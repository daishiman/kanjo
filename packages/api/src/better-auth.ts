import { drizzleAdapter } from '@better-auth/drizzle-adapter';
/**
 * ログイン v2 の認証の正本 (Better Auth v1.7.5)。
 *
 * 要求ごとに createAuth(env, scope) を作る。D1 のバインディングは env から来て、
 * 関門が出した設定トークン (scope.mfaSetup) は他の要求へ漏れない (design-decisions 3.1 R-1)。
 *
 * ここに集めるのは Better Auth の設定と、経路をまたぐ判定だけ:
 *   - 関門: TOTP 未設定の管理者と停止中の利用者にセッションを作らない (R-3)
 *   - 保持: 保持なしは 12 時間で、延長しない (R-2)
 *   - 復旧コード: SHA-256 のハッシュで保存する (3.2)
 *   - 連携: 再認証とメール確認を経た link grant が無ければ link-social を拒否する (R-9)
 * アプリ独自の経路 (招待・MFA 設定・再設定の依頼) は auth-endpoints.ts の plugin に置く。
 */
import { REMEMBERED_SESSION_TTL_MS, TRANSIENT_SESSION_TTL_MS, requiresTotpSetup } from '@kanjo/core';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { expireCookie } from 'better-auth/cookies';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { drizzle } from 'drizzle-orm/d1';
import { writeAuthV2Audit, writeLegacyAuthAudit } from './auth-audit.js';
import { issueMfaSetupToken, kanjoAuthEndpoints, readLinkGrant } from './auth-endpoints.js';
import { authSchema } from './auth-schema.js';
import { sha256Hex } from './auth-tokens.js';
import type { MailEnv } from './mail.js';
import {
  findUserByEmail,
  findUserById,
  hashPassword,
  passwordPolicyError,
  verifyPasswordHash,
} from './users.js';

export interface BetterAuthEnv extends MailEnv {
  DB: D1Database;
  /** Cookie の署名と TOTP 秘密鍵の暗号化の鍵。32 文字以上。 */
  BETTER_AUTH_SECRET?: string;
  /** 画面の origin (例 https://kanjo.example.com)。無ければ要求の origin を使う。 */
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

/** 要求ごとの入れ物。関門が設定トークンを出したら、Hono のラッパーがここを見て 200 を返す。 */
export interface AuthScope {
  mfaSetup: { setupToken: string; expiresAt: string } | null;
  waitUntil: (promise: Promise<unknown>) => void;
  auditLoginUserId: string | null;
  auditLogoutUserId: string | null;
  unlinkProvider: 'google' | 'credential' | null;
  mfaEnrollmentUserId: string | null;
  /** Google callbackがこの要求で作った、account未確定のuser。 */
  googleProvisioningUserId: string | null;
  googleProvisioningEmail: string | null;
}

export const newAuthScope = (
  waitUntil: (promise: Promise<unknown>) => void = (promise) => {
    void promise;
  },
): AuthScope => ({
  mfaSetup: null,
  waitUntil,
  auditLoginUserId: null,
  auditLogoutUserId: null,
  unlinkProvider: null,
  mfaEnrollmentUserId: null,
  googleProvisioningUserId: null,
  googleProvisioningEmail: null,
});

export const AUTH_BASE_PATH = '/api/auth';
export const AUTH_COOKIE_PREFIX = 'kanjo';
const ISSUER = 'Focus Ledger';
const BACKUP_CODE_HASH_PREFIX = 'h:';

/**
 * 復旧コードの保存形。twoFactor plugin は JSON 配列の文字列を渡してくる。
 * 生成時 (enable・generate-backup-codes・mfa-setup/complete) と、消費後の保存し直しの両方で呼ばれる。
 */
export async function hashBackupCodes(json: string): Promise<string> {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
    throw new Error('invalid_backup_codes');
  }
  return JSON.stringify(
    await Promise.all(
      parsed.map((code) => (code.startsWith(BACKUP_CODE_HASH_PREFIX) ? code : hashBackupCode(code))),
    ),
  );
}

export const KANJO_TWO_FACTOR_SECURITY = Object.freeze({
  trustDeviceMaxAge: 0,
  accountLockout: Object.freeze({ enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 }),
});

export async function secureMfaVerificationBody(
  path: '/two-factor/verify-totp' | '/two-factor/verify-backup-code',
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (path === '/two-factor/verify-backup-code' && typeof body.code === 'string') {
    return { ...body, code: await hashBackupCode(body.code), trustDevice: false };
  }
  return { ...body, trustDevice: false };
}

