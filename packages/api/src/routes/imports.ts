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
  HOUSEHOLD_RATIO_BASIS_MAX,
  OwnerValidationError,
  TX_EDIT_BASE_BITS,
  TxSplitsSnapshotError,
  applyFreeeDeals,
  applyMfTxs,
  canonicalEncode,
  canonicalMfTransactions,
  cashBizDeals,
  cashTxId,
  emptyDataset,
  importHistoryCancelable,
  importHistoryDiscardBlock,
  importJSON,
  isCashTxId,
  normalizeBaseKnown,
  normalizeVendorKey,
  projectAccountingDataset,
  resolveIncomingTx,
  validateTxSplitsForDataset,
  vendorKey,
} from '@kanjo/core';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { AuditValidationError } from '../audit-log.js';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { computeImportDiff, diffBaselineFromDataset, importResolutionFingerprint } from '../import-diff.js';
import {
  type MfResolutionAuditDecision,
  type MfResolutionPlan,
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
} from '../import-pipeline.js';
import {
  type CashProjectionEnvelope,
  CashProjectionError,
  type ImportRestoreSettingsSnapshot,
  type ReceiptSourceOverrideSnapshot,
  type ReceiptSourceProfileSnapshot,
  type TaxAccountSettingSnapshot,
  addCashProjection,
  getDb,
  loadDataset,
  loadImportRestoreSettingsSnapshot,
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

const analysisSettingsBackupSchema = z.object({ statMinMonths: z.number().int().min(3).max(24) }).strict();
const subVendorExclusionsBackupSchema = z
  .array(z.object({ partner: z.string().trim().min(1).max(120) }).strict())
  .max(5_000);
const taxAccountSettingsBackupSchema = z
  .array(
    z
      .object({
        taxYear: z.number().int().min(2000).max(2099),
        account: z.string().trim().min(1).max(60),
        taxAccount: z.string().trim().min(1).max(60).nullable(),
        businessPercent: z.number().int().min(0).max(100),
        basis: z.string().max(HOUSEHOLD_RATIO_BASIS_MAX).nullable(),
      })
      .strict(),
  )
  .max(10_000)
  .superRefine((rows, context) => {
    const keys = new Set<string>();
    rows.forEach((row, index) => {
      const key = `${row.taxYear}\0${row.account}`;
      if (keys.has(key))
        context.addIssue({ code: 'custom', path: [index], message: '年と科目が重複しています' });
      keys.add(key);
    });
  });

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
const nullableTrimmed = (max: number) => z.string().trim().min(1).max(max).nullable();
const httpUrl = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        !!url.hostname &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, '取得先URLが不正です');
const receiptSourceProfilesBackupSchema = z
  .array(
    z
      .object({
        profileKey: z
          .string()
          .trim()
          .min(3)
          .max(400)
          .refine((value) => value.includes('::')),
        merchantKey: z.string().trim().min(1).max(200),
        serviceName: z.string().trim().min(1).max(120),
        sourceUrl: httpUrl,
        loginAccount: nullableTrimmed(254),
        memo: nullableTrimmed(500),
      })
      .strict(),
  )
  .max(10_000)
  .superRefine((rows, context) => {
    const keys = new Set<string>();
    rows.forEach((row, index) => {
      if (keys.has(row.profileKey))
        context.addIssue({ code: 'custom', path: [index], message: '取得先が重複しています' });
      keys.add(row.profileKey);
    });
  });
