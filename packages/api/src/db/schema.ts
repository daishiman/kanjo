/**
 * Drizzle スキーマ(spec-v1.1 §7.2)。マイグレーションは migrations/ に手書きSQLで管理し、
 * このスキーマはクエリの型付けに使う(両者の対応はレビューで担保)。
 */
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * 作成日時の既定値。drizzle は values() に無い列へ明示的に NULL を入れるため、
 * SQL 側の DEFAULT datetime('now') は効かない(本番の imports.created_at が全件 NULL だった原因)。
 */
const nowIso = () => new Date().toISOString();

export const mfTransactions = sqliteTable(
  'mf_transactions',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    txId: text('tx_id').notNull(),
    month: text('month').notNull(),
    date: text('date').notNull(),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    categoryMajor: text('category_major'),
    categoryMid: text('category_mid'),
    institution: text('institution'),
    /** MFの「メモ」列。原本のまま保持する */
    memo: text('memo'),
    /** MFの「計算対象」列。0 = 集計に含めない行 */
    isTarget: integer('is_target').notNull().default(1),
    /** MFの「振替」列。1 = 口座間振替であり収支集計に含めない行 */
    isTransfer: integer('is_transfer').notNull().default(0),
    /** 1 = MFのID列由来。0/旧データは添付不可とする */
    identityStable: integer('identity_stable').notNull().default(0),
    importId: integer('import_id'),
  },
  (t) => [uniqueIndex('uq_mftx_user_tx').on(t.userId, t.txId), index('idx_mftx_month').on(t.userId, t.month)],
);

export const freeeDeals = sqliteTable(
  'freee_deals',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    month: text('month').notNull(),
    date: text('date').notNull(),
    io: text('io', { enum: ['income', 'expense'] }).notNull(),
    partner: text('partner'),
    accountRaw: text('account_raw'),
    accountNorm: text('account_norm'),
    amount: integer('amount').notNull(),
    memo: text('memo'),
    importId: integer('import_id'),
    /* 決済(0015)。settlementKnown=0 は決済列の無い取込で、未決済判定の対象外 */
    dueDate: text('due_date'),
    settledDate: text('settled_date'),
    settleAccount: text('settle_account'),
    settledAmount: integer('settled_amount'),
    settlementKnown: integer('settlement_known').notNull().default(0),
  },
  (t) => [
    index('idx_deals_month').on(t.userId, t.month, t.io),
    index('idx_deals_settlement').on(t.userId, t.settlementKnown, t.settledDate, t.dueDate),
  ],
);

/** 仕分けルール(0001 以降: 各属性 NULL = そのルールでは変えない) */
export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  keyword: text('keyword').notNull(),
  cls: text('cls', { enum: ['biz', 'per'] }),
  categoryMajor: text('category_major'),
  categoryMid: text('category_mid'),
  owner: text('owner', { enum: ['business', 'spouse', 'family'] }),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').$defaultFn(nowIso),
});

/** 旧・手動判定(0001 で tx_edits へ移行済み。読み書きしない) */
export const overrides = sqliteTable('overrides', {
  userId: text('user_id').notNull(),
  txId: text('tx_id').notNull(),
  cls: text('cls', { enum: ['biz', 'per'] }).notNull(),
  updatedAt: text('updated_at'),
});

/** 明細の手動編集(取込値とは別枠。同一性キー = MF の ID 列) */
export const txEdits = sqliteTable('tx_edits', {
  userId: text('user_id').notNull(),
  txId: text('tx_id').notNull(),
  cls: text('cls', { enum: ['biz', 'per'] }),
  categoryMajor: text('category_major'),
  categoryMid: text('category_mid'),
  owner: text('owner', { enum: ['business', 'spouse', 'family'] }),
  baseMajor: text('base_major'),
  baseMid: text('base_mid'),
  note: text('note'),
  updatedAt: text('updated_at'),
});

/** 保有金融機関 → 名義 */
export const institutionOwners = sqliteTable('institution_owners', {
  userId: text('user_id').notNull(),
  institution: text('institution').notNull(),
  owner: text('owner', { enum: ['business', 'spouse', 'family'] }).notNull(),
});

