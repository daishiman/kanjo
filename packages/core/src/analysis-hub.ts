import { tradeoffCandidates } from './diagnosis-detectors.js';
import { monthIndex, monthKey } from './month.js';
/**
 * 支出分析ハブ: 5 つの分析 (照合・総収支・マトリクス・推移・診断) のどこから見るかを決める材料。
 *
 * ハブは各分析の API を 5 本呼ぶのではなく、この純関数の結果 1 つで描く。
 * 数字はすべて既存の集計関数 (totalCashflowReport / reconciliationReport / tradeoffCandidates)
 * の出力を再利用し、ここで数え直さない。数え直すと、ハブの件数とタブの件数が食い違ったときに
 * どちらが正しいか誰にも決められなくなる。
 *
 * 判定規則の正本は docs/analysis-hub/requirements-baseline.md の BR-001..BR-005。
 */
import { type PeriodRange, applyPeriod, fullRange, isValidPeriod, sliceDataset } from './period.js';
import { type MfExclusion, reconciliationReport } from './reconciliation.js';
import { type DuplicateVerdict, type FreeeExclusion, totalCashflowReport } from './total-cashflow.js';
import type { Dataset, FreeeDeal } from './types.js';

export const ANALYSIS_HUB_VIEW_IDS = [
  'reconciliation',
  'total-cashflow',
  'matrix',
  'trends',
  'diagnosis',
] as const;
export type AnalysisHubViewId = (typeof ANALYSIS_HUB_VIEW_IDS)[number];
export type HubPriority = '高' | '中';

/* ======================== 期間 (BR-004) ======================== */

/** 期間の月数 (両端を含む) */
const rangeLength = (range: PeriodRange): number => monthIndex(range.to) - monthIndex(range.from) + 1;

/** 直前の同じ長さの期間。2026-01〜03 なら 2025-10〜12 */
export function previousPeriod(range: PeriodRange): PeriodRange {
  const n = rangeLength(range);
  return { from: monthKey(monthIndex(range.from) - n), to: monthKey(monthIndex(range.to) - n) };
}

/** 前期間のラベル。1 年を選んでいれば「前12か月」 */
export const previousPeriodLabel = (range: PeriodRange): string => `前${rangeLength(range)}か月`;

/* ======================== 判定規則 (BR-001..003) ======================== */

/** BR-001: 照合と総収支は対応必要 1 件以上で高。ほかの 3 視点は件数に関わらず中 */
export function hubPriority(id: AnalysisHubViewId, count: number): HubPriority {
  if (id === 'reconciliation' || id === 'total-cashflow') return count > 0 ? '高' : '中';
  return '中';
}

/** BR-002: マトリクスは期間内の未記録月が 0 なら正常 */
export const matrixIsNormal = (unrecordedMonths: number): boolean => unrecordedMonths === 0;

/** BR-003: 改善余地は候補の月額合計 × 12 */
export const annualSavings = (candidates: readonly { amount: number }[]): number =>
  candidates.reduce((sum, candidate) => sum + candidate.amount, 0) * 12;

/* ======================== 集約 ======================== */

export interface AnalysisHubTotals {
  income: number;
  expense: number;
  net: number;
}

export interface AnalysisHubPrevious extends AnalysisHubTotals {
  label: string;
  range: PeriodRange;
  months: number;
}

export interface AnalysisHubSummary extends AnalysisHubTotals {
  /** 前期間の月が 1 か月でも欠ければ null */
  previous: AnalysisHubPrevious | null;
  /** 比率 (0.1 = +10%)。前期間の値が 0 の項目は null */
  change: { income: number | null; expense: number | null; net: number | null } | null;
}

interface ViewBase<Id extends AnalysisHubViewId> {
  id: Id;
  priority: HubPriority;
  count: number;
}

export interface AnalysisHubViews {
  reconciliation: ViewBase<'reconciliation'> & {
    /** 要確認 + 未処理。バッジと優先度はこの契約を使う */
    actionRequiredCount: number;
    /** 互換用。同額候補がある要確認だけの件数 */
    reviewCount: number;
  };
  'total-cashflow': ViewBase<'total-cashflow'> & { reviewCount: number };
  matrix: ViewBase<'matrix'> & { unrecordedMonths: number; normal: boolean };
  trends: ViewBase<'trends'> & { expenseChange: number | null };
  diagnosis: ViewBase<'diagnosis'> & { annualSavings: number; candidateCount: number };
}

export interface AnalysisHubReport {
  summary: AnalysisHubSummary;
  views: AnalysisHubViews;
}

export interface AnalysisHubInput {
  /** 期間で切る前の Dataset。前期間はここから切り出す */
  all: Dataset;
  /** 適用する期間。null = 全期間 */
  range: PeriodRange | null;
  deals: readonly FreeeDeal[];
  verdicts?: readonly DuplicateVerdict[];
  exclusions?: readonly FreeeExclusion[];
  /** 照合画面で「照合から除外する」とした明細。照合と総収支の要確認から外す */
  mfExclusions?: readonly MfExclusion[];
}

