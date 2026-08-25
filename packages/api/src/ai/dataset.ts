/**
 * AIに渡す読み取り専用データ(集計値だけ。明細行・摘要・ルール・編集は含めない)。
 * - 月別配列は {月: 金額} に組み替えて、読み手(LLM)が月を取り違えないようにする。
 * - 対象期間・前期・前年同期の合計は先にサーバー側で計算し、LLM に足し算をさせない。
 * - 統計(外れ値・移動平均・季節性)は「何ヶ月あれば言えるか」を明示し、足りなければ available=false で渡す。
 * - 貸借対照表(BS)は freee の取引エクスポートに資産・負債が無いため、作れない理由を明記して渡す。
 */
import {
  type Dataset,
  type SubsCandidate,
  applyClassification,
  benchmarks,
  catProfile,
  diagnosis,
  household,
  overview,
  recordedExpIdx,
  subscriptions,
} from '@kanjo/core';
import { type ChartContext, type ChartResult, buildCharts } from './catalog.js';
import {
  type Period,
  type ReportType,
  addMonths,
  monthIndex,
  periodLabel,
  rangeLength,
  rangeMonths,
  reportTypeOf,
} from './contract.js';

type ByMonth = Record<string, number>;

const byMonth = (months: string[], series: number[]): ByMonth => {
  const out: ByMonth = {};
  months.forEach((m, i) => {
    out[m] = series[i] ?? 0;
  });
  return out;
};

const round = (v: number): number => Math.round(v);
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** 対象期間のうち取込済みの月だけを返す */
export function periodMonths(months: string[], p: Period): string[] {
  const set = new Set(rangeMonths(p));
  return months.filter((m) => set.has(m));
}

/** 直前の同じ長さの期間(前月 / 前四半期 / 前13ヶ月 …) */
export function previousPeriod(p: Period): Period {
  const n = rangeLength(p);
  return { from: addMonths(p.from, -n), to: addMonths(p.to, -n) };
}

/** 12ヶ月前の同じ期間(前年同月 / 前年同期) */
export function yearAgoPeriod(p: Period): Period {
  return { from: addMonths(p.from, -12), to: addMonths(p.to, -12) };
}

export interface PeriodTotals {
  from: string;
  to: string;
  /** 期間内で取込済みの月 */
  months: string[];
  /** 事業経費が記帳されている月(未記帳月を除く) */
  recordedExpenseMonths: string[];
  revenue: number;
  expense: number;
  profit: number;
  /** 経費÷売上(1=100%)。売上が無ければ null */
  expenseRatio: number | null;
  expenseByAccount: Record<string, number>;
  personalIncome: number;
  personalExpense: number;
  subscriptions: number;
}

function periodTotals(data: Dataset, p: Period): PeriodTotals | null {
  const months = periodMonths(data.months, p);
  if (!months.length) return null;
  const idx = months.map((m) => data.months.indexOf(m));
  const un = new Set(data.unrecordedExpMonths);
  const recIdx = idx.filter((i) => !un.has(data.months[i]));
  const revenue = idx.reduce((s, i) => s + (data.biz.revenue[i] ?? 0), 0);
  const expenseByAccount: Record<string, number> = {};
  for (const acct of data.biz.categories) {
    const v = recIdx.reduce((s, i) => s + (data.biz.expense[acct]?.[i] ?? 0), 0);
    if (v) expenseByAccount[acct] = v;
  }
  const expense = Object.values(expenseByAccount).reduce((s, v) => s + v, 0);
  let personalIncome = 0;
  let personalExpense = 0;
  for (const m of months) {
    const pm = data.personal[m];
    if (!pm) continue;
    personalIncome += Object.values(pm.income).reduce((s, v) => s + v, 0);
    personalExpense += Object.values(pm.expense).reduce((s, v) => s + v, 0);
  }
  const subs = idx.reduce(
    (s, i) =>
      s +
      data.subs.vendors.reduce((t, v) => t + (data.subs.matrix[v]?.[i] ?? 0), 0) +
      (data.subs.other[i] ?? 0),
    0,
  );
  return {
    from: p.from,
    to: p.to,
    months,
    recordedExpenseMonths: recIdx.map((i) => data.months[i]),
    revenue,
    expense,
    profit: revenue - expense,
    expenseRatio: revenue > 0 ? round3(expense / revenue) : null,
    expenseByAccount,
    personalIncome,
    personalExpense,
    subscriptions: subs,
  };
}

