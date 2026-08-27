import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from './index.js';
import {
  PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS,
  SCHEDULED_MAINTENANCE_MAX_D1_QUERIES,
  cleanupStalePasswordLoginRateLimits,
} from './login-rate-limit.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;

async function applyMigrations(database: D1Database): Promise<void> {
  for (const filename of readdirSync(migrationsDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
}

const login = (
  password: string,
  ip: string,
  extraEnv: Record<string, string> = {},
  database: D1Database = d1,
) =>
  app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ password }),
    },
    { ...auth, ...extraEnv, DB: database },
  );

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'login-rate-limit-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
}, 30_000);

beforeEach(async () => {
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results) await d1.prepare(`DELETE FROM "${name}"`).run();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('password login D1 rate limit', () => {
  it('同一scopeの5回目の失敗を429にしRetry-Afterを返す', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++)
      statuses.push((await login('wrong-password', '203.0.113.10')).status);

    expect(statuses).toEqual([401, 401, 401, 401, 429]);
    const locked = await login(auth.AUTH_PASSWORD, '203.0.113.10');
    expect(locked.status).toBe(429);
    expect(locked.headers.get('Retry-After')).toBe(String(PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.lockSeconds));
    expect(await locked.json()).toEqual({
      error: {
        code: 'login_rate_limited',
        message: 'ログイン試行回数が上限に達しました。時間をおいて再試行してください',
      },
      retryAfterSeconds: PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.lockSeconds,
    });
  });

  it('別scopeは独立し、成功時にそのscopeの失敗履歴だけをclearする', async () => {
    for (let attempt = 0; attempt < 4; attempt++)
      expect((await login('wrong-password', '203.0.113.20')).status).toBe(401);

    expect((await login(auth.AUTH_PASSWORD, '203.0.113.21')).status).toBe(200);
    expect((await login(auth.AUTH_PASSWORD, '203.0.113.20')).status).toBe(200);
    expect((await login('wrong-password', '203.0.113.20')).status).toBe(401);
  });

  it('windowとlockの期限後は同じscopeで再試行できる', async () => {
    for (let attempt = 0; attempt < 5; attempt++) await login('wrong-password', '203.0.113.30');
    await d1
      .prepare('UPDATE password_login_rate_limits SET window_started_at=0,locked_until=0,updated_at=0')
      .run();

    expect((await login('wrong-password', '203.0.113.30')).status).toBe(401);
  });

  it('並行失敗もatomicに上限へ収束し、raw IP/passwordをDBとログへ露出しない', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const ip = '203.0.113.40';
    const password = 'synthetic-never-store-password';

    const responses = await Promise.all(Array.from({ length: 5 }, () => login(password, ip)));
    expect(responses.map((response) => response.status).sort()).toEqual([401, 401, 401, 401, 429]);
    const rows = await d1
      .prepare('SELECT scope_hash AS scopeHash,failure_count AS failureCount FROM password_login_rate_limits')
      .all<{ scopeHash: string; failureCount: number }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]).toMatchObject({
      scopeHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      failureCount: 5,
    });
    expect(JSON.stringify(rows.results)).not.toContain(ip);
    expect(JSON.stringify(rows.results)).not.toContain(password);
    expect(error.mock.calls.flat().join(' ')).not.toContain(ip);
    expect(error.mock.calls.flat().join(' ')).not.toContain(password);
    expect(info.mock.calls.flat().join(' ')).not.toContain(ip);
    expect(info.mock.calls.flat().join(' ')).not.toContain(password);
  });

  it('Cloudflare Access modeはpassword throttleへ触れず既存契約を維持する', async () => {
    const response = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
        body: JSON.stringify({ password: 'wrong-password' }),
      },
      { ACCESS_AUD: 'synthetic-aud', ACCESS_TEAM_DOMAIN: 'access.example.invalid' },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'access_mode', message: 'Cloudflare Access認証を使用しています' },
    });
  });

  it('stale cleanupは100件を1 queryにboundedし、scheduled総D1 worst-caseを44で固定する', async () => {
    expect(PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.cleanupBatchSize).toBe(100);
    expect(PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.scheduledMaxD1Queries).toBe(1);
    expect(SCHEDULED_MAINTENANCE_MAX_D1_QUERIES).toBe(44);
    expect(SCHEDULED_MAINTENANCE_MAX_D1_QUERIES).toBeLessThan(50);
    const now = Date.now();
    const stale = now - (PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.staleAfterSeconds + 1) * 1_000;
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<101)
         INSERT INTO password_login_rate_limits
          (scope_hash,window_started_at,failure_count,locked_until,updated_at)
         SELECT printf('%064x',n),?,1,NULL,? FROM seq`,
      )
      .bind(stale, stale)
      .run();
    await d1
      .prepare(
        `INSERT INTO password_login_rate_limits
          (scope_hash,window_started_at,failure_count,locked_until,updated_at)
         VALUES (printf('%064x',999),?,1,NULL,?)`,
      )
      .bind(now, now)
      .run();

    let prepared = 0;
    const countedDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare')
          return (query: string) => {
            prepared++;
            return database.prepare(query);
          };
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;
    expect(await cleanupStalePasswordLoginRateLimits({ DB: countedDb }, now)).toBe(100);
    expect(prepared).toBe(1);
    expect(
      (await d1.prepare('SELECT COUNT(*) AS count FROM password_login_rate_limits').first())?.count,
    ).toBe(2);
    expect(await cleanupStalePasswordLoginRateLimits({ DB: d1 }, now)).toBe(1);
    expect(
      (await d1.prepare('SELECT COUNT(*) AS count FROM password_login_rate_limits').first())?.count,
    ).toBe(1);
  });

  it('password loginは成功・失敗とも1 request最大2 D1 queryに収める', async () => {
    expect(PASSWORD_LOGIN_RATE_LIMIT_DEFAULTS.routeMaxD1Queries).toBe(2);
    let prepared = 0;
    const countedDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare')
          return (query: string) => {
            prepared++;
            return database.prepare(query);
          };
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;

    expect((await login('wrong-password', '203.0.113.60', {}, countedDb)).status).toBe(401);
    expect(prepared).toBe(2);
    prepared = 0;
    expect((await login(auth.AUTH_PASSWORD, '203.0.113.60', {}, countedDb)).status).toBe(200);
    expect(prepared).toBe(2);
  });
});
