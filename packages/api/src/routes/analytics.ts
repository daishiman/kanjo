import { zValidator } from '@hono/zod-validator';
/**
 * 分析系リードAPI(P1〜P4, P6, FR-08, FR-09, エクスポート)。
 * 集計はすべて packages/core の純関数に委譲し、ここでは組み立てと整形のみ行う。
 */
import {
  budgetTable,
  defenseLine,
  diagnosis,
  exportJSON,
  household,
  matrix,
  overview,
  subscriptions,
  tradeoffCandidates,
} from '@kanjo/core';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { getDb, loadDataset } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const analyticsRoute = new Hono<Ctx>();

analyticsRoute.get('/summary', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json({ overview: overview(data), defense: defenseLine(data) });
});

analyticsRoute.get('/matrix', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json(matrix(data));
});

analyticsRoute.get('/diagnosis', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json(diagnosis(data));
});

analyticsRoute.get('/subscriptions', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json(subscriptions(data));
});

analyticsRoute.get('/household', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json(household(data));
});

analyticsRoute.get('/defense-line', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json(defenseLine(data));
});

/* -------- FR-09 やりくり試算 -------- */

analyticsRoute.get('/tradeoff', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  const plans = await db
    .select()
    .from(s.tradeoffPlans)
    .where(eq(s.tradeoffPlans.userId, userId))
    .orderBy(desc(s.tradeoffPlans.id))
    .limit(50);
  return c.json({
    candidates: tradeoffCandidates(data),
    budgets: budgetTable(data),
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      amount: p.amount,
      recurring: p.recurring === 1,
      selected: p.selected ? (JSON.parse(p.selected) as unknown) : [],
      covered: p.covered,
      verdict: p.verdict,
      createdAt: p.createdAt,
    })),
  });
});

const tradeoffSchema = z.object({
  title: z.string().max(200).optional(),
  amount: z.number().int().positive(),
  recurring: z.boolean(),
  selected: z.array(z.object({ label: z.string().max(200), value: z.number().int() })).max(50),
  covered: z.number().int(),
  verdict: z.enum(['covered', 'insufficient']),
});

analyticsRoute.post('/tradeoff', zValidator('json', tradeoffSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const [rec] = await db
    .insert(s.tradeoffPlans)
    .values({
      userId,
      title: b.title ?? null,
      amount: b.amount,
      recurring: b.recurring ? 1 : 0,
      selected: JSON.stringify(b.selected),
      covered: b.covered,
      verdict: b.verdict,
    })
    .returning({ id: s.tradeoffPlans.id });
  return c.json({ ok: true, id: rec.id }, 201);
});

/* -------- エクスポート(FR-05) -------- */

analyticsRoute.get('/export/json', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return new Response(JSON.stringify(exportJSON(data), null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="kanjo-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

analyticsRoute.get('/export/matrix.csv', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  const m = matrix(data);
  const esc = (v: string | number): string => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines: string[] = [];
  lines.push(['科目', ...m.months, ...m.years.map((y) => `${y}年計`), '前年比(年換算)'].map(esc).join(','));
  for (const row of m.rows) {
    lines.push(
      [row.label, ...row.series, ...row.yearTotals.map((t) => t.total), `${(row.yoy * 100).toFixed(1)}%`]
        .map(esc)
        .join(','),
    );
  }
  // Excel互換のためBOM付きUTF-8
  const body = `﻿${lines.join('\r\n')}`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="matrix.csv"',
    },
  });
});