/** その Dataset に含まれる月の freee 取引だけを残す (既存 /total-cashflow と同じ絞り方) */
const dealsIn = (data: Dataset, deals: readonly FreeeDeal[]): FreeeDeal[] => {
  const months = new Set(data.months);
  return deals.filter((deal) => months.has(deal.month));
};

function totalsOf(
  data: Dataset,
  deals: readonly FreeeDeal[],
  verdicts: readonly DuplicateVerdict[],
  exclusions: readonly FreeeExclusion[],
  mfExcludedTxIds: readonly string[],
) {
  const report = totalCashflowReport(data, dealsIn(data, deals), verdicts, exclusions, mfExcludedTxIds);
  const totals = report.months.reduce<AnalysisHubTotals>(
    (acc, row) => ({
      income: acc.income + row.totalIncome,
      expense: acc.expense + row.totalExpense,
      net: acc.net + row.totalBalance,
    }),
    { income: 0, expense: 0, net: 0 },
  );
  return { report, totals };
}

/** 前期間の値が 0 なら比率を定義できないので null (Infinity を画面へ出さない) */
const ratio = (current: number, previous: number): number | null =>
  previous === 0 ? null : (current - previous) / Math.abs(previous);

export function analysisHub(input: AnalysisHubInput): AnalysisHubReport {
  const { all, deals } = input;
  const verdicts = input.verdicts ?? [];
  const exclusions = input.exclusions ?? [];
  const mfExclusions = input.mfExclusions ?? [];
  const mfExcludedTxIds = mfExclusions.map((row) => row.txId);
  const range = input.range && isValidPeriod(input.range) ? input.range : null;

  const current = applyPeriod(all, range);
  const { report, totals } = totalsOf(current, deals, verdicts, exclusions, mfExcludedTxIds);

  // 全期間のときは全期間そのものを当期とみなす。直前の同じ長さは必ずデータの外なので null になる
  const basis = range ?? fullRange(all);
  let previous: AnalysisHubPrevious | null = null;
  if (basis) {
    const prevRange = previousPeriod(basis);
    const have = new Set(all.months);
    const n = rangeLength(prevRange);
    const complete = Array.from({ length: n }, (_, i) => monthKey(monthIndex(prevRange.from) + i)).every(
      (m) => have.has(m),
    );
    if (complete) {
      const prev = totalsOf(
        sliceDataset(all, prevRange),
        deals,
        verdicts,
        exclusions,
        mfExcludedTxIds,
      ).totals;
      previous = { label: previousPeriodLabel(prevRange), range: prevRange, months: n, ...prev };
    }
  }
  const change = previous
    ? {
        income: ratio(totals.income, previous.income),
        expense: ratio(totals.expense, previous.expense),
        net: ratio(totals.net, previous.net),
      }
    : null;

  // 照合は必ず全期間で消し込み、一覧と件数だけを表示期間へ投影する。
  // 先に Dataset / freee を切ると、月末と翌月初の ±3 日の候補が割れ、GET /reconciliation と件数がずれる。
  const reconciliation = reconciliationReport({
    data: all,
    deals,
    verdicts,
    freeeExclusions: exclusions,
    mfExclusions,
    months: current.months,
  });
  const reconciliationCount = reconciliation.kpi.actionRequiredCount;
  const cashflowCount = report.review.length;
  const unrecordedMonths = current.unrecordedExpMonths.length;
  const candidates = tradeoffCandidates(current);

  return {
    summary: { ...totals, previous, change },
    views: {
      reconciliation: {
        id: 'reconciliation',
        priority: hubPriority('reconciliation', reconciliationCount),
        count: reconciliationCount,
        actionRequiredCount: reconciliationCount,
        reviewCount: reconciliation.kpi.reviewCount,
      },
      'total-cashflow': {
        id: 'total-cashflow',
        priority: hubPriority('total-cashflow', cashflowCount),
        count: cashflowCount,
        reviewCount: cashflowCount,
      },
      matrix: {
        id: 'matrix',
        priority: hubPriority('matrix', unrecordedMonths),
        count: unrecordedMonths,
        unrecordedMonths,
        normal: matrixIsNormal(unrecordedMonths),
      },
      trends: {
        id: 'trends',
        priority: hubPriority('trends', 0),
        count: 0,
        expenseChange: change?.expense ?? null,
      },
      diagnosis: {
        id: 'diagnosis',
        priority: hubPriority('diagnosis', candidates.length),
        count: candidates.length,
        annualSavings: annualSavings(candidates),
        candidateCount: candidates.length,
      },
    },
  };
}
