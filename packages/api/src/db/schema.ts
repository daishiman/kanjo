/**
 * Drizzle スキーマ(spec-v1.1 §7.2)。マイグレーションは migrations/ に手書きSQLで管理し、
 * このスキーマはクエリの型付けに使う(両者の対応はレビューで担保)。
 */
import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

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
  /** 0030: 3点比較の基準値(種別・名義)。NULL は「基準が分からない」で、空欄とは違う */
  baseCls: text('base_cls', { enum: ['biz', 'per'] }),
  baseOwner: text('base_owner', { enum: ['business', 'spouse', 'family'] }),
  /** 0032: NULL/''の「記録済み空」と未記録を区別。cls=1,big=2,mid=4,owner=8 */
  baseKnown: integer('base_known').notNull().default(0),
  /** 0030: tx_id が取れないときだけ使う第二の鍵(DR-13)。重複しうるので UNIQUE にしない */
  stableKey: text('stable_key'),
  /** 0030: stable_key の作り方の版。版違いの鍵を誤って照合しないための番号 */
  fingerprintVersion: integer('fingerprint_version'),
  /** 0031: 値一致で推測せず、決め事由来の手当てだけを安全に取り消す。 */
  origin: text('origin', { enum: ['manual', 'vendor_memory'] }),
  originKey: text('origin_key'),
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
  /** 最後に契約を見直した日時(ISO)。NULL は一度も見直していない */
  reviewedAt: text('reviewed_at'),
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
  kind: text('kind', { enum: ['freee', 'mf', 'json', 'assets'] }),
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
 * 0025: 明細の分割記帳。10万円の引き落としの中身を「食品3万・交通費2万…」に割る。
 * 元の明細(mf_transactions)は消さない。集計するときだけ内訳N行に差し替える。
 */
export const txSplits = sqliteTable(
  'tx_splits',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    /** 元の明細のID。分割は明細に付く */
    txId: text('tx_id').notNull(),
    /** seqの変更や再利用に影響されない、内訳行そのものの識別子 */
    lineId: text('line_id').notNull(),
    /** 同じ明細の中の並び。1から振る */
    seq: integer('seq').notNull(),
    /** 保存時の親金額。再取込で金額が変わったときのfail-closed判定に使う */
    parentAmount: integer('parent_amount').notNull(),
    /** 常に正。収入か支出かは元の明細の符号で決まる */
    amount: integer('amount').notNull(),
    cls: text('cls', { enum: ['biz', 'per'] }).notNull(),
    categoryMajor: text('category_major').notNull(),
    categoryMid: text('category_mid').notNull().default(''),
    memo: text('memo'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    uniqueIndex('idx_tx_splits_tx').on(t.userId, t.txId, t.seq),
    uniqueIndex('uq_tx_splits_line').on(t.userId, t.lineId),
  ],
);

/**
 * 0026: 月次の残高(BS)。資産はMFの資産推移CSVから、負債は画面の手入力から入る。
 * source を持つのは、CSVの取り込み直しで手入力の負債を消さないため。
 */
export const balanceEntries = sqliteTable(
  'balance_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    /** 'YYYY-MM' */
    month: text('month').notNull(),
    /** その月で採用した日付。月末とは限らない(まだ終わっていない月は取得日) */
    date: text('date').notNull(),
    side: text('side', { enum: ['asset', 'liability'] }).notNull(),
    category: text('category').notNull(),
    amount: integer('amount').notNull(),
    source: text('source', { enum: ['mf', 'manual'] }).notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    // 1つの月・側・種類につき1行。取込は upsert になる
    uniqueIndex('uq_balance_entries').on(t.userId, t.month, t.side, t.category),
    index('idx_balance_entries_month').on(t.userId, t.month),
  ],
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

/** 0028: 取引先ごとの証憑取得先。ログイン識別子のみで秘密値は持たない */
export const receiptSourceProfiles = sqliteTable(
  'receipt_source_profiles',
  {
    userId: text('user_id').notNull(),
    profileKey: text('profile_key').notNull(),
    merchantKey: text('merchant_key').notNull(),
    serviceName: text('service_name').notNull(),
    sourceUrl: text('source_url').notNull(),
    loginAccount: text('login_account'),
    memo: text('memo'),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.profileKey] }),
    index('idx_receipt_source_profiles_merchant').on(t.userId, t.merchantKey),
  ],
);