/** 大項目/中項目の追加候補 */
export const categoryOptions = sqliteTable('category_options', {
  userId: text('user_id').notNull(),
  /** biz: freee 勘定科目(決算書の科目) / per: MF 大項目・中項目(家計の内訳) */
  scope: text('scope', { enum: ['biz', 'per'] })
    .notNull()
    .default('per'),
  major: text('major').notNull(),
  mid: text('mid').notNull(),
});

/** サブスクのベンダー登録(名前+別名+対象科目)。aliases / accounts は JSON 配列文字列 */
export const subVendors = sqliteTable('sub_vendors', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  aliases: text('aliases').notNull().default('[]'),
  /** 対象勘定科目の原本名。旧行の正規化後ラベルも互換照合する。'[]' なら全科目 */
  accounts: text('accounts').notNull().default('[]'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
});

/** 「これはサブスクではない」と記録した支払先。候補一覧から外すためだけに使う */
export const subVendorExclusions = sqliteTable(
  'sub_vendor_exclusions',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    partner: text('partner').notNull(),
    /** 表記ゆれを吸収した照合キー(core の vendorKey) */
    vendorKey: text('vendor_key').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex('uq_sub_vendor_exclusions_user_key').on(t.userId, t.vendorKey)],
);

export const budgets = sqliteTable('budgets', {
  userId: text('user_id').notNull(),
  account: text('account').notNull(),
  monthlyAmount: integer('monthly_amount'),
});

export const cashOverrides = sqliteTable('cash_overrides', {
  userId: text('user_id').notNull(),
  month: text('month').notNull(),
  revenue: integer('revenue'),
  expense: integer('expense'),
});

export const unrecordedMonths = sqliteTable('unrecorded_months', {
  userId: text('user_id').notNull(),
  month: text('month').notNull(),
  kind: text('kind', { enum: ['expense', 'revenue'] }).notNull(),
});

export const accountNormMap = sqliteTable('account_norm_map', {
  userId: text('user_id').notNull(),
  raw: text('raw').notNull(),
  norm: text('norm').notNull(),
});

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  filename: text('filename'),
  kind: text('kind', { enum: ['freee', 'mf', 'json'] }),
  months: text('months'),
  rowCount: integer('row_count'),
  status: text('status'),
  r2Key: text('r2_key'),
  /** 取込単位の内容指紋(0006)。ファイル名・形式・行順に依らず同じ内容なら同じ値 */
  contentHash: text('content_hash'),
  /** 重複としてスキップしたとき、元になった取込のID */
  duplicateOf: integer('duplicate_of'),
  /** 0008: multipart request/session */
  runId: text('run_id'),
  /** 0008: domain×month/globalのwrite-set key(JSON配列) */
  targetKeys: text('target_keys'),
  /** 0008: statusと分離したparse/runtime失敗理由 */
  failureReason: text('failure_reason'),
  /** 0008: content_hashのcanonical encoding version */
  fingerprintVersion: integer('fingerprint_version'),
  committedAt: text('committed_at'),
  createdAt: text('created_at').$defaultFn(nowIso),
});

/** 0008: upload request/session。logical unitはimports.run_idで所属する。 */
export const importRuns = sqliteTable(
  'import_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    status: text('status', {
      enum: ['processing', 'applying', 'committed', 'failed', 'duplicate'],
    }).notNull(),
    failureReason: text('failure_reason'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_import_runs_user_created').on(table.userId, table.createdAt)],
);

/**
 * 0008: 同一利用者の取込writerをDBで1件に直列化する期限付きclaim。
 * 受理前にもrunIdを所有tokenとして使うためFKは持たず、監査履歴には数えない。
 */
export const importWriterClaims = sqliteTable('import_writer_claims', {
  userId: text('user_id').primaryKey(),
  runId: text('run_id').notNull(),
  claimedAt: integer('claimed_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

/** 0008: 現在適用中のfingerprint。過去履歴とbusiness duplicateを分離する。 */
export const importActiveTargets = sqliteTable(
  'import_active_targets',
  {
    userId: text('user_id').notNull(),
    targetKey: text('target_key').notNull(),
    contentHash: text('content_hash').notNull(),
    importId: integer('import_id').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.targetKey] }),
    index('idx_import_active_import').on(table.userId, table.importId),
  ],
);

