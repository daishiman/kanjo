/**
 * AI分析画面の表示規則 (spec-ai-analysis-screen FR-1・FR-6・FR-8・FR-14)。
 *
 * 段階・進捗・T-番号・版の説明はサーバ (core `aiTaskStage` など) が決めて返す。ここは「どう読ませるか」
 * だけを持つ: URL 状態の解釈、期間の取り出し、進捗と依頼内容の表記。DOM を持たない純関数にする。
 */
import {
  type AiReportTab,
  type AiTaskStage,
  aiSupplementUserLine,
  aiTaskCapabilities,
  aiTaskIsPending,
  isAiReportTab,
} from '@kanjo/core';
import type { PeriodMeta, PeriodSelection } from '../../period.js';

export interface AiUrlState {
  tab: AiReportTab;
}

/** 壊れた値は既定へ倒す。URL を手で書き換えても画面を失敗にしない */
export function readAiUrl(params: URLSearchParams): AiUrlState {
  const tab = params.get('tab');
  return {
    tab: isAiReportTab(tab) ? tab : 'summary',
  };
}

/** 依頼・件数の API へ渡す範囲。絞り込み後の範囲、全期間なら取込済みの全範囲 */
export function aiRangeOf(meta: PeriodMeta | undefined): { from: string; to: string } | null {
  return meta?.applied ?? meta?.full ?? null;
}

export type AiPeriodChoice = 1 | 2 | 3 | 'custom';

/** 1.依頼の対象期間ボタン。共通の期間タブと同じ選択肢を、同じ状態に対して出す */
export const AI_PERIOD_CHOICES: readonly { id: AiPeriodChoice; label: string }[] = [
  { id: 1, label: '最新1年' },
  { id: 2, label: '2年' },
  { id: 3, label: '3年' },
  { id: 'custom', label: '任意' },
];

/** いまの選択がどのボタンに当たるか。年指定・全期間はどれにも当たらない (null) */
export function aiPeriodChoiceOf(selection: PeriodSelection): AiPeriodChoice | null {
  if (selection.mode === 'span') return selection.span;
  if (selection.mode === 'custom') return 'custom';
  return null;
}

/** ボタンを押したときの次の選択。任意は今の全体期間を初期値にする (PeriodPicker と同じ流儀) */
export function aiPeriodSelectionFor(choice: AiPeriodChoice, meta: PeriodMeta | undefined): PeriodSelection {
  if (choice === 'custom') {
    const range = aiRangeOf(meta);
    return { mode: 'custom', from: range?.from ?? '', to: range?.to ?? '' };
  }
  return { mode: 'span', span: choice };
}

/** 進捗の文字。失敗・キャンセル (null) は「-」 */
export const aiProgressText = (progress: number | null): string => (progress == null ? '-' : `${progress}%`);

/** 依頼内容の 1 行。利用者が自分の言葉を書いていない依頼は「補足指示なし」 */
export function aiTaskSummaryLine(supplement: string | null): string {
  return aiSupplementUserLine(supplement) ?? '補足指示なし';
}

/** 結果待ちがあるあいだだけ取り直す間隔 (spec「イベント・非同期処理」。agent 推定・利用者未確認) */
export const AI_TASKS_REFETCH_MS = 10_000;

/** 依頼一覧の取り直し間隔。待機中・実行中が 1 件も無ければ取り直さない (false) */
export function aiTasksRefetchMs(tasks: readonly { stage: AiTaskStage }[] | undefined): number | false {
  return tasks?.some((t) => aiTaskIsPending(t.stage)) ? AI_TASKS_REFETCH_MS : false;
}

/** 段階ごとに出す操作 (spec「段階ごとの操作と遷移」の表) */
export function aiTaskActions(stage: AiTaskStage): ('cancel' | 'detail' | 'retry' | 'delete')[] {
  const capability = aiTaskCapabilities(stage);
  return [
    ...(capability.cancel ? (['cancel'] as const) : []),
    ...(capability.openReport ? (['detail'] as const) : []),
    ...(capability.retry ? (['retry'] as const) : []),
    ...(capability.delete ? (['delete'] as const) : []),
  ];
}

/** ステータスのバッジ。色だけで伝えないよう、文字は常に段階名を出す */
export const AI_STAGE_PILL: Record<AiTaskStage, string> = {
  waiting: 'pill neutral',
  running: 'pill ai-running',
  done: 'pill calm',
  failed: 'pill alert',
  canceled: 'pill neutral',
};
