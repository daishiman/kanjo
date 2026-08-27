/**
 * 集計・統計・診断。HTML版の計算仕様（spec §8、変更禁止16項目）を移植。
 * 年次比較はHTML版の '2025'/'2026' 固定を「前年/当年（データ最終月の年）」に一般化した。
 */
import { mean, median, movingAvg, std, sum, yearOf } from './stats.js';
import {
  type CatProfile,
  type Dataset,
  OWNER_VALUES,
  type OwnerKey,
  type OwnerMonth,
  isMfCountable,
} from './types.js';

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
  vendorTable: {
    vendor: string;
    prevActual: number;
    currAnnualized: number;
    delta: number;
    /** 直近の記帳月の支払額 */
    lastMonthly: number;
    /** 支払があった月だけの平均月額 */
    avgMonthly: number;
    /** 直近12ヶ月(未記帳月を除く)の実支払合計 */
    last12Total: number;
    /** 支払があった月数 */
    activeMonths: number;
  }[];
  /** いま何にいくら払っているか(直近の記帳月基準) */
  now: {
    month: string | null;
    /** 直近月のサブスク合計(その他を含む) */
    monthlyTotal: number;
    /** 直近月合計×12 */
    annualized: number;
    /** 直近12ヶ月(未記帳月を除く)の実支払合計 */
    last12Total: number;
    /** サブスク対売上比(直近3ヶ月の平均月額 ÷ 売上のある月の平均売上)。売上が無ければ null */
    revenueShare: number | null;
  };
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
  const recordedI = M.map((_, i) => i).filter((i) => !un.has(M[i]));
  const lastI = recordedI.length ? recordedI[recordedI.length - 1] : -1;
  const last12I = recordedI.slice(-12);
  const vendorTable = V.map((vd) => {
    const s = data.subs.matrix[vd];
    const prevActual = sum(yPrevI.map((i) => s[i]));
    const a = sum(yCurrI.map((i) => s[i]));
    const currAnnualized = yCurrI.length ? (a / yCurrI.length) * 12 : 0;
    const active = s.filter((x) => x > 0);
    return {
      vendor: vd,
      prevActual,
      currAnnualized,
      delta: prevActual > 0 ? currAnnualized / prevActual - 1 : currAnnualized > 0 ? 1 : 0,
      lastMonthly: lastI >= 0 ? s[lastI] : 0,
      avgMonthly: mean(active),
      last12Total: sum(last12I.map((i) => s[i])),
      activeMonths: active.length,
    };
  }).sort((a, b) => b.currAnnualized - a.currAnnualized);
  const monthTotal = (i: number) => sum(V.map((vd) => data.subs.matrix[vd][i])) + (data.subs.other[i] || 0);
  const monthlyTotal = lastI >= 0 ? monthTotal(lastI) : 0;
  const rev = revenueIdx(data).map((i) => data.biz.revenue[i]);
  const avgRev = mean(rev);
  const recent3 = recordedI.slice(-3).map(monthTotal);
  const now: SubscriptionsData['now'] = {
    month: lastI >= 0 ? M[lastI] : null,
    monthlyTotal,
    annualized: monthlyTotal * 12,
    last12Total: sum(last12I.map(monthTotal)),
    revenueShare: avgRev > 0 && recent3.length ? mean(recent3) / avgRev : null,
  };

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
    now,
    alerts,
    years: { curr, prev },
  };
}

/* ======================== P6 家計 ======================== */

/** 1ヶ月分の収支バランス。個人の財布(MF)と事業の帳簿(freee)を並べて見る */
export interface BalanceMonth {
  month: string;
  /** 個人収入(MF・仕分け「個人」の入金) */
  personalIncome: number;
  /** 事業入金(MF・仕分け「事業」の入金=事業口座からの振替・報酬など) */
  bizIncome: number;
  /** 収入計 = 個人収入 + 事業入金 */
  income: number;
  /** 生活費(MF・仕分け「個人」の支出合計) */
  livingCost: number;
  /** 事業立替(MF・仕分け「事業」の支出=個人の財布から払った事業費) */
  bizAdvance: number;
  /** 支出計 = 生活費 + 事業立替 */
  expense: number;
  /** 収支 = 収入計 − 支出計 */
  balance: number;
  /** 貯蓄率 = 収支 ÷ 収入計。収入が無ければ null */
  saveRate: number | null;
  /** 同じ月のfreee売上。freeeにその月が無ければ null */
  revenue: number | null;
  /** 同じ月のfreee事業経費。未記帳月・freeeにその月が無ければ null */
  bizExpense: number | null;
}

