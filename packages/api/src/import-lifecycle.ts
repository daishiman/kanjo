/**
 * 取込run/unitの状態、writer claim、active target、D1 atomic commitの共通境界。
 * R2はD1 transaction外なので先にrun/unitへ関連付け、D1側はbatchで1unitを全commitする。
 */
import {
  type BalanceRow,
  type CashEntry,
  type Dataset,
  FINGERPRINT_VERSION,
  type FreeeDeal,
  MF_PERSISTED_IDENTITY_COLUMNS,
  type MfTx,
  STABLE_KEY_VERSION,
  type TxEdit,
  canonicalEncode,
  canonicalMfTransactions,
  freeePersistedRow,
  isCashTxId,
  mfPersistedIdentityRow,
} from '@kanjo/core';
import {
  type AuditAttribute,
  type AuditSourceType,
  type AuditStatementPlan,
  buildAuditStatements,
  opaqueAuditSourceKey,
  opaqueAuditTransactionKey,
} from './audit-log.js';
import { reconcileMfAttachmentParentsStatement } from './canonical-parent-convergence.js';
import { JSON_ACTIVE_TARGET, invalidateJsonSnapshotStatement } from './import-active.js';
import { type ParsedUnit, fingerprintCanonical } from './import-pipeline.js';
import {
  LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
  type ReceiptSourceOverrideSnapshot,
  type ReceiptSourceProfileSnapshot,
  type TaxAccountSettingSnapshot,
  aggRowsFromDataset,
} from './store.js';
import { txEditRestoreRow } from './tx-edit-codec.js';

export type ImportOutcome = 'processing' | 'applying' | 'committed' | 'failed' | 'duplicate';

/** 月ごとの洗い替え前後の件数 */
export interface MonthCountChange {
  month: string;
  before: number;
  after: number;
}

/** MF洗い替えと同じD1 batchへ入れる手当て解決。 */
export interface MfEditResolution {
  existingTxId: string;
  incomingTxId: string;
  choice: 'keep' | 'incoming';
  baseCls: string | null;
  baseOwner: string | null;
  baseMajor: string | null;
  baseMid: string | null;
  baseKnown: number;
  stableKey: string;
}

export interface MfMemoryResolution {
  vendorKey: string;
  vendorLabel: string;
  cls: string | null;
  big: string | null;
  mid: string | null;
  owner: string | null;
}

/** 既存の高確信memoryを通常取込で適用する。今回の回答から学ぶmemoriesとは別物。 */
export interface MfAutoEditResolution {
  txId: string;
  vendorKey: string;
  cls: string | null;
  big: string | null;
  mid: string | null;
  owner: string | null;
  stableKey: string;
}

/**
 * 確定前に解決済みの属性判定。tx/sourceの生identityは一時的にだけ持ち、
 * D1 statement化時に不透明keyへ変換する。API応答へは出さない。
 */
export interface MfResolutionAuditDecision {
  txIdentity: string;
  attribute: AuditAttribute;
  before: string | null;
  after: string | null;
  reason: string;
  sourceType: AuditSourceType;
  sourceIdentity?: string;
}

export interface MfResolutionPlan {
  edits: MfEditResolution[];
  autoEdits: MfAutoEditResolution[];
  memories: MfMemoryResolution[];
  auditDecisions?: MfResolutionAuditDecision[];
}

/** import-resolutionの判定があるunitにだけ、ヘッダ+detailを構成する。 */
export async function buildMfResolutionAuditStatements(args: {
  database: D1Database;
  userId: string;
  runId: string;
  importId: number;
  resolution?: MfResolutionPlan;
  occurredAt: string;
}): Promise<AuditStatementPlan | null> {
  const decisions = args.resolution?.auditDecisions ?? [];
  if (!decisions.length) return null;
  const operationId = `import-resolution:${args.runId}:${args.importId}`;
  const details = await Promise.all(
    decisions.map(async (decision) => ({
      txKey: await opaqueAuditTransactionKey(args.userId, operationId, decision.txIdentity),
      attribute: decision.attribute,
      before: decision.before,
      after: decision.after,
      reason: decision.reason,
      sourceType: decision.sourceType,
      sourceKey: decision.sourceIdentity
        ? await opaqueAuditSourceKey(args.userId, decision.sourceType, decision.sourceIdentity)
        : null,
    })),
  );
  const countTransactions = (predicate: (decision: MfResolutionAuditDecision) => boolean): number =>
    new Set(decisions.filter(predicate).map((decision) => decision.txIdentity)).size;
  const kept = countTransactions((decision) => decision.reason.startsWith('three_way_keep'));
  const incoming = countTransactions((decision) => decision.reason === 'three_way_incoming');
  const conflicts = countTransactions((decision) => decision.reason.startsWith('three_way_'));
  const autoApplied = countTransactions(
    (decision) => decision.sourceType === 'rule' || decision.sourceType === 'vendor_memory',
  );
  return buildAuditStatements({
    database: args.database,
    auditId: operationId,
    userId: args.userId,
    operationId,
    action: 'import_resolution',
    scope: args.importId > 0 ? { kind: 'import', importId: args.importId } : { kind: 'import' },
    counts: {
      resolved: decisions.length,
      kept,
      incoming,
      autoApplied,
      conflicts,
      remembered: args.resolution?.memories.length ?? 0,
    },
    occurredAt: args.occurredAt,
    result: 'succeeded',
    details,
  });
}

