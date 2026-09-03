/**
 * 取込データの削除と取り消し(DR-1〜DR-6, DR-8, DR-9)。
 *
 * 対象を決めるのは core の deletionScope。ここが持つのは永続化の順序だけ。
 *
 * 退避・正本の削除/復元・monthly_aggの入れ替えを同じ D1 batch に入れる(DR-2 / DR-5)。
 *      別トランザクションにすると、退避の途中で落ちたときに
 *      「消えたが戻せない」も「明細と月次数値がずれる」も作らない。
 *
 * 明細の内容・金額は退避テーブルにだけ入る。ログにもエラー応答にも出さない(DR-9)。
 */
import {
  type DeletionPreflight,
  type DeletionRequest,
  type DeletionScopeInput,
  type DeletionTargets,
  type ImportKind,
  type ManualRecords,
  collateralCounts,
  deletionFingerprint,
  deletionPreflight,
  deletionScope,
} from '@kanjo/core';
import { type AuditScope, buildAuditStatements } from './audit-log.js';
import { reconcileMfAttachmentParentsStatement } from './canonical-parent-convergence.js';
import {
  type FullResetTable,
  type FullResetTombstoneRow,
  fullResetDeleteStatements,
  fullResetRestoreStatements,
  isFullReset,
  readFullResetTombstones,
} from './deletion-full-reset.js';
import { D1_FREE_QUERY_LIMIT, chunkJsonRowsByBytes, insertJsonRows } from './import-lifecycle.js';
import {
  type RecomputeCanonicalMutation,
  getDb,
  planRecomputeFromDeals,
  recomputePlanStatements,
} from './store.js';

/** 退避行を保持する日数(D04)。過ぎた操作の取り消しは 410 を返す。 */
export const DELETION_UNDO_RETENTION_DAYS = 30;

/** planRecomputeFromDealsが発行する読取り上界。書込み文数は実計測で追加する。 */
const RECOMPUTE_PLAN_READS = 16;

/** 削除・取り消しが触るテーブル。undo の戻し先はこの3つ以外にない。 */
export const DELETION_TABLES = ['mf_transactions', 'freee_deals', 'balance_entries'] as const;
export type DeletionTable = (typeof DELETION_TABLES)[number];

const DELETION_COLUMNS: Record<DeletionTable, readonly string[]> = {
  mf_transactions: [
    'tx_id',
    'month',
    'date',
    'description',
    'amount',
    'category_major',
    'category_mid',
    'institution',
    'memo',
    'is_target',
    'is_transfer',
    'identity_stable',
    'import_id',
  ],
  freee_deals: [
    'month',
    'date',
    'io',
    'partner',
    'account_raw',
    'account_norm',
    'amount',
    'memo',
    'import_id',
    'due_date',
    'settled_date',
    'settle_account',
    'settled_amount',
    'settlement_known',
  ],
  balance_entries: ['month', 'date', 'side', 'category', 'amount', 'source', 'created_at', 'updated_at'],
};

/** 退避と戻しで使う行の識別子。id ではなく業務上の同一性キーを使う。 */
const IDENTITY_COLUMN: Record<DeletionTable, string> = {
  // 添付や手当ては tx_id で明細を指す。整数の id で戻すと採番が変わって参照が切れる
  mf_transactions: 'tx_id',
  freee_deals: 'id',
  balance_entries: 'id',
};

export interface DeletionQueryPlan {
  total: number;
  limit: number;
  accepted: boolean;
  breakdown: Record<string, number>;
}

const sumPlan = (breakdown: Record<string, number>): DeletionQueryPlan => {
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total, limit: D1_FREE_QUERY_LIMIT, accepted: total < D1_FREE_QUERY_LIMIT, breakdown };
};

/**
 * 1回の削除が使う D1 query のworst-case。
 * commit 直前に実測と突き合わせ、超えるなら実行しない(fail-closed)。
 */
export function planDeletionQueries(args: {
  payloadChunks: number;
  tombstoneChunks: number;
  deleteChunks: number;
  fullResetReads: number;
  fullResetDeletes: number;
  targetChunks: number;
  derivedConvergenceStatements: number;
  auditStatements: number;
  recomputeStatements: number;
}): DeletionQueryPlan {
  return sumPlan({
    // 対象候補(mf/freee/balance) + 取込種別 + 手動記録3種 + active target
    scopeReads: 8,
    // 消す前の行そのものを読む
    payloadReads: args.payloadChunks + args.fullResetReads,
    // claim取得のworst-case(stale回復ぶんを常に予算化する)
    claim: 4,
    // 操作記録 + 退避 + 削除 + active target の巻き戻し + JSON pointer 無効化
    commit:
      1 +
      args.tombstoneChunks +
      args.targetChunks +
      args.deleteChunks +
      args.fullResetDeletes +
      args.derivedConvergenceStatements +
      1 +
      1 +
      args.auditStatements,
    // 集計の作り直し(planRecomputeFromDeals の読み + 入れ替え)
    recompute: args.recomputeStatements,
    release: 1,
  });
}

