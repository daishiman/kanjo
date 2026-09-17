/**
 * 推移画面 (07-trends) の比較・要因分析。
 *
 * 数値の出所は総収支と同じ `totalCashflowLedger` の行集合に限る。MF の Dataset から
 * 別に数え直すと、消し込み・要確認・除外が推移だけに反映されず、2 画面の合計が食い違う。
 *
 * 指標は `METRIC_DEFINITIONS` の登録表で引く。1 件足せば系列・一覧・要因の全部に現れ、
 * 指標ごとの分岐は書かない。規則の正本は `specs/spec-trends-screen.md` と `docs/trends-screen.md`。
 */
import { previousPeriod, previousPeriodLabel } from './analysis-hub.js';
import { type PeriodRange, applyPeriod, fullRange, isMonthKey, previousYearPeriod } from './period.js';
import {
  type DuplicateVerdict,
  type FreeeExclusion,
  type TotalCashflowLedger,
  type TrendSourceRow,
  totalCashflowLedger,
} from './total-cashflow.js';
import type { ExpenseScope } from './trend.js';
import type { Dataset, FreeeDeal } from './types.js';

/* ======================== 登録表 ======================== */

export type TrendScope = 'total' | 'business' | 'household';
export type TrendCompare = 'previous' | 'yoy';
export type TrendSide = TrendSourceRow['side'];
export type TrendOrigin = 'mf' | 'freee' | 'mixed';
export type TrendMetricVisualRole = 'income' | 'expense' | 'net' | 'neutral';

export interface MetricDefinition {
  id: string;
  label: string;
  /** 増えると良いか減ると良いか。色と矢印の向きはここだけで決める */
  betterWhen: 'higher' | 'lower';
  /** 主図の系列色。label から意味を逆算しない */
  visualRole: TrendMetricVisualRole;
  /** 指標コントロールの並び。登録配列順と表示順の責務を分ける */
  controlOrder: number;
  /** 常時概要系列として主図に出す。false でも選択中は必ず出す */
  showInOverview: boolean;
  /** 1 行がこの指標に足す値。0 の行は内訳に出さない */
  valueOf: (row: TrendSourceRow) => number;
  breakdownAxis: 'category';
}

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: 'income',
    label: '収入',
    betterWhen: 'higher',
    visualRole: 'income',
    controlOrder: 1,
    showInOverview: true,
    valueOf: (row) => (row.io === 'income' ? row.amount : 0),
    breakdownAxis: 'category',
  },
  {
    id: 'expense',
    label: '支出',
    betterWhen: 'lower',
    visualRole: 'expense',
    controlOrder: 0,
    showInOverview: true,
    valueOf: (row) => (row.io === 'expense' ? row.amount : 0),
    breakdownAxis: 'category',
  },
  {
    id: 'net',
    label: '純収支',
    betterWhen: 'higher',
    visualRole: 'net',
    controlOrder: 2,
    showInOverview: true,
    valueOf: (row) => (row.io === 'income' ? row.amount : -row.amount),
    breakdownAxis: 'category',
  },
];

export const DEFAULT_TREND_METRIC = 'expense';

/**
 * 指標を id で引く。省略時は支出。未登録は null。
 * 配列の find で引くので、`constructor` のような任意のキーを評価しない。
 */
export function findMetric(
  id: string | null | undefined,
  definitions: readonly MetricDefinition[] = METRIC_DEFINITIONS,
): MetricDefinition | null {
  const key = id == null || id === '' ? DEFAULT_TREND_METRIC : id;
  return definitions.find((d) => d.id === key) ?? null;
}

/** 未登録の指標。API はこれを 400 invalid_metric へ変える */
export class UnknownTrendMetricError extends Error {
  constructor(readonly metric: string) {
    super('未登録の指標です');
    this.name = 'UnknownTrendMetricError';
  }
}

const SCOPE_ALIASES: Record<string, TrendScope> = {
  total: 'total',
  business: 'business',
  household: 'household',
  all: 'total',
  biz: 'business',
  personal: 'household',
};

/** scope は新旧どちらの名前も受ける。未知の値は総合へ倒す */
export function normalizeTrendScope(value: unknown): TrendScope {
  return typeof value === 'string' && Object.hasOwn(SCOPE_ALIASES, value) ? SCOPE_ALIASES[value] : 'total';
}

export function normalizeTrendCompare(value: unknown): TrendCompare {
  return value === 'yoy' ? 'yoy' : 'previous';
}

