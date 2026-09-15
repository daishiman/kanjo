/**
 * kanjo-console Worker エントリ。
 * - /api/auth/*: ログイン(アプリ内セッション)。Access併用時は不要だが常設(冪等)
 * - /api/*: 認証必須のREST(spec §9)
 * - それ以外: Workers Assets がSPAを配信(データを含まないため公開)
 * - scheduled: 夜間バックアップ(統合JSON→R2 backups/、30日保持)
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { type RequestIdVariables, requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { runAuditDetailRetention, runAuditHeaderRetention } from './audit-log.js';
import { type AuthEnv, type AuthVariables, authGuard, mustChangePasswordFence } from './auth.js';
import { canonicalMutationFence } from './canonical-mutation-fence.js';
import { runDeletionRetention } from './deletion-retention.js';
import { cleanupStalePasswordLoginRateLimits } from './login-rate-limit.js';
import { runR2Cleanup } from './r2-cleanup.js';
import { adminUsersRoute } from './routes/admin-users.js';
import { aiAgentRoute, aiRoute } from './routes/ai.js';
import { analysisHubRoute } from './routes/analysis-hub.js';
import { analyticsRoute } from './routes/analytics.js';
import { authRoute } from './routes/auth.js';
import { balancesRoute } from './routes/balances.js';
import { cashRoute } from './routes/cash.js';
import { classifyRoute } from './routes/classify.js';
import { deletionsRoute } from './routes/deletions.js';
import { importDiffRoute } from './routes/import-diff.js';
import { importsRoute } from './routes/imports.js';
import { improvementAgentRoute, improvementRoute, runImprovementRetention } from './routes/improvement.js';
import { settingsRoute } from './routes/settings.js';
import { subsRoute } from './routes/subs.js';
import { totalCashflowRoute } from './routes/total-cashflow.js';
import { vendorMemoryRoute } from './routes/vendor-memory.js';
import {
  SCHEDULED_MAINTENANCE_D1_PLAN,
  type ScheduledMaintenanceJobName,
} from './scheduled-maintenance-budget.js';
import { runtimeSchemaGuard } from './schema-guard.js';
import { getDb, loadBackupPayload } from './store.js';
import { cleanupExpiredTemporaryPasswords } from './users.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables & RequestIdVariables };

export const app = new Hono<Ctx>();

// 外から渡されたIDは短い安全文字だけを受理し、それ以外はUUIDへ置き換える。
// 失敗応答とログを同じIDで結び、内部値をクライアントへ出さずに調査可能にする。
app.use('*', requestId({ limitLength: 64 }));

// APIレスポンスの防御境界。静的アセット側は packages/web/public/_headers に同じ値を置き、
// index.test.ts の契約テストで差分を止める。
// Reactの既存inline styleを維持するためstyle-srcだけunsafe-inlineを許可する。
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'blob:', 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
    permissionsPolicy: {
      // カメラを使う機能は無い。証憑撮影の廃止に伴い許可も外す。
      camera: [],
      geolocation: [],
      microphone: [],
      payment: [],
      usb: [],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    xFrameOptions: 'DENY',
  }),
);

/* -------- 認証エンドポイント(未認証で到達可能なのはここだけ) -------- */

// 公開JSON endpointを巨大bodyの読み込み前に止める。CSV/画像uploadは別routeの上限を使う。
app.use(
  '/api/auth/*',
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) =>
      c.json({ error: { code: 'payload_too_large', message: 'リクエストが大きすぎます' } }, 413),
  }),
);
app.route('/api', authRoute);

// AIエージェント用(依頼ごとの使い捨てトークンで認証。セッション不要)
app.route('/api', aiAgentRoute);
// 改善要望のエージェント取得も同型。要望ごとの使い捨てトークン(Bearer)で認証する
app.route('/api', improvementAgentRoute);

/* -------- 保護されたAPI -------- */

