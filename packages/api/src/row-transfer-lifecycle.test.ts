/**
 * 明細1件ずつの振替の API/D1 ライフサイクル回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空明細だけで検証する。
 *
 * 見張っているのは「取込値を壊さずに有効値だけを差し替えられているか」。
 * 口座は DR-13 の stable key の材料そのものなので、mf_transactions.institution を
 * 書き換えると再取込のたびに手当てが別の明細へ付け替わる。振替は tx_edits 側だけで持ち、
 * 取込値は取込値のまま残す ── その境目がずれていないことをここで固定する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let cookie: string;

interface Row {
  id: string;
  institution: string | null;
  csvInstitution: string | null;
  instSrc: string;
  owner: string | null;
  ownerSrc: string;
  edited: boolean;
}

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

async function jsonRequest(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...auth, DB: d1 },
  );
}

/** 架空の引き落とし1件。取込値の口座は「架空銀行」 */
async function seedTx(): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO mf_transactions
         (user_id, tx_id, month, date, description, amount, category_major, category_mid, institution, identity_stable, is_target, is_transfer)
       VALUES ('default', 'T1', '2026-07', '2026-07-01', '架空スーパー', -10000, '食費', '食料品', '架空銀行', 1, 1, 0)`,
    )
    .run();
}

const listRow = async (): Promise<Row> => {
  const response = await jsonRequest('/transactions?month=2026-07');
  expect(response.status).toBe(200);
  const body = (await response.json()) as { transactions: Row[]; institutions: string[] };
  const row = body.transactions.find((t) => t.id === 'T1');
  expect(row).toBeDefined();
  return row as Row;
};

const listInstitutions = async (): Promise<string[]> => {
  const body = (await (await jsonRequest('/transactions?month=2026-07')).json()) as {
    institutions: string[];
  };
  return body.institutions;
};

/** 取込値の口座。振替しても動いてはいけない */
const storedInstitution = async (): Promise<string | null> =>
  (
    await d1
      .prepare("SELECT institution FROM mf_transactions WHERE user_id = 'default' AND tx_id = 'T1'")
      .first<{ institution: string | null }>()
  )?.institution ?? null;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'row-transfer-lifecycle-test',
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
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results.filter(({ name }) => isApplicationTableForTestReset(name)))
    await d1.prepare(`DELETE FROM "${name}"`).run();
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: d1 },
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(login.status).toBe(200);
  await seedTx();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('口座の振替', () => {
  it('振替しても取込値の口座は動かず、一覧が両方を運ぶ', async () => {
    expect(await listRow()).toMatchObject({
      institution: '架空銀行',
      csvInstitution: '架空銀行',
      instSrc: '取込値',
    });

    expect((await jsonRequest('/transactions/T1/edit', 'PUT', { inst: '架空カード' })).status).toBe(200);

    expect(await listRow()).toMatchObject({
      institution: '架空カード',
      csvInstitution: '架空銀行',
      instSrc: '手動',
      edited: true,
    });
    // stable key(DR-13)の材料。ここが動くと再取込で手当てが別明細へ付け替わる
    expect(await storedInstitution()).toBe('架空銀行');
  });

  it('名義の既定は振替後の口座から引く', async () => {
    expect(
      (
        await jsonRequest('/classification', 'PUT', {
          institutionOwners: { 架空銀行: 'spouse', 架空カード: 'family' },
        })
      ).status,
    ).toBe(200);
    expect(await listRow()).toMatchObject({ owner: 'spouse', ownerSrc: '口座' });

    expect((await jsonRequest('/transactions/T1/edit', 'PUT', { inst: '架空カード' })).status).toBe(200);
    expect(await listRow()).toMatchObject({ owner: 'family', ownerSrc: '口座' });
  });

  it('null を送ると取込値の口座に戻る', async () => {
    await jsonRequest('/transactions/T1/edit', 'PUT', { inst: '架空カード' });
    expect((await jsonRequest('/transactions/T1/edit', 'PUT', { inst: null })).status).toBe(200);
    expect(await listRow()).toMatchObject({ institution: '架空銀行', instSrc: '取込値' });
  });

  it('振替先の候補は、取込に現れた口座と名義を割り当てた口座から作る', async () => {
    // 取込にしか現れない口座と、設定にしか現れない口座を1つずつ用意する
    expect(await listInstitutions()).toEqual(['架空銀行']);
    await jsonRequest('/classification', 'PUT', { institutionOwners: { 架空カード: 'family' } });
    expect(await listInstitutions()).toEqual(['架空カード', '架空銀行']);
  });
});
