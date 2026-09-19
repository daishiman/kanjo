/**
 * 家計収支画面の表示規則 (spec §3・§4・§5・§7・§9)。
 *
 * 集計は core `householdSummary` がサーバで済ませている。ここは「どう読ませるか」だけを持つ:
 * URL 状態の解釈、符号と率の表記、前年との比較の文章。DOM を持たない純関数にして、
 * 文言の分岐 (黒字/収支、増加/減少/横ばい、比較不能) をテストで網羅できるようにする。
 */
import { HOUSEHOLD_CATEGORY_KEYS, type HouseholdCategoryKey, type HouseholdSummary } from '@kanjo/core';
import type { PeriodSelection } from '../../period.js';

export type HouseholdSeg = 'all' | 'biz' | 'personal';

export const SEGMENTS: readonly { id: HouseholdSeg; label: string }[] = [
  { id: 'all', label: '家計全体' },
  { id: 'biz', label: '事業' },
  { id: 'personal', label: '個人' },
];

export interface HouseholdUrlState {
  seg: HouseholdSeg;
  /** 選択中の月。null はサーバの既定 (期間の最終月) */
  month: string | null;
  /** 選択中のカテゴリ。null は既定 (前年差が最大)、'none' は詳細を閉じた状態 */
  cat: HouseholdCategoryKey | 'none' | null;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const isCategoryKey = (v: string | null): v is HouseholdCategoryKey =>
  v !== null && (HOUSEHOLD_CATEGORY_KEYS as readonly string[]).includes(v);

/** 壊れた値は既定へ倒す。URL を手で書き換えても画面を失敗にしない */
export function readHouseholdUrl(params: URLSearchParams): HouseholdUrlState {
  const seg = params.get('seg');
  const month = params.get('month');
  const cat = params.get('cat');
  return {
    seg: seg === 'biz' || seg === 'personal' ? seg : 'all',
    month: month && MONTH_RE.test(month) ? month : null,
    cat: cat === 'none' ? 'none' : isCategoryKey(cat) ? cat : null,
  };
}

/** URL の `cat` と既定から、詳細パネルに出す区分を決める。null はパネルを閉じる */
export function selectedCategory(
  cat: HouseholdUrlState['cat'],
  fallback: HouseholdCategoryKey,
): HouseholdCategoryKey | null {
  if (cat === 'none') return null;
  return cat ?? fallback;
}

/** KPI 見出しの `（1年間）` の部分。期間タブの表示名に従う (spec §3.1) */
export function periodSpanLabel(selection: PeriodSelection): string {
  return selection.mode === 'span' ? `${selection.span}年間` : '期間内';
}

/** `+¥1,234` / `−¥1,234` / `¥0`。null は `—` */
export function signedYen(v: number | null | undefined): string {
  if (v == null) return '—';
  const n = Math.round(v);
  const body = `¥${Math.abs(n).toLocaleString('ja-JP')}`;
  return n > 0 ? `+${body}` : n < 0 ? `−${body}` : body;
}

/**
 * 率の表記。丸めは各行独立に小数 1 桁の四捨五入 (OI-02)。
 * `signed` は増減率 (`+14.3%`)、それ以外は構成比 (`16.8%`)。null は `—`
 */
export function percent(v: number | null | undefined, signed = false): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 1000) / 10;
  const body = `${Math.abs(r).toFixed(1)}%`;
  if (!signed) return `${r < 0 ? '−' : ''}${body}`;
  return r > 0 ? `+${body}` : r < 0 ? `−${body}` : body;
}

/** 増減額と率を 1 つに: `+¥120,000 (+14.3%)`。率が無ければ額だけ */
export function diffWithRate(diff: number | null, rate: number | null): string {
  if (diff == null) return '—';
  return rate == null ? signedYen(diff) : `${signedYen(diff)} (${percent(rate, true)})`;
}

/** 支出の増減: 増加は悪化 (危険色)、減少は改善 (成功色)。既存の `.pos` 赤 / `.neg` 緑 */
export const expenseDiffClass = (v: number | null | undefined): string =>
  v == null || v === 0 ? '' : v > 0 ? 'pos' : 'neg';

/** 収入・純収支の増減: 増加が良い向き */
export const incomeDiffClass = (v: number | null | undefined): string =>
  v == null || v === 0 ? '' : v > 0 ? 'neg' : 'pos';

/** 前年よりカードの文言 (spec §3.2) */
export function previousYearSentence(summary: HouseholdSummary['summary']): string {
  const change = summary.change;
  if (!change) return '前年の同じ期間のデータが揃っていません。';
  const diff = change.balance.diff;
  if (diff === 0) return '家計の収支は前年と同じです。';
  // 当期が赤字のとき「黒字が増加」は事実と違う。収支の改善/悪化で言う
  if (summary.total.balance < 0) {
    return diff > 0 ? '家計の収支が改善しました。' : '家計の収支が悪化しました。';
  }
  return diff > 0 ? '家計の黒字が増加しました。' : '家計の黒字が減少しました。';
}

/**
 * 前年との比較の要約文 (spec §7)。決定論テンプレート。差が 0 の項目は `横ばいで` と書く。
 * 例: 前年と比べて収入が +¥280,000 増加し、支出が +¥360,000 増加したため、純収支は ¥80,000 悪化しました。
 */
export function comparisonSentence(change: HouseholdSummary['summary']['change']): string {
  if (!change) return '前年の同じ期間のデータが揃っていないため、比較できません。';
  const moved = (d: number) => `${signedYen(d)} ${d > 0 ? '増加' : '減少'}`;
  const income = change.income.diff === 0 ? '収入が横ばいで' : `収入が ${moved(change.income.diff)}し`;
  const expense =
    change.expense.diff === 0 ? '支出が横ばいであったため' : `支出が ${moved(change.expense.diff)}したため`;
  const b = change.balance.diff;
  const balance =
    b === 0
      ? '純収支は横ばいでした。'
      : `純収支は ¥${Math.abs(Math.round(b)).toLocaleString('ja-JP')} ${b > 0 ? '改善' : '悪化'}しました。`;
  return `前年と比べて${income}、${expense}、${balance}`;
}

/** 横軸の月ラベル。期間の最初の月と 1 月にだけ年を添える (spec §4.4) */
export function axisMonthLabel(month: string, index: number): string | string[] {
  const [y, m] = month.split('-');
  const label = `${Number(m)}月`;
  return index === 0 || m === '01' ? [label, y ?? ''] : label;
}

/** `2026-08-02` → `8/2` */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** 月送り: 期間の端では null (ボタンを disabled にする) */
export function adjacentMonth(months: readonly string[], current: string, step: -1 | 1): string | null {
  const i = months.indexOf(current);
  if (i < 0) return null;
  return months[i + step] ?? null;
}

/** 期間の表記 `2025年9月-2026年8月` (表の列の副題) */
export function rangeText(range: { from: string; to: string } | null): string {
  if (!range) return '';
  const f = (m: string) => {
    const [y, mm] = m.split('-');
    return `${y}年${Number(mm)}月`;
  };
  return `${f(range.from)}-${f(range.to)}`;
}

/** 前年同期間 (12 か月前へずらす) */
export function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const back = (m: string) => {
    const [y, mm] = m.split('-');
    return `${Number(y) - 1}-${mm}`;
  };
  return { from: back(range.from), to: back(range.to) };
}
