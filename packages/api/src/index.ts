import { settingsJsonFromBackup, summarizeSettings, validateSettingsJson } from '@kanjo/core';
import { getSessionCookie } from 'better-auth/cookies';
/**
 * kanjo-console Worker エントリ。
 * - /api/auth/*: ログイン(アプリ内セッション)。Access併用時は不要だが常設(冪等)
 * - /api/*: 認証必須のREST(spec §9)
 * - それ以外: Workers Assets がSPAを配信(データを含まないため公開)
 * - scheduled: 夜間バックアップ(統合JSON→R2 backups/、JST 2:00、30日保持)
 */
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { type RequestIdVariables, requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { runAuditDetailRetention, runAuditHeaderRetention } from './audit-log.js';
import { writeLegacyAuthAudit } from './auth-audit.js';
import { runScheduledAuthCleanup } from './auth-cleanup.js';
import {
  AUTH_RATE_LIMIT_ERROR,
  authRetryAfterSeconds,
  clearAuthRateLimit,
  inspectAuthRateLimit,
  recordAuthRateLimitFailure,
} from './auth-rate-limit.js';
import {
  type AuthEnv,
  type AuthVariables,
  authGuard,
  authModePolicy,
  authRuntime,
  authenticateAccessUser,
  resolveAuthMode,
} from './auth.js';
import { compensateFailedGoogleProvisioning } from './better-auth.js';
import { canonicalMutationFence } from './canonical-mutation-fence.js';
import { cashPurgeLogLine, runCashSoftDeletePurge } from './cash-purge.js';
import { runDeletionRetention } from './deletion-retention.js';
import { importOriginGuard, runImportStagingCleanup } from './import-rate-limit.js';
import { PRIVATE_NO_STORE } from './public-validation.js';
import { runR2Cleanup } from './r2-cleanup.js';
import { accountRoute } from './routes/account.js';
import { adminUsersRoute } from './routes/admin-users.js';
import { aiAgentRoute, aiRoute } from './routes/ai.js';
import { analysisHubRoute } from './routes/analysis-hub.js';
import { analyticsRoute } from './routes/analytics.js';
import { backupsRoute, listAllBackups } from './routes/backups.js';
import { balancesRoute } from './routes/balances.js';
import { budgetPlansRoute } from './routes/budget-plans.js';
import { cashRoute } from './routes/cash.js';
import { classifyBulkRoute } from './routes/classify-bulk.js';
import { classifyRoute } from './routes/classify.js';
import { deletionsRoute } from './routes/deletions.js';
import { importDiffRoute } from './routes/import-diff.js';
import { importsRoute } from './routes/imports.js';
import { improvementAgentRoute, improvementRoute, runImprovementRetention } from './routes/improvement.js';
import { reconciliationRoute } from './routes/reconciliation.js';
import { savedFiltersRoute } from './routes/saved-filters.js';
import { settingsScreenRoute } from './routes/settings-screen.js';
import { settingsRoute } from './routes/settings.js';
import { statusRoute } from './routes/status.js';
import { subsRoute } from './routes/subs.js';
import { totalCashflowRoute } from './routes/total-cashflow.js';
import { tradeoffRoute } from './routes/tradeoff.js';
import { vendorMemoryRoute } from './routes/vendor-memory.js';
import {
  SCHEDULED_MAINTENANCE_D1_PLAN,
  type ScheduledMaintenanceJobName,
} from './scheduled-maintenance-budget.js';
import { runtimeSchemaGuard } from './schema-guard.js';
import { getDb, loadBackupPayload } from './store.js';
import { findAccountUserDetails, findUserByEmail, normalizeEmail } from './users.js';

/** Better AuthのOAuth失敗はHTTP 302 + Locationのerror queryで表される。 */
export function isFailedOAuthCallbackResponse(response: Response, requestUrl: string): boolean {
  if (response.status >= 400) return true;
  if (response.status < 300 || response.status >= 400) return false;
  const location = response.headers.get('Location');
  if (!location) return true;
  try {
    // 監査分類のために解釈するだけで、このURLへfetch/再redirectはしない。
    return new URL(location, requestUrl).searchParams.has('error');
  } catch {
    return true;
  }
}

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables & RequestIdVariables };

