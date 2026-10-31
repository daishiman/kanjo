/**
 * 予算画面 (spec-budget-screen) の算出。
 *
 * 画面の数値 (自動提案・見通し・KPI・月次グラフ・過不足・インパクト) はすべてここで出す。
 * api は `budgetScreen` の結果を返すだけ、web は入力が変わるたびに `applyBudgetInputs` を呼ぶだけで、
 * どちらも計算を書き直さない (計算の場所は 1 か所)。
 *
 * 現在時刻と乱数は読まない。「今月」は api が `Dataset.budgetAsOf` に入れた値を使う (BR-23)。
 */
import { defenseLine } from './analysis.js';
import { monthIndex, monthKey } from './month.js';
import type { PeriodRange } from './period.js';
import type { Dataset } from './types.js';

export type BudgetKind = 'income' | 'expense';

/** budget_plans の 1 行 (予算対象の期間ごとの年額) */
export interface BudgetPlanRow {
  /** 'YYYY-MM' */
  periodStart: string;
  account: string;
  kind: BudgetKind;
  annualAmount: number;
  planAdjustment: number;
  planReason: string | null;
  /** RFC3339 */
  updatedAt: string;
}

export interface BudgetInput {
  /** null = 未設定 */
  annualAmount: number | null;
  planAdjustment: number;
  planReason: string | null;
}

export interface BudgetBaseRow {
  account: string;
  kind: BudgetKind;
  manualOnly: boolean;
  order: number;
  prevActual: number;
  growthRate: number;
  seasonal: number;
  /** 12 個 (暦月 1〜12) */
  monthDeviation: number[];
  /** 12 個 (予算対象の各月) */
  targetActuals: (number | null)[];
  recentMonthly: { month: string; amount: number }[];
  saved: BudgetInput | null;
}

export interface BudgetScreenBase {
  empty: boolean;
  actualRange: { from: string; to: string; months: number } | null;
  start: string | null;
  targetMonths: string[];
  startOptions: string[];
  source: 'saved' | 'legacy' | 'none';
  savedAt: string | null;
  defenseLine: { monthly: number; annual: number };
  seasonalEnabled: boolean;
  rows: BudgetBaseRow[];
}

export interface BudgetFigureRow {
  account: string;
  suggestion: number;
  suggestionBasis: {
    prevActual: number;
    growthRate: number;
    seasonal: number;
    planAdjustment: number;
    unrounded: number;
  };
  planAdjustment: number;
  /** 来期予算 (入力)。未設定は null */
  budget: number | null;
  /** 差額 = 来期予算 − 前期実績 (BR-13) */
  diff: number | null;
  forecastAnnual: number;
  forecastMonthly: { month: string; amount: number; actual: boolean }[];
  /** 過不足 = 見通し − 来期予算 (BR-14)。収入の行と未設定の行は null */
  gap: number | null;
  factor: string;
  basisText: string;
  evidence: string[];
}

export interface BudgetGapRow {
  account: string;
  forecast: number;
  gap: number;
  factor: string;
}

export interface BudgetMonthlyFigure {
  month: string;
  incomeActual: number | null;
  incomeBudget: number;
  expenseActual: number | null;
  expenseBudget: number;
  forecastNet: number;
  actual: boolean;
}

export interface BudgetFigures {
  rows: BudgetFigureRow[];
  kpi: { incomeBudget: number; expenseBudget: number; net: number; defenseMargin: number };
  monthly: BudgetMonthlyFigure[];
  boundary: { lastActualMonth: string | null; actualLabel: string | null; forecastLabel: string | null };
  outlook: { income: number; expense: number; net: number; comment: string };
  gaps: {
    increase: { count: number; rows: BudgetGapRow[] };
    decrease: { count: number; rows: BudgetGapRow[] };
  };
  impact: { expenseDiff: number; net: number; drivers: string[]; text: string };
}

export type BudgetScreen = BudgetScreenBase & { figures: BudgetFigures };

/* ============================ 定数 ============================ */

