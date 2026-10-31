import { Hono } from 'hono';
import { z } from 'zod';
import { writeAuthV2Audit } from '../auth-audit.js';
import {
  AUTH_RATE_LIMIT_ERROR,
  authRetryAfterSeconds,
  clearAuthRateLimit,
  inspectAuthRateLimit,
  recordAuthRateLimitFailure,
} from '../auth-rate-limit.js';
import { newOpaqueToken, newRowId, sha256Hex } from '../auth-tokens.js';
import type { AuthEnv, AuthVariables } from '../auth.js';
import { createSendMail } from '../mail.js';
import { publicJsonValidator } from '../public-validation.js';
import {
  findCredentialHash,
  findUserById,
  hashPassword,
  passwordPolicyError,
  verifyPasswordHash,
} from '../users.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };
const HOUR_MS = 60 * 60 * 1000;
const RECENT_SESSION_MS = 10 * 60 * 1000;
const startSchema = z.object({
  target: z.enum(['google', 'password']),
  currentPassword: z.string().max(200).optional(),
});
const tokenSchema = z.object({ token: z.string().min(20).max(128) });
const passwordSchema = tokenSchema.extend({ newPassword: z.string().max(200) });

export const accountRoute = new Hono<Ctx>();

accountRoute.post('/account/link/start', publicJsonValidator(startSchema), async (c) => {
  const actor = c.get('actor');
  const body = c.req.valid('json');
  const existing = await c.env.DB.prepare(
    'SELECT "providerId" FROM account WHERE "userId"=? AND "providerId"=? LIMIT 1',
  )
    .bind(actor.id, body.target === 'password' ? 'credential' : body.target)
    .first();
  if (existing)
    return c.json({ error: { code: 'already_linked', message: 'この認証手段は登録済みです' } }, 409);

  const credential = await findCredentialHash(c.env.DB, actor.id);
  if (credential) {
    const rate = await inspectAuthRateLimit(c.env.DB, 'login', c.req.raw, actor.id);
    if (rate.lockedUntil) {
      const retryAfterSeconds = authRetryAfterSeconds(rate.lockedUntil);
      return c.json({ error: { ...AUTH_RATE_LIMIT_ERROR, retryAfterSeconds } }, 429, {
        'Retry-After': String(retryAfterSeconds),
        'Cache-Control': 'no-store',
      });
    }
    if (!body.currentPassword || !(await verifyPasswordHash(body.currentPassword, credential))) {
      const failed = await recordAuthRateLimitFailure(c.env.DB, rate);
      if (failed.lockedUntil) {
        const retryAfterSeconds = authRetryAfterSeconds(failed.lockedUntil);
        return c.json({ error: { ...AUTH_RATE_LIMIT_ERROR, retryAfterSeconds } }, 429, {
          'Retry-After': String(retryAfterSeconds),
          'Cache-Control': 'no-store',
        });
      }
      return c.json({ error: { code: 'reauth_failed', message: '現在のパスワードが違います' } }, 401);
    }
    await clearAuthRateLimit(c.env.DB, rate);
  }
  if (!credential) {
    const createdAt = new Date(c.get('sessionCreatedAt') ?? '').getTime();
    const age = Date.now() - createdAt;
    if (!Number.isFinite(createdAt) || age < 0 || age > RECENT_SESSION_MS) {
      return c.json(
        { error: { code: 'recent_auth_required', message: '本人確認のため、もう一度ログインしてください' } },
        401,
      );
    }
  }
  const token = newOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOUR_MS).toISOString();
  await c.env.DB.prepare(
    `INSERT INTO link_confirmation_token
       (id,user_id,target,token_hash,expires_at,consumed_at,created_at)
     VALUES (?,?,?,?,?,NULL,?)`,
  )
    .bind(newRowId(), actor.id, body.target, await sha256Hex(token), expiresAt, now.toISOString())
    .run();
  const origin = c.env.BETTER_AUTH_URL?.trim() || new URL(c.req.url).origin;
  const mail = createSendMail(c.env)(actor.email, 'link_confirm', {
    url: `${origin}/settings?link_token=${encodeURIComponent(token)}`,
  });
  c.get('authScope')?.waitUntil(mail);
  return c.json({ ok: true }, 202);
});

accountRoute.post('/account/link/confirm', publicJsonValidator(tokenSchema), async (c) => {
  const actor = c.get('actor');
  const body = c.req.valid('json');
  const grant = newOpaqueToken();
  const now = new Date().toISOString();
  const row = await c.env.DB.prepare(
    `UPDATE link_confirmation_token
       SET consumed_at=?,token_hash=?
     WHERE token_hash=? AND user_id=? AND consumed_at IS NULL AND expires_at>?
     RETURNING target`,
  )
    .bind(now, await sha256Hex(grant), await sha256Hex(body.token), actor.id, now)
    .first<{ target: 'google' | 'password' }>();
  if (!row)
    return c.json({ error: { code: 'link_token_unavailable', message: '確認リンクを利用できません' } }, 404);
  return c.json({ target: row.target, linkGrant: grant });
});

accountRoute.post('/account/link/password', publicJsonValidator(passwordSchema), async (c) => {
  const actor = c.get('actor');
  const body = c.req.valid('json');
  const problem = passwordPolicyError(body.newPassword);
  if (problem) return c.json({ error: { code: 'weak_password', message: problem } }, 400);
  const now = new Date().toISOString();
  if (await findCredentialHash(c.env.DB, actor.id)) {
    return c.json({ error: { code: 'already_linked', message: 'パスワードは登録済みです' } }, 409);
  }
  const user = await findUserById(c.env.DB, actor.id);
  if (!user) return c.json({ error: { code: 'unauthorized', message: '認証が必要です' } }, 401);
  const passwordHash = await hashPassword(body.newPassword);
  const grant = await c.env.DB.prepare(
    `UPDATE link_confirmation_token SET expires_at=?
      WHERE token_hash=? AND user_id=? AND target='password'
        AND consumed_at IS NOT NULL AND expires_at>?
      RETURNING id`,
  )
    .bind(now, await sha256Hex(body.token), actor.id, now)
    .first<{ id: string }>();
  if (!grant)
    return c.json({ error: { code: 'link_token_unavailable', message: '確認リンクを利用できません' } }, 404);
  try {
    await c.env.DB.prepare(
      `INSERT INTO account
        (id,"accountId","providerId","userId",password,"createdAt","updatedAt")
       VALUES (?,?, 'credential', ?,?,?,?)`,
    )
      .bind(newRowId(), actor.id, actor.id, passwordHash, now, now)
      .run();
  } catch (error) {
    if (await findCredentialHash(c.env.DB, actor.id)) {
      return c.json({ error: { code: 'already_linked', message: 'パスワードは登録済みです' } }, 409);
    }
    throw error;
  }
  await writeAuthV2Audit(c.env.DB, {
    action: 'auth_link_add',
    actorUserId: actor.id,
    targetUserId: actor.id,
    result: 'succeeded',
    counts: { provider_password: 1 },
  });
  return c.json({ status: true });
});
