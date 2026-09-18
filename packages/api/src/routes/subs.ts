import { zValidator } from '@hono/zod-validator';
/**
 * サブスクのベンダー登録(一覧・追加・変更・削除)と、未登録の支払先から採点した候補。
 * 登録を変えたら freee 原本から集計を作り直す(取込のたびに消えない)。
 * 候補から外した支払先(「サブスクではない」)は集計に影響しないので、再計算はしない。
 */
import {
  type Dataset,
  type FreeeDeal,
  type PeriodRange,
  SUB_VENDOR_NAME_MAX,
  type SubscriptionsScreenInput,
  resolvePeriodQuery,
  sourceNeutralSubscriptionDeals,
  subsCandidates,
  subsReviewStatus,
  subscriptionRow,
  subscriptionVendorDetail,
  subscriptionsScreen,
  vendorKey,
} from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import {
  type Db,
  dealFromRow,
  getDb,
  loadDataset,
  loadNormMap,
  loadSubVendorExclusions,
  loadSubVendorReviewDecisions,
  loadSubVendors,
  recomputeFromDeals,
} from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const subsRoute = new Hono<Ctx>();

/**
 * 明細の取引名がそのまま登録名・別名・除外名になるため、名前の上限は一つにする。
 * 既存データが持つ最大長に合わせ、120 文字は保存でき、121 文字は全経路で 400 にする。
 */
const name = z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX);
/** 別名の上限は全経路で 50 件。カード明細の取引名は長いことがある */
const ALIASES_MAX = 50;
const alias = z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX);
const aliasList = z.array(alias).max(ALIASES_MAX);
/** 対象勘定科目。空配列なら従来どおり全科目を数える */
const accountList = z.array(z.string().trim().min(1).max(60)).max(30);
/** カテゴリの上書き。null は「既定辞書に従う」へ戻す */
const category = z.string().trim().min(1).max(20).nullable();
const vendorSchema = z.object({
  name,
  aliases: aliasList.default([]),
  accounts: accountList.default([]),
});
/** 部分更新。省いた項目は今の値を保つ */
const vendorPatchSchema = z.object({
  name: name.optional(),
  aliases: aliasList.optional(),
  accounts: accountList.optional(),
  category: category.optional(),
});

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

/**
 * 登録の変更 (部分更新)。統合の取消 (別名を外す) もこれで行う。
 * 集計に効くのは名前・別名・対象科目だけなので、カテゴリだけの変更では集計を作り直さない。
 */
subsRoute.put('/sub-vendors/:id', zValidator('json', vendorPatchSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const b = c.req.valid('json');
  const existing = await loadSubVendors(db, userId);
  const target = existing.find((v) => v.id === id);
  if (!target) return c.json({ error: { code: 'not_found', message: 'ベンダーが見つかりません' } }, 404);
  const nextName = b.name ?? target.name;
  if (existing.some((v) => v.id !== id && vendorKey(v.name) === vendorKey(nextName))) {
    return c.json({ error: { code: 'duplicate', message: '同じ名前のベンダーが既に登録されています' } }, 409);
  }
  const affectsTotals = b.name !== undefined || b.aliases !== undefined || b.accounts !== undefined;
  // 見直しの判断は正規化名で引く。名前が変わるなら判断も新しい名前へ付け替える (指紋は規則由来なので保てる)。
  // 付け替え先に残っている古い判断 (同名で登録し直す前の分など) は先に消す
  const fromKey = vendorKey(target.name);
  const toKey = vendorKey(nextName);
  const decisionsOf = (key: string) =>
    and(eq(s.subVendorReviewDecisions.userId, userId), eq(s.subVendorReviewDecisions.vendorKey, key));
  const carryDecision =
    fromKey === toKey
      ? []
      : [
          db.delete(s.subVendorReviewDecisions).where(decisionsOf(toKey)),
          db.update(s.subVendorReviewDecisions).set({ vendorKey: toKey }).where(decisionsOf(fromKey)),
        ];
  // batch の型は先頭要素を要求するので、空になりうる付け替えは後ろに展開する (同じ batch 内なので原子性は同じ)
  await db.batch([
    db
      .update(s.subVendors)
      .set({
        name: nextName,
        aliases: JSON.stringify(cleanAliases(nextName, b.aliases ?? target.aliases)),
        accounts: JSON.stringify(cleanAccounts(b.accounts ?? target.accounts ?? [])),
        ...(b.category !== undefined ? { category: b.category } : {}),
      })
      .where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id))),
    ...carryDecision,
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors', 'sub_vendor_review_decisions'),
  ]);
  if (affectsTotals) await recomputeFromDeals(db, userId);
  return c.json({ ok: true });
});

