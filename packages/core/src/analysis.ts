/**
 * 集計・統計・診断。HTML版の計算仕様（spec §8、変更禁止16項目）を移植。
 * 年次比較はHTML版の '2025'/'2026' 固定を「前年/当年（データ最終月の年）」に一般化した。
 */
import { mean, median, movingAvg, std, sum, yearOf } from './stats.js';
import type { CatProfile, Dataset } from './types.js';

export function catSeries(data: Dataset, c: string): number[] {
  return data.biz.expense[c] || data.months.map(() => 0);
}

export function bizExpTotal(data: Dataset, i: number): number {
  return sum(data.biz.categories.map((c) => catSeries(data, c)[i] || 0));
}

export function recordedExpIdx(data: Dataset): number[] {
  const un = new Set(data.unrecordedExpMonths);
  return data.months.map((_, i) => i).filter((i) => !un.has(data.months[i]));
}

export function revenueIdx(data: Dataset): number[] {
  return data.months.map((_, i) => i).filter((i) => data.biz.revenue[i] > 0);
}

/** 科目別統計プロファイル（未記帳月除外）。CV<0.6 固定費 / <1.5 準変動 / それ以上 スポット */
export function catProfile(data: Dataset, c: string): CatProfile {
  const s = catSeries(data, c);
  const idx = recordedExpIdx(data);
  const vals = idx.map((i) => s[i]);
  const m = mean(vals);
  const sd = std(vals);
  const cv = m > 0 ? sd / m : 0;
  const med = median(vals);
  const recent = vals.slice(-3);
  const prior = vals.slice(0, -3);
  const rAvg = mean(recent);
  const pAvg = mean(prior);
  const slope = pAvg > 0 ? rAvg / pAvg - 1 : rAvg > 0 ? 1 : 0;
  const lastVal = vals[vals.length - 1];
  const z = sd > 0 ? (lastVal - m) / sd : 0;
  const type = cv < 0.6 ? '固定費' : cv < 1.5 ? '準変動' : 'スポット';
  return { mean: m, sd, cv, med, rAvg, pAvg, slope, z, lastVal, type, total: sum(vals) };
}

/** 当年（データ最終月の年）と前年 */
export function yearPair(data: Dataset): { curr: string; prev: string } {
  const curr = data.months.length
    ? yearOf(data.months[data.months.length - 1])
    : String(new Date().getFullYear());
  return { curr, prev: String(Number(curr) - 1) };
}

/* ======================== P1 概況 ======================== */

export interface OverviewData {
  months: string[];
  revenue: number[];
  expenseTotal: number[];
  profit: (number | null)[];
  expenseMovingAvg: (number | null)[];
  cashOverride: Dataset['cashOverride'];
  unrecordedExpMonths: string[];
  kpi: {
    avgRevenue: number;
    revenueMonths: number;
    avgExpense: number;
    lastExpense: number;
    expenseMom: number;
    prevYearExpense: number;
    currYearAnnualized: number;
    prevYearRevenue: number;
    prevYearProfit: number;
    prevYearExpenseRatio: number;
  };
  /** 比率は1=100%の小数。deltaは負値・1超を許容する増減率。 */
  yearTable: { account: string; prevActual: number; currAnnualized: number; delta: number }[];
  yearTotals: { prevActual: number; currAnnualized: number; delta: number };
  /** 累積構成比。0..1。 */
  pareto: { account: string; total: number; cumShare: number }[];
  top2Share: number;
  years: { curr: string; prev: string };
}

