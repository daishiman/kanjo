/**
 * Drizzle スキーマ(spec-v1.1 §7.2)。マイグレーションは migrations/ に手書きSQLで管理し、
 * このスキーマはクエリの型付けに使う(両者の対応はレビューで担保)。
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  },
  (t) => [index('idx_deals_month').on(t.userId, t.month, t.io)],
);

/** 仕分けルール(0001 以降: 各属性 NULL = そのルールでは変えない) */
export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  keyword: text('keyword').notNull(),
  cls: text('cls', { enum: ['biz', 'per'] }),
  categoryMajor: text('category_major'),
  categoryMid: text('category_mid'),
  owner: text('owner', { enum: ['self', 'spouse'] }),
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
  owner: text('owner', { enum: ['self', 'spouse'] }),
  baseMajor: text('base_major'),
  baseMid: text('base_mid'),
  note: text('note'),
  updatedAt: text('updated_at'),
});

/** 保有金融機関 → 名義 */
export const institutionOwners = sqliteTable('institution_owners', {
  userId: text('user_id').notNull(),
  institution: text('institution').notNull(),
  owner: text('owner', { enum: ['self', 'spouse'] }).notNull(),
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

/** サブスクのベンダー登録(名前+別名)。aliases は JSON 配列文字列 */
export const subVendors = sqliteTable('sub_vendors', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  aliases: text('aliases').notNull().default('[]'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
});

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
  createdAt: text('created_at').$defaultFn(nowIso),
});

/** 現金の記帳(0006)。口座・カード明細に出ない現金の受け渡しを明細として持つ */
export const cashEntries = sqliteTable(
  'cash_entries',
  {
    id: integer('id').primaryKey(),
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
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [index('idx_cash_month').on(t.userId, t.month)],
);

export const monthlyAgg = sqliteTable('monthly_agg', {
  userId: text('user_id').notNull(),
  month: text('month').notNull(),
  scope: text('scope').notNull(),
  amount: integer('amount').notNull(),
});

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
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    index('idx_ai_reports_user').on(t.userId, t.createdAt),
    index('idx_ai_reports_period').on(t.userId, t.periodKind, t.periodKey),
    index('idx_ai_reports_type').on(t.userId, t.reportType, t.periodFrom, t.periodTo),
  ],
);