/**
 * undo の1 batchが Worker の D1 上限に収まるかを、書き込み前に決める。
 * 大きすぎる復元を途中まで進めるより、期間を狭めてもらう方が回復可能。
 */
export function planUndoQueries(args: {
  restoreStatements: number;
  auditStatements: number;
  recomputeStatements: number;
}): DeletionQueryPlan {
  return sumPlan({
    // operation、保持後の監査存在確認、退避行、active target の4読み
    metadataReads: 4,
    // canonical-mutation-fence のstale回復を含む上界
    claim: 4,
    commit: args.restoreStatements + args.auditStatements,
    recompute: args.recomputeStatements,
    release: 1,
  });
}

/** 対象候補の行を読む。範囲の解釈はサーバ側だけが持つ(DR-1)。 */
export async function loadDeletionScope(
  database: D1Database,
  userId: string,
  request: DeletionRequest,
): Promise<DeletionScopeInput> {
  const [mfRows, dealRows, balanceRows, lifecycleRows] = await Promise.all([
    database
      .prepare('SELECT tx_id, month, import_id FROM mf_transactions WHERE user_id=?')
      .bind(userId)
      .all<{ tx_id: string; month: string; import_id: number | null }>(),
    database
      .prepare('SELECT id, month, import_id FROM freee_deals WHERE user_id=?')
      .bind(userId)
      .all<{ id: number; month: string; import_id: number | null }>(),
    database
      .prepare('SELECT id, month, source FROM balance_entries WHERE user_id=?')
      .bind(userId)
      .all<{ id: number; month: string; source: 'mf' | 'manual' }>(),
    database
      .prepare(
        `SELECT 'import' AS source, id AS import_id, kind, NULL AS target_key
           FROM imports WHERE user_id=?
         UNION ALL
         SELECT 'active' AS source, import_id, NULL AS kind, target_key
           FROM import_active_targets WHERE user_id=?`,
      )
      .bind(userId, userId)
      .all<{
        source: 'import' | 'active';
        import_id: number;
        kind: ImportKind | null;
        target_key: string | null;
      }>(),
  ]);

  const importKinds: Record<number, ImportKind> = {};
  const activeTargets: Array<{ targetKey: string; importId: number }> = [];
  for (const row of lifecycleRows.results) {
    if (row.source === 'import' && row.kind) importKinds[row.import_id] = row.kind;
    if (row.source === 'active' && row.target_key)
      activeTargets.push({ targetKey: row.target_key, importId: row.import_id });
  }

  return {
    request,
    mfTx: mfRows.results.map((row) => ({ id: row.tx_id, month: row.month, importId: row.import_id })),
    freeeDeals: dealRows.results.map((row) => ({ id: row.id, month: row.month, importId: row.import_id })),
    balanceEntries: balanceRows.results.map((row) => ({ id: row.id, month: row.month, source: row.source })),
    importKinds,
    activeTargets,
  };
}

/** 巻き添え件数の材料。件数を数えるためだけに読む。消しはしない(DR-6)。 */
export async function loadManualRecords(database: D1Database, userId: string): Promise<ManualRecords> {
  const [edits, splits, attachments] = await Promise.all([
    database.prepare('SELECT tx_id FROM tx_edits WHERE user_id=?').bind(userId).all<{ tx_id: string }>(),
    database.prepare('SELECT tx_id FROM tx_splits WHERE user_id=?').bind(userId).all<{ tx_id: string }>(),
    database
      .prepare("SELECT target_key FROM attachments WHERE user_id=? AND target_kind='mf'")
      .bind(userId)
      .all<{ target_key: string }>(),
  ]);
  return {
    txEdits: edits.results.map((row) => ({ txId: row.tx_id })),
    txSplits: splits.results.map((row) => ({ txId: row.tx_id })),
    // 現金記録は対象集合に入らない。0 を見せるために空で渡す(DR-6)
    cashEntries: [],
    attachments: attachments.results.map((row) => ({ txId: row.target_key, month: null })),
  };
}

