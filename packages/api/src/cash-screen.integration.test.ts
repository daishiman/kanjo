/**
 * 現金入力画面の API/D1 結合テスト (spec-cash-screen、受入 S2・S4)。
 *
 * 画面の作り直しで足した論理削除・戻し・一括の経路と、削除中の行を読まない条件を
 * 経路ごとに1件ずつ固定する。読取経路の条件を1つ外すと、その経路のテストだけが落ちる
 * (docs/cash-screen/design-decisions.md §7 P04 の検算記録)。
 *
 * 既存の cash-lifecycle.test.ts(集計の作り直し)と transit-lifecycle.test.ts(交通費)は
 * そのまま緑に保ち、ここでは同じことを繰り返さない。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASH_LIMITS } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { cashPurgeLogLine, runCashSoftDeletePurge } from './cash-purge.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';
import { getDb, loadDataset, loadImportRestoreSettingsSnapshot, recomputeFromDeals } from './store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};
const ME = 'default';
const OTHER = 'synthetic-other-user';
const DAY_MS = 24 * 60 * 60 * 1000;

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;

type Entry = { id: number; owner: string | null; transitPurpose: string | null };

async function applyMigrations(database: D1Database): Promise<void> {
  const migrationNames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of migrationNames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, migrationNames);
}

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  database: D1Database = d1,
): Promise<Response> {
  return app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...auth, DB: database, FILES: files },
  );
}

/** native D1 はそのまま使い、prepare された SQL だけを観測する。 */
function observePreparedStatements(database: D1Database, observe: (query: string) => void): D1Database {
  return new Proxy(database, {
    get(target, property) {
      if (property === 'prepare')
        return (query: string) => {
          observe(query);
          return target.prepare(query);
        };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const input = (patch: Record<string, unknown> = {}) => ({
  date: '2026-07-10',
  side: 'biz',
  owner: 'business',
  io: 'expense',
  amount: 1200,
  description: '架空の会議費',
  big: '架空会議費',
  mid: '',
  memo: null,
  ...patch,
});

async function create(patch: Record<string, unknown> = {}): Promise<Entry> {
  const res = await request('/cash-entries', 'POST', input(patch));
  expect(res.status).toBe(201);
  return ((await res.json()) as { entry: Entry }).entry;
}

async function listIds(query = ''): Promise<number[]> {
  const res = await request(`/cash-entries${query}`);
  expect(res.status).toBe(200);
  return ((await res.json()) as { entries: Entry[] }).entries.map((e) => e.id);
}

async function deletedAt(id: number): Promise<string | null | undefined> {
  const row = await d1.prepare('SELECT deleted_at FROM cash_entries WHERE id = ?').bind(id).first<{
    deleted_at: string | null;
  }>();
  return row === null ? undefined : row.deleted_at;
}

async function aggregate(month: string, scope: string): Promise<number | null> {
  const row = await d1
    .prepare('SELECT amount FROM monthly_agg WHERE user_id = ? AND month = ? AND scope = ?')
    .bind(ME, month, scope)
    .first<{ amount: number }>();
  return row?.amount ?? null;
}

async function atomicState(): Promise<{
  cash: Array<{ id: number; amount: number }>;
  aggregate: Array<{ month: string; scope: string; amount: number }>;
}> {
  const [cash, aggregateRows] = await Promise.all([
    d1
      .prepare('SELECT id, amount FROM cash_entries WHERE user_id = ? ORDER BY id')
      .bind(ME)
      .all<{ id: number; amount: number }>(),
    d1
      .prepare('SELECT month, scope, amount FROM monthly_agg WHERE user_id = ? ORDER BY month, scope')
      .bind(ME)
      .all<{ month: string; scope: string; amount: number }>(),
  ]);
  return { cash: cash.results, aggregate: aggregateRows.results };
}

/** normalized update の事前検証で再集計計画を失敗させる。 */
async function injectRecomputePlanFailure(): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO freee_deals
       (id,user_id,month,date,io,account_raw,account_norm,amount)
       VALUES (-1,?,'2026-07','2026-07-01','expense','架空会議費','壊れた正規化値',100)`,
    )
    .bind(ME)
    .run();
}

/** 他の利用者の明細を1件、API を通さずに置く */
async function seedOther(deleted = false): Promise<number> {
  const now = new Date().toISOString();
  const row = await d1
    .prepare(
      `INSERT INTO cash_entries
       (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at,owner,deleted_at)
       VALUES (?,'2026-07-11','2026-07','biz','expense',777,'架空の他人の明細','架空会議費','',NULL,?,?,'business',?)
       RETURNING id`,
    )
    .bind(OTHER, now, now, deleted ? now : null)
    .first<{ id: number }>();
  return row!.id;
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'cash-screen-integration-test',
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
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  expect(cookie).not.toBe('');
  expect((await request('/category-options', 'POST', { scope: 'biz', major: '架空会議費' })).status).toBe(
    201,
  );
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('現金明細と派生集計の atomicity', () => {
  it.each(['POST', 'PUT'] as const)(
    '%s: 再集計計画の事前検証が失敗したら明細と集計をどちらも変えない',
    async (method) => {
      const entry = method === 'PUT' ? await create() : undefined;
      await injectRecomputePlanFailure();
      const before = await atomicState();
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const res =
          method === 'POST'
            ? await request('/cash-entries', 'POST', input({ amount: 900 }))
            : await request(`/cash-entries/${entry!.id}`, 'PUT', input({ amount: 900 }));
        expect(res.status).toBe(500);
        expect(await atomicState()).toEqual(before);
      } finally {
        log.mockRestore();
      }
    },
  );

  it.each(['POST', 'PUT'] as const)(
    '%s: 確定batchの集計INSERTが失敗したら先行した明細変更もrollbackする',
    async (method) => {
      const entry = method === 'PUT' ? await create() : undefined;
      const before = await atomicState();
      await d1
        .prepare(
          `CREATE TRIGGER cash_atomicity_failure
           BEFORE INSERT ON monthly_agg
           BEGIN SELECT RAISE(ABORT, 'injected_cash_atomicity_failure'); END`,
        )
        .run();
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const res =
          method === 'POST'
            ? await request('/cash-entries', 'POST', input({ amount: 900 }))
            : await request(`/cash-entries/${entry!.id}`, 'PUT', input({ amount: 900 }));
        expect(res.status).toBe(500);
        expect(await atomicState()).toEqual(before);
      } finally {
        log.mockRestore();
        await d1.prepare('DROP TRIGGER IF EXISTS cash_atomicity_failure').run();
      }
    },
  );
});

describe('GET /cash-entries の現金 snapshot', () => {
  it('応答とdatasetに同じcash SELECT 1回の結果を使う', async () => {
    const entry = await create();
    const statements: string[] = [];
    const observed = observePreparedStatements(d1, (query) => statements.push(query));
    const res = await request('/cash-entries', 'GET', undefined, observed);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ entries: [{ id: entry.id }] });
    const cashSelects = statements.filter(
      (query) => /^\s*select\b/i.test(query) && /\bfrom\s+["`]?cash_entries["`]?\b/i.test(query),
    );
    expect(cashSelects).toHaveLength(1);
  });
});

