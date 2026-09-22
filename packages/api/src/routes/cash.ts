import { zValidator } from '@hono/zod-validator';
/**
 * 現金の記帳: GET/POST /api/cash-entries, PUT/DELETE /api/cash-entries/:id,
 * POST /api/cash-entries/:id/restore, POST /api/cash-entries/bulk-delete|bulk-restore
 * 口座・カード明細に出ない現金の受け渡し(商工会議所の会議費など)を明細として持つ。
 * 事業分は freee 仕訳と同じ経路で科目別集計へ、個人分は口座「現金」の明細として家計集計へ合流する。
 * 変更のたびに集計キャッシュを作り直す(spec §7.3)。ログ・レスポンスに不要な内容を出さない。
 *
 * 削除は `deleted_at` を入れる論理削除で、30日のあいだは同じ id のまま戻せる
 * (spec-cash-screen「論理削除と完全消去」)。30日を過ぎた行は夜間の cash-purge.ts が消す。
 */
import {
  type CashEntry,
  OWNER_VALUES,
  cashBulkIdsError,
  cashTxId,
  categoryAllowed,
  categoryRejectReason,
  findCashDealDuplicates,
  formatTransitPurpose,
  isCashTxId,
  isTransitPurpose,
  isValidPeriod,
  monthOf,
  validateCashInput,
} from '@kanjo/core';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import { D1_FREE_QUERY_LIMIT, IMPORT_CLAIM_WORST_CASE_QUERY_COUNT } from '../import-lifecycle.js';
import {
  type Db,
  LOAD_DATASET_QUERY_COUNT_WITH_SPLITS,
  cashFromRow,
  dealFromRow,
  getDb,
  loadCashEntries,
  loadDataset,
  loadNormMap,
  planRecomputeFromDeals,
  recomputePlanQueries,
} from '../store.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const cashRoute = new Hono<Ctx>();

/**
 * cash親DELETE 1 requestのD1 query ledger。行数依存の追加queryをここ以外に増やさない。
 * 論理削除・戻し・一括削除・一括の戻しも同じ形(lease・明細の読み1本・再計算・確定batch)なので、
 * この台帳で上から押さえる。確定batchの本体は UPDATE 1本 + JSON pointer で、base の3以内に収まる。
 */
export const CASH_PARENT_DELETE_QUERY_LEDGER = {
  // prior claim SELECT + stale takeoverを含むclaim batch + finally release
  writerLeaseWorstCase: IMPORT_CLAIM_WORST_CASE_QUERY_COUNT + 1,
  cashSnapshot: 1,
  // norm/freee/baseline/MF + loadDataset(cash snapshot + 分割の内訳)
  recomputePlan: 4 + LOAD_DATASET_QUERY_COUNT_WITH_SPLITS,
  // cash + tx_edit + JSON pointer
  finalMutationBase: 3,
  normalizedDealsBulk: 1,
  aggregateReplacement: 2,
} as const;

/**
 * POST/PUT は削除系に加え、科目検証用のdatasetと候補を読む。
 * PUT per→biz の tx_edit 削除が確定batchに入る経路を最悪値にする。
 */
export const CASH_WRITE_QUERY_LEDGER = {
  writerLeaseWorstCase: IMPORT_CLAIM_WORST_CASE_QUERY_COUNT + 1,
  // loadDataset(現金snapshot無し) + category_options + distinct freee account
  categoryValidation: LOAD_DATASET_QUERY_COUNT_WITH_SPLITS + 1 + 2,
  cashSnapshot: 1,
  recomputePlan: 4 + LOAD_DATASET_QUERY_COUNT_WITH_SPLITS,
  // cash + tx_edit + JSON pointer (POSTとper向けPUTはこれより1少ない)
  finalMutationBase: 3,
  normalizedDealsBulk: 1,
  aggregateReplacement: 2,
} as const;

