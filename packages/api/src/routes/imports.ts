/**
 * FR-01 取込: POST /api/imports (multipart) / GET /api/imports / POST /api/restore
 * 受領→R2原本保存→形式判定→パース→月単位洗い替え→集計再生成。
 * セキュリティ: ログ・レスポンスに明細内容や金額は含めない(件数・月・理由のみ)。
 */
import {
  type CashEntry,
  type Dataset,
  FINGERPRINT_VERSION,
  type FreeeDeal,
  OwnerValidationError,
  applyFreeeDeals,
  applyMfTxs,
  canonicalMfTransactions,
  cashBizDeals,
  cashTxId,
  emptyDataset,
  importJSON,
  isCashTxId,
} from '@kanjo/core';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import {
  acquireImportWriter,
  activeDuplicateOf,
  createImportRun,
  freeeCommitStatements,
  heartbeatImportWriter,
  importLeaseGuardStatement,
  mfCommitStatements,
  planMultipartImportQueries,
  planRestoreImportQueries,
  preflightWriteSetConflicts,
  prepareRestoreWriteSet,
  reconcileImportRun,
  reconcileImportRunStatement,
  releaseImportWriter,
  restoreCommitStatements,
  restoreWriteSetFingerprint,
  targetKeysForUnit,
} from '../import-lifecycle.js';
import {
  type ImportCountSummary,
  type ParsedUnit,
  importCountSummary,
  legacyImportCountAliases,
  parseUpload,
  unitFingerprint,
} from '../import-pipeline.js';
import {
  type CashProjectionEnvelope,
  CashProjectionError,
  dealFromRow,
  getDb,
  loadCashEntries,
  loadDataset,
  loadNormMap,
  mergeRestoreCanonicalSources,
  removeCashProjection,
} from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const importsRoute = new Hono<Ctx>();

const restoredCashEntrySchema = z
  .object({
    id: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    side: z.enum(['biz', 'per']),
    io: z.enum(['income', 'expense']),
    amount: z.number().int().positive(),
    description: z.string(),
    categoryMajor: z.string(),
    categoryMid: z.string().default(''),
    memo: z.string().nullable().default(null),
    // 交通費・証憑の項目。旧バックアップには無いので既定値で補う(復元は投影行が正本のため監査目的のみ)
    transitFrom: z.string().nullable().default(null),
    transitTo: z.string().nullable().default(null),
    transitRound: z.boolean().default(false),
    receiptWaived: z.boolean().default(false),
  })
  .strict();

const canonicalScope = z
  .string()
  .refine(
    (scope) =>
      scope === 'biz_rev' ||
      scope === 'biz_personal_in' ||
      scope === 'biz_personal_out' ||
      scope === 'subs_other' ||
      /^(biz_exp|subs|per_inc|per_exp):.+$/.test(scope),
    'unknown scope',
  );

const cashProjectionSchema = z
  .object({
    version: z.literal(1),
    basis: z.literal('post-resolution'),
    rows: z
      .array(
        z
          .object({
            month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
            scope: canonicalScope,
            amount: z.number().int().positive(),
          })
          .strict(),
      )
      .max(20_000),
  })
  .strict();

/** cashProjectionのpresence stateを分け、意味不明な旧cashEntriesを黙って再投影しない。 */
const projectedCashRows = (
  obj: Record<string, unknown>,
): { ok: true; rows: CashProjectionEnvelope['rows'] } | { ok: false } => {
  const hasProjection = Object.prototype.hasOwnProperty.call(obj, 'cashProjection');
  const hasCashEntries = Object.prototype.hasOwnProperty.call(obj, 'cashEntries');
  const auditCash = hasCashEntries ? z.array(restoredCashEntrySchema).safeParse(obj.cashEntries) : null;
  if (hasCashEntries && !auditCash?.success) return { ok: false };
  if (!hasProjection) {
    return auditCash?.success && auditCash.data.length > 0 ? { ok: false } : { ok: true, rows: [] };
  }
  const parsed = cashProjectionSchema.safeParse(obj.cashProjection);
  if (!parsed.success) return { ok: false };
  const keys = parsed.data.rows.map((row) => `${row.month}\u0000${row.scope}`);
  if (new Set(keys).size !== keys.length) return { ok: false };
  return { ok: true, rows: parsed.data.rows };
};

const badCashProjection = {
  error: {
    code: 'invalid_cash_projection',
    message: '現金投影情報が不正か不足しているため、復元を中止しました',
  },
};

const badOwner = {
  error: {
    code: 'invalid_owner',
    message: '名義は「事業」「妻」「家族」のいずれかを指定してください',
  },
};

