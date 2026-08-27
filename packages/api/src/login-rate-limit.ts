import { ATTACHMENT_SCHEDULED_MAX_D1_QUERIES } from './attachment-recovery.js';
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
  routeMaxD1Queries: 2,
  scheduledMaxD1Queries: 1,
});

/** attachment ledger/backupの43 + password throttle stale cleanupの1。Worker入口からはexportしない。 */
export const SCHEDULED_MAINTENANCE_MAX_D1_QUERIES =
  ATTACHMENT_SCHEDULED_MAX_D1_QUERIES + PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.scheduledMaxD1Queries;

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

/** CF-Connecting-IP以外へfallbackせず、欠損時も共有の匿名scopeとしてfail closedする。 */
export async function passwordLoginScopeHash(request: Request): Promise<string> {
  const supplied = request.headers.get('CF-Connecting-IP')?.trim().toLowerCase();
  const source = supplied && supplied.length <= 128 ? supplied : 'missing-or-invalid';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`kanjo:password-login:v1:${source}`),
  );
  return hex(digest);
}

interface RateLimitRow {
  locked_until: number | null;
}

export interface PasswordLoginRateLimitContext {
  scopeHash: string;
  lockedUntil: number | null;
}

/** 1 D1 query。password検証前に呼び、active lockはcredential検証へ進めない。 */
export async function inspectPasswordLoginRateLimit(
  db: D1Database,
  request: Request,
  now = Date.now(),
): Promise<PasswordLoginRateLimitContext> {
  const scopeHash = await passwordLoginScopeHash(request);
  const row = await db
    .prepare('SELECT locked_until FROM password_login_rate_limits WHERE scope_hash=? LIMIT 1')
    .bind(scopeHash)
    .first<RateLimitRow>();
  return { scopeHash, lockedUntil: row?.locked_until && row.locked_until > now ? row.locked_until : null };
}

interface FailureRow {
  failure_count: number;
  locked_until: number | null;
}

/** 1 atomic D1 query。並行失敗もUPSERT RETURNINGでlost updateさせない。 */
export async function recordPasswordLoginFailure(
  db: D1Database,
  context: PasswordLoginRateLimitContext,
  config: PasswordLoginRateLimitConfig,
  now = Date.now(),
): Promise<{ failureCount: number; lockedUntil: number | null }> {
  const windowCutoff = now - config.windowMs;
  const row = await db
    .prepare(
      `INSERT INTO password_login_rate_limits
        (scope_hash,window_started_at,failure_count,locked_until,updated_at)
       VALUES (?,?,1,NULL,?)
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
       RETURNING failure_count,locked_until`,
    )
    .bind(
      context.scopeHash,
      now,
      now,
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
    .first<FailureRow>();
  if (!row) throw new Error('password_login_rate_limit_update_missing');
  return { failureCount: row.failure_count, lockedUntil: row.locked_until };
}

/** 成功したscopeだけを1 queryでclearする。 */
export async function clearPasswordLoginRateLimit(
  db: D1Database,
  context: PasswordLoginRateLimitContext,
): Promise<void> {
  await db.prepare('DELETE FROM password_login_rate_limits WHERE scope_hash=?').bind(context.scopeHash).run();
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