/** 何を消すことになるかを、状態を動かさずに返す。 */
interface DeletionPlanContext {
  preflight: DeletionPreflight;
  fullResetTombstones: FullResetTombstoneRow[];
}

async function planDeletionContext(
  database: D1Database,
  userId: string,
  request: DeletionRequest,
): Promise<DeletionPlanContext> {
  const [scope, manual, fullResetTombstones] = await Promise.all([
    loadDeletionScope(database, userId, request),
    loadManualRecords(database, userId),
    isFullReset(request) ? readFullResetTombstones(database, userId) : Promise.resolve([]),
  ]);
  const base = deletionPreflight(scope, manual);
  if (!isFullReset(request) || fullResetTombstones.length === 0)
    return { preflight: base, fullResetTombstones };

  const resetMonths = fullResetTombstones.map((row) => row.month).filter((month): month is string => !!month);
  const targets: DeletionTargets = {
    ...base.targets,
    months: [...new Set([...base.targets.months, ...resetMonths])].sort(),
  };
  return {
    preflight: {
      targets,
      counts: { ...base.counts, months: targets.months.length },
      collateral: collateralCounts(targets, manual),
      fingerprint: deletionFingerprint(targets, manual, {
        fullResetRows: fullResetTombstones.map(({ table, rowId, month }) => ({ table, rowId, month })),
      }),
    },
    fullResetTombstones,
  };
}

export async function planDeletion(
  database: D1Database,
  userId: string,
  request: DeletionRequest,
): Promise<DeletionPreflight> {
  return (await planDeletionContext(database, userId, request)).preflight;
}

interface TombstoneRow {
  table: DeletionTable | FullResetTable;
  rowId: string;
  month: string | null;
  payload: string;
}

const tombstonePayload = (row: TombstoneRow): Record<string, unknown> =>
  JSON.parse(row.payload) as Record<string, unknown>;

/** undo用の非公開コピーを、集計正本が読むdomain形へ戻す。 */
function recomputeMutationForUndo(rows: readonly TombstoneRow[]): RecomputeCanonicalMutation {
  const restoreMfTx = rows
    .filter((row) => row.table === 'mf_transactions')
    .map((row) => {
      const value = tombstonePayload(row);
      const date = String(value.date ?? '');
      return {
        id: String(value.tx_id ?? row.rowId),
        idStable: Number(value.identity_stable ?? 0) === 1,
        m: String(value.month ?? row.month ?? ''),
        d: date.slice(5).replace('-', '/'),
        c: String(value.description ?? ''),
        a: Number(value.amount ?? 0),
        big: String(value.category_major ?? ''),
        mid: String(value.category_mid ?? ''),
        ...(value.institution == null ? {} : { inst: String(value.institution) }),
        ...(value.memo == null ? {} : { memo: String(value.memo) }),
        isTarget: Number(value.is_target ?? 1) === 1,
        isTransfer: Number(value.is_transfer ?? 0) === 1,
      };
    });
  const restoreFreeeDeals = rows
    .filter((row) => row.table === 'freee_deals')
    .map((row) => {
      const value = tombstonePayload(row);
      const hasSettlement = Number(value.settlement_known ?? 0) === 1;
      return {
        month: String(value.month ?? row.month ?? ''),
        date: String(value.date ?? ''),
        io: value.io === 'income' ? ('income' as const) : ('expense' as const),
        partner: String(value.partner ?? ''),
        accountRaw: String(value.account_raw ?? ''),
        accountNorm: String(value.account_norm ?? ''),
        amount: Number(value.amount ?? 0),
        memo: value.memo == null ? undefined : String(value.memo),
        ...(hasSettlement
          ? {
              dueDate: value.due_date == null ? null : String(value.due_date),
              settledDate: value.settled_date == null ? null : String(value.settled_date),
              settleAccount: value.settle_account == null ? null : String(value.settle_account),
              settledAmount: value.settled_amount == null ? null : Number(value.settled_amount),
            }
          : {}),
      };
    });
  const restoreMonthlyAgg = rows
    .filter((row) => row.table === 'restored_monthly_agg')
    .map((row) => {
      const value = tombstonePayload(row);
      return {
        month: String(value.month ?? row.month ?? ''),
        scope: String(value.scope ?? ''),
        amount: Number(value.amount ?? 0),
      };
    });
  return {
    affectedMonths: [...new Set(rows.map((row) => row.month).filter((month): month is string => !!month))],
    restoreMfTx,
    restoreFreeeDeals,
    restoreMonthlyAgg,
  };
}

