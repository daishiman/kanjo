/**
 * D1 ⇔ Dataset(HTML版DATA形状) の変換層。
 *
 * - monthly_agg は表示用の派生キャッシュ。JSON復元でしか得られない値は
 *   restored_monthly_agg を正本(baseline)とし、現在の freee/MF/現金原本と合成する。
 * - 同月に原本CSVがあればそちらを正とし、原本が無い月だけ baseline + 現金とする。
 */
import {
  type CashEntry,
  DEFAULT_RULES,
  type Dataset,
  type FreeeDeal,
  type MfTx,
  type Owner,
  type Rule,
  type SubVendor,
  type TxEdit,
  applyClassification,
  applyFreeeDeals,
  cashBizDeals,
  cashToTx,
  emptyDataset,
  ensureMonth,
  exportJSON,
  isCashTxId,
  matchSubVendor,
  normalizeAccount,
  normalizeOwner,
  recomputeClassification,
  subVendorDefs,
} from '@kanjo/core';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as s from './db/schema.js';
import { invalidateJsonSnapshotQuery } from './import-active.js';

export type Db = ReturnType<typeof drizzle>;

export const getDb = (d1: D1Database): Db => drizzle(d1);

type AggValue = { month: string; scope: string; amount: number };

export interface CashProjectionEnvelope {
  version: 1;
  basis: 'post-resolution';
  rows: AggValue[];
}

export class CashProjectionError extends Error {
  constructor(public readonly code: 'invalid_cash_projection' | 'cash_projection_underflow') {
    super(code);
    this.name = 'CashProjectionError';
  }
}

const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const personalBaselineMonths = (rows: ReadonlyArray<AggValue>): Set<string> =>
  new Set(
    rows
      .filter(
        (r) =>
          r.scope === 'biz_personal_in' ||
          r.scope === 'biz_personal_out' ||
          r.scope.startsWith('per_inc:') ||
          r.scope.startsWith('per_exp:'),
      )
      .map((r) => r.month),
  );

const businessBaselineMonths = (rows: ReadonlyArray<AggValue>): Set<string> =>
  new Set(
    rows
      .filter(
        (r) =>
          r.scope === 'biz_rev' ||
          r.scope === 'subs_other' ||
          r.scope.startsWith('biz_exp:') ||
          r.scope.startsWith('subs:'),
      )
      .map((r) => r.month),
  );

/** 原本MFが無い月に限り、復元baselineを現在の個人明細集計へ加算する */
function addPersonalBaseline(
  data: Dataset,
  rows: ReadonlyArray<AggValue>,
  months: ReadonlySet<string>,
): void {
  for (const r of rows) {
    if (!months.has(r.month)) continue;
    if (r.scope === 'biz_personal_in') {
      data.bizPersonal[r.month] ??= { income: 0, expense: 0 };
      data.bizPersonal[r.month].income += r.amount;
    } else if (r.scope === 'biz_personal_out') {
      data.bizPersonal[r.month] ??= { income: 0, expense: 0 };
      data.bizPersonal[r.month].expense += r.amount;
    } else if (r.scope.startsWith('per_inc:')) {
      data.personal[r.month] ??= { income: {}, expense: {} };
      const category = r.scope.slice('per_inc:'.length);
      data.personal[r.month].income[category] = (data.personal[r.month].income[category] ?? 0) + r.amount;
    } else if (r.scope.startsWith('per_exp:')) {
      data.personal[r.month] ??= { income: {}, expense: {} };
      const category = r.scope.slice('per_exp:'.length);
      data.personal[r.month].expense[category] = (data.personal[r.month].expense[category] ?? 0) + r.amount;
    }
  }
}

/** 原本freeeが無い月に限り、復元baselineを現在の事業現金集計へ加算する */
function addBusinessBaseline(
  data: Dataset,
  rows: ReadonlyArray<AggValue>,
  months: ReadonlySet<string>,
): void {
  for (const r of rows) {
    if (!months.has(r.month)) continue;
    const i = ensureMonth(data, r.month);
    if (r.scope === 'biz_rev') {
      data.biz.revenue[i] += r.amount;
    } else if (r.scope.startsWith('biz_exp:')) {
      const category = r.scope.slice('biz_exp:'.length);
      if (!data.biz.categories.includes(category)) {
        data.biz.categories.push(category);
        data.biz.expense[category] = data.months.map(() => 0);
      }
      data.biz.expense[category][i] += r.amount;
    } else if (r.scope === 'subs_other') {
      data.subs.other[i] += r.amount;
    } else if (r.scope.startsWith('subs:')) {
      const vendor = r.scope.slice('subs:'.length);
      // ベンダー削除はbaselineより優先し、削除済みの列を再生しない。
      if (data.subs.vendors.includes(vendor)) data.subs.matrix[vendor][i] += r.amount;
    }
  }
}

/**
 * JSON restore後のcandidateを、永続化後にloadDatasetが再構成するのと同じ
 * baseline + 現存freee/MF/cash原本の意味へ揃える。
 */
export function mergeRestoreCanonicalSources(args: {
  data: Dataset;
  restored: Dataset;
  freeeDeals: ReadonlyArray<FreeeDeal>;
  cashEntries: ReadonlyArray<CashEntry>;
  normMap: Record<string, string>;
}): void {
  const baselineRows = aggRowsFromDataset('', args.restored);
  const rawMfMonths = new Set(args.data.mfTx.filter((tx) => !isCashTxId(tx.id)).map((tx) => tx.m));
  mergeCashTxs(args.data, [...args.cashEntries]);
  addPersonalBaseline(
    args.data,
    baselineRows,
    new Set([...personalBaselineMonths(baselineRows)].filter((month) => !rawMfMonths.has(month))),
  );

  const normalizedDeals = args.freeeDeals.map((deal) => ({
    ...deal,
    accountNorm: normalizeAccount(deal.accountRaw, args.normMap),
  }));
  const freeeMonths = new Set(normalizedDeals.map((deal) => deal.month));
  const cashDeals = cashBizDeals([...args.cashEntries], args.normMap);
  const businessMonths = new Set([
    ...freeeMonths,
    ...businessBaselineMonths(baselineRows),
    ...cashDeals.map((deal) => deal.month),
  ]);
  if (!businessMonths.size) return;

  const unrecordedBefore = [...args.data.unrecordedExpMonths];
  applyFreeeDeals(args.data, [...normalizedDeals, ...cashDeals], [...businessMonths]);
  addBusinessBaseline(
    args.data,
    baselineRows,
    new Set([...businessMonths].filter((month) => !freeeMonths.has(month))),
  );
  args.data.unrecordedExpMonths = [
    ...new Set([
      ...args.data.unrecordedExpMonths,
      ...unrecordedBefore.filter((month) => !freeeMonths.has(month)),
    ]),
  ].sort();
}

