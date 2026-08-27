import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiAgentRoute } from './routes/ai.js';
import { EXPECTED_D1_MIGRATION, SCHEMA_UNAVAILABLE_ERROR, createSchemaGuard } from './schema-guard.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const instances: Miniflare[] = [];

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function databaseWithHead(head?: string): Promise<D1Database> {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: `schema-guard-${instances.length}`,
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  instances.push(miniflare);
  const database = (await miniflare.getD1Database('DB')) as D1Database;
  await database
    .prepare(
      `CREATE TABLE d1_migrations (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT UNIQUE,
         applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
       )`,
    )
    .run();
  if (head) await database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(head).run();
  return database;
}

function guardedApp(database: D1Database, now = () => Date.now()) {
  const app = new Hono<{ Bindings: { DB: D1Database } }>();
  let businessCalls = 0;
  app.use('/business', createSchemaGuard({ now, ttlMs: 30_000 }));
  app.get('/business', (c) => {
    businessCalls += 1;
    return c.json({ ok: true });
  });
  return {
    request: () => app.request('/business', undefined, { DB: database }),
    businessCalls: () => businessCalls,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(instances.splice(0).map((instance) => instance.dispose()));
});

describe('runtime schema guard', () => {
  it('期待headをmigrationディレクトリの最大ファイルと一致させる', () => {
    const latest = readdirSync(migrationsDir)
      .filter((filename) => filename.endsWith('.sql'))
      .sort()
      .at(-1);
    expect(EXPECTED_D1_MIGRATION).toBe(latest);
    expect(readFileSync(resolve(migrationsDir, EXPECTED_D1_MIGRATION), 'utf8')).not.toHaveLength(0);
  });

  it('期待head以上なら業務処理へ進め、TTL内はD1を再検査しない', async () => {
    // 期待headより必ず新しい番号にする(migration追加で追い越されないよう十分大きく取る)。
    const database = await databaseWithHead('0999_future.sql');
    let now = 1_000;
    let inspectionCount = 0;
    const countingDatabase = new Proxy(database, {
      get(target, property) {
        if (property === 'prepare')
          return (sql: string) => {
            if (sql.includes('d1_migrations')) inspectionCount += 1;
            return target.prepare(sql);
          };
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const target = guardedApp(countingDatabase, () => now);

    expect((await target.request()).status).toBe(200);
    now += 29_999;
    expect((await target.request()).status).toBe(200);
    expect(target.businessCalls()).toBe(2);
    expect(inspectionCount).toBe(1);
  });

  it('適用headが期待より古い場合は内部情報を出さず503で停止する', async () => {
    const target = guardedApp(await databaseWithHead('0014_password_login_rate_limits.sql'));

    const response = await target.request();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ error: SCHEMA_UNAVAILABLE_ERROR });
    expect(target.businessCalls()).toBe(0);
    expect(body).not.toMatch(/d1_migrations|001[0-9]|stack/i);
  });

  it('検査不能でもfail-closed 503にして業務処理へ進まない', async () => {
    const database = await databaseWithHead(EXPECTED_D1_MIGRATION);
    await database.prepare('DROP TABLE d1_migrations').run();
    const target = guardedApp(database);

    const response = await target.request();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: SCHEMA_UNAVAILABLE_ERROR });
    expect(target.businessCalls()).toBe(0);
  });

  it('token経路はBearer taskを認証した後、payload取得前にschema 503で停止する', async () => {
    const database = await databaseWithHead('0014_password_login_rate_limits.sql');
    await database
      .prepare(
        `CREATE TABLE ai_tasks (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL,
           period_kind TEXT NOT NULL,
           period_key TEXT NOT NULL,
           period_from TEXT NOT NULL,
           period_to TEXT NOT NULL,
           report_type TEXT NOT NULL,
           supplement TEXT,
           parent_report_id TEXT,
           token_hash TEXT NOT NULL UNIQUE,
           expires_at TEXT NOT NULL,
           used_at TEXT,
           report_id TEXT,
           created_at TEXT NOT NULL
         )`,
      )
      .run();
    const token = 'kjo_synthetic-schema-test';
    await database
      .prepare(
        `INSERT INTO ai_tasks
         (id,user_id,period_kind,period_key,period_from,period_to,report_type,token_hash,expires_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        'task-schema-test',
        'synthetic-user',
        'range',
        '',
        '2026-01',
        '2026-01',
        'monthly',
        await sha256Hex(token),
        '2099-01-01T00:00:00.000Z',
        '2026-08-27T00:00:00.000Z',
      )
      .run();
    const app = new Hono();
    app.route('/api', aiAgentRoute);

    const response = await app.request(
      '/api/ai/tasks/task-schema-test/data',
      { headers: { Authorization: `Bearer ${token}` } },
      { DB: database },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: SCHEMA_UNAVAILABLE_ERROR });
  });
});
