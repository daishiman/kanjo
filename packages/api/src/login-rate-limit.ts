import type { AuthEnv } from './auth.js';

const SECOND_MS = 1_000;
const MINUTE_SECONDS = 60;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * password login throttleのSSOT。非secret env overrideは範囲外ならこの安全な既定値へ戻す。
 * scope sourceはWorkersが付与するCF-Connecting-IPだけで、転送header本文はDB/logへ残さない。
 */
export const PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS = Object.freeze({
  windowSeconds: 15 * MINUTE_SECONDS,
  maxFailures: 5,
  lockSeconds: 15 * MINUTE_SECONDS,
  staleAfterSeconds: 7 * DAY_SECONDS,
  cleanupBatchSize: 100,
  /**
   * /api/auth/login 1回あたりのD1 query上限。共有パスワード時代は2本(throttle照会+更新)
   * だったが、利用者ごとの認証になり照合と記録が増えた。成功が最長で次の5本:
   * 二軸throttle照会 / users検索 / throttle解除 / 最終ログイン時刻 / 監査batch。
   * 二軸はIN/複数行UPSERTへまとめるため、失敗も4本のまま。ここを超える実装はログイン経路の
   * 肥大なので、増やす前に1本ずつ理由を説明できるかを問う。
   */
  routeMaxD1Queries: 5,
});

export const PASSWORD_LOGIN_RATE_LIMIT_ERROR = Object.freeze({
  code: 'login_rate_limited',
  message: 'ログイン試行回数が上限に達しました。時間をおいて再試行してください',
});

export interface PasswordLoginRateLimitConfig {
  windowMs: number;
  maxFailures: number;
  lockMs: number;
  staleAfterMs: number;
  cleanupBatchSize: number;
}

const configuredInteger = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
};

export function passwordLoginRateLimitConfig(env: Partial<AuthEnv>): PasswordLoginRateLimitConfig {
  const windowSeconds = configuredInteger(
    env.PASSWORD_LOGIN_WINDOW_SECONDS,
    PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.windowSeconds,
    MINUTE_SECONDS,
    60 * MINUTE_SECONDS,
  );
  const maxFailures = configuredInteger(
    env.PASSWORD_LOGIN_MAX_FAILURES,
    PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.maxFailures,
    3,
    20,
  );
  const lockSeconds = configuredInteger(
    env.PASSWORD_LOGIN_LOCK_SECONDS,
    PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.lockSeconds,
    MINUTE_SECONDS,
    DAY_SECONDS,
  );
  const configuredStaleSeconds = configuredInteger(
    env.PASSWORD_LOGIN_STALE_AFTER_SECONDS,
    PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.staleAfterSeconds,
    DAY_SECONDS,
    30 * DAY_SECONDS,
  );
  return {
    windowMs: windowSeconds * SECOND_MS,
    maxFailures,
    lockMs: lockSeconds * SECOND_MS,
    staleAfterMs: Math.max(configuredStaleSeconds, windowSeconds + lockSeconds) * SECOND_MS,
    cleanupBatchSize: PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.cleanupBatchSize,
  };
}

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

/**
 * CF-Connecting-IP以外へfallbackせず、欠損時も共有の匿名scopeとしてfail closedする。
 *
 * 送信元全体と対象アカウント全体を独立した2軸にする。複合ペア1鍵では、IPかemailを
 * 変えるだけで双方の集約を回避できる。scope_hashは不可逆で、材料そのものは保存しない。
 */
async function passwordLoginScopeHash(kind: 'ip' | 'account', material: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`kanjo:password-login:v3:${kind}:${material}`),
  );
  return hex(digest);
}

export async function passwordLoginScopeHashes(
  request: Request,
  email?: string,
): Promise<{ ip: string; account: string }> {
  const supplied = request.headers.get('CF-Connecting-IP')?.trim().toLowerCase();
  const source = supplied && supplied.length <= 128 ? supplied : 'missing-or-invalid';
  const account = email?.trim().toLowerCase().slice(0, 254) || 'missing-or-invalid';
  const [ip, accountHash] = await Promise.all([
    passwordLoginScopeHash('ip', source),
    passwordLoginScopeHash('account', account),
  ]);
  return { ip, account: accountHash };
}

interface RateLimitRow {
  scope_hash: string;
  locked_until: number | null;
}

interface PasswordLoginRateLimitScope {
  scopeHash: string;
  scopeKind: 'ip' | 'account';
  lockedUntil: number | null;
}

export interface PasswordLoginRateLimitContext {
  scopes: readonly [PasswordLoginRateLimitScope, PasswordLoginRateLimitScope];
  lockedUntil: number | null;
  lockedScopeKinds: readonly ('ip' | 'account')[];
}

/** 2軸を1 D1 queryで調べる。active lockが1つでもあればcredential検証へ進めない。 */
export async function inspectPasswordLoginRateLimit(
  db: D1Database,
  request: Request,
  email?: string,
  now = Date.now(),
): Promise<PasswordLoginRateLimitContext> {
  const hashes = await passwordLoginScopeHashes(request, email);
  const rows = await db
    .prepare('SELECT scope_hash,locked_until FROM password_login_rate_limits WHERE scope_hash IN (?,?)')
    .bind(hashes.ip, hashes.account)
    .all<RateLimitRow>();
  const lockedUntilByHash = new Map(
    (rows.results ?? []).map((row) => [
      row.scope_hash,
      row.locked_until && row.locked_until > now ? row.locked_until : null,
    ]),
  );
  const scopes = [
    { scopeHash: hashes.ip, scopeKind: 'ip' as const, lockedUntil: lockedUntilByHash.get(hashes.ip) ?? null },
    {
      scopeHash: hashes.account,
      scopeKind: 'account' as const,
      lockedUntil: lockedUntilByHash.get(hashes.account) ?? null,
    },
  ] as const;
  const activeLocks = scopes.filter((scope) => scope.lockedUntil !== null);
  return {
    scopes,
    lockedUntil: activeLocks.length
      ? Math.max(...activeLocks.map((scope) => scope.lockedUntil as number))
      : null,
    lockedScopeKinds: activeLocks.map((scope) => scope.scopeKind),
  };
}

