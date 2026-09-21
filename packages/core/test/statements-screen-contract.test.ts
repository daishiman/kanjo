/**
 * 決算書画面 (statementsScreen) の契約。仕様 specs/spec-statements-screen.md §3.1・§6・§7 の core 部分。
 *
 * フィクスチャは仕様 §6 の検算済みの値 (当期 2025-09〜2026-08・前期 2024-09〜2025-08) を
 * 24 か月の架空の仕訳から組み立てる。画面の数字はこの 1 関数の出力だけなので、
 * ここで値が閉じていれば画面の数字も閉じる。
 */
import { describe, expect, it } from 'vitest';
import { type BalanceRow, LIABILITY_AMOUNT_MAX, LIABILITY_CATEGORIES } from '../src/balances.js';
import { applyFreeeDeals } from '../src/dataset.js';
import { applyPeriod } from '../src/period.js';
import {
  STATEMENTS_COGS_ACCOUNTS,
  STATEMENTS_LIABILITY_LINES,
  type StatementsRowKey,
  type StatementsScreen,
  previousMonthKey,
  resolveReferenceMonth,
  statementsScreen,
} from '../src/statements-screen.js';
import { type Dataset, type FreeeDeal, type MfTx, emptyDataset } from '../src/types.js';

const SEN = 1_000;
const CURRENT = { from: '2025-09', to: '2026-08' };
const PREVIOUS = { from: '2024-09', to: '2025-08' };
const monthsOf = (from: string, count: number) => {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m === 13) {
      y += 1;
      m = 1;
    }
  }
  return out;
};
const CUR_MONTHS = monthsOf(CURRENT.from, 12);
const PREV_MONTHS = monthsOf(PREVIOUS.from, 12);

// 仕様 §6 の月次 (千円)
const SALES = [950, 980, 1020, 1180, 1120, 1060, 1200, 1080, 1040, 1080, 1200, 570];
const COGS = [600, 620, 640, 760, 720, 680, 760, 700, 660, 680, 760, 280];
const SGA = [210, 220, 240, 260, 230, 220, 260, 240, 220, 230, 260, 210];

const deal = (p: Partial<FreeeDeal>): FreeeDeal => ({
  month: '2026-01',
  date: '2026-01-10',
  io: 'expense',
  partner: '架空商店',
  accountRaw: '地代家賃',
  accountNorm: '地代家賃',
  amount: 0,
  // 決済列を持つ取込 (settlementUnknown にしない)
  dueDate: null,
  settledDate: '2026-01-31',
  settleAccount: '架空銀行',
  settledAmount: 0,
  ...p,
});
const acct = (name: string) => ({ accountRaw: name, accountNorm: name });

function fixtureDeals(): FreeeDeal[] {
  const out: FreeeDeal[] = [];
  CUR_MONTHS.forEach((month, i) => {
    const date = `${month}-15`;
    // 売上は 2 科目に分ける (内訳の降順と合計の一致を見るため)
    out.push(deal({ month, date, io: 'income', ...acct('売上高'), amount: SALES[i] * SEN - 100_000 }));
    out.push(deal({ month, date, io: 'income', ...acct('サービス収入'), amount: 100_000 }));
    if (month === '2026-08') {
      // 280 千円 = 仕入 300 + 期首 50 − 期末 70 (期末棚卸の減算を見る)
      out.push(deal({ month, date, ...acct('仕入高'), amount: 300_000 }));
      out.push(deal({ month, date, ...acct('期首商品棚卸高'), amount: 50_000 }));
      out.push(deal({ month, date, ...acct('期末商品棚卸高'), amount: 70_000 }));
    } else {
      out.push(deal({ month, date, ...acct('仕入高'), amount: COGS[i] * SEN }));
    }
    // 販管費: 家賃・外注工賃 (経費欄なので販管費)・未知の科目
    out.push(deal({ month, date, ...acct('地代家賃'), amount: 100_000 }));
    out.push(deal({ month, date, ...acct('外注工賃'), amount: 50_000 }));
    out.push(deal({ month, date, ...acct('架空の未知科目'), amount: SGA[i] * SEN - 150_000 }));
  });
  PREV_MONTHS.forEach((month, i) => {
    const date = `${month}-15`;
    const last = i === 11;
    out.push(deal({ month, date, io: 'income', ...acct('売上高'), amount: last ? 900_000 : 940_000 }));
    out.push(deal({ month, date, ...acct('仕入高'), amount: last ? 630_000 : 590_000 }));
    out.push(deal({ month, date, ...acct('地代家賃'), amount: last ? 200_000 : 220_000 }));
  });
  return out;
}

