/**
 * 家計収支画面 (spec-household-cashflow-screen) の core 契約テスト (SYS-HOUSEHOLD-P04)。
 *
 * spec §3〜§7 のフィクスチャを Dataset として組み、`householdSummary` の出力を `toBe` で比べる。
 * 期待値は spec の**計算値**であり、画像の読み取り値ではない (design-decisions §1.2)。
 * 事業と個人の純収支だけは spec の数値が自己矛盾するため、R4 の決定値 (+¥571,000 / +¥185,000) を使う。
 *
 * | 受入 / 不変条件 | テスト |
 * |---|---|
 * | 受入1 フィクスチャの一致 (KPI・内訳・カテゴリ表・名義別・前年比較) | `受入1` |
 * | 受入2 家計全体 = 総収支画面の総合 | `不変条件1` |
 * | 受入3 食費を選ぶと詳細 (5 件・合計・すべて見る) | `受入3` |
 * | 受入4 振替が全件一覧に出て台帳に 1 件も無い | `受入4` / `不変条件5` |
 * | 受入7 前年欠損で比較値が null | `受入7` |
 * | 不変条件 2〜4 | `不変条件2` `不変条件3` `不変条件4` |
 * | 持ち越し OI-02 丸めない比 / OI-04 対推定の同点解消 | `OI-02` `OI-04` |
 *
 * 旧実装 (旧 household 集計と `OWNER_LABEL`) には `householdSummary` が無く、本ファイルは import の時点で落ちる。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HOUSEHOLD_CATEGORY_MAP } from '../src/household-summary.js';
import {
  DEFAULT_OWNER_LABELS,
  type Dataset,
  type FreeeDeal,
  HOUSEHOLD_CATEGORY_KEYS,
  HOUSEHOLD_DETAIL_LIMIT,
  type MfTx,
  type OwnerKey,
  TRANSFER_UNKNOWN_LABEL,
  emptyDataset,
  householdCategoryDetail,
  householdCategoryOfTx,
  householdSummary,
  pairTransfers,
  periodMonths,
  totalCashflowLedger,
  totalCashflowScreen,
} from '../src/index.js';

const RANGE = { from: '2025-09', to: '2026-08' };
const PREV_RANGE = { from: '2024-09', to: '2025-08' };
const CUR = periodMonths(RANGE);
const PREV = periodMonths(PREV_RANGE);
const LAST = '2026-08';

/** 口座と名義の対応。名義は口座から決まる (institutionOwners) */
const ACCOUNT: Record<Exclude<OwnerKey, 'unset'>, string> = {
  business: '本人 普通預金',
  spouse: 'パートナー 普通預金',
  family: '子ども 普通預金',
};

/**
 * 期間合計 `total` を 12 か月へ配る。最終月 (2026-08) だけ `last` に固定し、残りを 11 か月へ均等に配る。
 * 割り切れない端数は最初の月へ寄せる (合計は必ず `total` に一致する)。
 */
function spread(total: number, last?: number): number[] {
  if (last === undefined) {
    const base = Math.floor(total / 12);
    return [total - base * 11, ...Array(11).fill(base)];
  }
  const base = Math.floor((total - last) / 11);
  return [total - last - base * 10, ...Array(10).fill(base), last];
}

let seq = 0;
const mf = (month: string, day: number, a: number, over: Partial<MfTx> = {}): MfTx => {
  seq += 1;
  return {
    id: `mf-${String(seq).padStart(4, '0')}`,
    idStable: true,
    m: month,
    d: `${month.slice(5, 7)}/${String(day).padStart(2, '0')}`,
    c: '明細',
    a,
    big: '日用品',
    mid: '',
    inst: ACCOUNT.business,
    isTarget: true,
    isTransfer: false,
    ...over,
  };
};

const deal = (month: string, io: FreeeDeal['io'], amount: number): FreeeDeal => ({
  month,
  date: `${month}-28`,
  io,
  partner: io === 'income' ? '架空商事' : '架空外注',
  accountRaw: io === 'income' ? '売上高' : '外注費',
  accountNorm: io === 'income' ? '売上高' : '外注費',
  amount,
});