/**
 * cash親DELETEの最悪経路がFree上限未満か判定する。
 *
 * 証憑を廃止した今、行数に比例して増えるqueryは正規化差分のbulk UPDATE 1本だけになった。
 * それでも予算表を残すのは、上限に対する余白を宣言として固定し、
 * 新しいqueryを足したときにtypecheckではなくこの数で気づけるようにするため。
 */
export function planCashParentDeleteQueries(normalizedDealUpdateCount: number): {
  total: number;
  limit: number;
  accepted: boolean;
} {
  if (!Number.isSafeInteger(normalizedDealUpdateCount) || normalizedDealUpdateCount < 0) {
    throw new Error('invalid_cash_parent_delete_query_plan');
  }
  const total =
    CASH_PARENT_DELETE_QUERY_LEDGER.writerLeaseWorstCase +
    CASH_PARENT_DELETE_QUERY_LEDGER.cashSnapshot +
    CASH_PARENT_DELETE_QUERY_LEDGER.recomputePlan +
    CASH_PARENT_DELETE_QUERY_LEDGER.finalMutationBase +
    (normalizedDealUpdateCount > 0 ? CASH_PARENT_DELETE_QUERY_LEDGER.normalizedDealsBulk : 0) +
    CASH_PARENT_DELETE_QUERY_LEDGER.aggregateReplacement;
  return {
    total,
    limit: D1_FREE_QUERY_LIMIT,
    accepted: total < D1_FREE_QUERY_LIMIT,
  };
}

export function planCashWriteQueries(normalizedDealUpdateCount: number): {
  total: number;
  limit: number;
  accepted: boolean;
} {
  if (!Number.isSafeInteger(normalizedDealUpdateCount) || normalizedDealUpdateCount < 0) {
    throw new Error('invalid_cash_write_query_plan');
  }
  const total =
    CASH_WRITE_QUERY_LEDGER.writerLeaseWorstCase +
    CASH_WRITE_QUERY_LEDGER.categoryValidation +
    CASH_WRITE_QUERY_LEDGER.cashSnapshot +
    CASH_WRITE_QUERY_LEDGER.recomputePlan +
    CASH_WRITE_QUERY_LEDGER.finalMutationBase +
    (normalizedDealUpdateCount > 0 ? CASH_WRITE_QUERY_LEDGER.normalizedDealsBulk : 0) +
    CASH_WRITE_QUERY_LEDGER.aggregateReplacement;
  return { total, limit: D1_FREE_QUERY_LIMIT, accepted: total < D1_FREE_QUERY_LIMIT };
}

const idParam = z.object({ id: z.coerce.number().int().positive() });

/**
 * 形だけを zod で受け、中身の規則は core の validateCashInput に任せる。
 * 画面と API が同じ関数で同じ上限を確かめるので、片方だけ緩む食い違いが起きない。
 * 字数はコードポイントで数えるため、ここで .max() を重ねない。
 */
const entrySchema = z
  .object({
    date: z.string(),
    side: z.enum(['biz', 'per']),
    io: z.enum(['income', 'expense']),
    amount: z.number(),
    description: z.string(),
    big: z.string(),
    mid: z.string().trim().max(60).default(''),
    memo: z
      .string()
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.trim() === '' ? null : v.trim())),
    /** 任意(0051 より前の SPA の本文を通す互換)。無ければ POST は NULL、PUT は今の値を保つ */
    owner: z.enum(OWNER_VALUES, { message: '担当者を選んでください' }).optional(),
    /** 交通費の区間(任意)。片方だけの入力は validateCashInput が弾く */
    transitFrom: z.string().nullable().default(null),
    transitTo: z.string().nullable().default(null),
    transitRound: z.boolean().default(false),
    /** 業務の目的。区間があるときは必須、その他なら記述を transitPurposeNote に */
    transitPurpose: z.string().nullable().default(null),
    transitPurposeNote: z.string().nullable().default(null),
    /** 領収書が構造上出ない支出(電車代など) */
    receiptWaived: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const message = validateCashInput(
      {
        date: v.date,
        side: v.side,
        io: v.io,
        amount: v.amount,
        description: v.description,
        categoryMajor: v.big,
        owner: v.owner ?? null,
        memo: v.memo,
        transitFrom: v.transitFrom,
        transitTo: v.transitTo,
        transitRound: v.transitRound,
        transitPurpose: v.transitPurpose,
        transitPurposeNote: v.transitPurposeNote,
      },
      { allowUnset: true },
    );
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    else if (v.receiptWaived && !(v.transitFrom?.trim() && v.io === 'expense'))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '証憑不要は、領収書が出ない交通費でのみ選べます',
      });
  });
