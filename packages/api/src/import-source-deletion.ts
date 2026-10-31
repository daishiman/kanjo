/** CSV削除は取り消しと別契約。正本・個別判断・過去の控え・原本削除intentを一括確定する。 */
import {
  type FreeeDeal,
  type ImportKind,
  canonicalEncode,
  deletionPreflight,
  freeeDealKeys,
  mfStableKey,
} from '@kanjo/core';
import { buildAuditStatements } from './audit-log.js';
import type { AuthEnv } from './auth.js';
import { D1_INVOCATION_QUERY_LIMIT } from './d1-limits.js';
import { getDb, planRecomputeFromDeals, recomputePlanStatements } from './store.js';

interface Row {
  id: number;
  tx_id: string;
  month: string;
  import_id: number | null;
  date: string;
  description: string;
  amount: number;
  institution: string | null;
  source: 'mf' | 'manual';
  io: 'income' | 'expense';
  partner: string | null;
  account_raw: string | null;
  account_norm: string | null;
  settlement_known: number;
  settle_account: string | null;
  kind: ImportKind;
  status: string;
  run_id: string | null;
  filename: string | null;
  r2_key: string | null;
  target_key: string;
  content_hash: string;
  operation_id: string;
  table_name: string;
  payload_json: string;
  stable_key: string | null;
  freee_key: string;
  reason: string;
  reason_code: string | null;
  memo: string | null;
  created_at: string | null;
  updated_at: string | null;
}
interface RunRow {
  id: string;
  parent_run_id: string | null;
  status: string;
}
interface ActionRow {
  id: string;
  before_json: string;
  after_json: string;
}
interface CashflowOperationRow {
  id: string;
  items_json: string;
}
type State = Record<string, Row[]> & {
  import_runs: RunRow[];
  reconciliation_actions: ActionRow[];
  total_cashflow_operations: CashflowOperationRow[];
};
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
interface JudgmentItem {
  txId?: string;
  freeeKey?: string;
  row?: Record<string, JsonValue> | null;
  [key: string]: unknown;
}

export class ImportSourceDeletionError extends Error {
  constructor(
    readonly code: string,
    readonly status: 404 | 409 | 413 = 409,
  ) {
    super(code);
  }
}
const deals = (rows: Row[]): FreeeDeal[] =>
  rows.map((r) => ({
    month: r.month,
    date: r.date,
    io: r.io,
    partner: r.partner ?? '',
    accountRaw: r.account_raw ?? '',
    accountNorm: r.account_norm ?? '',
    amount: r.amount,
    ...(r.settlement_known === 1 ? { settleAccount: r.settle_account } : {}),
  }));