const identityValues = (targets: DeletionTargets, table: DeletionTable): string[] => {
  if (table === 'mf_transactions') return [...targets.mfTxIds];
  if (table === 'freee_deals') return targets.freeeDealIds.map(String);
  return targets.balanceEntryIds.map(String);
};

/** 消す前の行をそのまま読む。undo はこの JSON を戻すだけで済む。 */
async function readTombstoneRows(
  database: D1Database,
  userId: string,
  targets: DeletionTargets,
): Promise<TombstoneRow[]> {
  const rows: TombstoneRow[] = [];
  for (const table of DELETION_TABLES) {
    const ids = identityValues(targets, table);
    if (ids.length === 0) continue;
    const columns = DELETION_COLUMNS[table];
    const identity = IDENTITY_COLUMN[table];
    for (const payload of chunkJsonRowsByBytes(ids.map((id) => [id]))) {
      // 同一性キーは別名で必ず採る。freee/残高の識別子は `id` だが、退避する中身には
      // `id` を入れない(戻すときは採番し直す)。`SELECT` の結果から拾おうとすると
      // 全行が undefined になり、退避行が1明細1行にならず一意制約で落ちる。
      const result = await database
        .prepare(
          `SELECT ${identity} AS row_identity, ${columns.join(',')} FROM ${table}
           WHERE user_id=? AND CAST(${identity} AS TEXT) IN (
             SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
           )`,
        )
        .bind(userId, payload)
        .all<Record<string, unknown>>();
      for (const row of result.results) {
        const { row_identity: rowIdentity, ...body } = row;
        rows.push({
          table,
          rowId: String(rowIdentity),
          month: (body.month as string | null) ?? null,
          payload: JSON.stringify(body),
        });
      }
    }
  }
  return rows;
}

/**
 * 削除で消える取込指紋を読む(DR-4)。
 * import_active_targets は現在値しか持たないので、消す前にここで写しておく。
 */
async function readAffectedTargets(
  database: D1Database,
  userId: string,
  targets: DeletionTargets,
): Promise<Array<{ targetKey: string; contentHash: string; importId: number; updatedAt: string }>> {
  if (targets.affectedTargetKeys.length === 0) return [];
  const result = await database
    .prepare(
      `SELECT target_key, content_hash, import_id, updated_at FROM import_active_targets
       WHERE user_id=? AND target_key IN (
         SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
       )`,
    )
    .bind(userId, JSON.stringify(targets.affectedTargetKeys.map((key) => [key])))
    .all<{ target_key: string; content_hash: string; import_id: number; updated_at: string }>();
  return result.results.map((row) => ({
    targetKey: row.target_key,
    contentHash: row.content_hash,
    importId: row.import_id,
    updatedAt: row.updated_at,
  }));
}

export interface DeletionCommitPlan {
  statements: D1PreparedStatement[];
  tombstoneChunks: number;
  targetChunks: number;
  deleteChunks: number;
  fullResetDeletes: number;
  derivedConvergenceStatements: number;
}

/**
 * 退避・削除・指紋の巻き戻しを、後から足すmonthly_agg置換と同じ batch 用にまとめる(DR-2 / DR-4)。
 * 退避の文を先に並べる。同じ batch なので原子的だが、読む人に順序を残す。
 */
