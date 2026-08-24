/**
 * Drizzle スキーマ(spec-v1.1 §7.2)。マイグレーションは migrations/ に手書きSQLで管理し、
 * このスキーマはクエリの型付けに使う(両者の対応はレビューで担保)。
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  keyword: text('keyword').notNull(),
  cls: text('cls', { enum: ['biz', 'per'] }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at'),
});

export const overrides = sqliteTable('overrides', {
  userId: text('user_id').notNull(),
  txId: text('tx_id').notNull(),
  cls: text('cls', { enum: ['biz', 'per'] }).notNull(),
  updatedAt: text('updated_at'),
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
  createdAt: text('created_at'),
});

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
  createdAt: text('created_at'),
});
