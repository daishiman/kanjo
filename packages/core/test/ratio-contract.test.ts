import { describe, expect, it } from 'vitest';
import { budgetTable, emptyDataset, overview } from '../src/index.js';
import type { Dataset } from '../src/index.js';

function expenseDataset(amount: number, budget = 100): Dataset {
  const data = emptyDataset();
  data.months = ['2026-01', '2026-02', '2026-03'];
  data.biz.categories = ['テスト科目'];
  data.biz.revenue = [0, 0, 0];
  data.biz.expense = { テスト科目: [amount, amount, amount] };
  data.budgets = { テスト科目: budget };
  return data;
}

describe('比率契約', () => {
  it('累積構成比を1=100%の小数で返す', () => {
    const data = emptyDataset();
    data.months = ['2026-01'];
    data.biz.categories = ['A', 'B'];
    data.biz.revenue = [0];
    data.biz.expense = { A: [60], B: [40] };

    expect(overview(data).pareto.map((row) => row.cumShare)).toEqual([0.6, 1]);
  });

  it('年間増減率を1=100%の小数で返す', () => {
    const data = emptyDataset();
    data.months = ['2025-01', '2026-01'];
    data.biz.categories = ['A'];
    data.biz.revenue = [0, 0];
    data.biz.expense = { A: [100, 10] };

    const result = overview(data);
    expect(result.yearTable[0].delta).toBeCloseTo(0.2);
    expect(result.yearTotals.delta).toBeCloseTo(0.2);
  });

  it.each([
    [5, -0.4],
    [30, 2.6],
  ] as const)('年間増減率は負値と100%%超を許容する', (currentMonthly, expected) => {
    const data = emptyDataset();
    data.months = ['2025-01', '2026-01'];
    data.biz.categories = ['A'];
    data.biz.revenue = [0, 0];
    data.biz.expense = { A: [100, currentMonthly] };

    expect(overview(data).yearTable[0].delta).toBeCloseTo(expected);
  });
});

describe('予算±10%判定', () => {
  it.each([
    [110, '範囲内'],
    [111, '超過'],
    [90, '範囲内'],
    [89, '余裕'],
  ] as const)('実績%sは%s', (actual, expected) => {
    expect(budgetTable(expenseDataset(actual))[0].judge).toBe(expected);
  });
});
