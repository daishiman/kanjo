import { zValidator } from '@hono/zod-validator';
/**
 * 事業と家計を合わせたトータル収支の一覧表と、重複の「同じ / 違う」判断の保存。
 *
 * 集計はすべて `@kanjo/core` の純関数に委譲し、ここでは読み込みと整形だけを行う。
 * 保存するのは利用者の判断1つに限る (月次の合計・件数・トレンドは要求のたびに導出する)。
 */
import {
  type DuplicateVerdict,
  type MfTx,
  STABLE_KEY_VERSION,
  mfStableKey,
  totalCashflowReport,
} from '@kanjo/core';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { dealFromRow, getDb } from '../store.js';
import { loadScoped } from './analytics.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const totalCashflowRoute = new Hono<Ctx>();

type VerdictRow = typeof s.duplicateVerdicts.$inferSelect;

/**
 * 保存済みの判断を、いま画面に出ている明細へ結び付け直す。
 *
 * `tx_id` を先に見て、無いときだけ `stable_key` へ落ちる (identity.ts の2段解決と同じ順序)。
 * 逆順にすると弱い鍵が強い鍵を上書きしうる。版が違う鍵とは突き合わせない。
 */
function bindVerdicts(rows: readonly VerdictRow[], mfTx: readonly MfTx[]): DuplicateVerdict[] {
  const byTxId = new Map(rows.map((row) => [row.txId, row]));
  const byStableKey = new Map<string, VerdictRow | null>();
  for (const row of rows) {
    if (!row.stableKey) continue;
    if ((row.fingerprintVersion ?? STABLE_KEY_VERSION) !== STABLE_KEY_VERSION) continue;
    // 鍵が重複したらどちらの明細の判断か決められない。黙って片方を選ぶより結び付けない
    byStableKey.set(row.stableKey, byStableKey.has(row.stableKey) ? null : row);
  }
  const out: DuplicateVerdict[] = [];
  for (const tx of mfTx) {
    const hit = byTxId.get(tx.id) ?? byStableKey.get(mfStableKey(tx)) ?? null;
    if (hit) out.push({ txId: tx.id, verdict: hit.verdict });
  }
  return out;
}

/**
 * 月次のトータル収入・支出・収支と内訳、事業へ寄せた件数、要確認キュー。
 *
 * 期間の解決は分析APIと同じ `loadScoped` を通す。ここで別の解き方をすると、
 * 同じ ?from=&to= でも画面ごとに違う月が出る。
 */
totalCashflowRoute.get('/total-cashflow', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { data, period } = await loadScoped(c);
  const months = new Set(data.months);

  const [dealRows, verdictRows] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
  ]);
  const deals = dealRows.map(dealFromRow).filter((deal) => months.has(deal.month));

  const report = totalCashflowReport(data, deals, bindVerdicts(verdictRows, data.mfTx));
  return c.json({
    months: report.months,
    review: report.review.map((item) => ({ txId: item.mfTxId, reason: item.reason })),
    period,
  });
});

const verdictSchema = z.object({
  txId: z.string().trim().min(1).max(120),
  verdict: z.enum(['same', 'different']),
});

/**
 * 重複の判断を保存する。同じ明細への再判断は行を増やさず上書きする。
 *
 * 明細が実在するかを保存の前に確かめる。存在しない tx_id を受け付けると、
 * 誰の明細にも当たらない判断が溜まり、要確認キューが減らない理由が追えなくなる。
 */
totalCashflowRoute.post('/total-cashflow/verdicts', zValidator('json', verdictSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { txId, verdict } = c.req.valid('json');

  const { all } = await loadScoped(c);
  const tx = all.mfTx.find((row) => row.id === txId);
  if (!tx) return c.json({ error: '対象の明細が見つかりません' }, 404);

  const stableKey = mfStableKey(tx);
  // 識別子が不安定で、かつ stable_key も他の明細と衝突する明細は、再取込後に引き直せない。
  // 保存できたように見せて次の取込で消えるより、保存できないことをその場で言う。
  if (!tx.idStable && all.mfTx.filter((row) => mfStableKey(row) === stableKey).length > 1) {
    return c.json({ error: 'この明細は再取込後に見分けられないため、判断を保存できません' }, 409);
  }

  const now = new Date().toISOString();
  const existing = await db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId));
  // tx_id が振り直されていても、同じ stable_key の行があればそれを書き換える(行を増やさない)
  const target =
    existing.find((row) => row.txId === txId) ??
    existing.find(
      (row) =>
        row.stableKey === stableKey && (row.fingerprintVersion ?? STABLE_KEY_VERSION) === STABLE_KEY_VERSION,
    );

  if (target) {
    await db
      .update(s.duplicateVerdicts)
      .set({ verdict, stableKey, fingerprintVersion: STABLE_KEY_VERSION, updatedAt: now })
      .where(and(eq(s.duplicateVerdicts.userId, userId), eq(s.duplicateVerdicts.txId, target.txId)));
  } else {
    await db
      .insert(s.duplicateVerdicts)
      .values({
        userId,
        txId,
        verdict,
        stableKey,
        fingerprintVersion: STABLE_KEY_VERSION,
        decidedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [s.duplicateVerdicts.userId, s.duplicateVerdicts.txId],
        set: { verdict, stableKey, fingerprintVersion: STABLE_KEY_VERSION, updatedAt: now },
      });
  }
  return c.json({ ok: true });
});
