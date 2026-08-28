/**
 * 残高(BS)の手入力。いま受けるのは負債だけ。
 *
 * 資産はMFの資産推移CSV(取込)から入る。負債はそのCSVに列が無いので、
 * クレジットカードの未払いと借入を月ごとに画面から入れてもらう。
 *
 * 消して入れ直すのは source='manual' の行だけ。取込んだ資産(source='mf')には触らない。
 * 逆に取込側も 'mf' しか消さないので、どちらが先でも相手を壊さない。
 */
import { zValidator } from '@hono/zod-validator';
import { LIABILITY_CATEGORIES } from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { getDb } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const balancesRoute = new Hono<Ctx>();

const liabilitiesSchema = z
  .object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    lines: z
      .array(
        z
          .object({
            // 種類は決め打ちの一覧から選ぶ。自由入力だと月ごとに名前が揺れて前月と比べられなくなる
            category: z.enum(LIABILITY_CATEGORIES as unknown as [string, ...string[]]),
            amount: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(LIABILITY_CATEGORIES.length),
  })
  .strict();

/**
 * 保存する行を決める。
 *
 * 0円の行は残す。「返し終えた」は分かっている情報で、伏せると
 * 「入力していない月」と区別が付かなくなる(純資産が出せなくなる)。
 * 同じ種類が2回来たら後勝ちにする。UNIQUE制約に当ててエラーにする理由がない。
 */
const rowsToStore = (
  lines: ReadonlyArray<{ category: string; amount: number }>,
): Array<{ category: string; amount: number }> => {
  const byCategory = new Map<string, number>();
  for (const line of lines) byCategory.set(line.category, line.amount);
  // 並びは入力順ではなく決め打ちの一覧順。月をまたいで表の行がずれない
  return LIABILITY_CATEGORIES.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    amount: byCategory.get(category) ?? 0,
  }));
};

balancesRoute.put('/balances/liabilities', zValidator('json', liabilitiesSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { month, lines } = c.req.valid('json');
  const now = new Date().toISOString();

  const remove = db
    .delete(s.balanceEntries)
    .where(
      and(
        eq(s.balanceEntries.userId, userId),
        eq(s.balanceEntries.month, month),
        eq(s.balanceEntries.side, 'liability'),
        eq(s.balanceEntries.source, 'manual'),
      ),
    );

  const rows = rowsToStore(lines);
  if (!rows.length) {
    await remove;
    return c.json({ ok: true, stored: 0 });
  }

  await db.batch([
    remove,
    db.insert(s.balanceEntries).values(
      rows.map(({ category, amount }) => ({
        userId,
        month,
        // 負債は月単位でしか持たない。日付は資産側(CSV)が持っている
        date: `${month}-01`,
        side: 'liability' as const,
        category,
        amount,
        source: 'manual' as const,
        createdAt: now,
        updatedAt: now,
      })),
    ),
  ]);
  return c.json({ ok: true, stored: rows.length });
});