/** 統計手法ごとに必要な最低月数(記帳月ベース)。足りない手法は使わせない */
export const STAT_MIN_MONTHS = {
  outliers: 6,
  movingAverage: 6,
  trend: 12,
  seasonality: 24,
  yearOverYear: 13,
} as const;

export interface PreviousReportSummary {
  id: string;
  version: number;
  createdAt: string;
  period: Period;
  title: string;
  summary: string;
  keyFindings: { improvements: string[]; wasted: string[]; quickWins: string[] };
  reductionItems: string[];
  needs: string[];
}

export interface BuildOptions {
  previousReports?: PreviousReportSummary[];
  supplement?: string | null;
  /** 未登録の支払先のうちサブスクらしい上位(サブスク分析ページの候補と同じ採点) */
  candidates?: SubsCandidate[];
}

/** 期間プリセット(画面の「直近月 / 四半期 / 13ヶ月 / 5年」と同じ切り方)。終了月を基準に切る */
export const PERIOD_PRESETS = [
  { id: 'month', label: '直近月', months: 1 },
  { id: 'quarter', label: '直近四半期', months: 3 },
  { id: 'year13', label: '直近13ヶ月', months: 13 },
  { id: 'year5', label: '直近5年', months: 61 },
] as const;

/** 要望25d: 図ごとに「出せた / 元データが無い / アプリ側の不備」を分けて記録する */
export interface CoverageRow {
  chart: string;
  figure: number;
  status: ChartResult['status'];
  detail: string;
}

