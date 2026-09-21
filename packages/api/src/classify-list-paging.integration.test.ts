/**
 * 一覧のページ送り (GET /api/transactions) の API/D1 回帰 (spec-classify-screen AT-04・§7.7)。
 *
 * ここで押さえるのは「1 ページは 50 件で、51 件目は 2 ページ目に出る」ことだけである。
 * 画面が page=2 を送っていることを確かめても、サーバが 51 件目を返すかは分からない。
 * 境界を 51 件の fixture で跨がせて、落ちる明細が 1 件も無いことをサーバ側で固定する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

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

const env = () => ({ ...auth, DB: database });
const get = (path: string) => app.request(`/api${path}`, { headers: { cookie } }, env());

interface ListBody {
  rows: { id: string; date: string }[];
  transactions: { id: string }[];
  total: number;
  page: number;
  limit: number;
}

/** 8 月に 31 件・7 月に 20 件で合計 51 件。日付が全件違うので、並びが一意に決まる */
const AUGUST_DAYS = 31;
const JULY_DAYS = 20;
const PERIOD = 'from=2026-07&to=2026-08';

const values = (month: string, day: number, userId = 'default') => {
  const dd = String(day).padStart(2, '0');
  return `('${userId}','tx-${month}-${dd}','2026-${month}','2026-${month}-${dd}','架空店${month}${dd}',-1000,'食費','日用品',1,0,1)`;
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'classify-list-paging',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());

  const rows = [
    ...Array.from({ length: AUGUST_DAYS }, (_, i) => values('08', i + 1)),
    ...Array.from({ length: JULY_DAYS }, (_, i) => values('07', i + 1)),
    // 他の利用者の明細は件数にもページにも混ざらない
    values('07', 25, 'other-user'),
  ];
  await database
    .prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES ${rows.join(',')}`,
    )
    .run();
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

const listOf = async (query: string): Promise<ListBody> => {
  const response = await get(`/transactions?${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as ListBody;
};

describe('一覧のページ送り (AT-04)', () => {
  it('検査対象は 51 件ある', async () => {
    const first = await listOf(PERIOD);
    expect(AUGUST_DAYS + JULY_DAYS).toBe(51);
    expect(first.total).toBe(51);
  });

  it('1 ページ目は 50 件で、51 件目は 2 ページ目に出る', async () => {
    const first = await listOf(`${PERIOD}&page=1`);
    expect(first.page).toBe(1);
    expect(first.limit).toBe(50);
    expect(first.rows).toHaveLength(50);
    // 既定の並びは日付の降順。先頭は 8/31、1 ページ目の末尾は 7/2 になる
    expect(first.rows[0]?.id).toBe('tx-08-31');
    expect(first.rows[49]?.id).toBe('tx-07-02');
    expect(first.rows.map((r) => r.id)).not.toContain('tx-07-01');

    const second = await listOf(`${PERIOD}&page=2`);
    expect(second.page).toBe(2);
    expect(second.rows).toHaveLength(1);
    // 51 件目。ここが空で返ると、一番古い明細だけが永久に片付かない
    expect(second.rows[0]?.id).toBe('tx-07-01');
    expect(second.total).toBe(51);

    // 2 ページで全件がちょうど 1 回ずつ出る。重複も取りこぼしも無い
    const paged = [...first.rows, ...second.rows].map((r) => r.id);
    expect(new Set(paged).size).toBe(51);
    expect(paged.sort()).toEqual(first.transactions.map((t) => t.id).sort());
  });

  it('明細が無いページは空で返る。件数は変わらない', async () => {
    const third = await listOf(`${PERIOD}&page=3`);
    expect(third.rows).toHaveLength(0);
    expect(third.total).toBe(51);
  });

  it('表示件数は 50 で固定。ほかの値は 400', async () => {
    expect((await listOf(`${PERIOD}&limit=50`)).rows).toHaveLength(50);
    expect((await get(`/transactions?${PERIOD}&limit=100`)).status).toBe(400);
    expect((await get(`/transactions?${PERIOD}&page=0`)).status).toBe(400);
  });

  // 検索語はそのまま LIKE の当たり判定に入る。上限が無いと、
  // 1 回の要求で任意長の語を投げて全件走査を繰り返させられる (BR-14)
  it('検索語 101 字は 400。上限は 100 字', async () => {
    expect((await get(`/transactions?${PERIOD}&q=${'あ'.repeat(101)}`)).status).toBe(400);
    expect((await get(`/transactions?${PERIOD}&q=${'あ'.repeat(100)}`)).status).toBe(200);
  });
});
