import { zValidator } from '@hono/zod-validator';
/**
 * kanjo-console Worker エントリ。
 * - /api/auth/*: ログイン(アプリ内セッション)。Access併用時は不要だが常設(冪等)
 * - /api/*: 認証必須のREST(spec §9)
 * - それ以外: Workers Assets がSPAを配信(データを含まないため公開)
 * - scheduled: 夜間バックアップ(統合JSON→R2 backups/、30日保持)
 */
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { ATTACHMENT_AVAILABILITY_ERROR, AttachmentAvailabilityError } from './attachment-availability.js';
import { runAttachmentMaintenance } from './attachment-recovery.js';
import { type AuthEnv, authGuard, clearSession, issueSession, verifyPassword } from './auth.js';
import { canonicalMutationFence } from './canonical-mutation-fence.js';
import {
  PASSWORD_LOGIN_RATE_LIMIT_ERROR,
  cleanupStalePasswordLoginRateLimits,
  clearPasswordLoginRateLimit,
  inspectPasswordLoginRateLimit,
  passwordLoginRateLimitConfig,
  passwordLoginRetryAfterSeconds,
  recordPasswordLoginFailure,
} from './login-rate-limit.js';
import { aiAgentRoute, aiRoute } from './routes/ai.js';
import { analyticsRoute } from './routes/analytics.js';
import { attachmentsRoute } from './routes/attachments.js';
import { balancesRoute } from './routes/balances.js';
import { cashRoute } from './routes/cash.js';
import { classifyRoute } from './routes/classify.js';
import { importsRoute } from './routes/imports.js';
import { improvementAgentRoute, improvementRoute, runImprovementRetention } from './routes/improvement.js';
import { settingsRoute } from './routes/settings.js';
import { subsRoute } from './routes/subs.js';
import { taxRoute } from './routes/tax.js';
import { runtimeSchemaGuard } from './schema-guard.js';
import { getDb, loadBackupPayload } from './store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const app = new Hono<Ctx>();

// APIとWorkers Assetsの全レスポンスで同じ防御境界を使う。
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
      // 証憑撮影は同一originのfile inputから使う。埋め込み先へは許可しない。
      camera: ['self'],
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

const loginSchema = z.object({ password: z.string().min(1).max(500) });

app.post('/api/auth/login', zValidator('json', loginSchema), async (c) => {
  const env = c.env;
  if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
    return c.json({ error: { code: 'access_mode', message: 'Cloudflare Access認証を使用しています' } }, 400);
  }
  if (!env.AUTH_PASSWORD || !env.SESSION_SECRET) {
    return c.json({ error: { code: 'auth_not_configured', message: '認証が未設定です' } }, 503);
  }
  const config = passwordLoginRateLimitConfig(env);
  const rateLimit = await inspectPasswordLoginRateLimit(env.DB, c.req.raw);
  if (rateLimit.lockedUntil) {
    const retryAfterSeconds = passwordLoginRetryAfterSeconds(rateLimit.lockedUntil);
    c.header('Retry-After', String(retryAfterSeconds));
    return c.json({ error: PASSWORD_LOGIN_RATE_LIMIT_ERROR, retryAfterSeconds }, 429);
  }
  const { password } = c.req.valid('json');
  if (!(await verifyPassword(password, env.AUTH_PASSWORD))) {
    const failure = await recordPasswordLoginFailure(env.DB, rateLimit, config);
    if (failure.lockedUntil) {
      const retryAfterSeconds = passwordLoginRetryAfterSeconds(failure.lockedUntil);
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json({ error: PASSWORD_LOGIN_RATE_LIMIT_ERROR, retryAfterSeconds }, 429);
    }
    return c.json({ error: { code: 'invalid_credentials', message: 'パスワードが違います' } }, 401);
  }
  await clearPasswordLoginRateLimit(env.DB, rateLimit);
  await issueSession(c, env.SESSION_SECRET);
  return c.json({ ok: true });
});

