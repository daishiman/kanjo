/**
 * 予算画面の書式と文言 (spec-budget-screen §7.2〜§7.13)。
 *
 * 数値は core の `budgetScreen` / `applyBudgetInputs` が出したものをそのまま使い、ここでは計算し直さない。
 * 置くのは表示の書式 (円・万円・符号・率) と、見出し・保存バー・通知の文言の組立てだけ (FR-12・C1)。
 */
import { budgetSignedPct, budgetSignedYen } from '@kanjo/core';
import type { ApiError } from '../../api-client.js';

const MINUS = '−';

export const TITLE = '予算';
export const QUESTION = '実績に合う予算へ、どこを調整しますか？';
export const LEAD_LINES = [
  '過去の実績をもとに、来期の予算を計画しましょう。',
  '自動提案も参考にしながら、事業の優先順位に沿って調整できます。',
] as const;
export const TARGET_NOTE = '来期の12か月の予算を編集できます。';
export const AMOUNT_ERROR = '整数で入力してください（±100億円以内）';
export const EMPTY_INPUT_NOTE = '来期予算を1行以上入力してください。';
export const IMPACT_NOTE =
  '実績に合わせて無理のない予算を設定することで、安定したキャッシュフローを維持できます。';
export const PANEL_PLACEHOLDER = '一覧の行を選ぶと、自動提案の根拠を確かめられます。';
export const STALE_NOTICE = 'この予算はほかの画面で更新されています。';
export const SAVED_NOTICE = '予算を保存しました。';

const digits = (n: number): string => Math.abs(Math.round(n)).toLocaleString('ja-JP');

/** 表の金額: 通貨記号なしの桁区切り。null は『—』(§7.6) */
export const plainYen = (n: number | null | undefined): string =>
  n == null ? '—' : `${n < 0 ? MINUS : ''}${digits(n)}`;

/** 表の差額: +3,600,000 / −900,000 / ±0。null は『—』(§7.6) */
export const signedPlain = (n: number | null | undefined): string =>
  n == null ? '—' : n > 0 ? `+${digits(n)}` : n < 0 ? `${MINUS}${digits(n)}` : '±0';

/** ¥ 付きの金額: ¥13,200,000 */
export const yenOf = (n: number | null | undefined): string =>
  n == null ? '—' : `${n < 0 ? MINUS : ''}¥${digits(n)}`;

/** 符号つきの ¥: +¥1,000 / −¥1,000 / ±¥0 (core と同じ書式) */
export const signedYen = (n: number): string => budgetSignedYen(Math.round(n));

/** 小数第 1 位までの百分率 (core と同じ書式) */
export const signedPct = (rate: number): string => budgetSignedPct(rate);

/** 万円 1 桁 (グラフの目盛りと隠した表) */
export const manYen = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : (n / 10_000).toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * 差額・過不足の色 (§7.6)。+ を赤系、− を緑系。0 と null は色なし。
 * 色は補助で、意味は符号の文字が担う。
 */
export const diffClass = (n: number | null | undefined): string =>
  n == null || n === 0 ? '' : n > 0 ? 'budget-up' : 'budget-down';

/** 予算純収支・防衛ライン余裕の補足 (§7.3)。負のときだけ『不足』 */
export const shortfallNote = (n: number): string | null => (n < 0 ? '不足' : null);

/** 2026-09 → 2026年9月 */
export const monthJa = (month: string): string => `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;

/** 2026-09 → 9月 (グラフの横軸) */
export const monthAxis = (month: string): string => `${Number(month.slice(5, 7))}月`;

/** 予算対象: 2026年9月 - 2027年8月 (§7.2) */
export const targetRangeLabel = (months: readonly string[]): string =>
  months.length === 0
    ? '—'
    : `${monthJa(months[0] as string)} - ${monthJa(months[months.length - 1] as string)}`;

/** 列見出しの期間: 2025/9-2026/8 (§7.6) */
export const slashRange = (from: string, to: string): string =>
  `${from.slice(0, 4)}/${Number(from.slice(5, 7))}-${to.slice(0, 4)}/${Number(to.slice(5, 7))}`;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 『最終保存：2026年9月10日 10:18』。保存行が無い期間は『最終保存：なし』(§7.9) */
export function lastSavedLabel(savedAt: string | null): string {
  if (!savedAt) return '最終保存：なし';
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return '最終保存：なし';
  return `最終保存：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 『下書きを自動保存 10:18』。下書きが無いときは null (§7.9) */
export function draftSavedLabel(savedAt: string | null): string | null {
  if (!savedAt) return null;
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `下書きを自動保存 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 『未保存 4項目』/ 0 件は『すべて保存済みです』(§7.9) */
export const unsavedLabel = (count: number): string =>
  count === 0 ? 'すべて保存済みです' : `未保存 ${count}項目`;

/** リセットの確認の本文 (§7.9)。選択した行を戻すときは行数で書く */
export const resetBody = (unsaved: number, selected: number | null): string =>
  selected == null
    ? `未保存の ${unsaved} 項目の入力と下書きが消えます。`
    : `選択した ${selected} 行の未保存の入力が消えます。`;

/** 保存失敗の文言 (§エラー・例外・回復)。409 は fence の既存文言を使う */
export function saveErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiError> | null;
  if (apiError?.status === 400) return '予算を保存できませんでした。入力内容を確認してください。';
  if (apiError?.status === 409 && typeof apiError.message === 'string' && apiError.message !== '')
    return `予算を保存できませんでした。${apiError.message}`;
  return '予算を保存できませんでした。時間をおいてもう一度お試しください。';
}

/** 保存失敗で『再試行』を出すか (400 は入力を直すので出さない) */
export const canRetry = (error: unknown): boolean => (error as Partial<ApiError> | null)?.status !== 400;

/** 検索の比較用: NFKC 正規化して小文字にする (§7.6) */
export const normalizeSearch = (text: string): string => text.normalize('NFKC').toLowerCase().trim();

/** 検索 0 件の文言 (§7.13) */
export const noMatchLabel = (query: string): string => `「${query}」に合うカテゴリはありません。`;

/** 縦軸の目盛り: 0 を含み、5 本前後のきりのよい刻み (§7.4) */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  if (low === high) return [0];
  const raw = (high - low) / (count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  const first = Math.floor(low / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= high + step * 1e-9; value += step) ticks.push(Math.round(value));
  if ((ticks[ticks.length - 1] ?? 0) < high) ticks.push(Math.round(first + ticks.length * step));
  return ticks;
}
