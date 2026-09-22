/**
 * 予算画面の DOM テスト用フィクスチャ (spec-budget-screen)。
 *
 * 実績 2024-09〜2026-08 の 24 か月、予算対象 2026-09〜2027-08。数値は core の `applyBudgetInputs` で
 * 保存済みの入力から作り、画面と同じ計算を通す (テスト側で見通しや KPI を書き写さない)。
 */
import {
  type BudgetBaseRow,
  type BudgetInput,
  type BudgetScreenBase,
  applyBudgetInputs,
  budgetTargetMonths,
} from '@kanjo/core';
import type { BudgetScreenResponse } from '../api.js';

export const BUDGET_START = '2026-09';
export const BUDGET_SAVED_AT = '2026-08-20T01:00:00.000Z';

const ACTUAL_MONTHS = Array.from({ length: 24 }, (_, i) => {
  const index = 2024 * 12 + 8 + i;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
});

function row(
  account: string,
  order: number,
  prevActual: number,
  growthRate: number,
  saved: BudgetInput | null,
  kind: 'income' | 'expense' = 'expense',
): BudgetBaseRow {
  const monthly = Math.round(prevActual / 12);
  return {
    account,
    kind,
    manualOnly: false,
    order,
    prevActual,
    growthRate,
    seasonal: 0,
    monthDeviation: Array.from({ length: 12 }, () => 0),
    targetActuals: Array.from({ length: 12 }, () => null),
    recentMonthly: ACTUAL_MONTHS.map((month) => ({ month, amount: monthly })),
    saved,
  };
}

const saved = (annualAmount: number, planAdjustment = 0, planReason: string | null = null): BudgetInput => ({
  annualAmount,
  planAdjustment,
  planReason,
});

export function budgetScreenBase(overrides: Partial<BudgetScreenBase> = {}): BudgetScreenBase {
  return {
    empty: false,
    actualRange: { from: ACTUAL_MONTHS[0] as string, to: ACTUAL_MONTHS[23] as string, months: 24 },
    start: BUDGET_START,
    targetMonths: budgetTargetMonths(BUDGET_START),
    startOptions: ['2025-09', BUDGET_START],
    source: 'saved',
    savedAt: BUDGET_SAVED_AT,
    defenseLine: { monthly: 800_000, annual: 9_600_000 },
    seasonalEnabled: true,
    rows: [
      row('売上高', 1, 12_000_000, 0.05, saved(12_600_000), 'income'),
      row('外注費', 2, 1_200_000, -0.05, null),
      row('広告宣伝費', 3, 360_000, 0.1, saved(300_000, 20_000, '展示会の出展')),
      row('通信費', 4, 60_000, 0, null),
    ],
    ...overrides,
  };
}

/** GET /api/budget-screen の応答。保存済みの入力で figures を作る (API と同じ) */
export function budgetScreenResponse(overrides: Partial<BudgetScreenBase> = {}): BudgetScreenResponse {
  const base = budgetScreenBase(overrides);
  const inputs: Record<string, BudgetInput> = {};
  for (const r of base.rows) if (r.saved) inputs[r.account] = r.saved;
  return {
    ...base,
    figures: applyBudgetInputs(base, inputs),
    period: {
      applied: null,
      label: '全期間',
      full: { from: ACTUAL_MONTHS[0] as string, to: ACTUAL_MONTHS[23] as string },
      years: ['2024', '2025', '2026'],
      monthCount: 24,
    },
  };
}

/** 実績が無いときの応答 */
export function emptyBudgetScreenResponse(): BudgetScreenResponse {
  return budgetScreenResponse({
    empty: true,
    actualRange: null,
    start: null,
    targetMonths: [],
    startOptions: [],
    source: 'none',
    savedAt: null,
    rows: [],
  });
}
