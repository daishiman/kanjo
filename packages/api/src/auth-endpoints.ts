import { createOTP } from '@better-auth/utils/otp';
import { mfaSetupTokenExpiresAt, resetTokenExpiresAt } from '@kanjo/core';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { generateRandomString, symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { z } from 'zod';
import { writeAuthV2Audit } from './auth-audit.js';
import {
  AUTH_RATE_LIMIT_ERROR,
  authRetryAfterSeconds,
  clearAuthRateLimit,
  inspectAuthRateLimit,
  recordAuthRateLimitFailure,
} from './auth-rate-limit.js';
import { isOpaqueToken, newOpaqueToken, newRowId, sha256Hex } from './auth-tokens.js';
import type { AuthScope, BetterAuthEnv } from './better-auth.js';
import { rotateAndDeliverInvitation } from './invitations.js';
import { createSendMail } from './mail.js';
import {
  findAccountUserDetails,
  findCredentialHash,
  findUserByEmail,
  hashPassword,
  normalizeEmail,
  passwordPolicyError,
} from './users.js';

const noStore = { 'Cache-Control': 'no-store' };
const unavailable = () =>
  APIError.fromStatus('NOT_FOUND', {
    code: 'invitation_unavailable',
    message: 'この招待は利用できません',
  });
const unauthorizedSetup = () =>
  APIError.from('UNAUTHORIZED', {
    code: 'mfa_setup_token_invalid',
    message: 'MFA設定の有効期限が切れました。もう一度ログインしてください',
  });

/**
 * setup token の消費・user のMFA有効化・factor確定を1つのD1 transactionへ閉じる。
 * changes() を鎖にするため、並行要求の敗者は後続2行を更新できない。
 */
export async function completeMfaSetupState(
  db: D1Database,
  input: { setupId: string; userId: string; factorId: string; storedCodes: string; nowIso: string },
): Promise<boolean> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE mfa_setup_token SET consumed_at=?
          WHERE id=? AND user_id=? AND consumed_at IS NULL AND expires_at>?
            AND EXISTS (SELECT 1 FROM "user" WHERE id=? AND status='active')
            AND EXISTS (SELECT 1 FROM "twoFactor" WHERE id=? AND "userId"=?)`,
      )
      .bind(
        input.nowIso,
        input.setupId,
        input.userId,
        input.nowIso,
        input.userId,
        input.factorId,
        input.userId,
      ),
    db
      .prepare(
        `UPDATE "user" SET "twoFactorEnabled"=1,"updatedAt"=?
          WHERE id=? AND changes()=1`,
      )
      .bind(input.nowIso, input.userId),
    db
      .prepare(
        `UPDATE "twoFactor" SET "backupCodes"=?,verified=1
          WHERE id=? AND "userId"=? AND changes()=1`,
      )
      .bind(input.storedCodes, input.factorId, input.userId),
  ]);
  return results.every((result) => Number(result.meta.changes ?? 0) === 1);
}

interface InvitationRow {
  id: string;
  email: string;
  role: 'admin' | 'member';
  expires_at: string;
}

interface SetupRow {
  id: string;
  user_id: string;
  remember_me: number;
  expires_at: string;
}

const activeInvite = async (db: D1Database, token: unknown): Promise<InvitationRow | null> => {
  if (!isOpaqueToken(token)) return null;
  return db
    .prepare(
      `SELECT id,email,role,expires_at FROM invitations
        WHERE token_hash=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?
        LIMIT 1`,
    )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first<InvitationRow>();
};

const activeSetup = async (db: D1Database, token: unknown): Promise<SetupRow | null> => {
  if (!isOpaqueToken(token)) return null;
  return db
    .prepare(
      `SELECT id,user_id,remember_me,expires_at FROM mfa_setup_token
        WHERE token_hash=? AND consumed_at IS NULL AND expires_at>? LIMIT 1`,
    )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first<SetupRow>();
};

export async function issueMfaSetupToken(
  db: D1Database,
  userId: string,
  remember: boolean,
  audit = true,
): Promise<{ setupToken: string; expiresAt: string }> {
  const setupToken = newOpaqueToken();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = mfaSetupTokenExpiresAt(now).toISOString();
  await db.batch([
    db
      .prepare('UPDATE mfa_setup_token SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL')
      .bind(nowIso, userId),
    db
      .prepare(
        `INSERT INTO mfa_setup_token
           (id,user_id,token_hash,remember_me,expires_at,consumed_at,created_at)
         VALUES (?,?,?,?,?,NULL,?)`,
      )
      .bind(newRowId(), userId, await sha256Hex(setupToken), remember ? 1 : 0, expiresAt, nowIso),
  ]);
  if (audit) {
    await writeAuthV2Audit(db, {
      action: 'auth_mfa_setup_issued',
      actorUserId: userId,
      targetUserId: userId,
      result: 'succeeded',
      counts: { method_mfa_setup: 1 },
    });
  }
  return { setupToken, expiresAt };
}

/**
 * link-social の直前だけ使える許可。確認トークンの行を原子的に消費し、
 * userId と対象を要求単位で照合する。平文 token は D1 に残さない。
 */
export async function readLinkGrant(
  ctx: { request?: Request; body?: unknown },
  db: D1Database,
  target: 'google' | 'password',
  userId: string,
): Promise<{ userId: string } | null> {
  const body = ctx.body as { linkGrant?: unknown } | undefined;
  const header = ctx.request?.headers.get('x-kanjo-link-grant');
  // bearerをURLへ置くと履歴・access log・Refererへ漏れるため、queryは受け付けない。
  const token = typeof body?.linkGrant === 'string' ? body.linkGrant : header;
  if (!isOpaqueToken(token)) return null;
  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `UPDATE link_confirmation_token SET expires_at=?
        WHERE token_hash=? AND target=? AND user_id=?
          AND consumed_at IS NOT NULL AND expires_at>?
        RETURNING user_id`,
    )
    .bind(now, await sha256Hex(token), target, userId, now)
    .first<{ user_id: string }>();
  return row ? { userId: row.user_id } : null;
}

const rateLimited = (retryAfter: number): never => {
  throw new APIError('TOO_MANY_REQUESTS', {
    ...AUTH_RATE_LIMIT_ERROR,
    retryAfterSeconds: retryAfter,
  } as never);
};

const endpointRequest = (request: Request | undefined): Request => {
  if (!request) throw APIError.from('BAD_REQUEST', { code: 'invalid_request', message: '要求が不正です' });
  return request;
};

const publicRateGate = async (
  env: BetterAuthEnv,
  family: 'invite' | 'reset' | 'mfa',
  request: Request,
  account?: string,
) => {
  const rate = await inspectAuthRateLimit(env.DB, family, request, account);
  if (rate.lockedUntil) rateLimited(authRetryAfterSeconds(rate.lockedUntil));
  return rate;
};

const generateBackupCodes = () =>
  Array.from({ length: 10 }, () => {
    const raw = generateRandomString(10, 'a-z', 'A-Z', '0-9');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

export function kanjoAuthEndpoints(env: BetterAuthEnv, scope: AuthScope): BetterAuthPlugin {
  const sendMail = createSendMail(env);
  return {
    id: 'kanjo-auth-endpoints',
    endpoints: {
      inviteInspect: createAuthEndpoint(
        '/invite/inspect',
        { method: 'POST', body: z.object({ token: z.string() }) },
        async (ctx) => {
          const rate = await publicRateGate(
            env,
            'invite',
            endpointRequest(ctx.request),
            isOpaqueToken(ctx.body.token) ? ctx.body.token : undefined,
          );
          const invitation = await activeInvite(env.DB, ctx.body.token);
          if (!invitation) {
            await recordAuthRateLimitFailure(env.DB, rate);
            throw unavailable();
          }
          await clearAuthRateLimit(env.DB, rate);
          return ctx.json(
            { email: invitation.email, role: invitation.role, expiresAt: invitation.expires_at },
            { headers: noStore },
          );
        },
      ),
      inviteAccept: createAuthEndpoint(
        '/invite/accept',
        { method: 'POST', body: z.object({ token: z.string(), password: z.string() }) },
        async (ctx) => {
          const invitation = await activeInvite(env.DB, ctx.body.token);
          const rate = await publicRateGate(env, 'invite', endpointRequest(ctx.request), invitation?.email);
          if (!invitation) {
            await recordAuthRateLimitFailure(env.DB, rate);
            throw unavailable();
          }
          const problem = passwordPolicyError(ctx.body.password);
          if (problem) throw APIError.from('BAD_REQUEST', { code: 'weak_password', message: problem });
          if (await findUserByEmail(env.DB, invitation.email)) {
            throw APIError.fromStatus('CONFLICT', {
              code: 'user_exists',
              message: 'このメールアドレスは登録済みです',
            });
          }
          const now = new Date().toISOString();
          const presentedTokenHash = await sha256Hex(ctx.body.token);
          let userId: string | null = null;
          let setup: { setupToken: string; expiresAt: string } | null = null;
          try {
            const user = await ctx.context.internalAdapter.createUser(
              {
                name: invitation.email.split('@')[0] || invitation.email,
                email: invitation.email,
                emailVerified: true,
                role: invitation.role,
                status: 'active',
                lastLoginAt: null,
              },
              { method: 'email' },
            );
            userId = user.id;
            await ctx.context.internalAdapter.createAccount({
              accountId: user.id,
              providerId: 'credential',
              userId: user.id,
              password: await hashPassword(ctx.body.password),
            });
            if (invitation.role === 'admin') {
              setup = await issueMfaSetupToken(env.DB, user.id, true, false);
            }
            const consumed = await env.DB.prepare(
              `UPDATE invitations SET accepted_at=?,updated_at=?
                WHERE id=? AND token_hash=?
                  AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?`,
            )
              .bind(now, now, invitation.id, presentedTokenHash, now)
              .run();
            if (Number(consumed.meta.changes ?? 0) !== 1) throw unavailable();
          } catch (error) {
            if (userId) await ctx.context.internalAdapter.deleteUser(userId);
            throw error;
          }
          // accepted_at確定後は登録を巻き戻さない。rate/audit障害は認証結果と分離する。
          try {
            await clearAuthRateLimit(env.DB, rate);
          } catch (error) {
            console.error(
              JSON.stringify({
                level: 'error',
                job: 'invite_rate_clear',
                name: error instanceof Error ? error.name : 'UnknownError',
              }),
            );
          }
          await writeAuthV2Audit(env.DB, {
            action: 'auth_invite_accept',
            actorUserId: userId,
            targetUserId: userId,
            result: 'succeeded',
            counts: invitation.role === 'admin' ? { role_admin: 1 } : { role_member: 1 },
          });
          if (invitation.role === 'admin' && setup) {
            await writeAuthV2Audit(env.DB, {
              action: 'auth_mfa_setup_issued',
              actorUserId: userId,
              targetUserId: userId,
              result: 'succeeded',
              counts: { method_mfa_setup: 1 },
            });
            return ctx.json({ next: 'mfa_setup' as const, ...setup }, { headers: noStore });
          }
          return ctx.json({ next: 'login' as const, email: invitation.email }, { headers: noStore });
        },
      ),
      inviteResendRequest: createAuthEndpoint(
        '/invite/resend-request',
        { method: 'POST', body: z.object({ email: z.string() }) },
        async (ctx) => {
          const email = normalizeEmail(ctx.body.email);
          const rate = await publicRateGate(env, 'invite', endpointRequest(ctx.request), email);
          const count = await recordAuthRateLimitFailure(env.DB, rate);
          if (count.lockedUntil) rateLimited(authRetryAfterSeconds(count.lockedUntil));
          const baseURL = ctx.context.baseURL;
          scope.waitUntil(
            (async () => {
              const nowIso = new Date().toISOString();
              const invitation = await rotateAndDeliverInvitation({
                db: env.DB,
                sendMail,
                appOrigin: baseURL.replace(/\/api\/auth$/, ''),
                selector: { email, unexpiredAt: nowIso },
              });
              if (!invitation) return;
              await writeAuthV2Audit(env.DB, {
                action: 'auth_invite_resend_request',
                actorUserId: null,
                result: 'succeeded',
                counts: { mail_queued: 1 },
              });
            })(),
          );
          ctx.setStatus(202);
          return ctx.json({ ok: true }, { headers: noStore });
        },
      ),
      passwordResetRequest: createAuthEndpoint(
        '/password-reset/request',
        { method: 'POST', body: z.object({ email: z.string() }) },
        async (ctx) => {
          const email = normalizeEmail(ctx.body.email);
          const rate = await publicRateGate(env, 'reset', endpointRequest(ctx.request), email);
          const count = await recordAuthRateLimitFailure(env.DB, rate);
          if (count.lockedUntil) rateLimited(authRetryAfterSeconds(count.lockedUntil));
          const baseURL = ctx.context.baseURL;
          scope.waitUntil(
            (async () => {
              const user = await findUserByEmail(env.DB, email);
              const credential = user ? await findCredentialHash(env.DB, user.id) : null;
              // internalAdapterが storeIdentifier 設定に従ってSHA-256へ変換する。平文identifierは保存されない。
              const token = newOpaqueToken();
              const identifier = `reset-password:${token}`;
              if (!user || user.status !== 'active' || !credential) return;
              await ctx.context.internalAdapter.createVerificationValue({
                identifier,
                value: user.id,
                expiresAt: resetTokenExpiresAt(new Date()),
              });
              const url = `${baseURL.replace(/\/api\/auth$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
              await sendMail(email, 'password_reset', { url });
              await writeAuthV2Audit(env.DB, {
                action: 'auth_password_reset_request',
                actorUserId: user.id,
                targetUserId: user.id,
                result: 'succeeded',
                counts: { mail_queued: 1 },
              });
            })(),
          );
          ctx.setStatus(202);
          return ctx.json({ ok: true }, { headers: noStore });
        },
      ),
      mfaSetupStart: createAuthEndpoint(
        '/mfa-setup/start',
        { method: 'POST', body: z.object({ setupToken: z.string() }) },
        async (ctx) => {
          const setup = await activeSetup(env.DB, ctx.body.setupToken);
          const rate = await publicRateGate(env, 'mfa', endpointRequest(ctx.request), setup?.user_id);
          if (!setup) {
            await recordAuthRateLimitFailure(env.DB, rate);
            throw unauthorizedSetup();
          }
          const user = (await ctx.context.internalAdapter.findUserById(setup.user_id)) as
            | ({
                id: string;
                email: string;
                role: 'admin' | 'member';
                status: 'active' | 'suspended';
                twoFactorEnabled?: boolean;
              } & Record<string, unknown>)
            | null;
          if (!user || user.role !== 'admin' || user.status !== 'active' || user.twoFactorEnabled) {
            await recordAuthRateLimitFailure(env.DB, rate);
            throw unauthorizedSetup();
          }
          let row = (await ctx.context.adapter.findOne({
            model: 'twoFactor',
            where: [{ field: 'userId', value: user.id }],
          })) as { secret: string; id: string } | null;
          if (!row) {
            const secret = generateRandomString(32);
            row = (await ctx.context.adapter.create({
              model: 'twoFactor',
              data: {
                userId: user.id,
                secret: await symmetricEncrypt({ key: ctx.context.secretConfig, data: secret }),
                backupCodes: '[]',
                verified: false,
              },
            })) as { secret: string; id: string };
          }
          if (!row) throw new Error('mfa_setup_row_missing');
          const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: row.secret });
          await clearAuthRateLimit(env.DB, rate);
          return ctx.json(
            {
              secret,
              totpURI: createOTP(secret).url('Focus Ledger', user.email),
            },
            { headers: noStore },
          );
        },
      ),
      mfaSetupComplete: createAuthEndpoint(
        '/mfa-setup/complete',
        {
          method: 'POST',
          body: z.object({ setupToken: z.string(), code: z.string().regex(/^\d{6}$/) }),
        },
        async (ctx) => {
          const setup = await activeSetup(env.DB, ctx.body.setupToken);
          const rate = await publicRateGate(env, 'mfa', endpointRequest(ctx.request), setup?.user_id);
          if (!setup) {
            await recordAuthRateLimitFailure(env.DB, rate);
            throw unauthorizedSetup();
          }
          const user = (await ctx.context.internalAdapter.findUserById(setup.user_id)) as
            | ({ id: string; status: 'active' | 'suspended' } & Record<string, unknown>)
            | null;
          const factor = (await ctx.context.adapter.findOne({
            model: 'twoFactor',
            where: [{ field: 'userId', value: setup.user_id }],
          })) as { id: string; secret: string } | null;
          if (!user || user.status !== 'active' || !factor) {
            throw APIError.fromStatus('CONFLICT', {
              code: 'mfa_setup_not_started',
              message: 'MFA設定を最初からやり直してください',
            });
          }
          const secret = await symmetricDecrypt({ key: ctx.context.secretConfig, data: factor.secret });
          if (!(await verifyMfaSetupCode(secret, ctx.body.code))) {
            const failed = await recordAuthRateLimitFailure(env.DB, rate);
            if (failed.lockedUntil) rateLimited(authRetryAfterSeconds(failed.lockedUntil));
            throw APIError.from('UNAUTHORIZED', {
              code: 'mfa_code_invalid',
              message: 'コードが正しくありません',
            });
          }
          const now = new Date().toISOString();
          const backupCodes = generateBackupCodes();
          const storedCodes = JSON.stringify(
            await Promise.all(backupCodes.map(async (code) => `h:${await sha256Hex(code)}`)),
          );
          if (
            !(await completeMfaSetupState(env.DB, {
              setupId: setup.id,
              userId: user.id,
              factorId: factor.id,
              storedCodes,
              nowIso: now,
            }))
          )
            throw unauthorizedSetup();
          const refreshed = await ctx.context.internalAdapter.findUserById(user.id);
          if (!refreshed) throw unauthorizedSetup();
          const remember = setup.remember_me === 1;
          const session = await ctx.context.internalAdapter.createSession(user.id, !remember, {
            rememberMe: remember,
          });
          await setSessionCookie(ctx, { session, user: refreshed }, !remember);
          await clearAuthRateLimit(env.DB, rate);
          await writeAuthV2Audit(env.DB, {
            action: 'auth_mfa_enable',
            actorUserId: user.id,
            targetUserId: user.id,
            result: 'succeeded',
            counts: { method_mfa_setup: 1, backup_codes_remaining: backupCodes.length },
          });
          return ctx.json({ status: true, backupCodes }, { headers: noStore });
        },
      ),
      me: createAuthEndpoint('/me', { method: 'GET', use: [sessionMiddleware] }, async (ctx) => {
        const user = ctx.context.session.user as typeof ctx.context.session.user & {
          role: 'admin' | 'member';
          status: 'active' | 'suspended';
          twoFactorEnabled?: boolean;
          lastLoginAt?: Date | string | null;
        };
        if (user.status !== 'active') {
          throw APIError.from('UNAUTHORIZED', { code: 'unauthorized', message: '認証が必要です' });
        }
        const details = await findAccountUserDetails(env.DB, user.id);
        if (!details) {
          throw APIError.from('UNAUTHORIZED', { code: 'unauthorized', message: '認証が必要です' });
        }
        return ctx.json(
          {
            authenticated: true,
            user: details,
          },
          { headers: noStore },
        );
      }),
    },
  } satisfies BetterAuthPlugin;
}

/** Better Auth 標準と同じく、端末時計のずれを前後1枠まで許容し定時間比較する。 */
export const verifyMfaSetupCode = (secret: string, code: string): Promise<boolean> =>
  createOTP(secret).verify(code);