/** 生活費の区分ごとの大項目 (区分の対応表のうち 1 つ) と、家計側の「その他」に入る大項目 */
const MAJOR = {
  housing: '住まい',
  food: '食費',
  utilities: '水道・光熱費',
  education: '教養・教育',
  transport: '交通費',
  other: '日用品',
} as const;

interface YearPlan {
  months: string[];
  bizIncome: number[];
  bizExpense: number[];
  /** 個人の収入 (MF)。名義ごと */
  income: Record<Exclude<OwnerKey, 'unset'>, number[]>;
  /** 家計側の支出 (MF)。区分ごと。other は家計の残り */
  expense: Record<keyof typeof MAJOR, number[]>;
}

/*
 * 当期 (2025-09〜2026-08) の年額。spec §3・§5.2・§6.1・§4.5 と R4:
 *   総収入 6,480,000 = 事業 2,275,000 (freee) + 個人 4,205,000 (MF)
 *   名義: 本人 3,600,000 = freee 2,275,000 + MF 1,325,000 / パートナー 2,640,000 / 子ども 240,000
 *   総支出 5,724,000 = 住居費 1,440,000 + 食費 960,000 + 光熱費 300,000 + 教育費 720,000
 *                     + 交通費 480,000 + その他 1,824,000 (事業 1,704,000 + 家計の残り 120,000)
 * 最終月は選択中の月の純収支 +¥68,000 (§8) になるよう置く:
 *   収入 185,000 + 110,000 + 220,000 + 20,000 = 535,000
 *   支出 142,000 + 120,000 + 80,000 + 25,000 + 60,000 + 40,000 + 0 = 467,000
 */
const CURRENT: YearPlan = {
  months: CUR,
  bizIncome: spread(2_275_000, 185_000),
  bizExpense: spread(1_704_000, 142_000),
  income: {
    business: spread(1_325_000, 110_000),
    spouse: spread(2_640_000, 220_000),
    family: spread(240_000, 20_000),
  },
  expense: {
    housing: spread(1_440_000, 120_000),
    food: spread(960_000, 80_000),
    utilities: spread(300_000, 25_000),
    education: spread(720_000, 60_000),
    transport: spread(480_000, 40_000),
    other: spread(120_000, 0),
  },
};

/*
 * 前年 (2024-09〜2025-08)。総収入 6,200,000 / 総支出 5,364,000。
 *   名義: 本人 3,480,000 = freee 2,200,000 + MF 1,280,000 / パートナー 2,520,000 / 子ども 200,000
 *   区分: 住居費 1,380,000 / 食費 840,000 / 光熱費 280,000 / 教育費 660,000 / 交通費 450,000
 *         / その他 1,754,000 = 事業 1,650,000 + 家計の残り 104,000
 * 事業の前年の内訳は spec に無い。前年の総額と区分・名義の値だけが spec の値。
 */
const PREVIOUS: YearPlan = {
  months: PREV,
  bizIncome: spread(2_200_000),
  bizExpense: spread(1_650_000),
  income: { business: spread(1_280_000), spouse: spread(2_520_000), family: spread(200_000) },
  expense: {
    housing: spread(1_380_000),
    food: spread(840_000),
    utilities: spread(280_000),
    education: spread(660_000),
    transport: spread(450_000),
    other: spread(104_000),
  },
};

/** 最終月の食費を 6 件に割る (詳細の 5 件打ち切りを確かめる)。最初の 1 件は子どもの口座 */
const LAST_FOOD = [
  { day: 2, amount: 12_000, c: 'スーパーでの買い物', memo: '架空スーパー', inst: ACCOUNT.family },
  { day: 4, amount: 18_000, c: '外食', memo: '架空食堂', inst: ACCOUNT.business },
  { day: 6, amount: 9_000, c: 'ドラッグストア食品', memo: '', inst: ACCOUNT.spouse },
  { day: 8, amount: 15_000, c: 'スーパーでの買い物', memo: '架空スーパー', inst: ACCOUNT.business },
  { day: 11, amount: 16_000, c: '宅配', memo: '架空宅配', inst: ACCOUNT.business },
  { day: 14, amount: 10_000, c: 'パン屋', memo: '架空ベーカリー', inst: ACCOUNT.business },
];

