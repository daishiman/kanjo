/**
 * 「操作」の行を、画面の mutation (待機中・処理中・失敗) と API の操作の記録 (完了) から合成する純関数 (SM-FE-07)。
 * 待機中と失敗は画面にしか無く、他の利用者の完了は記録にしか無い。同じ操作が両方に現れるので、
 * 統合と取り消しは応答の操作 id で、その他は「記録を読めているか」で重複を除く。
 */
import type { OperationRecord, WriteResponse } from './api.js';
import type { RetryProgress } from './operationProgress.js';
import {
  busyRetrying,
  classifyWriteError,
  errorCodeOf,
  operationLabel,
  revisionRetrying,
} from './operationText.js';
import type { WriteIntent } from './types.js';
import { labelOf } from './writeRequests.js';

/** 画面に出す操作の行の上限 */
export const OPERATION_ROW_LIMIT = 5;

const DELETED_USER = '削除された利用者';

/** useMutationState から読む mutation 1 件 (同じ操作の「再試行」は同じ clientOpId の別の mutation になる) */
export interface MutationEntry {
  clientOpId: number;
  intent: WriteIntent;
  inlineCodes: readonly string[];
  status: 'idle' | 'pending' | 'success' | 'error';
  isPaused: boolean;
  submittedAt: number;
  data: WriteResponse | undefined;
  error: unknown;
}

/** retrying は自動の送り直しの待ち。状態の文字は「処理中」のまま、色だけを変える */
export type OperationRowState = 'waiting' | 'running' | 'retrying' | 'done' | 'failed';

export const STATE_TEXT: Record<OperationRowState, string> = {
  waiting: '待機中',
  running: '処理中',
  retrying: '処理中',
  done: '完了',
  failed: '失敗',
};

export interface OperationRow {
  /** React の key。記録は操作 id、画面の操作は clientOpId から作る */
  key: string;
  /** 記録の操作 id。属性にだけ持ち、文字には出さない (AC-022) */
  operationId: string | null;
  state: OperationRowState;
  label: string;
  /** 自動の送り直し・失敗の文言と「(email) が元に戻しました」 */
  detail: string | null;
  actor: string | null;
  /** ISO 8601。画面の操作は積んだ時刻、記録は API の作成時刻 */
  at: string;
  /** 「再試行」で送り直す操作。押せない失敗は null */
  retryOf: number | null;
  /** 「元に戻す」。取り消しを処理中なら pending */
  undo: { operationId: string; targetName: string | null; pending: boolean } | null;
}

export interface OperationRowsInput {
  mutations: readonly MutationEntry[];
  operations: readonly OperationRecord[];
  /** 記録を 1 度でも読めたか。読めていなければ完了した画面の操作を行として残す */
  operationsLoaded: boolean;
  progress: ReadonlyMap<number, RetryProgress>;
  /** 画面の操作の操作者 (ログイン中の利用者) */
  currentEmail: string | null;
  /** 取り消しを積んでいる (待機中か処理中の) 統合の操作 id */
  pendingUndoIds: ReadonlySet<string>;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** clientOpId ごとに最後の mutation だけを残す (失敗の後の「再試行」は同じ行の続き) */
function latestByOperation(mutations: readonly MutationEntry[]): MutationEntry[] {
  const latest = new Map<number, MutationEntry>();
  for (const mutation of mutations) latest.set(mutation.clientOpId, mutation);
  return [...latest.values()];
}

function mutationRow(
  mutation: MutationEntry,
  input: OperationRowsInput,
  recordIds: ReadonlySet<string>,
): OperationRow | null {
  const base = {
    key: `client-${mutation.clientOpId}`,
    operationId: null,
    label: labelOf(mutation.intent),
    actor: input.currentEmail,
    at: iso(mutation.submittedAt),
    retryOf: null,
    undo: null,
  };
  if (mutation.status === 'pending') {
    if (mutation.isPaused) return { ...base, state: 'waiting', detail: null };
    const progress = input.progress.get(mutation.clientOpId);
    if (!progress) return { ...base, state: 'running', detail: null };
    const detail =
      progress.kind === 'busy' ? busyRetrying(progress.attempt) : revisionRetrying(progress.attempt);
    return { ...base, state: 'retrying', detail };
  }
  if (mutation.status === 'error') {
    const code = errorCodeOf(mutation.error);
    // 重複など、押した場所のそばで見せる失敗は操作の行に出さない
    if (code !== null && mutation.inlineCodes.includes(code)) return null;
    const failure = classifyWriteError(mutation.error, mutation.intent.kind);
    return {
      ...base,
      state: 'failed',
      detail: failure.message,
      retryOf: failure.retryable ? mutation.clientOpId : null,
    };
  }
  if (mutation.status === 'success') {
    const operationId = mutation.data?.operation?.id;
    if (operationId !== undefined) {
      if (recordIds.has(operationId)) return null;
    } else if (input.operationsLoaded) {
      // 応答に操作 id を持たない書き込みは、記録を読めていれば記録の行に任せる
      return null;
    }
    return { ...base, state: 'done', detail: null };
  }
  return null;
}

function recordRow(record: OperationRecord, pendingUndoIds: ReadonlySet<string>): OperationRow {
  // email のあとは半角スペースで区切り、「削除された利用者」とは続けて書く
  const undoneBy =
    record.undoneAt === null
      ? null
      : record.undoneByEmail
        ? `${record.undoneByEmail} が元に戻しました`
        : `${DELETED_USER}が元に戻しました`;
  return {
    key: `record-${record.id}`,
    operationId: record.id,
    state: 'done',
    label: operationLabel(record.kind, record.targetVendorName),
    detail: undoneBy,
    actor: record.actorEmail ?? DELETED_USER,
    at: record.createdAt,
    retryOf: null,
    undo: record.undoable
      ? {
          operationId: record.id,
          targetName: record.targetVendorName,
          pending: pendingUndoIds.has(record.id),
        }
      : null,
  };
}

export function operationRows(input: OperationRowsInput): OperationRow[] {
  const recordIds = new Set(input.operations.map((record) => record.id));
  const fromMutations = latestByOperation(input.mutations)
    .map((mutation) => ({ mutation, row: mutationRow(mutation, input, recordIds) }))
    .filter((entry): entry is { mutation: MutationEntry; row: OperationRow } => entry.row !== null);

  // 待機中・処理中は積んだ順の新しいものを先頭に、その後に完了と失敗を時刻の新しい順に並べる
  const pending = fromMutations
    .filter(({ mutation }) => mutation.status === 'pending')
    .sort((a, b) => b.mutation.submittedAt - a.mutation.submittedAt)
    .map(({ row }) => row);
  const settled = [
    ...fromMutations.filter(({ mutation }) => mutation.status !== 'pending').map(({ row }) => row),
    ...input.operations.map((record) => recordRow(record, input.pendingUndoIds)),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return [...pending, ...settled].slice(0, OPERATION_ROW_LIMIT);
}