const aliasesBodySchema = z.object({ aliases: z.array(alias).min(1).max(ALIASES_MAX) });

/**
 * 名称の統合。別の取引名をこのベンダーの別名に足す。既にある別名は無視する (冪等)。
 * 結合後に上限を超えるなら、どれを残すかを勝手に決めずに 400 で返す。
 */
subsRoute.post('/sub-vendors/:id/aliases', zValidator('json', aliasesBodySchema), async (c) => {
  const userId = c.get('userId');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const db = getDb(c.env.DB);
  const existing = await loadSubVendors(db, userId);
  const target = existing.find((v) => v.id === id);
  if (!target) return c.json({ error: { code: 'not_found', message: 'ベンダーが見つかりません' } }, 404);
  const merged = cleanAliases(target.name, [...target.aliases, ...c.req.valid('json').aliases]);
  if (merged.length > ALIASES_MAX) {
    return c.json({ error: { code: 'too_many_aliases', message: `別名は ${ALIASES_MAX} 件までです` } }, 400);
  }
  if (JSON.stringify(merged) === JSON.stringify(target.aliases)) return c.json({ ok: true, aliases: merged });
  await db.batch([
    db
      .update(s.subVendors)
      .set({ aliases: JSON.stringify(merged) })
      .where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id))),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors'),
  ]);
  await recomputeFromDeals(db, userId);
  return c.json({ ok: true, aliases: merged });
});

subsRoute.delete('/sub-vendors/:id', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
  const target = (await loadSubVendors(db, userId)).find((v) => v.id === id);
  if (!target) return c.json({ error: { code: 'not_found', message: 'ベンダーが見つかりません' } }, 404);
  // 見直しの判断も一緒に消す。残すと、同じ名前で登録し直したときに古い判断が生き返る
  await db.batch([
    db.delete(s.subVendors).where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id))),
    db
      .delete(s.subVendorReviewDecisions)
      .where(
        and(
          eq(s.subVendorReviewDecisions.userId, userId),
          eq(s.subVendorReviewDecisions.vendorKey, vendorKey(target.name)),
        ),
      ),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors', 'sub_vendor_review_decisions'),
  ]);
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

const exclusionSchema = z.object({ partner: z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX) });

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
  if (!Number.isInteger(id)) return c.json({ error: { code: 'bad_id', message: 'IDが不正です' } }, 400);
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
  const [updated] = await db.batch([
    db
      .update(s.subVendors)
      .set({ reviewedAt })
      .where(and(eq(s.subVendors.userId, userId), eq(s.subVendors.id, id)))
      .returning({ id: s.subVendors.id }),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendors'),
  ]);
  if (!updated.length) return c.json({ error: { code: 'not_found', message: 'その登録はありません' } }, 404);
  return c.json({ ok: true, reviewedAt });
});

/** 画面の期間 query。from/to > year > span の順に効き、何も無ければ全期間 (web の「全期間」) */
export interface SubscriptionsPeriodQuery {
  from?: string;
  to?: string;
  year?: string;
  span?: string;
}

const periodQueryOf = (c: Context<Ctx>): SubscriptionsPeriodQuery => ({
  from: c.req.query('from'),
  to: c.req.query('to'),
  year: c.req.query('year'),
  span: c.req.query('span'),
});

/**
 * サブスク画面の core 入力を組む。画面・詳細・判断の保存・サイドバーのバッジが同じ入口を通る
 * (バッジと KPI 5 枚目を別経路で数えない。spec §12.2)。
 *
 * freee 原本は期間で絞らずに渡す。前期間との比較と期間の切り出しは core が行う。
 * 読み込み済みの Dataset・freee 原本があれば受け取り、二度読まない。
 */
export async function loadSubscriptionsInput(
  db: Db,
  userId: string,
  query: SubscriptionsPeriodQuery,
  preloaded: { all?: Dataset; deals?: readonly FreeeDeal[] } = {},
): Promise<SubscriptionsScreenInput> {
  const [all, deals, vendors, decisions, exclusions] = await Promise.all([
    preloaded.all ?? loadDataset(db, userId),
    preloaded.deals ??
      db
        .select()
        .from(s.freeeDeals)
        .where(eq(s.freeeDeals.userId, userId))
        .then((rows) => rows.map(dealFromRow)),
    loadSubVendors(db, userId),
    loadSubVendorReviewDecisions(db, userId),
    loadSubVendorExclusions(db, userId),
  ]);
  const range: PeriodRange | null = resolvePeriodQuery(all, query);
  return {
    all,
    deals,
    range,
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      aliases: v.aliases,
      accounts: v.accounts ?? [],
      category: v.category,
      reviewedAt: v.reviewedAt,
    })),
    decisions: decisions.map((d) => ({
      vendorKey: d.vendorKey,
      decision: d.decision,
      ruleFingerprint: d.ruleFingerprint,
    })),
    exclusions: exclusions.map((e) => e.partner),
    generatedAt: new Date().toISOString(),
  };
}

