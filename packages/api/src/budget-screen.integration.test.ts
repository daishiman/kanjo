/**
 * 予算画面 (spec-budget-screen) の API/D1 結合テスト。
 * GET /budget-screen・GET /budget-plans・PUT /budget-plans を実 D1 で確かめる。
 * 保存行の読取り元の切替え (legacy→saved)、KPI と行・月別・見通しの一致、防衛ラインとの一致、
 * 入力の上限 (400)、期間の置換えと他の期間の保全、利用者の分離、json:global の無効化、
 * 書出し→復元の往復と旧バックアップの扱い (BR-24)、既存の読み手が年額 ÷ 12 を読むこと (BR-23)。
 * 実データは使わず、専用のインメモリ D1 と架空の集計だけで検証する。
 *
 * 集計: 2024-09..2026-08 の各月に 事業売上 1,000,000 / 仕入高 400,000 / 地代家賃 100,000
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let cookie: string;

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(Date.UTC(2024, 8 + i, 1));
  return d.toISOString().slice(0, 7);
});

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  sessionCookie: string | null = cookie,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (sessionCookie) headers.cookie = sessionCookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return app.request(
    `/api${path}`,
    {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    },
    { ...auth, DB: d1 },
  );
}

async function seedAggregates(userId = 'default'): Promise<void> {
  const agg = (month: string, scope: string, amount: number) =>
    d1
      .prepare('INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES (?, ?, ?, ?)')
      .bind(userId, month, scope, amount);
  const stmts: D1PreparedStatement[] = [];
  for (const month of MONTHS) {
    stmts.push(agg(month, 'biz_rev', 1_000_000));
    stmts.push(agg(month, 'biz_exp:仕入高', 400_000));
    stmts.push(agg(month, 'biz_exp:地代家賃', 100_000));
  }
  await d1.batch(stmts);
}

const planRows = async (userId = 'default') =>
  (
    await d1
      .prepare(
        'SELECT period_start, account, kind, annual_amount, plan_adjustment, plan_reason FROM budget_plans WHERE user_id = ? ORDER BY period_start, account',
      )
      .bind(userId)
      .all<{
        period_start: string;
        account: string;
        kind: string;
        annual_amount: number;
        plan_adjustment: number;
        plan_reason: string | null;
      }>()
  ).results;

const legacyRows = async () =>
  (
    await d1
      .prepare("SELECT account, monthly_amount FROM budgets WHERE user_id = 'default' ORDER BY account")
      .all()
  ).results;

const VALID_ROWS = [
  { account: '売上高', kind: 'income', annualAmount: 13_200_000 },
  {
    account: '仕入高',
    kind: 'expense',
    annualAmount: 4_800_000,
    planAdjustment: 120_000,
    planReason: '値上げ',
  },
  { account: '地代家賃', kind: 'expense', annualAmount: 1_200_000 },
];

const putPlans = (body: unknown, sessionCookie: string | null = cookie) =>
  request('/budget-plans', 'PUT', body, sessionCookie);

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'budget-screen-test',
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
  cookie = await loginForTest(app, { ...auth, DB: d1 });
  await seedAggregates();
});

afterAll(async () => {
  await mf?.dispose();
});

interface ScreenBody {
  empty: boolean;
  start: string | null;
  targetMonths: string[];
  source: 'saved' | 'legacy' | 'none';
  savedAt: string | null;
  revision: string | null;
  defenseLine: { monthly: number; annual: number };
  rows: Array<{ account: string; kind: string; manualOnly: boolean; prevActual: number; saved: unknown }>;
  figures: {
    rows: Array<{ account: string; budget: number | null }>;
    kpi: { incomeBudget: number; expenseBudget: number; net: number; defenseMargin: number };
    monthly: Array<{ incomeBudget: number; expenseBudget: number }>;
    outlook: { income: number; expense: number; net: number };
  };
  period: { applied: unknown; full: { from: string; to: string } | null };
}

const screen = async (query = '') => {
  const res = await request(`/budget-screen${query}`);
  expect(res.status, await res.clone().text()).toBe(200);
  return (await res.json()) as ScreenBody;
};

describe('GET /budget-screen', () => {
  it('既存 budgets だけなら legacy、保存すると saved に切り替わる', async () => {
    await d1
      .prepare("INSERT INTO budgets (user_id, account, monthly_amount) VALUES ('default', '地代家賃', 90000)")
      .run();
    const before = await screen();
    expect(before.start).toBe('2026-09');
    expect(before.source).toBe('legacy');
    expect(before.rows.find((r) => r.account === '地代家賃')?.saved).toEqual({
      annualAmount: 1_080_000,
      planAdjustment: 0,
      planReason: null,
    });

    expect((await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS })).status).toBe(200);
    const after = await screen();
    expect(after.source).toBe('saved');
    expect(after.savedAt).not.toBeNull();
    expect(after.revision).toBe(after.savedAt);
    expect(after.rows.find((r) => r.account === '地代家賃')?.saved).toMatchObject({
      annualAmount: 1_200_000,
    });
  });

  it('KPI は行の和・月別の和・見通しと一致し、余裕は防衛ラインと一致する', async () => {
    await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    const body = await screen();
    const { kpi, rows, monthly } = body.figures;
    const kindOf = new Map(body.rows.map((r) => [r.account, r.kind]));
    const sum = (kind: string) =>
      rows.filter((r) => kindOf.get(r.account) === kind).reduce((a, r) => a + (r.budget ?? 0), 0);
    expect(kpi.incomeBudget).toBe(sum('income'));
    expect(kpi.expenseBudget).toBe(sum('expense'));
    expect(kpi.net).toBe(kpi.incomeBudget - kpi.expenseBudget);
    expect(monthly.reduce((a, m) => a + m.incomeBudget, 0)).toBe(kpi.incomeBudget);
    expect(monthly.reduce((a, m) => a + m.expenseBudget, 0)).toBe(kpi.expenseBudget);
    expect(body.figures.outlook.net).toBe(body.figures.outlook.income - body.figures.outlook.expense);

    const defense = (await (await request('/defense-line')).json()) as { line: number };
    expect(body.defenseLine.monthly).toBe(defense.line);
    expect(kpi.defenseMargin).toBe(kpi.incomeBudget - body.defenseLine.annual);
  });

  it('売上高とその他収入の行を出し、その他収入は手入力だけ', async () => {
    const body = await screen();
    expect(body.rows.slice(0, 2).map((r) => [r.account, r.kind, r.manualOnly])).toEqual([
      ['売上高', 'income', false],
      ['その他収入', 'income', true],
    ]);
    expect(body.rows.find((r) => r.account === '売上高')?.prevActual).toBe(12_000_000);
  });

  it('実績期間を変えると前年実績 (年換算) が変わる', async () => {
    // 1 年目 (2024-09..2025-08) の仕入高だけを月 300,000 に下げる
    await d1
      .prepare(
        "UPDATE monthly_agg SET amount = 300000 WHERE user_id = 'default' AND scope = 'biz_exp:仕入高' AND month < '2025-09'",
      )
      .run();
    const prev = (b: ScreenBody) => b.rows.find((r) => r.account === '仕入高')?.prevActual;
    expect(prev(await screen('?span=1'))).toBe(4_800_000);
    expect(prev(await screen('?span=2'))).toBe(4_200_000);
  });

  it('開始月が不正なら 400、未ログインは 401', async () => {
    expect((await request('/budget-screen?start=2026-13')).status).toBe(400);
    expect((await request('/budget-screen?start=1999-12')).status).toBe(400);
    expect((await request('/budget-screen', 'GET', undefined, null)).status).toBe(401);
  });

  it('実績が無ければ empty=true', async () => {
    await d1.prepare("DELETE FROM monthly_agg WHERE user_id = 'default'").run();
    const body = await screen();
    expect(body.empty).toBe(true);
    expect(body.rows).toEqual([]);
  });
});

describe('PUT /budget-plans', () => {
  it('baseSavedAt は null を含めて必須', async () => {
    const res = await putPlans({ start: '2026-09', rows: VALID_ROWS });
    expect(res.status).toBe(400);
    expect(await planRows()).toEqual([]);
  });

  it('baseSavedAt を使って dirty 行だけを更新し、null 金額の行だけを削除する', async () => {
    const created = await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    expect(created.status, await created.clone().text()).toBe(200);
    const first = (await created.json()) as { savedAt: string; revision: string };
    expect(first.revision).toBe(first.savedAt);

    const patched = await putPlans({
      start: '2026-09',
      baseSavedAt: first.revision,
      rows: [
        { account: '仕入高', kind: 'expense', annualAmount: 5_000_000 },
        { account: '地代家賃', kind: 'expense', annualAmount: null },
      ],
    });
    expect(patched.status, await patched.clone().text()).toBe(200);
    const second = (await patched.json()) as { savedAt: string; revision: string };
    expect(second.revision).toBe(second.savedAt);
    expect(second.revision).not.toBe(first.revision);
    expect((await planRows()).map(({ account, annual_amount }) => [account, annual_amount])).toEqual([
      ['仕入高', 5_000_000],
      ['売上高', 13_200_000],
    ]);
  });

  it('古い baseSavedAt は 409 にし、勝者と未編集行を保持する', async () => {
    const initial = await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    const { revision: baseSavedAt } = (await initial.json()) as { revision: string };
    const winner = await putPlans({
      start: '2026-09',
      baseSavedAt,
      rows: [{ account: '仕入高', kind: 'expense', annualAmount: 5_000_000 }],
    });
    expect(winner.status).toBe(200);

    const stale = await putPlans({
      start: '2026-09',
      baseSavedAt,
      rows: [{ account: '地代家賃', kind: 'expense', annualAmount: 9_999_999 }],
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: 'budget_plan_conflict' } });
    expect((await planRows()).map(({ account, annual_amount }) => [account, annual_amount])).toEqual([
      ['仕入高', 5_000_000],
      ['地代家賃', 1_200_000],
      ['売上高', 13_200_000],
    ]);
  });

  it('同じrevisionからの同時保存は一方だけを反映する', async () => {
    const initial = await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    const { revision: baseSavedAt } = (await initial.json()) as { revision: string };
    const requests = [5_100_000, 5_200_000].map((annualAmount) =>
      putPlans({
        start: '2026-09',
        baseSavedAt,
        rows: [{ account: '仕入高', kind: 'expense', annualAmount }],
      }),
    );
    const responses = await Promise.all(requests);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const saved = await planRows();
    expect([5_100_000, 5_200_000]).toContain(
      saved.find(({ account }) => account === '仕入高')?.annual_amount,
    );
    expect(saved.map(({ account, annual_amount }) => [account, annual_amount]).slice(1)).toEqual([
      ['地代家賃', 1_200_000],
      ['売上高', 13_200_000],
    ]);
  });

  it('最後の行を削除するとrevisionはnullへ戻り、旧revisionを拒否してnullからの同時作成を直列化する', async () => {
    const created = await putPlans({
      start: '2026-09',
      baseSavedAt: null,
      rows: [{ account: '仕入高', kind: 'expense', annualAmount: 1 }],
    });
    const { revision: oldRevision } = (await created.json()) as { revision: string };
    const removed = await putPlans({
      start: '2026-09',
      baseSavedAt: oldRevision,
      rows: [{ account: '仕入高', kind: 'expense', annualAmount: null }],
    });
    expect(await removed.json()).toMatchObject({ savedAt: null, revision: null });
    expect(await planRows()).toEqual([]);

    const stale = await putPlans({
      start: '2026-09',
      baseSavedAt: oldRevision,
      rows: [{ account: '地代家賃', kind: 'expense', annualAmount: 2 }],
    });
    expect(stale.status).toBe(409);

    const competing = [3, 4].map((annualAmount) =>
      putPlans({
        start: '2026-09',
        baseSavedAt: null,
        rows: [{ account: '地代家賃', kind: 'expense', annualAmount }],
      }),
    );
    expect((await Promise.all(competing)).map(({ status }) => status).sort()).toEqual([200, 409]);
    expect((await planRows()).map(({ account, annual_amount }) => [account, annual_amount])).toEqual([
      ['地代家賃', expect.any(Number)],
    ]);
  });

  it('同じ期間の dirty 行だけを置き換え、他の行・期間・既存 budgets には触らない', async () => {
    await d1
      .prepare("INSERT INTO budgets (user_id, account, monthly_amount) VALUES ('default', '地代家賃', 90000)")
      .run();
    await putPlans({
      start: '2025-09',
      baseSavedAt: null,
      rows: [{ account: '地代家賃', kind: 'expense', annualAmount: 1_000_000 }],
    });
    const res = await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; start: string; count: number; savedAt: string };
    expect(body).toMatchObject({ ok: true, start: '2026-09', count: 3 });

    await putPlans({
      start: '2026-09',
      baseSavedAt: body.savedAt,
      rows: [{ account: '仕入高', kind: 'expense', annualAmount: 5_000_000 }],
    });
    expect(await planRows()).toEqual([
      {
        period_start: '2025-09',
        account: '地代家賃',
        kind: 'expense',
        annual_amount: 1_000_000,
        plan_adjustment: 0,
        plan_reason: null,
      },
      {
        period_start: '2026-09',
        account: '仕入高',
        kind: 'expense',
        annual_amount: 5_000_000,
        plan_adjustment: 0,
        plan_reason: null,
      },
      {
        period_start: '2026-09',
        account: '地代家賃',
        kind: 'expense',
        annual_amount: 1_200_000,
        plan_adjustment: 0,
        plan_reason: null,
      },
      {
        period_start: '2026-09',
        account: '売上高',
        kind: 'income',
        annual_amount: 13_200_000,
        plan_adjustment: 0,
        plan_reason: null,
      },
    ]);
    expect(await legacyRows()).toEqual([{ account: '地代家賃', monthly_amount: 90000 }]);
  });

  it('理由は前後の空白を除き、空は null で保存する', async () => {
    await putPlans({
      start: '2026-09',
      baseSavedAt: null,
      rows: [
        { account: '仕入高', kind: 'expense', annualAmount: 1, planReason: '  値上げ  ' },
        { account: '地代家賃', kind: 'expense', annualAmount: 1, planReason: '   ' },
      ],
    });
    expect((await planRows()).map((r) => r.plan_reason)).toEqual(['値上げ', null]);
  });

  it.each([
    [
      '201 行',
      {
        rows: Array.from({ length: 201 }, (_, i) => ({
          account: `科目${i}`,
          kind: 'expense',
          annualAmount: 1,
        })),
      },
    ],
    ['0 行', { rows: [] }],
    ['61 字の科目', { rows: [{ account: 'あ'.repeat(61), kind: 'expense', annualAmount: 1 }] }],
    [
      '101 字の理由',
      { rows: [{ account: '仕入高', kind: 'expense', annualAmount: 1, planReason: 'あ'.repeat(101) }] },
    ],
    ['上限超の金額', { rows: [{ account: '仕入高', kind: 'expense', annualAmount: 10_000_000_001 }] }],
    ['小数', { rows: [{ account: '仕入高', kind: 'expense', annualAmount: 1.5 }] }],
    ['範囲外の開始月', { start: '2101-01' }],
    [
      '科目の重複',
      {
        rows: [
          { account: '仕入高', kind: 'expense', annualAmount: 1 },
          { account: '仕入高', kind: 'expense', annualAmount: 2 },
        ],
      },
    ],
    ['売上高を expense', { rows: [{ account: '売上高', kind: 'expense', annualAmount: 1 }] }],
    ['知らないキー', { rows: [{ account: '仕入高', kind: 'expense', annualAmount: 1, extra: 1 }] }],
  ])('%s は 400 で、何も書かない', async (_label, patch) => {
    const res = await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS, ...patch });
    expect(res.status).toBe(400);
    expect(await planRows()).toEqual([]);
  });

  it('上限いっぱい (200 行・60 字の科目・100 字の理由) を 1 回の batch で保存する (Q-7)', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      account: `${String(i).padStart(3, '0')}${'あ'.repeat(57)}`,
      kind: 'expense',
      annualAmount: -10_000_000_000,
      planAdjustment: 10_000_000_000,
      planReason: 'い'.repeat(100),
    }));
    expect((await putPlans({ start: '2026-09', baseSavedAt: null, rows })).status).toBe(200);
    const saved = await planRows();
    expect(saved).toHaveLength(200);
    expect(saved.every((r) => r.plan_reason === 'い'.repeat(100))).toBe(true);
  });

  it('未ログインは 401', async () => {
    expect((await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS }, null)).status).toBe(
      401,
    );
  });

  it('他の利用者の行は読まず、書き換えない', async () => {
    const insertForeign = d1.prepare(
      "INSERT INTO budget_plans (user_id, period_start, account, kind, annual_amount, updated_at) VALUES ('other-user', '2026-09', ?, 'expense', 7, '2026-01-01T00:00:00Z')",
    );
    await d1.batch([insertForeign.bind('仕入高'), insertForeign.bind('広告宣伝費')]);
    const view = await request('/budget-plans?start=2026-09');
    expect(await view.json()).toMatchObject({ source: 'none', rows: [] });
    expect((await screen()).source).toBe('none');

    expect((await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS })).status).toBe(200);
    expect((await planRows()).map((r) => r.annual_amount)).toEqual([4_800_000, 1_200_000, 13_200_000]);
    expect((await planRows('other-user')).map((r) => [r.account, r.annual_amount])).toEqual([
      ['仕入高', 7],
      ['広告宣伝費', 7],
    ]);
  });

  it('保存すると json:global の snapshot を無効化する', async () => {
    await d1
      .prepare(
        "INSERT INTO import_active_targets (user_id, target_key, content_hash, import_id, updated_at) VALUES ('default', 'json:global', 'h', 1, '2026-01-01T00:00:00Z')",
      )
      .run();
    await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    const left = await d1
      .prepare(
        "SELECT count(*) AS n FROM import_active_targets WHERE user_id = 'default' AND target_key = 'json:global'",
      )
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});

describe('GET /budget-plans', () => {
  it('start は必須、保存が無ければ既存 budgets の月額 × 12 を返す', async () => {
    expect((await request('/budget-plans')).status).toBe(400);
    await d1
      .prepare("INSERT INTO budgets (user_id, account, monthly_amount) VALUES ('default', '地代家賃', 90000)")
      .run();
    const res = await request('/budget-plans?start=2026-09');
    expect(await res.json()).toEqual({
      start: '2026-09',
      source: 'legacy',
      savedAt: null,
      revision: null,
      rows: [
        {
          account: '地代家賃',
          kind: 'expense',
          annualAmount: 1_080_000,
          planAdjustment: 0,
          planReason: null,
          updatedAt: null,
        },
      ],
    });
  });
});

describe('既存の読み手 (BR-23) と JSON の往復 (BR-24)', () => {
  it('予算表は今月を含む期間の年額 ÷ 12 を読む', async () => {
    await d1
      .prepare("INSERT INTO budgets (user_id, account, monthly_amount) VALUES ('default', '地代家賃', 90000)")
      .run();
    const asOf = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
    await putPlans({
      start: asOf,
      baseSavedAt: null,
      rows: [{ account: '地代家賃', kind: 'expense', annualAmount: 1_200_000 }],
    });
    const res = await request('/budgets');
    const body = (await res.json()) as { table: Array<{ account: string; budget: number | null }> };
    expect(body.table.find((r) => r.account === '地代家賃')?.budget).toBe(100_000);
  });

  it('書き出した budgetPlans を復元で戻す。鍵の無い旧バックアップは budget_plans を消す', async () => {
    await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    const exported = (await (await request('/export/json')).json()) as Record<string, unknown>;
    expect((exported.budgetPlans as unknown[]).length).toBe(3);

    await d1.prepare("DELETE FROM budget_plans WHERE user_id = 'default'").run();
    const restored = await request('/restore', 'POST', exported);
    expect(restored.status, await restored.clone().text()).toBe(200);
    expect((await planRows()).map((r) => [r.account, r.annual_amount, r.plan_reason])).toEqual([
      ['仕入高', 4_800_000, '値上げ'],
      ['地代家賃', 1_200_000, null],
      ['売上高', 13_200_000, null],
    ]);

    const { budgetPlans: _dropped, ...legacy } = exported;
    expect((await request('/restore', 'POST', legacy)).status).toBe(200);
    expect(await planRows()).toEqual([]);
  });

  it('形の不正な budgetPlans は 400 で、既存の行を残す', async () => {
    await putPlans({ start: '2026-09', baseSavedAt: null, rows: VALID_ROWS });
    const exported = (await (await request('/export/json')).json()) as Record<string, unknown>;
    const res = await request('/restore', 'POST', { ...exported, budgetPlans: [{ periodStart: '2026-13' }] });
    expect(res.status).toBe(400);
    expect((await planRows()).length).toBe(3);
  });
});
