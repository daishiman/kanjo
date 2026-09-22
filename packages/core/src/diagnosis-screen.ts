import { previousPeriod, previousPeriodLabel } from './analysis-hub.js';
/**
 * 診断画面 1 枚ぶんの組み立て。
 *
 * 画面が「いま何にいくら効くのか」を上から下へ一度で辿れるように、
 * 改善余地 → 健全性 → インパクト → シグナル → 根拠 を同じ Dataset から一括で作る。
 * 画面側で足し直す値を残さないのは、表と図で合計が食い違う状態を作らないため。
 */
import {
  type DiagnosisData,
  comparison,
  diagnosis,
  personalExplainability,
  personalMonths,
} from './analysis.js';
import { budgetsInEffect } from './budget-screen.js';
import {
  type DiagnosisActionStatus,
  type DiagnosisDetector,
  type DiagnosisImprovement,
  detectImprovements,
} from './diagnosis-detectors.js';
import { type DiagnosisHealth, diagnosisHealth } from './diagnosis-health.js';
import { type PeriodRange, previousYearPeriod } from './period.js';
import {
  type DuplicateVerdict,
  type FreeeExclusion,
  type SegmentTotals,
  type TotalCashflowSeriesRow,
  totalCashflowScreen,
} from './total-cashflow.js';
import type { FreeeDeal } from './types.js';
import type { Dataset } from './types.js';

/* ============================ URL に載る条件 ============================ */

export const DIAGNOSIS_SCOPES = ['total', 'business', 'household'] as const;
export const DIAGNOSIS_METRICS = ['expense', 'income', 'net'] as const;
export const DIAGNOSIS_COMPARES = ['previous', 'yoy'] as const;

export type DiagnosisScope = (typeof DIAGNOSIS_SCOPES)[number];
export type DiagnosisMetric = (typeof DIAGNOSIS_METRICS)[number];
export type DiagnosisCompare = (typeof DIAGNOSIS_COMPARES)[number];

export interface DiagnosisSelection {
  scope: DiagnosisScope;
  metric: DiagnosisMetric;
  compare: DiagnosisCompare;
}

/**
 * 許可集合と完全一致しない値は既定へ倒す。400 にしないのは FR-010 の方針で、
 * 古いブックマークを開いた利用者に「壊れた」ではなく既定の画面を見せるため。
 */
export function resolveDiagnosisSelection(query: {
  scope?: string | null;
  metric?: string | null;
  compare?: string | null;
}): DiagnosisSelection {
  const pick = <T extends string>(allowed: readonly T[], value: string | null | undefined): T =>
    allowed.includes(value as T) ? (value as T) : allowed[0];
  return {
    scope: pick(DIAGNOSIS_SCOPES, query.scope),
    metric: pick(DIAGNOSIS_METRICS, query.metric),
    compare: pick(DIAGNOSIS_COMPARES, query.compare),
  };
}

/* ============================ 画面の構成要素 ============================ */

/** ウォーターフォールの 1 本。from→to の floating bar として描く */
export interface DiagnosisWaterfallBar {
  key: string;
  label: string;
  from: number;
  to: number;
  kind: 'base' | 'cut' | 'gain' | 'result';
}

export interface DiagnosisSignal {
  label: string;
  detail: string;
  tone: 'alert' | 'watch' | 'good';
}

export interface DiagnosisEvidenceRow {
  source: string;
  period: string;
  /** 記帳済みの割合 (1 = 100%)。測れなければ null */
  coverage: number | null;
  summary: string;
  /** 取込画面など、確認しに行く先 */
  to: string;
}

export interface DiagnosisTotals {
  /** 対応済み・見送りを除いた年間インパクトの合計 (BR-001) */
  active: number;
  activeCount: number;
  /** 畳んだぶんの合計と件数 (FR-003 の注記) */
  collapsed: number;
  collapsedCount: number;
}

/**
 * 条件の帯 (範囲・指標・比較対象) が選んだ期間合計と、比較対象との差 (BR-004)。
 *
 * 値の出どころは総収支画面と同じ `totalCashflowScreen` の月次系列である。
 * 診断だけが別の足し方をすると、同じ期間・同じ範囲なのに 2 つの画面で合計が食い違い、
 * 「どちらが正しいのか」を利用者が判定できなくなる。
 */
