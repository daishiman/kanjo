/**
 * FR-09 トレードオフ画面の API。
 *
 * 候補生成と試算規則は packages/core に委譲し、この層は認証済み利用者の
 * D1 読み書き、入力検証、HTTP 応答だけを担当する。
 */
import { zValidator } from '@hono/zod-validator';
import {
  type Dataset,
  TRADEOFF_AMOUNT_MAX,
  TRADEOFF_CANDIDATE_KEY_MAX,
  TRADEOFF_CANDIDATE_LIMIT,
  TRADEOFF_MEMO_MAX,
  TRADEOFF_TITLE_MAX,
  type TradeoffLatestPlan,
  buildTradeoffCandidates,
  defenseLine,
  detectImprovements,
  isValidTradeoffCovered,
  tradeoffDefenseMargin,
  tradeoffSimulation,
  tradeoffWindowMonths,
} from '@kanjo/core';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import * as s from '../db/schema.js';
import { getDb } from '../store.js';
import { loadScoped } from './analytics.js';

type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };

export const tradeoffRoute = new Hono<Ctx>();

const apiError = (code: string, message: string) => ({ error: { code, message } });
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

// 候補キー 50 件 × 300 字の UTF-8 と本文の欄が収まる大きさ。これを超える本文は読む前に止める。
const tradeoffBodyLimit = bodyLimit({
  maxSize: 64 * 1024,
  onError: (c) => c.json(apiError('payload_too_large', 'リクエストが大きすぎます'), 413),
});
tradeoffRoute.use('/tradeoff/*', tradeoffBodyLimit);
tradeoffRoute.use('/tradeoff', tradeoffBodyLimit);

/**
 * 期間の見直し候補を、自分の freee 経費と上書きだけから作る。
 * GET・POST・PUT が同じ関数を通すので、画面に出た候補と保存時に照合する候補は必ず一致する。
 * data は呼び出し側が loadScoped で受け取った期間適用後の Dataset を渡す。
 */
async function loadTradeoffCandidates(c: Context<Ctx>, data: Dataset) {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const window = tradeoffWindowMonths(data);
  const [deals, notes] = await Promise.all([
    window.length
      ? db
          .select({
            month: s.freeeDeals.month,
            accountNorm: s.freeeDeals.accountNorm,
            accountRaw: s.freeeDeals.accountRaw,
            partner: s.freeeDeals.partner,
            amount: s.freeeDeals.amount,
          })
          .from(s.freeeDeals)
          .where(
            and(
              eq(s.freeeDeals.userId, userId),
              eq(s.freeeDeals.io, 'expense'),
              gte(s.freeeDeals.month, window[0]),
              lte(s.freeeDeals.month, window[window.length - 1]),
            ),
          )
      : Promise.resolve([]),
    db.select().from(s.tradeoffCandidateNotes).where(eq(s.tradeoffCandidateNotes.userId, userId)),
  ]);
  const rows = deals.map((d) => ({
    month: d.month,
    account: d.accountNorm ?? d.accountRaw ?? '',
    partner: d.partner ?? '',
    amount: d.amount,
  }));
  const noteMap = new Map(notes.map((n) => [n.candidateKey, { need: n.need ?? null, memo: n.memo ?? null }]));
  return buildTradeoffCandidates(data, rows, {
    improvements: detectImprovements(data),
    notes: noteMap,
  });
}

/** 保存行を画面の復元に使う形へ。0050 より前の行は候補キーを持たないので keys は空。 */
function tradeoffPlanFromRow(p: typeof s.tradeoffPlans.$inferSelect): TradeoffLatestPlan {
  let keys: string[] = [];
  try {
    const selected = p.selected ? (JSON.parse(p.selected) as unknown) : [];
    if (Array.isArray(selected))
      keys = selected.flatMap((x) => (x && typeof x.key === 'string' ? [x.key as string] : []));
  } catch {
    keys = [];
  }
  return {
    id: p.id,
    title: p.title,
    amount: p.amount,
    recurring: p.recurring === 1,
    startMonth: p.startMonth,
    memo: p.memo,
    keys,
    covered: p.covered ?? 0,
    verdict: p.verdict === 'covered' ? 'covered' : 'insufficient',
    createdAt: p.createdAt,
  };
}

tradeoffRoute.get('/tradeoff', async (c) => {
  const userId = c.get('userId');
  const { data } = await loadScoped(c);
  const candidates = await loadTradeoffCandidates(c, data);
  const [latest] = await getDb(c.env.DB)
    .select()
    .from(s.tradeoffPlans)
    .where(eq(s.tradeoffPlans.userId, userId))
    .orderBy(desc(s.tradeoffPlans.id))
    .limit(1);
  return c.json({
    candidates,
    defense: tradeoffDefenseMargin(defenseLine(data)),
    latest: latest ? tradeoffPlanFromRow(latest) : null,
  });
});

