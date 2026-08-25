import { zValidator } from '@hono/zod-validator';
/**
 * 現金の記帳: GET/POST /api/cash-entries, PUT/DELETE /api/cash-entries/:id
 * 口座・カード明細に出ない現金の受け渡し(商工会議所の会議費など)を明細として持つ。
 * 事業分は freee 仕訳と同じ経路で科目別集計へ、個人分は口座「現金」の明細として家計集計へ合流する。
 * 変更のたびに集計キャッシュを作り直す(spec §7.3)。ログ・レスポンスに不要な内容を出さない。
 */
import { type CashEntry, categoryAllowed, categoryRejectReason, isCashTxId, monthOf } from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { type Db, cashFromRow, getDb, loadCashEntries, loadDataset, recomputeFromDeals } from '../store.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const cashRoute = new Hono<Ctx>();

const isRealDate = (v: string): boolean => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const entrySchema = z.object({
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
});

cashRoute.get('/cash-entries', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  const [entries, candidates] = await Promise.all([
    loadCashEntries(db, userId),
    loadCandidates(
      db,
      userId,
      data.mfTx.filter((t) => !isCashTxId(t.id)),
    ),
  ]);
  return c.json({ entries, candidates, months: data.months });
});

cashRoute.post('/cash-entries', validBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const bad = await checkCategory(db, userId, b);
  if (bad) return c.json(bad, 400);
  const [rec] = await db.insert(s.cashEntries).values(toRow(userId, b)).returning();
  await recomputeFromDeals(db, userId);
  const entry: CashEntry = cashFromRow(rec);
  return c.json({ entry }, 201);
});

cashRoute.put('/cash-entries/:id', zValidator('param', idParam), validBody, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const b = c.req.valid('json');
  const [cur] = await db
    .select({ id: s.cashEntries.id })
    .from(s.cashEntries)
    .where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id)));
  if (!cur) return c.json({ error: { code: 'not_found', message: '記帳が見つかりません' } }, 404);
  const bad = await checkCategory(db, userId, b);
  if (bad) return c.json(bad, 400);
  const [rec] = await db
    .update(s.cashEntries)
    .set({ ...toRow(userId, b), updatedAt: new Date().toISOString() })
    .where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id)))
    .returning();
  await recomputeFromDeals(db, userId);
  return c.json({ entry: cashFromRow(rec) });
});

cashRoute.delete('/cash-entries/:id', zValidator('param', idParam), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { id } = c.req.valid('param');
  const deleted = await db
    .delete(s.cashEntries)
    .where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, id)))
    .returning({ id: s.cashEntries.id });
  if (!deleted.length) return c.json({ error: { code: 'not_found', message: '記帳が見つかりません' } }, 404);
  await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});
