import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APIError } from 'better-auth/api';
import { Hono } from 'hono';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AuthEnv,
  type AuthVariables,
  TENANT_ID,
  actorOf,
  adminGuard,
  authGuard,
  authRuntime,
} from './auth.js';
import { TEST_ADMIN, TEST_BETTER_AUTH_SECRET } from './auth.test-support.js';
import {
  AUTH_BASE_PATH,
  AUTH_COOKIE_PREFIX,
  KANJO_TWO_FACTOR_SECURITY,
  type KanjoAuth,
  compensateFailedGoogleProvisioning,
  createAuth,
  hashBackupCode,
  hashBackupCodes,
  newAuthScope,
  secureMfaVerificationBody,
} from './better-auth.js';
import { isFailedOAuthCallbackResponse, app as workerApp } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const NOW = '2026-09-22T00:00:00.000Z';
let miniflare: Miniflare | undefined;
let db: D1Database;
let files: R2Bucket;

const assetFetcher = { fetch: async () => new Response('asset') } as unknown as Fetcher;
const baseEnv = (): AuthEnv => ({
  DB: db,
  FILES: files,
  ASSETS: assetFetcher,
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  BETTER_AUTH_SECRET: TEST_BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: 'http://localhost',
});

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'auth-boundaries-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  db = (await miniflare.getD1Database('DB')) as D1Database;
  files = (await miniflare.getR2Bucket('FILES')) as unknown as R2Bucket;
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(async () => miniflare?.dispose());

async function insertUser(
  options: {
    id?: string;
    email?: string;
    role?: 'admin' | 'member';
    status?: 'active' | 'suspended';
    twoFactorEnabled?: boolean;
  } = {},
) {
  const id = options.id ?? TEST_ADMIN.id;
  const email = options.email ?? TEST_ADMIN.email;
  await db
    .prepare(
      `INSERT INTO "user"
        (id,name,email,"emailVerified",image,"createdAt","updatedAt","twoFactorEnabled",role,status,"lastLoginAt")
       VALUES (?,?,?,1,NULL,?,?,?,?,?,NULL)`,
    )
    .bind(
      id,
      email.split('@')[0],
      email,
      NOW,
      NOW,
      options.twoFactorEnabled ? 1 : 0,
      options.role ?? 'member',
      options.status ?? 'active',
    )
    .run();
  return { id, email };
}

const b64url = (value: string | ArrayBuffer): string => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