/**
 * importJSONはmfTxからpersonal/bizPersonalを再計算するため、export済みaggregate snapshotを
 * cash delta控除前に戻す。cloneにより控除が受信body自体へ波及することも防ぐ。
 */
const restoredAggregateSnapshot = (obj: Record<string, unknown>): Dataset => {
  const snapshot = structuredClone(obj);
  const restored = emptyDataset();
  importJSON(restored, snapshot);
  if (snapshot.personal) restored.personal = snapshot.personal as Dataset['personal'];
  if (snapshot.bizPersonal) restored.bizPersonal = snapshot.bizPersonal as Dataset['bizPersonal'];
  return restored;
};

/** projection検証と現金delta控除を、R2/DBへの書込みより前に完了させる。 */
const restoredWithoutCashProjection = (obj: Record<string, unknown>): Dataset | null => {
  const projection = projectedCashRows(obj);
  if (!projection.ok) return null;
  const restored = restoredAggregateSnapshot(obj);
  try {
    removeCashProjection(restored, projection.rows);
    return restored;
  } catch (error) {
    if (error instanceof CashProjectionError) return null;
    throw error;
  }
};

/** 月ごとの洗い替え前後の件数。減っていれば「月の途中までのファイル」の可能性を画面で知らせる */
interface MonthReplace {
  month: string;
  before: number;
  after: number;
}

interface UnitResult {
  filename: string;
  kind: string;
  months: string[];
  counts: ImportCountSummary;
  /** 後方互換: 旧parserの集計有効行 */
  rows: number;
  /** 後方互換: 旧parserの対象外・振替・保存不能行 */
  skipped: number;
  syntheticIds?: number;
  duplicateIds?: number;
  /** committed=原本/canonical/cache/active pointerの確定完了 */
  status: 'committed' | 'failed' | 'duplicate';
  reason?: string;
  importId?: number;
  replaced?: MonthReplace[];
}

/**
 * parserの入力件数と、今回の試行で実際に確定した保存件数をwireへ揃える。
 * failed/duplicateは新しい永続行を確定しないため、stored側3項目だけ0にする。
 */
const unitCountFields = (
  unit: ParsedUnit,
  committed: boolean,
  jsonMfTx: Dataset['mfTx'] = [],
): Pick<UnitResult, 'counts' | 'rows' | 'skipped' | 'syntheticIds' | 'duplicateIds'> => {
  const parsedCounts = importCountSummary(unit, jsonMfTx);
  const counts = committed ? parsedCounts : { ...parsedCounts, stored: 0, countable: 0, nonCountable: 0 };
  const legacy = legacyImportCountAliases(unit, jsonMfTx);
  return {
    counts,
    ...legacy,
    syntheticIds: unit.kind === 'mf' ? unit.syntheticIds : undefined,
    duplicateIds: unit.kind === 'mf' ? unit.duplicateIds : undefined,
  };
};

interface PreparedUnit {
  unit: ParsedUnit;
  contentHash: string | null;
  targetKeys: string[];
  restored: Dataset | null;
}

interface PreparedFile {
  file: File;
  buf: Uint8Array;
  units: PreparedUnit[];
}

const runtimeFailureReason = '内部処理を完了できませんでした。同じファイルでそのまま再試行できます';
const r2FailureReason = '原本ファイルを保存できませんでした。同じファイルで再試行してください';

const currentCashEdits = (data: Dataset, entries: CashEntry[]): Dataset['edits'] => {
  const ids = new Set(entries.map((entry) => cashTxId(entry.id)));
  return Object.fromEntries(Object.entries(data.edits).filter(([txId]) => ids.has(txId)));
};

const withoutCashEdits = (edits: Dataset['edits']): Dataset['edits'] =>
  Object.fromEntries(Object.entries(edits).filter(([txId]) => !isCashTxId(txId)));

/** source cash editを破棄し、destination cash editを戻した単一candidateから全派生物を作る。 */
const prepareJsonApplication = async (args: {
  userId: string;
  data: Dataset;
  restored: Dataset;
  json: Record<string, unknown>;
  cashEntries: CashEntry[];
  freeeDeals: FreeeDeal[];
  normMap: Record<string, string>;
}): Promise<{
  candidate: Dataset;
  writeSet: ReturnType<typeof prepareRestoreWriteSet>;
  contentHash: string;
}> => {
  const candidate = structuredClone(args.data);
  const destinationCashEdits = currentCashEdits(candidate, args.cashEntries);
  // importJSON assigns the aggregate maps from its input by reference. The same
  // restore unit is prepared during planning, runtime validation, and execution,
  // so mutating those maps would make each pass inflate the next one. Clone the
  // source and rebuild derived aggregates from the authoritative raw sources.
  importJSON(candidate, structuredClone(args.json));
  candidate.personal = {};
  candidate.bizPersonal = {};
  candidate.personalByOwner = {};
  candidate.edits = { ...withoutCashEdits(candidate.edits), ...destinationCashEdits };
  mergeRestoreCanonicalSources({
    data: candidate,
    restored: args.restored,
    freeeDeals: args.freeeDeals,
    cashEntries: args.cashEntries,
    normMap: args.normMap,
  });
  const writeSet = prepareRestoreWriteSet({ userId: args.userId, data: candidate, restored: args.restored });
  return {
    candidate,
    writeSet,
    contentHash: await restoreWriteSetFingerprint(writeSet),
  };
};