export async function planImportSourceDeletion(database: D1Database, userId: string, ids: string[]) {
  // 一つの読取りsnapshotで帰属・共有原本・過去世代を判定する。実明細は応答へ出さない。
  const tables = [
    'import_runs',
    'imports',
    'mf_transactions',
    'freee_deals',
    'balance_entries',
    'import_active_targets',
    'import_deleted_rows',
    'import_deleted_targets',
    'tx_edits',
    'tx_splits',
    'reconciliation_actions',
    'tx_history',
    'duplicate_verdicts',
    'mf_tx_exclusions',
    'freee_deal_exclusions',
    'total_cashflow_operations',
  ] as const;
  // 各行を返し、巨大なCSV/undoを1つのJSONセルへ集約しない（D1文字列2MB上限）。
  // compound SELECTの上限にも依存しないよう、2項ずつmaterialized CTEで結ぶ。
  const ctes = ['tenant AS (SELECT ? AS id)'];
  let sources = tables.map((table, index) => {
    const name = `source_${index}`;
    ctes.push(
      `${name} AS MATERIALIZED (SELECT '${table}' AS source,json_object(${FIELDS[table]}) AS payload,${table === 'freee_deals' ? 'id' : '0'} AS sort_id FROM ${table} WHERE user_id=(SELECT id FROM tenant))`,
    );
    return name;
  });
  let level = 0;
  while (sources.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < sources.length; index += 2) {
      if (!sources[index + 1]) {
        next.push(sources[index]!);
        continue;
      }
      const name = `snapshot_${level}_${index}`;
      ctes.push(
        `${name} AS MATERIALIZED (SELECT * FROM ${sources[index]} UNION ALL SELECT * FROM ${sources[index + 1]})`,
      );
      next.push(name);
    }
    sources = next;
    level++;
  }
  const snapshot = await database
    .prepare(`WITH ${ctes.join(',')} SELECT source,payload FROM ${sources[0]} ORDER BY source,sort_id`)
    .bind(userId)
    .all<{ source: string; payload: string }>();
  const state = {} as State;
  for (const table of tables) state[table] = [];
  for (const row of snapshot.results) state[row.source]!.push(JSON.parse(row.payload));
  const selected = new Set(ids);
  const roots = state.import_runs!.filter((r) => selected.has(r.id) && !r.parent_run_id);
  if (roots.length !== ids.length) throw new ImportSourceDeletionError('not_found', 404);
  const runs = state.import_runs!.filter((r) => selected.has(r.id) || selected.has(r.parent_run_id ?? ''));
  const runIds = new Set(runs.map((r) => r.id));
  const units = state.imports!.filter((r) => runIds.has(r.run_id ?? ''));
  if (
    runs.some((r) => r.status === 'processing') ||
    units.some((r) => ['processing', 'applying'].includes(r.status))
  )
    throw new ImportSourceDeletionError('in_progress');
  if (
    units.some(
      (r) =>
        r.kind === 'json' || r.status === 'ok' || !['committed', 'failed', 'duplicate'].includes(r.status),
    )
  )
    throw new ImportSourceDeletionError('unattributed');
  const importIds = units.map((r) => r.id as number);
  const selectedImports = new Set<number | null>(importIds);
  const scope = deletionPreflight(
    {
      request: { granularity: 'import', importIds },
      mfTx: state.mf_transactions!.map((r) => ({ id: r.tx_id, month: r.month, importId: r.import_id })),
      freeeDeals: state.freee_deals!.map((r) => ({ id: r.id, month: r.month, importId: r.import_id })),
      balanceEntries: state.balance_entries!.map((r) => ({ id: r.id, month: r.month, source: r.source })),
      importKinds: Object.fromEntries(state.imports!.map((r) => [r.id, r.kind as ImportKind])),
      activeTargets: state.import_active_targets!.map((r) => ({
        targetKey: r.target_key,
        importId: r.import_id!,
      })),
    },
    {
      txEdits: state.tx_edits!.map((r) => ({ txId: r.tx_id })),
      txSplits: state.tx_splits!.map((r) => ({ txId: r.tx_id })),
      cashEntries: [],
    },
  );
  const assetSnapshots = new Set(
    state
      .import_deleted_targets!.filter(
        (r) => selectedImports.has(r.import_id) && r.target_key.startsWith('assets:'),
      )
      .map((r) => `${r.operation_id}:${r.target_key.slice(7)}`),
  );
  const snapshots = state.import_deleted_rows!.filter(
    (r) =>
      selectedImports.has(JSON.parse(r.payload_json).import_id) ||
      (r.table_name === 'balance_entries' && assetSnapshots.has(`${r.operation_id}:${r.month}`)),
  );
  // 過去世代の同じstable IDが別CSVで現在利用されているなら、その個別判断は保持。
  const protectedIds = new Set(
    state.mf_transactions!.filter((r) => !selectedImports.has(r.import_id)).map((r) => r.tx_id),
  );
  const survivingStableKeys = new Set(
    state
      .mf_transactions!.filter((r) => !selectedImports.has(r.import_id))
      .map((r) =>
        mfStableKey({
          m: r.month,
          d: r.date,
          c: r.description,
          a: r.amount,
          inst: r.institution ?? undefined,
        }),
      ),
  );
  for (const table of ['tx_edits', 'duplicate_verdicts', 'mf_tx_exclusions'])
    for (const row of state[table]!)
      if (row.stable_key && survivingStableKeys.has(row.stable_key)) protectedIds.add(row.tx_id);
  const txIds = [
    ...new Set([
      ...scope.targets.mfTxIds,
      ...snapshots
        .filter((r) => r.table_name === 'mf_transactions')
        .map((r) => JSON.parse(r.payload_json).tx_id),
    ]),
  ].filter((id) => !protectedIds.has(id));
  const remainingDeals = state.freee_deals!.filter((r) => !selectedImports.has(r.import_id));
  const remainingKeys = freeeDealKeys(deals(remainingDeals));
  const allKeys = freeeDealKeys(deals(state.freee_deals!));
  const survivingKeys = new Set(
    allKeys.filter((_, i) => !selectedImports.has(state.freee_deals![i]!.import_id)),
  );
  const originalKeyById = new Map(state.freee_deals!.map((row, index) => [row.id, allKeys[index]!]));
  const keyRebindings = Object.fromEntries(
    remainingDeals
      .map((row, index) => [originalKeyById.get(row.id)!, remainingKeys[index]!])
      .filter(([oldKey, newKey]) => oldKey !== newKey),
  );
  const historicalDeals = snapshots
    .filter((r) => r.table_name === 'freee_deals')
    .map((r) => JSON.parse(r.payload_json));
  const removedFreeeKeys = [
    ...new Set([
      ...allKeys.filter((_, i) => selectedImports.has(state.freee_deals![i]!.import_id)),
      ...freeeDealKeys(deals(historicalDeals)),
    ]),
  ].filter((key) => !survivingKeys.has(key));
  const originals = [...new Set(units.map((r) => r.r2_key).filter((key): key is string => !!key))].map(
    (key) => ({ key, shared: state.imports!.some((r) => r.r2_key === key && !selectedImports.has(r.id)) }),
  );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalEncode({ ids: [...ids].sort(), state })),
  );
  const fingerprint = `v1:csv-delete:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  return {
    scope,
    importIds,
    runIds: [...runIds],
    txIds,
    snapshotIds: snapshots.map((r) => r.id),
    removedFreeeKeys,
    keyRebindings,
    originals,
    fingerprint,
    state,
    fileCount: new Set(units.map((r) => `${r.run_id}:${r.r2_key ?? r.filename ?? r.id}`)).size,
  };
}

const FIELDS: Record<string, string> = {
  import_runs: "'id',id,'parent_run_id',parent_run_id,'status',status",
  imports: "'id',id,'run_id',run_id,'status',status,'kind',kind,'r2_key',r2_key,'filename',filename",
  mf_transactions:
    "'tx_id',tx_id,'month',month,'import_id',import_id,'date',date,'description',description,'amount',amount,'institution',institution",
  freee_deals:
    "'id',id,'month',month,'date',date,'io',io,'partner',partner,'account_raw',account_raw,'account_norm',account_norm,'amount',amount,'settlement_known',settlement_known,'settle_account',settle_account,'import_id',import_id",
  balance_entries: "'id',id,'month',month,'source',source",
  import_active_targets: "'target_key',target_key,'import_id',import_id,'content_hash',content_hash",
  import_deleted_rows:
    "'id',id,'operation_id',operation_id,'table_name',table_name,'month',month,'payload_json',payload_json",
  import_deleted_targets: "'operation_id',operation_id,'target_key',target_key,'import_id',import_id",
  tx_history: "'tx_id',tx_id",
  duplicate_verdicts: "'tx_id',tx_id,'freee_key',freee_key,'stable_key',stable_key",
  mf_tx_exclusions: "'tx_id',tx_id,'stable_key',stable_key",
  freee_deal_exclusions:
    "'freee_key',freee_key,'reason',reason,'reason_code',reason_code,'memo',memo,'created_at',created_at,'updated_at',updated_at",
  tx_edits: "'tx_id',tx_id,'stable_key',stable_key",
  tx_splits: "'tx_id',tx_id",
  total_cashflow_operations: "'id',id,'items_json',items_json",
  reconciliation_actions: "'id',id,'before_json',before_json,'after_json',after_json",
};

export function publicSourceDeletionPlan(plan: Awaited<ReturnType<typeof planImportSourceDeletion>>) {
  return {
    fingerprint: plan.fingerprint,
    counts: plan.scope.counts,
    months: plan.scope.targets.months,
    fileCount: plan.fileCount,
    runCount: plan.runIds.length,
    originals: {
      delete: plan.originals.filter((r) => !r.shared).length,
      shared: plan.originals.filter((r) => r.shared).length,
    },
    undoable: false,
    backupRetentionDays: 30,
  };
}

export async function executeImportSourceDeletion(
  env: Pick<AuthEnv, 'DB' | 'FILES'> & Partial<AuthEnv>,
  userId: string,
  ids: string[],
  fingerprint: string,
  writerToken: string,
) {
  const plan = await planImportSourceDeletion(env.DB, userId, ids);
  if (plan.fingerprint !== fingerprint) throw new ImportSourceDeletionError('scope_changed');
  const db = env.DB;
  const now = new Date();
  const nowIso = now.toISOString();
  const importJson = JSON.stringify(plan.importIds);
  const runJson = JSON.stringify(plan.runIds);
  const txJson = JSON.stringify(plan.txIds);
  const freeeJson = JSON.stringify(plan.removedFreeeKeys);
  const guard = db
    .prepare(
      'INSERT INTO import_writer_claims(user_id,run_id,claimed_at,expires_at) VALUES (?,CASE WHEN EXISTS(SELECT 1 FROM import_writer_claims WHERE user_id=? AND run_id=? AND expires_at>?) THEN ? ELSE NULL END,?,?) ON CONFLICT(user_id) DO UPDATE SET run_id=excluded.run_id,claimed_at=excluded.claimed_at,expires_at=excluded.expires_at',
    )
    .bind(userId, userId, writerToken, now.getTime(), writerToken, now.getTime(), now.getTime() + 120_000);
  const statements: D1PreparedStatement[] = [guard];
  const remove = (table: string, column: string, values: unknown[]) => {
    const wanted = new Set(values);
    if (
      values.length &&
      (!plan.state[table] ||
        plan.state[table]!.some((row) => wanted.has((row as unknown as Record<string, unknown>)[column])))
    )
      statements.push(
        db
          .prepare(`DELETE FROM ${table} WHERE user_id=? AND ${column} IN (SELECT value FROM json_each(?))`)
          .bind(userId, JSON.stringify(values)),
      );
  };
  for (const table of ['tx_edits', 'tx_splits', 'tx_history', 'duplicate_verdicts', 'mf_tx_exclusions'])
    remove(table, 'tx_id', plan.txIds);
  remove('freee_deal_exclusions', 'freee_key', plan.removedFreeeKeys);
  // 名指し先だけが消えた判断は解除し、残存MFの明細や補正は保持する。
  if (plan.removedFreeeKeys.length)
    statements.push(
      db
        .prepare(
          'DELETE FROM duplicate_verdicts WHERE user_id=? AND freee_key IN (SELECT value FROM json_each(?))',
        )
        .bind(userId, freeeJson),
    );
  const rebindings = Object.entries(plan.keyRebindings);
  if (rebindings.length) {
    const originals = plan.state.freee_deal_exclusions!.filter((r) =>
      Object.hasOwn(plan.keyRebindings, r.freee_key),
    );
    remove(
      'freee_deal_exclusions',
      'freee_key',
      originals.map((r) => r.freee_key),
    );
    if (originals.length)
      statements.push(
        db
          .prepare(
            `INSERT INTO freee_deal_exclusions (user_id,freee_key,reason,reason_code,memo,created_at,updated_at) SELECT ?,json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]') FROM json_each(?)`,
          )
          .bind(
            userId,
            JSON.stringify(
              originals.map((r) => [
                plan.keyRebindings[r.freee_key],
                r.reason,
                r.reason_code,
                r.memo,
                r.created_at,
                r.updated_at,
              ]),
            ),
          ),
      );
    statements.push(
      db
        .prepare(
          `UPDATE duplicate_verdicts SET freee_key=(SELECT json_extract(value,'$[1]') FROM json_each(?) WHERE json_extract(value,'$[0]')=duplicate_verdicts.freee_key) WHERE user_id=? AND freee_key IN (SELECT json_extract(value,'$[0]') FROM json_each(?))`,
        )
        .bind(JSON.stringify(rebindings), userId, JSON.stringify(rebindings)),
    );
  }
  const txSet = new Set(plan.txIds);
  const keySet = new Set(plan.removedFreeeKeys);
  const containsRemovedKey = (value: unknown): boolean =>
    typeof value === 'string'
      ? keySet.has(value)
      : Array.isArray(value)
        ? value.some(containsRemovedKey)
        : !!value && typeof value === 'object' && Object.values(value).some(containsRemovedKey);
  const rebind = (obj: JsonValue): JsonValue =>
    Array.isArray(obj)
      ? obj.map(rebind)
      : obj && typeof obj === 'object'
        ? Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [
              k,
              k === 'freeeKey' && typeof v === 'string' ? (plan.keyRebindings[v] ?? v) : rebind(v),
            ]),
          )
        : obj;
  const opUpdates: unknown[][] = [];
  for (const op of plan.state.total_cashflow_operations!) {
    const items = JSON.parse(op.items_json) as JudgmentItem[];
    const next = items
      .filter((item) => !txSet.has(item.txId ?? '') && !containsRemovedKey(item))
      .map((item) => rebind(item as JsonValue));
    if (JSON.stringify(next) !== op.items_json) opUpdates.push([op.id, JSON.stringify(next), next.length]);
  }
  if (opUpdates.length)
    statements.push(
      db
        .prepare(
          `UPDATE total_cashflow_operations SET (items_json,item_count)=(SELECT json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?) WHERE json_extract(value,'$[0]')=total_cashflow_operations.id) WHERE user_id=? AND id IN (SELECT json_extract(value,'$[0]') FROM json_each(?))`,
        )
        .bind(JSON.stringify(opUpdates), userId, JSON.stringify(opUpdates)),
    );
  const actionUpdates: unknown[][] = [];
  for (const action of plan.state.reconciliation_actions!) {
    const before = JSON.parse(action.before_json);
    const after = JSON.parse(action.after_json);
    const blockedTxIds = new Set<string>(plan.txIds);
    const blockedFreeeKeys = new Set<string>(plan.removedFreeeKeys);
    for (const source of [before, after])
      for (const values of Object.values(source))
        if (Array.isArray(values))
          for (const value of values)
            if (typeof value === 'object' && value && containsRemovedKey(value)) {
              if (value.txId) blockedTxIds.add(value.txId);
              if (value.freeeKey) blockedFreeeKeys.add(value.freeeKey);
            }
    const clean = (obj: Record<string, (JudgmentItem | string)[]>) =>
      Object.fromEntries(
        Object.entries(obj).map(([key, values]) => [
          key,
          Array.isArray(values)
            ? values.filter((v) =>
                typeof v === 'string'
                  ? !blockedTxIds.has(v)
                  : !blockedTxIds.has(v.txId ?? '') &&
                    !blockedFreeeKeys.has(v.freeeKey ?? '') &&
                    !containsRemovedKey(v),
              )
            : values,
        ]),
      );
    const b = rebind(clean(before) as JsonValue) as Record<string, (JudgmentItem | string)[]>;
    const a = rebind(clean(after) as JsonValue) as Record<string, (JudgmentItem | string)[]>;
    const targetIds = new Set<string>();
    for (const [kind, values] of Object.entries(a))
      if (Array.isArray(values))
        for (const value of values)
          targetIds.add(
            kind === 'freeeExclusions'
              ? `freee:${typeof value === 'string' ? value : value.freeeKey}`
              : `mf:${typeof value === 'string' ? value : value.txId}`,
          );
    const count = targetIds.size;
    if (JSON.stringify(b) !== action.before_json || JSON.stringify(a) !== action.after_json)
      actionUpdates.push([action.id, JSON.stringify(b), JSON.stringify(a), count]);
  }
  if (actionUpdates.length) {
    const payload = JSON.stringify(actionUpdates);
    statements.push(
      db
        .prepare(
          `DELETE FROM reconciliation_actions WHERE user_id=? AND id IN (SELECT json_extract(value,'$[0]') FROM json_each(?) WHERE json_extract(value,'$[3]')=0)`,
        )
        .bind(userId, payload),
    );
    statements.push(
      db
        .prepare(
          `UPDATE reconciliation_actions SET (before_json,after_json,target_count)=(SELECT json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?) WHERE json_extract(value,'$[0]')=reconciliation_actions.id) WHERE user_id=? AND id IN (SELECT json_extract(value,'$[0]') FROM json_each(?) WHERE json_extract(value,'$[3]')>0)`,
        )
        .bind(payload, userId, payload),
    );
  }
  // 過去の取り消し控えからこのCSVだけを除く。混在操作の他CSVは取り消せるまま残す。
  remove('import_deleted_rows', 'id', plan.snapshotIds);
  if (plan.state.import_deleted_targets!.length)
    statements.push(
      db
        .prepare(
          'DELETE FROM import_deleted_targets WHERE user_id=? AND import_id IN (SELECT value FROM json_each(?))',
        )
        .bind(userId, importJson),
    );
  if (plan.state.import_deleted_rows!.length || plan.state.import_deleted_targets!.length)
    statements.push(
      db
        .prepare(
          `UPDATE import_deletion_operations SET counts_json=json_set(counts_json,'$.mfTx',(SELECT count(*) FROM import_deleted_rows r WHERE r.user_id=? AND r.operation_id=import_deletion_operations.id AND r.table_name='mf_transactions'),'$.freeeDeals',(SELECT count(*) FROM import_deleted_rows r WHERE r.user_id=? AND r.operation_id=import_deletion_operations.id AND r.table_name='freee_deals'),'$.balanceEntries',(SELECT count(*) FROM import_deleted_rows r WHERE r.user_id=? AND r.operation_id=import_deletion_operations.id AND r.table_name='balance_entries'),'$.months',(SELECT count(DISTINCT month) FROM (SELECT month FROM import_deleted_rows r WHERE r.user_id=import_deletion_operations.user_id AND r.operation_id=import_deletion_operations.id UNION ALL SELECT substr(target_key,-7) FROM import_deleted_targets t WHERE t.user_id=import_deletion_operations.user_id AND t.operation_id=import_deletion_operations.id AND substr(target_key,-7) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'))) WHERE user_id=? AND undone_by IS NULL`,
        )
        .bind(userId, userId, userId, userId),
    );
  remove('mf_transactions', 'tx_id', plan.scope.targets.mfTxIds);
  remove('freee_deals', 'id', plan.scope.targets.freeeDealIds);
  remove('balance_entries', 'id', plan.scope.targets.balanceEntryIds);
  remove('import_active_targets', 'target_key', plan.scope.targets.affectedTargetKeys);
  if (plan.scope.targets.months.length)
    statements.push(
      db
        .prepare("DELETE FROM import_active_targets WHERE user_id=? AND target_key='json:global'")
        .bind(userId),
    );
  statements.push(
    db
      .prepare(
        'UPDATE imports SET duplicate_of=NULL WHERE user_id=? AND duplicate_of IN (SELECT value FROM json_each(?))',
      )
      .bind(userId, importJson),
  );
  remove('imports', 'id', plan.importIds);
  // 確定receiptを削除し、同じ検査に残る未確定の別CSVは新しいrunへ継続できるようにする。
  statements.push(
    db
      .prepare(
        `DELETE FROM import_inspection_files WHERE user_id=? AND error_kind='committed' AND inspection_id IN (SELECT id FROM import_inspections WHERE user_id=? AND run_id IN (SELECT value FROM json_each(?)))`,
      )
      .bind(userId, userId, runJson),
  );
  statements.push(
    db
      .prepare(
        'UPDATE import_inspections SET run_id=NULL WHERE user_id=? AND run_id IN (SELECT value FROM json_each(?))',
      )
      .bind(userId, runJson),
  );
  remove('import_runs', 'id', plan.runIds);
  const keys = plan.originals.filter((r) => !r.shared).map((r) => r.key);
  if (keys.length > 1000) throw new ImportSourceDeletionError('delete_too_large', 413);
  const cleanupIndex = statements.length;
  if (keys.length)
    statements.push(
      db
        .prepare(
          `INSERT INTO r2_cleanup_jobs (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at) SELECT ?,value,'import_original','pending',0,?,NULL,?,? FROM json_each(?) WHERE true ON CONFLICT(user_id,r2_key) DO UPDATE SET purpose='import_original',state='pending',attempts=0,not_before=excluded.not_before,last_error=NULL,updated_at=excluded.updated_at RETURNING id`,
        )
        .bind(userId, nowIso, nowIso, nowIso, JSON.stringify(keys)),
    );
  if (plan.scope.targets.months.length) {
    const recompute = await planRecomputeFromDeals(getDb(db), userId, [], undefined, {
      affectedMonths: plan.scope.targets.months,
      removeMfTxIds: plan.scope.targets.mfTxIds,
      removeFreeeDealIds: plan.scope.targets.freeeDealIds,
    });
    statements.push(...recomputePlanStatements(db, userId, recompute));
  }
  const audit = buildAuditStatements({
    database: db,
    userId,
    auditId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    action: 'delete',
    scope: { kind: 'import', importId: plan.importIds[0] },
    counts: { imports: plan.importIds.length, ...plan.scope.counts },
    occurredAt: nowIso,
    result: 'succeeded',
  });
  statements.push(...audit.statements);
  // 読み1 + 再集計16 + claim最悪4 + release1。超過時は一部も書かない。
  if (statements.length + 22 + (keys.length ? 1 : 0) >= D1_INVOCATION_QUERY_LIMIT)
    throw new ImportSourceDeletionError('delete_too_large', 413);
  const result = await db.batch(statements).catch((error) => {
    if (String(error).includes('import_writer_claims.run_id'))
      throw new ImportSourceDeletionError('scope_changed');
    throw error;
  });
  let deleted = 0;
  let pending = keys.length;
  // このwriterのsnapshotで非共有と確認し、同じbatchでimportsを除いた新規intentだけを対象にする。
  // R2 deleteは最大1000 keys。一括成功後だけoutboxを閉じ、失敗/応答消失時は全intentを再試行可能に残す。
  if (keys.length) {
    try {
      await env.FILES.delete(keys);
      const jobIds = (result[cleanupIndex]!.results as { id: number }[]).map((row) => row.id);
      await db
        .prepare('DELETE FROM r2_cleanup_jobs WHERE user_id=? AND id IN (SELECT value FROM json_each(?))')
        .bind(userId, JSON.stringify(jobIds))
        .run();
      deleted = keys.length;
      pending = 0;
    } catch {
      /* metadataとintentは確定済み。既存の耐久cleanupで再試行する。 */
    }
  }
  return {
    ...publicSourceDeletionPlan(plan),
    deletedRuns: ids.length,
    originals: { deleted, pending, shared: plan.originals.filter((r) => r.shared).length },
    sharedReason: plan.originals.some((r) => r.shared)
      ? '他のCSVが同じ保存原本を使用しているため保持しています'
      : null,
  };
}
