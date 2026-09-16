import type { ReconciliationReport } from '@kanjo/core';
import { type PeriodMeta, api } from '../../../api.js';

export type ReconciliationActionKind = 'same' | 'different' | 'exclude-mf' | 'exclude-freee';

export interface ReconciliationLastAction {
  id: string;
  action: ReconciliationActionKind;
  targetCount: number;
  createdAt: string;
}

/** GET /api/reconciliation。一致度・件数・キューはサーバが core で導出した値をそのまま描く */
export interface ReconciliationResponse extends ReconciliationReport {
  period: PeriodMeta;
  lastAction: ReconciliationLastAction | null;
}

export interface ReconciliationTarget {
  txId?: string;
  freeeKey?: string;
}

export interface ReconciliationActionResponse {
  results: { txId: string | null; freeeKey: string | null; ok: boolean; reason?: string }[];
  saved: number;
  action: ReconciliationLastAction | null;
}

export const postReconciliationAction = (action: ReconciliationActionKind, targets: ReconciliationTarget[]) =>
  api<ReconciliationActionResponse>('/reconciliation/actions', {
    method: 'POST',
    body: JSON.stringify({ action, targets }),
  });

export const undoReconciliationAction = (id: string) =>
  api<{
    ok: true;
    action: { id: string; action: ReconciliationActionKind; targetCount: number; undoneAt: string };
  }>(`/reconciliation/actions/${encodeURIComponent(id)}/undo`, { method: 'POST' });