/** 現金の記帳(0006、ID非再利用は0007)。口座・カード明細に出ない現金の受け渡しを明細として持つ */
export const cashEntries = sqliteTable(
  'cash_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    date: text('date').notNull(),
    month: text('month').notNull(),
    side: text('side', { enum: ['biz', 'per'] }).notNull(),
    io: text('io', { enum: ['income', 'expense'] }).notNull(),
    amount: integer('amount').notNull(),
    description: text('description').notNull(),
    categoryMajor: text('category_major').notNull(),
    categoryMid: text('category_mid').notNull().default(''),
    memo: text('memo'),
    /** 0010: 交通費の区間。from/to は両方入るか両方 NULL */
    transitFrom: text('transit_from'),
    transitTo: text('transit_to'),
    /** 0010: 1 = 往復 */
    transitRound: integer('transit_round').notNull().default(0),
    /** 0010: 1 = 証憑不要(電車代など領収書が出ない支出) */
    receiptWaived: integer('receipt_waived').notNull().default(0),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [index('idx_cash_month').on(t.userId, t.month)],
);

/**
 * 0010/0011: レシート・領収書の添付。原本は R2、この表はメタデータと
 * R2削除の再試行状態を持つ。添付先は接頭辞付き文字列ではなく種別+安定keyで表す。
 */
export const attachments = sqliteTable(
  'attachments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    targetKind: text('target_kind', { enum: ['cash', 'mf'] }).notNull(),
    targetKey: text('target_key').notNull(),
    r2Key: text('r2_key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    contentHash: text('content_hash').notNull(),
    state: text('state', { enum: ['ready', 'delete_pending', 'delete_failed'] })
      .notNull()
      .default('ready'),
    deleteAttempts: integer('delete_attempts').notNull().default(0),
    deleteRequestedAt: text('delete_requested_at'),
    lastDeleteError: text('last_delete_error'),
    /** 0012: NULLなら原本が存在し得る。非NULLはR2 DELETE成功済みの単調fact */
    objectDeletedAt: text('object_deleted_at'),
    /** 0012: MF洗替えで親が不在になった時刻。再出現時はNULLへ戻す */
    parentMissingAt: text('parent_missing_at'),
    cleanupDeadLetterAt: text('cleanup_dead_letter_at'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    index('idx_attachments_target').on(t.userId, t.targetKind, t.targetKey, t.state),
    uniqueIndex('uq_attachments_r2key').on(t.r2Key),
    uniqueIndex('uq_attachments_dup').on(t.userId, t.targetKind, t.targetKey, t.contentHash),
  ],
);

/** 0012: R2/D1境界をscheduled処理へ引き継ぐdurable outbox。 */
export const attachmentCleanupJobs = sqliteTable(
  'attachment_cleanup_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    attachmentId: integer('attachment_id'),
    importId: integer('import_id'),
    r2Key: text('r2_key').notNull(),
    size: integer('size').notNull().default(0),
    action: text('action', { enum: ['delete_object', 'delete_metadata'] }).notNull(),
    reason: text('reason', { enum: ['upload_intent', 'attachment_delete', 'import_retention'] }).notNull(),
    state: text('state', { enum: ['pending', 'retry', 'dead'] })
      .notNull()
      .default('pending'),
    attempts: integer('attempts').notNull().default(0),
    notBefore: text('not_before').notNull(),
    lastError: text('last_error'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex('uq_attachment_cleanup_r2key').on(t.userId, t.r2Key),
    index('idx_attachment_cleanup_due').on(t.state, t.notBefore, t.id),
    index('idx_attachment_cleanup_attachment').on(t.userId, t.attachmentId),
  ],
);

/** 0013: cleanup job/metadata消去後も明示削除済みkeyをarchiveから復活させない単調fact。 */
export const attachmentObjectTombstones = sqliteTable(
  'attachment_object_tombstones',
  {
    userId: text('user_id').notNull(),
    r2Key: text('r2_key').notNull(),
    deletedAt: text('deleted_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.r2Key] }),
    index('idx_attachment_object_tombstones_deleted').on(table.deletedAt),
  ],
);

/** 0014: password loginの接続元scope別rate limit。raw IP/passwordは保存しない。 */
export const passwordLoginRateLimits = sqliteTable(
  'password_login_rate_limits',
  {
    scopeHash: text('scope_hash').primaryKey(),
    windowStartedAt: integer('window_started_at').notNull(),
    failureCount: integer('failure_count').notNull(),
    lockedUntil: integer('locked_until'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_password_login_rate_limits_updated').on(table.updatedAt)],
);

export const monthlyAgg = sqliteTable('monthly_agg', {
  userId: text('user_id').notNull(),
  month: text('month').notNull(),
  scope: text('scope').notNull(),
  amount: integer('amount').notNull(),
});

/** JSON復元由来の集計baseline(0007)。monthly_aggはこれと現在の原本/現金から作る派生キャッシュ */
export const restoredMonthlyAgg = sqliteTable(
  'restored_monthly_agg',
  {
    userId: text('user_id').notNull(),
    month: text('month').notNull(),
    scope: text('scope').notNull(),
    amount: integer('amount').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month, t.scope] })],
);

export const tradeoffPlans = sqliteTable('tradeoff_plans', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title'),
  amount: integer('amount').notNull(),
  recurring: integer('recurring').notNull(),
  selected: text('selected'),
  covered: integer('covered'),
  verdict: text('verdict'),
  createdAt: text('created_at').$defaultFn(nowIso),
});

