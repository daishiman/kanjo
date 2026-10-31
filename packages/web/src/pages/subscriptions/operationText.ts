/**
 * 操作の行と読み上げに出す文言。失敗は status ではなくエラーコードで類に分ける (SM-FE-08)。
 * 409 には busy・revision・duplicate・already_undone など意味の違うものが並ぶので、コードの一覧をここに集め、
 * 未知のコードは status で既定の類に落とす。
 */
import { SUBSCRIPTION_UNDO_BLOCKED_MESSAGE } from '@kanjo/core';
import { ApiError } from '../../api.js';
import type { WriteRequest } from './api.js';
import type { IntentKind, OperationLabelKind } from './types.js';

/** 自動で送り直す上限。busy は 1・2・4 秒、revision は取り直しのたびに 1 回 (SM-FE-06) */
export const AUTO_RETRY_LIMIT = 3;

export const SERVER_FAILED = 'サーバー側で処理に失敗しました。同じ操作を再試行しても二重には反映されません';
export const BUSY_EXHAUSTED = '別の操作が続いているため送れませんでした。少し待ってから再試行してください';
export const REVISION_EXHAUSTED =
  '他の利用者の操作が続いたため送れませんでした。一覧を確認してから再試行してください';
const CLIENT_BROKEN = '画面の不具合で送れませんでした。画面を読み込み直してください';
/** 読み込みの失敗の共通文言と同じ文 (spec)。共通の言い換えは通さず、操作の文言をここ 1 か所に置く (SM-UX-04) */
const SCHEMA_UNAVAILABLE =
  'システム更新の適用待ちです。お客様の操作やファイルが原因ではありません。時間をおいて、もう一度読み込んでください。';
const SIGNED_OUT = 'ログインの有効期限が切れました。もう一度ログインしてから操作してください';

export const busyRetrying = (attempt: number) =>
  `別の操作を処理中です。自動で再試行します (${attempt}/${AUTO_RETRY_LIMIT})`;
export const revisionRetrying = (attempt: number) =>
  `他の利用者の操作が先に反映されました。最新の状態で送り直しています (${attempt}/${AUTO_RETRY_LIMIT})`;

/** 送る前の検査で、対象が他の操作で変わっていた。統合は選び直し、それ以外は操作のやり直しを促す */
export const staleMessage = (names: readonly string[], kind: IntentKind) =>
  kind === 'merge'
    ? `${names.join('、')} は他の操作で変更されたため、統合しませんでした。一覧を確認してもう一度選んでください`
    : `${names.join('、')} は他の操作で変更されたため、送りませんでした。一覧を確認してもう一度操作してください`;

export const KIND_LABEL: Record<Exclude<OperationLabelKind, 'merge'>, string> = {
  unmerge: '統合の取り消し',
  vendor_create: '登録',
  vendor_update: '登録内容の変更',
  vendor_delete: '登録の削除',
  review: '見直し日の記録',
  review_decision: '候補の判断',
  exclusion: '除外',
};

/** 操作の行の見出し。統合だけは統合先の名前を含める */
export const operationLabel = (kind: OperationLabelKind, targetName: string | null): string =>
  kind === 'merge' ? `${targetName ?? '統合先'} へ統合` : KIND_LABEL[kind];

/**
 * 失敗の類。
 * - busy / revision: 自動の送り直しが上限に達した。「再試行」で同じ操作をもう一度送れる
 * - server: 5xx と通信の失敗。サーバで反映済みかもしれないので、同じ key と本文で送り直す
 * - manual: 利用者が選び直すか、画面を読み込み直すしかない。「再試行」を出さない
 */
export type FailureClass = 'busy' | 'revision' | 'server' | 'manual';

export interface FailureText {
  class: FailureClass;
  message: string;
  retryable: boolean;
}

/** 自動で送り直してよい応答。busy は同じ key で待ってから、revision は取り直してから新しい key で送る */
export function retryKindOf(error: unknown): 'busy' | 'revision' | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'canonical_write_busy' || error.code === 'd1_overloaded') return 'busy';
  if (error.code === 'subscription_revision_conflict') return 'revision';
  return null;
}

/** 最後に送った要求。5xx・通信の失敗・busy の上限の「再試行」は、これを同じ key・同じ本文で送り直す */
export interface PinnedRequest {
  key: string;
  base: number | null;
  request: WriteRequest;
}