/* ------------------------- 行 ⇔ 型 ------------------------- */

export const ruleFromRow = (r: typeof s.rules.$inferSelect): Rule => ({
  k: r.keyword,
  cls: r.cls ?? null,
  big: r.categoryMajor ?? null,
  mid: r.categoryMid ?? null,
  owner: r.owner ?? null,
});

/** ルール評価の正規順序。sort_order同値時もidで決定的にする。 */
export async function loadOrderedRuleRows(db: Db, userId: string) {
  return db
    .select()
    .from(s.rules)
    .where(eq(s.rules.userId, userId))
    .orderBy(asc(s.rules.sortOrder), asc(s.rules.id));
}

/** DB未登録時の既定ルールfallbackもこの一箇所に集約する。 */
export const effectiveRules = (rows: ReadonlyArray<typeof s.rules.$inferSelect>): Rule[] =>
  rows.length ? rows.map(ruleFromRow) : [...DEFAULT_RULES];

export const editFromRow = (r: typeof s.txEdits.$inferSelect): TxEdit => ({
  cls: r.cls ?? null,
  big: r.categoryMajor ?? null,
  mid: r.categoryMid ?? null,
  owner: r.owner ?? null,
  baseBig: r.baseMajor ?? null,
  baseMid: r.baseMid ?? null,
  note: r.note ?? null,
  updatedAt: r.updatedAt ?? null,
});

/** 編集が空(全属性 null)なら行ごと消す */
export const editIsEmpty = (e: TxEdit): boolean => !e.cls && !e.big && !e.mid && !e.owner;

export async function upsertEdit(db: Db, userId: string, txId: string, e: TxEdit): Promise<void> {
  const remove = db.delete(s.txEdits).where(and(eq(s.txEdits.userId, userId), eq(s.txEdits.txId, txId)));
  const invalidate = invalidateJsonSnapshotQuery(db, userId, 'tx_edits');
  if (editIsEmpty(e)) {
    await db.batch([remove, invalidate]);
  } else {
    await db.batch([
      remove,
      db.insert(s.txEdits).values({
        userId,
        txId,
        cls: e.cls ?? null,
        categoryMajor: e.big ?? null,
        categoryMid: e.mid ?? null,
        owner: e.owner ?? null,
        baseMajor: e.baseBig ?? null,
        baseMid: e.baseMid ?? null,
        note: e.note ?? null,
        updatedAt: e.updatedAt ?? new Date().toISOString(),
      }),
      invalidate,
    ]);
  }
}

export async function replaceEdits(db: Db, userId: string, edits: Record<string, TxEdit>): Promise<void> {
  await db.delete(s.txEdits).where(eq(s.txEdits.userId, userId));
  const rows = Object.entries(edits)
    .filter(([, e]) => !editIsEmpty(e))
    .map(([txId, e]) => ({
      userId,
      txId,
      cls: e.cls ?? null,
      categoryMajor: e.big ?? null,
      categoryMid: e.mid ?? null,
      owner: e.owner ?? null,
      baseMajor: e.baseBig ?? null,
      baseMid: e.baseMid ?? null,
      note: e.note ?? null,
      updatedAt: e.updatedAt ?? null,
    }));
  for (const grp of chunk(rows, 9)) await db.insert(s.txEdits).values(grp);
}

export async function replaceInstitutionOwners(
  db: Db,
  userId: string,
  map: Record<string, Owner>,
): Promise<void> {
  const rows = Object.entries(map).map(([institution, owner]) => ({ userId, institution, owner }));
  const inserts = chunk(rows, 30).map((group) => db.insert(s.institutionOwners).values(group));
  await db.batch([
    db.delete(s.institutionOwners).where(eq(s.institutionOwners.userId, userId)),
    ...inserts,
    invalidateJsonSnapshotQuery(db, userId, 'institution_owners'),
  ]);
}

/* ------------------------- 読み出し ------------------------- */

/** cash snapshotを渡したloadDatasetが発行するSELECT数。query plannerとloaderの契約。 */
export const LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT = 10;

