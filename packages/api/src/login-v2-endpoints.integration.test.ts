import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAuthAuditRetention } from './auth-audit.js';
import { cleanupExpiredAuthArtifacts } from './auth-cleanup.js';
import { sha256Hex } from './auth-tokens.js';
import { TEST_ADMIN, TEST_BETTER_AUTH_SECRET, loginForTest, seedTestUser } from './auth.test-support.js';
import { app } from './index.js';
import { type MailParams, MailSendError, type MailTemplate, setSendMailForTest } from './mail.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const TEST_ORIGIN = 'http://localhost';

let miniflare: Miniflare | undefined;
let db: D1Database;
let files: R2Bucket;

const env = () => ({
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: TEST_ORIGIN,
  DB: db,
  FILES: files,
});

const post = (path: string, body: unknown, cookie?: string, ip = '192.0.2.10') =>
  app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': ip,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    },
    env(),
  );

const protectedRequest = (method: 'GET' | 'PATCH', path: string, cookie: string, body?: unknown) =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env(),
  );

const tokenFromUrl = (url: string, key: 'token' | 'link_token' = 'token'): string => {
  const token = new URL(url).searchParams.get(key);
  if (!token) throw new Error(`missing_${key}`);
  return token;
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'login-v2-endpoints-integration',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  db = (await miniflare.getD1Database('DB')) as D1Database;
  files = (await miniflare.getR2Bucket('FILES')) as unknown as R2Bucket;
  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const migration of migrations) {
    const source = readFileSync(resolve(migrationsDir, migration), 'utf8');
    for (const sql of splitMigrationStatements(source)) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, migrations);
}, 30_000);

beforeEach(async () => {
  const tables = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results.filter(({ name }) => isApplicationTableForTestReset(name))) {
    await db.prepare(`DELETE FROM "${name}"`).run();
  }
});

afterEach(() => setSendMailForTest(null));
afterAll(async () => miniflare?.dispose());