export const BUDGET_REVENUE_ACCOUNT = '売上高';
export const BUDGET_OTHER_INCOME_ACCOUNT = 'その他収入';
/** 収入の行 (BR-01)。この 2 科目だけが income で、それ以外はすべて expense (BR-17) */
export const BUDGET_INCOME_ACCOUNTS: readonly string[] = [
  BUDGET_REVENUE_ACCOUNT,
  BUDGET_OTHER_INCOME_ACCOUNT,
];

/** BR-06・BR-17 の上限 */
export const BUDGET_AMOUNT_LIMIT = 10_000_000_000;
export const BUDGET_ACCOUNT_MAX = 60;
export const BUDGET_REASON_MAX = 100;
export const BUDGET_ROWS_MAX = 200;
export const BUDGET_START_MIN = '2000-01';
export const BUDGET_START_MAX = '2100-12';

/** 増減率の上限 (BR-03) */
const GROWTH_CLAMP = 0.3;
/** 増減率・季節性に要る月数 (BR-03・BR-04) */
const TREND_MONTHS = 24;
/** 過不足カテゴリの各タブに出す件数 (§7.8) */
const GAP_TOP = 5;

export const budgetKindOf = (account: string): BudgetKind =>
  BUDGET_INCOME_ACCOUNTS.includes(account) ? 'income' : 'expense';

/* ============================ 書式・丸め ============================ */

/** 0.5 を絶対値の大きい方へ丸める。符号で結果が変わらないようにするため (BR-05) */
const roundHalfAway = (x: number): number => (x < 0 ? -Math.round(-x) : Math.round(x));

/** 千円単位の四捨五入 (BR-05) */
export const thousandRound = (x: number): number => roundHalfAway(x / 1000) * 1000;

const MINUS = '−';
const digits = (n: number): string => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** +¥1,000 / −¥1,000 / ±¥0 */
export const budgetSignedYen = (n: number): string =>
  n > 0 ? `+¥${digits(n)}` : n < 0 ? `${MINUS}¥${digits(n)}` : '±¥0';
/** +1,000円 / −1,000円 / ±0円 */
const signedEn = (n: number): string =>
  n > 0 ? `+${digits(n)}円` : n < 0 ? `${MINUS}${digits(n)}円` : '±0円';
/** 小数第 1 位までの百分率。+2.8% / −1.0% / ±0.0% */
export const budgetSignedPct = (rate: number): string => {
  const tenth = roundHalfAway(rate * 1000);
  const body = `${Math.floor(Math.abs(tenth) / 10)}.${Math.abs(tenth) % 10}%`;
  return tenth > 0 ? `+${body}` : tenth < 0 ? `${MINUS}${body}` : `±${body}`;
};

/** 2026-09 → 2026年9月 */
const ymLabel = (m: string): string => `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`;
const rangeLabel = (from: string, to: string): string => `${ymLabel(from)} - ${ymLabel(to)}`;
const addMonths = (m: string, n: number): string => monthKey(monthIndex(m) + n);
/** 暦月 1〜12 */
const calendarMonth = (m: string): number => Number(m.slice(5, 7));

/* ============================ 読み出し関数 (BR-22・BR-23) ============================ */

/**
 * `month` を含む予算対象の月額 (科目 → 年額 ÷ 12)。
 * 該当する期間が無ければ既存の `budgets` (月額) をそのまま返す (BR-22)。
 */
export function monthlyBudgetsAt(data: Dataset, month: string): Record<string, number> {
  const target = monthIndex(month);
  let best: string | null = null;
  for (const p of data.budgetPlans ?? []) {
    const s = monthIndex(p.periodStart);
    if (s <= target && target < s + 12 && (best == null || p.periodStart > best)) best = p.periodStart;
  }
  if (best == null) return { ...data.budgets };
  const out: Record<string, number> = {};
  for (const p of data.budgetPlans ?? []) {
    if (p.periodStart === best) out[p.account] = roundHalfAway(p.annualAmount / 12);
  }
  return out;
}