/** 実行時と同じcandidate/commit builderでpayload chunkとcacheを含むstatement数を事前計画する。 */
const planCommitStatementCounts = async (args: {
  database: D1Database;
  userId: string;
  preparedFiles: PreparedFile[];
  data: Dataset;
  cashEntries: CashEntry[];
  normMap: Record<string, string>;
  freeeDeals: FreeeDeal[];
  runId?: string;
  importIds?: number[];
}): Promise<number[]> => {
  let data = structuredClone(args.data);
  const counts: number[] = [];
  for (const prepared of args.preparedFiles.flatMap((file) => file.units)) {
    const unit = prepared.unit;
    if (unit.kind === 'error') continue;
    const importId = args.importIds?.[counts.length] ?? 0;
    const runId = args.runId ?? 'query-plan';
    if (unit.kind === 'json') {
      if (!prepared.restored) throw new Error('preflight済みJSON復元snapshotがありません');
      const application = await prepareJsonApplication({
        userId: args.userId,
        data,
        restored: prepared.restored,
        json: unit.json,
        cashEntries: args.cashEntries,
        freeeDeals: args.freeeDeals,
        normMap: args.normMap,
      });
      counts.push(
        restoreCommitStatements({
          database: args.database,
          userId: args.userId,
          runId,
          writeSet: application.writeSet,
          importId,
          contentHash: application.contentHash,
          targetKeys: prepared.targetKeys,
        }).length,
      );
      data = application.candidate;
      continue;
    }

    const candidate = structuredClone(data);
    if (unit.kind === 'freee') {
      applyFreeeDeals(
        candidate,
        [...unit.deals, ...cashBizDeals(args.cashEntries, args.normMap, unit.months)],
        unit.months,
      );
      counts.push(
        freeeCommitStatements({
          database: args.database,
          userId: args.userId,
          runId,
          deals: unit.deals,
          months: unit.months,
          importId,
          contentHash: prepared.contentHash ?? 'query-plan',
          targetKeys: prepared.targetKeys,
          data: candidate,
        }).length,
      );
    } else {
      const txs = canonicalMfTransactions(unit.txs);
      applyMfTxs(candidate, txs);
      counts.push(
        mfCommitStatements({
          database: args.database,
          userId: args.userId,
          runId,
          txs,
          months: unit.months,
          importId,
          contentHash: prepared.contentHash ?? 'query-plan',
          targetKeys: prepared.targetKeys,
          data: candidate,
        }).length,
      );
    }
    data = candidate;
  }
  return counts;
};

const queryBudgetError = (total?: number) => ({
  error: {
    code: 'import_query_budget_exceeded',
    message:
      total === undefined
        ? '1行の文字量が取込の安全上限を超えています。列を短くしてください'
        : `取込の安全上限を超えます（計画 ${total} queries / 上限未満 50）。ファイルを分けるか列を短くしてください`,
  },
});

const fmtWhen = (iso: string | null): string => {
  if (!iso) return '以前';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '以前';
  // 表示はJST(利用者は日本)
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
};