// covered と verdict は受け取らない。送られても捨て、候補の月額からサーバで再計算する。
const tradeoffPlanSchema = z.object({
  title: z.string().max(TRADEOFF_TITLE_MAX).nullish(),
  amount: z.number().int().min(1).max(TRADEOFF_AMOUNT_MAX),
  recurring: z.boolean(),
  startMonth: z.string().regex(MONTH_KEY).nullable(),
  memo: z.string().max(TRADEOFF_MEMO_MAX).nullable(),
  keys: z
    .array(z.string().min(1).max(TRADEOFF_CANDIDATE_KEY_MAX))
    .min(1)
    .max(TRADEOFF_CANDIDATE_LIMIT)
    .refine((keys) => new Set(keys).size === keys.length),
});

tradeoffRoute.post(
  '/tradeoff',
  zValidator('json', tradeoffPlanSchema, (result, c) => {
    if (!result.success) return c.json(apiError('invalid_request', '試算の条件が不正です'), 400);
  }),
  async (c) => {
    const userId = c.get('userId');
    const b = c.req.valid('json');
    const candidates = await loadTradeoffCandidates(c, (await loadScoped(c)).data);
    const byKey = new Map(candidates.map((x) => [x.key, x]));
    const picked = b.keys.map((k) => byKey.get(k));
    if (picked.some((x) => x === undefined))
      return c.json(apiError('unknown_candidate', '選んだ候補が現在の期間にありません'), 422);
    const chosen = picked as NonNullable<(typeof picked)[number]>[];
    const sim = tradeoffSimulation(
      { amount: b.amount, recurring: b.recurring, startMonth: b.startMonth },
      chosen.map((x) => x.monthly),
      null,
    );
    if (!isValidTradeoffCovered(sim.monthlySaving))
      return c.json(apiError('invariant_violation', '削減額を計算できませんでした'), 500);
    const [rec] = await getDb(c.env.DB)
      .insert(s.tradeoffPlans)
      .values({
        userId,
        title: b.title || null,
        amount: b.amount,
        recurring: b.recurring ? 1 : 0,
        selected: JSON.stringify(
          chosen.map((x) => ({
            key: x.key,
            label: `${x.account} / ${x.partner || '取引先なし'}`,
            value: x.monthly,
          })),
        ),
        covered: sim.monthlySaving,
        verdict: sim.verdict,
        startMonth: b.startMonth,
        memo: b.memo || null,
      })
      .returning();
    return c.json({ ok: true, id: rec.id, plan: tradeoffPlanFromRow(rec) }, 201);
  },
);

const tradeoffNoteSchema = z.object({
  need: z.enum(['low', 'mid', 'high']).nullable(),
  memo: z.string().max(TRADEOFF_MEMO_MAX).nullable(),
});

/**
 * 候補 1 件の必要度とメモを上書きする。同じ本文の再送は同じ 1 行 (冪等)。
 * 両方 null なら行を消して自動の推定へ戻す。
 */
tradeoffRoute.put(
  '/tradeoff/candidates/:key',
  zValidator('json', tradeoffNoteSchema, (result, c) => {
    if (!result.success) return c.json(apiError('invalid_request', '必要度とメモが不正です'), 400);
  }),
  async (c) => {
    const key = c.req.param('key');
    if (!key || key.length > TRADEOFF_CANDIDATE_KEY_MAX)
      return c.json(apiError('invalid_request', '候補キーの形式が不正です'), 400);
    const userId = c.get('userId');
    const b = c.req.valid('json');
    // 上書きは Dataset を変えないので、照合と返却で同じ data を使う。上書き表は毎回読み直す。
    const { data } = await loadScoped(c);
    const candidates = await loadTradeoffCandidates(c, data);
    if (!candidates.some((x) => x.key === key))
      return c.json(apiError('unknown_candidate', '候補が現在の期間にありません'), 422);

    const db = getDb(c.env.DB);
    const memo = b.memo ? b.memo : null;
    const target = and(
      eq(s.tradeoffCandidateNotes.userId, userId),
      eq(s.tradeoffCandidateNotes.candidateKey, key),
    );
    if (b.need === null && memo === null) {
      await db.delete(s.tradeoffCandidateNotes).where(target);
    } else {
      const now = new Date().toISOString();
      await db
        .insert(s.tradeoffCandidateNotes)
        .values({ userId, candidateKey: key, need: b.need, memo, updatedAt: now })
        .onConflictDoUpdate({
          target: [s.tradeoffCandidateNotes.userId, s.tradeoffCandidateNotes.candidateKey],
          set: { need: b.need, memo, updatedAt: now },
        });
    }
    const after = await loadTradeoffCandidates(c, data);
    const candidate = after.find((x) => x.key === key) ?? null;
    return c.json({ ok: true, candidate });
  },
);