export function overview(data: Dataset): OverviewData {
  const M = data.months;
  const rev = data.biz.revenue;
  const expT = M.map((_, i) => bizExpTotal(data, i));
  const profit = M.map((_, i) => (rev[i] > 0 ? rev[i] - expT[i] : null));
  const rIdx = revenueIdx(data);
  const eIdx = recordedExpIdx(data);
  const un = new Set(data.unrecordedExpMonths);
  const { curr, prev } = yearPair(data);
  const avgRev = mean(rIdx.map((i) => rev[i]));
  const avgExp = mean(eIdx.map((i) => expT[i]));
  const last = eIdx[eIdx.length - 1];
  const prevI = eIdx[eIdx.length - 2];
  const expMom = prevI !== undefined && expT[prevI] > 0 ? expT[last] / expT[prevI] - 1 : 0;
  const yPrevE = sum(M.map((m, i) => (yearOf(m) === prev ? expT[i] : 0)));
  const yCurrIdx = M.map((_, i) => i).filter((i) => yearOf(M[i]) === curr && !un.has(M[i]));
  const yCurrE = sum(yCurrIdx.map((i) => expT[i]));
  const yCurrAnn = yCurrIdx.length ? (yCurrE / yCurrIdx.length) * 12 : 0;
  const yPrevRev = sum(M.map((m, i) => (yearOf(m) === prev ? rev[i] : 0)));

  const maNullable = movingAvg(
    expT.map((v, i) => (un.has(M[i]) ? Number.NaN : v)),
    3,
  ).map((v) => (v === null || Number.isNaN(v) ? null : v));

  const yearTable = data.biz.categories
    .map((c) => {
      const s = catSeries(data, c);
      const prevActual = sum(M.map((m, i) => (yearOf(m) === prev ? s[i] : 0)));
      const a = sum(yCurrIdx.map((i) => s[i]));
      const currAnnualized = yCurrIdx.length ? (a / yCurrIdx.length) * 12 : 0;
      const delta = prevActual > 0 ? currAnnualized / prevActual - 1 : currAnnualized > 0 ? 1 : 0;
      return { account: c, prevActual, currAnnualized, delta };
    })
    .filter((r) => r.prevActual > 0 || r.currAnnualized > 0)
    .sort((a, b) => b.currAnnualized - a.currAnnualized);

  const totals = data.biz.categories
    .map((c) => ({ account: c, total: sum(catSeries(data, c)) }))
    .sort((a, b) => b.total - a.total);
  const grand = sum(totals.map((x) => x.total));
  let cum = 0;
  const pareto = totals.map((x) => {
    cum += x.total;
    return { ...x, cumShare: grand > 0 ? cum / grand : 0 };
  });

  return {
    months: M,
    revenue: rev,
    expenseTotal: expT,
    profit,
    expenseMovingAvg: maNullable,
    cashOverride: data.cashOverride,
    unrecordedExpMonths: data.unrecordedExpMonths,
    kpi: {
      avgRevenue: avgRev,
      revenueMonths: rIdx.length,
      avgExpense: avgExp,
      lastExpense: expT[last] ?? 0,
      expenseMom: expMom,
      prevYearExpense: yPrevE,
      currYearAnnualized: yCurrAnn,
      prevYearRevenue: yPrevRev,
      prevYearProfit: yPrevRev - yPrevE,
      prevYearExpenseRatio: yPrevRev > 0 ? yPrevE / yPrevRev : 0,
    },
    yearTable,
    yearTotals: {
      prevActual: yPrevE,
      currAnnualized: yCurrAnn,
      delta: yPrevE > 0 ? yCurrAnn / yPrevE - 1 : yCurrAnn > 0 ? 1 : 0,
    },
    pareto,
    top2Share: grand > 0 ? ((totals[0]?.total ?? 0) + (totals[1]?.total ?? 0)) / grand : 0,
    years: { curr, prev },
  };
}

/* ======================== P2 増減マトリクス ======================== */

export interface MatrixRow {
  label: string;
  isTotal: boolean;
  series: number[];
  yearTotals: { year: string; total: number }[];
  yoy: number;
}

export interface MatrixData {
  months: string[];
  unrecordedExpMonths: string[];
  years: string[];
  rows: MatrixRow[];
}

