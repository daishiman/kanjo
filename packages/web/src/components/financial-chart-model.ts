import type { BalanceSheet, MatrixData } from '../api.js';

export interface MatrixMover {
  label: string;
  previous: number;
  current: number;
  delta: number;
}

export interface MatrixMovers {
  fromMonth: string;
  toMonth: string;
  rows: MatrixMover[];
}

/**
 * 巨大な月次表を読む前に見る「直近の変化」。
 * 未記帳月は0円として比較せず、合計行は個別科目と重複するため除く。
 */
export function matrixMovers(data: MatrixData, limit = 6): MatrixMovers | null {
  const unrecorded = new Set(data.unrecordedExpMonths);
  const recordedIndexes = data.months
    .map((month, index) => ({ month, index }))
    .filter(({ month }) => !unrecorded.has(month));
  const current = recordedIndexes.at(-1);
  const previous = recordedIndexes.at(-2);
  if (!current || !previous) return null;

  const rows = data.rows
    .filter((row) => !row.isTotal)
    .map((row) => {
      const previousValue = row.series[previous.index] ?? 0;
      const currentValue = row.series[current.index] ?? 0;
      return {
        label: row.label,
        previous: previousValue,
        current: currentValue,
        delta: currentValue - previousValue,
      };
    })
    .filter((row) => row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label, 'ja'))
    .slice(0, Math.max(0, limit));

  return { fromMonth: previous.month, toMonth: current.month, rows };
}

/** 純資産まで確定している最新月。未入力の負債を0円に見せない。 */
export function latestCompleteBalance(data: BalanceSheet) {
  for (let index = data.months.length - 1; index >= 0; index -= 1) {
    const month = data.months[index];
    if (month?.netAssets !== null) return month ?? null;
  }
  return null;
}