describe('DELETE は論理削除になり、restore で同じ id が戻る', () => {
  it('削除で一覧と集計から消え、手動の仕分けは残り、戻すと同じ id と集計が戻る', async () => {
    const entry = await create({ owner: 'spouse' });
    await d1
      .prepare(
        "INSERT INTO tx_edits (user_id, tx_id, cls, updated_at) VALUES (?, ?, 'biz', '2026-07-12T00:00:00Z')",
      )
      .bind(ME, `cash:${entry.id}`)
      .run();
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(1200);

    const del = await request(`/cash-entries/${entry.id}`, 'DELETE');
    expect(del.status).toBe(200);
    const body = (await del.json()) as { ok: boolean; id: number; deletedAt: string };
    expect(body).toMatchObject({ ok: true, id: entry.id });
    expect(await deletedAt(entry.id)).toBe(body.deletedAt);
    expect(await listIds()).toEqual([]);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBeNull();
    expect(
      await d1.prepare('SELECT COUNT(*) AS n FROM tx_edits WHERE tx_id = ?').bind(`cash:${entry.id}`).first(),
    ).toEqual({ n: 1 });

    const restored = await request(`/cash-entries/${entry.id}/restore`, 'POST');
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({ entry: { id: entry.id, owner: 'spouse' } });
    expect(await deletedAt(entry.id)).toBeNull();
    expect(await listIds()).toEqual([entry.id]);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(1200);
  });

  it('restore は冪等で、削除中でない行には何も書かず今の行を返す', async () => {
    const entry = await create();
    const before = await d1
      .prepare('SELECT updated_at FROM cash_entries WHERE id = ?')
      .bind(entry.id)
      .first();
    const again = await request(`/cash-entries/${entry.id}/restore`, 'POST');
    expect(again.status).toBe(200);
    await expect(again.json()).resolves.toMatchObject({ entry: { id: entry.id } });
    expect(
      await d1.prepare('SELECT updated_at FROM cash_entries WHERE id = ?').bind(entry.id).first(),
    ).toEqual(before);
  });

  it('無い行・完全消去済みの行の restore と、2度目の DELETE は 404', async () => {
    expect((await request('/cash-entries/999999/restore', 'POST')).status).toBe(404);
    const entry = await create();
    expect((await request(`/cash-entries/${entry.id}`, 'DELETE')).status).toBe(200);
    const second = await request(`/cash-entries/${entry.id}`, 'DELETE');
    expect(second.status).toBe(404);
    await expect(second.json()).resolves.toEqual({
      error: { code: 'not_found', message: '記帳が見つかりません' },
    });
  });
});

