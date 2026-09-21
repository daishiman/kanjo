/**
 * 決算書画面の DOM テスト用フィクスチャ (spec-statements-screen §6 の検算済みの値)。
 *
 * 期間 2025-09〜2026-08、前期 2024-09〜2025-08。月次は万円の検算値を円にしたもので、
 * 各行の月の和が期間合計に一致する (画像の月次表は閉じないので使わない)。
 */
import type { StatementsBsLine, StatementsCf, StatementsPlRow, StatementsScreen } from '@kanjo/core';
import type { StatementsResponse } from '../api.js';

export const STATEMENTS_MONTHS = [
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
];

// core 契約と同じ「千円」の検算値。画面は円値を万円に丸めて表示する。
const THOUSAND_YEN: Record<string, number[]> = {
  sales: [950, 980, 1020, 1180, 1120, 1060, 1200, 1080, 1040, 1080, 1200, 570],
  cogs: [600, 620, 640, 760, 720, 680, 760, 700, 660, 680, 760, 280],
  gross: [350, 360, 380, 420, 400, 380, 440, 380, 380, 400, 440, 290],
  sga: [210, 220, 240, 260, 230, 220, 260, 240, 220, 230, 260, 210],
  operating: [140, 140, 140, 160, 170, 160, 180, 140, 160, 170, 180, 80],
};

const monthly = (key: string) =>
  STATEMENTS_MONTHS.map((month, index) => ({
    month,
    amount: (THOUSAND_YEN[key]?.[index] ?? 0) * 1_000,
  }));

const row = (
  key: StatementsPlRow['key'],
  label: string,
  current: number,
  previous: number,
  formula: string,
  accounts: Array<Omit<StatementsPlRow['accounts'][number], 'ratio'>> = [],
): StatementsPlRow => ({
  key,
  label,
  current,
  previous,
  diff: current - previous,
  ratio: current / 12_480_000,
  formula,
  source: key === 'sales' ? '出典：仕訳データ' : '出典：損益計算書',
  accounts: accounts.map((account) => ({ ...account, ratio: account.current / 12_480_000 })),
  monthly: monthly(key),
});

export const plRows = (): StatementsPlRow[] => [
  row('sales', '売上高', 12_480_000, 11_240_000, '売上高 ＝ 売上に関する収益の合計', [
    { account: '売上高', current: 12_480_000, previous: 11_240_000 },
  ]),
  row('cogs', '売上原価', 7_860_000, 7_120_000, '売上原価 ＝ 仕入高 ＋ 期首棚卸 − 期末棚卸', [
    { account: '仕入高', current: 7_860_000, previous: 7_120_000 },
  ]),
  row('gross', '売上総利益', 4_620_000, 4_120_000, '売上総利益 ＝ 売上高 − 売上原価', [
    { account: '売上高', current: 12_480_000, previous: 11_240_000 },
    { account: '売上原価', current: -7_860_000, previous: -7_120_000 },
  ]),
  row('sga', '販管費', 2_800_000, 2_620_000, '販管費 ＝ 売上原価以外の経費の合計', [
    { account: '地代家賃', current: 1_200_000, previous: 1_200_000 },
    { account: '通信費', current: 900_000, previous: 820_000 },
    { account: '消耗品費', current: 700_000, previous: 600_000 },
  ]),
  row('operating', '営業利益', 1_820_000, 1_500_000, '営業利益 ＝ 売上総利益 − 販管費', [
    { account: '売上総利益', current: 4_620_000, previous: 4_120_000 },
    { account: '販管費', current: -2_800_000, previous: -2_620_000 },
  ]),
];

/** §6 の CF 不能 (未仕訳 12 件・現金口座の欠け 1 か月・科目未設定 3 件・決済列あり) */
export const unavailableCf: StatementsCf = {
  status: 'unavailable',
  causes: { unclassified: 12, missingCash: { months: 1, settlementUnknown: false }, accountUnset: 3 },
  limits: [],
};

/** 原因をすべて 0 にしたフィクスチャ (営業 CF 概算を出す) */
export const availableCf: StatementsCf = {
  status: 'available',
  months: STATEMENTS_MONTHS.map((month) => ({
    month,
    profit: 150_000,
    receivableIncrease: 20_000,
    payableIncrease: 10_000,
    operating: 140_000,
  })),
  cumulative: STATEMENTS_MONTHS.map((_, index) => (index + 1) * 140_000),
  total: 1_680_000,
  limits: [],
};