export function matrix(data: Dataset): MatrixData {
  const M = data.months;
  const un = new Set(data.unrecordedExpMonths);
  const years = [...new Set(M.map(yearOf))];
  const { curr } = yearPair(data);
  const rowFn = (label: string, series: number[], isTotal: boolean): MatrixRow => {
    const yearTotals = years.map((y) => ({
      year: y,
      total: sum(M.map((m, i) => (yearOf(m) === y && !un.has(m) ? series[i] : 0))),
    }));
    const currMonths = M.filter((m) => yearOf(m) === curr && !un.has(m)).length;
    const currTotal = yearTotals.find((t) => t.year === curr)?.total ?? 0;
    const prevTotal = yearTotals.find((t) => t.year === String(Number(curr) - 1))?.total ?? 0;
    const ann = currMonths > 0 ? (currTotal / currMonths) * 12 : 0;
    const yoy = prevTotal > 0 ? ann / prevTotal - 1 : ann > 0 ? 1 : 0;
    return { label, isTotal, series, yearTotals, yoy };
  };
  const rows = data.biz.categories.map((c) => rowFn(c, catSeries(data, c), false));
  rows.push(
    rowFn(
      '経費計',
      M.map((_, i) => bizExpTotal(data, i)),
      true,
    ),
  );
  rows.push(rowFn('売上（記帳）', data.biz.revenue, true));
  return { months: M, unrecordedExpMonths: data.unrecordedExpMonths, years, rows };
}

/* ======================== P3 統計診断 ======================== */

export interface DiagnosisEntry {
  account: string;
  profile: CatProfile;
  range: { lo: number; hi: number };
  judge: '要確認' | 'やや高い' | '低め' | '通常レンジ';
  signals: ('上昇' | '低下' | '契約見直し対象')[];
}

export interface DiagnosisData {
  entries: DiagnosisEntry[];
  kpi: {
    expenseMean: number;
    expenseMedian: number;
    expenseCv: number;
    expenseSd: number;
    months: number;
    fixedCost: number;
    totalRecent: number;
    avgRevenue: number;
    expenseRatio: number;
  };
  bep: { breakEven: number; avgRevenue: number; revenueMonths: number; safetyMargin: number };
  autoDiagnosis: {
    kind: 'cut' | 'watch' | 'invest' | 'fix';
    tag: string;
    title: string;
    body: string;
    value: string;
  }[];
}

