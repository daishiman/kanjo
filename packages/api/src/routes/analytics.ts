import { zValidator } from '@hono/zod-validator';
/**
 * 分析系リードAPI(P1〜P4, P6, FR-08, FR-09, エクスポート)。
 * 集計はすべて packages/core の純関数に委譲し、ここでは組み立てと整形のみ行う。
 */
import {
  DIAGNOSIS_NOTE_MAX,
  type Dataset,
  type ExpenseScope,
  HOUSEHOLD_CATEGORY_KEYS,
  LEGACY_SCOPE,
  type PeriodRange,
  type ReviewQueueItem,
  TRANSACTION_EXPORT_HEADER,
  applyDiagnosisStatuses,
  applyPeriod,
  applyReviewSnoozes,
  availableYears,
  benchmarks,
  budgetTable,
  buildExpenseProjection,
  buildReportHtml,
  buildReviewQueue,
  defenseForecast,
  defenseLine,
  diagnosis,
  diagnosisCashflowSeries,
  diagnosisScreen,
  diagnosisSignals,
  diagnosisTotals,
  diagnosisWaterfall,
  findMetric,
  fullRange,
  householdCategoryDetail,
  householdSummary,
  isCloseMonth,
  isDiagnosisActionStatus,
  isOverviewScope,
  isReviewItemKey,
  isReviewItemKind,
  isValidDiagnosisActionKey,
  matrix,
  monthlyCloseStatus,
  normalizeTrendScope,
  overview,
  overviewAggregate,
  overviewScopeMonths,
  periodLabel,
  periodMonths,
  previousPeriod,
  reconciliationReport,
  resolveDiagnosisSelection,
  resolvePeriodQuery,
  reviewItemFingerprint,
  reviewQueueCounts,
  statementsScreen,
  subscriptionsScreen,
  toCsv,
  totalCashflowReport,
  tradeoffCandidates,
  tradeoffReview,
  transactionExportRows,
  trendsReport,
  trendsScreen,
  unsettledReport,
} from '@kanjo/core';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv, AuthVariables } from '../auth.js';
import { loadCashflowSources } from '../cashflow-sources.js';
import * as s from '../db/schema.js';
import { invalidateJsonSnapshotQuery } from '../import-active.js';
import { loadOwnerLabels } from '../owner-labels-store.js';
import { dealFromRow, getDb, loadBackupPayload, loadDataset, loadVendorMemories } from '../store.js';
import { loadSubscriptionsInput } from './subs.js';

// 月次レビューの記録者 (actor) を読むため、ルートは認証ミドルウェアが載せる変数の型をそのまま使う
type Ctx = { Bindings: AuthEnv; Variables: AuthVariables };
/**
 * 集計の補助関数はテナントの鍵だけを読む。Hono の Context は変数の型について不変なので、
 * userId を持つ任意の Context (total-cashflow のルートを含む) を受けられるよう総称にしておく
 */
type DataCtx<V extends { userId: string }> = { Bindings: AuthEnv; Variables: V };
/** 期間の解決に要る部分だけ。analytics と total-cashflow の Context がどちらもそのまま渡せる */
type ScopedContext = Pick<Context<DataCtx<{ userId: string }>>, 'env' | 'req'> & {
  get(key: 'userId'): string;
};

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
  c: ScopedContext,
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

/* -------- 概況 (GET /overview・未処理キュー・保留・月次レビュー) -------- */

const apiError = (code: string, message: string) => ({ error: { code, message } });

/**
 * 未処理キュー (保留を除く前) と、総合 scope の月別系列の元になるトータル収支を全期間で作る。
 *
 * 件数は期間に左右されない (BR-002) ので、ここは必ず絞り込み前の `all` から作る。
 * 概況の総合 KPI と照合キューは同じ totalCashflowReport を共有し、二度計算しない。
 */
