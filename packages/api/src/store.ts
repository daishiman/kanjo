/**
 * D1 ⇔ Dataset(HTML版DATA形状) の変換層。
 *
 * - monthly_agg は表示用の派生キャッシュ。JSON復元でしか得られない値は
 *   restored_monthly_agg を正本(baseline)とし、現在の freee/MF/現金原本と合成する。
 * - 同月に原本CSVがあればそちらを正とし、原本が無い月だけ baseline + 現金とする。
 */
import {
  type BudgetPlanRow,
  type CashEntry,
  type CashOverrideRule,
  DEFAULT_RULES,
  DEFAULT_STAT_MIN_MONTHS,
  type Dataset,
  type FreeeDeal,
  type MfTx,
  type NormRule,
  type Owner,
  type Rule,
  type SubVendor,
  type TxEdit,
  type TxSplit,
  type VendorMemoryRecord,
  accountNormMap,
  applyCashOverrides,
  applyClassification,
  applyFreeeDeals,
  cashBizDeals,
  cashToTx,
  emptyDataset,
  ensureMonth,
  exportJSON,
  hasSettlementColumns,
  isCashTxId,
  matchSubVendor,
  normalizeAccount,
  normalizeOwner,
  parseSplitTemplate,
  projectAccountingDataset,
  recomputeClassification,
  sortCashOverrides,
  subVendorDefs,
} from '@kanjo/core';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as s from './db/schema.js';
import { invalidateJsonSnapshotQuery } from './import-active.js';
import { txEditFromRow, txEditInsertValues } from './tx-edit-codec.js';

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
  payee: r.payee ?? null,
  scope: r.scope ?? 'all',
  splitTemplate: parseSplitTemplate(r.splitTemplateJson),
});

/** vendor_memoryのDB行をcoreの純粋resolverへ渡す唯一の投影。 */
export const vendorMemoryFromRow = (row: typeof s.vendorMemory.$inferSelect): VendorMemoryRecord => ({
  vendorKey: row.vendorKey,
  vendorLabel: row.vendorLabel,
  cls: row.cls,
  big: row.categoryMajor,
  mid: row.categoryMid,
  owner: row.owner,
  hitCount: row.hitCount,
  disagreeCount: row.disagreeCount,
  pinned: row.pinned === 1,
  revoked: row.revoked === 1,
});

/** 1利用者ぶんを1 queryで読み、明細ごとのN+1を作らない。 */
export async function loadVendorMemories(db: Db, userId: string): Promise<VendorMemoryRecord[]> {
  const rows = await db.select().from(s.vendorMemory).where(eq(s.vendorMemory.userId, userId));
  return rows.map(vendorMemoryFromRow);
}

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

export const splitFromRow = (r: typeof s.txSplits.$inferSelect): TxSplit => ({
  txId: r.txId,
  lineId: r.lineId,
  seq: r.seq,
  parentAmount: r.parentAmount,
  amount: r.amount,
  cls: r.cls,
  categoryMajor: r.categoryMajor,
  categoryMid: r.categoryMid,
  ...(r.owner ? { owner: r.owner } : {}),
  ...(r.memo ? { memo: r.memo } : {}),
});

/** @deprecated tx_edits の列投影は tx-edit-codec が正本。既存callerの名前だけ保つ。 */
export const editFromRow = txEditFromRow;

/**
 * 編集が空(全属性 null)なら行ごと消す。
 *
 * メモと支払方法もここで数える。数えないと「メモだけ書いて保存」が
 * 空の編集と見なされ、書いた直後に行ごと消える(0046 以前の取りこぼし)。
 */
export const editIsEmpty = (e: TxEdit): boolean =>
  !e.cls && !e.big && !e.mid && !e.owner && !e.inst && !e.note && !e.paymentMethod;

/**
 * tx_edits の 1 行を書き換える文の並び。1 明細ぶんがこの配列 1 つに収まるので、
 * 一括保存は「明細の境界で batch を切る」を配列の連結だけで守れる。
 */
export function editWriteQueries(
  db: Db,
  userId: string,
  txId: string,
  e: TxEdit,
  options: { disagreeOriginKey?: string | null; now?: string } = {},
): DbBatchQuery[] {
  const now = options.now ?? new Date().toISOString();
  const remove = db.delete(s.txEdits).where(and(eq(s.txEdits.userId, userId), eq(s.txEdits.txId, txId)));
  const disagreement = options.disagreeOriginKey
    ? db
        .update(s.vendorMemory)
        .set({ disagreeCount: sql`${s.vendorMemory.disagreeCount} + 1`, updatedAt: now })
        .where(
          and(eq(s.vendorMemory.userId, userId), eq(s.vendorMemory.vendorKey, options.disagreeOriginKey)),
        )
    : null;
  return [
    remove,
    ...(editIsEmpty(e) ? [] : [db.insert(s.txEdits).values(txEditInsertValues(userId, txId, e, now))]),
    ...(disagreement ? [disagreement] : []),
  ];
}

/**
 * 文の配列を batch へ渡せる形にする。drizzle の batch は「1 文以上」をタプルで要求するが、
 * 組み立て側は連結で作るので配列にならざるを得ない。空配列を渡す呼び手は先に弾く。
 */
export function toBatch(queries: DbBatchQuery[]): DbBatchQueries {
  if (queries.length === 0) throw new Error('batch requires at least one statement');
  return queries as unknown as DbBatchQueries;
}

export async function upsertEdit(
  db: Db,
  userId: string,
  txId: string,
  e: TxEdit,
  options: { disagreeOriginKey?: string | null } = {},
): Promise<void> {
  await db.batch(
    toBatch([
      ...editWriteQueries(db, userId, txId, e, options),
      invalidateJsonSnapshotQuery(db, userId, 'tx_edits'),
    ]),
  );
}