const buildAll = (deals: FreeeDeal[]): Dataset => {
  const data = emptyDataset();
  applyFreeeDeals(data, deals, [...new Set(deals.map((d) => d.month))].sort());
  return data;
};

const liability = (
  month: string,
  category: string,
  amount: number,
  status?: 'zero' | 'amount',
): BalanceRow => ({
  month,
  date: `${month}-01`,
  side: 'liability',
  category,
  amount,
  source: 'manual',
  ...(status ? { status } : {}),
});

/** 前月 (2026-07) は必須 3 項目が揃って 2,500,000。クレジットは 0046 より前の (amount, 0) 行 */
const BALANCES: BalanceRow[] = [
  liability('2026-07', '借入金', 2_100_000, 'amount'),
  liability('2026-07', '未払金・買掛金', 400_000, 'amount'),
  liability('2026-07', 'クレジットカード未払金', 0),
  liability('2026-08', '借入金', 2_000_000, 'amount'),
  liability('2026-08', '未払金・買掛金', 300_000, 'amount'),
  {
    month: '2026-08',
    date: '2026-08-31',
    side: 'asset',
    category: '預金・現金',
    amount: 5_000_000,
    source: 'mf',
  },
];

const screenOf = (
  overrides: { balances?: BalanceRow[]; referenceMonth?: string | null } = {},
): StatementsScreen => {
  const deals = fixtureDeals();
  const all = buildAll(deals);
  return statementsScreen({
    current: applyPeriod(all, CURRENT),
    previous: applyPeriod(all, PREVIOUS),
    deals,
    balances: overrides.balances ?? BALANCES,
    referenceMonth: overrides.referenceMonth === undefined ? '2026-08' : overrides.referenceMonth,
  });
};
const rowOf = (s: StatementsScreen, key: StatementsRowKey) => {
  const r = s.pl.rows.find((x) => x.key === key);
  if (!r) throw new Error(`row ${key} が無い`);
  return r;
};