app.use('/api/*', authGuard());
// 一時パスワードのまま業務データへ触らせない。画面側の分岐はURL直打ちで越えられる。
app.use('/api/*', mustChangePasswordFence());
app.use('/api/*', runtimeSchemaGuard);
app.use('/api/*', canonicalMutationFence());
app.route('/api', adminUsersRoute);
app.route('/api', aiRoute);
// 差分は importsRoute より先に載せる。/imports/:id 形のルートに /imports/diff を拾わせない
app.route('/api', importDiffRoute);
app.route('/api', importsRoute);
app.route('/api', deletionsRoute);
app.route('/api', cashRoute);
app.route('/api', analyticsRoute);
app.route('/api', classifyRoute);
app.route('/api', vendorMemoryRoute);
app.route('/api', settingsRoute);
app.route('/api', subsRoute);
app.route('/api', balancesRoute);
app.route('/api', totalCashflowRoute);
app.route('/api', analysisHubRoute);
app.route('/api', improvementRoute);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: { code: 'not_found', message: 'エンドポイントがありません' } }, 404);
  }
  // SPAフォールバックは Workers Assets 側(not_found_handling)が担当
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  // 金融明細のため、エラーログにも明細内容・金額は出さない。
  // ただし種別だけでは本番の障害を追えない(どの行で落ちたか分からず、再現に何時間もかかる)。
  // スタックはコードの位置しか含まないので、先頭数フレームだけ残す。message は
  // 値を埋め込んで投げる箇所があり得るため出さない。
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: c.get('requestId'),
      path: c.req.path,
      name: err.name,
      // message は複数行のことがあり(drizzle は失敗したSQLの実パラメータを並べる)、
      // 行番号で切ると明細IDが混ざる。「at 〜」で始まる呼び出し位置の行だけを採る。
      at: (err.stack ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('at '))
        .slice(0, 4),
    }),
  );
  return c.json(
    {
      error: {
        code: 'internal',
        message: 'サーバーエラーが発生しました',
        requestId: c.get('requestId'),
      },
    },
    500,
  );
});

/* -------- 夜間バックアップ(cron) -------- */

interface NightlyBackupSummary {
  stored: 1;
  deleted: number;
}

async function nightlyBackup(env: Pick<AuthEnv, 'DB' | 'FILES'>): Promise<NightlyBackupSummary> {
  const db = getDb(env.DB);
  const payload = await loadBackupPayload(db, 'default');
  const today = new Date().toISOString().slice(0, 10);
  await env.FILES.put(`backups/${today}.json`, JSON.stringify(payload));
  // 30日より古いバックアップを削除
  const list = await env.FILES.list({ prefix: 'backups/' });
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let deleted = 0;
  for (const obj of list.objects) {
    const day = obj.key.slice('backups/'.length, 'backups/'.length + 10);
    if (day && day < cutoff) {
      await env.FILES.delete(obj.key);
      deleted += 1;
    }
  }
  return { stored: 1, deleted };
}