/** 既存の傾向判定 (trendsReport) が使う旧名 */
export const LEGACY_SCOPE: Record<TrendScope, ExpenseScope> = {
  total: 'all',
  business: 'biz',
  household: 'personal',
};

/* ======================== 型 ======================== */

export interface TrendsScreenInput {
  /** 期間で切る前の Dataset。比較期間も同じ all から切る */
  all: Dataset;
  deals: readonly FreeeDeal[];
  verdicts: readonly DuplicateVerdict[];
  exclusions: readonly FreeeExclusion[];
  mfExcludedTxIds: readonly string[];
  /** null は全期間 */
  range: PeriodRange | null;
}

export interface TrendsScreenRequest {
  scope?: string | null;
  metric?: string | null;
  compare?: string | null;
  month?: string | null;
  /** scope=total で同名カテゴリを識別する。省略した旧 URL も引き続き受ける */
  side?: string | null;
  category?: string | null;
  payee?: string | null;
}

export interface TrendsSelection {
  scope: TrendScope;
  metric: string;
  compare: TrendCompare;
  month: string | null;
  /** 解決済みカテゴリの区分。未選択なら null */
  side: TrendSide | null;
  category: string | null;
  payee: string | null;
}

export interface TrendComparePeriod extends PeriodRange {
  label: string;
}

export interface TrendMetricSeries {
  current: number[];
  /** 同じ位置の比較月の値。比較月にデータが無ければ null。比較期間が無ければ全体が null */
  compare: (number | null)[] | null;
}

export interface TrendSeries {
  months: string[];
  compareMonths: string[] | null;
  values: Record<string, TrendMetricSeries>;
  /** 選んだ指標の月次差。比較期間があれば同じ位置の比較月との差、無ければ前月差 */
  diff: (number | null)[];
}

export interface TrendKpis {
  current: number;
  change: { amount: number | null; rate: number | null; basis: 'compare_period' | 'peak_month_mom' };
  peakMonth: { month: string; diff: number | null; reason: string | null } | null;
}

export interface TrendDriver {
  category: string;
  side: TrendSide;
  change: number;
  payee: string;
  origin: TrendOrigin;
  text: string;
}

export interface TrendSourceSummary {
  origin: 'mf' | 'freee';
  account: string | null;
  count: number;
}

export interface TrendDetail {
  month: string;
  values: Record<string, { current: number; compare: number | null }>;
  drivers: TrendDriver[];
  sources: TrendSourceSummary[];
}

interface TrendRowColumns {
  side: TrendSide;
  origin: TrendOrigin;
  spark: (number | null)[];
  sparkMonths: string[];
  current: number;
  compare: number | null;
  change: number | null;
  changeRate: number | null;
  share: number;
  contribution: number | null;
}

export interface TrendPayeeRow extends TrendRowColumns {
  payee: string;
}

export interface TrendCategoryRow extends TrendRowColumns {
  name: string;
  payees: TrendPayeeRow[];
}

export interface ChangeParetoRow {
  name: string;
  side: TrendSide;
  change: number;
  cumulativeShare: number;
}

export interface TrendReviewSummary {
  count: number;
  amount: number;
  monthCount: number;
  monthAmount: number;
}

export interface TrendFocus {
  month: string | null;
  category: string;
  payee: string | null;
  change: number | null;
  changeRate: number | null;
  origin: TrendOrigin;
  side: TrendSide;
  /** 明細を開く先。MF は公私仕分け、freee だけの行は総収支 */
  href: string;
}

export interface TrendsScreen {
  metrics: Array<
    Pick<MetricDefinition, 'id' | 'label' | 'betterWhen' | 'visualRole' | 'controlOrder' | 'showInOverview'>
  >;
  selection: TrendsSelection;
  comparePeriod: TrendComparePeriod | null;
  compareUnavailable: 'all_period' | 'no_data' | null;
  series: TrendSeries;
  kpis: TrendKpis;
  detail: TrendDetail | null;
  sparkMonths: string[];
  categories: TrendCategoryRow[];
  changePareto: ChangeParetoRow[];
  topMovers: TrendCategoryRow[];
  review: TrendReviewSummary;
  /** 選択月の最大要因から導く初期アクション。利用者が選んだ focus と混ぜない */
  recommended: TrendFocus | null;
  /** 利用者がカテゴリ/取引先を明示選択したときだけ持つ */
  focus: TrendFocus | null;
}