describe('PL: 仕様 §6 の検算済みフィクスチャ', () => {
  const s = screenOf();

  it('5 行が固定の順で並び、当期・前期・差額が §6 の値になる', () => {
    expect(s.pl.rows.map((r) => [r.key, r.label])).toEqual([
      ['sales', '売上高'],
      ['cogs', '売上原価'],
      ['gross', '売上総利益'],
      ['sga', '販管費'],
      ['operating', '営業利益'],
    ]);
    expect(s.pl.rows.map((r) => [r.current, r.previous, r.diff])).toEqual([
      [12_480_000, 11_240_000, 1_240_000],
      [7_860_000, 7_120_000, 740_000],
      [4_620_000, 4_120_000, 500_000],
      [2_800_000, 2_620_000, 180_000],
      [1_820_000, 1_500_000, 320_000],
    ]);
  });

  it('構成比は売上高比で、小数 1 桁にすると 100.0 / 63.0 / 37.0 / 22.4 / 14.6', () => {
    expect(s.pl.rows.map((r) => ((r.ratio ?? Number.NaN) * 100).toFixed(1))).toEqual([
      '100.0',
      '63.0',
      '37.0',
      '22.4',
      '14.6',
    ]);
  });

  it('月次は §6 の千円表どおりで、恒等式が全月と合計で閉じる', () => {
    const series = (key: StatementsRowKey) => rowOf(s, key).monthly.map((m) => m.amount / SEN);
    expect(rowOf(s, 'sales').monthly.map((m) => m.month)).toEqual(CUR_MONTHS);
    expect(series('sales')).toEqual(SALES);
    expect(series('cogs')).toEqual(COGS);
    expect(series('sga')).toEqual(SGA);
    expect(series('gross')).toEqual([350, 360, 380, 420, 400, 380, 440, 380, 380, 400, 440, 290]);
    expect(series('operating')).toEqual([140, 140, 140, 160, 170, 160, 180, 140, 160, 170, 180, 80]);
    for (let i = 0; i < 12; i++) {
      const at = (key: StatementsRowKey) => rowOf(s, key).monthly[i].amount;
      expect(at('gross')).toBe(at('sales') - at('cogs'));
      expect(at('operating')).toBe(at('gross') - at('sga'));
    }
    expect(rowOf(s, 'gross').current).toBe(rowOf(s, 'sales').current - rowOf(s, 'cogs').current);
    expect(rowOf(s, 'operating').current).toBe(rowOf(s, 'gross').current - rowOf(s, 'sga').current);
  });

  it('売上原価は 仕入高 + 期首 − 期末。期末棚卸は負の内訳として出る', () => {
    expect(STATEMENTS_COGS_ACCOUNTS).toEqual({
      add: ['仕入高', '期首商品棚卸高'],
      subtract: ['期末商品棚卸高'],
    });
    const cogs = rowOf(s, 'cogs');
    expect(cogs.accounts.find((a) => a.account === '期末商品棚卸高')?.current).toBe(-70_000);
    expect(cogs.accounts.reduce((t, a) => t + a.current, 0)).toBe(cogs.current);
  });

  it('外注工賃と未知の科目は販管費に入り、売上原価には入らない', () => {
    const sga = rowOf(s, 'sga').accounts.map((a) => a.account);
    expect(sga).toContain('外注工賃');
    expect(sga).toContain('架空の未知科目');
    expect(rowOf(s, 'cogs').accounts.map((a) => a.account)).not.toContain('外注工賃');
    expect(rowOf(s, 'sga').accounts.reduce((t, a) => t + a.current, 0)).toBe(2_800_000);
  });

  it('売上の内訳は収入仕訳の科目名で、当期金額の降順', () => {
    const sales = rowOf(s, 'sales').accounts;
    expect(sales.map((a) => [a.account, a.current])).toEqual([
      ['売上高', 11_280_000],
      ['サービス収入', 1_200_000],
    ]);
    expect(sales.find((a) => a.account === 'サービス収入')?.previous).toBe(0);
    expect(sales.find((a) => a.account === 'サービス収入')?.ratio).toBeCloseTo(1_200_000 / 12_480_000);
  });

  it('計算行の内訳は構成要素の区分名 (差し引く側は負)', () => {
    expect(rowOf(s, 'gross').accounts).toEqual([
      { account: '売上高', current: 12_480_000, previous: 11_240_000, ratio: 1 },
      {
        account: '売上原価',
        current: -7_860_000,
        previous: -7_120_000,
        ratio: -7_860_000 / 12_480_000,
      },
    ]);
    expect(rowOf(s, 'operating').accounts.map((a) => a.account)).toEqual(['売上総利益', '販管費']);
  });

  it('計算式と出典は区分ごとの固定文言', () => {
    expect(rowOf(s, 'sales').formula).toBe('売上高 ＝ 売上に関する収益の合計');
    expect(rowOf(s, 'gross').formula).toBe('売上総利益 ＝ 売上高 − 売上原価');
    expect(rowOf(s, 'operating').formula).toBe('営業利益 ＝ 売上総利益 − 販管費');
    expect(rowOf(s, 'sales').source).toBe('仕訳データ（収益科目の合計）');
  });

  it('期間と前期の表示', () => {
    expect(s.period).toMatchObject({
      from: '2025-09',
      to: '2026-08',
      label: '2025年9月 - 2026年8月',
      previous: { from: '2024-09', to: '2025-08', label: '2024年9月 - 2025年8月' },
    });
  });
});