async function executePreparedUnit(args: {
  database: D1Database;
  userId: string;
  runId: string;
  attemptId: number;
  prepared: PreparedUnit;
  force: boolean;
  data: Dataset;
  cashEntries: CashEntry[];
  normMap: Record<string, string>;
  freeeCount: Map<string, number>;
  mfCount: Map<string, number>;
  plannedCommitStatementCount: number;
  freeeDeals: FreeeDeal[];
}): Promise<{ result: UnitResult; data: Dataset }> {
  const { database, userId, runId, attemptId, prepared, force, data, cashEntries, normMap } = args;
  const unit = prepared.unit;
  if (unit.kind === 'error') {
    throw new Error('error unitはcommit handlerの対象外です');
  }

  let candidate = structuredClone(data);
  let contentHash = prepared.contentHash;
  let restoreWriteSet: ReturnType<typeof prepareRestoreWriteSet> | null = null;
  if (unit.kind === 'json') {
    const restored = prepared.restored;
    if (!restored) throw new Error('preflight済みJSON復元snapshotがありません');
    const application = await prepareJsonApplication({
      userId,
      data,
      restored,
      json: unit.json,
      cashEntries,
      freeeDeals: args.freeeDeals,
      normMap,
    });
    candidate = application.candidate;
    restoreWriteSet = application.writeSet;
    contentHash = application.contentHash;
    await database
      .prepare('UPDATE imports SET content_hash=?, fingerprint_version=? WHERE id=? AND user_id=?')
      .bind(contentHash, FINGERPRINT_VERSION, attemptId, userId)
      .run();
  }
  if (!contentHash) throw new Error('canonical fingerprintを生成できません');

  const duplicateOf = await activeDuplicateOf(database, userId, prepared.targetKeys, contentHash);
  if (duplicateOf !== null && !force) {
    try {
      await database.batch([
        importLeaseGuardStatement({ database, userId, runId, importId: attemptId }),
        database
          .prepare(
            `UPDATE imports
             SET status='duplicate', duplicate_of=?, failure_reason=NULL
             WHERE id=? AND user_id=? AND run_id=? AND status='processing'`,
          )
          .bind(duplicateOf, attemptId, userId, runId),
        reconcileImportRunStatement(database, runId),
      ]);
    } catch {
      // D1がcommit後の応答だけ失った場合は、決着済みstatusを正本として収束する。
      await database.batch([
        database
          .prepare(
            `UPDATE imports SET status='failed', failure_reason=?
             WHERE id=? AND user_id=? AND status IN ('processing','applying')`,
          )
          .bind(runtimeFailureReason, attemptId, userId),
        reconcileImportRunStatement(database, runId),
      ]);
      const settled = await database
        .prepare('SELECT status FROM imports WHERE id=? AND user_id=?')
        .bind(attemptId, userId)
        .first<{ status: string }>();
      if (settled?.status !== 'duplicate') {
        return {
          data,
          result: {
            filename: unit.filename,
            kind: unit.kind,
            months: unit.kind === 'json' ? [] : unit.months,
            ...unitCountFields(
              unit,
              false,
              candidate.mfTx.filter((tx) => !isCashTxId(tx.id)),
            ),
            status: 'failed',
            reason: runtimeFailureReason,
            importId: attemptId,
          },
        };
      }
    }
    const active = await database
      .prepare('SELECT filename, created_at FROM imports WHERE id=? AND user_id=?')
      .bind(duplicateOf, userId)
      .first<{ filename: string | null; created_at: string | null }>();
    return {
      data,
      result: {
        filename: unit.filename,
        kind: unit.kind,
        months: unit.kind === 'json' ? [] : unit.months,
        ...unitCountFields(
          unit,
          false,
          candidate.mfTx.filter((tx) => !isCashTxId(tx.id)),
        ),
        status: 'duplicate',
        reason: `${fmtWhen(active?.created_at ?? null)} に「${active?.filename ?? '過去の取込'}」として現在適用中(内容が同一)`,
        importId: attemptId,
      },
    };
  }

  try {
    let statements: D1PreparedStatement[];
    if (unit.kind === 'freee') {
      applyFreeeDeals(
        candidate,
        [...unit.deals, ...cashBizDeals(cashEntries, normMap, unit.months)],
        unit.months,
      );
      statements = freeeCommitStatements({
        database,
        userId,
        runId,
        deals: unit.deals,
        months: unit.months,
        importId: attemptId,
        contentHash,
        targetKeys: prepared.targetKeys,
        data: candidate,
      });
    } else if (unit.kind === 'mf') {
      const canonicalTxs = canonicalMfTransactions(unit.txs);
      applyMfTxs(candidate, canonicalTxs);
      statements = mfCommitStatements({
        database,
        userId,
        runId,
        txs: canonicalTxs,
        months: unit.months,
        importId: attemptId,
        contentHash,
        targetKeys: prepared.targetKeys,
        data: candidate,
      });
    } else {
      if (!restoreWriteSet) throw new Error('restore write-setを生成できません');
      statements = restoreCommitStatements({
        database,
        userId,
        runId,
        writeSet: restoreWriteSet,
        importId: attemptId,
        contentHash,
        targetKeys: prepared.targetKeys,
      });
    }
    // builder入力の差異が将来増えても、計画上界を超えるbatchはcanonicalへ送らない。
    if (statements.length > args.plannedCommitStatementCount) {
      throw new Error('import query plan drift');
    }
    // D1 batchはstatementを順序実行し、1件でも失敗するとunit全体をrollbackする。
    await database.batch(statements);

    let replaced: MonthReplace[] | undefined;
    if (unit.kind === 'freee') {
      const after = new Map<string, number>();
      for (const deal of unit.deals) after.set(deal.month, (after.get(deal.month) ?? 0) + 1);
      replaced = unit.months.map((month) => ({
        month,
        before: args.freeeCount.get(month) ?? 0,
        after: after.get(month) ?? 0,
      }));
      after.forEach((value, month) => args.freeeCount.set(month, value));
    } else if (unit.kind === 'mf') {
      const after = new Map<string, number>();
      for (const tx of canonicalMfTransactions(unit.txs)) after.set(tx.m, (after.get(tx.m) ?? 0) + 1);
      replaced = unit.months.map((month) => ({
        month,
        before: args.mfCount.get(month) ?? 0,
        after: after.get(month) ?? 0,
      }));
      after.forEach((value, month) => args.mfCount.set(month, value));
    }
    return {
      data: candidate,
      result: {
        filename: unit.filename,
        kind: unit.kind,
        months: unit.kind === 'json' ? candidate.months : unit.months,
        ...unitCountFields(
          unit,
          true,
          candidate.mfTx.filter((tx) => !isCashTxId(tx.id)),
        ),
        status: 'committed',
        importId: attemptId,
        replaced,
      },
    };
  } catch {
    await database.batch([
      database
        .prepare(
          `UPDATE imports SET status='failed', failure_reason=?
           WHERE id=? AND user_id=? AND status IN ('processing','applying')`,
        )
        .bind(runtimeFailureReason, attemptId, userId),
      reconcileImportRunStatement(database, runId),
    ]);
    const settled = await database
      .prepare('SELECT status FROM imports WHERE id=? AND user_id=?')
      .bind(attemptId, userId)
      .first<{ status: string }>();
    if (settled?.status === 'committed') {
      return {
        data: candidate,
        result: {
          filename: unit.filename,
          kind: unit.kind,
          months: unit.kind === 'json' ? candidate.months : unit.months,
          ...unitCountFields(
            unit,
            true,
            candidate.mfTx.filter((tx) => !isCashTxId(tx.id)),
          ),
          status: 'committed',
          importId: attemptId,
        },
      };
    }
    return {
      data,
      result: {
        filename: unit.filename,
        kind: unit.kind,
        months: unit.kind === 'json' ? [] : unit.months,
        ...unitCountFields(
          unit,
          false,
          candidate.mfTx.filter((tx) => !isCashTxId(tx.id)),
        ),
        status: 'failed',
        reason: runtimeFailureReason,
        importId: attemptId,
      },
    };
  }
}