export function buildAgentData(data: Dataset, period: Period, opts: BuildOptions = {}) {
  const ov = overview(data);
  const hh = household(data);
  const subs = subscriptions(data);
  const diag = diagnosis(data);
  const months = data.months;
  const type: ReportType = reportTypeOf(period);
  const inPeriod = periodMonths(months, period);
  const prev = previousPeriod(period);
  const yago = yearAgoPeriod(period);
  const recordedCount = recordedExpIdx(data).length;

  // 科目別の統計プロファイル(全期間・未記帳月除外)。固定費/変動費の区分もここから
  const accounts = data.biz.categories.filter((c) => (data.biz.expense[c] ?? []).some((v) => v > 0));
  const profiles = Object.fromEntries(
    accounts.map((c) => {
      const p = catProfile(data, c);
      return [
        c,
        {
          type: p.type,
          mean: round(p.mean),
          sd: round(p.sd),
          cv: round3(p.cv),
          median: round(p.med),
          recent3Avg: round(p.rAvg),
          priorAvg: round(p.pAvg),
          slope: round3(p.slope),
          lastValue: round(p.lastVal),
          z: round3(p.z),
          total: round(p.total),
        },
      ];
    }),
  );
  // 外れ値(異常月): 科目×月で |z| >= 2 のもの。記帳月が足りなければ空
  const outliers: { month: string; account: string; value: number; mean: number; z: number }[] = [];
  if (recordedCount >= STAT_MIN_MONTHS.outliers) {
    const un = new Set(data.unrecordedExpMonths);
    for (const c of accounts) {
      const p = profiles[c];
      if (p.sd <= 0) continue;
      months.forEach((m, i) => {
        if (un.has(m)) return;
        const v = data.biz.expense[c]?.[i] ?? 0;
        const z = (v - p.mean) / p.sd;
        if (Math.abs(z) >= 2 && v > 10000)
          outliers.push({ month: m, account: c, value: v, mean: p.mean, z: round3(z) });
      });
    }
    outliers.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  }
  const fixedAccounts = accounts.filter((c) => profiles[c].type === '固定費');
  const variableAccounts = accounts.filter((c) => profiles[c].type !== '固定費');
  const current = periodTotals(data, period);
  const fixedInPeriod = current
    ? fixedAccounts.reduce((s, c) => s + (current.expenseByAccount[c] ?? 0), 0)
    : 0;
  const variableInPeriod = current ? current.expense - fixedInPeriod : 0;

  // 年別の集計(長期レポート用。月別は全部渡すが、年単位の比較はこの表を使う)
  const byYear: Record<string, { months: number; revenue: number; expense: number; profit: number }> = {};
  const un = new Set(data.unrecordedExpMonths);
  months.forEach((m, i) => {
    const y = m.slice(0, 4);
    byYear[y] ??= { months: 0, revenue: 0, expense: 0, profit: 0 };
    byYear[y].months += 1;
    byYear[y].revenue += data.biz.revenue[i] ?? 0;
    if (!un.has(m)) byYear[y].expense += ov.expenseTotal[i] ?? 0;
    byYear[y].profit = byYear[y].revenue - byYear[y].expense;
  });

  const previousTotals = periodTotals(data, prev);
  const yearAgoTotals = periodTotals(data, yago);
  const bench = benchmarks(data);
  const bepAvailable = diag.bep.revenueMonths >= 3 && diag.bep.breakEven > 0;

  // ---- 図表(要望23/25): 数値はここで全部計算し、AIには caption だけ書かせる ----
  const chartCtx: ChartContext = {
    data,
    period,
    type,
    expenseTotal: ov.expenseTotal,
    expenseMovingAvg: ov.expenseMovingAvg,
    recordedCount,
    current,
    previous: previousTotals,
    yearAgo: yearAgoTotals,
    fixedAccounts,
    breakEven: { monthly: round(diag.bep.breakEven), available: bepAvailable },
    subsVendors: subs.vendors,
    subsMatrix: subs.matrix,
    subsOther: subs.other,
    subsMonths: subs.months,
  };
  const charts = buildCharts(chartCtx);
  const coverage: CoverageRow[] = charts.map((c) => ({
    chart: c.id,
    figure: c.figure,
    status: c.status,
    detail: c.detail,
  }));

  // ---- 切り口(要望25補足): 図とレポートに使える軸を、データにある範囲だけ列挙する ----
  const rangeOf = (ms: string[]) => (ms.length ? { from: ms[0], to: ms[ms.length - 1] } : null);
  const accountRange = (acct: string) =>
    rangeOf(months.filter((m, i) => !un.has(m) && (data.biz.expense[acct]?.[i] ?? 0) > 0));
  const sumBig = (personal: Dataset['personal']) => {
    const out: Record<string, number> = {};
    for (const m of inPeriod) {
      for (const [big, v] of Object.entries(personal[m]?.expense ?? {})) out[big] = (out[big] ?? 0) + v;
    }
    return out;
  };
  // 手動編集を除いた「取込値ベース」の個人支出(edits を空にして分類し直す)
  const imported = applyClassification(data.mfTx, data.rules, {}, data.institutionOwners);
  const ownerTotals = { self: 0, spouse: 0, unset: 0 };
  for (const m of inPeriod) {
    const o = data.personalByOwner[m];
    if (!o) continue;
    ownerTotals.self += o.self?.expense ?? 0;
    ownerTotals.spouse += o.spouse?.expense ?? 0;
    ownerTotals.unset += o.unset?.expense ?? 0;
  }
  const presetRange = (n: number): Period => ({ from: addMonths(period.to, -(n - 1)), to: period.to });
  const presets = PERIOD_PRESETS.map((ps) => {
    const r = presetRange(ps.months);
    const ms = periodMonths(months, r);
    return {
      id: ps.id,
      label: ps.label,
      from: r.from,
      to: r.to,
      availableMonths: ms.length,
      recordedMonths: ms.filter((m) => !un.has(m)).length,
    };
  });
  const fixedVariableAvailable = recordedCount >= STAT_MIN_MONTHS.movingAverage;
  const axes = {
    note: 'レポート・図に使ってよい切り口。ここに無い軸(例: 決済状況)は判定不能として扱い、推測で作らない。',
    category: {
      bizAccounts: accounts.map((a) => ({
        name: a,
        type: fixedVariableAvailable ? profiles[a].type : '判定不能',
        currentTotal: current?.expenseByAccount[a] ?? 0,
        range: accountRange(a),
      })),
      personalBig: {
        note: 'effective=公私仕分けの手動編集を反映した値 / imported=取込値のまま(ルール分類のみ)。差があれば手修正の影響',
        effective: sumBig(data.personal),
        imported: sumBig(imported.personal),
        range: rangeOf(Object.keys(data.personal).sort()),
      },
    },
    segment: {
      bizPersonal: current
        ? { biz: current.expense, personal: current.personalExpense, range: rangeOf(inPeriod) }
        : null,
      owner: {
        ...ownerTotals,
        note: 'unset は名義未設定の金融機関分。設定画面で名義を割り当てると本人/妻に分かれる',
        range: rangeOf(inPeriod),
      },
      fixedVariable: fixedVariableAvailable
        ? {
            available: true,
            reason: null,
            fixed: fixedInPeriod,
            variable: variableInPeriod,
            fixedAccounts,
            variableAccounts,
          }
        : {
            available: false,
            reason: `固定費/変動費の判定には記帳済みの月が${STAT_MIN_MONTHS.movingAverage}ヶ月必要です(現在${recordedCount}ヶ月)。判定不能として扱う`,
            fixed: null,
            variable: null,
            fixedAccounts: [],
            variableAccounts: [],
          },
      settlement: {
        available: false,
        reason: '決済状況(入金済み/未入金)は取込データに無いため、この軸は使えない',
      },
    },
    period: {
      requested: { from: period.from, to: period.to, availableMonths: inPeriod.length },
      presets,
      previous: { from: prev.from, to: prev.to, availableMonths: periodMonths(months, prev).length },
      yearAgo: { from: yago.from, to: yago.to, availableMonths: periodMonths(months, yago).length },
      dataRange: rangeOf(months),
    },
    indicator: [
      ...bench.map((b) => ({
        id: b.id,
        label: b.label,
        value: b.value,
        basis: b.basis,
        guide: b.guide,
        judge: b.judge,
        low: b.low,
        high: b.high,
      })),
      {
        id: 'breakEven',
        label: '損益分岐点(月あたり)',
        value: bepAvailable ? round(diag.bep.breakEven) : null,
        basis: '固定費に分類された科目の直近3ヶ月平均の合計',
        guide: '平均売上がこれを下回る月が続くと赤字',
        judge: bepAvailable
          ? diag.bep.avgRevenue >= diag.bep.breakEven
            ? '目安内'
            : '目安外'
          : 'データ不足',
        low: null,
        high: null,
      },
      {
        id: 'fixedShare',
        label: '固定費比率',
        value:
          fixedVariableAvailable && current && current.expense > 0
            ? round3(fixedInPeriod / current.expense)
            : null,
        basis: '対象期間の固定費÷経費合計',
        guide: '目安は決めていない(業種で異なる)。前期との比較に使う',
        judge: fixedVariableAvailable && current && current.expense > 0 ? '目安内' : 'データ不足',
        low: null,
        high: null,
      },
    ],
  };

  return {
    generatedAt: new Date().toISOString(),
    period: {
      from: period.from,
      to: period.to,
      type,
      label: periodLabel(period),
      requestedMonths: rangeMonths(period),
      months: inPeriod,
      previous: { from: prev.from, to: prev.to, months: periodMonths(months, prev) },
      yearAgo: { from: yago.from, to: yago.to, months: periodMonths(months, yago) },
    },
    dataRange: { from: months[0] ?? null, to: months[months.length - 1] ?? null, count: months.length },
    notes: [
      '金額はすべて円(整数)。支出は正の値。比率は 1=100% の小数。',
      'biz は freee 帳簿(事業)。personal は MF 明細のうち公私仕分けで「個人」とされた分。',
      'unrecordedExpenseMonths は事業経費が未記帳の月で、その月の経費 0 は「無い」ではなく「未記帳」。',
      'summary.current / previous / yearAgo は対象期間・直前の同じ長さの期間・前年同期の合計。null はその期間に取込済みの月が無いこと。',
      'stats.available が false の手法は月数不足。レポートには「データ不足(あとNヶ月分で分析可能)」と書き、結論を書かない。',
      'bs.available は false(貸借対照表は作れない)。資産・負債・現預金残高について推測で書かない。',
      'personal.expense のキーは MF の大項目(または大項目/中項目)。',
      'charts は図表カタログの全図(固定順)。available=true の図だけ本文で「図N」と参照し、caption を付けて送る。数値はアプリが計算済みで、AIが図の数字を作ることはない。',
      'coverage は図ごとの状態。source_missing=元データが無い / app_missing=アプリ側の不備(needs ではなく dataGaps に「アプリ側」と明記する)。',
      'axes はレポートに使ってよい切り口(項目・区分・期間・指標)。available=false の軸は判定不能と書き、推測で埋めない。',
    ],
    months,
    unrecordedExpenseMonths: data.unrecordedExpMonths,
    summary: {
      current,
      previous: previousTotals,
      yearAgo: yearAgoTotals,
    },
    pl: {
      basis: 'freee 取引エクスポートの収入・支出(発生ベース)。売上=収入の合計、経費=支出の合計',
      current: current
        ? {
            revenue: current.revenue,
            expense: current.expense,
            profit: current.profit,
            expenseRatio: current.expenseRatio,
            fixedCost: fixedInPeriod,
            variableCost: variableInPeriod,
            fixedAccounts,
            variableAccounts,
          }
        : null,
      breakEven: {
        note: '固定費に分類された科目の直近3ヶ月平均の合計(月あたり)。安全余裕率=(平均売上−固定費)÷平均売上',
        monthly: round(diag.bep.breakEven),
        avgMonthlyRevenue: round(diag.bep.avgRevenue),
        revenueMonths: diag.bep.revenueMonths,
        safetyMargin: round3(diag.bep.safetyMargin),
        available: bepAvailable,
      },
    },
    bs: {
      available: false,
      reason:
        '取り込んでいる freee「取引」エクスポートには収入・支出の発生額しか無く、資産・負債・現預金残高が含まれない。貸借対照表(BS)を出すには freee の「試算表(貸借対照表)」または「残高」のエクスポートを取り込む機能が必要。',
    },
    stats: {
      recordedMonths: recordedCount,
      minMonths: STAT_MIN_MONTHS,
      available: {
        outliers: recordedCount >= STAT_MIN_MONTHS.outliers,
        movingAverage: recordedCount >= STAT_MIN_MONTHS.movingAverage,
        trend: recordedCount >= STAT_MIN_MONTHS.trend,
        seasonality: recordedCount >= STAT_MIN_MONTHS.seasonality,
        yearOverYear: recordedCount >= STAT_MIN_MONTHS.yearOverYear,
      },
      accountProfiles: profiles,
      outliers: outliers.slice(0, 30),
      expenseMovingAvg3: byMonth(
        months,
        ov.expenseMovingAvg.map((v) => (v == null ? 0 : round(v))),
      ),
      expenseCv: round3(diag.kpi.expenseCv),
    },
    biz: {
      revenue: byMonth(months, data.biz.revenue),
      expenseTotal: byMonth(months, ov.expenseTotal),
      expenseByAccount: Object.fromEntries(
        accounts.map((acct) => [acct, byMonth(months, data.biz.expense[acct] ?? [])]),
      ),
      byYear,
      kpi: ov.kpi,
      years: ov.years,
      yearTable: ov.yearTable,
      yearTotals: ov.yearTotals,
      pareto: ov.pareto,
    },
    personal: {
      byMonth: Object.fromEntries(months.map((m) => [m, data.personal[m] ?? { income: {}, expense: {} }])),
      livingCost: hh.livingCost,
      explainability: hh.explainability,
    },
    bizPersonal: data.bizPersonal,
    comparison: hh.comparison,
    byOwner: {
      rows: hh.byOwner.rows,
      totals: hh.byOwner.totals,
      unmappedInstitutions: hh.byOwner.unmappedInstitutions,
    },
    subscriptions: {
      now: subs.now,
      vendors: Object.fromEntries(subs.vendors.map((v) => [v, byMonth(subs.months, subs.matrix[v] ?? [])])),
      other: byMonth(subs.months, subs.other),
      vendorTable: subs.vendorTable,
      alerts: subs.alerts,
      years: subs.years,
      /** 登録外だが毎月続いている支払先。整理候補の材料(登録は利用者がサブスク分析ページで行う) */
      candidates: opts.candidates ?? [],
    },
    benchmarks: bench,
    charts,
    coverage,
    axes,
    previousReports: opts.previousReports ?? [],
    supplement: (opts.supplement ?? '').trim() || null,
  };
}

export type AgentData = ReturnType<typeof buildAgentData>;
