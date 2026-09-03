import { zValidator } from '@hono/zod-validator';
/**
 * 分析系リードAPI(P1〜P4, P6, FR-08, FR-09, エクスポート)。
 * 集計はすべて packages/core の純関数に委譲し、ここでは組み立てと整形のみ行う。
 */
import {
  BALANCE_SHEET_SOURCES,
  type Dataset,
  type ExpenseScope,
  LIABILITY_CATEGORIES,
  type PeriodRange,
  TRANSACTION_EXPORT_HEADER,
  applyPeriod,
  availableYears,
  benchmarks,
  budgetTable,
  buildBalanceSheet,
  buildExpenseProjection,
  buildReportHtml,
  cashFlow,
  defenseForecast,
  defenseLine,
  diagnosis,
  fullRange,
  household,
  matrix,
  overview,
  periodLabel,
  profitAndLoss,
  resolvePeriodQuery,
  sourceNeutralSubscriptions,
  toCsv,
  tradeoffCandidates,
  tradeoffReview,
  transactionExportRows,
  trendsReport,
  unsettledReport,
} from '@kanjo/core';
import { and, desc, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { dealFromRow, getDb, loadBackupPayload, loadDataset } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };

export const analyticsRoute = new Hono<Ctx>();

/* -------- 対象期間(?from=YYYY-MM&to=YYYY-MM) -------- */

/**
 * 期間を適用した Dataset と、選択肢を作るための全期間の情報を返す。
 *
 * ?from=&to= の任意期間、?year=YYYY の暦年、?span=1|2|3 の直近n年を受ける。
 * 年と直近n年の解決にはデータの最終月が要るので、データを持っているここで解決する。
 * 壊れた指定は 400 にせず全期間に倒す(古いブックマークで画面が出なくなるのを避ける)。
 *
 * 選択肢は必ず絞り込み前の Dataset から作る。絞り込み後から作ると、
 * 2025年を選んだ瞬間に選択肢から2026年が消えて戻れなくなる。
 */
export async function loadScoped(
  c: Context<Ctx>,
): Promise<{ data: Dataset; all: Dataset; period: PeriodMeta }> {
  const all = await loadDataset(getDb(c.env.DB), c.get('userId'));
  const range = resolvePeriodQuery(all, {
    from: c.req.query('from'),
    to: c.req.query('to'),
    year: c.req.query('year'),
    span: c.req.query('span'),
  });
  return {
    data: applyPeriod(all, range),
    all,
    period: {
      applied: range,
      label: periodLabel(range),
      full: fullRange(all),
      years: availableYears(all),
      monthCount: all.months.length,
    },
  };
}

export interface PeriodMeta {
  /** 実際に適用された期間。null = 全期間 */
  applied: PeriodRange | null;
  label: string;
  /** データ全体の期間(選択肢の上限・下限) */
  full: PeriodRange | null;
  /** データが存在する年(新しい順) */
  years: string[];
  /** データ全体の月数 */
  monthCount: number;
}

analyticsRoute.get('/summary', async (c) => {
  const { data, period } = await loadScoped(c);
  return c.json({
    overview: overview(data),
    defense: { ...defenseLine(data), forecast: defenseForecast(data) },
    benchmarks: benchmarks(data),
    period,
  });
});

analyticsRoute.get('/matrix', async (c) => {
  const { data } = await loadScoped(c);
  return c.json(matrix(data));
});

analyticsRoute.get('/diagnosis', async (c) => {
  const { data } = await loadScoped(c);
  return c.json(diagnosis(data));
});

/**
 * 科目ごとの規模・増減・記録状況と、次に手を打つ順番。
 * 期間を絞ると同じ指標がその期間だけで計算し直される。
 */
analyticsRoute.get('/trends', async (c) => {
  const { data, period } = await loadScoped(c);
  // 未知の値は合算に倒す。片側だけの画面が空で出るより、全部が見えるほうが害が小さい
  const raw = c.req.query('scope');
  const scope: ExpenseScope = raw === 'biz' || raw === 'personal' ? raw : 'all';
  return c.json({ ...trendsReport(data, scope), period });
});

