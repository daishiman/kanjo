import { zValidator } from '@hono/zod-validator';
/**
 * 事業と家計を合わせたトータル収支の一覧表と、重複の「同じ / 違う」判断の保存。
 *
 * 集計はすべて `@kanjo/core` の純関数に委譲し、ここでは読み込みと整形だけを行う。
 * 保存するのは利用者の判断1つに限る (月次の合計・件数・トレンドは要求のたびに導出する)。
 */
import {
  type DuplicateVerdict,
  type FreeeExclusion,
  type MfTx,
  STABLE_KEY_VERSION,
  mfStableKey,
  totalCashflowReport,
} from '@kanjo/core';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import { D1_MAX_BOUND_PARAMS } from '../d1-limits.js';
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
    // freeeKey は「どの freee 取引と同じか」の名指し。無い判断 (候補が1件だった) は null のまま渡す
    if (hit) out.push({ txId: tx.id, verdict: hit.verdict, freeeKey: hit.freeeKey });
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

  const [dealRows, verdictRows, exclusionRows] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
  ]);
  const deals = dealRows.map(dealFromRow).filter((deal) => months.has(deal.month));
  const exclusions: FreeeExclusion[] = exclusionRows.map((row) => ({
    freeeKey: row.freeeKey,
    reason: row.reason,
  }));

  const report = totalCashflowReport(data, deals, bindVerdicts(verdictRows, data.mfTx), exclusions);
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
    // 一致した組・相手のいない freee・外した freee の三つを全部返す。
    // 「抜け漏れはないか」に答えられるのは、freee 全件がこの三つのどれかに必ず入る形だけである。
    matched: report.matched,
    freeeOnly: report.freeeOnly,
    excluded: report.excluded,
    coverage: report.coverage,
    period,
  });
});

const verdictItemSchema = z.object({
  txId: z.string().trim().min(1).max(120),
  verdict: z.enum(['same', 'different']),
  /**
   * どの freee 取引と同じかの名指し。候補が1件しかないときは省ける。
   * 上限を長めに取るのは、鍵の材料に支払先名や勘定科目名がそのまま入るため。
   */
  freeeKey: z.string().trim().min(1).max(2_000).optional(),
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

  for (const { txId, verdict, freeeKey } of items) {
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
      // 「違う」の名指しは意味を持たない。持たせると、後で「同じ」に変えたとき古い相手が復活する
      freeeKey: verdict === 'same' ? (freeeKey ?? null) : null,
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
          freeeKey: sql`excluded.freee_key`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  return bulk ? c.json({ ok: true, saved: rows.length, rejected }) : c.json({ ok: true });
});

/**
 * freee 側の二重登録を、理由を付けて総額から外す / 戻す。
 *
 * 突合 (MF と freee のどちらを正とするか) とは別の入口にしてある。既定はあくまで freee が正で、
 * ここに置いた鍵だけが事業費・事業収入から落ちる。理由を必須にするのは、後から金額の差を
 * 追うときに「なぜ外したか」が読めないと元へ戻す判断ができないため。
 */
const freeeKeyField = z.string().trim().min(1).max(2_000);

/** 1 リクエストで外せる件数の上限。一致した組が数百件でも 1 往復で送れる幅を取る */
const MAX_EXCLUSION_ITEMS = 200;

/** 除外行の列数 (user_id / freee_key / reason / created_at / updated_at) */
const EXCLUSION_COLUMNS = 5;

/**
 * 1 文の多重 VALUES に載せられる行数。D1 は 1 文あたりのバインドを 100 に制限するので、
 * 列数で割った数を超えたら文を分ける。件数が増えた日にだけ落ちる書き方にしない。
 */
const EXCLUSION_ROWS_PER_STATEMENT = Math.floor(D1_MAX_BOUND_PARAMS / EXCLUSION_COLUMNS);

/**
 * 1 件だけの除外と、選択したぶんをまとめた除外の両方を受ける。
 *
 * まとめて送れるようにするのは画面の都合ではない。一致した組は 1 か月で十数件あり、
 * 1 件ずつ送るとそのたびに往復する。理由は選んだ全件で同じことが多い (「日付と金額が
 * 一致するので二重登録」) ので、理由は 1 つだけ受け取り、鍵の配列に同じ理由を書く。
 */
const exclusionSchema = z.union([
  z.object({ freeeKey: freeeKeyField, reason: z.string().trim().min(1).max(200) }),
  z.object({
    freeeKeys: z.array(freeeKeyField).min(1).max(MAX_EXCLUSION_ITEMS),
    reason: z.string().trim().min(1).max(200),
  }),
]);

totalCashflowRoute.post(
  '/total-cashflow/freee-exclusions',
  zValidator('json', exclusionSchema),
  async (c) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    const payload = c.req.valid('json');
    const bulk = 'freeeKeys' in payload;
    // 同じ鍵が 2 回来ても 1 文の中で同じ行を二度更新することはできない (SQLite が拒む)。
    // 受け取った時点で畳んでおき、選び方によって保存の成否が変わらないようにする。
    const keys = [...new Set(bulk ? payload.freeeKeys : [payload.freeeKey])];
    const now = new Date().toISOString();
    const rows = keys.map((freeeKey) => ({
      userId,
      freeeKey,
      reason: payload.reason,
      createdAt: now,
      updatedAt: now,
    }));

    for (let at = 0; at < rows.length; at += EXCLUSION_ROWS_PER_STATEMENT) {
      await db
        .insert(s.freeeDealExclusions)
        .values(rows.slice(at, at + EXCLUSION_ROWS_PER_STATEMENT))
        .onConflictDoUpdate({
          target: [s.freeeDealExclusions.userId, s.freeeDealExclusions.freeeKey],
          // createdAt は最初の値を保つ。理由の書き直しで「いつ外したか」を失わない
          set: { reason: sql`excluded.reason`, updatedAt: sql`excluded.updated_at` },
        });
    }
    return bulk ? c.json({ ok: true, saved: rows.length }) : c.json({ ok: true });
  },
);

totalCashflowRoute.delete(
  '/total-cashflow/freee-exclusions',
  zValidator('json', z.object({ freeeKey: z.string().trim().min(1).max(2_000) })),
  async (c) => {
    const userId = c.get('userId');
    const db = getDb(c.env.DB);
    await db
      .delete(s.freeeDealExclusions)
      .where(
        and(
          eq(s.freeeDealExclusions.userId, userId),
          eq(s.freeeDealExclusions.freeeKey, c.req.valid('json').freeeKey),
        ),
      );
    return c.json({ ok: true });
  },
);