export async function loadDataset(
  db: Db,
  userId: string,
  cashEntriesSnapshot?: ReadonlyArray<CashEntry>,
): Promise<Dataset> {
  const [
    aggRows,
    baselineRows,
    txRows,
    ruleRows,
    editRows,
    budgetRows,
    cashRows,
    unrecRows,
    instRows,
    vendorRows,
    cashEntries,
  ] = await Promise.all([
    db.select().from(s.monthlyAgg).where(eq(s.monthlyAgg.userId, userId)),
    db.select().from(s.restoredMonthlyAgg).where(eq(s.restoredMonthlyAgg.userId, userId)),
    db
      .select()
      .from(s.mfTransactions)
      .where(eq(s.mfTransactions.userId, userId))
      .orderBy(asc(s.mfTransactions.month), asc(s.mfTransactions.date)),
    loadOrderedRuleRows(db, userId),
    db.select().from(s.txEdits).where(eq(s.txEdits.userId, userId)),
    db.select().from(s.budgets).where(eq(s.budgets.userId, userId)),
    db.select().from(s.cashOverrides).where(eq(s.cashOverrides.userId, userId)),
    db.select().from(s.unrecordedMonths).where(eq(s.unrecordedMonths.userId, userId)),
    db.select().from(s.institutionOwners).where(eq(s.institutionOwners.userId, userId)),
    loadSubVendors(db, userId),
    cashEntriesSnapshot ? Promise.resolve([...cashEntriesSnapshot]) : loadCashEntries(db, userId),
  ]);

  const data = emptyDataset();

  // 月の全集合(集計キャッシュ+復元baseline+明細)
  const monthSet = new Set<string>();
  aggRows.forEach((r) => monthSet.add(r.month));
  baselineRows.forEach((r) => monthSet.add(r.month));
  txRows.forEach((r) => monthSet.add(r.month));
  cashEntries.forEach((e) => monthSet.add(e.month));
  data.months = [...monthSet].sort();
  const idx = new Map(data.months.map((m, i) => [m, i]));

  // 事業側の系列を monthly_agg から復元
  const catSet = new Set<string>();
  // ベンダーは sub_vendors が正。集計キャッシュに残る登録外の名前(削除直後など)も読み出しだけは通す
  const vendorSet = new Set<string>(vendorRows.map((v) => v.name));
  for (const r of [...aggRows, ...baselineRows]) {
    if (r.scope.startsWith('biz_exp:')) catSet.add(r.scope.slice('biz_exp:'.length));
    else if (r.scope.startsWith('subs:')) vendorSet.add(r.scope.slice('subs:'.length));
  }
  data.biz.revenue = data.months.map(() => 0);
  data.biz.categories = [...catSet];
  data.biz.categories.forEach((c) => {
    data.biz.expense[c] = data.months.map(() => 0);
  });
  data.subs.vendors = [...vendorSet];
  data.subs.aliases = Object.fromEntries(vendorRows.map((v) => [v.name, v.aliases]));
  data.subs.vendors.forEach((v) => {
    data.subs.matrix[v] = data.months.map(() => 0);
  });
  data.subs.other = data.months.map(() => 0);

  for (const r of aggRows) {
    const i = idx.get(r.month);
    if (i === undefined) continue;
    if (r.scope === 'biz_rev') data.biz.revenue[i] = r.amount;
    else if (r.scope.startsWith('biz_exp:')) data.biz.expense[r.scope.slice('biz_exp:'.length)][i] = r.amount;
    else if (r.scope.startsWith('subs:')) data.subs.matrix[r.scope.slice('subs:'.length)][i] = r.amount;
    else if (r.scope === 'subs_other') data.subs.other[i] = r.amount;
    else if (r.scope === 'biz_personal_in') {
      data.bizPersonal[r.month] ??= { income: 0, expense: 0 };
      data.bizPersonal[r.month].income = r.amount;
    } else if (r.scope === 'biz_personal_out') {
      data.bizPersonal[r.month] ??= { income: 0, expense: 0 };
      data.bizPersonal[r.month].expense = r.amount;
    } else if (r.scope.startsWith('per_inc:')) {
      data.personal[r.month] ??= { income: {}, expense: {} };
      data.personal[r.month].income[r.scope.slice('per_inc:'.length)] = r.amount;
    } else if (r.scope.startsWith('per_exp:')) {
      data.personal[r.month] ??= { income: {}, expense: {} };
      data.personal[r.month].expense[r.scope.slice('per_exp:'.length)] = r.amount;
    }
  }

  data.mfTx = txRows.map(
    (r): MfTx => ({
      id: r.txId,
      idStable: r.identityStable === 1,
      m: r.month,
      d: r.date.slice(5).replace('-', '/'),
      c: r.description,
      a: r.amount,
      big: r.categoryMajor ?? '',
      mid: r.categoryMid ?? '',
      inst: r.institution ?? undefined,
    }),
  );
  data.rules = effectiveRules(ruleRows);
  editRows.forEach((r) => {
    data.edits[r.txId] = editFromRow(r);
  });
  instRows.forEach((r) => {
    data.institutionOwners[r.institution] = r.owner;
  });
  budgetRows.forEach((r) => {
    if (r.monthlyAmount != null) data.budgets[r.account] = r.monthlyAmount;
  });
  cashRows.forEach((r) => {
    data.cashOverride[r.month] = { revenue: r.revenue ?? 0, expense: r.expense ?? 0 };
  });
  data.unrecordedExpMonths = unrecRows.filter((r) => r.kind === 'expense').map((r) => r.month);

  // 個人分の現金明細を口座「現金」の明細として合流させ、生明細がある月は再計算が正(ルール・手動判定の現在値を反映)
  mergeCashTxs(data, cashEntries);
  const rawMfMonths = new Set(txRows.map((r) => r.month));
  const cashOnlyPersonalMonths = new Set(
    cashEntries.filter((e) => e.side === 'per' && !rawMfMonths.has(e.month)).map((e) => e.month),
  );
  addPersonalBaseline(data, baselineRows, cashOnlyPersonalMonths);
  return data;
}

/* ------------------------- 現金の記帳 ------------------------- */

export const cashFromRow = (r: typeof s.cashEntries.$inferSelect): CashEntry => ({
  id: r.id,
  date: r.date,
  month: r.month,
  side: r.side,
  io: r.io,
  amount: r.amount,
  description: r.description,
  categoryMajor: r.categoryMajor,
  categoryMid: r.categoryMid,
  memo: r.memo ?? null,
  transitFrom: r.transitFrom ?? null,
  transitTo: r.transitTo ?? null,
  transitRound: r.transitRound === 1,
  receiptWaived: r.receiptWaived === 1,
});

/** 日付の新しい順(同日はIDの新しい順) */
export async function loadCashEntries(db: Db, userId: string): Promise<CashEntry[]> {
  const rows = await db
    .select()
    .from(s.cashEntries)
    .where(eq(s.cashEntries.userId, userId))
    .orderBy(desc(s.cashEntries.date), desc(s.cashEntries.id));
  return rows.map(cashFromRow);
}

/**
 * 個人分の現金明細(cash:*)を MF 明細に合流させて仕分けを再計算する。
 * JSON復元で data.mfTx が丸ごと差し替わった後にも呼び、現金明細が落ちないようにする。
 */
export function mergeCashTxs(data: Dataset, entries: CashEntry[]): void {
  const cash = entries.filter((e) => e.side === 'per').map(cashToTx);
  data.mfTx = data.mfTx.filter((t) => !isCashTxId(t.id)).concat(cash);
  cash.forEach((t) => ensureMonth(data, t.m));
  recomputeClassification(data);
}

const withoutCashEdits = (edits: Record<string, TxEdit>): Record<string, TxEdit> =>
  Object.fromEntries(Object.entries(edits).filter(([txId]) => !isCashTxId(txId)));

const projectionKey = (row: AggValue): string => `${row.month}\u0000${row.scope}`;

const addProjection = (map: Map<string, AggValue>, row: AggValue): void => {
  const key = projectionKey(row);
  const current = map.get(key);
  map.set(key, { ...row, amount: (current?.amount ?? 0) + row.amount });
};

