import { zValidator } from '@hono/zod-validator';
/**
 * FR-04 予算 / P9 設定(科目正規化・未記帳月・現金補正)。
 * 正規化マップ変更は集計再生成のトリガ(spec §7.3)。
 */
import { budgetTable, suggestBudgets } from '@kanjo/core';
import { applyFreeeDeals } from '@kanjo/core';
import { normalizeAccount } from '@kanjo/core';
import { resolveTx } from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import {
  type Db,
  getDb,
  loadDataset,
  loadNormMap,
  replaceInstitutionOwners,
  saveAgg,
  upsertEdit,
} from '../store.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const settingsRoute = new Hono<Ctx>();

/* -------- 予算(FR-04) -------- */

settingsRoute.get('/budgets', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json({ budgets: data.budgets, table: budgetTable(data) });
});

const budgetsSchema = z.object({
  budgets: z.record(z.string().max(60), z.number().int().nonnegative().nullable()),
});

settingsRoute.put('/budgets', zValidator('json', budgetsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { budgets } = c.req.valid('json');
  for (const [account, v] of Object.entries(budgets)) {
    await db.delete(s.budgets).where(and(eq(s.budgets.userId, userId), eq(s.budgets.account, account)));
    if (v != null && v > 0) await db.insert(s.budgets).values({ userId, account, monthlyAmount: v });
  }
  return c.json({ ok: true });
});

settingsRoute.post('/budgets/suggest', async (c) => {
  const data = await loadDataset(getDb(c.env.DB), c.get('userId'));
  return c.json({ suggested: suggestBudgets(data) });
});

/* -------- 設定(P9) -------- */

settingsRoute.get('/settings', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [normRows, unrecRows, cashRows] = await Promise.all([
    db.select().from(s.accountNormMap).where(eq(s.accountNormMap.userId, userId)),
    db.select().from(s.unrecordedMonths).where(eq(s.unrecordedMonths.userId, userId)),
    db.select().from(s.cashOverrides).where(eq(s.cashOverrides.userId, userId)),
  ]);
  return c.json({
    normMap: Object.fromEntries(normRows.map((r) => [r.raw, r.norm])),
    unrecordedExpMonths: unrecRows.filter((r) => r.kind === 'expense').map((r) => r.month),
    cashOverrides: Object.fromEntries(
      cashRows.map((r) => [r.month, { revenue: r.revenue ?? 0, expense: r.expense ?? 0 }]),
    ),
  });
});

const settingsSchema = z.object({
  normMap: z.record(z.string().max(60), z.string().max(60)).optional(),
  unrecordedExpMonths: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  cashOverrides: z
    .record(
      z.string().regex(/^\d{4}-\d{2}$/),
      z
        .object({ revenue: z.number().int().nonnegative(), expense: z.number().int().nonnegative() })
        .nullable(),
    )
    .optional(),
});

settingsRoute.put('/settings', zValidator('json', settingsSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  let needRecompute = false;

  if (b.normMap) {
    await db.delete(s.accountNormMap).where(eq(s.accountNormMap.userId, userId));
    for (const [raw, norm] of Object.entries(b.normMap)) {
      await db.insert(s.accountNormMap).values({ userId, raw, norm });
    }
    needRecompute = true;
  }
  if (b.unrecordedExpMonths) {
    await db
      .delete(s.unrecordedMonths)
      .where(and(eq(s.unrecordedMonths.userId, userId), eq(s.unrecordedMonths.kind, 'expense')));
    for (const m of b.unrecordedExpMonths) {
      await db.insert(s.unrecordedMonths).values({ userId, month: m, kind: 'expense' });
    }
  }
  if (b.cashOverrides) {
    for (const [month, v] of Object.entries(b.cashOverrides)) {
      await db
        .delete(s.cashOverrides)
        .where(and(eq(s.cashOverrides.userId, userId), eq(s.cashOverrides.month, month)));
      if (v)
        await db.insert(s.cashOverrides).values({ userId, month, revenue: v.revenue, expense: v.expense });
    }
  }

  if (needRecompute) await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});

/* -------- 分類の設定(名義・候補科目・手動編集の一覧) -------- */