analyticsRoute.get('/subscriptions', async (c) => {
  const { data, all } = await loadScoped(c);
  // 期間絞り込みは従来、値が0の支払先を表から落とす。しかし登録定義まで落とすと、
  // MFにしか無い支払先をここから新たに集計できない。設定は全期間側から戻す。
  data.subs.vendors = [...all.subs.vendors];
  data.subs.aliases = structuredClone(all.subs.aliases);
  data.subs.accounts = structuredClone(all.subs.accounts);
  data.subs.matrix = Object.fromEntries(
    data.subs.vendors.map((vendor) => [vendor, data.months.map(() => 0)]),
  );
  const months = new Set(data.months);
  const rows = await getDb(c.env.DB)
    .select()
    .from(s.freeeDeals)
    .where(eq(s.freeeDeals.userId, c.get('userId')));
  const deals = rows.map(dealFromRow).filter((deal) => months.has(deal.month));
  return c.json(sourceNeutralSubscriptions(data, deals));
});

/**
 * freeeの帳簿確定額と、MFの未記帳事業支出を混同せず照合する。
 * canonicalは書き換えず、現在のuser scopeの行から毎回導出する。
 */
analyticsRoute.get('/business-spend', async (c) => {
  const { data, period } = await loadScoped(c);
  const months = new Set(data.months);
  const rows = await getDb(c.env.DB)
    .select()
    .from(s.freeeDeals)
    .where(eq(s.freeeDeals.userId, c.get('userId')));
  const projection = buildExpenseProjection(
    data,
    rows.map(dealFromRow).filter((deal) => months.has(deal.month)),
  );
  return c.json({
    summary: projection.summary,
    months: projection.months,
    unbooked: projection.unbooked.map((fact) => ({
      id: fact.sourceId,
      month: fact.month,
      date: fact.date,
      amount: fact.amount,
      party: fact.party,
      category: fact.categoryNorm || fact.categoryRaw,
    })),
    review: projection.review.map((item) => ({
      mf: {
        id: item.mf.sourceId,
        month: item.mf.month,
        date: item.mf.date,
        amount: item.mf.amount,
        party: item.mf.party,
        purpose: item.mf.purpose,
      },
      freee: item.freee
        ? {
            date: item.freee.date,
            amount: item.freee.amount,
            party: item.freee.party,
            purpose: item.freee.purpose,
          }
        : null,
      candidateCount: item.candidateCount,
      reason: item.reason,
    })),
    period,
  });
});

analyticsRoute.get('/household', async (c) => {
  const { data } = await loadScoped(c);
  return c.json(household(data));
});

/**
 * freee 未決済(未入金・未払)の一覧。
 * 損益(発生ベース)には既に載っているため集計とは別経路で、原本の freee_deals を期日順に並べ直す。
 * 「今日」は Worker 側で決める(純関数は時計を持たない)。
 */
analyticsRoute.get('/unsettled', async (c) => {
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.freeeDeals)
    .where(and(eq(s.freeeDeals.userId, c.get('userId')), eq(s.freeeDeals.settlementKnown, 1)));
  const today = new Date().toISOString().slice(0, 10);
  return c.json(unsettledReport(rows.map(dealFromRow), today));
});

/**
 * 財務三表(PL・キャッシュフロー)。BSは残高が要るのでまだ作れない。
 * 期間を絞ると、その期間だけの損益計算書になる。
 *
 * キャッシュフローは freee 原本の決済列を見るため、集計済みの Dataset とは別に
 * freee_deals を読む(未決済かどうかは集計に残っていない)。
 */
analyticsRoute.get('/statements', async (c) => {
  const { data, period } = await loadScoped(c);
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.freeeDeals)
    .where(eq(s.freeeDeals.userId, c.get('userId')));
  const deals = rows.map(dealFromRow);
  // 残高はloadDatasetに混ぜない。取込の1リクエストがD1の50 query上限に張り付いており、
  // loaderのSELECTを1本増やすと取込が落ちる。ここでだけ直接読む
  const balances = await db
    .select()
    .from(s.balanceEntries)
    .where(eq(s.balanceEntries.userId, c.get('userId')))
    .orderBy(s.balanceEntries.month);
  return c.json({
    pl: profitAndLoss(data),
    cf: cashFlow(data, deals),
    bs: buildBalanceSheet(balances),
    liabilityCategoryOptions: LIABILITY_CATEGORIES,
    balanceSheetSources: BALANCE_SHEET_SOURCES,
    period,
  });
});

