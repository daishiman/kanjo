/**
 * 認証エンドポイント (FR-06)。
 *
 * ここだけが未認証で到達できる。応答は「メールアドレスが存在するか」を一切区別しない:
 * 不在・停止・パスワード相違のすべてを同一の 401 と同一の所要時間で返す。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { type AuditAction, type AuditCountKey, type AuditScope, buildAuditStatements } from '../audit-log.js';
import {
  type AuthEnv,
  type AuthVariables,
  TENANT_ID,
  authGuard,
  clearSession,
  issueSession,
  issueSessionUntil,
} from '../auth.js';
import {
  PASSWORD_LOGIN_RATE_LIMIT_ERROR,
  clearPasswordLoginRateLimit,
  inspectPasswordLoginRateLimit,
  passwordLoginRateLimitConfig,
  passwordLoginRetryAfterSeconds,
  recordPasswordLoginFailure,
} from '../login-rate-limit.js';
import { publicJsonValidator } from '../public-validation.js';
import {
  PASSWORD_MAX_LENGTH,
  consumeTemporaryPassword,
  equalizeAbsentAccountTiming,
  findUserByEmail,
  findUserById,
  hashPassword,
  isTemporaryPasswordActive,
  isValidEmail,
  needsRehash,
  normalizeEmail,
  passwordPolicyError,
  preparePasswordUpdateAndRevoke,
  recordLogin,
  rehashStoredPassword,
  revokeSessions,
  toPublicUser,
  verifyPasswordHash,
} from '../users.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export interface AuthAuditInput {
  action: AuditAction;
  actorUserId: string | null;
  scope: AuditScope;
  occurredAt: string;
  result: 'succeeded' | 'failed' | 'rejected';
  counts?: Partial<Record<AuditCountKey, number>>;
  onlyIfPreviousStatementChanged?: boolean;
}

/** 管理更新と同じD1 batchへ積める、認証監査の唯一の組み立て口。 */
export function buildAuthAuditPlan(db: D1Database, input: AuthAuditInput) {
  const operationId = crypto.randomUUID();
  return buildAuditStatements({
    database: db,
    auditId: operationId,
    userId: TENANT_ID,
    actorUserId: input.actorUserId,
    operationId,
    action: input.action,
    scope: input.scope,
    counts: input.counts ?? {},
    occurredAt: input.occurredAt,
    result: input.result,
    onlyIfPreviousStatementChanged: input.onlyIfPreviousStatementChanged,
  });
}