async function loadReviewSources<V extends { userId: string }>(c: Context<DataCtx<V>>, all: Dataset) {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [sources, failedRuns, vendorMemories] = await Promise.all([
    loadCashflowSources(db, userId, all.mfTx),
    db
      .select({
        id: s.importRuns.id,
        createdAt: s.importRuns.createdAt,
        failureReason: s.importRuns.failureReason,
      })
      .from(s.importRuns)
      .where(and(eq(s.importRuns.userId, userId), eq(s.importRuns.status, 'failed'))),
    loadVendorMemories(db, userId),
  ]);
  const { deals, verdicts, freeeExclusions: exclusions, mfExclusions } = sources;
  const report = totalCashflowReport(
    all,
    deals,
    verdicts,
    exclusions,
    mfExclusions.map((row) => row.txId),
  );
  const items = buildReviewQueue({
    data: all,
    review: report.review,
    failedImports: failedRuns,
    vendorMemories,
  });
  // 照合件数の正本を一度だけ作り、月次クローズへそのまま渡す (照合画面 BR-006)
  const actionRequiredCount = reconciliationReport({
    data: all,
    deals,
    verdicts,
    freeeExclusions: exclusions,
    mfExclusions,
  }).kpi.actionRequiredCount;
  // サイドバーの「サブスク」バッジ。サブスク画面の KPI 5 枚目 (未判断の見直し候補) と同じ入口・同じ関数で数える。
  // バッジは画面の期間タブを知らないので、既定の期間 (直近 1 年) で数える (spec §12.2)
  const subscriptionCandidates = subscriptionsScreen(
    await loadSubscriptionsInput(db, userId, { span: '1' }, { all, deals }),
  ).kpis.reviewCandidates;
  return { report, items, actionRequiredCount, subscriptionCandidates };
}

/**
 * 月次クローズの状況。概況の本体とサイドバーのカード (未処理キューの応答) が同じ関数で作る。
 * 期間にも範囲にも依存しない (BR-003) ので、必ず全期間の `all` と保留前の全件 `items` を渡す。
 */
async function loadCloseStatus<V extends { userId: string }>(
  c: Context<DataCtx<V>>,
  all: Dataset,
  sources: { items: ReviewQueueItem[]; actionRequiredCount: number },
) {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const [reviewRows, [updated]] = await Promise.all([
    db
      .select({ month: s.monthlyCloseReviews.month, reviewedAt: s.monthlyCloseReviews.reviewedAt })
      .from(s.monthlyCloseReviews)
      .where(eq(s.monthlyCloseReviews.userId, userId)),
    db
      .select({ at: sql<string | null>`max(${s.imports.committedAt})` })
      .from(s.imports)
      .where(and(eq(s.imports.userId, userId), eq(s.imports.status, 'committed'))),
  ]);
  return {
    closeStatus: monthlyCloseStatus({
      data: all,
      items: sources.items,
      reviews: reviewRows,
      hasCommittedImport: updated?.at != null,
      actionRequiredCount: sources.actionRequiredCount,
    }),
    dataUpdatedAt: updated?.at ?? null,
  };
}

async function loadSnoozes<V extends { userId: string }>(c: Context<DataCtx<V>>) {
  const rows = await getDb(c.env.DB)
    .select()
    .from(s.reviewSnoozes)
    .where(eq(s.reviewSnoozes.userId, c.get('userId')));
  return rows.map((row) => ({ kind: row.itemKind, itemKey: row.itemKey, fingerprint: row.fingerprint }));
}

/**
 * 概況の 4 要素 (KPI・推移・前年比・内訳) とクローズ状況。
 * 4 要素だけが scope と期間で変わり、クローズ状況はどちらにも依存しない (BR-003)。
 */
analyticsRoute.get('/overview', async (c) => {
  const rawScope = c.req.query('scope') ?? 'total';
  if (!isOverviewScope(rawScope)) {
    return c.json(apiError('invalid_scope', 'scope は total / business / household のいずれかです'), 400);
  }
  const { data, all, period } = await loadScoped(c);
  const sources = await loadReviewSources(c, all);
  const { report } = sources;
  const { closeStatus, dataUpdatedAt } = await loadCloseStatus(c, all, sources);
  // 系列は全期間から作り、期間は「表示する月の集合」として渡す。前年の比較窓を欠かさないため
  const series = overviewScopeMonths(rawScope, { data: all, totalMonths: report.months });
  const aggregate = overviewAggregate(series, period.applied);
  const forecast = defenseForecast(data);
  return c.json({
    scope: rawScope,
    ...aggregate,
    closeStatus,
    dataUpdatedAt,
    // 画面の語彙は caution。core の 'watch' は他画面が使うので型は変えず、境界でだけ写す
    defenseForecast: { ...forecast, level: forecast.level === 'watch' ? 'caution' : forecast.level },
    period,
  });
});