/**
 * 書き込みの失敗を包む。mutationFn がここまでで送り直しを諦めた理由と、「再試行」に要る要求を持つ。
 * broken は送る前に手元の値から本文を作る段で投げた例外 (buildLocally)。通信をしていないので通信の失敗と分ける
 */
export class WriteFailure extends Error {
  constructor(
    readonly reason: 'busy' | 'revision' | 'stale' | 'request' | 'broken',
    readonly cause: unknown,
    readonly names: readonly string[] = [],
    readonly pinned?: PinnedRequest,
  ) {
    super(reason);
    this.name = 'WriteFailure';
  }
}

/**
 * 手元の値だけで本文を作る処理を包む。WriteFailure 以外の例外は送る前の画面の不具合なので broken にする。
 * 型では分けられない (fetch の失敗も undefined の参照も TypeError) ので、通信をしない段を包んで場所で分ける
 */
export function buildLocally<T>(build: () => T): T {
  try {
    return build();
  } catch (error) {
    if (error instanceof WriteFailure) throw error;
    throw new WriteFailure('broken', error);
  }
}

const manual = (message: string): FailureText => ({ class: 'manual', message, retryable: false });
const server: FailureText = { class: 'server', message: SERVER_FAILED, retryable: true };
/** 自動の送り直しが上限に達した類。コードの一覧は retryKindOf の 1 か所にだけ置く */
const exhausted: Record<'busy' | 'revision', FailureText> = {
  busy: { class: 'busy', message: BUSY_EXHAUSTED, retryable: true },
  revision: { class: 'revision', message: REVISION_EXHAUSTED, retryable: true },
};

/** ApiError のコードを文言に。知らないコードは status で既定の類へ落とす */
function classifyApiError(error: ApiError, kind: IntentKind): FailureText {
  const retryKind = retryKindOf(error);
  if (retryKind !== null) return exhausted[retryKind];
  switch (error.code) {
    case 'schema_unavailable':
      return manual(SCHEMA_UNAVAILABLE);
    // 取り消せない理由の文は API の応答と操作の記録の表示と同じ core の 1 か所から引く
    case 'undo_expired':
    case 'already_undone':
    case 'undo_blocked_by_later_operation':
      return manual(SUBSCRIPTION_UNDO_BLOCKED_MESSAGE[error.code]);
    case 'too_many_aliases':
      return manual('統合先の別名が 50 件を超えるため統合しませんでした。統合する取引名を減らしてください');
    case 'merge_cycle':
      return manual('統合先が統合元に含まれるため統合しませんでした。統合先を選び直してください');
    case 'idempotency_key_required':
    case 'empty_merge':
    case 'idempotency_key_reused':
    case 'idempotency_key_expired':
      return manual(CLIENT_BROKEN);
  }
  if (error.status === 404 && kind === 'merge') {
    return manual('統合先か統合元が見つかりませんでした。一覧を確認してもう一度選んでください');
  }
  if (error.status === 404 && kind === 'unmerge') {
    return manual('この統合は見つかりませんでした。操作の一覧を確認してください');
  }
  if (error.status >= 500) return server;
  // 401 はログインし直してもらう (認証の通知は api-client が出す)。その他の 4xx は API の文言をそのまま見せる
  return manual(error.status === 401 ? SIGNED_OUT : error.message);
}

export function classifyWriteError(error: unknown, kind: IntentKind): FailureText {
  if (error instanceof WriteFailure) {
    if (error.reason === 'stale') return manual(staleMessage(error.names, kind));
    if (error.reason === 'broken') return manual(CLIENT_BROKEN);
    if (error.reason === 'busy' || error.reason === 'revision') return exhausted[error.reason];
    return classifyWriteError(error.cause, kind);
  }
  if (error instanceof ApiError) return classifyApiError(error, kind);
  // fetch の失敗 (TypeError) と、応答を読めなかったものは通信の失敗として送り直せるようにする。
  // 200 の本文を読めなかったときは反映済みかもしれないので、同じ key で送り直せる server のままにする
  return server;
}

/** 呼び出し側がその場で扱う失敗 (重複など) のコード。WriteFailure の中の ApiError まで辿る */
export function errorCodeOf(error: unknown): string | null {
  if (error instanceof WriteFailure) return errorCodeOf(error.cause);
  return error instanceof ApiError ? error.code : null;
}
