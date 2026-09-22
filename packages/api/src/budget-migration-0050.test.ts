/**
 * 0050_budget_plans.sql: 予算対象の期間別の年額表を足すだけで、既存の budgets を書き換えない。
 * 直前 (0049 まで) の全 migration を当てた D1 に旧 budgets の行を入れてから 0050 を当てて確かめる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const TARGET = '0050_budget_plans.sql';

let mf: Miniflare;
let d1: D1Database;

const apply = async (filename: string) => {
  for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')))
    await d1.prepare(sql).run();
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'budget-plans-0050',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  const earlier = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f < TARGET)
    .sort();
  for (const filename of earlier) await apply(filename);
  await d1
    .prepare(
      "INSERT INTO budgets (user_id, account, monthly_amount) VALUES ('u1', '地代家賃', 90000), ('u1', '仕入高', 400000)",
    )
    .run();
  await apply(TARGET);
}, 60_000);

afterAll(async () => mf?.dispose());

const insertPlan = (overrides: Partial<Record<string, unknown>> = {}) => {
  const row = {
    period_start: '2026-09',
    account: '地代家賃',
    kind: 'expense',
    annual_amount: 1_200_000,
    plan_reason: null,
    ...overrides,
  };
  return d1
    .prepare(
      "INSERT INTO budget_plans (user_id, period_start, account, kind, annual_amount, plan_reason, updated_at) VALUES ('u1', ?, ?, ?, ?, ?, '2026-09-01T00:00:00Z')",
    )
    .bind(row.period_start, row.account, row.kind, row.annual_amount, row.plan_reason)
    .run();
};

describe('0050 budget_plans', () => {
  it('既存の budgets の行を変えない', async () => {
    const rows = await d1
      .prepare('SELECT user_id, account, monthly_amount FROM budgets ORDER BY account')
      .all();
    expect(rows.results).toEqual([
      { user_id: 'u1', account: '仕入高', monthly_amount: 400000 },
      { user_id: 'u1', account: '地代家賃', monthly_amount: 90000 },
    ]);
  });

  it('本文に既存の行を書き換える文を含まない', () => {
    const sql = splitMigrationStatements(readFileSync(resolve(migrationsDir, TARGET), 'utf8')).join('\n');
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER)\b/i);
  });

  it('調整の既定は 0、同じ利用者・期間・科目は 1 行だけ', async () => {
    await insertPlan();
    const row = await d1.prepare("SELECT plan_adjustment FROM budget_plans WHERE user_id = 'u1'").first();
    expect(row).toEqual({ plan_adjustment: 0 });
    await expect(insertPlan()).rejects.toThrow();
    await insertPlan({ period_start: '2027-09' });
  });

  it.each([
    ['開始月の書式', { period_start: '2026-9' }],
    ['空の科目', { account: '' }],
    ['61 字の科目', { account: 'あ'.repeat(61) }],
    ['知らない種別', { kind: 'asset' }],
    ['空の理由', { plan_reason: '' }],
    ['101 字の理由', { plan_reason: 'あ'.repeat(101) }],
  ])('%s は CHECK で拒む', async (_label, overrides) => {
    await expect(insertPlan({ account: '広告宣伝費', ...overrides })).rejects.toThrow();
  });
});
