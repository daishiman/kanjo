import { GUIDE_TERM_CURRENT } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary.js';
import { buildGuideSections } from './guide-sections.js';

describe('用語と目安の行', () => {
  it('APIデータが無くても全用語を一度ずつ表示できる', () => {
    const rows = buildGuideSections().flatMap((section) => section.rows);
    expect(rows.map((row) => row.id).sort()).toEqual(Object.keys(GLOSSARY).sort());
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(rows.every((row) => row.now.length > 0 && row.bench.length > 0)).toBe(true);
  });

  it('core の現在値の正本が用語集の全用語を持ち、該当なしを取得不能と区別する', () => {
    expect(Object.keys(GUIDE_TERM_CURRENT).sort()).toEqual(Object.keys(GLOSSARY).sort());
    const rows = buildGuideSections().flatMap((section) => section.rows);
    expect(
      rows.filter((row) => row.currentKind === 'not_applicable').every((row) => row.now === '該当なし'),
    ).toBe(true);
    expect(rows.filter((row) => row.currentKind === 'metric').some((row) => row.now === '—')).toBe(true);
  });

  it('取得できた数値は円・% の書式で出し、年換算の目安は前年実績から組む', () => {
    const rows = buildGuideSections(
      {
        defense: { status: 'ok', line: 250000 },
        overview: {
          kpi: { currYearAnnualized: 3600000, prevYearExpense: 3000000 },
          top2Share: 0.42,
          unrecordedExpMonths: [],
        },
      } as never,
      {
        bep: { breakEven: 1200000, safetyMargin: 0.3 },
        kpi: { expenseRatio: 0.6, expenseCv: 0.25, expenseMedian: 180000, fixedCost: 90000 },
      } as never,
    ).flatMap((section) => section.rows);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId.defenseLine.now).toBe('¥250,000');
    expect(byId.expenseRatio.now).toBe('+60%');
    expect(byId.profitMargin.now).toBe('おおよそ +40%(決算書ページが正)');
    expect(byId.pareto.now).toBe('上位2科目で42%');
    expect(byId.unrecordedMonth.now).toBe('なし');
    expect(byId.annualized.bench).toBe('前年実績¥3,000,000との比較で増減を判断');
  });
});