describe('bulk-delete した 3 件が bulk-restore で戻る', () => {
  it('3 件に同じ deleted_at を入れ、まとめて同じ id で戻す', async () => {
    const ids = [
      (await create({ amount: 100 })).id,
      (await create({ amount: 200 })).id,
      (await create({ amount: 300 })).id,
    ];
    const keep = (await create({ amount: 400 })).id;
    const del = await request('/cash-entries/bulk-delete', 'POST', { ids });
    expect(del.status).toBe(200);
    const { deletedAt: at } = (await del.json()) as { deletedAt: string };
    expect(await Promise.all(ids.map(deletedAt))).toEqual([at, at, at]);
    expect(await listIds()).toEqual([keep]);
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(400);

    const back = await request('/cash-entries/bulk-restore', 'POST', { ids });
    expect(back.status).toBe(200);
    const { entries } = (await back.json()) as { entries: Entry[] };
    expect(entries.map((e) => e.id)).toEqual(ids);
    expect((await listIds()).sort((a, b) => a - b)).toEqual([...ids, keep].sort((a, b) => a - b));
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(1000);

    // 2度目は何も書かない(冪等)
    expect((await request('/cash-entries/bulk-restore', 'POST', { ids })).status).toBe(200);
  });

  it('bulk-delete は削除中の id を 1 件でも含めば 404 で、何も変えない', async () => {
    const a = (await create()).id;
    const b = (await create()).id;
    expect((await request(`/cash-entries/${b}`, 'DELETE')).status).toBe(200);
    const before = await deletedAt(b);
    expect((await request('/cash-entries/bulk-delete', 'POST', { ids: [a, b] })).status).toBe(404);
    expect(await deletedAt(a)).toBeNull();
    expect(await deletedAt(b)).toBe(before);
  });
});

