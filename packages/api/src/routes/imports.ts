/**
 * FR-01 取込: POST /api/imports (multipart) / GET /api/imports / POST /api/restore
 * 受領→R2原本保存→形式判定→パース→月単位洗い替え→集計再生成。
 * セキュリティ: ログ・レスポンスに明細内容や金額は含めない(件数・月・理由のみ)。
 */
import {
  type CashEntry,
  DEFAULT_STAT_MIN_MONTHS,
  type Dataset,
  FINGERPRINT_VERSION,
  type FreeeDeal,
  IMPORT_LIMITS,
  IMPORT_MB,
  type ImportDuplicate,
  type ImportFileState,
  type ImportHistoryResult,
  type ImportRunResult,
  type ImportSource,
  type ImportValidation,
  OwnerValidationError,
  SUB_VENDOR_NAME_MAX,
  TX_EDIT_BASE_BITS,
  TxSplitsSnapshotError,
  applyFreeeDeals,
  applyMfTxs,
  canonicalEncode,
  canonicalMfTransactions,
  cashBizDeals,
  cashTxId,
  emptyDataset,
  freeeDealKeys,
  importArchiveViolation,
  importBodyLimitBytes,
  importDuplicate,
  importFileSelectable,
  importFileState,
  importGenerationState,
  importHistoryActions,
  importHistoryCancelable,
  importHistoryDiscardBlock,
  importHistoryHideable,
  importInspectionSummary,
  importJSON,
  importLimitViolation,
  importLimitsNote,
  importPeriodFromMonths,
  importRunResult,
  importUndoDeadline,
  importValidation,
  isCashTxId,
  isCloseMonth,
  isImportSource,
  isReviewItemKey,
  isReviewItemKind,
  mfStableKey,
  normalizeBaseKnown,
  normalizeVendorKey,
  orderedImportSources,
  projectAccountingDataset,
  reconcileBizDuplicates,
  resolveIncomingTx,
  sourceNeutralSubscriptionDeals,
  subsCandidates,
  validateTxSplitsForDataset,
  vendorKey,
} from '@kanjo/core';
import { and, desc, eq } from 'drizzle-orm';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { AuditValidationError } from '../audit-log.js';
import type { AuthEnv, AuthVariables } from '../auth.js';
import * as s from '../db/schema.js';
import {
  DELETION_UNDO_RETENTION_DAYS,
  DeletionScopeChangedError,
  executeDeletion,
  planDeletion,
} from '../deletion-lifecycle.js';
import { computeImportDiff, diffBaselineFromDataset, importResolutionFingerprint } from '../import-diff.js';
import {
  type MfResolutionAuditDecision,
  type MfResolutionPlan,
  type RestoreDuplicateVerdict,
  type RestoreFreeeDealExclusion,
  type RestoreMonthlyCloseReview,
  type RestoreReviewSnooze,
  type RestoreSubVendorMetadata,
  type RestoreSubVendorReviewDecision,
  type RestoreTotalCashflowOperation,
  acquireImportWriter,
  activeDuplicateOf,
  assetsCommitStatements,
  buildMfResolutionAuditStatements,
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
  shrinkingMonths,
  targetKeysForUnit,
} from '../import-lifecycle.js';
import {
  type ImportCountSummary,
  type ParsedUnit,
  importCountSummary,
  legacyImportCountAliases,
  parseUpload,
  unitFingerprint,
  zipCentralDirectoryStats,
} from '../import-pipeline.js';
import {
  type ImportRateLimitKind,
  consumeImportRateLimit,
  importRateLimitedResponse,
} from '../import-rate-limit.js';
import {
  type CashProjectionEnvelope,
  CashProjectionError,
  type ImportRestoreSettingsSnapshot,
  addCashProjection,
  getDb,
  loadDataset,
  loadImportRestoreSettingsSnapshot,
  mergeRestoreCanonicalSources,
  removeCashProjection,
} from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

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

const analysisSettingsBackupSchema = z.object({ statMinMonths: z.number().int().min(3).max(24) }).strict();
const subVendorExclusionsBackupSchema = z
  .array(z.object({ partner: z.string().trim().min(1).max(120) }).strict())
  .max(5_000);
// 0040: 保留と月次レビュー。kind/itemKey/month はルートと同じ core の検証器で受け、D1 の CHECK 違反を commit まで持ち込まない
const isoTimestamp = z.string().min(1).max(40);
const subVendorMetadataBackupSchema = z
  .array(
    z
      .object({
        name: z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX),
        category: z.string().trim().min(1).max(20).nullable(),
        reviewedAt: isoTimestamp.nullable(),
      })
      .strict(),
  )
  .max(5_000)
  .refine((rows) => new Set(rows.map((row) => row.name)).size === rows.length);
const subVendorReviewDecisionsBackupSchema = z
  .array(
    z
      .object({
        vendorKey: z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX),
        decision: z.enum(['confirmed', 'dismissed']),
        ruleFingerprint: z.string().min(1).max(500),
        decidedAt: isoTimestamp,
      })
      .strict(),
  )
  .max(5_000)
  .refine((rows) => new Set(rows.map((row) => row.vendorKey)).size === rows.length);
const reviewSnoozesBackupSchema = z
  .array(
    z
      .object({
        kind: z.string().refine(isReviewItemKind),
        itemKey: z.string().refine(isReviewItemKey),
        fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
        snoozedAt: isoTimestamp,
      })
      .strict(),
  )
  .max(5_000)
  .refine((rows) => new Set(rows.map((row) => `${row.kind}\0${row.itemKey}`)).size === rows.length);
const monthlyCloseReviewsBackupSchema = z
  .array(
    z
      .object({
        month: z.string().refine(isCloseMonth),
        reviewedAt: isoTimestamp,
        reviewedByUserId: z.string().min(1).max(64),
      })
      .strict(),
  )
  .max(1_200)
  .refine((rows) => new Set(rows.map((row) => row.month)).size === rows.length);
// 0041: 総収支の判断3表。CHECK 違反を commit まで持ち込まないよう、enum と桁はここで落とす
const duplicateVerdictsBackupSchema = z
  .array(
    z
      .object({
        txId: z.string().min(1).max(200),
        verdict: z.enum(['same', 'different']),
        // 第二の引き当て鍵(DR-13)と、その鍵を作った版。名指しの無い旧行は NULL のまま運ぶ
        stableKey: z.string().max(200).nullable().default(null),
        fingerprintVersion: z.number().int().nonnegative().nullable().default(null),
        decidedAt: isoTimestamp.nullable().default(null),
        updatedAt: isoTimestamp.nullable().default(null),
        freeeKey: z.string().max(400).nullable().default(null),
      })
      .strict(),
  )
  .max(50_000)
  .refine((rows) => new Set(rows.map((row) => row.txId)).size === rows.length);
const freeeDealExclusionsBackupSchema = z
  .array(
    z
      .object({
        freeeKey: z.string().min(1).max(400),
        reason: z.string().max(400),
        // 0037 以前に付いた行は reason_code を持たない。'other' へ寄せると利用者の分類と混ざる
        reasonCode: z
          .enum(['transfer', 'internal', 'book_only', 'duplicate', 'other'])
          .nullable()
          .default(null),
        memo: z.string().max(200).nullable().default(null),
        createdAt: isoTimestamp.nullable().default(null),
        updatedAt: isoTimestamp.nullable().default(null),
      })
      .strict(),
  )
  .max(20_000)
  .refine((rows) => new Set(rows.map((row) => row.freeeKey)).size === rows.length);
const totalCashflowOperationsBackupSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(64),
        kind: z.enum(['verdict', 'exclude', 'restore', 'undo']),
        // 操作「前」の値。中身は解釈せず文字列のまま戻す(解釈すると版が増えたときに復元が落ちる)
        itemsJson: z.string().max(100_000),
        itemCount: z.number().int().nonnegative(),
        undoesId: z.string().max(64).nullable().default(null),
        undoneAt: isoTimestamp.nullable().default(null),
        createdAt: isoTimestamp,
      })
      .strict(),
  )
  .max(20_000)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length);