/** 行数に比例する書込みをJSON tableで1文ずつに束ねる。 */
export function mfResolutionStatements(
  database: D1Database,
  userId: string,
  plan: MfResolutionPlan | undefined,
  now = new Date().toISOString(),
): D1PreparedStatement[] {
  if (!plan) return [];
  const reset = plan.edits.filter((row) => row.choice === 'incoming');
  const keep = plan.edits.filter((row) => row.choice === 'keep');
  const statements: D1PreparedStatement[] = [];
  for (const payload of chunkJsonRowsByBytes(reset.map((row) => [row.existingTxId])))
    statements.push(
      database
        .prepare(
          `DELETE FROM tx_edits WHERE user_id=? AND tx_id IN (
             SELECT CAST(json_extract(value,'$[0]') AS TEXT) FROM json_each(?)
           )`,
        )
        .bind(userId, payload),
    );
  for (const payload of chunkJsonRowsByBytes(
    keep.map((row) => [
      row.existingTxId,
      row.incomingTxId,
      row.baseCls,
      row.baseOwner,
      row.baseMajor,
      row.baseMid,
      row.stableKey,
      row.baseKnown,
    ]),
  ))
    statements.push(
      database
        .prepare(
          `UPDATE tx_edits
              SET tx_id=(SELECT CAST(json_extract(value,'$[1]') AS TEXT) FROM json_each(?)
                           WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id),
                  base_cls=CASE WHEN (base_known & 1)=0
                           THEN (SELECT json_extract(value,'$[2]') FROM json_each(?)
                                 WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id)
                           ELSE base_cls END,
                  base_owner=CASE WHEN (base_known & 8)=0
                           THEN (SELECT json_extract(value,'$[3]') FROM json_each(?)
                                 WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id)
                           ELSE base_owner END,
                  base_major=CASE WHEN (base_known & 2)=0
                           THEN (SELECT json_extract(value,'$[4]') FROM json_each(?)
                                 WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id)
                           ELSE base_major END,
                  base_mid=CASE WHEN (base_known & 4)=0
                           THEN (SELECT json_extract(value,'$[5]') FROM json_each(?)
                                 WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id)
                           ELSE base_mid END,
                  stable_key=(SELECT CAST(json_extract(value,'$[6]') AS TEXT) FROM json_each(?)
                           WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id),
                  base_known=base_known | COALESCE((SELECT CAST(json_extract(value,'$[7]') AS INTEGER)
                           FROM json_each(?) WHERE CAST(json_extract(value,'$[0]') AS TEXT)=tx_edits.tx_id),0),
                  fingerprint_version=?
            WHERE user_id=? AND tx_id IN (
              SELECT CAST(json_extract(value,'$[0]') AS TEXT) FROM json_each(?)
            )`,
        )
        .bind(
          payload,
          payload,
          payload,
          payload,
          payload,
          payload,
          payload,
          STABLE_KEY_VERSION,
          userId,
          payload,
        ),
    );
  for (const payload of chunkJsonRowsByBytes(
    plan.autoEdits.map((row) => [
      row.txId,
      row.cls,
      row.big,
      row.mid,
      row.owner,
      row.stableKey,
      row.vendorKey,
    ]),
  ))
    statements.push(
      database
        .prepare(
          `INSERT INTO tx_edits
             (user_id,tx_id,cls,category_major,category_mid,owner,stable_key,
              fingerprint_version,origin,origin_key,updated_at)
           SELECT ?,
                  CAST(json_extract(value,'$[0]') AS TEXT),
                  json_extract(value,'$[1]'), json_extract(value,'$[2]'),
                  json_extract(value,'$[3]'), json_extract(value,'$[4]'),
                  CAST(json_extract(value,'$[5]') AS TEXT),
                  ?, 'vendor_memory', CAST(json_extract(value,'$[6]') AS TEXT), ?
             FROM json_each(?) WHERE 1
           ON CONFLICT(user_id,tx_id) DO NOTHING`,
        )
        .bind(userId, STABLE_KEY_VERSION, now, payload),
    );
  for (const payload of chunkJsonRowsByBytes(
    plan.memories.map((row) => [row.vendorKey, row.vendorLabel, row.cls, row.big, row.mid, row.owner]),
  ))
    statements.push(
      database
        .prepare(
          `INSERT INTO vendor_memory
             (user_id,vendor_key,vendor_label,cls,category_major,category_mid,owner,
              hit_count,disagree_count,pinned,revoked,created_at,updated_at)
           SELECT ?, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'),
                  json_extract(value,'$[3]'), json_extract(value,'$[4]'), json_extract(value,'$[5]'),
                  1,0,1,0,?,? FROM json_each(?) WHERE 1
           ON CONFLICT(user_id,vendor_key) DO UPDATE SET
             vendor_label=excluded.vendor_label, cls=excluded.cls,
             category_major=excluded.category_major, category_mid=excluded.category_mid,
             owner=excluded.owner, hit_count=vendor_memory.hit_count+1,
             pinned=1, revoked=0, updated_at=excluded.updated_at`,
        )
        .bind(userId, now, now, payload),
    );
  return statements;
}

/**
 * 洗い替えで件数が減る月。「月の途中までのファイル」を取り込んでしまった疑いの唯一の手掛かり。
 *
 * 件数が同じ・増える月は返さない。減る月が1つでもあれば、その取込は月全体を置き換える前提と
 * 食い違っている可能性がある(freee 側で行を消した場合など、正しく減ることもあるので判断は利用者に返す)。
 */
export function shrinkingMonths(
  months: string[],
  before: Map<string, number>,
  after: Map<string, number>,
): MonthCountChange[] {
  return months
    .map((month) => ({ month, before: before.get(month) ?? 0, after: after.get(month) ?? 0 }))
    .filter((m) => m.before > m.after);
}

/** Worker request上限より十分長く、各unit前にheartbeatする。crash後は15分で回復可能。 */
export const IMPORT_CLAIM_TTL_MS = 15 * 60 * 1000;
/** D1の1query 100KB上限に余白を取り、UTF-8 bytesでchunkする。 */
export const D1_JSON_PAYLOAD_MAX_BYTES = 80 * 1024;
/** Cloudflare Workers Freeの1 invocation上限。安全側に49 queriesまでを受理する。 */
export const D1_FREE_QUERY_LIMIT = 50;
/** prior claim SELECT + stale takeover時のclaim/unit/run 3-statement batch。 */
export const IMPORT_CLAIM_WORST_CASE_QUERY_COUNT = 4;

export interface ImportQueryPlan {
  total: number;
  limit: number;
  accepted: boolean;
  breakdown: {
    preflightReads: number;
    lifecycle: number;
    heartbeats: number;
    unitTransitions: number;
    commitStatements: number;
  };
}

const sumPlan = (breakdown: ImportQueryPlan['breakdown']): ImportQueryPlan => {
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total, limit: D1_FREE_QUERY_LIMIT, accepted: total < D1_FREE_QUERY_LIMIT, breakdown };
};

/**
 * POST /importsが実行するqueryのworst-case。commitStatementsは実際のbuilder.length。
 * stale claim回復を常に予算化するため、通常claimの実測より2多い。
 */
export function planMultipartImportQueries(args: {
  fileCount: number;
  unitCount: number;
  applicableUnitCount: number;
  jsonUnitCount: number;
  commitStatementCounts: number[];
}): ImportQueryPlan {
  const { fileCount, unitCount, applicableUnitCount, jsonUnitCount, commitStatementCounts } = args;
  return sumPlan({
    // canonical planning snapshot(norm/cash/freee/splits) + loadDataset(cash snapshot)
    preflightReads: 1 + LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
    // run create + worst claim + attempt inserts + initial reconcile + release + outer catch cleanup(2)
    lifecycle: 5 + IMPORT_CLAIM_WORST_CASE_QUERY_COUNT + unitCount,
    heartbeats: fileCount + applicableUnitCount,
    // active lookup + duplicate詳細 + 応答喪失時のfailed CAS(2)+settled read。JSONはhash確定を追加
    unitTransitions: 5 * applicableUnitCount + jsonUnitCount,
    commitStatements: commitStatementCounts.reduce((sum, count) => sum + count, 0),
  });
}

/** POST /restore用。R2/file heartbeat/freee countは無いがJSON content_hash確定は行う。 */
export function planRestoreImportQueries(commitStatementCount: number): ImportQueryPlan {
  return sumPlan({
    // canonical planning snapshot(norm/cash/freee/splits) + loadDataset(cash snapshot)
    preflightReads: 1 + LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
    // run create + worst claim + attempt insert + release + outer catch cleanup(2)
    lifecycle: 5 + IMPORT_CLAIM_WORST_CASE_QUERY_COUNT,
    heartbeats: 0,
    // content_hash確定 + active lookup + duplicate詳細 + 応答喪失時のfailed CAS(2)+settled read
    unitTransitions: 6,
    commitStatements: commitStatementCount,
  });
}