/** 0028: 安定targetごとの取得先例外。profile参照か明示値の一方を持つ */
export const receiptSourceOverrides = sqliteTable(
  'receipt_source_overrides',
  {
    userId: text('user_id').notNull(),
    targetKind: text('target_kind', { enum: ['cash', 'mf'] }).notNull(),
    targetKey: text('target_key').notNull(),
    /** 明細側の正規化した取引先キー */
    merchantKey: text('merchant_key').notNull(),
    /** 別の取引先profileを使う場合の参照先。明示例外ではNULL */
    profileKey: text('profile_key'),
    serviceName: text('service_name'),
    sourceUrl: text('source_url'),
    loginAccount: text('login_account'),
    memo: text('memo'),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.targetKind, t.targetKey] }),
    foreignKey({
      columns: [t.userId, t.profileKey],
      foreignColumns: [receiptSourceProfiles.userId, receiptSourceProfiles.profileKey],
    })
      .onUpdate('cascade')
      .onDelete('restrict'),
    index('idx_receipt_source_overrides_profile').on(t.userId, t.profileKey),
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
    /** 指示文を最後にコピーした日時と貼り付け先('claude_code' | 'codex')。上書き方式 */
    copiedAt: text('copied_at'),
    copiedTarget: text('copied_target', { enum: ['claude_code', 'codex'] }),
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

/**
 * 0027: 確定申告での科目の扱い。申告年ごとに決算書への割り当てと家事按分を1行で持つ。
 * 行が無い科目は未確認。全額事業でも100%を明示保存した行だけを確認済みとして扱う。
 */