describe('KPI', () => {
  const s = screenOf();

  it('売上高 +11.0%・営業利益 +21.3%、出典と対象期間の文言', () => {
    expect(s.kpis.sales).toMatchObject({
      value: 12_480_000,
      previous: 11_240_000,
      diff: 1_240_000,
      source: '出典：仕訳データ',
      periodLabel: '対象期間：2025年9月 - 2026年8月',
    });
    expect(((s.kpis.sales.diffRate ?? 0) * 100).toFixed(1)).toBe('11.0');
    expect(s.kpis.operatingProfit).toMatchObject({
      value: 1_820_000,
      diff: 320_000,
      source: '出典：損益計算書',
    });
    expect(((s.kpis.operatingProfit.diffRate ?? 0) * 100).toFixed(1)).toBe('21.3');
  });

  it('現金増減は率を持たない (diffRate は常に null)', () => {
    expect(s.kpis.cashChange.diffRate).toBeNull();
    expect(s.kpis.cashChange.source).toBe('出典：現金収支/キャッシュフロー');
  });

  it('前期が 0 のとき diffRate は null、差額は出る', () => {
    const deals = [
      deal({ month: '2026-01', io: 'income', ...acct('売上高'), amount: 100_000 }),
      deal({ month: '2025-12', ...acct('地代家賃'), amount: 10_000 }),
    ];
    const all = buildAll(deals);
    const screen = statementsScreen({
      current: applyPeriod(all, { from: '2026-01', to: '2026-01' }),
      previous: applyPeriod(all, { from: '2025-12', to: '2025-12' }),
      deals,
      balances: [],
    });
    expect(screen.kpis.sales).toMatchObject({ value: 100_000, previous: 0, diff: 100_000, diffRate: null });
    expect(rowOf(screen, 'sales').ratio).toBe(1);
  });

  it('前期のデータが無いとき、前期・差額・率はすべて null', () => {
    const deals = [deal({ month: '2026-01', io: 'income', ...acct('売上高'), amount: 100_000 })];
    const all = buildAll(deals);
    const screen = statementsScreen({
      current: applyPeriod(all, { from: '2026-01', to: '2026-01' }),
      previous: applyPeriod(all, { from: '2025-12', to: '2025-12' }),
      deals,
      balances: [],
    });
    expect(screen.period.previous).toBeNull();
    expect(screen.kpis.sales).toMatchObject({ previous: null, diff: null, diffRate: null });
    expect(rowOf(screen, 'sales')).toMatchObject({ previous: null, diff: null });
  });

  it('売上高 0 の期間は構成比が null', () => {
    const deals = [deal({ month: '2026-01', ...acct('地代家賃'), amount: 10_000 })];
    const all = buildAll(deals);
    const screen = statementsScreen({ current: all, previous: null, deals, balances: [] });
    expect(screen.pl.rows.every((r) => r.ratio === null)).toBe(true);
  });
});

