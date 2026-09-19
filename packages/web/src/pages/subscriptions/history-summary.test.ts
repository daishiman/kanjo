import type { SubscriptionTransaction } from '@kanjo/core';
import { describe, expect, it } from 'vitest';
import { summarizeObservedHistory } from './history-summary.js';

const tx = (date: string, amount: number, name = 'テストサービス'): SubscriptionTransaction => ({
  date,
  amount,
  name,
  source: 'card',
});

describe('summarizeObservedHistory', () => {
  it('履歴が無いときは要約を作らない', () => {
    expect(summarizeObservedHistory([])).toBeNull();
  });

  it('1件だけなら同じ日を期間の両端とし、1か月・1件で集計する', () => {
    expect(summarizeObservedHistory([tx('2026-08-13', 8_454)])).toEqual({
      firstDate: '2026-08-13',
      lastDate: '2026-08-13',
      paymentMonthCount: 1,
      transactionCount: 1,
      totalAmount: 8_454,
      monthlyAverage: 8_454,
    });
  });

  it('並び順を変えずに最古日・最新日、重複しない支払月、月平均を求める', () => {
    const rows = [
      tx('2026-08-13', 6_000),
      tx('2026-06-21', 3_000),
      tx('2026-08-01', 4_000),
      tx('2026-07-17', 2_000),
    ];
    const datesBefore = rows.map((row) => row.date);

    expect(summarizeObservedHistory(rows)).toEqual({
      firstDate: '2026-06-21',
      lastDate: '2026-08-13',
      paymentMonthCount: 3,
      transactionCount: 4,
      totalAmount: 15_000,
      monthlyAverage: 5_000,
    });
    expect(rows.map((row) => row.date)).toEqual(datesBefore);
  });
});