/** AI分析の依頼(期間 + 使い捨てトークンのハッシュ)。原文トークンは保存しない */
export const aiTasks = sqliteTable(
  'ai_tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** 旧形式(月/年)。新規行は 'range' 固定で period_from/to が正本 */
    periodKind: text('period_kind').notNull().default('range'),
    periodKey: text('period_key').notNull().default(''),
    periodFrom: text('period_from').notNull(),
    periodTo: text('period_to').notNull(),
    reportType: text('report_type', { enum: ['monthly', 'annual', 'longterm'] }).notNull(),
    /** 再分析時に利用者が補った情報(任意) */
    supplement: text('supplement'),
    /** 再分析の元になったレポート(任意) */
    parentReportId: text('parent_report_id'),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    reportId: text('report_id'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex('uq_ai_tasks_token').on(t.tokenHash),
    index('idx_ai_tasks_user').on(t.userId, t.createdAt),
  ],
);

/** 受信したAI分析レポート(検証・無害化済みJSON) */
export const aiReports = sqliteTable(
  'ai_reports',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    taskId: text('task_id').notNull(),
    periodKind: text('period_kind').notNull().default('range'),
    periodKey: text('period_key').notNull().default(''),
    periodFrom: text('period_from').notNull(),
    periodTo: text('period_to').notNull(),
    reportType: text('report_type', { enum: ['monthly', 'annual', 'longterm'] }).notNull(),
    /** 同じ期間・型のレポートの通し番号(再分析で増える) */
    version: integer('version').notNull().default(1),
    parentReportId: text('parent_report_id'),
    generatedBy: text('generated_by').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    bodyJson: text('body_json').notNull(),
    /** アーカイブした日時。NULL = 通常表示(削除ではないので本文は残る) */
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    index('idx_ai_reports_user').on(t.userId, t.createdAt),
    index('idx_ai_reports_period').on(t.userId, t.periodKind, t.periodKey),
    index('idx_ai_reports_type').on(t.userId, t.reportType, t.periodFrom, t.periodTo),
    index('idx_ai_reports_archived').on(t.userId, t.archivedAt, t.createdAt),
  ],
);

/** AI分析の統計設定(利用者ごと)。行が無ければ既定値として扱う */
export const analysisSettings = sqliteTable('analysis_settings', {
  userId: text('user_id').primaryKey(),
  /** 平均・標準偏差・移動平均・固定費判定に必要な記帳月数(既定6) */
  statMinMonths: integer('stat_min_months').notNull().default(6),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});