const resolutionDecisionSchema = z
  .object({
    txIds: z.array(z.string().min(1)).min(1).max(200),
    choice: z.enum(['keep', 'incoming']),
    remember: z.boolean(),
    vendorKey: z.string().max(200).optional(),
    vendorLabel: z.string().max(200).optional(),
    memoryValue: z
      .object({
        cls: z.enum(['biz', 'per']).nullable(),
        big: z.string().max(100).nullable(),
        mid: z.string().max(100).nullable(),
        owner: z.enum(['business', 'spouse', 'family']).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
const resolutionRequestSchema = z
  .object({
    fingerprint: z.string().min(1),
    decisions: z.array(resolutionDecisionSchema).max(200),
  })
  .strict();
type ResolutionRequest = z.infer<typeof resolutionRequestSchema>;

class ImportResolutionError extends Error {
  constructor(readonly code: 'resolution_scope_changed' | 'invalid_resolution') {
    super(code);
    this.name = 'ImportResolutionError';
  }
}

class InvalidRestoreSettingsError extends Error {
  constructor() {
    super('invalid_restore_settings');
    this.name = 'InvalidRestoreSettingsError';
  }
}

const resolveRestoreSettings = (
  obj: Record<string, unknown>,
  destination: ImportRestoreSettingsSnapshot,
): ImportRestoreSettingsSnapshot => {
  const analysis = Object.prototype.hasOwnProperty.call(obj, 'analysisSettings')
    ? analysisSettingsBackupSchema.safeParse(obj.analysisSettings)
    : { success: true as const, data: { statMinMonths: destination.statMinMonths } };
  const sourceExclusions = Object.prototype.hasOwnProperty.call(obj, 'subVendorExclusions')
    ? subVendorExclusionsBackupSchema.safeParse(obj.subVendorExclusions)
    : { success: true as const, data: [] };
  if (!analysis.success || !sourceExclusions.success) {
    throw new InvalidRestoreSettingsError();
  }
  const byKey = new Map<string, { partner: string; vendorKey: string }>();
  for (const entry of [...destination.subVendorExclusions, ...sourceExclusions.data]) {
    const partner = entry.partner;
    const key =
      'vendorKey' in entry && typeof entry.vendorKey === 'string' ? entry.vendorKey : vendorKey(partner);
    if (key) byKey.set(key, { partner, vendorKey: key });
  }
  return {
    normMap: destination.normMap,
    statMinMonths: analysis.data.statMinMonths ?? DEFAULT_STAT_MIN_MONTHS,
    subVendorExclusions: [...byKey.values()],
    subVendors: destination.subVendors,
    subVendorReviewDecisions: destination.subVendorReviewDecisions,
    cashEntries: destination.cashEntries,
    freeeDeals: destination.freeeDeals,
    txSplits: destination.txSplits,
    // JSON復元は現在の取引先の決め事を置き換えない。通常取込の解決入力として保持する。
    vendorMemories: destination.vendorMemories,
    destinationRowCounts: destination.destinationRowCounts,
  };
};

/**
 * 新backupはベンダーの補助属性と見直し判断をcanonicalに運ぶ。
 * 旧backupのキー欠落は空集合とは扱わず、復元先の値を保つ。
 */
const resolveRestoreSubscriptionState = (
  obj: Record<string, unknown>,
): {
  metadata: RestoreSubVendorMetadata[] | null;
  decisions: RestoreSubVendorReviewDecision[] | null;
} => {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(obj, key);
  const metadata = has('subVendorMetadata')
    ? subVendorMetadataBackupSchema.safeParse(obj.subVendorMetadata)
    : null;
  const decisions = has('subVendorReviewDecisions')
    ? subVendorReviewDecisionsBackupSchema.safeParse(obj.subVendorReviewDecisions)
    : null;
  if ((metadata && !metadata.success) || (decisions && !decisions.success)) {
    throw new InvalidRestoreSettingsError();
  }
  return {
    metadata: metadata?.success ? metadata.data : null,
    decisions: decisions?.success ? decisions.data : null,
  };
};

/**
 * 0040: バックアップの保留・月次レビューを読む。key が無い旧バックアップは null を返し、既存の行を残す。
 * key があれば(空配列でも)その集合で置き換える。レビュー者 (actor の user id) の欠けた行は
 * テナント鍵で埋めず、復元全体を不正な設定として拒む (誰がレビューしたかを捏造しない)。
 *
 * 0041: 総収支の判断3表も同じ規則で読む。1表でも検証に落ちたら復元全体を拒む。
 * 判断だけ入って履歴が欠けると、取消ボタンが復元前の操作を指して二重に戻してしまう。
 */
const resolveRestoreReviewState = (
  obj: Record<string, unknown>,
): {
  reviewSnoozes: RestoreReviewSnooze[] | null;
  monthlyCloseReviews: RestoreMonthlyCloseReview[] | null;
  duplicateVerdicts: RestoreDuplicateVerdict[] | null;
  freeeDealExclusions: RestoreFreeeDealExclusion[] | null;
  totalCashflowOperations: RestoreTotalCashflowOperation[] | null;
} => {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(obj, key);
  const snoozes = has('reviewSnoozes') ? reviewSnoozesBackupSchema.safeParse(obj.reviewSnoozes) : null;
  const reviews = has('monthlyCloseReviews')
    ? monthlyCloseReviewsBackupSchema.safeParse(obj.monthlyCloseReviews)
    : null;
  const verdicts = has('duplicateVerdicts')
    ? duplicateVerdictsBackupSchema.safeParse(obj.duplicateVerdicts)
    : null;
  const exclusions = has('freeeDealExclusions')
    ? freeeDealExclusionsBackupSchema.safeParse(obj.freeeDealExclusions)
    : null;
  const operations = has('totalCashflowOperations')
    ? totalCashflowOperationsBackupSchema.safeParse(obj.totalCashflowOperations)
    : null;
  if (
    (snoozes && !snoozes.success) ||
    (reviews && !reviews.success) ||
    (verdicts && !verdicts.success) ||
    (exclusions && !exclusions.success) ||
    (operations && !operations.success)
  ) {
    throw new InvalidRestoreSettingsError();
  }
  return {
    reviewSnoozes: snoozes?.success ? snoozes.data : null,
    monthlyCloseReviews: reviews?.success ? reviews.data : null,
    duplicateVerdicts: verdicts?.success ? verdicts.data : null,
    freeeDealExclusions: exclusions?.success ? exclusions.data : null,
    totalCashflowOperations: operations?.success ? operations.data : null,
  };
};

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

/**
 * バックアップに入っている現金の記帳のうち、復元してよい分。
 *
 * 移行先に記帳が1件でもあれば空を返す。この経路は初期移行であり、いま使っている記帳を
 * バックアップ時点へ巻き戻すことは意図していない。idも重なるため、混ぜると宛先が壊れる。
 */
const restorableCashEntries = (
  obj: Record<string, unknown>,
  destination: ReadonlyArray<CashEntry>,
): CashEntry[] => {
  if (destination.length > 0) return [];
  const parsed = z.array(restoredCashEntrySchema).safeParse(obj.cashEntries);
  return parsed.success ? parsed.data : [];
};

const badCashProjection = {
  error: {
    code: 'invalid_cash_projection',
    message: '現金投影情報が不正か不足しているため、復元を中止しました',
  },
};

const badRestoreSettings = {
  error: {
    code: 'invalid_restore_settings',
    message: '復元設定の形式が不正なため、復元を中止しました',
  },
};

const badOwner = {
  error: {
    code: 'invalid_owner',
    message: '名義は「事業」「妻」「家族」のいずれかを指定してください',
  },
};

const badTxSplits = {
  error: {
    code: 'invalid_tx_splits_snapshot',
    message: '明細の分割情報が親明細と整合しないため、復元を中止しました',
  },
};

/**
 * importJSONはmfTxからpersonal/bizPersonalを再計算するため、export済みaggregate snapshotを
 * cash delta控除前に戻す。cloneにより控除が受信body自体へ波及することも防ぐ。
 */
const restoredAggregateSnapshot = (obj: Record<string, unknown>): Dataset => {
  // aggregate baselineの復元にはcanonical childは不要。参照整合性はcandidate構成後に検査する。
  const { txSplits: _txSplits, ...snapshot } = structuredClone(obj);
  const restored = emptyDataset();
  importJSON(restored, snapshot);
  if (snapshot.personal) restored.personal = snapshot.personal as Dataset['personal'];
  if (snapshot.bizPersonal) restored.bizPersonal = snapshot.bizPersonal as Dataset['bizPersonal'];
  return restored;
};

/** projection検証と現金delta控除を、R2/DBへの書込みより前に完了させる。 */
const restoredWithoutCashProjection = (
  obj: Record<string, unknown>,
): { data: Dataset; projectionRows: CashProjectionEnvelope['rows'] } | null => {
  const projection = projectedCashRows(obj);
  if (!projection.ok) return null;
  const restored = restoredAggregateSnapshot(obj);
  try {
    removeCashProjection(restored, projection.rows);
    return { data: restored, projectionRows: projection.rows };
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
  /**
   * 資産推移CSVで、合計欄と内訳の和が合わなかった月。
   * 列が欠けたCSVを黙って取り込むと、資産が実際より少ないBSができる。
   */
  totalMismatchMonths?: string[];
  /**
   * committed=原本/canonical/cache/active pointerの確定完了。
   * kept=「前回を残す」指定により、件数が減る洗い替えを実行しなかった(既存データは無傷)。
   */
  status: 'committed' | 'failed' | 'duplicate' | 'kept';
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
): Pick<
  UnitResult,
  'counts' | 'rows' | 'skipped' | 'syntheticIds' | 'duplicateIds' | 'totalMismatchMonths'
> => {
  const parsedCounts = importCountSummary(unit, jsonMfTx);
  const counts = committed ? parsedCounts : { ...parsedCounts, stored: 0, countable: 0, nonCountable: 0 };
  const legacy = legacyImportCountAliases(unit, jsonMfTx);
  return {
    counts,
    ...legacy,
    syntheticIds: unit.kind === 'mf' ? unit.syntheticIds : undefined,
    duplicateIds: unit.kind === 'mf' ? unit.duplicateIds : undefined,
    totalMismatchMonths:
      unit.kind === 'assets' && unit.totalMismatchMonths.length ? unit.totalMismatchMonths : undefined,
  };
};

interface PreparedUnit {
  unit: ParsedUnit;
  contentHash: string | null;
  targetKeys: string[];
  restored: Dataset | null;
  /** 検証済みsource cash delta。cashEntriesを実復元するときだけ再加算する */
  cashProjectionRows: CashProjectionEnvelope['rows'];
  /** 復元する現金の記帳。移行先に記帳があるとき・JSON以外のunitでは空 */
  restoredCash: CashEntry[];
  /** MF取込と同じbatchへ入れる解決。非MFは未定義。 */
  resolution?: MfResolutionPlan;
}

interface PreparedFile {
  file: { name: string };
  buf: Uint8Array;
  units: PreparedUnit[];
}

const AUDIT_ATTRIBUTE = {
  cls: 'cls',
  big: 'category_major',
  mid: 'category_mid',
  owner: 'owner',
} as const;

/**
 * previewと同じ解決結果から、実際に採用した属性根拠だけを作る。
 * 3点比較はrule/vendorより後の最終判定なので、同一属性を上書きする。
 */
const resolutionAuditDecisions = (args: {
  incoming: Dataset['mfTx'];
  diff: ReturnType<typeof computeImportDiff>;
  requested: ResolutionRequest | null;
  fingerprint: string;
  data: Dataset;
  vendorMemories: ImportRestoreSettingsSnapshot['vendorMemories'];
}): MfResolutionAuditDecision[] => {
  const decisions = new Map<string, MfResolutionAuditDecision>();
  const rulesIdentity = canonicalEncode(args.data.rules);
  const matchedByIncoming = new Map(args.diff.matches.map((match) => [match.incomingTxId, match]));
  const attributes = ['cls', 'big', 'mid', 'owner'] as const;

  for (const tx of canonicalMfTransactions(args.incoming)) {
    const match = matchedByIncoming.get(tx.id);
    const manual = match?.edit && match.edit.origin !== 'vendor_memory' ? match.edit : null;
    const resolved = resolveIncomingTx(tx, args.data.rules, args.data.institutionOwners, args.vendorMemories);
    const withoutRules = resolveIncomingTx(tx, [], args.data.institutionOwners, args.vendorMemories);
    const withoutMemory = resolveIncomingTx(tx, args.data.rules, args.data.institutionOwners, []);
    for (const attribute of attributes) {
      const categoryEdited = !!manual?.categoryMajor || !!manual?.categoryMid;
      const manuallyDecided =
        (attribute === 'cls' && !!manual?.cls) ||
        ((attribute === 'big' || attribute === 'mid') && categoryEdited) ||
        (attribute === 'owner' && !!manual?.owner);
      // この属性の手動編集が有効なら、自動rule/vendorは最終根拠ではない。
      if (manuallyDecided) continue;
      const source = resolved.sources[attribute];
      if (source !== 'rules' && source !== 'vendor_memory') continue;
      const sourceType = source === 'rules' ? ('rule' as const) : ('vendor_memory' as const);
      const sourceIdentity =
        sourceType === 'rule' ? `${attribute}:${rulesIdentity}` : (resolved.vendorMemory?.vendorKey ?? '');
      if (!sourceIdentity) throw new ImportResolutionError('invalid_resolution');
      decisions.set(`${tx.id}\u0000${attribute}`, {
        txIdentity: tx.id,
        attribute: AUDIT_ATTRIBUTE[attribute],
        before: source === 'rules' ? withoutRules[attribute] : withoutMemory[attribute],
        after: resolved[attribute],
        reason: source === 'rules' ? 'rule_match' : 'vendor_memory_auto_apply',
        sourceType,
        sourceIdentity,
      });
    }
  }

  const requestedByTxId = new Map<string, 'keep' | 'incoming'>();
  for (const row of args.requested?.decisions ?? [])
    for (const txId of row.txIds) requestedByTxId.set(txId, row.choice);
  for (const conflict of args.diff.conflicts) {
    const match = args.diff.matches.find((row) => row.existingTxId === conflict.txId);
    if (!match) throw new ImportResolutionError('invalid_resolution');
    const explicitChoice = requestedByTxId.get(conflict.txId);
    const choice = explicitChoice ?? 'keep';
    for (const [attribute, values] of Object.entries(conflict.attrs) as Array<
      [keyof typeof AUDIT_ATTRIBUTE, { current: string | null; incoming: string | null }]
    >) {
      decisions.set(`${match.incomingTxId}\u0000${attribute}`, {
        txIdentity: match.incomingTxId,
        attribute: AUDIT_ATTRIBUTE[attribute],
        before: values.current,
        after: choice === 'incoming' ? values.incoming : values.current,
        reason: explicitChoice ? `three_way_${choice}` : 'three_way_keep_default',
        sourceType: explicitChoice ? 'user_resolution' : 'system',
        sourceIdentity: explicitChoice ? args.fingerprint : undefined,
      });
    }
  }
  return [...decisions.values()].sort(
    (a, b) => a.txIdentity.localeCompare(b.txIdentity) || a.attribute.localeCompare(b.attribute),
  );
};

/** previewと同じ全MF unitを1度だけ解決し、各commit unitへ配る。 */
async function attachMfResolutionPlans(
  preparedFiles: PreparedFile[],
  data: Dataset,
  requested: ResolutionRequest | null,
  vendorMemories: ImportRestoreSettingsSnapshot['vendorMemories'],
): Promise<{
  fingerprint: string | null;
  reset: number;
  remembered: number;
  learned: number;
  autoApplied: number;
  candidates: number;
}> {
  const preparedMf = preparedFiles.flatMap((file) => file.units).filter((item) => item.unit.kind === 'mf');
  if (!preparedMf.length) {
    if (requested) throw new ImportResolutionError('invalid_resolution');
    return { fingerprint: null, reset: 0, remembered: 0, learned: 0, autoApplied: 0, candidates: 0 };
  }
  const incoming = preparedMf.flatMap((item) => (item.unit.kind === 'mf' ? item.unit.txs : []));
  const months = [
    ...new Set(preparedMf.flatMap((item) => (item.unit.kind === 'mf' ? item.unit.months : []))),
  ].sort();
  const baseline = diffBaselineFromDataset(data);
  const diff = computeImportDiff({
    incoming,
    months,
    ...baseline,
    rules: data.rules,
    institutionOwners: data.institutionOwners,
    vendorMemories,
  });
  const fingerprint = await importResolutionFingerprint(
    preparedMf.map((item) => item.contentHash ?? ''),
    diff,
  );
  if (requested && requested.fingerprint !== fingerprint)
    throw new ImportResolutionError('resolution_scope_changed');

  const conflictIds = new Set(diff.conflicts.map((row) => row.txId));
  const choiceByTxId = new Map<string, 'keep' | 'incoming'>();
  for (const decision of requested?.decisions ?? []) {
    for (const txId of decision.txIds) {
      if (!conflictIds.has(txId) || choiceByTxId.has(txId))
        throw new ImportResolutionError('invalid_resolution');
      choiceByTxId.set(txId, decision.choice);
    }
  }
  const incomingById = new Map(canonicalMfTransactions(incoming).map((tx) => [tx.id, tx]));
  const backfillByTxId = new Map(diff.backfill.map((row) => [row.txId, row]));
  const rows = diff.matches
    .filter((match) => match.edit !== null)
    .map((match) => {
      const tx = incomingById.get(match.incomingTxId);
      if (!tx) throw new ImportResolutionError('invalid_resolution');
      const planned = backfillByTxId.get(match.existingTxId);
      return {
        existingTxId: match.existingTxId,
        incomingTxId: match.incomingTxId,
        // 自動適用行は手動編集ではない。毎回いったん外し、今回のrules/memory計画から作り直す。
        choice:
          match.edit?.origin === 'vendor_memory'
            ? ('incoming' as const)
            : (choiceByTxId.get(match.existingTxId) ?? ('keep' as const)),
        baseCls: planned ? planned.baseCls : (match.edit?.baseCls ?? null),
        baseOwner: planned ? planned.baseOwner : (match.edit?.baseOwner ?? null),
        baseMajor: planned ? planned.baseMajor : (match.edit?.baseMajor ?? tx.big),
        baseMid: planned ? planned.baseMid : (match.edit?.baseMid ?? tx.mid),
        baseKnown:
          planned?.baseKnown ??
          normalizeBaseKnown(match.edit?.baseKnown, {
            cls: match.edit?.baseCls,
            big: match.edit?.baseMajor,
            mid: match.edit?.baseMid,
            owner: match.edit?.baseOwner,
          }),
        stableKey: match.stableKey,
      };
    });
  const memories = (requested?.decisions ?? [])
    .filter((decision) => decision.remember)
    .map((decision) => {
      if (!decision.vendorKey || !decision.vendorLabel || !decision.memoryValue)
        throw new ImportResolutionError('invalid_resolution');
      return {
        vendorKey: normalizeVendorKey(decision.vendorKey),
        vendorLabel: decision.vendorLabel,
        ...decision.memoryValue,
      };
    });
  const memoryByKey = new Map(memories.map((row) => [row.vendorKey, row]));
  const auditDecisions = resolutionAuditDecisions({
    incoming,
    diff,
    requested,
    fingerprint,
    data,
    vendorMemories,
  });
  const firstMf = preparedMf[0];
  for (const prepared of preparedMf) {
    const ids = new Set(
      prepared.unit.kind === 'mf' ? canonicalMfTransactions(prepared.unit.txs).map((tx) => tx.id) : [],
    );
    prepared.resolution = {
      edits: rows.filter((row) => ids.has(row.incomingTxId)),
      autoEdits: diff.autoApply.filter((row) => ids.has(row.txId)),
      memories: prepared === firstMf ? [...memoryByKey.values()] : [],
      auditDecisions: auditDecisions.filter((row) => ids.has(row.txIdentity)),
    };
  }
  return {
    fingerprint,
    reset: rows.filter(
      (row) =>
        row.choice === 'incoming' &&
        diff.matches.find((match) => match.existingTxId === row.existingTxId)?.edit?.origin !==
          'vendor_memory',
    ).length,
    remembered: memoryByKey.size,
    learned: memoryByKey.size,
    autoApplied: diff.autoApply.length,
    candidates: diff.vendorCandidates.length,
  };
}

const runtimeFailureReason = '内部処理を完了できませんでした。同じファイルでそのまま再試行できます';
const r2FailureReason = '原本ファイルを保存できませんでした。同じファイルで再試行してください';

const currentCashEdits = (data: Dataset, entries: CashEntry[]): Dataset['edits'] => {
  const ids = new Set(entries.map((entry) => cashTxId(entry.id)));
  return Object.fromEntries(Object.entries(data.edits).filter(([txId]) => ids.has(txId)));
};

const withoutCashEdits = (edits: Dataset['edits']): Dataset['edits'] =>
  Object.fromEntries(Object.entries(edits).filter(([txId]) => !isCashTxId(txId)));

/** 確定用candidateにもDB batchと同じ手当て移動/解除を先に適用する。 */
const applyMfResolution = (data: Dataset, plan: MfResolutionPlan | undefined): void => {
  for (const row of plan?.edits ?? []) {
    const current = data.edits[row.existingTxId];
    if (row.choice === 'incoming') {
      delete data.edits[row.existingTxId];
      continue;
    }
    if (!current) continue;
    if (row.existingTxId !== row.incomingTxId) delete data.edits[row.existingTxId];
    const known = normalizeBaseKnown(current.baseKnown, {
      cls: current.baseCls,
      big: current.baseBig,
      mid: current.baseMid,
      owner: current.baseOwner,
    });
    data.edits[row.incomingTxId] = {
      ...current,
      baseCls:
        (known & TX_EDIT_BASE_BITS.cls) !== 0
          ? current.baseCls
          : (row.baseCls as Dataset['edits'][string]['baseCls']),
      baseOwner:
        (known & TX_EDIT_BASE_BITS.owner) !== 0
          ? current.baseOwner
          : (row.baseOwner as Dataset['edits'][string]['baseOwner']),
      baseBig: (known & TX_EDIT_BASE_BITS.big) !== 0 ? current.baseBig : row.baseMajor,
      baseMid: (known & TX_EDIT_BASE_BITS.mid) !== 0 ? current.baseMid : row.baseMid,
      baseKnown: row.baseKnown,
      stableKey: row.stableKey,
      fingerprintVersion: 1,
    };
  }
  for (const row of plan?.autoEdits ?? []) {
    // 手動行は常に強い。plan側でも除外しているが、candidate投影でも二重に守る。
    if (data.edits[row.txId]) continue;
    data.edits[row.txId] = {
      cls: row.cls as Dataset['edits'][string]['cls'],
      big: row.big,
      mid: row.mid,
      owner: row.owner as Dataset['edits'][string]['owner'],
      stableKey: row.stableKey,
      fingerprintVersion: 1,
      origin: 'vendor_memory',
      originKey: row.vendorKey,
    };
  }
};

/**
 * source cash editを破棄し、destination cash editを戻した単一candidateから全派生物を作る。
 * ただし現金の記帳ごと復元する場合は、記帳もその手動判定もsource側が正本になる。
 */
const prepareJsonApplication = async (args: {
  userId: string;
  data: Dataset;
  restored: Dataset;
  json: Record<string, unknown>;
  cashEntries: CashEntry[];
  freeeDeals: FreeeDeal[];
  destinationSettings: ImportRestoreSettingsSnapshot;
  cashProjectionRows: CashProjectionEnvelope['rows'];
  /** 復元する現金の記帳(移行先が空のときだけ非空) */
  restoredCashEntries?: CashEntry[];
}): Promise<{
  candidate: Dataset;
  writeSet: ReturnType<typeof prepareRestoreWriteSet>;
  contentHash: string;
}> => {
  const candidate = structuredClone(args.data);
  // 現金を復元する場合、記帳の正本はバックアップ側になる。手動判定もその記帳に付いていたものを採る
  const restoringCash = args.restoredCashEntries !== undefined && args.restoredCashEntries.length > 0;
  const effectiveCash = restoringCash ? (args.restoredCashEntries ?? []) : args.cashEntries;
  const restoreSettings = resolveRestoreSettings(args.json, args.destinationSettings);
  const subscriptionState = resolveRestoreSubscriptionState(args.json);
  const reviewState = resolveRestoreReviewState(args.json);
  const destinationCashEdits = restoringCash ? {} : currentCashEdits(candidate, args.cashEntries);
  const destinationVendors = args.destinationSettings.subVendors;
  // importJSON assigns the aggregate maps from its input by reference. The same
  // restore unit is prepared during planning, runtime validation, and execution,
  // so mutating those maps would make each pass inflate the next one. Clone the
  // source and rebuild derived aggregates from the authoritative raw sources.
  // 旧snapshotにtxSplitsが無い場合も、移行先の現在値を残さずcanonical集合を空へ置換する。
  candidate.txSplits = [];
  importJSON(candidate, structuredClone(args.json));
  const sourceVendorNames = new Set(candidate.subs.vendors);
  if (
    subscriptionState.metadata &&
    (subscriptionState.metadata.length !== sourceVendorNames.size ||
      subscriptionState.metadata.some((row) => !sourceVendorNames.has(row.name)))
  ) {
    throw new InvalidRestoreSettingsError();
  }
  const sourceVendorKeys = new Set(candidate.subs.vendors.map(vendorKey));
  if (subscriptionState.decisions?.some((row) => !sourceVendorKeys.has(row.vendorKey))) {
    throw new InvalidRestoreSettingsError();
  }
  // JSON restoreは初期移行。sourceの同名設定を優先しつつ、移行先だけの登録を削除しない。
  for (const vendor of destinationVendors) {
    if (candidate.subs.vendors.includes(vendor.name)) continue;
    candidate.subs.vendors.push(vendor.name);
    candidate.subs.aliases[vendor.name] = vendor.aliases;
    candidate.subs.accounts ??= {};
    candidate.subs.accounts[vendor.name] = vendor.accounts ?? [];
    candidate.subs.matrix[vendor.name] = candidate.months.map(() => 0);
  }
  const metadataByName = new Map(
    destinationVendors.map((vendor) => [
      vendor.name,
      { name: vendor.name, category: vendor.category, reviewedAt: vendor.reviewedAt },
    ]),
  );
  for (const metadata of subscriptionState.metadata ?? []) metadataByName.set(metadata.name, metadata);
  const mergedSubVendorMetadata = candidate.subs.vendors.map(
    (name): RestoreSubVendorMetadata =>
      metadataByName.get(name) ?? { name, category: null, reviewedAt: null },
  );
  candidate.personal = {};
  candidate.bizPersonal = {};
  candidate.personalByOwner = {};
  // 復元する記帳に対応する手動判定だけを残す。宛先の無い cash edit は持ち込まない
  const restoredCashEdits = restoringCash
    ? currentCashEdits(candidate, args.restoredCashEntries ?? [])
    : destinationCashEdits;
  candidate.edits = { ...withoutCashEdits(candidate.edits), ...restoredCashEdits };
  mergeRestoreCanonicalSources({
    data: candidate,
    restored: args.restored,
    freeeDeals: args.freeeDeals,
    // sourceのcash deltaはsourceで確定済み。destination設定では再投影しない。
    cashEntries: restoringCash ? [] : effectiveCash,
    normMap: restoringCash ? restoreSettings.normMap : args.destinationSettings.normMap,
  });
  if (restoringCash) addCashProjection(candidate, args.cashProjectionRows);
  if (validateTxSplitsForDataset(candidate).length > 0) throw new TxSplitsSnapshotError();
  const accounting = projectAccountingDataset(candidate);
  const writeSet = prepareRestoreWriteSet({
    userId: args.userId,
    data: candidate,
    accountingData: accounting,
    restored: args.restored,
    statMinMonths: restoreSettings.statMinMonths,
    subVendorExclusions: restoreSettings.subVendorExclusions,
    existingStatMinMonths: args.destinationSettings.statMinMonths,
    existingSubVendorExclusions: args.destinationSettings.subVendorExclusions,
    subVendorMetadata: mergedSubVendorMetadata,
    subVendorReviewDecisions: subscriptionState.decisions,
    restoredCashEntries: restoringCash ? args.restoredCashEntries : undefined,
    reviewSnoozes: reviewState.reviewSnoozes,
    monthlyCloseReviews: reviewState.monthlyCloseReviews,
    duplicateVerdicts: reviewState.duplicateVerdicts,
    freeeDealExclusions: reviewState.freeeDealExclusions,
    totalCashflowOperations: reviewState.totalCashflowOperations,
    existingDestinationRowCounts: args.destinationSettings.destinationRowCounts,
  });
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
  restoreSettings: ImportRestoreSettingsSnapshot;
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
        destinationSettings: args.restoreSettings,
        cashProjectionRows: prepared.cashProjectionRows,
        restoredCashEntries: prepared.restoredCash,
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

    if (unit.kind === 'assets') {
      // 残高は Dataset(収支)を一切変えない。候補データを作り直す必要がない
      counts.push(
        assetsCommitStatements({
          database: args.database,
          userId: args.userId,
          runId,
          balances: unit.balances,
          months: unit.months,
          importId,
          contentHash: prepared.contentHash ?? 'query-plan',
          targetKeys: prepared.targetKeys,
        }).length,
      );
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
          data: projectAccountingDataset(candidate),
        }).length,
      );
    } else if (unit.kind === 'mf') {
      const txs = canonicalMfTransactions(unit.txs);
      applyMfResolution(candidate, prepared.resolution);
      applyMfTxs(candidate, txs);
      const now = new Date().toISOString();
      const audit = await buildMfResolutionAuditStatements({
        database: args.database,
        userId: args.userId,
        runId,
        importId,
        resolution: prepared.resolution,
        occurredAt: now,
      });
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
          data: projectAccountingDataset(candidate),
          resolution: prepared.resolution,
          audit,
          now,
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
  restoreSettings: ImportRestoreSettingsSnapshot;
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
      destinationSettings: args.restoreSettings,
      cashProjectionRows: prepared.cashProjectionRows,
      restoredCashEntries: prepared.restoredCash,
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
        data: projectAccountingDataset(candidate),
      });
    } else if (unit.kind === 'assets') {
      statements = assetsCommitStatements({
        database,
        userId,
        runId,
        balances: unit.balances,
        months: unit.months,
        importId: attemptId,
        contentHash,
        targetKeys: prepared.targetKeys,
      });
    } else if (unit.kind === 'mf') {
      const canonicalTxs = canonicalMfTransactions(unit.txs);
      applyMfResolution(candidate, prepared.resolution);
      applyMfTxs(candidate, canonicalTxs);
      const now = new Date().toISOString();
      const audit = await buildMfResolutionAuditStatements({
        database,
        userId,
        runId,
        importId: attemptId,
        resolution: prepared.resolution,
        occurredAt: now,
      });
      statements = mfCommitStatements({
        database,
        userId,
        runId,
        txs: canonicalTxs,
        months: unit.months,
        importId: attemptId,
        contentHash,
        targetKeys: prepared.targetKeys,
        data: projectAccountingDataset(candidate),
        resolution: prepared.resolution,
        audit,
        now,
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

/*
 * 旧来の 1 要求で検査と確定をまとめる互換経路。新しい取込画面は使わず、ローカル seed・互換利用・
 * 既存 API テストのために残す。本文の上限とファイル数・合計の上限は新経路と同じ値を掛ける。
 * 互換経路も新経路と同じ確定レート制限で保護する。廃止判断だけを backlog で追跡する。
 */
importsRoute.post(
  '/imports',
  importRateLimit('commit'),
  (c, next) => importUploadBodyLimit(c, next),
  async (c) => {
    const form = await c.req.formData();
    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (!files.length) {
      return c.json({ error: { code: 'no_file', message: 'ファイルが指定されていません' } }, 400);
    }

    // 「同じ内容でも取り込み直す」チェック。既定は重複をスキップする
    const force = form.get('force') === '1';
    // 「件数が減る取込は実行せず、前回の内容を残す」チェック。月の途中までのファイルを掴んだときの安全弁
    const keepOnShrink = form.get('keepOnShrink') === '1';
    let requestedResolution: ResolutionRequest | null = null;
    const resolutionRaw = form.get('resolutionPlan');
    if (resolutionRaw !== null) {
      if (typeof resolutionRaw !== 'string')
        return c.json({ error: { code: 'invalid_resolution', message: '取込の解決内容が不正です' } }, 400);
      try {
        const parsed = resolutionRequestSchema.safeParse(JSON.parse(resolutionRaw));
        if (!parsed.success)
          return c.json({ error: { code: 'invalid_resolution', message: '取込の解決内容が不正です' } }, 400);
        requestedResolution = parsed.data;
      } catch {
        return c.json({ error: { code: 'invalid_resolution', message: '取込の解決内容が不正です' } }, 400);
      }
    }
    // ファイル数と合計は core の共通判定で断る。1 ファイルの超過は旧来の code (file_too_large) のまま下で返す
    const violation = importLimitViolation({
      files: files.map((file) => ({ name: file.name, size: file.size })),
    });
    if (violation && violation.kind !== 'file') return payloadTooLarge(c, violation.reason);
    const bufferedFiles: BufferedImportFile[] = [];
    for (const file of files) {
      if (file.size > IMPORT_LIMITS.maxFileBytes) {
        return c.json(
          {
            error: {
              code: 'file_too_large',
              message: `1ファイルは${importLimitsFileText()}以下にしてください`,
            },
          },
          413,
        );
      }
      bufferedFiles.push({ file: { name: file.name }, buf: new Uint8Array(await file.arrayBuffer()) });
    }
    return runMultipartImport(c, {
      files: bufferedFiles,
      force,
      keepOnShrink,
      keepPrevious: false,
      requestedResolution,
    });
  },
);

/** 取込1件ぶんの入力。multipart と検査の保管 (R2) のどちらから来ても同じ形にする */
export interface BufferedImportFile {
  file: { name: string };
  buf: Uint8Array;
}

/** 取込で増えた件数・既存と同じで足さなかった件数・サブスク候補の増分 */
export interface ImportImpact {
  added: number;
  skipped: number;
  subsCandidates: number;
}

const importLimitsFileText = (): string => `${IMPORT_LIMITS.maxFileBytes / IMPORT_MB}MB`;

/**
 * 「前回データを残す」: 取込先の月にある既存の行を残し、無い行だけを足す。
 * 洗い替えの前に unit の中身を「既存 ∪ 新規」に差し替えるため、後段の確定経路は変えない。
 * 同一性は MF が stable_key と tx_id、freee が内容の鍵 (同じ内容の行は出現順の番号付き)。
 */
function keepPreviousUnion(
  unit: ParsedUnit,
  data: Dataset,
  freeeDeals: FreeeDeal[],
): { unit: ParsedUnit; added: number; skipped: number } {
  if (unit.kind === 'mf') {
    const months = new Set(unit.months);
    const existing = data.mfTx.filter((tx) => months.has(tx.m) && !isCashTxId(tx.id));
    const keys = new Set(existing.map((tx) => mfStableKey(tx)));
    const ids = new Set(existing.map((tx) => tx.id));
    const fresh = unit.txs.filter((tx) => !keys.has(mfStableKey(tx)) && !ids.has(tx.id));
    const txs = [...existing, ...fresh];
    return {
      unit: { ...unit, txs, rows: txs.length },
      added: fresh.length,
      skipped: unit.txs.length - fresh.length,
    };
  }
  if (unit.kind === 'freee') {
    const months = new Set(unit.months);
    const existing = freeeDeals.filter((deal) => months.has(deal.month));
    const keys = new Set(freeeDealKeys(existing));
    const incomingKeys = freeeDealKeys(unit.deals);
    const fresh = unit.deals.filter((_, i) => !keys.has(incomingKeys[i]));
    const deals = [...existing, ...fresh];
    return {
      unit: { ...unit, deals, rows: deals.length },
      added: fresh.length,
      skipped: unit.deals.length - fresh.length,
    };
  }
  return { unit, added: unit.kind === 'error' || unit.kind === 'json' ? 0 : unit.rows, skipped: 0 };
}

/** サブスク候補に挙がる支払先の集合。取込の前後で比べ、新しく現れた数を影響として返す */
const subsCandidatePartners = (
  data: Dataset,
  deals: FreeeDeal[],
  settings: ImportRestoreSettingsSnapshot,
): Set<string> =>
  new Set(
    subsCandidates(
      sourceNeutralSubscriptionDeals(data, deals),
      settings.subVendors,
      20,
      settings.subVendorExclusions.map((e) => e.partner),
    ).map((candidate) => vendorKey(candidate.partner)),
  );

/**
 * POST /imports と検査を経た確定 (POST /imports/runs) が共有する取込本体。
 * 返すのは Response。前者はそのまま返し、後者は本文を読んで画面向けの形へ詰め替える。
 */
export async function runMultipartImport(
  c: Context<Ctx>,
  input: {
    files: BufferedImportFile[];
    force: boolean;
    keepOnShrink: boolean;
    keepPrevious: boolean;
    requestedResolution: ResolutionRequest | null;
    /** 呼び出し側 (検査の読み込み・レート制限・run の件数更新) が同じ invocation で使う query 数 */
    extraQueries?: number;
    /** 採番済みの run ID。検査を経る経路は先に決めて staging の片付けに使う */
    runId?: string;
  },
): Promise<Response> {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { files: bufferedFiles, force, keepOnShrink, keepPrevious, requestedResolution } = input;
  // claim自体は期限付きのephemeral coordinationであり、受理前にrun/R2/canonicalは作らない。
  const runId = input.runId ?? crypto.randomUUID();
  if (!(await acquireImportWriter(c.env.DB, userId, runId))) {
    return c.json(
      { error: { code: 'import_busy', message: '別の取込処理が進行中です。完了後に再試行してください' } },
      409,
    );
  }

  let preparedFiles: PreparedFile[] = [];
  // 「前回を残す」で実行しなかったunit。runにもR2にも載せないため、ここで結果だけ持つ
  const keptResults: UnitResult[] = [];
  let normMap: Record<string, string> = {};
  let restoreSettings: ImportRestoreSettingsSnapshot = {
    normMap: {},
    statMinMonths: DEFAULT_STAT_MIN_MONTHS,
    subVendorExclusions: [],
    subVendors: [],
    subVendorReviewDecisions: [],
    cashEntries: [],
    freeeDeals: [],
    txSplits: [],
    vendorMemories: [],
    destinationRowCounts: {
      subVendorReviewDecisions: 0,
      reviewSnoozes: 0,
      monthlyCloseReviews: 0,
      duplicateVerdicts: 0,
      freeeDealExclusions: 0,
      totalCashflowOperations: 0,
      rules: 0,
      txEdits: 0,
      institutionOwners: 0,
      budgets: 0,
      cashOverrides: 0,
    },
  };
  let cashEntries: CashEntry[] = [];
  let data = emptyDataset();
  let freeeCount = new Map<string, number>();
  let freeeDeals: FreeeDeal[] = [];
  let mfCount = new Map<string, number>();
  let commitStatementCounts: number[] = [];
  let queryPlan: ReturnType<typeof planMultipartImportQueries> | null = null;
  let resolutionSummary = {
    fingerprint: null as string | null,
    reset: 0,
    remembered: 0,
    learned: 0,
    autoApplied: 0,
    candidates: 0,
  };
  let preflightAccepted = false;
  const impact: ImportImpact = { added: 0, skipped: 0, subsCandidates: 0 };
  let subsBefore = new Set<string>();
  try {
    // writer claim取得後のsnapshotだけを、計画と実行の双方で共有する。
    restoreSettings = await loadImportRestoreSettingsSnapshot(db, userId);
    normMap = restoreSettings.normMap;
    for (const { file, buf } of bufferedFiles) {
      const units = parseUpload(file.name, buf, normMap);
      const preparedUnits: PreparedUnit[] = [];
      for (const unit of units) {
        const restoredSnapshot = unit.kind === 'json' ? restoredWithoutCashProjection(unit.json) : null;
        if (unit.kind === 'json' && !restoredSnapshot) return c.json(badCashProjection, 400);
        preparedUnits.push({
          unit,
          contentHash: unit.kind === 'json' ? null : await unitFingerprint(unit),
          targetKeys: targetKeysForUnit(unit),
          restored: restoredSnapshot?.data ?? null,
          cashProjectionRows: restoredSnapshot?.projectionRows ?? [],
          // 移行先の記帳を読むのはこの後。復元対象は下でまとめて決める
          restoredCash: [],
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

    cashEntries = restoreSettings.cashEntries;
    // 現金の記帳ごと復元するのは、移行先に記帳が1件も無いときだけ(初期移行)
    for (const prepared of preparedFiles.flatMap((preparedFile) => preparedFile.units)) {
      if (prepared.unit.kind === 'json') {
        prepared.restoredCash = restorableCashEntries(prepared.unit.json, cashEntries);
      }
    }
    data = await loadDataset(db, userId, cashEntries, { withSplits: false });
    data.txSplits = restoreSettings.txSplits;
    freeeDeals = restoreSettings.freeeDeals;
    freeeCount = new Map<string, number>();
    for (const deal of freeeDeals) {
      freeeCount.set(deal.month, (freeeCount.get(deal.month) ?? 0) + 1);
    }
    mfCount = new Map<string, number>();
    for (const tx of data.mfTx) {
      if (!isCashTxId(tx.id)) mfCount.set(tx.m, (mfCount.get(tx.m) ?? 0) + 1);
    }
    if (keepPrevious) {
      subsBefore = subsCandidatePartners(data, freeeDeals, restoreSettings);
      for (const preparedFile of preparedFiles) {
        for (const prepared of preparedFile.units) {
          const merged = keepPreviousUnion(prepared.unit, data, freeeDeals);
          prepared.unit = merged.unit;
          impact.added += merged.added;
          impact.skipped += merged.skipped;
        }
      }
    } else {
      for (const unit of preparedFiles.flatMap((file) => file.units)) {
        if (unit.unit.kind !== 'error' && unit.unit.kind !== 'json') impact.added += unit.unit.rows;
      }
    }
    if (keepOnShrink) {
      // 実行前に判定する。洗い替えは月単位でDELETEしてから入れ直すため、実行後に「前回を残す」ことはできない
      for (const preparedFile of preparedFiles) {
        preparedFile.units = preparedFile.units.filter((prepared) => {
          const unit = prepared.unit;
          if (unit.kind !== 'freee' && unit.kind !== 'mf') return true;
          const after = new Map<string, number>();
          if (unit.kind === 'freee') {
            for (const deal of unit.deals) after.set(deal.month, (after.get(deal.month) ?? 0) + 1);
          } else {
            for (const tx of canonicalMfTransactions(unit.txs)) after.set(tx.m, (after.get(tx.m) ?? 0) + 1);
          }
          const shrink = shrinkingMonths(unit.months, unit.kind === 'freee' ? freeeCount : mfCount, after);
          if (!shrink.length) return true;
          keptResults.push({
            filename: unit.filename,
            kind: unit.kind,
            months: unit.months,
            // 見送りは1行も確定しないため、失敗・重複と同じく保存側の件数は0で返す
            ...unitCountFields(unit, false),
            status: 'kept',
            reason: `件数が減るため取り込みませんでした(${shrink
              .map((m) => `${m.month}: ${m.before}件 → ${m.after}件`)
              .join(' / ')})。前回の内容はそのまま残っています`,
            replaced: shrink,
          });
          return false;
        });
      }
      preparedFiles = preparedFiles.filter((preparedFile) => preparedFile.units.length > 0);
      // 全部を見送ったならrunもR2も作らない。writer claimは finally が解放する
      if (!preparedFiles.length) return c.json({ results: keptResults });
    }
    resolutionSummary = await attachMfResolutionPlans(
      preparedFiles,
      data,
      requestedResolution,
      restoreSettings.vendorMemories,
    );
    commitStatementCounts = await planCommitStatementCounts({
      database: c.env.DB,
      userId,
      preparedFiles,
      data,
      cashEntries,
      normMap,
      restoreSettings,
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
      extraQueries: input.extraQueries,
    });
    if (!queryPlan.accepted) return c.json(queryBudgetError(queryPlan.total), 413);
    preflightAccepted = true;
  } catch (error) {
    if (error instanceof OwnerValidationError) return c.json(badOwner, 400);
    if (error instanceof TxSplitsSnapshotError) return c.json(badTxSplits, 400);
    if (error instanceof InvalidRestoreSettingsError) return c.json(badRestoreSettings, 400);
    if (error instanceof ImportResolutionError)
      return c.json(
        {
          error: {
            code: error.code,
            message:
              error.code === 'resolution_scope_changed'
                ? '差分を確認した後に取込対象が変わりました。もう一度差分を確認してください'
                : '取込の解決内容が差分と一致しません',
          },
        },
        error.code === 'resolution_scope_changed' ? 409 : 400,
      );
    if (error instanceof AuditValidationError)
      return c.json(
        {
          error: {
            code: 'invalid_audit_resolution',
            message: '判定履歴として安全に保存できない属性値があるため、取込を中止しました',
          },
        },
        400,
      );
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
      restoreSettings,
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
          restoreSettings,
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
  if (keepPrevious) {
    // 確定した freee unit の月は、差し替え後の取引で置き換えた一覧で数え直す (追加の query は使わない)
    const committedFreee = preparedFiles
      .flatMap((file) => file.units)
      .map((prepared) => prepared.unit)
      .filter(
        (unit): unit is Extract<ParsedUnit, { kind: 'freee' }> =>
          unit.kind === 'freee' &&
          results.some((result) => result.filename === unit.filename && result.status === 'committed'),
      );
    const replacedMonths = new Set(committedFreee.flatMap((unit) => unit.months));
    const afterDeals = [
      ...freeeDeals.filter((deal) => !replacedMonths.has(deal.month)),
      ...committedFreee.flatMap((unit) => unit.deals),
    ];
    const subsAfter = subsCandidatePartners(data, afterDeals, restoreSettings);
    impact.subsCandidates = [...subsAfter].filter((key) => !subsBefore.has(key)).length;
  }
  // 見送ったunitも画面には出す。実行した分と混ざらないよう、順序は「実行→見送り」で固定する
  const all = [...results, ...keptResults];
  const ok = all.some((result) => result.status === 'committed');
  // 全件が重複スキップ/見送りなら「失敗」ではなく正常終了として 200 で返す(何も壊していない)
  const allSkipped =
    all.length > 0 && all.every((result) => result.status === 'duplicate' || result.status === 'kept');
  return c.json(
    { runId, results: all, ok, queryPlan, resolution: resolutionSummary, impact },
    ok || allSkipped ? 200 : 400,
  );
}

/** imports.target_keys は JSON 文字列。壊れていても履歴一覧を落とさず、対象キー不明として扱う */
function parseTargetKeys(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 取込ごとの「いま何を所有し、何から参照されているか」。履歴の状態 (有効・置き換え・取り消し済み) と
 * 取り消し・破棄の入口は、状態名ではなくこの数から導く。ファイル単位の一覧と取込 1 回の一覧で共有する。
 */
async function loadImportOwnership(database: D1Database, userId: string) {
  const activeRows = await getDb(database)
    .select({ importId: s.importActiveTargets.importId, targetKey: s.importActiveTargets.targetKey })
    .from(s.importActiveTargets)
    .where(eq(s.importActiveTargets.userId, userId));
  const activeCounts = new Map<number, number>();
  // 「置き換わった」と「消した」を分けるには、この取込の所有数だけでなく
  // 誰かが所有している対象キーの全体集合が要る
  const ownedTargetKeys = new Set<string>();
  for (const row of activeRows) {
    activeCounts.set(row.importId, (activeCounts.get(row.importId) ?? 0) + 1);
    ownedTargetKeys.add(row.targetKey);
  }
  const protectedReferences = await database
    .prepare(
      `SELECT import_id,SUM(canonical_rows) AS canonical_rows,SUM(undo_snapshots) AS undo_snapshots
       FROM (
         SELECT import_id,COUNT(*) AS canonical_rows,0 AS undo_snapshots
           FROM mf_transactions WHERE user_id=? AND import_id IS NOT NULL GROUP BY import_id
         UNION ALL
         SELECT import_id,COUNT(*),0
           FROM freee_deals WHERE user_id=? AND import_id IS NOT NULL GROUP BY import_id
         UNION ALL
         SELECT import_id,0,COUNT(*)
           FROM import_deleted_targets WHERE user_id=? GROUP BY import_id
         UNION ALL
         SELECT CAST(json_extract(payload_json,'$.import_id') AS INTEGER),0,COUNT(*)
           FROM import_deleted_rows
          WHERE user_id=? AND json_valid(payload_json)
            AND json_extract(payload_json,'$.import_id') IS NOT NULL
          GROUP BY CAST(json_extract(payload_json,'$.import_id') AS INTEGER)
       )
      GROUP BY import_id`,
    )
    .bind(userId, userId, userId, userId)
    .all<{ import_id: number; canonical_rows: number; undo_snapshots: number }>();
  const protectedCounts = new Map(protectedReferences.results.map((row) => [row.import_id, row] as const));
  return { activeCounts, ownedTargetKeys, protectedCounts };
}

type ImportOwnership = Awaited<ReturnType<typeof loadImportOwnership>>;

/** 1 取込の状態と、取り消し・破棄の入口。 */
function importLifecycleView(
  r: { id: number; status: string | null; targetKeys: string | null },
  ownership: ImportOwnership,
) {
  const activeTargetCount = ownership.activeCounts.get(r.id) ?? 0;
  const canonicalRowCount = Number(ownership.protectedCounts.get(r.id)?.canonical_rows ?? 0);
  return {
    generationState: importGenerationState({
      status: r.status as never,
      targetKeys: parseTargetKeys(r.targetKeys),
      ownTargetCount: activeTargetCount,
      ownedTargetKeys: ownership.ownedTargetKeys,
      canonicalRowCount,
    }),
    cancelable: importHistoryCancelable({ status: r.status as never, activeTargetCount, canonicalRowCount }),
    discardable:
      importHistoryDiscardBlock({
        status: r.status as never,
        activeTargetCount,
        canonicalRowCount,
        undoSnapshotCount: Number(ownership.protectedCounts.get(r.id)?.undo_snapshots ?? 0),
      }) === null,
  };
}

importsRoute.get('/imports', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.imports)
    .where(eq(s.imports.userId, userId))
    .orderBy(desc(s.imports.id))
    .limit(100);
  const ownership = await loadImportOwnership(c.env.DB, userId);
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
      ...importLifecycleView(r, ownership),
      createdAt: r.createdAt,
      committedAt: r.committedAt ?? null,
      // 投入した原本をR2へ保存できた取込だけ、やり直し(再取込)の入口を出せる。
      // ここはkeyの有無しか見ない(100行ぶんHEADを打つのは割に合わない)。実在確認は原本取得時に行う。
      originalRecorded: r.r2Key !== null,
    })),
  });
});

/** R2に残る投入原本をそのまま返す。画面はこれを取込枠へ戻し、通常の取込と同じ確認・経路で流す */
importsRoute.get('/imports/:id/original', async (c) => {
  const userId = c.get('userId');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0)
    return c.json({ error: { code: 'invalid_input', message: '取込履歴が見つかりません' } }, 400);
  const [row] = await getDb(c.env.DB)
    .select()
    .from(s.imports)
    .where(and(eq(s.imports.userId, userId), eq(s.imports.id, id)));
  if (!row) return c.json({ error: { code: 'not_found', message: '取込履歴が見つかりません' } }, 404);
  if (!row.r2Key)
    return c.json(
      {
        error: {
          code: 'import_original_not_recorded',
          message: 'この取込は原本を保存していないため、やり直せません',
        },
      },
      404,
    );
  const object = await c.env.FILES.get(row.r2Key);
  if (!object)
    return c.json(
      {
        error: {
          code: 'import_original_missing',
          message: '取込の原本が保管先に見つかりません。同じファイルを選び直してください',
        },
      },
      404,
    );
  // ZIPの中身は `zip名/中身名` で1行ずつ残るが、原本は投入したファイルそのもの。先頭だけを名前にする
  const filename = (row.filename ?? 'import').split('/')[0] || 'import';
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
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
  let restoredSnapshot: { data: Dataset; projectionRows: CashProjectionEnvelope['rows'] } | null;
  try {
    restoredSnapshot = restoredWithoutCashProjection(body);
  } catch (error) {
    if (error instanceof OwnerValidationError) return c.json(badOwner, 400);
    throw error;
  }
  if (!restoredSnapshot) return c.json(badCashProjection, 400);
  const restored = restoredSnapshot.data;
  const unit: ParsedUnit = { kind: 'json', filename: 'restore.json', json: body };
  const prepared: PreparedUnit = {
    unit,
    contentHash: null,
    targetKeys: targetKeysForUnit(unit),
    restored,
    cashProjectionRows: restoredSnapshot.projectionRows,
    restoredCash: [],
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
  let restoreSettings: ImportRestoreSettingsSnapshot = {
    normMap: {},
    statMinMonths: DEFAULT_STAT_MIN_MONTHS,
    subVendorExclusions: [],
    subVendors: [],
    subVendorReviewDecisions: [],
    cashEntries: [],
    freeeDeals: [],
    txSplits: [],
    vendorMemories: [],
    destinationRowCounts: {
      subVendorReviewDecisions: 0,
      reviewSnoozes: 0,
      monthlyCloseReviews: 0,
      duplicateVerdicts: 0,
      freeeDealExclusions: 0,
      totalCashflowOperations: 0,
      rules: 0,
      txEdits: 0,
      institutionOwners: 0,
      budgets: 0,
      cashOverrides: 0,
    },
  };
  let freeeDeals: FreeeDeal[] = [];
  let restoreCommitCount = 0;
  let cashSkipped = 0;
  let queryPlan: ReturnType<typeof planRestoreImportQueries> | null = null;
  let preflightAccepted = false;
  try {
    // multipartと同じく、claim取得後のauthoritative snapshotで計画と実行を行う。
    restoreSettings = await loadImportRestoreSettingsSnapshot(db, userId);
    cashEntries = restoreSettings.cashEntries;
    prepared.restoredCash = restorableCashEntries(body, cashEntries);
    data = await loadDataset(db, userId, cashEntries, { withSplits: false });
    data.txSplits = restoreSettings.txSplits;
    normMap = restoreSettings.normMap;
    freeeDeals = restoreSettings.freeeDeals;
    const planFor = async (restoredCashEntries: CashEntry[]): Promise<number> => {
      const application = await prepareJsonApplication({
        userId,
        data,
        restored,
        json: body,
        cashEntries,
        freeeDeals,
        destinationSettings: restoreSettings,
        cashProjectionRows: prepared.cashProjectionRows,
        restoredCashEntries,
      });
      return restoreCommitStatements({
        database: c.env.DB,
        userId,
        runId: 'query-plan',
        writeSet: application.writeSet,
        importId: 0,
        contentHash: application.contentHash,
        targetKeys: prepared.targetKeys,
      }).length;
    };
    restoreCommitCount = await planFor(prepared.restoredCash);
    queryPlan = planRestoreImportQueries(restoreCommitCount);
    // 現金の記帳は集計・設定より後回しにする。予算に載らないなら記帳だけ見送り、
    // 見送った件数を応答で返す(黙って0件にすると「バックアップに無かった」と区別が付かない)
    if (!queryPlan.accepted && prepared.restoredCash.length > 0) {
      cashSkipped = prepared.restoredCash.length;
      prepared.restoredCash = [];
      restoreCommitCount = await planFor([]);
      queryPlan = planRestoreImportQueries(restoreCommitCount);
    }
    if (!queryPlan.accepted) return c.json(queryBudgetError(queryPlan.total), 413);
    preflightAccepted = true;
  } catch (error) {
    if (error instanceof OwnerValidationError) return c.json(badOwner, 400);
    if (error instanceof TxSplitsSnapshotError) return c.json(badTxSplits, 400);
    if (error instanceof InvalidRestoreSettingsError) return c.json(badRestoreSettings, 400);
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
        restoreSettings,
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
      restoreSettings,
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
      // 現金の記帳をいくつ戻したか。0でも「バックアップに無かった」と「移行先に既にあった」で
      // 意味が違うため、後者は cashKept で区別する
      cashEntries: executed.result.status === 'duplicate' ? 0 : prepared.restoredCash.length,
      cashKept: cashEntries.length,
      // 予算(49 queries)に載らず記帳だけ見送った件数。0なら見送りは無い
      cashSkipped,
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

/* ======================== データ取込画面 (16-import) ======================== */
/*
 * 検査 → 確定 → 履歴 の 3 段。検査は明細の表に 1 行も書かず、原本を R2 の仮置きへ置くだけにする。
 * 確定は本人の期限内の検査 ID だけを受け付け、既存の取込本体 (runMultipartImport) を 1 回だけ通す。
 * 判定の順は Origin (index.ts) → レート制限 → 本文の上限 → 本文の形 → 件数・大きさ → ファイルごとの検査。
 */

/** 確定・一括削除・取り消しの JSON 本文の上限。ファイルを載せない要求は小さい上限で止める。 */
const IMPORT_JSON_BODY_LIMIT_BYTES = 64 * 1024;

const notFound = (c: Context) =>
  c.json({ error: { code: 'not_found', message: '対象が見つかりません。最初から選び直してください' } }, 404);

const invalidRequest = (c: Context, message: string) =>
  c.json({ error: { code: 'invalid_request', message } }, 400);

const payloadTooLarge = (c: Context, reason?: string) =>
  c.json(
    {
      error: {
        code: 'payload_too_large',
        message: `${reason ? `${reason}のため受け付けられません。` : ''}${importLimitsNote()}`,
      },
    },
    413,
  );

/** 検査・ファイル追加の本文。Content-Length があればその値で、無ければ読みながら数えて止める。 */
const importUploadBodyLimit = bodyLimit({
  maxSize: importBodyLimitBytes(),
  onError: (c) => payloadTooLarge(c),
});

const importJsonBodyLimit = bodyLimit({
  maxSize: IMPORT_JSON_BODY_LIMIT_BYTES,
  onError: (c) => c.json({ error: { code: 'payload_too_large', message: 'リクエストが大きすぎます' } }, 413),
});

function importRateLimit(kind: ImportRateLimitKind): MiddlewareHandler<Ctx> {
  return async (c, next) => {
    const decision = await consumeImportRateLimit(c.env.DB, c.get('userId'), kind, Date.now());
    if (!decision.allowed) return importRateLimitedResponse(c, decision);
    await next();
  };
}

/**
 * 記録するファイル名。制御文字を除き、パスの区切りは「_」に置き換え、255 文字 (コードポイント) で切る。
 * 拡張子で取込元を判定するので、切るときは拡張子を残す。ZIP の中身は「ZIP 名/中身の名前」で結果に出るため、
 * 最上位の名前に「/」が残ると、どのファイルの結果かを取り違える。
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: ファイル名の制御文字を記録しないため
const FILENAME_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function sanitizeImportFilename(name: string): string {
  const max = IMPORT_LIMITS.maxFilenameLength;
  const cleaned = [...name.replace(FILENAME_CONTROL_CHARACTERS, '').replace(/[/\\]/g, '_').trim()];
  if (!cleaned.length) return 'import';
  if (cleaned.length <= max) return cleaned.join('');
  const dot = cleaned.lastIndexOf('.');
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : [];
  return [...cleaned.slice(0, max - extension.length), ...extension].join('');
}

interface UploadedImportFile {
  name: string;
  size: number;
  buf: Uint8Array;
}

/** multipart の file パートを読む。0 個なら 400、上限の超過はパースより前に 413。 */
async function readImportUpload(
  c: Context<Ctx>,
  prior?: { count: number; totalBytes: number },
): Promise<UploadedImportFile[] | Response> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return invalidRequest(c, 'ファイルを読み取れませんでした。選び直してください');
  }
  const parts = form.getAll('file').filter((entry): entry is File => entry instanceof File);
  if (!parts.length) return invalidRequest(c, 'ファイルが指定されていません');
  const named = parts.map((part) => ({ part, name: sanitizeImportFilename(part.name) }));
  const violation = importLimitViolation({
    files: named.map(({ part, name }) => ({ name, size: part.size })),
    prior,
  });
  if (violation) return payloadTooLarge(c, violation.reason);
  const files: UploadedImportFile[] = [];
  for (const { part, name } of named) {
    files.push({ name, size: part.size, buf: new Uint8Array(await part.arrayBuffer()) });
  }
  return files;
}

/** 検査結果の要約 (import_inspection_files.summary_json)。明細の中身は入れない。 */
interface InspectionSummaryJson {
  rowCount: number;
  skipped: number;
  months: string[];
  validation: ImportValidation;
  duplicate: ImportDuplicate;
  reason: string | null;
  identicalOf: number | null;
  subsEstimate: number;
  /**
   * 確定応答が届かなかったときに同じ file ID を安全に再送できるように残す完了記録。
   * 明細や原本は含まず、画面に返す結果だけを保持する。
   */
  commit?: {
    state: ImportFileState;
    rowCount: number;
    reason: string | null;
    possibleDuplicates: number;
  };
}

interface InspectionFileRow {
  id: string;
  inspection_id: string;
  position: number;
  filename: string;
  source: string | null;
  period_from: string | null;
  period_to: string | null;
  size: number;
  content_hash: string | null;
  summary_json: string;
  error_kind: string | null;
  r2_key: string | null;
}

const EMPTY_SUMMARY: InspectionSummaryJson = {
  rowCount: 0,
  skipped: 0,
  months: [],
  validation: { kind: 'error', count: 1 },
  duplicate: { kind: 'none', count: 0 },
  reason: '検査結果を読み取れません',
  identicalOf: null,
  subsEstimate: 0,
};

function parseInspectionSummary(raw: string): InspectionSummaryJson {
  try {
    const parsed = JSON.parse(raw) as Partial<InspectionSummaryJson>;
    return { ...EMPTY_SUMMARY, ...parsed };
  } catch {
    return EMPTY_SUMMARY;
  }
}

/** 項目の状態。上限の超過 (error_kind='limit') は検査結果より先に取込不可にする。 */
function inspectionFileStatus(row: InspectionFileRow, force: boolean) {
  const summary = parseInspectionSummary(row.summary_json);
  const status = importFileState({
    commit: null,
    limitViolation: row.error_kind === 'limit' ? (summary.reason ?? '上限を超えています') : null,
    uploaded: true,
    inspection:
      row.error_kind === 'limit'
        ? null
        : { validation: summary.validation, duplicate: summary.duplicate, errorReason: summary.reason },
    force,
  });
  return { summary, ...status };
}

function inspectionFileView(row: InspectionFileRow) {
  const { summary, state, reason } = inspectionFileStatus(row, false);
  return {
    id: row.id,
    filename: row.filename,
    source: isImportSource(row.source) ? row.source : null,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    size: row.size,
    rowCount: summary.rowCount,
    duplicate: summary.duplicate,
    validation: summary.validation,
    state,
    reason,
    subsEstimate: summary.subsEstimate,
  };
}

function inspectionBody(id: string, expiresAt: string, rows: InspectionFileRow[]) {
  const files = [...rows].sort((a, b) => a.position - b.position).map(inspectionFileView);
  return {
    id,
    expiresAt,
    files: files.map(({ subsEstimate: _subsEstimate, ...file }) => file),
    summary: importInspectionSummary(files),
  };
}

async function loadInspectionFiles(
  database: D1Database,
  userId: string,
  inspectionId: string,
): Promise<InspectionFileRow[]> {
  const rows = await database
    .prepare(
      `SELECT id,inspection_id,position,filename,source,period_from,period_to,size,content_hash,summary_json,error_kind,r2_key
         FROM import_inspection_files WHERE inspection_id=? AND user_id=? ORDER BY position`,
    )
    .bind(inspectionId, userId)
    .all<InspectionFileRow>();
  return rows.results;
}

/**
 * 本人の・期限内の・確定していない検査だけを返す。それ以外は区別せず null (404)。
 * 本人は actor_id で見る。user_id は全利用者が共有するテナントキーなので、それだけでは他人の検査に届く。
 */
async function loadOpenInspection(
  database: D1Database,
  userId: string,
  actorId: string,
  inspectionId: string,
) {
  return database
    .prepare(
      `SELECT id,expires_at,run_id FROM import_inspections
        WHERE id=? AND user_id=? AND actor_id=? AND status='open' AND expires_at>?`,
    )
    .bind(inspectionId, userId, actorId, new Date().toISOString())
    .first<{ id: string; expires_at: string; run_id: string | null }>();
}

const sha256Hex = async (buf: Uint8Array): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** JSON バックアップは行の概念が無いので、明細の件数を行数として見せる */
const jsonRowCount = (json: Record<string, unknown>): number =>
  Array.isArray(json.mfTx) ? Math.max(1, json.mfTx.length) : 1;

/**
 * ファイルごとの検査。明細の表には書かず、見込みは取込前の正本の複製に当てて数える。
 * 重複の可能性・サブスク候補は「前回データを残す」(既定) で当てたときの近似で、確定時の記録値とは別物である。
 */
async function inspectUploadedFiles(
  c: Context<Ctx>,
  userId: string,
  inspectionId: string,
  files: UploadedImportFile[],
  startPosition: number,
): Promise<InspectionFileRow[]> {
  const db = getDb(c.env.DB);
  const settings = await loadImportRestoreSettingsSnapshot(db, userId);
  const base = await loadDataset(db, userId, settings.cashEntries, { withSplits: false });
  base.txSplits = settings.txSplits;
  const baseReview = reconcileBizDuplicates(base, settings.freeeDeals).review.length;
  const baseSubs = subsCandidatePartners(base, settings.freeeDeals, settings);

  const rows: InspectionFileRow[] = [];
  const hashChecks: Array<{ rowIndex: number; statement: D1PreparedStatement; targetCount: number }> = [];
  const unitCounts: number[] = [];
  for (const [offset, file] of files.entries()) {
    const id = crypto.randomUUID();
    const row: InspectionFileRow = {
      id,
      inspection_id: inspectionId,
      position: startPosition + offset,
      filename: file.name,
      source: null,
      period_from: null,
      period_to: null,
      size: file.size,
      content_hash: null,
      summary_json: '',
      error_kind: null,
      r2_key: null,
    };
    const summary: InspectionSummaryJson = { ...EMPTY_SUMMARY, reason: null };
    const archive = zipCentralDirectoryStats(file.buf);
    const archiveViolation = archive ? importArchiveViolation(archive) : null;
    if (archiveViolation) {
      // 展開せずに取込不可にする。要求全体は拒否しない
      row.error_kind = 'limit';
      row.summary_json = JSON.stringify({ ...summary, reason: archiveViolation.reason });
      rows.push(row);
      unitCounts.push(0);
      continue;
    }
    const units = parseUpload(file.name, file.buf, settings.normMap);
    const usable = units.filter((unit) => unit.kind !== 'error');
    const failures = units.filter(
      (unit): unit is Extract<ParsedUnit, { kind: 'error' }> => unit.kind === 'error',
    );
    const rowCount = usable.reduce(
      (sum, unit) => sum + (unit.kind === 'json' ? jsonRowCount(unit.json) : unit.rows),
      0,
    );
    const skipped =
      usable.reduce((sum, unit) => sum + (unit.kind === 'json' ? 0 : unit.skipped), 0) +
      (usable.length ? failures.length : 0);
    const months = [...new Set(usable.flatMap((unit) => (unit.kind === 'json' ? [] : unit.months)))].sort();
    const period = importPeriodFromMonths(months);
    row.source = orderedImportSources(usable.map((unit) => unit.kind))[0] ?? null;
    row.period_from = period.from;
    row.period_to = period.to;
    row.content_hash = await sha256Hex(file.buf);
    summary.rowCount = rowCount;
    summary.skipped = skipped;
    summary.months = months;
    summary.validation = importValidation({ error: usable.length === 0, rows: rowCount, skipped });
    summary.reason = usable.length === 0 ? (failures[0]?.reason ?? '取り込めない形式です') : null;
    if (summary.validation.kind === 'error') row.error_kind = 'validation';

    // 見込み: 取込前の複製へ当て、増えた二重計上の候補とサブスク候補を数える
    if (usable.length) {
      const candidate = structuredClone(base);
      let deals = settings.freeeDeals;
      for (const unit of usable) {
        if (unit.kind === 'mf') {
          const merged = keepPreviousUnion(unit, candidate, deals).unit;
          if (merged.kind === 'mf') applyMfTxs(candidate, canonicalMfTransactions(merged.txs));
        } else if (unit.kind === 'freee') {
          const merged = keepPreviousUnion(unit, candidate, deals).unit;
          const replaced = new Set(unit.months);
          if (merged.kind === 'freee')
            deals = [...deals.filter((deal) => !replaced.has(deal.month)), ...merged.deals];
        }
      }
      const possible = Math.max(0, reconcileBizDuplicates(candidate, deals).review.length - baseReview);
      summary.duplicate = importDuplicate({ identical: false, possibleCount: possible });
      summary.subsEstimate = [...subsCandidatePartners(candidate, deals, settings)].filter(
        (key) => !baseSubs.has(key),
      ).length;
    }

    // 取込済みと同一: 使える unit がすべて有効な取込と同じ内容なら「同一」
    let checks = 0;
    for (const unit of usable) {
      if (unit.kind === 'json') continue;
      const contentHash = await unitFingerprint(unit);
      const targetKeys = targetKeysForUnit(unit);
      if (!contentHash || !targetKeys.length) continue;
      checks += 1;
      hashChecks.push({
        rowIndex: rows.length,
        targetCount: targetKeys.length,
        statement: c.env.DB.prepare(
          `SELECT COUNT(*) AS matched, MIN(import_id) AS import_id
             FROM import_active_targets
            WHERE user_id=? AND content_hash=?
              AND target_key IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
        ).bind(userId, contentHash, JSON.stringify(targetKeys)),
      });
    }
    unitCounts.push(usable.some((unit) => unit.kind === 'json') ? 0 : checks);
    row.summary_json = JSON.stringify(summary);
    rows.push(row);
  }

  if (hashChecks.length) {
    const results = await c.env.DB.batch<{ matched: number; import_id: number | null }>(
      hashChecks.map((check) => check.statement),
    );
    const matches = new Map<number, Array<number | null>>();
    for (const [index, check] of hashChecks.entries()) {
      const first = results[index]?.results[0];
      const list = matches.get(check.rowIndex) ?? [];
      list.push(first && first.matched === check.targetCount ? first.import_id : null);
      matches.set(check.rowIndex, list);
    }
    for (const [rowIndex, list] of matches) {
      const row = rows[rowIndex];
      if (list.length !== unitCounts[rowIndex] || list.some((id) => id === null)) continue;
      const summary = parseInspectionSummary(row.summary_json);
      summary.duplicate = importDuplicate({ identical: true, possibleCount: 0 });
      summary.identicalOf = list[0] ?? null;
      row.summary_json = JSON.stringify(summary);
    }
  }

  // 取込不可のファイルも含め、検査を通ったものだけ仮置きする (上限超過は展開も保管もしない)
  for (const [index, row] of rows.entries()) {
    if (row.error_kind === 'limit') continue;
    const key = `import-staging/${userId}/${inspectionId}/${row.id}`;
    try {
      await c.env.FILES.put(key, files[index].buf);
      row.r2_key = key;
    } catch {
      const summary = parseInspectionSummary(row.summary_json);
      row.error_kind = 'staging';
      row.summary_json = JSON.stringify({
        ...summary,
        validation: { kind: 'error', count: 1 },
        reason: '一時保管できませんでした。もう一度お試しください',
      });
    }
  }
  return rows;
}

const insertInspectionFileStatement = (database: D1Database, userId: string, row: InspectionFileRow) =>
  database
    .prepare(
      `INSERT INTO import_inspection_files
         (id,inspection_id,user_id,position,filename,source,period_from,period_to,size,content_hash,summary_json,error_kind,r2_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      row.id,
      row.inspection_id,
      userId,
      row.position,
      row.filename,
      row.source,
      row.period_from,
      row.period_to,
      row.size,
      row.content_hash,
      row.summary_json,
      row.error_kind,
      row.r2_key,
    );

async function deleteStagedObjects(bucket: R2Bucket, rows: InspectionFileRow[]): Promise<void> {
  const keys = rows.map((row) => row.r2_key).filter((key): key is string => !!key);
  if (!keys.length) return;
  try {
    await bucket.delete(keys);
  } catch {
    // 片づけの失敗で応答を失敗にしない。残った仮置きは夜間保守が期限で消す
    console.error(
      JSON.stringify({ level: 'error', event: 'import_staging_delete_failed', count: keys.length }),
    );
  }
}

importsRoute.post('/imports/inspections', importRateLimit('inspection'), importUploadBodyLimit, async (c) => {
  const userId = c.get('userId');
  const files = await readImportUpload(c);
  if (files instanceof Response) return files;
  const inspectionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IMPORT_LIMITS.stagingTtlMs).toISOString();
  const rows = await inspectUploadedFiles(c, userId, inspectionId, files, 0);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO import_inspections (id,user_id,actor_id,status,expires_at,created_at) VALUES (?,?,?,'open',?,?)`,
    ).bind(inspectionId, userId, c.get('actor').id, expiresAt, now.toISOString()),
    ...rows.map((row) => insertInspectionFileStatement(c.env.DB, userId, row)),
  ]);
  return c.json({ inspection: inspectionBody(inspectionId, expiresAt, rows) }, 201);
});

importsRoute.post(
  '/imports/inspections/:id/files',
  importRateLimit('inspection'),
  importUploadBodyLimit,
  async (c) => {
    const userId = c.get('userId');
    const inspectionId = c.req.param('id');
    const inspection = await loadOpenInspection(c.env.DB, userId, c.get('actor').id, inspectionId);
    // 確定を始めた検査は再送用の完了記録を持つ。後からファイル構成は変えない。
    if (!inspection || inspection.run_id) return notFound(c);
    const existing = await loadInspectionFiles(c.env.DB, userId, inspectionId);
    const files = await readImportUpload(c, {
      count: existing.length,
      totalBytes: existing.reduce((sum, row) => sum + row.size, 0),
    });
    if (files instanceof Response) return files;
    const start = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const rows = await inspectUploadedFiles(c, userId, inspectionId, files, start);
    await c.env.DB.batch(rows.map((row) => insertInspectionFileStatement(c.env.DB, userId, row)));
    // 期限は延ばさない (最初の検査から 24 時間)
    return c.json({
      inspection: inspectionBody(inspectionId, inspection.expires_at, [...existing, ...rows]),
    });
  },
);

importsRoute.delete('/imports/inspections/:id/files/:fileId', async (c) => {
  const userId = c.get('userId');
  const inspectionId = c.req.param('id');
  const inspection = await loadOpenInspection(c.env.DB, userId, c.get('actor').id, inspectionId);
  if (!inspection || inspection.run_id) return notFound(c);
  const rows = await loadInspectionFiles(c.env.DB, userId, inspectionId);
  const target = rows.find((row) => row.id === c.req.param('fileId'));
  if (!target) return notFound(c);
  await c.env.DB.prepare('DELETE FROM import_inspection_files WHERE id=? AND inspection_id=? AND user_id=?')
    .bind(target.id, inspectionId, userId)
    .run();
  await deleteStagedObjects(c.env.FILES, [target]);
  return c.json({
    inspection: inspectionBody(
      inspectionId,
      inspection.expires_at,
      rows.filter((row) => row.id !== target.id),
    ),
  });
});

/** 確定の後処理が同じ invocation で使う query (レート制限・検査の claim・項目の読み込み・run の更新・片づけ)。 */
const RUN_EXTRA_QUERIES = 6;
/** 検査経由の確定は、応答消失時の再送用にファイルごとの完了記録を 1 query で残す。 */
const INSPECTION_RUN_EXTRA_QUERIES = RUN_EXTRA_QUERIES + 1;

type RunImportBody = {
  runId: string;
  results: UnitResult[];
  impact: ImportImpact;
};

const isRunImportBody = (body: unknown): body is RunImportBody =>
  typeof body === 'object' && body !== null && 'runId' in body && 'results' in body;

/** ZIP の中身は「ZIP 名/中身の名前」で結果に出る。最上位のファイルごとに成否をまとめる */
const resultsOfFile = (results: UnitResult[], filename: string): UnitResult[] =>
  results.filter((result) => result.filename === filename || result.filename.startsWith(`${filename}/`));

const SUCCEEDED_IMPORT_STATUSES = new Set(['committed', 'duplicate', 'ok']);

/**
 * 確定の結果を取込 1 回の記録 (import_runs の影響の値と結果) へ書き、画面向けの形にする。
 * 影響の値は確定時に数えたものを記録し、後から明細を数え直さない。
 */
async function recordImportRun(
  c: Context<Ctx>,
  input: {
    runId: string;
    body: RunImportBody;
    files: Array<{ id: string; filename: string; possibleDuplicates: number }>;
    keepPrevious: boolean;
    /** 同じ取込 1 回の 2 本目以降。値はこの run ではなく親の run に足す */
    parentRunId?: string | null;
  },
) {
  const userId = c.get('userId');
  const files = input.files.map((file) => {
    const results = resultsOfFile(input.body.results, file.filename);
    const succeeded = results.some(
      (result) => result.status === 'committed' || result.status === 'duplicate',
    );
    const committedRows = results
      .filter((result) => result.status === 'committed')
      .reduce((sum, result) => sum + result.rows, 0);
    const failure = results.find((result) => result.status === 'failed');
    return {
      id: file.id,
      filename: file.filename,
      state: (succeeded ? 'imported' : 'failed') as ImportFileState,
      rowCount: succeeded ? committedRows : 0,
      reason: succeeded ? null : (failure?.reason ?? '取り込めませんでした'),
      possibleDuplicates: file.possibleDuplicates,
    };
  });
  const succeeded = files.filter((file) => file.state === 'imported').length;
  const result = importRunResult(succeeded, files.length - succeeded);
  const rowCount = files.reduce((sum, file) => sum + file.rowCount, 0);
  const impact = input.body.impact;
  const files0 = files.map(({ possibleDuplicates: _possible, ...file }) => file);
  const duplicateCandidates = files
    .filter((file) => file.state === 'imported')
    .reduce((sum, file) => sum + file.possibleDuplicates, 0);
  if (input.parentRunId) {
    // 子の run は値を持たず親を指すだけ。結果は親と同じなら保ち、違えば一部成功にする
    const [, parent] = await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE import_runs SET parent_run_id=?,keep_previous=? WHERE id=? AND user_id=?',
      ).bind(input.parentRunId, input.keepPrevious ? 1 : 0, input.runId, userId),
      c.env.DB.prepare(
        `UPDATE import_runs
            SET file_count=COALESCE(file_count,0)+?,row_count=COALESCE(row_count,0)+?,
                added_count=COALESCE(added_count,0)+?,skipped_count=COALESCE(skipped_count,0)+?,
                subs_candidate_count=COALESCE(subs_candidate_count,0)+?,
                result=CASE WHEN result IS NULL OR result=? THEN ? ELSE 'partial' END
          WHERE id=? AND user_id=?
          RETURNING added_count,skipped_count,subs_candidate_count,result`,
      ).bind(
        files.length,
        rowCount,
        impact.added,
        impact.skipped,
        impact.subsCandidates,
        result,
        result,
        input.parentRunId,
        userId,
      ),
    ]);
    const total = (parent?.results?.[0] ?? null) as {
      added_count: number;
      skipped_count: number;
      subs_candidate_count: number;
      result: ImportRunResult;
    } | null;
    return {
      id: input.parentRunId,
      result: total?.result ?? result,
      files: files0,
      impact: {
        added: total?.added_count ?? impact.added,
        skipped: total?.skipped_count ?? impact.skipped,
        subsCandidates: total?.subs_candidate_count ?? impact.subsCandidates,
      },
      duplicateCandidates,
    };
  }
  await c.env.DB.prepare(
    `UPDATE import_runs
        SET file_count=?,row_count=?,added_count=?,skipped_count=?,subs_candidate_count=?,result=?,keep_previous=?
      WHERE id=? AND user_id=?`,
  )
    .bind(
      files.length,
      rowCount,
      impact.added,
      impact.skipped,
      impact.subsCandidates,
      result,
      input.keepPrevious ? 1 : 0,
      input.runId,
      userId,
    )
    .run();
  return {
    id: input.runId,
    result,
    files: files0,
    impact: { added: impact.added, skipped: impact.skipped, subsCandidates: impact.subsCandidates },
    duplicateCandidates,
  };
}

/** 仮置き済みの原本を持たず、確定後の再送に必要な結果だけを持つ行。 */
function committedInspectionFile(row: InspectionFileRow) {
  if (row.error_kind !== 'committed' || row.r2_key) return null;
  const commit = parseInspectionSummary(row.summary_json).commit;
  if (!commit) return null;
  return {
    id: row.id,
    filename: row.filename,
    state: commit.state,
    rowCount: commit.rowCount,
    reason: commit.reason,
    possibleDuplicates: commit.possibleDuplicates,
  };
}

/** 同じ確定要求の再送に、既に記録した run とファイル結果を返す。 */
async function replayCommittedInspectionRun(c: Context<Ctx>, runId: string, rows: InspectionFileRow[]) {
  const recorded = await c.env.DB.prepare(
    `SELECT id,result,added_count,skipped_count,subs_candidate_count
       FROM import_runs WHERE id=? AND user_id=? AND parent_run_id IS NULL`,
  )
    .bind(runId, c.get('userId'))
    .first<{
      id: string;
      result: ImportRunResult | null;
      added_count: number | null;
      skipped_count: number | null;
      subs_candidate_count: number | null;
    }>();
  const committed = rows.map(committedInspectionFile);
  if (!recorded?.result || committed.some((file) => !file)) return null;
  const files = committed as Array<NonNullable<ReturnType<typeof committedInspectionFile>>>;
  return {
    id: recorded.id,
    result: recorded.result,
    files: files.map(({ possibleDuplicates: _possible, ...file }) => file),
    impact: {
      added: recorded.added_count ?? 0,
      skipped: recorded.skipped_count ?? 0,
      subsCandidates: recorded.subs_candidate_count ?? 0,
    },
    duplicateCandidates: files.reduce((sum, file) => sum + file.possibleDuplicates, 0),
  };
}

const runCommitSchema = z
  .object({
    inspectionId: z.string().min(1).max(64),
    fileIds: z.array(z.string().min(1).max(64)).min(1).max(IMPORT_LIMITS.maxFiles),
    keepPrevious: z.boolean().default(true),
    force: z.boolean().default(false),
  })
  .strict();

async function readJsonBody<T extends z.ZodTypeAny>(c: Context<Ctx>, schema: T): Promise<z.infer<T> | null> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * 検査 ID の確定。D1 の 1 invocation の query 予算 (50) に 2 ファイルは載らないので、1 要求で確定するのは
 * 選んだファイルのうち先頭の 1 つだけにして、残りの ID を `remaining` で返す。画面は残りが空になるまで
 * 同じ検査 ID で呼び直す。2 本目以降の run は最初の run の子にして、取込 1 回 = 履歴 1 行を保つ。
 * 最初の要求で選ばなかったファイルはその場で外す。確定済みの行は原本を消した完了記録として
 * 検査の期限まで残し、応答消失後の同一 payload 再送に同じ結果を返す。
 */
importsRoute.post('/imports/runs', importJsonBodyLimit, async (c) => {
  const userId = c.get('userId');
  const body = await readJsonBody(c, runCommitSchema);
  if (!body) return invalidRequest(c, '取り込むファイルを選び直してください');
  const claimed = await c.env.DB.prepare(
    `UPDATE import_inspections SET status='committing'
      WHERE id=? AND user_id=? AND actor_id=? AND status='open' AND expires_at>?
      RETURNING run_id`,
  )
    .bind(body.inspectionId, userId, c.get('actor').id, new Date().toISOString())
    .first<{ run_id: string | null }>();
  const reopen = () =>
    c.env.DB.prepare(`UPDATE import_inspections SET status='open' WHERE id=? AND user_id=?`)
      .bind(body.inspectionId, userId)
      .run();
  // 確定の回数は「取込 1 回」で数える。続きの要求 (run_id を持つ検査) は、検査に残ったファイルを
  // 消費するだけで検査 1 つにつき最大 maxFiles-1 回で尽きるので数えない。見つからない ID は数える
  if (!claimed?.run_id) {
    const decision = await consumeImportRateLimit(c.env.DB, userId, 'commit', Date.now());
    if (!decision.allowed) {
      if (claimed) await reopen();
      return importRateLimitedResponse(c, decision);
    }
  }
  if (!claimed) return notFound(c);
  const parentRunId = claimed.run_id;

  try {
    const rows = await loadInspectionFiles(c.env.DB, userId, body.inspectionId);
    const byId = new Map(rows.map((row) => [row.id, row] as const));
    const requested = [...new Set(body.fileIds)];
    if (requested.some((id) => !byId.has(id))) {
      await reopen();
      return notFound(c);
    }
    const requestedRows = requested.map((id) => byId.get(id) as InspectionFileRow);
    const committedRequested = requestedRows.filter((row) => committedInspectionFile(row));
    if (committedRequested.length) {
      // 同じ payload の再送に完了済み ID が含まれるときは、次のファイルへ進まない。
      // 完了済みの結果だけを再生し、未処理 ID を remaining で返すことで、Web は失った
      // 1 回分の結果を取り込んでから通常の続きへ進める。
      const replay = parentRunId
        ? await replayCommittedInspectionRun(c, parentRunId, committedRequested)
        : null;
      if (!replay) {
        await reopen();
        return notFound(c);
      }
      const remaining = rows.filter((row) => !!row.r2_key).map((row) => row.id);
      await reopen();
      return c.json({ run: replay, remaining }, 201);
    }
    // 取込可能でないものは外す。強制再取込のときだけ「取込済みと同一」を含める
    const selected = requestedRows.filter(
      (row) => row.r2_key && importFileSelectable(inspectionFileStatus(row, body.force).state),
    );
    if (!selected.length) {
      await reopen();
      return invalidRequest(c, '取り込めるファイルがありません');
    }
    const [current, ...rest] = selected as [InspectionFileRow, ...InspectionFileRow[]];
    const object = await c.env.FILES.get(current.r2_key as string);
    if (!object) {
      await reopen();
      return notFound(c);
    }
    const buffered: BufferedImportFile[] = [
      { file: { name: current.filename }, buf: new Uint8Array(await object.arrayBuffer()) },
    ];

    const runId = crypto.randomUUID();
    const response = await runMultipartImport(c, {
      files: buffered,
      force: body.force,
      keepOnShrink: false,
      keepPrevious: body.keepPrevious,
      requestedResolution: null,
      extraQueries: INSPECTION_RUN_EXTRA_QUERIES,
      runId,
    });
    const result: unknown = await response.clone().json();
    if (!isRunImportBody(result)) {
      // 取込が始まらなかった (busy・予算超過・形式の不整合)。検査はそのまま選び直せる
      await reopen();
      return response;
    }
    const summary = parseInspectionSummary(current.summary_json);
    const run = await recordImportRun(c, {
      runId,
      body: result,
      files: [
        {
          id: current.id,
          filename: current.filename,
          possibleDuplicates: summary.duplicate.kind === 'possible' ? summary.duplicate.count : 0,
        },
      ],
      keepPrevious: body.keepPrevious,
      parentRunId,
    });
    // 原本は取込本体が uploads/ へ置いた。仮置きは消し、応答消失後の再送を識別できるよう
    // 結果だけの小さな完了記録を検査の期限まで残す。最初に選ばなかった行はここで消す。
    const currentResult = run.files[0];
    if (!currentResult) throw new Error('committed import file result is missing');
    const receiptSummary: InspectionSummaryJson = {
      ...summary,
      commit: {
        state: currentResult.state,
        rowCount: currentResult.rowCount,
        reason: currentResult.reason,
        possibleDuplicates: run.duplicateCandidates,
      },
    };
    const committedIds = rows.filter((row) => committedInspectionFile(row)).map((row) => row.id);
    const keepIds = new Set([...committedIds, current.id, ...rest.map((row) => row.id)]);
    const dropped = rows.filter((row) => row.id === current.id || !keepIds.has(row.id));
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE import_inspection_files
            SET summary_json=?,error_kind='committed',r2_key=NULL
          WHERE id=? AND inspection_id=? AND user_id=?`,
      ).bind(JSON.stringify(receiptSummary), current.id, body.inspectionId, userId),
      c.env.DB.prepare(
        `DELETE FROM import_inspection_files
          WHERE inspection_id=? AND user_id=? AND id NOT IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
      ).bind(body.inspectionId, userId, JSON.stringify([...keepIds])),
      c.env.DB.prepare(`UPDATE import_inspections SET status='open',run_id=? WHERE id=? AND user_id=?`).bind(
        run.id,
        body.inspectionId,
        userId,
      ),
    ]);
    await deleteStagedObjects(c.env.FILES, dropped);
    return c.json({ run, remaining: rest.map((row) => row.id) }, 201);
  } catch (error) {
    await reopen().catch(() => undefined);
    throw error;
  }
});

/* ---------- 取込 1 回の履歴 ---------- */

interface ImportRunRow {
  id: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
  file_count: number | null;
  row_count: number | null;
  added_count: number | null;
  skipped_count: number | null;
  subs_candidate_count: number | null;
  result: string | null;
  keep_previous: number | null;
  hidden_at: string | null;
}

interface RunImportRow {
  id: number;
  run_id: string;
  filename: string | null;
  kind: string | null;
  months: string | null;
  row_count: number | null;
  status: string | null;
  r2_key: string | null;
  target_keys: string | null;
  failure_reason: string | null;
  created_at: string | null;
}

const RUN_COLUMNS =
  'id,status,failure_reason,created_at,file_count,row_count,added_count,skipped_count,subs_candidate_count,result,keep_previous,hidden_at';

async function loadImportsOfRuns(
  database: D1Database,
  userId: string,
  runIds: string[],
): Promise<RunImportRow[]> {
  if (!runIds.length) return [];
  // D1 のバインドは 1 文 100 個まで。ID の配列は JSON 1 個で渡す。
  // 子の run (同じ取込 1 回の 2 本目以降) の明細は親の run_id に寄せて返す
  const rows = await database
    .prepare(
      `SELECT i.id,COALESCE(r.parent_run_id,i.run_id) AS run_id,i.filename,i.kind,i.months,i.row_count,i.status,
              i.r2_key,i.target_keys,i.failure_reason,i.created_at
         FROM imports i JOIN import_runs r ON r.id=i.run_id AND r.user_id=i.user_id
        WHERE i.user_id=? AND COALESCE(r.parent_run_id,i.run_id) IN (SELECT CAST(value AS TEXT) FROM json_each(?))
        ORDER BY i.id`,
    )
    .bind(userId, JSON.stringify(runIds))
    .all<RunImportRow>();
  return rows.results;
}

/** 最上位のファイル名。ZIP の中身は「ZIP 名/中身の名前」で記録されている */
const topLevelFilename = (filename: string | null): string => (filename ?? '').split('/')[0] || '(名前なし)';

/** 取込 1 回の状態。結果・取り消し済み・操作の可否は core の関数から導く */
function summarizeImportRun(
  run: ImportRunRow,
  rows: RunImportRow[],
  ownership: ImportOwnership,
  now: number,
) {
  const byFile = new Map<string, RunImportRow[]>();
  for (const row of rows) {
    const key = topLevelFilename(row.filename);
    byFile.set(key, [...(byFile.get(key) ?? []), row]);
  }
  const succeeded = [...byFile.values()].filter((units) =>
    units.some((unit) => SUCCEEDED_IMPORT_STATUSES.has(unit.status ?? '')),
  ).length;
  const fileCount = run.file_count ?? byFile.size;
  const failed = Math.max(0, fileCount - succeeded);
  const lifecycle = rows.map((row) => ({
    row,
    ...importLifecycleView({ id: row.id, status: row.status, targetKeys: row.target_keys }, ownership),
  }));
  const committed = lifecycle.filter((entry) => entry.row.status === 'committed');
  const undone = committed.length > 0 && committed.every((entry) => entry.generationState === 'deleted');
  const baseResult: ImportRunResult = isRunResult(run.result)
    ? run.result
    : importRunResult(succeeded, failed);
  const result: ImportHistoryResult = undone ? 'undone' : baseResult;
  const actions = importHistoryActions({ result, createdAt: run.created_at, now });
  const cancelable = lifecycle.filter((entry) => entry.cancelable);
  const months = [
    ...new Set(rows.flatMap((row) => (row.months ? row.months.split(',').filter(Boolean) : []))),
  ];
  const period = importPeriodFromMonths(months);
  return {
    id: run.id,
    createdAt: run.created_at,
    sources: orderedImportSources(rows.map((row) => row.kind)),
    periodFrom: period.from,
    periodTo: period.to,
    fileCount,
    rowCount:
      run.row_count ??
      rows.reduce((sum, row) => sum + (row.status === 'committed' ? (row.row_count ?? 0) : 0), 0),
    result,
    detail: {
      succeeded,
      failed,
      failureSummary: rows.find((row) => row.failure_reason)?.failure_reason ?? run.failure_reason ?? null,
    },
    undoable: actions.includes('undo') && cancelable.length > 0,
    replaceable: actions.includes('replace') && rows.some((row) => row.r2_key),
    undoDeadline: importUndoDeadline(run.created_at),
    canHide: importHistoryHideable(result),
    hasOriginal: rows.some((row) => row.r2_key),
    keepPrevious: run.keep_previous === null ? null : run.keep_previous === 1,
    impact:
      run.added_count === null
        ? null
        : {
            added: run.added_count,
            skipped: run.skipped_count ?? 0,
            subsCandidates: run.subs_candidate_count ?? 0,
          },
    lifecycle,
  };
}

const isRunResult = (value: unknown): value is ImportRunResult =>
  value === 'success' || value === 'partial' || value === 'failed';

importsRoute.get('/imports/runs', async (c) => {
  const userId = c.get('userId');
  const runs = await c.env.DB.prepare(
    `SELECT ${RUN_COLUMNS} FROM import_runs
      WHERE user_id=? AND hidden_at IS NULL AND parent_run_id IS NULL
      ORDER BY created_at DESC, id DESC LIMIT 100`,
  )
    .bind(userId)
    .all<ImportRunRow>();
  const imports = await loadImportsOfRuns(
    c.env.DB,
    userId,
    runs.results.map((run) => run.id),
  );
  const ownership = await loadImportOwnership(c.env.DB, userId);
  const now = Date.now();
  return c.json({
    runs: runs.results
      .map((run) =>
        summarizeImportRun(
          run,
          imports.filter((row) => row.run_id === run.id),
          ownership,
          now,
        ),
      )
      // 全部を見送った・まだ unit を作っていない run は、取込の記録として見せるものが無い
      .filter((run) => run.fileCount > 0 || run.lifecycle.length > 0)
      .map(
        ({
          lifecycle: _lifecycle,
          periodFrom: _from,
          periodTo: _to,
          keepPrevious: _keep,
          impact: _impact,
          ...run
        }) => run,
      ),
  });
});

async function loadOwnedRun(database: D1Database, userId: string, runId: string) {
  return database
    .prepare(`SELECT ${RUN_COLUMNS} FROM import_runs WHERE id=? AND user_id=? AND parent_run_id IS NULL`)
    .bind(runId, userId)
    .first<ImportRunRow>();
}

importsRoute.get('/imports/runs/:id', async (c) => {
  const userId = c.get('userId');
  const run = await loadOwnedRun(c.env.DB, userId, c.req.param('id'));
  if (!run) return notFound(c);
  const rows = await loadImportsOfRuns(c.env.DB, userId, [run.id]);
  const ownership = await loadImportOwnership(c.env.DB, userId);
  const summary = summarizeImportRun(run, rows, ownership, Date.now());
  const { lifecycle, ...rest } = summary;
  return c.json({
    run: {
      ...rest,
      files: lifecycle.map(({ row, generationState, cancelable, discardable }) => ({
        importId: row.id,
        filename: row.filename,
        source: isImportSource(row.kind) ? row.kind : null,
        state: (SUCCEEDED_IMPORT_STATUSES.has(row.status ?? '') ? 'imported' : 'failed') as ImportFileState,
        status: row.status,
        rowCount: row.row_count ?? 0,
        months: row.months ? row.months.split(',').filter(Boolean) : [],
        reason: row.failure_reason,
        hasOriginal: row.r2_key !== null,
        generationState,
        cancelable,
        discardable,
      })),
    },
  });
});

/* ---------- 置換 (同じ原本で強制再取込) ---------- */

const reimportSchema = z
  .object({
    /** 2 回目以降の呼び直し: 残りの原本の名前と、1 回目で作った新しい取込 1 回の ID */
    filenames: z
      .array(z.string().min(1).max(IMPORT_LIMITS.maxFilenameLength))
      .min(1)
      .max(IMPORT_LIMITS.maxFiles),
    intoRunId: z.string().min(1).max(64),
  })
  .strict();

/**
 * 保存した原本で強制再取込する。確定と同じ理由で 1 要求 1 ファイルにし、残りの名前を `remaining` で返す。
 * 画面は `{ filenames: remaining, intoRunId: run.id }` で呼び直し、新しい取込 1 回の子として足していく。
 */
importsRoute.post('/imports/runs/:id/reimport', importRateLimit('commit'), importJsonBodyLimit, async (c) => {
  const userId = c.get('userId');
  const text = await c.req.text();
  let continuation: z.infer<typeof reimportSchema> | null = null;
  if (text.trim()) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return invalidRequest(c, '再取込するファイルを選び直してください');
    }
    const parsed = reimportSchema.safeParse(raw);
    if (!parsed.success) return invalidRequest(c, '再取込するファイルを選び直してください');
    continuation = parsed.data;
  }
  const run = await loadOwnedRun(c.env.DB, userId, c.req.param('id'));
  if (!run) return notFound(c);
  const rows = await loadImportsOfRuns(c.env.DB, userId, [run.id]);
  const ownership = await loadImportOwnership(c.env.DB, userId);
  const summary = summarizeImportRun(run, rows, ownership, Date.now());
  if (!summary.replaceable && !continuation)
    return c.json(
      {
        error: { code: 'not_replaceable', message: 'この取込は置換できません (成功した取込だけ、30 日以内)' },
      },
      409,
    );
  if (continuation && !(await loadOwnedRun(c.env.DB, userId, continuation.intoRunId))) return notFound(c);
  // 最上位のファイルごとに、保存した原本を 1 つ読む (ZIP の中身は同じ原本を共有する)
  const originals = new Map<string, string>();
  for (const row of rows) {
    const name = topLevelFilename(row.filename);
    if (row.r2_key && !originals.has(name)) originals.set(name, row.r2_key);
  }
  const targets = continuation ? continuation.filenames : [...originals.keys()];
  if (targets.some((name) => !originals.has(name))) return notFound(c);
  const [name, ...remaining] = targets as [string, ...string[]];
  const object = await c.env.FILES.get(originals.get(name) as string);
  if (!object)
    return c.json(
      {
        error: {
          code: 'import_original_missing',
          message: '保存した原本が見つかりません。ファイルを選び直してください',
        },
      },
      404,
    );
  const buffered: BufferedImportFile[] = [
    { file: { name }, buf: new Uint8Array(await object.arrayBuffer()) },
  ];
  const runId = crypto.randomUUID();
  const keepPrevious = run.keep_previous === 1;
  const response = await runMultipartImport(c, {
    files: buffered,
    force: true,
    keepOnShrink: false,
    keepPrevious,
    requestedResolution: null,
    extraQueries: RUN_EXTRA_QUERIES,
    runId,
  });
  const result: unknown = await response.clone().json();
  if (!isRunImportBody(result)) return response;
  const recorded = await recordImportRun(c, {
    runId,
    body: result,
    files: [{ id: name, filename: name, possibleDuplicates: 0 }],
    keepPrevious,
    parentRunId: continuation?.intoRunId ?? null,
  });
  return c.json({ run: recorded, remaining }, 201);
});

/* ---------- 取込 1 回の取り消し ---------- */

async function undoTargets(c: Context<Ctx>, runId: string) {
  const userId = c.get('userId');
  const run = await loadOwnedRun(c.env.DB, userId, runId);
  if (!run) return null;
  const rows = await loadImportsOfRuns(c.env.DB, userId, [run.id]);
  const ownership = await loadImportOwnership(c.env.DB, userId);
  const summary = summarizeImportRun(run, rows, ownership, Date.now());
  return {
    summary,
    importIds: summary.undoable
      ? summary.lifecycle.filter((entry) => entry.cancelable).map((entry) => entry.row.id)
      : [],
  };
}

const notUndoable = (c: Context) =>
  c.json(
    {
      error: {
        code: 'not_undoable',
        message: 'この取込は取り消せません (30 日を過ぎたか、取り消し済みです)',
      },
    },
    409,
  );

const sumCounts = (list: Array<Record<string, number>>): Record<string, number> => {
  const total: Record<string, number> = {};
  for (const counts of list)
    for (const [key, value] of Object.entries(counts)) total[key] = (total[key] ?? 0) + value;
  return total;
};

importsRoute.post('/imports/runs/:id/undo/preflight', async (c) => {
  const userId = c.get('userId');
  const targets = await undoTargets(c, c.req.param('id'));
  if (!targets) return notFound(c);
  if (!targets.importIds.length) return notUndoable(c);
  const plans = [];
  for (const importId of targets.importIds) {
    const preflight = await planDeletion(c.env.DB, userId, { granularity: 'import', importId });
    plans.push({
      importId,
      fingerprint: preflight.fingerprint,
      counts: preflight.counts as unknown as Record<string, number>,
      months: preflight.targets.months,
    });
  }
  return c.json({
    imports: plans,
    counts: sumCounts(plans.map((plan) => plan.counts)),
    months: [...new Set(plans.flatMap((plan) => plan.months))].sort(),
    undoRetentionDays: DELETION_UNDO_RETENTION_DAYS,
  });
});

const runUndoSchema = z
  .object({
    fingerprints: z
      .array(z.object({ importId: z.number().int().positive(), fingerprint: z.string().min(1) }).strict())
      .min(1)
      .max(100),
  })
  .strict();

importsRoute.post('/imports/runs/:id/undo', importJsonBodyLimit, async (c) => {
  const userId = c.get('userId');
  const body = await readJsonBody(c, runUndoSchema);
  if (!body) return invalidRequest(c, '取り消す内容をもう一度確認してください');
  // この経路は canonical-mutation-fence の経路表に一致しないため、同じ lease をここで取る
  const leaseToken = `mutation:${crypto.randomUUID()}`;
  if (!(await acquireImportWriter(c.env.DB, userId, leaseToken)))
    return c.json(
      {
        error: {
          code: 'canonical_write_busy',
          message: '別の取込みまたは更新が進行中です。完了後に再試行してください',
        },
      },
      409,
    );
  try {
    const targets = await undoTargets(c, c.req.param('id'));
    if (!targets) return notFound(c);
    if (!targets.importIds.length) return notUndoable(c);
    const expected = new Map(body.fingerprints.map((entry) => [entry.importId, entry.fingerprint] as const));
    const sameScope =
      expected.size === targets.importIds.length &&
      targets.importIds.every((importId) => expected.has(importId));
    if (!sameScope)
      return c.json(
        {
          error: {
            code: 'deletion_scope_changed',
            message: '確認した内容から対象が変わりました。もう一度確認してください',
          },
        },
        409,
      );
    const done: Array<{
      importId: number;
      operationId: string;
      counts: Record<string, number>;
      months: string[];
    }> = [];
    for (const importId of targets.importIds) {
      try {
        const result = await executeDeletion({
          database: c.env.DB,
          userId,
          operationId: crypto.randomUUID(),
          request: { granularity: 'import', importId },
          expectedFingerprint: expected.get(importId),
          recordTransactionHistory: false,
        });
        done.push({
          importId,
          operationId: result.operationId,
          counts: result.counts as unknown as Record<string, number>,
          months: result.targets.months,
        });
      } catch (error) {
        if (error instanceof DeletionScopeChangedError)
          return c.json(
            {
              error: {
                code: 'deletion_scope_changed',
                message: '確認した内容から対象が変わりました。もう一度確認してください',
              },
              undone: done.map((entry) => entry.importId),
            },
            409,
          );
        throw error;
      }
    }
    return c.json({
      operations: done,
      counts: sumCounts(done.map((entry) => entry.counts)),
      months: [...new Set(done.flatMap((entry) => entry.months))].sort(),
    });
  } finally {
    try {
      await releaseImportWriter(c.env.DB, userId, leaseToken);
    } catch {
      console.error(JSON.stringify({ level: 'error', event: 'canonical_lease_release_failed' }));
    }
  }
});

/* ---------- 記録の一括削除 (非表示) ---------- */

const hideSchema = z
  .object({ ids: z.array(z.string().min(1).max(64)).min(1).max(IMPORT_LIMITS.maxHideIds) })
  .strict();

importsRoute.post('/imports/runs/hide', importJsonBodyLimit, async (c) => {
  const userId = c.get('userId');
  const body = await readJsonBody(c, hideSchema);
  if (!body) return invalidRequest(c, `削除する履歴を 1〜${IMPORT_LIMITS.maxHideIds} 件選んでください`);
  const ids = [...new Set(body.ids)];
  const owned = await c.env.DB.prepare(
    `SELECT ${RUN_COLUMNS} FROM import_runs
      WHERE user_id=? AND hidden_at IS NULL AND parent_run_id IS NULL
        AND id IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
  )
    .bind(userId, JSON.stringify(ids))
    .all<ImportRunRow>();
  if (owned.results.length !== ids.length) return notFound(c);
  const rows = await loadImportsOfRuns(c.env.DB, userId, ids);
  const ownership = await loadImportOwnership(c.env.DB, userId);
  const now = Date.now();
  const blocked = owned.results.some(
    (run) =>
      !summarizeImportRun(
        run,
        rows.filter((row) => row.run_id === run.id),
        ownership,
        now,
      ).canHide,
  );
  if (blocked)
    return c.json(
      { error: { code: 'not_hideable', message: '削除できるのは失敗・取り消し済みの履歴だけです' } },
      409,
    );
  const updated = await c.env.DB.prepare(
    `UPDATE import_runs SET hidden_at=?
      WHERE user_id=? AND hidden_at IS NULL AND id IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
  )
    .bind(new Date().toISOString(), userId, JSON.stringify(ids))
    .run();
  return c.json({ hidden: updated.meta.changes ?? 0 });
});