export function deletionCommitStatements(args: {
  database: D1Database;
  userId: string;
  operationId: string;
  kind: 'delete';
  request: DeletionRequest;
  confirmedPeriod?: ConfirmedDeletionPeriod;
  targets: DeletionTargets;
  fingerprint: string;
  counts: DeletionPreflight['counts'];
  tombstones: TombstoneRow[];
  affectedTargets: Awaited<ReturnType<typeof readAffectedTargets>>;
  expiresAt: string;
  nowIso: string;
}): DeletionCommitPlan {
  const { database, userId, operationId, targets } = args;

  const operation = database
    .prepare(
      `INSERT INTO import_deletion_operations
         (id,user_id,kind,granularity,request_json,fingerprint,counts_json,expires_at,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      operationId,
      userId,
      args.kind,
      args.request.granularity,
      JSON.stringify(
        args.confirmedPeriod ? { ...args.request, confirmedPeriod: args.confirmedPeriod } : args.request,
      ),
      args.fingerprint,
      JSON.stringify(args.counts),
      args.expiresAt,
      args.nowIso,
    );

  const tombstoneStatements = insertJsonRows(
    database,
    'import_deleted_rows',
    ['table_name', 'row_id', 'month', 'payload_json'],
    args.tombstones.map((row) => [row.table, row.rowId, row.month, row.payload]),
    [
      { column: 'operation_id', value: operationId },
      { column: 'user_id', value: userId },
    ],
  );

  const targetStatements = args.affectedTargets.length
    ? insertJsonRows(
        database,
        'import_deleted_targets',
        ['target_key', 'content_hash', 'import_id', 'updated_at'],
        args.affectedTargets.map((row) => [row.targetKey, row.contentHash, row.importId, row.updatedAt]),
        [
          { column: 'operation_id', value: operationId },
          { column: 'user_id', value: userId },
        ],
      )
    : [];

  const deleteStatements: D1PreparedStatement[] = [];
  for (const table of DELETION_TABLES) {
    const ids = identityValues(targets, table);
    if (ids.length === 0) continue;
    const identity = IDENTITY_COLUMN[table];
    for (const payload of chunkJsonRowsByBytes(ids.map((id) => [id])))
      deleteStatements.push(
        database
          .prepare(
            `DELETE FROM ${table} WHERE user_id=? AND CAST(${identity} AS TEXT) IN (
               SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
             )`,
          )
          .bind(userId, payload),
      );
  }
  const resetStatements = isFullReset(args.request) ? fullResetDeleteStatements(database, userId) : [];

  // 消した取込の指紋を落とす。残すと、同じCSVを入れ直したときに
  // 「取込済み」と判定されて何も入らない(DR-4)。
  const clearTargets = args.affectedTargets.length
    ? [
        database
          .prepare(
            `DELETE FROM import_active_targets WHERE user_id=? AND target_key IN (
               SELECT CAST(json_extract(item.value,'$[0]') AS TEXT) FROM json_each(?) AS item
             )`,
          )
          .bind(userId, JSON.stringify(args.affectedTargets.map((row) => [row.targetKey]))),
      ]
    : [];

  // JSON 復元の write-set が変わるので、復元用 pointer を落とす
  const invalidateJson = database
    .prepare("DELETE FROM import_active_targets WHERE user_id=? AND target_key='json:global'")
    .bind(userId);
  const derivedConvergence = targets.mfTxIds.length
    ? [reconcileMfAttachmentParentsStatement(database, userId, args.nowIso)]
    : [];

  return {
    statements: [
      operation,
      ...tombstoneStatements,
      ...targetStatements,
      ...deleteStatements,
      ...resetStatements,
      ...derivedConvergence,
      ...clearTargets,
      invalidateJson,
    ],
    tombstoneChunks: tombstoneStatements.length,
    targetChunks: targetStatements.length + clearTargets.length,
    deleteChunks: deleteStatements.length,
    fullResetDeletes: resetStatements.length,
    derivedConvergenceStatements: derivedConvergence.length,
  };
}

export class DeletionScopeChangedError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super('deletion_scope_changed');
    this.name = 'DeletionScopeChangedError';
  }
}

export class DeletionBudgetError extends Error {
  constructor(public readonly plan: DeletionQueryPlan) {
    super('deletion_query_budget_exceeded');
    this.name = 'DeletionBudgetError';
  }
}

export class AllScopeConfirmationError extends Error {
  constructor(public readonly reason: 'required' | 'mismatch') {
    super(`all_scope_confirmation_${reason}`);
    this.name = 'AllScopeConfirmationError';
  }
}

export interface ConfirmedDeletionPeriod {
  from: string;
  to: string;
}

export interface DeletionExecution {
  operationId: string;
  targets: DeletionTargets;
  counts: DeletionPreflight['counts'];
  fingerprint: string;
  expiresAt: string;
  plan: DeletionQueryPlan;
}

const auditScopeForDeletion = (request: DeletionRequest): AuditScope => {
  switch (request.granularity) {
    case 'transaction':
      return { kind: 'transaction' };
    case 'import':
      return { kind: 'import', importId: request.importId };
    case 'period':
      if (!request.period) throw new Error('period deletion without a period');
      return { kind: 'period', ...request.period };
    case 'all':
      return { kind: 'all' };
  }
};

/**
 * undo metadataのrequest_jsonは範囲再現には使わず、監査ヘッダの安全な粒度だけを復元する。
 * 旧行が不正でもtx ID/request本体を監査層へコピーしない。
 */
const auditScopeForUndo = (granularity: string, requestJson: string): AuditScope => {
  if (granularity === 'transaction') return { kind: 'transaction' };
  if (granularity === 'import') {
    try {
      const request = JSON.parse(requestJson) as { importId?: unknown };
      return typeof request.importId === 'number' && Number.isSafeInteger(request.importId)
        ? { kind: 'import', importId: request.importId }
        : { kind: 'import' };
    } catch {
      return { kind: 'import' };
    }
  }
  if (granularity === 'period') {
    try {
      const request = JSON.parse(requestJson) as { period?: { from?: unknown; to?: unknown } };
      if (typeof request.period?.from === 'string' && typeof request.period.to === 'string')
        return { kind: 'period', from: request.period.from, to: request.period.to };
    } catch {
      // malformed legacy metadataは以下の安全な概要範囲に倒す
    }
  }
  return { kind: 'all' };
};

/**
 * 削除を実行する。呼び出し側が writer claim を持っていることを前提にする。
 * 正本の削除後 snapshot を先に計画し、集計置換まで同じ D1 batch で確定する。
 */
export async function executeDeletion(args: {
  database: D1Database;
  userId: string;
  operationId: string;
  request: DeletionRequest;
  /** 全件実行で利用者が画面へ入力した範囲。preflightでは要求しない。 */
  confirmedPeriod?: ConfirmedDeletionPeriod;
  /** preflight で利用者へ見せた指紋。省略時は確認なしで実行する(内部経路用) */
  expectedFingerprint?: string;
  now?: Date;
  recomputeStatements?: number;
}): Promise<DeletionExecution> {
  const { database, userId, operationId, request } = args;
  const now = args.now ?? new Date();

  // 範囲をサーバ側で読み直す。画面が送ってきた件数やIDは信用しない(DR-1)
  const { preflight, fullResetTombstones: resetTombstones } = await planDeletionContext(
    database,
    userId,
    request,
  );
  const targets = preflight.targets;
  const fingerprint = preflight.fingerprint;

  if (args.expectedFingerprint !== undefined && args.expectedFingerprint !== fingerprint)
    throw new DeletionScopeChangedError(args.expectedFingerprint, fingerprint);

  if (request.granularity === 'all' && !args.confirmedPeriod) throw new AllScopeConfirmationError('required');

  const [detailTombstones, affectedTargets] = await Promise.all([
    readTombstoneRows(database, userId, targets),
    readAffectedTargets(database, userId, targets),
  ]);
  const tombstones: TombstoneRow[] = [...detailTombstones, ...resetTombstones];

  if (request.granularity === 'all' && args.confirmedPeriod) {
    const actualMonths = new Set([
      ...targets.months,
      ...resetTombstones
        .map((row: FullResetTombstoneRow) => row.month)
        .filter((month): month is string => !!month),
    ]);
    const orderedMonths = [...actualMonths].sort();
    if (
      orderedMonths.length > 0 &&
      (args.confirmedPeriod.from !== orderedMonths[0] ||
        args.confirmedPeriod.to !== orderedMonths[orderedMonths.length - 1])
    )
      throw new AllScopeConfirmationError('mismatch');
  }

  const expiresAt = new Date(
    now.getTime() + DELETION_UNDO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const commit = deletionCommitStatements({
    database,
    userId,
    operationId,
    kind: 'delete',
    request,
    confirmedPeriod: args.confirmedPeriod,
    targets,
    fingerprint,
    counts: preflight.counts,
    tombstones,
    affectedTargets,
    expiresAt,
    nowIso: now.toISOString(),
  });

  // 削除後のcanonical snapshotを副作用なしで作り、派生集計の入れ替えも同じbatchへ載せる。
  const affectedMonths = [
    ...new Set([
      ...targets.months,
      ...resetTombstones.map((row) => row.month).filter((month): month is string => !!month),
    ]),
  ];
  const recomputePlan = await planRecomputeFromDeals(getDb(database), userId, [], undefined, {
    affectedMonths,
    removeMfTxIds: targets.mfTxIds,
    removeFreeeDealIds: targets.freeeDealIds,
    clearRestoredMonthlyAgg: isFullReset(request),
  });
  const recomputeStatements = recomputePlanStatements(database, userId, recomputePlan);
  const audit = buildAuditStatements({
    database,
    auditId: operationId,
    userId,
    operationId,
    action: 'delete',
    scope: auditScopeForDeletion(request),
    counts: preflight.counts,
    occurredAt: now.toISOString(),
    result: 'succeeded',
  });

  const plan = planDeletionQueries({
    payloadChunks: commit.tombstoneChunks,
    tombstoneChunks: commit.tombstoneChunks,
    deleteChunks: commit.deleteChunks,
    fullResetReads: isFullReset(request) ? 2 : 0,
    fullResetDeletes: commit.fullResetDeletes,
    targetChunks: commit.targetChunks,
    derivedConvergenceStatements: commit.derivedConvergenceStatements,
    auditStatements: audit.queryCount,
    recomputeStatements: Math.max(
      args.recomputeStatements ?? 0,
      RECOMPUTE_PLAN_READS + recomputeStatements.length,
    ),
  });
  // 予算を超えるなら1文も書かない。途中まで消してから落ちる方が悪い
  if (!plan.accepted) throw new DeletionBudgetError(plan);

  await database.batch([...commit.statements, ...recomputeStatements, ...audit.statements]);
  return { operationId, targets, counts: preflight.counts, fingerprint, expiresAt, plan };
}

export class UndoExpiredError extends Error {
  constructor() {
    super('undo_expired');
    this.name = 'UndoExpiredError';
  }
}
export class UndoNotFoundError extends Error {
  constructor() {
    super('undo_not_found');
    this.name = 'UndoNotFoundError';
  }
}
export class UndoAlreadyDoneError extends Error {
  constructor() {
    super('undo_already_done');
    this.name = 'UndoAlreadyDoneError';
  }
}

export interface UndoExecution {
  operationId: string;
  undoOperationId: string;
  restored: Record<DeletionTable | FullResetTable, number>;
  months: string[];
}

/**
 * 削除を取り消す。退避行を戻し、取込指紋も対で戻す(DR-4 / DR-8)。
 *
 * 退避行は消さない。もう一度消して、もう一度戻せるようにするため。
 * 消してしまうと「取り消しの取り消し」が作れず、操作の履歴も切れる。
 */
export async function executeUndo(args: {
  database: D1Database;
  userId: string;
  operationId: string;
  undoOperationId: string;
  now?: Date;
  recomputeStatements?: number;
}): Promise<UndoExecution> {
  const { database, userId, operationId, undoOperationId } = args;
  const now = args.now ?? new Date();

  const operation = await database
    .prepare(
      `SELECT granularity, request_json, fingerprint, expires_at, undone_by
       FROM import_deletion_operations WHERE id=? AND user_id=? AND kind='delete'`,
    )
    .bind(operationId, userId)
    .first<{
      granularity: string;
      request_json: string;
      fingerprint: string;
      expires_at: string;
      undone_by: string | null;
    }>();
  if (!operation) {
    const retainedAudit = await database
      .prepare("SELECT 1 AS found FROM audit_log WHERE operation_id=? AND user_id=? AND action='delete'")
      .bind(operationId, userId)
      .first<number>('found');
    if (retainedAudit) throw new UndoExpiredError();
    throw new UndoNotFoundError();
  }
  if (operation.undone_by) throw new UndoAlreadyDoneError();
  // 保持期間を過ぎた操作は、退避行が残っていても戻さない。
  // 掃除の途中で「一部だけ戻る」状態を作らないため、期限だけで判断する(D04)
  if (operation.expires_at <= now.toISOString()) throw new UndoExpiredError();

  const tombstones = await database
    .prepare(
      'SELECT table_name, month, payload_json FROM import_deleted_rows WHERE operation_id=? AND user_id=?',
    )
    .bind(operationId, userId)
    .all<{ table_name: DeletionTable | FullResetTable; month: string | null; payload_json: string }>();
  const savedTargets = await database
    .prepare(
      'SELECT target_key, content_hash, import_id, updated_at FROM import_deleted_targets WHERE operation_id=? AND user_id=?',
    )
    .bind(operationId, userId)
    .all<{ target_key: string; content_hash: string; import_id: number; updated_at: string }>();

  // 退避が1件も無い操作は、期限内でも戻せない。保管量の上限で前倒しに捨てられた世代がこれにあたる(D7)。
  // ここで止めないと「0件を戻して成功」になり、戻っていないのに戻ったと表示してしまう
  if (!tombstones.results.length && !savedTargets.results.length) throw new UndoExpiredError();

  const statements: D1PreparedStatement[] = [];
  const restored: Record<DeletionTable | FullResetTable, number> = {
    mf_transactions: 0,
    freee_deals: 0,
    balance_entries: 0,
    restored_monthly_agg: 0,
    overrides: 0,
  };
  const months = new Set<string>();

  for (const table of DELETION_TABLES) {
    const rows = tombstones.results.filter((row) => row.table_name === table);
    if (rows.length === 0) continue;
    restored[table] = rows.length;
    const columns = DELETION_COLUMNS[table];
    const values = rows.map((row) => {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      if (row.month) months.add(row.month);
      return columns.map((column) => payload[column] ?? null);
    });
    statements.push(
      ...insertJsonRows(database, table, columns, values, [{ column: 'user_id', value: userId }]),
    );
  }

  const fullResetRestore = fullResetRestoreStatements(database, userId, tombstones.results);
  statements.push(...fullResetRestore.statements);
  restored.restored_monthly_agg = fullResetRestore.restored.restored_monthly_agg;
  restored.overrides = fullResetRestore.restored.overrides;
  for (const month of fullResetRestore.months) months.add(month);

  const recomputePlan = await planRecomputeFromDeals(
    getDb(database),
    userId,
    [],
    undefined,
    recomputeMutationForUndo(
      tombstones.results.map((row) => ({
        table: row.table_name,
        rowId: '',
        month: row.month,
        payload: row.payload_json,
      })),
    ),
  );
  const recomputeStatements = recomputePlanStatements(database, userId, recomputePlan);

  // 指紋を削除前の値へ戻す。行を戻して指紋を戻さないと、
  // 同じCSVがもう一度入って二重になる(DR-4 は対で巻き戻す)
  if (savedTargets.results.length)
    statements.push(
      ...savedTargets.results.map((row) =>
        database
          .prepare(
            `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
             VALUES (?,?,?,?,?)
             ON CONFLICT(user_id,target_key) DO UPDATE SET
               content_hash=excluded.content_hash,
               import_id=excluded.import_id,
               updated_at=excluded.updated_at`,
          )
          .bind(userId, row.target_key, row.content_hash, row.import_id, row.updated_at),
      ),
    );

  if (restored.mf_transactions > 0)
    statements.push(reconcileMfAttachmentParentsStatement(database, userId, now.toISOString()));

  statements.push(
    // 二重取り消しを DB 側で止める。undone_by が既に入っていれば0行更新になる
    database
      .prepare(
        'UPDATE import_deletion_operations SET undone_by=? WHERE id=? AND user_id=? AND undone_by IS NULL',
      )
      .bind(undoOperationId, operationId, userId),
    database
      .prepare("DELETE FROM import_active_targets WHERE user_id=? AND target_key='json:global'")
      .bind(userId),
  );

  const audit = buildAuditStatements({
    database,
    auditId: undoOperationId,
    userId,
    operationId: undoOperationId,
    action: 'undo',
    scope: auditScopeForUndo(operation.granularity, operation.request_json),
    counts: {
      mfTx: restored.mf_transactions,
      freeeDeals: restored.freee_deals,
      balanceEntries: restored.balance_entries,
      restoredMonthlyAgg: restored.restored_monthly_agg,
      overrides: restored.overrides,
      months: months.size,
    },
    occurredAt: now.toISOString(),
    result: 'succeeded',
  });

  const plan = planUndoQueries({
    restoreStatements: statements.length + recomputeStatements.length,
    auditStatements: audit.queryCount,
    recomputeStatements: Math.max(args.recomputeStatements ?? 0, RECOMPUTE_PLAN_READS),
  });
  // 読み取りは済んでいても、この時点まで利用者データは1行も動いていない。
  if (!plan.accepted) throw new DeletionBudgetError(plan);

  await database.batch([...statements, ...recomputeStatements, ...audit.statements]);
  return { operationId, undoOperationId, restored, months: [...months].sort() };
}

/**
 * 保持期間を過ぎた退避行を捨てる(T15 の夜間掃除から呼ぶ)。
 *
 * 対象は呼び出し側が件数を絞って渡す。「期限切れ全部」を1文で消すと、
 * 溜まった夜に1回の Cron が無制限のクエリを撃つことになるため(DR-8 の掃除は有界)。
 * import_deletion_operationsはundo用metadataであり、退避行と同じ30日で捨てる。
 * 400日履歴の正本はaudit_logであり、この掃除は触らない。
 */
export function expiredTombstoneCleanupStatements(
  database: D1Database,
  operationIds: string[],
  includeMetadata = true,
): D1PreparedStatement[] {
  if (!operationIds.length) return [];
  const holes = operationIds.map(() => '?').join(',');
  const statements = [
    database
      .prepare(`DELETE FROM import_deleted_rows WHERE operation_id IN (${holes})`)
      .bind(...operationIds),
    database
      .prepare(`DELETE FROM import_deleted_targets WHERE operation_id IN (${holes})`)
      .bind(...operationIds),
  ];
  if (includeMetadata)
    statements.push(
      database.prepare(`DELETE FROM import_deletion_operations WHERE id IN (${holes})`).bind(...operationIds),
    );
  return statements;
}

export { deletionScope, deletionFingerprint };
