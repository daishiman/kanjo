import { zValidator } from '@hono/zod-validator';
/**
 * 現金の記帳: GET/POST /api/cash-entries, PUT/DELETE /api/cash-entries/:id
 * 口座・カード明細に出ない現金の受け渡し(商工会議所の会議費など)を明細として持つ。
 * 事業分は freee 仕訳と同じ経路で科目別集計へ、個人分は口座「現金」の明細として家計集計へ合流する。
 * 変更のたびに集計キャッシュを作り直す(spec §7.3)。ログ・レスポンスに不要な内容を出さない。
 */
import {
  type CashEntry,
  cashTxId,
  categoryAllowed,
  categoryRejectReason,
  findCashDealDuplicates,
  isCashTxId,
  monthOf,
} from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
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
  recomputeFromDeals,
  recomputePlanQueries,
} from '../store.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const cashRoute = new Hono<Ctx>();

/** cash親DELETE 1 requestのD1 query ledger。行数依存の追加queryをここ以外に増やさない。 */
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

const isRealDate = (v: string): boolean => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const entrySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD で入力してください')
      .refine(isRealDate, '存在しない日付です'),
    side: z.enum(['biz', 'per']),
    io: z.enum(['income', 'expense']),
    amount: z
      .number()
      .int('金額は整数(円)で入力してください')
      .positive('金額は1円以上で入力してください')
      .max(1_000_000_000),
    description: z.string().trim().min(1, '内容を入力してください').max(60, '内容は60文字までです'),
    big: z.string().trim().min(1, '科目を選んでください').max(60),
    mid: z.string().trim().max(60).default(''),
    memo: z.string().trim().max(200).nullable().default(null),
    /** 交通費の区間(任意)。片方だけの入力は下の refine で弾く */
    transitFrom: z.string().trim().max(40).nullable().default(null),
    transitTo: z.string().trim().max(40).nullable().default(null),
    transitRound: z.boolean().default(false),
    /** 領収書が構造上出ない支出(電車代など) */
    receiptWaived: z.boolean().default(false),
  })
  .refine((v) => !!v.transitFrom === !!v.transitTo, {
    message: '交通費は出発地と到着地の両方を入力してください',
  })
  .refine((v) => !v.transitFrom || v.io === 'expense', {
    message: '交通費は支出として記帳してください',
  })
  .refine((v) => !v.transitRound || (!!v.transitFrom && !!v.transitTo), {
    message: '往復は出発地と到着地を入力した交通費でのみ選べます',
  })
  .refine((v) => !v.receiptWaived || (!!v.transitFrom && !!v.transitTo && v.io === 'expense'), {
    message: '証憑不要は、領収書が出ない交通費でのみ選べます',
  });
type EntryInput = z.infer<typeof entrySchema>;

const idParam = z.object({ id: z.coerce.number().int().positive() });

/** 入力エラーは最初の1件を日本語で返す(画面にそのまま出す) */
const validBody = zValidator('json', entrySchema, (r, c) => {
  if (!r.success)
    return c.json(
      {
        error: { code: 'invalid_input', message: r.error.issues[0]?.message ?? '入力内容を確認してください' },
      },
      400,
    );
});

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
  return categoryAllowed(cands, b.side, b.big, b.mid) ? null : invalidCategory(b.side);
}

const toRow = (userId: string, b: EntryInput) => ({
  userId,
  date: b.date,
  month: monthOf(b.date),
  side: b.side,
  io: b.io,
  amount: b.amount,
  description: b.description,
  categoryMajor: b.big,
  categoryMid: b.side === 'biz' ? '' : b.mid,
  memo: b.memo,
  transitFrom: b.transitFrom || null,
  transitTo: b.transitTo || null,
  transitRound: b.transitRound ? 1 : 0,
  receiptWaived: b.receiptWaived ? 1 : 0,
});

cashRoute.get('/cash-entries', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  const [entries, candidates, normMap, dealRows] = await Promise.all([
    loadCashEntries(db, userId),
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
  const duplicates = findCashDealDuplicates(entries, dealRows.map(dealFromRow), normMap);
  return c.json({ entries, candidates, months: data.months, duplicates });
});

cashRoute.post('/cash-entries', validBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const bad = await checkCategory(db, userId, b);
  if (bad) return c.json(bad, 400);
  const [inserted] = await db.batch([
    db.insert(s.cashEntries).values(toRow(userId, b)).returning(),
    invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
  ]);
  const [rec] = inserted;
  const entry: CashEntry = cashFromRow(rec);
  await recomputeFromDeals(db, userId, [entry]);
  return c.json({ entry }, 201);
});

cashRoute.put('/cash-entries/:id', zValidator('param', idParam), validBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const b = c.req.valid('json');
  const [cur] = await db
    .select()
    .from(s.cashEntries)
    .where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id)));
  if (!cur) return c.json({ error: { code: 'not_found', message: '記帳が見つかりません' } }, 404);
  const bad = await checkCategory(db, userId, b);
  if (bad) return c.json(bad, 400);
  const update = db
    .update(s.cashEntries)
    .set({ ...toRow(userId, b), updatedAt: new Date().toISOString() })
    .where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id)))
    .returning();
  const before = cashFromRow(cur);
  let rec: typeof s.cashEntries.$inferSelect;
  if (b.side === 'biz') {
    // per→biz と旧版由来の残存編集を、正本の更新と同じD1トランザクションで消す。
    const [updated] = await db.batch([
      update,
      db.delete(s.txEdits).where(and(eq(s.txEdits.userId, userId), eq(s.txEdits.txId, cashTxId(id)))),
      invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
    ]);
    [rec] = updated;
  } else {
    const [updated] = await db.batch([update, invalidateJsonSnapshotQuery(db, userId, 'cash_entries')]);
    [rec] = updated;
  }
  const entry = cashFromRow(rec);
  await recomputeFromDeals(db, userId, [before, entry]);
  return c.json({ entry });
});

cashRoute.delete('/cash-entries/:id', zValidator('param', idParam), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const cashEntries = await loadCashEntries(db, userId);
  const cur = cashEntries.find((entry) => entry.id === id);
  if (!cur) return c.json({ error: { code: 'not_found', message: '記帳が見つかりません' } }, 404);
  // 再計算とJSON bulk payloadのサイズ検証を、R2原本に触る前に完了させる。
  const recomputePlan = await planRecomputeFromDeals(
    db,
    userId,
    [cur],
    cashEntries.filter((entry) => entry.id !== id),
  );
  if (!planCashParentDeleteQueries(recomputePlan.normalizedDealUpdates.length).accepted) {
    throw new Error('cash_parent_delete_query_budget_exceeded');
  }
  const recomputeQueries = recomputePlanQueries(db, userId, recomputePlan);
  // 親・手動編集・JSON pointer・再計算済み集計を一つのD1 transactionで確定する。
  await db.batch([
    db.delete(s.cashEntries).where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id))),
    db.delete(s.txEdits).where(and(eq(s.txEdits.userId, userId), eq(s.txEdits.txId, cashTxId(id)))),
    invalidateJsonSnapshotQuery(db, userId, 'cash_entries'),
    ...recomputeQueries,
  ]);
  return c.json({ ok: true });
});