describe('他の利用者の明細', () => {
  it('GET / PUT / DELETE / restore / bulk-delete / bulk-restore の 6 経路で存在しないものとして扱う', async () => {
    const other = await seedOther();
    const otherDeleted = await seedOther(true);
    const mine = await create();

    expect(await listIds()).toEqual([mine.id]);
    expect((await request(`/cash-entries/${other}`, 'PUT', input())).status).toBe(404);
    expect((await request(`/cash-entries/${other}`, 'DELETE')).status).toBe(404);
    expect((await request(`/cash-entries/${otherDeleted}/restore`, 'POST')).status).toBe(404);
    expect((await request('/cash-entries/bulk-delete', 'POST', { ids: [other] })).status).toBe(404);
    expect((await request('/cash-entries/bulk-restore', 'POST', { ids: [otherDeleted] })).status).toBe(404);

    // 他人の行は1文字も動かない
    expect(
      await d1
        .prepare(
          'SELECT id, amount, deleted_at IS NULL AS live FROM cash_entries WHERE user_id = ? ORDER BY id',
        )
        .bind(OTHER)
        .all(),
    ).toMatchObject({
      results: [
        { id: other, amount: 777, live: 1 },
        { id: otherDeleted, amount: 777, live: 0 },
      ],
    });
  });

  it('bulk-delete に他の利用者の id を 1 件混ぜると 404 で、自分の行も変わらない', async () => {
    const mine = [(await create()).id, (await create()).id];
    const other = await seedOther();
    expect((await request('/cash-entries/bulk-delete', 'POST', { ids: [...mine, other] })).status).toBe(404);
    expect(await Promise.all(mine.map(deletedAt))).toEqual([null, null]);
    expect(await deletedAt(other)).toBeNull();
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(2400);
  });

  it('bulk-restore に他の利用者の id を 1 件混ぜると 404 で、自分の削除中の行も戻らない', async () => {
    const mine = [(await create()).id, (await create()).id];
    expect((await request('/cash-entries/bulk-delete', 'POST', { ids: mine })).status).toBe(200);
    const at = await deletedAt(mine[0]!);
    const other = await seedOther(true);
    expect((await request('/cash-entries/bulk-restore', 'POST', { ids: [...mine, other] })).status).toBe(404);
    expect(await Promise.all(mine.map(deletedAt))).toEqual([at, at]);
    expect(await listIds()).toEqual([]);
  });
});

describe('不正な入力は 400', () => {
  it.each([
    ['実在しない日付', { date: '2026-02-30' }],
    ['0 円', { amount: 0 }],
    ['上限を超える金額', { amount: CASH_LIMITS.amountMax + 1 }],
    ['小数の金額', { amount: 10.5 }],
    ['候補外の担当者', { owner: 'wife' }],
    ['担当者が null', { owner: null }],
    ['長すぎる内容', { description: 'あ'.repeat(CASH_LIMITS.descriptionMax + 1) }],
    ['長すぎるメモ', { memo: 'あ'.repeat(CASH_LIMITS.memoMax + 1) }],
    ['候補外の業務の目的', { transitFrom: '架空駅A', transitTo: '架空駅B', transitPurpose: '観光' }],
    ['区間の片方だけ', { transitFrom: '架空駅A', transitPurpose: '客先訪問' }],
    ['交通費でない証憑不要', { receiptWaived: true }],
  ])('%s は invalid_input で、行を作らない', async (_label, patch) => {
    const res = await request('/cash-entries', 'POST', input(patch));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'invalid_input' } });
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM cash_entries').first()).toEqual({ n: 0 });
  });

  it('候補外のカテゴリは invalid_category', async () => {
    const res = await request('/cash-entries', 'POST', input({ big: '架空の未登録科目' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: { code: 'invalid_category' } });
  });

  it('候補外の担当者は「担当者を選んでください」を返す', async () => {
    const res = await request('/cash-entries', 'POST', input({ owner: 'wife' }));
    await expect(res.json()).resolves.toEqual({
      error: { code: 'invalid_input', message: '担当者を選んでください' },
    });
  });

  it('PUT も同じ規則で 400 にし、行を変えない', async () => {
    const entry = await create();
    expect((await request(`/cash-entries/${entry.id}`, 'PUT', input({ amount: -1 }))).status).toBe(400);
    expect(await d1.prepare('SELECT amount FROM cash_entries WHERE id = ?').bind(entry.id).first()).toEqual({
      amount: 1200,
    });
  });

  it.each([
    ['空', []],
    ['重複', [1, 1]],
    ['数でない', ['1']],
    ['上限超え', Array.from({ length: CASH_LIMITS.bulkMax + 1 }, (_, i) => i + 1)],
  ])('一括の id が%sなら 400', async (_label, ids) => {
    for (const path of ['/cash-entries/bulk-delete', '/cash-entries/bulk-restore']) {
      const res = await request(path, 'POST', { ids });
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: { code: 'invalid_input' } });
    }
  });

  it.each(['?from=2026-07', '?to=2026-07', '?from=2026-13&to=2026-14', '?from=2026-08&to=2026-07'])(
    '期間 %s は 400',
    async (query) => {
      const res = await request(`/cash-entries${query}`);
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: { code: 'invalid_input', message: '期間は YYYY-MM で指定してください' },
      });
    },
  );

  it('期間を渡せば月で切り、省けば全期間を返す', async () => {
    const july = await create();
    const aug = await create({ date: '2026-08-01' });
    expect(await listIds('?from=2026-08&to=2026-08')).toEqual([aug.id]);
    expect(await listIds()).toEqual([aug.id, july.id]);
  });
});

