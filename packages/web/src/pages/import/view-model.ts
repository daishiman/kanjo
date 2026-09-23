/**
 * データ取込画面の表示規則 (spec-import-screen「UI・状態遷移」)。
 *
 * ファイルの状態・操作・要約・結果の文言は core (`@kanjo/core` の import-screen) が決める。
 * ここは画面が持つ項目 (送信の進み具合・中断・確定の結果) を core の入力へ写すことと、
 * URL 状態・エラー文・期間カードの読ませ方だけを持つ。DOM を持たない純関数にする。
 */
import {
  IMPORT_FILE_STATE_LABEL,
  type ImportFileStatus,
  type ImportInspectionSummary,
  type ImportSummaryFile,
  formatImportPeriod,
  importFileSelectable,
  importFileState,
  importInspectionSummary,
  importLimitsNote,
  importPeriodFromMonths,
} from '@kanjo/core';
import { ApiError } from '../../api-client.js';
import type { ImportInspectionFile } from '../../api.js';
import { describeError } from '../../components/Page.js';
import type { PeriodMeta, PeriodSelection } from '../../period.js';

/** 画面が持つ 1 ファイル。送信前から確定後まで同じ key で追う */
export interface ImportItem {
  key: string;
  file: File;
  /** 検査の中のファイル ID。応答で結び付くまで null */
  serverId: string | null;
  /** 送信の進み具合 (0〜100) */
  progress: number;
  /** 送信中か (中断できる間) */
  uploading: boolean;
  /** 送信の失敗 (通信・413・429 など)。この行は「失敗」になり、再試行で送り直す */
  uploadError: string | null;
  /** 送る前の上限判定の超過理由。送らない */
  limitViolation: string | null;
  inspection: ImportInspectionFile | null;
  commit: 'committed' | 'failed' | null;
  commitReason: string | null;
  /** 確定で書いた行数 */
  committedRows: number | null;
  /** 下部バーの選択。取込準備完了の行だけが選べる */
  checked: boolean;
}

export interface ImportUrlState {
  /** 履歴の詳細ペインで開いている取込 1 回 */
  runId: string | null;
}

/** 壊れた値は「選んでいない」へ倒す。URL を手で書き換えても画面を失敗にしない */
export function readImportUrl(params: URLSearchParams): ImportUrlState {
  const run = params.get('run');
  return { runId: run && /^[\w-]{1,64}$/.test(run) ? run : null };
}

/**
 * サーバー側の上限超過 (検査で error_kind=limit)。validation はエラーでも identical でもないのに
 * blocked になった行だけがこれに当たる。強制再取込をオンにしても外れない理由として持ち直す。
 */
function serverLimitReason(inspection: ImportInspectionFile | null): string | null {
  if (!inspection || inspection.state !== 'blocked') return null;
  if (inspection.validation.kind === 'error' || inspection.duplicate.kind === 'identical') return null;
  return inspection.reason ?? '上限を超えています';
}

/** 行の状態。判定は core の判定表に任せ、確定の失敗にだけ web が受け取った理由を添える */
export function importItemStatus(item: ImportItem, force: boolean): ImportFileStatus {
  const status = importFileState({
    commit: item.commit,
    limitViolation: item.limitViolation ?? serverLimitReason(item.inspection),
    uploaded: item.progress >= 100 || item.serverId !== null,
    inspection: item.inspection
      ? {
          validation: item.inspection.validation,
          duplicate: item.inspection.duplicate,
          errorReason: item.inspection.reason,
        }
      : null,
    force,
    uploadError: item.uploadError,
  });
  if (status.state === 'failed' && status.reason === null)
    return { state: 'failed', reason: item.commitReason ?? '取り込めませんでした' };
  return status;
}

/** ステータス列の文字。送信中だけ進み具合を添える */
export function importItemStatusLabel(item: ImportItem, status: ImportFileStatus): string {
  const label = IMPORT_FILE_STATE_LABEL[status.state];
  return status.state === 'uploading' ? `${label} (${item.progress}%)` : label;
}

/** 状態を色だけで伝えないための記号 (WCAG 1.4.1)。文字と並べて出す */
export const IMPORT_STATE_ICON: Record<ImportFileStatus['state'], string> = {
  uploading: '↑',
  inspecting: '…',
  ready: '✓',
  blocked: '✕',
  imported: '✓',
  failed: '!',
};

export type ImportSummaryView =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'ready'; summary: ImportInspectionSummary };

/**
 * 3.取込内容の確認 の中身。検査 ID が無ければ「-」、検査中の行があれば「検査中」。
 * サブスク候補の見込みはファイル単位では返らない (サーバーの要約だけが持つ) ので、要約の値を使う。
 */
export function importSummaryView(input: {
  items: readonly ImportItem[];
  force: boolean;
  inspectionId: string | null;
  serverSubsCandidates: number;
}): ImportSummaryView {
  if (!input.inspectionId) return { kind: 'none' };
  const pending = input.items.filter((item) => item.commit === null);
  const statuses = pending.map((item) => importItemStatus(item, input.force));
  if (statuses.some((status) => status.state === 'uploading' || status.state === 'inspecting'))
    return { kind: 'checking' };
  const files: ImportSummaryFile[] = pending.map((item, index) => ({
    state: statuses[index].state,
    source: item.inspection?.source ?? null,
    rowCount: item.inspection?.rowCount ?? 0,
    periodFrom: item.inspection?.periodFrom ?? null,
    periodTo: item.inspection?.periodTo ?? null,
    duplicate: item.inspection?.duplicate ?? { kind: 'none', count: 0 },
    subsEstimate: 0,
  }));
  const summary = importInspectionSummary(files);
  return {
    kind: 'ready',
    summary: { ...summary, subsCandidates: summary.importableCount > 0 ? input.serverSubsCandidates : 0 },
  };
}