export async function replaceEdits(db: Db, userId: string, edits: Record<string, TxEdit>): Promise<void> {
  await db.delete(s.txEdits).where(eq(s.txEdits.userId, userId));
  const rows = Object.entries(edits)
    .filter(([, e]) => !editIsEmpty(e))
    .map(([txId, e]) => txEditInsertValues(userId, txId, e));
  // 1行あたりの列が増えたぶん、1文へ載せられる行数を減らす(D1のバインド上限)
  for (const grp of chunk(rows, 7)) await db.insert(s.txEdits).values(grp);
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

/**
 * cash snapshotを渡し、分割の内訳を読まないloadDatasetが発行するSELECT数。
 * query plannerとloaderの契約。
 *
 * 取込の1リクエストはD1の50 query上限に対してほぼ満杯で、
 * ここに1本足すとJSON復元が丸ごと入らなくなる(413)。
 * そのため取込の下見だけは内訳を読まない。詳しくは applySplits の呼び出し側。
 */
export const LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT = 10;

/** 分割の内訳まで読むloadDatasetのSELECT数。集計を書き直す経路はこちら。 */
export const LOAD_DATASET_QUERY_COUNT_WITH_SPLITS = LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT + 1;

/** 要求時刻の日本時間の年月 (`YYYY-MM`)。予算の「今月」(BR-23) に使う */
export function jstMonth(now: Date): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

/**
 * 月額の予算 (budgets) と期間別の年額 (budget_plans, 0050) を 1 statement で読む。
 * loadDataset の SELECT 数は取込の D1 query 上限に効くので、表を足しても本数は増やさない。
 */
async function loadBudgetRows(
  db: Db,
  userId: string,
): Promise<{ budgets: Dataset['budgets']; plans: BudgetPlanRow[] }> {
  const result = await db.$client
    .prepare(
      `SELECT 'budget' AS source, account, monthly_amount AS amount, NULL AS period_start, NULL AS kind,
              NULL AS plan_adjustment, NULL AS plan_reason, NULL AS updated_at
         FROM budgets WHERE user_id=?
       UNION ALL
       SELECT 'plan', account, annual_amount, period_start, kind, plan_adjustment, plan_reason, updated_at
         FROM budget_plans WHERE user_id=?
       ORDER BY source, period_start, account`,
    )
    .bind(userId, userId)
    .all<{
      source: string;
      account: string;
      amount: number | null;
      period_start: string | null;
      kind: string | null;
      plan_adjustment: number | null;
      plan_reason: string | null;
      updated_at: string | null;
    }>();
  const budgets: Dataset['budgets'] = {};
  const plans: BudgetPlanRow[] = [];
  for (const row of result.results) {
    if (row.source === 'budget') {
      if (row.amount != null) budgets[row.account] = row.amount;
      continue;
    }
    plans.push({
      periodStart: row.period_start ?? '',
      account: row.account,
      kind: row.kind === 'income' ? 'income' : 'expense',
      annualAmount: row.amount ?? 0,
      planAdjustment: row.plan_adjustment ?? 0,
      planReason: row.plan_reason,
      updatedAt: row.updated_at ?? '',
    });
  }
  return { budgets, plans };
}

/** 設定画面の集計ルール・現金上書きと、旧 cash_overrides の月の値 */
export interface SettingsRuleRows {
  cashOverride: Dataset['cashOverride'];
  normRules: NormRule[];
  cashOverrideRules: CashOverrideRule[];
}

/**
 * 旧 cash_overrides と 0051・0052 の新表を 1 statement で読む。
 * loadDataset の SELECT 数は取込の D1 query 上限に効くので、表を足しても本数は増やさない (loadBudgetRows と同じ)。
 */
async function loadSettingsRuleRows(db: Db, userId: string): Promise<SettingsRuleRows> {
  const result = await db.$client
    .prepare(
      `SELECT 'cash' AS source, month AS a, NULL AS b, NULL AS c, NULL AS d,
              revenue AS n1, expense AS n2, NULL AS scope, NULL AS month, NULL AS memo
         FROM cash_overrides WHERE user_id=?
       UNION ALL
       SELECT 'norm', rule_id, kind, raw, norm, sort_order, enabled, NULL, NULL, NULL
         FROM settings_norm_rules WHERE user_id=?
       UNION ALL
       SELECT 'override', override_id, kind, NULL, NULL, amount, NULL, scope, month, memo
         FROM settings_cash_overrides WHERE user_id=?
       ORDER BY source, n1, a`,
    )
    .bind(userId, userId, userId)
    .all<{
      source: string;
      a: string;
      b: string | null;
      c: string | null;
      d: string | null;
      n1: number | null;
      n2: number | null;
      scope: string | null;
      month: string | null;
      memo: string | null;
    }>();
  const out: SettingsRuleRows = { cashOverride: {}, normRules: [], cashOverrideRules: [] };
  for (const row of result.results) {
    if (row.source === 'cash') {
      out.cashOverride[row.a] = { revenue: row.n1 ?? 0, expense: row.n2 ?? 0 };
    } else if (row.source === 'norm') {
      out.normRules.push(
        normRuleFromRow({
          ruleId: row.a,
          kind: row.b,
          raw: row.c,
          norm: row.d,
          sortOrder: row.n1,
          enabled: row.n2,
        }),
      );
    } else {
      out.cashOverrideRules.push(
        cashOverrideRuleFromRow({
          overrideId: row.a,
          kind: row.b,
          amount: row.n1,
          scope: row.scope,
          month: row.month,
          memo: row.memo,
        }),
      );
    }
  }
  // 並び順は 1 始まりの連番へ詰める (保存値に欠番があっても core の order は連続させる)
  out.normRules.forEach((rule, i) => {
    rule.order = i + 1;
  });
  out.cashOverrideRules = sortCashOverrides(out.cashOverrideRules);
  return out;
}

export const normRuleFromRow = (r: {
  ruleId: string;
  kind: string | null;
  raw: string | null;
  norm: string | null;
  sortOrder: number | null;
  enabled: number | null;
}): NormRule => ({
  ruleId: r.ruleId,
  kind: r.kind === 'vendor' ? 'vendor' : 'account',
  raw: r.raw ?? '',
  norm: r.norm ?? '',
  order: r.sortOrder ?? 0,
  enabled: r.enabled !== 0,
});

export const cashOverrideRuleFromRow = (r: {
  overrideId: string;
  kind: string | null;
  amount: number | null;
  scope: string | null;
  month: string | null;
  memo: string | null;
}): CashOverrideRule => ({
  overrideId: r.overrideId,
  kind: r.kind === 'receipt' ? 'receipt' : 'payment',
  amount: r.amount,
  scope: r.scope === 'month' ? 'month' : 'all',
  month: r.scope === 'month' ? r.month : null,
  memo: r.memo ?? '',
});

export async function loadDataset(
  db: Db,
  userId: string,
  cashEntriesSnapshot?: ReadonlyArray<CashEntry>,
  options: { withSplits?: boolean; loadSplitRows?: boolean; now?: Date; cashOverrides?: boolean } = {},
): Promise<Dataset> {
  const withSplits = options.withSplits ?? true;
  // 設定画面の現金上書き (BR-14) は表示・集計の読み手にだけ掛ける。取込計画 (withSplits:false) と
  // 集計キャッシュの書き直し (cashOverrides:false) は現金の原本の値のまま扱う。
  const withCashOverrides = options.cashOverrides ?? withSplits;
  // canonical mutationの事前計画は、生の親明細を保ったまま分割metadataも要る。
  // 通常のwithSplits:false(取込preview)は従来どおり1 query節約する。
  const loadSplitRows = options.loadSplitRows ?? withSplits;
  const [
    aggRows,
    baselineRows,
    txRows,
    ruleRows,
    editRows,
    budgetRows,
    settingsRows,
    unrecRows,
    instRows,
    vendorRows,
    cashEntries,
    splitRows,
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
    loadBudgetRows(db, userId),
    loadSettingsRuleRows(db, userId),
    db.select().from(s.unrecordedMonths).where(eq(s.unrecordedMonths.userId, userId)),
    db.select().from(s.institutionOwners).where(eq(s.institutionOwners.userId, userId)),
    loadSubVendors(db, userId),
    cashEntriesSnapshot ? Promise.resolve([...cashEntriesSnapshot]) : loadCashEntries(db, userId),
    loadSplitRows
      ? db.select().from(s.txSplits).where(eq(s.txSplits.userId, userId))
      : Promise.resolve([] as (typeof s.txSplits.$inferSelect)[]),
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
  data.subs.accounts = Object.fromEntries(vendorRows.map((v) => [v.name, v.accounts ?? []]));
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
      memo: r.memo ?? undefined,
      isTarget: r.isTarget === 1,
      isTransfer: r.isTransfer === 1,
    }),
  );
  data.rules = effectiveRules(ruleRows);
  editRows.forEach((r) => {
    data.edits[r.txId] = editFromRow(r);
  });
  instRows.forEach((r) => {
    data.institutionOwners[r.institution] = r.owner;
  });
  data.budgets = budgetRows.budgets;
  data.budgetPlans = budgetRows.plans;
  data.budgetAsOf = jstMonth(options.now ?? new Date());
  data.cashOverride = settingsRows.cashOverride;
  data.normRules = settingsRows.normRules;
  data.cashOverrideRules = settingsRows.cashOverrideRules;
  data.unrecordedExpMonths = unrecRows.filter((r) => r.kind === 'expense').map((r) => r.month);

  data.txSplits = splitRows.map(splitFromRow);

  // 個人分の現金明細を口座「現金」の明細として合流させ、生明細がある月は再計算が正(ルール・手動判定の現在値を反映)
  mergeCashTxs(data, cashEntries, withCashOverrides ? data.cashOverrideRules : []);
  const rawMfMonths = new Set(txRows.map((r) => r.month));
  const cashOnlyPersonalMonths = new Set(
    cashEntries.filter((e) => e.side === 'per' && !rawMfMonths.has(e.month)).map((e) => e.month),
  );
  addPersonalBaseline(data, baselineRows, cashOnlyPersonalMonths);
  // withSplits:false は取込計画専用のraw canonical Dataset。通常のconsumerには
  // 明示的なaccounting projectionを返し、canonical parentと派生childを混在させない。
  return withSplits ? projectAccountingDataset(data) : data;
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
  owner: normalizeOwner(r.owner),
  transitPurpose: r.transitPurpose ?? null,
});

