/**
 * 決算書画面 (SYS-STATEMENTS) の API/D1 結合テスト。
 * GET /statements の screen と、負債入力 PUT /balances/liabilities の 200/400/401/409/413、
 * 部分保存 (送らなかった項目と他の月に触らない)、監査 1 行 (金額を残さない)、基準月の丸めを実 D1 で確かめる。
 * 実データは使わず、専用のインメモリ D1 と架空の集計だけで検証する。
 *
 * 集計: 2026-01..2026-08 の各月に 事業売上 1,000,000 / 仕入高 400,000 / 地代家賃 100,000
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIABILITY_AMOUNT_MAX } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
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

const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
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

const putLiabilities = (lines: unknown[], month = '2026-08') =>
  request('/balances/liabilities', 'PUT', { month, lines });

const liabilityRows = async () =>
  (
    await d1
      .prepare(
        "SELECT month, category, amount, status, source FROM balance_entries WHERE user_id = 'default' AND side = 'liability' ORDER BY month, category",
      )
      .all<{ month: string; category: string; amount: number; status: string; source: string }>()
  ).results;

const auditRows = async () =>
  (
    await d1
      .prepare('SELECT user_id, actor_user_id, month, changed_json FROM liability_audit_log ORDER BY id')
      .all<{ user_id: string; actor_user_id: string; month: string; changed_json: string }>()
  ).results;

async function seedAggregates(): Promise<void> {
  const stmts: D1PreparedStatement[] = [];
  const agg = (month: string, scope: string, amount: number) =>
    d1
      .prepare('INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES (?, ?, ?, ?)')
      .bind('default', month, scope, amount);
  for (const month of MONTHS) {
    stmts.push(agg(month, 'biz_rev', 1_000_000));
    stmts.push(agg(month, 'biz_exp:仕入高', 400_000));
    stmts.push(agg(month, 'biz_exp:地代家賃', 100_000));
  }
  await d1.batch(stmts);
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'statements-screen-test',
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
  screen: {
    period: {
      from: string;
      to: string;
      label: string;
      navigation: {
        applied: { from: string; to: string } | null;
        full: { from: string; to: string } | null;
        years: string[];
        monthCount: number;
      };
    };
    pl: {
      rows: Array<{
        key: string;
        current: number;
        accounts: Array<{ account: string; current: number; ratio: number | null }>;
      }>;
    };
    cf:
      | { status: 'available'; cumulative: number[]; limits: string[] }
      | { status: 'unavailable'; limits: string[] };
    bs: {
      referenceMonth: string;
      asOf: string;
      partial: boolean;
      complete: boolean;
      liabilityTotal: number | null;
      lines: Array<{ category: string; status: string; amount: number | null }>;
      liabilities: Array<{ category: string; amount: number }> | null;
      sources: Array<{ name: string }>;
    };
    kpis: { liabilities: { value: number | null; incomplete: boolean } };
  };
}

describe('GET /statements', () => {
  it('screen だけを返し、画面の表示値と期間遷移をその中に閉じる', async () => {
    const res = await request('/statements');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ScreenBody;
    expect(Object.keys(body)).toEqual(['screen']);
    expect(body.screen.period).toMatchObject({
      from: '2026-01',
      to: '2026-08',
      label: '2026年1月 - 2026年8月',
      navigation: {
        applied: null,
        full: { from: '2026-01', to: '2026-08' },
        years: ['2026'],
        monthCount: 8,
      },
    });
    const pl = Object.fromEntries(body.screen.pl.rows.map((r) => [r.key, r.current]));
    expect(pl).toEqual({
      sales: 8_000_000,
      cogs: 3_200_000,
      gross: 4_800_000,
      sga: 800_000,
      operating: 4_000_000,
    });
    const cogs = body.screen.pl.rows.find((row) => row.key === 'cogs');
    expect(cogs?.accounts[0]).toMatchObject({ account: '仕入高', ratio: 0.4 });
    expect(body.screen.cf.limits.length).toBeGreaterThan(0);
    expect(body.screen.bs.sources.some((source) => source.name.includes('資産推移'))).toBe(true);
  });

  it('BS は基準月の asOf / partial / 図用負債値を screen だけで返す', async () => {
    const now = new Date().toISOString();
    await d1
      .prepare(
        "INSERT INTO balance_entries (user_id, month, date, side, category, amount, source, created_at, updated_at) VALUES ('default', '2026-08', '2026-08-28', 'asset', '預金・現金', 5000000, 'mf', ?, ?)",
      )
      .bind(now, now)
      .run();
    await putLiabilities([
      { category: '借入金', status: 'amount', amount: 2_000_000 },
      { category: '未払金・買掛金', status: 'amount', amount: 300_000 },
      { category: 'クレジットカード未払金', status: 'zero' },
    ]);
    const { screen } = (await (await request('/statements')).json()) as ScreenBody;
    expect(screen.bs).toMatchObject({
      asOf: '2026-08-28',
      partial: true,
      complete: true,
      liabilityTotal: 2_300_000,
      liabilities: [
        { category: '借入金', amount: 2_000_000 },
        { category: '未払金・買掛金', amount: 300_000 },
        { category: 'クレジットカード未払金', amount: 0 },
      ],
    });
  });

  it('基準月は期間内だけを受け、期間外・不正は期間の最終月に丸める', async () => {
    const ref = async (q: string) =>
      ((await (await request(`/statements${q}`)).json()) as ScreenBody).screen.bs.referenceMonth;
    expect(await ref('?ref=2026-03')).toBe('2026-03');
    expect(await ref('?ref=2025-12')).toBe('2026-08');
    expect(await ref('?ref=2026-13')).toBe('2026-08');
    expect(await ref('?ref=abc')).toBe('2026-08');
  });

  it('必須の負債が未入力の月は、負債合計を 0 と見せずに null で返す', async () => {
    await putLiabilities([{ category: 'クレジットカード未払金', status: 'amount', amount: 30_000 }]);
    const { screen } = (await (await request('/statements')).json()) as ScreenBody;
    expect(screen.bs.complete).toBe(false);
    expect(screen.bs.liabilityTotal).toBeNull();
    expect(screen.kpis.liabilities.value).toBeNull();
    expect(screen.kpis.liabilities.incomplete).toBe(true);
  });

  it('未ログインは 401', async () => {
    expect((await request('/statements', 'GET', undefined, null)).status).toBe(401);
  });
});

describe('PUT /balances/liabilities', () => {
  const ALL_ZERO_BUT_CARD = [
    { category: 'クレジットカード未払金', status: 'amount', amount: 120_000 },
    { category: '借入金', status: 'zero' },
    { category: '未払金・買掛金', status: 'zero' },
  ];

  it('保存すると、その月の BS を core と同じ形で返す', async () => {
    const res = await putLiabilities(ALL_ZERO_BUT_CARD);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; bs: ScreenBody['screen']['bs'] };
    expect(body.ok).toBe(true);
    expect(body.bs.referenceMonth).toBe('2026-08');
    expect(body.bs.complete).toBe(true);
    expect(body.bs.liabilityTotal).toBe(120_000);
    expect(body.bs.lines.map((l) => [l.category, l.status, l.amount])).toEqual([
      // 並びは仕様の STATEMENTS_LIABILITY_LINES の順 (送った順ではない)
      ['借入金', 'zero', 0],
      ['未払金・買掛金', 'zero', 0],
      ['クレジットカード未払金', 'amount', 120_000],
      ['その他の負債', 'unset', null],
    ]);
  });

  it('送らなかった項目と他の月には触らない', async () => {
    await putLiabilities([{ category: '借入金', status: 'amount', amount: 2_000_000 }], '2026-07');
    await putLiabilities(ALL_ZERO_BUT_CARD);
    await putLiabilities([{ category: 'クレジットカード未払金', status: 'amount', amount: 90_000 }]);
    expect((await liabilityRows()).map((r) => [r.month, r.category, r.amount, r.status])).toEqual([
      ['2026-07', '借入金', 2_000_000, 'amount'],
      ['2026-08', 'クレジットカード未払金', 90_000, 'amount'],
      ['2026-08', '借入金', 0, 'zero'],
      ['2026-08', '未払金・買掛金', 0, 'zero'],
    ]);
  });

  it('金額 0 を「金額あり」で送っても 0円 として保存する', async () => {
    await putLiabilities([{ category: '借入金', status: 'amount', amount: 0 }]);
    expect((await liabilityRows()).map((r) => [r.category, r.amount, r.status])).toEqual([
      ['借入金', 0, 'zero'],
    ]);
  });

  it('1 回の保存につき監査を 1 行だけ書き、金額は残さない', async () => {
    await putLiabilities(ALL_ZERO_BUT_CARD);
    await putLiabilities([{ category: 'クレジットカード未払金', status: 'unset' }]);
    const rows = await auditRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ user_id: 'default', month: '2026-08' });
    expect(rows[0].actor_user_id).toBeTruthy();
    expect(JSON.parse(rows[0].changed_json)).toEqual({
      lines: { クレジットカード未払金: 'unset→amount', 借入金: 'unset→zero', 未払金・買掛金: 'unset→zero' },
      count: 3,
    });
    expect(JSON.parse(rows[1].changed_json)).toEqual({
      lines: { クレジットカード未払金: 'amount→unset' },
      count: 1,
    });
    // 金額はどこにも出てこない
    for (const r of rows) expect(r.changed_json).not.toMatch(/120000|120,000/);
  });

  it.each([
    [
      '同じ項目が 2 回',
      [
        { category: '借入金', status: 'zero' },
        { category: '借入金', status: 'amount', amount: 1 },
      ],
    ],
    ['0円 に金額が付いている', [{ category: '借入金', status: 'zero', amount: 5 }]],
    ['未入力に金額が付いている', [{ category: '借入金', status: 'unset', amount: 5 }]],
    ['金額ありなのに金額が無い', [{ category: '借入金', status: 'amount' }]],
    ['上限 (1 兆円) を超える', [{ category: '借入金', status: 'amount', amount: LIABILITY_AMOUNT_MAX + 1 }]],
    ['負の金額', [{ category: '借入金', status: 'amount', amount: -1 }]],
    ['小数の金額', [{ category: '借入金', status: 'amount', amount: 1.5 }]],
    ['一覧に無い項目', [{ category: '架空の負債', status: 'zero' }]],
    ['状態が無い (旧形式)', [{ category: '借入金', amount: 5 }]],
    ['空の配列', []],
  ])('%s は 400 で、1 行も書かない', async (_label, lines) => {
    const res = await putLiabilities(lines);
    expect(res.status).toBe(400);
    expect(await liabilityRows()).toEqual([]);
    expect(await auditRows()).toEqual([]);
  });

  it('上限ちょうどは受ける', async () => {
    expect(
      (await putLiabilities([{ category: '借入金', status: 'amount', amount: LIABILITY_AMOUNT_MAX }])).status,
    ).toBe(200);
  });

  it('月の形が不正なら 400', async () => {
    expect((await putLiabilities([{ category: '借入金', status: 'zero' }], '2026-8')).status).toBe(400);
  });

  it('未ログインは 401 で、1 行も書かない', async () => {
    const res = await request(
      '/balances/liabilities',
      'PUT',
      { month: '2026-08', lines: [{ category: '借入金', status: 'zero' }] },
      null,
    );
    expect(res.status).toBe(401);
    expect(await liabilityRows()).toEqual([]);
  });

  it('取込で入った負債と同じ項目は 409 で止め、取込の行を上書きしない', async () => {
    await d1
      .prepare(
        "INSERT INTO balance_entries (user_id, month, date, side, category, amount, source, created_at, updated_at) VALUES ('default', '2026-08', '2026-08-31', 'liability', '借入金', 777, 'mf', 'x', 'x')",
      )
      .run();
    const res = await putLiabilities([{ category: '借入金', status: 'amount', amount: 1 }]);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('liability_owned_by_import');
    expect((await liabilityRows()).map((r) => [r.category, r.amount, r.source])).toEqual([
      ['借入金', 777, 'mf'],
    ]);
    expect(await auditRows()).toEqual([]);
  });

  it('8 KiB を超える本文は 413', async () => {
    const res = await request(
      '/balances/liabilities',
      'PUT',
      JSON.stringify({ month: '2026-08', pad: 'x'.repeat(9000) }),
    );
    expect(res.status).toBe(413);
    expect(await liabilityRows()).toEqual([]);
  });
});