async function accessJwt(input: {
  privateKey: CryptoKey;
  kid: string;
  audience: string;
  issuer: string;
  email: string;
  expiresAt?: number;
  algorithm?: string;
}): Promise<string> {
  const header = b64url(JSON.stringify({ kid: input.kid, alg: input.algorithm ?? 'RS256' }));
  const payload = b64url(
    JSON.stringify({
      aud: input.audience,
      exp: input.expiresAt ?? Math.floor(Date.now() / 1000) + 300,
      iss: input.issuer,
      email: input.email,
    }),
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    input.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64url(signature)}`;
}

const executionContext = (waitUntil: (promise: Promise<unknown>) => void): ExecutionContext =>
  ({
    waitUntil,
    passThroughOnException: () => undefined,
    props: {},
  }) as ExecutionContext;

describe('auth middleware boundaries', () => {
  it('actorを最小公開形へ写し、adminGuardはroleだけで管理境界を固定する', async () => {
    expect(actorOf({ id: 'u1', email: 'u1@example.test', role: 'member' })).toEqual({
      id: 'u1',
      email: 'u1@example.test',
      role: 'member',
    });

    const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();
    app.get(
      '/member',
      (c, next) => {
        c.set('actor', { id: 'm1', email: 'member@example.test', role: 'member' });
        return next();
      },
      adminGuard(),
      (c) => c.json({ leaked: true }),
    );
    app.get(
      '/admin',
      (c, next) => {
        c.set('actor', { id: 'a1', email: 'admin@example.test', role: 'admin' });
        return next();
      },
      adminGuard(),
      (c) => c.json({ ok: true }),
    );

    const member = await app.request('/member', undefined, baseEnv());
    expect(member.status).toBe(403);
    await expect(member.json()).resolves.toEqual({
      error: { code: 'forbidden', message: '管理者のみが実行できます' },
    });
    expect((await app.request('/admin', undefined, baseEnv())).status).toBe(200);
  });

  it('authRuntimeは未設定を503にし、Access構成とcookie無し保護要求は不要な初期化を省く', async () => {
    const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();
    app.use('*', authRuntime());
    app.get('*', (c) => c.json({ hasAuth: Boolean(c.get('auth')) }));

    const noSecret = { ...baseEnv(), BETTER_AUTH_SECRET: undefined };
    const authEndpoint = await app.request('/api/auth/session', undefined, noSecret);
    expect(authEndpoint.status).toBe(503);
    expect((await app.request('/plain', undefined, noSecret)).status).toBe(503);

    const accessFallback = await app.request('/plain', undefined, {
      ...noSecret,
      ACCESS_AUD: 'audience',
      ACCESS_TEAM_DOMAIN: 'team.example.test',
    });
    await expect(accessFallback.json()).resolves.toEqual({ hasAuth: false });

    const cookieLess = await app.request('/plain', undefined, baseEnv());
    await expect(cookieLess.json()).resolves.toEqual({ hasAuth: false });
  });

  it('authRuntimeは認証要求ごとのscopeを作り、background失敗を機密なしでwaitUntilへ渡す', async () => {
    const pending: Promise<unknown>[] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();
    app.use('*', authRuntime());
    app.get('/api/auth/probe', (c) => {
      c.get('authScope')?.waitUntil(Promise.reject(new TypeError('do-not-log-this-token')));
      return c.json({ hasAuth: Boolean(c.get('auth')), hasScope: Boolean(c.get('authScope')) });
    });

    const response = await app.request(
      '/api/auth/probe',
      undefined,
      baseEnv(),
      executionContext((promise) => pending.push(promise)),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasAuth: true, hasScope: true });
    await Promise.all(pending);
    expect(errors).toHaveBeenCalledTimes(1);
    const logged = String(errors.mock.calls[0]?.[0]);
    expect(logged).toContain('"job":"auth_background"');
    expect(logged).toContain('"name":"TypeError"');
    expect(logged).not.toContain('do-not-log-this-token');
  });

  it('execution contextがwaitUntilを拒んでもbackground失敗を握り潰さず安全に処理する', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();
    app.use('*', authRuntime());
    app.get('/api/auth/probe', (c) => {
      c.get('authScope')?.waitUntil(Promise.reject('opaque failure'));
      return c.body(null, 204);
    });
    const response = await app.request(
      '/api/auth/probe',
      undefined,
      baseEnv(),
      executionContext(() => {
        throw new Error('execution context closed');
      }),
    );
    expect(response.status).toBe(204);
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());
    expect(String(errors.mock.calls[0]?.[0])).toContain('"name":"UnknownError"');
  });

  it('Better Auth guardはauth/cookie/session/statusを検証し、安全なsessionだけをcontextへ渡す', async () => {
    const responses = [
      { response: null },
      {
        response: {
          session: { createdAt: NOW },
          user: { id: 's1', email: 'suspended@example.test', role: 'member', status: 'suspended' },
        },
      },
      {
        response: {
          session: { createdAt: NOW },
          user: { id: 'u1', email: 'active@example.test', role: 'member', status: 'active' },
        },
        headers: new Headers({ 'set-cookie': 'kanjo.session_token=rotated; Path=/; HttpOnly' }),
      },
    ];
    const getSession = vi.fn(async () => responses.shift());
    const fakeAuth = { api: { getSession } } as unknown as KanjoAuth;
    const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();
    app.use('*', (c, next) => {
      c.set('auth', fakeAuth);
      return next();
    });
    app.get('/protected', authGuard(), (c) =>
      c.json({ userId: c.get('userId'), actor: c.get('actor'), createdAt: c.get('sessionCreatedAt') }),
    );

    expect((await app.request('/protected', undefined, baseEnv())).status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
    const cookie = { headers: { cookie: 'kanjo.session_token=synthetic.invalid' } };
    expect((await app.request('/protected', cookie, baseEnv())).status).toBe(401);
    expect((await app.request('/protected', cookie, baseEnv())).status).toBe(401);
    const active = await app.request('/protected', cookie, baseEnv());
    expect(active.status).toBe(200);
    await expect(active.json()).resolves.toEqual({
      userId: TENANT_ID,
      actor: { id: 'u1', email: 'active@example.test', role: 'member' },
      createdAt: NOW,
    });
    expect(active.headers.get('set-cookie')).toContain('kanjo.session_token=rotated');
    expect(getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      returnHeaders: true,
      query: { disableCookieCache: true },
    });
  });

  it('Access JWTは保護APIと/auth/meで署名を検証し、active利用者だけを通す', async () => {
    const teamDomain = 'access.example.test';
    const audience = 'aud-kanjo';
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('upstream unavailable', { status: 502 }))
      .mockResolvedValue(
        new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'k1' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await insertUser();
    const env = { ...baseEnv(), ACCESS_AUD: audience, ACCESS_TEAM_DOMAIN: teamDomain };
    const app = new Hono<{ Bindings: AuthEnv; Variables: AuthVariables }>();
    app.get('/protected', authGuard(), (c) => c.json({ actor: c.get('actor'), userId: c.get('userId') }));
    const makeToken = (changes: Partial<Parameters<typeof accessJwt>[0]> = {}) =>
      accessJwt({
        privateKey: keyPair.privateKey,
        kid: 'k1',
        audience,
        issuer: `https://${teamDomain}`,
        email: TEST_ADMIN.email,
        ...changes,
      });

    const upstreamFailure = await app.request(
      '/protected',
      {
        headers: { 'Cf-Access-Jwt-Assertion': await makeToken() },
      },
      env,
    );
    expect(upstreamFailure.status).toBe(401);
    const valid = await app.request(
      '/protected',
      {
        headers: { 'Cf-Access-Jwt-Assertion': await makeToken() },
      },
      env,
    );
    expect(valid.status).toBe(200);
    await expect(valid.json()).resolves.toEqual({
      actor: { id: TEST_ADMIN.id, email: TEST_ADMIN.email, role: 'member' },
      userId: TENANT_ID,
    });

    const accessMe = await workerApp.request(
      '/api/auth/me',
      { headers: { 'Cf-Access-Jwt-Assertion': await makeToken() } },
      env,
    );
    expect(accessMe.status).toBe(200);
    await expect(accessMe.json()).resolves.toMatchObject({
      authenticated: true,
      user: {
        id: TEST_ADMIN.id,
        email: TEST_ADMIN.email,
        role: 'member',
        status: 'active',
        twoFactorEnabled: false,
        providers: [],
        authAccounts: [],
      },
    });
    expect((await workerApp.request('/api/auth/me', undefined, env)).status).toBe(401);
    for (const partial of [
      { ACCESS_AUD: audience, ACCESS_TEAM_DOMAIN: '' },
      { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: teamDomain },
    ]) {
      expect(
        (
          await workerApp.request(
            '/api/auth/me',
            { headers: { 'Cf-Access-Jwt-Assertion': await makeToken() } },
            { ...baseEnv(), ...partial },
          )
        ).status,
      ).toBe(503);
    }

    expect(
      (
        await app.request(
          '/protected',
          {
            headers: {
              'Cf-Access-Jwt-Assertion': await makeToken({ audience: ['other'] as unknown as string }),
            },
          },
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request(
          '/protected',
          {
            headers: { 'Cf-Access-Jwt-Assertion': await makeToken({ expiresAt: 1 }) },
          },
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request(
          '/protected',
          {
            headers: { 'Cf-Access-Jwt-Assertion': await makeToken({ algorithm: 'HS256' }) },
          },
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request(
          '/protected',
          {
            headers: { 'Cf-Access-Jwt-Assertion': 'not-a-jwt' },
          },
          env,
        )
      ).status,
    ).toBe(401);
    await db.prepare('UPDATE "user" SET status=\'suspended\' WHERE id=?').bind(TEST_ADMIN.id).run();
    expect(
      (
        await workerApp.request(
          '/api/auth/me',
          { headers: { 'Cf-Access-Jwt-Assertion': await makeToken() } },
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request(
          '/protected',
          {
            headers: { 'Cf-Access-Jwt-Assertion': await makeToken() },
          },
          env,
        )
      ).status,
    ).toBe(401);
  });
});

