/**
 * 支出分析ハブの集約 API。
 *
 * ハブは 5 つの分析のどこから見るかを決める画面で、5 本の分析 API を並べて呼ぶと
 * 開いた瞬間に 5 倍遅くなる。判断に要る数字だけをここで 1 本にまとめて返す。
 *
 * 集計は `@kanjo/core` の analysisHub に委譲し、ここでは読み込みと受け渡しだけを行う。
 * 前期間比は期間で切ったあとのデータでは出せないので、切る前の `all` を渡す。
 */
import { analysisHub } from '@kanjo/core';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import { loadCashflowSources } from '../cashflow-sources.js';
import { getDb } from '../store.js';
import { loadScoped } from './analytics.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const analysisHubRoute = new Hono<Ctx>();

analysisHubRoute.get('/analysis/hub', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { all, period } = await loadScoped(c);

  const {
    deals,
    verdicts,
    freeeExclusions: exclusions,
    mfExclusions,
  } = await loadCashflowSources(db, userId, all.mfTx);

  const report = analysisHub({
    all,
    range: period.applied,
    deals,
    verdicts,
    exclusions,
    mfExclusions,
  });
  return c.json({ period, ...report });
});
