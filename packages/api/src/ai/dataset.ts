/**
 * AIに渡す読み取り専用データ(集計値だけ。明細行・摘要・ルール・編集は含めない)。
 * 月別配列は {月: 金額} に組み替えて、読み手(LLM)が月を取り違えないようにする。
 */
import { type Dataset, benchmarks, household, overview, subscriptions } from '@kanjo/core';
import type { PeriodKind } from './contract.js';
import { periodLabel } from './contract.js';

type ByMonth = Record<string, number>;

const byMonth = (months: string[], series: number[]): ByMonth => {
  const out: ByMonth = {};
  months.forEach((m, i) => {
    out[m] = series[i] ?? 0;
  });
  return out;
};

export function periodMonths(months: string[], kind: PeriodKind, key: string): string[] {
  return months.filter((m) => (kind === 'year' ? m.startsWith(`${key}-`) : m === key));
}

export function buildAgentData(data: Dataset, kind: PeriodKind, key: string) {
  const ov = overview(data);
  const hh = household(data);
  const subs = subscriptions(data);
  const months = data.months;
  const inPeriod = periodMonths(months, kind, key);
  const prevKey =
    kind === 'year'
      ? String(Number(key) - 1)
      : (() => {
          const [y, m] = key.split('-').map(Number);
          return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
        })();
  const yoyKey = kind === 'year' ? prevKey : `${Number(key.slice(0, 4)) - 1}-${key.slice(5)}`;

  return {
    generatedAt: new Date().toISOString(),
    period: {
      kind,
      key,
      label: periodLabel(kind, key),
      months: inPeriod,
      previous: { key: prevKey, months: periodMonths(months, kind, prevKey) },
      yearAgo: { key: yoyKey, months: periodMonths(months, kind, yoyKey) },
    },
    notes: [
      '金額はすべて円(整数)。支出は正の値。',
      'biz は freee 帳簿(事業)。personal は MF 明細のうち公私仕分けで「個人」とされた分。',
      'unrecordedExpenseMonths は事業経費が未記帳の月で、その月の経費 0 は「無い」ではなく「未記帳」。',
      'personal.expense のキーは MF の大項目(または大項目/中項目)。',
    ],
    months,
    unrecordedExpenseMonths: data.unrecordedExpMonths,
    biz: {
      revenue: byMonth(months, data.biz.revenue),
      expenseTotal: byMonth(months, ov.expenseTotal),
      expenseByAccount: Object.fromEntries(
        data.biz.categories.map((acct) => [acct, byMonth(months, data.biz.expense[acct] ?? [])]),
      ),
      kpi: ov.kpi,
      years: ov.years,
      yearTable: ov.yearTable,
      yearTotals: ov.yearTotals,
      pareto: ov.pareto,
    },
    personal: {
      byMonth: Object.fromEntries(months.map((m) => [m, data.personal[m] ?? { income: {}, expense: {} }])),
      livingCost: hh.livingCost,
      explainability: hh.explainability,
    },
    bizPersonal: data.bizPersonal,
    comparison: hh.comparison,
    byOwner: {
      rows: hh.byOwner.rows,
      totals: hh.byOwner.totals,
      unmappedInstitutions: hh.byOwner.unmappedInstitutions,
    },
    subscriptions: {
      now: subs.now,
      vendors: Object.fromEntries(subs.vendors.map((v) => [v, byMonth(subs.months, subs.matrix[v] ?? [])])),
      other: byMonth(subs.months, subs.other),
      vendorTable: subs.vendorTable,
      alerts: subs.alerts,
      years: subs.years,
    },
    benchmarks: benchmarks(data),
  };
}

export type AgentData = ReturnType<typeof buildAgentData>;
