/**
 * 推移画面の指標登録表と恒等式の契約テスト (SYS-TRENDS-P04)。
 *
 * 実装より先に書く赤いテストである。実装は SYS-TRENDS-P05 が
 * `packages/core/src/trend-metrics.ts` に置く。期待値の正本は `specs/spec-trends-screen.md` の
 * 「ビジネスルールと検証」と `docs/trends-screen/requirements-baseline.md`。
 *
 * ## 置換前に落ちる理由
 *
 * `METRIC_DEFINITIONS` / `findMetric` / `normalizeTrendScope` / `trendsScreen` は置換前に存在しない。
 * 総収支との一致は、置換前の推移が MF の Dataset だけから数えていたため成り立たない。
 */
import { describe, expect, it } from 'vitest';
import * as core from '../src/index.js';
import {
  METRIC_DEFINITIONS,
  type MetricDefinition,
  type TrendCompare,
  type TrendScope,
  findMetric,
  monthlyTotalCashflow,
  normalizeTrendCompare,
  normalizeTrendScope,
  trendsScreen,
} from '../src/index.js';
import { fixture } from './trend-fixture.js';

const { data, deals } = fixture();
const input = (range: { from: string; to: string } | null) => ({
  all: data,
  deals,
  verdicts: [],
  exclusions: [],
  mfExcludedTxIds: [],
  range,
});
const YEAR = { from: '2025-07', to: '2026-06' };
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe('指標の登録表 (FR9)', () => {
  it('指標の意味色・操作順・概要図への掲載を登録表が正本として持つ', () => {
    expect(
      METRIC_DEFINITIONS.map((d) => [
        d.id,
        d.label,
        d.betterWhen,
        d.visualRole,
        d.controlOrder,
        d.showInOverview,
      ]),
    ).toEqual([
      ['income', '収入', 'higher', 'income', 1, true],
      ['expense', '支出', 'lower', 'expense', 0, true],
      ['net', '純収支', 'higher', 'net', 2, true],
    ]);
  });

  it('findMetric は省略時に支出を返し、未登録の id は null (任意のキーを評価しない)', () => {
    expect(findMetric(undefined)?.id).toBe('expense');
    expect(findMetric('')?.id).toBe('expense');
    expect(findMetric('net')?.id).toBe('net');
    expect(findMetric('constructor')).toBeNull();
    expect(findMetric('toString')).toBeNull();
    expect(findMetric('unknown')).toBeNull();
  });

  it('scope は新旧どちらの名前も受け、未知の値は総合へ倒す', () => {
    expect(
      ['total', 'business', 'household', 'all', 'biz', 'personal', 'x', undefined].map(normalizeTrendScope),
    ).toEqual(['total', 'business', 'household', 'total', 'business', 'household', 'total', 'total']);
    expect(['previous', 'yoy', 'x', undefined].map(normalizeTrendCompare)).toEqual([
      'previous',
      'yoy',
      'previous',
      'previous',
    ]);
  });

  it('未登録の metric は例外にする (API が 400 invalid_metric へ変える)', () => {
    expect(() => trendsScreen(input(YEAR), { metric: 'unknown' })).toThrow();
  });

  it('テスト用の指標を 1 件足すと、分岐を書かずに系列と一覧へ現れる', () => {
    const count: MetricDefinition = {
      id: 'count',
      label: '件数',
      betterWhen: 'lower',
      visualRole: 'neutral',
      controlOrder: 3,
      showInOverview: false,
      valueOf: (row) => (row.io === 'expense' ? 1 : 0),
      breakdownAxis: 'category',
    };
    const screen = trendsScreen(input(YEAR), { metric: 'count' }, [...METRIC_DEFINITIONS, count]);
    expect(screen.metrics.map((m) => m.id)).toContain('count');
    expect(screen.selection.metric).toBe('count');
    expect(screen.metrics.find((m) => m.id === 'count')).toMatchObject({
      visualRole: 'neutral',
      controlOrder: 3,
      showInOverview: false,
    });
    expect(screen.series.values.count.current.every((v) => Number.isInteger(v) && v > 0)).toBe(true);
    expect(screen.kpis.current).toBe(sum(screen.series.values.count.current));
  });
});

describe('総収支との一致 (数値の出所)', () => {
  it('事業・家計・総合の月次値が monthlyTotalCashflow の同じ月と一致する', () => {
    const months = monthlyTotalCashflow(
      core.applyPeriod(data, YEAR),
      deals.filter((d) => d.month >= YEAR.from && d.month <= YEAR.to),
    );
    const pick = (scope: TrendScope) => trendsScreen(input(YEAR), { scope }).series;
    const total = pick('total');
    const business = pick('business');
    const household = pick('household');
    expect(total.months).toEqual(months.map((m) => m.month));
    expect(total.values.expense.current).toEqual(months.map((m) => m.totalExpense));
    expect(total.values.income.current).toEqual(months.map((m) => m.totalIncome));
    expect(total.values.net.current).toEqual(months.map((m) => m.totalBalance));
    expect(business.values.expense.current).toEqual(months.map((m) => m.bizExpense));
    expect(business.values.income.current).toEqual(months.map((m) => m.bizIncome));
    expect(household.values.expense.current).toEqual(months.map((m) => m.householdExpense));
    expect(household.values.income.current).toEqual(months.map((m) => m.householdIncome));
  });
});

describe('3 指標 × 3 範囲 × 2 比較対象の恒等式', () => {
  const metrics = ['income', 'expense', 'net'] as const;
  const scopes: TrendScope[] = ['total', 'business', 'household'];
  const compares: TrendCompare[] = ['previous', 'yoy'];
  for (const metric of metrics) {
    for (const scope of scopes) {
      for (const compare of compares) {
        it(`${metric} / ${scope} / ${compare}`, () => {
          const s = trendsScreen(input(YEAR), { metric, scope, compare });
          const cur = s.series.values;
          // 純収支 = 収入 - 支出 (月ごと)
          cur.net.current.forEach((v, i) => expect(v).toBe(cur.income.current[i] - cur.expense.current[i]));
          // 行の和 = 期間合計
          expect(sum(s.categories.map((c) => c.current))).toBe(s.kpis.current);
          expect(s.kpis.current).toBe(sum(cur[metric].current));
          for (const c of s.categories) expect(sum(c.payees.map((p) => p.current))).toBe(c.current);
          // 寄与度の和 = 100%
          if (s.kpis.change.amount) {
            expect(sum(s.categories.map((c) => c.contribution ?? 0))).toBeCloseTo(1, 9);
          }
          // 総合 = 事業 + 家計
          if (scope === 'total') {
            const b = trendsScreen(input(YEAR), { metric, scope: 'business', compare });
            const h = trendsScreen(input(YEAR), { metric, scope: 'household', compare });
            cur[metric].current.forEach((v, i) =>
              expect(v).toBe(b.series.values[metric].current[i] + h.series.values[metric].current[i]),
            );
            const changes = [s.kpis.change.amount, b.kpis.change.amount, h.kpis.change.amount];
            if (changes.some((v) => v === null)) {
              // 比較先の月が一部でも未取込なら、0 に読み替えず全範囲で比較不能にする。
              expect(changes).toEqual([null, null, null]);
            } else {
              expect(changes[0]).toBe((changes[1] as number) + (changes[2] as number));
            }
          }
        });
      }
    }
  }
});
