/**
 * 交通費の記帳の API/D1 回帰テスト。
 *
 * もとは証憑添付のライフサイクルテストに同居していた。証憑機能を廃止する際に
 * その巨大なファイルごと消すと、現金の記帳の一部である交通費の保証まで一緒に消える。
 * 交通費と証憑は別の機能なので、ここへ切り出して独立させる。
 *
 * receipt_waived (証憑不要) は「領収書が出ない支出」を示す現金記帳の属性であり、
 * 証憑の保管機能とは別物である。交通費でしか立てられない CHECK 制約も込みで、
 * 現金の記帳の契約としてここで固定する。
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
let files: R2Bucket;
let cookie: string;

const env = () => ({ ...auth, DB: d1, FILES: files });

async function applyMigrations(database: D1Database): Promise<void> {
  const migrationNames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of migrationNames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, migrationNames);
}

async function jsonRequest(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );
}

/** 交通費でない通常の現金記帳を1件作り、その id を返す */
async function seedCashEntry(): Promise<number> {
  expect((await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空会議費' })).status).toBe(
    201,
  );
  const created = await jsonRequest('/cash-entries', 'POST', {
    date: '2026-07-10',
    side: 'biz',
    io: 'expense',
    amount: 1200,
    description: '架空の現金支払い',
    big: '架空会議費',
    mid: '',
    memo: null,
  });
  expect(created.status).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: number } };
  return entry.id;
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'transit-lifecycle-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
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
    env(),
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('交通費の記帳', () => {
  it('区間と往復を保存し、金額は集計にも反映される', async () => {
    expect(
      (await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空旅費交通費' })).status,
    ).toBe(201);
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-12',
      side: 'biz',
      io: 'expense',
      amount: 460,
      description: '電車代 架空駅A→架空駅B(往復)',
      big: '架空旅費交通費',
      mid: '',
      memo: null,
      transitFrom: '架空駅A',
      transitTo: '架空駅B',
      transitRound: true,
      receiptWaived: true,
    });
    expect(created.status).toBe(201);
    const { entry } = (await created.json()) as {
      entry: { transitFrom: string; transitTo: string; transitRound: boolean; receiptWaived: boolean };
    };
    expect(entry).toMatchObject({
      transitFrom: '架空駅A',
      transitTo: '架空駅B',
      transitRound: true,
      receiptWaived: true,
    });

    const agg = await d1
      .prepare('SELECT amount FROM monthly_agg WHERE user_id = ? AND month = ? AND scope = ?')
      .bind('default', '2026-07', 'biz_exp:架空旅費交通費')
      .first<{ amount: number }>();
    expect(agg?.amount).toBe(460);
  });

  it('出発地だけの入力を日本語の理由で拒否する', async () => {
    expect(
      (await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空旅費交通費' })).status,
    ).toBe(201);
    const res = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-12',
      side: 'biz',
      io: 'expense',
      amount: 230,
      description: '電車代',
      big: '架空旅費交通費',
      mid: '',
      memo: null,
      transitFrom: '架空駅A',
      transitTo: null,
      transitRound: false,
      receiptWaived: true,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('出発地と到着地');
  });

  it('通常記帳で証憑不要だけを指定する入力を400で拒否する', async () => {
    expect(
      (await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空会議費' })).status,
    ).toBe(201);
    const res = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-12',
      side: 'biz',
      io: 'expense',
      amount: 1200,
      description: '通常の架空支払い',
      big: '架空会議費',
      mid: '',
      memo: null,
      receiptWaived: true,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('証憑不要');
  });

  it('D1直接のinsert/updateも不正な交通費状態をCHECKで拒否する', async () => {
    const insert = d1
      .prepare(
        `INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,
          transit_from,transit_to,transit_round,receipt_waived,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        'default',
        '2026-07-12',
        '2026-07',
        'biz',
        'expense',
        1200,
        '架空支払い',
        '架空会議費',
        '',
        null,
        null,
        null,
        0,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/i);

    const id = await seedCashEntry();
    await expect(
      d1.prepare('UPDATE cash_entries SET receipt_waived=1 WHERE id=?').bind(id).run(),
    ).rejects.toThrow(/CHECK constraint failed/i);
  });
});