export const app = new Hono<Ctx>();
const apiSchemaGuard = runtimeSchemaGuard as unknown as MiddlewareHandler<Ctx>;

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

// 内部構成を含めない公開probe。authRuntime/authGuardより先に確定する。
app.route('/api', statusRoute);

// Access/Better Authの選択を、公開ログイン入口・schema gate・保護APIより上流で1回だけ確定する。
app.use('/api/*', authModePolicy());

// 公開JSON endpointを巨大bodyの読み込み前に止める。CSV/画像uploadは別routeの上限を使う。
app.use(
  '/api/auth/*',
  bodyLimit({
    maxSize: 16 * 1024,
    onError: (c) =>
      c.json({ error: { code: 'payload_too_large', message: 'リクエストが大きすぎます' } }, 413),
  }),
);

// auth tableへ触る前に0059を確認する。CookieもBearerも無い保護routeだけは、
// D1へ触れず従来どおりauthGuardの401へ落とす。
app.use('/api/*', async (c, next) => {
  const needsSchema =
    c.req.path.startsWith('/api/auth/') ||
    Boolean(getSessionCookie(c.req.raw, { cookiePrefix: 'kanjo' })) ||
    Boolean(c.req.header('Authorization')) ||
    resolveAuthMode(c.env) === 'cloudflare-access';
  if (!needsSchema) return next();
  return apiSchemaGuard(c, next);
});

// 1要求につき1個だけBetter Authを組み、handlerとauthGuardで共有する。
app.use('/api/*', authRuntime());

// Accessモードで唯一公開する認証DTO。assertion検証は保護APIと同じ境界を使い、Better Auth sessionは作らない。
app.get('/api/auth/me', async (c, next) => {
  if (resolveAuthMode(c.env) !== 'cloudflare-access') return next();
  const user = await authenticateAccessUser(c.env, c.req.header('Cf-Access-Jwt-Assertion'));
  if (!user) {
    return c.json({ error: { code: 'unauthorized', message: '認証が必要です' } }, 401, {
      'Cache-Control': 'no-store',
    });
  }
  const details = await findAccountUserDetails(c.env.DB, user.id);
  if (!details) {
    return c.json({ error: { code: 'unauthorized', message: '認証が必要です' } }, 401, {
      'Cache-Control': 'no-store',
    });
  }
  return c.json({ authenticated: true, user: details }, 200, { 'Cache-Control': 'no-store' });
});

// Better Auth/pluginが増やすendpointを暗黙公開しない。仕様にあるmethod/pathだけを許す。
const allowedAuthRoutes = new Map<string, ReadonlySet<string>>([
  ['/api/auth/callback/google', new Set(['GET'])],
  ['/api/auth/me', new Set(['GET'])],
  ['/api/auth/sign-in/email', new Set(['POST'])],
  ['/api/auth/sign-in/social', new Set(['POST'])],
  ['/api/auth/sign-out', new Set(['POST'])],
  ['/api/auth/reset-password', new Set(['POST'])],
  ['/api/auth/change-password', new Set(['POST'])],
  ['/api/auth/link-social', new Set(['POST'])],
  ['/api/auth/unlink-account', new Set(['POST'])],
  ['/api/auth/two-factor/enable', new Set(['POST'])],
  ['/api/auth/two-factor/disable', new Set(['POST'])],
  ['/api/auth/two-factor/verify-totp', new Set(['POST'])],
  ['/api/auth/two-factor/verify-backup-code', new Set(['POST'])],
  ['/api/auth/two-factor/generate-backup-codes', new Set(['POST'])],
  ['/api/auth/mfa-setup/start', new Set(['POST'])],
  ['/api/auth/mfa-setup/complete', new Set(['POST'])],
  ['/api/auth/invite/inspect', new Set(['POST'])],
  ['/api/auth/invite/accept', new Set(['POST'])],
  ['/api/auth/invite/resend-request', new Set(['POST'])],
  ['/api/auth/password-reset/request', new Set(['POST'])],
]);

