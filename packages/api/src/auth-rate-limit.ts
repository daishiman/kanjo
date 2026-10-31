/**
 * ログイン v2 で増えた入口 (MFA・招待の承諾・再設定の依頼・状態の照会) のレート制限。
 *
 * 判定の骨組みは login-rate-limit.ts と同じにする: 送信元と対象アカウントを独立した軸で数え、
 * どちらかが上限を超えたら固定時間ロックする。0039 の CHECK を触らないため、表は
 * auth_rate_limits に分け (design-decisions K-5)、scope_kind に入口の名前を前置する。
 *
 * scope_hash は不可逆で、IP やメールそのものは D1 にもログにも残さない。
 */
const SECOND_MS = 1_000;
const WINDOW_MS = 15 * 60 * SECOND_MS;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * SECOND_MS;
const STALE_AFTER_MS = 24 * 60 * 60 * SECOND_MS;

export type AuthRateLimitFamily = 'login' | 'mfa' | 'invite' | 'reset' | 'status';
type Axis = 'ip' | 'account';
type ScopeKind = `${AuthRateLimitFamily}_${Axis}`;

/** 入口ごとの軸。status は未ログインの照会なので対象アカウントを持たない。 */
const AXES: Record<AuthRateLimitFamily, readonly Axis[]> = {
  login: ['ip', 'account'],
  // 標準MFAはaccountを渡さないのでIPのみ、custom初回設定は確定userIdを渡して2軸にする。
  mfa: ['ip', 'account'],
  invite: ['ip', 'account'],
  reset: ['ip', 'account'],
  status: ['ip'],
};

export interface AuthRateLimitPolicy {
  windowMs: number;
  maxFailures: number;
  lockMs: number;
}

/**
 * 認証入口はすべて15分に5回・15分ロック。statusだけは公開probeとして1分60回。
 */
export const AUTH_RATE_LIMIT_POLICIES: Readonly<Record<AuthRateLimitFamily, AuthRateLimitPolicy>> =
  Object.freeze({
    login: { windowMs: WINDOW_MS, maxFailures: MAX_FAILURES, lockMs: LOCK_MS },
    mfa: { windowMs: WINDOW_MS, maxFailures: MAX_FAILURES, lockMs: LOCK_MS },
    invite: { windowMs: WINDOW_MS, maxFailures: MAX_FAILURES, lockMs: LOCK_MS },
    reset: { windowMs: WINDOW_MS, maxFailures: MAX_FAILURES, lockMs: LOCK_MS },
    // 仕様: 同じ送信元から 1 分に 60 回を超えたら 429。窓の残りだけ止める。
    status: { windowMs: 60 * SECOND_MS, maxFailures: 60, lockMs: 60 * SECOND_MS },
  });

export const AUTH_RATE_LIMIT_ERROR = Object.freeze({
  code: 'rate_limited',
  message: '試行回数が上限に達しました。時間をおいて再試行してください',
});

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

async function scopeHash(kind: ScopeKind, material: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`kanjo:auth-rate-limit:v1:${kind}:${material}`),
  );
  return hex(digest);
}

interface Scope {
  scopeHash: string;
  scopeKind: ScopeKind;
  lockedUntil: number | null;
}

export interface AuthRateLimitContext {
  family: AuthRateLimitFamily;
  scopes: readonly Scope[];
  lockedUntil: number | null;
}

/** 軸ごとの材料。account は正規化したメールか user id。欠損時はIP軸だけにする。 */
async function scopesFor(
  family: AuthRateLimitFamily,
  request: Request,
  account: string | undefined,
): Promise<Omit<Scope, 'lockedUntil'>[]> {
  const supplied = request.headers.get('CF-Connecting-IP')?.trim().toLowerCase();
  const ip = supplied && supplied.length <= 128 ? supplied : 'missing-or-invalid';
  const accountMaterial = account?.trim().toLowerCase().slice(0, 254);
  // account材料が無い標準MFAでは匿名accountを共有せずIP軸だけにする。
  const axes = accountMaterial ? AXES[family] : AXES[family].filter((axis) => axis !== 'account');
  return Promise.all(
    axes.map(async (axis) => {
      const kind = `${family}_${axis}` as ScopeKind;
      return { scopeKind: kind, scopeHash: await scopeHash(kind, axis === 'ip' ? ip : accountMaterial!) };
    }),
  );
}

const placeholders = (count: number, row: string) => Array.from({ length: count }, () => row).join(',');