/** 照合する側。本文のコードを保存形と同じハッシュへ置き換える (組込みの includes がそのまま効く)。 */
export const hashBackupCode = async (code: string): Promise<string> =>
  `${BACKUP_CODE_HASH_PREFIX}${await sha256Hex(code.trim())}`;

const unauthorizedCredentials = () =>
  APIError.from('UNAUTHORIZED', {
    code: 'invalid_credentials',
    message: 'メールアドレスまたはパスワードが違います',
  });

/** 有効な招待 (未承諾・未取消・期限内) のうち最新の1件。 */
const findPendingInvitation = (db: D1Database, email: string, nowIso: string) =>
  db
    .prepare(
      `SELECT id,role FROM invitations
        WHERE email=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?
        ORDER BY created_at DESC,id DESC LIMIT 1`,
    )
    .bind(email.toLowerCase(), nowIso)
    .first<{ id: string; role: 'admin' | 'member' }>();

/** Google callback開始後にroleが回転した場合、古いroleでは招待を消費しない。 */
export const consumeGoogleInvitation = (
  db: D1Database,
  email: string,
  expectedRole: 'admin' | 'member',
  nowIso: string,
) =>
  db
    .prepare(
      `UPDATE invitations SET accepted_at=?,updated_at=?
        WHERE id=(SELECT id FROM invitations
                   WHERE email=? AND role=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>?
                   ORDER BY created_at DESC,id DESC LIMIT 1)
          AND accepted_at IS NULL AND revoked_at IS NULL
        RETURNING role`,
    )
    .bind(nowIso, nowIso, email.toLowerCase(), expectedRole, nowIso)
    .first<{ role: 'admin' | 'member' }>();

/**
 * D1 adapterはBetter Authの擬似transactionを使えないため、Google user作成後の
 * account作成失敗だけを要求スコープで補償する。既存userやaccount作成済みuserは消さない。
 */
export async function compensateFailedGoogleProvisioning(db: D1Database, scope: AuthScope): Promise<boolean> {
  const userId = scope.googleProvisioningUserId;
  const email = scope.googleProvisioningEmail;
  if (!userId && !email) return false;
  scope.googleProvisioningUserId = null;
  scope.googleProvisioningEmail = null;
  const deleted = await db
    .prepare(
      `DELETE FROM "user"
        WHERE (id=? OR email=?)
          AND NOT EXISTS (SELECT 1 FROM "account" WHERE "userId"="user".id)`,
    )
    .bind(userId ?? '', email ?? '')
    .run();
  return (deleted.meta.changes ?? 0) === 1;
}