export function targetKeysForUnit(unit: ParsedUnit): string[] {
  if (unit.kind === 'error') return [];
  if (unit.kind === 'json') return [JSON_ACTIVE_TARGET];
  return unit.months.map((month) => `${unit.kind}:${month}`).sort();
}

/** 同一multipart内の競合を解析後・R2/DB書込み前に検出する。 */
export function preflightWriteSetConflicts(units: ParsedUnit[]): string[] {
  const applicable = units.filter((unit) => unit.kind !== 'error');
  const conflicts = new Set<string>();
  const jsonCount = applicable.filter((unit) => unit.kind === 'json').length;
  // JSON復元は複数tableのglobal snapshotなので、他unitと同一requestで優先順を作らない。
  if (jsonCount > 1 || (jsonCount === 1 && applicable.length > 1)) conflicts.add('json:global');

  const seen = new Set<string>();
  for (const unit of applicable) {
    if (unit.kind === 'json') continue;
    for (const key of targetKeysForUnit(unit)) {
      if (seen.has(key)) conflicts.add(key);
      seen.add(key);
    }
  }
  return [...conflicts].sort();
}

export async function createImportRun(
  database: D1Database,
  userId: string,
  runId: string,
  now = new Date().toISOString(),
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO import_runs (id,user_id,status,failure_reason,created_at,updated_at)
       VALUES (?,?,'processing',NULL,?,?)`,
    )
    .bind(runId, userId, now, now)
    .run();
}

export async function updateImportRun(
  database: D1Database,
  runId: string,
  status: ImportOutcome,
  failureReason: string | null,
  now = new Date().toISOString(),
): Promise<void> {
  await database
    .prepare('UPDATE import_runs SET status=?, failure_reason=?, updated_at=? WHERE id=?')
    .bind(status, failureReason, now, runId)
    .run();
}

/** INSERT..ON CONFLICT..WHEREの1 statementで単一writerをclaimする。 */
export async function acquireImportWriter(
  database: D1Database,
  userId: string,
  runId: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const prior = await database
    .prepare('SELECT run_id, expires_at FROM import_writer_claims WHERE user_id=?')
    .bind(userId)
    .first<{ run_id: string; expires_at: number }>();
  const claimStatement = database
    .prepare(
      `INSERT INTO import_writer_claims (user_id,run_id,claimed_at,expires_at)
       VALUES (?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         run_id=excluded.run_id,
         claimed_at=excluded.claimed_at,
         expires_at=excluded.expires_at
       WHERE import_writer_claims.expires_at <= excluded.claimed_at
          OR import_writer_claims.run_id = excluded.run_id
       RETURNING run_id`,
    )
    .bind(userId, runId, nowMs, nowMs + IMPORT_CLAIM_TTL_MS);
  const recovering = !!prior && prior.run_id !== runId && prior.expires_at <= nowMs;
  const reason = '処理中に中断されたため、新しい取込で回復しました';
  const now = new Date(nowMs).toISOString();
  const statements: D1PreparedStatement[] = [claimStatement];
  if (recovering) {
    // claim取得・旧unitのCAS失敗化・旧run収束を1つのD1 transactionにする。
    statements.push(
      database
        .prepare(
          `UPDATE imports SET status='failed', failure_reason=?
           WHERE run_id=? AND status IN ('processing','applying')
             AND EXISTS (
               SELECT 1 FROM import_writer_claims
               WHERE user_id=? AND run_id=?
             )`,
        )
        .bind(reason, prior.run_id, userId, runId),
      reconcileImportRunStatement(database, prior.run_id, now, reason),
    );
  }
  const [claimResult] = await database.batch(statements);
  const claimed = (claimResult.results?.[0] ?? null) as { run_id?: string } | null;
  return claimed?.run_id === runId;
}

export async function heartbeatImportWriter(
  database: D1Database,
  userId: string,
  runId: string,
  nowMs = Date.now(),
): Promise<void> {
  const result = await database
    .prepare(
      `UPDATE import_writer_claims
       SET claimed_at=?, expires_at=?
       WHERE user_id=? AND run_id=?`,
    )
    .bind(nowMs, nowMs + IMPORT_CLAIM_TTL_MS, userId, runId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) throw new Error('import writer claim lost');
}

export async function releaseImportWriter(
  database: D1Database,
  userId: string,
  runId: string,
): Promise<void> {
  await database
    .prepare('DELETE FROM import_writer_claims WHERE user_id=? AND run_id=?')
    .bind(userId, runId)
    .run();
}

/**
 * canonical commit batch の先頭で lease token と unit の source status を同時に検査する。
 * 不一致時は run_id=NULL が NOT NULL 制約に違反するため、zero-row UPDATE と異なり
 * D1 batch 全体を実際に rollback させる。成功時は同じ token の TTL も更新する。
 */
export function importLeaseGuardStatement(args: {
  database: D1Database;
  userId: string;
  runId: string;
  importId: number;
  nowMs?: number;
}): D1PreparedStatement {
  const nowMs = args.nowMs ?? Date.now();
  return args.database
    .prepare(
      `INSERT INTO import_writer_claims (user_id,run_id,claimed_at,expires_at)
       VALUES (
         ?,
         CASE WHEN
           EXISTS (
             SELECT 1 FROM import_writer_claims
             WHERE user_id=? AND run_id=? AND expires_at>?
           )
           AND EXISTS (
             SELECT 1 FROM imports
             WHERE id=? AND user_id=? AND run_id=? AND status='processing'
           )
         THEN ? ELSE NULL END,
         ?,?
       )
       ON CONFLICT(user_id) DO UPDATE SET
         run_id=excluded.run_id,
         claimed_at=excluded.claimed_at,
         expires_at=excluded.expires_at`,
    )
    .bind(
      args.userId,
      args.userId,
      args.runId,
      nowMs,
      args.importId,
      args.userId,
      args.runId,
      args.runId,
      nowMs,
      nowMs + IMPORT_CLAIM_TTL_MS,
    );
}

const beginImportCommitStatements = (args: {
  database: D1Database;
  userId: string;
  runId: string;
  importId: number;
}): D1PreparedStatement[] => [
  importLeaseGuardStatement(args),
  args.database
    .prepare(
      `UPDATE imports SET status='applying', failure_reason=NULL
       WHERE id=? AND user_id=? AND run_id=? AND status='processing'`,
    )
    .bind(args.importId, args.userId, args.runId),
];

/** active targetがすべて同じfingerprintのときだけbusiness duplicate。 */
export async function activeDuplicateOf(
  database: D1Database,
  userId: string,
  targetKeys: string[],
  contentHash: string,
): Promise<number | null> {
  if (!targetKeys.length) return null;
  const row = await database
    .prepare(
      `SELECT COUNT(*) AS matched, MIN(import_id) AS import_id
       FROM import_active_targets
       WHERE user_id=? AND content_hash=?
         AND target_key IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
    )
    .bind(userId, contentHash, JSON.stringify(targetKeys))
    .first<{ matched: number; import_id: number | null }>();
  return row?.matched === targetKeys.length ? row.import_id : null;
}