/**
 * 振替 (台帳に入らない)。最終月に組が 2 つ、相手の無い出金が 1 つ。前月にも 1 組置き、
 * 一覧が選択月だけに絞られることを確かめる。
 */
function transfers(): MfTx[] {
  const t = (month: string, day: number, a: number, inst: string, c: string) =>
    mf(month, day, a, { inst, c, big: '現金・カード', mid: '口座振替', isTransfer: true });
  return [
    t(LAST, 10, -50_000, ACCOUNT.business, '本人→パートナー'),
    t(LAST, 10, 50_000, ACCOUNT.spouse, '本人→パートナー'),
    t(LAST, 18, -30_000, ACCOUNT.spouse, 'パートナー→本人'),
    t(LAST, 19, 30_000, ACCOUNT.business, 'パートナー→本人'),
    t(LAST, 25, -12_000, ACCOUNT.business, '口座振替'),
    t('2026-07', 5, -40_000, ACCOUNT.business, '本人→パートナー'),
    t('2026-07', 6, 40_000, ACCOUNT.spouse, '本人→パートナー'),
  ];
}

function build(plan: YearPlan, txs: MfTx[], deals: FreeeDeal[]): void {
  plan.months.forEach((month, i) => {
    if (plan.bizIncome[i]) deals.push(deal(month, 'income', plan.bizIncome[i]!));
    if (plan.bizExpense[i]) deals.push(deal(month, 'expense', plan.bizExpense[i]!));
    for (const owner of ['business', 'spouse', 'family'] as const) {
      const v = plan.income[owner][i]!;
      if (v) txs.push(mf(month, 15, v, { c: '給与', big: '収入', mid: '給与', inst: ACCOUNT[owner] }));
    }
    for (const key of Object.keys(MAJOR) as (keyof typeof MAJOR)[]) {
      const v = plan.expense[key][i]!;
      if (!v) continue;
      if (key === 'food' && month === LAST) {
        for (const f of LAST_FOOD)
          txs.push(mf(month, f.day, -f.amount, { c: f.c, memo: f.memo, big: MAJOR.food, inst: f.inst }));
        continue;
      }
      txs.push(mf(month, 20, -v, { c: `${MAJOR[key]}の支払`, big: MAJOR[key] }));
    }
  });
}

function dataset(txs: MfTx[], months: string[]): Dataset {
  const data = emptyDataset();
  data.months = months;
  data.biz.revenue = months.map(() => 0);
  data.subs.other = months.map(() => 0);
  data.mfTx = txs;
  data.institutionOwners = {
    [ACCOUNT.business]: 'business',
    [ACCOUNT.spouse]: 'spouse',
    [ACCOUNT.family]: 'family',
  };
  return data;
}