export interface BalanceTotals {
  months: number;
  income: number;
  livingCost: number;
  bizAdvance: number;
  expense: number;
  balance: number;
  saveRate: number | null;
  /** 月平均(取込月数で割る) */
  monthlyAvg: { income: number; livingCost: number; expense: number; balance: number };
  /** 年換算 = 月平均×12 */
  annualized: { income: number; livingCost: number; expense: number; balance: number };
}

export interface LivingCostRow {
  big: string;
  total: number;
  monthlyAvg: number;
  annualized: number;
  /** 生活費全体に占める割合(1=100%) */
  share: number;
}

export interface HouseholdData {
  months: string[];
  personal: Dataset['personal'];
  bizPersonal: Dataset['bizPersonal'];
  /** 説明可能率 = (支出合計 − 未分類 − 明細不明のカード引落) ÷ 支出合計（最新月・個人分） */
  explainability: { month: string; rate: number; unexplained: number; total: number } | null;
  /** 月別の収支バランス(取込月の昇順) */
  balance: BalanceMonth[];
  /** 全期間の合計・月平均・年換算 */
  totals: BalanceTotals;
  /** 生活費の大項目別(全期間、金額の大きい順) */
  livingCost: LivingCostRow[];
  /** 事業(freee帳簿) と 個人(MF・仕分け「個人」) を並べた比較 */
  comparison: Comparison;
  /** 個人分の名義別(事業/妻/家族/未設定)。根拠は MF の保有金融機関→名義の設定と手動編集 */
  byOwner: ByOwner;
}

/** 片側(事業 or 個人)の1ヶ月。データが無い月は null */
export interface CompareSide {
  income: number | null;
  expense: number | null;
  balance: number | null;
}
export interface CompareRow {
  month: string;
  /** 事業 = freee 売上 / 事業経費(未記帳月は経費 null) */
  biz: CompareSide;
  /** 個人 = MF 個人収入 / 生活費 */
  personal: CompareSide;
}
export interface CompareTotal {
  /** データがあった月数 */
  months: number;
  income: number;
  expense: number;
  balance: number;
  monthlyAvg: { income: number; expense: number; balance: number };
  annualized: { income: number; expense: number; balance: number };
}
export interface Comparison {
  rows: CompareRow[];
  biz: CompareTotal;
  personal: CompareTotal;
}

export interface OwnerRow {
  month: string;
  business: OwnerMonth;
  spouse: OwnerMonth;
  family: OwnerMonth;
  unset: OwnerMonth;
}
export interface OwnerTotal {
  income: number;
  expense: number;
  monthlyAvg: { income: number; expense: number };
  annualized: { income: number; expense: number };
  /** 個人収入全体に占める収入の割合(1=100%) */
  incomeShare: number;
}
export interface ByOwner {
  rows: OwnerRow[];
  totals: Record<OwnerKey, OwnerTotal>;
  /** 名義が未設定の保有金融機関（設定画面で割り当てると解消する） */
  unmappedInstitutions: string[];
  /** 保有金融機関が取り込まれていない明細数（旧取込。MFの再取込で埋まる） */
  noInstitutionCount: number;
}

export function balanceMonth(data: Dataset, m: string): BalanceMonth {
  const p = data.personal[m] ?? { income: {}, expense: {} };
  const bp = data.bizPersonal[m] ?? { income: 0, expense: 0 };
  const personalIncome = sum(Object.values(p.income));
  const livingCost = sum(Object.values(p.expense));
  const income = personalIncome + bp.income;
  const expense = livingCost + bp.expense;
  const balance = income - expense;
  const i = data.months.indexOf(m);
  const unrecorded = data.unrecordedExpMonths.includes(m);
  return {
    month: m,
    personalIncome,
    bizIncome: bp.income,
    income,
    livingCost,
    bizAdvance: bp.expense,
    expense,
    balance,
    saveRate: income > 0 ? balance / income : null,
    revenue: i >= 0 ? data.biz.revenue[i] : null,
    bizExpense: i >= 0 && !unrecorded ? bizExpTotal(data, i) : null,
  };
}

