/**
 * 非有効な取込履歴と、最後の参照になった保存原本だけを破棄する。
 * canonical data の取消は deletion-lifecycle が所有し、この経路では1行も触らない(DR-17)。
 */
import { canonicalEncode, importHistoryDiscardBlock } from '@kanjo/core';
import { buildAuditStatements } from './audit-log.js';
import type { AuthEnv } from './auth.js';
import { reconcileImportRunStatement } from './import-lifecycle.js';
import { processR2CleanupJobNow, r2CleanupEnqueueStatement } from './r2-cleanup.js';

export type ImportOriginalDisposition = 'delete' | 'keep_shared' | 'none';

interface ImportDiscardRow {
  id: number;
  status: string | null;
  r2_key: string | null;
  run_id: string | null;
  active_targets: number;
  canonical_rows: number;
  undo_snapshots: number;
  shared_references: number;
}

export interface ImportHistoryDiscardPlan {
  importId: number;
  fingerprint: string;
  originalDisposition: ImportOriginalDisposition;
  /** APIへは返さない内部値。 */
  r2Key: string | null;
  /** APIへは返さない内部値。 */
  runId: string | null;
}

export class ImportHistoryDiscardNotFoundError extends Error {
  constructor() {
    super('import history not found');
    this.name = 'ImportHistoryDiscardNotFoundError';
  }
}

export class ImportHistoryDiscardNotAllowedError extends Error {
  constructor(
    readonly reason:
      | 'in_progress'
      | 'legacy'
      | 'active'
      | 'has_canonical_data'
      | 'has_undo_snapshot'
      | 'unsupported_state',
  ) {
    super(`import history discard not allowed: ${reason}`);
    this.name = 'ImportHistoryDiscardNotAllowedError';
  }
}