function fixture(opts: { previous?: 'full' | 'none' | 'lastOnly' } = {}) {
  seq = 0;
  const txs: MfTx[] = [];
  const deals: FreeeDeal[] = [];
  const previous = opts.previous ?? 'full';
  let prevMonths: string[] = [];
  if (previous === 'full') {
    build(PREVIOUS, txs, deals);
    prevMonths = PREV;
  } else if (previous === 'lastOnly') {
    // 前年は 2025-08 の 1 か月だけ記帳済み (期間全体としては欠損)
    const only = PREV.length - 1;
    const pick = <T>(xs: T[]) => xs.map((v, i) => (i === only ? v : 0)) as T[];
    build(
      {
        months: PREV,
        bizIncome: pick(PREVIOUS.bizIncome),
        bizExpense: pick(PREVIOUS.bizExpense),
        income: {
          business: pick(PREVIOUS.income.business),
          spouse: pick(PREVIOUS.income.spouse),
          family: pick(PREVIOUS.income.family),
        },
        expense: {
          housing: pick(PREVIOUS.expense.housing),
          food: pick(PREVIOUS.expense.food),
          utilities: pick(PREVIOUS.expense.utilities),
          education: pick(PREVIOUS.expense.education),
          transport: pick(PREVIOUS.expense.transport),
          other: pick(PREVIOUS.expense.other),
        },
      },
      txs,
      deals,
    );
    prevMonths = [PREV[only]!];
  }
  build(CURRENT, txs, deals);
  txs.push(...transfers());
  const all = dataset(txs, [...prevMonths, ...CUR]);
  return { all, deals, verdicts: [], exclusions: [], range: RANGE } as const;
}

const round1 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 1000) / 10);

describe('受入1: フィクスチャを流すと spec の表と一致する', () => {
  const s = householdSummary(fixture());

  it('KPI (総収入・総支出・純収支と月平均)', () => {
    expect(s.summary.total).toEqual({ income: 6_480_000, expense: 5_724_000, balance: 756_000 });
    expect(s.summary.recordedMonths).toBe(12);
    expect(s.summary.ledgerRowCount).toBeGreaterThan(0);
    expect(s.summary.monthlyAverage).toEqual({ income: 540_000, expense: 477_000, balance: 63_000 });
    expect(s.summary.annualized).toEqual({ income: 6_480_000, expense: 5_724_000, balance: 756_000 });
  });

  it('前年より: 純収支 −¥80,000 (−9.6%)、収入 +¥280,000・支出 +¥360,000', () => {
    expect(s.summary.previousYear).toEqual({ income: 6_200_000, expense: 5_364_000, balance: 836_000 });
    expect(s.summary.change?.balance.diff).toBe(-80_000);
    expect(round1(s.summary.change?.balance.rate)).toBe(-9.6);
    expect(s.summary.change?.income.diff).toBe(280_000);
    expect(s.summary.change?.expense.diff).toBe(360_000);
  });

  it('事業と個人: 収入は 35.1% / 64.9%、純収支は R4 の決定値 +¥571,000 / +¥185,000', () => {
    expect(s.segments.biz.income).toBe(2_275_000);
    expect(s.segments.personal.income).toBe(4_205_000);
    expect(round1(s.segments.biz.incomeShare)).toBe(35.1);
    expect(round1(s.segments.personal.incomeShare)).toBe(64.9);
    expect(s.segments.biz.balance).toBe(571_000);
    expect(s.segments.personal.balance).toBe(185_000);
  });

  it('生活費カテゴリ: 6 区分の固定順・当期・前年・増減・構成比', () => {
    expect(s.categories.map((c) => c.label)).toEqual([
      '住居費',
      '食費',
      '光熱費',
      '教育費',
      '交通費',
      'その他',
    ]);
    expect(s.categories.map((c) => [c.key, c.current, c.previous, c.diff])).toEqual([
      ['housing', 1_440_000, 1_380_000, 60_000],
      ['food', 960_000, 840_000, 120_000],
      ['utilities', 300_000, 280_000, 20_000],
      ['education', 720_000, 660_000, 60_000],
      ['transport', 480_000, 450_000, 30_000],
      ['other', 1_824_000, 1_754_000, 70_000],
    ]);
    const byKey = new Map(s.categories.map((c) => [c.key, c]));
    expect(round1(byKey.get('housing')?.share)).toBe(25.2);
    expect(round1(byKey.get('other')?.share)).toBe(31.9);
    expect(round1(byKey.get('food')?.rate)).toBe(14.3);
  });

  it('既定の選択区分は前年差が最大の食費', () => {
    expect(s.defaultCategory).toBe('food');
  });

  it('名義別の収入: 既定の表示名と当期・前年・増減', () => {
    expect(s.owners.map((o) => [o.owner, o.label, o.current, o.previous, o.diff])).toEqual([
      ['business', '本人', 3_600_000, 3_480_000, 120_000],
      ['spouse', 'パートナー', 2_640_000, 2_520_000, 120_000],
      ['family', '子ども', 240_000, 200_000, 40_000],
      ['unset', 'その他', 0, 0, 0],
    ]);
    expect(s.labels).toEqual(DEFAULT_OWNER_LABELS);
  });

  it('選択中の月は期間の最終月で、その月の純収支は +¥68,000', () => {
    expect(s.selectedMonth).toBe(LAST);
    expect(s.series.find((r) => r.month === LAST)?.total.balance).toBe(68_000);
    expect(s.series).toHaveLength(12);
  });

  it('期間外・壊れた月の指定は最終月へ寄せる', () => {
    expect(householdSummary({ ...fixture(), month: '2024-01' }).selectedMonth).toBe(LAST);
    expect(householdSummary({ ...fixture(), month: '2026-13' }).selectedMonth).toBe(LAST);
    expect(householdSummary({ ...fixture(), month: '2026-02' }).selectedMonth).toBe('2026-02');
  });

  it('保存済みの表示名は名義・振替の両方に効く (部分指定は既定で補う)', () => {
    const t = householdSummary({ ...fixture(), labels: { business: 'わたし' } });
    expect(t.labels.business).toBe('わたし');
    expect(t.labels.spouse).toBe('パートナー');
    expect(t.owners[0]?.label).toBe('わたし');
    expect(t.transfers.rows[0]?.from.label).toBe('わたし');
  });
});