describe('負債 (BS) と負債 KPI', () => {
  it('負債カテゴリと入力上限は core の単一定義である', () => {
    expect(LIABILITY_CATEGORIES).toEqual([
      '借入金',
      '未払金・買掛金',
      'クレジットカード未払金',
      'その他の負債',
    ]);
    expect(LIABILITY_AMOUNT_MAX).toBe(1_000_000_000_000);
  });

  it('4 項目の表示名と保存カテゴリの対応', () => {
    expect(STATEMENTS_LIABILITY_LINES.map((l) => [l.label, l.category, l.required])).toEqual([
      ['借入金', '借入金', true],
      ['未払金', '未払金・買掛金', true],
      ['クレジット未払', 'クレジットカード未払金', true],
      ['その他の負債', 'その他の負債', false],
    ]);
  });

  it('クレジット未払が未入力なら incomplete で値は null (未入力あり)、純資産も出さない', () => {
    const s = screenOf();
    expect(s.bs.lines.map((l) => [l.label, l.status, l.amount])).toEqual([
      ['借入金', 'amount', 2_000_000],
      ['未払金', 'amount', 300_000],
      ['クレジット未払', 'unset', null],
      ['その他の負債', 'unset', null],
    ]);
    expect(s.bs.complete).toBe(false);
    expect(s.bs.liabilityTotal).toBeNull();
    expect(s.bs.netAssets).toBeNull();
    expect(s.kpis.liabilities).toMatchObject({
      value: null,
      incomplete: true,
      referenceMonth: '2026-08',
      source: '出典：貸借対照表（要入力）',
      periodLabel: '基準日：2026年8月末',
    });
  });

  it('クレジット未払を zero で保存すると 2,300,000、前月末比 −200,000 (−8.0%)', () => {
    const s = screenOf({
      balances: [...BALANCES, liability('2026-08', 'クレジットカード未払金', 0, 'zero')],
    });
    expect(s.bs.complete).toBe(true);
    expect(s.bs.lines[2]).toMatchObject({ status: 'zero', amount: 0 });
    expect(s.kpis.liabilities).toMatchObject({
      value: 2_300_000,
      previous: 2_500_000,
      diff: -200_000,
      incomplete: false,
    });
    expect(((s.kpis.liabilities.diffRate ?? 0) * 100).toFixed(1)).toBe('-8.0');
    expect(s.bs).toMatchObject({ assetTotal: 5_000_000, liabilityTotal: 2_300_000, netAssets: 2_700_000 });
    expect(s.bs).toMatchObject({
      asOf: '2026-08-31',
      partial: false,
      liabilities: [
        { category: '借入金', amount: 2_000_000 },
        { category: '未払金・買掛金', amount: 300_000 },
        { category: 'クレジットカード未払金', amount: 0 },
      ],
    });
    expect(s.bs.sources.some((source) => source.name.includes('資産推移'))).toBe(true);
  });

  it('資産の最新日を asOf にし、月末前なら partial を立てる', () => {
    const balances = BALANCES.map((row) =>
      row.side === 'asset' && row.month === '2026-08' ? { ...row, date: '2026-08-28' } : row,
    ).concat(liability('2026-08', 'クレジットカード未払金', 0, 'zero'));
    expect(screenOf({ balances }).bs).toMatchObject({ asOf: '2026-08-28', partial: true });
  });

  it('0046 より前の (amount, 0) 行は zero と同じ扱いで、前月末の完了判定に数える', () => {
    const s = screenOf({ referenceMonth: '2026-07' });
    expect(s.bs.lines[2]).toMatchObject({ status: 'zero', amount: 0 });
    expect(s.bs.complete).toBe(true);
    expect(s.kpis.liabilities.value).toBe(2_500_000);
  });

  it('前月末に必須の未入力があれば前月末比は null', () => {
    const balances = BALANCES.filter((r) => !(r.month === '2026-07' && r.category === '借入金')).concat(
      liability('2026-08', 'クレジットカード未払金', 0, 'zero'),
    );
    const s = screenOf({ balances });
    expect(s.kpis.liabilities).toMatchObject({
      value: 2_300_000,
      previous: null,
      diff: null,
      diffRate: null,
    });
  });

  it('前月末の行が 1 件も無ければ前月末比は null', () => {
    const balances = BALANCES.filter((r) => r.month !== '2026-07').concat(
      liability('2026-08', 'クレジットカード未払金', 0, 'zero'),
    );
    expect(screenOf({ balances }).kpis.liabilities.previous).toBeNull();
  });

  it('基準月は期間外・不正なら期間の最終月へ丸める', () => {
    expect(screenOf({ referenceMonth: '2030-01' }).bs.referenceMonth).toBe('2026-08');
    expect(screenOf({ referenceMonth: 'x' }).bs.referenceMonth).toBe('2026-08');
    expect(screenOf({ referenceMonth: null }).bs.referenceMonth).toBe('2026-08');
    expect(resolveReferenceMonth(['2026-01', '2026-02'], '2026-01')).toBe('2026-01');
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });

  it('取引が 0 件でも資産残高があれば、最新の残高月を基準月にする', () => {
    const screen = statementsScreen({
      current: emptyDataset(),
      previous: null,
      deals: [],
      balances: [
        {
          month: '2026-08',
          date: '2026-08-28',
          side: 'asset',
          category: '預金・現金',
          amount: 5_000_000,
          source: 'mf',
        },
      ],
    });
    expect(screen.bs).toMatchObject({ referenceMonth: '2026-08', asOf: '2026-08-28', assetTotal: 5_000_000 });
  });
});

