/**
 * 支出分析ハブの集約 API。
 *
 * ハブは 5 つの分析のどこから見るかを決める画面で、5 本の分析 API を並べて呼ぶと
 * 開いた瞬間に 5 倍遅くなる。判断に要る数字だけをここで 1 本にまとめて返す。
 *
 * 集計は `@kanjo/core` の analysisHub に委譲し、ここでは読み込みと受け渡しだけを行う。
 * 前期間比は期間で切ったあとのデータでは出せないので、切る前の `all` を渡す。
 */
import { type FreeeExclusion, analysisHub } from '@kanjo/core';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { dealFromRow, getDb } from '../store.js';
import { loadScoped } from './analytics.js';
import { bindDuplicateVerdicts } from './duplicate-verdict-bindings.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const analysisHubRoute = new Hono<Ctx>();

analysisHubRoute.get('/analysis/hub', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { all, period } = await loadScoped(c);

  const [dealRows, verdictRows, exclusionRows] = await Promise.all([
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, userId)),
    db.select().from(s.duplicateVerdicts).where(eq(s.duplicateVerdicts.userId, userId)),
    db.select().from(s.freeeDealExclusions).where(eq(s.freeeDealExclusions.userId, userId)),
  ]);
  const exclusions: FreeeExclusion[] = exclusionRows.map((row) => ({
    freeeKey: row.freeeKey,
    reason: row.reason,
  }));

  const report = analysisHub({
    all,
    range: period.applied,
    deals: dealRows.map(dealFromRow),
    verdicts: bindDuplicateVerdicts(verdictRows, all.mfTx),
    exclusions,
  });
  return c.json({ period, ...report });
});