describe('0052 より前の SPA の本文(担当者・業務の目的を持たない)を通す互換', () => {
  const stored = async (id: number) =>
    d1.prepare('SELECT owner, transit_purpose FROM cash_entries WHERE id = ?').bind(id).first();
  const transit = { transitFrom: '架空駅A', transitTo: '架空駅B' };

  it('POST: 担当者が無ければ 201 で NULL(画面では「未設定」)に入れる', async () => {
    const entry = await create({ owner: undefined });
    expect(await stored(entry.id)).toEqual({ owner: null, transit_purpose: null });
  });

  it('POST: 業務の目的が無い交通費も 201 で、目的は NULL', async () => {
    const entry = await create(transit);
    expect(await stored(entry.id)).toEqual({ owner: 'business', transit_purpose: null });
  });

  it('PUT: 送らなかった担当者と業務の目的は今の値を保つ', async () => {
    const entry = await create({ ...transit, owner: 'spouse', transitPurpose: '客先訪問' });
    const res = await request(
      `/cash-entries/${entry.id}`,
      'PUT',
      input({ ...transit, owner: undefined, amount: 900 }),
    );
    expect(res.status).toBe(200);
    expect(await stored(entry.id)).toEqual({ owner: 'spouse', transit_purpose: '客先訪問' });
  });

  it('PUT: 区間を消せば業務の目的も消える(交通費でなくなった行に目的を残さない)', async () => {
    const entry = await create({ ...transit, transitPurpose: '客先訪問' });
    const res = await request(`/cash-entries/${entry.id}`, 'PUT', input({ owner: undefined }));
    expect(res.status).toBe(200);
    expect(await stored(entry.id)).toEqual({ owner: 'business', transit_purpose: null });
  });
});

