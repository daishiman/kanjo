import { zValidator } from '@hono/zod-validator';
/**
 * サブスクのベンダー登録(一覧・追加・変更・削除)と、未登録の支払先から採点した候補。
 * 登録を変えたら freee 原本から集計を作り直す(取込のたびに消えない)。
 */
import { subsCandidates, vendorKey } from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import { dealFromRow, getDb, loadSubVendors, recomputeFromDeals } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const subsRoute = new Hono<Ctx>();

const name = z.string().trim().min(1).max(60);
const aliases = z.array(z.string().trim().min(1).max(60)).max(20).default([]);
const vendorSchema = z.object({ name, aliases });

/** 別名は重複と名前自身を除いて保存する */
const cleanAliases = (n: string, a: string[]): string[] => {
  const seen = new Set<string>([vendorKey(n)]);
  return a.filter((x) => {
    const k = vendorKey(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

subsRoute.get('/sub-vendors', async (c) => {
  const vendors = await loadSubVendors(getDb(c.env.DB), c.get('userId'));
  return c.json({ vendors });
});

subsRoute.post('/sub-vendors', zValidator('json', vendorSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const existing = await loadSubVendors(db, userId);
  if (existing.some((v) => vendorKey(v.name) === vendorKey(b.name))) {
    return c.json({ error: { code: 'duplicate', message: '同じ名前のベンダーが既に登録されています' } }, 409);
  }
  const sortOrder = (existing.at(-1)?.id ?? 0) + 100;
  await db.batch([
    db
      .insert(s.subVendors)
      .values({ userId, name: b.name, aliases: JSON.stringify(cleanAliases(b.name, b.aliases)), sortOrder }),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors'),
  ]);
  await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});

subsRoute.put('/sub-vendors/:id', zValidator('json', vendorSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  const b = c.req.valid('json');
  const existing = await loadSubVendors(db, userId);
  const target = existing.find((v) => v.id === id);
  if (!target) return c.json({ error: { code: 'not_found', message: 'ベンダーが見つかりません' } }, 404);
  if (existing.some((v) => v.id !== id && vendorKey(v.name) === vendorKey(b.name))) {
    return c.json({ error: { code: 'duplicate', message: '同じ名前のベンダーが既に登録されています' } }, 409);
  }
  await db.batch([
    db
      .update(s.subVendors)
      .set({ name: b.name, aliases: JSON.stringify(cleanAliases(b.name, b.aliases)) })
      .where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id))),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors'),
  ]);
  await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});

subsRoute.delete('/sub-vendors/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  const [r] = await db.batch([
    db
      .delete(s.subVendors)
      .where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id)))
      .returning({ id: s.subVendors.id }),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors'),
  ]);
  if (!r.length) return c.json({ error: { code: 'not_found', message: 'ベンダーが見つかりません' } }, 404);
  await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});

/** 未登録の支払先を「サブスクらしさ」順に。freee 原本仕訳が無ければ空 */
subsRoute.get('/sub-vendors/candidates', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [vendors, rows] = await Promise.all([
    loadSubVendors(db, userId),
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
  ]);
  return c.json({ candidates: subsCandidates(rows.map(dealFromRow), vendors), dealRows: rows.length });
});