export function createAuth(env: BetterAuthEnv, scope: AuthScope, requestUrl?: string) {
  if (!env.BETTER_AUTH_SECRET) throw new Error('auth_not_configured');
  const configuredOrigin = env.BETTER_AUTH_URL?.trim();
  const origin = configuredOrigin || (requestUrl ? new URL(requestUrl).origin : undefined);
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            disableImplicitSignUp: true,
            prompt: 'select_account' as const,
            // メールを確かめていない Google の利用者は、ここと user.create.before の2か所で止める (2.6)。
            mapProfileToUser: async (profile: { email?: string; email_verified?: boolean }) => {
              if (profile.email_verified !== true || typeof profile.email !== 'string') {
                throw unauthorizedCredentials();
              }
              // profileの変換は新規登録・再ログイン・連携の全callbackで呼ばれる。
              // 既存利用者には消費済みの招待を要求せず、DBの役割と状態をそのまま保つ。
              const existing = await findUserByEmail(env.DB, profile.email);
              if (existing) {
                if (existing.status !== 'active') throw unauthorizedCredentials();
                return { role: existing.role, status: existing.status };
              }
              // role/statusはBetter Authがuser hookを呼ぶ前の必須field検査にも必要。
              // DB hookで同じ招待を再検査し、callback中の回転・取消はfail closedにする。
              const invite = await findPendingInvitation(env.DB, profile.email, new Date().toISOString());
              if (!invite) throw unauthorizedCredentials();
              return { role: invite.role, status: 'active' };
            },
          },
        }
      : undefined;

  return betterAuth({
    database: drizzleAdapter(drizzle(env.DB, { schema: authSchema }), {
      provider: 'sqlite',
      schema: authSchema,
      transaction: false,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: origin ? [origin] : [],
    // Better Authはadapter errorのargsにOAuth tokenを含む場合がある。認証結果は専用auditへ残し、
    // library loggerは無効化してtoken/state/Location queryをstdout/stderrへ出さない。
    logger: { disabled: true },
    // 入口のレート制限は既存の計数表で掛ける (2.8)。
    rateLimit: { enabled: false },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true, secure: true },
    },
    emailAndPassword: {
      enabled: true,
      // 自己登録は無い。招待の承諾は auth-endpoints.ts が internalAdapter で作る (R-5)。
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 200,
      // 既存の PBKDF2 のまま読む。移行した利用者が再設定なしで入れる (AT-05)。
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPasswordHash(password, hash),
      },
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        await writeAuthV2Audit(env.DB, {
          action: 'auth_password_reset',
          actorUserId: user.id,
          targetUserId: user.id,
          result: 'succeeded',
        });
      },
    },
    socialProviders: google,
    user: {
      additionalFields: {
        // Better AuthはOAuthのdatabase hookより前にrequired inputを検査する。
        // 入力は拒否したままoptionalとし、hook + DB NOT NULL/CHECKを正本にする。
        role: { type: 'string', input: false, required: false },
        status: { type: 'string', input: false, required: false },
        lastLoginAt: { type: 'date', input: false, required: false },
      },
    },
    session: {
      expiresIn: REMEMBERED_SESSION_TTL_MS / 1000,
      additionalFields: { rememberMe: { type: 'boolean', input: false, required: false } },
    },
    account: {
      accountLinking: { enabled: true, disableImplicitLinking: true, allowDifferentEmails: false },
    },
    verification: {
      // 再設定のトークンは D1 にハッシュだけを置く (2.5)。
      storeIdentifier: { default: 'plain', overrides: { 'reset-password:': 'hashed' } },
    },
    plugins: [
      twoFactor({
        issuer: ISSUER,
        ...KANJO_TWO_FACTOR_SECURITY,
        backupCodeOptions: {
          storeBackupCodes: { encrypt: hashBackupCodes, decrypt: async (stored) => stored },
        },
      }),
      kanjoAuthEndpoints(env, scope),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        switch (ctx.path) {
          case '/reset-password':
          case '/change-password': {
            const body = ctx.body as { newPassword?: unknown; token?: unknown } | undefined;
            if (ctx.path === '/reset-password') {
              const hasQueryToken = ctx.request ? new URL(ctx.request.url).searchParams.has('token') : false;
              if (hasQueryToken || typeof body?.token !== 'string') {
                throw APIError.from('BAD_REQUEST', {
                  code: 'invalid_reset_token_transport',
                  message: '再設定リンクをもう一度開いてください',
                });
              }
            }
            if (typeof body?.newPassword !== 'string') return;
            const problem = passwordPolicyError(body.newPassword);
            if (problem) {
              throw APIError.from('BAD_REQUEST', { code: 'weak_password', message: problem });
            }
            return;
          }
          case '/sign-in/social': {
            // 認可の開始で保持の指定を Cookie に残す。callback は body を持たないため (K-4)。
            const remember = ctx.request ? new URL(ctx.request.url).searchParams.get('remember') : null;
            const cookie = ctx.context.authCookies.dontRememberToken;
            if (remember === '0') {
              await ctx.setSignedCookie(cookie.name, 'true', ctx.context.secret, cookie.attributes);
            } else {
              expireCookie(ctx, cookie);
            }
            return;
          }
          case '/two-factor/verify-totp': {
            const body = ctx.body as Record<string, unknown> | undefined;
            if (!body) return;
            const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
            if (session?.user.id) {
              const factor = await env.DB.prepare('SELECT verified FROM "twoFactor" WHERE "userId"=? LIMIT 1')
                .bind(session.user.id)
                .first<{ verified: number | null }>();
              if (factor && factor.verified !== 1) scope.mfaEnrollmentUserId = session.user.id;
            }
            return { context: { body: await secureMfaVerificationBody(ctx.path, body) } };
          }
          case '/two-factor/verify-backup-code': {
            const body = ctx.body as ({ code?: unknown } & Record<string, unknown>) | undefined;
            if (typeof body?.code !== 'string') return;
            return { context: { body: await secureMfaVerificationBody(ctx.path, body) } };
          }
          case '/two-factor/disable': {
            const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
            if (session?.user.role === 'admin') {
              throw APIError.from('FORBIDDEN', {
                code: 'admin_mfa_required',
                message: '管理者はMFAを解除できません',
              });
            }
            return;
          }
          case '/link-social': {
            // 連携はメール確認まで済んだ本人だけ (R-9)。grant は1回で消費する。
            const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
            const userId = session?.user.id;
            if (!userId) {
              throw APIError.from('FORBIDDEN', {
                code: 'link_not_confirmed',
                message: '連携の確認が必要です',
              });
            }
            const grant = await readLinkGrant(ctx, env.DB, 'google', userId);
            if (!grant) {
              throw APIError.from('FORBIDDEN', {
                code: 'link_not_confirmed',
                message: '連携の確認が必要です',
              });
            }
            return;
          }
          case '/unlink-account': {
            const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
            const userId = session?.user.id;
            const body = ctx.body as { accountId?: unknown } | undefined;
            if (userId && typeof body?.accountId === 'string') {
              const account = await env.DB.prepare(
                'SELECT "providerId" FROM account WHERE id=? AND "userId"=? LIMIT 1',
              )
                .bind(body.accountId, userId)
                .first<{ providerId: string }>();
              scope.unlinkProvider =
                account?.providerId === 'google' || account?.providerId === 'credential'
                  ? account.providerId
                  : null;
            }
            return;
          }
          case '/sign-out': {
            const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
            scope.auditLogoutUserId = session?.user.id ?? null;
            return;
          }
          default:
            return;
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.context.returned instanceof APIError) return;
        const sessionUserId = ctx.context.session?.user.id ?? ctx.context.newSession?.user.id ?? null;
        switch (ctx.path) {
          case '/two-factor/disable':
            if (sessionUserId) {
              await writeAuthV2Audit(env.DB, {
                action: 'auth_mfa_disable',
                actorUserId: sessionUserId,
                targetUserId: sessionUserId,
                result: 'succeeded',
                counts: { method_totp: 1 },
              });
            }
            return;
          case '/two-factor/verify-totp':
            if (scope.mfaEnrollmentUserId) {
              await writeAuthV2Audit(env.DB, {
                action: 'auth_mfa_enable',
                actorUserId: scope.mfaEnrollmentUserId,
                targetUserId: scope.mfaEnrollmentUserId,
                result: 'succeeded',
                counts: { method_totp: 1 },
              });
            }
            return;
          case '/two-factor/verify-backup-code':
            if (sessionUserId) {
              await writeAuthV2Audit(env.DB, {
                action: 'auth_mfa_backup_code_used',
                actorUserId: sessionUserId,
                targetUserId: sessionUserId,
                result: 'succeeded',
                counts: { method_backup_code: 1 },
              });
            }
            return;
          case '/two-factor/generate-backup-codes':
            if (sessionUserId) {
              await writeAuthV2Audit(env.DB, {
                action: 'auth_mfa_backup_codes_regenerated',
                actorUserId: sessionUserId,
                targetUserId: sessionUserId,
                result: 'succeeded',
              });
            }
            return;
          case '/unlink-account':
            if (sessionUserId && scope.unlinkProvider) {
              await writeAuthV2Audit(env.DB, {
                action: 'auth_link_remove',
                actorUserId: sessionUserId,
                targetUserId: sessionUserId,
                result: 'succeeded',
                counts: scope.unlinkProvider === 'google' ? { provider_google: 1 } : { provider_password: 1 },
              });
            }
            return;
          case '/change-password':
            if (sessionUserId) {
              await writeLegacyAuthAudit(env.DB, {
                action: 'auth_password_change',
                actorUserId: sessionUserId,
                result: 'succeeded',
              });
            }
            return;
          default:
            return;
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            // 招待の承諾は auth-endpoints.ts が役割と状態を渡して作る。
            if (ctx?.path === '/invite/accept') return { data: user };
            // それ以外で新しい利用者が作られるのは Google の callback だけ。有効な招待が無ければ拒否する。
            if (!ctx?.path?.startsWith('/callback/') || user.emailVerified !== true) return false;
            const invite = await findPendingInvitation(env.DB, user.email, new Date().toISOString());
            if (!invite) return false;
            scope.googleProvisioningEmail = user.email.toLowerCase();
            return { data: { ...user, role: invite.role, status: 'active', emailVerified: true } };
          },
          after: async (user, ctx) => {
            if (!ctx?.path?.startsWith('/callback/')) return;
            // account insertより前なので、ここで招待は消費しない。
            // user IDは要求ローカルに限定し、callback失敗時の補償対象を一意にする。
            scope.googleProvisioningUserId = user.id;
          },
        },
      },
      session: {
        create: {
          before: async (session, ctx) => {
            const user = await findUserById(env.DB, session.userId);
            if (!user || user.status !== 'active') return false;
            const path = ctx?.path ?? '';
            const body = (ctx?.body ?? {}) as { rememberMe?: unknown };
            const carried = (session as { rememberMe?: unknown }).rememberMe;
            // 保持の指定: 引き継ぎ (MFA 設定の完了・TOTP の有効化) > パスワードの body > 署名付き Cookie。
            const remember =
              carried !== undefined && carried !== null
                ? Boolean(carried)
                : path === '/sign-in/email'
                  ? body.rememberMe !== false
                  : !(
                      ctx &&
                      (await ctx.getSignedCookie(
                        ctx.context.authCookies.dontRememberToken.name,
                        ctx.context.secret,
                      ))
                    );
            if (requiresTotpSetup({ role: user.role, twoFactorEnabled: user.twoFactorEnabled === 1, path })) {
              // パスワードで入った TOTP 未設定の管理者には、セッションの代わりに設定トークンを渡す (R-1)。
              if (path === '/sign-in/email')
                scope.mfaSetup = await issueMfaSetupToken(env.DB, user.id, remember);
              return false;
            }
            const expiresAt = remember ? session.expiresAt : new Date(Date.now() + TRANSIENT_SESSION_TTL_MS);
            return { data: { ...session, rememberMe: remember, expiresAt } };
          },
          after: async (session, ctx) => {
            // TOTP 設定済みの人の /sign-in/email は、twoFactor の after フックがこのセッションを消す。
            // 最終ログインは、コードを確かめた後に作られるセッションで記録する。
            const firstFactorOnly = ctx?.path === '/sign-in/email' ? 1 : 0;
            const now = new Date().toISOString();
            await env.DB.prepare(
              `UPDATE "user" SET "lastLoginAt"=?,"updatedAt"=?
                WHERE id=? AND NOT (? = 1 AND COALESCE("twoFactorEnabled",0) = 1)`,
            )
              .bind(now, now, session.userId, firstFactorOnly)
              .run();
            const user = await findUserById(env.DB, session.userId);
            const enrollmentSession =
              ctx?.path === '/two-factor/verify-totp' && scope.mfaEnrollmentUserId === session.userId;
            if (!enrollmentSession && !(ctx?.path === '/sign-in/email' && user?.twoFactorEnabled === 1)) {
              scope.auditLoginUserId = session.userId;
            }
          },
        },
        update: {
          before: async (data, ctx) => {
            // 保持なしは延長しない。false を返すと getSession が 401 になるので、期限を据え置く (R-2)。
            const current = ctx?.context.session?.session as
              | { rememberMe?: unknown; expiresAt?: Date }
              | undefined;
            if (current && current.rememberMe === false && current.expiresAt) {
              return { data: { ...data, expiresAt: current.expiresAt } };
            }
            return { data };
          },
        },
      },
      account: {
        create: {
          after: async (account, ctx) => {
            const userId = ctx?.context?.session?.user.id;
            if (userId && account.userId === userId && account.providerId === 'google') {
              await writeAuthV2Audit(env.DB, {
                action: 'auth_link_add',
                actorUserId: userId,
                targetUserId: userId,
                result: 'succeeded',
                counts: { provider_google: 1 },
              });
            }
            if (
              account.providerId === 'google' &&
              scope.googleProvisioningUserId &&
              account.userId === scope.googleProvisioningUserId
            ) {
              // Google新規登録の確定点はaccount insert後。ここで初めて招待を消費する。
              const user = await findUserById(env.DB, account.userId);
              const now = new Date().toISOString();
              const expectedRole = user?.role;
              const consumed =
                user && (expectedRole === 'admin' || expectedRole === 'member')
                  ? await consumeGoogleInvitation(env.DB, user.email, expectedRole, now)
                  : null;
              if (!user || !consumed || consumed.role !== expectedRole) {
                await env.DB.prepare('DELETE FROM "user" WHERE id=?').bind(account.userId).run();
                scope.googleProvisioningUserId = null;
                scope.googleProvisioningEmail = null;
                throw unauthorizedCredentials();
              }
              await writeAuthV2Audit(env.DB, {
                action: 'auth_invite_accept',
                actorUserId: user.id,
                targetUserId: user.id,
                result: 'succeeded',
                counts: { provider_google: 1 },
              });
              scope.googleProvisioningUserId = null;
              scope.googleProvisioningEmail = null;
            }
          },
        },
      },
    },
  });
}

export type KanjoAuth = ReturnType<typeof createAuth>;