/** 全期間の未処理キュー。クエリを受け取らない (BR-002) */
analyticsRoute.get('/review-queue', async (c) => {
  // 読み込みは loadScoped に一本化する。件数は期間に依存させないので all だけを使う
  const { all } = await loadScoped(c);
  const [sources, snoozes] = await Promise.all([loadReviewSources(c, all), loadSnoozes(c)]);
  const [{ items, snoozed, snoozedCount }, { closeStatus }] = await Promise.all([
    applyReviewSnoozes(sources.items, snoozes),
    // サイドバーの月次クローズカードは全画面に出るので、全画面が読む未処理キューに載せる
    loadCloseStatus(c, all, sources),
  ]);
  return c.json({
    total: items.length,
    counts: reviewQueueCounts(items),
    snoozedCount,
    items,
    snoozedItems: snoozed,
    closeStatus,
    subscriptionCandidates: sources.subscriptionCandidates,
  });
});

/** kind / itemKey をパスから取り出して検証する。違反は 400 のレスポンスを返す */
function snoozeTarget<V extends { userId: string }>(c: Context<DataCtx<V>>) {
  const kind = c.req.param('kind');
  const itemKey = c.req.param('itemKey');
  if (!isReviewItemKind(kind)) {
    return {
      error: c.json(
        apiError('invalid_kind', 'kind は reconciliation / classification / import のいずれかです'),
        400,
      ),
    };
  }
  if (!isReviewItemKey(itemKey)) {
    return { error: c.json(apiError('invalid_item_key', 'itemKey は 1〜200 文字です'), 400) };
  }
  return { kind, itemKey };
}

/**
 * 後で確認 (保留)。指紋はサーバが今の明細から計算する。
 * クライアントに指紋を渡させると、中身が変わった明細を古い指紋で黙らせられるため。
 */
analyticsRoute.put('/review-queue/snoozes/:kind/:itemKey', async (c) => {
  const target = snoozeTarget(c);
  if ('error' in target) return target.error;
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  // 保留の対象判定も全期間。?span= 付きで呼ばれても期間外の明細を 404 にしない
  const { all } = await loadScoped(c);
  const { items } = await loadReviewSources(c, all);
  const item = items.find((x) => x.kind === target.kind && x.itemKey === target.itemKey);
  if (!item) {
    return c.json(apiError('review_item_not_found', '対象の明細が未処理キューにありません'), 404);
  }
  const fingerprint = await reviewItemFingerprint(item);
  const snoozedAt = new Date().toISOString();
  await db.batch([
    db
      .insert(s.reviewSnoozes)
      .values({ userId, itemKind: target.kind, itemKey: target.itemKey, fingerprint, snoozedAt })
      .onConflictDoUpdate({
        target: [s.reviewSnoozes.userId, s.reviewSnoozes.itemKind, s.reviewSnoozes.itemKey],
        set: { fingerprint, snoozedAt },
      }),
    // 保留は復元の write-set に入る。保留だけ違うバックアップを重複扱いで飛ばさないよう指紋を落とす
    invalidateJsonSnapshotQuery(db, userId, 'review_snoozes'),
  ]);
  return c.json({ kind: target.kind, itemKey: target.itemKey, snoozedAt });
});

analyticsRoute.delete('/review-queue/snoozes/:kind/:itemKey', async (c) => {
  const target = snoozeTarget(c);
  if ('error' in target) return target.error;
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  await db.batch([
    db
      .delete(s.reviewSnoozes)
      .where(
        and(
          eq(s.reviewSnoozes.userId, userId),
          eq(s.reviewSnoozes.itemKind, target.kind),
          eq(s.reviewSnoozes.itemKey, target.itemKey),
        ),
      ),
    invalidateJsonSnapshotQuery(db, userId, 'review_snoozes'),
  ]);
  return c.body(null, 204);
});