app.all('/api/auth/*', async (c) => {
  if (!allowedAuthRoutes.get(c.req.path)?.has(c.req.method)) {
    return c.json({ error: { code: 'not_found', message: 'エンドポイントがありません' } }, 404);
  }
  const auth = c.get('auth');
  const scope = c.get('authScope');
  if (!auth || !scope) {
    return c.json({ error: { code: 'auth_not_configured', message: '認証が未設定です' } }, 503);
  }

  // Google OAuthは設定漏れを provider_not_found に丸めず、運用者が原因を特定できる形で止める。
  // secret値そのものは応答にもログにも含めない。
  let isGoogleAuth = c.req.path === '/api/auth/callback/google';
  if (c.req.path === '/api/auth/sign-in/social') {
    try {
      const body = (await c.req.raw.clone().json()) as { provider?: unknown };
      isGoogleAuth = body.provider === 'google';
    } catch {
      // Better Authのvalidationへ委ねる。
    }
  }
  if (isGoogleAuth && (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET)) {
    return c.json({ error: { code: 'google_auth_not_configured', message: 'Google認証が未設定です' } }, 503, {
      'Cache-Control': 'no-store',
    });
  }

  const isPassword = c.req.path === '/api/auth/sign-in/email';
  const isMfa =
    c.req.path === '/api/auth/two-factor/verify-totp' ||
    c.req.path === '/api/auth/two-factor/verify-backup-code';
  let rate: Awaited<ReturnType<typeof inspectAuthRateLimit>> | null = null;
  let rateAccount: string | undefined;
  if (isPassword || isMfa) {
    if (isPassword) {
      try {
        const body = (await c.req.raw.clone().json()) as { email?: unknown };
        if (typeof body.email === 'string') rateAccount = normalizeEmail(body.email);
      } catch {
        // Better Authのvalidationへ渡す。ここで別のerror形を作らない。
      }
    }
    rate = await inspectAuthRateLimit(c.env.DB, isPassword ? 'login' : 'mfa', c.req.raw, rateAccount);
    if (rate.lockedUntil) {
      return c.json(
        {
          error: {
            ...AUTH_RATE_LIMIT_ERROR,
            retryAfterSeconds: authRetryAfterSeconds(rate.lockedUntil),
          },
        },
        429,
        { 'Retry-After': String(authRetryAfterSeconds(rate.lockedUntil)), 'Cache-Control': 'no-store' },
      );
    }
  }

  const isGoogleCallback = c.req.path === '/api/auth/callback/google';
  let response: Response;
  try {
    response = await auth.handler(c.req.raw);
  } catch (error) {
    if (isGoogleCallback) await compensateFailedGoogleProvisioning(c.env.DB, scope);
    throw error;
  }
  response.headers.set('Cache-Control', 'no-store');
  if (scope.mfaSetup && isPassword) {
    if (rate) await clearAuthRateLimit(c.env.DB, rate);
    return c.json({ mfaSetupRequired: true, ...scope.mfaSetup }, 200, { 'Cache-Control': 'no-store' });
  }
  const failedGoogleCallback = isGoogleCallback && isFailedOAuthCallbackResponse(response, c.req.raw.url);
  if (failedGoogleCallback) await compensateFailedGoogleProvisioning(c.env.DB, scope);
  const isLoginAttempt = isPassword || isMfa || isGoogleCallback;
  if (scope.auditLoginUserId && response.status < 400 && !failedGoogleCallback) {
    await writeLegacyAuthAudit(c.env.DB, {
      action: 'auth_login',
      actorUserId: scope.auditLoginUserId,
      result: 'succeeded',
    });
  } else if (isLoginAttempt && (response.status >= 400 || failedGoogleCallback)) {
    const known = rateAccount ? await findUserByEmail(c.env.DB, rateAccount) : null;
    await writeLegacyAuthAudit(c.env.DB, {
      action: 'auth_login_failed',
      actorUserId: known?.id ?? null,
      result: 'failed',
    });
  }
  if (scope.auditLogoutUserId && c.req.path === '/api/auth/sign-out' && response.status < 400) {
    await writeLegacyAuthAudit(c.env.DB, {
      action: 'auth_logout',
      actorUserId: scope.auditLogoutUserId,
      result: 'succeeded',
    });
  }
  if (rate) {
    if (response.ok) await clearAuthRateLimit(c.env.DB, rate);
    else await recordAuthRateLimitFailure(c.env.DB, rate);
  }
  if (isPassword && response.status === 401) {
    return c.json(
      { error: { code: 'invalid_credentials', message: 'メールアドレスまたはパスワードが違います' } },
      401,
      { 'Cache-Control': 'no-store' },
    );
  }
  return response;
});