/**
 * 既存の読み手 (予算表・着地見込み・診断) が読む月額 (BR-23)。
 * 基準月は api が入れた今月 (日本時間)。無ければ最終実績月の翌月。
 */
export function budgetsInEffect(data: Dataset): Record<string, number> {
  const last = data.months.length ? data.months[data.months.length - 1] : null;
  const asOf = data.budgetAsOf ?? (last ? addMonths(last, 1) : null);
  return asOf ? monthlyBudgetsAt(data, asOf) : { ...data.budgets };
}

/** 実績期間の終了月の翌月 */
export function defaultBudgetStart(range: PeriodRange | null): string | null {
  return range ? addMonths(range.to, 1) : null;
}

/** start から 12 か月 */
export const budgetTargetMonths = (start: string): string[] =>
  Array.from({ length: 12 }, (_, i) => addMonths(start, i));

/* ============================ 基礎値 ============================ */

/** 科目の月次実績を全実績の月順で返す */
function seriesOf(all: Dataset, account: string): number[] {
  if (account === BUDGET_REVENUE_ACCOUNT) return all.months.map((_, i) => all.biz.revenue[i] ?? 0);
  if (account === BUDGET_OTHER_INCOME_ACCOUNT) return all.months.map(() => 0);
  const s = all.biz.expense[account] ?? [];
  return all.months.map((_, i) => s[i] ?? 0);
}

interface Trend {
  growthRate: number;
  deviation: number[];
  enabled: boolean;
}

/** 増減率 (BR-03) と暦月の偏り (BR-04)。終了月以前の月だけを使う */
function trendOf(months: string[], series: number[], end: string): Trend {
  const upto = months.map((m, i) => ({ m, v: series[i] ?? 0 })).filter((x) => x.m <= end);
  const zero = Array.from({ length: 12 }, () => 0);
  if (upto.length < TREND_MONTHS) return { growthRate: 0, deviation: zero, enabled: false };
  const last24 = upto.slice(-TREND_MONTHS);
  const p = last24.slice(0, 12).reduce((a, x) => a + x.v, 0);
  const r = last24.slice(12).reduce((a, x) => a + x.v, 0);
  const raw = p === 0 ? 0 : r / p - 1;
  const growthRate = Math.max(-GROWTH_CLAMP, Math.min(GROWTH_CLAMP, raw));
  const mean = last24.reduce((a, x) => a + x.v, 0) / last24.length;
  const deviation = zero.map((_, c) => {
    const hit = last24.filter((x) => calendarMonth(x.m) === c + 1);
    return hit.length ? hit.reduce((a, x) => a + x.v, 0) / hit.length - mean : 0;
  });
  return { growthRate, deviation, enabled: true };
}

/**
 * 予算画面の一式。`data` は実績期間に適用後、`all` は全実績、`plans` は予算対象の保存済みの行。
 * 既存 budgets の初期値は `all.budgets` から読む (BR-08)。
 */
export function budgetScreen(args: {
  data: Dataset;
  all: Dataset;
  range: PeriodRange | null;
  start: string | null;
  plans: BudgetPlanRow[];
}): BudgetScreen {
  const base = budgetScreenBase(args);
  const inputs: Record<string, BudgetInput> = {};
  for (const r of base.rows) if (r.saved) inputs[r.account] = r.saved;
  return { ...base, figures: applyBudgetInputs(base, inputs) };
}

