import { zValidator } from '@hono/zod-validator';
/**
 * サブスクのベンダー登録(一覧・追加・変更・削除)と、未登録の支払先から採点した候補。
 * 登録を変えたら freee 原本から集計を作り直す(取込のたびに消えない)。
 * 候補から外した支払先(「サブスクではない」)は集計に影響しないので、再計算はしない。
 */
import { sourceNeutralSubscriptionDeals, subsCandidates, subsReviewStatus, vendorKey } from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import {
  dealFromRow,
  getDb,
  loadDataset,
  loadNormMap,
  loadSubVendorExclusions,
  loadSubVendors,
  recomputeFromDeals,
} from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const subsRoute = new Hono<Ctx>();

const name = z.string().trim().min(1).max(60);
const aliases = z.array(z.string().trim().min(1).max(60)).max(20).default([]);
/** 対象勘定科目。空配列なら従来どおり全科目を数える */
const accounts = z.array(z.string().trim().min(1).max(60)).max(30).default([]);
const vendorSchema = z.object({ name, aliases, accounts });

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

/** 重複と空を除いて保存する。原本科目名を安定参照として使う。 */
const cleanAccounts = (a: string[]): string[] => [...new Set(a.filter(Boolean))];

/**
 * 登録一覧と、対象科目の選択肢(freee 原本に実際に出てくる科目名)。
 * 選択肢はサジェスト用なので、原本が無ければ空でよい。
 */
subsRoute.get('/sub-vendors', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [vendors, dealRows, mfRows] = await Promise.all([
    loadSubVendors(db, userId),
    db
      .selectDistinct({ accountRaw: s.freeeDeals.accountRaw })
      .from(s.freeeDeals)
      .where(eq(s.freeeDeals.userId, userId)),
    db
      .selectDistinct({
        categoryMajor: s.mfTransactions.categoryMajor,
        categoryMid: s.mfTransactions.categoryMid,
      })
      .from(s.mfTransactions)
      .where(eq(s.mfTransactions.userId, userId)),
  ]);
  const accountOptions = [
    ...new Set(
      [
        ...dealRows.map((row) => row.accountRaw ?? ''),
        ...mfRows.flatMap((row) => [
          row.categoryMajor ?? '',
          row.categoryMid ?? '',
          row.categoryMajor && row.categoryMid ? `${row.categoryMajor}/${row.categoryMid}` : '',
        ]),
      ].filter(Boolean),
    ),
  ].sort();
  // 解約し忘れは金額の異常では拾えないので、最後に見直した日から四半期で催促する
  const review = subsReviewStatus(
    vendors.map((v) => ({ id: v.id, name: v.name, reviewedAt: v.reviewedAt })),
    new Date().toISOString().slice(0, 10),
  );
  return c.json({ vendors, accountOptions, review });
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
    db.insert(s.subVendors).values({
      userId,
      name: b.name,
      aliases: JSON.stringify(cleanAliases(b.name, b.aliases)),
      accounts: JSON.stringify(cleanAccounts(b.accounts)),
      sortOrder,
    }),
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
      .set({
        name: b.name,
        aliases: JSON.stringify(cleanAliases(b.name, b.aliases)),
        accounts: JSON.stringify(cleanAccounts(b.accounts)),
      })
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

/**
 * 未登録の支払先を「サブスクらしさ」順に。freee 原本仕訳が無ければ空。
 * 「サブスクではない」と記録した支払先は候補から外し、取り消せるよう excluded として返す。
 */
subsRoute.get('/sub-vendors/candidates', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [vendors, excluded, rows, data] = await Promise.all([
    loadSubVendors(db, userId),
    loadSubVendorExclusions(db, userId),
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    loadDataset(db, userId),
  ]);
  const sourceNeutralDeals = sourceNeutralSubscriptionDeals(data, rows.map(dealFromRow));
  return c.json({
    candidates: subsCandidates(
      sourceNeutralDeals,
      vendors,
      20,
      excluded.map((e) => e.partner),
    ),
    excluded,
    dealRows: sourceNeutralDeals.length,
  });
});

const exclusionSchema = z.object({ partner: z.string().trim().min(1).max(120) });

/** 「これはサブスクではない」の記録。集計は変わらないので再計算しない(登録の追加・削除とは別経路) */
subsRoute.post('/sub-vendors/exclusions', zValidator('json', exclusionSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { partner } = c.req.valid('json');
  const key = vendorKey(partner);
  if (!key) {
    return c.json({ error: { code: 'invalid_partner', message: '支払先の名前が空です' } }, 400);
  }
  const existing = await loadSubVendorExclusions(db, userId);
  // 同じ支払先を二度押しても増やさない(表記ゆれは照合キーで吸収)
  if (existing.some((e) => vendorKey(e.partner) === key)) return c.json({ ok: true });
  await db.batch([
    db.insert(s.subVendorExclusions).values({ userId, partner, vendorKey: key }),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendor_exclusions'),
  ]);
  return c.json({ ok: true });
});

/** 除外の取り消し。候補一覧に戻る */
subsRoute.delete('/sub-vendors/exclusions/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  const [deleted] = await db.batch([
    db
      .delete(s.subVendorExclusions)
      .where(and(eq(s.subVendorExclusions.userId, userId), eq(s.subVendorExclusions.id, id)))
      .returning({ id: s.subVendorExclusions.id }),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendor_exclusions'),
  ]);
  if (!deleted.length) {
    return c.json({ error: { code: 'not_found', message: '除外の記録が見つかりません' } }, 404);
  }
  return c.json({ ok: true });
});

/** 「いま見直した」の記録。契約内容そのものは変えないので集計の作り直しは要らない */
subsRoute.post('/sub-vendors/:id/review', async (c) => {
  const userId = c.get('userId');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const db = getDb(c.env.DB);
  const reviewedAt = new Date().toISOString();
  const updated = await db
    .update(s.subVendors)
    .set({ reviewedAt })
    .where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id)))
    .returning({ id: s.subVendors.id });
  if (!updated.length) return c.json({ error: { code: 'not_found', message: 'その登録はありません' } }, 404);
  return c.json({ ok: true, reviewedAt });
});