export function diagnosis(data: Dataset): DiagnosisData {
  const cats = data.biz.categories.filter((c) => sum(catSeries(data, c)) > 0);
  const profiles = cats.map((c) => ({ c, p: catProfile(data, c) }));
  const eIdx = recordedExpIdx(data);
  const expT = eIdx.map((i) => bizExpTotal(data, i));
  const rIdx = revenueIdx(data);
  const avgRev = mean(rIdx.map((i) => data.biz.revenue[i]));
  const fixedCost = sum(profiles.filter(({ p }) => p.type === '固定費').map(({ p }) => p.rAvg));
  const totalRecent = sum(profiles.map(({ p }) => p.rAvg));

  const entries: DiagnosisEntry[] = profiles
    .sort((a, b) => b.p.rAvg - a.p.rAvg)
    .map(({ c, p }) => {
      const signals: DiagnosisEntry['signals'] = [];
      if (p.slope > 0.3 && p.rAvg > 10000) signals.push('上昇');
      if (p.slope < -0.3 && p.pAvg > 10000) signals.push('低下');
      if (p.type === '固定費' && p.rAvg > 30000) signals.push('契約見直し対象');
      const judge = p.z >= 2 ? '要確認' : p.z >= 1 ? 'やや高い' : p.z <= -1 ? '低め' : '通常レンジ';
      return {
        account: c,
        profile: p,
        range: { lo: Math.max(0, p.mean - p.sd), hi: p.mean + p.sd },
        judge,
        signals,
      };
    });

  const grandTotal = sum(data.biz.categories.map((c) => sum(catSeries(data, c))));
  const autoDiagnosis: DiagnosisData['autoDiagnosis'] = [];
  for (const { c, p } of profiles) {
    if (c === 'サブスク・通信') {
      const share = grandTotal > 0 ? (sum(catSeries(data, c)) / grandTotal) * 100 : 0;
      autoDiagnosis.push({
        kind: 'cut',
        tag: '削減',
        title: `${c}：全経費の${share.toFixed(0)}%を占める最大コスト`,
        body: `月平均${Math.round(p.mean / 10000)}万→直近${Math.round(p.rAvg / 10000)}万。固定費性が強いため「使用頻度の棚卸し→重複解約→年払い化」の順で削減。重複検知はサブスク分析ページを参照。`,
        value: '目安 ▲3〜5万円/月',
      });
    } else if (p.slope > 0.5 && p.rAvg > 10000) {
      autoDiagnosis.push({
        kind: 'watch',
        tag: '監視',
        title: `${c}：直近3ヶ月で${(p.slope * 100).toFixed(1)}%の増加`,
        body: `${Math.round(p.pAvg / 10000)}万→${Math.round(p.rAvg / 10000)}万へ上昇中。意図的な投資なら問題なし。無自覚な増加なら早期に上限を設定。`,
        value: `直近 ¥${Math.round(p.rAvg).toLocaleString()}/月`,
      });
    } else if (c === '研修費') {
      autoDiagnosis.push({
        kind: 'invest',
        tag: '投資',
        title: '研修費：削減ではなくROIで判断する科目',
        body: `累計${Math.round(p.total / 10000)}万。スキル投資は売上単価に直結するため一律削減は不適。「受講→3ヶ月以内に案件・単価へ反映できたか」を振り返る運用に。`,
        value: `累計 ¥${Math.round(p.total).toLocaleString()}`,
      });
    }
  }
  const zeroRevMonths = data.months.filter((_, i) => data.biz.revenue[i] === 0);
  if (zeroRevMonths.length > 0) {
    autoDiagnosis.push({
      kind: 'fix',
      tag: '構造',
      title: '売上の記帳漏れが統計を歪めている',
      body: `売上0記帳の月が${zeroRevMonths.length}ヶ月あります（${zeroRevMonths.slice(0, 6).join(', ')}${zeroRevMonths.length > 6 ? ' ほか' : ''}）。入金実態があるなら、まず記帳を締めないと「売上トレンド」「経費率」の統計が機能しません。`,
      value: 'freee月次締め',
    });
  }

  return {
    entries,
    kpi: {
      expenseMean: mean(expT),
      expenseMedian: median(expT),
      expenseCv: mean(expT) > 0 ? std(expT) / mean(expT) : 0,
      expenseSd: std(expT),
      months: expT.length,
      fixedCost,
      totalRecent,
      avgRevenue: avgRev,
      expenseRatio: avgRev > 0 ? totalRecent / avgRev : 0,
    },
    bep: {
      breakEven: fixedCost,
      avgRevenue: avgRev,
      revenueMonths: rIdx.length,
      safetyMargin: avgRev > 0 ? (avgRev - fixedCost) / avgRev : 0,
    },
    autoDiagnosis,
  };
}

/* ======================== P4 サブスク ======================== */

export interface SubsAlert {
  month: string;
  vendor: string;
  value: number;
  median: number;
  type: 'dup' | 'spike';
}

export interface SubscriptionsData {
  months: string[];
  vendors: string[];
  matrix: Record<string, number[]>;
  other: number[];
  /** deltaは1=100%の小数。負値・1超を許容する増減率。 */
  vendorTable: { vendor: string; prevActual: number; currAnnualized: number; delta: number }[];
  alerts: SubsAlert[];
  years: { curr: string; prev: string };
}

/** 重複疑い=中央値の1.8倍超かつ2万円超かつ中央値5千円超 / 急増=3倍超かつ1.5万円超 */
export function subscriptions(data: Dataset): SubscriptionsData {
  const M = data.months;
  const V = data.subs.vendors;
  const un = new Set(data.unrecordedExpMonths);
  const { curr, prev } = yearPair(data);
  const yPrevI = M.map((_, i) => i).filter((i) => yearOf(M[i]) === prev);
  const yCurrI = M.map((_, i) => i).filter((i) => yearOf(M[i]) === curr && !un.has(M[i]));
  const vendorTable = V.map((vd) => {
    const s = data.subs.matrix[vd];
    const prevActual = sum(yPrevI.map((i) => s[i]));
    const a = sum(yCurrI.map((i) => s[i]));
    const currAnnualized = yCurrI.length ? (a / yCurrI.length) * 12 : 0;
    return {
      vendor: vd,
      prevActual,
      currAnnualized,
      delta: prevActual > 0 ? currAnnualized / prevActual - 1 : currAnnualized > 0 ? 1 : 0,
    };
  }).sort((a, b) => b.currAnnualized - a.currAnnualized);

  const alerts: SubsAlert[] = [];
  V.forEach((vd) => {
    const s = data.subs.matrix[vd];
    const nz = s.filter((x) => x > 0);
    if (!nz.length) return;
    const med = median(nz);
    s.forEach((v, i) => {
      if (v >= med * 1.8 && v > 20000 && med > 5000)
        alerts.push({ month: M[i], vendor: vd, value: v, median: med, type: 'dup' });
      else if (v >= med * 3 && v > 15000)
        alerts.push({ month: M[i], vendor: vd, value: v, median: med, type: 'spike' });
    });
  });
  return {
    months: M,
    vendors: V,
    matrix: data.subs.matrix,
    other: data.subs.other,
    vendorTable,
    alerts,
    years: { curr, prev },
  };
}