function budgetScreenBase({
  data,
  all,
  range,
  start: requested,
  plans,
}: {
  data: Dataset;
  all: Dataset;
  range: PeriodRange | null;
  start: string | null;
  plans: BudgetPlanRow[];
}): BudgetScreenBase {
  const line = defenseLine(data).line;
  const defense = { monthly: line, annual: roundHalfAway(line * 12) };
  const effective =
    range ?? (all.months.length ? { from: all.months[0], to: all.months[all.months.length - 1] } : null);
  const fallbackStart = defaultBudgetStart(effective);
  const start = requested ?? fallbackStart;
  const targetMonths = start ? budgetTargetMonths(start) : [];
  const startOptions = optionsOf(all, fallbackStart, start);

  const hasPlans = plans.length > 0;
  const savedAt = hasPlans
    ? plans.reduce((a, p) => (p.updatedAt > a ? p.updatedAt : a), plans[0].updatedAt)
    : null;
  const legacy = Object.keys(all.budgets).length > 0;
  const source: BudgetScreenBase['source'] = hasPlans ? 'saved' : legacy ? 'legacy' : 'none';

  if (data.months.length === 0 || !start) {
    return {
      empty: true,
      actualRange: null,
      start,
      targetMonths,
      startOptions,
      source,
      savedAt,
      defenseLine: defense,
      seasonalEnabled: false,
      rows: [],
    };
  }

  const from = data.months[0];
  const to = data.months[data.months.length - 1];
  const n = data.months.length;
  const actualMonths = new Set(all.months);
  const allIndex = new Map(all.months.map((m, i) => [m, i]));
  const accounts = [
    ...BUDGET_INCOME_ACCOUNTS,
    ...data.biz.categories.filter((c) => !BUDGET_INCOME_ACCOUNTS.includes(c)),
  ];
  const savedOf = (account: string): BudgetInput | null => {
    if (hasPlans) {
      const p = plans.find((x) => x.account === account);
      return p
        ? { annualAmount: p.annualAmount, planAdjustment: p.planAdjustment, planReason: p.planReason }
        : null;
    }
    const monthly = all.budgets[account];
    return monthly == null
      ? null
      : { annualAmount: roundHalfAway(monthly * 12), planAdjustment: 0, planReason: null };
  };

  let seasonalEnabled = false;
  const rows: BudgetBaseRow[] = accounts.map((account) => {
    const kind = budgetKindOf(account);
    const manualOnly = account === BUDGET_OTHER_INCOME_ACCOUNT;
    const series = seriesOf(all, account);
    const prevSum = data.months.reduce((a, m) => a + (series[allIndex.get(m) ?? -1] ?? 0), 0);
    const prevActual = manualOnly ? 0 : roundHalfAway((prevSum * 12) / n);
    const trend = manualOnly ? trendOf([], [], to) : trendOf(all.months, series, to);
    if (trend.enabled) seasonalEnabled = true;
    const dev = (m: string) => trend.deviation[calendarMonth(m) - 1];
    const seasonal = trend.enabled
      ? roundHalfAway(
          targetMonths.reduce((a, m) => a + dev(m), 0) -
            (12 / n) * data.months.reduce((a, m) => a + dev(m), 0),
        )
      : 0;
    const targetActuals = targetMonths.map((m) =>
      actualMonths.has(m) ? (series[allIndex.get(m) ?? -1] ?? 0) : null,
    );
    const recentMonthly = manualOnly
      ? []
      : all.months
          .map((m, i) => ({ month: m, amount: series[i] ?? 0 }))
          .filter((x) => x.month <= to)
          .slice(-TREND_MONTHS);
    return {
      account,
      kind,
      manualOnly,
      order: 0,
      prevActual,
      growthRate: trend.growthRate,
      seasonal,
      monthDeviation: trend.deviation,
      targetActuals,
      recentMonthly,
      saved: savedOf(account),
    };
  });

  const income = rows.filter((r) => r.kind === 'income');
  const expense = rows
    .filter((r) => r.kind === 'expense')
    .sort((a, b) => b.prevActual - a.prevActual || cmp(a.account, b.account));
  const ordered = [...income, ...expense].map((r, i) => ({ ...r, order: i + 1 }));

  return {
    empty: false,
    actualRange: { from, to, months: n },
    start,
    targetMonths,
    startOptions,
    source,
    savedAt,
    defenseLine: defense,
    seasonalEnabled,
    rows: ordered,
  };
}