describe('不変条件 (spec §12)', () => {
  const input = fixture();
  const s = householdSummary(input);

  it('不変条件1: 家計全体 = 総収支画面の総合 (同じ Dataset・期間)', () => {
    const screen = totalCashflowScreen(input.all, input.deals, [], [], RANGE);
    expect(s.summary.total.income).toBe(screen.summary.total.income);
    expect(s.summary.total.expense).toBe(screen.summary.total.expense);
    expect(s.summary.total.balance).toBe(screen.summary.total.balance);
  });

  it('不変条件2: 全月と期間合計で 事業 + 個人 = 家計全体', () => {
    const broken = s.series.filter(
      (r) =>
        r.biz.income + r.personal.income !== r.total.income ||
        r.biz.expense + r.personal.expense !== r.total.expense ||
        r.biz.balance + r.personal.balance !== r.total.balance,
    );
    // 0 件の違反が「12 か月を調べた結果」であることを件数で固定する
    expect(s.series).toHaveLength(12);
    expect(broken).toEqual([]);
    expect(s.segments.biz.balance + s.segments.personal.balance).toBe(s.summary.total.balance);
  });

  it('不変条件3: 6 区分の和 = 総支出 (前年も)', () => {
    expect(s.categories.reduce((a, c) => a + c.current, 0)).toBe(s.summary.total.expense);
    expect(s.categories.reduce((a, c) => a + (c.previous ?? 0), 0)).toBe(s.summary.previousYear?.expense);
  });

  it('不変条件4: 名義別の和 = 総収入 (前年も)', () => {
    expect(s.owners.reduce((a, o) => a + o.current, 0)).toBe(s.summary.total.income);
    expect(s.owners.reduce((a, o) => a + (o.previous ?? 0), 0)).toBe(s.summary.previousYear?.income);
  });

  it('不変条件5: 振替の明細は台帳に 1 件も現れない', () => {
    const transferIds = new Set(input.all.mfTx.filter((t) => t.isTransfer).map((t) => t.id));
    expect(transferIds.size).toBe(7);
    const { ledger } = totalCashflowLedger(input.all, input.deals);
    expect(ledger.rows.length).toBeGreaterThan(0);
    expect(ledger.rows.filter((r) => r.txId && transferIds.has(r.txId))).toEqual([]);
  });

  it('事業側の支出は大項目が食費でも「その他」に入る (R5)', () => {
    const data = fixture();
    data.all.mfTx.push(
      mf(LAST, 3, -7_000, { c: '会食', big: '食費', mid: '事業経費', inst: ACCOUNT.business }),
    );
    const t = householdSummary(data);
    expect(t.categories.find((c) => c.key === 'food')?.current).toBe(960_000);
    expect(t.categories.find((c) => c.key === 'other')?.current).toBe(1_831_000);
    expect(t.categories.reduce((a, c) => a + c.current, 0)).toBe(t.summary.total.expense);
  });
});