type EntryInput = z.infer<typeof entrySchema>;

const invalidInput = (message: string) => ({ error: { code: 'invalid_input', message } });
const notFound = { error: { code: 'not_found', message: '記帳が見つかりません' } } as const;

/** 入力エラーは最初の1件を日本語で返す(画面にそのまま出す) */
const validBody = zValidator('json', entrySchema, (r, c) => {
  if (!r.success)
    return c.json(invalidInput(r.error.issues[0]?.message ?? '入力内容を確認してください'), 400);
});

/** 一括の id 配列。規則は画面と同じ core の cashBulkIdsError */
const bulkBody = zValidator('json', z.object({ ids: z.array(z.unknown()) }), (r, c) => {
  if (!r.success) return c.json(invalidInput('明細の指定が正しくありません'), 400);
  const message = cashBulkIdsError(r.data.ids);
  if (message) return c.json(invalidInput(message), 400);
});

/** GET の期間。両方あるときだけ絞り、片方だけや壊れた値は 400 にする(静かに全期間へ倒さない) */
const listQuery = zValidator(
  'query',
  z.object({ from: z.string().optional(), to: z.string().optional() }),
  (r, c) => {
    if (!r.success) return c.json(invalidInput('期間は YYYY-MM で指定してください'), 400);
    const { from, to } = r.data;
    if ((from === undefined) !== (to === undefined) || (from !== undefined && !isValidPeriod({ from, to })))
      return c.json(invalidInput('期間は YYYY-MM で指定してください'), 400);
  },
);

const invalidCategory = (side: 'biz' | 'per') => ({
  error: { code: 'invalid_category', message: categoryRejectReason(side) },
});

/** 科目が候補(事業=freee勘定科目 / 個人=MF大項目・中項目)に含まれるかを確認する */
async function checkCategory(db: Db, userId: string, b: EntryInput): Promise<{ error: unknown } | null> {
  if (b.side === 'biz' && b.mid)
    return { error: { code: 'biz_has_no_mid', message: '事業の科目(freee勘定科目)には中項目がありません' } };
  const data = await loadDataset(db, userId);
  const cands = await loadCandidates(
    db,
    userId,
    data.mfTx.filter((t) => !isCashTxId(t.id)),
  );
  return categoryAllowed(cands, b.side, b.big.trim(), b.mid) ? null : invalidCategory(b.side);
}

/** 業務の目的を1列の保存形へ。区間が無ければ null(validateCashInput が両方 null を確かめ済み) */
const storedTransitPurpose = (b: EntryInput): string | null =>
  b.transitFrom?.trim() && isTransitPurpose(b.transitPurpose)
    ? formatTransitPurpose(b.transitPurpose, b.transitPurposeNote)
    : null;

const toRow = (userId: string, b: EntryInput) => ({
  userId,
  date: b.date,
  month: monthOf(b.date),
  side: b.side,
  io: b.io,
  amount: b.amount,
  description: b.description.trim(),
  categoryMajor: b.big.trim(),
  categoryMid: b.side === 'biz' ? '' : b.mid,
  memo: b.memo,
  transitFrom: b.transitFrom?.trim() || null,
  transitTo: b.transitTo?.trim() || null,
  transitRound: b.transitRound ? 1 : 0,
  receiptWaived: b.receiptWaived ? 1 : 0,
  owner: b.owner ?? null,
  transitPurpose: storedTransitPurpose(b),
});

