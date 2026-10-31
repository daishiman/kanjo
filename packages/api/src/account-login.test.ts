import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOTP } from '@better-auth/utils/otp';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeMfaSetupState, readLinkGrant, verifyMfaSetupCode } from './auth-endpoints.js';
import { inspectAuthRateLimit, recordAuthRateLimitFailure } from './auth-rate-limit.js';
import { newOpaqueToken, sha256Hex } from './auth-tokens.js';
import { TEST_ADMIN, TEST_BETTER_AUTH_SECRET, loginForTest, seedTestUser } from './auth.test-support.js';
import {
  KANJO_TWO_FACTOR_SECURITY,
  consumeGoogleInvitation,
  secureMfaVerificationBody,
} from './better-auth.js';
import { app } from './index.js';
import { MailSendError, createSendMail, setSendMailForTest } from './mail.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
let mf: Miniflare | undefined;
let db: D1Database;
let files: R2Bucket;
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: 'http://localhost',
};
const env = () => ({ ...auth, DB: db, FILES: files });

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'account-login-v2-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  db = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  const filenames = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'))) {
      await db.prepare(sql).run();
    }
  }
  await recordTestMigrationHead(db, filenames);
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
afterEach(() => {
  setSendMailForTest(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(async () => mf?.dispose());

const post = (path: string, body: unknown, cookie?: string) =>
  app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    },
    env(),
  );

const googleEnv = () => ({
  ...env(),
  GOOGLE_CLIENT_ID: 'google-client.test',
  GOOGLE_CLIENT_SECRET: 'google-secret.test',
});

const encodeJwtPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

async function beginGoogleSignIn() {
  const response = await app.request(
    '/api/auth/sign-in/social',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: '/',
        errorCallbackURL: '/login?error=google',
        requestSignUp: true,
      }),
    },
    googleEnv(),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { url: string };
  const state = new URL(body.url).searchParams.get('state');
  const setCookie = response.headers.get('set-cookie') ?? '';
  const cookie = setCookie
    .split(/,(?=\s*kanjo\.)/)
    .map((part) => part.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ');
  expect(state).toBeTruthy();
  expect(cookie).toContain('kanjo.state=');
  return { state: state as string, cookie };
}

function stubGoogleTokenExchange(email: string) {
  const idToken = `${encodeJwtPart({ alg: 'none' })}.${encodeJwtPart({
    sub: 'google-subject-test',
    email,
    email_verified: true,
    name: 'Google Test',
    iss: 'https://accounts.google.com',
    aud: 'google-client.test',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  })}.signature`;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({
          access_token: 'access-token-test',
          token_type: 'Bearer',
          expires_in: 300,
          id_token: idToken,
        });
      }
      throw new Error(`unexpected_external_request:${new URL(url).origin}`);
    }),
  );
}

const finishGoogleSignIn = ({ state, cookie }: { state: string; cookie: string }) =>
  app.request(
    `/api/auth/callback/google?code=code-test&state=${encodeURIComponent(state)}`,
    { headers: { cookie } },
    googleEnv(),
  );

