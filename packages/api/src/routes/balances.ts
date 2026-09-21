/**
 * 残高(BS)の手入力。いま受けるのは負債だけ。
 *
 * 資産はMFの資産推移CSV(取込)から入る。負債はそのCSVに列が無いので、
 * クレジットカードの未払いと借入を月ごとに画面から入れてもらう。
 *
 * 項目ごとに「未入力 / 0円 / 金額」の 3 状態を持つ (決算書画面, 0046)。
 * 送られた項目だけを upsert / 削除し、送られていない項目と他の月には触らない。
 * 以前は月の手入力行を全部消して入れ直していたため、1 項目だけ直すと残りが消えていた。
 *
 * 触るのは source='manual' の行だけ。取込んだ行(source='mf')には触らない。
 * 逆に取込側も 'mf' しか消さないので、どちらが先でも相手を壊さない。
 */
import { zValidator } from '@hono/zod-validator';
import {
  type BalanceRow,
  LIABILITY_AMOUNT_MAX,
  LIABILITY_CATEGORIES,
  statementsBalanceSheet,
} from '@kanjo/core';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import * as s from '../db/schema.js';
import { getDb } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export const balancesRoute = new Hono<Ctx>();

const category = z.enum(LIABILITY_CATEGORIES);

// 状態ごとに受ける形を分ける。amount は status='amount' のときだけ必須で、それ以外に付いていたら 400
const lineSchema = z.discriminatedUnion('status', [
  z.object({ category, status: z.literal('unset') }).strict(),
  z.object({ category, status: z.literal('zero') }).strict(),
  z
    .object({
      category,
      status: z.literal('amount'),
      amount: z.number().int().min(0).max(LIABILITY_AMOUNT_MAX),
    })
    .strict(),
]);

const liabilitiesSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    lines: z
      .array(lineSchema)
      .min(1)
      .max(LIABILITY_CATEGORIES.length)
      // 同じ項目が 2 回来たら、どちらが正か決められない。後勝ちにせず送り直してもらう
      .refine((lines) => new Set(lines.map((l) => l.category)).size === lines.length, {
        message: '同じ項目が2回含まれています',
      }),
  })
  .strict();

type Status = 'unset' | 'zero' | 'amount';

balancesRoute.use(
  '/balances/*',
  bodyLimit({
    maxSize: 8 * 1024,
    onError: (c) =>
      c.json({ error: { code: 'payload_too_large', message: 'リクエストが大きすぎます' } }, 413),
  }),
);

balancesRoute.put('/balances/liabilities', zValidator('json', liabilitiesSchema), async (c) => {
  const userId = c.get('userId');
  const actorId = c.get('actor').id;
  const db = getDb(c.env.DB);
  const { month, lines } = c.req.valid('json');
  const now = new Date().toISOString();

  const before = await db
    .select()
    .from(s.balanceEntries)
    .where(
      and(
        eq(s.balanceEntries.userId, userId),
        eq(s.balanceEntries.month, month),
        eq(s.balanceEntries.side, 'liability'),
        inArray(
          s.balanceEntries.category,
          lines.map((l) => l.category),
        ),
      ),
    );
  // 同じ項目に取込の行があると、手入力の upsert がそれを上書きしてしまう。黙って潰さず止める
  if (before.some((r) => r.source === 'mf')) {
    return c.json(
      { error: { code: 'liability_owned_by_import', message: '取込で入った負債は画面から変更できません' } },
      409,
    );
  }
  const statusOf = (cat: string): Status => {
    const row = before.find((r) => r.category === cat);
    if (!row) return 'unset';
    return row.status === 'zero' || row.amount === 0 ? 'zero' : 'amount';
  };

  const transitions: Record<string, string> = {};
  const writes = lines.map((line) => {
    // 金額 0 を「金額あり」で送られても 0円 として保存する。同じ事実に 2 つの表し方を残さない
    const next: Status = line.status === 'amount' && line.amount === 0 ? 'zero' : line.status;
    transitions[line.category] = `${statusOf(line.category)}→${next}`;
    const key = and(
      eq(s.balanceEntries.userId, userId),
      eq(s.balanceEntries.month, month),
      eq(s.balanceEntries.side, 'liability'),
      eq(s.balanceEntries.category, line.category),
      eq(s.balanceEntries.source, 'manual'),
    );
    if (next === 'unset') return db.delete(s.balanceEntries).where(key);
    const amount = next === 'amount' && line.status === 'amount' ? line.amount : 0;
    return db
      .insert(s.balanceEntries)
      .values({
        userId,
        month,
        // 負債は月単位でしか持たない。日付は資産側(CSV)が持っている
        date: `${month}-01`,
        side: 'liability',
        category: line.category,
        amount,
        source: 'manual',
        status: next,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          s.balanceEntries.userId,
          s.balanceEntries.month,
          s.balanceEntries.side,
          s.balanceEntries.category,
        ],
        set: { amount, status: next, source: 'manual', updatedAt: now },
      });
  });

  // 監査は同じ batch で書く。金額は残さず、項目ごとの状態遷移と件数だけ
  const audit = db.insert(s.liabilityAuditLog).values({
    userId,
    actorUserId: actorId,
    month,
    changedJson: JSON.stringify({ lines: transitions, count: lines.length }),
    occurredAt: now,
  });
  const [first, ...rest] = writes;
  await db.batch([first, ...rest, audit]);

  const rows = await db
    .select()
    .from(s.balanceEntries)
    .where(and(eq(s.balanceEntries.userId, userId), eq(s.balanceEntries.month, month)));
  const balances: BalanceRow[] = rows.map((r) => ({
    month: r.month,
    date: r.date,
    side: r.side,
    category: r.category,
    amount: r.amount,
    source: r.source,
    status: r.status,
  }));
  return c.json({ ok: true, bs: statementsBalanceSheet(balances, month) });
});
