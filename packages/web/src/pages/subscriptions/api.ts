/**
 * サブスク画面の通信。書き込みは「何を送るか (WriteRequest)」と「いつ・どの base と key で送るか」を分け、
 * 後者は useSubscriptionWrites の mutationFn だけが決める。本文は送る直前に最新の値から作る (SM-FE-04)。
 * 失敗は ApiError のまま投げ、操作の行の文言への言い換えは operationText が持つ (楽観更新はしない)。
 */
import { type SubVendorExclusionRow, type SubVendorRow, api } from '../../api.js';

/** 送る要求。base revision と Idempotency-Key は含めない */
export interface WriteRequest {
  path: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: Record<string, unknown>;
}

/**
 * 全書き込みの唯一の送り口。key は再送の識別子、base は利用者が見ていた revision。
 * revision をまだ 1 度も受け取っていない (API の反映前) ときは base を省き、API に現在値として扱わせる。
 */
export const sendWrite = <T = WriteResponse>(
  request: WriteRequest,
  key: string,
  baseRevision: number | null,
) =>
  api<T>(request.path, {
    method: request.method,
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(baseRevision === null ? request.body : { ...request.body, baseRevision }),
  });

/** 書き込みの応答はどれも、反映後の revision を持つ */
export interface WriteResult {
  revision: number;
  replayed?: boolean;
}

export interface MergeResult extends WriteResult {
  operation: { id: string; kind: 'merge'; targetVendorId: number; createdAt: string };
}

export interface UndoResult extends WriteResult {
  operation: { id: string; kind: 'unmerge'; undoesId: string; createdAt: string };
}

/** どの書き込みの応答も読める形。登録は id、統合と取り消しは operation を持つ */
export interface WriteResponse extends WriteResult {
  id?: number;
  operation?: MergeResult['operation'] | UndoResult['operation'];
}

export interface SubVendorsResponse {
  vendors: SubVendorRow[];
  accountOptions: string[];
  revision?: number;
}

export interface SubCandidatesResponse {
  excluded: SubVendorExclusionRow[];
}

export type {
  SubscriptionOperationKind as OperationKind,
  SubscriptionOperationRecord as OperationRecord,
} from '@kanjo/core';
import type { SubscriptionOperationRecord as OperationRecord } from '@kanjo/core';

export interface OperationsResponse {
  operations: OperationRecord[];
  revision: number;
}

export const getSubVendors = () => api<SubVendorsResponse>('/sub-vendors');

/** 操作の記録は直近 20 件。画面はこのうち 5 件を出す */
export const getOperations = () => api<OperationsResponse>('/subscription-operations?limit=20');
