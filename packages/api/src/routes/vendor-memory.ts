/**
 * 取引先ごとの決め事(vendor_memory)の一覧と操作。
 *
 *   GET   /api/vendor-memory                    … 決め事の一覧と、いま自動で当たるかどうか
 *   PATCH /api/vendor-memory/:vendorKey         … 中身・留める・取り消すの変更
 *   POST  /api/vendor-memory/:vendorKey/reapply … いまの決め事で past の明細を当て直す
 *
 * ここで守るもの:
 *  - 他の利用者の決め事は見えない・触れない。全ての読み書きに user_id を付ける。
 *    取引先キーは利用者ごとに独立しており、同じ名前でも別の決め事になる。
 *    PATCH は自分の決め事が無ければ作る。他人の行はどう呼んでも1文字も動かない。
 *  - 取り消した決め事は以後当てない。judgeVendorMemory が revoked を最初に見る(core)。
 *  - 取り消したうえで当て直すと、過去に当てた手当てが外れる。
 *
 * 「過去に当てた手当て」の見分け方について:
 *   tx_edits.origin/origin_key の明示的な由来だけを使う。手動編集が偶然同じ値でも、
 *   値一致から自動適用と推測して削除しない(DR-6)。
 */
import { zValidator } from '@hono/zod-validator';
import {
  OWNER_VALUES,
  STABLE_KEY_VERSION,
  categoryAllowed,
  categoryRejectReason,
  judgeVendorMemory,
  mfStableKey,
  normalizeVendorKey,
} from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import { D1_FREE_QUERY_LIMIT, chunkJsonRowsByBytes } from '../import-lifecycle.js';
import { getDb, recomputeFromDeals } from '../store.js';
import { loadCandidates } from './classify.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const vendorMemoryRoute = new Hono<Ctx>();

const vendorKeyParam = z.object({ vendorKey: z.string().min(1).max(200) }).strict();

const patchSchema = z
  .object({
    cls: z.enum(['biz', 'per']).nullable().optional(),
    big: z.string().max(100).nullable().optional(),
    mid: z.string().max(100).nullable().optional(),
    owner: z.enum(OWNER_VALUES).nullable().optional(),
    /** 画面に出す元の表記。新しく作るときだけ使う(照合は正規化キーで行う) */
    label: z.string().max(200).optional(),
    pinned: z.boolean().optional(),
    revoked: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '変更する項目がありません' });

const notFound = { error: { code: 'vendor_memory_not_found', message: 'その取引先の決め事はありません' } };

/**
 * 当て直しの書き込みが D1 の1呼び出し上限を食い尽くさないための上限。
 * 読み3本 + 集計の再生成ぶんを残す。超えたら期間を狭めて呼び直してもらう。
 */
const REAPPLY_MAX_WRITE_CHUNKS = 8;

type MemoryRow = typeof s.vendorMemory.$inferSelect;

/** 画面へ返す形。判断の理由(件数)まで込みで返し、画面側で再計算させない。 */
const memoryBody = (row: MemoryRow) => {
  const judgement = judgeVendorMemory({
    vendorKey: row.vendorKey,
    cls: row.cls,
    big: row.categoryMajor,
    mid: row.categoryMid,
    owner: row.owner,
    hitCount: row.hitCount,
    disagreeCount: row.disagreeCount,
    pinned: row.pinned === 1,
    revoked: row.revoked === 1,
  });
  return {
    vendorKey: row.vendorKey,
    vendorLabel: row.vendorLabel,
    cls: row.cls,
    big: row.categoryMajor,
    mid: row.categoryMid,
    owner: row.owner,
    hitCount: row.hitCount,
    disagreeCount: row.disagreeCount,
    pinned: row.pinned === 1,
    revoked: row.revoked === 1,
    disposition: judgement.disposition,
    confidence: judgement.confidence,
    reason: judgement.reason,
    // 最後にこの決め事が動いた日。当たった・直した・取り消したのいずれでも進む
    updatedAt: row.updatedAt,
  };
};

vendorMemoryRoute.get('/vendor-memory', async (c) => {
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.vendorMemory)
    .where(eq(s.vendorMemory.userId, c.get('userId')));
  // 使われている決め事から見せる。同数なら取引先名で安定させる(並びが毎回変わらない)
  const memories = rows
    .map(memoryBody)
    .sort((a, b) => b.hitCount - a.hitCount || a.vendorKey.localeCompare(b.vendorKey, 'ja'));
  return c.json({ memories });
});