interface FailureRow {
  scope_kind: 'ip' | 'account';
  failure_count: number;
  locked_until: number | null;
}

/** 2軸を1 atomic D1 queryで更新する。並行失敗もUPSERT RETURNINGでlost updateさせない。 */
export async function recordPasswordLoginFailure(
  db: D1Database,
  context: PasswordLoginRateLimitContext,
  config: PasswordLoginRateLimitConfig,
  now = Date.now(),
): Promise<{
  failureCount: number;
  lockedUntil: number | null;
  newlyLockedScopeKinds: readonly ('ip' | 'account')[];
}> {
  const windowCutoff = now - config.windowMs;
  const bindFor = (scope: PasswordLoginRateLimitScope): readonly unknown[] => [
    scope.scopeHash,
    scope.scopeKind,
    now,
    now,
  ];
  const rows = await db
    .prepare(
      `INSERT INTO password_login_rate_limits
        (scope_hash,scope_kind,window_started_at,failure_count,locked_until,updated_at)
       VALUES (?,?,?,1,NULL,?), (?,?,?,1,NULL,?)
       ON CONFLICT(scope_hash) DO UPDATE SET
         window_started_at=CASE
           WHEN password_login_rate_limits.window_started_at<=?
             OR (password_login_rate_limits.locked_until IS NOT NULL
                 AND password_login_rate_limits.locked_until<=?)
             THEN excluded.window_started_at
           ELSE password_login_rate_limits.window_started_at
         END,
         failure_count=CASE
           WHEN password_login_rate_limits.window_started_at<=?
             OR (password_login_rate_limits.locked_until IS NOT NULL
                 AND password_login_rate_limits.locked_until<=?)
             THEN 1
           ELSE MIN(password_login_rate_limits.failure_count+1,?)
         END,
         locked_until=CASE
           WHEN password_login_rate_limits.locked_until IS NOT NULL
             AND password_login_rate_limits.locked_until>?
             THEN password_login_rate_limits.locked_until
           WHEN password_login_rate_limits.window_started_at<=?
             OR (password_login_rate_limits.locked_until IS NOT NULL
                 AND password_login_rate_limits.locked_until<=?)
             THEN NULL
           WHEN password_login_rate_limits.failure_count+1>=?
             THEN ?+?
           ELSE NULL
         END,
         updated_at=excluded.updated_at
       RETURNING scope_kind,failure_count,locked_until`,
    )
    .bind(
      ...bindFor(context.scopes[0]),
      ...bindFor(context.scopes[1]),
      windowCutoff,
      now,
      windowCutoff,
      now,
      config.maxFailures,
      now,
      windowCutoff,
      now,
      config.maxFailures,
      now,
      config.lockMs,
    )
    .all<FailureRow>();
  if ((rows.results ?? []).length !== 2) throw new Error('password_login_rate_limit_update_missing');
  const activeLocks = rows.results.filter((row) => row.locked_until !== null);
  const previouslyLocked = new Set(
    context.scopes.filter((scope) => scope.lockedUntil !== null).map((scope) => scope.scopeKind),
  );
  return {
    failureCount: Math.max(...rows.results.map((row) => row.failure_count)),
    lockedUntil: activeLocks.length
      ? Math.max(...activeLocks.map((row) => row.locked_until as number))
      : null,
    newlyLockedScopeKinds: activeLocks
      .map((row) => row.scope_kind)
      .filter((kind) => !previouslyLocked.has(kind)),
  };
}

/** 成功した要求の2軸を1 queryでclearする。 */
export async function clearPasswordLoginRateLimit(
  db: D1Database,
  context: PasswordLoginRateLimitContext,
): Promise<void> {
  await db
    .prepare('DELETE FROM password_login_rate_limits WHERE scope_hash IN (?,?)')
    .bind(context.scopes[0].scopeHash, context.scopes[1].scopeHash)
    .run();
}

export function passwordLoginRetryAfterSeconds(lockedUntil: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((lockedUntil - now) / SECOND_MS));
}

/** stale rowをindex順に最大100件だけ1 queryで削除する。scope値は返却もlogもしない。 */
export async function cleanupStalePasswordLoginRateLimits(
  env: Pick<AuthEnv, 'DB'> & Partial<AuthEnv>,
  now = Date.now(),
): Promise<number> {
  const config = passwordLoginRateLimitConfig(env);
  const result = await env.DB.prepare(
    `DELETE FROM password_login_rate_limits
      WHERE scope_hash IN (
        SELECT scope_hash FROM password_login_rate_limits
        WHERE updated_at<? ORDER BY updated_at,scope_hash LIMIT ?
      )`,
  )
    .bind(now - config.staleAfterMs, config.cleanupBatchSize)
    .run();
  return result.meta.changes ?? 0;
}