/** 科目名の昇順。実行環境の照合順序に依らないよう符号位置で比べる */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 全実績の最初の月から、既定の開始月の 12 か月後まで。新しい順 (§7.2) */
function optionsOf(all: Dataset, fallback: string | null, start: string | null): string[] {
  if (!fallback || all.months.length === 0) return start ? [start] : [];
  const first = monthIndex(all.months[0]);
  const last = monthIndex(fallback) + 12;
  const out: string[] = [];
  for (let i = last; i >= first; i--) out.push(monthKey(i));
  if (start && !out.includes(start)) {
    out.push(start);
    out.sort((a, b) => cmp(b, a));
  }
  return out;
}

/* ============================ 入力からの組み立て ============================ */

/** 自動提案 (BR-05) */
export function suggestAmount(
  row: BudgetBaseRow,
  planAdjustment: number,
): { value: number; unrounded: number } {
  const unrounded = row.prevActual * (1 + row.growthRate) + row.seasonal + planAdjustment;
  return { value: thousandRound(unrounded), unrounded };
}

/** 年額を 12 か月に割る。1〜11 か月目は 0 方向への切り捨て、12 か月目に端数を寄せる (BR-11) */
export function splitAnnual(annual: number): number[] {
  const first = Math.trunc(annual / 12);
  return [...Array.from({ length: 11 }, () => first), annual - 11 * first];
}

function basisTextOf(
  row: BudgetBaseRow,
  suggestion: number,
  adj: number,
  reason: string | null,
  seasonalEnabled: boolean,
): string {
  const parts: string[] = [];
  if (row.prevActual === 0) {
    parts.push('前期実績が無いため、計画による調整だけから見込みました。');
  } else {
    const rate = suggestion / row.prevActual - 1;
    parts.push(
      `前期実績と過去12か月の増減率（${budgetSignedPct(row.growthRate)}）をもとに、来期は${budgetSignedPct(rate)}の${rate < 0 ? '減少' : '増加'}を見込みました。`,
    );
  }
  if (!seasonalEnabled) parts.push('実績が24か月に満たないため、増減率と季節性補正は0として計算しました。');
  if (row.seasonal !== 0) parts.push(`季節性補正 ${budgetSignedYen(row.seasonal)} を加えています。`);
  if (adj !== 0)
    parts.push(
      `計画による調整 ${budgetSignedYen(adj)} を反映しています${reason ? `（理由: ${reason}）` : ''}。`,
    );
  return parts.join('');
}

function evidenceOf(base: BudgetScreenBase, reason: string | null): string[] {
  const out = ['過去12か月の月次実績の推移'];
  if (base.actualRange)
    out.push(
      `前期実績（${rangeLabel(base.actualRange.from, base.actualRange.to)}の${base.actualRange.months}か月）`,
    );
  if (base.seasonalEnabled) out.push('直近24か月の月別の偏り（季節性）');
  if (reason) out.push(`計画による調整: ${reason}`);
  return out;
}

function factorOf(row: BudgetBaseRow, reason: string | null): string {
  if (reason) return reason;
  const growth = Math.abs(row.prevActual * row.growthRate);
  const seasonal = Math.abs(row.seasonal);
  if (growth === 0 && seasonal === 0) return '来期予算が自動提案と異なる';
  return growth >= seasonal ? `過去12か月の増減率 ${budgetSignedPct(row.growthRate)}` : '季節性の偏り';
}

const byGap = (a: BudgetGapRow, b: BudgetGapRow): number =>
  Math.abs(b.gap) - Math.abs(a.gap) || cmp(a.account, b.account);

/**
 * 入力 (来期予算・調整額・理由) から画面の数値一式を組む。
 * `inputs` に無い行は未設定・調整 0 として扱う。
 */