/* ======================== P6 家計 ======================== */

export interface HouseholdData {
  months: string[];
  personal: Dataset['personal'];
  bizPersonal: Dataset['bizPersonal'];
  /** 説明可能率 = (支出合計 − 未分類 − 明細不明のカード引落) ÷ 支出合計（最新月・個人分） */
  explainability: { month: string; rate: number; unexplained: number; total: number } | null;
}

export function household(data: Dataset): HouseholdData {
  const months = Object.keys(data.personal).sort();
  let explainability: HouseholdData['explainability'] = null;
  if (months.length) {
    const m = months[months.length - 1];
    const exp = data.personal[m].expense;
    const total = sum(Object.values(exp));
    const unexplained = (exp['未分類'] || 0) + (exp['現金・カード'] || 0);
    explainability = { month: m, rate: total > 0 ? (total - unexplained) / total : 1, unexplained, total };
  }
  return { months, personal: data.personal, bizPersonal: data.bizPersonal, explainability };
}

/* ======================== P7 予算 ======================== */

/** 推奨予算: 固定費=直近3ヶ月平均×95% / その他=全期間平均。千円丸め */
export function suggestBudgets(data: Dataset): Record<string, number> {
  const out: Record<string, number> = {};
  data.biz.categories
    .filter((c) => sum(catSeries(data, c)) > 0)
    .forEach((c) => {
      const p = catProfile(data, c);
      out[c] = Math.round((p.type === '固定費' ? p.rAvg * 0.95 : p.mean) / 1000) * 1000;
    });
  return out;
}

export interface BudgetRow {
  account: string;
  type: CatProfile['type'];
  recentAvg: number;
  budget: number | null;
  diff: number | null;
  judge: '超過' | '範囲内' | '余裕' | null;
}

/** 判定: 実績が予算の±10%を超えれば超過/余裕。境界値は範囲内。 */
export function budgetTable(data: Dataset): BudgetRow[] {
  return data.biz.categories
    .filter((c) => sum(catSeries(data, c)) > 0)
    .map((c) => {
      const p = catProfile(data, c);
      const b = data.budgets[c];
      const diff = b != null ? p.rAvg - b : null;
      const judge = diff === null ? null : p.rAvg > b * 1.1 ? '超過' : p.rAvg < b * 0.9 ? '余裕' : '範囲内';
      return { account: c, type: p.type, recentAvg: p.rAvg, budget: b ?? null, diff, judge };
    });
}

/* ======================== FR-08 防衛ライン ======================== */

export interface DefenseLine {
  /** 防衛ライン = 個人生活費の直近3ヶ月平均 + 事業固定費（CV<0.6科目）の直近3ヶ月平均 */
  line: number;
  personalAvg: number;
  bizFixedAvg: number;
  /** 当月（データ最新月）の収入見込み = 給与 + 事業入金実績 */
  month: string | null;
  incomeEstimate: number;
  salary: number;
  bizIncome: number;
  diff: number;
  status: 'ok' | 'tight' | 'danger' | 'nodata';
}

