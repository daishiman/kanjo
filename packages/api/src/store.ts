/**
 * D1 ⇔ Dataset(HTML版DATA形状) の変換層。
 *
 * - 事業側(freee由来)の系列は monthly_agg を正とする。restore(JSON移行)で原本仕訳が無い月も
 *   monthly_agg に直接持てるため、原本の有無に依らず同じ読み出しで復元できる。
 * - 個人側(MF由来)は生明細+ルール+手動判定から毎回再計算する(数千行規模・spec §7.3)。
 *   restoreのみで明細が無い月は monthly_agg の per_* スコープから温存復元する。
 */
import {
  DEFAULT_RULES,
  type Dataset,
  type FreeeDeal,
  type MfTx,
  type Rule,
  type SubVendor,
  type TxEdit,
  applyFreeeDeals,
  emptyDataset,
  normalizeAccount,
  recomputeClassification,
} from '@kanjo/core';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as s from './db/schema.js';

export type Db = ReturnType<typeof drizzle>;

export const getDb = (d1: D1Database): Db => drizzle(d1);

const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

/* ------------------------- 行 ⇔ 型 ------------------------- */

export const ruleFromRow = (r: typeof s.rules.$inferSelect): Rule => ({
  k: r.keyword,
  cls: r.cls ?? null,
  big: r.categoryMajor ?? null,
  mid: r.categoryMid ?? null,
  owner: r.owner ?? null,
});

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
  await db.delete(s.txEdits).where(and(eq(s.txEdits.userId, userId), eq(s.txEdits.txId, txId)));
  if (editIsEmpty(e)) return;
  await db.insert(s.txEdits).values({
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
  });
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
  map: Record<string, 'self' | 'spouse'>,
): Promise<void> {
  await db.delete(s.institutionOwners).where(eq(s.institutionOwners.userId, userId));
  const rows = Object.entries(map).map(([institution, owner]) => ({ userId, institution, owner }));
  for (const grp of chunk(rows, 30)) await db.insert(s.institutionOwners).values(grp);
}

/* ------------------------- 読み出し ------------------------- */

export async function loadDataset(db: Db, userId: string): Promise<Dataset> {
  const [aggRows, txRows, ruleRows, editRows, budgetRows, cashRows, unrecRows, instRows, vendorRows] =
    await Promise.all([
      db.select().from(s.monthlyAgg).where(eq(s.monthlyAgg.userId, userId)),
      db
        .select()
        .from(s.mfTransactions)
        .where(eq(s.mfTransactions.userId, userId))
        .orderBy(asc(s.mfTransactions.month), asc(s.mfTransactions.date)),
      db.select().from(s.rules).where(eq(s.rules.userId, userId)).orderBy(asc(s.rules.sortOrder)),
      db.select().from(s.txEdits).where(eq(s.txEdits.userId, userId)),
      db.select().from(s.budgets).where(eq(s.budgets.userId, userId)),
      db.select().from(s.cashOverrides).where(eq(s.cashOverrides.userId, userId)),
      db.select().from(s.unrecordedMonths).where(eq(s.unrecordedMonths.userId, userId)),
      db.select().from(s.institutionOwners).where(eq(s.institutionOwners.userId, userId)),
      loadSubVendors(db, userId),
    ]);

  const data = emptyDataset();

  // 月の全集合(集計キャッシュ+明細)
  const monthSet = new Set<string>();
  aggRows.forEach((r) => monthSet.add(r.month));
  txRows.forEach((r) => monthSet.add(r.month));
  data.months = [...monthSet].sort();
  const idx = new Map(data.months.map((m, i) => [m, i]));

  // 事業側の系列を monthly_agg から復元
  const catSet = new Set<string>();
  // ベンダーは sub_vendors が正。集計キャッシュに残る登録外の名前(削除直後など)も読み出しだけは通す
  const vendorSet = new Set<string>(vendorRows.map((v) => v.name));
  for (const r of aggRows) {
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
      m: r.month,
      d: r.date.slice(5).replace('-', '/'),
      c: r.description,
      a: r.amount,
      big: r.categoryMajor ?? '',
      mid: r.categoryMid ?? '',
      inst: r.institution ?? undefined,
    }),
  );
  data.rules = ruleRows.length ? ruleRows.map(ruleFromRow) : [...DEFAULT_RULES];
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

  // 生明細がある月は再計算が正(ルール・手動判定の現在値を反映)
  recomputeClassification(data);
  return data;
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

/**
 * freee 原本仕訳から事業側の集計を作り直す(正規化マップ・ベンダー登録の変更時)。
 * account_norm 列も新マップで更新する。
 */
export async function recomputeFromDeals(db: Db, userId: string): Promise<void> {
  const normMap = await loadNormMap(db, userId);
  const dealRows = await db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId));
  for (const r of dealRows) {
    const norm = normalizeAccount(r.accountRaw ?? '', normMap);
    if (norm !== r.accountNorm) {
      await db.update(s.freeeDeals).set({ accountNorm: norm }).where(eq(s.freeeDeals.id, r.id));
    }
  }
  const data = await loadDataset(db, userId);
  // 削除済みベンダーの列を集計から落とす(読み出しでは温存されるため、ここで正本に揃える)
  const registered = new Set(Object.keys(data.subs.aliases));
  data.subs.vendors = data.subs.vendors.filter((v) => registered.has(v));
  const months = [...new Set(dealRows.map((r) => r.month))].sort();
  if (months.length) {
    applyFreeeDeals(
      data,
      dealRows.map((r) => ({
        ...dealFromRow(r),
        accountNorm: normalizeAccount(r.accountRaw ?? '', normMap),
      })),
      months,
    );
  }
  await saveAgg(db, userId, data);
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

/** monthly_agg を Dataset から全再生成する(spec §7.3。取込/ルール/手動判定/正規化マップ変更時) */
export async function saveAgg(db: Db, userId: string, data: Dataset): Promise<void> {
  const rows: { userId: string; month: string; scope: string; amount: number }[] = [];
  data.months.forEach((m, i) => {
    rows.push({ userId, month: m, scope: 'biz_rev', amount: data.biz.revenue[i] });
    data.biz.categories.forEach((c) => {
      const v = data.biz.expense[c][i];
      if (v) rows.push({ userId, month: m, scope: `biz_exp:${c}`, amount: v });
    });
    data.subs.vendors.forEach((vd) => {
      const v = data.subs.matrix[vd][i];
      if (v) rows.push({ userId, month: m, scope: `subs:${vd}`, amount: v });
    });
    if (data.subs.other[i]) rows.push({ userId, month: m, scope: 'subs_other', amount: data.subs.other[i] });
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

  await db.delete(s.monthlyAgg).where(eq(s.monthlyAgg.userId, userId));
  // D1のバインド変数上限(100/文)に収まるよう分割して一括投入
  for (const grp of chunk(rows, 24)) {
    await db.insert(s.monthlyAgg).values(grp);
  }
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
