/** canonical owner domain・旧self移行・復元入口の回帰。fixtureは全て架空値。 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const migrationFiles = () =>
  readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

const statements = (filename: string): string[] =>
  readFileSync(resolve(migrationsDir, filename), 'utf8')
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map((sql) => sql.trim())
    .filter(Boolean);

async function apply(database: D1Database, filenames: string[]): Promise<void> {
  for (const filename of filenames) {
    for (const sql of statements(filename)) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

const instances: Miniflare[] = [];
async function fixture(name: string, files = migrationFiles()) {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      name,
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  instances.push(mf);
  const db = (await mf.getD1Database('DB')) as D1Database;
  const bucket = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await apply(db, files);
  return { db, bucket };
}

afterEach(async () => {
  await Promise.all(instances.splice(0).map((mf) => mf.dispose()));
});

type TableInfo = { name: string; type: string; notnull: number; dflt_value: unknown; pk: number };
type IndexList = { name: string; unique: number; origin: string; partial: number };

async function structuralContract(db: D1Database, table: string) {
  const columns = (await db.prepare(`PRAGMA table_info(${table})`).all<TableInfo>()).results.map(
    ({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk }),
  );
  const indexes = await db.prepare(`PRAGMA index_list(${table})`).all<IndexList>();
  const normalizedIndexes = [];
  for (const index of indexes.results) {
    const indexColumns = await db
      .prepare(`PRAGMA index_info(${index.name})`)
      .all<{ seqno: number; name: string }>();
    normalizedIndexes.push({
      unique: index.unique,
      origin: index.origin,
      partial: index.partial,
      columns: indexColumns.results.sort((a, b) => a.seqno - b.seqno).map((column) => column.name),
    });
  }
  const foreignKeys = await db.prepare(`PRAGMA foreign_key_list(${table})`).all();
  return { columns, indexes: normalizedIndexes, foreignKeys: foreignKeys.results };
}

describe('0009 owner domain migration', () => {
  it('3テーブルの列・PKを保ちselfをbusinessへ移し、familyだけを新規許可する', async () => {
    const all = migrationFiles();
    const { db } = await fixture(
      'owner-migration',
      all.filter((file) => file < '0009'),
    );
    const beforeContracts = Object.fromEntries(
      await Promise.all(
        ['rules', 'tx_edits', 'institution_owners'].map(async (table) => [
          table,
          await structuralContract(db, table),
        ]),
      ),
    );
    await db
      .prepare(
        "INSERT INTO rules (id,user_id,keyword,cls,category_major,category_mid,owner,sort_order,created_at) VALUES (41,'u','架空','per','食費','外食','self',7,'2026-01-01')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO tx_edits (user_id,tx_id,cls,category_major,category_mid,owner,base_major,base_mid,note,updated_at) VALUES ('u','tx','per','食費','外食','self','旧','旧内訳','監査','2026-01-01')",
      )
      .run();
    await db
      .prepare("INSERT INTO institution_owners (user_id,institution,owner) VALUES ('u','架空銀行','spouse')")
      .run();
    await db
      .prepare(
        "INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at) VALUES ('u','json:global','old',1,'2026-01-01'),('u','mf:2026-01','keep',2,'2026-01-01')",
      )
      .run();

    await apply(db, ['0009_owner_domains.sql']);

    for (const table of ['rules', 'tx_edits', 'institution_owners']) {
      expect(await structuralContract(db, table)).toEqual(beforeContracts[table]);
    }

    expect(
      await db
        .prepare(
          'SELECT id,keyword,cls,category_major,category_mid,owner,sort_order,created_at FROM rules WHERE id=41',
        )
        .first(),
    ).toMatchObject({ id: 41, keyword: '架空', cls: 'per', category_major: '食費', owner: 'business' });
    expect(await db.prepare("SELECT owner,note FROM tx_edits WHERE tx_id='tx'").first()).toMatchObject({
      owner: 'business',
      note: '監査',
    });
    expect(
      await db.prepare("SELECT owner FROM institution_owners WHERE institution='架空銀行'").first(),
    ).toMatchObject({
      owner: 'spouse',
    });
    expect(
      await db
        .prepare("SELECT target_key FROM import_active_targets WHERE user_id='u' ORDER BY target_key")
        .all(),
    ).toMatchObject({ results: [{ target_key: 'mf:2026-01' }] });

    await db
      .prepare("INSERT INTO rules (user_id,keyword,owner,sort_order) VALUES ('u','家族','family',8)")
      .run();
    await db.prepare("INSERT INTO tx_edits (user_id,tx_id,owner) VALUES ('u','family-tx','family')").run();
    await db
      .prepare("INSERT INTO institution_owners (user_id,institution,owner) VALUES ('u','家族口座','family')")
      .run();
    await expect(
      db.prepare("INSERT INTO rules (user_id,keyword,owner,sort_order) VALUES ('u','旧','self',9)").run(),
    ).rejects.toThrow();
    await expect(
      db.prepare("INSERT INTO tx_edits (user_id,tx_id,owner) VALUES ('u','legacy','self')").run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare("INSERT INTO institution_owners (user_id,institution,owner) VALUES ('u','旧口座','self')")
        .run(),
    ).rejects.toThrow();
    await db.prepare("INSERT INTO tx_edits (user_id,tx_id) VALUES ('u','empty-edit')").run();
    await expect(
      db.prepare("INSERT INTO tx_edits (user_id,tx_id,owner) VALUES ('u','unknown','other')").run(),
    ).rejects.toThrow();
    await expect(
      db
        .prepare(
          "INSERT INTO institution_owners (user_id,institution,owner) VALUES ('u','架空銀行','family')",
        )
        .run(),
    ).rejects.toThrow();

    const schemas = await db
      .prepare(
        "SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('rules','tx_edits','institution_owners') ORDER BY name",
      )
      .all<{ name: string; sql: string }>();
    expect(schemas.results).toHaveLength(3);
    for (const row of schemas.results) {
      expect(row.sql).toContain("'business','spouse','family'");
      expect(row.sql).not.toContain("'self','spouse'");
    }
    const editInfo = await db
      .prepare('PRAGMA table_info(tx_edits)')
      .all<{ name: string; pk: number; notnull: number }>();
    expect(editInfo.results.filter((column) => column.pk).map((column) => column.name)).toEqual([
      'user_id',
      'tx_id',
    ]);
    const institutionInfo = await db
      .prepare('PRAGMA table_info(institution_owners)')
      .all<{ name: string; pk: number; notnull: number }>();
    expect(institutionInfo.results.filter((column) => column.pk).map((column) => column.name)).toEqual([
      'user_id',
      'institution',
    ]);
    expect(institutionInfo.results.find((column) => column.name === 'owner')?.notnull).toBe(1);
  }, 60_000);
});

describe('owner API / restore compatibility', () => {
  const auth = {
    ACCESS_AUD: '',
    ACCESS_TEAM_DOMAIN: '',
    AUTH_PASSWORD: 'synthetic-test-password',
    SESSION_SECRET: 'synthetic-test-secret',
  };

  it('旧self復元をcanonical exportへ変換し、family全経路とunknown 400を守る', async () => {
    const { db, bucket } = await fixture('owner-api');
    const login = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
      },
      { ...auth, DB: db },
    );
    const cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    const request = (path: string, method = 'GET', body?: unknown) =>
      app.request(
        `/api${path}`,
        {
          method,
          headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        { ...auth, DB: db, FILES: bucket },
      );
    const base = {
      months: ['2026-07'],
      biz: { revenue: [0], categories: [], expense: {} },
      subs: { vendors: [], matrix: {}, other: [0] },
      personal: {},
      bizPersonal: {},
      mfTx: [],
      rules: [{ k: '架空', cls: null, owner: 'self' }],
      edits: { legacy: { owner: 'self' } },
      institutionOwners: { 架空銀行: 'self', 空欄口座: null },
      budgets: {},
      cashOverride: {},
      unrecordedExpMonths: [],
    };
    const restoreResponse = await request('/restore', 'POST', base);
    expect(restoreResponse.status, await restoreResponse.clone().text()).toBe(200);
    expect((await db.prepare('SELECT owner FROM rules').first<{ owner: string }>())?.owner).toBe('business');
    expect((await db.prepare('SELECT owner FROM tx_edits').first<{ owner: string }>())?.owner).toBe(
      'business',
    );
    expect(await db.prepare('SELECT institution,owner FROM institution_owners').all()).toMatchObject({
      results: [{ institution: '架空銀行', owner: 'business' }],
    });

    const exported = (await (await request('/export/json')).json()) as Record<string, unknown>;
    expect(exported.ownerSchemaVersion).toBe(2);
    expect(JSON.stringify(exported)).not.toContain('"self"');

    expect(
      (
        await request('/classification', 'PUT', {
          institutionOwners: { 家族口座: 'family' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await db
          .prepare("SELECT owner FROM institution_owners WHERE institution='家族口座'")
          .first<{ owner: string }>()
      )?.owner,
    ).toBe('family');

    const beforeRuns = (await db.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>())?.n;
    expect(
      (
        await request('/restore', 'POST', {
          ...base,
          institutionOwners: { 架空銀行: 'unknown' },
        })
      ).status,
    ).toBe(400);
    expect((await db.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>())?.n).toBe(
      beforeRuns,
    );
    expect(
      (await request('/classification', 'PUT', { institutionOwners: { 架空銀行: 'unknown' } })).status,
    ).toBe(400);
    expect((await request('/rules', 'POST', { keyword: '未知', owner: 'unknown' })).status).toBe(400);
    expect((await request('/transactions/missing/edit', 'PUT', { owner: 'unknown' })).status).toBe(400);
  }, 60_000);
});
