/**
 * 改善リクエスト画面の view-model (specs/spec-improvement-screen.md)。
 *
 * 規則 (状態の遷移・概要・IMP 番号・件数・検索・ページング・関連・診断の要約・マスク) は
 * core の improvement-screen と improvement にあり、api が導いた結果を画面は並べるだけにする。
 * core を import してよいのはこのファイルだけ (部品は view-model から受け取る)。
 */
import {
  IMPROVEMENT_DIAGNOSTICS_DISCLOSURE,
  IMPROVEMENT_DRAFT_MESSAGES,
  IMPROVEMENT_NEW_BODY_MAX,
  IMPROVEMENT_STATUS_LABEL,
  IMPROVEMENT_TABS,
  IMPROVEMENT_TAB_LABEL,
  type ImprovementDraftCheck,
  type ImprovementListItem,
  type ImprovementStatus,
  type ImprovementTab,
  checkImprovementDraft,
  improvementPageRangeText,
  normalizeImprovementListQuery,
} from '@kanjo/core';
import { ApiError } from '../../api-client.js';

export {
  IMPROVEMENT_DIAGNOSTICS_DISCLOSURE,
  IMPROVEMENT_DRAFT_MESSAGES,
  IMPROVEMENT_NEW_BODY_MAX,
  IMPROVEMENT_STATUS_LABEL,
  IMPROVEMENT_TABS,
  IMPROVEMENT_TAB_LABEL,
  improvementPageRangeText,
};
export type { ImprovementDraftCheck, ImprovementListItem, ImprovementStatus, ImprovementTab };

/* ------------------------------ 文言 ------------------------------ */

export const TITLE = '改善リクエスト';
export const QUESTION = '画面の文脈を保ったまま、改善を共有しますか？';
export const LEAD =
  '使っていて困ったこと、こうなったらいいのに、という改善案をお送りください。開発チームが内容を確認し、今後の改善に活用します。';

export const BODY_PLACEHOLDER =
  '例：月次レポートのグラフが正しく表示されないので、条件を変更しても正しく表示されるようにしてほしいです。可能であれば、エラー時のメッセージもわかりやすくしてほしいです。';

export const PRIVACY_CONFIRM_LABEL =
  '添付画像・入力内容から、個人情報や機密情報が含まれていないことを確認しました';
export const PRIVACY_CONSENT_LABEL = 'この内容の取り扱いに同意します（プライバシーに記載して対応します）';

export const MASK_TARGETS = [
  '口座情報・取引先名・金額・個人名・メールアドレス',
  '電話番号・住所・その他の個人情報',
];

export const SEARCH_PLACEHOLDER = 'ID・内容・関連ページで検索（例：グラフ、エラー、仕分け）';

export const TEXT = {
  captureFailed: '画面を撮影できませんでした。画像なしでも送れます',
  noMatch: '条件に合う改善リクエストがありません',
  emptyTitle: 'データがありません',
  emptyBody: 'まだ改善リクエストがありません。気づいたことや改善してほしいことを、ぜひお送りください。',
  errorTitle: 'データの読み込みに失敗しました',
  errorBody: '一時的なエラーが発生しました。時間をおいて再度お試しください。入力済みの内容は失われません。',
  unselected: '一覧から改善リクエストを選んでください',
  purged: '保持期限を過ぎて添付が削除されているため、指示文は作れません',
  cannotRestore: 'この改善リクエストはもう戻せません',
  conflict: '他の画面で状態が変わっていたため、最新の内容を読み直しました',
  deleted: '削除しました',
  copyFallback: 'クリップボードに書き込めませんでした。下の指示文を選んで手動でコピーしてください',
  reissued: 'プロンプトを再発行しました。前に発行したプロンプトは使えません',
} as const;

/* ------------------------------ コピー先 ------------------------------ */

export type CopyTarget = 'claude_code' | 'codex';
export const COPY_TARGETS: readonly CopyTarget[] = ['claude_code', 'codex'];
export const COPY_TARGET_LABEL: Record<CopyTarget, string> = { claude_code: 'Claude Code', codex: 'Codex' };
export const COPY_REISSUE_NOTICE =
  '指示文がこの画面にない場合は、コピー時に再発行し、以前の指示文は使えなくなります。';
export const copiedToast = (target: CopyTarget): string =>
  `${COPY_TARGET_LABEL[target]}用のプロンプトをコピーしました`;

/* ------------------------------ URL ------------------------------ */

export interface ImprovementUrlState {
  id: string | null;
  tab: ImprovementTab;
  q: string;
  page: number;
}

/** 壊れた値は core の規則で既定に倒す。範囲外の page は api が最後のページへ倒す */
export function readImprovementUrl(params: URLSearchParams): ImprovementUrlState {
  const query = normalizeImprovementListQuery({
    q: params.get('q'),
    tab: params.get('tab'),
    page: params.get('page'),
  });
  const id = params.get('id');
  return { id: id ? id : null, ...query };
}

/** 既定値のキーは書かない。同じ状態が同じ URL になる */
export function writeImprovementUrl(state: ImprovementUrlState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.id) params.set('id', state.id);
  if (state.tab !== 'all') params.set('tab', state.tab);
  const q = normalizeImprovementListQuery({ q: state.q }).q;
  if (q) params.set('q', q);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

/* ------------------------------ 作成フォーム ------------------------------ */

export interface CreateDraft {
  body: string;
  privacyConfirmed: boolean;
  privacyConsented: boolean;
}

export const EMPTY_CREATE_DRAFT: CreateDraft = { body: '', privacyConfirmed: false, privacyConsented: false };

/** 送信を止める理由は core が決める。画面は文を送信ボタンの近くへ出すだけ */
export const checkDraft = (draft: CreateDraft): ImprovementDraftCheck => checkImprovementDraft(draft);

export const bodyCountText = (length: number): string => `${length}/${IMPROVEMENT_NEW_BODY_MAX}`;

/* ------------------------------ 表示の整形 ------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

/** 一覧の日付。端末の時刻帯で「2026/09/10」 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** 詳細とアクティビティの日時。「2026/09/10 10:24」 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 状態バッジの見た目の種類。色だけに頼らず、文字ラベルを必ず一緒に出す */
export const STATUS_TONE: Record<ImprovementStatus, 'open' | 'progress' | 'done' | 'reconfirm'> = {
  open: 'open',
  in_progress: 'progress',
  done: 'done',
  reconfirm: 'reconfirm',
};

/* ------------------------------ 失敗の読み分け ------------------------------ */

export type ActionFailure = 'purged' | 'conflict' | 'not_found' | 'other';

/** 410 は添付の期限切れ、409 は他の画面との競合、404 は削除・存在しない */
export function classifyActionError(error: unknown): ActionFailure {
  if (!(error instanceof ApiError)) return 'other';
  if (error.status === 410) return 'purged';
  if (error.status === 409) return 'conflict';
  if (error.status === 404) return 'not_found';
  return 'other';
}

export function actionErrorText(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return '操作できませんでした。もう一度お試しください';
}
