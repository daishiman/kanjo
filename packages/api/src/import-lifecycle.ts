/**
 * 取込run/unitの状態、writer claim、active target、D1 atomic commitの共通境界。
 * R2はD1 transaction外なので先にrun/unitへ関連付け、D1側はbatchで1unitを全commitする。
 */
import {
  type Dataset,
  FINGERPRINT_VERSION,
  type FreeeDeal,
  MF_PERSISTED_IDENTITY_COLUMNS,
  type MfTx,
  type TxEdit,
  canonicalEncode,
  canonicalMfTransactions,
  freeePersistedRow,
  isCashTxId,
  mfPersistedIdentityRow,
} from '@kanjo/core';
import { JSON_ACTIVE_TARGET, invalidateJsonSnapshotStatement } from './import-active.js';
import { type ParsedUnit, fingerprintCanonical } from './import-pipeline.js';
import { LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT, aggRowsFromDataset } from './store.js';

export type ImportOutcome = 'processing' | 'applying' | 'committed' | 'failed' | 'duplicate';

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
    // norm map + cash + loadDataset(cash snapshot) + freee count
    preflightReads: 3 + LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
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
    // cash + loadDataset(cash snapshot) + norm map + retained freee原本
    preflightReads: 3 + LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
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

const insertJsonRows = (
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
  sourceKind: 'freee' | 'mf' | 'json',
  now: string,
): D1PreparedStatement[] => {
  const globalSnapshot = targetKeys.includes(JSON_ACTIVE_TARGET);
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
    globalSnapshot
      ? database.prepare('DELETE FROM import_active_targets WHERE user_id=?').bind(userId)
      : invalidateJsonSnapshotStatement(
          database,
          userId,
          sourceKind === 'freee' ? 'freee_deals' : 'mf_transactions',
        ),
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
      ['month', 'date', 'io', 'partner', 'account_raw', 'account_norm', 'amount'],
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
  now?: string;
}): D1PreparedStatement[] {
  const { database, userId, months, runId, importId, contentHash, targetKeys, data } = args;
  const now = args.now ?? new Date().toISOString();
  const txs = canonicalMfTransactions(args.txs);
  const deleteReplacement = database
    .prepare(
      `DELETE FROM mf_transactions
        WHERE user_id=?
          AND (month IN (SELECT CAST(value AS TEXT) FROM json_each(?))
            OR tx_id IN (SELECT CAST(value AS TEXT) FROM json_each(?)))`,
    )
    .bind(userId, JSON.stringify(months), JSON.stringify(txs.map((tx) => tx.id)));
  const syncAttachmentParents = database
    .prepare(
      `UPDATE attachments
          SET parent_missing_at=CASE
            WHEN EXISTS (
              SELECT 1 FROM mf_transactions m
               WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
            ) THEN NULL ELSE COALESCE(parent_missing_at,?) END
        WHERE user_id=? AND target_kind='mf'
          AND ((parent_missing_at IS NULL AND NOT EXISTS (
                  SELECT 1 FROM mf_transactions m
                   WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
               ))
            OR (parent_missing_at IS NOT NULL AND EXISTS (
                  SELECT 1 FROM mf_transactions m
                   WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
               )))`,
    )
    .bind(now, userId);
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
    syncAttachmentParents,
    ...replaceAggStatements(database, userId, data),
    ...finalizeStatements(database, userId, runId, importId, contentHash, targetKeys, 'mf', now),
  ];
}

const editRows = (edits: Record<string, TxEdit>): unknown[][] =>
  Object.entries(edits).map(([txId, edit]) => [
    txId,
    edit.cls ?? null,
    edit.big ?? null,
    edit.mid ?? null,
    edit.owner ?? null,
    edit.baseBig ?? null,
    edit.baseMid ?? null,
    edit.note ?? null,
    edit.updatedAt ?? null,
  ]);

export interface RestoreWriteSet {
  mfRows: ReturnType<typeof mfPersistedIdentityRow>[];
  vendors: string[];
  ruleRows: unknown[][];
  editRows: unknown[][];
  ownerRows: unknown[][];
  budgetRows: unknown[][];
  cashOverrideRows: unknown[][];
  restoredAggRows: unknown[][];
  unrecordedMonths: string[];
  monthlyAggRows: unknown[][];
}

/** restoreのmerge/default適用後に、実際にpersistするtable行を一度だけ構成する。 */
export function prepareRestoreWriteSet(args: {
  userId: string;
  data: Dataset;
  restored: Dataset;
}): RestoreWriteSet {
  const rawTxs = canonicalMfTransactions(args.data.mfTx.filter((tx) => !isCashTxId(tx.id)));
  return {
    // MF/editsはDBでは集合として永続化される。JSON配列/object挿入順を指紋へ混ぜない。
    mfRows: rawTxs
      .map(mfPersistedIdentityRow)
      .sort((a, b) => canonicalEncode(a).localeCompare(canonicalEncode(b))),
    vendors: [...new Set(args.data.subs.vendors)].sort(),
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
    monthlyAggRows: aggRowsFromDataset(args.userId, args.data)
      .map((row) => [row.month, row.scope, row.amount])
      .sort(([am, as], [bm, bs]) => `${am}\0${as}`.localeCompare(`${bm}\0${bs}`)),
  };
}

/** merge後の実効的な永続write-set全体をbusiness fingerprintにする。 */
export async function restoreWriteSetFingerprint(writeSet: RestoreWriteSet): Promise<string> {
  return fingerprintCanonical(`v${FINGERPRINT_VERSION}:json-write-set:${canonicalEncode(writeSet)}`);
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
    ...chunkJsonRowsByBytes(writeSet.vendors.map((name) => [name])).map((payload) =>
      database
        .prepare(
          `INSERT INTO sub_vendors (user_id,name,aliases,sort_order,created_at)
           SELECT ?, CAST(json_extract(item.value,'$[0]') AS TEXT), '[]', 100, ?
           FROM json_each(?) AS item
           WHERE NOT EXISTS (
             SELECT 1 FROM sub_vendors
             WHERE user_id=? AND name=CAST(json_extract(item.value,'$[0]') AS TEXT)
           )`,
        )
        .bind(userId, now, payload, userId),
    ),
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
        'note',
        'updated_at',
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
    ...replaceUnrecordedStatements(database, userId, writeSet.unrecordedMonths),
    database.prepare('DELETE FROM monthly_agg WHERE user_id=?').bind(userId),
    ...insertJsonRows(database, 'monthly_agg', ['month', 'scope', 'amount'], writeSet.monthlyAggRows, [
      { column: 'user_id', value: userId },
    ]),
    ...finalizeStatements(database, userId, runId, importId, contentHash, targetKeys, 'json', now),
  ];
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
    database
      .prepare(
        `UPDATE attachments
            SET parent_missing_at=CASE
              WHEN EXISTS (
                SELECT 1 FROM mf_transactions m
                 WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
              ) THEN NULL ELSE COALESCE(parent_missing_at,?) END
          WHERE user_id=? AND target_kind='mf'
            AND ((parent_missing_at IS NULL AND NOT EXISTS (
                    SELECT 1 FROM mf_transactions m
                     WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
                 ))
              OR (parent_missing_at IS NOT NULL AND EXISTS (
                    SELECT 1 FROM mf_transactions m
                     WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
                 )))`,
      )
      .bind(now, userId),
  ];
}