/** sourceで実際に解決済みの設定を使い、現金の月次寄与だけをcanonical scopeへ確定する。 */
export function projectCashContribution(
  data: Dataset,
  entries: ReadonlyArray<CashEntry>,
  normMap: Record<string, string>,
): AggValue[] {
  const rows = new Map<string, AggValue>();
  const personal = applyClassification(
    entries.filter((entry) => entry.side === 'per').map(cashToTx),
    data.rules,
    data.edits,
    data.institutionOwners,
  );
  for (const [month, values] of Object.entries(personal.personal)) {
    for (const [category, amount] of Object.entries(values.income))
      if (amount) addProjection(rows, { month, scope: `per_inc:${category}`, amount });
    for (const [category, amount] of Object.entries(values.expense))
      if (amount) addProjection(rows, { month, scope: `per_exp:${category}`, amount });
  }
  for (const [month, values] of Object.entries(personal.bizPersonal)) {
    if (values.income) addProjection(rows, { month, scope: 'biz_personal_in', amount: values.income });
    if (values.expense) addProjection(rows, { month, scope: 'biz_personal_out', amount: values.expense });
  }

  const vendorDefs = subVendorDefs(data);
  for (const deal of cashBizDeals([...entries], normMap)) {
    if (deal.io === 'income')
      addProjection(rows, { month: deal.month, scope: 'biz_rev', amount: deal.amount });
    else {
      addProjection(rows, { month: deal.month, scope: `biz_exp:${deal.accountNorm}`, amount: deal.amount });
      const vendor = matchSubVendor(deal.partner, vendorDefs);
      if (vendor) addProjection(rows, { month: deal.month, scope: `subs:${vendor}`, amount: deal.amount });
      else if (deal.accountNorm === 'サブスク・通信')
        addProjection(rows, { month: deal.month, scope: 'subs_other', amount: deal.amount });
    }
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month) || a.scope.localeCompare(b.scope));
}

const aggregateAmounts = (data: Dataset): Map<string, number> =>
  new Map(aggRowsFromDataset('', data).map((row) => [projectionKey(row), row.amount]));

type BackupSnapshotRow = {
  source: string;
  id: number | null;
  rank: number | null;
  amount: number | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
  v6: string | null;
  v7: string | null;
  v8: string | null;
  v9: string | null;
  v10: string | null;
  v11: string | null;
  v12: string | number | null;
  v13: string | number | null;
};

interface BackupSourceSnapshot {
  baselineRows: AggValue[];
  deals: FreeeDeal[];
  txs: MfTx[];
  rules: Rule[];
  edits: Record<string, TxEdit>;
  institutionOwners: Dataset['institutionOwners'];
  vendors: SubVendorRow[];
  budgets: Dataset['budgets'];
  cashOverride: Dataset['cashOverride'];
  unrecordedExpMonths: string[];
  cashEntries: CashEntry[];
  attachmentArchive: AttachmentArchiveRecord[];
  normMap: Record<string, string>;
}

/**
 * 添付の復元データではなく、D1とR2の照合・棚卸しに使うarchive record。
 * restoreはこの形を受け取らないことをloadBackupPayloadのenvelopeで明示する。
 */
interface AttachmentArchiveRecord {
  target: { kind: 'cash' | 'mf'; key: string };
  r2Key: string;
  filename: string;
  contentType: string;
  size: number;
  contentHash: string;
  state: 'ready' | 'delete_pending' | 'delete_failed';
  deleteAttempts: number;
  deleteRequestedAt: string | null;
  lastDeleteError: string | null;
  objectDeletedAt: string | null;
  parentMissingAt: string | null;
  cleanupDeadLetterAt: string | null;
  createdAt: string;
}

/*
 * D1 batch/withSessionは逐次整合性までは型契約にあるが、複数readの同一snapshotは保証しない。
 * backupに影響する全canonical tableを1本のSQLite statementで読み、statement snapshotを境界にする。
 * monthly_aggは派生cacheなので意図的に含めない。
 */
const BACKUP_SNAPSHOT_SQL = `
SELECT * FROM (
SELECT 'baseline' AS source, NULL AS id, NULL AS rank, amount,
       month AS v1, scope AS v2, NULL AS v3, NULL AS v4, NULL AS v5,
       NULL AS v6, NULL AS v7, NULL AS v8, NULL AS v9, NULL AS v10, NULL AS v11, NULL AS v12, NULL AS v13
FROM restored_monthly_agg WHERE user_id = ?
UNION ALL
SELECT 'freee', id, NULL, amount,
       month, date, io, partner, account_raw, account_norm, memo, NULL, NULL, NULL, NULL, NULL, NULL
FROM freee_deals WHERE user_id = ?
UNION ALL
SELECT 'mf', id, NULL, amount,
       tx_id, month, date, description, category_major, category_mid, institution, NULL, NULL, NULL, NULL, identity_stable, NULL
FROM mf_transactions WHERE user_id = ?
UNION ALL
SELECT 'rule', id, sort_order, NULL,
       keyword, cls, category_major, category_mid, owner, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM rules WHERE user_id = ?
)
UNION ALL
SELECT * FROM (
SELECT 'edit', NULL, NULL, NULL,
       tx_id, cls, category_major, category_mid, owner, base_major, base_mid, note, updated_at, NULL, NULL, NULL, NULL
FROM tx_edits WHERE user_id = ?
UNION ALL
SELECT 'budget', NULL, NULL, monthly_amount,
       account, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM budgets WHERE user_id = ?
UNION ALL
SELECT 'cash_override', NULL, expense, revenue,
       month, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM cash_overrides WHERE user_id = ?
UNION ALL
SELECT 'unrecorded', NULL, NULL, NULL,
       month, kind, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM unrecorded_months WHERE user_id = ?
UNION ALL
SELECT 'institution', NULL, NULL, NULL,
       institution, owner, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM institution_owners WHERE user_id = ?
)
UNION ALL
SELECT * FROM (
SELECT 'vendor', id, sort_order, NULL,
       name, aliases, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM sub_vendors WHERE user_id = ?
UNION ALL
SELECT 'cash', id, NULL, amount,
       date, month, side, io, description, category_major, category_mid, memo, NULL, transit_from, transit_to, transit_round, receipt_waived
FROM cash_entries WHERE user_id = ?
UNION ALL
SELECT 'norm', NULL, NULL, NULL,
       raw, norm, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM account_norm_map WHERE user_id = ?
UNION ALL
SELECT 'attachment', id, delete_attempts, size,
       target_kind, target_key, r2_key, filename, content_type, content_hash, created_at, state,
       delete_requested_at, last_delete_error, object_deleted_at, parent_missing_at, cleanup_dead_letter_at
FROM attachments WHERE user_id = ?
)
ORDER BY source, rank, id, v1, v2`;

