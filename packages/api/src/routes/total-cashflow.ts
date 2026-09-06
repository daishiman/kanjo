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
import { eq, sql } from 'drizzle-orm';
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
    // mf と candidates をそのまま渡す。要確認は「理由を告げる」ためではなく
    // 「利用者が同じ取引か判断する」ために出しており、判断材料は画面まで届かないと意味がない。
    review: report.review.map((item) => ({
      txId: item.mfTxId,
      reason: item.reason,
      mf: item.mf,
      candidates: item.candidates,
    })),
    period,
  });
});

const verdictItemSchema = z.object({
  txId: z.string().trim().min(1).max(120),
  verdict: z.enum(['same', 'different']),
});

/**
 * 1 件だけの判断と、選択したぶんをまとめた判断の両方を受ける。
 *
 * まとめて送れるようにするのは画面の都合ではない。1 件ずつ送ると要確認 19 件で
 * 19 往復になり、そのたびに期間解決 (`loadScoped`) を丸ごとやり直す。
 * D1 のクエリ数は 1 invocation あたりで数えられるので、往復を減らすことがそのまま
 * 上限に触れない唯一の方法になる (取込を 1 ファイルずつに割ったのと同じ理由の裏返し)。
 */
/** 1 リクエストで受ける判断の上限。多重 VALUES の 1 文に収まる範囲に留める */
const MAX_VERDICT_ITEMS = 200;

const verdictSchema = z.union([
  verdictItemSchema,
  z.object({ items: z.array(verdictItemSchema).min(1).max(MAX_VERDICT_ITEMS) }),
]);

/** 保存できない理由。単票なら HTTP status、まとめてなら件ごとの理由として返す */
type VerdictReject = { txId: string; reason: string };

/**
 * 重複の判断を保存する。同じ明細への再判断は行を増やさず上書きする。
 *
 * 明細が実在するかを保存の前に確かめる。存在しない tx_id を受け付けると、
 * 誰の明細にも当たらない判断が溜まり、要確認キューが減らない理由が追えなくなる。
 *
 * まとめて送られた場合も、書き込みは多重 VALUES の 1 文に畳む。件数に比例して
 * クエリが増える書き方にすると、選ぶ件数によって成否が変わる保存になってしまう。
 */
totalCashflowRoute.post('/total-cashflow/verdicts', zValidator('json', verdictSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const payload = c.req.valid('json');
  const bulk = 'items' in payload;
  const items = bulk ? payload.items : [payload];

  const { all } = await loadScoped(c);
  const now = new Date().toISOString();
  const existing = await db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId));

  const rejected: VerdictReject[] = [];
  const rows: (typeof s.duplicateVerdicts.$inferInsert)[] = [];
  const claimed = new Set<string>();

  for (const { txId, verdict } of items) {
    const tx = all.mfTx.find((row) => row.id === txId);
    if (!tx) {
      rejected.push({ txId, reason: '対象の明細が見つかりません' });
      continue;
    }
    const stableKey = mfStableKey(tx);
    // 識別子が不安定で、かつ stable_key も他の明細と衝突する明細は、再取込後に引き直せない。
    // 保存できたように見せて次の取込で消えるより、保存できないことをその場で言う。
    if (!tx.idStable && all.mfTx.filter((row) => mfStableKey(row) === stableKey).length > 1) {
      rejected.push({ txId, reason: 'この明細は再取込後に見分けられないため、判断を保存できません' });
      continue;
    }
    // tx_id が振り直されていても、同じ stable_key の行があればそれを書き換える(行を増やさない)
    const target =
      existing.find((row) => row.txId === txId) ??
      existing.find(
        (row) =>
          row.stableKey === stableKey &&
          (row.fingerprintVersion ?? STABLE_KEY_VERSION) === STABLE_KEY_VERSION,
      );
    // 同じ既存行を 2 件が取り合うと、1 文の中で同じ行を二度更新することになり SQLite が拒む。
    // 先に取った側へ譲り、後から来た側は自分の tx_id で新しい行を持つ。
    const rowTxId = target && !claimed.has(target.txId) ? target.txId : txId;
    if (claimed.has(rowTxId)) continue;
    claimed.add(rowTxId);
    rows.push({
      userId,
      txId: rowTxId,
      verdict,
      stableKey,
      fingerprintVersion: STABLE_KEY_VERSION,
      decidedAt: now,
      updatedAt: now,
    });
  }

  if (!bulk && rejected.length > 0) {
    const reason = rejected[0]!.reason;
    return c.json({ error: reason }, reason.includes('見つかりません') ? 404 : 409);
  }

  if (rows.length > 0) {
    await db
      .insert(s.duplicateVerdicts)
      .values(rows)
      .onConflictDoUpdate({
        target: [s.duplicateVerdicts.userId, s.duplicateVerdicts.txId],
        set: {
          verdict: sql`excluded.verdict`,
          stableKey: sql`excluded.stable_key`,
          fingerprintVersion: sql`excluded.fingerprint_version`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  return bulk ? c.json({ ok: true, saved: rows.length, rejected }) : c.json({ ok: true });
});