app.post('/api/auth/logout', (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

// 認証状態の確認(ガードを通れば200)
app.get('/api/auth/me', authGuard(), (c) => c.json({ authenticated: true }));

// AIエージェント用(依頼ごとの使い捨てトークンで認証。セッション不要)
app.route('/api', aiAgentRoute);
// 改善要望のエージェント取得も同型。要望ごとの使い捨てトークン(Bearer)で認証する
app.route('/api', improvementAgentRoute);

/* -------- 保護されたAPI -------- */

app.use('/api/*', authGuard());
app.use('/api/*', runtimeSchemaGuard);
app.use('/api/*', canonicalMutationFence());
app.route('/api', aiRoute);
app.route('/api', importsRoute);
app.route('/api', cashRoute);
app.route('/api', analyticsRoute);
app.route('/api', classifyRoute);
app.route('/api', settingsRoute);
app.route('/api', subsRoute);
app.route('/api', attachmentsRoute);
app.route('/api', balancesRoute);
app.route('/api', taxRoute);
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
  if (err instanceof AttachmentAvailabilityError)
    return c.json({ error: ATTACHMENT_AVAILABILITY_ERROR }, 503);
  return c.json({ error: { code: 'internal', message: 'サーバーエラーが発生しました' } }, 500);
});

/* -------- 夜間バックアップ(cron) -------- */

async function nightlyBackup(env: Pick<AuthEnv, 'DB' | 'FILES'>): Promise<void> {
  const db = getDb(env.DB);
  const payload = await loadBackupPayload(db, 'default');
  const today = new Date().toISOString().slice(0, 10);
  await env.FILES.put(`backups/${today}.json`, JSON.stringify(payload));
  // 30日より古いバックアップを削除
  const list = await env.FILES.list({ prefix: 'backups/' });
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const obj of list.objects) {
    const day = obj.key.slice('backups/'.length, 'backups/'.length + 10);
    if (day && day < cutoff) await env.FILES.delete(obj.key);
  }
  console.log(JSON.stringify({ level: 'info', job: 'nightly_backup', key: `backups/${today}.json` }));
}

/** R2 key/filename/user IDをログへ出さず、bounded jobの件数だけを残す。 */
export async function scheduledMaintenance(
  env: Pick<AuthEnv, 'DB' | 'FILES'> & Partial<AuthEnv>,
): Promise<void> {
  const [cleanup, backup, loginRateLimit, improvement] = await Promise.allSettled([
    runAttachmentMaintenance(env),
    nightlyBackup(env),
    cleanupStalePasswordLoginRateLimits(env),
    // 改善要望の添付は対応完了から30日で消す。新規 Cron は増やさずここへ相乗りさせる
    runImprovementRetention(env),
  ]);
  if (cleanup.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'attachment_maintenance',
        selected: cleanup.value.selected,
        completed: cleanup.value.completed,
        retried: cleanup.value.retried,
        dead: cleanup.value.dead,
        importJobsEnqueued: cleanup.value.importJobsEnqueued,
      }),
    );
  } else {
    console.error(
      JSON.stringify({ level: 'error', job: 'attachment_maintenance', name: errorName(cleanup.reason) }),
    );
  }
  if (backup.status === 'rejected') {
    console.error(JSON.stringify({ level: 'error', job: 'nightly_backup', name: errorName(backup.reason) }));
  }
  if (loginRateLimit.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'password_login_rate_limit_cleanup',
        deleted: loginRateLimit.value,
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
      }),
    );
  } else {
    console.error(
      JSON.stringify({ level: 'error', job: 'improvement_retention', name: errorName(improvement.reason) }),
    );
  }
  // 改善要望の削除失敗は throw に含めない。二次資産の後始末であり、次回の実行が同じ行を
  // 冪等に拾い直す。ここで throw すると記帳データのバックアップまで失敗扱いになる。
  if (cleanup.status === 'rejected' || backup.status === 'rejected' || loginRateLimit.status === 'rejected') {
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
