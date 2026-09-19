/**
 * 名義の表示名 API (GET / PUT /api/settings/owner-labels) の結合テスト (SYS-HOUSEHOLD-P04)。
 *
 * 契約の正本は `specs/spec-household-cashflow-screen.md` §6.3・§11。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前は owner_labels 表 (0043) も経路も無く、GET も PUT も 404 になる。
 *
 * 実データを使わず、専用のインメモリ D1 だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TENANT_ID } from '../src/auth.js';
import { loginForTest } from '../src/auth.test-support.js';
import { acquireImportWriter, releaseImportWriter } from '../src/import-lifecycle.js';
import { app } from '../src/index.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const DEFAULTS = { business: '本人', spouse: 'パートナー', family: '子ども', unset: 'その他' };

const request = (init: RequestInit = {}, withCookie = true) =>
  app.request(
    '/api/settings/owner-labels',
    { ...init, headers: { ...(withCookie ? { cookie } : {}), ...(init.headers ?? {}) } },
    { ...auth, DB: database },
  );

const put = (body: unknown, withCookie = true) =>
  request(
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    withCookie,
  );

// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
const json = async (res: Response): Promise<any> => res.json();

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'owner-labels',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database });
}, 30_000);

beforeEach(async () => {
  await database.prepare('DELETE FROM owner_labels').run();
});

afterAll(async () => {
  await miniflare?.dispose();
});

describe('認証', () => {
  it('未ログインは GET も PUT も 401', async () => {
    expect((await request({}, false)).status).toBe(401);
    expect((await put({ labels: DEFAULTS }, false)).status).toBe(401);
  });
});

describe('GET /api/settings/owner-labels', () => {
  it('保存が無ければ既定の 4 名義を返す', async () => {
    const res = await request();
    expect(res.status).toBe(200);
    expect((await json(res)).labels).toEqual(DEFAULTS);
  });

  it('別の利用者の保存は混ざらない', async () => {
    await database
      .prepare(
        "INSERT INTO owner_labels (user_id,owner,label,updated_at) VALUES ('other-user','business','他人','2026-01-01T00:00:00.000Z')",
      )
      .run();
    expect((await json(await request())).labels).toEqual(DEFAULTS);
  });
});

describe('PUT /api/settings/owner-labels', () => {
  it('4 名義を保存し、GET と応答が同じ値を返す (前後の空白は落とす)', async () => {
    const res = await put({ labels: { business: ' わたし ', spouse: '夫', family: '娘', unset: '未分類' } });
    expect(res.status).toBe(200);
    const saved = { business: 'わたし', spouse: '夫', family: '娘', unset: '未分類' };
    expect((await json(res)).labels).toEqual(saved);
    expect((await json(await request())).labels).toEqual(saved);
    const rows = await database
      .prepare('SELECT count(*) AS n FROM owner_labels WHERE user_id=?')
      .bind(TENANT_ID)
      .first<{ n: number }>();
    expect(rows?.n).toBe(4);
  });

  it('名義の欠落・未知のキーは部分更新せず 400 invalid_owner_labels', async () => {
    for (const labels of [
      { business: 'a', spouse: 'b', family: 'c' },
      { ...DEFAULTS, extra: 'x' },
    ]) {
      const res = await put({ labels });
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe('invalid_owner_labels');
    }
    expect((await json(await request())).labels).toEqual(DEFAULTS);
  });

  it('21 文字・制御文字・空・重複は fields 付きの 400 で、保存しない', async () => {
    const cases = [
      [{ ...DEFAULTS, business: 'あ'.repeat(21) }, { business: 'too_long' }],
      [{ ...DEFAULTS, spouse: '夫\n' }, { spouse: 'control_char' }],
      [{ ...DEFAULTS, family: '   ' }, { family: 'required' }],
      [{ ...DEFAULTS, unset: '本人' }, { unset: 'duplicate' }],
    ] as const;
    for (const [labels, fields] of cases) {
      const res = await put({ labels });
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe('invalid_owner_labels');
      expect(body.error.fields).toMatchObject(fields);
    }
    expect((await json(await request())).labels).toEqual(DEFAULTS);
  });

  it('20 文字ちょうどは保存できる', async () => {
    const res = await put({ labels: { ...DEFAULTS, business: 'あ'.repeat(20) } });
    expect(res.status).toBe(200);
  });

  it('取込みや他の更新が進行中なら 409 canonical_write_busy で保存しない (変更系フェンス)', async () => {
    const token = 'test-import-run';
    expect(await acquireImportWriter(database, TENANT_ID, token)).toBe(true);
    try {
      const res = await put({ labels: { ...DEFAULTS, business: 'わたし' } });
      expect(res.status).toBe(409);
      expect((await json(res)).error.code).toBe('canonical_write_busy');
    } finally {
      await releaseImportWriter(database, TENANT_ID, token);
    }
    expect((await json(await request())).labels).toEqual(DEFAULTS);
  });
});