describe('削除中の行を読まない条件', () => {
  /** 事業と個人の明細を1件ずつ作り、個人側に手動の仕分けを付けてから、両方を削除する */
  async function deletedPair(): Promise<{ biz: number; per: number }> {
    expect((await request('/category-options', 'POST', { scope: 'per', major: '架空食費' })).status).toBe(
      201,
    );
    const biz = (await create()).id;
    const per = (await create({ side: 'per', big: '架空食費', owner: 'family', amount: 800 })).id;
    await d1
      .prepare(
        "INSERT INTO tx_edits (user_id, tx_id, cls, note, updated_at) VALUES (?, ?, 'per', '架空の仕分け', '2026-07-12T00:00:00Z')",
      )
      .bind(ME, `cash:${per}`)
      .run();
    expect((await request('/cash-entries/bulk-delete', 'POST', { ids: [biz, per] })).status).toBe(200);
    return { biz, per };
  }

  it('一覧: GET /cash-entries に出ない', async () => {
    const live = (await create({ amount: 50 })).id;
    await deletedPair();
    expect(await listIds()).toEqual([live]);
  });

  it('合計と集計: 削除のあとの別の書き込みで monthly_agg を作り直しても数えない', async () => {
    await deletedPair();
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBeNull();
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBeNull();
    // 追加は loadCashEntries から作り直す (削除の経路は自前で除くので、ここで初めて条件が効く)
    await create({ amount: 50 });
    expect(await aggregate('2026-07', 'biz_exp:架空会議費')).toBe(50);
    await recomputeFromDeals(getDb(d1), ME);
    expect(await aggregate('2026-07', 'per_exp:架空食費')).toBeNull();
  });

  it('取引: loadDataset の明細(cash:<id>)に出ない', async () => {
    const { per } = await deletedPair();
    const data = await loadDataset(getDb(d1), ME);
    expect(data.mfTx.map((t) => t.id)).not.toContain(`cash:${per}`);
  });

  it('バックアップ: /export/json の現金明細と、それを指す手動の仕分けに出ない', async () => {
    const live = (await create({ amount: 50 })).id;
    const { biz, per } = await deletedPair();
    const res = await request('/export/json');
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      cashEntries: Entry[];
      edits: Record<string, unknown>;
    };
    expect(payload.cashEntries.map((e) => e.id)).toEqual([live]);
    expect(Object.keys(payload.edits)).not.toContain(`cash:${per}`);
    expect(JSON.stringify(payload)).not.toContain('架空の仕分け');
    expect(payload.cashEntries.map((e) => e.id)).not.toContain(biz);
  });

  it('取込時の設定スナップショット: 中身は外し、件数だけ削除中を含めて数える', async () => {
    const live = (await create({ amount: 50 })).id;
    await deletedPair();
    const snapshot = await loadImportRestoreSettingsSnapshot(getDb(d1), ME);
    expect(snapshot.cashEntries.map((e) => e.id)).toEqual([live]);
    expect(snapshot.destinationRowCounts.cashEntries).toBe(3);
  });

  it('科目使用状況: 削除中の明細はカテゴリの使用数に入らず、候補の削除を止めない', async () => {
    await deletedPair();
    const res = await request('/classification');
    const { categoryOptions } = (await res.json()) as {
      categoryOptions: Array<{ major: string; uses: { cashEntries: number } }>;
    };
    expect(categoryOptions.find((o) => o.major === '架空会議費')?.uses.cashEntries).toBe(0);
    expect(categoryOptions.find((o) => o.major === '架空食費')?.uses.cashEntries).toBe(0);
    expect(
      (await request('/category-options', 'DELETE', { scope: 'biz', major: '架空会議費', mid: '' })).status,
    ).toBe(200);
  });

  it('PUT: 削除中の行は編集できず 404 で、編集で復活もしない', async () => {
    const { biz } = await deletedPair();
    const res = await request(`/cash-entries/${biz}`, 'PUT', input({ amount: 9999 }));
    expect(res.status).toBe(404);
    expect(
      await d1
        .prepare('SELECT amount, deleted_at IS NOT NULL AS gone FROM cash_entries WHERE id = ?')
        .bind(biz)
        .first(),
    ).toEqual({ amount: 1200, gone: 1 });
  });
});

