/**
 * 利用者管理 (設定画面の「利用者」セクション)。admin だけが到達できる。
 *
 * 自己サインアップは持たない。増やすのも止めるのも既存 admin の操作としてだけ起きる。
 * 平文パスワードを返すのは一時パスワード発行の応答1回だけで、保存はしない。
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { type AuthEnv, type AuthVariables, adminGuard } from '../auth.js';
import { publicJsonValidator } from '../public-validation.js';
import {
  PASSWORD_MAX_LENGTH,
  USER_ROLES,
  USER_STATUSES,
  findUserByEmail,
  findUserById,
  generateTemporaryPassword,
  hashPassword,
  isValidEmail,
  listUsers,
  normalizeEmail,
  passwordPolicyError,
  preparePasswordUpdateAndRevoke,
  prepareUserAdminUpdate,
  prepareUserInvitation,
  toPublicUser,
} from '../users.js';
import { buildAuthAuditPlan } from './auth.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

const createSchema = z.object({
  email: z.string().min(3).max(254),
  role: z.enum(USER_ROLES),
  // 省略時は一時パスワードを発行する。管理者が初期値を決め打ちしなくてよい。
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
});

const updateSchema = z
  .object({ role: z.enum(USER_ROLES).optional(), status: z.enum(USER_STATUSES).optional() })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'role か status のどちらかを指定してください',
  });

const notFound = { error: { code: 'not_found', message: '利用者が見つかりません' } } as const;

const lastAdmin = {
  error: { code: 'last_admin', message: '有効な管理者が0人になる操作はできません' },
} as const;

export const adminUsersRoute = new Hono<Ctx>();

// /api/* の共通authGuardを通過済み。ここではadmin認可だけを1度適用する。
adminUsersRoute.use('/admin/*', adminGuard());

adminUsersRoute.get('/admin/users', async (c) => {
  const rows = await listUsers(c.env.DB);
  return c.json({ users: rows.map(toPublicUser) });
});

adminUsersRoute.post('/admin/users', publicJsonValidator(createSchema), async (c) => {
  const env = c.env;
  const actor = c.get('actor');
  const body = c.req.valid('json');
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return c.json({ error: { code: 'invalid_email', message: 'メールアドレスの形式が不正です' } }, 400);
  }
  if (await findUserByEmail(env.DB, email)) {
    return c.json({ error: { code: 'email_taken', message: 'そのメールアドレスは登録済みです' } }, 409);
  }
  if (body.password) {
    const policyError = passwordPolicyError(body.password);
    if (policyError) return c.json({ error: { code: 'weak_password', message: policyError } }, 400);
  }

  // 管理者が決めた初期パスワードも一時扱いにする。管理者が知っている値のまま使わせない。
  const temporaryPassword = body.password ?? generateTemporaryPassword();
  const now = new Date().toISOString();
  const invitation = prepareUserInvitation({
    db: env.DB,
    email,
    passwordHash: await hashPassword(temporaryPassword),
    role: body.role,
    mustChangePassword: true,
    now,
  });
  const audit = buildAuthAuditPlan(env.DB, {
    action: 'admin_user_invite',
    actorUserId: actor.id,
    scope: { kind: 'account', userId: invitation.user.id },
    occurredAt: now,
    result: 'succeeded',
  });
  await env.DB.batch([invitation.statement, ...audit.statements]);
  // この応答が平文を見せる唯一の機会。以後どこからも取り出せない。
  return c.json({ user: toPublicUser(invitation.user), temporaryPassword }, 201);
});

adminUsersRoute.patch('/admin/users/:id', publicJsonValidator(updateSchema), async (c) => {
  const env = c.env;
  const actor = c.get('actor');
  const target = await findUserById(env.DB, c.req.param('id'));
  if (!target) return c.json(notFound, 404);
  const body = c.req.valid('json');

  const now = new Date().toISOString();
  const update = prepareUserAdminUpdate(env.DB, target.id, body, now);
  const audit = buildAuthAuditPlan(env.DB, {
    action: body.status === 'suspended' ? 'admin_user_suspend' : 'admin_user_update',
    actorUserId: actor.id,
    scope: { kind: 'account', userId: target.id },
    occurredAt: now,
    result: 'succeeded',
    onlyIfPreviousStatementChanged: true,
  });
  const [updatedResult] = await env.DB.batch([update, ...audit.statements]);
  if ((updatedResult.meta.changes ?? 0) === 0) return c.json(lastAdmin, 409);
  const updated = await findUserById(env.DB, target.id);
  return c.json({ user: updated ? toPublicUser(updated) : null });
});

adminUsersRoute.post('/admin/users/:id/password-reset', async (c) => {
  const env = c.env;
  const actor = c.get('actor');
  const target = await findUserById(env.DB, c.req.param('id'));
  if (!target) return c.json(notFound, 404);

  const temporaryPassword = generateTemporaryPassword();
  const temporaryHash = await hashPassword(temporaryPassword);
  const now = new Date().toISOString();
  // 世代も進む。再発行はパスワードを失った状況で行うため、古い端末のセッションを残さない。
  const update = preparePasswordUpdateAndRevoke(env.DB, target.id, temporaryHash, true, now);
  const audit = buildAuthAuditPlan(env.DB, {
    action: 'admin_user_password_reset',
    actorUserId: actor.id,
    scope: { kind: 'account', userId: target.id },
    occurredAt: now,
    result: 'succeeded',
  });
  await env.DB.batch([update, ...audit.statements]);
  return c.json({
    user: toPublicUser({
      ...target,
      must_change_password: 1,
      temporary_password_expires_at: new Date(Date.parse(now) + 72 * 60 * 60 * 1000).toISOString(),
    }),
    temporaryPassword,
  });
});