describe('CF の可否と原因', () => {
  const period = { from: '2025-09', to: '2026-08' };
  const mfTx = (i: number, month: string): MfTx => ({
    id: `mf-${i}`,
    m: month,
    d: `${month.slice(5)}/10`,
    c: '架空の店',
    a: -1000,
    // ルールにも中項目にも当たらない (既定のまま = 未仕訳)
    big: '架空大項目',
    mid: '架空中項目',
    isTarget: true,
    isTransfer: false,
  });

  it('未仕訳 12 件・現金口座の欠け 1 か月・科目未設定 3 件・決済列あり → unavailable と各件数', () => {
    const deals = fixtureDeals().filter((d) => CUR_MONTHS.includes(d.month));
    const unset = [1, 2, 3].map((i) =>
      deal({ month: '2026-03', date: `2026-03-0${i}`, accountRaw: '', accountNorm: '', amount: 1000 }),
    );
    const all = buildAll(deals);
    all.mfTx = Array.from({ length: 12 }, (_, i) => mfTx(i, CUR_MONTHS[i]));
    // 集計対象外の明細は数えない
    all.mfTx.push({ ...mfTx(99, '2026-01'), isTarget: false }, { ...mfTx(98, '2026-01'), isTransfer: true });
    all.unrecordedExpMonths = ['2026-02'];
    const s = statementsScreen({
      current: applyPeriod(all, period),
      previous: null,
      deals: [...deals, ...unset],
      balances: [],
    });
    expect(s.cf).toEqual({
      status: 'unavailable',
      causes: { unclassified: 12, missingCash: { months: 1, settlementUnknown: false }, accountUnset: 3 },
      limits: expect.any(Array),
    });
    expect(s.kpis.cashChange.value).toBeNull();
  });

  it('原因が 1 つも無ければ available で、営業 CF 概算の月と合計を返す', () => {
    const deals = fixtureDeals().filter((d) => CUR_MONTHS.includes(d.month));
    const all = buildAll(deals);
    const s = statementsScreen({ current: applyPeriod(all, period), previous: null, deals, balances: [] });
    expect(s.cf.status).toBe('available');
    if (s.cf.status !== 'available') return;
    expect(s.cf.months).toHaveLength(12);
    // 利益は PL の営業利益と月ごとに一致する (期末商品棚卸高を経費として足さない)
    expect(s.cf.months.map((m) => m.profit)).toEqual(rowOf(s, 'operating').monthly.map((m) => m.amount));
    expect(s.cf.total).toBe(1_820_000);
    expect(s.cf.cumulative).toHaveLength(12);
    expect(s.cf.cumulative.at(-1)).toBe(s.cf.total);
    expect(s.cf.limits.some((limit) => limit.includes('期首を0'))).toBe(true);
    expect(s.kpis.cashChange.value).toBe(1_820_000);
  });

  it('決済列の無い取込だけ (settlementUnknown) でも unavailable', () => {
    const deals = fixtureDeals()
      .filter((d) => CUR_MONTHS.includes(d.month))
      .map(({ dueDate, settledDate, settleAccount, settledAmount, ...rest }) => rest);
    const all = buildAll(deals);
    const s = statementsScreen({ current: applyPeriod(all, period), previous: null, deals, balances: [] });
    expect(s.cf).toEqual({
      status: 'unavailable',
      causes: { unclassified: 0, missingCash: { months: 0, settlementUnknown: true }, accountUnset: 0 },
      limits: expect.any(Array),
    });
  });

  it('期間外の未仕訳・欠け月は数えない', () => {
    const deals = fixtureDeals();
    const all = buildAll(deals);
    all.mfTx = [mfTx(1, '2024-10')];
    all.unrecordedExpMonths = ['2024-11'];
    const s = statementsScreen({
      current: applyPeriod(all, period),
      previous: applyPeriod(all, PREVIOUS),
      deals,
      balances: [],
    });
    expect(s.cf.status).toBe('available');
  });
});
