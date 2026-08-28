import { describe, expect, it } from 'vitest';
import { type Dataset, budgetOutlook, emptyDataset } from '../src/index.js';

/** 予算の年間・着地見込み(月次予算の積み上げが年間でどこへ着地するか) */

/** 当年 2026 の月を n ヶ月ぶん持つ、経費1科目だけのデータセット */
function yearData(series: number[], budget: number | null, unrecorded: string[] = []): Dataset {
  const months = series.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  const data = emptyDataset();
  data.months = months;
  data.biz = { revenue: months.map(() => 0), categories: ['広告宣伝費'], expense: { 広告宣伝費: series } };
  if (budget != null) data.budgets = { 広告宣伝費: budget };
  data.unrecordedExpMonths = unrecorded;
  return data;
}

describe('予算の年間・着地見込み', () => {
  it('年間予算は月次予算の12倍、着地は実績累計 + 直近3ヶ月平均 × 残り月数', () => {
    // 6ヶ月ぶん 各10,000 → 実績累計 60,000 / 直近3ヶ月平均 10,000 / 残り6ヶ月
    const o = budgetOutlook(yearData(Array(6).fill(10000), 10000));
    expect(o.year).toBe('2026');
    expect(o.recordedMonths).toBe(6);
    expect(o.remainingMonths).toBe(6);
    const row = o.rows[0];
    expect(row.annualBudget).toBe(120000);
    expect(row.ytd).toBe(60000);
    expect(row.landing).toBe(120000);
    expect(row.diff).toBe(0);
    expect(row.judge).toBe('範囲内');
  });

  it('見込みは年平均ではなく直近3ヶ月平均で伸ばす(年の途中の水準変化を反映する)', () => {
    // 前半は 0、後半3ヶ月で 30,000 に上がった → 年平均 15,000 ではなく 30,000 で伸ばす
    const o = budgetOutlook(yearData([0, 0, 0, 30000, 30000, 30000], 10000));
    const row = o.rows[0];
    expect(row.recentAvg).toBe(30000);
    expect(row.ytd).toBe(90000);
    // 90,000 + 30,000 × 6 = 270,000
    expect(row.landing).toBe(270000);
    expect(row.judge).toBe('超過');
  });

  it('未記帳月は実績にも記帳済み月数にも数えない', () => {
    const o = budgetOutlook(yearData([10000, 10000, 10000, 10000], 10000, ['2026-04']));
    expect(o.recordedMonths).toBe(3);
    expect(o.remainingMonths).toBe(9);
    expect(o.rows[0].ytd).toBe(30000);
  });

  it('予算未設定の科目は判定を持たず、合計にも含めない', () => {
    const o = budgetOutlook(yearData(Array(6).fill(10000), null));
    expect(o.rows[0].annualBudget).toBeNull();
    expect(o.rows[0].diff).toBeNull();
    expect(o.rows[0].judge).toBeNull();
    expect(o.totals).toEqual({ annualBudget: 0, ytd: 0, landing: 0, diff: 0 });
  });

  it('合計は予算のある科目だけを足し、着地と年間予算の差を返す', () => {
    const data = yearData(Array(6).fill(10000), 10000);
    // 予算のない科目を足しても合計は動かない
    data.biz.categories.push('雑費');
    data.biz.expense['雑費'] = Array(6).fill(50000);
    const o = budgetOutlook(data);
    expect(o.rows).toHaveLength(2);
    expect(o.totals.annualBudget).toBe(120000);
    expect(o.totals.landing).toBe(120000);
    expect(o.totals.diff).toBe(0);
  });

  it('12ヶ月すべて記帳済みなら残りは0で、着地は実績累計そのもの', () => {
    const o = budgetOutlook(yearData(Array(12).fill(10000), 10000));
    expect(o.remainingMonths).toBe(0);
    expect(o.rows[0].landing).toBe(120000);
    expect(o.rows[0].ytd).toBe(120000);
  });

  it('データが無くても落ちない', () => {
    const o = budgetOutlook(emptyDataset());
    expect(o.rows).toEqual([]);
    expect(o.totals.diff).toBe(0);
  });
});
