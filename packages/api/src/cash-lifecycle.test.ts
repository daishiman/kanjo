/**
 * 現金記帳の API/D1 ライフサイクル回帰テスト。
 * 実データを使わず、各テスト専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { planCashParentDeleteQueries } from './routes/cash.js';
import {
  D1BulkPayloadError,
  D1_JSON_BIND_SAFE_BYTES,
  d1JsonPayload,
  getDb,
  loadBackupPayload,
  normalizedDealUpdatesQuery,
  recomputeFromDeals,
} from './store.js';

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

const migrationFiles = () =>
  readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

async function applyMigrations(database: D1Database, filenames = migrationFiles()): Promise<void> {
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
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

async function multipartJsonRequest(body: unknown): Promise<Response> {
  const form = new FormData();
  form.append(
    'file',
    new File([JSON.stringify(body)], 'synthetic-backup.json', { type: 'application/json' }),
  );
  return app.request(
    '/api/imports',
    { method: 'POST', headers: { cookie }, body: form },
    { ...auth, DB: d1, FILES: files },
  );
}

async function addOption(scope: 'biz' | 'per', major: string, mid = ''): Promise<void> {
  const response = await jsonRequest('/category-options', 'POST', { scope, major, mid });
  expect(response.status).toBe(201);
}

async function aggregate(month: string, scope: string): Promise<number | null> {
  const row = await d1
    .prepare('SELECT amount FROM monthly_agg WHERE user_id = ? AND month = ? AND scope = ?')
    .bind('default', month, scope)
    .first<{ amount: number }>();
  return row?.amount ?? null;
}

async function cashEditExists(id: number): Promise<boolean> {
  return !!(await d1
    .prepare('SELECT 1 FROM tx_edits WHERE user_id = ? AND tx_id = ?')
    .bind('default', `cash:${id}`)
    .first());
}

async function freshFixture(name: string): Promise<{
  mf: Miniflare;
  db: D1Database;
  request: (path: string, method?: string, body?: unknown) => Promise<Response>;
}> {
  const freshMf = new Miniflare(
    convertV4MiniflareOptions({
      name,
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  const db = (await freshMf.getD1Database('DB')) as D1Database;
  await applyMigrations(db);
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: db },
  );
  const freshCookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(login.status).toBe(200);
  expect(freshCookie).not.toBe('');
  return {
    mf: freshMf,
    db,
    request: async (path, method, body) =>
      app.request(
        `/api${path}`,
        {
          method: method ?? 'GET',
          headers: {
            cookie: freshCookie,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        { ...auth, DB: db },
      ),
  };
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'cash-lifecycle-test',
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
  for (const { name } of tables.results) await d1.prepare(`DELETE FROM "${name}"`).run();
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: d1 },
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('現金記帳の月次集計ライフサイクル', () => {
  it('同月の復元baselineに現金を加算し、biz/perの月移動・区分変更・削除後もbaselineを保つ', async () => {
    await addOption('biz', '架空会議費');
    await addOption('per', '架空食費', '架空外食');
    const restored = await jsonRequest('/restore', 'POST', {
      months: ['2026-07'],
      biz: {
        revenue: [0],
        categories: ['架空会議費'],
        expense: { 架空会議費: [777] },
      },
      personal: {
        '2026-07': { income: {}, expense: { 架空食費: 888 } },
      },
      mfTx: [],
    });
    expect(restored.status).toBe(200);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(777);
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBe(888);

    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-15',
      side: 'biz',
      io: 'expense',
      amount: 5000,
      description: '架空商工会議所',
      big: '架空会議費',
      mid: '',
      memo: null,
    });
    expect(created.status).toBe(201);
    const { entry } = (await created.json()) as { entry: { id: number } };
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(5777);

    const moved = await jsonRequest(`/cash-entries/${entry.id}`, 'PUT', {
      date: '2026-08-15',
      side: 'biz',
      io: 'expense',
      amount: 5000,
      description: '架空商工会議所',
      big: '架空会議費',
      mid: '',
      memo: null,
    });
    expect(moved.status).toBe(200);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(777);
    expect(await aggregate('2026-08', 'biz_exp:架空会議費')).toBe(5000);

    const changedToPersonal = await jsonRequest(`/cash-entries/${entry.id}`, 'PUT', {
      date: '2026-07-15',
      side: 'per',
      io: 'expense',
      amount: 5000,
      description: '架空商工会議所',
      big: '架空食費',
      mid: '架空外食',
      memo: null,
    });
    expect(changedToPersonal.status).toBe(200);
    expect(await aggregate('2026-08', 'biz_exp:架空会議費')).toBeNull();
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(777);
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBe(5888);

    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, owner, updated_at)
         VALUES (?, ?, 'business', '2026-08-01T00:00:00.000Z')`,
      )
      .bind('default', `cash:${entry.id}`)
      .run();
    const changedBackToBusiness = await jsonRequest(`/cash-entries/${entry.id}`, 'PUT', {
      date: '2026-07-15',
      side: 'biz',
      io: 'expense',
      amount: 5000,
      description: '架空商工会議所',
      big: '架空会議費',
      mid: '',
      memo: null,
    });
    expect(changedBackToBusiness.status).toBe(200);
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBe(888);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(5777);
    expect(await cashEditExists(entry.id)).toBe(false);

    // 削除時にも対応編集を消す。IDはAUTOINCREMENTのため、削除後の新規明細へ再利用されない。
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, owner, updated_at)
         VALUES (?, ?, 'business', '2026-08-02T00:00:00.000Z')`,
      )
      .bind('default', `cash:${entry.id}`)
      .run();

    const deleted = await jsonRequest(`/cash-entries/${entry.id}`, 'DELETE');
    expect(deleted.status).toBe(200);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(777);
    expect(await cashEditExists(entry.id)).toBe(false);

    const personal = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-20',
      side: 'per',
      io: 'expense',
      amount: 300,
      description: '架空売店',
      big: '架空食費',
      mid: '架空外食',
      memo: null,
    });
    expect(personal.status).toBe(201);
    const personalEntry = (await personal.json()) as { entry: { id: number } };
    expect(personalEntry.entry.id).toBeGreaterThan(entry.id);
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBe(1188);

    const movedPersonal = await jsonRequest(`/cash-entries/${personalEntry.entry.id}`, 'PUT', {
      date: '2026-08-20',
      side: 'per',
      io: 'expense',
      amount: 300,
      description: '架空売店',
      big: '架空食費',
      mid: '架空外食',
      memo: null,
    });
    expect(movedPersonal.status).toBe(200);
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBe(888);
    expect(await aggregate('2026-08', 'per_exp:架空食費')).toBe(300);

    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, owner, updated_at)
         VALUES (?, ?, 'business', '2026-08-03T00:00:00.000Z')`,
      )
      .bind('default', `cash:${personalEntry.entry.id}`)
      .run();
    expect((await jsonRequest(`/cash-entries/${personalEntry.entry.id}`, 'DELETE')).status).toBe(200);
    expect(await cashEditExists(personalEntry.entry.id)).toBe(false);
    expect(await aggregate('2026-08', 'per_exp:架空食費')).toBeNull();
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBe(888);

    const afterDelete = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-09-01',
      side: 'per',
      io: 'expense',
      amount: 100,
      description: '架空自販機',
      big: '架空食費',
      mid: '架空外食',
      memo: null,
    });
    expect(afterDelete.status).toBe(201);
    const afterDeleteEntry = (await afterDelete.json()) as { entry: { id: number } };
    expect(afterDeleteEntry.entry.id).toBeGreaterThan(personalEntry.entry.id);
  }, 40_000);
});

describe('現金投影を含むexport/restoreのprovenance', () => {
  it('baselineから現金を除き、同一DBでは現在現金を1回だけ合成し、新DBでは現金とcash editを復元しない', async () => {
    await addOption('biz', '架空会議費');
    await addOption('per', '架空食費', '架空外食');
    const initial = await jsonRequest('/restore', 'POST', {
      months: ['2026-11', '2026-12'],
      biz: {
        revenue: [0, 0],
        categories: ['架空会議費'],
        expense: { 架空会議費: [100, 1000] },
      },
      personal: {
        '2026-11': { income: {}, expense: { 架空食費: 200 } },
        '2026-12': { income: {}, expense: { 架空食費: 2000 } },
      },
      mfTx: [],
    });
    expect(initial.status).toBe(200);

    // 12月は原本を正とし、復元baselineを加算しない。
    await d1
      .prepare(
        `INSERT INTO freee_deals
         (user_id, month, date, io, account_raw, account_norm, amount)
         VALUES ('default', '2026-12', '2026-12-01', 'expense', '架空会議費', '架空会議費', 300)`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO mf_transactions
         (user_id, tx_id, month, date, description, amount, category_major, category_mid)
         VALUES ('default', 'mf-original', '2026-12', '2026-12-01', '架空原本', -400, '架空食費', '架空外食')`,
      )
      .run();

    const createCash = async (side: 'biz' | 'per', month: '11' | '12', amount: number) => {
      const response = await jsonRequest('/cash-entries', 'POST', {
        date: `2026-${month}-15`,
        side,
        io: 'expense',
        amount,
        description: `架空現金${side}${month}`,
        big: side === 'biz' ? '架空会議費' : '架空食費',
        mid: side === 'biz' ? '' : '架空外食',
        memo: null,
      });
      expect(response.status).toBe(201);
      return ((await response.json()) as { entry: { id: number } }).entry;
    };
    await createCash('biz', '11', 10);
    await createCash('biz', '12', 30);
    const personal = await createCash('per', '11', 20);
    await createCash('per', '12', 40);
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id, tx_id, owner, updated_at)
         VALUES ('default', ?, 'business', '2026-12-20T00:00:00.000Z')`,
      )
      .bind(`cash:${personal.id}`)
      .run();

    expect(await aggregate('2026-11', 'biz_exp:架空会議費')).toBe(110);
    expect(await aggregate('2026-11', 'per_exp:架空食費')).toBe(220);
    expect(await aggregate('2026-12', 'biz_exp:架空会議費')).toBe(330);
    expect(await aggregate('2026-12', 'per_exp:架空食費')).toBe(440);

    const exportedResponse = await jsonRequest('/export/json');
    expect(exportedResponse.status).toBe(200);
    const exported = (await exportedResponse.json()) as Record<string, unknown> & {
      cashEntries: unknown[];
      edits: Record<string, unknown>;
      cashProjection: {
        version: number;
        basis: string;
        rows: Array<{ month: string; scope: string; amount: number }>;
      };
    };
    expect(exported.cashEntries).toHaveLength(4);
    expect(exported.cashProjection).toEqual({
      version: 1,
      basis: 'post-resolution',
      rows: [
        { month: '2026-11', scope: 'biz_exp:架空会議費', amount: 10 },
        { month: '2026-11', scope: 'per_exp:架空食費', amount: 20 },
        { month: '2026-12', scope: 'biz_exp:架空会議費', amount: 30 },
        { month: '2026-12', scope: 'per_exp:架空食費', amount: 40 },
      ],
    });

    const sameDbRestore = await jsonRequest('/restore', 'POST', exported);
    expect(sameDbRestore.status, await sameDbRestore.clone().text()).toBe(200);
    expect(await aggregate('2026-11', 'biz_exp:架空会議費')).toBe(110);
    expect(await aggregate('2026-11', 'per_exp:架空食費')).toBe(220);
    expect(await aggregate('2026-12', 'biz_exp:架空会議費')).toBe(330);
    expect(await aggregate('2026-12', 'per_exp:架空食費')).toBe(440);
    expect(await cashEditExists(personal.id)).toBe(true);
    expect(
      await d1
        .prepare(
          `SELECT amount FROM restored_monthly_agg
           WHERE user_id = 'default' AND month = '2026-11' AND scope = 'biz_exp:架空会議費'`,
        )
        .first<{ amount: number }>(),
    ).toEqual({ amount: 100 });
    expect(
      await d1
        .prepare(
          `SELECT amount FROM restored_monthly_agg
           WHERE user_id = 'default' AND month = '2026-12' AND scope = 'per_exp:架空食費'`,
        )
        .first<{ amount: number }>(),
    ).toEqual({ amount: 400 });

    // backup内のcash:* editは、新DBで後から採番されるcash id=1へ付着させない。
    exported.edits = { ...exported.edits, 'cash:1': { owner: 'spouse' } };
    const fresh = await freshFixture('cash-export-restore-fresh');
    try {
      const restored = await fresh.request('/restore', 'POST', exported);
      expect(restored.status, await restored.clone().text()).toBe(200);
      // この規模の集計では記帳4件を足すと49 query予算を超えるため、記帳だけ見送る。
      // 見送りは黙って0件にせず cashSkipped で返す
      await expect(restored.clone().json()).resolves.toMatchObject({
        cashEntries: 0,
        cashSkipped: 4,
      });
      expect(
        await fresh.db
          .prepare(
            `SELECT amount FROM monthly_agg
             WHERE user_id = 'default' AND month = '2026-11' AND scope = 'biz_exp:架空会議費'`,
          )
          .first<{ amount: number }>(),
      ).toEqual({ amount: 100 });
      expect(
        await fresh.db
          .prepare("SELECT COUNT(*) AS n FROM cash_entries WHERE user_id = 'default'")
          .first<{ n: number }>(),
      ).toEqual({ n: 0 });
      expect(
        await fresh.db
          .prepare("SELECT COUNT(*) AS n FROM tx_edits WHERE tx_id LIKE 'cash:%'")
          .first<{ n: number }>(),
      ).toEqual({ n: 0 });

      expect(
        (
          await fresh.request('/category-options', 'POST', {
            scope: 'per',
            major: '架空食費',
            mid: '架空外食',
          })
        ).status,
      ).toBe(201);
      const created = await fresh.request('/cash-entries', 'POST', {
        date: '2026-11-30',
        side: 'per',
        io: 'expense',
        amount: 50,
        description: '架空新規現金',
        big: '架空食費',
        mid: '架空外食',
        memo: null,
      });
      expect(created.status).toBe(201);
      await expect(created.json()).resolves.toMatchObject({ entry: { id: 1 } });
      expect(
        await fresh.db
          .prepare("SELECT COUNT(*) AS n FROM tx_edits WHERE tx_id = 'cash:1'")
          .first<{ n: number }>(),
      ).toEqual({ n: 0 });
      expect(
        await fresh.db
          .prepare(
            `SELECT amount FROM monthly_agg
             WHERE user_id = 'default' AND month = '2026-11' AND scope = 'per_exp:架空食費'`,
          )
          .first<{ amount: number }>(),
      ).toEqual({ amount: 250 });
    } finally {
      await fresh.mf.dispose();
    }
  }, 30_000);

  it('post-resolution projectionをdestination設定で再解釈せず、invalid/legacy ambiguityは書込み前に拒否する', async () => {
    await addOption('biz', '架空原科目');
    await addOption('biz', '架空通信原');
    await addOption('per', '架空財布', '架空雑貨');
    await d1
      .prepare(
        "INSERT INTO account_norm_map (user_id, raw, norm) VALUES ('default', '架空原科目', '架空確定科目')",
      )
      .run();
    await d1.batch([
      d1.prepare(
        "INSERT INTO account_norm_map (user_id, raw, norm) VALUES ('default', '架空通信原', 'サブスク・通信')",
      ),
      d1.prepare(
        `INSERT INTO sub_vendors (user_id,name,aliases,sort_order,created_at)
           VALUES ('default','架空SaaS','[]',1,'2026-06-01T00:00:00.000Z')`,
      ),
      d1.prepare(
        `INSERT INTO rules (user_id,keyword,cls,sort_order)
           VALUES ('default','架空立替','biz',1)`,
      ),
    ]);
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-06-01',
      side: 'biz',
      io: 'expense',
      amount: 321,
      description: '架空支払先',
      big: '架空原科目',
      mid: '',
      memo: null,
    });
    expect(created.status).toBe(201);
    const moreCash = [
      {
        date: '2026-06-02',
        side: 'biz',
        io: 'income',
        amount: 123,
        description: '架空売上',
        big: '架空原科目',
        mid: '',
        memo: null,
      },
      {
        date: '2026-06-03',
        side: 'biz',
        io: 'expense',
        amount: 456,
        description: '架空SaaS',
        big: '架空通信原',
        mid: '',
        memo: null,
      },
      {
        date: '2026-06-04',
        side: 'per',
        io: 'expense',
        amount: 789,
        description: '架空立替 現金',
        big: '架空財布',
        mid: '架空雑貨',
        memo: null,
      },
    ];
    for (const entry of moreCash)
      expect((await jsonRequest('/cash-entries', 'POST', entry)).status).toBe(201);
    const exported = (await (await jsonRequest('/export/json')).json()) as Record<string, unknown> & {
      cashProjection: { rows: Array<{ month: string; scope: string; amount: number }> };
      cashEntries: unknown[];
    };
    expect(exported.cashProjection.rows).toContainEqual({
      month: '2026-06',
      scope: 'biz_exp:架空確定科目',
      amount: 321,
    });
    expect(exported.cashProjection.rows).toEqual(
      expect.arrayContaining([
        { month: '2026-06', scope: 'biz_rev', amount: 123 },
        { month: '2026-06', scope: 'biz_exp:サブスク・通信', amount: 456 },
        { month: '2026-06', scope: 'subs:架空SaaS', amount: 456 },
        { month: '2026-06', scope: 'biz_personal_out', amount: 789 },
      ]),
    );

    await d1
      .prepare(
        "UPDATE account_norm_map SET norm = '架空移行先科目' WHERE user_id = 'default' AND raw = '架空原科目'",
      )
      .run();
    expect((await jsonRequest('/restore', 'POST', exported)).status).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT amount FROM restored_monthly_agg WHERE user_id='default' AND month='2026-06' AND scope='biz_exp:架空確定科目'",
        )
        .first(),
    ).toBeNull();

    const before = await d1
      .prepare("SELECT COUNT(*) AS n FROM imports WHERE user_id='default'")
      .first<{ n: number }>();
    const invalidCases = [
      { ...exported, cashProjection: { version: 2, basis: 'post-resolution', rows: [] } },
      {
        ...exported,
        cashProjection: {
          version: 1,
          basis: 'post-resolution',
          rows: [
            { month: '2026-06', scope: 'biz_exp:架空確定科目', amount: 1 },
            { month: '2026-06', scope: 'biz_exp:架空確定科目', amount: 1 },
          ],
        },
      },
      {
        ...exported,
        cashProjection: {
          version: 1,
          basis: 'post-resolution',
          rows: [{ month: '2026-06', scope: 'unknown', amount: 1 }],
        },
      },
      {
        ...exported,
        cashProjection: {
          version: 1,
          basis: 'post-resolution',
          rows: [{ month: '2026-06', scope: 'biz_exp:架空確定科目', amount: 999999 }],
        },
      },
      Object.fromEntries(Object.entries(exported).filter(([key]) => key !== 'cashProjection')),
    ];
    for (const body of invalidCases) expect((await jsonRequest('/restore', 'POST', body)).status).toBe(400);
    expect(
      await d1.prepare("SELECT COUNT(*) AS n FROM imports WHERE user_id='default'").first<{ n: number }>(),
    ).toEqual(before);
    const r2Before = await files.list();
    expect((await multipartJsonRequest(invalidCases[0])).status).toBe(400);
    expect(
      await d1.prepare("SELECT COUNT(*) AS n FROM imports WHERE user_id='default'").first<{ n: number }>(),
    ).toEqual(before);
    expect((await files.list()).objects.map((object) => object.key)).toEqual(
      r2Before.objects.map((object) => object.key),
    );

    const legacy = Object.fromEntries(
      Object.entries(exported).filter(([key]) => key !== 'cashProjection' && key !== 'cashEntries'),
    );
    expect((await jsonRequest('/restore', 'POST', legacy)).status).toBe(200);
    expect(
      (
        await jsonRequest('/restore', 'POST', {
          ...legacy,
          cashProjection: { version: 1, basis: 'post-resolution', rows: [] },
        })
      ).status,
    ).toBe(200);
  }, 30_000);

  it('canonical rowsと集計cacheの更新間でも、exportを同一raw snapshotだけから再構築する', async () => {
    await addOption('biz', '架空原科目');
    await d1
      .prepare(
        "INSERT INTO account_norm_map (user_id, raw, norm) VALUES ('default', '架空原科目', '架空旧科目')",
      )
      .run();
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-09-01',
      side: 'biz',
      io: 'expense',
      amount: 100,
      description: '架空旧現金',
      big: '架空原科目',
      mid: '',
      memo: null,
    });
    expect(created.status).toBe(201);
    const cashId = ((await created.json()) as { entry: { id: number } }).entry.id;
    expect(await aggregate('2026-09', 'biz_exp:架空旧科目')).toBe(100);

    // canonical delete直後、monthly_agg再生成前を意図的に作る。旧cacheをbaselineとしてexportしてはならない。
    await d1.prepare('DELETE FROM cash_entries WHERE id = ?').bind(cashId).run();
    const deletedGap = (await loadBackupPayload(getDb(d1), 'default')) as {
      months: string[];
      biz: { categories: string[] };
      cashProjection: { rows: unknown[] };
    };
    expect(deletedGap.months).not.toContain('2026-09');
    expect(deletedGap.biz.categories).not.toContain('架空旧科目');
    expect(deletedGap.cashProjection.rows).toEqual([]);

    // canonical add/update・設定更新後、cacheが旧世代のままでも全入力を同じraw snapshotから解決する。
    const inserted = await d1
      .prepare(
        `INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at)
         VALUES ('default','2026-09-02','2026-09','biz','expense',222,'架空SaaS','架空原科目','',NULL,'now','now')
         RETURNING id`,
      )
      .first<{ id: number }>();
    await d1.batch([
      d1.prepare(
        "UPDATE account_norm_map SET norm='架空新科目' WHERE user_id='default' AND raw='架空原科目'",
      ),
      d1.prepare(
        `INSERT INTO sub_vendors (user_id,name,aliases,sort_order,created_at)
         VALUES ('default','架空SaaS','[]',0,'now')`,
      ),
      d1.prepare(
        `INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at)
         VALUES ('default','2026-09-03','2026-09','per','expense',33,'架空ルール対象','架空家計','',NULL,'now','now')`,
      ),
      d1.prepare(
        `INSERT INTO rules (user_id,keyword,cls,sort_order)
         VALUES ('default','架空ルール対象','biz',0)`,
      ),
      d1.prepare("INSERT INTO budgets (user_id,account,monthly_amount) VALUES ('default','架空予算',1234)"),
      d1.prepare(
        "INSERT INTO cash_overrides (user_id,month,revenue,expense) VALUES ('default','2026-09',12,34)",
      ),
    ]);
    const addedGap = (await loadBackupPayload(getDb(d1), 'default')) as {
      months: string[];
      biz: { categories: string[]; expense: Record<string, number[]> };
      subs: { vendors: string[]; matrix: Record<string, number[]> };
      bizPersonal: Record<string, { expense: number }>;
      budgets: Record<string, number>;
      cashOverride: Record<string, { revenue: number; expense: number }>;
      cashProjection: { rows: Array<{ month: string; scope: string; amount: number }> };
    };
    const monthIndex = addedGap.months.indexOf('2026-09');
    expect(monthIndex).toBeGreaterThanOrEqual(0);
    expect(addedGap.biz.categories).toContain('架空新科目');
    expect(addedGap.biz.expense['架空新科目']?.[monthIndex]).toBe(222);
    expect(addedGap.subs.vendors).toContain('架空SaaS');
    expect(addedGap.subs.matrix['架空SaaS']?.[monthIndex]).toBe(222);
    expect(addedGap.bizPersonal['2026-09']?.expense).toBe(33);
    expect(addedGap.budgets).toEqual({ 架空予算: 1234 });
    expect(addedGap.cashOverride).toEqual({ '2026-09': { revenue: 12, expense: 34 } });
    expect(addedGap.cashProjection.rows).toEqual(
      expect.arrayContaining([
        { month: '2026-09', scope: 'biz_exp:架空新科目', amount: 222 },
        { month: '2026-09', scope: 'subs:架空SaaS', amount: 222 },
        { month: '2026-09', scope: 'biz_personal_out', amount: 33 },
      ]),
    );

    await d1.prepare('UPDATE cash_entries SET amount=333 WHERE id=?').bind(inserted?.id).run();
    const updatedGap = (await loadBackupPayload(getDb(d1), 'default')) as {
      biz: { expense: Record<string, number[]> };
      cashProjection: { rows: Array<{ scope: string; amount: number }> };
    };
    expect(updatedGap.biz.expense['架空新科目']?.[monthIndex]).toBe(333);
    expect(updatedGap.cashProjection.rows).toContainEqual({
      month: '2026-09',
      scope: 'biz_exp:架空新科目',
      amount: 333,
    });
  }, 30_000);
});

describe('append-only migrationのprovenanceとID契約', () => {
  it('cash sideごとに反対domainの安全な旧集計をbaselineへ移行し、IDを再利用しない', async () => {
    const legacyMf = new Miniflare(
      convertV4MiniflareOptions({
        name: 'cash-migration-test',
        modules: true,
        script: 'export default { fetch() { return new Response("test") } }',
        d1Databases: ['DB'],
      }),
    );
    try {
      const legacyDb = (await legacyMf.getD1Database('DB')) as D1Database;
      const files = migrationFiles();
      await applyMigrations(
        legacyDb,
        files.filter((filename) => filename < '0006'),
      );
      await applyMigrations(legacyDb, ['0006_cash_entries_import_hash.sql']);
      await legacyDb
        .prepare(
          `INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES
           ('legacy','2025-01','biz_exp:同domain曖昧事業',11),
           ('legacy','2025-01','per_exp:安全家計',101),
           ('legacy','2025-02','biz_exp:安全事業',202),
           ('legacy','2025-02','per_exp:同domain曖昧家計',22),
           ('legacy','2025-03','biz_exp:両side曖昧事業',33),
           ('legacy','2025-03','per_exp:両side曖昧家計',33),
           ('legacy','2025-04','biz_exp:cashなし事業',404),
           ('legacy','2025-04','per_exp:cashなし家計',404),
           ('legacy','2025-05','biz_exp:原本事業',505),
           ('legacy','2025-06','per_exp:原本家計',606)`,
        )
        .run();
      await legacyDb
        .prepare(
          `INSERT INTO cash_entries
           (user_id,date,month,side,io,amount,description,category_major,category_mid,created_at,updated_at)
           VALUES
           ('legacy','2025-01-01','2025-01','biz','expense',11,'移行前事業','同domain曖昧事業','','now','now'),
           ('legacy','2025-02-01','2025-02','per','expense',22,'移行前家計','同domain曖昧家計','','now','now'),
           ('legacy','2025-03-01','2025-03','biz','expense',33,'移行前両side事業','両side曖昧事業','','now','now'),
           ('legacy','2025-03-02','2025-03','per','expense',33,'移行前両side家計','両side曖昧家計','','now','now')`,
        )
        .run();
      await legacyDb
        .prepare(
          `INSERT INTO freee_deals (user_id,month,date,io,account_raw,account_norm,amount)
           VALUES ('legacy','2025-05','2025-05-01','expense','原本事業','原本事業',505)`,
        )
        .run();
      await legacyDb
        .prepare(
          `INSERT INTO mf_transactions
           (user_id,tx_id,month,date,description,amount,category_major,category_mid)
           VALUES ('legacy','mf-1','2025-06','2025-06-01','架空原本家計',-606,'原本家計','')`,
        )
        .run();
      await applyMigrations(legacyDb, ['0007_cash_lifecycle_provenance.sql']);

      const baseline = await legacyDb
        .prepare(
          'SELECT month, scope, amount FROM restored_monthly_agg WHERE user_id = ? ORDER BY month, scope',
        )
        .bind('legacy')
        .all<{ month: string; scope: string; amount: number }>();
      expect(baseline.results).toEqual([
        { month: '2025-01', scope: 'per_exp:安全家計', amount: 101 },
        { month: '2025-02', scope: 'biz_exp:安全事業', amount: 202 },
        { month: '2025-04', scope: 'biz_exp:cashなし事業', amount: 404 },
        { month: '2025-04', scope: 'per_exp:cashなし家計', amount: 404 },
      ]);

      const storeDb = getDb(legacyDb);
      await recomputeFromDeals(storeDb, 'legacy');
      const assertBaselineAgg = async () => {
        const rows = await legacyDb
          .prepare(
            `SELECT month,scope,amount FROM monthly_agg
             WHERE user_id='legacy' AND scope IN
             ('per_exp:安全家計','biz_exp:安全事業','biz_exp:cashなし事業','per_exp:cashなし家計')
             ORDER BY month,scope`,
          )
          .all();
        expect(rows.results).toEqual([
          { month: '2025-01', scope: 'per_exp:安全家計', amount: 101 },
          { month: '2025-02', scope: 'biz_exp:安全事業', amount: 202 },
          { month: '2025-04', scope: 'biz_exp:cashなし事業', amount: 404 },
          { month: '2025-04', scope: 'per_exp:cashなし家計', amount: 404 },
        ]);
      };
      await assertBaselineAgg();

      const bizCash = await legacyDb
        .prepare("SELECT id FROM cash_entries WHERE user_id='legacy' AND month='2025-01' AND side='biz'")
        .first<{ id: number }>();
      await legacyDb
        .prepare("UPDATE cash_entries SET month='2025-04',date='2025-04-10' WHERE id=?")
        .bind(bizCash?.id)
        .run();
      await recomputeFromDeals(storeDb, 'legacy', [
        { month: '2025-01', side: 'biz' },
        { month: '2025-04', side: 'biz' },
      ]);
      await assertBaselineAgg();
      await legacyDb.prepare('DELETE FROM cash_entries WHERE id=?').bind(bizCash?.id).run();
      await recomputeFromDeals(storeDb, 'legacy', [{ month: '2025-04', side: 'biz' }]);
      await assertBaselineAgg();

      const perCash = await legacyDb
        .prepare("SELECT id FROM cash_entries WHERE user_id='legacy' AND month='2025-02' AND side='per'")
        .first<{ id: number }>();
      await legacyDb
        .prepare("UPDATE cash_entries SET month='2025-04',date='2025-04-11' WHERE id=?")
        .bind(perCash?.id)
        .run();
      await recomputeFromDeals(storeDb, 'legacy', [
        { month: '2025-02', side: 'per' },
        { month: '2025-04', side: 'per' },
      ]);
      await assertBaselineAgg();
      await legacyDb.prepare('DELETE FROM cash_entries WHERE id=?').bind(perCash?.id).run();
      await recomputeFromDeals(storeDb, 'legacy', [{ month: '2025-04', side: 'per' }]);
      await assertBaselineAgg();

      const insertCash = async (description: string) =>
        legacyDb
          .prepare(
            `INSERT INTO cash_entries
             (user_id, date, month, side, io, amount, description, category_major, category_mid, created_at, updated_at)
             VALUES ('legacy', '2025-07-01', '2025-07', 'per', 'expense', 1, ?, '架空', '', 'now', 'now')
             RETURNING id`,
          )
          .bind(description)
          .first<{ id: number }>();
      const first = await insertCash('最初');
      await legacyDb.prepare('DELETE FROM cash_entries WHERE id = ?').bind(first?.id).run();
      const second = await insertCash('次');
      expect(second?.id).toBeGreaterThan(first?.id ?? 0);
    } finally {
      await legacyMf.dispose();
    }
  }, 20_000);
});

describe('候補科目と現金記帳の参照整合', () => {
  it('使用数・rename・delete guardが現金明細を同じconsumerとして扱う', async () => {
    await addOption('per', '架空食費', '架空外食');
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-20',
      side: 'per',
      io: 'expense',
      amount: 1200,
      description: '架空食堂',
      big: '架空食費',
      mid: '架空外食',
      memo: null,
    });
    expect(created.status).toBe(201);

    const classification = await jsonRequest('/classification');
    const options = ((await classification.json()) as { categoryOptions: unknown[] })
      .categoryOptions as Array<{
      major: string;
      uses: { cashEntries: number };
    }>;
    expect(options.find((o) => o.major === '架空食費')?.uses.cashEntries).toBe(1);

    const guarded = await jsonRequest('/category-options', 'DELETE', {
      scope: 'per',
      major: '架空食費',
      mid: '架空外食',
    });
    expect(guarded.status).toBe(409);
    await expect(guarded.json()).resolves.toMatchObject({ uses: { cashEntries: 1 } });

    const renamed = await jsonRequest('/category-options', 'PUT', {
      from: { scope: 'per', major: '架空食費', mid: '架空外食' },
      to: { major: '架空外食費', mid: '架空ランチ' },
    });
    expect(renamed.status).toBe(200);
    const cash = await jsonRequest('/cash-entries');
    await expect(cash.json()).resolves.toMatchObject({
      entries: [{ categoryMajor: '架空外食費', categoryMid: '架空ランチ' }],
    });
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBeNull();
    expect(await aggregate('2026-07', 'per_exp:架空外食費')).toBe(1200);
  });

  it('中項目なしの個人現金は、同じ大項目の最後の供給optionだけに依存する', async () => {
    await addOption('per', '架空交通費', '架空電車');
    await addOption('per', '架空交通費', '架空バス');
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-10-01',
      side: 'per',
      io: 'expense',
      amount: 600,
      description: '架空乗車',
      big: '架空交通費',
      mid: '',
      memo: null,
    });
    expect(created.status).toBe(201);

    const before = (await (await jsonRequest('/classification')).json()) as {
      categoryOptions: Array<{ major: string; mid: string; uses: { cashEntries: number } }>;
    };
    expect(
      before.categoryOptions.filter((o) => o.major === '架空交通費').map((o) => o.uses.cashEntries),
    ).toEqual([0, 0]);

    const deleteOne = await jsonRequest('/category-options', 'DELETE', {
      scope: 'per',
      major: '架空交通費',
      mid: '架空電車',
    });
    expect(deleteOne.status).toBe(200);
    const afterOne = (await (await jsonRequest('/classification')).json()) as {
      categoryOptions: Array<{ major: string; mid: string; uses: { cashEntries: number } }>;
    };
    expect(afterOne.categoryOptions.find((o) => o.mid === '架空バス')?.uses.cashEntries).toBe(1);

    const guardedLast = await jsonRequest('/category-options', 'DELETE', {
      scope: 'per',
      major: '架空交通費',
      mid: '架空バス',
    });
    expect(guardedLast.status).toBe(409);
    await expect(guardedLast.json()).resolves.toMatchObject({ uses: { cashEntries: 1 } });

    const renamedLast = await jsonRequest('/category-options', 'PUT', {
      from: { scope: 'per', major: '架空交通費', mid: '架空バス' },
      to: { major: '架空移動費', mid: '架空路線バス' },
    });
    expect(renamedLast.status).toBe(200);
    const cash = await jsonRequest('/cash-entries');
    await expect(cash.json()).resolves.toMatchObject({
      entries: [{ categoryMajor: '架空移動費', categoryMid: '' }],
    });
  });

  it('clsなしeditは実明細の有効scopeだけに依存し、raw科目が供給するoptionには依存しない', async () => {
    await addOption('biz', '架空共通費');
    await addOption('per', '架空共通費', '架空個人');
    await addOption('per', '架空原本費', '架空原本中');
    await d1
      .prepare(
        `INSERT INTO mf_transactions
         (user_id, tx_id, month, date, description, amount, category_major, category_mid)
         VALUES
         ('default', 'mf-scope', '2026-10', '2026-10-01', '架空個人明細', -100, '架空旧科目', ''),
         ('default', 'mf-raw-provider', '2026-10', '2026-10-02', '架空原本明細', -200, '架空原本費', '架空原本中')`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO tx_edits
         (user_id, tx_id, cls, category_major, category_mid, updated_at)
         VALUES
         ('default', 'mf-scope', NULL, '架空共通費', '', '2026-10-03T00:00:00.000Z'),
         ('default', 'mf-raw-provider', NULL, '架空原本費', '架空原本中', '2026-10-03T00:00:00.000Z')`,
      )
      .run();

    const options = (
      (await (await jsonRequest('/classification')).json()) as {
        categoryOptions: Array<{ scope: string; major: string; uses: { edits: number } }>;
      }
    ).categoryOptions;
    expect(options.find((o) => o.scope === 'biz' && o.major === '架空共通費')?.uses.edits).toBe(0);
    expect(options.find((o) => o.scope === 'per' && o.major === '架空共通費')?.uses.edits).toBe(1);
    expect(options.find((o) => o.major === '架空原本費')?.uses.edits).toBe(0);

    expect(
      (
        await jsonRequest('/category-options', 'PUT', {
          from: { scope: 'biz', major: '架空共通費', mid: '' },
          to: { major: '架空事業費', mid: '' },
        })
      ).status,
    ).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT category_major AS major FROM tx_edits WHERE user_id = 'default' AND tx_id = 'mf-scope'",
        )
        .first<{ major: string }>(),
    ).toEqual({ major: '架空共通費' });

    expect(
      (
        await jsonRequest('/category-options', 'PUT', {
          from: { scope: 'per', major: '架空共通費', mid: '架空個人' },
          to: { major: '架空個人費', mid: '架空個人新' },
        })
      ).status,
    ).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT category_major AS major, category_mid AS mid FROM tx_edits WHERE user_id = 'default' AND tx_id = 'mf-scope'",
        )
        .first<{ major: string; mid: string }>(),
    ).toEqual({ major: '架空個人費', mid: '' });

    expect(
      (
        await jsonRequest('/category-options', 'PUT', {
          from: { scope: 'per', major: '架空原本費', mid: '架空原本中' },
          to: { major: '架空原本費改', mid: '架空原本中改' },
        })
      ).status,
    ).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT category_major AS major, category_mid AS mid FROM tx_edits WHERE user_id = 'default' AND tx_id = 'mf-raw-provider'",
        )
        .first<{ major: string; mid: string }>(),
    ).toEqual({ major: '架空原本費', mid: '架空原本中' });
  });
});

describe('仕分けルールのcanonical total order', () => {
  it('sort_order,idの勝者を明細解決とcategory usageで共有し、reorderは完全順列だけ受理する', async () => {
    await addOption('biz', '架空事業費');
    await addOption('per', '架空個人費', '架空中項目');
    await addOption('biz', '架空共通費');
    await addOption('per', '架空共通費', '架空個人中');
    await d1
      .prepare(
        `INSERT INTO mf_transactions
         (user_id, tx_id, month, date, description, amount, category_major, category_mid)
         VALUES
         ('default','mf-rule-order','2026-05','2026-05-01','架空競合ワード 支払',-100,'旧科目',''),
         ('default','mf-edit-order','2026-05','2026-05-02','架空競合ワード 編集',-200,'旧科目','')`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO tx_edits (user_id,tx_id,cls,category_major,category_mid,updated_at)
         VALUES ('default','mf-edit-order',NULL,'架空共通費','','2026-05-03T00:00:00.000Z')`,
      )
      .run();
    // 物理INSERT順はpersonal→business、評価順はbusiness→personal。tieは小さいidが先勝ち。
    const per = await d1
      .prepare(
        `INSERT INTO rules (user_id,keyword,cls,category_major,category_mid,sort_order)
         VALUES ('default','架空競合ワード','per','架空個人費','架空中項目',20) RETURNING id`,
      )
      .first<{ id: number }>();
    const biz = await d1
      .prepare(
        `INSERT INTO rules (user_id,keyword,cls,category_major,category_mid,sort_order)
         VALUES ('default','架空競合ワード','biz','架空事業費','',10) RETURNING id`,
      )
      .first<{ id: number }>();
    const foreign = await d1
      .prepare(
        `INSERT INTO rules (user_id,keyword,cls,sort_order)
         VALUES ('another-user','架空競合ワード','biz',0) RETURNING id`,
      )
      .first<{ id: number }>();
    const txs = (await (await jsonRequest('/transactions?month=2026-05')).json()) as {
      transactions: Array<{ id: string; cls: string; big: string }>;
    };
    expect(txs.transactions.find((row) => row.id === 'mf-rule-order')).toMatchObject({
      cls: 'biz',
      big: '架空事業費',
    });
    const usage = (await (await jsonRequest('/classification')).json()) as {
      categoryOptions: Array<{ scope: string; major: string; uses: { edits: number } }>;
    };
    expect(
      usage.categoryOptions.find((option) => option.scope === 'biz' && option.major === '架空共通費')?.uses
        .edits,
    ).toBe(1);
    expect(
      usage.categoryOptions.find((option) => option.scope === 'per' && option.major === '架空共通費')?.uses
        .edits,
    ).toBe(0);

    expect(
      (
        await jsonRequest('/category-options', 'PUT', {
          from: { scope: 'per', major: '架空共通費', mid: '架空個人中' },
          to: { major: '架空個人共通費', mid: '架空個人中' },
        })
      ).status,
    ).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT category_major AS major FROM tx_edits WHERE user_id='default' AND tx_id='mf-edit-order'",
        )
        .first(),
    ).toEqual({ major: '架空共通費' });
    expect(
      (
        await jsonRequest('/category-options', 'PUT', {
          from: { scope: 'biz', major: '架空共通費', mid: '' },
          to: { major: '架空事業共通費', mid: '' },
        })
      ).status,
    ).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT category_major AS major FROM tx_edits WHERE user_id='default' AND tx_id='mf-edit-order'",
        )
        .first(),
    ).toEqual({ major: '架空事業共通費' });

    const beforeOrder = (
      await d1
        .prepare(
          "SELECT id,sort_order AS sortOrder FROM rules WHERE user_id='default' ORDER BY sort_order,id",
        )
        .all<{ id: number; sortOrder: number }>()
    ).results;
    for (const order of [[biz?.id], [biz?.id, biz?.id], [biz?.id, 999999], [per?.id, foreign?.id]]) {
      expect((await jsonRequest('/rules', 'PATCH', { order })).status).toBe(400);
      expect(
        (
          await d1
            .prepare(
              "SELECT id,sort_order AS sortOrder FROM rules WHERE user_id='default' ORDER BY sort_order,id",
            )
            .all()
        ).results,
      ).toEqual(beforeOrder);
    }
    expect((await jsonRequest('/rules', 'PATCH', { order: [per?.id, biz?.id] })).status).toBe(200);
    expect(
      (
        await d1
          .prepare(
            "SELECT id,sort_order AS sortOrder FROM rules WHERE user_id='default' ORDER BY sort_order,id",
          )
          .all()
      ).results,
    ).toEqual([
      { id: per?.id, sortOrder: 0 },
      { id: biz?.id, sortOrder: 1 },
    ]);

    await d1.prepare("UPDATE rules SET sort_order=0 WHERE user_id='default'").run();
    const ids = await d1
      .prepare("SELECT id FROM rules WHERE user_id='default' ORDER BY sort_order,id")
      .all<{ id: number }>();
    const firstId = ids.results[0]?.id;
    const firstCls = firstId === per?.id ? 'per' : 'biz';
    const tie = (await (await jsonRequest('/transactions?month=2026-05')).json()) as {
      transactions: Array<{ id: string; cls: string }>;
    };
    expect(tie.transactions.find((row) => row.id === 'mf-rule-order')?.cls).toBe(firstCls);
  }, 20_000);
});

describe('cash親削除のD1 query budget', () => {
  it('添付10件+正規化差分多数でもquery数が行数非依存で49以下に収まる', () => {
    const oneDifference = planCashParentDeleteQueries(10, 1);
    const manyDifferences = planCashParentDeleteQueries(10, 100_000);
    expect(manyDifferences).toEqual({
      total: 41,
      success: 39,
      attachmentFailure: 41,
      limit: 50,
      accepted: true,
    });
    expect(manyDifferences.success).toBe(oneDifference.success);
    expect(manyDifferences.total).toBeLessThanOrEqual(49);
    expect(() => planCashParentDeleteQueries(11, 0)).toThrow('invalid_cash_parent_delete_query_plan');
  });

  it('正規化差分100件を1つのjson_each UPDATEで更新し、空・重複・不正入力を安全に扱う', async () => {
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 100)
         INSERT INTO freee_deals (user_id,month,date,io,account_raw,account_norm,amount)
         SELECT 'default','2026-07','2026-07-01','expense','架空旧科目','旧正規化',n FROM seq`,
      )
      .run();
    const ids = (
      await d1.prepare("SELECT id FROM freee_deals WHERE user_id='default' ORDER BY id").all<{ id: number }>()
    ).results.map((row) => row.id);
    const updates = ids.map((id) => ({ id, accountNorm: '新正規化' }));
    updates.push({ id: ids[0] ?? 0, accountNorm: '新正規化' });

    const query = normalizedDealUpdatesQuery(getDb(d1), 'default', updates);
    expect(query).not.toBeNull();
    expect(query?.toSQL().sql.match(/json_each/g)).toHaveLength(2);
    await query;
    expect(
      await d1
        .prepare("SELECT COUNT(*) AS n FROM freee_deals WHERE user_id='default' AND account_norm='新正規化'")
        .first(),
    ).toEqual({ n: 100 });

    expect(normalizedDealUpdatesQuery(getDb(d1), 'default', [])).toBeNull();
    expect(() =>
      normalizedDealUpdatesQuery(getDb(d1), 'default', [
        { id: ids[0] ?? 0, accountNorm: 'A' },
        { id: ids[0] ?? 0, accountNorm: 'B' },
      ]),
    ).toThrow(D1BulkPayloadError);
    expect(() =>
      normalizedDealUpdatesQuery(getDb(d1), 'default', [{ id: Number.NaN, accountNorm: '不正' }]),
    ).toThrow(D1BulkPayloadError);
  });

  it('JSON bulk payloadはD1の2MB上限に達する前にfail-fastする', () => {
    expect(() => d1JsonPayload(['x'.repeat(D1_JSON_BIND_SAFE_BYTES)])).toThrowError(
      expect.objectContaining({ code: 'bulk_payload_too_large' }),
    );
  });
});