describe('Better Auth cutover', () => {
  it('MFA初回設定はBetter Auth標準どおり前後1枠の時刻ずれを許容する', async () => {
    const secret = '12345678901234567890';
    const counter = Math.floor(Date.now() / 30_000);
    const otp = createOTP(secret);
    await expect(verifyMfaSetupCode(secret, await otp.hotp(counter - 1))).resolves.toBe(true);
    await expect(verifyMfaSetupCode(secret, await otp.hotp(counter + 1))).resolves.toBe(true);
    await expect(verifyMfaSetupCode(secret, await otp.hotp(counter + 2))).resolves.toBe(false);
  });

  it('旧login/logout/password入口を404で閉じる', async () => {
    expect((await post('/auth/login', {})).status).toBe(404);
    expect((await post('/auth/logout', {})).status).toBe(404);
    expect((await post('/auth/password', {})).status).toBe(404);
  });

  it('Accessモードはpassword sign-inを閉じ、片側だけのAccess設定をfail-closedにする', async () => {
    const request = (): RequestInit => ({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
    });
    const access = await app.request('/api/auth/sign-in/email', request(), {
      ...env(),
      ACCESS_AUD: 'synthetic-audience',
      ACCESS_TEAM_DOMAIN: 'team.example.test',
    });
    expect(access.status).toBe(400);
    await expect(access.json()).resolves.toMatchObject({ error: { code: 'access_mode' } });

    for (const partial of [
      { ACCESS_AUD: 'synthetic-audience', ACCESS_TEAM_DOMAIN: '' },
      { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: 'team.example.test' },
    ]) {
      const response = await app.request('/api/auth/sign-in/email', request(), { ...env(), ...partial });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'access_config_invalid' } });
    }
  });

  it('仕様外のBetter Auth token/account endpointをdefault-denyし値を返さない', async () => {
    const attempts = await Promise.all([
      app.request('/api/auth/get-access-token', {}, env()),
      post('/auth/refresh-token', {}),
      app.request('/api/auth/account-info', {}, env()),
      app.request('/api/auth/list-accounts', {}, env()),
    ]);
    expect(attempts.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    const bodies = await Promise.all(attempts.map((response) => response.text()));
    expect(bodies.join(' ')).not.toMatch(/access[_-]?token|refresh[_-]?token|bearer/i);
  });

  it('memberはsign-in/emailでログインしmeを読める', async () => {
    await seedTestUser(db, { role: 'member' });
    const signedIn = await post('/auth/sign-in/email', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      rememberMe: true,
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    expect(cookie).toContain('kanjo.session_token=');
    const me = await app.request('/api/auth/me', { headers: { cookie } }, env());
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      authenticated: true,
      user: { email: TEST_ADMIN.email, role: 'member', providers: ['credential'] },
    });
  });

  it('正しいpasswordでMFA初回設定へ進む応答をlogin失敗として監査しない', async () => {
    await seedTestUser(db, { role: 'admin', twoFactorEnabled: false });
    const response = await post('/auth/sign-in/email', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mfaSetupRequired: true });
    expect(
      await db
        .prepare(`SELECT count(*) AS count FROM audit_log WHERE action='auth_login_failed'`)
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });
  });

  it('不在・停止・誤passwordを同じ401へ畳み、適当Cookieを拒む', async () => {
    await seedTestUser(db, { role: 'member', status: 'suspended' });
    const responses = await Promise.all([
      post('/auth/sign-in/email', { email: 'nobody@example.test', password: 'wrong-password-000' }),
      post('/auth/sign-in/email', { email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
      post('/auth/sign-in/email', { email: TEST_ADMIN.email, password: 'wrong-password-000' }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect(new Set(await Promise.all(responses.map((response) => response.text()))).size).toBe(1);
    expect(
      (
        await app.request(
          '/api/auth/me',
          { headers: { cookie: 'kanjo.session_token=random.invalid' } },
          env(),
        )
      ).status,
    ).toBe(401);
  });

  it('secret未設定を503として明示しstatusは公開する', async () => {
    expect((await post('/auth/sign-in/email', {}, undefined)).status).not.toBe(503);
    const noSecret = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', DB: db, FILES: files };
    expect((await app.request('/api/auth/me', {}, noSecret)).status).toBe(503);
    const status = await app.request('/api/status', {}, noSecret);
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ status: 'normal' });
  });

  it('Googleのsecret未設定は明示的な503で止め、implicit signupを開始しない', async () => {
    const response = await post('/auth/sign-in/social', { provider: 'google' });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: 'google_auth_not_configured', message: 'Google認証が未設定です' },
    });
  });

  it('Google callbackのstate不正は302でもlogin失敗監査へ残す', async () => {
    const response = await app.request('/api/auth/callback/google?code=invalid-state-code', {}, googleEnv());
    expect(response.status).toBe(302);
    expect(
      new URL(response.headers.get('location') ?? '', 'http://localhost').searchParams.get('error'),
    ).toBe('state_not_found');
    expect(
      await db.prepare(`SELECT action,result FROM audit_log WHERE action='auth_login_failed'`).first(),
    ).toEqual({ action: 'auth_login_failed', result: 'failed' });
  });

  it('Google callbackは未招待とpassword-only userの暗黙linkを拒否する', async () => {
    const uninvitedEmail = 'google-uninvited@example.test';
    stubGoogleTokenExchange(uninvitedEmail);
    const uninvited = await finishGoogleSignIn(await beginGoogleSignIn());
    expect(uninvited.status).toBe(401);
    expect(await db.prepare('SELECT id FROM "user" WHERE email=?').bind(uninvitedEmail).first()).toBeNull();

    await seedTestUser(db, { role: 'member' });
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES ('invite-existing-password',?,'member',?,?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        TEST_ADMIN.email,
        'e'.repeat(64),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    stubGoogleTokenExchange(TEST_ADMIN.email);
    const unlinked = await finishGoogleSignIn(await beginGoogleSignIn());
    expect(unlinked.status).toBe(302);
    expect(
      new URL(unlinked.headers.get('location') ?? '', 'http://localhost').searchParams.has('error'),
    ).toBe(true);
    expect(
      await db
        .prepare(`SELECT "providerId" FROM "account" WHERE "userId"=? ORDER BY "providerId"`)
        .bind(TEST_ADMIN.id)
        .all(),
    ).toMatchObject({ results: [{ providerId: 'credential' }] });
    expect(
      await db.prepare(`SELECT count(*) AS count FROM audit_log WHERE action='auth_login_failed'`).first(),
    ).toEqual({ count: 2 });
  });

  it('Google account insert失敗はorphanと招待消費を補償し、同じ招待で再試行できる', async () => {
    const email = 'google-retry@example.test';
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES ('invite-google-retry',?,'member',?,?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        email,
        'f'.repeat(64),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    stubGoogleTokenExchange(email);

    const first = await beginGoogleSignIn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await db
      .prepare(
        `CREATE TRIGGER fail_google_account BEFORE INSERT ON "account"
         WHEN NEW."providerId"='google'
         BEGIN SELECT RAISE(FAIL, 'synthetic_account_failure'); END`,
      )
      .run();
    const failed = await finishGoogleSignIn(first);
    expect(failed.status).toBe(302);
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(
      /access-token-test|google-secret\.test|id_token/i,
    );
    expect(new URL(failed.headers.get('location') ?? '', 'http://localhost').searchParams.has('error')).toBe(
      true,
    );
    await db.prepare('DROP TRIGGER fail_google_account').run();
    expect(await db.prepare('SELECT id FROM "user" WHERE email=?').bind(email).first()).toBeNull();
    expect(
      await db.prepare("SELECT accepted_at FROM invitations WHERE id='invite-google-retry'").first(),
    ).toEqual({ accepted_at: null });

    const retried = await finishGoogleSignIn(await beginGoogleSignIn());
    expect(retried.status).toBe(302);
    const retriedLocation = new URL(retried.headers.get('location') ?? '', 'http://localhost');
    expect({
      pathname: retriedLocation.pathname,
      error: retriedLocation.searchParams.getAll('error'),
      description: retriedLocation.searchParams.getAll('error_description'),
    }).toEqual({ pathname: '/', error: [], description: [] });
    const created = await db
      .prepare('SELECT id FROM "user" WHERE email=?')
      .bind(email)
      .first<{ id: string }>();
    expect(created?.id).toBeTruthy();
    expect(
      await db.prepare('SELECT "providerId" FROM "account" WHERE "userId"=?').bind(created?.id).first(),
    ).toEqual({ providerId: 'google' });
    expect(
      await db
        .prepare("SELECT accepted_at FROM invitations WHERE id='invite-google-retry'")
        .first<{ accepted_at: string | null }>(),
    ).toMatchObject({ accepted_at: expect.any(String) });
    const audits = await db
      .prepare(
        `SELECT action,result FROM audit_log
         WHERE action IN ('auth_login','auth_login_failed') ORDER BY occurred_at,id`,
      )
      .all<{ action: string; result: string }>();
    expect(audits.results.map(({ action, result }) => [action, result])).toEqual([
      ['auth_login_failed', 'failed'],
      ['auth_login', 'succeeded'],
    ]);
  });

  it('Google link grantは並行要求でも1回だけ消費できる', async () => {
    await seedTestUser(db, { role: 'member' });
    const token = newOpaqueToken();
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO link_confirmation_token
        (id,user_id,target,token_hash,expires_at,consumed_at,created_at)
       VALUES (?,?, 'google', ?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        TEST_ADMIN.id,
        await sha256Hex(token),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    const request = () =>
      new Request('http://localhost/api/auth/link-social', {
        headers: { 'x-kanjo-link-grant': token },
      });
    const results = await Promise.all([
      readLinkGrant({ request: request() }, db, 'google', TEST_ADMIN.id),
      readLinkGrant({ request: request() }, db, 'google', TEST_ADMIN.id),
    ]);
    expect(results.filter(Boolean)).toEqual([{ userId: TEST_ADMIN.id }]);

    const queryToken = newOpaqueToken();
    await db
      .prepare(
        `INSERT INTO link_confirmation_token
        (id,user_id,target,token_hash,expires_at,consumed_at,created_at)
       VALUES (?,?, 'google', ?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        TEST_ADMIN.id,
        await sha256Hex(queryToken),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    await expect(
      readLinkGrant(
        {
          request: new Request(`http://localhost/api/auth/link-social?linkGrant=${queryToken}`),
        },
        db,
        'google',
        TEST_ADMIN.id,
      ),
    ).resolves.toBeNull();
  });

  it('password link grantは並行要求でも1回だけ消費できる', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    const now = new Date();
    await db.prepare(`DELETE FROM account WHERE "userId"=?`).bind(TEST_ADMIN.id).run();
    await db
      .prepare(
        `INSERT INTO account
        (id,"accountId","providerId","userId","createdAt","updatedAt")
       VALUES (?,?, 'google', ?,?,?)`,
      )
      .bind(crypto.randomUUID(), TEST_ADMIN.email, TEST_ADMIN.id, now.toISOString(), now.toISOString())
      .run();
    const token = newOpaqueToken();
    await db
      .prepare(
        `INSERT INTO link_confirmation_token
        (id,user_id,target,token_hash,expires_at,consumed_at,created_at)
       VALUES (?,?, 'password', ?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        TEST_ADMIN.id,
        await sha256Hex(token),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    const responses = await Promise.all([
      post('/account/link/password', { token, newPassword: 'Nebula-river-copper-41' }, cookie),
      post('/account/link/password', { token, newPassword: 'Atlas-forest-silver-72' }, cookie),
    ]);
    const statuses = responses.map(({ status }) => status).sort();
    expect(statuses[0]).toBe(200);
    expect([404, 409]).toContain(statuses[1]);
    const audit = await db
      .prepare(`SELECT action,counts_json FROM auth_audit_log WHERE action='auth_link_add'`)
      .first<{ action: string; counts_json: string }>();
    expect(audit).toEqual({ action: 'auth_link_add', counts_json: '{"provider_password":1}' });
  });

  it('異なるpassword grantの並行利用でもcredentialは1行だけ作る', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    await db.prepare(`DELETE FROM account WHERE "userId"=?`).bind(TEST_ADMIN.id).run();
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO account
        (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES (?,?, 'google', ?,?,?)`,
      )
      .bind(crypto.randomUUID(), TEST_ADMIN.email, TEST_ADMIN.id, now.toISOString(), now.toISOString())
      .run();
    const tokens = [newOpaqueToken(), newOpaqueToken()];
    for (const token of tokens) {
      await db
        .prepare(
          `INSERT INTO link_confirmation_token
          (id,user_id,target,token_hash,expires_at,consumed_at,created_at)
         VALUES (?,?, 'password', ?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          TEST_ADMIN.id,
          await sha256Hex(token),
          new Date(now.getTime() + 60_000).toISOString(),
          now.toISOString(),
          now.toISOString(),
        )
        .run();
    }
    const responses = await Promise.all([
      post('/account/link/password', { token: tokens[0], newPassword: 'Nebula-river-copper-41' }, cookie),
      post('/account/link/password', { token: tokens[1], newPassword: 'Atlas-forest-silver-72' }, cookie),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(
      await db
        .prepare(`SELECT count(*) AS count FROM account WHERE "userId"=? AND "providerId"='credential'`)
        .bind(TEST_ADMIN.id)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
  });

  it('MFA外側rate limitは標準MFAをIP軸、確定した初回設定主体を2軸にする', async () => {
    const first = await inspectAuthRateLimit(
      db,
      'mfa',
      new Request('http://localhost', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }),
    );
    const second = await inspectAuthRateLimit(
      db,
      'mfa',
      new Request('http://localhost', { headers: { 'CF-Connecting-IP': '192.0.2.2' } }),
    );
    expect(first.scopes.map(({ scopeKind }) => scopeKind)).toEqual(['mfa_ip']);
    expect(second.scopes.map(({ scopeKind }) => scopeKind)).toEqual(['mfa_ip']);
    expect(first.scopes[0]?.scopeHash).not.toBe(second.scopes[0]?.scopeHash);
    const setup = await inspectAuthRateLimit(
      db,
      'mfa',
      new Request('http://localhost', { headers: { 'CF-Connecting-IP': '192.0.2.3' } }),
      TEST_ADMIN.id,
    );
    expect(setup.scopes.map(({ scopeKind }) => scopeKind)).toEqual(['mfa_ip', 'mfa_account']);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordAuthRateLimitFailure(
        db,
        await inspectAuthRateLimit(
          db,
          'mfa',
          new Request('http://localhost', { headers: { 'CF-Connecting-IP': `198.51.100.${attempt + 1}` } }),
          TEST_ADMIN.id,
        ),
      );
    }
    const locked = await inspectAuthRateLimit(
      db,
      'mfa',
      new Request('http://localhost', { headers: { 'CF-Connecting-IP': '203.0.113.1' } }),
      TEST_ADMIN.id,
    );
    expect(locked.lockedUntil).not.toBeNull();
  });

  it('MFA設定完了はtoken・user・factorを原子的に更新し、並行要求の1件だけが勝つ', async () => {
    await seedTestUser(db, { role: 'admin' });
    const now = new Date();
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO mfa_setup_token
        (id,user_id,token_hash,remember_me,expires_at,consumed_at,created_at)
       VALUES (?,?,?,1,?,NULL,?)`,
      )
      .bind(
        id,
        TEST_ADMIN.id,
        await sha256Hex(newOpaqueToken()),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
      )
      .run();
    await db
      .prepare(
        `INSERT INTO "twoFactor" (id,secret,"backupCodes","userId",verified)
         VALUES ('tf-atomic','encrypted','[]',?,0)`,
      )
      .bind(TEST_ADMIN.id)
      .run();
    const input = {
      setupId: id,
      userId: TEST_ADMIN.id,
      factorId: 'tf-atomic',
      storedCodes: '["h:synthetic"]',
      nowIso: now.toISOString(),
    };
    const result = await Promise.all([completeMfaSetupState(db, input), completeMfaSetupState(db, input)]);
    expect(result.sort()).toEqual([false, true]);
    expect(
      await db
        .prepare(
          `SELECT u."twoFactorEnabled" AS enabled,t.verified,t."backupCodes" AS codes
             FROM "user" u JOIN "twoFactor" t ON t."userId"=u.id WHERE u.id=?`,
        )
        .bind(TEST_ADMIN.id)
        .first(),
    ).toEqual({ enabled: 1, verified: 1, codes: '["h:synthetic"]' });
  });

  it('MFA設定完了のfactor更新が失敗したらtoken消費とuser更新もrollbackする', async () => {
    await seedTestUser(db, { role: 'admin' });
    const now = new Date();
    await db.batch([
      db
        .prepare(
          `INSERT INTO mfa_setup_token
             (id,user_id,token_hash,remember_me,expires_at,consumed_at,created_at)
           VALUES ('setup-rollback',?,?,1,?,NULL,?)`,
        )
        .bind(
          TEST_ADMIN.id,
          await sha256Hex(newOpaqueToken()),
          new Date(now.getTime() + 60_000).toISOString(),
          now.toISOString(),
        ),
      db
        .prepare(
          `INSERT INTO "twoFactor" (id,secret,"backupCodes","userId",verified)
           VALUES ('tf-rollback','encrypted','[]',?,0)`,
        )
        .bind(TEST_ADMIN.id),
    ]);
    await db
      .prepare(
        `CREATE TRIGGER fail_mfa_factor_update BEFORE UPDATE ON "twoFactor"
         BEGIN SELECT RAISE(ABORT, 'injected_mfa_failure'); END`,
      )
      .run();
    try {
      await expect(
        completeMfaSetupState(db, {
          setupId: 'setup-rollback',
          userId: TEST_ADMIN.id,
          factorId: 'tf-rollback',
          storedCodes: '["h:new"]',
          nowIso: now.toISOString(),
        }),
      ).rejects.toThrow(/injected_mfa_failure/);
    } finally {
      await db.prepare('DROP TRIGGER fail_mfa_factor_update').run();
    }
    expect(
      await db
        .prepare(
          `SELECT m.consumed_at,u."twoFactorEnabled" AS enabled,t.verified,t."backupCodes" AS codes
             FROM mfa_setup_token m
             JOIN "user" u ON u.id=m.user_id
             JOIN "twoFactor" t ON t."userId"=u.id WHERE m.id='setup-rollback'`,
        )
        .first(),
    ).toEqual({ consumed_at: null, enabled: 0, verified: 0, codes: '[]' });
  });

  it('adminのMFA解除を403にし、trusted deviceとlockoutを仕様値に固定する', async () => {
    expect(KANJO_TWO_FACTOR_SECURITY).toEqual({
      trustDeviceMaxAge: 0,
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
    });
    expect(
      await secureMfaVerificationBody('/two-factor/verify-totp', { code: '123456', trustDevice: true }),
    ).toEqual({ code: '123456', trustDevice: false });
    const backup = await secureMfaVerificationBody('/two-factor/verify-backup-code', {
      code: 'synthetic-backup-code',
      trustDevice: true,
    });
    expect(backup.trustDevice).toBe(false);
    expect(backup.code).toMatch(/^h:[0-9a-f]{64}$/);

    const cookie = await loginForTest(app, env(), { role: 'admin', twoFactorEnabled: true });
    const response = await post('/auth/two-factor/disable', { password: TEST_ADMIN.password }, cookie);
    expect(response.status).toBe(403);
    expect(
      await db
        .prepare('SELECT "twoFactorEnabled" FROM "user" WHERE id=?')
        .bind(TEST_ADMIN.id)
        .first<{ twoFactorEnabled: number }>(),
    ).toEqual({ twoFactorEnabled: 1 });
  });

  it('Google-only利用者の古いsessionでは連携確認を開始できない', async () => {
    const cookie = await loginForTest(app, env(), { role: 'member' });
    await db.prepare('DELETE FROM account WHERE "userId"=?').bind(TEST_ADMIN.id).run();
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    await db.prepare('UPDATE session SET "createdAt"=? WHERE "userId"=?').bind(old, TEST_ADMIN.id).run();
    const response = await post('/account/link/start', { target: 'password' }, cookie);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'recent_auth_required' } });
  });

  it('認証手段追加のpassword再認証は分散IPでも本人軸を5回でlockし、他人を阻害しない', async () => {
    const firstCookie = await loginForTest(app, env(), { role: 'member' });
    const start = (cookie: string, ip: string) =>
      app.request(
        '/api/account/link/start',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie,
            'CF-Connecting-IP': ip,
          },
          body: JSON.stringify({ target: 'google', currentPassword: 'wrong-but-long-enough' }),
        },
        env(),
      );
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await start(firstCookie, `198.51.100.${attempt + 1}`)).status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 429]);

    const secondCookie = await loginForTest(app, env(), {
      id: 'usr_rate_other',
      email: 'rate-other@example.test',
      role: 'member',
    });
    expect((await start(secondCookie, '203.0.113.100')).status).toBe(401);
  });

  it('login成功・失敗とlogoutを既存audit_logへ記録する', async () => {
    await seedTestUser(db, { role: 'member' });
    expect(
      (
        await post('/auth/sign-in/email', {
          email: TEST_ADMIN.email,
          password: 'wrong-but-long-enough-value',
        })
      ).status,
    ).toBe(401);
    const signedIn = await post('/auth/sign-in/email', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    expect((await post('/auth/sign-out', {}, cookie)).status).toBe(200);
    const rows = await db
      .prepare(
        `SELECT action,result FROM audit_log
       WHERE action IN ('auth_login','auth_login_failed','auth_logout') ORDER BY occurred_at,id`,
      )
      .all<{ action: string; result: string }>();
    expect((rows.results ?? []).map(({ action, result }) => [action, result])).toEqual([
      ['auth_login_failed', 'failed'],
      ['auth_login', 'succeeded'],
      ['auth_logout', 'succeeded'],
    ]);
  });

  it('member招待を確認・承諾し、再設定依頼を存在非公開で受け付ける', async () => {
    const token = newOpaqueToken();
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES (?,?, 'member', ?,?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        'invited@example.test',
        await sha256Hex(token),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    const sent: Array<{ to: string; template: string; url: string }> = [];
    setSendMailForTest(async (to, template, params) => {
      sent.push({ to, template, url: params.url });
    });
    const inspected = await post('/auth/invite/inspect', { token });
    expect(inspected.status).toBe(200);
    expect(await inspected.json()).toMatchObject({ email: 'invited@example.test', role: 'member' });
    expect((await post('/auth/invite/inspect', { token: 'invalid-token-value-000000' })).status).toBe(404);
    const accepted = await post('/auth/invite/accept', {
      token,
      password: 'Nebula-river-copper-41',
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ next: 'login', email: 'invited@example.test' });
    const knownReset = await post('/auth/password-reset/request', { email: 'invited@example.test' });
    const unknownReset = await post('/auth/password-reset/request', { email: 'missing@example.test' });
    expect(knownReset.status).toBe(202);
    expect(unknownReset.status).toBe(202);
    expect(await knownReset.clone().json()).toEqual(await unknownReset.clone().json());
    expect(knownReset.headers.get('cache-control')).toBe('no-store');
    expect(unknownReset.headers.get('cache-control')).toBe('no-store');
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ to: 'invited@example.test', template: 'password_reset' });
    expect(sent[0]?.url).toContain('/reset-password?token=');
    const stored = await db
      .prepare(`SELECT identifier FROM verification WHERE value=(SELECT id FROM "user" WHERE email=?)`)
      .bind('invited@example.test')
      .first<{ identifier: string }>();
    expect(stored?.identifier).not.toContain('reset-password:');
  });

  it('admin招待の承諾からMFA初回設定を完了する', async () => {
    const token = newOpaqueToken();
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES (?,?, 'admin', ?,?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        'new-admin@example.test',
        await sha256Hex(token),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    const accepted = await post('/auth/invite/accept', {
      token,
      password: 'Atlas-forest-silver-72',
    });
    expect(accepted.status).toBe(200);
    const setup = (await accepted.json()) as { next: string; setupToken: string };
    expect(setup.next).toBe('mfa_setup');
    const started = await post('/auth/mfa-setup/start', { setupToken: setup.setupToken });
    expect(started.status).toBe(200);
    const enrollment = (await started.json()) as { secret: string; totpURI: string };
    expect(enrollment.totpURI).toContain('otpauth://totp/');
    const completed = await post('/auth/mfa-setup/complete', {
      setupToken: setup.setupToken,
      code: await createOTP(enrollment.secret).totp(),
    });
    expect(completed.status).toBe(200);
    const body = (await completed.json()) as { status: boolean; backupCodes: string[] };
    expect(body.status).toBe(true);
    expect(body.backupCodes).toHaveLength(10);
    expect(
      (
        await post('/auth/mfa-setup/complete', {
          setupToken: setup.setupToken,
          code: '000000',
        })
      ).status,
    ).toBe(401);
    const actions = await db
      .prepare(
        `SELECT action FROM auth_audit_log WHERE actor_user_id=(SELECT id FROM "user" WHERE email=?) ORDER BY occurred_at,id`,
      )
      .bind('new-admin@example.test')
      .all<{ action: string }>();
    expect((actions.results ?? []).map(({ action }) => action)).toEqual([
      'auth_invite_accept',
      'auth_mfa_setup_issued',
      'auth_mfa_enable',
    ]);
  });

  it('招待再送は同じ202を返し、存在時だけmailとauditを残す', async () => {
    const token = newOpaqueToken();
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES (?,?, 'member', ?,?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        'resend@example.test',
        await sha256Hex(token),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    const sent: string[] = [];
    setSendMailForTest(async (to) => {
      sent.push(to);
    });
    const known = await post('/auth/invite/resend-request', { email: 'resend@example.test' });
    const unknown = await post('/auth/invite/resend-request', { email: 'missing@example.test' });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.clone().json()).toEqual(await unknown.clone().json());
    expect(known.headers.get('cache-control')).toBe('no-store');
    expect(unknown.headers.get('cache-control')).toBe('no-store');
    await vi.waitFor(() => expect(sent).toEqual(['resend@example.test']));
    expect(
      await db
        .prepare(`SELECT count(*) AS count FROM auth_audit_log WHERE action='auth_invite_resend_request'`)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
  });

  it('管理者の招待作成・利用者更新は本体とauditを同じbatchで確定する', async () => {
    const cookie = await loginForTest(app, env(), { role: 'admin' });
    const memberCookie = await loginForTest(app, env(), {
      id: 'usr_member_target',
      email: 'target@example.test',
      role: 'member',
    });
    setSendMailForTest(async () => {
      throw new MailSendError('invite', 503);
    });
    const invite = await post(
      '/admin/invitations',
      {
        email: 'created@example.test',
        role: 'member',
      },
      cookie,
    );
    expect(invite.status).toBe(502);
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM invitations WHERE email=?')
        .bind('created@example.test')
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect(
      await db
        .prepare(`SELECT actor_user_id FROM audit_log WHERE action='admin_user_invite'`)
        .first<{ actor_user_id: string }>(),
    ).toEqual({ actor_user_id: TEST_ADMIN.id });

    const updated = await app.request(
      '/api/admin/users/usr_member_target',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ role: 'admin' }),
      },
      env(),
    );
    expect(updated.status).toBe(200);
    expect(
      await db
        .prepare(`SELECT count(*) AS count FROM audit_log WHERE action='admin_user_update'`)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect((await app.request('/api/auth/me', { headers: { cookie: memberCookie } }, env())).status).toBe(
      401,
    );
  });

  it('同じemailの並行招待を1行へupsertし、再送はterminal状態を条件付き更新する', async () => {
    const cookie = await loginForTest(app, env(), { role: 'admin', twoFactorEnabled: true });
    const sent: string[] = [];
    setSendMailForTest(async (to) => {
      sent.push(to);
    });
    const create = (role: 'admin' | 'member') =>
      post(
        '/admin/invitations',
        {
          email: 'concurrent-invite@example.test',
          role,
        },
        cookie,
      );
    const created = await Promise.all([create('member'), create('admin')]);
    expect(created.map(({ status }) => status)).toEqual([201, 201]);
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM invitations WHERE email=?')
        .bind('concurrent-invite@example.test')
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });

    const invitation = await db
      .prepare('SELECT id FROM invitations WHERE email=?')
      .bind('concurrent-invite@example.test')
      .first<{ id: string }>();
    const beforeRaceMailCount = sent.length;
    const [resent, revoked] = await Promise.all([
      post(`/admin/invitations/${invitation!.id}/resend`, {}, cookie),
      post(`/admin/invitations/${invitation!.id}/revoke`, {}, cookie),
    ]);
    expect(revoked.status).toBe(200);
    expect([200, 409]).toContain(resent.status);
    if (resent.status === 409) expect(sent).toHaveLength(beforeRaceMailCount);
    expect((await post(`/admin/invitations/${invitation!.id}/resend`, {}, cookie)).status).toBe(409);
  });

  it('招待token/role回転後は旧password tokenとGoogleの旧roleを消費しない', async () => {
    const cookie = await loginForTest(app, env(), { role: 'admin', twoFactorEnabled: true });
    const links: string[] = [];
    setSendMailForTest(async (_to, _template, params) => {
      links.push(params.url);
    });
    const create = (role: 'admin' | 'member') =>
      post(
        '/admin/invitations',
        {
          email: 'rotated-invite@example.test',
          role,
        },
        cookie,
      );
    expect((await create('member')).status).toBe(201);
    const oldToken = new URL(links.at(-1)!).searchParams.get('token')!;
    expect((await create('admin')).status).toBe(201);
    const currentToken = new URL(links.at(-1)!).searchParams.get('token')!;
    expect(currentToken).not.toBe(oldToken);
    expect(
      (
        await post('/auth/invite/accept', {
          token: oldToken,
          password: 'Nebula-river-copper-41',
        })
      ).status,
    ).toBe(404);
    expect(
      await db
        .prepare('SELECT count(*) AS count FROM "user" WHERE email=?')
        .bind('rotated-invite@example.test')
        .first<{ count: number }>(),
    ).toEqual({ count: 0 });
    expect(
      (
        await post('/auth/invite/accept', {
          token: currentToken,
          password: 'Nebula-river-copper-41',
        })
      ).status,
    ).toBe(200);
    expect(
      await db
        .prepare('SELECT role FROM "user" WHERE email=?')
        .bind('rotated-invite@example.test')
        .first<{ role: string }>(),
    ).toEqual({ role: 'admin' });

    const googleNow = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES (?,?, 'admin', ?,?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        'google-role@example.test',
        await sha256Hex(newOpaqueToken()),
        new Date(googleNow.getTime() + 60_000).toISOString(),
        googleNow.toISOString(),
        googleNow.toISOString(),
      )
      .run();
    await expect(
      consumeGoogleInvitation(db, 'google-role@example.test', 'member', googleNow.toISOString()),
    ).resolves.toBeNull();
    await expect(
      consumeGoogleInvitation(db, 'google-role@example.test', 'admin', googleNow.toISOString()),
    ).resolves.toEqual({ role: 'admin' });
  });

  it('招待createとacceptの競合でもuserとopen invitationを同時に残さない', async () => {
    const cookie = await loginForTest(app, env(), { role: 'admin', twoFactorEnabled: true });
    const links: string[] = [];
    setSendMailForTest(async (_to, _template, params) => {
      links.push(params.url);
    });
    const email = 'create-accept-race@example.test';
    expect((await post('/admin/invitations', { email, role: 'member' }, cookie)).status).toBe(201);
    const token = new URL(links.at(-1)!).searchParams.get('token')!;
    const [accepted, recreated] = await Promise.all([
      post('/auth/invite/accept', { token, password: 'Nebula-river-copper-41' }),
      post('/admin/invitations', { email, role: 'admin' }, cookie),
    ]);
    expect([
      [200, 409],
      [404, 201],
    ]).toContainEqual([accepted.status, recreated.status]);
    const userCount = await db
      .prepare('SELECT count(*) AS count FROM "user" WHERE email=?')
      .bind(email)
      .first<{ count: number }>();
    const openCount = await db
      .prepare(
        'SELECT count(*) AS count FROM invitations WHERE email=? AND accepted_at IS NULL AND revoked_at IS NULL',
      )
      .bind(email)
      .first<{ count: number }>();
    expect((userCount?.count ?? 0) + (openCount?.count ?? 0)).toBe(1);
  });

  it('reset/change passwordにも招待と同じweak password規則を適用する', async () => {
    const queryOnly = await app.request(
      `/api/auth/reset-password?token=${newOpaqueToken()}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: 'Nebula-river-copper-41' }),
      },
      env(),
    );
    expect(queryOnly.status).toBe(400);
    expect(await queryOnly.json()).toMatchObject({ code: 'invalid_reset_token_transport' });
    const reset = await post('/auth/reset-password', {
      token: newOpaqueToken(),
      newPassword: 'password123456',
    });
    expect(reset.status).toBe(400);
    expect(await reset.json()).toMatchObject({ code: 'weak_password' });
    const cookie = await loginForTest(app, env(), { role: 'member' });
    const change = await post(
      '/auth/change-password',
      {
        currentPassword: TEST_ADMIN.password,
        newPassword: 'password123456',
        revokeOtherSessions: true,
      },
      cookie,
    );
    expect(change.status).toBe(400);
    expect(await change.json()).toMatchObject({ code: 'weak_password' });
  });

  it('mailはsecretなしを明示失敗し、outboxと外部成功/失敗で宛先やtokenをログしない', async () => {
    const error = await createSendMail({})('private@example.test', 'invite', {
      url: 'https://example.test/invite?token=secret-token',
      role: 'member',
    }).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(MailSendError);
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await createSendMail({ MAIL_DEV_OUTBOX: '1' })('private@example.test', 'password_reset', {
      url: 'https://example.test/reset?token=secret-token',
    });
    expect(info.mock.calls.flat().join(' ')).not.toContain('private@example.test');
    expect(info.mock.calls.flat().join(' ')).not.toContain('secret-token');
    info.mockRestore();

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    await createSendMail({ RESEND_API_KEY: 'synthetic-key', MAIL_FROM: 'sender@example.test' })(
      'private@example.test',
      'link_confirm',
      { url: 'https://example.test/settings?token=secret-token' },
    );
    await expect(
      createSendMail({ RESEND_API_KEY: 'synthetic-key', MAIL_FROM: 'sender@example.test' })(
        'private@example.test',
        'invite',
        { url: 'https://example.test/invite?token=secret-token', role: 'admin' },
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      createSendMail({ RESEND_API_KEY: 'synthetic-key' })('private@example.test', 'invite', {
        url: 'https://example.test/invite?token=secret-token',
        role: 'admin',
      }),
    ).rejects.toMatchObject({ status: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
});