/** §6 の負債 (基準月 2026-08): 借入金 200 万・未払金 30 万・クレジット未払は未入力・その他は行なし */
export const liabilityLines = (): StatementsBsLine[] => [
  { category: '借入金', label: '借入金', required: true, status: 'amount', amount: 2_000_000 },
  { category: '未払金・買掛金', label: '未払金', required: true, status: 'amount', amount: 300_000 },
  {
    category: 'クレジットカード未払金',
    label: 'クレジット未払',
    required: true,
    status: 'unset',
    amount: null,
  },
  { category: 'その他の負債', label: 'その他の負債', required: false, status: 'unset', amount: null },
];

export interface ScreenOptions {
  cf?: StatementsCf;
  lines?: StatementsBsLine[];
  referenceMonth?: string;
  plMonths?: string[];
  assets?: StatementsScreen['bs']['assets'];
  asOf?: string;
  partial?: boolean;
}

const balanceSheetSources: StatementsScreen['bs']['sources'] = [
  {
    step: 1,
    name: '資産推移(全口座の残高)',
    service: 'MF',
    where: '資産 → 資産推移 → CSVダウンロード',
    url: 'https://moneyforward.com/bs/history',
    columns: ['日付', '合計（円）'],
    use: 'BSの資産の部が埋まります。',
  },
];

export function statementsScreen(options: ScreenOptions = {}): StatementsScreen {
  const lines = options.lines ?? liabilityLines();
  const complete = lines.every((line) => !line.required || line.status !== 'unset');
  const liabilityTotal = complete
    ? lines.reduce((sum, line) => sum + (line.status === 'amount' ? (line.amount ?? 0) : 0), 0)
    : null;
  const cf = options.cf ?? unavailableCf;
  const cashValue = cf.status === 'available' ? cf.total : null;
  const referenceMonth = options.referenceMonth ?? '2026-08';
  const assets = options.assets ?? [{ category: '預金・現金', amount: 5_000_000 }];
  const assetTotal = assets.reduce((sum, asset) => sum + asset.amount, 0);
  const liabilities = complete
    ? lines.flatMap((line) =>
        line.amount === null ? [] : [{ category: line.category, amount: line.amount }],
      )
    : null;
  const rows = plRows().map((plRow) => ({
    ...plRow,
    monthly:
      options.plMonths === undefined
        ? plRow.monthly
        : plRow.monthly.filter((point) => options.plMonths?.includes(point.month)),
  }));
  return {
    period: {
      from: '2025-09',
      to: '2026-08',
      label: '2025年9月 - 2026年8月',
      previous: { from: '2024-09', to: '2025-08', label: '2024年9月 - 2025年8月' },
      navigation: {
        applied: { from: '2025-09', to: '2026-08' },
        full: { from: '2024-01', to: '2026-08' },
        years: ['2024', '2025', '2026'],
        monthCount: 12,
      },
    },
    kpis: {
      sales: {
        value: 12_480_000,
        previous: 11_240_000,
        diff: 1_240_000,
        diffRate: 1_240_000 / 11_240_000,
        source: '出典：仕訳データ',
        periodLabel: '対象期間：2025年9月 - 2026年8月',
      },
      operatingProfit: {
        value: 1_820_000,
        previous: 1_500_000,
        diff: 320_000,
        diffRate: 320_000 / 1_500_000,
        source: '出典：損益計算書',
        periodLabel: '対象期間：2025年9月 - 2026年8月',
      },
      cashChange: {
        value: cashValue,
        previous: cashValue === null ? null : 1_560_000,
        diff: cashValue === null ? null : cashValue - 1_560_000,
        diffRate: null,
        source: '出典：現金収支/キャッシュフロー',
        periodLabel: '対象期間：2025年9月 - 2026年8月',
      },
      liabilities: {
        value: liabilityTotal,
        previous: 2_500_000,
        diff: liabilityTotal === null ? null : liabilityTotal - 2_500_000,
        diffRate: liabilityTotal === null ? null : (liabilityTotal - 2_500_000) / 2_500_000,
        source: '出典：貸借対照表（要入力）',
        periodLabel: `基準日：${referenceMonth.slice(0, 4)}年${Number(referenceMonth.slice(5, 7))}月末`,
        referenceMonth,
        incomplete: !complete,
      },
    },
    pl: { rows },
    cf,
    bs: {
      referenceMonth,
      asOf: options.asOf ?? (referenceMonth === '2026-07' ? '2026-07-31' : '2026-08-28'),
      partial: options.partial ?? referenceMonth !== '2026-07',
      lines,
      complete,
      assets,
      assetTotal,
      liabilities,
      liabilityTotal,
      netAssets: liabilityTotal === null ? null : assetTotal - liabilityTotal,
      sources: balanceSheetSources,
    },
  };
}

export function statementsPayload(options: ScreenOptions = {}): StatementsResponse {
  return { screen: statementsScreen(options) };
}