vendorMemoryRoute.patch(
  '/vendor-memory/:vendorKey',
  zValidator('param', vendorKeyParam),
  zValidator('json', patchSchema),
  async (c) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    // URL から来たキーも同じ正規化を通す。表記ゆれで別の決め事を作らせない
    const vendorKey = normalizeVendorKey(c.req.valid('param').vendorKey);
    const patch = c.req.valid('json');

    // 決め事が無ければその場で作る。差分の画面から「この手当てを覚える」を押したとき、
    // まだ1件も無い取引先で 404 に落とさないため。キーは利用者ごとに独立している
    const [current] = await db
      .select()
      .from(s.vendorMemory)
      .where(and(eq(s.vendorMemory.userId, userId), eq(s.vendorMemory.vendorKey, vendorKey)));

    const next = {
      cls: patch.cls === undefined ? (current?.cls ?? null) : patch.cls,
      big: patch.big === undefined ? (current?.categoryMajor ?? null) : patch.big,
      mid: patch.mid === undefined ? (current?.categoryMid ?? null) : patch.mid,
      owner: patch.owner === undefined ? (current?.owner ?? null) : patch.owner,
    };

    // 科目を動かすなら、その組み合わせが候補にあるか確かめる。ここを素通しすると
    // 当て直しが候補外の科目を明細へ配ってしまい、仕分け画面で直せなくなる
    if (next.big) {
      if (!next.cls) {
        return c.json(
          { error: { code: 'invalid_category', message: '科目を決めるには公私の指定が要ります' } },
          400,
        );
      }
      const txs = await db
        .selectDistinct({ big: s.mfTransactions.categoryMajor, mid: s.mfTransactions.categoryMid })
        .from(s.mfTransactions)
        .where(eq(s.mfTransactions.userId, userId));
      const candidates = await loadCandidates(
        db,
        userId,
        txs.map((t) => ({ big: t.big ?? '', mid: t.mid ?? '' })),
      );
      if (!categoryAllowed(candidates, next.cls, next.big, next.mid)) {
        return c.json({ error: { code: 'invalid_category', message: categoryRejectReason(next.cls) } }, 400);
      }
    }

    const now = new Date().toISOString();
    const flags = {
      pinned: patch.pinned === undefined ? (current?.pinned ?? 0) : patch.pinned ? 1 : 0,
      revoked: patch.revoked === undefined ? (current?.revoked ?? 0) : patch.revoked ? 1 : 0,
    };
    if (current) {
      await db
        .update(s.vendorMemory)
        .set({
          cls: next.cls,
          categoryMajor: next.big,
          categoryMid: next.mid,
          owner: next.owner,
          ...flags,
          updatedAt: now,
        })
        .where(and(eq(s.vendorMemory.userId, userId), eq(s.vendorMemory.vendorKey, vendorKey)));
    } else {
      // 新しい決め事は実績0件から始める。作った瞬間に自動適用にならないのは意図で、
      // すぐ当てたいときは「留める(pinned)」を同じ操作で付けてもらう(D01)
      await db.insert(s.vendorMemory).values({
        userId,
        vendorKey,
        vendorLabel: patch.label ?? vendorKey,
        cls: next.cls,
        categoryMajor: next.big,
        categoryMid: next.mid,
        owner: next.owner,
        hitCount: 0,
        disagreeCount: 0,
        ...flags,
        createdAt: now,
        updatedAt: now,
      });
    }

    const [updated] = await db
      .select()
      .from(s.vendorMemory)
      .where(and(eq(s.vendorMemory.userId, userId), eq(s.vendorMemory.vendorKey, vendorKey)));
    return c.json(memoryBody(updated as MemoryRow));
  },
);

