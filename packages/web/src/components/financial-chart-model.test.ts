import { describe, expect, it } from 'vitest';
import type { BalanceSheet } from '../api.js';
import { latestCompleteBalance } from './financial-chart-model.js';

describe('財務図表の表示用データ', () => {
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