const cashEntryFromWrite = (id: number, row: ReturnType<typeof toRow>): CashEntry => ({
  id,
  date: row.date,
  month: row.month,
  side: row.side,
  io: row.io,
  amount: row.amount,
  description: row.description,
  categoryMajor: row.categoryMajor,
  categoryMid: row.categoryMid,
  memo: row.memo,
  transitFrom: row.transitFrom,
  transitTo: row.transitTo,
  transitRound: row.transitRound === 1,
  receiptWaived: row.receiptWaived === 1,
  owner: row.owner,
  transitPurpose: row.transitPurpose,
});

/**
 * AUTOINCREMENT の実idを予約せず、未確定の新規行を再集計計画に入れるためのみに使う。
 * 有効な cash id と API のidパラメータは常に正なので、cash:0 を指すedit/splitは正規状態には存在しない。
 * 集計行にcash id自体は保存されないため、実INSERTは従来どおりDBの採番に任せられる。
 */
const NEW_CASH_ENTRY_PLAN_ID = 0;

/**
 * PUT で担当者・業務の目的が送られなかったときは今の値を保つ。
 * 古い SPA が編集しただけで、0051 以後に付けた値が NULL に戻らないようにする。
 */
const keepUnsent = (b: EntryInput, cur: typeof s.cashEntries.$inferSelect) => ({
  owner: b.owner ?? cur.owner,
  transitPurpose: storedTransitPurpose(b) ?? (b.transitFrom?.trim() ? cur.transitPurpose : null),
});

/**
 * 利用者の現金明細を削除中の行も含めて1本で読む。
 * 有効な集合(再計算の入力)と、戻す・消す対象の行の両方をここから作るので、読みは1回で済む。
 * 並びは loadCashEntries と同じ(日付の新しい順、同日は id の新しい順)。
 */
async function loadAllCashRows(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(s.cashEntries)
    .where(eq(s.cashEntries.userId, userId))
    .orderBy(sql`${s.cashEntries.date} DESC`, sql`${s.cashEntries.id} DESC`);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const active = rows.filter((row) => row.deletedAt === null).map(cashFromRow);
  return { byId, active };
}

/** 集計を作り直す計画を立て、Free 上限に収まることを確かめてから確定用の query を返す */
async function planCashRecompute(
  db: Db,
  userId: string,
  affected: readonly CashEntry[],
  nextActive: readonly CashEntry[],
  budget: 'parent-mutation' | 'validated-write' = 'parent-mutation',
) {
  const plan = await planRecomputeFromDeals(db, userId, affected, nextActive);
  const queryPlan =
    budget === 'validated-write'
      ? planCashWriteQueries(plan.normalizedDealUpdates.length)
      : planCashParentDeleteQueries(plan.normalizedDealUpdates.length);
  if (!queryPlan.accepted) {
    throw new Error('cash_query_budget_exceeded');
  }
  return recomputePlanQueries(db, userId, plan);
}

/** id 配列を1つの JSON 文字列で束縛する(1文あたりの束縛数の上限 100 に user_id と 100 件が収まらないため) */
const idsIn = (ids: readonly number[]) =>
  sql`${s.cashEntries.id} IN (SELECT value FROM json_each(${JSON.stringify(ids)}))`;

cashRoute.get('/cash-entries', listQuery, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { from, to } = c.req.valid('query');
  // loadDataset も通常は現金明細を読む。先に1回だけ取得して snapshot として渡し、
  // 応答の entries と dataset 内の集計・月集合が同じ観測値を使うようにする。
  const allEntries = await loadCashEntries(db, userId);
  const data = await loadDataset(db, userId, allEntries);
  const [candidates, normMap, dealRows] = await Promise.all([
    loadCandidates(
      db,
      userId,
      data.mfTx.filter((t) => !isCashTxId(t.id)),
    ),
    loadNormMap(db, userId),
    // 取込由来の仕訳(freee_deals)だけを読む。現金由来の仕訳は集計側で合流するもので、
    // ここに混ぜると記帳が自分自身と突合してしまう。
    db
      .select()
      .from(s.freeeDeals)
      .where(eq(s.freeeDeals.userId, userId)),
  ]);
  // 期間は month の文字列比較で切る(YYYY-MM は辞書順と時間順が一致する)
  const entries =
    from && to ? allEntries.filter((entry) => entry.month >= from && entry.month <= to) : allEntries;
  const duplicates = findCashDealDuplicates(entries, dealRows.map(dealFromRow), normMap);
  return c.json({ entries, candidates, months: data.months, duplicates });
});

