/**
 * 推移画面 (SYS-TRENDS-P04) のテストが共有する取引の組。
 *
 * 18 か月 (2025-01..2026-06) に、家計の支出・事業の支出・家計の収入 (MF) と
 * freee の支出・収入を置く。2026-03 に総収支と同じ判定の 3 種を置く:
 *   - 同日同額の MF と freee (自動で寄る。MF 側は数えない)
 *   - 1 日ずれた同額の MF と freee (要確認。MF 側は数えない)
 *   - 決済口座が空の freee 支出 (出典の口座は null)
 */
import { type Dataset, type FreeeDeal, type MfTx, emptyDataset } from '../src/index.js';

export const MONTHS = Array.from({ length: 18 }, (_, i) => {
  const y = 2025 + Math.floor(i / 12);
  const m = (i % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
});

export const mf = (over: Partial<MfTx> = {}): MfTx => ({
  id: 'mf-1',
  idStable: true,
  m: '2026-03',
  d: '03/05',
  c: '架空スーパー',
  a: -1_000,
  big: '食費',
  mid: '食料品',
  inst: '架空カード',
  isTarget: true,
  isTransfer: false,
  ...over,
});

export const deal = (over: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-03',
  date: '2026-03-05',
  io: 'expense',
  partner: '架空広告社',
  accountRaw: '広告宣伝費',
  accountNorm: '広告宣伝費',
  amount: 10_000,
  settleAccount: '架空銀行',
  ...over,
});

export function dataset(txs: MfTx[], months: readonly string[] = MONTHS): Dataset {
  const data = emptyDataset();
  data.months = [...months];
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  return data;
}

/** 月ごとに額が変わる取引の組。i は MONTHS の添字 */
export function fixture(): { data: Dataset; deals: FreeeDeal[] } {
  const txs: MfTx[] = [];
  const deals: FreeeDeal[] = [];
  MONTHS.forEach((m, i) => {
    const mm = m.slice(5);
    txs.push(
      mf({ id: `food-a-${m}`, m, d: `${mm}/03`, c: '架空スーパー', a: -(30_000 + i * 1_000) }),
      mf({ id: `food-b-${m}`, m, d: `${mm}/10`, c: '架空パン屋', a: -5_000 }),
      mf({
        id: `rent-${m}`,
        m,
        d: `${mm}/27`,
        c: '架空不動産',
        big: '住宅',
        mid: '家賃',
        a: -80_000,
        inst: '架空銀行',
      }),
      mf({
        id: `salary-${m}`,
        m,
        d: `${mm}/25`,
        c: '架空給与',
        big: '収入',
        mid: '給与',
        a: 250_000,
        inst: '架空銀行',
      }),
      mf({
        id: `biz-comm-${m}`,
        m,
        d: `${mm}/12`,
        c: '架空回線',
        big: '通信費',
        mid: '事業経費',
        a: -(8_000 + (i % 3) * 500),
      }),
    );
    deals.push(
      deal({ month: m, date: `${m}-15`, partner: '架空広告社', amount: 10_000 + (i === 14 ? 240_000 : 0) }),
      deal({
        month: m,
        date: `${m}-20`,
        io: 'income',
        partner: '架空商事',
        accountRaw: '売上高',
        accountNorm: '売上高',
        amount: 300_000 + i * 5_000,
      }),
    );
  });
  // 2026-03 (添字 14) の判定 3 種
  txs.push(
    mf({
      id: 'shifted-1',
      m: '2026-03',
      d: '03/08',
      c: '架空クラウド',
      big: '通信費',
      mid: '事業経費',
      a: -3_300,
    }),
    mf({
      id: 'review-1',
      m: '2026-03',
      d: '03/09',
      c: '架空ホスティング',
      big: '通信費',
      mid: '事業経費',
      a: -4_400,
    }),
  );
  deals.push(
    deal({
      month: '2026-03',
      date: '2026-03-08',
      partner: '架空クラウド',
      accountRaw: '通信費',
      accountNorm: '通信費',
      amount: 3_300,
    }),
    deal({
      month: '2026-03',
      date: '2026-03-10',
      partner: '架空ホスティング',
      accountRaw: '通信費',
      accountNorm: '通信費',
      amount: 4_400,
    }),
    deal({
      month: '2026-03',
      date: '2026-03-21',
      partner: '',
      accountRaw: '消耗品費',
      accountNorm: '消耗品費',
      amount: 2_000,
      settleAccount: '',
    }),
  );
  return { data: dataset(txs), deals };
}

/**
 * 同じ「食費 / 共通取引先」が事業と家計の両方にある境界値。
 * 名前だけで選択すると、scope=total でどちらを開いたかを復元できない。
 */
export function sameNameCategoryFixture(): { data: Dataset; deals: FreeeDeal[] } {
  const months = ['2026-01', '2026-02'];
  return {
    data: dataset(
      months.map((m) =>
        mf({
          id: `household-food-${m}`,
          m,
          d: `${m.slice(5)}/03`,
          c: '共通取引先',
          big: '食費',
          mid: '食料品',
          a: m === '2026-01' ? -100 : -200,
        }),
      ),
      months,
    ),
    deals: months.map((m) =>
      deal({
        month: m,
        date: `${m}-15`,
        partner: '共通取引先',
        accountRaw: '食費',
        accountNorm: '食費',
        amount: m === '2026-01' ? 300 : 500,
      }),
    ),
  };
}

/** 比較期間 2 か月のうち後半の 2026-03 が未取込の境界値。 */
export function missingCompareMonthFixture(): { data: Dataset; deals: FreeeDeal[] } {
  const months = ['2026-02', '2026-04', '2026-05'];
  return {
    data: dataset(
      [
        mf({ id: 'missing-base', m: '2026-02', d: '02/03', a: -100 }),
        mf({ id: 'missing-current-a', m: '2026-04', d: '04/03', a: -200 }),
        mf({ id: 'missing-current-b', m: '2026-05', d: '05/03', a: -300 }),
      ],
      months,
    ),
    deals: [],
  };
}

/** 比較先より今回の支出が小さく、change が負になる境界値。 */
export function negativeChangeFixture(): { data: Dataset; deals: FreeeDeal[] } {
  const months = ['2026-01', '2026-02'];
  return {
    data: dataset(
      [
        mf({ id: 'negative-base', m: '2026-01', d: '01/03', c: '減額先', a: -200 }),
        mf({ id: 'negative-current', m: '2026-02', d: '02/03', c: '減額先', a: -100 }),
      ],
      months,
    ),
    deals: [],
  };
}