describe('Better Auth configuration and hooks', () => {
  it('scope、backup code、MFA入力を安全な既定値へ正規化する', async () => {
    const waiting = vi.fn<(promise: Promise<unknown>) => void>();
    expect(newAuthScope(waiting)).toEqual({
      mfaSetup: null,
      waitUntil: waiting,
      auditLoginUserId: null,
      auditLogoutUserId: null,
      unlinkProvider: null,
      mfaEnrollmentUserId: null,
      googleProvisioningUserId: null,
      googleProvisioningEmail: null,
    });
    const hashed = await hashBackupCode(' code-with-spaces ');
    expect(hashed).toMatch(/^h:[0-9a-f]{64}$/);
    expect(await hashBackupCodes(JSON.stringify(['first-code', hashed]))).toEqual(
      JSON.stringify([await hashBackupCode('first-code'), hashed]),
    );
    await expect(hashBackupCodes('{}')).rejects.toThrow('invalid_backup_codes');
    await expect(hashBackupCodes('[1]')).rejects.toThrow('invalid_backup_codes');
    expect(
      await secureMfaVerificationBody('/two-factor/verify-totp', { code: '123456', trustDevice: true }),
    ).toEqual({ code: '123456', trustDevice: false });
    expect(await secureMfaVerificationBody('/two-factor/verify-backup-code', { code: ' backup ' })).toEqual({
      code: await hashBackupCode('backup'),
      trustDevice: false,
    });
  });

  it('認証設定は固定path/cookie/security/password policyを持ち、Google未検証profileを拒否する', async () => {
    expect(() => createAuth({ ...baseEnv(), BETTER_AUTH_SECRET: undefined }, newAuthScope())).toThrow(
      'auth_not_configured',
    );
    const auth = createAuth(
      {
        ...baseEnv(),
        GOOGLE_CLIENT_ID: 'synthetic-client-id',
        GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
      },
      newAuthScope(),
      'https://fallback.example.test/api/auth/session',
    );
    expect(auth.options.basePath).toBe(AUTH_BASE_PATH);
    expect(auth.options.advanced?.cookiePrefix).toBe(AUTH_COOKIE_PREFIX);
    expect(auth.options.advanced?.defaultCookieAttributes).toMatchObject({
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
    });
    expect(auth.options.rateLimit).toEqual({ enabled: false });
    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 200,
      revokeSessionsOnPasswordReset: true,
    });
    expect(KANJO_TWO_FACTOR_SECURITY).toEqual({
      trustDeviceMaxAge: 0,
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
    });
    const google = auth.options.socialProviders?.google;
    expect(google).toMatchObject({ disableImplicitSignUp: true, prompt: 'select_account' });
    await expect(
      google?.mapProfileToUser?.({ email: 'not-invited@example.test', email_verified: true } as never),
    ).rejects.toThrowError(APIError);
    await expect(
      google?.mapProfileToUser?.({ email: 'not-verified@example.test', email_verified: false } as never),
    ).rejects.toThrowError(APIError);

    const requestOrigin = createAuth(
      { ...baseEnv(), BETTER_AUTH_URL: undefined },
      newAuthScope(),
      'https://request-origin.example.test/api/auth/session',
    );
    expect(requestOrigin.options.baseURL).toBe('https://request-origin.example.test');
    expect(requestOrigin.options.trustedOrigins).toEqual(['https://request-origin.example.test']);
    expect(requestOrigin.options.socialProviders).toBeUndefined();
  });

  it('既存Google利用者は招待消費後もログインでき、既存パスワード利用者もGoogle連携へ進める', async () => {
    const auth = createAuth(
      {
        ...baseEnv(),
        GOOGLE_CLIENT_ID: 'synthetic-client-id',
        GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
      },
      newAuthScope(),
    );
    const mapProfile = auth.options.socialProviders?.google?.mapProfileToUser;
    const googleUser = await insertUser({
      id: 'returning-google',
      email: 'returning@example.test',
      role: 'admin',
    });
    await db
      .prepare(
        `INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt")
       VALUES ('returning-account','google-subject','google',?,?,?)`,
      )
      .bind(googleUser.id, NOW, NOW)
      .run();
    const passwordUser = await insertUser({
      id: 'linking-password',
      email: 'linking@example.test',
      role: 'member',
    });
    for (const user of [googleUser, passwordUser]) {
      const before = await db.prepare('SELECT role,status FROM "user" WHERE id=?').bind(user.id).first();
      await expect(mapProfile?.({ email: user.email, email_verified: true } as never)).resolves.toEqual(
        before,
      );
      expect(await db.prepare('SELECT role,status FROM "user" WHERE id=?').bind(user.id).first()).toEqual(
        before,
      );
      await expect(mapProfile?.({ email: user.email, email_verified: false } as never)).rejects.toThrowError(
        APIError,
      );
    }
    const suspended = await insertUser({
      id: 'suspended-google',
      email: 'suspended@example.test',
      status: 'suspended',
    });
    await expect(
      mapProfile?.({ email: suspended.email, email_verified: true } as never),
    ).rejects.toThrowError(APIError);
    await expect(
      mapProfile?.({ email: 'uninvited@example.test', email_verified: true } as never),
    ).rejects.toThrowError(APIError);
  });

  it('password hooksは弱いreset/changeだけを拒否し、reset成功を監査する', async () => {
    await insertUser();
    const auth = createAuth(baseEnv(), newAuthScope());
    const requestHook = auth.options.hooks?.before;
    expect(requestHook).toBeTypeOf('function');
    await expect(
      requestHook?.({ path: '/reset-password', body: { token: 'body-token' } } as never),
    ).resolves.toBeUndefined();
    await expect(
      requestHook?.({
        path: '/reset-password',
        request: new Request('http://localhost/api/auth/reset-password?token=query-token'),
        body: { token: 'body-token' },
      } as never),
    ).rejects.toMatchObject({ body: { code: 'invalid_reset_token_transport' } });
    await expect(
      requestHook?.({ path: '/change-password', body: { newPassword: 'password123456' } } as never),
    ).rejects.toMatchObject({ body: { code: 'weak_password' } });
    await expect(
      requestHook?.({ path: '/change-password', body: { newPassword: 'Nebula-river-copper-41' } } as never),
    ).resolves.toBeUndefined();

    await auth.options.emailAndPassword?.onPasswordReset?.({ user: { id: TEST_ADMIN.id } } as never);
    expect(
      await db
        .prepare(`SELECT action,result FROM auth_audit_log WHERE action='auth_password_reset'`)
        .first<{ action: string; result: string }>(),
    ).toEqual({
      action: 'auth_password_reset',
      result: 'succeeded',
    });
  });

  it('request hooksはremember cookie、MFA enrollment、unlink/logoutの要求文脈を閉じ込める', async () => {
    await insertUser({ twoFactorEnabled: true });
    await db
      .prepare(
        `INSERT INTO "twoFactor" (id,secret,"backupCodes","userId",verified,"failedVerificationCount","lockedUntil")
       VALUES ('tf1','secret','[]',?,0,0,NULL)`,
      )
      .bind(TEST_ADMIN.id)
      .run();
    await db
      .prepare(
        `INSERT INTO account (id,"accountId","providerId","userId","createdAt","updatedAt")
       VALUES ('google-account','google-subject','google',?,?,?)`,
      )
      .bind(TEST_ADMIN.id, NOW, NOW)
      .run();
    const scope = newAuthScope();
    const auth = createAuth(baseEnv(), scope);
    const requestHook = auth.options.hooks?.before;
    const context = {
      authCookies: { dontRememberToken: { name: 'kanjo.dont_remember', attributes: { httpOnly: true } } },
      secret: TEST_BETTER_AUTH_SECRET,
      session: {
        user: { id: TEST_ADMIN.id, role: 'member' },
        session: { id: 'session-1' },
      },
    };
    const rememberOff = (await requestHook?.({
      path: '/sign-in/social',
      request: new Request('http://localhost/api/auth/sign-in/social?remember=0'),
      context,
      returnHeaders: true,
    } as never)) as { headers?: Headers } | undefined;
    expect(rememberOff?.headers?.get('set-cookie')).toContain('kanjo.dont_remember=');
    const rememberOn = (await requestHook?.({
      path: '/sign-in/social',
      request: new Request('http://localhost/api/auth/sign-in/social?remember=1'),
      context,
      returnHeaders: true,
    } as never)) as { headers?: Headers } | undefined;
    expect(rememberOn?.headers?.get('set-cookie')).toContain('kanjo.dont_remember=;');
    expect(rememberOn?.headers?.get('set-cookie')).toContain('Max-Age=0');

    const totp = (await requestHook?.({
      path: '/two-factor/verify-totp',
      body: { code: '123456', trustDevice: true },
      context,
    } as never)) as { context?: { body?: Record<string, unknown> } } | undefined;
    expect(totp?.context?.body).toEqual({ code: '123456', trustDevice: false });
    expect(scope.mfaEnrollmentUserId).toBe(TEST_ADMIN.id);
    const backup = (await requestHook?.({
      path: '/two-factor/verify-backup-code',
      body: { code: 'backup-code', trustDevice: true },
      context,
    } as never)) as { context?: { body?: Record<string, unknown> } } | undefined;
    expect(backup?.context?.body?.code).toBe(await hashBackupCode('backup-code'));

    await requestHook?.({
      path: '/unlink-account',
      body: { accountId: 'google-account' },
      context,
    } as never);
    expect(scope.unlinkProvider).toBe('google');
    await requestHook?.({ path: '/sign-out', context } as never);
    expect(scope.auditLogoutUserId).toBe(TEST_ADMIN.id);
    await expect(
      requestHook?.({
        path: '/two-factor/disable',
        context: {
          ...context,
          session: { ...context.session, user: { id: TEST_ADMIN.id, role: 'admin' } },
        },
      } as never),
    ).rejects.toMatchObject({ body: { code: 'admin_mfa_required' } });
    await expect(requestHook?.({ path: '/unknown', context } as never)).resolves.toBeUndefined();
  });

  it('after hooksは成功したMFA・unlink・password changeだけを秘匿監査へ残す', async () => {
    await insertUser();
    const scope = newAuthScope();
    scope.mfaEnrollmentUserId = TEST_ADMIN.id;
    scope.unlinkProvider = 'google';
    const auth = createAuth(baseEnv(), scope);
    const responseHook = auth.options.hooks?.after;
    const context = { session: { user: { id: TEST_ADMIN.id } }, returned: null };
    for (const path of [
      '/two-factor/disable',
      '/two-factor/verify-totp',
      '/two-factor/verify-backup-code',
      '/two-factor/generate-backup-codes',
      '/unlink-account',
      '/change-password',
      '/unrelated',
    ]) {
      await responseHook?.({ path, context } as never);
    }
    await responseHook?.({
      path: '/two-factor/disable',
      context: {
        ...context,
        returned: APIError.from('BAD_REQUEST', { code: 'already_failed', message: 'already failed' }),
      },
    } as never);

    const v2 = await db
      .prepare('SELECT action,counts_json FROM auth_audit_log ORDER BY action')
      .all<{ action: string; counts_json: string }>();
    expect(v2.results).toEqual([
      { action: 'auth_link_remove', counts_json: '{"provider_google":1}' },
      { action: 'auth_mfa_backup_code_used', counts_json: '{"method_backup_code":1}' },
      { action: 'auth_mfa_backup_codes_regenerated', counts_json: '{}' },
      { action: 'auth_mfa_disable', counts_json: '{"method_totp":1}' },
      { action: 'auth_mfa_enable', counts_json: '{"method_totp":1}' },
    ]);
    expect(
      await db
        .prepare(`SELECT action,result FROM audit_log WHERE action='auth_password_change'`)
        .first<{ action: string; result: string }>(),
    ).toEqual({
      action: 'auth_password_change',
      result: 'succeeded',
    });
  });

  it('Google新規userはaccount確定後に招待を消費し、account失敗時は補償で戻す', async () => {
    const scope = newAuthScope();
    const auth = createAuth(baseEnv(), scope);
    const hooks = auth.options.databaseHooks?.user?.create;
    const user = {
      id: 'google-user',
      name: 'google',
      email: 'google@example.test',
      emailVerified: true,
      image: null,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
      role: 'member',
      status: 'active',
    };
    expect(await hooks?.before?.(user as never, { path: '/invite/accept' } as never)).toEqual({ data: user });
    expect(await hooks?.before?.(user as never, { path: '/sign-up/email' } as never)).toBe(false);
    expect(
      await hooks?.before?.(
        { ...user, emailVerified: false } as never,
        { path: '/callback/google' } as never,
      ),
    ).toBe(false);
    expect(await hooks?.before?.(user as never, { path: '/callback/google' } as never)).toBe(false);

    const now = new Date();
    await db
      .prepare(
        `INSERT INTO invitations
        (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
       VALUES ('invite-google',?,'member',?, ?,NULL,NULL,NULL,?,?)`,
      )
      .bind(
        user.email,
        'a'.repeat(64),
        new Date(now.getTime() + 60_000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      )
      .run();
    expect(await hooks?.before?.(user as never, { path: '/callback/google' } as never)).toMatchObject({
      data: { role: 'member', status: 'active', emailVerified: true },
    });
    await db
      .prepare(
        `INSERT INTO "user"
        (id,name,email,"emailVerified",image,"createdAt","updatedAt","twoFactorEnabled",role,status,"lastLoginAt")
       VALUES (?,?,?,1,NULL,?,?,0,'member','active',NULL)`,
      )
      .bind(user.id, user.name, user.email, NOW, NOW)
      .run();
    await hooks?.after?.(user as never, { path: '/callback/google' } as never);
    expect(scope.googleProvisioningUserId).toBe(user.id);
    expect(
      await db
        .prepare("SELECT accepted_at FROM invitations WHERE id='invite-google'")
        .first<{ accepted_at: string | null }>(),
    ).toEqual({ accepted_at: null });
    await db
      .prepare(
        `INSERT INTO "account" (id,"accountId","providerId","userId","createdAt","updatedAt")
         VALUES ('google-account','google-subject','google',?,?,?)`,
      )
      .bind(user.id, NOW, NOW)
      .run();
    await auth.options.databaseHooks?.account?.create?.after?.(
      {
        id: 'google-account',
        accountId: 'google-subject',
        providerId: 'google',
        userId: user.id,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
      } as never,
      { path: '/callback/google' } as never,
    );
    expect(scope.googleProvisioningUserId).toBeNull();
    expect(
      await db
        .prepare("SELECT accepted_at FROM invitations WHERE id='invite-google'")
        .first<{ accepted_at: string | null }>(),
    ).toMatchObject({ accepted_at: expect.any(String) });
    expect(
      await db
        .prepare(`SELECT action,counts_json FROM auth_audit_log WHERE action='auth_invite_accept'`)
        .first(),
    ).toEqual({ action: 'auth_invite_accept', counts_json: '{"provider_google":1}' });

    await hooks?.after?.({ ...user, id: 'ignored' } as never, { path: '/invite/accept' } as never);
    await insertUser({ id: 'loser', email: 'loser@example.test' });
    scope.googleProvisioningUserId = 'loser';
    expect(await compensateFailedGoogleProvisioning(db, scope)).toBe(true);
    expect(await db.prepare('SELECT id FROM "user" WHERE id=\'loser\'').first()).toBeNull();
    expect(await compensateFailedGoogleProvisioning(db, scope)).toBe(false);
  });

  it('OAuth callbackはBetter AuthのLocation error契約だけを失敗と分類する', () => {
    expect(
      isFailedOAuthCallbackResponse(
        new Response(null, { status: 302, headers: { Location: 'http://localhost/' } }),
        'http://localhost/api/auth/callback/google',
      ),
    ).toBe(false);
    expect(
      isFailedOAuthCallbackResponse(
        new Response(null, {
          status: 302,
          headers: { Location: '/login?error=state_mismatch&error_description=do-not-log' },
        }),
        'http://localhost/api/auth/callback/google',
      ),
    ).toBe(true);
    expect(
      isFailedOAuthCallbackResponse(
        new Response(null, { status: 401 }),
        'http://localhost/api/auth/callback/google',
      ),
    ).toBe(true);
  });

  it('session hooksは停止・MFA関門・保持なし期限・login監査主体を一貫させる', async () => {
    await insertUser({ id: 'member', email: 'member@example.test' });
    await insertUser({ id: 'admin', email: 'admin@example.test', role: 'admin' });
    await insertUser({ id: 'suspended', email: 'suspended@example.test', status: 'suspended' });
    await insertUser({ id: 'mfa-user', email: 'mfa@example.test', twoFactorEnabled: true });
    const scope = newAuthScope();
    const auth = createAuth(baseEnv(), scope);
    const createHooks = auth.options.databaseHooks?.session?.create;
    const updateHook = auth.options.databaseHooks?.session?.update?.before;
    const future = new Date(Date.now() + 86_400_000);
    const session = (userId: string) => ({
      id: `session-${userId}`,
      token: `token-${userId}`,
      userId,
      expiresAt: future,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
      ipAddress: null,
      userAgent: null,
    });
    expect(await createHooks?.before?.(session('missing') as never, null)).toBe(false);
    expect(await createHooks?.before?.(session('suspended') as never, null)).toBe(false);
    const transient = (await createHooks?.before?.(
      session('member') as never,
      {
        path: '/sign-in/email',
        body: { rememberMe: false },
      } as never,
    )) as { data?: { rememberMe?: boolean; expiresAt?: Date } } | false | undefined;
    expect(transient).toMatchObject({ data: { rememberMe: false } });
    const transientExpiry = transient === false ? undefined : transient?.data?.expiresAt?.getTime();
    expect(transientExpiry).toBeLessThan(future.getTime());
    const carried = (await createHooks?.before?.(
      { ...session('member'), rememberMe: true } as never,
      null,
    )) as
      | {
          data?: { rememberMe?: boolean; expiresAt?: Date };
        }
      | undefined;
    expect(carried?.data).toMatchObject({ rememberMe: true, expiresAt: future });

    expect(
      await createHooks?.before?.(
        session('admin') as never,
        {
          path: '/sign-in/email',
          body: { rememberMe: true },
        } as never,
      ),
    ).toBe(false);
    expect(scope.mfaSetup).toMatchObject({ setupToken: expect.any(String), expiresAt: expect.any(String) });
    expect(
      await db.prepare("SELECT user_id,remember_me FROM mfa_setup_token WHERE user_id='admin'").first(),
    ).toEqual({ user_id: 'admin', remember_me: 1 });

    const originalExpiry = new Date(Date.now() + 10_000);
    expect(
      await updateHook?.(
        { updatedAt: new Date() } as never,
        {
          context: { session: { session: { rememberMe: false, expiresAt: originalExpiry } } },
        } as never,
      ),
    ).toMatchObject({ data: { expiresAt: originalExpiry } });
    expect(await updateHook?.({ updatedAt: new Date(NOW) } as never, null)).toMatchObject({
      data: { updatedAt: new Date(NOW) },
    });

    await createHooks?.after?.(session('member') as never, { path: '/sign-in/email' } as never);
    expect(scope.auditLoginUserId).toBe('member');
    scope.auditLoginUserId = null;
    await createHooks?.after?.(session('mfa-user') as never, { path: '/sign-in/email' } as never);
    expect(scope.auditLoginUserId).toBeNull();
    scope.mfaEnrollmentUserId = 'member';
    await createHooks?.after?.(session('member') as never, { path: '/two-factor/verify-totp' } as never);
    expect(scope.auditLoginUserId).toBeNull();
    expect(
      await db
        .prepare('SELECT "lastLoginAt" FROM "user" WHERE id=\'member\'')
        .first<{ lastLoginAt: string | null }>(),
    ).toMatchObject({ lastLoginAt: expect.any(String) });
  });

  it('account hookは本人のGoogle連携だけを監査する', async () => {
    await insertUser();
    const auth = createAuth(baseEnv(), newAuthScope());
    const accountHook = auth.options.databaseHooks?.account?.create?.after;
    const account = {
      id: 'account-1',
      accountId: 'google-subject',
      providerId: 'google',
      userId: TEST_ADMIN.id,
      createdAt: new Date(NOW),
      updatedAt: new Date(NOW),
    };
    await accountHook?.(account as never, { context: { session: { user: { id: TEST_ADMIN.id } } } } as never);
    await accountHook?.(
      { ...account, id: 'credential-1', providerId: 'credential' } as never,
      {
        context: { session: { user: { id: TEST_ADMIN.id } } },
      } as never,
    );
    await accountHook?.(
      { ...account, id: 'other-1', userId: 'other' } as never,
      {
        context: { session: { user: { id: TEST_ADMIN.id } } },
      } as never,
    );
    expect(
      await db.prepare(`SELECT action,counts_json FROM auth_audit_log WHERE action='auth_link_add'`).first(),
    ).toEqual({ action: 'auth_link_add', counts_json: '{"provider_google":1}' });
  });
});