/** 月次レビュー済みの記録。重ねて押しても初回の時刻を保つ (冪等) */
analyticsRoute.put('/monthly-close/:month/review', async (c) => {
  const month = c.req.param('month');
  if (!isCloseMonth(month)) return c.json(apiError('invalid_month', 'month は YYYY-MM 形式です'), 400);
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  // user_id はテナントの鍵 ('default')。誰がレビューしたかはログイン中の利用者 (actor) で残す
  const reviewedByUserId = c.get('actor').id;
  await db.batch([
    db
      .insert(s.monthlyCloseReviews)
      .values({ userId, month, reviewedAt: new Date().toISOString(), reviewedByUserId })
      .onConflictDoNothing(),
    invalidateJsonSnapshotQuery(db, userId, 'monthly_close_reviews'),
  ]);
  const [row] = await db
    .select({ reviewedAt: s.monthlyCloseReviews.reviewedAt })
    .from(s.monthlyCloseReviews)
    .where(and(eq(s.monthlyCloseReviews.userId, userId), eq(s.monthlyCloseReviews.month, month)));
  return c.json({ month, reviewedAt: row.reviewedAt });
});

analyticsRoute.delete('/monthly-close/:month/review', async (c) => {
  const month = c.req.param('month');
  if (!isCloseMonth(month)) return c.json(apiError('invalid_month', 'month は YYYY-MM 形式です'), 400);
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  await db.batch([
    db
      .delete(s.monthlyCloseReviews)
      .where(and(eq(s.monthlyCloseReviews.userId, userId), eq(s.monthlyCloseReviews.month, month))),
    invalidateJsonSnapshotQuery(db, userId, 'monthly_close_reviews'),
  ]);
  return c.body(null, 204);
});

analyticsRoute.get('/matrix', async (c) => {
  const { data } = await loadScoped(c);
  return c.json(matrix(data));
});

/**
 * 改善余地・健全性・改善インパクト・診断根拠を 1 応答で返す。
 * 改善余地は毎回計算し直し、D1 から読むのは利用者の判断 (status / note) だけ。
 */
analyticsRoute.get('/diagnosis', async (c) => {
  const { data, all, period } = await loadScoped(c);
  // 未知の scope/metric/compare は 400 にせず既定へ倒す (古いブックマーク対策・FR-010)
  const query = {
    scope: c.req.query('scope'),
    metric: c.req.query('metric'),
    compare: c.req.query('compare'),
  };
  const selection = resolveDiagnosisSelection(query);
  const {
    deals,
    verdicts,
    freeeExclusions: exclusions,
    mfExclusions,
  } = await loadCashflowSources(getDb(c.env.DB), c.get('userId'), all.mfTx);
  // 条件の帯の合計は総収支画面と同じ経路で作る (BR-004)。診断だけ別に足すと合計が食い違う
  const cashflow = diagnosisCashflowSeries(
    all,
    deals,
    verdicts,
    exclusions,
    period.applied ?? fullRange(all),
    selection.compare,
    mfExclusions.map((row) => row.txId),
  );
  const screen = diagnosisScreen(data, query, undefined, cashflow);
  const rows = await getDb(c.env.DB)
    .select({
      actionKey: s.diagnosisActionStates.actionKey,
      status: s.diagnosisActionStates.status,
      note: s.diagnosisActionStates.note,
      decidedAt: s.diagnosisActionStates.decidedAt,
    })
    .from(s.diagnosisActionStates)
    .where(eq(s.diagnosisActionStates.userId, c.get('userId')));
  const states = new Map(
    rows.map((row) => [row.actionKey, { status: row.status, note: row.note, decided_at: row.decidedAt }]),
  );
  // 判断を重ねた後に、合計・棒・シグナルを組み直す (画面側で足し直さないため)
  const improvements = applyDiagnosisStatuses(screen.improvements, states);
  return c.json({
    ...screen,
    improvements,
    waterfall: diagnosisWaterfall(improvements, screen.waterfall[0]?.to ?? 0, screen.selection.metric),
    signals: diagnosisSignals(screen, improvements),
    totals: diagnosisTotals(improvements),
  });
});

const diagnosisActionBody = z.object({
  status: z.string(),
  note: z.string().nullish(),
});

/**
 * 改善アクション 1 件の判断を保存する。同じ鍵への再送は上書き (冪等)。
 * 鍵は登録済み検知器 id で始まるものだけを受け付ける (許可リスト方式)。
 */
