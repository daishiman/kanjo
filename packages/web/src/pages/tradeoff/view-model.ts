/**
 * トレードオフ画面の表示用の純粋関数 (spec-tradeoff-screen FR-2 / FR-5 / FR-9)。
 *
 * 試算・推奨の数字は core の `tradeoffSimulation` / `tradeoffCombos` だけが作る。
 * ここは入力の読み取り・候補の絞り込み・文言への写しに限り、×12 や差額の式を持たない。
 */
import {
  TRADEOFF_AMOUNT_MAX,
  TRADEOFF_MEMO_MAX,
  TRADEOFF_TITLE_MAX,
  type TradeoffNeedLevel,
  type TradeoffScreenCandidate,
  type TradeoffSimulationResult,
  type TradeoffTrendDirection,
  tradeoffSimulation,
} from '@kanjo/core';
import { yenS } from '../../format.js';

/** FR-5 の最初に出す件数 */
export const INITIAL_ROWS = 10;

/** 必要度の変更メニュー。auto は利用者の上書きを外す。 */
export type NeedChoice = TradeoffNeedLevel | 'auto';

export const NEED_LABEL: Record<TradeoffNeedLevel, string> = { low: '低', mid: '中', high: '高' };
export const TREND_LABEL: Record<TradeoffTrendDirection, string> = {
  down: '↓ 減少',
  flat: '→ 横ばい',
  up: '↑ 増加',
};
export const NO_PARTNER = '取引先なし';

/** 1.新しい支出の入力 (文字列のまま持ち、送信と試算の直前に読む) */
export interface ExpenseDraft {
  title: string;
  amount: string;
  recurring: boolean;
  startMonth: string;
  memo: string;
}

/** 開始月の既定: 今日の翌月 (端末の暦で数える) */
export function nextMonthKey(today: Date): string {
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

/** 金額欄を 1〜1 億円の整数として読む。範囲外・未入力は null */
export function parseAmount(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return value >= 1 && value <= TRADEOFF_AMOUNT_MAX ? value : null;
}

/** 選択順も含めて同じ候補キーか。区切り文字に連結せず、キーの内容に影響されない。 */
export function sameCandidateKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export const partnerLabel = (partner: string): string => partner || NO_PARTNER;
export const candidateName = (c: TradeoffScreenCandidate): string =>
  `${c.account}・${partnerLabel(c.partner)}`;

/** 検索はカテゴリ名・取引先名の部分一致、カテゴリ絞込は科目の完全一致 (FR-5) */
export function filterCandidates(
  candidates: readonly TradeoffScreenCandidate[],
  search: string,
  account: string,
): TradeoffScreenCandidate[] {
  const word = search.trim();
  return candidates.filter(
    (c) =>
      (!account || c.account === account) &&
      (!word || c.account.includes(word) || partnerLabel(c.partner).includes(word)),
  );
}

/** カテゴリ絞込の選択肢。候補の並び (月額降順) で最初に出た順 */
export function accountOptions(candidates: readonly TradeoffScreenCandidate[]): string[] {
  return [...new Set(candidates.map((c) => c.account))];
}

/** 関連ページのリンク名。検知器の `nextAction.to` の先頭の経路で決める */
export function relatedLabel(to: string): string {
  if (to.startsWith('/subscriptions')) return 'サブスク';
  if (to.startsWith('/budget')) return '予算';
  return '明細';
}

/** 差額の表記。正 (支出増) にも符号を付け、0 以下の捻出と取り違えないようにする */
export const signedYen = (value: number): string => (value > 0 ? `+${yenS(value)}` : yenS(value));

/** 円記号なしの 3 桁区切り (文の中の金額) */
export const plain = (value: number): string => Math.round(value).toLocaleString('ja-JP');

/** 差額の文 (表示の文言、符号は決定 009: 正は支出増) */
export function diffSentence(annualDiff: number): { text: string; warn: boolean } {
  return annualDiff > 0
    ? { text: `年間 ${plain(annualDiff)} 円の支出増になります`, warn: true }
    : { text: `年間 ${plain(-annualDiff)} 円を捻出できます`, warn: false };
}

export interface CalcExample {
  label: string;
  amount: number;
  recurring: boolean;
  monthlySaving: number;
  result: TradeoffSimulationResult;
}

/** FR-9 の 2 例。固定の入力を core の試算関数に通した結果 */
export const CALC_EXAMPLES: CalcExample[] = [
  { label: '毎月の支出', amount: 80_000, recurring: true, monthlySaving: 85_000 },
  { label: '単発の支出', amount: 300_000, recurring: false, monthlySaving: 50_000 },
].map((e) => ({
  ...e,
  result: tradeoffSimulation({ amount: e.amount, recurring: e.recurring }, [e.monthlySaving], null),
}));

export { TRADEOFF_AMOUNT_MAX, TRADEOFF_MEMO_MAX, TRADEOFF_TITLE_MAX };