/** 有効な(論理削除されていない)現金明細を、日付の新しい順(同日はIDの新しい順)で返す */
export async function loadCashEntries(db: Db, userId: string): Promise<CashEntry[]> {
  const rows = await db
    .select()
    .from(s.cashEntries)
    .where(and(eq(s.cashEntries.userId, userId), isNull(s.cashEntries.deletedAt)))
    .orderBy(desc(s.cashEntries.date), desc(s.cashEntries.id));
  return rows.map(cashFromRow);
}

/**
 * 個人分の現金明細(cash:*)を MF 明細に合流させて仕分けを再計算する。
 * JSON復元で data.mfTx が丸ごと差し替わった後にも呼び、現金明細が落ちないようにする。
 */
export function mergeCashTxs(
  data: Dataset,
  entries: CashEntry[],
  cashOverrideRules: readonly CashOverrideRule[] = [],
): void {
  const cash = entries.filter((e) => e.side === 'per').map(cashToTx);
  cash.forEach((t) => ensureMonth(data, t.m));
  // 現金上書き (BR-14) は現金の明細の月の合計を置き換える。上書きの明細も cash: 接頭辞を持つ
  data.mfTx = data.mfTx
    .filter((t) => !isCashTxId(t.id))
    .concat(applyCashOverrides(cash, cashOverrideRules, data.months));
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
      const vendor = matchSubVendor(deal.partner, vendorDefs, {
        raw: deal.accountRaw,
        normalized: deal.accountNorm,
      });
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
  /** sourceごとの汎用枠。editでは0046のpayment_methodを運ぶ。 */
  id: number | string | null;
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
  v14: string | number | null;
  /** 0035: tx_edits.institution / tx_splits.owner が載る枠 */
  v15: string | null;
};

interface BackupSourceSnapshot {
  baselineRows: AggValue[];
  deals: FreeeDeal[];
  txs: MfTx[];
  rules: Rule[];
  edits: Record<string, TxEdit>;
  institutionOwners: Dataset['institutionOwners'];
  vendors: SubVendorWithReview[];
  budgets: Dataset['budgets'];
  /** 0050: 期間別の年額予算。月額の budgets とは別の正本 */
  budgetPlans: BudgetPlanRow[];
  cashOverride: Dataset['cashOverride'];
  unrecordedExpMonths: string[];
  cashEntries: CashEntry[];
  txSplits: TxSplit[];
  normMap: Record<string, string>;
  /** 0051〜0052: 設定画面の集計ルールと現金上書き。exportJSON が normRules・cashOverrideRules として運ぶ */
  normRules: NormRule[];
  cashOverrideRules: CashOverrideRule[];
  /** 0045: 名義の表示名。行が無ければ空 (既定の表示名) */
  ownerLabels: Record<string, string>;
  statMinMonths: number;
  subVendorExclusions: Array<{ partner: string; vendorKey: string }>;
  subVendorReviewDecisions: SubVendorReviewDecisionRow[];
  /** 0040: 概況の「後で確認」。指紋だけを持ち、明細本文の写しは持たない */
  reviewSnoozes: BackupReviewSnooze[];
  /** 0040: 月次レビューを済ませた月 */
  monthlyCloseReviews: BackupMonthlyCloseReview[];
  /** 0041: 重複の「同じ / 違う」判断。落とすと復元後の総額が判断前の値に戻る */
  duplicateVerdicts: BackupDuplicateVerdict[];
  /** 0041: freee 側の二重登録を総額から外す判断 */
  freeeDealExclusions: BackupFreeeDealExclusion[];
  /** 0041: 総収支画面の操作履歴。取消ボタンの土台 */
  totalCashflowOperations: BackupTotalCashflowOperation[];
}

export interface BackupReviewSnooze {
  kind: string;
  itemKey: string;
  fingerprint: string;
  snoozedAt: string;
}

export interface BackupMonthlyCloseReview {
  month: string;
  reviewedAt: string;
  reviewedByUserId: string;
}

export interface BackupDuplicateVerdict {
  txId: string;
  verdict: string;
  stableKey: string | null;
  fingerprintVersion: number | null;
  decidedAt: string | null;
  updatedAt: string | null;
  freeeKey: string | null;
}