export interface ImportSelectionBar {
  /** まだ確定していないファイルの数 (「n 件のファイルを選択中」) */
  selected: number;
  /** 取込準備完了の数 */
  importable: number;
  /** 取込不可・失敗の数 */
  errors: number;
  /** 主ボタンで確定に送るファイル (選択中かつ取込準備完了) */
  commitKeys: string[];
}

/** 下部の選択件数バー。N は押して取り込まれる数で、0 件なら主ボタンを無効にする */
export function importSelectionBar(items: readonly ImportItem[], force: boolean): ImportSelectionBar {
  const selected = items.filter((item) => item.commit === null && item.checked);
  const statuses = selected.map((item) => importItemStatus(item, force).state);
  return {
    selected: selected.length,
    importable: statuses.filter(importFileSelectable).length,
    errors: statuses.filter((state) => state === 'blocked' || state === 'failed').length,
    commitKeys: selected
      .filter((item, index) => importFileSelectable(statuses[index]) && item.serverId)
      .map((item) => item.key),
  };
}

/** 追加と月次置換の意味を、設定と確認ダイアログで同じ言葉にする。 */
export function importKeepPreviousDescription(keepPrevious: boolean): string {
  return keepPrevious
    ? '同一期間の既存明細を残し、まだない明細だけ追加します。既にある明細はスキップします。'
    : '同じ月の明細を今回のファイル内容に置き換えます。既存明細が消える場合があります。';
}

/** 送信 (検査・ファイル追加) の失敗の文。行の「失敗」の理由に出す */
export function importUploadErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return error.message || importLimitsNote();
    if (error.status === 429) return error.message;
    if (error.status === 403)
      return 'この画面の外からの操作は受け付けません。この画面から操作し直してください。';
    // 期限切れの言い換えは検査が見つからない 404 (not_found) だけ。原本の欠落などはサーバの文を出す
    if (error.status === 404 && error.code === 'not_found')
      return '検査結果の期限が切れました。ファイルを選び直してください。';
    if (error.status === 404) return error.message;
  }
  if (error instanceof TypeError) return '通信できませんでした。「再試行」で送り直せます。';
  return describeError(error);
}

/** 確定 (取込・置換・取り消し) の失敗の文 (spec「Error contract」の画面側) */
export function importCommitErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'import_busy')
      return 'ほかの取込を処理しています。少し待ってから押し直してください。';
    if (error.status === 409 && error.code === 'query_budget_exceeded')
      return '1 回で処理できる量を超えました。ファイルを分けて取り込んでください。';
    if (error.status === 409) return `${error.message}。`;
    if (error.status === 413) return error.message || importLimitsNote();
    if (error.status === 429) return error.message;
    if (error.status === 403)
      return 'この画面の外からの操作は受け付けません。この画面から操作し直してください。';
    // 期限切れの言い換えは検査が見つからない 404 (not_found) だけ。原本の欠落などはサーバの文を出す
    if (error.status === 404 && error.code === 'not_found')
      return '検査結果の期限が切れました。ファイルを選び直してください。';
    if (error.status === 404) return error.message;
  }
  return describeError(error);
}

/**
 * 取り消しの対象月「2026/01/01 - 2026/03/31（3か月）」。
 * 月が飛んでいるときは範囲で書くと間の月まで消えるように読めるので、月を並べて書く。
 */
export function importMonthsText(months: readonly string[]): string {
  const valid = [...new Set(months.filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort();
  if (!valid.length) return 'なし';
  const index = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return y * 12 + m;
  };
  const contiguous = index(valid[valid.length - 1]) - index(valid[0]) === valid.length - 1;
  if (!contiguous)
    return `${valid.map((m) => m.replace('-', '/')).join('、')}（${valid.length}か月・連続していません）`;
  const period = importPeriodFromMonths(valid);
  return `${formatImportPeriod(period.from, period.to)}（${valid.length}か月）`;
}

const monthText = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return Number.isFinite(y) && Number.isFinite(m) ? `${y}年${m}月` : ym;
};

/** 右上のカード「2025年9月 - 2026年8月（1年）」。範囲が取れなければサーバーのラベル */
export function importPeriodCardText(meta: PeriodMeta | undefined, selection: PeriodSelection): string {
  const range = meta?.applied ?? meta?.full ?? null;
  const body = range ? `${monthText(range.from)} - ${monthText(range.to)}` : (meta?.label ?? '-');
  return selection.mode === 'span' ? `${body}（${selection.span}年）` : body;
}

/** 選んだファイルに振る key。同じ名前を 2 回選んでも別の行にする */
let seq = 0;
export const nextImportItemKey = (): string => {
  seq += 1;
  return `f${seq}`;
};

/** 新しく選んだファイルの行。送る前の上限判定の結果を持たせる */
export function newImportItem(file: File, limitViolation: string | null): ImportItem {
  return {
    key: nextImportItemKey(),
    file,
    serverId: null,
    progress: 0,
    uploading: false,
    uploadError: null,
    limitViolation,
    inspection: null,
    commit: null,
    commitReason: null,
    committedRows: null,
    checked: true,
  };
}