// AIエージェント用(依頼ごとの使い捨てトークンで認証。セッション不要)
app.route('/api', aiAgentRoute);
// 改善要望のエージェント取得も同型。要望ごとの使い捨てトークン(Bearer)で認証する
app.route('/api', improvementAgentRoute);

/* -------- 保護されたAPI -------- */

app.use('/api/*', authGuard());
app.use('/api/*', canonicalMutationFence());
// 取込の変更要求は Origin を自サイトに限る (security 章)。GET は対象外
app.use('/api/imports', importOriginGuard());
app.use('/api/imports/*', importOriginGuard());
app.route('/api', adminUsersRoute);
app.route('/api', accountRoute);
app.route('/api', aiRoute);
// 差分は importsRoute より先に載せる。/imports/:id 形のルートに /imports/diff を拾わせない
app.route('/api', importDiffRoute);
app.route('/api', importsRoute);
app.route('/api', deletionsRoute);
app.route('/api', cashRoute);
app.route('/api', analyticsRoute);
app.route('/api', tradeoffRoute);
app.route('/api', classifyRoute);
app.route('/api', classifyBulkRoute);
app.route('/api', savedFiltersRoute);
app.route('/api', vendorMemoryRoute);
app.route('/api', settingsScreenRoute);
app.route('/api', settingsRoute);
app.route('/api', backupsRoute);
app.route('/api', budgetPlansRoute);
app.route('/api', subsRoute);
app.route('/api', balancesRoute);
app.route('/api', totalCashflowRoute);
app.route('/api', reconciliationRoute);
app.route('/api', analysisHubRoute);
app.route('/api', improvementRoute);

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: { code: 'not_found', message: 'エンドポイントがありません' } }, 404);
  }
  // SPAフォールバックは Workers Assets 側(not_found_handling)が担当
  return c.env.ASSETS.fetch(c.req.raw);
});

/**
 * D1 は 1 つの DB への要求が溜まりすぎると、SQL を実行する前に
 * `D1_ERROR: D1 DB is overloaded. Too many requests queued.` で拒否する。
 * 実行前の拒否なので未適用であり、同じ Idempotency-Key で送り直してよい。
 * 「適用されたか分からない」500 と分けるため、503 d1_overloaded (retryable) に言い換える。
 *
 * ただし「未適用」と保証できるのは、書込みを 1 回の D1 batch で行う route だけ
 * (サブスクの操作は commitOperation の 1 batch)。複数の batch や個別の文に分けて書く route では、
 * 前の batch が適用済みのまま後の要求で拒否されうる。自動再送の対象を広げるときは、
 * その route が 1 batch で書くかを確かめる。
 */
const isD1Overloaded = (err: Error): boolean => err.message.includes('D1 DB is overloaded');