export interface BackupFreeeDealExclusion {
  freeeKey: string;
  reason: string;
  reasonCode: string | null;
  memo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BackupTotalCashflowOperation {
  id: string;
  kind: string;
  /** 操作「前」の値の配列。中身は解釈せず、文字列のまま運ぶ(解釈すると版が増えたときに落ちる) */
  itemsJson: string;
  itemCount: number;
  undoesId: string | null;
  undoneAt: string | null;
  createdAt: string;
}

export interface ImportRestoreSettingsSnapshot {
  normMap: Record<string, string>;
  statMinMonths: number;
  subVendorExclusions: Array<{ partner: string; vendorKey: string }>;
  /** 旧JSONにメタデータが無いときに、復元先の値を保つためのauthoritative snapshot */
  subVendors: SubVendorWithReview[];
  subVendorReviewDecisions: SubVendorReviewDecisionRow[];
  cashEntries: CashEntry[];
  freeeDeals: FreeeDeal[];
  txSplits: TxSplit[];
  /** 通常取込が1 statement snapshotで読む、利用者単位の決め事。 */
  vendorMemories: VendorMemoryRecord[];
  /**
   * 復元先に今ある行数。0件の表は復元時の DELETE を省き、復元1回のD1クエリ上限(<50)に収める。
   *
   * 0040 で「後で確認」と月次レビュー、0041 で総収支の判断3表がこの枠に入った。
   * 置き換える表が増えるほど DELETE を省ける効きが要るので、以前から無条件に消していた
   * 5表も同じ数え方へ揃える。数えるのは全部まとめて1 statement なので、問い合わせは増えない。
   */
  destinationRowCounts: {
    subVendorReviewDecisions: number;
    reviewSnoozes: number;
    monthlyCloseReviews: number;
    duplicateVerdicts: number;
    freeeDealExclusions: number;
    totalCashflowOperations: number;
    rules: number;
    txEdits: number;
    institutionOwners: number;
    budgets: number;
    budgetPlans: number;
    cashOverrides: number;
    /** 0054〜0056。全データ JSON 復元が設定画面の表へ写すときの差分判定と revision の起点 */
    settingsNormRules: number;
    settingsCashOverrides: number;
    settingsRevision: string | null;
    settingsCashOverrideRules: CashOverrideRule[];
    /** 0052: 論理削除中を含む現金明細の件数。JSON 復元で現金明細を入れてよいかの判定に使う */
    cashEntries: number;
  };
}

/*
 * D1 batch/withSessionは逐次整合性までは型契約にあるが、複数readの同一snapshotは保証しない。
 * backupに影響する全canonical tableを1本のSQLite statementで読み、statement snapshotを境界にする。
 * 表を足すときは既存の `SELECT * FROM (...)` の組へ入れる。1つの UNION ALL に6本目を並べると
 * D1 が "too many terms in compound SELECT" で落ちる(組の数も本数も5まで)。
 * monthly_aggは派生cacheなので意図的に含めない。
 *
 * 禁止事項: improvement_requests をここへ追加しない。
 * 改善要望のスクリーンショットと診断情報は「対応完了から30日で削除する」ことが確定仕様
 * (system-spec の D6/D7)。バックアップ側へ複製すると、その削除が最大30日ぶん骨抜きになる。
 * 改善要望は利用者の一次資産(記帳データ)ではなく、D1障害時に復元できないことを許容している。
 * この不在は packages/api/src/improvement-retention.test.ts が固定する。
 */
const BACKUP_SNAPSHOT_SQL = `
SELECT * FROM (
SELECT 'baseline' AS source, NULL AS id, NULL AS rank, amount,
       month AS v1, scope AS v2, NULL AS v3, NULL AS v4, NULL AS v5,
       NULL AS v6, NULL AS v7, NULL AS v8, NULL AS v9, NULL AS v10, NULL AS v11, NULL AS v12, NULL AS v13, NULL AS v14, NULL AS v15
FROM restored_monthly_agg WHERE user_id = ?
UNION ALL
SELECT 'freee', id, NULL, amount,
       month, date, io, partner, account_raw, account_norm, memo, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM freee_deals WHERE user_id = ?
UNION ALL
SELECT 'mf', id, NULL, amount,
       tx_id, month, date, description, category_major, category_mid, institution, memo,
       CAST(is_target AS TEXT), CAST(is_transfer AS TEXT), NULL, identity_stable, NULL, NULL, NULL
FROM mf_transactions WHERE user_id = ?
UNION ALL
SELECT 'rule', id, sort_order, NULL,
       keyword, cls, category_major, category_mid, owner, payee, scope, split_template_json, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM rules WHERE user_id = ?
UNION ALL
SELECT 'settings_cash_override', NULL, NULL, amount,
       override_id, kind, scope, month, memo, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM settings_cash_overrides WHERE user_id = ?
)
UNION ALL
SELECT * FROM (
SELECT 'edit', payment_method, matched_proposal, NULL,
       tx_id, cls, category_major, category_mid, owner, base_major, base_mid, note, updated_at,
       base_cls, base_owner, stable_key, CAST(fingerprint_version AS TEXT), base_known, institution
FROM tx_edits WHERE user_id = ?
  -- 論理削除中の現金明細を指す手動編集は写さない。明細本体を写さないので、残すと宙に浮く
  AND NOT EXISTS (
    SELECT 1 FROM cash_entries ce
    WHERE ce.user_id = tx_edits.user_id AND ce.deleted_at IS NOT NULL AND tx_edits.tx_id = 'cash:' || ce.id
  )
UNION ALL
SELECT 'budget', NULL, NULL, monthly_amount,
       account, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM budgets WHERE user_id = ?
UNION ALL
SELECT 'cash_override', NULL, expense, revenue,
       month, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM cash_overrides WHERE user_id = ?
UNION ALL
SELECT 'unrecorded', NULL, NULL, NULL,
       month, kind, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM unrecorded_months WHERE user_id = ?
UNION ALL
SELECT 'institution', NULL, NULL, NULL,
       institution, owner, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM institution_owners WHERE user_id = ?
)
UNION ALL
SELECT * FROM (
SELECT 'vendor', id, sort_order, NULL,
       name, aliases, accounts, category, reviewed_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM sub_vendors WHERE user_id = ?
UNION ALL
SELECT 'sub_vendor_review_decision', id, NULL, NULL,
       vendor_key, decision, rule_fingerprint, decided_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM sub_vendor_review_decisions WHERE user_id = ?
UNION ALL
SELECT 'cash', id, NULL, amount,
       date, month, side, io, description, category_major, category_mid, memo, NULL, transit_from, transit_to, transit_round, receipt_waived, owner, transit_purpose
FROM cash_entries WHERE user_id = ? AND deleted_at IS NULL
UNION ALL
SELECT 'split', id, seq, amount,
       tx_id, line_id, cls, category_major, category_mid, memo, created_at, updated_at,
       owner, NULL, NULL, parent_amount, NULL, NULL, NULL
FROM tx_splits WHERE user_id = ?
UNION ALL
SELECT 'norm', NULL, sort_order, enabled,
       raw, norm, rule_id, kind, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM settings_norm_rules WHERE user_id = ?
)
UNION ALL
SELECT * FROM (
SELECT 'analysis_setting', NULL, NULL, stat_min_months,
       NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM analysis_settings WHERE user_id = ?
UNION ALL
SELECT 'sub_vendor_exclusion', id, NULL, NULL,
       partner, vendor_key, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM sub_vendor_exclusions WHERE user_id = ?
UNION ALL
SELECT 'budget_plan', NULL, plan_adjustment, annual_amount,
       account, period_start, kind, plan_reason, updated_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM budget_plans WHERE user_id = ?
UNION ALL
SELECT 'owner_label', NULL, NULL, NULL,
       owner, label, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM owner_labels WHERE user_id = ?
)
UNION ALL
SELECT * FROM (
SELECT 'review_snooze', NULL, NULL, NULL,
       item_kind, item_key, fingerprint, snoozed_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM review_snoozes WHERE user_id = ?
UNION ALL
SELECT 'monthly_close_review', NULL, NULL, NULL,
       month, reviewed_at, reviewed_by_user_id, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM monthly_close_reviews WHERE user_id = ?
UNION ALL
SELECT 'duplicate_verdict', NULL, NULL, NULL,
       tx_id, verdict, CAST(stable_key AS TEXT), CAST(fingerprint_version AS TEXT), decided_at, updated_at, freee_key, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM duplicate_verdicts WHERE user_id = ?
UNION ALL
SELECT 'freee_deal_exclusion', NULL, NULL, NULL,
       freee_key, reason, reason_code, memo, created_at, updated_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM freee_deal_exclusions WHERE user_id = ?
UNION ALL
SELECT 'total_cashflow_operation', NULL, NULL, item_count,
       id, kind, items_json, undoes_id, undone_at, created_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
FROM total_cashflow_operations WHERE user_id = ?
)
ORDER BY source, rank, id, v1, v2`;

/** export用canonical rowsを、単一D1 read statementから型付きsnapshotへ変換する。 */
async function loadBackupSourceSnapshot(db: Db, userId: string): Promise<BackupSourceSnapshot> {
  const params = Array.from({ length: 24 }, () => userId);
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
        memo: row.v8 ?? undefined,
        // CAST(... AS TEXT) 済み。'0' のときだけ非対象/振替と読む
        isTarget: row.v9 !== '0',
        isTransfer: row.v10 === '1',
      }),
    )
    .sort((a, b) => a.m.localeCompare(b.m) || a.d.localeCompare(b.d) || a.id.localeCompare(b.id));
  const ruleRows = bySource('rule').sort(
    (a, b) => (a.rank ?? 0) - (b.rank ?? 0) || Number(a.id ?? 0) - Number(b.id ?? 0),
  );
  const rules = ruleRows.length
    ? ruleRows.map(
        (row): Rule => ({
          k: row.v1 ?? '',
          cls: row.v2 === 'biz' || row.v2 === 'per' ? row.v2 : null,
          big: row.v3,
          mid: row.v4,
          owner: normalizeOwner(row.v5),
          payee: row.v6,
          scope: row.v7 === 'unconfirmed' ? 'unconfirmed' : 'all',
          splitTemplate: parseSplitTemplate(row.v8),
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
      // 0030 で足した基準値。base_major/base_mid と同じ扱いにしないと、復元の直後の
      // 再取込で公私・名義だけが「利用者は触っていない」と読まれ、手当てが失われる(D6)
      baseCls: row.v10 === 'biz' || row.v10 === 'per' ? row.v10 : null,
      baseOwner: normalizeOwner(row.v11),
      // 第二の引き当て鍵(DR-13)。SQL側で TEXT に寄せてあるので数へ戻す
      stableKey: row.v12 == null ? null : String(row.v12),
      fingerprintVersion: row.v13 == null ? null : Number(row.v13),
      baseKnown: row.v14 == null ? undefined : Number(row.v14),
      // 0035 の口座の振替。base を持たないので、値そのものだけを運ぶ
      inst: row.v15,
      // 0046。editで未使用だった汎用id/rank枠に載せ、snapshotの列数を増やさない
      paymentMethod: row.id === 'cash' || row.id === 'card' || row.id === 'account' ? row.id : null,
      matchedProposal: row.rank == null ? null : Number(row.rank),
    };
  }
  const institutionOwners: Dataset['institutionOwners'] = {};
  for (const row of bySource('institution')) {
    const owner = normalizeOwner(row.v2);
    if (owner) institutionOwners[row.v1 ?? ''] = owner;
  }
  const vendors = bySource('vendor')
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || Number(a.id ?? 0) - Number(b.id ?? 0))
    .map((row) => ({
      id: Number(row.id ?? 0),
      name: row.v1 ?? '',
      aliases: parseStringArray(row.v2 ?? '[]'),
      accounts: parseStringArray(row.v3 ?? '[]'),
      category: row.v4,
      reviewedAt: row.v5,
    }));
  const budgets: Dataset['budgets'] = {};
  for (const row of bySource('budget')) if (row.amount != null) budgets[row.v1 ?? ''] = row.amount;
  const budgetPlans: BudgetPlanRow[] = bySource('budget_plan').map((row) => ({
    periodStart: row.v2 ?? '',
    account: row.v1 ?? '',
    kind: row.v3 === 'income' ? 'income' : 'expense',
    annualAmount: row.amount ?? 0,
    planAdjustment: row.rank ?? 0,
    planReason: row.v4,
    updatedAt: row.v5 ?? '',
  }));
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
        id: Number(row.id ?? 0),
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
        // 0052。cash 行で未使用だった v14/v15 に載せ、snapshot の列数を増やさない
        owner: normalizeOwner(row.v14 == null ? null : String(row.v14)),
        transitPurpose: row.v15 ?? null,
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const txSplits = bySource('split')
    .map(
      (row): TxSplit => ({
        txId: row.v1 ?? '',
        lineId: row.v2 ?? '',
        seq: row.rank ?? 0,
        parentAmount: typeof row.v12 === 'number' ? row.v12 : Number(row.v12 ?? 0),
        amount: row.amount ?? 0,
        cls: row.v3 === 'biz' ? 'biz' : 'per',
        categoryMajor: row.v4 ?? '',
        categoryMid: row.v5 ?? '',
        // 0035: 内訳1行の名義。未指定(NULL)は元の明細の名義に従う
        ...(normalizeOwner(row.v9) ? { owner: normalizeOwner(row.v9) } : {}),
        ...(row.v6 ? { memo: row.v6 } : {}),
        ...(row.v7 ? { createdAt: row.v7 } : {}),
        ...(row.v8 ? { updatedAt: row.v8 } : {}),
      }),
    )
    .sort((a, b) => a.txId.localeCompare(b.txId) || a.seq - b.seq);
  // 0051: 集計ルールは settings_norm_rules が正本。normMap は有効な勘定科目ルールから組み直す
  const normRules = bySource('norm')
    .map((row) =>
      normRuleFromRow({
        ruleId: row.v3 ?? '',
        kind: row.v4 ?? '',
        raw: row.v1 ?? '',
        norm: row.v2 ?? '',
        sortOrder: row.rank ?? 0,
        enabled: row.amount ?? 0,
      }),
    )
    .sort((a, b) => a.order - b.order || a.ruleId.localeCompare(b.ruleId))
    .map((rule, i) => ({ ...rule, order: i + 1 }));
  const normMap = accountNormMap(normRules);
  const cashOverrideRules = sortCashOverrides(
    bySource('settings_cash_override').map((row) =>
      cashOverrideRuleFromRow({
        overrideId: row.v1 ?? '',
        kind: row.v2 ?? '',
        amount: row.amount,
        scope: row.v3 ?? '',
        month: row.v4,
        memo: row.v5 ?? '',
      }),
    ),
  );
  const ownerLabels: Record<string, string> = {};
  for (const row of bySource('owner_label')) ownerLabels[row.v1 ?? ''] = row.v2 ?? '';
  const statMinMonths = bySource('analysis_setting')[0]?.amount ?? DEFAULT_STAT_MIN_MONTHS;
  const subVendorExclusions = bySource('sub_vendor_exclusion').map((row) => ({
    partner: row.v1 ?? '',
    vendorKey: row.v2 ?? '',
  }));
  const subVendorReviewDecisions = bySource('sub_vendor_review_decision').map((row) => ({
    vendorKey: row.v1 ?? '',
    decision: row.v2 === 'dismissed' ? ('dismissed' as const) : ('confirmed' as const),
    ruleFingerprint: row.v3 ?? '',
    decidedAt: row.v4 ?? '',
  }));
  const reviewSnoozes = bySource('review_snooze').map((row) => ({
    kind: row.v1 ?? '',
    itemKey: row.v2 ?? '',
    fingerprint: row.v3 ?? '',
    snoozedAt: row.v4 ?? '',
  }));
  const monthlyCloseReviews = bySource('monthly_close_review').map((row) => ({
    month: row.v1 ?? '',
    reviewedAt: row.v2 ?? '',
    reviewedByUserId: row.v3 ?? '',
  }));
  const duplicateVerdicts = bySource('duplicate_verdict').map((row) => ({
    txId: row.v1 ?? '',
    verdict: row.v2 ?? '',
    // 第二の引き当て鍵(DR-13)と版。SQL側で TEXT に寄せてあるので、版だけ数へ戻す
    stableKey: row.v3,
    fingerprintVersion: row.v4 == null ? null : Number(row.v4),
    decidedAt: row.v5,
    updatedAt: row.v6,
    freeeKey: row.v7,
  }));
  const freeeDealExclusions = bySource('freee_deal_exclusion').map((row) => ({
    freeeKey: row.v1 ?? '',
    reason: row.v2 ?? '',
    // 0041 の理由コードと補足。0037 以前の行は NULL なので、空文字へ丸めない
    reasonCode: row.v3,
    memo: row.v4,
    createdAt: row.v5,
    updatedAt: row.v6,
  }));
  const totalCashflowOperations = bySource('total_cashflow_operation').map((row) => ({
    id: row.v1 ?? '',
    kind: row.v2 ?? '',
    itemsJson: row.v3 ?? '',
    itemCount: row.amount ?? 0,
    undoesId: row.v4,
    undoneAt: row.v5,
    createdAt: row.v6 ?? '',
  }));

  return {
    baselineRows,
    deals,
    txs,
    rules,
    edits,
    institutionOwners,
    vendors,
    budgets,
    budgetPlans,
    cashOverride,
    unrecordedExpMonths,
    cashEntries,
    txSplits,
    normMap,
    normRules,
    cashOverrideRules,
    ownerLabels,
    statMinMonths,
    subVendorExclusions,
    subVendorReviewDecisions,
    reviewSnoozes,
    monthlyCloseReviews,
    duplicateVerdicts,
    freeeDealExclusions,
    totalCashflowOperations,
  };
}