importsRoute.post('/imports', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const form = await c.req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) {
    return c.json({ error: { code: 'no_file', message: 'ファイルが指定されていません' } }, 400);
  }

  // 「同じ内容でも取り込み直す」チェック。既定は重複をスキップする
  const force = form.get('force') === '1';
  const bufferedFiles: Array<{ file: File; buf: Uint8Array }> = [];
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      return c.json({ error: { code: 'file_too_large', message: '1ファイルは25MB以下にしてください' } }, 413);
    }
    bufferedFiles.push({ file, buf: new Uint8Array(await file.arrayBuffer()) });
  }

  // claim自体は期限付きのephemeral coordinationであり、受理前にrun/R2/canonicalは作らない。
  const runId = crypto.randomUUID();
  if (!(await acquireImportWriter(c.env.DB, userId, runId))) {
    return c.json(
      { error: { code: 'import_busy', message: '別の取込処理が進行中です。完了後に再試行してください' } },
      409,
    );
  }

  const preparedFiles: PreparedFile[] = [];
  let normMap: Record<string, string> = {};
  let cashEntries: CashEntry[] = [];
  let data = emptyDataset();
  let freeeCount = new Map<string, number>();
  let freeeDeals: FreeeDeal[] = [];
  let mfCount = new Map<string, number>();
  let commitStatementCounts: number[] = [];
  let queryPlan: ReturnType<typeof planMultipartImportQueries> | null = null;
  let preflightAccepted = false;
  try {
    // writer claim取得後のsnapshotだけを、計画と実行の双方で共有する。
    normMap = await loadNormMap(db, userId);
    for (const { file, buf } of bufferedFiles) {
      const units = parseUpload(file.name, buf, normMap);
      const preparedUnits: PreparedUnit[] = [];
      for (const unit of units) {
        const restored = unit.kind === 'json' ? restoredWithoutCashProjection(unit.json) : null;
        if (unit.kind === 'json' && !restored) return c.json(badCashProjection, 400);
        preparedUnits.push({
          unit,
          contentHash: unit.kind === 'json' ? null : await unitFingerprint(unit),
          targetKeys: targetKeysForUnit(unit),
          restored,
        });
      }
      preparedFiles.push({ file, buf, units: preparedUnits });
    }
    const conflicts = preflightWriteSetConflicts(
      preparedFiles.flatMap((prepared) => prepared.units.map((unit) => unit.unit)),
    );
    if (conflicts.length) {
      return c.json(
        {
          error: {
            code: 'import_write_conflict',
            message: `同じ取込先を書き換えるファイルが重複しています: ${conflicts.join(', ')}`,
          },
        },
        400,
      );
    }

    cashEntries = await loadCashEntries(db, userId);
    data = await loadDataset(db, userId, cashEntries);
    const freeeDealRows = await db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId));
    freeeDeals = freeeDealRows.map(dealFromRow);
    freeeCount = new Map<string, number>();
    for (const deal of freeeDeals) {
      freeeCount.set(deal.month, (freeeCount.get(deal.month) ?? 0) + 1);
    }
    mfCount = new Map<string, number>();
    for (const tx of data.mfTx) {
      if (!isCashTxId(tx.id)) mfCount.set(tx.m, (mfCount.get(tx.m) ?? 0) + 1);
    }
    commitStatementCounts = await planCommitStatementCounts({
      database: c.env.DB,
      userId,
      preparedFiles,
      data,
      cashEntries,
      normMap,
      freeeDeals,
    });
    const applicableUnits = preparedFiles
      .flatMap((file) => file.units)
      .filter((prepared) => prepared.unit.kind !== 'error');
    queryPlan = planMultipartImportQueries({
      fileCount: preparedFiles.length,
      unitCount: preparedFiles.reduce((sum, file) => sum + file.units.length, 0),
      applicableUnitCount: applicableUnits.length,
      jsonUnitCount: applicableUnits.filter((prepared) => prepared.unit.kind === 'json').length,
      commitStatementCounts,
    });
    if (!queryPlan.accepted) return c.json(queryBudgetError(queryPlan.total), 413);
    preflightAccepted = true;
  } catch (error) {
    if (error instanceof OwnerValidationError) return c.json(badOwner, 400);
    if (error instanceof Error && error.message.includes('D1 JSON payload上限')) {
      return c.json(queryBudgetError(), 413);
    }
    throw error;
  } finally {
    if (!preflightAccepted) await releaseImportWriter(c.env.DB, userId, runId);
  }
  if (!queryPlan) throw new Error('import query plan was not created');

  const results: UnitResult[] = [];
  let runCreated = false;
  try {
    await createImportRun(c.env.DB, userId, runId);
    runCreated = true;
    const attemptFiles: Array<{
      preparedFile: PreparedFile;
      r2Key: string;
      attempts: Array<{ prepared: PreparedUnit; id: number; plannedCommitStatementCount: number }>;
    }> = [];
    let commitStatementIndex = 0;
    // 全logical unitを先に作り、run reconciliationが「まだ作られていない後続unit」を見落とさないようにする。
    for (const preparedFile of preparedFiles) {
      const r2Key = `uploads/${new Date().toISOString().slice(0, 10)}/${runId}-${crypto.randomUUID()}-${preparedFile.file.name}`;
      const attempts: Array<{
        prepared: PreparedUnit;
        id: number;
        plannedCommitStatementCount: number;
      }> = [];
      for (const prepared of preparedFile.units) {
        const unit = prepared.unit;
        const [record] = await db
          .insert(s.imports)
          .values({
            userId,
            filename: unit.filename,
            kind: unit.kind === 'error' ? null : unit.kind,
            months: unit.kind === 'error' || unit.kind === 'json' ? '' : unit.months.join(','),
            rowCount: unit.kind === 'error' || unit.kind === 'json' ? 0 : unit.rows,
            status: unit.kind === 'error' ? 'failed' : 'processing',
            r2Key,
            contentHash: prepared.contentHash,
            runId,
            targetKeys: JSON.stringify(prepared.targetKeys),
            failureReason: unit.kind === 'error' ? unit.reason : null,
            fingerprintVersion: prepared.contentHash ? FINGERPRINT_VERSION : null,
          })
          .returning({ id: s.imports.id });
        const plannedCommitStatementCount =
          unit.kind === 'error' ? 0 : (commitStatementCounts[commitStatementIndex++] ?? 0);
        attempts.push({ prepared, id: record.id, plannedCommitStatementCount });
      }
      attemptFiles.push({ preparedFile, r2Key, attempts });
    }

    // 実attempt IDをbindしたbuilderでもstatement上界が変わらないことをR2保存前に検証する。
    const runtimeCommitStatementCounts = await planCommitStatementCounts({
      database: c.env.DB,
      userId,
      preparedFiles,
      data,
      cashEntries,
      normMap,
      freeeDeals,
      runId,
      importIds: attemptFiles.flatMap((file) =>
        file.attempts
          .filter((attempt) => attempt.prepared.unit.kind !== 'error')
          .map((attempt) => attempt.id),
      ),
    });
    if (runtimeCommitStatementCounts.some((count, index) => count > (commitStatementCounts[index] ?? 0))) {
      throw new Error('import query plan drift');
    }
    await reconcileImportRun(c.env.DB, runId);

    for (const { preparedFile, r2Key, attempts } of attemptFiles) {
      await heartbeatImportWriter(c.env.DB, userId, runId);
      let stored = true;
      try {
        await c.env.FILES.put(r2Key, preparedFile.buf);
      } catch {
        stored = false;
      }
      for (const attempt of attempts) {
        const unit = attempt.prepared.unit;
        if (unit.kind === 'error') {
          results.push({
            filename: unit.filename,
            kind: 'unknown',
            months: [],
            ...unitCountFields(unit, false),
            status: 'failed',
            reason: unit.reason,
            importId: attempt.id,
          });
          continue;
        }
        if (!stored) {
          await c.env.DB.batch([
            c.env.DB.prepare(
              "UPDATE imports SET status='failed', failure_reason=? WHERE id=? AND user_id=?",
            ).bind(r2FailureReason, attempt.id, userId),
            reconcileImportRunStatement(c.env.DB, runId),
          ]);
          results.push({
            filename: unit.filename,
            kind: unit.kind,
            months: unit.kind === 'json' ? [] : unit.months,
            ...unitCountFields(unit, false, attempt.prepared.restored?.mfTx ?? []),
            status: 'failed',
            reason: r2FailureReason,
            importId: attempt.id,
          });
          continue;
        }
        await heartbeatImportWriter(c.env.DB, userId, runId);
        const executed = await executePreparedUnit({
          database: c.env.DB,
          userId,
          runId,
          attemptId: attempt.id,
          prepared: attempt.prepared,
          force,
          data,
          cashEntries,
          normMap,
          freeeCount,
          mfCount,
          plannedCommitStatementCount: attempt.plannedCommitStatementCount,
          freeeDeals,
        });
        data = executed.data;
        results.push(executed.result);
      }
    }
  } catch (error) {
    if (runCreated) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `UPDATE imports SET status='failed', failure_reason=?
             WHERE run_id=? AND status IN ('processing','applying')`,
        ).bind(runtimeFailureReason, runId),
        reconcileImportRunStatement(c.env.DB, runId, undefined, runtimeFailureReason),
      ]);
    }
    throw error;
  } finally {
    await releaseImportWriter(c.env.DB, userId, runId);
  }
  const ok = results.some((result) => result.status === 'committed');
  // 全件が重複スキップなら「失敗」ではなく「取込済み」として 200 で返す
  const allDuplicate = results.length > 0 && results.every((result) => result.status === 'duplicate');
  return c.json({ runId, results, ok, queryPlan }, ok || allDuplicate ? 200 : 400);
});

