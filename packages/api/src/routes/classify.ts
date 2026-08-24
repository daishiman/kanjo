import { zValidator } from '@hono/zod-validator';
/**
 * FR-02 公私仕分け: 明細一覧・手動判定・ルールCRUD。
 * 変更(PUT/POST/DELETE/PATCH)は即時に monthly_agg を再生成する(spec §7.3)。
 */
import { classifyTx, sum } from '@kanjo/core';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { type Db, getDb, loadDataset, saveAgg } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const classifyRoute = new Hono<Ctx>();

async function recompute(db: Db, userId: string): Promise<void> {
  const data = await loadDataset(db, userId);
  await saveAgg(db, userId, data);
}

classifyRoute.get('/transactions', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  const month = c.req.query('month') ?? null;
  const cls = c.req.query('cls') ?? '';
  const q = (c.req.query('q') ?? '').toUpperCase();
  const manualOnly = c.req.query('manual') === '1';

  const months = [...new Set(data.mfTx.map((t) => t.m))].sort();
  const m = month && months.includes(month) ? month : (months[months.length - 1] ?? null);

  let txs = data.mfTx.filter((t) => t.m === m);
  const rows = txs
    .map((t) => {
      const j = classifyTx(t, data.rules, data.overrides);
      return {
        id: t.id,
        date: t.d,
        description: t.c,
        amount: t.a,
        big: t.big,
        mid: t.mid,
        cls: j.cls,
        src: j.src,
      };
    })
    .filter((r) => {
      if (cls === 'biz' || cls === 'per') {
        if (r.cls !== cls) return false;
      }
      if (manualOnly && r.src !== '手動') return false;
      if (q && !`${r.description}|${r.big}|${r.mid}`.toUpperCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  txs = data.mfTx.filter((t) => t.m === m);
  const judged = txs.map((t) => ({ t, j: classifyTx(t, data.rules, data.overrides) }));
  const summary = {
    month: m,
    count: txs.length,
    totalIncome: sum(txs.filter((t) => t.a > 0).map((t) => t.a)),
    bizIncome: sum(judged.filter((x) => x.j.cls === 'biz' && x.t.a > 0).map((x) => x.t.a)),
    personalIncome: sum(judged.filter((x) => x.j.cls === 'per' && x.t.a > 0).map((x) => x.t.a)),
    totalExpense: -sum(txs.filter((t) => t.a < 0).map((t) => t.a)),
    bizExpense: -sum(judged.filter((x) => x.j.cls === 'biz' && x.t.a < 0).map((x) => x.t.a)),
    personalExpense: -sum(judged.filter((x) => x.j.cls === 'per' && x.t.a < 0).map((x) => x.t.a)),
  };
  return c.json({ months, month: m, summary, transactions: rows });
});

const clsSchema = z.object({ cls: z.enum(['biz', 'per']).nullable() });

classifyRoute.put('/transactions/:txId/class', zValidator('json', clsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const txId = c.req.param('txId');
  const { cls } = c.req.valid('json');
  await db.delete(s.overrides).where(and(eq(s.overrides.userId, userId), eq(s.overrides.txId, txId)));
  if (cls) await db.insert(s.overrides).values({ userId, txId, cls });
  await recompute(db, userId);
  return c.json({ ok: true, txId, cls });
});

/* -------- ルールCRUD(表示順=評価順・先勝ち) -------- */

classifyRoute.get('/rules', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.rules)
    .where(eq(s.rules.userId, userId))
    .orderBy(asc(s.rules.sortOrder));
  const data = await loadDataset(db, userId);
  // ルール誤爆対策: 各ルールの影響件数(そのルールで判定される明細数)
  const hitCount = new Map<number, number>();
  for (const t of data.mfTx) {
    const hay = `${t.c || ''}|${t.big || ''}|${t.mid || ''}`.toUpperCase();
    if (data.overrides[t.id]) continue;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].keyword && hay.includes(rows[i].keyword.toUpperCase())) {
        hitCount.set(rows[i].id, (hitCount.get(rows[i].id) ?? 0) + 1);
        break;
      }
    }
  }
  return c.json({
    rules: rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      cls: r.cls,
      sortOrder: r.sortOrder,
      hits: hitCount.get(r.id) ?? 0,
    })),
    usingDefaults: rows.length === 0,
  });
});

const ruleSchema = z.object({
  keyword: z.string().min(1).max(100),
  cls: z.enum(['biz', 'per']),
  top: z.boolean().optional(),
});

classifyRoute.post('/rules', zValidator('json', ruleSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const existing = await db
    .select()
    .from(s.rules)
    .where(eq(s.rules.userId, userId))
    .orderBy(asc(s.rules.sortOrder));
  if (existing.length === 0) {
    // 初回のルール追加時は既定ルール(HTML版)を実体化してから追加する
    const { DEFAULT_RULES } = await import('@kanjo/core');
    for (let i = 0; i < DEFAULT_RULES.length; i++) {
      await db
        .insert(s.rules)
        .values({ userId, keyword: DEFAULT_RULES[i].k, cls: DEFAULT_RULES[i].cls, sortOrder: i + 1 });
    }
  }
  const rows = await db
    .select()
    .from(s.rules)
    .where(eq(s.rules.userId, userId))
    .orderBy(asc(s.rules.sortOrder));
  const sortOrder = b.top ? (rows[0]?.sortOrder ?? 1) - 1 : (rows[rows.length - 1]?.sortOrder ?? 0) + 1;
  const [rec] = await db
    .insert(s.rules)
    .values({ userId, keyword: b.keyword, cls: b.cls, sortOrder })
    .returning({ id: s.rules.id });
  await recompute(db, userId);
  return c.json({ ok: true, id: rec.id }, 201);
});

classifyRoute.delete('/rules/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  await db.delete(s.rules).where(and(eq(s.rules.userId, userId), eq(s.rules.id, id)));
  await recompute(db, userId);
  return c.json({ ok: true });
});

const reorderSchema = z.object({ order: z.array(z.number().int()).max(200) });

classifyRoute.patch('/rules', zValidator('json', reorderSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { order } = c.req.valid('json');
  for (let i = 0; i < order.length; i++) {
    await db
      .update(s.rules)
      .set({ sortOrder: i })
      .where(and(eq(s.rules.userId, userId), eq(s.rules.id, order[i])));
  }
  await recompute(db, userId);
  return c.json({ ok: true });
});