/** R2 key/filename/user IDをログへ出さず、bounded jobの件数だけを残す。 */
export async function scheduledMaintenance(
  env: Pick<AuthEnv, 'DB' | 'FILES'> & Partial<AuthEnv>,
): Promise<void> {
  // 回復資産を先に確定する。backup失敗時も後続の独立jobは観測のため実行する。
  const [backup] = await Promise.allSettled([nightlyBackup(env)]);
  type ConcurrentJobName = Exclude<ScheduledMaintenanceJobName, 'nightly_backup'>;
  // Recordで予算表と実行jobを型結合する。jobの追加・宣言漏れはtypecheckで止まる。
  const concurrentJobs = {
    r2_cleanup: runR2Cleanup(env),
    password_login_rate_limit_cleanup: Promise.all([
      cleanupStalePasswordLoginRateLimits(env),
      cleanupExpiredTemporaryPasswords(env.DB),
    ]),
    improvement_retention: runImprovementRetention(env),
    deletion_undo_retention: runDeletionRetention(env),
    audit_header_retention: runAuditHeaderRetention(env),
    audit_detail_retention: runAuditDetailRetention(env),
  } satisfies Record<ConcurrentJobName, Promise<unknown>>;
  const [
    r2Cleanup,
    loginRateLimit,
    improvement,
    deletionRetention,
    auditHeaderRetention,
    auditDetailRetention,
  ] = await Promise.allSettled([
    concurrentJobs.r2_cleanup,
    concurrentJobs.password_login_rate_limit_cleanup,
    concurrentJobs.improvement_retention,
    concurrentJobs.deletion_undo_retention,
    concurrentJobs.audit_header_retention,
    concurrentJobs.audit_detail_retention,
  ]);
  console.log(
    JSON.stringify({
      level: 'info',
      job: 'scheduled_maintenance_budget',
      plannedQueries: SCHEDULED_MAINTENANCE_D1_PLAN.total,
      limit: SCHEDULED_MAINTENANCE_D1_PLAN.limit,
    }),
  );
  if (backup.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'nightly_backup',
        stored: backup.value.stored,
        deleted: backup.value.deleted,
      }),
    );
  } else {
    console.error(JSON.stringify({ level: 'error', job: 'nightly_backup', name: errorName(backup.reason) }));
  }
  if (r2Cleanup.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'r2_cleanup',
        selected: r2Cleanup.value.selected,
        completed: r2Cleanup.value.completed,
        retried: r2Cleanup.value.retried,
        dead: r2Cleanup.value.dead,
        importJobsEnqueued: r2Cleanup.value.importJobsEnqueued,
      }),
    );
  } else {
    console.error(JSON.stringify({ level: 'error', job: 'r2_cleanup', name: errorName(r2Cleanup.reason) }));
  }
  if (loginRateLimit.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'password_login_rate_limit_cleanup',
        deleted: loginRateLimit.value[0],
        expiredTemporaryPasswords: loginRateLimit.value[1],
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'password_login_rate_limit_cleanup',
        name: errorName(loginRateLimit.reason),
      }),
    );
  }
  if (improvement.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'improvement_retention',
        selected: improvement.value.selected,
        purged: improvement.value.purged,
        failed: improvement.value.failed,
        orphans: improvement.value.orphans,
        orphanScanned: improvement.value.orphanScanned,
        orphanDeferredRecent: improvement.value.orphanDeferredRecent,
        orphanHasMore: improvement.value.orphanHasMore,
        orphanCycleCompleted: improvement.value.orphanCycleCompleted,
      }),
    );
  } else {
    console.error(
      JSON.stringify({ level: 'error', job: 'improvement_retention', name: errorName(improvement.reason) }),
    );
  }
  if (deletionRetention.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'deletion_undo_retention',
        metadata: deletionRetention.value.metadata,
        rows: deletionRetention.value.rows,
        targets: deletionRetention.value.targets,
        early: deletionRetention.value.early,
        bytes: deletionRetention.value.bytes,
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'deletion_undo_retention',
        name: errorName(deletionRetention.reason),
      }),
    );
  }
  if (auditHeaderRetention.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'audit_header_retention',
        expired: auditHeaderRetention.value.expired,
        early: auditHeaderRetention.value.early,
        beforeRows: auditHeaderRetention.value.before.rows,
        beforeBytes: auditHeaderRetention.value.before.bytes,
        afterRows: auditHeaderRetention.value.after.rows,
        afterBytes: auditHeaderRetention.value.after.bytes,
        queries: auditHeaderRetention.value.queries,
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'audit_header_retention',
        name: errorName(auditHeaderRetention.reason),
      }),
    );
  }
  if (auditDetailRetention.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'audit_detail_retention',
        expired: auditDetailRetention.value.expired,
        early: auditDetailRetention.value.early,
        beforeRows: auditDetailRetention.value.before.rows,
        beforeBytes: auditDetailRetention.value.before.bytes,
        afterRows: auditDetailRetention.value.after.rows,
        afterBytes: auditDetailRetention.value.after.bytes,
        queries: auditDetailRetention.value.queries,
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'audit_detail_retention',
        name: errorName(auditDetailRetention.reason),
      }),
    );
  }
  // 全jobを完走・個別記録してからCronへ失敗を返す。飲み込むとPast Eventsが成功になり、
  // 後始末が止まった事実を運用から観測できない。元errorのmessageは外へ出さない。
  if (
    [
      backup,
      r2Cleanup,
      loginRateLimit,
      improvement,
      deletionRetention,
      auditHeaderRetention,
      auditDetailRetention,
    ].some((result) => result.status === 'rejected')
  ) {
    throw new Error('scheduled_maintenance_failed');
  }
}

const errorName = (reason: unknown): string => (reason instanceof Error ? reason.name : 'UnknownError');

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: AuthEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scheduledMaintenance(env));
  },
};