/** export用canonical rowsを、単一D1 read statementから型付きsnapshotへ変換する。 */
async function loadBackupSourceSnapshot(db: Db, userId: string): Promise<BackupSourceSnapshot> {
  const params = Array.from({ length: 13 }, () => userId);
  const result = await db.$client
    .prepare(BACKUP_SNAPSHOT_SQL)
    .bind(...params)
    .all<BackupSnapshotRow>();
  const bySource = (source: string) => result.results.filter((row) => row.source === source);

  const baselineRows = bySource('baseline').map((row) => ({
    month: row.v1 ?? '',
    scope: row.v2 ?? '',
    amount: row.amount ?? 0,
  }));
  const deals = bySource('freee').map(
    (row): FreeeDeal => ({
      month: row.v1 ?? '',
      date: row.v2 ?? '',
      io: row.v3 === 'income' ? 'income' : 'expense',
      partner: row.v4 ?? '',
      accountRaw: row.v5 ?? '',
      accountNorm: row.v6 ?? '',
      amount: row.amount ?? 0,
    }),
  );
  const txs = bySource('mf')
    .map(
      (row): MfTx => ({
        id: row.v1 ?? '',
        idStable: row.v12 === 1,
        m: row.v2 ?? '',
        d: (row.v3 ?? '').slice(5).replace('-', '/'),
        c: row.v4 ?? '',
        a: row.amount ?? 0,
        big: row.v5 ?? '',
        mid: row.v6 ?? '',
        inst: row.v7 ?? undefined,
      }),
    )
    .sort((a, b) => a.m.localeCompare(b.m) || a.d.localeCompare(b.d) || a.id.localeCompare(b.id));
  const ruleRows = bySource('rule').sort(
    (a, b) => (a.rank ?? 0) - (b.rank ?? 0) || (a.id ?? 0) - (b.id ?? 0),
  );
  const rules = ruleRows.length
    ? ruleRows.map(
        (row): Rule => ({
          k: row.v1 ?? '',
          cls: row.v2 === 'biz' || row.v2 === 'per' ? row.v2 : null,
          big: row.v3,
          mid: row.v4,
          owner: normalizeOwner(row.v5),
        }),
      )
    : [...DEFAULT_RULES];
  const edits: Record<string, TxEdit> = {};
  for (const row of bySource('edit')) {
    const txId = row.v1 ?? '';
    edits[txId] = {
      cls: row.v2 === 'biz' || row.v2 === 'per' ? row.v2 : null,
      big: row.v3,
      mid: row.v4,
      owner: normalizeOwner(row.v5),
      baseBig: row.v6,
      baseMid: row.v7,
      note: row.v8,
      updatedAt: row.v9,
    };
  }
  const institutionOwners: Dataset['institutionOwners'] = {};
  for (const row of bySource('institution')) {
    const owner = normalizeOwner(row.v2);
    if (owner) institutionOwners[row.v1 ?? ''] = owner;
  }
  const vendors = bySource('vendor')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || (a.id ?? 0) - (b.id ?? 0))
    .map((row) => ({ id: row.id ?? 0, name: row.v1 ?? '', aliases: parseAliases(row.v2 ?? '[]') }));
  const budgets: Dataset['budgets'] = {};
  for (const row of bySource('budget')) if (row.amount != null) budgets[row.v1 ?? ''] = row.amount;
  const cashOverride: Dataset['cashOverride'] = {};
  for (const row of bySource('cash_override')) {
    cashOverride[row.v1 ?? ''] = { revenue: row.amount ?? 0, expense: row.rank ?? 0 };
  }
  const unrecordedExpMonths = bySource('unrecorded')
    .filter((row) => row.v2 === 'expense')
    .map((row) => row.v1 ?? '');
  const cashEntries = bySource('cash')
    .map(
      (row): CashEntry => ({
        id: row.id ?? 0,
        date: row.v1 ?? '',
        month: row.v2 ?? '',
        side: row.v3 === 'biz' ? 'biz' : 'per',
        io: row.v4 === 'income' ? 'income' : 'expense',
        amount: row.amount ?? 0,
        description: row.v5 ?? '',
        categoryMajor: row.v6 ?? '',
        categoryMid: row.v7 ?? '',
        memo: row.v8,
        transitFrom: row.v10,
        transitTo: row.v11,
        transitRound: row.v12 === 1,
        receiptWaived: row.v13 === 1,
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const attachmentArchive = bySource('attachment').map(
    (row): AttachmentArchiveRecord => ({
      target: { kind: row.v1 === 'cash' ? 'cash' : 'mf', key: row.v2 ?? '' },
      r2Key: row.v3 ?? '',
      filename: row.v4 ?? '',
      contentType: row.v5 ?? '',
      size: row.amount ?? 0,
      contentHash: row.v6 ?? '',
      createdAt: row.v7 ?? '',
      state: row.v8 === 'delete_pending' || row.v8 === 'delete_failed' ? row.v8 : 'ready',
      deleteAttempts: row.rank ?? 0,
      deleteRequestedAt: row.v9,
      lastDeleteError: row.v10,
      objectDeletedAt: row.v11,
      parentMissingAt: typeof row.v12 === 'string' ? row.v12 : null,
      cleanupDeadLetterAt: typeof row.v13 === 'string' ? row.v13 : null,
    }),
  );
  const normMap: Record<string, string> = {};
  for (const row of bySource('norm')) normMap[row.v1 ?? ''] = row.v2 ?? '';

  return {
    baselineRows,
    deals,
    txs,
    rules,
    edits,
    institutionOwners,
    vendors,
    budgets,
    cashOverride,
    unrecordedExpMonths,
    cashEntries,
    attachmentArchive,
    normMap,
  };
}

/** monthly_aggを読まず、canonical snapshotだけからexport対象Datasetを一度だけ組み立てる。 */
function datasetFromBackupSnapshot(snapshot: BackupSourceSnapshot): Dataset {
  const data = emptyDataset();
  data.rules = snapshot.rules;
  data.edits = snapshot.edits;
  data.institutionOwners = snapshot.institutionOwners;
  data.budgets = snapshot.budgets;
  data.cashOverride = snapshot.cashOverride;
  data.unrecordedExpMonths = [...snapshot.unrecordedExpMonths];
  data.subs.vendors = snapshot.vendors.map((vendor) => vendor.name);
  data.subs.aliases = Object.fromEntries(snapshot.vendors.map((vendor) => [vendor.name, vendor.aliases]));

  const monthSet = new Set<string>();
  snapshot.baselineRows.forEach((row) => monthSet.add(row.month));
  snapshot.deals.forEach((deal) => monthSet.add(deal.month));
  snapshot.txs.forEach((tx) => monthSet.add(tx.m));
  snapshot.cashEntries.forEach((entry) => monthSet.add(entry.month));
  data.months = [...monthSet].sort();
  data.biz.revenue = data.months.map(() => 0);
  data.subs.other = data.months.map(() => 0);
  for (const vendor of data.subs.vendors) data.subs.matrix[vendor] = data.months.map(() => 0);

  data.mfTx = [...snapshot.txs];
  mergeCashTxs(data, snapshot.cashEntries);
  const rawMfMonths = new Set(snapshot.txs.map((tx) => tx.m));
  addPersonalBaseline(
    data,
    snapshot.baselineRows,
    new Set([...personalBaselineMonths(snapshot.baselineRows)].filter((month) => !rawMfMonths.has(month))),
  );

  const freeeMonths = new Set(snapshot.deals.map((deal) => deal.month));
  const cashDeals = cashBizDeals(snapshot.cashEntries, snapshot.normMap);
  const businessMonths = new Set([
    ...freeeMonths,
    ...businessBaselineMonths(snapshot.baselineRows),
    ...cashDeals.map((deal) => deal.month),
  ]);
  if (businessMonths.size) {
    const unrecordedBefore = data.unrecordedExpMonths;
    applyFreeeDeals(
      data,
      [
        ...snapshot.deals.map((deal) => ({
          ...deal,
          accountNorm: normalizeAccount(deal.accountRaw, snapshot.normMap),
        })),
        ...cashDeals,
      ],
      [...businessMonths],
    );
    addBusinessBaseline(
      data,
      snapshot.baselineRows,
      new Set([...businessMonths].filter((month) => !freeeMonths.has(month))),
    );
    data.unrecordedExpMonths = [
      ...new Set([
        ...data.unrecordedExpMonths,
        ...unrecordedBefore.filter((month) => !freeeMonths.has(month)),
      ]),
    ].sort();
  }
  return data;
}

/** export/cronが共有する単一canonical snapshot。aggregateとdeltaを同じin-memory rowsから作る。 */
export async function loadBackupPayload(db: Db, userId: string): Promise<Record<string, unknown>> {
  const snapshot = await loadBackupSourceSnapshot(db, userId);
  const data = datasetFromBackupSnapshot(snapshot);
  const rows = projectCashContribution(data, snapshot.cashEntries, snapshot.normMap);
  const aggregate = aggregateAmounts(data);
  if (rows.some((row) => row.amount > (aggregate.get(projectionKey(row)) ?? 0))) {
    throw new CashProjectionError('cash_projection_underflow');
  }
  const cashProjection: CashProjectionEnvelope = { version: 1, basis: 'post-resolution', rows };
  // 添付も他のcanonical rowsと同一SQLite statement snapshotから取る。
  // ただしR2原本のcopy/restoreは行わないため、復元可能とは主張せず
  // inventory/archive契約として明示する。
  const attachmentArchive = {
    version: 1,
    basis: 'inventory-only',
    restoreCapable: false,
    metadataRecoveryCapable: true,
    recoveryEndpoint: '/api/attachments/archive/recover',
    records: snapshot.attachmentArchive,
  } as const;
  return { ...exportJSON(data), cashEntries: snapshot.cashEntries, cashProjection, attachmentArchive };
}

/** valid envelopeの確定deltaをbaseline候補から厳密に差し引く。 */
export function removeCashProjection(data: Dataset, rows: ReadonlyArray<AggValue>): void {
  for (const row of rows) {
    const i = data.months.indexOf(row.month);
    const subtract = (value: number): number => {
      if (row.amount > value) throw new CashProjectionError('cash_projection_underflow');
      return value - row.amount;
    };
    if (i < 0) throw new CashProjectionError('cash_projection_underflow');
    if (row.scope === 'biz_rev') data.biz.revenue[i] = subtract(data.biz.revenue[i] ?? 0);
    else if (row.scope.startsWith('biz_exp:')) {
      const category = row.scope.slice('biz_exp:'.length);
      if (!data.biz.expense[category]) throw new CashProjectionError('cash_projection_underflow');
      data.biz.expense[category][i] = subtract(data.biz.expense[category][i] ?? 0);
    } else if (row.scope === 'subs_other') data.subs.other[i] = subtract(data.subs.other[i] ?? 0);
    else if (row.scope.startsWith('subs:')) {
      const vendor = row.scope.slice('subs:'.length);
      if (!data.subs.matrix[vendor]) throw new CashProjectionError('cash_projection_underflow');
      data.subs.matrix[vendor][i] = subtract(data.subs.matrix[vendor][i] ?? 0);
    } else if (row.scope === 'biz_personal_in' || row.scope === 'biz_personal_out') {
      const target = data.bizPersonal[row.month];
      if (!target) throw new CashProjectionError('cash_projection_underflow');
      if (row.scope === 'biz_personal_in') target.income = subtract(target.income);
      else target.expense = subtract(target.expense);
    } else if (row.scope.startsWith('per_inc:') || row.scope.startsWith('per_exp:')) {
      const target = data.personal[row.month];
      if (!target) throw new CashProjectionError('cash_projection_underflow');
      const income = row.scope.startsWith('per_inc:');
      const category = row.scope.slice(income ? 'per_inc:'.length : 'per_exp:'.length);
      const values = income ? target.income : target.expense;
      values[category] = subtract(values[category] ?? 0);
    } else throw new CashProjectionError('invalid_cash_projection');
  }
  data.mfTx = data.mfTx.filter((tx) => !isCashTxId(tx.id));
  data.edits = withoutCashEdits(data.edits);
  data.overrides = Object.fromEntries(Object.entries(data.overrides).filter(([txId]) => !isCashTxId(txId)));
}

/* ------------------------- サブスクのベンダー登録 ------------------------- */

export interface SubVendorRow extends SubVendor {
  id: number;
}

const parseAliases = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** 登録順(sort_order, id)で返す。マイグレーション 0005 で既定8件が入る */
export async function loadSubVendors(db: Db, userId: string): Promise<SubVendorRow[]> {
  const rows = await db
    .select()
    .from(s.subVendors)
    .where(eq(s.subVendors.userId, userId))
    .orderBy(asc(s.subVendors.sortOrder), asc(s.subVendors.id));
  return rows.map((r) => ({ id: r.id, name: r.name, aliases: parseAliases(r.aliases) }));
}

/** 統合JSONなどに含まれるベンダー名を登録に加える(既存は無視) */
export async function ensureSubVendors(db: Db, userId: string, names: string[]): Promise<void> {
  const existing = new Set((await loadSubVendors(db, userId)).map((v) => v.name));
  const add = names.filter((n) => n && !existing.has(n));
  for (const name of add) await db.insert(s.subVendors).values({ userId, name, sortOrder: 100 });
}

export interface RecomputePlan {
  data: Dataset;
  normalizedDealUpdates: Array<{ id: number; accountNorm: string }>;
}

/** D1のTEXT/BLOB 2MB上限に5%の余白を取ったJSON bind上限。 */
export const D1_JSON_BIND_SAFE_BYTES = 1_900_000;

export class D1BulkPayloadError extends Error {
  constructor(public readonly code: 'invalid_bulk_update' | 'bulk_payload_too_large') {
    super(code);
    this.name = 'D1BulkPayloadError';
  }
}

/** JSON virtual tableへ渡す値をUTF-8 byteでfail-fastさせる共通境界。 */
export function d1JsonPayload(value: unknown): string {
  const payload = JSON.stringify(value);
  if (payload === undefined) throw new D1BulkPayloadError('invalid_bulk_update');
  if (new TextEncoder().encode(payload).byteLength > D1_JSON_BIND_SAFE_BYTES) {
    throw new D1BulkPayloadError('bulk_payload_too_large');
  }
  return payload;
}

/**
 * freee/MF/現金の正本から集計の書込み計画を副作用なしで作る。
 * cashEntriesSnapshotを渡すと、未確定の親削除後状態を先に計算し、後続の単一D1 batchに参加できる。
 */
export async function planRecomputeFromDeals(
  db: Db,
  userId: string,
  affectedCashEntries: ReadonlyArray<Pick<CashEntry, 'month' | 'side'>> = [],
  cashEntriesSnapshot?: ReadonlyArray<CashEntry>,
): Promise<RecomputePlan> {
  const [normMap, dealRows, baselineRows, rawMfRows, cashEntries] = await Promise.all([
    loadNormMap(db, userId),
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.restoredMonthlyAgg).where(eq(s.restoredMonthlyAgg.userId, userId)),
    db
      .select({ month: s.mfTransactions.month })
      .from(s.mfTransactions)
      .where(eq(s.mfTransactions.userId, userId)),
    cashEntriesSnapshot === undefined
      ? loadCashEntries(db, userId)
      : Promise.resolve([...cashEntriesSnapshot]),
  ]);
  const normalizedDealUpdates = dealRows
    .map((row) => ({ id: row.id, accountNorm: normalizeAccount(row.accountRaw ?? '', normMap) }))
    .filter((row, index) => row.accountNorm !== dealRows[index]?.accountNorm);
  const data = await loadDataset(db, userId, cashEntries);
  const rawMfMonths = new Set(rawMfRows.map((r) => r.month));
  const personalMonths = new Set([
    ...rawMfMonths,
    ...personalBaselineMonths(baselineRows),
    ...cashEntries.filter((entry) => entry.side === 'per').map((entry) => entry.month),
    ...affectedCashEntries.filter((entry) => entry.side === 'per').map((entry) => entry.month),
  ]);
  for (const month of personalMonths) {
    delete data.personal[month];
    delete data.bizPersonal[month];
    delete data.personalByOwner[month];
  }
  recomputeClassification(data);
  addPersonalBaseline(
    data,
    baselineRows,
    new Set([...personalMonths].filter((month) => !rawMfMonths.has(month))),
  );
  // 削除済みベンダーの列を集計から落とす(読み出しでは温存されるため、ここで正本に揃える)
  const registered = new Set(Object.keys(data.subs.aliases));
  data.subs.vendors = data.subs.vendors.filter((v) => registered.has(v));
  // 事業分の現金明細は freee 仕訳と同じ経路で科目別集計に合流する(取込値とは別テーブルなので再取込で消えない)
  const cashDeals = cashBizDeals(cashEntries, normMap);
  const freeeMonths = new Set(dealRows.map((r) => r.month));
  const affectedBusinessMonths = affectedCashEntries
    .filter((entry) => entry.side === 'biz')
    .map((entry) => entry.month);
  const months = [
    ...new Set([
      ...freeeMonths,
      ...businessBaselineMonths(baselineRows),
      ...cashDeals.map((d) => d.month),
      ...affectedBusinessMonths,
    ]),
  ].sort();
  if (months.length) {
    const unrecBefore = data.unrecordedExpMonths;
    applyFreeeDeals(
      data,
      [
        ...dealRows.map((r) => ({
          ...dealFromRow(r),
          accountNorm: normalizeAccount(r.accountRaw ?? '', normMap),
        })),
        ...cashDeals,
      ],
      months,
    );
    addBusinessBaseline(data, baselineRows, new Set(months.filter((month) => !freeeMonths.has(month))));
    // 現金明細しか無い月は freee の記帳が済んでいないので、未記帳のままにする
    data.unrecordedExpMonths = [
      ...new Set([...data.unrecordedExpMonths, ...unrecBefore.filter((m) => !freeeMonths.has(m))]),
    ].sort();
  }
  return { data, normalizedDealUpdates };
}

type DbBatchQueries = Parameters<Db['batch']>[0];

/** 集計キャッシュ全件入れ替えを他の正本mutationと同じbatchへ組み込む。 */
export function aggregateReplacementQueries(db: Db, userId: string, data: Dataset): DbBatchQueries {
  const rows = aggRowsFromDataset(userId, data);
  // json_eachに1パラメータで渡し、集計行数に関係なくINSERTを1 statementに保つ。
  // これによりD1 Freeのinvocation query上限下でも、親削除と全集計のatomic入れ替えを両立できる。
  const payload = d1JsonPayload(rows.map((row) => [row.userId, row.month, row.scope, row.amount]));
  return [
    db.delete(s.monthlyAgg).where(eq(s.monthlyAgg.userId, userId)),
    db.insert(s.monthlyAgg).select(sql`
      SELECT
        json_extract(value, '$[0]'),
        json_extract(value, '$[1]'),
        json_extract(value, '$[2]'),
        json_extract(value, '$[3]')
      FROM json_each(${payload})
    `),
  ];
}

/**
 * account_norm差分を行数に依存しない1 UPDATEにする。
 * 同じID+同じ値は重複除去し、不正ID/値と同一IDの競合値はD1へ触る前に拒否する。
 */
export function normalizedDealUpdatesQuery(
  db: Db,
  userId: string,
  updates: ReadonlyArray<{ id: number; accountNorm: string }>,
) {
  const unique = new Map<number, string>();
  for (const update of updates) {
    if (!Number.isSafeInteger(update.id) || update.id <= 0 || typeof update.accountNorm !== 'string') {
      throw new D1BulkPayloadError('invalid_bulk_update');
    }
    if (unique.has(update.id) && unique.get(update.id) !== update.accountNorm) {
      throw new D1BulkPayloadError('invalid_bulk_update');
    }
    unique.set(update.id, update.accountNorm);
  }
  if (unique.size === 0) return null;

  const payload = d1JsonPayload([...unique].map(([id, accountNorm]) => [id, accountNorm]));
  return db
    .update(s.freeeDeals)
    .set({
      accountNorm: sql<string>`(
        SELECT CAST(json_extract(value, '$[1]') AS TEXT)
        FROM json_each(${payload})
        WHERE CAST(json_extract(value, '$[0]') AS INTEGER) = ${s.freeeDeals.id}
      )`,
    })
    .where(
      and(
        eq(s.freeeDeals.userId, userId),
        sql`${s.freeeDeals.id} IN (
          SELECT CAST(json_extract(value, '$[0]') AS INTEGER)
          FROM json_each(${payload})
        )`,
      ),
    );
}

/** 正規化列と集計キャッシュを同じD1 batchへ組み込む。 */
export function recomputePlanQueries(db: Db, userId: string, plan: RecomputePlan): DbBatchQueries {
  const aggregateQueries = aggregateReplacementQueries(db, userId, plan.data);
  const normalizeDeals = normalizedDealUpdatesQuery(db, userId, plan.normalizedDealUpdates);
  return normalizeDeals ? [normalizeDeals, ...aggregateQueries] : aggregateQueries;
}

/**
 * freee 原本仕訳から事業側の集計を作り直す(正規化マップ・ベンダー登録の変更時)。
 * account_norm 列とmonthly_aggは一つのD1 batchで入れ替える。
 */
export async function recomputeFromDeals(
  db: Db,
  userId: string,
  affectedCashEntries: ReadonlyArray<Pick<CashEntry, 'month' | 'side'>> = [],
): Promise<void> {
  const plan = await planRecomputeFromDeals(db, userId, affectedCashEntries);
  await db.batch(recomputePlanQueries(db, userId, plan));
}

export const dealFromRow = (r: typeof s.freeeDeals.$inferSelect): FreeeDeal => ({
  month: r.month,
  date: r.date,
  io: r.io,
  partner: r.partner ?? '',
  accountRaw: r.accountRaw ?? '',
  accountNorm: r.accountNorm ?? '',
  amount: r.amount,
});

/* ------------------------- 集計キャッシュ再生成 ------------------------- */

export function aggRowsFromDataset(userId: string, data: Dataset) {
  const rows: { userId: string; month: string; scope: string; amount: number }[] = [];
  data.months.forEach((m, i) => {
    rows.push({ userId, month: m, scope: 'biz_rev', amount: data.biz.revenue[i] ?? 0 });
    data.biz.categories.forEach((c) => {
      const v = data.biz.expense[c]?.[i] ?? 0;
      if (v) rows.push({ userId, month: m, scope: `biz_exp:${c}`, amount: v });
    });
    data.subs.vendors.forEach((vd) => {
      const v = data.subs.matrix[vd]?.[i] ?? 0;
      if (v) rows.push({ userId, month: m, scope: `subs:${vd}`, amount: v });
    });
    const other = data.subs.other[i] ?? 0;
    if (other) rows.push({ userId, month: m, scope: 'subs_other', amount: other });
  });
  for (const [m, bp] of Object.entries(data.bizPersonal)) {
    rows.push({ userId, month: m, scope: 'biz_personal_in', amount: bp.income });
    rows.push({ userId, month: m, scope: 'biz_personal_out', amount: bp.expense });
  }
  for (const [m, p] of Object.entries(data.personal)) {
    for (const [k, v] of Object.entries(p.income))
      rows.push({ userId, month: m, scope: `per_inc:${k}`, amount: v });
    for (const [k, v] of Object.entries(p.expense))
      rows.push({ userId, month: m, scope: `per_exp:${k}`, amount: v });
  }
  return rows;
}

/** monthly_agg を Dataset から全再生成する(spec §7.3。取込/ルール/手動判定/正規化マップ変更時) */
export async function saveAgg(db: Db, userId: string, data: Dataset): Promise<void> {
  // DELETE + json_each INSERTの2 statementsで、全行をatomicに入れ替える。
  await db.batch(aggregateReplacementQueries(db, userId, data));
}

/** JSON復元スナップショットの集計値を、派生キャッシュとは別のbaselineとして入れ替える */
export async function replaceRestoredAgg(db: Db, userId: string, restored: Dataset): Promise<void> {
  const rows = aggRowsFromDataset(userId, restored);
  await db.delete(s.restoredMonthlyAgg).where(eq(s.restoredMonthlyAgg.userId, userId));
  for (const grp of chunk(rows, 24)) await db.insert(s.restoredMonthlyAgg).values(grp);
}

/* ------------------------- 明細の洗い替え永続化 ------------------------- */

export async function replaceFreeeDeals(
  db: Db,
  userId: string,
  deals: FreeeDeal[],
  months: string[],
  importId: number,
): Promise<void> {
  if (months.length) {
    await db
      .delete(s.freeeDeals)
      .where(and(eq(s.freeeDeals.userId, userId), inArray(s.freeeDeals.month, months)));
  }
  const rows = deals.map((d) => ({
    userId,
    month: d.month,
    date: d.date,
    io: d.io,
    partner: d.partner,
    accountRaw: d.accountRaw,
    accountNorm: d.accountNorm,
    amount: d.amount,
    importId,
  }));
  for (const grp of chunk(rows, 10)) await db.insert(s.freeeDeals).values(grp);
}

export async function replaceMfTxs(
  db: Db,
  userId: string,
  txs: MfTx[],
  months: string[],
  importId: number | null,
): Promise<void> {
  if (months.length) {
    await db
      .delete(s.mfTransactions)
      .where(and(eq(s.mfTransactions.userId, userId), inArray(s.mfTransactions.month, months)));
  }
  // ファイル内のID重複(MF側の稀な重複)は後勝ちで1件に畳む
  const byId = new Map<string, MfTx>();
  txs.forEach((t) => byId.set(t.id, t));
  const rows = [...byId.values()].map((t) => ({
    userId,
    txId: t.id,
    month: t.m,
    date: `${t.m}-${(t.d.split('/')[1] ?? '01').padStart(2, '0')}`,
    description: t.c,
    amount: t.a,
    categoryMajor: t.big,
    categoryMid: t.mid,
    institution: t.inst ?? null,
    importId,
  }));
  // 月をまたいで同一tx_idが残っている場合(UNIQUE制約)に備え、先に既存の同一IDを消す
  const ids = rows.map((r) => r.txId);
  for (const grp of chunk(ids, 90)) {
    await db
      .delete(s.mfTransactions)
      .where(and(eq(s.mfTransactions.userId, userId), inArray(s.mfTransactions.txId, grp)));
  }
  for (const grp of chunk(rows, 9)) await db.insert(s.mfTransactions).values(grp);
}

/** 科目正規化マップの取得(未設定行は既定値で補完済みのマイグレーションが入る) */
export async function loadNormMap(db: Db, userId: string): Promise<Record<string, string>> {
  const rows = await db.select().from(s.accountNormMap).where(eq(s.accountNormMap.userId, userId));
  const map: Record<string, string> = {};
  rows.forEach((r) => {
    map[r.raw] = r.norm;
  });
  return map;
}