describe('受入3: カテゴリの詳細', () => {
  const d = householdCategoryDetail({ ...fixture(), key: 'food' });

  it('選択月の主な取引を日付順に最大 5 件、合計は全件の和', () => {
    expect(d.label).toBe('食費');
    expect(d.month).toBe(LAST);
    expect(d.totalCount).toBe(6);
    expect(d.transactions).toHaveLength(HOUSEHOLD_DETAIL_LIMIT);
    expect(d.monthTotal).toBe(80_000);
    expect(d.transactions.map((t) => t.date)).toEqual([
      '2026-08-02',
      '2026-08-04',
      '2026-08-06',
      '2026-08-08',
      '2026-08-11',
    ]);
  });

  it('主な取引の名義は表示名、取引先はメモ (空なら不明)', () => {
    expect(d.transactions[0]).toEqual({
      date: '2026-08-02',
      description: 'スーパーでの買い物',
      amount: 12_000,
      payee: '架空スーパー',
      owner: { owner: 'family', label: '子ども' },
    });
    expect(d.transactions[2]?.payee).not.toBe('');
  });

  it('前年比と「すべて見る」のリンク', () => {
    expect(d.current).toBe(960_000);
    expect(d.diff).toBe(120_000);
    expect(round1(d.rate)).toBe(14.3);
    expect(d.detailHref).toBe('/classify?month=2026-08&big=食費');
    expect(d.rule.note).toBe(
      '「食費」に該当する取引（食料品・外食・飲料等）を自動で分類して集計しています。',
    );
  });

  it('その他は家計の残りと事業の支出に分けて示す', () => {
    const other = householdCategoryDetail({ ...fixture(), key: 'other' });
    expect(other.breakdown).toEqual({ household: 120_000, business: 1_704_000 });
    // 大項目で列挙できない区分は区分キーで渡す (条件が無いと月の全明細が出てしまう)
    expect(other.detailHref).toBe('/classify?month=2026-08&hcat=other');
  });

  it('明細の 1 行の区分判定は集計と同じ (事業側は大項目が食費でも「その他」)', () => {
    expect(householdCategoryOfTx({ cls: 'per', big: '食費' })).toBe('food');
    expect(householdCategoryOfTx({ cls: 'biz', big: '食費' })).toBe('other');
    expect(householdCategoryOfTx({ cls: 'per', big: '日用品' })).toBe('other');
    expect(householdCategoryOfTx({ cls: 'per', big: null })).toBe('other');
  });

  it('大項目が複数の区分は big を並べる', () => {
    expect(householdCategoryDetail({ ...fixture(), key: 'housing' }).detailHref).toBe(
      '/classify?month=2026-08&big=住まい&big=住宅ローン&big=住宅購入&big=住宅',
    );
  });
});