export const taxAccountSettings = sqliteTable(
  'tax_account_settings',
  {
    userId: text('user_id').notNull(),
    /** 対象の申告年(2000..2099) */
    taxYear: integer('tax_year').notNull(),
    /** 帳簿上の科目名(正規化後) */
    account: text('account').notNull(),
    /** 転記先の決算書科目。NULL は未割当 */
    taxAccount: text('tax_account'),
    /** 家事按分の事業割合(0..100)。100は按分なし */
    businessPercent: integer('business_percent').notNull().default(100),
    /** 按分率の根拠。税務調査で聞かれるのはここ */
    basis: text('basis'),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [primaryKey({ columns: [t.userId, t.taxYear, t.account] })],
);

/** AI分析の統計設定(利用者ごと)。行が無ければ既定値として扱う */
export const analysisSettings = sqliteTable('analysis_settings', {
  userId: text('user_id').primaryKey(),
  /** 平均・標準偏差・移動平均・固定費判定に必要な記帳月数(既定6) */
  statMinMonths: integer('stat_min_months').notNull().default(6),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

/**
 * 0030: 削除・取り消しの操作1回ぶんの記録。
 * 範囲だけを持ち、明細の内容・金額は持たない(DR-9)。中身は importDeletedRows にある。
 */
export const importDeletionOperations = sqliteTable(
  'import_deletion_operations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind', { enum: ['delete', 'undo'] }).notNull(),
    granularity: text('granularity', {
      enum: ['transaction', 'import', 'period', 'all'],
    }).notNull(),
    /** 範囲の指定そのもの(JSON)。件数ではなく指定を残すので、あとから再現できる */
    requestJson: text('request_json').notNull(),
    /** preflight で見せた対象集合の指紋。実行時に一致しなければ 409(DR-1) */
    fingerprint: text('fingerprint').notNull(),
    countsJson: text('counts_json').notNull().default('{}'),
    /** この操作を取り消した操作のID。NULL なら未取り消し */
    undoneBy: text('undone_by'),
    /** 退避行を捨ててよくなる時刻(D04: 既定30日)。過ぎた操作の undo は 410 */
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [index('idx_deletion_operations_user').on(t.userId, t.createdAt)],
);

/**
 * 0030: 消した行そのものの退避。消す前に必ず書く(DR-2)。
 * undo は payloadJson を INSERT し直すだけで済む形にしてある。
 */
export const importDeletedRows = sqliteTable(
  'import_deleted_rows',
  {
    id: integer('id').primaryKey(),
    operationId: text('operation_id').notNull(),
    userId: text('user_id').notNull(),
    /** 戻し先のテーブル名。undo はこの名前で分岐する */
    tableName: text('table_name').notNull(),
    /** 元の行のID。mf_transactions が TEXT、他が INTEGER なので文字列で揃える */
    rowId: text('row_id').notNull(),
    /** 集計を作り直す対象月(DR-5) */
    month: text('month'),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    index('idx_deleted_rows_operation').on(t.operationId, t.tableName),
    uniqueIndex('uq_deleted_rows_row').on(t.operationId, t.tableName, t.rowId),
  ],
);

/**
 * 0030: 削除で巻き戻す取込指紋の退避(DR-4)。
 * import_active_targets は現在値しか持たないため、削除前の値はここにしか残らない。
 * 粒度が行ではなく target_key なので importDeletedRows とは別に持つ。
 */
export const importDeletedTargets = sqliteTable(
  'import_deleted_targets',
  {
    id: integer('id').primaryKey(),
    operationId: text('operation_id').notNull(),
    userId: text('user_id').notNull(),
    targetKey: text('target_key').notNull(),
    contentHash: text('content_hash').notNull(),
    importId: integer('import_id').notNull(),
    updatedAt: text('updated_at').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex('uq_deleted_targets_key').on(t.operationId, t.targetKey)],
);

/**
 * 0030: 取引先ごとの決め事。
 * hit と disagree を別々に持つ。割合1つに畳むと「1件中1件」と「40件中40件」が
 * どちらも 1.00 になり、区別できなくなる(D01)。
 */
export const vendorMemory = sqliteTable(
  'vendor_memory',
  {
    id: integer('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** 表記ゆれを寄せた照合キー(core の normalizeVendorKey) */
    vendorKey: text('vendor_key').notNull(),
    /** 画面に出す元の表記。照合には使わない */
    vendorLabel: text('vendor_label').notNull().default(''),
    cls: text('cls', { enum: ['biz', 'per'] }),
    categoryMajor: text('category_major'),
    categoryMid: text('category_mid'),
    owner: text('owner', { enum: ['business', 'spouse', 'family'] }),
    hitCount: integer('hit_count').notNull().default(0),
    disagreeCount: integer('disagree_count').notNull().default(0),
    /** 利用者が留めた決め事。件数によらず当てる */
    pinned: integer('pinned').notNull().default(0),
    /** 利用者が取り消した決め事。当てない・候補にも出さない */
    revoked: integer('revoked').notNull().default(0),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex('uq_vendor_memory_key').on(t.userId, t.vendorKey)],
);

/**
 * 0033 / 0034 / D8: 1操作1行の監査ヘッダ。400日保持。
 * 明細内容・金額の列を持たないことがプライバシー境界である。
 */
export const auditLogs = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    operationId: text('operation_id').notNull(),
    action: text('action', {
      enum: ['delete', 'undo', 'import_resolution', 'import_discard'],
    }).notNull(),
    /** 粒度と安全な期間/取込IDだけ。transactionの明細IDは含めない。 */
    scope: text('scope').notNull(),
    /** 件数だけの有界JSON。キーと値はaudit builderが検証する。 */
    countsJson: text('counts_json').notNull(),
    occurredAt: text('occurred_at').notNull(),
    result: text('result', { enum: ['succeeded', 'failed', 'rejected'] }).notNull(),
  },
  (t) => [
    uniqueIndex('uq_audit_log_operation').on(t.operationId),
    uniqueIndex('uq_audit_log_tenant_ref').on(t.id, t.userId),
    index('idx_audit_log_user_occurred').on(t.userId, t.occurredAt),
    index('idx_audit_log_retention').on(t.occurredAt, t.id),
  ],
);

/**
 * 0033 / D8: 判定した1属性1行の短期明細。90日保持。
 * txKey/sourceKeyは不透明keyで、明細本体は複製しない。
 */
export const auditLogDetails = sqliteTable(
  'audit_log_detail',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    auditId: text('audit_id').notNull(),
    userId: text('user_id').notNull(),
    txKey: text('tx_key').notNull(),
    attribute: text('attribute', {
      enum: ['cls', 'category_major', 'category_mid', 'owner'],
    }).notNull(),
    beforeValue: text('before_value'),
    afterValue: text('after_value'),
    reasonCode: text('reason_code').notNull(),
    sourceType: text('source_type', {
      enum: ['tx_edit', 'rule', 'vendor_memory', 'import', 'default', 'user_resolution', 'system'],
    }).notNull(),
    sourceKey: text('source_key'),
    occurredAt: text('occurred_at').notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.auditId, t.userId],
      foreignColumns: [auditLogs.id, auditLogs.userId],
    }).onDelete('cascade'),
    uniqueIndex('uq_audit_log_detail_decision').on(t.auditId, t.txKey, t.attribute),
    index('idx_audit_log_detail_user_occurred').on(t.userId, t.occurredAt),
    index('idx_audit_log_detail_retention').on(t.occurredAt, t.id),
  ],
);