export function applyBudgetInputs(
  base: BudgetScreenBase,
  inputs: Record<string, BudgetInput>,
): BudgetFigures {
  const rows: BudgetFigureRow[] = base.rows.map((row) => {
    const input = inputs[row.account];
    const adj = input?.planAdjustment ?? 0;
    const reason = input?.planReason ? input.planReason : null;
    const budget = input?.annualAmount ?? null;
    const { value: suggestion, unrounded } = suggestAmount(row, adj);
    const forecastMonthly = base.targetMonths.map((month, i) => {
      const actual = row.targetActuals[i];
      return actual != null
        ? { month, amount: actual, actual: true }
        : {
            month,
            amount: roundHalfAway(suggestion / 12 + row.monthDeviation[calendarMonth(month) - 1]),
            actual: false,
          };
    });
    const forecastAnnual = forecastMonthly.reduce((a, x) => a + x.amount, 0);
    return {
      account: row.account,
      suggestion,
      suggestionBasis: {
        prevActual: row.prevActual,
        growthRate: row.growthRate,
        seasonal: row.seasonal,
        planAdjustment: adj,
        unrounded,
      },
      planAdjustment: adj,
      budget,
      diff: budget == null ? null : budget - row.prevActual,
      forecastAnnual,
      forecastMonthly,
      gap: row.kind === 'expense' && budget != null ? forecastAnnual - budget : null,
      factor: factorOf(row, reason),
      basisText: basisTextOf(row, suggestion, adj, reason, base.seasonalEnabled),
      evidence: evidenceOf(base, reason),
    };
  });

  const kindOf = new Map(base.rows.map((r) => [r.account, r.kind]));
  const isIncome = (account: string) => kindOf.get(account) === 'income';
  const incomeBudget = rows.filter((r) => isIncome(r.account)).reduce((a, r) => a + (r.budget ?? 0), 0);
  const expenseBudget = rows.filter((r) => !isIncome(r.account)).reduce((a, r) => a + (r.budget ?? 0), 0);
  const net = incomeBudget - expenseBudget;
  const kpi = { incomeBudget, expenseBudget, net, defenseMargin: incomeBudget - base.defenseLine.annual };

  const splits = new Map(rows.map((r) => [r.account, splitAnnual(r.budget ?? 0)]));
  const monthly: BudgetMonthlyFigure[] = base.targetMonths.map((month, i) => {
    let incomeActual: number | null = null;
    let expenseActual: number | null = null;
    let incomeB = 0;
    let expenseB = 0;
    let forecastNet = 0;
    base.rows.forEach((row, k) => {
      const actual = row.targetActuals[i];
      const b = splits.get(row.account)?.[i] ?? 0;
      const f = rows[k].forecastMonthly[i].amount;
      if (row.kind === 'income') {
        incomeB += b;
        forecastNet += f;
        if (actual != null && row.account === BUDGET_REVENUE_ACCOUNT)
          incomeActual = (incomeActual ?? 0) + actual;
      } else {
        expenseB += b;
        forecastNet -= f;
        if (actual != null) expenseActual = (expenseActual ?? 0) + actual;
      }
    });
    const actual = base.rows.some((r) => r.targetActuals[i] != null);
    return {
      month,
      incomeActual: actual ? (incomeActual ?? 0) : null,
      incomeBudget: incomeB,
      expenseActual: actual ? (expenseActual ?? 0) : null,
      expenseBudget: expenseB,
      forecastNet,
      actual,
    };
  });

  const t = base.targetMonths;
  let lastIdx = -1;
  monthly.forEach((m, i) => {
    if (m.actual) lastIdx = i;
  });
  const boundary =
    t.length === 0
      ? { lastActualMonth: null, actualLabel: null, forecastLabel: null }
      : lastIdx < 0
        ? { lastActualMonth: null, actualLabel: null, forecastLabel: `見通し(${rangeLabel(t[0], t[11])})` }
        : lastIdx === t.length - 1
          ? {
              lastActualMonth: t[lastIdx],
              actualLabel: `実績(${rangeLabel(t[0], t[lastIdx])})`,
              forecastLabel: null,
            }
          : {
              lastActualMonth: t[lastIdx],
              actualLabel: `実績(${rangeLabel(t[0], t[lastIdx])})`,
              forecastLabel: `見通し(${rangeLabel(t[lastIdx + 1], t[11])})`,
            };

  const gapRows: BudgetGapRow[] = rows
    .filter((r) => r.gap != null && r.gap !== 0)
    .map((r) => ({ account: r.account, forecast: r.forecastAnnual, gap: r.gap as number, factor: r.factor }));
  const inc = gapRows.filter((r) => r.gap > 0).sort(byGap);
  const dec = gapRows.filter((r) => r.gap < 0).sort(byGap);
  const gaps = {
    increase: { count: inc.length, rows: inc.slice(0, GAP_TOP) },
    decrease: { count: dec.length, rows: dec.slice(0, GAP_TOP) },
  };

  const sumMonthly = (pick: (m: BudgetMonthlyFigure) => number) => monthly.reduce((a, m) => a + pick(m), 0);
  const outIncome = sumMonthly((m) => m.incomeBudget);
  const outExpense = sumMonthly((m) => m.expenseBudget);
  const outNet = outIncome - outExpense;
  const comment = `現状の予算で推移した場合、来期の純収支は ${signedEn(outNet)} の見込みです。${
    inc.length > 0
      ? '一部の費用で増加傾向があるため、右下の過不足カテゴリを参考に調整することをおすすめします。'
      : '見通しが予算を上回る費用はありません。'
  }`;

  const expenseDiff = rows
    .filter((r) => !isIncome(r.account) && r.budget != null)
    .reduce((a, r) => a + ((r.budget as number) - r.suggestion), 0);
  const drivers = inc.slice(0, 2).map((r) => r.account);
  const head =
    expenseDiff === 0
      ? `現在の入力内容は、支出の合計が自動提案と同じで、予算純収支は ${budgetSignedYen(net)} を見込んでいます。`
      : `現在の入力内容では、自動提案と比較して年間 ${budgetSignedYen(expenseDiff)} の支出${expenseDiff < 0 ? '抑制' : '増加'}となり、予算純収支は ${budgetSignedYen(net)} を見込んでいます。`;
  const tail = drivers.length === 0 ? '' : `特に ${drivers.join(' と ')} が増加要因です。`;

  return {
    rows,
    kpi,
    monthly,
    boundary,
    outlook: { income: outIncome, expense: outExpense, net: outNet, comment },
    gaps,
    impact: { expenseDiff, net, drivers, text: head + tail },
  };
}