export function balanceTotals(rows: BalanceMonth[]): BalanceTotals {
  const n = rows.length;
  const income = sum(rows.map((r) => r.income));
  const livingCost = sum(rows.map((r) => r.livingCost));
  const bizAdvance = sum(rows.map((r) => r.bizAdvance));
  const expense = livingCost + bizAdvance;
  const balance = income - expense;
  const avg = (v: number) => (n ? v / n : 0);
  const monthlyAvg = {
    income: avg(income),
    livingCost: avg(livingCost),
    expense: avg(expense),
    balance: avg(balance),
  };
  return {
    months: n,
    income,
    livingCost,
    bizAdvance,
    expense,
    balance,
    saveRate: income > 0 ? balance / income : null,
    monthlyAvg,
    annualized: {
      income: monthlyAvg.income * 12,
      livingCost: monthlyAvg.livingCost * 12,
      expense: monthlyAvg.expense * 12,
      balance: monthlyAvg.balance * 12,
    },
  };
}

export function livingCostByBig(data: Dataset, months: string[]): LivingCostRow[] {
  const acc: Record<string, number> = {};
  for (const m of months) {
    for (const [big, v] of Object.entries(data.personal[m]?.expense ?? {})) acc[big] = (acc[big] || 0) + v;
  }
  const grand = sum(Object.values(acc));
  const n = months.length;
  return Object.entries(acc)
    .map(([big, total]) => ({
      big,
      total,
      monthlyAvg: n ? total / n : 0,
      annualized: n ? (total / n) * 12 : 0,
      share: grand > 0 ? total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function compareTotal(sides: CompareSide[]): CompareTotal {
  const have = sides.filter((s) => s.income !== null || s.expense !== null);
  const n = have.length;
  const income = sum(have.map((s) => s.income ?? 0));
  const expense = sum(have.map((s) => s.expense ?? 0));
  const balance = income - expense;
  const avg = (v: number) => (n ? v / n : 0);
  const monthlyAvg = { income: avg(income), expense: avg(expense), balance: avg(balance) };
  return {
    months: n,
    income,
    expense,
    balance,
    monthlyAvg,
    annualized: {
      income: monthlyAvg.income * 12,
      expense: monthlyAvg.expense * 12,
      balance: monthlyAvg.balance * 12,
    },
  };
}

/** 事業(freee) と 個人(MF) を月ごとに並べる。月は両方の和集合 */
export function comparison(data: Dataset, personalMonths: string[]): Comparison {
  const months = Array.from(new Set([...data.months, ...personalMonths])).sort();
  const rows: CompareRow[] = months.map((m) => {
    const i = data.months.indexOf(m);
    const unrecorded = data.unrecordedExpMonths.includes(m);
    const rev = i >= 0 ? data.biz.revenue[i] : null;
    const exp = i >= 0 && !unrecorded ? bizExpTotal(data, i) : null;
    const biz: CompareSide = {
      income: rev,
      expense: exp,
      balance: rev !== null && exp !== null ? rev - exp : null,
    };
    const p = data.personal[m];
    const pin = p ? sum(Object.values(p.income)) : null;
    const pex = p ? sum(Object.values(p.expense)) : null;
    const personal: CompareSide = {
      income: pin,
      expense: pex,
      balance: pin !== null && pex !== null ? pin - pex : null,
    };
    return { month: m, biz, personal };
  });
  return {
    rows,
    biz: compareTotal(rows.map((r) => r.biz)),
    personal: compareTotal(rows.map((r) => r.personal)),
  };
}

const OWNER_KEYS: OwnerKey[] = [...OWNER_VALUES, 'unset'];

/** 個人分を名義別に並べる。名義の根拠は保有金融機関→名義の設定・ルール・手動編集 */
export function byOwner(data: Dataset, months: string[]): ByOwner {
  const zero = (): OwnerMonth => ({ income: 0, expense: 0 });
  const rows: OwnerRow[] = months
    .filter((m) => data.personalByOwner[m])
    .map((m) => {
      const o = data.personalByOwner[m];
      return {
        month: m,
        business: o.business ?? zero(),
        spouse: o.spouse ?? zero(),
        family: o.family ?? zero(),
        unset: o.unset ?? zero(),
      };
    });
  const n = rows.length;
  const grandIncome = sum(
    rows.map((r) => r.business.income + r.spouse.income + r.family.income + r.unset.income),
  );
  const totals = {} as Record<OwnerKey, OwnerTotal>;
  for (const k of OWNER_KEYS) {
    const income = sum(rows.map((r) => r[k].income));
    const expense = sum(rows.map((r) => r[k].expense));
    const monthlyAvg = { income: n ? income / n : 0, expense: n ? expense / n : 0 };
    totals[k] = {
      income,
      expense,
      monthlyAvg,
      annualized: { income: monthlyAvg.income * 12, expense: monthlyAvg.expense * 12 },
      incomeShare: grandIncome > 0 ? income / grandIncome : 0,
    };
  }
  const unmapped = new Set<string>();
  let noInst = 0;
  for (const t of data.mfTx) {
    // 名義マッピングの過不足は収支集計に載る明細を基準に測る(振替・計算対象外は載らない)
    if (!isMfCountable(t)) continue;
    if (!t.inst) noInst++;
    else if (!data.institutionOwners[t.inst]) unmapped.add(t.inst);
  }
  return { rows, totals, unmappedInstitutions: Array.from(unmapped).sort(), noInstitutionCount: noInst };
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
  const balance = months.map((m) => balanceMonth(data, m));
  return {
    months,
    personal: data.personal,
    bizPersonal: data.bizPersonal,
    explainability,
    balance,
    totals: balanceTotals(balance),
    livingCost: livingCostByBig(data, months),
    comparison: comparison(data, months),
    byOwner: byOwner(data, months),
  };
}

/* ======================== 指標ガイド: ベンチマーク ======================== */

export interface Benchmark {
  id: 'expenseRatio' | 'subsShare' | 'safetyMargin' | 'saveRate' | 'foodShare' | 'telecomShare';
  label: string;
  /** 現在値(1=100%)。算出に必要なデータが無ければ null */
  value: number | null;
  /** 目安の下限・上限(1=100%)。片側だけの目安は null */
  low: number | null;
  high: number | null;
  /** 目安の読み方(画面表示用) */
  guide: string;
  /** 判定: 目安内 / 目安外 / データ不足 */
  judge: '目安内' | '目安外' | 'データ不足';
  /** 何をどのデータから割ったか */
  basis: string;
}

function judgeRange(v: number | null, low: number | null, high: number | null): Benchmark['judge'] {
  if (v === null) return 'データ不足';
  if (low !== null && v < low) return '目安外';
  if (high !== null && v > high) return '目安外';
  return '目安内';
}

/**
 * 参考実装(収支管理ダッシュボード)のベンチマーク表を同じ式で再現する。
 * 経費率=直近3ヶ月の事業経費平均÷平均売上 / サブスク対売上比 / 安全余裕率 / 貯蓄率(世帯) / 食費比率 / 通信費比率
 */
export function benchmarks(data: Dataset): Benchmark[] {
  const rec = recordedExpIdx(data);
  const rev = revenueIdx(data).map((i) => data.biz.revenue[i]);
  const avgRev = mean(rev);
  const recent3 = rec.slice(-3);
  const expenseRatio =
    avgRev > 0 && recent3.length ? mean(recent3.map((i) => bizExpTotal(data, i))) / avgRev : null;
  const subsMonthly = (i: number) =>
    sum(data.subs.vendors.map((v) => data.subs.matrix[v][i])) + (data.subs.other[i] || 0);
  const subsShare = avgRev > 0 && recent3.length ? mean(recent3.map(subsMonthly)) / avgRev : null;
  const bep = diagnosis(data).bep;
  const safetyMargin = avgRev > 0 && bep.breakEven > 0 ? bep.safetyMargin : null;
  const hh = household(data);
  const saveRate = hh.totals.saveRate;
  const living = hh.totals.livingCost;
  const share = (big: string) => {
    if (living <= 0) return null;
    return (hh.livingCost.find((r) => r.big === big)?.total ?? 0) / living;
  };
  const foodShare = share('食費');
  const telecomShare = share('通信費');
  const out: Benchmark[] = [
    {
      id: 'expenseRatio',
      label: '経費率',
      value: expenseRatio,
      low: 0.2,
      high: 0.4,
      guide: '20〜40%',
      judge: judgeRange(expenseRatio, 0.2, 0.4),
      basis: 'freee: 直近3ヶ月の事業経費平均 ÷ 売上のある月の平均売上',
    },
    {
      id: 'subsShare',
      label: 'サブスク対売上比',
      value: subsShare,
      low: null,
      high: 0.15,
      guide: '10〜15%以内',
      judge: judgeRange(subsShare, null, 0.15),
      basis: 'freee: 直近3ヶ月のサブスク平均 ÷ 平均売上',
    },
    {
      id: 'safetyMargin',
      label: '安全余裕率',
      value: safetyMargin,
      low: 0.3,
      high: null,
      guide: '30%以上',
      judge: judgeRange(safetyMargin, 0.3, null),
      basis: 'freee: (平均売上 − 損益分岐点) ÷ 平均売上',
    },
    {
      id: 'saveRate',
      label: '貯蓄率(世帯)',
      value: saveRate,
      low: 0.2,
      high: null,
      guide: '20〜30%',
      judge: judgeRange(saveRate, 0.2, null),
      basis: 'MF: 1 − (生活費 + 事業立替) ÷ (個人収入 + 事業入金)',
    },
    {
      id: 'foodShare',
      label: '食費比率',
      value: foodShare,
      low: null,
      high: 0.2,
      guide: '15〜20%',
      judge: judgeRange(foodShare, null, 0.2),
      basis: 'MF: 食費 ÷ 生活費合計(全期間)',
    },
    {
      id: 'telecomShare',
      label: '通信費比率',
      value: telecomShare,
      low: null,
      high: 0.05,
      guide: '5%以内',
      judge: judgeRange(telecomShare, null, 0.05),
      basis: 'MF: 通信費 ÷ 生活費合計(全期間)',
    },
  ];
  return out;
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
export function judgeBudget(recentAvg: number, budget: number | null): Pick<BudgetRow, 'diff' | 'judge'> {
  if (budget == null) return { diff: null, judge: null };
  const judge = recentAvg > budget * 1.1 ? '超過' : recentAvg < budget * 0.9 ? '余裕' : '範囲内';
  return { diff: recentAvg - budget, judge };
}

export function budgetTable(data: Dataset): BudgetRow[] {
  return data.biz.categories
    .filter((c) => sum(catSeries(data, c)) > 0)
    .map((c) => {
      const p = catProfile(data, c);
      const b = data.budgets[c] ?? null;
      return { account: c, type: p.type, recentAvg: p.rAvg, budget: b, ...judgeBudget(p.rAvg, b) };
    });
}

/**
 * 画面の入力欄1つを予算額へ読む。空欄は「未設定」、数値でない入力は保存済みの値を保つ
 * (打ちかけの `-` や `1e` で表が壊れないように)。
 */
export function parseBudgetDraft(raw: string | undefined, saved: number | null): number | null {
  if (raw === undefined) return saved;
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : saved;
}

/**
 * 保存済みの表へ編集中の下書きを重ねる。保存前でも保存後と同じ判定規則で見えるようにするため、
 * 判定は `judgeBudget` を共有する(画面側で条件式を書き写さない)。
 */
export function budgetRowsWithDraft(
  rows: ReadonlyArray<BudgetRow>,
  draft: Readonly<Record<string, string>>,
): BudgetRow[] {
  return rows.map((row) => {
    const budget = parseBudgetDraft(draft[row.account], row.budget);
    return { ...row, budget, ...judgeBudget(row.recentAvg, budget) };
  });
}

export interface BudgetSummary {
  /** 予算を設定した科目数 */
  withBudget: number;
  /** 月次予算の合計 */
  budgetTotal: number;
  /** 予算を設定した科目の直近3ヶ月平均の合計 */
  actualTotal: number;
  /** 超過と判定された科目数 */
  over: number;
}

export function budgetSummary(rows: ReadonlyArray<BudgetRow>): BudgetSummary {
  const set = rows.filter((row) => row.budget != null);
  return {
    withBudget: set.length,
    budgetTotal: set.reduce((total, row) => total + (row.budget ?? 0), 0),
    actualTotal: set.reduce((total, row) => total + row.recentAvg, 0),
    over: rows.filter((row) => row.judge === '超過').length,
  };
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