const receiptSourceOverridesBackupSchema = z
  .array(
    z
      .object({
        targetKind: z.enum(['cash', 'mf']),
        targetKey: z.string().min(1).max(200),
        merchantKey: z.string().trim().min(1).max(200),
        profileKey: nullableTrimmed(400),
        serviceName: nullableTrimmed(120),
        sourceUrl: httpUrl.nullable(),
        loginAccount: nullableTrimmed(254),
        memo: nullableTrimmed(500),
      })
      .strict(),
  )
  .max(20_000)
  .superRefine((rows, context) => {
    const keys = new Set<string>();
    rows.forEach((row, index) => {
      const key = `${row.targetKind}\0${row.targetKey}`;
      if (keys.has(key)) context.addIssue({ code: 'custom', path: [index], message: '明細が重複しています' });
      keys.add(key);
      const explicit = [row.serviceName, row.sourceUrl, row.loginAccount, row.memo];
      if (
        row.profileKey
          ? explicit.some((value) => value !== null)
          : row.serviceName === null || row.sourceUrl === null
      ) {
        context.addIssue({ code: 'custom', path: [index], message: '参照と明示値はどちらか一方です' });
      }
    });
  });

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
  const sourceTaxSettings = Object.prototype.hasOwnProperty.call(obj, 'taxAccountSettings')
    ? taxAccountSettingsBackupSchema.safeParse(obj.taxAccountSettings)
    : { success: true as const, data: destination.taxAccountSettings };
  const sourceReceiptProfiles = Object.prototype.hasOwnProperty.call(obj, 'receiptSourceProfiles')
    ? receiptSourceProfilesBackupSchema.safeParse(obj.receiptSourceProfiles)
    : { success: true as const, data: destination.receiptSourceProfiles };
  const sourceReceiptOverrides = Object.prototype.hasOwnProperty.call(obj, 'receiptSourceOverrides')
    ? receiptSourceOverridesBackupSchema.safeParse(obj.receiptSourceOverrides)
    : { success: true as const, data: destination.receiptSourceOverrides };
  if (
    !analysis.success ||
    !sourceExclusions.success ||
    !sourceTaxSettings.success ||
    !sourceReceiptProfiles.success ||
    !sourceReceiptOverrides.success
  ) {
    throw new InvalidRestoreSettingsError();
  }
  const byKey = new Map<string, { partner: string; vendorKey: string }>();
  for (const entry of [...destination.subVendorExclusions, ...sourceExclusions.data]) {
    const partner = entry.partner;
    const key =
      'vendorKey' in entry && typeof entry.vendorKey === 'string' ? entry.vendorKey : vendorKey(partner);
    if (key) byKey.set(key, { partner, vendorKey: key });
  }
  const taxByKey = new Map<string, TaxAccountSettingSnapshot>();
  for (const setting of [...destination.taxAccountSettings, ...sourceTaxSettings.data]) {
    taxByKey.set(`${setting.taxYear}\0${setting.account}`, setting);
  }
  const receiptProfilesByKey = new Map<string, ReceiptSourceProfileSnapshot>();
  for (const profile of [...destination.receiptSourceProfiles, ...sourceReceiptProfiles.data]) {
    receiptProfilesByKey.set(profile.profileKey, profile);
  }
  const receiptOverridesByKey = new Map<string, ReceiptSourceOverrideSnapshot>();
  for (const override of [...destination.receiptSourceOverrides, ...sourceReceiptOverrides.data]) {
    if (override.profileKey && !receiptProfilesByKey.has(override.profileKey)) {
      throw new InvalidRestoreSettingsError();
    }
    receiptOverridesByKey.set(`${override.targetKind}\0${override.targetKey}`, override);
  }
  return {
    normMap: destination.normMap,
    statMinMonths: analysis.data.statMinMonths ?? DEFAULT_STAT_MIN_MONTHS,
    subVendorExclusions: [...byKey.values()],
    cashEntries: destination.cashEntries,
    freeeDeals: destination.freeeDeals,
    txSplits: destination.txSplits,
    taxAccountSettings: [...taxByKey.values()].sort(
      (a, b) => a.taxYear - b.taxYear || a.account.localeCompare(b.account, 'ja'),
    ),
    receiptSourceProfiles: [...receiptProfilesByKey.values()].sort((a, b) =>
      a.profileKey.localeCompare(b.profileKey),
    ),
    receiptSourceOverrides: [...receiptOverridesByKey.values()].sort(
      (a, b) => a.targetKind.localeCompare(b.targetKind) || a.targetKey.localeCompare(b.targetKey),
    ),
    // JSON復元は現在の取引先の決め事を置き換えない。通常取込の解決入力として保持する。
    vendorMemories: destination.vendorMemories,
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
  file: File;
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
  const destinationCashEdits = restoringCash ? {} : currentCashEdits(candidate, args.cashEntries);
  const destinationVendors = candidate.subs.vendors.map((name) => ({
    name,
    aliases: candidate.subs.aliases?.[name] ?? [],
    accounts: candidate.subs.accounts?.[name] ?? [],
  }));
  // importJSON assigns the aggregate maps from its input by reference. The same
  // restore unit is prepared during planning, runtime validation, and execution,
  // so mutating those maps would make each pass inflate the next one. Clone the
  // source and rebuild derived aggregates from the authoritative raw sources.
  // 旧snapshotにtxSplitsが無い場合も、移行先の現在値を残さずcanonical集合を空へ置換する。
  candidate.txSplits = [];
  importJSON(candidate, structuredClone(args.json));
  // JSON restoreは初期移行。sourceの同名設定を優先しつつ、移行先だけの登録を削除しない。
  for (const vendor of destinationVendors) {
    if (candidate.subs.vendors.includes(vendor.name)) continue;
    candidate.subs.vendors.push(vendor.name);
    candidate.subs.aliases[vendor.name] = vendor.aliases;
    candidate.subs.accounts ??= {};
    candidate.subs.accounts[vendor.name] = vendor.accounts;
    candidate.subs.matrix[vendor.name] = candidate.months.map(() => 0);
  }
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
    taxAccountSettings: restoreSettings.taxAccountSettings,
    existingTaxAccountSettings: args.destinationSettings.taxAccountSettings,
    receiptSourceProfiles: restoreSettings.receiptSourceProfiles,
    existingReceiptSourceProfiles: args.destinationSettings.receiptSourceProfiles,
    receiptSourceOverrides: restoreSettings.receiptSourceOverrides,
    existingReceiptSourceOverrides: args.destinationSettings.receiptSourceOverrides,
    restoredCashEntries: restoringCash ? args.restoredCashEntries : undefined,
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

  let preparedFiles: PreparedFile[] = [];
  // 「前回を残す」で実行しなかったunit。runにもR2にも載せないため、ここで結果だけ持つ
  const keptResults: UnitResult[] = [];
  let normMap: Record<string, string> = {};
  let restoreSettings: ImportRestoreSettingsSnapshot = {
    normMap: {},
    statMinMonths: DEFAULT_STAT_MIN_MONTHS,
    subVendorExclusions: [],
    cashEntries: [],
    freeeDeals: [],
    txSplits: [],
    taxAccountSettings: [],
    receiptSourceProfiles: [],
    receiptSourceOverrides: [],
    vendorMemories: [],
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
  // 見送ったunitも画面には出す。実行した分と混ざらないよう、順序は「実行→見送り」で固定する
  const all = [...results, ...keptResults];
  const ok = all.some((result) => result.status === 'committed');
  // 全件が重複スキップ/見送りなら「失敗」ではなく正常終了として 200 で返す(何も壊していない)
  const allSkipped =
    all.length > 0 && all.every((result) => result.status === 'duplicate' || result.status === 'kept');
  return c.json(
    { runId, results: all, ok, queryPlan, resolution: resolutionSummary },
    ok || allSkipped ? 200 : 400,
  );
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
  const protectedReferences = await c.env.DB.prepare(
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
      // 投入した原本をR2へ保存できた取込だけ、やり直し(再取込)の入口を出せる。
      // ここはkeyの有無しか見ない(100行ぶんHEADを打つのは割に合わない)。実在確認は原本取得時に行う。
      originalRecorded: r.r2Key !== null,
      /** 取込状態名ではなく、現在の所有・参照から帳簿取消の入口を出す。 */
      cancelable: importHistoryCancelable({
        status: r.status,
        activeTargetCount: activeCounts.get(r.id) ?? 0,
        canonicalRowCount: Number(protectedCounts.get(r.id)?.canonical_rows ?? 0),
      }),
      /** 帳簿本体ではなく、この履歴と不要原本だけを破棄できるか。最終判定は実行APIで再度行う。 */
      discardable:
        importHistoryDiscardBlock({
          status: r.status,
          activeTargetCount: activeCounts.get(r.id) ?? 0,
          canonicalRowCount: Number(protectedCounts.get(r.id)?.canonical_rows ?? 0),
          undoSnapshotCount: Number(protectedCounts.get(r.id)?.undo_snapshots ?? 0),
        }) === null,
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
    cashEntries: [],
    freeeDeals: [],
    txSplits: [],
    taxAccountSettings: [],
    receiptSourceProfiles: [],
    receiptSourceOverrides: [],
    vendorMemories: [],
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