/* ============================ 読取り API の形 ============================ */

export interface BudgetPlansView {
  start: string;
  source: 'saved' | 'legacy' | 'none';
  savedAt: string | null;
  rows: {
    account: string;
    kind: BudgetKind;
    annualAmount: number;
    planAdjustment: number;
    planReason: string | null;
    updatedAt: string | null;
  }[];
}

/**
 * `GET /api/budget-plans` の本文。保存済みの行が無ければ既存 budgets の月額 × 12 を初期値として返す (BR-08)。
 * 初期値の行は種別 expense・調整 0・理由 null・更新時刻 null で、科目名の昇順。
 */
export function budgetPlansView(
  budgets: Record<string, number>,
  start: string,
  plans: BudgetPlanRow[],
): BudgetPlansView {
  if (plans.length > 0) {
    const rows = [...plans]
      .sort((a, b) => cmp(a.account, b.account))
      .map((p) => ({
        account: p.account,
        kind: p.kind,
        annualAmount: p.annualAmount,
        planAdjustment: p.planAdjustment,
        planReason: p.planReason,
        updatedAt: p.updatedAt as string | null,
      }));
    const savedAt = plans.reduce((a, p) => (p.updatedAt > a ? p.updatedAt : a), plans[0].updatedAt);
    return { start, source: 'saved', savedAt, rows };
  }
  const accounts = Object.keys(budgets).sort(cmp);
  return {
    start,
    source: accounts.length ? 'legacy' : 'none',
    savedAt: null,
    rows: accounts.map((account) => ({
      account,
      kind: 'expense' as const,
      annualAmount: roundHalfAway(budgets[account] * 12),
      planAdjustment: 0,
      planReason: null,
      updatedAt: null,
    })),
  };
}
