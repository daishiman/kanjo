/**
 * 「操作」の行の合成 (SM-FE-07)。待機中と失敗は画面の mutation にしか無く、他の利用者の完了は記録にしか無い。
 * 同じ操作が両方に現れても 1 行にし、直近 5 件だけを、処理中を先頭にして並べる。
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api.js';
import type { OperationRecord } from './api.js';
import type { RetryProgress } from './operationProgress.js';
import {
  type MutationEntry,
  OPERATION_ROW_LIMIT,
  type OperationRowsInput,
  STATE_TEXT,
  operationRows,
} from './operationRows.js';
import {
  BUSY_EXHAUSTED,
  SERVER_FAILED,
  WriteFailure,
  busyRetrying,
  revisionRetrying,
} from './operationText.js';
import type { WriteIntent } from './types.js';

const T0 = Date.parse('2026-10-01T09:00:00.000Z');
const at = (minutes: number) => T0 + minutes * 60_000;
const isoAt = (minutes: number) => new Date(at(minutes)).toISOString();

const merge = (targetName: string): WriteIntent => ({
  kind: 'merge',
  targetId: 1,
  targetName,
  targetKey: null,
  sourceVendorIds: [2],
  sourceKeys: ['b'],
  rawNames: [],
  names: {},
});

const mutation = (clientOpId: number, extra: Partial<MutationEntry> = {}): MutationEntry => ({
  clientOpId,
  intent: merge(`統合先${clientOpId}`),
  inlineCodes: [],
  status: 'pending',
  isPaused: false,
  submittedAt: at(clientOpId),
  data: undefined,
  error: null,
  ...extra,
});

const record = (id: string, minutes: number, extra: Partial<OperationRecord> = {}): OperationRecord => ({
  id,
  kind: 'merge',
  targetVendorName: 'Aqua Voice',
  createdAt: isoAt(minutes),
  actorEmail: 'other@example.com',
  undoneAt: null,
  undoneByEmail: null,
  undoable: false,
  undoBlockedReason: 'not_merge',
  ...extra,
});

const input = (extra: Partial<OperationRowsInput> = {}): OperationRowsInput => ({
  mutations: [],
  operations: [],
  operationsLoaded: true,
  progress: new Map<number, RetryProgress>(),
  currentEmail: 'owner@example.com',
  pendingUndoIds: new Set<string>(),
  ...extra,
});

describe('operationRows', () => {
  it('状態の文字は 4 つで、自動の送り直しは「処理中」のまま色だけを変える', () => {
    expect(STATE_TEXT).toEqual({
      waiting: '待機中',
      running: '処理中',
      retrying: '処理中',
      done: '完了',
      failed: '失敗',
    });
  });

  it('前の操作を待っている mutation は待機中、送っているものは処理中で、ログイン中の利用者を操作者にする', () => {
    const rows = operationRows(input({ mutations: [mutation(1), mutation(2, { isPaused: true })] }));
    expect(rows.map((row) => [row.key, row.state, row.label, row.actor])).toEqual([
      ['client-2', 'waiting', '統合先2 へ統合', 'owner@example.com'],
      ['client-1', 'running', '統合先1 へ統合', 'owner@example.com'],
    ]);
  });

  it('自動の送り直しの途中は、種類と何回目かを説明に出す', () => {
    const progress = new Map<number, RetryProgress>([
      [1, { kind: 'busy', attempt: 2 }],
      [2, { kind: 'revision', attempt: 1 }],
    ]);
    const rows = operationRows(input({ mutations: [mutation(1), mutation(2)], progress }));
    expect(rows.find((row) => row.key === 'client-1')).toMatchObject({
      state: 'retrying',
      detail: busyRetrying(2),
    });
    expect(rows.find((row) => row.key === 'client-2')).toMatchObject({
      state: 'retrying',
      detail: revisionRetrying(1),
    });
  });

  it('5xx と busy の上限は再試行つきの失敗、選び直すしかない失敗は再試行を出さない', () => {
    const rows = operationRows(
      input({
        mutations: [
          mutation(1, {
            status: 'error',
            error: new WriteFailure('request', new ApiError(500, 'internal', 'x')),
          }),
          mutation(2, {
            status: 'error',
            error: new WriteFailure('busy', new ApiError(409, 'canonical_write_busy', 'x')),
          }),
          mutation(3, { status: 'error', error: new WriteFailure('stale', null, ['Notion']) }),
        ],
      }),
    );
    expect(rows.map((row) => [row.key, row.state, row.retryOf])).toEqual([
      ['client-3', 'failed', null],
      ['client-2', 'failed', 2],
      ['client-1', 'failed', 1],
    ]);
    expect(rows[1]?.detail).toBe(BUSY_EXHAUSTED);
    expect(rows[2]?.detail).toBe(SERVER_FAILED);
    expect(rows[0]?.detail).toContain('Notion');
  });

  it('押した場所のそばで見せる失敗 (重複) は行にしない', () => {
    const duplicate = new WriteFailure('request', new ApiError(409, 'duplicate', '同じ名前があります'));
    const rows = operationRows(
      input({
        mutations: [
          mutation(1, {
            intent: { kind: 'vendor_create', name: 'A' },
            inlineCodes: ['duplicate'],
            status: 'error',
            error: duplicate,
          }),
        ],
      }),
    );
    expect(rows).toEqual([]);
  });

  it('失敗の後の「再試行」は同じ行の続きとして、最後の mutation の状態だけを出す', () => {
    const failed = mutation(1, { status: 'error', error: new ApiError(500, 'internal', 'x') });
    const retried = mutation(1, { status: 'pending', submittedAt: at(5) });
    const rows = operationRows(input({ mutations: [failed, retried] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'client-1', state: 'running', retryOf: null, at: isoAt(5) });
  });

  it('統合と取り消しの完了は、記録に同じ操作 id があれば記録の行に任せる', () => {
    const done = mutation(1, {
      status: 'success',
      data: { revision: 3, operation: { id: 'op-1', kind: 'merge', targetVendorId: 1, createdAt: isoAt(1) } },
    });
    const rows = operationRows(input({ mutations: [done], operations: [record('op-1', 1)] }));
    expect(rows.map((row) => row.key)).toEqual(['record-op-1']);
    // 記録をまだ取り直していなければ、画面の完了を出しておく
    const before = operationRows(input({ mutations: [done], operations: [] }));
    expect(before.map((row) => [row.key, row.state])).toEqual([['client-1', 'done']]);
  });

  it('操作 id を持たない完了は、記録を読めていれば記録に任せ、読めていなければ画面の行を残す', () => {
    const done = mutation(1, {
      intent: { kind: 'vendor_create', name: 'A' },
      status: 'success',
      data: { revision: 3, id: 9 },
    });
    expect(operationRows(input({ mutations: [done] }))).toEqual([]);
    expect(operationRows(input({ mutations: [done], operationsLoaded: false }))).toMatchObject([
      { key: 'client-1', state: 'done', label: '登録' },
    ]);
  });

  it('処理中を先頭に積んだ新しい順、その後に完了と失敗を時刻の新しい順に並べ、5 件で切る', () => {
    const rows = operationRows(
      input({
        mutations: [
          mutation(10, { status: 'error', error: new TypeError('Failed to fetch'), submittedAt: at(10) }),
          mutation(1, { submittedAt: at(1) }),
          mutation(2, { isPaused: true, submittedAt: at(2) }),
        ],
        operations: [record('a', 30), record('b', 20), record('c', 5), record('d', 0)],
      }),
    );
    expect(OPERATION_ROW_LIMIT).toBe(5);
    expect(rows.map((row) => row.key)).toEqual(['client-2', 'client-1', 'record-a', 'record-b', 'client-10']);
  });

  it('記録の操作者と取り消した人を出し、削除された利用者は名前で言い換え、操作 id は文字に出さない', () => {
    const rows = operationRows(
      input({
        operations: [
          record('op-a', 3, { actorEmail: null, undoneAt: isoAt(4), undoneByEmail: 'owner@example.com' }),
          record('op-b', 2, { undoneAt: isoAt(4), undoneByEmail: null }),
        ],
      }),
    );
    expect(rows[0]).toMatchObject({
      operationId: 'op-a',
      actor: '削除された利用者',
      detail: 'owner@example.com が元に戻しました',
      state: 'done',
    });
    expect(rows[1]?.detail).toBe('削除された利用者が元に戻しました');
    for (const row of rows) {
      expect(`${row.label} ${row.detail} ${row.actor}`).not.toContain(row.operationId ?? '');
    }
  });

  it('元に戻せる統合には取り消しを付け、取り消しを積んでいる間は押せない印を付ける', () => {
    const undoable = record('op-1', 1, { undoable: true, undoBlockedReason: null });
    expect(operationRows(input({ operations: [undoable] }))[0]?.undo).toEqual({
      operationId: 'op-1',
      targetName: 'Aqua Voice',
      pending: false,
    });
    expect(
      operationRows(input({ operations: [undoable], pendingUndoIds: new Set(['op-1']) }))[0]?.undo?.pending,
    ).toBe(true);
    expect(operationRows(input({ operations: [record('op-2', 1)] }))[0]?.undo).toBeNull();
  });
});