app.onError((err, c) => {
  if (isD1Overloaded(err)) {
    console.error(
      JSON.stringify({
        level: 'warn',
        event: 'd1_overloaded',
        requestId: c.get('requestId'),
        path: c.req.path,
      }),
    );
    return c.json(
      {
        error: {
          code: 'd1_overloaded',
          message: 'データベースが混み合っています。少し待ってから再試行してください',
          retryable: true,
        },
      },
      503,
      PRIVATE_NO_STORE,
    );
  }
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

/** 夜間バックアップの日付。cron は UTC 17:00 (= JST 2:00) に動くので、日付は JST で切る */
export const jstDate = (ms: number): string => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

const BACKUP_RETENTION_DAYS = 30;

/**
 * 一覧に出す設定の要約。D1 を読み直さず、置く本文そのものから作る
 * (D1 の読込は本文の 1 回だけ、かつ要約とその回の中身が必ず一致する)。読めなければ要約なしで置く。
 */
function backupSettingsSummary(payload: Record<string, unknown>, exportedAt: string): string | undefined {
  const checked = validateSettingsJson(settingsJsonFromBackup(payload, exportedAt));
  if (!checked.ok) return undefined;
  const labels = payload.ownerLabels;
  const ownerLabelsSaved = typeof labels === 'object' && labels !== null && Object.keys(labels).length > 0;
  return JSON.stringify(summarizeSettings(checked.value, ownerLabelsSaved));
}

/**
 * 1 回ぶんの夜間バックアップ。設定画面の一覧が読む customMetadata (状態・メモ・設定の要約・形式の版) を付ける。
 * 置けなかった回は `YYYY-MM-DD.failed.json` を残し、一覧に『失敗』として出す (黙って欠けさせない)。
 * 30 日より古い回は、失敗の印と復元前の退避 (pre-restore/) も含めて消す。
 */
export async function nightlyBackup(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  nowMs: number = Date.now(),
): Promise<NightlyBackupSummary> {
  const db = getDb(env.DB);
  const today = jstDate(nowMs);
  let failed = false;
  try {
    const payload = await loadBackupPayload(db, 'default');
    const summary = backupSettingsSummary(payload, new Date(nowMs).toISOString());
    await env.FILES.put(`backups/${today}.json`, JSON.stringify(payload), {
      customMetadata: {
        status: 'success',
        memo: '自動バックアップ',
        ...(summary ? { summary } : {}),
        formatVersion: '1',
      },
    });
  } catch {
    failed = true;
    await env.FILES.put(`backups/${today}.failed.json`, JSON.stringify({ reason: 'put_failed' }), {
      customMetadata: { status: 'failed', memo: '自動バックアップ', reason: 'put_failed' },
    });
  }

  const cutoff = jstDate(nowMs - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deleted = 0;
  for (const obj of await listAllBackups(env.FILES)) {
    const rest = obj.key.slice('backups/'.length);
    const day = (rest.startsWith('pre-restore/') ? rest.slice('pre-restore/'.length) : rest).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < cutoff) {
      await env.FILES.delete(obj.key);
      deleted += 1;
    }
  }
  if (failed) throw new Error('nightly backup put failed');
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
    password_login_rate_limit_cleanup: runScheduledAuthCleanup(env.DB),
    improvement_retention: runImprovementRetention(env),
    deletion_undo_retention: runDeletionRetention(env),
    audit_header_retention: runAuditHeaderRetention(env),
    audit_detail_retention: runAuditDetailRetention(env),
    cash_soft_delete_purge: runCashSoftDeletePurge(env),
  } satisfies Record<ConcurrentJobName, Promise<unknown>>;
  // D1 を 1 本も使わない job は query 予算の表に載せない (載せると使わない枠を他から奪う)。
  const importStagingCleanup = runImportStagingCleanup(env);
  const [
    r2Cleanup,
    loginRateLimit,
    improvement,
    deletionRetention,
    auditHeaderRetention,
    auditDetailRetention,
    cashPurge,
    importStaging,
  ] = await Promise.allSettled([
    concurrentJobs.r2_cleanup,
    concurrentJobs.password_login_rate_limit_cleanup,
    concurrentJobs.improvement_retention,
    concurrentJobs.deletion_undo_retention,
    concurrentJobs.audit_header_retention,
    concurrentJobs.audit_detail_retention,
    concurrentJobs.cash_soft_delete_purge,
    importStagingCleanup,
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
        deleted: loginRateLimit.value.rateLimitsDeleted,
        retentionKind: loginRateLimit.value.kind,
        retentionDeleted: loginRateLimit.value.deleted,
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
        erased: improvement.value.erased,
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
  if (importStaging.status === 'fulfilled') {
    console.log(
      JSON.stringify({
        level: 'info',
        job: 'import_staging_cleanup',
        staged: importStaging.value.staged,
      }),
    );
  } else {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'import_staging_cleanup',
        name: errorName(importStaging.reason),
      }),
    );
  }
  if (cashPurge.status === 'fulfilled') {
    const line = cashPurgeLogLine(cashPurge.value);
    if (cashPurge.value.limitReached) console.warn(JSON.stringify(line));
    else console.log(JSON.stringify(line));
  } else {
    console.error(
      JSON.stringify({ level: 'error', job: 'cash_soft_delete_purge', name: errorName(cashPurge.reason) }),
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
      importStaging,
      cashPurge,
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