/** 全軸を1 query で調べる。有効なロックが1つでもあれば本体の処理へ進めない。 */
export async function inspectAuthRateLimit(
  db: D1Database,
  family: AuthRateLimitFamily,
  request: Request,
  account?: string,
  now = Date.now(),
): Promise<AuthRateLimitContext> {
  const bare = await scopesFor(family, request, account);
  const rows = await db
    .prepare(
      `SELECT scope_hash,locked_until FROM auth_rate_limits WHERE scope_hash IN (${placeholders(bare.length, '?')})`,
    )
    .bind(...bare.map((scope) => scope.scopeHash))
    .all<{ scope_hash: string; locked_until: number | null }>();
  const locked = new Map(
    (rows.results ?? []).map((row) => [
      row.scope_hash,
      row.locked_until && row.locked_until > now ? row.locked_until : null,
    ]),
  );
  const scopes = bare.map((scope) => ({ ...scope, lockedUntil: locked.get(scope.scopeHash) ?? null }));
  const active = scopes.flatMap((scope) => (scope.lockedUntil === null ? [] : [scope.lockedUntil]));
  return { family, scopes, lockedUntil: active.length ? Math.max(...active) : null };
}

/**
 * 失敗 (または数える依頼) を全軸へ1 atomic query で足す。
 * login-rate-limit.ts と同じく、窓切れ・ロック明けは 1 からやり直し、上限到達でロックする。
 */
export async function recordAuthRateLimitFailure(
  db: D1Database,
  context: AuthRateLimitContext,
  now = Date.now(),
): Promise<{ lockedUntil: number | null }> {
  const policy = AUTH_RATE_LIMIT_POLICIES[context.family];
  const windowCutoff = now - policy.windowMs;
  const expired = `(auth_rate_limits.window_started_at<=?
      OR (auth_rate_limits.locked_until IS NOT NULL AND auth_rate_limits.locked_until<=?))`;
  const rows = await db
    .prepare(
      `INSERT INTO auth_rate_limits
        (scope_hash,scope_kind,window_started_at,failure_count,locked_until,updated_at)
       VALUES ${placeholders(context.scopes.length, '(?,?,?,1,NULL,?)')}
       ON CONFLICT(scope_hash) DO UPDATE SET
         window_started_at=CASE WHEN ${expired} THEN excluded.window_started_at
           ELSE auth_rate_limits.window_started_at END,
         failure_count=CASE WHEN ${expired} THEN 1
           ELSE MIN(auth_rate_limits.failure_count+1,?) END,
         locked_until=CASE
           WHEN auth_rate_limits.locked_until IS NOT NULL AND auth_rate_limits.locked_until>?
             THEN auth_rate_limits.locked_until
           WHEN ${expired} THEN NULL
           WHEN auth_rate_limits.failure_count+1>=? THEN ?+?
           ELSE NULL
         END,
         updated_at=excluded.updated_at
       RETURNING locked_until`,
    )
    .bind(
      ...context.scopes.flatMap((scope) => [scope.scopeHash, scope.scopeKind, now, now]),
      windowCutoff,
      now,
      windowCutoff,
      now,
      policy.maxFailures,
      now,
      windowCutoff,
      now,
      policy.maxFailures,
      now,
      policy.lockMs,
    )
    .all<{ locked_until: number | null }>();
  if ((rows.results ?? []).length !== context.scopes.length)
    throw new Error('auth_rate_limit_update_missing');
  const active = rows.results.flatMap((row) => (row.locked_until === null ? [] : [row.locked_until]));
  return { lockedUntil: active.length ? Math.max(...active) : null };
}

/** 成功した要求の全軸を消す。依頼を数える入口 (reset・status) では呼ばない。 */
export async function clearAuthRateLimit(db: D1Database, context: AuthRateLimitContext): Promise<void> {
  await db
    .prepare(`DELETE FROM auth_rate_limits WHERE scope_hash IN (${placeholders(context.scopes.length, '?')})`)
    .bind(...context.scopes.map((scope) => scope.scopeHash))
    .run();
}

export function authRetryAfterSeconds(lockedUntil: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((lockedUntil - now) / SECOND_MS));
}

/** 最長の窓+ロックより古い行を index 順に最大100件消す。scope の値は返さない。 */
export async function cleanupStaleAuthRateLimits(db: D1Database, now = Date.now()): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM auth_rate_limits WHERE scope_hash IN (
         SELECT scope_hash FROM auth_rate_limits WHERE updated_at<? ORDER BY updated_at,scope_hash LIMIT 100
       )`,
    )
    .bind(now - STALE_AFTER_MS)
    .run();
  return result.meta.changes ?? 0;
}