/** restore planningが使う設定群を1 statement snapshotで読む。query budgetを増やさない。 */
export async function loadImportRestoreSettingsSnapshot(
  db: Db,
  userId: string,
): Promise<ImportRestoreSettingsSnapshot> {
  const sql = `SELECT * FROM (
       SELECT 'norm' AS source, raw AS v1, norm AS v2, sort_order AS amount
         FROM settings_norm_rules WHERE user_id=? AND kind='account' AND enabled=1
       UNION ALL
       SELECT 'analysis', NULL, NULL, stat_min_months
         FROM analysis_settings WHERE user_id=?
       UNION ALL
       SELECT 'exclusion', partner, vendor_key, NULL
         FROM sub_vendor_exclusions WHERE user_id=?
       UNION ALL
       SELECT 'sub_vendor', json_object(
         'id',id,'name',name,'aliases',json(aliases),'accounts',json(accounts),
         'category',category,'reviewedAt',reviewed_at), NULL, NULL
         FROM sub_vendors WHERE user_id=?
       UNION ALL
       SELECT 'sub_vendor_review_decision', json_object(
         'vendorKey',vendor_key,'decision',decision,'ruleFingerprint',rule_fingerprint,'decidedAt',decided_at
       ), NULL, NULL
         FROM sub_vendor_review_decisions WHERE user_id=?
       )
       UNION ALL
       SELECT * FROM (
       SELECT 'cash', json_object(
         'id',id,'date',date,'month',month,'side',side,'io',io,'amount',amount,
         'description',description,'categoryMajor',category_major,'categoryMid',category_mid,
         'memo',memo,'transitFrom',transit_from,'transitTo',transit_to,
         'transitRound',transit_round,'receiptWaived',receipt_waived,
         'owner',owner,'transitPurpose',transit_purpose), NULL, NULL
         FROM cash_entries WHERE user_id=? AND deleted_at IS NULL
       UNION ALL
       SELECT 'freee', json_object(
         'month',month,'date',date,'io',io,'partner',partner,'accountRaw',account_raw,
         'accountNorm',account_norm,'amount',amount,'dueDate',due_date,'settledDate',settled_date,
         'settleAccount',settle_account,'settledAmount',settled_amount,'settlementKnown',settlement_known), NULL, NULL
         FROM freee_deals WHERE user_id=?
       UNION ALL
       SELECT 'split', json_object(
         'txId',tx_id,'lineId',line_id,'seq',seq,'parentAmount',parent_amount,'amount',amount,
         'cls',cls,'categoryMajor',category_major,'categoryMid',category_mid,'memo',memo,
         'owner',owner,'createdAt',created_at,'updatedAt',updated_at), NULL, NULL
         FROM tx_splits WHERE user_id=?
       UNION ALL
       SELECT 'vendor_memories', json_object(
         'vendorMemories', json((
           SELECT json_group_array(json_object(
             'vendorKey',vendor_key,'vendorLabel',vendor_label,'cls',cls,
             'big',category_major,'mid',category_mid,'owner',owner,
             'hitCount',hit_count,'disagreeCount',disagree_count,
             'pinned',pinned,'revoked',revoked))
           FROM vendor_memory WHERE user_id=?
         ))
       ), NULL, NULL
       UNION ALL
       SELECT 'destination_counts', json_object(
         'reviewSnoozes', (SELECT count(*) FROM review_snoozes WHERE user_id=?),
         'monthlyCloseReviews', (SELECT count(*) FROM monthly_close_reviews WHERE user_id=?),
         'duplicateVerdicts', (SELECT count(*) FROM duplicate_verdicts WHERE user_id=?),
         'freeeDealExclusions', (SELECT count(*) FROM freee_deal_exclusions WHERE user_id=?),
         'totalCashflowOperations', (SELECT count(*) FROM total_cashflow_operations WHERE user_id=?),
         'rules', (SELECT count(*) FROM rules WHERE user_id=?),
         'txEdits', (SELECT count(*) FROM tx_edits WHERE user_id=?),
         'institutionOwners', (SELECT count(*) FROM institution_owners WHERE user_id=?),
         'budgets', (SELECT count(*) FROM budgets WHERE user_id=?),
         'budgetPlans', (SELECT count(*) FROM budget_plans WHERE user_id=?),
         'cashOverrides', (SELECT count(*) FROM cash_overrides WHERE user_id=?),
         -- 論理削除中も数える。id が残っているので、復元で同じ id を入れると衝突する
         'cashEntries', (SELECT count(*) FROM cash_entries WHERE user_id=?),
         'settingsNormRules', (SELECT count(*) FROM settings_norm_rules WHERE user_id=?),
         'settingsCashOverrides', (SELECT count(*) FROM settings_cash_overrides WHERE user_id=?),
         'settingsRevision', (SELECT MAX(changed_at) FROM settings_change_log WHERE user_id=?),
         'settingsCashOverrideRules', json((
           SELECT json_group_array(json_object(
             'overrideId',override_id,'kind',kind,'amount',amount,'scope',scope,'month',month,'memo',memo))
           FROM settings_cash_overrides WHERE user_id=?
         ))
       ), NULL, NULL
       )
       ORDER BY source, v1, v2`;
  // ? はすべて user_id なので、SQL から数えて同じ数だけ渡す。件数を手で書くと、
  // 別々のブランチが同じ数へ増やしたときに merge が衝突せず、実行時まで壊れに気づけない
  const result = await db.$client
    .prepare(sql)
    .bind(...Array.from({ length: sql.split('?').length - 1 }, () => userId))
    .all<{ source: string; v1: string | null; v2: string | null; amount: number | null }>();
  // 有効な勘定科目行を並び順に見て、同じ元の表記は最初の行 (core accountNormMap と同じ)
  const normMap = accountNormMap(
    result.results
      .filter((row) => row.source === 'norm')
      .map((row, i) => ({
        ruleId: String(i),
        kind: 'account' as const,
        raw: row.v1 ?? '',
        norm: row.v2 ?? '',
        order: row.amount ?? i,
        enabled: true,
      })),
  );
  const payloads = <T>(source: string): T[] =>
    result.results
      .filter((row) => row.source === source && row.v1)
      .map((row) => JSON.parse(row.v1 ?? 'null') as T);
  const cashEntries = payloads<
    Omit<CashEntry, 'transitRound' | 'receiptWaived'> & { transitRound: number; receiptWaived: number }
  >('cash').map((row) => ({
    ...row,
    transitRound: row.transitRound === 1,
    receiptWaived: row.receiptWaived === 1,
    owner: normalizeOwner(row.owner),
    transitPurpose: row.transitPurpose ?? null,
  }));
  const freeeDeals = payloads<
    Omit<FreeeDeal, 'partner' | 'accountRaw' | 'accountNorm'> & {
      partner: string | null;
      accountRaw: string | null;
      accountNorm: string | null;
      settlementKnown: number;
    }
  >('freee').map((row) => {
    const { settlementKnown, dueDate, settledDate, settleAccount, settledAmount, ...base } = row;
    const normalized = {
      ...base,
      partner: base.partner ?? '',
      accountRaw: base.accountRaw ?? '',
      accountNorm: base.accountNorm ?? '',
    };
    return settlementKnown === 1
      ? { ...normalized, dueDate, settledDate, settleAccount, settledAmount }
      : normalized;
  });
  const txSplits = payloads<
    TxSplit & { memo?: string | null; createdAt?: string | null; updatedAt?: string | null }
  >('split').map(({ memo, createdAt, updatedAt, owner, ...row }) => ({
    ...row,
    // 未指定(NULL)は「元の明細の名義に従う」。キーごと落として既定を復元する
    ...(owner ? { owner } : {}),
    ...(memo ? { memo } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  }));
  const memoryGroup = payloads<{
    vendorMemories: Array<
      Omit<VendorMemoryRecord, 'pinned' | 'revoked'> & { pinned: number; revoked: number }
    >;
  }>('vendor_memories')[0] ?? { vendorMemories: [] };
  const vendorMemories = memoryGroup.vendorMemories
    .map((row) => ({
      ...row,
      pinned: row.pinned === 1,
      revoked: row.revoked === 1,
    }))
    .sort((a, b) => a.vendorKey.localeCompare(b.vendorKey, 'ja'));
  const subVendors = payloads<SubVendorWithReview>('sub_vendor').sort((a, b) => a.id - b.id);
  const subVendorReviewDecisions = payloads<SubVendorReviewDecisionRow>('sub_vendor_review_decision');
  const destinationRowCounts = payloads<ImportRestoreSettingsSnapshot['destinationRowCounts']>(
    'destination_counts',
  )[0] ?? {
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
    budgetPlans: 0,
    cashOverrides: 0,
    settingsNormRules: 0,
    settingsCashOverrides: 0,
    settingsRevision: null,
    settingsCashOverrideRules: [],
    cashEntries: 0,
  };
  destinationRowCounts.settingsCashOverrideRules = sortCashOverrides(
    (destinationRowCounts.settingsCashOverrideRules ?? []).map(cashOverrideRuleFromRow),
  );
  destinationRowCounts.subVendorReviewDecisions = subVendorReviewDecisions.length;
  return {
    normMap,
    statMinMonths: result.results.find((row) => row.source === 'analysis')?.amount ?? DEFAULT_STAT_MIN_MONTHS,
    subVendorExclusions: result.results
      .filter((row) => row.source === 'exclusion')
      .map((row) => ({ partner: row.v1 ?? '', vendorKey: row.v2 ?? '' })),
    subVendors,
    subVendorReviewDecisions,
    cashEntries,
    freeeDeals,
    txSplits,
    vendorMemories,
    destinationRowCounts,
  };
}

/** monthly_aggを読まず、canonical snapshotだけからexport対象Datasetを一度だけ組み立てる。 */
function datasetFromBackupSnapshot(snapshot: BackupSourceSnapshot): Dataset {
  const data = emptyDataset();
  data.rules = snapshot.rules;
  data.edits = snapshot.edits;
  data.institutionOwners = snapshot.institutionOwners;
  data.budgets = snapshot.budgets;
  data.budgetPlans = snapshot.budgetPlans;
  data.cashOverride = snapshot.cashOverride;
  data.normRules = snapshot.normRules;
  data.cashOverrideRules = snapshot.cashOverrideRules;
  data.unrecordedExpMonths = [...snapshot.unrecordedExpMonths];
  data.txSplits = [...snapshot.txSplits];
  data.subs.vendors = snapshot.vendors.map((vendor) => vendor.name);
  data.subs.aliases = Object.fromEntries(snapshot.vendors.map((vendor) => [vendor.name, vendor.aliases]));
  data.subs.accounts = Object.fromEntries(
    snapshot.vendors.map((vendor) => [vendor.name, vendor.accounts ?? []]),
  );

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
  const raw = datasetFromBackupSnapshot(snapshot);
  const accounting = projectAccountingDataset(raw);
  const rows = projectCashContribution(accounting, snapshot.cashEntries, snapshot.normMap);
  const aggregate = aggregateAmounts(accounting);
  if (rows.some((row) => row.amount > (aggregate.get(projectionKey(row)) ?? 0))) {
    throw new CashProjectionError('cash_projection_underflow');
  }
  const cashProjection: CashProjectionEnvelope = { version: 1, basis: 'post-resolution', rows };
  return {
    ...exportJSON(accounting),
    // projection childは表示・集計専用。snapshotのcanonical MF原本は親行のまま保存する。
    mfTx: raw.mfTx,
    analysisSettings: { statMinMonths: snapshot.statMinMonths },
    // 0045: 名義の表示名。設定の比較・設定だけの復元 (settingsJsonFromBackup) が読む
    ownerLabels: snapshot.ownerLabels,
    subVendorExclusions: snapshot.subVendorExclusions.map(({ partner }) => ({ partner })),
    subVendorMetadata: snapshot.vendors.map(({ name, category, reviewedAt }) => ({
      name,
      category,
      reviewedAt,
    })),
    subVendorReviewDecisions: snapshot.subVendorReviewDecisions,
    cashEntries: snapshot.cashEntries,
    cashProjection,
    // 0040: 保留と月次レビューは利用者の判断の記録。復元で失うと、片付けた未処理が全部戻ってくる
    reviewSnoozes: snapshot.reviewSnoozes,
    monthlyCloseReviews: snapshot.monthlyCloseReviews,
    // 0041: 総収支の判断。落とすと復元後の総額が、判断する前の金額に戻ってしまう
    duplicateVerdicts: snapshot.duplicateVerdicts,
    freeeDealExclusions: snapshot.freeeDealExclusions,
    // 判断だけ戻して履歴を残すと、取消ボタンが復元前の操作を指して二重に戻す
    totalCashflowOperations: snapshot.totalCashflowOperations,
  };
}

/** sourceで確定したcashProjectionを再演算せず、そのcanonical scopeへ戻す。 */
export function addCashProjection(data: Dataset, rows: ReadonlyArray<AggValue>): void {
  const months = new Set(rows.map((row) => row.month));
  for (const month of months) ensureMonth(data, month);
  addPersonalBaseline(data, rows, months);
  addBusinessBaseline(data, rows, months);
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

/**
 * 見直し記録つきのベンダー行。
 * 集計(loadDataset)には見直し日は要らないので、SubVendorRow とは別の型にして
 * 「集計経路では取っていない」ことを型で見えるようにする。
 */
export interface SubVendorWithReview extends SubVendorRow {
  /** 最後に契約を見直した日時(ISO)。null は一度も見直していない */
  reviewedAt: string | null;
  /** 0043: 利用者が上書きしたカテゴリ。null は既定辞書に従う */
  category: string | null;
}

const parseStringArray = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** 登録順(sort_order, id)で返す。マイグレーション 0005 で既定8件が入る */
export async function loadSubVendors(db: Db, userId: string): Promise<SubVendorWithReview[]> {
  const rows = await db
    .select()
    .from(s.subVendors)
    .where(eq(s.subVendors.userId, userId))
    .orderBy(asc(s.subVendors.sortOrder), asc(s.subVendors.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    aliases: parseStringArray(r.aliases),
    accounts: parseStringArray(r.accounts),
    reviewedAt: r.reviewedAt ?? null,
    category: r.category ?? null,
  }));
}

export interface SubVendorReviewDecisionRow {
  vendorKey: string;
  decision: 'confirmed' | 'dismissed';
  ruleFingerprint: string;
  decidedAt: string;
}

/** 0043: 見直し候補への判断。1 ベンダー 1 行。候補の判定は core が毎回やり直す */
export async function loadSubVendorReviewDecisions(
  db: Db,
  userId: string,
): Promise<SubVendorReviewDecisionRow[]> {
  const rows = await db
    .select()
    .from(s.subVendorReviewDecisions)
    .where(eq(s.subVendorReviewDecisions.userId, userId))
    .orderBy(asc(s.subVendorReviewDecisions.id));
  return rows.map((r) => ({
    vendorKey: r.vendorKey,
    decision: r.decision,
    ruleFingerprint: r.ruleFingerprint,
    decidedAt: r.decidedAt,
  }));
}

export interface SubVendorExclusionRow {
  id: number;
  partner: string;
}

/** 「サブスクではない」と記録した支払先(候補一覧から外す)。登録が古い順 */
export async function loadSubVendorExclusions(db: Db, userId: string): Promise<SubVendorExclusionRow[]> {
  const rows = await db
    .select()
    .from(s.subVendorExclusions)
    .where(eq(s.subVendorExclusions.userId, userId))
    .orderBy(asc(s.subVendorExclusions.id));
  return rows.map((r) => ({ id: r.id, partner: r.partner }));
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

/**
 * canonical書込みとmonthly_agg入れ替えを1つのD1 batchにするための、未確定状態。
 * 削除/undoはDBを先に動かさず、この差分を現在snapshotへ重ねて派生集計を計画する。
 */
export interface RecomputeCanonicalMutation {
  affectedMonths: readonly string[];
  removeMfTxIds?: readonly string[];
  removeFreeeDealIds?: readonly number[];
  clearRestoredMonthlyAgg?: boolean;
  restoreMfTx?: readonly MfTx[];
  restoreFreeeDeals?: readonly FreeeDeal[];
  restoreMonthlyAgg?: ReadonlyArray<{ month: string; scope: string; amount: number }>;
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
  canonicalMutation?: RecomputeCanonicalMutation,
): Promise<RecomputePlan> {
  const [normMap, databaseDealRows, databaseBaselineRows, rawMfRows, cashEntries] = await Promise.all([
    loadNormMap(db, userId),
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.restoredMonthlyAgg).where(eq(s.restoredMonthlyAgg.userId, userId)),
    db
      .select({ txId: s.mfTransactions.txId, month: s.mfTransactions.month })
      .from(s.mfTransactions)
      .where(eq(s.mfTransactions.userId, userId)),
    cashEntriesSnapshot === undefined
      ? loadCashEntries(db, userId)
      : Promise.resolve([...cashEntriesSnapshot]),
  ]);
  const removedDeals = new Set(canonicalMutation?.removeFreeeDealIds ?? []);
  const dealRows = databaseDealRows.filter((row) => !removedDeals.has(row.id));
  const baselineRows = canonicalMutation?.clearRestoredMonthlyAgg ? [] : [...databaseBaselineRows];
  for (const row of canonicalMutation?.restoreMonthlyAgg ?? []) {
    const index = baselineRows.findIndex(
      (current) => current.month === row.month && current.scope === row.scope,
    );
    if (index >= 0) baselineRows[index] = { ...baselineRows[index]!, amount: row.amount };
    else baselineRows.push({ userId, ...row });
  }

  const normalizedDealUpdates = dealRows
    .map((row) => ({ id: row.id, accountNorm: normalizeAccount(row.accountRaw ?? '', normMap) }))
    .filter((row, index) => row.accountNorm !== dealRows[index]?.accountNorm);
  let data = await loadDataset(
    db,
    userId,
    cashEntries,
    // 集計キャッシュは現金の原本の値で書く。現金上書きは読み出し (loadDataset) の側で掛ける
    canonicalMutation ? { withSplits: false, loadSplitRows: true } : { cashOverrides: false },
  );
  if (canonicalMutation) {
    const removedMf = new Set(canonicalMutation.removeMfTxIds ?? []);
    data.mfTx = data.mfTx.filter((tx) => !removedMf.has(tx.id));
    const byId = new Map(data.mfTx.map((tx) => [tx.id, tx]));
    for (const tx of canonicalMutation.restoreMfTx ?? []) {
      byId.set(tx.id, { ...tx });
      ensureMonth(data, tx.m);
    }
    data.mfTx = [...byId.values()];
    data = projectAccountingDataset(data);
  }
  const restoredMfMonths = (canonicalMutation?.restoreMfTx ?? []).map((row) => row.m);
  const removedMfTxIds = new Set(canonicalMutation?.removeMfTxIds ?? []);
  const rawMfMonths = new Set([
    ...rawMfRows.filter((row) => !removedMfTxIds.has(row.txId)).map((row) => row.month),
    ...restoredMfMonths,
  ]);
  const personalMonths = new Set([
    ...rawMfMonths,
    ...personalBaselineMonths(baselineRows),
    ...cashEntries.filter((entry) => entry.side === 'per').map((entry) => entry.month),
    ...affectedCashEntries.filter((entry) => entry.side === 'per').map((entry) => entry.month),
    ...(canonicalMutation?.affectedMonths ?? []),
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
  const restoredDeals = (canonicalMutation?.restoreFreeeDeals ?? []).map((deal) => ({
    ...deal,
    accountNorm: normalizeAccount(deal.accountRaw, normMap),
  }));
  const freeeMonths = new Set([...dealRows.map((r) => r.month), ...restoredDeals.map((r) => r.month)]);
  const affectedBusinessMonths = affectedCashEntries
    .filter((entry) => entry.side === 'biz')
    .map((entry) => entry.month);
  const months = [
    ...new Set([
      ...freeeMonths,
      ...businessBaselineMonths(baselineRows),
      ...cashDeals.map((d) => d.month),
      ...affectedBusinessMonths,
      ...(canonicalMutation?.affectedMonths ?? []),
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
        ...restoredDeals,
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

export type DbBatchQueries = Parameters<Db['batch']>[0];
/** batch へ渡す文 1 つ。空配列を許すので、明細ごとの文を連結してから batch へ渡せる */
export type DbBatchQuery = DbBatchQueries[number];

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

/** canonical split集合の親単位置換。行数に依存せず、aggregateと同じbatchへ組み込める。 */
export function splitReplacementQueries(
  db: Db,
  userId: string,
  txId: string,
  rows: ReadonlyArray<TxSplit>,
  now = new Date().toISOString(),
): DbBatchQueries {
  const remove = db.delete(s.txSplits).where(and(eq(s.txSplits.userId, userId), eq(s.txSplits.txId, txId)));
  if (rows.length === 0) return [remove];
  const payload = d1JsonPayload(
    rows.map((row) => [
      row.lineId,
      row.seq,
      row.parentAmount,
      row.amount,
      row.cls,
      row.categoryMajor,
      row.categoryMid,
      row.memo ?? null,
      row.createdAt ?? now,
      now,
      row.owner ?? null,
    ]),
  );
  return [
    remove,
    db.insert(s.txSplits).select(sql`
      SELECT
        NULL, ${userId}, ${txId},
        json_extract(value, '$[0]'),
        json_extract(value, '$[1]'),
        json_extract(value, '$[2]'),
        json_extract(value, '$[3]'),
        json_extract(value, '$[4]'),
        json_extract(value, '$[5]'),
        json_extract(value, '$[6]'),
        json_extract(value, '$[7]'),
        json_extract(value, '$[8]'),
        json_extract(value, '$[9]'),
        json_extract(value, '$[10]')
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

/** Drizzleの集計正本を、native D1 batchの他statementと同居できる形へ変換する。 */
export function recomputePlanStatements(
  database: D1Database,
  userId: string,
  plan: RecomputePlan,
): D1PreparedStatement[] {
  const queries = recomputePlanQueries(getDb(database), userId, plan);
  return queries.map((query) => {
    if (!('toSQL' in query) || typeof query.toSQL !== 'function') {
      throw new D1BulkPayloadError('invalid_bulk_update');
    }
    const built = query.toSQL();
    return database.prepare(built.sql).bind(...built.params);
  });
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
  // 決済列の無い取込(settlementKnown=0)は undefined に戻す。DB上の NULL は
  // 「列が無い」と「空欄」の両方になるため、この区別は settlement_known だけが持っている。
  ...(r.settlementKnown === 1
    ? {
        dueDate: r.dueDate,
        settledDate: r.settledDate,
        settleAccount: r.settleAccount,
        settledAmount: r.settledAmount,
      }
    : {}),
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
    dueDate: d.dueDate ?? null,
    settledDate: d.settledDate ?? null,
    settleAccount: d.settleAccount ?? null,
    settledAmount: d.settledAmount ?? null,
    settlementKnown: hasSettlementColumns(d) ? 1 : 0,
  }));
  for (const grp of chunk(rows, 10)) await db.insert(s.freeeDeals).values(grp);
}

/**
 * 科目正規化マップの取得。正本は設定画面の集計ルール (0051) の有効な勘定科目行で、
 * 同じ元の表記は並び順の最初の行が効く (core accountNormMap)。旧 account_norm_map は互換の写しとして残るだけ。
 */
export async function loadNormMap(db: Db, userId: string): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(s.settingsNormRules)
    .where(and(eq(s.settingsNormRules.userId, userId), eq(s.settingsNormRules.kind, 'account')))
    .orderBy(asc(s.settingsNormRules.sortOrder), asc(s.settingsNormRules.ruleId));
  return accountNormMap(rows.map((r, i) => ({ ...normRuleFromRow(r), order: i + 1 })));
}