describe('login v2 endpoint integration', () => {
  it('admin invitation create, resend, revoke rotates hashed tokens and records sanitized audits', async () => {
    const adminCookie = await loginForTest(app, env(), {
      role: 'admin',
      twoFactorEnabled: true,
    });
    const sent: Array<{ to: string; template: MailTemplate; params: MailParams }> = [];
    setSendMailForTest(async (to, template, params) => {
      sent.push({ to, template, params });
    });

    const created = await post(
      '/admin/invitations',
      { email: '  NEW.MEMBER@EXAMPLE.TEST ', role: 'member' },
      adminCookie,
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      invitation: { id: string; email: string; role: string; status: string };
    };
    expect(createdBody.invitation).toMatchObject({
      email: 'new.member@example.test',
      role: 'member',
      status: 'pending',
    });
    expect(sent).toHaveLength(1);
    const firstToken = tokenFromUrl(sent[0]!.params.url);
    const firstRow = await db
      .prepare('SELECT token_hash FROM invitations WHERE id=?')
      .bind(createdBody.invitation.id)
      .first<{ token_hash: string }>();
    expect(firstRow?.token_hash).toBe(await sha256Hex(firstToken));
    expect(JSON.stringify(createdBody)).not.toContain(firstToken);

    const resent = await post(`/admin/invitations/${createdBody.invitation.id}/resend`, {}, adminCookie);
    expect(resent.status).toBe(200);
    expect(sent).toHaveLength(2);
    const secondToken = tokenFromUrl(sent[1]!.params.url);
    expect(secondToken).not.toBe(firstToken);
    const secondRow = await db
      .prepare('SELECT token_hash FROM invitations WHERE id=?')
      .bind(createdBody.invitation.id)
      .first<{ token_hash: string }>();
    expect(secondRow?.token_hash).toBe(await sha256Hex(secondToken));
    expect(secondRow?.token_hash).not.toBe(firstRow?.token_hash);

    const revoked = await post(`/admin/invitations/${createdBody.invitation.id}/revoke`, {}, adminCookie);
    expect(revoked.status).toBe(200);
    await expect(revoked.json()).resolves.toMatchObject({ invitation: { status: 'revoked' } });
    expect((await post('/auth/invite/inspect', { token: secondToken }, undefined, '192.0.2.11')).status).toBe(
      404,
    );

    const authAudits = await db
      .prepare(
        `SELECT action,counts_json FROM auth_audit_log
           WHERE action IN ('admin_invite_resend','admin_invite_revoke') ORDER BY occurred_at,id`,
      )
      .all<{ action: string; counts_json: string }>();
    expect(authAudits.results).toEqual([
      { action: 'admin_invite_resend', counts_json: '{"mail_queued":1}' },
      { action: 'admin_invite_revoke', counts_json: '{}' },
    ]);
    expect(JSON.stringify(authAudits.results)).not.toContain('new.member@example.test');
    expect(JSON.stringify(authAudits.results)).not.toContain(secondToken);
  });

  it('admin invitation mail failure is explicit but never returns the recipient or token', async () => {
    const adminCookie = await loginForTest(app, env(), {
      role: 'admin',
      twoFactorEnabled: true,
    });
    let attemptedUrl = '';
    setSendMailForTest(async (_to, template, params) => {
      attemptedUrl = params.url;
      throw new MailSendError(template, 503);
    });

    const response = await post(
      '/admin/invitations',
      { email: 'mail-failure@example.test', role: 'member' },
      adminCookie,
    );
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      error: { code: 'mail_send_failed', message: '招待メールを送信できませんでした' },
    });
    expect(text).not.toContain('mail-failure@example.test');
    expect(text).not.toContain(tokenFromUrl(attemptedUrl));
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM invitations WHERE email=?')
        .bind('mail-failure@example.test')
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
  });

  it('admin invitation validation, pending update, listing, and terminal-state conflicts stay explicit', async () => {
    const adminCookie = await loginForTest(app, env(), {
      role: 'admin',
      twoFactorEnabled: true,
    });
    expect(
      (await post('/admin/invitations', { email: 'not-an-email', role: 'member' }, adminCookie)).status,
    ).toBe(400);
    expect(
      (await post('/admin/invitations', { email: TEST_ADMIN.email, role: 'member' }, adminCookie)).status,
    ).toBe(409);

    setSendMailForTest(async () => undefined);
    const first = await post(
      '/admin/invitations',
      { email: 'pending-update@example.test', role: 'member' },
      adminCookie,
    );
    const firstBody = (await first.json()) as { invitation: { id: string } };
    const updated = await post(
      '/admin/invitations',
      { email: 'pending-update@example.test', role: 'admin' },
      adminCookie,
    );
    expect(updated.status).toBe(201);
    await expect(updated.json()).resolves.toMatchObject({
      invitation: { id: firstBody.invitation.id, role: 'admin', status: 'pending' },
    });
    const listed = await protectedRequest('GET', '/admin/invitations', adminCookie);
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      invitations: [{ id: firstBody.invitation.id, role: 'admin', status: 'pending' }],
    });
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM invitations WHERE email=?')
        .bind('pending-update@example.test')
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });

    const beforeFailedResend = await db
      .prepare('SELECT token_hash,expires_at,updated_at FROM invitations WHERE id=?')
      .bind(firstBody.invitation.id)
      .first();

    setSendMailForTest(async (_to, template) => {
      throw new MailSendError(template, null);
    });
    const failedResend = await post(`/admin/invitations/${firstBody.invitation.id}/resend`, {}, adminCookie);
    expect(failedResend.status).toBe(502);
    expect(
      await db
        .prepare('SELECT token_hash,expires_at,updated_at FROM invitations WHERE id=?')
        .bind(firstBody.invitation.id)
        .first(),
    ).toEqual(beforeFailedResend);
    await db
      .prepare('UPDATE invitations SET accepted_at=?,updated_at=? WHERE id=?')
      .bind(new Date().toISOString(), new Date().toISOString(), firstBody.invitation.id)
      .run();
    expect((await post(`/admin/invitations/${firstBody.invitation.id}/resend`, {}, adminCookie)).status).toBe(
      409,
    );
    expect((await post(`/admin/invitations/${firstBody.invitation.id}/revoke`, {}, adminCookie)).status).toBe(
      409,
    );
    expect((await post('/admin/invitations/missing/resend', {}, adminCookie)).status).toBe(404);
    expect((await post('/admin/invitations/missing/revoke', {}, adminCookie)).status).toBe(404);
  });

  it('member cannot use admin invitation endpoints', async () => {
    const memberCookie = await loginForTest(app, env(), {
      role: 'member',
      twoFactorEnabled: false,
    });
    const response = await post(
      '/admin/invitations',
      { email: 'forbidden@example.test', role: 'member' },
      memberCookie,
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'forbidden', message: '管理者のみが実行できます' },
    });
    expect(await db.prepare('SELECT count(*) AS count FROM invitations').first<{ count: number }>()).toEqual({
      count: 0,
    });
  });

  it('admin role/status changes purge unsafe sessions and expose only public user fields', async () => {
    const adminCookie = await loginForTest(app, env(), {
      role: 'admin',
      twoFactorEnabled: true,
    });
    await loginForTest(app, env(), {
      id: 'usr_promoted_member',
      email: 'promoted@example.test',
      role: 'member',
    });
    await loginForTest(app, env(), {
      id: 'usr_suspended_member',
      email: 'suspended@example.test',
      role: 'member',
    });

    const listed = await protectedRequest('GET', '/admin/users', adminCookie);
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { users: Array<Record<string, unknown>> };
    expect(listBody.users).toHaveLength(3);
    expect(JSON.stringify(listBody)).not.toContain('password');

    const promoted = await protectedRequest('PATCH', '/admin/users/usr_promoted_member', adminCookie, {
      role: 'admin',
    });
    expect(promoted.status).toBe(200);
    await expect(promoted.json()).resolves.toMatchObject({
      user: { id: 'usr_promoted_member', role: 'admin', status: 'active' },
    });
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM session WHERE "userId"=?')
        .bind('usr_promoted_member')
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });

    const suspended = await protectedRequest('PATCH', '/admin/users/usr_suspended_member', adminCookie, {
      status: 'suspended',
    });
    expect(suspended.status).toBe(200);
    await expect(suspended.json()).resolves.toMatchObject({
      user: { id: 'usr_suspended_member', role: 'member', status: 'suspended' },
    });
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM session WHERE "userId"=?')
        .bind('usr_suspended_member')
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });

    const missing = await protectedRequest('PATCH', '/admin/users/usr_missing', adminCookie, {
      role: 'member',
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: { code: 'not_found', message: '対象が見つかりません' },
    });
    const auditActions = await db
      .prepare(
        `SELECT action FROM audit_log
           WHERE action IN ('admin_user_update','admin_user_suspend') ORDER BY occurred_at,id`,
      )
      .all<{ action: string }>();
    expect(auditActions.results).toEqual([{ action: 'admin_user_update' }, { action: 'admin_user_suspend' }]);
  });

  it('the sole active admin cannot remove the final administration path', async () => {
    const adminCookie = await loginForTest(app, env(), {
      role: 'admin',
      twoFactorEnabled: true,
    });
    const response = await protectedRequest('PATCH', `/admin/users/${TEST_ADMIN.id}`, adminCookie, {
      role: 'member',
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'last_admin', message: '有効な管理者が0人になる操作はできません' },
    });
    expect(await db.prepare('SELECT role,status FROM "user" WHERE id=?').bind(TEST_ADMIN.id).first()).toEqual(
      { role: 'admin', status: 'active' },
    );
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM session WHERE "userId"=?')
        .bind(TEST_ADMIN.id)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
  });

  it('password reset is enumeration-safe, consumes only a hashed token, revokes sessions, and audits success', async () => {
    const oldCookie = await loginForTest(app, env(), {
      role: 'member',
      email: 'reset-me@example.test',
    });
    await seedTestUser(db, {
      id: 'usr_suspended_reset',
      email: 'suspended-reset@example.test',
      role: 'member',
      status: 'suspended',
    });
    const sent: Array<{ to: string; url: string }> = [];
    setSendMailForTest(async (to, _template, params) => {
      sent.push({ to, url: params.url });
    });

    const responses = await Promise.all([
      post('/auth/password-reset/request', { email: 'reset-me@example.test' }, undefined, '192.0.2.21'),
      post('/auth/password-reset/request', { email: 'missing@example.test' }, undefined, '192.0.2.22'),
      post(
        '/auth/password-reset/request',
        { email: 'suspended-reset@example.test' },
        undefined,
        '192.0.2.23',
      ),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([202, 202, 202]);
    const bodies = await Promise.all(responses.map((response) => response.text()));
    expect(new Set(bodies)).toEqual(new Set(['{"ok":true}']));
    expect(responses.map((response) => response.headers.get('cache-control'))).toEqual([
      expect.stringContaining('no-store'),
      expect.stringContaining('no-store'),
      expect.stringContaining('no-store'),
    ]);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.to).toBe('reset-me@example.test');

    const resetToken = tokenFromUrl(sent[0]!.url);
    const verification = await db
      .prepare('SELECT identifier,value FROM verification')
      .first<{ identifier: string; value: string }>();
    expect(verification?.value).toBe(TEST_ADMIN.id);
    expect(verification?.identifier).not.toContain(resetToken);
    expect(JSON.stringify(verification)).not.toContain('reset-password:');

    const newPassword = 'Quartz-river-cobalt-93';
    const reset = await post('/auth/reset-password', { token: resetToken, newPassword });
    expect(reset.status).toBe(200);
    await expect(reset.json()).resolves.toEqual({ status: true });
    expect((await post('/auth/reset-password', { token: resetToken, newPassword })).status).toBe(400);

    expect((await app.request('/api/auth/me', { headers: { cookie: oldCookie } }, env())).status).toBe(401);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: 'reset-me@example.test',
          password: TEST_ADMIN.password,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: 'reset-me@example.test',
          password: newPassword,
        })
      ).status,
    ).toBe(200);
    expect(
      await db
        .prepare(
          `SELECT action,scope,counts_json FROM auth_audit_log
             WHERE action='auth_password_reset'`,
        )
        .first(),
    ).toEqual({
      action: 'auth_password_reset',
      scope: `account:${TEST_ADMIN.id}`,
      counts_json: '{}',
    });
  });

  it('account password linking requires mail confirmation, rotates to a one-time grant, then audits unlink', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    await db.prepare('DELETE FROM account WHERE "userId"=?').bind(TEST_ADMIN.id).run();
    const now = new Date().toISOString();
    const googleAccountId = 'acct_google_synthetic';
    await db
      .prepare(
        `INSERT INTO account
           (id,"accountId","providerId","userId","createdAt","updatedAt")
         VALUES (?,?,'google',?,?,?)`,
      )
      .bind(googleAccountId, TEST_ADMIN.email, TEST_ADMIN.id, now, now)
      .run();
    const sent: string[] = [];
    setSendMailForTest(async (_to, template, params) => {
      expect(template).toBe('link_confirm');
      sent.push(params.url);
    });

    const started = await post('/account/link/start', { target: 'password' }, cookie);
    expect(started.status).toBe(202);
    await expect(started.json()).resolves.toEqual({ ok: true });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const confirmationToken = tokenFromUrl(sent[0]!, 'link_token');
    const beforeConfirm = await db
      .prepare('SELECT token_hash,consumed_at FROM link_confirmation_token WHERE user_id=?')
      .bind(TEST_ADMIN.id)
      .first<{ token_hash: string; consumed_at: string | null }>();
    expect(beforeConfirm).toEqual({ token_hash: await sha256Hex(confirmationToken), consumed_at: null });

    const confirmed = await post('/account/link/confirm', { token: confirmationToken }, cookie);
    expect(confirmed.status).toBe(200);
    const confirmation = (await confirmed.json()) as { target: string; linkGrant: string };
    expect(confirmation.target).toBe('password');
    expect(confirmation.linkGrant).not.toBe(confirmationToken);
    expect((await post('/account/link/confirm', { token: confirmationToken }, cookie)).status).toBe(404);
    const afterConfirm = await db
      .prepare('SELECT token_hash,consumed_at FROM link_confirmation_token WHERE user_id=?')
      .bind(TEST_ADMIN.id)
      .first<{ token_hash: string; consumed_at: string | null }>();
    expect(afterConfirm?.token_hash).toBe(await sha256Hex(confirmation.linkGrant));
    expect(afterConfirm?.consumed_at).not.toBeNull();

    const newPassword = 'Aurora-field-copper-84';
    const linked = await post(
      '/account/link/password',
      { token: confirmation.linkGrant, newPassword },
      cookie,
    );
    expect(linked.status).toBe(200);
    await expect(linked.json()).resolves.toEqual({ status: true });
    expect(
      (
        await post('/auth/sign-in/email', {
          email: TEST_ADMIN.email,
          password: newPassword,
        })
      ).status,
    ).toBe(200);

    const unlinked = await post('/auth/unlink-account', { accountId: googleAccountId }, cookie);
    expect(unlinked.status).toBe(200);
    await expect(unlinked.json()).resolves.toEqual({ status: true });
    const accounts = await db
      .prepare('SELECT "providerId" AS provider FROM account WHERE "userId"=? ORDER BY "providerId"')
      .bind(TEST_ADMIN.id)
      .all<{ provider: string }>();
    expect(accounts.results).toEqual([{ provider: 'credential' }]);
    const audits = await db
      .prepare(
        `SELECT action,counts_json FROM auth_audit_log
           WHERE action IN ('auth_link_add','auth_link_remove') ORDER BY occurred_at,id`,
      )
      .all<{ action: string; counts_json: string }>();
    expect(audits.results).toEqual([
      { action: 'auth_link_add', counts_json: '{"provider_password":1}' },
      { action: 'auth_link_remove', counts_json: '{"provider_google":1}' },
    ]);
  });

  it('account linking rejects existing methods, bad reauthentication, invalid tokens, and weak passwords', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    expect((await post('/account/link/start', { target: 'password' }, cookie)).status).toBe(409);
    expect((await post('/account/link/start', { target: 'google' }, cookie)).status).toBe(401);
    expect(
      (
        await post(
          '/account/link/start',
          { target: 'google', currentPassword: 'incorrect-current-password' },
          cookie,
        )
      ).status,
    ).toBe(401);

    const sent: string[] = [];
    setSendMailForTest(async (_to, template, params) => {
      expect(template).toBe('link_confirm');
      sent.push(params.url);
    });
    expect(
      (await post('/account/link/start', { target: 'google', currentPassword: TEST_ADMIN.password }, cookie))
        .status,
    ).toBe(202);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(
      (await post('/account/link/confirm', { token: 'invalid-token-value-000000' }, cookie)).status,
    ).toBe(404);
    expect(
      (
        await post(
          '/account/link/password',
          { token: 'invalid-token-value-000000', newPassword: 'weak' },
          cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          '/account/link/password',
          { token: 'invalid-token-value-000000', newPassword: 'Cobalt-river-forest-71' },
          cookie,
        )
      ).status,
    ).toBe(409);
  });

  it('member MFA enrollment hashes recovery codes and audits enable, regeneration, and disable', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    const enabled = await post(
      '/auth/two-factor/enable',
      { password: TEST_ADMIN.password, method: 'totp' },
      cookie,
    );
    expect(enabled.status).toBe(200);
    const enrollment = (await enabled.json()) as {
      method: string;
      totpURI: string;
      backupCodes: string[];
    };
    expect(enrollment.method).toBe('totp');
    expect(enrollment.backupCodes).toHaveLength(10);
    const encodedSecret = new URL(enrollment.totpURI).searchParams.get('secret');
    if (!encodedSecret) throw new Error('missing_totp_secret');
    const secret = new TextDecoder().decode(base32.decode(encodedSecret));
    const factorBefore = await db
      .prepare('SELECT "backupCodes",verified FROM "twoFactor" WHERE "userId"=?')
      .bind(TEST_ADMIN.id)
      .first<{ backupCodes: string; verified: number }>();
    expect(JSON.parse(factorBefore?.backupCodes ?? '[]')).toEqual(
      expect.arrayContaining([expect.stringMatching(/^h:[0-9a-f]{64}$/)]),
    );
    expect(factorBefore?.backupCodes).not.toContain(enrollment.backupCodes[0]!);

    const verified = await post(
      '/auth/two-factor/verify-totp',
      { code: await createOTP(secret).totp() },
      cookie,
    );
    expect(verified.status, await verified.clone().text()).toBe(200);
    const verifiedCookie = verified.headers.get('set-cookie')?.split(';', 1)[0] ?? cookie;
    expect(
      await db
        .prepare('SELECT "twoFactorEnabled" AS enabled FROM "user" WHERE id=?')
        .bind(TEST_ADMIN.id)
        .first<{ enabled: number }>(),
    ).toEqual({ enabled: 1 });

    const regenerated = await post(
      '/auth/two-factor/generate-backup-codes',
      { password: TEST_ADMIN.password },
      verifiedCookie,
    );
    expect(regenerated.status).toBe(200);
    const regeneratedBody = (await regenerated.json()) as { status: boolean; backupCodes: string[] };
    expect(regeneratedBody).toMatchObject({ status: true });
    expect(regeneratedBody.backupCodes).toHaveLength(10);

    const disabled = await post(
      '/auth/two-factor/disable',
      { password: TEST_ADMIN.password },
      verifiedCookie,
    );
    expect(disabled.status).toBe(200);
    const actions = await db
      .prepare(
        `SELECT action,counts_json FROM auth_audit_log
           WHERE action IN ('auth_mfa_enable','auth_mfa_backup_codes_regenerated','auth_mfa_disable')
           ORDER BY occurred_at,id`,
      )
      .all<{ action: string; counts_json: string }>();
    expect(actions.results).toEqual([
      { action: 'auth_mfa_enable', counts_json: '{"method_totp":1}' },
      { action: 'auth_mfa_backup_codes_regenerated', counts_json: '{}' },
      { action: 'auth_mfa_disable', counts_json: '{"method_totp":1}' },
    ]);
  });

  it('password change enforces policy, changes credentials, and records the legacy audit', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    expect(
      (
        await post(
          '/auth/change-password',
          { currentPassword: TEST_ADMIN.password, newPassword: 'weak' },
          cookie,
        )
      ).status,
    ).toBe(400);
    const newPassword = 'Silver-aurora-valley-68';
    const changed = await post(
      '/auth/change-password',
      { currentPassword: TEST_ADMIN.password, newPassword, revokeOtherSessions: false },
      cookie,
    );
    expect(changed.status).toBe(200);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: TEST_ADMIN.email,
          password: TEST_ADMIN.password,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post('/auth/sign-in/email', {
          email: TEST_ADMIN.email,
          password: newPassword,
        })
      ).status,
    ).toBe(200);
    expect(
      await db.prepare("SELECT action,result FROM audit_log WHERE action='auth_password_change'").first(),
    ).toEqual({ action: 'auth_password_change', result: 'succeeded' });
  });

  it('status probe reports normal, rate-limited, and degraded states without leaking DB errors', async () => {
    const requestStatus = (ip: string, overrideDb: D1Database = db) =>
      app.request('/api/status', { headers: { 'cf-connecting-ip': ip } }, { ...env(), DB: overrideDb });
    const normal = await requestStatus('192.0.2.70');
    expect(normal.status).toBe(200);
    await expect(normal.json()).resolves.toEqual({ status: 'normal' });
    expect(normal.headers.get('cache-control')).toContain('no-store');

    let last: Response | null = null;
    for (let attempt = 0; attempt < 61; attempt += 1) {
      last = await requestStatus('192.0.2.71');
    }
    expect(last?.status).toBe(429);
    await expect(last?.json()).resolves.toMatchObject({
      error: { code: 'rate_limited', retryAfterSeconds: expect.any(Number) },
    });

    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const brokenDb = {
      prepare: () => {
        throw new Error('synthetic private database detail');
      },
    } as unknown as D1Database;
    const degraded = await requestStatus('192.0.2.72', brokenDb);
    expect(degraded.status).toBe(200);
    await expect(degraded.json()).resolves.toEqual({ status: 'degraded' });
    const logText = errorLog.mock.calls.flat().join(' ');
    expect(logText).toContain('status_probe');
    expect(logText).not.toContain('synthetic private database detail');
    errorLog.mockRestore();
  });

  it('auth audit retention removes only expired rows and honors the bounded batch limit', async () => {
    const insert = (id: string, occurredAt: string) =>
      db
        .prepare(
          `INSERT INTO auth_audit_log
             (id,user_id,actor_user_id,operation_id,action,scope,counts_json,occurred_at,result)
           VALUES (?,'default',NULL,?,'auth_password_reset_request','account','{}',?,'succeeded')`,
        )
        .bind(id, id, occurredAt)
        .run();
    await Promise.all([
      insert('audit-old-1', '2024-01-01T00:00:00.000Z'),
      insert('audit-old-2', '2024-01-02T00:00:00.000Z'),
      insert('audit-old-3', '2024-01-03T00:00:00.000Z'),
      insert('audit-fresh', '2026-08-01T00:00:00.000Z'),
    ]);

    expect(await runAuthAuditRetention(db, new Date('2026-09-22T00:00:00.000Z'), 2)).toBe(2);
    expect(
      (await db.prepare('SELECT id FROM auth_audit_log ORDER BY occurred_at,id').all<{ id: string }>())
        .results,
    ).toEqual([{ id: 'audit-old-3' }, { id: 'audit-fresh' }]);
    expect(await runAuthAuditRetention(db, new Date('2026-09-22T00:00:00.000Z'), 2)).toBe(1);
    expect(await db.prepare('SELECT id FROM auth_audit_log').all<{ id: string }>()).toMatchObject({
      results: [{ id: 'audit-fresh' }],
    });
  });

  it.each([
    ['mfa_setup_token', '2026-09-20T12:00:00.000Z'],
    ['link_confirmation_token', '2026-09-21T12:00:00.000Z'],
    ['session', '2026-09-22T12:00:00.000Z'],
    ['verification', '2026-09-23T12:00:00.000Z'],
  ] as const)(
    '%s cleanup deletes before/at expiry but preserves the next millisecond',
    async (kind, nowIso) => {
      await seedTestUser(db, { role: 'member' });
      const now = new Date(nowIso);
      const before = new Date(now.getTime() - 1).toISOString();
      const after = new Date(now.getTime() + 1).toISOString();
      const expiries = [before, nowIso, after] as const;

      if (kind === 'mfa_setup_token') {
        for (const [index, expiresAt] of expiries.entries()) {
          await db
            .prepare(
              `INSERT INTO mfa_setup_token
               (id,user_id,token_hash,remember_me,expires_at,consumed_at,created_at)
             VALUES (?,?,?,1,?,NULL,?)`,
            )
            .bind(
              `mfa-cleanup-${index}`,
              TEST_ADMIN.id,
              await sha256Hex(`mfa-cleanup-token-${index}`),
              expiresAt,
              before,
            )
            .run();
        }
      } else if (kind === 'link_confirmation_token') {
        for (const [index, expiresAt] of expiries.entries()) {
          await db
            .prepare(
              `INSERT INTO link_confirmation_token
               (id,user_id,target,token_hash,expires_at,consumed_at,created_at)
             VALUES (?,?,'password',?,?,NULL,?)`,
            )
            .bind(
              `link-cleanup-${index}`,
              TEST_ADMIN.id,
              await sha256Hex(`link-cleanup-token-${index}`),
              expiresAt,
              before,
            )
            .run();
        }
      } else if (kind === 'session') {
        for (const [index, expiresAt] of expiries.entries()) {
          await db
            .prepare(
              `INSERT INTO "session"
               (id,"expiresAt",token,"createdAt","updatedAt","userId","rememberMe")
             VALUES (?,?,?,?,?,?,1)`,
            )
            .bind(
              `session-cleanup-${index}`,
              expiresAt,
              `session-cleanup-token-${index}`,
              before,
              before,
              TEST_ADMIN.id,
            )
            .run();
        }
      } else {
        for (const [index, expiresAt] of expiries.entries()) {
          await db
            .prepare(
              `INSERT INTO verification
               (id,identifier,value,"expiresAt","createdAt","updatedAt")
             VALUES (?,?,?,?,?,?)`,
            )
            .bind(
              `verification-cleanup-${index}`,
              `verification-cleanup-identifier-${index}`,
              TEST_ADMIN.id,
              expiresAt,
              before,
              before,
            )
            .run();
        }
      }

      expect(await cleanupExpiredAuthArtifacts(db, now)).toEqual({ kind, deleted: 2 });
      const table = kind === 'session' ? '"session"' : kind;
      const expiresColumn =
        kind === 'mfa_setup_token' || kind === 'link_confirmation_token' ? 'expires_at' : '"expiresAt"';
      expect(
        await db.prepare(`SELECT ${expiresColumn} AS expiresAt FROM ${table}`).first<{ expiresAt: string }>(),
      ).toEqual({ expiresAt: after });
    },
  );
});
