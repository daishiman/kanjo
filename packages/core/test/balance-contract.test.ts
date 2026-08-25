import { describe, expect, it } from 'vitest';
import { type Dataset, benchmarks, emptyDataset, household, subscriptions } from '../src/index.js';

/** 架空データ。個人の財布(MF)2ヶ月 + 事業帳簿(freee)3ヶ月 */
function dataset(): Dataset {
  const months = ['2026-05', '2026-06', '2026-07'];
  return {
    ...emptyDataset(),
    months,
    biz: {
      revenue: [500000, 500000, 500000],
      categories: ['架空固定費', '架空サブスク'],
      expense: { 架空固定費: [100000, 100000, 100000], 架空サブスク: [30000, 30000, 30000] },
    },
    subs: { vendors: ['架空SaaS'], matrix: { 架空SaaS: [30000, 30000, 30000] }, other: [0, 0, 0] },
    personal: {
      '2026-06': { income: { 給与: 300000 }, expense: { 食費: 60000, 通信費: 10000, 住宅: 130000 } },
      '2026-07': {
        income: { 給与: 300000 },
        expense: { 食費: 40000, 通信費: 10000, 住宅: 130000, 未分類: 25000 },
      },
    },
    bizPersonal: {
      '2026-06': { income: 100000, expense: 20000 },
      '2026-07': { income: 100000, expense: 0 },
    },
    unrecordedExpMonths: ['2026-05'],
  };
}

describe('収支バランス(家計)の計算契約', () => {
  it('月別: 収入=個人収入+事業入金、支出=生活費+事業立替、収支と貯蓄率', () => {
    const h = household(dataset());
    expect(h.balance.map((b) => b.month)).toEqual(['2026-06', '2026-07']);
    const jun = h.balance[0];
    expect(jun.income).toBe(400000);
    expect(jun.livingCost).toBe(200000);
    expect(jun.expense).toBe(220000);
    expect(jun.balance).toBe(180000);
    expect(jun.saveRate).toBeCloseTo(0.45);
    expect(jun.revenue).toBe(500000);
    expect(jun.bizExpense).toBe(130000);
  });
  it('freeeに無い月・未記帳月の事業経費は null(0と区別する)', () => {
    const d = dataset();
    d.personal['2026-05'] = { income: {}, expense: { 食費: 1000 } };
    const h = household(d);
    expect(h.balance[0].month).toBe('2026-05');
    expect(h.balance[0].bizExpense).toBeNull();
    expect(h.balance[0].revenue).toBe(500000);
    expect(h.balance[0].saveRate).toBeNull();
  });
  it('合計・月平均・年換算は取込月数で割る', () => {
    const t = household(dataset()).totals;
    expect(t.months).toBe(2);
    expect(t.income).toBe(800000);
    expect(t.livingCost).toBe(405000);
    expect(t.bizAdvance).toBe(20000);
    expect(t.balance).toBe(375000);
    expect(t.monthlyAvg.livingCost).toBe(202500);
    expect(t.annualized.livingCost).toBe(2430000);
    expect(t.saveRate).toBeCloseTo(0.46875);
  });
  it('生活費の大項目別は全期間合計の大きい順で構成比を持つ', () => {
    const rows = household(dataset()).livingCost;
    expect(rows[0]).toMatchObject({ big: '住宅', total: 260000, monthlyAvg: 130000, annualized: 1560000 });
    expect(rows[0].share).toBeCloseTo(260000 / 405000);
    expect(rows.map((r) => r.big)).toEqual(['住宅', '食費', '未分類', '通信費']);
  });
  it('個人データが無ければ空の合計を返す(ゼロ除算しない)', () => {
    const h = household({ ...emptyDataset() });
    expect(h.balance).toEqual([]);
    expect(h.totals.months).toBe(0);
    expect(h.totals.saveRate).toBeNull();
    expect(h.livingCost).toEqual([]);
  });
});

describe('サブスクの現況(いま何にいくら)', () => {
  it('直近月合計・年換算・直近12ヶ月合計・対売上比', () => {
    const s = subscriptions(dataset());
    expect(s.now.month).toBe('2026-07');
    expect(s.now.monthlyTotal).toBe(30000);
    expect(s.now.annualized).toBe(360000);
    expect(s.now.last12Total).toBe(60000);
    expect(s.now.revenueShare).toBeCloseTo(0.06);
    expect(s.vendorTable[0]).toMatchObject({
      lastMonthly: 30000,
      avgMonthly: 30000,
      last12Total: 60000,
      activeMonths: 3,
    });
  });
  it('データが無ければ null / 0 で返す', () => {
    const s = subscriptions(emptyDataset());
    expect(s.now).toEqual({
      month: null,
      monthlyTotal: 0,
      annualized: 0,
      last12Total: 0,
      revenueShare: null,
    });
  });
});

describe('ベンチマーク(参考実装と同じ式)', () => {
  it('6指標を返し、目安との判定を持つ', () => {
    const b = benchmarks(dataset());
    const by = Object.fromEntries(b.map((x) => [x.id, x]));
    expect(b).toHaveLength(6);
    expect(by.expenseRatio.value).toBeCloseTo(0.26);
    expect(by.expenseRatio.judge).toBe('目安内');
    expect(by.subsShare.value).toBeCloseTo(0.06);
    expect(by.saveRate.value).toBeCloseTo(0.46875);
    expect(by.foodShare.value).toBeCloseTo(100000 / 405000);
    expect(by.foodShare.judge).toBe('目安外');
    expect(by.telecomShare.value).toBeCloseTo(20000 / 405000);
    expect(by.telecomShare.judge).toBe('目安内');
  });
  it('データが無ければ全指標がデータ不足', () => {
    expect(benchmarks(emptyDataset()).every((x) => x.judge === 'データ不足' && x.value === null)).toBe(true);
  });
});
