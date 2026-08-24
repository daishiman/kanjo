/** 公私判定の区分 */
export type Cls = 'biz' | 'per';

/** MF明細（HTML版の mfTx 要素と同一形状） */
export interface MfTx {
  /** MFのID列。無ければ `${month}_${row}_${amount}` の合成キー */
  id: string;
  /** 'YYYY-MM' */
  m: string;
  /** 'MM/DD'（表示用） */
  d: string;
  /** 内容（40文字まで） */
  c: string;
  /** 金額。正=収入 / 負=支出 */
  a: number;
  /** 大項目 */
  big: string;
  /** 中項目 */
  mid: string;
}

/** 仕分けルール。配列の並び順＝評価順（先勝ち） */
export interface Rule {
  k: string;
  cls: Cls;
}

/** freee仕訳1行 */
export interface FreeeDeal {
  month: string;
  date: string;
  io: 'income' | 'expense';
  partner: string;
  accountRaw: string;
  accountNorm: string;
  amount: number;
}

/** 判定結果 */
export interface Classification {
  cls: Cls;
  src: '手動' | 'ルール' | '既定';
}

export interface PersonalMonth {
  income: Record<string, number>;
  expense: Record<string, number>;
}

export interface BizPersonalMonth {
  income: number;
  expense: number;
}

/**
 * 集計・分析の入力となる統合データセット。
 * HTML版の DATA グローバルと同一形状（＝統合JSONの形状）。
 */
export interface Dataset {
  months: string[];
  biz: {
    revenue: number[];
    categories: string[];
    expense: Record<string, number[]>;
  };
  subs: {
    vendors: string[];
    matrix: Record<string, number[]>;
    other: number[];
  };
  personal: Record<string, PersonalMonth>;
  bizPersonal: Record<string, BizPersonalMonth>;
  mfTx: MfTx[];
  rules: Rule[];
  overrides: Record<string, Cls>;
  budgets: Record<string, number>;
  cashOverride: Record<string, { revenue: number; expense: number }>;
  unrecordedExpMonths: string[];
}

/** 科目別統計プロファイル（HTML版 catProfile の戻り値） */
export interface CatProfile {
  mean: number;
  sd: number;
  cv: number;
  med: number;
  rAvg: number;
  pAvg: number;
  slope: number;
  z: number;
  lastVal: number;
  type: '固定費' | '準変動' | 'スポット';
  total: number;
}

export function emptyDataset(): Dataset {
  return {
    months: [],
    biz: { revenue: [], categories: [], expense: {} },
    subs: { vendors: [], matrix: {}, other: [] },
    personal: {},
    bizPersonal: {},
    mfTx: [],
    rules: [],
    overrides: {},
    budgets: {},
    cashOverride: {},
    unrecordedExpMonths: [],
  };
}

/** HTML版の初期ルール（新規ユーザーの既定値） */
export const DEFAULT_RULES: Rule[] = [
  '事業経費',
  '事業・副業',
  'ANTHROPIC',
  'OPENAI',
  'OPEN AI',
  'アドビ',
  'ADOBE',
  'AMAZON WEB',
  'CURSOR',
  'ラボラトス',
].map((k) => ({ k, cls: 'biz' as const }));

/** HTML版の既定サブスクベンダー一覧（freee取込時の振り分け先） */
export const DEFAULT_SUB_VENDORS: string[] = [
  'Anthropic',
  'Open AI',
  'Cursor',
  'note株式会社',
  'Twitter',
  'Adobe',
  'Limitless',
  'KandaQuntum',
];

/** 科目正規化の既定マップ（支払手数料/通信費 → サブスク・通信） */
export const DEFAULT_ACCOUNT_NORM: Record<string, string> = {
  支払手数料: 'サブスク・通信',
  通信費: 'サブスク・通信',
};