/** 家計の明細から作る応答は、共有キャッシュにもブラウザの履歴キャッシュにも残さない */
const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' };

/** 画面 1 本ぶんの集計。取引の実体は返さず、詳細で 1 ベンダーぶんだけ返す (spec §13.1) */
subsRoute.get('/subscriptions', async (c) => {
  const input = await loadSubscriptionsInput(getDb(c.env.DB), c.get('userId'), periodQueryOf(c));
  return c.json(subscriptionsScreen(input), 200, PRIVATE_NO_STORE);
});

/** 行を選んだあとだけ取る詳細。未登録の候補も返す (関連データは登録済みだけ) */
subsRoute.get('/subscriptions/vendors/:key', async (c) => {
  const input = await loadSubscriptionsInput(getDb(c.env.DB), c.get('userId'), periodQueryOf(c));
  const detail = subscriptionVendorDetail(input, c.req.param('key'));
  if (!detail) return c.json({ error: { code: 'not_found', message: 'そのサブスクはありません' } }, 404);
  return c.json(detail, 200, PRIVATE_NO_STORE);
});

const vendorKeyField = z.string().trim().min(1).max(SUB_VENDOR_NAME_MAX);
const decisionSchema = z.object({
  vendorKey: vendorKeyField,
  decision: z.enum(['confirmed', 'dismissed']),
});

/**
 * 見直し候補への判断。指紋はクライアントから受け取らず、サーバが core で求めて保存する。
 *
 * 求めるときはこのベンダーへの既存の判断を外す。除外済みの行は候補から消えているため、
 * そのままでは「除外 → 確認済み」への切り替えで指紋が取れない。
 * 判断は集計には効かないが、バックアップから復元する利用者の判断なので
 * canonical mutation fence と JSON snapshot invalidation に接続する。
 */
subsRoute.post('/subscriptions/review-decisions', zValidator('json', decisionSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { vendorKey: key, decision } = c.req.valid('json');
  const input = await loadSubscriptionsInput(db, userId, periodQueryOf(c));
  const row = subscriptionRow(
    {
      ...input,
      decisions: input.decisions.filter((d) => d.vendorKey !== key),
    },
    key,
  );
  if (!row || row.status !== 'registered')
    return c.json({ error: { code: 'not_found', message: '登録済みのサブスクではありません' } }, 404);
  if (!row.review) {
    return c.json({ error: { code: 'not_candidate', message: '見直し候補ではありません' } }, 409);
  }
  const decidedAt = new Date().toISOString();
  const fingerprint = row.review.fingerprint;
  await db.batch([
    db
      .insert(s.subVendorReviewDecisions)
      .values({ userId, vendorKey: key, decision, ruleFingerprint: fingerprint, decidedAt })
      .onConflictDoUpdate({
        target: [s.subVendorReviewDecisions.userId, s.subVendorReviewDecisions.vendorKey],
        set: { decision, ruleFingerprint: fingerprint, decidedAt },
      }),
    invalidateJsonSnapshotQuery(db, userId, 'sub_vendor_review_decisions'),
  ]);
  return c.json({ ok: true, vendorKey: key, decision, fingerprint, decidedAt });
});

/** 判断の取消。候補は規則から毎回導くので、行を消せば未判断に戻る */
subsRoute.delete(
  '/subscriptions/review-decisions',
  zValidator('json', z.object({ vendorKey: vendorKeyField })),
  async (c) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    const { vendorKey: key } = c.req.valid('json');
    const [deleted] = await db.batch([
      db
        .delete(s.subVendorReviewDecisions)
        .where(
          and(eq(s.subVendorReviewDecisions.userId, userId), eq(s.subVendorReviewDecisions.vendorKey, key)),
        )
        .returning({ id: s.subVendorReviewDecisions.id }),
      invalidateJsonSnapshotQuery(db, userId, 'sub_vendor_review_decisions'),
    ]);
    if (!deleted.length)
      return c.json({ error: { code: 'not_found', message: '判断の記録がありません' } }, 404);
    return c.json({ ok: true });
  },
);