importsRoute.get('/imports', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.imports)
    .where(eq(s.imports.userId, userId))
    .orderBy(desc(s.imports.id))
    .limit(100);
  const activeRows = await db
    .select({ importId: s.importActiveTargets.importId })
    .from(s.importActiveTargets)
    .where(eq(s.importActiveTargets.userId, userId));
  const activeCounts = new Map<number, number>();
  for (const row of activeRows) activeCounts.set(row.importId, (activeCounts.get(row.importId) ?? 0) + 1);
  return c.json({
    imports: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      kind: r.kind,
      months: r.months ? r.months.split(',').filter(Boolean) : [],
      rows: r.rowCount,
      status: r.status,
      failureReason: r.failureReason ?? null,
      duplicateOf: r.duplicateOf ?? null,
      generationState: (() => {
        if (r.status === 'ok') return 'legacy';
        if (r.status !== 'committed') return null;
        let targetCount = 0;
        try {
          const parsed = JSON.parse(r.targetKeys ?? '[]');
          targetCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          targetCount = 0;
        }
        const activeCount = activeCounts.get(r.id) ?? 0;
        if (targetCount > 0 && activeCount === targetCount) return 'active';
        if (activeCount > 0) return 'partial';
        return 'superseded';
      })(),
      createdAt: r.createdAt,
      committedAt: r.committedAt ?? null,
    })),
  });
});