analyticsRoute.patch(
  '/diagnosis/actions/:action_key',
  zValidator('json', diagnosisActionBody, (result, c) => {
    if (!result.success) return c.json(apiError('invalid_request', 'status は必須です'), 400);
  }),
  async (c) => {
    const actionKey = c.req.param('action_key');
    if (!isValidDiagnosisActionKey(actionKey))
      return c.json(apiError('invalid_request', 'action_key の形式が不正です'), 400);
    const { status, note } = c.req.valid('json');
    if (!isDiagnosisActionStatus(status))
      return c.json(apiError('invalid_request', 'status は 4 種のいずれかです'), 400);
    if (note != null && note.length > DIAGNOSIS_NOTE_MAX)
      return c.json(apiError('invalid_request', 'note は 500 文字以内です'), 400);

    const now = new Date().toISOString();
    const userId = c.get('userId');
    const row = {
      userId,
      actionKey,
      status,
      note: note ?? null,
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await getDb(c.env.DB)
      .insert(s.diagnosisActionStates)
      .values(row)
      .onConflictDoUpdate({
        target: [s.diagnosisActionStates.userId, s.diagnosisActionStates.actionKey],
        set: { status, note: row.note, decidedAt: now, updatedAt: now },
      });
    return c.json({ action_key: actionKey, status, note: row.note, decided_at: now });
  },
);

/**
 * 科目ごとの規模・増減・記録状況と、次に手を打つ順番。
 * 期間を絞ると同じ指標がその期間だけで計算し直される。
 */
analyticsRoute.get('/trends', async (c) => {
  // 未登録の指標だけは 400。壊れた month や未知の scope/compare は既定値へ倒す (古いブックマーク対策)
  const metric = c.req.query('metric');
  if (!findMetric(metric)) return c.json(apiError('invalid_metric', '未登録の指標です'), 400);
  const { data, all, period } = await loadScoped(c);
  const {
    deals,
    verdicts,
    freeeExclusions: exclusions,
    mfExclusions,
  } = await loadCashflowSources(getDb(c.env.DB), c.get('userId'), all.mfTx);
  // 未知の値は合算に倒す。片側だけの画面が空で出るより、全部が見えるほうが害が小さい
  const scope = normalizeTrendScope(c.req.query('scope'));
  const screen = trendsScreen(
    {
      all,
      deals,
      verdicts,
      exclusions,
      mfExcludedTxIds: mfExclusions.map((row) => row.txId),
      range: period.applied,
    },
    {
      scope,
      metric,
      compare: c.req.query('compare'),
      month: c.req.query('month'),
      category: c.req.query('category'),
      side: c.req.query('side'),
      payee: c.req.query('payee'),
    },
  );
  // 傾向の判定 (rows/pareto/breakdown) は従来どおり MF の明細だけで数える。その基準を応答で明示する
  const legacyScope: ExpenseScope = LEGACY_SCOPE[scope];
  return c.json({
    ...trendsReport(data, legacyScope),
    period,
    ...screen,
    judgementBasis: 'mf_only' as const,
  });
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

/* -------- 家計収支 (spec-household-cashflow-screen §11) -------- */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
// 期間パラメータ (from / to / year / span) は loadScoped が解く。壊れた期間は全期間に倒す既存の規則のまま
const periodQuery = {
  from: z.string().optional(),
  to: z.string().optional(),
  year: z.string().optional(),
  span: z.string().optional(),
};
const householdQuery = z
  .object({ ...periodQuery, month: z.string().regex(MONTH_PATTERN).optional() })
  .strict();
const householdCategoryQuery = z
  .object({
    ...periodQuery,
    key: z.enum(HOUSEHOLD_CATEGORY_KEYS),
    month: z.string().regex(MONTH_PATTERN).optional(),
  })
  .strict();
// zValidator の hook は成功時にも呼ばれる。success を見ずに応答を返すと正しい要求まで 400 になる
const invalidHouseholdQuery = (result: { success: boolean }, c: Context) => {
  if (!result.success)
    return c.json(
      apiError('invalid_query', 'month は YYYY-MM、key は 6 区分のいずれかで指定してください'),
      400,
    );
};

/**
 * 家計画面の入力。総収支画面と同じ `loadScoped` + `loadCashflowSources` で読み、
 * core の `householdSummary` / `householdCategoryDetail` に同じ入力を渡す。
 * 読み方を画面ごとに変えると、家計全体と総収支の総合が同じ期間で食い違う (不変条件 1)。
 */
async function loadHouseholdInput(c: ScopedContext, month: string | undefined) {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const { all, period } = await loadScoped(c);
  const [sources, labels, [updated]] = await Promise.all([
    loadCashflowSources(db, userId, all.mfTx),
    loadOwnerLabels(db, userId),
    db
      .select({ at: sql<string | null>`max(${s.imports.committedAt})` })
      .from(s.imports)
      .where(and(eq(s.imports.userId, userId), eq(s.imports.status, 'committed'))),
  ]);
  const range = period.applied ?? fullRange(all);
  const input = range && {
    all,
    deals: sources.deals,
    verdicts: sources.verdicts,
    exclusions: sources.freeeExclusions,
    mfExcludedTxIds: sources.mfExclusions.map((row) => row.txId),
    range,
    month: month ?? null,
    labels,
  };
  // 期間外の月は黙って最終月に倒さず 400 にする。URL の month と画面の選択月が食い違ったまま表示しない
  const monthOutOfRange = Boolean(range && month && !periodMonths(range).includes(month));
  return { input, labels, period, monthOutOfRange, updatedAt: updated?.at ?? null };
}

const monthOutOfRangeError = apiError('invalid_month', '選んだ月は表示中の期間に含まれていません');

analyticsRoute.get('/household', zValidator('query', householdQuery, invalidHouseholdQuery), async (c) => {
  const { month } = c.req.valid('query');
  const { input, labels, period, monthOutOfRange, updatedAt } = await loadHouseholdInput(c, month);
  if (monthOutOfRange) return c.json(monthOutOfRangeError, 400);
  // 期間内で集計対象になった台帳行が 0 件なら空状態。振替・除外行だけの月を 0 円実績と誤認しない。
  if (!input) return c.json({ empty: true, labels, period, updatedAt });
  const summary = householdSummary(input);
  if (summary.summary.ledgerRowCount === 0) return c.json({ empty: true, labels, period, updatedAt });
  return c.json({ empty: false, ...summary, period, updatedAt });
});

analyticsRoute.get(
  '/household/category',
  zValidator('query', householdCategoryQuery, invalidHouseholdQuery),
  async (c) => {
    const { key, month } = c.req.valid('query');
    const { input, monthOutOfRange } = await loadHouseholdInput(c, month);
    if (monthOutOfRange) return c.json(monthOutOfRangeError, 400);
    if (!input) return c.json(apiError('no_data', 'まだ取り込まれたデータがありません'), 404);
    return c.json(householdCategoryDetail({ ...input, key }));
  },
);

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
 * 財務三表(PL・キャッシュフロー・BS)を、core が組み立てた screen 契約で返す。
 * 期間を絞ると PL / CF はその期間、BS は期間内の基準月の残高になる。
 *
 * キャッシュフローは freee 原本の決済列を見るため、集計済みの Dataset とは別に
 * freee_deals を読む(未決済かどうかは集計に残っていない)。
 */
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

analyticsRoute.get('/statements', async (c) => {
  const { data, all, period } = await loadScoped(c);
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
  // 前期は直前の同じ長さの期間。全期間を選んでいるときもデータ全体の長さで 1 つ前を見る (その範囲は通常空で、前期なし)
  const range = period.applied ?? fullRange(all);
  const previous = range ? applyPeriod(all, previousPeriod(range)) : null;
  // 基準月は期間内だけを受ける。不正・期間外は core が期間の最終月へ丸める
  const ref = c.req.query('ref');
  const screen = statementsScreen({
    current: data,
    previous,
    deals,
    balances,
    referenceMonth: ref && MONTH_KEY.test(ref) ? ref : null,
    navigation: {
      applied: period.applied,
      full: period.full,
      years: period.years,
      monthCount: period.monthCount,
    },
  });
  return c.json({ screen });
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
  const labels = await loadOwnerLabels(getDb(c.env.DB), c.get('userId'));
  // 名義列は利用者が保存した表示名で出す。画面とCSVで同じ人が別の名前にならないようにする
  const rows: (string | number)[][] = [
    [...TRANSACTION_EXPORT_HEADER],
    ...transactionExportRows(data, labels),
  ];
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