vendorMemoryRoute.post(
  '/vendor-memory/:vendorKey/reapply',
  zValidator('param', vendorKeyParam),
  async (c) => {
    const userId = c.get('userId');
    const database = c.env.DB;
    const db = getDb(database);
    const vendorKey = normalizeVendorKey(c.req.valid('param').vendorKey);

    const [row] = await db
      .select()
      .from(s.vendorMemory)
      .where(and(eq(s.vendorMemory.userId, userId), eq(s.vendorMemory.vendorKey, vendorKey)));
    if (!row) return c.json(notFound, 404);
    const body = memoryBody(row);

    const [txs, edits] = await Promise.all([
      db
        .select({
          txId: s.mfTransactions.txId,
          month: s.mfTransactions.month,
          date: s.mfTransactions.date,
          description: s.mfTransactions.description,
          amount: s.mfTransactions.amount,
          institution: s.mfTransactions.institution,
        })
        .from(s.mfTransactions)
        .where(eq(s.mfTransactions.userId, userId)),
      db
        .select({
          txId: s.txEdits.txId,
          cls: s.txEdits.cls,
          big: s.txEdits.categoryMajor,
          mid: s.txEdits.categoryMid,
          owner: s.txEdits.owner,
          origin: s.txEdits.origin,
          originKey: s.txEdits.originKey,
        })
        .from(s.txEdits)
        .where(eq(s.txEdits.userId, userId)),
    ]);

    const matched = txs.filter((t) => normalizeVendorKey(t.description) === vendorKey).map((t) => t.txId);
    const editByTxId = new Map(edits.map((e) => [e.txId, e]));
    // 当てるのは手当ての無い明細だけ。人が付けた手当ては決め事より強い(DR-6)
    const toApply =
      body.disposition === 'auto-apply'
        ? txs.filter((tx) => normalizeVendorKey(tx.description) === vendorKey && !editByTxId.has(tx.txId))
        : [];
    const toWithdraw =
      body.disposition === 'inactive'
        ? matched.filter((id) => {
            const edit = editByTxId.get(id);
            return edit?.origin === 'vendor_memory' && edit.originKey === vendorKey;
          })
        : [];

    const applyChunks = chunkJsonRowsByBytes(
      toApply.map((tx) => [
        tx.txId,
        mfStableKey({
          m: tx.month,
          d: tx.date,
          c: tx.description,
          a: tx.amount,
          inst: tx.institution ?? undefined,
        }),
      ]),
    );
    const withdrawChunks = chunkJsonRowsByBytes(toWithdraw.map((id) => [id]));
    if (applyChunks.length + withdrawChunks.length > REAPPLY_MAX_WRITE_CHUNKS) {
      return c.json(
        {
          error: {
            code: 'reapply_too_large',
            message: `一度に当て直せる件数を超えています(上限 ${D1_FREE_QUERY_LIMIT} クエリ)`,
          },
        },
        413,
      );
    }

    if (applyChunks.length || withdrawChunks.length) {
      const now = new Date().toISOString();
      await database.batch([
        ...applyChunks.map((payload) =>
          database
            .prepare(
              `INSERT INTO tx_edits
               (user_id, tx_id, cls, category_major, category_mid, owner, stable_key,
                fingerprint_version, origin, origin_key, updated_at)
             SELECT ?, json_extract(item.value,'$[0]'), ?, ?, ?, ?, json_extract(item.value,'$[1]'),
                    ?, 'vendor_memory', ?, ?
             FROM json_each(?) AS item`,
            )
            .bind(
              userId,
              row.cls,
              row.categoryMajor,
              row.categoryMid,
              row.owner,
              STABLE_KEY_VERSION,
              vendorKey,
              now,
              payload,
            ),
        ),
        ...withdrawChunks.map((payload) =>
          database
            .prepare(
              `DELETE FROM tx_edits WHERE user_id=?
             AND tx_id IN (SELECT json_extract(item.value,'$[0]') FROM json_each(?) AS item)`,
            )
            .bind(userId, payload),
        ),
      ]);
      // 手当てが変われば JSON 復元の write-set も変わる。取込の指紋を落としておく
      await invalidateJsonSnapshotQuery(db, userId, 'tx_edits');
      // 手当てが動けば月次の集計も動く。画面が古い数字を出さないよう、ここで作り直す
      await recomputeFromDeals(db, userId);
    }

    return c.json({
      vendorKey: body.vendorKey,
      disposition: body.disposition,
      reason: body.reason,
      matched: matched.length,
      applied: toApply.length,
      withdrawn: toWithdraw.length,
    });
  },
);