analyticsRoute.get('/defense-line', async (c) => {
  const { data } = await loadScoped(c);
  return c.json({ ...defenseLine(data), forecast: defenseForecast(data) });
});

/* -------- FR-09 やりくり試算 -------- */

analyticsRoute.get('/tradeoff', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { data } = await loadScoped(c);
  const plans = await db
    .select()
    .from(s.tradeoffPlans)
    .where(eq(s.tradeoffPlans.userId, userId))
    .orderBy(desc(s.tradeoffPlans.id))
    .limit(50);
  return c.json({
    candidates: tradeoffCandidates(data),
    budgets: budgetTable(data),
    plans: plans.map((p) => ({
      id: p.id,
      title: p.title,
      amount: p.amount,
      recurring: p.recurring === 1,
      selected: p.selected ? (JSON.parse(p.selected) as unknown) : [],
      covered: p.covered,
      verdict: p.verdict,
      createdAt: p.createdAt,
    })),
    // 立てた計画が翌月に効いたかの突合。見込みを出しただけで終わらせない
    review: tradeoffReview(
      data,
      plans.map((p) => ({
        id: p.id,
        title: p.title,
        amount: p.amount,
        covered: p.covered,
        createdAt: p.createdAt,
      })),
    ),
  });
});

const tradeoffSchema = z.object({
  title: z.string().max(200).optional(),
  amount: z.number().int().positive(),
  recurring: z.boolean(),
  selected: z.array(z.object({ label: z.string().max(200), value: z.number().int() })).max(50),
  covered: z.number().int(),
  verdict: z.enum(['covered', 'insufficient']),
});

analyticsRoute.post('/tradeoff', zValidator('json', tradeoffSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const b = c.req.valid('json');
  const [rec] = await db
    .insert(s.tradeoffPlans)
    .values({
      userId,
      title: b.title ?? null,
      amount: b.amount,
      recurring: b.recurring ? 1 : 0,
      selected: JSON.stringify(b.selected),
      covered: b.covered,
      verdict: b.verdict,
    })
    .returning({ id: s.tradeoffPlans.id });
  return c.json({ ok: true, id: rec.id }, 201);
});

/* -------- エクスポート(FR-05) -------- */

analyticsRoute.get('/export/json', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const payload = await loadBackupPayload(db, userId);
  // 現金はrestore対象外。監査用rawと、sourceで解決済みのversioned deltaを別枠で同梱する。
  return new Response(JSON.stringify(payload, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="kanjo-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

analyticsRoute.get('/export/matrix.csv', async (c) => {
  const { data } = await loadScoped(c);
  const m = matrix(data);
  const rows: (string | number)[][] = [
    ['科目', ...m.months, ...m.years.map((y) => `${y}年計`), '前年比(年換算)'],
  ];
  for (const row of m.rows) {
    rows.push([
      row.label,
      ...row.series,
      ...row.yearTotals.map((t) => t.total),
      `${(row.yoy * 100).toFixed(1)}%`,
    ]);
  }
  // Excel互換のためBOM付きUTF-8
  return new Response(`﻿${toCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="matrix.csv"',
    },
  });
});

/**
 * 明細CSV。集計(matrix.csv)では追えない「この金額はどの明細か」を出す。
 * 税理士への受け渡しと、取込結果の目視突合の両方でここが要る。
 */
analyticsRoute.get('/export/transactions.csv', async (c) => {
  const { data } = await loadScoped(c);
  const rows: (string | number)[][] = [[...TRANSACTION_EXPORT_HEADER], ...transactionExportRows(data)];
  return new Response(`﻿${toCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kanjo-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

/**
 * 単一HTMLの会計レポート。画面は手元に残らないので、人へ渡せる形をここで作る。
 * 外部参照ゼロなので、保存すればオフラインでもそのまま開ける。
 */
analyticsRoute.get('/export/report.html', async (c) => {
  const { data } = await loadScoped(c);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(buildReportHtml(data, today), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="kanjo-report-${today}.html"`,
    },
  });
});
