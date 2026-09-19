import type { SubscriptionTransaction } from '@kanjo/core';

export interface ObservedHistorySummary {
  firstDate: string;
  lastDate: string;
  paymentMonthCount: number;
  transactionCount: number;
  totalAmount: number;
  monthlyAverage: number;
}

/** 表示中の期間にある支払い履歴だけを要約する。契約の開始・終了や連続利用は推測しない。 */
export function summarizeObservedHistory(
  rows: readonly SubscriptionTransaction[],
): ObservedHistorySummary | null {
  if (rows.length === 0) return null;

  let firstDate = rows[0].date;
  let lastDate = rows[0].date;
  let totalAmount = 0;
  const paymentMonths = new Set<string>();

  for (const row of rows) {
    if (row.date < firstDate) firstDate = row.date;
    if (row.date > lastDate) lastDate = row.date;
    paymentMonths.add(row.date.slice(0, 7));
    totalAmount += row.amount;
  }

  const paymentMonthCount = paymentMonths.size;
  return {
    firstDate,
    lastDate,
    paymentMonthCount,
    transactionCount: rows.length,
    totalAmount,
    monthlyAverage: totalAmount / paymentMonthCount,
  };
}