export class ImportHistoryDiscardScopeChangedError extends Error {
  constructor() {
    super('import history discard scope changed');
    this.name = 'ImportHistoryDiscardScopeChangedError';
  }
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

async function loadDiscardRow(
  database: D1Database,
  userId: string,
  importId: number,
): Promise<ImportDiscardRow | null> {
  return database
    .prepare(
      `SELECT i.id,i.status,i.r2_key,i.run_id,
              (SELECT COUNT(*) FROM import_active_targets a
                WHERE a.user_id=i.user_id AND a.import_id=i.id) AS active_targets,
              ((SELECT COUNT(*) FROM mf_transactions m
                 WHERE m.user_id=i.user_id AND m.import_id=i.id)
               +
               (SELECT COUNT(*) FROM freee_deals f
                 WHERE f.user_id=i.user_id AND f.import_id=i.id)) AS canonical_rows,
              ((SELECT COUNT(*) FROM import_deleted_targets t
                 WHERE t.user_id=i.user_id AND t.import_id=i.id)
               +
               (SELECT COUNT(*) FROM import_deleted_rows d
                 WHERE d.user_id=i.user_id
                   AND json_valid(d.payload_json)
                   AND CAST(json_extract(d.payload_json,'$.import_id') AS INTEGER)=i.id)) AS undo_snapshots,
              (SELECT COUNT(*) FROM imports sibling
                WHERE sibling.user_id=i.user_id AND sibling.id<>i.id
                  AND i.r2_key IS NOT NULL AND sibling.r2_key=i.r2_key) AS shared_references
         FROM imports i
        WHERE i.user_id=? AND i.id=?`,
    )
    .bind(userId, importId)
    .first<ImportDiscardRow>();
}

export async function planImportHistoryDiscard(
  database: D1Database,
  userId: string,
  importId: number,
): Promise<ImportHistoryDiscardPlan> {
  const row = await loadDiscardRow(database, userId, importId);
  if (!row) throw new ImportHistoryDiscardNotFoundError();
  const block = importHistoryDiscardBlock({
    status: row.status,
    activeTargetCount: row.active_targets,
    canonicalRowCount: row.canonical_rows,
    undoSnapshotCount: row.undo_snapshots,
  });
  if (block) throw new ImportHistoryDiscardNotAllowedError(block);

  const originalDisposition: ImportOriginalDisposition = !row.r2_key
    ? 'none'
    : row.shared_references > 0
      ? 'keep_shared'
      : 'delete';
  const fingerprint = `v1:import-discard:${await sha256Hex(
    canonicalEncode({
      userId,
      importId: row.id,
      status: row.status,
      r2Key: row.r2_key,
      runId: row.run_id,
      activeTargets: row.active_targets,
      canonicalRows: row.canonical_rows,
      undoSnapshots: row.undo_snapshots,
      sharedReferences: row.shared_references,
    }),
  )}`;
  return {
    importId: row.id,
    fingerprint,
    originalDisposition,
    r2Key: row.r2_key,
    runId: row.run_id,
  };
}

export interface ImportHistoryDiscardResult {
  discarded: true;
  original: 'deleted' | 'deletion_pending' | 'kept_shared' | 'not_recorded';
}

export async function executeImportHistoryDiscard(args: {
  env: Pick<AuthEnv, 'DB' | 'FILES'> & Partial<AuthEnv>;
  userId: string;
  importId: number;
  expectedFingerprint: string;
  operationId: string;
  now?: Date;
}): Promise<ImportHistoryDiscardResult> {
  const plan = await planImportHistoryDiscard(args.env.DB, args.userId, args.importId);
  if (plan.fingerprint !== args.expectedFingerprint) throw new ImportHistoryDiscardScopeChangedError();

  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const audit = buildAuditStatements({
    database: args.env.DB,
    auditId: args.operationId,
    userId: args.userId,
    operationId: args.operationId,
    action: 'import_discard',
    scope: { kind: 'import', importId: args.importId },
    counts: { imports: 1 },
    occurredAt: nowIso,
    result: 'succeeded',
  });

  const statements: D1PreparedStatement[] = [];
  let cleanupStatementIndex = -1;
  if (plan.originalDisposition === 'delete' && plan.r2Key) {
    cleanupStatementIndex = statements.length;
    // R2操作より先にintentを履歴削除と同じD1 transactionへ入れ、keyを失わない。
    statements.push(
      r2CleanupEnqueueStatement(args.env.DB, {
        userId: args.userId,
        r2Key: plan.r2Key,
        purpose: 'import_original',
        now: nowIso,
      }),
    );
  }
  statements.push(
    args.env.DB.prepare('UPDATE imports SET duplicate_of=NULL WHERE user_id=? AND duplicate_of=?').bind(
      args.userId,
      args.importId,
    ),
    args.env.DB.prepare('DELETE FROM imports WHERE user_id=? AND id=?').bind(args.userId, args.importId),
  );
  if (plan.runId) {
    statements.push(
      reconcileImportRunStatement(args.env.DB, plan.runId, nowIso),
      args.env.DB.prepare(
        `DELETE FROM import_runs WHERE id=? AND user_id=?
             AND NOT EXISTS (SELECT 1 FROM imports WHERE run_id=?)`,
      ).bind(plan.runId, args.userId, plan.runId),
    );
  }
  statements.push(...audit.statements);

  const results = await args.env.DB.batch(statements);

  if (cleanupStatementIndex < 0) {
    return {
      discarded: true,
      original: plan.originalDisposition === 'keep_shared' ? 'kept_shared' : 'not_recorded',
    };
  }

  const cleanupRow = (results[cleanupStatementIndex]?.results?.[0] ?? null) as { id?: number } | null;
  let pendingResult: 'retry' | 'dead' | 'not_found' = 'not_found';
  try {
    const cleanupResult = cleanupRow?.id
      ? await processR2CleanupJobNow(args.env, cleanupRow.id, now)
      : 'not_found';
    if (cleanupResult === 'completed') return { discarded: true, original: 'deleted' };
    pendingResult = cleanupResult;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        job: 'r2_cleanup',
        importId: args.importId,
        name: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return { discarded: true, original: 'deletion_pending' };
  }
  console.error(
    JSON.stringify({
      level: 'error',
      job: 'r2_cleanup',
      importId: args.importId,
      result: pendingResult,
    }),
  );
  // 履歴削除は確定済みだが、intentはD1に残る。次回Cronが同じR2 DELETEを再試行する。
  return { discarded: true, original: 'deletion_pending' };
}