describe('受入4: 振替は収入・支出から除外して一覧に出す', () => {
  const s = householdSummary(fixture());

  it('選択月の振替を全件、組と相手不明で示す', () => {
    expect(s.transfers.month).toBe(LAST);
    expect(s.transfers.totalCount).toBe(3);
    expect(s.transfers.rows.map((r) => [r.date, r.amount, r.from.label, r.to.label, r.paired])).toEqual([
      ['2026-08-10', 50_000, '本人', 'パートナー', true],
      ['2026-08-18', 30_000, 'パートナー', '本人', true],
      ['2026-08-25', 12_000, '本人', TRANSFER_UNKNOWN_LABEL, false],
    ]);
  });

  it('選択月を変えると一覧もその月に絞られる', () => {
    const july = householdSummary({ ...fixture(), month: '2026-07' });
    expect(july.transfers.rows.map((r) => [r.date, r.amount, r.paired])).toEqual([
      ['2026-07-05', 40_000, true],
    ]);
  });

  it('振替を足しても総収入・総支出は変わらない', () => {
    const data = fixture();
    data.all.mfTx.push(
      mf(LAST, 27, -999_000, { isTransfer: true, big: '現金・カード' }),
      mf(LAST, 27, 999_000, { isTransfer: true, big: '現金・カード', inst: ACCOUNT.spouse }),
    );
    expect(householdSummary(data).summary.total).toEqual(s.summary.total);
  });
});

describe('OI-04: 振替の対推定の同点解消', () => {
  const owner = (tx: MfTx): OwnerKey => (tx.inst === ACCOUNT.spouse ? 'spouse' : 'business');
  const t = (id: string, date: string, a: number, inst = ACCOUNT.business): MfTx => ({
    ...mf(date.slice(0, 7), Number(date.slice(8)), a, { inst, isTransfer: true }),
    id,
  });

  it('日付差の小さい組を先に確定し、1 明細は 1 組にしか入らない', () => {
    const rows = pairTransfers(
      [
        t('out-a', '2026-08-10', -10_000),
        t('in-far', '2026-08-13', 10_000, ACCOUNT.spouse),
        t('in-near', '2026-08-11', 10_000, ACCOUNT.spouse),
      ],
      owner,
    );
    expect(rows.map((r) => [r.date, r.paired, r.from.label, r.to.label])).toEqual([
      ['2026-08-10', true, '本人', 'パートナー'],
      ['2026-08-13', false, TRANSFER_UNKNOWN_LABEL, 'パートナー'],
    ]);
  });

  it('日付差が同じなら出金側の id → 入金側の id の昇順', () => {
    const rows = pairTransfers(
      [
        t('out-b', '2026-08-10', -5_000),
        t('out-a', '2026-08-10', -5_000),
        t('in-b', '2026-08-10', 5_000, ACCOUNT.spouse),
        t('in-a', '2026-08-10', 5_000, ACCOUNT.spouse),
      ],
      owner,
    );
    expect(rows.every((r) => r.paired)).toBe(true);
    expect(rows).toHaveLength(2);
  });

  it('3 日を超える差・金額違い・同符号は組にしない', () => {
    const rows = pairTransfers(
      [
        t('o1', '2026-08-01', -8_000),
        t('i1', '2026-08-05', 8_000, ACCOUNT.spouse),
        t('o2', '2026-08-10', -8_000),
        t('i2', '2026-08-10', 8_001, ACCOUNT.spouse),
        t('o3', '2026-08-20', -3_000),
        t('o4', '2026-08-20', -3_000),
      ],
      owner,
    );
    expect(rows.filter((r) => r.paired)).toEqual([]);
    expect(rows).toHaveLength(6);
  });

  it('入力順を入れ替えても結果は同じ (決定論)', () => {
    const txs = [
      t('x1', '2026-08-10', -7_000),
      t('x2', '2026-08-11', 7_000, ACCOUNT.spouse),
      t('x3', '2026-08-12', 7_000, ACCOUNT.spouse),
      t('x4', '2026-08-12', -7_000),
    ];
    expect(pairTransfers([...txs].reverse(), owner)).toEqual(pairTransfers(txs, owner));
  });
});

