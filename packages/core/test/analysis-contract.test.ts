/**
 * 集計・診断の契約テスト。
 * 金額・名称はすべてテスト内で生成した架空値で、外部データには依存しない。
 */
import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type MfTx,
  applyClassification,
  catProfile,
  diagnosis,
  emptyDataset,
  overview,
  subscriptions,
  suggestBudgets,
} from '../src/index.js';

function syntheticDataset(): Dataset {
  const previousMonths = Array.from(
    { length: 12 },
    (_, index) => `2025-${String(index + 1).padStart(2, '0')}`,
  );
  const months = [...previousMonths, '2026-01', '2026-02'];
  const fixed = [...previousMonths.map(() => 10000), 12000, 12000];
  const variable = [...previousMonths.map(() => 5000), 6000, 6000];

  return {
    ...emptyDataset(),
    months,
    biz: {
      revenue: [...previousMonths.map(() => 100000), 120000, 120000],
      categories: ['架空固定費', '架空変動費'],
      expense: { 架空固定費: fixed, 架空変動費: variable },
    },
    subs: {
      vendors: ['架空SaaS'],
      matrix: { 架空SaaS: fixed },
      other: months.map(() => 0),
    },
    budgets: { 架空固定費: 12000, 架空変動費: 6000 },
  };
}

describe('年間比較の比率契約', () => {
  it('1を100%として前年比と累積構成比を返す', () => {
    const result = overview(syntheticDataset());

    expect(result.yearTotals.prevActual).toBe(180000);
    expect(result.yearTotals.currAnnualized).toBe(216000);
    expect(result.yearTotals.delta).toBeCloseTo(0.2);
    expect(result.yearTable.every((row) => Math.abs(row.delta - 0.2) < 1e-10)).toBe(true);
    expect(result.pareto.at(-1)?.cumShare).toBeCloseTo(1);
    expect(result.top2Share).toBeCloseTo(1);
  });

  it('サブスク年間比較も同じ比率契約を使う', () => {
    const result = subscriptions(syntheticDataset());
    expect(result.vendorTable).toHaveLength(1);
    expect(result.vendorTable[0].delta).toBeCloseTo(0.2);
  });
});

describe('分類と診断', () => {
  const transactions: MfTx[] = [
    { id: 'biz-in', m: '2026-02', d: '02/01', c: '架空事業 売上', a: 100000, big: '', mid: '' },
    { id: 'biz-out', m: '2026-02', d: '02/02', c: '架空事業 経費', a: -10000, big: '', mid: '' },
    { id: 'personal', m: '2026-02', d: '02/03', c: '架空店舗', a: -30000, big: '生活費', mid: '' },
  ];

  it('手動判定、ルール、既定の順で公私を分類する', () => {
    const rules = [{ k: '架空事業', cls: 'biz' as const }];
    const result = applyClassification(transactions, rules, {});

    expect(result.bizPersonal['2026-02']).toEqual({ income: 100000, expense: 10000 });
    expect(result.personal['2026-02'].expense).toEqual({ 生活費: 30000 });

    const overridden = applyClassification(transactions, rules, { 'biz-in': 'per' });
    expect(overridden.bizPersonal['2026-02'].income).toBe(0);
  });

  it('安定した系列を固定費として扱い、予算を千円単位で提案する', () => {
    const data = syntheticDataset();
    expect(catProfile(data, '架空固定費').type).toBe('固定費');
    expect(diagnosis(data).entries).toHaveLength(2);
    expect(Object.values(suggestBudgets(data)).every((value) => value % 1000 === 0)).toBe(true);
  });
});