export function defenseLine(data: Dataset): DefenseLine {
  const pMonths = Object.keys(data.personal).sort();
  const recent = pMonths.slice(-3);
  const personalAvg = recent.length
    ? mean(recent.map((m) => sum(Object.values(data.personal[m].expense))))
    : 0;
  const profiles = data.biz.categories
    .filter((c) => sum(catSeries(data, c)) > 0)
    .map((c) => catProfile(data, c));
  const bizFixedAvg = sum(profiles.filter((p) => p.type === '固定費').map((p) => p.rAvg));
  const line = personalAvg + bizFixedAvg;
  const month = pMonths.length ? pMonths[pMonths.length - 1] : null;
  const salary = month ? data.personal[month].income['給与'] || 0 : 0;
  const bizIncome = month ? data.bizPersonal[month]?.income || 0 : 0;
  const incomeEstimate = salary + bizIncome;
  const diff = incomeEstimate - line;
  const status: DefenseLine['status'] = !month
    ? 'nodata'
    : incomeEstimate >= line * 1.1
      ? 'ok'
      : incomeEstimate >= line
        ? 'tight'
        : 'danger';
  return { line, personalAvg, bizFixedAvg, month, incomeEstimate, salary, bizIncome, diff, status };
}

/* ======================== FR-09 やりくり試算 ======================== */

export interface TradeoffCandidate {
  id: string;
  kind: 'subs_dup' | 'subs_spike' | 'budget_over' | 'above_range' | 'unexplained';
  label: string;
  detail: string;
  /** 月あたりの捻出期待額 */
  amount: number;
}

/**
 * 削減余地リスト（効果額降順）。
 * 未分類・説明不能支出の削減期待値は精査で3割解消できる想定（可逆な運用仮説）。
 */
export function tradeoffCandidates(data: Dataset): TradeoffCandidate[] {
  const out: TradeoffCandidate[] = [];
  const subs = subscriptions(data);
  const latestByVendor = new Map<string, SubsAlert>();
  subs.alerts.forEach((a) => {
    const prev = latestByVendor.get(a.vendor);
    if (!prev || a.month > prev.month) latestByVendor.set(a.vendor, a);
  });
  latestByVendor.forEach((a) => {
    const excess = Math.round(a.value - a.median);
    out.push({
      id: `subs:${a.vendor}`,
      kind: a.type === 'dup' ? 'subs_dup' : 'subs_spike',
      label: `${a.vendor} の${a.type === 'dup' ? '重複契約疑い' : '急増'}を解消`,
      detail: `${a.month} に ¥${a.value.toLocaleString()}（通常月中央値 ¥${Math.round(a.median).toLocaleString()}）`,
      amount: excess,
    });
  });
  budgetTable(data).forEach((r) => {
    if (r.judge === '超過' && r.diff != null) {
      out.push({
        id: `budget:${r.account}`,
        kind: 'budget_over',
        label: `${r.account} を予算内に戻す`,
        detail: `直近3ヶ月平均 ¥${Math.round(r.recentAvg).toLocaleString()} が予算 ¥${(r.budget ?? 0).toLocaleString()} を超過`,
        amount: Math.round(r.diff),
      });
    }
  });
  diagnosis(data).entries.forEach((e) => {
    if ((e.judge === '要確認' || e.judge === 'やや高い') && data.budgets[e.account] == null) {
      const excess = Math.round(e.profile.lastVal - e.profile.mean);
      if (excess > 0) {
        out.push({
          id: `range:${e.account}`,
          kind: 'above_range',
          label: `${e.account} を基準レンジへ戻す`,
          detail: `直近 ¥${Math.round(e.profile.lastVal).toLocaleString()} が基準レンジ上限 ¥${Math.round(e.range.hi).toLocaleString()} 超え`,
          amount: excess,
        });
      }
    }
  });
  const hh = household(data);
  if (hh.explainability && hh.explainability.unexplained > 0) {
    out.push({
      id: 'unexplained',
      kind: 'unexplained',
      label: '未分類・明細不明支出の精査',
      detail: `${hh.explainability.month} の未分類＋カード引落 ¥${hh.explainability.unexplained.toLocaleString()}（精査で3割解消想定）`,
      amount: Math.round(hh.explainability.unexplained * 0.3),
    });
  }
  return out.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
}