/* ======================== 月の計算 ======================== */

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthKey = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const shiftMonth = (m: string, n: number): string => monthKey(monthIndex(m) - n);

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const yen = (n: number): string => `¥${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const inScope = (scope: TrendScope) => (row: TrendSourceRow) =>
  scope === 'total' || (scope === 'business' ? row.side === 'business' : row.side === 'household');

/**
 * 期間の台帳。切り方は totalCashflowScreen と同じにする (全期間はデータの全範囲、
 * freee は切った Dataset にある月だけ)。切り方が違うと、同じ期間でも総収支と合計がずれる。
 */
function ledgerFor(input: TrendsScreenInput, range: PeriodRange | null): TotalCashflowLedger {
  const r = range ?? fullRange(input.all);
  if (!r) return totalCashflowLedger(input.all, [], [], [], []).ledger;
  const data = applyPeriod(input.all, r);
  const months = new Set(data.months);
  const deals = input.deals.filter((d) => months.has(d.month));
  return totalCashflowLedger(data, deals, input.verdicts, input.exclusions, input.mfExcludedTxIds).ledger;
}

const originOf = (rows: readonly TrendSourceRow[]): TrendOrigin => {
  const set = new Set(rows.map((r) => r.origin));
  return set.size === 1 ? [...set][0] : 'mixed';
};

/* ======================== 本体 ======================== */

export function trendsScreen(
  input: TrendsScreenInput,
  request: TrendsScreenRequest = {},
  definitions: readonly MetricDefinition[] = METRIC_DEFINITIONS,
): TrendsScreen {
  const metric = findMetric(request.metric, definitions);
  if (!metric) throw new UnknownTrendMetricError(String(request.metric));
  const scope = normalizeTrendScope(request.scope);
  const compare = normalizeTrendCompare(request.compare);
  const { range } = input;

  const current = ledgerFor(input, range);
  const months = current.months;
  const scoped = inScope(scope);
  const curRows = current.rows.filter(scoped);

  // 比較期間: 全期間では作らない。比較先の台帳に月が無ければ作らない
  let comparePeriod: TrendComparePeriod | null = null;
  let compareUnavailable: TrendsScreen['compareUnavailable'] = null;
  let cmpRows: TrendSourceRow[] = [];
  let cmpMonthSet = new Set<string>();
  let offset = 0;
  if (!range) {
    compareUnavailable = 'all_period';
  } else {
    const r = compare === 'yoy' ? previousYearPeriod(range) : previousPeriod(range);
    const cmp = ledgerFor(input, r);
    if (cmp.months.length) {
      comparePeriod = { ...r, label: compare === 'yoy' ? '前年同期' : previousPeriodLabel(range) };
      cmpRows = cmp.rows.filter(scoped);
      cmpMonthSet = new Set(cmp.months);
      offset = monthIndex(range.from) - monthIndex(r.from);
    } else {
      compareUnavailable = 'no_data';
    }
  }
  const hasCompare = comparePeriod !== null;
  const compareMonths = hasCompare ? months.map((m) => shiftMonth(m, offset)) : null;
  const curMonthSet = new Set(months);

  // 月 × 指標の合計
  const values: Record<string, TrendMetricSeries> = {};
  for (const def of definitions) {
    const cur = totalsByMonth(curRows, def);
    const cmp = totalsByMonth(cmpRows, def);
    values[def.id] = {
      current: months.map((m) => cur.get(m) ?? 0),
      compare: compareMonths
        ? compareMonths.map((m) => (cmpMonthSet.has(m) ? (cmp.get(m) ?? 0) : null))
        : null,
    };
  }
  const selected = values[metric.id];
  const diff: (number | null)[] = selected.current.map((v, i) => {
    if (selected.compare) {
      const compared = selected.compare[i];
      return compared === null ? null : v - compared;
    }
    return i === 0 ? null : v - selected.current[i - 1];
  });

  // 最も変化が大きい月。同値は新しい月、全月 0 なら最新月
  let peakIndex = -1;
  let peakAbs = -1;
  diff.forEach((d, i) => {
    if (d === null) return;
    const abs = Math.abs(d);
    if (abs >= peakAbs) {
      peakAbs = abs;
      peakIndex = i;
    }
  });

  const requested = request.month;
  const monthIdx =
    isMonthKey(requested) && curMonthSet.has(requested) ? months.indexOf(requested) : peakIndex;
  const selectedMonth = monthIdx >= 0 ? months[monthIdx] : null;

  // 選んだ月と比べる相手の月の行
  const baseOf = (i: number): { rows: TrendSourceRow[]; month: string } | null => {
    if (compareMonths) {
      const month = compareMonths[i];
      return cmpMonthSet.has(month) ? { rows: cmpRows, month } : null;
    }
    return i > 0 ? { rows: curRows, month: months[i - 1] } : null;
  };
  const driversAt = (i: number): TrendDriver[] =>
    i < 0 ? [] : drivers(metric, curRows, months[i], baseOf(i));

  const peakDrivers = driversAt(peakIndex);
  const currentTotal = sum(selected.current);
  const completeCompare = selected.compare?.every((v) => v !== null) === true;
  const compareTotal = completeCompare ? sum(selected.compare as number[]) : null;

  let change: TrendKpis['change'];
  if (!range) {
    const prev = peakIndex > 0 ? selected.current[peakIndex - 1] : null;
    const amount = peakIndex > 0 ? diff[peakIndex] : null;
    change = {
      amount,
      rate: amount === null || prev === null || prev === 0 ? null : amount / Math.abs(prev),
      basis: 'peak_month_mom',
    };
  } else if (compareTotal === null) {
    change = { amount: null, rate: null, basis: 'compare_period' };
  } else {
    const amount = currentTotal - compareTotal;
    change = {
      amount,
      rate: compareTotal === 0 ? null : amount / Math.abs(compareTotal),
      basis: 'compare_period',
    };
  }

  const kpis: TrendKpis = {
    current: currentTotal,
    change,
    peakMonth:
      peakIndex >= 0
        ? { month: months[peakIndex], diff: diff[peakIndex], reason: peakDrivers[0]?.text ?? null }
        : null,
  };

  const detail: TrendDetail | null =
    monthIdx < 0
      ? null
      : {
          month: months[monthIdx],
          values: Object.fromEntries(
            definitions.map((def) => [
              def.id,
              {
                current: values[def.id].current[monthIdx],
                compare: values[def.id].compare?.[monthIdx] ?? null,
              },
            ]),
          ),
          drivers: monthIdx === peakIndex ? peakDrivers : driversAt(monthIdx),
          sources: sourcesOf(curRows.filter((r) => r.month === months[monthIdx])),
        };

  // スパークラインは今回期間の末月から遡る 12 枠
  const lastMonth = range ? range.to : months.at(-1);
  const sparkMonths = lastMonth ? Array.from({ length: 12 }, (_, k) => shiftMonth(lastMonth, 11 - k)) : [];

  const categories = categoryRows({
    metric,
    curRows,
    cmpRows,
    hasCompare: completeCompare,
    sparkMonths,
    curMonthSet,
    currentTotal,
    totalChange: completeCompare ? change.amount : null,
  });

  const changePareto: ChangeParetoRow[] = [];
  if (completeCompare) {
    const moved = categories.filter((c) => c.change !== null && c.change !== 0);
    moved.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));
    const whole = sum(moved.map((c) => Math.abs(c.change ?? 0)));
    let running = 0;
    for (const c of moved) {
      running += Math.abs(c.change ?? 0);
      changePareto.push({
        name: c.name,
        side: c.side,
        change: c.change ?? 0,
        cumulativeShare: running / whole,
      });
    }
  }
  const topMovers = changePareto
    .slice(0, 3)
    .map((p) => categories.find((c) => c.name === p.name && c.side === p.side))
    .filter((c): c is TrendCategoryRow => c != null);

  const sumAbs = (xs: readonly { a: number }[]) => sum(xs.map((tx) => Math.abs(tx.a)));
  const reviewInMonth = current.review.filter((tx) => tx.m === selectedMonth);
  const review: TrendReviewSummary = {
    count: current.review.length,
    amount: sumAbs(current.review),
    monthCount: reviewInMonth.length,
    monthAmount: sumAbs(reviewInMonth),
  };

  // 選択は取得後の行との完全一致だけで決める
  const requestedSide: TrendSide | null =
    request.side === 'business' || request.side === 'household' ? request.side : null;
  const cat = request.category
    ? categories.find(
        (c) => c.name === request.category && (requestedSide === null || c.side === requestedSide),
      )
    : undefined;
  const pay = cat && request.payee ? cat.payees.find((p) => p.payee === request.payee) : undefined;
  const selection: TrendsSelection = {
    scope,
    metric: metric.id,
    compare,
    month: selectedMonth,
    side: cat?.side ?? null,
    category: cat?.name ?? null,
    payee: pay?.payee ?? null,
  };

  const recommendedDriver = detail?.drivers[0] ?? null;
  const recommended: TrendFocus | null = recommendedDriver
    ? {
        month: selectedMonth,
        category: recommendedDriver.category,
        payee: recommendedDriver.payee || null,
        change: recommendedDriver.change,
        changeRate: null,
        origin: recommendedDriver.origin,
        side: recommendedDriver.side,
        href: trendDrilldownHref({
          month: selectedMonth,
          category: recommendedDriver.category,
          payee: recommendedDriver.payee || null,
          origin: recommendedDriver.origin,
          side: recommendedDriver.side,
        }),
      }
    : null;

  let focus: TrendFocus | null = null;
  if (cat) {
    const row = pay ?? cat;
    const selectedDriver = detail?.drivers.find(
      (driver) =>
        driver.category === cat.name && driver.side === cat.side && (!pay || driver.payee === pay.payee),
    );
    // 月を付けるのは、金額もその月の要因額に揃えられるときだけ。
    // 月と期間合計が同じ導線に混ざると、遷移先で金額を再現できない。
    const focusMonth = selectedDriver ? selectedMonth : null;
    const focusOrigin = selectedDriver?.origin ?? row.origin;
    focus = {
      month: focusMonth,
      category: cat.name,
      payee: pay?.payee ?? null,
      change: selectedDriver?.change ?? row.change,
      changeRate: selectedDriver ? null : row.changeRate,
      origin: focusOrigin,
      side: row.side,
      href: trendDrilldownHref({
        month: focusMonth,
        category: cat.name,
        payee: pay?.payee ?? null,
        origin: focusOrigin,
        side: row.side,
      }),
    };
  }

  return {
    metrics: definitions.map(({ id, label, betterWhen, visualRole, controlOrder, showInOverview }) => ({
      id,
      label,
      betterWhen,
      visualRole,
      controlOrder,
      showInOverview,
    })),
    selection,
    comparePeriod,
    compareUnavailable,
    series: { months, compareMonths, values, diff },
    kpis,
    detail,
    sparkMonths,
    categories,
    changePareto,
    topMovers,
    review,
    recommended,
    focus,
  };
}

/**
 * 明細を開く先。freee だけの行は MF の仕分け画面に出ないので総収支へ送る。
 * MF を含む行は公私仕分けを月・区分・大項目・内容で絞って開く。
 */
export function trendDrilldownHref(target: {
  month: string | null;
  category: string;
  payee: string | null;
  origin: TrendOrigin;
  side: TrendSide;
}): string {
  if (target.origin === 'freee') {
    const q = new URLSearchParams();
    if (target.month) q.set('month', target.month);
    return `/analysis/total-cashflow${q.size ? `?${q.toString()}` : ''}`;
  }
  const q = new URLSearchParams();
  if (target.month) q.set('month', target.month);
  q.set('cls', target.side === 'business' ? 'biz' : 'per');
  q.set('category', target.category);
  if (target.payee) q.set('payee', target.payee);
  return `/classify?${q.toString()}`;
}

/* ======================== 要因・出典・カテゴリ ======================== */

const keyOf = (row: TrendSourceRow): string => `${row.side}\u0000${row.category}`;

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function drivers(
  metric: MetricDefinition,
  curRows: readonly TrendSourceRow[],
  month: string,
  base: { rows: TrendSourceRow[]; month: string } | null,
): TrendDriver[] {
  if (!base) return [];
  const counted = (row: TrendSourceRow) => metric.valueOf(row) !== 0;
  const cur = groupBy(
    curRows.filter((r) => r.month === month && counted(r)),
    keyOf,
  );
  const prev = groupBy(
    base.rows.filter((r) => r.month === base.month && counted(r)),
    keyOf,
  );
  const total = (rows: readonly TrendSourceRow[] = []) => sum(rows.map(metric.valueOf));

  const out: TrendDriver[] = [];
  for (const key of new Set([...cur.keys(), ...prev.keys()])) {
    const now = cur.get(key) ?? [];
    const before = prev.get(key) ?? [];
    const change = total(now) - total(before);
    if (change === 0) continue;

    // 取引先ごとの差が最も大きいものを代表にする
    const nowBy = groupBy(now, (r) => r.payee);
    const beforeBy = groupBy(before, (r) => r.payee);
    let payee = '';
    let payeeAbs = -1;
    for (const p of new Set([...nowBy.keys(), ...beforeBy.keys()])) {
      const d = Math.abs(total(nowBy.get(p)) - total(beforeBy.get(p)));
      if (d > payeeAbs) {
        payeeAbs = d;
        payee = p;
      }
    }
    const shown = now.length ? now : before;
    const kinds = new Set(shown.map((r) => r.payee)).size;
    const sample = (now[0] ?? before[0]) as TrendSourceRow;
    out.push({
      category: sample.category,
      side: sample.side,
      change,
      payee,
      origin: originOf([...(nowBy.get(payee) ?? []), ...(beforeBy.get(payee) ?? [])]),
      text: `${sample.category}が${payee}${kinds > 1 ? 'など' : ''}${shown.length}件で${yen(change)}${change > 0 ? '増' : '減'}`,
    });
  }
  out.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return out.slice(0, 3);
}

function sourcesOf(rows: readonly TrendSourceRow[]): TrendSourceSummary[] {
  const grouped = groupBy(
    rows,
    (r) => `${r.origin}\u0000${r.account ?? ''}\u0000${r.account === null ? 1 : 0}`,
  );
  const out = [...grouped.values()].map((list) => ({
    origin: list[0].origin,
    account: list[0].account,
    count: list.length,
  }));
  // 口座の分かる行を件数順に並べ、口座が空の行は最後に置く
  return out.sort(
    (a, b) =>
      Number(a.account === null) - Number(b.account === null) ||
      b.count - a.count ||
      a.origin.localeCompare(b.origin) ||
      (a.account ?? '').localeCompare(b.account ?? ''),
  );
}

function categoryRows(args: {
  metric: MetricDefinition;
  curRows: readonly TrendSourceRow[];
  cmpRows: readonly TrendSourceRow[];
  hasCompare: boolean;
  sparkMonths: readonly string[];
  curMonthSet: ReadonlySet<string>;
  currentTotal: number;
  totalChange: number | null;
}): TrendCategoryRow[] {
  const { metric, hasCompare, sparkMonths, curMonthSet, currentTotal, totalChange } = args;
  const counted = (row: TrendSourceRow) => metric.valueOf(row) !== 0;
  const cur = args.curRows.filter(counted);
  const cmp = args.cmpRows.filter(counted);

  const columns = (now: readonly TrendSourceRow[], before: readonly TrendSourceRow[]) => {
    const current = sum(now.map(metric.valueOf));
    const compare = hasCompare ? sum(before.map(metric.valueOf)) : null;
    const change = compare === null ? null : current - compare;
    const byMonth = totalsByMonth(now, metric);
    return {
      origin: originOf([...now, ...before]),
      spark: sparkMonths.map((m) => (curMonthSet.has(m) ? (byMonth.get(m) ?? 0) : null)),
      sparkMonths: [...sparkMonths],
      current,
      compare,
      change,
      changeRate: change === null || !compare ? null : change / Math.abs(compare),
      share: currentTotal === 0 ? 0 : current / currentTotal,
      contribution: change === null || !totalChange ? null : change / totalChange,
    };
  };
  const bySize = (a: { current: number }, b: { current: number }) =>
    Math.abs(b.current) - Math.abs(a.current);

  const curBy = groupBy(cur, keyOf);
  const cmpBy = groupBy(cmp, keyOf);
  const rows: TrendCategoryRow[] = [];
  for (const key of new Set([...curBy.keys(), ...cmpBy.keys()])) {
    const now = curBy.get(key) ?? [];
    const before = cmpBy.get(key) ?? [];
    const head = (now[0] ?? before[0]) as TrendSourceRow;
    const col = columns(now, before);
    if (col.current === 0 && (col.compare ?? 0) === 0) continue;

    const nowBy = groupBy(now, (r) => r.payee);
    const beforeBy = groupBy(before, (r) => r.payee);
    const payees: TrendPayeeRow[] = [];
    for (const p of new Set([...nowBy.keys(), ...beforeBy.keys()])) {
      const pc = columns(nowBy.get(p) ?? [], beforeBy.get(p) ?? []);
      if (pc.current === 0 && (pc.compare ?? 0) === 0) continue;
      payees.push({ payee: p, side: head.side, ...pc });
    }
    payees.sort((a, b) => bySize(a, b) || a.payee.localeCompare(b.payee));
    rows.push({ name: head.category, side: head.side, ...col, payees });
  }
  return rows.sort((a, b) => bySize(a, b) || a.name.localeCompare(b.name));
}

function totalsByMonth(rows: readonly TrendSourceRow[], metric: MetricDefinition): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) out.set(row.month, (out.get(row.month) ?? 0) + metric.valueOf(row));
  return out;
}