/** 認証判定の監査はbest-effort。失敗を隔離し、資格情報を含まない運用イベントだけを出す。 */
export async function writeAuthAudit(db: D1Database, input: AuthAuditInput): Promise<void> {
  try {
    await db.batch(buildAuthAuditPlan(db, input).statements);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'auth_audit_write',
        action: input.action,
        name: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
}

const loginSchema = z.object({
  email: z.string().min(3).max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  // 既定 ON。画面のチェックボックスと既定値を揃える。
  remember: z.boolean().optional().default(true),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

/** 不在・停止・相違を1つの応答に畳む。区別できる情報を返した時点で列挙可能になる。 */
const INVALID_CREDENTIALS = {
  error: { code: 'invalid_credentials', message: 'メールアドレスまたはパスワードが正しくありません。' },
} as const;

export const authRoute = new Hono<Ctx>();

authRoute.post('/auth/login', publicJsonValidator(loginSchema), async (c) => {
  const env = c.env;
  if (env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN) {
    return c.json({ error: { code: 'access_mode', message: 'Cloudflare Access認証を使用しています' } }, 400);
  }
  if (!env.SESSION_SECRET) {
    return c.json({ error: { code: 'auth_not_configured', message: '認証が未設定です' } }, 503);
  }

  const body = c.req.valid('json');
  const email = normalizeEmail(body.email);
  const config = passwordLoginRateLimitConfig(env);
  const now = new Date().toISOString();
  const rateLimit = await inspectPasswordLoginRateLimit(env.DB, c.req.raw, email);
  if (rateLimit.lockedUntil) {
    await writeAuthAudit(env.DB, {
      action: 'auth_login_failed',
      actorUserId: null,
      scope: { kind: 'account' },
      occurredAt: now,
      result: 'rejected',
      counts: { lockRejected: rateLimit.lockedScopeKinds.length },
    });
    const retryAfterSeconds = passwordLoginRetryAfterSeconds(rateLimit.lockedUntil);
    c.header('Retry-After', String(retryAfterSeconds));
    return c.json({ error: PASSWORD_LOGIN_RATE_LIMIT_ERROR, retryAfterSeconds }, 429);
  }

  const user = isValidEmail(email) ? await findUserByEmail(env.DB, email) : null;
  // 停止中の利用者も「存在しない」と同じ経路を通す。ここで分岐すると在籍が分かる。
  const usable = user && user.status === 'active' ? user : null;
  // 不在時も実際に PBKDF2 を1回回す。早期 return が応答時間差として存否を漏らす。
  const verified = usable
    ? await verifyPasswordHash(body.password, usable.password_hash)
    : await equalizeAbsentAccountTiming(body.password);

  if (!usable || !verified || !isTemporaryPasswordActive(usable, now)) {
    const failure = await recordPasswordLoginFailure(env.DB, rateLimit, config);
    await writeAuthAudit(env.DB, {
      action: 'auth_login_failed',
      // 認証前は「誰が操作したか」を確定できない。target accountと混ぜない。
      actorUserId: null,
      scope: usable ? { kind: 'account', userId: usable.id } : { kind: 'account' },
      occurredAt: now,
      result: failure.newlyLockedScopeKinds.length ? 'rejected' : 'failed',
      counts: failure.newlyLockedScopeKinds.length
        ? { lockStarted: failure.newlyLockedScopeKinds.length }
        : {},
    });
    if (failure.lockedUntil) {
      const retryAfterSeconds = passwordLoginRetryAfterSeconds(failure.lockedUntil);
      c.header('Retry-After', String(retryAfterSeconds));
      return c.json({ error: PASSWORD_LOGIN_RATE_LIMIT_ERROR, retryAfterSeconds }, 429);
    }
    return c.json(INVALID_CREDENTIALS, 401);
  }

  await clearPasswordLoginRateLimit(env.DB, rateLimit);
  let sessionUser = usable;
  if (usable.must_change_password === 1) {
    // 有効期限をNULLへCAS更新することが「使用済み」の単一状態遷移。
    // 並行要求でもchanges=1になれるのは1本だけなので、二重発行しない。
    const consumed = await consumeTemporaryPassword(
      env.DB,
      usable,
      needsRehash(usable.password_hash) ? await hashPassword(body.password) : usable.password_hash,
      now,
    );
    if ((consumed.meta.changes ?? 0) !== 1) {
      await writeAuthAudit(env.DB, {
        action: 'auth_login_failed',
        actorUserId: null,
        scope: { kind: 'account', userId: usable.id },
        occurredAt: now,
        result: 'rejected',
      });
      return c.json(INVALID_CREDENTIALS, 401);
    }
    sessionUser = { ...usable, session_generation: usable.session_generation + 1, last_login_at: now };
  } else {
    // 反復回数を引き上げた後は、ログインのたびに1件ずつ黙って追いつかせる。
    if (needsRehash(usable.password_hash)) {
      await rehashStoredPassword(env.DB, usable.id, await hashPassword(body.password), now);
    }
    await recordLogin(env.DB, usable.id, now);
  }
  await issueSession(c, env.SESSION_SECRET, sessionUser, body.remember);
  await writeAuthAudit(env.DB, {
    action: 'auth_login',
    actorUserId: usable.id,
    scope: { kind: 'account', userId: usable.id },
    occurredAt: now,
    result: 'succeeded',
  });
  return c.json({ ok: true, user: toPublicUser(usable) });
});

authRoute.post('/auth/logout', authGuard(), async (c) => {
  const actor = c.get('actor');
  const now = new Date().toISOString();
  // Cookie の削除だけでは、複製された Cookie がそのまま使える。
  // 世代を進めて、この利用者の発行済みセッションを全て無効にする。
  await revokeSessions(c.env.DB, actor.id, now);
  clearSession(c);
  await writeAuthAudit(c.env.DB, {
    action: 'auth_logout',
    actorUserId: actor.id,
    scope: { kind: 'account', userId: actor.id },
    occurredAt: now,
    result: 'succeeded',
  });
  return c.json({ ok: true });
});

// 認証状態の確認。既存画面は `authenticated` だけを見るため、そのキーは残す。
authRoute.get('/auth/me', authGuard(), async (c) => {
  const actor = c.get('actor');
  const user = await findUserById(c.env.DB, actor.id);
  return c.json({ authenticated: true, user: user ? toPublicUser(user) : null });
});

/**
 * 本人によるパスワード変更。一時パスワードの解除経路でもあるため、
 * must_change_password が立っていても通れる位置に置く。
 */
authRoute.post('/auth/password', authGuard(), publicJsonValidator(passwordChangeSchema), async (c) => {
  const env = c.env;
  if (!env.SESSION_SECRET) {
    return c.json({ error: { code: 'auth_not_configured', message: '認証が未設定です' } }, 503);
  }
  const actor = c.get('actor');
  const body = c.req.valid('json');
  const user = await findUserById(env.DB, actor.id);
  if (!user) return c.json(INVALID_CREDENTIALS, 401);
  if (!(await verifyPasswordHash(body.currentPassword, user.password_hash))) {
    return c.json({ error: { code: 'invalid_credentials', message: '現在のパスワードが違います' } }, 401);
  }
  const policyError = passwordPolicyError(body.newPassword);
  if (policyError) return c.json({ error: { code: 'weak_password', message: policyError } }, 400);
  // 過去全履歴の再利用は追わない (履歴を持てば「復元可能な材料」を増やす)。現行と同値だけを拒否する。
  if (await verifyPasswordHash(body.newPassword, user.password_hash)) {
    return c.json(
      { error: { code: 'password_unchanged', message: '現在と異なるパスワードにしてください' } },
      400,
    );
  }

  const expiresAt = c.get('sessionExpiresAt');
  if (expiresAt === null) {
    return c.json({ error: { code: 'session_not_refreshable', message: '再ログインしてください' } }, 409);
  }

  const now = new Date().toISOString();
  const update = preparePasswordUpdateAndRevoke(
    env.DB,
    user.id,
    await hashPassword(body.newPassword),
    false,
    now,
  );
  const audit = buildAuthAuditPlan(env.DB, {
    action: 'auth_password_change',
    actorUserId: user.id,
    scope: { kind: 'account', userId: user.id },
    occurredAt: now,
    result: 'succeeded',
  });
  await env.DB.batch([update, ...audit.statements]);
  // 世代が進んだので手元の Cookie も無効。変更した本人だけ、その場で新しい世代へ載せ替える。
  await issueSessionUntil(
    c,
    env.SESSION_SECRET,
    { id: user.id, session_generation: user.session_generation + 1 },
    expiresAt,
  );
  return c.json({
    ok: true,
    user: toPublicUser({ ...user, must_change_password: 0, temporary_password_expires_at: null }),
  });
});
