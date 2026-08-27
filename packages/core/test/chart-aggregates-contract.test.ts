/**
 * AIレポートの追加図(科目×月ヒートマップ / 名義別推移)と統計基準月数の契約テスト。
 * 金額・名称はすべてテスト内で生成した架空値で、外部データには依存しない。
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAT_MIN_MONTHS,
  type Dataset,
  STAT_MIN_MONTHS_MAX,
  STAT_MIN_MONTHS_MIN,
  accountMonthMatrix,
  clampStatMinMonths,
  emptyDataset,
  ownerMonthlyExpense,
  statThresholds,
} from '../src/index.js';

const MONTHS = ['2026-01', '2026-02', '2026-03'];

function syntheticDataset(): Dataset {
  return {
    ...emptyDataset(),
    months: MONTHS,
    biz: {
      revenue: [100000, 100000, 100000],
      categories: ['架空外注', '架空家賃', '架空消耗品'],
      expense: {
        架空外注: [50000, 10000, 10000],
        架空家賃: [30000, 30000, 30000],
        架空消耗品: [1000, 2000, 3000],
      },
    },
    personalByOwner: {
      '2026-01': {
        business: { income: 0, expense: 10000 },
        spouse: { income: 0, expense: 5000 },
        family: { income: 0, expense: 0 },
        unset: { income: 0, expense: 1000 },
      },
      '2026-02': {
        business: { income: 0, expense: 12000 },
        spouse: { income: 0, expense: 4000 },
        family: { income: 0, expense: 0 },
        unset: { income: 0, expense: 0 },
      },
      '2026-03': {
        business: { income: 0, expense: 11000 },
        spouse: { income: 0, expense: 6000 },
        family: { income: 0, expense: 0 },
        unset: { income: 0, expense: 0 },
      },
    },
  };
}

describe('科目×月のヒートマップ集計', () => {
  it('期間合計の大きい順に並べ、行ごとの最大月額を返す', () => {
    const m = accountMonthMatrix(syntheticDataset(), MONTHS);
    expect(m.rows.map((r) => r.account)).toEqual(['架空家賃', '架空外注', '架空消耗品']);
    expect(m.rows[0].total).toBe(90000);
    expect(m.rows[1].max).toBe(50000);
    // 月の合計は科目別合計の総和に一致する(図の数字が本文の経費合計とずれない)
    const grand = m.rows.reduce((s, r) => s + r.total, 0);
    expect(grand).toBe(90000 + 70000 + 6000);
  });

  it('未記帳月は 0 ではなく null(記帳前と「使わなかった」を混ぜない)', () => {
    const d = { ...syntheticDataset(), unrecordedExpMonths: ['2026-02'] };
    const m = accountMonthMatrix(d, MONTHS);
    expect(m.rows[0].values[1]).toBeNull();
    expect(m.rows[0].total).toBe(60000);
  });

  it('上限を超える科目は「その他」に畳み、金額の無い科目は落とす', () => {
    const d = syntheticDataset();
    d.biz.categories = [...d.biz.categories, '架空未使用'];
    d.biz.expense.架空未使用 = [0, 0, 0];
    const m = accountMonthMatrix(d, MONTHS, 2);
    expect(m.rows.map((r) => r.account)).toEqual(['架空家賃', '架空外注', 'その他']);
    expect(m.rows[2].values).toEqual([1000, 2000, 3000]);
  });
});

describe('名義別の個人支出推移', () => {
  it('支出のある名義だけを既定順(事業→妻→家族→未設定)で返す', () => {
    const s = ownerMonthlyExpense(syntheticDataset(), MONTHS);
    expect(s.rows.map((r) => r.owner)).toEqual(['business', 'spouse', 'unset']);
    expect(s.rows.map((r) => r.label)).toEqual(['事業', '妻', '未設定']);
    expect(s.rows[0].values).toEqual([10000, 12000, 11000]);
    expect(s.allUnset).toBe(false);
  });

  it('名義が1つも割り当てられていなければ allUnset を立てる', () => {
    const d = emptyDataset();
    d.personalByOwner = {
      '2026-01': {
        business: { income: 0, expense: 0 },
        spouse: { income: 0, expense: 0 },
        family: { income: 0, expense: 0 },
        unset: { income: 0, expense: 9000 },
      },
    };
    const s = ownerMonthlyExpense(d, ['2026-01']);
    expect(s.rows.map((r) => r.owner)).toEqual(['unset']);
    expect(s.allUnset).toBe(true);
  });
});

describe('統計指標の基準月数', () => {
  it('既定は6ヶ月で、外れ値・移動平均の判定に使う', () => {
    const t = statThresholds();
    expect(DEFAULT_STAT_MIN_MONTHS).toBe(6);
    expect(t.outliers).toBe(6);
    expect(t.movingAverage).toBe(6);
  });

  it('暦で決まる周期(傾向12・季節性24・前年同月13)は基準月数では短くならない', () => {
    const t = statThresholds(3);
    expect(t.outliers).toBe(3);
    expect(t.trend).toBe(12);
    expect(t.seasonality).toBe(24);
    expect(t.yearOverYear).toBe(13);
    const long = statThresholds(STAT_MIN_MONTHS_MAX);
    expect(long.trend).toBe(STAT_MIN_MONTHS_MAX);
    expect(long.seasonality).toBe(24);
  });

  it('範囲外・数値でない値は既定または上下限に寄せる', () => {
    expect(clampStatMinMonths(1)).toBe(STAT_MIN_MONTHS_MIN);
    expect(clampStatMinMonths(999)).toBe(STAT_MIN_MONTHS_MAX);
    expect(clampStatMinMonths('6')).toBe(DEFAULT_STAT_MIN_MONTHS);
    expect(clampStatMinMonths(undefined)).toBe(DEFAULT_STAT_MIN_MONTHS);
    expect(clampStatMinMonths(7.4)).toBe(7);
  });
});