describe('夜間の完全消去', () => {
  const NOW = '2026-09-22T03:00:00.000Z';
  const ago = (days: number, extraMs = 0) =>
    new Date(Date.parse(NOW) - days * DAY_MS - extraMs).toISOString();

  async function seedDeleted(at: string, userId = ME): Promise<number> {
    const row = await d1
      .prepare(
        `INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at,deleted_at)
         VALUES (?,'2026-07-10','2026-07','per','expense',100,'架空の消去対象','架空食費','',NULL,?,?,?)
         RETURNING id`,
      )
      .bind(userId, at, at, at)
      .first<{ id: number }>();
    await d1
      .prepare("INSERT INTO tx_edits (user_id, tx_id, cls, updated_at) VALUES (?, ?, 'per', ?)")
      .bind(userId, `cash:${row!.id}`, at)
      .run();
    return row!.id;
  }

  it('29 日前は残し、31 日前は消し、ちょうど 30 日前は残す。消す行の手動の仕分けも一緒に消す', async () => {
    const d29 = await seedDeleted(ago(29));
    const d30 = await seedDeleted(ago(30));
    const d31 = await seedDeleted(ago(31));
    const live = await create();

    const result = await runCashSoftDeletePurge({ DB: d1 }, NOW);
    expect(result).toEqual({ deleted: 1, edits: 1, limitReached: false });
    expect(cashPurgeLogLine(result)).toMatchObject({ level: 'info', deleted: 1 });
    const ids = (
      await d1.prepare('SELECT id FROM cash_entries ORDER BY id').all<{ id: number }>()
    ).results.map((r) => r.id);
    expect(ids).toEqual([d29, d30, live.id]);
    expect(await d1.prepare('SELECT tx_id FROM tx_edits ORDER BY tx_id').all()).toMatchObject({
      results: [{ tx_id: `cash:${d29}` }, { tx_id: `cash:${d30}` }],
    });
    expect(ids).not.toContain(d31);
  });

  it('501 件なら 1 晩目は古い順に 500 件で止めて warn を出し、2 晩目に残りの 1 件を消す', async () => {
    const t = ago(40);
    await d1
      .prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 501)
         INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at,deleted_at)
         SELECT ?, '2026-07-10','2026-07','per','expense',100,'架空の消去対象','架空食費','',NULL,?,?,
                strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || i || ' seconds')
           FROM n`,
      )
      .bind(ME, t, t, t)
      .run();
    const newest = await d1
      .prepare('SELECT id FROM cash_entries ORDER BY deleted_at DESC, id DESC LIMIT 1')
      .first<{ id: number }>();

    const first = await runCashSoftDeletePurge({ DB: d1 }, NOW);
    expect(first).toEqual({ deleted: CASH_LIMITS.purgeBatch, edits: 0, limitReached: true });
    expect(cashPurgeLogLine(first)).toEqual({
      level: 'warn',
      job: 'cash_soft_delete_purge',
      event: 'cash_soft_delete_purge',
      deleted: 500,
      limitReached: true,
      remainingMayExist: true,
    });
    expect(await d1.prepare('SELECT id FROM cash_entries').all()).toMatchObject({
      results: [{ id: newest!.id }],
    });

    const second = await runCashSoftDeletePurge({ DB: d1 }, NOW);
    expect(second).toEqual({ deleted: 1, edits: 0, limitReached: false });
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM cash_entries').first()).toEqual({ n: 0 });
  }, 30_000);

  it('ちょうど500件では残件がなくても、追加queryを使わず上限到達の可能性warnとして扱う', async () => {
    const t = ago(40);
    await d1
      .prepare(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 500)
         INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at,deleted_at)
         SELECT ?, '2026-07-10','2026-07','per','expense',100,'架空の消去対象','架空食費','',NULL,?,?,
                strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+' || i || ' seconds')
           FROM n`,
      )
      .bind(ME, t, t, t)
      .run();

    const result = await runCashSoftDeletePurge({ DB: d1 }, NOW);
    expect(result).toEqual({ deleted: CASH_LIMITS.purgeBatch, edits: 0, limitReached: true });
    expect(cashPurgeLogLine(result)).toMatchObject({
      level: 'warn',
      limitReached: true,
      remainingMayExist: true,
    });
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM cash_entries').first()).toEqual({ n: 0 });
  }, 30_000);

  it('他の利用者の同じ tx_id の手動の仕分けは消さない', async () => {
    const mine = await seedDeleted(ago(31));
    // 同じ文字列の tx_id を持つ別の利用者の仕分け(明細は有効)
    await d1
      .prepare("INSERT INTO tx_edits (user_id, tx_id, cls, updated_at) VALUES (?, ?, 'per', ?)")
      .bind(OTHER, `cash:${mine}`, NOW)
      .run();
    expect(await runCashSoftDeletePurge({ DB: d1 }, NOW)).toEqual({
      deleted: 1,
      edits: 1,
      limitReached: false,
    });
    expect(await d1.prepare('SELECT user_id FROM tx_edits').all()).toMatchObject({
      results: [{ user_id: OTHER }],
    });
  });

  it('上限の範囲外は例外にし、何も消さない', async () => {
    await seedDeleted(ago(31));
    for (const limit of [0, CASH_LIMITS.purgeBatch + 1, 1.5])
      await expect(runCashSoftDeletePurge({ DB: d1 }, NOW, limit)).rejects.toThrow(
        'invalid_cash_purge_limit',
      );
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM cash_entries').first()).toEqual({ n: 1 });
  });
});
