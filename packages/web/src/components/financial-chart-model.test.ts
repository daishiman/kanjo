import { describe, expect, it } from 'vitest';
import type { BalanceSheet, MatrixData } from '../api.js';
import { latestCompleteBalance, matrixMovers } from './financial-chart-model.js';

describe('財務図表の表示用データ', () => {
  it('増減マトリクスは未記帳月を飛ばし、直近2記帳月の差が大きい順に返す', () => {
    const data: MatrixData = {
      months: ['2026-05', '2026-06', '2026-07'],
      unrecordedExpMonths: ['2026-06'],
      years: ['2026'],
      rows: [
        { label: '広告宣伝費', isTotal: false, series: [10_000, 0, 40_000], yearTotals: [], yoy: 0 },
        { label: '新聞図書費', isTotal: false, series: [20_000, 0, 5_000], yearTotals: [], yoy: 0 },
        { label: '経費計', isTotal: true, series: [30_000, 0, 45_000], yearTotals: [], yoy: 0 },
      ],
    };

    expect(matrixMovers(data)).toEqual({
      fromMonth: '2026-05',
      toMonth: '2026-07',
      rows: [
        { label: '広告宣伝費', previous: 10_000, current: 40_000, delta: 30_000 },
        { label: '新聞図書費', previous: 20_000, current: 5_000, delta: -15_000 },
      ],
    });
  });

  it('BSは負債入力済みの最新月だけを均衡図に使う', () => {
    const data: BalanceSheet = {
      months: [
        {
          month: '2026-07',
          asOf: '2026-07-31',
          partial: false,
          assets: [],
          assetTotal: 400_000,
          liabilities: [],
          liabilityTotal: 150_000,
          netAssets: 250_000,
        },
        {
          month: '2026-08',
          asOf: '2026-08-28',
          partial: true,
          assets: [],
          assetTotal: 500_000,
          liabilities: [],
          liabilityTotal: 0,
          netAssets: null,
        },
      ],
      assetCategories: [],
      liabilityCategories: [],
      monthsWithoutLiabilities: ['2026-08'],
      limits: [],
    };

    expect(latestCompleteBalance(data)?.month).toBe('2026-07');
  });
});