cashRoute.post('/cash-entries', validBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const bad = await checkCategory(db, userId, b);
  if (bad) return c.json(bad, 400);
  const write = toRow(userId, b);
  const plannedEntry = cashEntryFromWrite(NEW_CASH_ENTRY_PLAN_ID, write);
  const { active } = await loadAllCashRows(db, userId);
  // writer lease内で、書込み後の集合を先に計画する。計画失敗ではDBに何も書かない。
  const recomputeQueries = await planCashRecompute(
    db,
    userId,
    [plannedEntry],
    [plannedEntry, ...active],
    'validated-write',
  );
  const [inserted] = await db.batch([
    db.insert(s.cashEntries).values(write).returning(),
    invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
    ...recomputeQueries,
  ]);
  const [rec] = inserted;
  if (!rec) throw new Error('cash_entry_insert_returned_no_row');
  const entry: CashEntry = cashFromRow(rec);
  return c.json({ entry }, 201);
});

cashRoute.put('/cash-entries/:id', zValidator('param', idParam), validBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const b = c.req.valid('json');
  // 削除中の行は編集で復活させない(戻すのは restore だけ)
  const target = and(
    eq(s.cashEntries.userId, userId),
    eq(s.cashEntries.id, id),
    isNull(s.cashEntries.deletedAt),
  );
  const { byId, active } = await loadAllCashRows(db, userId);
  const cur = byId.get(id);
  if (!cur || cur.deletedAt !== null) return c.json(notFound, 404);
  const bad = await checkCategory(db, userId, b);
  if (bad) return c.json(bad, 400);
  const updatedAt = new Date().toISOString();
  const write = { ...toRow(userId, b), ...keepUnsent(b, cur) };
  const before = cashFromRow(cur);
  const entry = cashEntryFromWrite(id, write);
  const recomputeQueries = await planCashRecompute(
    db,
    userId,
    [before, entry],
    active.map((current) => (current.id === id ? entry : current)),
    'validated-write',
  );
  const update = db
    .update(s.cashEntries)
    .set({ ...write, updatedAt })
    .where(target)
    .returning();
  let rec: typeof s.cashEntries.$inferSelect | undefined;
  if (b.side === 'biz') {
    // per→biz と旧版由来の残存編集も、正本・派生集計と同じbatchで消す。
    const [updated] = await db.batch([
      update,
      db.delete(s.txEdits).where(and(eq(s.txEdits.userId, userId), eq(s.txEdits.txId, cashTxId(id)))),
      invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
      ...recomputeQueries,
    ]);
    [rec] = updated;
  } else {
    const [updated] = await db.batch([
      update,
      invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
      ...recomputeQueries,
    ]);
    [rec] = updated;
  }
  if (!rec) return c.json(notFound, 404);
  return c.json({ entry: cashFromRow(rec) });
});

/**
 * 1件の論理削除。`deleted_at` を入れ、同じ batch で JSON pointer の無効化と集計の作り直しを確定する。
 * 手動の仕分け(tx_edits の `cash:<id>`)は消さない。戻したときに同じ仕分けで戻すため。
 */