describe('受入7: 前年欠損と空', () => {
  it('前年同期間に欠けた月があれば比較値は null、前年同月の実データがある月だけ前年系列を持つ', () => {
    const s = householdSummary(fixture({ previous: 'lastOnly' }));
    expect(s.summary.previousYear).toBeNull();
    expect(s.summary.change).toBeNull();
    expect(s.categories.every((c) => c.previous === null && c.diff === null && c.rate === null)).toBe(true);
    expect(s.owners.every((o) => o.previous === null && o.diff === null)).toBe(true);
    // 比較不能なら既定の区分は住居費
    expect(s.defaultCategory).toBe('housing');
    expect(s.series.filter((r) => r.previous !== null).map((r) => r.month)).toEqual([LAST]);
  });

  it('前年のデータが無ければ前年系列はすべて null', () => {
    const s = householdSummary(fixture({ previous: 'none' }));
    expect(s.series.every((r) => r.previous === null)).toBe(true);
    expect(s.summary.change).toBeNull();
  });

  it('台帳行が 0 件なら全て 0・比は null・出典は null', () => {
    const s = householdSummary({
      all: dataset([], []),
      deals: [],
      verdicts: [],
      exclusions: [],
      range: RANGE,
    });
    expect(s.summary.total).toEqual({ income: 0, expense: 0, balance: 0 });
    expect(s.summary.recordedMonths).toBe(0);
    expect(s.summary.ledgerRowCount).toBe(0);
    expect(s.summary.monthlyAverage).toEqual({ income: 0, expense: 0, balance: 0 });
    expect(s.categories.map((c) => c.share)).toEqual(HOUSEHOLD_CATEGORY_KEYS.map(() => null));
    expect(s.segments.biz.incomeShare).toBeNull();
    expect(s.sources).toBeNull();
    expect(s.transfers.rows).toEqual([]);
  });

  it('期間に振替しかなくても、集計対象の台帳行は 0 件として扱う', () => {
    const onlyTransfer = mf(LAST, 10, -50_000, {
      isTransfer: true,
      big: '現金・カード',
      mid: '口座振替',
    });
    const s = householdSummary({
      all: dataset([onlyTransfer], [LAST]),
      deals: [],
      verdicts: [],
      exclusions: [],
      range: { from: LAST, to: LAST },
    });
    expect(s.summary.recordedMonths).toBe(1);
    expect(s.summary.ledgerRowCount).toBe(0);
    expect(s.transfers.rows).toHaveLength(1);
  });
});

describe('OI-02: 比は丸めずに返す', () => {
  it('構成比の和は丸めずに 1 になる (表示で各行独立に丸める)', () => {
    const s = householdSummary(fixture());
    const sum = s.categories.reduce((a, c) => a + (c.share ?? 0), 0);
    expect(sum).toBeCloseTo(1, 12);
    expect(s.categories.find((c) => c.key === 'housing')?.share).toBe(1_440_000 / 5_724_000);
  });

  it('出典は件数の最も多い口座と、それ以外の口座の数', () => {
    const s = householdSummary(fixture());
    expect(s.sources).toEqual({ primary: ACCOUNT.business, otherCount: 2 });
  });
});

describe('区分と大項目の対応表: docs は core の写し', () => {
  it('docs/data-schema.md のマーカー内の表が HOUSEHOLD_CATEGORY_MAP と行・順序・大項目まで一致する', () => {
    const doc = readFileSync(fileURLToPath(new URL('../../../docs/data-schema.md', import.meta.url)), 'utf8');
    const block = doc
      .split('<!-- household-category-map:start -->')[1]
      ?.split('<!-- household-category-map:end -->')[0];
    expect(block, 'docs にマーカーが無い').toBeDefined();
    const rows = (block ?? '')
      .split('\n')
      .filter((line) => line.startsWith('| `'))
      .map((line) => {
        const [key = '', label = '', majors = ''] = line
          .split('|')
          .slice(1, 4)
          .map((cell) => cell.trim());
        return {
          key: key.replaceAll('`', ''),
          label,
          // `other` の大項目欄は説明文 (括弧書き) で、対応する大項目は無い
          majors: majors.startsWith('(') ? [] : majors.split('、'),
        };
      });
    expect(rows).toEqual(
      HOUSEHOLD_CATEGORY_MAP.map(({ key, label, majors }) => ({ key, label, majors: [...majors] })),
    );
  });
});