const jsonBytes = (value: string): number => new TextEncoder().encode(value).byteLength;

/** JSON配列payloadをrow境界で分け、各queryをD1の100KB制限内に保つpure helper。 */
export function chunkJsonRowsByBytes(
  rows: ReadonlyArray<readonly unknown[]>,
  maxBytes = D1_JSON_PAYLOAD_MAX_BYTES,
): string[] {
  const chunks: string[] = [];
  let items: string[] = [];
  let bytes = 2;
  for (const row of rows) {
    const encoded = JSON.stringify(row);
    const size = jsonBytes(encoded) + (items.length ? 1 : 0);
    if (size + 2 > maxBytes) throw new Error('1行がD1 JSON payload上限を超えています');
    if (items.length && bytes + size > maxBytes) {
      chunks.push(`[${items.join(',')}]`);
      items = [];
      bytes = 2;
    }
    items.push(encoded);
    bytes += jsonBytes(encoded) + (items.length > 1 ? 1 : 0);
  }
  if (items.length) chunks.push(`[${items.join(',')}]`);
  return chunks;
}

export const insertJsonRows = (
  database: D1Database,
  table: string,
  jsonColumns: readonly string[],
  rows: ReadonlyArray<readonly unknown[]>,
  scalarColumns: ReadonlyArray<{ column: string; value: unknown }> = [],
): D1PreparedStatement[] => {
  const columns = [...scalarColumns.map(({ column }) => column), ...jsonColumns];
  const projection = [
    ...scalarColumns.map(() => '?'),
    ...jsonColumns.map((_, index) => `json_extract(item.value,'$[${index}]')`),
  ].join(',');
  return chunkJsonRowsByBytes(rows).map((payload) =>
    database
      .prepare(
        `INSERT INTO ${table} (${columns.join(',')})
         SELECT ${projection} FROM json_each(?) AS item`,
      )
      .bind(...scalarColumns.map(({ value }) => value), payload),
  );
};

const deleteJsonValues = (
  database: D1Database,
  table: string,
  userId: string,
  column: string,
  values: readonly string[],
): D1PreparedStatement[] =>
  chunkJsonRowsByBytes(values.map((value) => [value])).map((payload) =>
    database
      .prepare(
        `DELETE FROM ${table} WHERE user_id=?
         AND ${column} IN (
           SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
         )`,
      )
      .bind(userId, payload),
  );

const replaceAggStatements = (database: D1Database, userId: string, data: Dataset): D1PreparedStatement[] => [
  database.prepare('DELETE FROM monthly_agg WHERE user_id=?').bind(userId),
  ...insertJsonRows(
    database,
    'monthly_agg',
    ['month', 'scope', 'amount'],
    aggRowsFromDataset(userId, data).map((row) => [row.month, row.scope, row.amount]),
    [{ column: 'user_id', value: userId }],
  ),
];

const replaceUnrecordedStatements = (
  database: D1Database,
  userId: string,
  months: string[],
): D1PreparedStatement[] => [
  database.prepare("DELETE FROM unrecorded_months WHERE user_id=? AND kind='expense'").bind(userId),
  ...insertJsonRows(
    database,
    'unrecorded_months',
    ['month'],
    months.map((month) => [month]),
    [
      { column: 'user_id', value: userId },
      { column: 'kind', value: 'expense' },
    ],
  ),
];

export function reconcileImportRunStatement(
  database: D1Database,
  runId: string,
  now = new Date().toISOString(),
  fallbackFailureReason = '取込処理を完了できませんでした',
): D1PreparedStatement {
  return database
    .prepare(
      `UPDATE import_runs
       SET status = CASE
         WHEN EXISTS (SELECT 1 FROM imports WHERE run_id=import_runs.id AND status IN ('processing','applying'))
           THEN 'applying'
         WHEN EXISTS (SELECT 1 FROM imports WHERE run_id=import_runs.id AND status='failed')
           THEN 'failed'
         WHEN EXISTS (SELECT 1 FROM imports WHERE run_id=import_runs.id AND status='committed')
           THEN 'committed'
         WHEN EXISTS (SELECT 1 FROM imports WHERE run_id=import_runs.id AND status='duplicate')
           THEN 'duplicate'
         ELSE 'failed'
       END,
       failure_reason = CASE
         WHEN NOT EXISTS (SELECT 1 FROM imports WHERE run_id=import_runs.id AND status IN ('processing','applying'))
          AND EXISTS (SELECT 1 FROM imports WHERE run_id=import_runs.id AND status='failed')
         THEN COALESCE(
           (SELECT failure_reason FROM imports WHERE run_id=import_runs.id AND status='failed' ORDER BY id LIMIT 1),
           ?
         )
         ELSE NULL
       END,
       updated_at=?
       WHERE id=?`,
    )
    .bind(fallbackFailureReason, now, runId);
}

export async function reconcileImportRun(
  database: D1Database,
  runId: string,
  now = new Date().toISOString(),
): Promise<void> {
  await reconcileImportRunStatement(database, runId, now).run();
}