export interface DiagnosisScopeTotals {
  /** 選択中の範囲×指標の期間合計 */
  current: number;
  /** 比較対象期間の同じ値。比較対象の月が 1 つでも欠けていれば null (BR-006 と同じ扱い) */
  baseline: number | null;
  /** current − baseline。baseline が null なら null */
  diff: number | null;
  /** 変化率。baseline が 0 なら null (0 で割らない) */
  rate: number | null;
  /** 「前12か月」「前年同期」など比較対象の呼び名 */
  baselineLabel: string;
  baselineRange: PeriodRange | null;
  /** 範囲別の期間合計。total = business + household が成り立つ (BR-004) */
  byScope: Record<DiagnosisScope, number>;
}

/** 指標 1 つを SegmentTotals から取り出す。net は収入 − 支出 */
const metricValue = (totals: SegmentTotals, metric: DiagnosisMetric): number =>
  metric === 'expense' ? totals.expense : metric === 'income' ? totals.income : totals.balance;

const sumScope = (
  rows: readonly TotalCashflowSeriesRow[],
  scope: DiagnosisScope,
  metric: DiagnosisMetric,
): number =>
  rows.reduce(
    (acc, row) =>
      acc +
      metricValue(scope === 'total' ? row.total : scope === 'business' ? row.biz : row.household, metric),
    0,
  );

/**
 * 条件の帯の 3 値を月次系列へ適用する。
 *
 * 比較対象の期間は当期の range から導くだけで、欠け月の判定 (baselineSeries=null) は
 * 呼び出し側が行う。取込前の月を 0 として足すと「去年は支出 0 だった」と読めてしまい、
 * 増減が実態と逆に出るため (総収支画面 BR-006 と同じ理由)。
 */
export function diagnosisScopeTotals(
  currentSeries: readonly TotalCashflowSeriesRow[],
  baselineSeries: readonly TotalCashflowSeriesRow[] | null,
  selection: DiagnosisSelection,
  range: PeriodRange | null,
): DiagnosisScopeTotals {
  const byScope: Record<DiagnosisScope, number> = {
    total: sumScope(currentSeries, 'total', selection.metric),
    business: sumScope(currentSeries, 'business', selection.metric),
    household: sumScope(currentSeries, 'household', selection.metric),
  };
  const current = byScope[selection.scope];
  const baseline = baselineSeries ? sumScope(baselineSeries, selection.scope, selection.metric) : null;
  return {
    current,
    baseline,
    diff: baseline === null ? null : current - baseline,
    rate: baseline === null || baseline === 0 ? null : (current - baseline) / Math.abs(baseline),
    baselineLabel: selection.compare === 'yoy' ? '前年同期' : range ? previousPeriodLabel(range) : '前期間',
    baselineRange: range ? diagnosisBaselineRange(range, selection.compare) : null,
    byScope,
  };
}

/** 比較対象の期間。yoy は 12 か月前、previous は直前の同じ長さ */
export const diagnosisBaselineRange = (range: PeriodRange, compare: DiagnosisCompare): PeriodRange =>
  compare === 'yoy' ? previousYearPeriod(range) : previousPeriod(range);

