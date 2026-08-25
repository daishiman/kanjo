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
  /** 保有金融機関（MFの口座名。名義の判定根拠） */
  inst?: string;
}

/** 名義。MFの保有金融機関(口座名)を設定で対応付けて決める。データに無い区分は増やさない */
export type Owner = 'self' | 'spouse';

/** 名義の表示名 */
export type OwnerKey = Owner | 'unset';
export interface OwnerMonth {
  income: number;
  expense: number;
}
export const OWNER_LABEL: Record<Owner | 'unset', string> = { self: '本人', spouse: '妻', unset: '未設定' };

/**
 * 仕分けルール。配列の並び順＝評価順（先勝ち）。
 * 属性ごとに「その属性を持つ最初のルール」が採用される（cls だけのルールと 大項目だけのルールは共存できる）。
 */
export interface Rule {
  k: string;
  cls: Cls | null;
  big?: string | null;
  mid?: string | null;
  owner?: Owner | null;
}

/**
 * 明細1件への手動編集（取込値とは別枠で保持し、再取込でも消えない）。
 * baseBig/baseMid は編集時点の取込値。現在の取込値と違えば「取込側が変わった」と分かる。
 */
export interface TxEdit {
  cls?: Cls | null;
  big?: string | null;
  mid?: string | null;
  owner?: Owner | null;
  baseBig?: string | null;
  baseMid?: string | null;
  note?: string | null;
  updatedAt?: string | null;
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
  /** 手動の公私判定（HTML版互換。edits から導出される） */
  overrides: Record<string, Cls>;
  /** 明細IDごとの手動編集（公私・大項目・中項目・名義） */
  edits: Record<string, TxEdit>;
  /** 保有金融機関 → 名義 */
  institutionOwners: Record<string, Owner>;
  /** 個人分の名義別(本人/妻/未設定)の月別 収入・支出（edits/rules/institutionOwners から導出） */
  personalByOwner: Record<string, Record<OwnerKey, OwnerMonth>>;
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
    edits: {},
    institutionOwners: {},
    personalByOwner: {},
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