cashRoute.delete('/cash-entries/:id', zValidator('param', idParam), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const { byId, active } = await loadAllCashRows(db, userId);
  const cur = active.find((entry) => entry.id === id);
  if (!cur || !byId.has(id)) return c.json(notFound, 404);
  const deletedAt = new Date().toISOString();
  // 再計算とJSON bulk payloadのサイズ検証を、書き込む前に完了させる。
  const recomputeQueries = await planCashRecompute(
    db,
    userId,
    [cur],
    active.filter((entry) => entry.id !== id),
  );
  await db.batch([
    db
      .update(s.cashEntries)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(
        and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id), isNull(s.cashEntries.deletedAt)),
      ),
    invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
    ...recomputeQueries,
  ]);
  return c.json({ ok: true, id, deletedAt });
});

/**
 * 論理削除した1件を同じ id のまま戻す。削除中でない行には何も書かず、今の行を返す(冪等)。
 * 行が無い・他の利用者の行・完全消去済みは 404。カテゴリは検証しない(次の編集で確かめる)。
 */
cashRoute.post('/cash-entries/:id/restore', zValidator('param', idParam), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const { byId, active } = await loadAllCashRows(db, userId);
  const row = byId.get(id);
  if (!row) return c.json(notFound, 404);
  const entry = cashFromRow(row);
  if (row.deletedAt === null) return c.json({ entry });
  const recomputeQueries = await planCashRecompute(db, userId, [entry], [entry, ...active]);
  await db.batch([
    db
      .update(s.cashEntries)
      .set({ deletedAt: null, updatedAt: new Date().toISOString() })
      .where(
        and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id), isNotNull(s.cashEntries.deletedAt)),
      ),
    invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
    ...recomputeQueries,
  ]);
  return c.json({ entry });
});

/**
 * 選んだ明細をまとめて論理削除する。1件でも他の利用者・存在しない・削除中の id があれば
 * 全体を 404 にして何も変えない。全件に同じ deleted_at を入れる。
 */
cashRoute.post('/cash-entries/bulk-delete', bulkBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const ids = (await c.req.json<{ ids: number[] }>()).ids;
  const { active } = await loadAllCashRows(db, userId);
  const idSet = new Set(ids);
  const targets = active.filter((entry) => idSet.has(entry.id));
  if (targets.length !== ids.length) return c.json(notFound, 404);
  const deletedAt = new Date().toISOString();
  const recomputeQueries = await planCashRecompute(
    db,
    userId,
    targets,
    active.filter((entry) => !idSet.has(entry.id)),
  );
  // 事前の読みと batch のあいだは fence の lease が他の書込を止め、UPDATE の条件が最後の守りになる
  await db.batch([
    db
      .update(s.cashEntries)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(s.cashEntries.userId, userId), idsIn(ids), isNull(s.cashEntries.deletedAt))),
    invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
    ...recomputeQueries,
  ]);
  return c.json({ ok: true, ids, deletedAt });
});

/**
 * 一括削除をトーストの『元に戻す』でまとめて戻す。削除中でない id は何もしない(冪等)。
 * 1件でも他の利用者・存在しない・完全消去済みの id があれば全体を 404 にして何も戻さない。
 */
cashRoute.post('/cash-entries/bulk-restore', bulkBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const ids = (await c.req.json<{ ids: number[] }>()).ids;
  const { byId, active } = await loadAllCashRows(db, userId);
  const rows = ids.map((id) => byId.get(id));
  if (rows.some((row) => row === undefined)) return c.json(notFound, 404);
  const entries = rows.map((row) => cashFromRow(row!));
  const restoring = rows.flatMap((row, index) => (row!.deletedAt === null ? [] : [entries[index]!]));
  if (restoring.length > 0) {
    const recomputeQueries = await planCashRecompute(db, userId, restoring, [...restoring, ...active]);
    const restoringIds = restoring.map((entry) => entry.id);
    await db.batch([
      db
        .update(s.cashEntries)
        .set({ deletedAt: null, updatedAt: new Date().toISOString() })
        .where(
          and(eq(s.cashEntries.userId, userId), idsIn(restoringIds), isNotNull(s.cashEntries.deletedAt)),
        ),
      invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
      ...recomputeQueries,
    ]);
  }
  return c.json({ entries });
});
