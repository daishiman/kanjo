import { invitationExpiresAt, invitationStatus } from '@kanjo/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildAuditStatements } from '../audit-log.js';
import { writeAuthV2Audit } from '../auth-audit.js';
import { newOpaqueToken, newRowId, sha256Hex } from '../auth-tokens.js';
import { type AuthEnv, type AuthVariables, TENANT_ID, adminGuard } from '../auth.js';
import { rotateAndDeliverInvitation } from '../invitations.js';
import { MailSendError, createSendMail } from '../mail.js';
import { publicJsonValidator } from '../public-validation.js';
import {
  USER_ROLES,
  USER_STATUSES,
  findUserByEmail,
  findUserById,
  isValidEmail,
  listUsers,
  normalizeEmail,
  prepareSuspendedSessionPurge,
  prepareUserAdminUpdate,
  toPublicUser,
} from '../users.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };
type InvitationRole = (typeof USER_ROLES)[number];

interface InvitationRow {
  id: string;
  email: string;
  role: InvitationRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

const invitationDto = (row: InvitationRow, now = new Date()) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: invitationStatus(
    {
      expiresAt: new Date(row.expires_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    },
    now,
  ),
  expiresAt: row.expires_at,
  invitedBy: row.invited_by,
  createdAt: row.created_at,
  acceptedAt: row.accepted_at,
});

const updateSchema = z
  .object({ role: z.enum(USER_ROLES).optional(), status: z.enum(USER_STATUSES).optional() })
  .refine((value) => value.role !== undefined || value.status !== undefined);
const inviteSchema = z.object({ email: z.string().min(3).max(254), role: z.enum(USER_ROLES) });
const notFound = { error: { code: 'not_found', message: '対象が見つかりません' } } as const;

export const adminUsersRoute = new Hono<Ctx>();
adminUsersRoute.use('/admin/*', adminGuard());

adminUsersRoute.get('/admin/users', async (c) =>
  c.json({ users: (await listUsers(c.env.DB)).map(toPublicUser) }),
);

adminUsersRoute.patch('/admin/users/:id', publicJsonValidator(updateSchema), async (c) => {
  const target = await findUserById(c.env.DB, c.req.param('id'));
  if (!target) return c.json(notFound, 404);
  const body = c.req.valid('json');
  const promotesToAdmin = target.role !== 'admin' && body.role === 'admin';
  const now = new Date().toISOString();
  const operationId = crypto.randomUUID();
  const audit = buildAuditStatements({
    database: c.env.DB,
    auditId: operationId,
    userId: TENANT_ID,
    actorUserId: c.get('actor').id,
    operationId,
    action: body.status === 'suspended' ? 'admin_user_suspend' : 'admin_user_update',
    scope: { kind: 'account', userId: target.id },
    counts: {},
    occurredAt: now,
    result: 'succeeded',
    onlyIfPreviousStatementChanged: true,
  });
  const [updated] = await c.env.DB.batch([
    prepareUserAdminUpdate(c.env.DB, target.id, body, now),
    ...audit.statements,
    prepareSuspendedSessionPurge(c.env.DB, target.id, promotesToAdmin),
  ]);
  if (Number(updated.meta.changes ?? 0) === 0) {
    return c.json({ error: { code: 'last_admin', message: '有効な管理者が0人になる操作はできません' } }, 409);
  }
  const user = await findUserById(c.env.DB, target.id);
  return c.json({ user: user ? toPublicUser(user) : null });
});