settingsRoute.get('/classification', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const data = await loadDataset(db, userId);
  // 保有金融機関ごとの件数・名義
  const instCount = new Map<string, number>();
  let noInstitutionCount = 0;
  for (const t of data.mfTx) {
    if (!t.inst) noInstitutionCount++;
    else instCount.set(t.inst, (instCount.get(t.inst) ?? 0) + 1);
  }
  const institutions = [...instCount.entries()]
    .map(([institution, count]) => ({
      institution,
      count,
      owner: data.institutionOwners[institution] ?? null,
    }))
    .sort((a, b) => b.count - a.count);
  const byId = new Map(data.mfTx.map((t) => [t.id, t]));
  const edits = Object.entries(data.edits)
    .map(([txId, e]) => {
      const t = byId.get(txId);
      const r = t ? resolveTx(t, data.rules, data.edits, data.institutionOwners) : null;
      return {
        txId,
        month: t?.m ?? null,
        date: t?.d ?? null,
        description: t?.c ?? null,
        amount: t?.a ?? null,
        csvBig: t?.big ?? null,
        csvMid: t?.mid ?? null,
        cls: e.cls ?? null,
        big: e.big ?? null,
        mid: e.mid ?? null,
        owner: e.owner ?? null,
        baseBig: e.baseBig ?? null,
        baseMid: e.baseMid ?? null,
        updatedAt: e.updatedAt ?? null,
        /** ok: 有効 / changed: 取込値が編集時と変わった / orphan: 元明細が無い */
        status: !t ? 'orphan' : r?.conflict ? 'changed' : 'ok',
      };
    })
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  const opts = await db.select().from(s.categoryOptions).where(eq(s.categoryOptions.userId, userId));
  return c.json({
    institutions,
    noInstitutionCount,
    institutionOwners: data.institutionOwners,
    categoryOptions: opts.map((o) => ({ major: o.major, mid: o.mid })),
    candidates: await loadCandidates(db, userId, data.mfTx),
    edits,
  });
});

const classificationSchema = z.object({
  institutionOwners: z.record(z.string().max(100), z.enum(['self', 'spouse']).nullable()).optional(),
  categoryOptions: z
    .array(z.object({ major: z.string().min(1).max(60), mid: z.string().max(60) }))
    .max(300)
    .optional(),
  /** 指定した明細の編集を取込値に戻す */
  resetEdits: z.array(z.string().max(100)).max(500).optional(),
});

settingsRoute.put('/classification', zValidator('json', classificationSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  if (b.institutionOwners) {
    const data = await loadDataset(db, userId);
    const map = { ...data.institutionOwners };
    for (const [inst, owner] of Object.entries(b.institutionOwners)) {
      if (owner) map[inst] = owner;
      else delete map[inst];
    }
    await replaceInstitutionOwners(db, userId, map);
  }
  if (b.categoryOptions) {
    await db.delete(s.categoryOptions).where(eq(s.categoryOptions.userId, userId));
    const seen = new Set<string>();
    for (const o of b.categoryOptions) {
      const key = `${o.major}\t${o.mid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await db.insert(s.categoryOptions).values({ userId, major: o.major, mid: o.mid });
    }
  }
  if (b.resetEdits) {
    for (const txId of b.resetEdits) await upsertEdit(db, userId, txId, {});
  }
  if (b.institutionOwners || b.resetEdits) {
    const data = await loadDataset(db, userId);
    await saveAgg(db, userId, data);
  }
  return c.json({ ok: true });
});

/**
 * 正規化マップ変更時: 原本仕訳(freee_deals)から account_norm を再導出して集計を作り直す。
 * 原本の無い月(restore由来)は既存の monthly_agg 値が温存される。
 */
async function recomputeFromDeals(db: Db, userId: string): Promise<void> {
  const normMap = await loadNormMap(db, userId);
  const dealRows = await db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId));
  // account_norm列を新マップで更新
  for (const r of dealRows) {
    const norm = normalizeAccount(r.accountRaw ?? '', normMap);
    if (norm !== r.accountNorm) {
      await db.update(s.freeeDeals).set({ accountNorm: norm }).where(eq(s.freeeDeals.id, r.id));
    }
  }
  const data = await loadDataset(db, userId);
  const months = [...new Set(dealRows.map((r) => r.month))].sort();
  if (months.length) {
    applyFreeeDeals(
      data,
      dealRows.map((r) => ({
        month: r.month,
        date: r.date,
        io: r.io,
        partner: r.partner ?? '',
        accountRaw: r.accountRaw ?? '',
        accountNorm: normalizeAccount(r.accountRaw ?? '', normMap),
        amount: r.amount,
      })),
      months,
    );
  }
  await saveAgg(db, userId, data);
}