/** 'YYYY-MM' の期間を月キーへ開く (両端を含む) */
function monthsBetween(range: PeriodRange): string[] {
  const out: string[] = [];
  let y = Number(range.from.slice(0, 4));
  let m = Number(range.from.slice(5, 7));
  for (;;) {
    const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
    if (key > range.to) break;
    out.push(key);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * 診断が使う月次系列を、総収支画面とまったく同じ経路で作る。
 *
 * 当期と比較対象で `totalCashflowScreen` を 2 回通すのは、比較対象が
 * 「別の期間で同じ計算をやり直した結果」だからで、Dataset の切り方だけでは表せない。
 * 比較対象の月が 1 つでも取込前なら系列を返さない。0 として足すと
 * 「去年は支出 0 だった」と読めてしまい、増減が実態と逆に出る。
 */
export function diagnosisCashflowSeries(
  all: Dataset,
  deals: readonly FreeeDeal[],
  verdicts: readonly DuplicateVerdict[],
  exclusions: readonly FreeeExclusion[],
  range: PeriodRange | null,
  compare: DiagnosisCompare,
  mfExcludedTxIds: readonly string[] = [],
): {
  series: readonly TotalCashflowSeriesRow[];
  baselineSeries: readonly TotalCashflowSeriesRow[] | null;
  range: PeriodRange | null;
} {
  if (!range) return { series: [], baselineSeries: null, range: null };
  const screenOf = (r: PeriodRange): TotalCashflowSeriesRow[] =>
    totalCashflowScreen(all, deals, verdicts, exclusions, r, mfExcludedTxIds).series;
  const baselineRange = diagnosisBaselineRange(range, compare);
  const known = new Set(all.months);
  const complete = monthsBetween(baselineRange).every((m) => known.has(m));
  return {
    series: screenOf(range),
    baselineSeries: complete ? screenOf(baselineRange) : null,
    range,
  };
}

export interface DiagnosisScreen extends DiagnosisData {
  selection: DiagnosisSelection;
  /** 条件の帯が選んだ期間合計。総収支の月次系列を渡さなければ null */
  scopeTotals: DiagnosisScopeTotals | null;
  improvements: DiagnosisImprovement[];
  health: DiagnosisHealth;
  waterfall: DiagnosisWaterfallBar[];
  signals: DiagnosisSignal[];
  evidence: DiagnosisEvidenceRow[];
  totals: DiagnosisTotals;
}

/** 合計から外す判断。対応済みと見送りは「もう手を打たない」ので残余ではない */
const SETTLED: readonly DiagnosisActionStatus[] = ['対応済み', '見送り'];

const isActive = (row: DiagnosisImprovement): boolean => !SETTLED.includes(row.status);

/** シグナルの上限 (BR-009)。多いと優先順位が立たない */
export const DIAGNOSIS_SIGNAL_LIMIT = 3;

export function diagnosisTotals(improvements: readonly DiagnosisImprovement[]): DiagnosisTotals {
  const active = improvements.filter(isActive);
  const collapsed = improvements.filter((r) => !isActive(r));
  return {
    active: active.reduce((acc, r) => acc + r.annualImpact, 0),
    activeCount: active.length,
    collapsed: collapsed.reduce((acc, r) => acc + r.annualImpact, 0),
    collapsedCount: collapsed.length,
  };
}

/**
 * 年間経費からの積み上げ。先頭に現状、以降は未対応の改善ぶんを 1 本ずつ引き、最後に改善後。
 * 対応済み・見送りは棒に出さない (合計と表の残余をそろえるため)。
 */
export function diagnosisWaterfall(
  improvements: readonly DiagnosisImprovement[],
  baselineAnnual: number,
  metric: DiagnosisMetric = 'expense',
): DiagnosisWaterfallBar[] {
  const baseline =
    metric === 'expense' ? Math.max(0, Math.round(baselineAnnual)) : Math.round(baselineAnnual);
  const metricLabel = metric === 'expense' ? '年間経費' : metric === 'income' ? '年間収入' : '年間純収支';
  const bars: DiagnosisWaterfallBar[] = [
    { key: 'base', label: `現状の${metricLabel}`, from: 0, to: baseline, kind: 'base' },
  ];
  let cursor = baseline;
  for (const row of improvements.filter(isActive)) {
    const next = metric === 'expense' ? Math.max(0, cursor - row.annualImpact) : cursor + row.annualImpact;
    bars.push({
      key: row.action_key,
      label: row.label,
      from: metric === 'expense' ? next : cursor,
      to: metric === 'expense' ? cursor : next,
      kind: metric === 'expense' ? 'cut' : 'gain',
    });
    cursor = next;
  }
  bars.push({ key: 'result', label: `改善後の${metricLabel}`, from: 0, to: cursor, kind: 'result' });
  return bars;
}

/** cashflow を渡さない純関数利用でも、選択した scope×metric の年換算を同じ Dataset から作る */
function diagnosisAnnualBaseline(data: Dataset, selection: DiagnosisSelection): number {
  const rows = comparison(data, personalMonths(data)).rows;
  const values = rows.flatMap((row) => {
    const sides =
      selection.scope === 'business'
        ? [row.biz]
        : selection.scope === 'household'
          ? [row.personal]
          : [row.biz, row.personal];
    let present = false;
    let value = 0;
    for (const side of sides) {
      const selected =
        selection.metric === 'expense'
          ? side.expense
          : selection.metric === 'income'
            ? side.income
            : side.balance;
      if (selected !== null) {
        present = true;
        value += selected;
      }
    }
    return present ? [value] : [];
  });
  return values.length ? Math.round((values.reduce((acc, value) => acc + value, 0) / values.length) * 12) : 0;
}

/** 重複排除済みの改善余地から、いま効くシグナルを最大 3 件 */
export function diagnosisSignals(
  _base: DiagnosisData,
  improvements: readonly DiagnosisImprovement[],
): DiagnosisSignal[] {
  return improvements
    .filter(isActive)
    .slice(0, DIAGNOSIS_SIGNAL_LIMIT)
    .map((row) => ({
      label: row.label,
      detail: `年内 ¥${row.annualImpact.toLocaleString()} の改善見込み。${row.detail}`,
      tone: row.severity === 'high' ? ('alert' as const) : ('watch' as const),
    }));
}

/** どのデータをどこまで見て診断したか。数字が合わないときの切り分けの出発点になる */
export function diagnosisEvidence(data: Dataset): DiagnosisEvidenceRow[] {
  const months = data.months;
  const period = months.length ? `${months[0]}〜${months[months.length - 1]}` : '未取込';
  const unrecorded = new Set(data.unrecordedExpMonths);
  const recorded = months.filter((m) => !unrecorded.has(m)).length;
  const hh = { months: personalMonths(data), explainability: personalExplainability(data) };
  return [
    {
      source: 'freee 取引 (事業)',
      period,
      coverage: months.length ? recorded / months.length : null,
      summary: `科目 ${data.biz.categories.length} 件、記帳済み ${recorded} / ${months.length} ヶ月。`,
      to: '/import',
    },
    {
      source: 'MoneyForward 明細 (個人)',
      period: hh.months.length ? `${hh.months[0]}〜${hh.months[hh.months.length - 1]}` : '未取込',
      coverage: hh.explainability ? hh.explainability.rate : null,
      summary: `明細 ${data.mfTx.length} 件、直近月の説明可能率 ${
        hh.explainability ? `${(hh.explainability.rate * 100).toFixed(0)}%` : '算出不能'
      }。`,
      to: '/import',
    },
    {
      source: 'サブスク登録',
      period,
      coverage: null,
      summary: `取引先 ${data.subs.vendors.length} 件を月次系列として集計。`,
      to: '/subscriptions',
    },
    {
      source: '予算設定',
      period,
      coverage: null,
      summary: `予算を設定した科目 ${Object.keys(budgetsInEffect(data)).length} 件。`,
      to: '/budget',
    },
  ];
}

/**
 * 画面 1 枚ぶん。既存 diagnosis() の返却をそのまま含め、追加分を足す。
 *
 * detectors を差し替えられるようにしてあるのは、検知器を 1 件足した状態を
 * テストから確かめるため (レジストリ本体を書き換えずに済ませる)。
 */
export function diagnosisScreen(
  data: Dataset,
  query: { scope?: string | null; metric?: string | null; compare?: string | null } = {},
  detectors?: readonly DiagnosisDetector[],
  // 総収支画面と同じ月次系列。渡さない呼び出しは条件の帯の合計を持たない (scopeTotals=null)
  cashflow?: {
    series: readonly TotalCashflowSeriesRow[];
    baselineSeries: readonly TotalCashflowSeriesRow[] | null;
    range: PeriodRange | null;
  },
): DiagnosisScreen {
  const base = diagnosis(data);
  const selection = resolveDiagnosisSelection(query);
  const improvements = detectImprovements(data, detectors, selection);
  const scopeTotals = cashflow
    ? diagnosisScopeTotals(cashflow.series, cashflow.baselineSeries, selection, cashflow.range)
    : null;
  const annualBaseline = cashflow?.series.length
    ? Math.round(((scopeTotals?.current ?? 0) / cashflow.series.length) * 12)
    : selection.metric === 'expense'
      ? Math.round(base.kpi.totalRecent * 12)
      : diagnosisAnnualBaseline(data, selection);
  return {
    ...base,
    selection,
    scopeTotals,
    improvements,
    health: diagnosisHealth(data),
    waterfall: diagnosisWaterfall(improvements, annualBaseline, selection.metric),
    signals: diagnosisSignals(base, improvements),
    evidence: diagnosisEvidence(data),
    totals: diagnosisTotals(improvements),
  };
}

/** D1 が持つ 1 件の判断 */
export interface DiagnosisActionState {
  status: DiagnosisActionStatus;
  note: string | null;
  decided_at: string | null;
}

/** D1 から読んだ判断を改善余地へ重ねる。行が無ければ 未着手 のまま */
export function applyDiagnosisStatuses(
  improvements: readonly DiagnosisImprovement[],
  states: ReadonlyMap<string, DiagnosisActionState>,
): DiagnosisImprovement[] {
  return improvements.map((row) => {
    const saved = states.get(row.action_key);
    return saved ? { ...row, ...saved } : row;
  });
}