adminUsersRoute.get('/admin/invitations', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id,email,role,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at
       FROM invitations ORDER BY created_at DESC,id DESC LIMIT 200`,
  ).all<InvitationRow>();
  return c.json({ invitations: (rows.results ?? []).map((row) => invitationDto(row)) });
});

const applicationOrigin = (env: AuthEnv, requestUrl: string) =>
  (env.BETTER_AUTH_URL?.trim() || new URL(requestUrl).origin).replace(/\/api\/auth$/, '');

adminUsersRoute.post('/admin/invitations', publicJsonValidator(inviteSchema), async (c) => {
  const body = c.req.valid('json');
  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) {
    return c.json({ error: { code: 'invalid_email', message: 'メールアドレスの形式が不正です' } }, 400);
  }
  if (await findUserByEmail(c.env.DB, email)) {
    return c.json({ error: { code: 'user_exists', message: 'このメールアドレスは登録済みです' } }, 409);
  }
  const token = newOpaqueToken();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = invitationExpiresAt(now).toISOString();
  const write = c.env.DB.prepare(
    `INSERT INTO invitations
       (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
     SELECT ?,?,?,?,?,NULL,NULL,?,?,?
       WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE email=?)
     ON CONFLICT(email) WHERE accepted_at IS NULL AND revoked_at IS NULL DO UPDATE SET
       role=excluded.role,
       token_hash=excluded.token_hash,
       expires_at=excluded.expires_at,
       updated_at=excluded.updated_at
     WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE email=excluded.email)
     RETURNING id,email,role,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at`,
  ).bind(
    newRowId(),
    email,
    body.role,
    await sha256Hex(token),
    expiresAt,
    c.get('actor').id,
    nowIso,
    nowIso,
    email,
  );
  const operationId = crypto.randomUUID();
  const audit = buildAuditStatements({
    database: c.env.DB,
    auditId: operationId,
    userId: TENANT_ID,
    actorUserId: c.get('actor').id,
    operationId,
    action: 'admin_user_invite',
    scope: { kind: 'account' },
    counts: {},
    occurredAt: nowIso,
    result: 'succeeded',
    onlyIfPreviousStatementChanged: true,
  });
  const [writeResult] = await c.env.DB.batch([write, ...audit.statements]);
  const row = (writeResult.results as unknown as InvitationRow[])[0];
  if (!row) {
    return c.json({ error: { code: 'user_exists', message: 'このメールアドレスは登録済みです' } }, 409);
  }
  try {
    await createSendMail(c.env)(row.email, 'invite', {
      url: `${applicationOrigin(c.env, c.req.url)}/invite/accept?token=${encodeURIComponent(token)}`,
      role: row.role,
    });
  } catch (error) {
    if (error instanceof MailSendError) {
      return c.json(
        { error: { code: 'mail_send_failed', message: '招待メールを送信できませんでした' } },
        502,
      );
    }
    throw error;
  }
  return c.json({ invitation: invitationDto(row) }, 201);
});

adminUsersRoute.post('/admin/invitations/:id/resend', async (c) => {
  let updated: InvitationRow | null = null;
  try {
    updated = await rotateAndDeliverInvitation({
      db: c.env.DB,
      sendMail: createSendMail(c.env),
      appOrigin: applicationOrigin(c.env, c.req.url),
      selector: { id: c.req.param('id') },
    });
  } catch (error) {
    if (error instanceof MailSendError) {
      return c.json(
        { error: { code: 'mail_send_failed', message: '招待メールを送信できませんでした' } },
        502,
      );
    }
    throw error;
  }
  if (!updated) {
    const exists = await c.env.DB.prepare('SELECT id FROM invitations WHERE id=?')
      .bind(c.req.param('id'))
      .first();
    return exists
      ? c.json({ error: { code: 'invitation_not_pending', message: 'この招待は再送できません' } }, 409)
      : c.json(notFound, 404);
  }
  await writeAuthV2Audit(c.env.DB, {
    action: 'admin_invite_resend',
    actorUserId: c.get('actor').id,
    result: 'succeeded',
    counts: { mail_queued: 1 },
  });
  return c.json({ invitation: invitationDto(updated) });
});

adminUsersRoute.post('/admin/invitations/:id/revoke', async (c) => {
  const now = new Date().toISOString();
  const result = await c.env.DB.prepare(
    `UPDATE invitations SET revoked_at=?,updated_at=?
      WHERE id=? AND accepted_at IS NULL AND revoked_at IS NULL`,
  )
    .bind(now, now, c.req.param('id'))
    .run();
  if (Number(result.meta.changes ?? 0) !== 1) {
    const exists = await c.env.DB.prepare('SELECT id FROM invitations WHERE id=?')
      .bind(c.req.param('id'))
      .first();
    return exists
      ? c.json({ error: { code: 'invitation_not_pending', message: 'この招待は取消できません' } }, 409)
      : c.json(notFound, 404);
  }
  const row = (await c.env.DB.prepare(
    `SELECT id,email,role,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at
       FROM invitations WHERE id=?`,
  )
    .bind(c.req.param('id'))
    .first<InvitationRow>())!;
  await writeAuthV2Audit(c.env.DB, {
    action: 'admin_invite_revoke',
    actorUserId: c.get('actor').id,
    result: 'succeeded',
  });
  return c.json({ invitation: invitationDto(row) });
});
