/**
 * 対象期間の絞り込み。
 *
 * 取込が積み上がると全期間の集計は「去年と今年が混ざった平均」になり、
 * 今の水準を判断する役に立たなくなる。年単位・任意期間で見られるようにする。
 *
 * 設計: 各分析関数に期間引数を足すのではなく、Dataset を期間で切る。
 * 分析関数は20個以上あり、引数を足す方式では1つ足し忘れた画面だけ
 * 期間が効かないという、画面を見ても気づけないバグになる。
 * ここで切れば下流は1行も変えずに全部が期間対応になる。
 */
import type { Dataset } from './types.js';

/** 対象期間。両端を含む 'YYYY-MM' */
export interface PeriodRange {
  from: string;
  to: string;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (v: unknown): v is string => typeof v === 'string' && MONTH_RE.test(v);

/** 'YYYY-MM' の妥当性と前後関係。壊れた入力を静かに全期間へ倒さないための判定 */
export function isValidPeriod(range: unknown): range is PeriodRange {
  if (!range || typeof range !== 'object') return false;
  const r = range as Partial<PeriodRange>;
  return isMonthKey(r.from) && isMonthKey(r.to) && r.from <= r.to;
}

/** データが持つ年の一覧(新しい年が先)。年別の選択肢はここから作る */
export function availableYears(data: Dataset): string[] {
  return [...new Set(data.months.map((m) => m.slice(0, 4)))].sort().reverse();
}

/** 暦年1年ぶんの期間 */
export const yearRange = (year: string): PeriodRange => ({ from: `${year}-01`, to: `${year}-12` });

/** データ全体の期間。データが無ければ null */
export function fullRange(data: Dataset): PeriodRange | null {
  if (!data.months.length) return null;
  const sorted = [...data.months].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

/**
 * 直近 n ヶ月の期間。終点はデータの最終月で、暦の今日ではない。
 * 取込が1ヶ月遅れているとき、今日基準にすると必ず末尾が空の期間になる。
 */
export function lastMonthsRange(data: Dataset, n: number): PeriodRange | null {
  const full = fullRange(data);
  if (!full || n < 1) return null;
  const months = [...data.months].sort();
  const from = months[Math.max(0, months.length - n)];
  return { from, to: full.to };
}

/** 月キーが期間に入るか(両端を含む)。文字列比較で足りるのが 'YYYY-MM' の利点 */
const inRange = (m: string, r: PeriodRange): boolean => m >= r.from && m <= r.to;

/** Record<月, T> を期間で絞る */
function sliceByMonthKey<T>(rec: Record<string, T>, r: PeriodRange): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [m, v] of Object.entries(rec)) if (inRange(m, r)) out[m] = v;
  return out;
}

/**
 * Dataset を期間で切る。
 *
 * 月で並んだ配列(売上・科目別経費・サブスク)は同じ添字で切り、
 * 月をキーにした表(個人収支・名義別・現金上書き)はキーで絞る。
 * 設定類(ルール・手動編集・口座と名義の対応・予算)は時系列ではないのでそのまま残す。
 * 予算を落とすと、期間を絞った瞬間に予算判定が全科目「未設定」になってしまう。
 */
export function sliceDataset(data: Dataset, range: PeriodRange): Dataset {
  const keep = data.months.map((m) => inRange(m, range));
  const pick = <T>(arr: T[]): T[] => arr.filter((_, i) => keep[i]);
  const months = pick(data.months);

  // 期間内に一度も値が立たない科目は落とす。残すと表が空行だらけになり、
  // 「この期間には無かった」ことが逆に読み取りにくくなる
  const expense: Record<string, number[]> = {};
  const categories: string[] = [];
  for (const cat of data.biz.categories) {
    const series = pick(data.biz.expense[cat] ?? []);
    if (series.some((v) => v !== 0)) {
      categories.push(cat);
      expense[cat] = series;
    }
  }

  const subsMatrix: Record<string, number[]> = {};
  const vendors: string[] = [];
  for (const v of data.subs.vendors) {
    const series = pick(data.subs.matrix[v] ?? []);
    if (series.some((x) => x !== 0)) {
      vendors.push(v);
      subsMatrix[v] = series;
    }
  }

  return {
    ...data,
    months,
    biz: { revenue: pick(data.biz.revenue), categories, expense },
    subs: { ...data.subs, vendors, matrix: subsMatrix, other: pick(data.subs.other) },
    personal: sliceByMonthKey(data.personal, range),
    bizPersonal: sliceByMonthKey(data.bizPersonal, range),
    personalByOwner: sliceByMonthKey(data.personalByOwner, range),
    cashOverride: sliceByMonthKey(data.cashOverride, range),
    mfTx: data.mfTx.filter((t) => inRange(t.m, range)),
    unrecordedExpMonths: data.unrecordedExpMonths.filter((m) => inRange(m, range)),
  };
}

/**
 * 期間の指定を Dataset に適用する。range が無効・未指定なら全期間のまま返す。
 * 「壊れた指定は全期間」ではなく「指定なしは全期間」であることを呼び出し側で
 * 区別できるよう、判定は isValidPeriod を先に通すこと。
 */
export function applyPeriod(data: Dataset, range: PeriodRange | null | undefined): Dataset {
  if (!range || !isValidPeriod(range)) return data;
  return sliceDataset(data, range);
}

/* ======================== 期間指定の解決 ======================== */

/** 選べる年数の幅。1年ごと・2年ごと・3年ごと */
export const SPAN_YEARS = [1, 2, 3] as const;
export type SpanYears = (typeof SPAN_YEARS)[number];

export interface PeriodQuery {
  /** 任意期間の開始 'YYYY-MM' */
  from?: string | null;
  /** 任意期間の終了 'YYYY-MM' */
  to?: string | null;
  /** 暦年1年 'YYYY' */
  year?: string | null;
  /** 直近n年('1' | '2' | '3') */
  span?: string | null;
}

/**
 * 指定を実際の期間に解決する。優先順は 任意期間 > 年 > 直近n年。
 *
 * 年と直近n年の解決にはデータの最終月が要る。これをクライアントで解決しようとすると
 * 「期間を知るための問い合わせ自体が期間に依存する」循環になるため、
 * データを持っているサーバ側で解決する。
 */
export function resolvePeriodQuery(data: Dataset, q: PeriodQuery): PeriodRange | null {
  const range = { from: q.from ?? '', to: q.to ?? '' };
  if (isValidPeriod(range)) return range;

  if (q.year && /^\d{4}$/.test(q.year)) {
    // データに無い年を指定されたら全期間に倒す(空の画面を出しても何も分からない)
    return availableYears(data).includes(q.year) ? yearRange(q.year) : null;
  }

  if (q.span) {
    const n = Number(q.span);
    if ((SPAN_YEARS as readonly number[]).includes(n)) return lastMonthsRange(data, n * 12);
  }
  return null;
}

/** 期間の表示ラベル。'2026年1月 〜 2026年8月' */
export function periodLabel(range: PeriodRange | null): string {
  if (!range) return '全期間';
  const fmt = (m: string): string => `${m.slice(0, 4)}年${Number(m.slice(5))}月`;
  return range.from === range.to ? fmt(range.from) : `${fmt(range.from)} 〜 ${fmt(range.to)}`;
}