const finalizeStatements = (
  database: D1Database,
  userId: string,
  runId: string,
  importId: number,
  contentHash: string,
  targetKeys: string[],
  sourceKind: 'freee' | 'mf' | 'json' | 'assets',
  now: string,
): D1PreparedStatement[] => {
  const globalSnapshot = targetKeys.includes(JSON_ACTIVE_TARGET);
  /**
   * JSONバックアップの復元write-setを変えたときだけ、activeなJSON pointerを落とす。
   * 残高(balance_entries)はその write-set に入っていないので落とす理由がない。
   * 無用に落とすと、同じバックアップの入れ直しが重複と判定できなくなる。
   */
  const pointerStatements: D1PreparedStatement[] = globalSnapshot
    ? [database.prepare('DELETE FROM import_active_targets WHERE user_id=?').bind(userId)]
    : sourceKind === 'assets'
      ? []
      : [
          invalidateJsonSnapshotStatement(
            database,
            userId,
            sourceKind === 'freee' ? 'freee_deals' : 'mf_transactions',
          ),
        ];
  const activeUpserts = chunkJsonRowsByBytes(targetKeys.map((targetKey) => [targetKey])).map((payload) =>
    database
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         SELECT ?, json_extract(item.value,'$[0]'), ?, ?, ?
         FROM json_each(?) AS item WHERE 1
         ON CONFLICT(user_id,target_key) DO UPDATE SET
           content_hash=excluded.content_hash,
           import_id=excluded.import_id,
           updated_at=excluded.updated_at`,
      )
      .bind(userId, contentHash, importId, now, payload),
  );
  return [
    ...pointerStatements,
    database
      .prepare(
        `UPDATE imports
         SET status='committed', failure_reason=NULL, fingerprint_version=?, committed_at=?
         WHERE id=? AND user_id=? AND run_id=? AND status='applying'`,
      )
      .bind(FINGERPRINT_VERSION, now, importId, userId, runId),
    ...activeUpserts,
    reconcileImportRunStatement(database, runId, now),
  ];
};

const monthDelete = (
  database: D1Database,
  table: string,
  userId: string,
  months: string[],
): D1PreparedStatement[] => deleteJsonValues(database, table, userId, 'month', months);

export function freeeCommitStatements(args: {
  database: D1Database;
  userId: string;
  deals: FreeeDeal[];
  months: string[];
  runId: string;
  importId: number;
  contentHash: string;
  targetKeys: string[];
  data: Dataset;
  now?: string;
}): D1PreparedStatement[] {
  const { database, userId, deals, months, runId, importId, contentHash, targetKeys, data } = args;
  const now = args.now ?? new Date().toISOString();
  return [
    ...beginImportCommitStatements({ database, userId, runId, importId }),
    ...monthDelete(database, 'freee_deals', userId, months),
    ...insertJsonRows(
      database,
      'freee_deals',
      [
        'month',
        'date',
        'io',
        'partner',
        'account_raw',
        'account_norm',
        'amount',
        'due_date',
        'settled_date',
        'settle_account',
        'settled_amount',
        'settlement_known',
      ],
      deals.map((deal) => freeePersistedRow(deal)),
      [
        { column: 'user_id', value: userId },
        { column: 'import_id', value: importId },
      ],
    ),
    ...replaceUnrecordedStatements(database, userId, data.unrecordedExpMonths),
    ...replaceAggStatements(database, userId, data),
    ...finalizeStatements(database, userId, runId, importId, contentHash, targetKeys, 'freee', now),
  ];
}

/**
 * MFの資産推移CSV(残高)を確定する。
 *
 * 消すのは source='mf' の行だけ。負債は画面で手入力したもの(source='manual')で、
 * CSVには最初から入っていない。月ごと全消しにすると、CSVを入れ直すたびに
 * 手入力した負債が黙って消える。
 *
 * 月次集計(monthly_agg)は書き換えない。残高は収支に1円も入らないため。
 */
export function assetsCommitStatements(args: {
  database: D1Database;
  userId: string;
  balances: readonly BalanceRow[];
  months: string[];
  runId: string;
  importId: number;
  contentHash: string;
  targetKeys: string[];
  now?: string;
}): D1PreparedStatement[] {
  const { database, userId, balances, months, runId, importId, contentHash, targetKeys } = args;
  const now = args.now ?? new Date().toISOString();
  const deleteImported = chunkJsonRowsByBytes(months.map((month) => [month])).map((payload) =>
    database
      .prepare(
        `DELETE FROM balance_entries
          WHERE user_id=? AND source='mf'
            AND month IN (
              SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
            )`,
      )
      .bind(userId, payload),
  );
  return [
    ...beginImportCommitStatements({ database, userId, runId, importId }),
    ...deleteImported,
    ...insertJsonRows(
      database,
      'balance_entries',
      ['month', 'date', 'side', 'category', 'amount'],
      balances.map((b) => [b.month, b.date, b.side, b.category, b.amount]),
      [
        { column: 'user_id', value: userId },
        { column: 'source', value: 'mf' },
        { column: 'created_at', value: now },
        { column: 'updated_at', value: now },
      ],
    ),
    ...finalizeStatements(database, userId, runId, importId, contentHash, targetKeys, 'assets', now),
  ];
}

export function mfCommitStatements(args: {
  database: D1Database;
  userId: string;
  txs: MfTx[];
  months: string[];
  runId: string;
  importId: number;
  contentHash: string;
  targetKeys: string[];
  data: Dataset;
  resolution?: MfResolutionPlan;
  audit?: AuditStatementPlan | null;
  now?: string;
}): D1PreparedStatement[] {
  const { database, userId, months, runId, importId, contentHash, targetKeys, data } = args;
  const now = args.now ?? new Date().toISOString();
  const txs = canonicalMfTransactions(args.txs);
  const resolution = mfResolutionStatements(database, userId, args.resolution, now);
  const deleteReplacement = database
    .prepare(
      `DELETE FROM mf_transactions
        WHERE user_id=?
          AND (month IN (SELECT CAST(value AS TEXT) FROM json_each(?))
            OR tx_id IN (SELECT CAST(value AS TEXT) FROM json_each(?)))`,
    )
    .bind(userId, JSON.stringify(months), JSON.stringify(txs.map((tx) => tx.id)));
  const removeOrphanSplits = database
    .prepare(
      `DELETE FROM tx_splits
        WHERE user_id=?
          AND NOT EXISTS (
            SELECT 1 FROM mf_transactions m
             WHERE m.user_id=tx_splits.user_id
               AND m.tx_id=tx_splits.tx_id
               AND m.identity_stable=1
          )`,
    )
    .bind(userId);
  return [
    ...beginImportCommitStatements({ database, userId, runId, importId }),
    deleteReplacement,
    ...insertJsonRows(
      database,
      'mf_transactions',
      MF_PERSISTED_IDENTITY_COLUMNS,
      txs.map((tx) => mfPersistedIdentityRow(tx)),
      [
        { column: 'user_id', value: userId },
        { column: 'import_id', value: importId },
      ],
    ),
    ...resolution,
    removeOrphanSplits,
    reconcileMfAttachmentParentsStatement(database, userId, now),
    ...replaceAggStatements(database, userId, data),
    ...finalizeStatements(database, userId, runId, importId, contentHash, targetKeys, 'mf', now),
    ...(args.audit?.statements ?? []),
  ];
}

/**
 * 復元するとき、手当てに第二の引き当て鍵(DR-13)を持たせるかどうかを決める。
 *
 * `stable_key` は tx_id が振り直されたときに手当てを追うための鍵で、
 * `fingerprint_version` はその鍵を作った版。版が違う鍵どうしは突き合わせない。
 * 戻り値は `[stable_key, fingerprint_version]` の順で、そのまま行に載る。
 */
const editRows = (edits: Record<string, TxEdit>): unknown[][] =>
  Object.entries(edits).map(([txId, edit]) => txEditRestoreRow(txId, edit));

export interface RestoreWriteSet {
  mfRows: ReturnType<typeof mfPersistedIdentityRow>[];
  vendorRows: unknown[][];
  analysisSettingsRow: [number];
  subVendorExclusionRows: unknown[][];
  taxAccountSettingRows: unknown[][];
  receiptSourceProfileRows: unknown[][];
  receiptSourceOverrideRows: unknown[][];
  /** commitの差分計画。fingerprintは最終行だけを使い、この実行手順は含めない。 */
  analysisSettingsChanged: boolean;
  subVendorExclusionsChanged: boolean;
  taxAccountSettingsChanged: boolean;
  receiptSourceProfilesChanged: boolean;
  receiptSourceOverridesChanged: boolean;
  ruleRows: unknown[][];
  editRows: unknown[][];
  ownerRows: unknown[][];
  budgetRows: unknown[][];
  cashOverrideRows: unknown[][];
  restoredAggRows: unknown[][];
  unrecordedMonths: string[];
  monthlyAggRows: unknown[][];
  /** canonical split children。projection行は永続化しない。 */
  splitRows: unknown[][];
  /**
   * 復元する現金の記帳。移行先に1件も記帳が無いときだけ入る(空なら現金は一切触らない)。
   * `cash:<id>` は手動判定・証憑の宛先なので、idはバックアップの値をそのまま使う。
   */
  cashEntryRows: unknown[][];
}

/** restoreのmerge/default適用後に、実際にpersistするtable行を一度だけ構成する。 */
export function prepareRestoreWriteSet(args: {
  userId: string;
  data: Dataset;
  restored: Dataset;
  statMinMonths?: number;
  subVendorExclusions?: ReadonlyArray<{ partner: string; vendorKey: string }>;
  existingStatMinMonths?: number;
  existingSubVendorExclusions?: ReadonlyArray<{ partner: string; vendorKey: string }>;
  taxAccountSettings?: ReadonlyArray<TaxAccountSettingSnapshot>;
  existingTaxAccountSettings?: ReadonlyArray<TaxAccountSettingSnapshot>;
  receiptSourceProfiles?: ReadonlyArray<ReceiptSourceProfileSnapshot>;
  existingReceiptSourceProfiles?: ReadonlyArray<ReceiptSourceProfileSnapshot>;
  receiptSourceOverrides?: ReadonlyArray<ReceiptSourceOverrideSnapshot>;
  existingReceiptSourceOverrides?: ReadonlyArray<ReceiptSourceOverrideSnapshot>;
  /** 復元する現金の記帳。移行先に既存の記帳があるときは渡さない */
  restoredCashEntries?: ReadonlyArray<CashEntry>;
  /** raw canonical dataから明示的に作った集計・表示用projection */
  accountingData?: Dataset;
}): RestoreWriteSet {
  const rawTxs = canonicalMfTransactions(args.data.mfTx.filter((tx) => !isCashTxId(tx.id)));
  const taxRows = (settings: ReadonlyArray<TaxAccountSettingSnapshot>): unknown[][] =>
    [...settings]
      .sort((a, b) => a.taxYear - b.taxYear || a.account.localeCompare(b.account, 'ja'))
      .map((entry) => [entry.taxYear, entry.account, entry.taxAccount, entry.businessPercent, entry.basis]);
  const taxAccountSettingRows = taxRows(args.taxAccountSettings ?? []);
  const existingTaxAccountSettingRows = taxRows(args.existingTaxAccountSettings ?? []);
  const receiptProfileRows = (profiles: ReadonlyArray<ReceiptSourceProfileSnapshot>): unknown[][] =>
    [...profiles]
      .sort((a, b) => a.profileKey.localeCompare(b.profileKey))
      .map((profile) => [
        profile.profileKey,
        profile.merchantKey,
        profile.serviceName,
        profile.sourceUrl,
        profile.loginAccount,
        profile.memo,
      ]);
  const receiptOverrideRows = (overrides: ReadonlyArray<ReceiptSourceOverrideSnapshot>): unknown[][] =>
    [...overrides]
      .sort((a, b) => a.targetKind.localeCompare(b.targetKind) || a.targetKey.localeCompare(b.targetKey))
      .map((override) => [
        override.targetKind,
        override.targetKey,
        override.merchantKey,
        override.profileKey,
        override.serviceName,
        override.sourceUrl,
        override.loginAccount,
        override.memo,
      ]);
  const receiptSourceProfileRows = receiptProfileRows(args.receiptSourceProfiles ?? []);
  const existingReceiptSourceProfileRows = receiptProfileRows(args.existingReceiptSourceProfiles ?? []);
  const receiptSourceOverrideRows = receiptOverrideRows(args.receiptSourceOverrides ?? []);
  const existingReceiptSourceOverrideRows = receiptOverrideRows(args.existingReceiptSourceOverrides ?? []);
  return {
    // MF/editsはDBでは集合として永続化される。JSON配列/object挿入順を指紋へ混ぜない。
    mfRows: rawTxs
      .map(mfPersistedIdentityRow)
      .sort((a, b) => canonicalEncode(a).localeCompare(canonicalEncode(b))),
    vendorRows: [...new Set(args.data.subs.vendors)].map((name, index) => [
      name,
      JSON.stringify([...new Set(args.data.subs.aliases?.[name] ?? [])].sort()),
      JSON.stringify([...new Set(args.data.subs.accounts?.[name] ?? [])].sort()),
      index,
    ]),
    analysisSettingsRow: [args.statMinMonths ?? 6],
    subVendorExclusionRows: [...(args.subVendorExclusions ?? [])]
      .sort((a, b) => a.vendorKey.localeCompare(b.vendorKey))
      .map((entry) => [entry.partner, entry.vendorKey]),
    taxAccountSettingRows,
    receiptSourceProfileRows,
    receiptSourceOverrideRows,
    analysisSettingsChanged: (args.statMinMonths ?? 6) !== args.existingStatMinMonths,
    subVendorExclusionsChanged:
      canonicalEncode(
        [...(args.subVendorExclusions ?? [])]
          .sort((a, b) => a.vendorKey.localeCompare(b.vendorKey))
          .map((entry) => [entry.partner, entry.vendorKey]),
      ) !==
      canonicalEncode(
        [...(args.existingSubVendorExclusions ?? [])]
          .sort((a, b) => a.vendorKey.localeCompare(b.vendorKey))
          .map((entry) => [entry.partner, entry.vendorKey]),
      ),
    taxAccountSettingsChanged:
      canonicalEncode(taxAccountSettingRows) !== canonicalEncode(existingTaxAccountSettingRows),
    receiptSourceProfilesChanged:
      canonicalEncode(receiptSourceProfileRows) !== canonicalEncode(existingReceiptSourceProfileRows),
    receiptSourceOverridesChanged:
      canonicalEncode(receiptSourceOverrideRows) !== canonicalEncode(existingReceiptSourceOverrideRows),
    ruleRows: args.data.rules.map((rule, index) => [
      rule.k,
      rule.cls ?? null,
      rule.big ?? null,
      rule.mid ?? null,
      rule.owner ?? null,
      index,
    ]),
    editRows: editRows(args.data.edits).sort(([a], [b]) => String(a).localeCompare(String(b))),
    ownerRows: Object.entries(args.data.institutionOwners).sort(([a], [b]) => a.localeCompare(b)),
    budgetRows: Object.entries(args.data.budgets).sort(([a], [b]) => a.localeCompare(b)),
    cashOverrideRows: Object.entries(args.data.cashOverride)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => [month, value.revenue, value.expense]),
    restoredAggRows: aggRowsFromDataset(args.userId, args.restored)
      .map((row) => [row.month, row.scope, row.amount])
      .sort(([am, as], [bm, bs]) => `${am}\0${as}`.localeCompare(`${bm}\0${bs}`)),
    unrecordedMonths: [...new Set(args.data.unrecordedExpMonths)].sort(),
    monthlyAggRows: aggRowsFromDataset(args.userId, args.accountingData ?? args.data)
      .map((row) => [row.month, row.scope, row.amount])
      .sort(([am, as], [bm, bs]) => `${am}\0${as}`.localeCompare(`${bm}\0${bs}`)),
    splitRows: [...args.data.txSplits]
      .sort((a, b) => a.txId.localeCompare(b.txId) || a.seq - b.seq || a.lineId.localeCompare(b.lineId))
      .map((row) => [
        row.txId,
        row.lineId,
        row.seq,
        row.parentAmount,
        row.amount,
        row.cls,
        row.categoryMajor,
        row.categoryMid,
        row.memo ?? null,
        row.createdAt ?? null,
        row.updatedAt ?? null,
        row.owner ?? null,
      ]),
    cashEntryRows: [...(args.restoredCashEntries ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((entry) => [
        entry.id,
        entry.date,
        entry.month,
        entry.side,
        entry.io,
        entry.amount,
        entry.description,
        entry.categoryMajor,
        entry.categoryMid,
        entry.memo ?? null,
        entry.transitFrom ?? null,
        entry.transitTo ?? null,
        entry.transitRound ? 1 : 0,
        entry.receiptWaived ? 1 : 0,
      ]),
  };
}

/** merge後の実効的な永続write-set全体をbusiness fingerprintにする。 */
export async function restoreWriteSetFingerprint(writeSet: RestoreWriteSet): Promise<string> {
  const {
    analysisSettingsChanged: _analysisChanged,
    subVendorExclusionsChanged: _exclusionsChanged,
    taxAccountSettingsChanged: _taxAccountSettingsChanged,
    receiptSourceProfilesChanged: _receiptSourceProfilesChanged,
    receiptSourceOverridesChanged: _receiptSourceOverridesChanged,
    ...rows
  } = writeSet;
  return fingerprintCanonical(`v${FINGERPRINT_VERSION}:json-write-set:${canonicalEncode(rows)}`);
}

/** multipart JSONとPOST /restoreが共有するrestore commandのD1 write-set。 */
export function restoreCommitStatements(args: {
  database: D1Database;
  userId: string;
  runId: string;
  writeSet: RestoreWriteSet;
  importId: number;
  contentHash: string;
  targetKeys: string[];
  now?: string;
}): D1PreparedStatement[] {
  const { database, userId, runId, writeSet, importId, contentHash, targetKeys } = args;
  const now = args.now ?? new Date().toISOString();
  const mfStatements = mfReplaceOnlyStatements(database, userId, writeSet.mfRows, importId);
  return [
    ...beginImportCommitStatements({ database, userId, runId, importId }),
    ...mfStatements,
    database.prepare('DELETE FROM tx_splits WHERE user_id=?').bind(userId),
    ...insertJsonRows(
      database,
      'tx_splits',
      [
        'tx_id',
        'line_id',
        'seq',
        'parent_amount',
        'amount',
        'cls',
        'category_major',
        'category_mid',
        'memo',
        'created_at',
        'updated_at',
        // 0035: 内訳1行の名義
        'owner',
      ],
      writeSet.splitRows,
      [{ column: 'user_id', value: userId }],
    ),
    ...chunkJsonRowsByBytes(writeSet.vendorRows).map((payload) =>
      database
        .prepare(
          `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order,created_at)
           SELECT ?,
                  CAST(json_extract(item.value,'$[0]') AS TEXT),
                  CAST(json_extract(item.value,'$[1]') AS TEXT),
                  CAST(json_extract(item.value,'$[2]') AS TEXT),
                  CAST(json_extract(item.value,'$[3]') AS INTEGER), ?
           FROM json_each(?) AS item WHERE 1
           ON CONFLICT(user_id,name) DO UPDATE SET
             aliases=excluded.aliases, accounts=excluded.accounts, sort_order=excluded.sort_order`,
        )
        .bind(userId, now, payload),
    ),
    ...(writeSet.analysisSettingsChanged
      ? [
          database
            .prepare(
              `INSERT INTO analysis_settings (user_id,stat_min_months,updated_at) VALUES (?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET
                 stat_min_months=excluded.stat_min_months, updated_at=excluded.updated_at`,
            )
            .bind(userId, writeSet.analysisSettingsRow[0], now),
        ]
      : []),
    ...(writeSet.subVendorExclusionsChanged && writeSet.subVendorExclusionRows.length
      ? chunkJsonRowsByBytes(writeSet.subVendorExclusionRows).map((payload) =>
          database
            .prepare(
              `INSERT INTO sub_vendor_exclusions
                 (user_id,partner,vendor_key,created_at)
               SELECT ?,
                      CAST(json_extract(item.value,'$[0]') AS TEXT),
                      CAST(json_extract(item.value,'$[1]') AS TEXT), ?
               FROM json_each(?) AS item WHERE 1
               ON CONFLICT(user_id,vendor_key) DO UPDATE SET
                 partner=excluded.partner`,
            )
            .bind(userId, now, payload),
        )
      : []),
    ...(writeSet.taxAccountSettingsChanged && writeSet.taxAccountSettingRows.length
      ? chunkJsonRowsByBytes(writeSet.taxAccountSettingRows).map((payload) =>
          database
            .prepare(
              `INSERT INTO tax_account_settings
                 (user_id,tax_year,account,tax_account,business_percent,basis,updated_at)
               SELECT ?,
                      CAST(json_extract(item.value,'$[0]') AS INTEGER),
                      CAST(json_extract(item.value,'$[1]') AS TEXT),
                      CAST(json_extract(item.value,'$[2]') AS TEXT),
                      CAST(json_extract(item.value,'$[3]') AS INTEGER),
                      CAST(json_extract(item.value,'$[4]') AS TEXT), ?
               FROM json_each(?) AS item WHERE 1
               ON CONFLICT(user_id,tax_year,account) DO UPDATE SET
                 tax_account=excluded.tax_account,
                 business_percent=excluded.business_percent,
                 basis=excluded.basis,
                 updated_at=excluded.updated_at`,
            )
            .bind(userId, now, payload),
        )
      : []),
    ...(writeSet.receiptSourceProfilesChanged && writeSet.receiptSourceProfileRows.length
      ? chunkJsonRowsByBytes(writeSet.receiptSourceProfileRows).map((payload) =>
          database
            .prepare(
              `INSERT INTO receipt_source_profiles
                 (user_id,profile_key,merchant_key,service_name,source_url,login_account,memo,updated_at)
               SELECT ?,
                      CAST(json_extract(item.value,'$[0]') AS TEXT),
                      CAST(json_extract(item.value,'$[1]') AS TEXT),
                      CAST(json_extract(item.value,'$[2]') AS TEXT),
                      CAST(json_extract(item.value,'$[3]') AS TEXT),
                      CAST(json_extract(item.value,'$[4]') AS TEXT),
                      CAST(json_extract(item.value,'$[5]') AS TEXT), ?
               FROM json_each(?) AS item WHERE 1
               ON CONFLICT(user_id,profile_key) DO UPDATE SET
                 merchant_key=excluded.merchant_key,
                 service_name=excluded.service_name,
                 source_url=excluded.source_url,
                 login_account=excluded.login_account,
                 memo=excluded.memo,
                 updated_at=excluded.updated_at`,
            )
            .bind(userId, now, payload),
        )
      : []),
    ...(writeSet.receiptSourceOverridesChanged && writeSet.receiptSourceOverrideRows.length
      ? chunkJsonRowsByBytes(writeSet.receiptSourceOverrideRows).map((payload) =>
          database
            .prepare(
              `INSERT INTO receipt_source_overrides
                 (user_id,target_kind,target_key,merchant_key,profile_key,
                  service_name,source_url,login_account,memo,updated_at)
               SELECT ?,
                      CAST(json_extract(item.value,'$[0]') AS TEXT),
                      CAST(json_extract(item.value,'$[1]') AS TEXT),
                      CAST(json_extract(item.value,'$[2]') AS TEXT),
                      CAST(json_extract(item.value,'$[3]') AS TEXT),
                      CAST(json_extract(item.value,'$[4]') AS TEXT),
                      CAST(json_extract(item.value,'$[5]') AS TEXT),
                      CAST(json_extract(item.value,'$[6]') AS TEXT),
                      CAST(json_extract(item.value,'$[7]') AS TEXT), ?
               FROM json_each(?) AS item WHERE 1
               ON CONFLICT(user_id,target_kind,target_key) DO UPDATE SET
                 merchant_key=excluded.merchant_key,
                 profile_key=excluded.profile_key,
                 service_name=excluded.service_name,
                 source_url=excluded.source_url,
                 login_account=excluded.login_account,
                 memo=excluded.memo,
                 updated_at=excluded.updated_at`,
            )
            .bind(userId, now, payload),
        )
      : []),
    database.prepare('DELETE FROM rules WHERE user_id=?').bind(userId),
    ...insertJsonRows(
      database,
      'rules',
      ['keyword', 'cls', 'category_major', 'category_mid', 'owner', 'sort_order'],
      writeSet.ruleRows,
      [
        { column: 'user_id', value: userId },
        { column: 'created_at', value: now },
      ],
    ),
    database.prepare('DELETE FROM tx_edits WHERE user_id=?').bind(userId),
    ...insertJsonRows(
      database,
      'tx_edits',
      [
        'tx_id',
        'cls',
        'category_major',
        'category_mid',
        'owner',
        'base_major',
        'base_mid',
        // 4属性ぶんの基準値をそろえて戻す。2つだけ戻すと、復元直後の再取込で
        // 公私・名義だけが「利用者は触っていない」と読まれ、手当てが消える(D6)
        'base_cls',
        'base_owner',
        'base_known',
        'note',
        'updated_at',
        'stable_key',
        'fingerprint_version',
        // 0035: 口座の振替。戻さないと、復元後に振り替えた明細が元の口座へ戻る
        'institution',
      ],
      writeSet.editRows,
      [{ column: 'user_id', value: userId }],
    ),
    database.prepare('DELETE FROM institution_owners WHERE user_id=?').bind(userId),
    ...insertJsonRows(database, 'institution_owners', ['institution', 'owner'], writeSet.ownerRows, [
      { column: 'user_id', value: userId },
    ]),
    database.prepare('DELETE FROM budgets WHERE user_id=?').bind(userId),
    ...insertJsonRows(database, 'budgets', ['account', 'monthly_amount'], writeSet.budgetRows, [
      { column: 'user_id', value: userId },
    ]),
    database.prepare('DELETE FROM cash_overrides WHERE user_id=?').bind(userId),
    ...insertJsonRows(
      database,
      'cash_overrides',
      ['month', 'revenue', 'expense'],
      writeSet.cashOverrideRows,
      [{ column: 'user_id', value: userId }],
    ),
    database.prepare('DELETE FROM restored_monthly_agg WHERE user_id=?').bind(userId),
    ...insertJsonRows(
      database,
      'restored_monthly_agg',
      ['month', 'scope', 'amount'],
      writeSet.restoredAggRows,
      [{ column: 'user_id', value: userId }],
    ),
    ...restoreCashEntryStatements(database, userId, writeSet.cashEntryRows, now),
    ...replaceUnrecordedStatements(database, userId, writeSet.unrecordedMonths),
    database.prepare('DELETE FROM monthly_agg WHERE user_id=?').bind(userId),
    ...insertJsonRows(database, 'monthly_agg', ['month', 'scope', 'amount'], writeSet.monthlyAggRows, [
      { column: 'user_id', value: userId },
    ]),
    ...finalizeStatements(database, userId, runId, importId, contentHash, targetKeys, 'json', now),
  ];
}

/**
 * 現金の記帳を復元する。移行先に記帳が1件も無いときだけ呼ばれるので DELETE はしない
 * (既存の記帳を消すのは復元ではなく破壊であり、この経路の役目ではない)。
 *
 * id はバックアップの値をそのまま入れる。`cash:<id>` が手動判定と証憑の宛先だからで、
 * 採番し直すと復元済みの証憑メタデータが宛先を失う。
 *
 * 証憑の `parent_missing_at` はここで消さない。49 query予算に1 queryも積めないうえ、
 * 親の生死判定は証憑のsafe recovery(`/api/attachments/archive/recover`)側の役目で、
 * 復元後にそちらを回せば同じ結果になる。
 */
function restoreCashEntryStatements(
  database: D1Database,
  userId: string,
  rows: ReadonlyArray<readonly unknown[]>,
  now: string,
): D1PreparedStatement[] {
  if (rows.length === 0) return [];
  return insertJsonRows(
    database,
    'cash_entries',
    [
      'id',
      'date',
      'month',
      'side',
      'io',
      'amount',
      'description',
      'category_major',
      'category_mid',
      'memo',
      'transit_from',
      'transit_to',
      'transit_round',
      'receipt_waived',
    ],
    rows,
    [
      { column: 'user_id', value: userId },
      { column: 'created_at', value: now },
      { column: 'updated_at', value: now },
    ],
  );
}

function mfReplaceOnlyStatements(
  database: D1Database,
  userId: string,
  rows: ReturnType<typeof mfPersistedIdentityRow>[],
  importId: number,
): D1PreparedStatement[] {
  if (rows.length === 0) return [];
  const months = [...new Set(rows.map((row) => row[1]))].sort();
  const now = new Date().toISOString();
  return [
    database
      .prepare(
        `DELETE FROM mf_transactions
          WHERE user_id=?
            AND (month IN (SELECT CAST(value AS TEXT) FROM json_each(?))
              OR tx_id IN (SELECT CAST(value AS TEXT) FROM json_each(?)))`,
      )
      .bind(userId, JSON.stringify(months), JSON.stringify(rows.map((row) => row[0]))),
    ...insertJsonRows(database, 'mf_transactions', MF_PERSISTED_IDENTITY_COLUMNS, rows, [
      { column: 'user_id', value: userId },
      { column: 'import_id', value: importId },
    ]),
    reconcileMfAttachmentParentsStatement(database, userId, now),
  ];
}
