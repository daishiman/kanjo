/**
 * AIレポートの図表のうち「科目×月」「名義×月」の集計。
 * - 画面もAPIも数値を作らず、この純関数の結果だけを描く(計算の正本は1箇所)。
 * - 未記帳月は 0 ではなく null。0 は「使わなかった」、null は「まだ入力していない」で意味が違う。
 */
import { type Dataset, OWNER_LABEL, type OwnerKey } from './types.js';

/** 科目1行分。values は months と同じ長さ */
export interface AccountMonthRow {
  account: string;
  values: (number | null)[];
  /** 期間合計(null は 0 として扱わず、単に足さない) */
  total: number;
  /** その科目の最大月額。ヒートマップの濃さは科目ごとにこの値で割る */
  max: number;
}

export interface AccountMonthMatrix {
  months: string[];
  rows: AccountMonthRow[];
}

/**
 * 科目×月の金額表(ヒートマップの元)。
 * 期間合計の大きい順に limit 件まで並べ、残りは「その他」に畳む。
 * 金額のまったく無い科目は落とす(空行を並べても読めないため)。
 */
export function accountMonthMatrix(data: Dataset, months: string[], limit = 8): AccountMonthMatrix {
  const unrecorded = new Set(data.unrecordedExpMonths);
  const idx = months.map((m) => data.months.indexOf(m));
  const valuesOf = (account: string): (number | null)[] =>
    months.map((m, i) =>
      unrecorded.has(m) || idx[i] < 0 ? null : (data.biz.expense[account]?.[idx[i]] ?? 0),
    );
  const sumOf = (values: (number | null)[]): number => values.reduce<number>((s, v) => s + (v ?? 0), 0);
  const maxOf = (values: (number | null)[]): number =>
    values.reduce<number>((m, v) => Math.max(m, v ?? 0), 0);

  const all = data.biz.categories
    .map((account) => {
      const values = valuesOf(account);
      return { account, values, total: sumOf(values), max: maxOf(values) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  if (all.length <= limit) return { months, rows: all };

  const head = all.slice(0, limit);
  const tail = all.slice(limit);
  // 「その他」も未記帳月は null のまま(足せない値を 0 として足さない)
  const otherValues = months.map((m, i) =>
    unrecorded.has(m) || idx[i] < 0
      ? null
      : tail.reduce<number>((s, r) => s + ((r.values[i] as number) ?? 0), 0),
  );
  return {
    months,
    rows: [
      ...head,
      { account: 'その他', values: otherValues, total: sumOf(otherValues), max: maxOf(otherValues) },
    ],
  };
}

/** 名義1行分 */
export interface OwnerMonthRow {
  owner: OwnerKey;
  label: string;
  values: number[];
  total: number;
}

export interface OwnerMonthSeries {
  months: string[];
  rows: OwnerMonthRow[];
  /** 名義が1つも割り当てられていない(全部「未設定」)なら true。図の読み方が変わる */
  allUnset: boolean;
}

const OWNER_ORDER: OwnerKey[] = ['business', 'spouse', 'family', 'unset'];

/**
 * 名義(事業/妻/家族/未設定)別の個人支出の月次推移。
 * 個人支出は未記帳月の概念を持たない(MF明細は取り込んだ月がそのまま実績)ので 0 埋めで返す。
 * 期間合計が 0 の名義は落とす(使っていない名義の帯を積み上げない)。
 */
export function ownerMonthlyExpense(data: Dataset, months: string[]): OwnerMonthSeries {
  const rows = OWNER_ORDER.map((owner) => {
    const values = months.map((m) => data.personalByOwner[m]?.[owner]?.expense ?? 0);
    return {
      owner,
      label: OWNER_LABEL[owner],
      values,
      total: values.reduce((s, v) => s + v, 0),
    };
  }).filter((r) => r.total > 0);
  const assigned = rows.filter((r) => r.owner !== 'unset').reduce((s, r) => s + r.total, 0);
  return { months, rows, allUnset: rows.length > 0 && assigned === 0 };
}