/** HTML版互換JSONによる初期移行(spec §12) */
importsRoute.post('/restore', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: { code: 'bad_json', message: 'JSONを読み取れません' } }, 400);
  }
  if (!body || (!body.months && !body.mfTx && !body.biz)) {
    return c.json({ error: { code: 'bad_format', message: 'HTML版互換JSONではありません' } }, 400);
  }
  let restored: Dataset | null;
  try {
    restored = restoredWithoutCashProjection(body);
  } catch (error) {
    if (error instanceof OwnerValidationError) return c.json(badOwner, 400);
    throw error;
  }
  if (!restored) return c.json(badCashProjection, 400);
  const unit: ParsedUnit = { kind: 'json', filename: 'restore.json', json: body };
  const prepared: PreparedUnit = {
    unit,
    contentHash: null,
    targetKeys: targetKeysForUnit(unit),
    restored,
  };

  const runId = crypto.randomUUID();
  if (!(await acquireImportWriter(c.env.DB, userId, runId))) {
    return c.json(
      { error: { code: 'import_busy', message: '別の取込処理が進行中です。完了後に再試行してください' } },
      409,
    );
  }

  let cashEntries: CashEntry[] = [];
  let data = emptyDataset();
  let normMap: Record<string, string> = {};
  let freeeDeals: FreeeDeal[] = [];
  let restoreCommitCount = 0;
  let queryPlan: ReturnType<typeof planRestoreImportQueries> | null = null;
  let preflightAccepted = false;
  try {
    // multipartと同じく、claim取得後のauthoritative snapshotで計画と実行を行う。
    cashEntries = await loadCashEntries(db, userId);
    data = await loadDataset(db, userId, cashEntries);
    normMap = await loadNormMap(db, userId);
    freeeDeals = (await db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId))).map(
      dealFromRow,
    );
    const application = await prepareJsonApplication({
      userId,
      data,
      restored,
      json: body,
      cashEntries,
      freeeDeals,
      normMap,
    });
    restoreCommitCount = restoreCommitStatements({
      database: c.env.DB,
      userId,
      runId: 'query-plan',
      writeSet: application.writeSet,
      importId: 0,
      contentHash: application.contentHash,
      targetKeys: prepared.targetKeys,
    }).length;
    queryPlan = planRestoreImportQueries(restoreCommitCount);
    if (!queryPlan.accepted) return c.json(queryBudgetError(queryPlan.total), 413);
    preflightAccepted = true;
  } catch (error) {
    if (error instanceof OwnerValidationError) return c.json(badOwner, 400);
    if (error instanceof Error && error.message.includes('D1 JSON payload上限')) {
      return c.json(queryBudgetError(), 413);
    }
    throw error;
  } finally {
    if (!preflightAccepted) await releaseImportWriter(c.env.DB, userId, runId);
  }
  if (!queryPlan) throw new Error('restore query plan was not created');

  let runCreated = false;
  try {
    await createImportRun(c.env.DB, userId, runId);
    runCreated = true;
    const [attempt] = await db
      .insert(s.imports)
      .values({
        userId,
        filename: unit.filename,
        kind: 'json',
        months: Array.isArray(body.months) ? body.months.join(',') : '',
        rowCount: Array.isArray(body.mfTx) ? body.mfTx.length : 0,
        status: 'processing',
        r2Key: null,
        contentHash: null,
        runId,
        targetKeys: JSON.stringify(prepared.targetKeys),
        fingerprintVersion: null,
      })
      .returning({ id: s.imports.id });
    const runtimeCommitCount = (
      await planCommitStatementCounts({
        database: c.env.DB,
        userId,
        preparedFiles: [{ file: new File([], unit.filename), buf: new Uint8Array(), units: [prepared] }],
        data,
        cashEntries,
        normMap,
        freeeDeals,
        runId,
        importIds: [attempt.id],
      })
    )[0];
    if (runtimeCommitCount === undefined || runtimeCommitCount > restoreCommitCount) {
      throw new Error('restore query plan drift');
    }
    const executed = await executePreparedUnit({
      database: c.env.DB,
      userId,
      runId,
      attemptId: attempt.id,
      prepared,
      force: false,
      data,
      cashEntries,
      normMap,
      freeeCount: new Map(),
      mfCount: new Map(),
      plannedCommitStatementCount: restoreCommitCount,
      freeeDeals,
    });
    if (executed.result.status === 'failed') {
      return c.json({ error: { code: 'restore_failed', message: runtimeFailureReason } }, 500);
    }
    return c.json({
      ok: true,
      duplicate: executed.result.status === 'duplicate',
      months: executed.data.months,
      mfTxCount: executed.data.mfTx.length,
      rules: executed.data.rules.length,
      runId,
      queryPlan,
    });
  } catch (error) {
    if (runCreated) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `UPDATE imports SET status='failed', failure_reason=?
             WHERE run_id=? AND status IN ('processing','applying')`,
        ).bind(runtimeFailureReason, runId),
        reconcileImportRunStatement(c.env.DB, runId, undefined, runtimeFailureReason),
      ]);
    }
    throw error;
  } finally {
    await releaseImportWriter(c.env.DB, userId, runId);
  }
});
