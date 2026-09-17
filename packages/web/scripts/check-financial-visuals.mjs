// 財務画面を匿名データで実描画し、現行 FinancialFigure/Chart.js の意味と寸法を検証する。
// 使い方:
//   pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4175
//   KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 node scripts/check-financial-visuals.mjs
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCdpSession } from './cdp.mjs';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';
import { viewportsByLabel } from './viewports.mjs';

const BASE_URL = process.env.KANJO_VISUAL_BASE_URL ?? 'http://127.0.0.1:4175';
const VISUAL_SCOPE = process.env.KANJO_VISUAL_SCOPE ?? 'all';
const PERFORMANCE_GATE = process.env.KANJO_PERFORMANCE_GATE === '1';
// 実ルートは高さを1000で揃えて測る(縦は検査対象ではない)ため、幅とzoomだけ使う。
const VIEWPORTS = viewportsByLabel([
  '320',
  '360',
  '375',
  '390',
  '641',
  '768',
  '900',
  '1023',
  '1024',
  '1280',
  '1600',
  '1908',
  'zoom200',
  'rail-zoom200',
]);
const OUTPUT_DIR = process.env.KANJO_VISUAL_OUTPUT_DIR ?? join(tmpdir(), 'kanjo-financial-review');
const months = Array.from({ length: 20 }, (_, index) => {
  const date = new Date(Date.UTC(2025, index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
});

const rows = [
  ['サブスク・通信', 42_000, 1_100],
  ['会議費', 8_500, -2_100],
  ['広告宣伝費', 56_000, 30_000],
  ['新聞図書費', 12_000, -8_000],
  ['旅費交通費', 24_000, 13_000],
  ['消耗品費', 31_000, -16_000],
  ['研修費', 18_000, 9_000],
  ['交際費', 15_000, -5_000],
].map(([label, base, delta], rowIndex) => {
  const series = months.map((_, index) =>
    index === months.length - 1
      ? Number(base) + Number(delta)
      : Number(base) + ((index + rowIndex) % 4) * 900,
  );
  return {
    label,
    isTotal: false,
    series,
    yearTotals: [
      { year: '2025', total: series.slice(0, 12).reduce((sum, value) => sum + value, 0) },
      { year: '2026', total: series.slice(12).reduce((sum, value) => sum + value, 0) },
    ],
    yoy: rowIndex % 2 ? -0.08 : 0.12,
  };
});
const expenseSeries = months.map((_, index) => rows.reduce((sum, row) => sum + row.series[index], 0));
const revenueSeries = months.map((_, index) => 390_000 + (index % 5) * 24_000);
const profitSeries = revenueSeries.map((value, index) => value - expenseSeries[index]);
const sum = (values) => values.reduce((total, value) => total + value, 0);

const matrix = {
  months,
  unrecordedExpMonths: [],
  years: ['2025', '2026'],
  rows: [
    ...rows,
    {
      label: '経費計',
      isTotal: true,
      series: expenseSeries,
      yearTotals: [
        { year: '2025', total: sum(expenseSeries.slice(0, 12)) },
        { year: '2026', total: sum(expenseSeries.slice(12)) },
      ],
      yoy: 0.04,
    },
  ],
};

let runningCash = 0;
const cfMonths = months.map((month, index) => {
  const receivableIncrease = index % 4 === 0 ? 32_000 : 0;
  const payableIncrease = index % 5 === 0 ? 18_000 : 0;
  const operating = profitSeries[index] - receivableIncrease + payableIncrease;
  runningCash += operating;
  return { month, profit: profitSeries[index], receivableIncrease, payableIncrease, operating };
});
const cumulative = cfMonths.map((month, index) =>
  sum(cfMonths.slice(0, index + 1).map((item) => item.operating)),
);
const statements = {
  pl: {
    months,
    revenue: { monthly: revenueSeries, total: sum(revenueSeries) },
    groups: [
      {
        group: 'その他',
        rows: rows.map((row) => ({
          account: row.label,
          monthly: row.series,
          total: sum(row.series),
          share: sum(row.series) / sum(expenseSeries),
        })),
        monthly: expenseSeries,
        total: sum(expenseSeries),
        share: 1,
      },
    ],
    expense: { monthly: expenseSeries, total: sum(expenseSeries) },
    profit: { monthly: profitSeries, total: sum(profitSeries) },
    profitRate: sum(profitSeries) / sum(revenueSeries),
    limits: ['匿名フィクスチャ: 決算整理前の数値です。'],
  },
  cf: {
    months: cfMonths,
    cumulative,
    total: cumulative.at(-1),
    settlementUnknown: false,
    limits: ['匿名フィクスチャ: 営業活動のみです。'],
  },
  bs: {
    months: [
      {
        month: '2026-07',
        asOf: '2026-07-31',
        partial: false,
        assets: [
          { category: '預金・現金', amount: 1_280_000 },
          { category: '売掛金', amount: 320_000 },
        ],
        assetTotal: 1_600_000,
        liabilities: [
          { category: 'クレジットカード未払金', amount: 280_000 },
          { category: '借入金', amount: 520_000 },
        ],
        liabilityTotal: 800_000,
        netAssets: 800_000,
      },
      {
        month: '2026-08',
        asOf: '2026-08-28',
        partial: true,
        assets: [
          { category: '預金・現金', amount: 1_420_000 },
          { category: '売掛金', amount: 380_000 },
        ],
        assetTotal: 1_800_000,
        liabilities: [
          { category: 'クレジットカード未払金', amount: 260_000 },
          { category: '借入金', amount: 490_000 },
        ],
        liabilityTotal: 750_000,
        netAssets: 1_050_000,
      },
    ],
    assetCategories: ['預金・現金', '売掛金'],
    liabilityCategories: ['クレジットカード未払金', '借入金'],
    monthsWithoutLiabilities: [],
    limits: ['匿名フィクスチャ: 簿外資産は含みません。'],
  },
  liabilityCategoryOptions: ['クレジットカード未払金', '借入金', '未払金・買掛金', 'その他の負債'],
  balanceSheetSources: [],
  period: {
    applied: null,
    label: '全期間',
    full: { from: months[0], to: months.at(-1) },
    years: ['2025', '2026'],
    monthCount: months.length,
  },
};

const movingAverage = expenseSeries.map((_, index) =>
  index < 2 ? null : sum(expenseSeries.slice(index - 2, index + 1)) / 3,
);
const summary = {
  overview: {
    months,
    revenue: revenueSeries,
    expenseTotal: expenseSeries,
    profit: profitSeries,
    expenseMovingAvg: movingAverage,
    cashOverride: {},
    unrecordedExpMonths: [],
    kpi: {
      avgRevenue: sum(revenueSeries) / revenueSeries.length,
      revenueMonths: revenueSeries.length,
      avgExpense: sum(expenseSeries) / expenseSeries.length,
      lastExpense: expenseSeries.at(-1),
      expenseMom: expenseSeries.at(-1) / expenseSeries.at(-2) - 1,
      prevYearExpense: sum(expenseSeries.slice(0, 12)),
      currYearAnnualized: (sum(expenseSeries.slice(12)) / 8) * 12,
      prevYearRevenue: sum(revenueSeries.slice(0, 12)),
      prevYearProfit: sum(profitSeries.slice(0, 12)),
      prevYearExpenseRatio: sum(expenseSeries.slice(0, 12)) / sum(revenueSeries.slice(0, 12)),
    },
    yearTable: rows.map((row) => ({
      account: row.label,
      prevActual: sum(row.series.slice(0, 12)),
      currAnnualized: (sum(row.series.slice(12)) / 8) * 12,
      delta: 0.08,
    })),
    yearTotals: {
      prevActual: sum(expenseSeries.slice(0, 12)),
      currAnnualized: (sum(expenseSeries.slice(12)) / 8) * 12,
      delta: 0.08,
    },
    pareto: rows.map((row, index) => ({
      account: row.label,
      total: sum(row.series),
      cumShare: Math.min(1, (index + 1) / rows.length),
    })),
    top2Share: 0.44,
    years: { curr: '2026', prev: '2025' },
  },
  defense: {
    line: 300_000,
    personalAvg: 210_000,
    bizFixedAvg: 90_000,
    month: months.at(-1),
    incomeEstimate: 510_000,
    salary: 260_000,
    bizIncome: 250_000,
    diff: 210_000,
    status: 'ok',
    forecast: {
      line: 300_000,
      history: [],
      breachCount: 0,
      nextMonth: null,
      nextEstimate: 510_000,
      nextSalary: 260_000,
      nextBizIncome: 250_000,
      nextDiff: 210_000,
      slope: 0,
      level: 'none',
      reason: '匿名フィクスチャの見通しは安定しています。',
    },
  },
  benchmarks: [],
  period: statements.period,
};

const subscriptionVendors = Array.from(
  { length: 20 },
  (_, index) => `支払先${String(index + 1).padStart(2, '0')}`,
);
const subscriptionMatrix = Object.fromEntries(
  subscriptionVendors.map((vendor, index) => [
    vendor,
    months.map((_, monthIndex) => (index + 1) * 1_000 + (monthIndex % 3) * 100),
  ]),
);
const subscriptions = {
  months,
  vendors: subscriptionVendors,
  matrix: subscriptionMatrix,
  other: months.map(() => 500),
  vendorTable: subscriptionVendors.map((vendor, index) => ({
    vendor,
    prevActual: (index + 1) * 12_000,
    currAnnualized: (index + 1) * 13_000,
    delta: 0.08,
    lastMonthly: subscriptionMatrix[vendor].at(-1),
    avgMonthly: sum(subscriptionMatrix[vendor]) / months.length,
    last12Total: sum(subscriptionMatrix[vendor].slice(-12)),
    activeMonths: months.length,
  })),
  now: {
    month: months.at(-1),
    monthlyTotal:
      subscriptionVendors.reduce((total, vendor) => total + subscriptionMatrix[vendor].at(-1), 0) + 500,
    annualized: 2_600_000,
    last12Total: 2_450_000,
    revenueShare: 0.1,
  },
  alerts: [],
  years: { curr: '2026', prev: '2025' },
};

const trendRows = rows.slice(0, 4).map((row, index) => ({
  account: row.label,
  side: index % 2 ? 'personal' : 'biz',
  key: `trend-${index}`,
  total: sum(row.series),
  share: 0.25,
  monthlyAvg: sum(row.series) / row.series.length,
  cv: 0.2,
  type: '固定費',
  slopePerMonth: index % 2 ? -500 : 700,
  slopeRatio: index % 2 ? -0.03 : 0.04,
  annualImpact: index % 2 ? -6_000 : 8_400,
  mk: { s: 1, tau: 0.2, z: 1.1, p: 0.12, n: months.length },
  direction: index % 2 ? '減少' : '増加',
  recentAvg: 40_000,
  priorAvg: 36_000,
  presenceRate: 1,
  gapMonths: [],
  series: row.series,
  action: index === 0 ? '削減を検討' : '継続監視',
  score: 80 - index,
  reason: '匿名フィクスチャの変化です。',
}));
const trends = {
  months,
  recordedMonths: months,
  unrecordedExpMonths: [],
  expenseTotal: sum(expenseSeries),
  monthlyAvg: sum(expenseSeries) / months.length,
  rows: trendRows,
  pareto: trendRows.map((row, index) => ({
    account: row.account,
    side: row.side,
    key: row.key,
    total: row.total,
    share: row.share,
    cumShare: (index + 1) / trendRows.length,
  })),
  coreCount: 3,
  breakdown: {
    beforeMonths: months.slice(0, 10),
    afterMonths: months.slice(10),
    beforeTotal: 150_000,
    afterTotal: 170_000,
    diff: 20_000,
    rows: trendRows.map((row, index) => ({
      account: row.account,
      side: row.side,
      key: row.key,
      before: 35_000,
      after: index % 2 ? 32_000 : 41_000,
      diff: index % 2 ? -3_000 : 6_000,
      contribution: index % 2 ? -0.15 : 0.3,
    })),
  },
  counts: { 削減を検討: 1, 継続監視: 3, 記録を整える: 0, 対応不要: 0 },
  scope: 'all',
  scopeLabel: '事業+家計',
  sides: [
    {
      side: 'biz',
      label: '事業',
      total: 180_000,
      monthlyAvg: 9_000,
      share: 0.6,
      accountCount: 2,
      topAccount: { account: '広告宣伝費', total: 100_000 },
    },
    {
      side: 'personal',
      label: '家計',
      total: 120_000,
      monthlyAvg: 6_000,
      share: 0.4,
      accountCount: 2,
      topAccount: { account: '会議費', total: 70_000 },
    },
  ],
  monthlySides: months.map((month, index) => ({
    month,
    biz: 90_000 + index * 500,
    personal: 60_000 + index * 300,
    total: 150_000 + index * 800,
  })),
  period: statements.period,
};
// 推移の新しい応答 (比較・詳細・カテゴリ表・増減パレート)。
// 新画面に旧判定を重複 mount せず、主要2図だけを実描画検査する。
{
  const cur = months.slice(-12);
  const cmp = months.slice(-24, -12);
  const current = expenseSeries.slice(-12);
  const compare =
    cmp.length === 12 ? expenseSeries.slice(-24, -12) : cur.map((_, i) => current[i] - 2_000 + i * 100);
  const diff = current.map((v, i) => v - compare[i]);
  const peak = diff.reduce((best, d, i) => (Math.abs(d) >= Math.abs(diff[best]) ? i : best), 0);
  // 実運用相当の件数で、カテゴリ表がページとの二重縦スクロールを作らないことも検査する。
  const categoryNames = [
    '広告宣伝費',
    '仕入高',
    '人件費',
    '家賃・地代',
    '外注費',
    '通信費',
    '旅費交通費',
    '水道・光熱費',
    '保険',
    'サブスク・通信',
    '研修費',
    '教養・教育',
    '消耗品費',
    '日用品',
    '衣服・美容',
    '交際費',
    '税・社会保障',
    '健康・医療',
    '新聞図書費',
    '会議費',
    '車両費',
    '租税公課',
    '支払手数料',
    '業務用クラウドサービス利用料・情報通信費',
  ];
  const categories = categoryNames.map((name, index) => {
    const row = trendRows[index % trendRows.length];
    const now = row.total;
    const before = now - (index % 2 ? -3_000 : 6_000);
    const columns = {
      side: index % 2 ? 'household' : 'business',
      origin: 'mf',
      spark: row.series.slice(-12),
      sparkMonths: cur,
      current: now,
      compare: before,
      change: now - before,
      changeRate: (now - before) / before,
      share: 0.25,
      contribution: (now - before) / 6_000,
    };
    return { ...columns, name, payees: [{ ...columns, payee: `支払先${index + 1}` }] };
  });
  Object.assign(trends, {
    metrics: [
      {
        id: 'income',
        label: '収入',
        betterWhen: 'higher',
        visualRole: 'income',
        controlOrder: 1,
        showInOverview: true,
      },
      {
        id: 'expense',
        label: '支出',
        betterWhen: 'lower',
        visualRole: 'expense',
        controlOrder: 0,
        showInOverview: true,
      },
      {
        id: 'net',
        label: '純収支',
        betterWhen: 'higher',
        visualRole: 'net',
        controlOrder: 2,
        showInOverview: true,
      },
    ],
    selection: {
      scope: 'total',
      metric: 'expense',
      compare: 'previous',
      month: cur[peak],
      side: null,
      category: null,
      payee: null,
    },
    comparePeriod: { from: cmp[0] ?? cur[0], to: cmp.at(-1) ?? cur.at(-1), label: '前12か月' },
    compareUnavailable: null,
    series: {
      months: cur,
      compareMonths: cmp.length === 12 ? cmp : cur,
      values: {
        income: { current: cur.map(() => 400_000), compare: cur.map(() => 380_000) },
        expense: { current, compare },
        net: { current: current.map((v) => 400_000 - v), compare: compare.map((v) => 380_000 - v) },
      },
      diff,
    },
    kpis: {
      current: sum(current),
      change: {
        amount: sum(current) - sum(compare),
        rate: (sum(current) - sum(compare)) / sum(compare),
        basis: 'compare_period',
      },
      peakMonth: { month: cur[peak], diff: diff[peak], reason: '広告宣伝費が支払先1など2件で¥6,000増' },
    },
    detail: {
      month: cur[peak],
      values: { expense: { current: current[peak], compare: compare[peak] } },
      drivers: [
        {
          category: '広告宣伝費',
          side: 'business',
          change: 6_000,
          payee: '支払先1',
          origin: 'mf',
          text: '広告宣伝費が支払先1など2件で¥6,000増',
        },
      ],
      sources: [
        { origin: 'mf', account: '匿名カード', count: 12 },
        { origin: 'freee', account: null, count: 1 },
      ],
    },
    sparkMonths: cur,
    categories,
    changePareto: categories.map((row, index) => ({
      name: row.name,
      side: row.side,
      change: row.change,
      cumulativeShare: (index + 1) / categories.length,
    })),
    topMovers: categories.slice(0, 3),
    review: { count: 1, amount: 3_300, monthCount: 0, monthAmount: 0 },
    recommended: {
      month: cur[peak],
      category: '広告宣伝費',
      payee: '支払先1',
      change: 6_000,
      changeRate: null,
      origin: 'mf',
      side: 'business',
      href: `/classify?month=${cur[peak]}&cls=biz&category=${encodeURIComponent('広告宣伝費')}&payee=${encodeURIComponent('支払先1')}`,
    },
    focus: null,
    judgementBasis: 'mf_only',
    period: {
      applied: { from: cur[0], to: cur.at(-1) },
      label: `${cur[0]} 〜 ${cur.at(-1)}`,
      full: { from: months[0], to: months.at(-1) },
      years: [...new Set(months.map((month) => month.slice(0, 4)))],
      monthCount: cur.length,
    },
  });
}

const householdMonths = months.slice(-6);
const householdBalance = householdMonths.map((month, index) => ({
  month,
  personalIncome: 280_000 + index * 2_000,
  bizIncome: 120_000 + index * 3_000,
  income: 400_000 + index * 5_000,
  livingCost: 210_000 + index * 1_000,
  bizAdvance: 20_000,
  expense: 230_000 + index * 1_000,
  balance: 170_000 + index * 4_000,
  saveRate: 0.42,
  revenue: 450_000 + index * 5_000,
  bizExpense: 130_000 + index * 1_000,
}));
const compareTotal = (income, expense) => ({
  months: householdMonths.length,
  income,
  expense,
  balance: income - expense,
  monthlyAvg: {
    income: income / householdMonths.length,
    expense: expense / householdMonths.length,
    balance: (income - expense) / householdMonths.length,
  },
  annualized: {
    income: (income / householdMonths.length) * 12,
    expense: (expense / householdMonths.length) * 12,
    balance: ((income - expense) / householdMonths.length) * 12,
  },
});
const ownerMonth = (income, expense) => ({ income, expense });
const ownerTotal = (income, expense, share) => ({
  income,
  expense,
  monthlyAvg: { income: income / householdMonths.length, expense: expense / householdMonths.length },
  annualized: {
    income: (income / householdMonths.length) * 12,
    expense: (expense / householdMonths.length) * 12,
  },
  incomeShare: share,
});
const household = {
  months: householdMonths,
  personal: Object.fromEntries(
    householdMonths.map((month, index) => [
      month,
      { income: { 給与: 280_000 + index * 2_000 }, expense: { 住宅: 120_000, 食費: 90_000 + index * 1_000 } },
    ]),
  ),
  bizPersonal: Object.fromEntries(
    householdMonths.map((month) => [month, { income: 120_000, expense: 20_000 }]),
  ),
  explainability: { month: householdMonths.at(-1), rate: 0.96, unexplained: 8_000, total: 215_000 },
  balance: householdBalance,
  totals: {
    months: householdMonths.length,
    income: sum(householdBalance.map((row) => row.income)),
    livingCost: sum(householdBalance.map((row) => row.livingCost)),
    bizAdvance: sum(householdBalance.map((row) => row.bizAdvance)),
    expense: sum(householdBalance.map((row) => row.expense)),
    balance: sum(householdBalance.map((row) => row.balance)),
    saveRate: 0.42,
    monthlyAvg: { income: 412_500, livingCost: 212_500, expense: 232_500, balance: 180_000 },
    annualized: { income: 4_950_000, livingCost: 2_550_000, expense: 2_790_000, balance: 2_160_000 },
  },
  livingCost: [
    { big: '住宅', total: 720_000, monthlyAvg: 120_000, annualized: 1_440_000, share: 0.56 },
    { big: '食費', total: 555_000, monthlyAvg: 92_500, annualized: 1_110_000, share: 0.44 },
  ],
  comparison: {
    rows: householdBalance.map((row) => ({
      month: row.month,
      biz: { income: row.revenue, expense: row.bizExpense, balance: row.revenue - row.bizExpense },
      personal: {
        income: row.personalIncome,
        expense: row.livingCost,
        balance: row.personalIncome - row.livingCost,
      },
    })),
    biz: compareTotal(2_775_000, 795_000),
    personal: compareTotal(1_710_000, 1_275_000),
  },
  byOwner: {
    rows: householdMonths.map((month, index) => ({
      month,
      business: ownerMonth(120_000 + index * 3_000, 20_000),
      spouse: ownerMonth(260_000 + index * 2_000, 190_000),
      family: ownerMonth(20_000, 10_000),
      unset: ownerMonth(0, 0),
    })),
    totals: {
      business: ownerTotal(765_000, 120_000, 0.43),
      spouse: ownerTotal(1_590_000, 1_140_000, 0.89),
      family: ownerTotal(120_000, 60_000, 0.07),
      unset: ownerTotal(0, 0, 0),
    },
    unmappedInstitutions: [],
    noInstitutionCount: 0,
  },
};

const aiReportRow = {
  id: 'anonymous-report-1',
  taskId: 'anonymous-task-1',
  period: { from: months.at(-3), to: months.at(-1) },
  type: 'monthly',
  label: '匿名月次レポート',
  version: 1,
  parentReportId: null,
  generatedBy: 'anonymous-local-fixture',
  title: '匿名財務レポート',
  summary: '月別支出の関係を匿名数値で確認します。',
  createdAt: '2026-08-30T00:00:00.000Z',
  archivedAt: null,
};
const anonymousChart = (figure, kind, title) => ({
  id: `anonymous-chart-${figure}`,
  figure,
  title,
  kind,
  unit: 'yen',
  purpose: '匿名データの内訳を表で確認します。',
  readingGuide: '左から右へ変化を追います。',
  available: true,
  reason: null,
  monthsNeeded: null,
  granularity: 'month',
  status: 'ok',
  caption: `匿名データの${title}。`,
});

const aiReportDetail = {
  report: {
    ...aiReportRow,
    body: {
      version: 3,
      generatedBy: 'anonymous-local-fixture',
      model: null,
      title: aiReportRow.title,
      summary: aiReportRow.summary,
      keyFindings: {
        improvements: [],
        wasted: [],
        quickWins: [],
        notes: { improvements: '匿名データ', wasted: '匿名データ', quickWins: '匿名データ' },
      },
      sections: [],
      followUp: null,
      needs: [],
      charts: [
        {
          id: 'anonymous-chart-1',
          figure: 1,
          title: '月別支出の推移',
          kind: 'line',
          unit: 'yen',
          purpose: '月別の変化を比べる',
          readingGuide: '増減を左から確認する',
          available: true,
          reason: null,
          monthsNeeded: null,
          granularity: 'month',
          data: {
            labels: months.slice(-6),
            series: [{ label: '支出', data: expenseSeries.slice(-6), role: 'line' }],
          },
          status: 'ok',
          caption: '匿名データで支出の変化を示します。',
        },
        // 以下3枚は「色の引き当てが非自明な kind」。実 Chart.js で本当に描けること、
        // 凡例チップが色を主張する/しないの別が実DOMで保たれることを見るために置く。
        {
          ...anonymousChart(2, 'pareto', '科目別の金額と累積構成比'),
          data: {
            // 累積構成比を先に置く。系列の並び順で色を引くと金額の色がこちらへ付く。
            labels: ['科目A', '科目B', '科目C', '科目D'],
            series: [
              { label: '累積構成比', data: [0.4, 0.7, 0.9, 1], role: 'cum' },
              { label: '金額', data: [520_000, 380_000, 240_000, 120_000] },
            ],
          },
        },
        {
          ...anonymousChart(3, 'band', '経費と平均±2σ'),
          data: {
            labels: months.slice(-6),
            series: [
              { label: '月次経費', data: expenseSeries.slice(-6) },
              { label: '平均', data: months.slice(-6).map(() => 300_000), role: 'line' },
              { label: '平均+2σ', data: months.slice(-6).map(() => 420_000), role: 'band' },
              { label: '平均-2σ', data: months.slice(-6).map(() => 180_000), role: 'band' },
            ],
          },
        },
        {
          ...anonymousChart(4, 'waterfall', '残高の増減'),
          data: {
            labels: ['期首', '増加', '減少', '期末'],
            series: [
              { label: '残高', data: [1_000_000, null, null, 900_000], role: 'total' },
              { label: '増減', data: [null, 200_000, -300_000, null] },
            ],
          },
        },
      ],
      dataGaps: [],
    },
  },
  previous: null,
  versions: [aiReportRow],
};

// 概況 (P1) は /api/overview の集計と /api/review-queue の未処理キューを描く。値はすべて匿名の架空データ
const overviewTrend = months.map((month, index) => ({
  month,
  income: revenueSeries[index],
  expense: expenseSeries[index],
  balance: revenueSeries[index] - expenseSeries[index],
}));
const overviewIncome = sum(revenueSeries.slice(12));
const overviewExpense = sum(expenseSeries.slice(12));
const overviewPreviousIncome = sum(revenueSeries.slice(4, 12));
const overviewPreviousExpense = sum(expenseSeries.slice(4, 12));
const overviewBalance = overviewIncome - overviewExpense;
const overviewPreviousBalance = overviewPreviousIncome - overviewPreviousExpense;
const overviewBreakdownSource = rows
  .map((row) => ({ label: row.label, amount: sum(row.series.slice(12)) }))
  .sort((left, right) => right.amount - left.amount || left.label.localeCompare(right.label, 'ja'));
const overviewBreakdownTop = overviewBreakdownSource.slice(0, 5);
const overviewBreakdownOther = overviewBreakdownSource.slice(5).reduce((total, row) => total + row.amount, 0);
const overviewFixture = {
  scope: 'total',
  kpi: {
    income: overviewIncome,
    expense: overviewExpense,
    balance: overviewBalance,
    months: 8,
  },
  trend: overviewTrend,
  yearComparison: {
    rows: [
      {
        key: 'income',
        label: '総収入',
        current: overviewIncome,
        previous: overviewPreviousIncome,
        delta: overviewIncome - overviewPreviousIncome,
        deltaRate: (overviewIncome - overviewPreviousIncome) / overviewPreviousIncome,
      },
      {
        key: 'expense',
        label: '総支出',
        current: overviewExpense,
        previous: overviewPreviousExpense,
        delta: overviewExpense - overviewPreviousExpense,
        deltaRate: (overviewExpense - overviewPreviousExpense) / overviewPreviousExpense,
      },
      {
        key: 'balance',
        label: '純収支',
        current: overviewBalance,
        previous: overviewPreviousBalance,
        delta: overviewBalance - overviewPreviousBalance,
        deltaRate: (overviewBalance - overviewPreviousBalance) / overviewPreviousBalance,
      },
    ],
    currentLabel: '直近8か月',
    previousLabel: '前8か月',
  },
  breakdown: {
    items: [
      ...overviewBreakdownTop,
      ...(overviewBreakdownOther > 0 ? [{ label: 'その他', amount: overviewBreakdownOther }] : []),
    ].map((row) => ({ ...row, share: row.amount / overviewExpense })),
    total: overviewExpense,
  },
  closeStatus: {
    month: months.at(-1),
    steps: [
      { key: 'import', label: 'データ取込', done: true, count: null },
      { key: 'classification', label: '仕分け', done: false, count: 1 },
      { key: 'reconciliation', label: '照合', done: false, count: 1 },
      { key: 'review', label: '月次レビュー', done: false, count: null },
    ],
    doneCount: 1,
    total: 4,
    reviewedAt: null,
  },
  dataUpdatedAt: '2026-08-31T09:00:00.000Z',
  defenseForecast: { ...summary.defense.forecast, level: 'none' },
  period: summary.period,
};
const reviewQueueFixture = {
  total: 41,
  counts: { classification: 1, reconciliation: 39, import: 1 },
  snoozedCount: 0,
  closeStatus: {
    ...overviewFixture.closeStatus,
    steps: overviewFixture.closeStatus.steps.map((step) =>
      step.key === 'reconciliation' ? { ...step, count: 39 } : step,
    ),
  },
  items: [
    {
      kind: 'classification',
      itemKey: 'fixture-1',
      amount: -12_000,
      date: `${months.at(-1)}-15`,
      month: months.at(-1),
      content: '匿名の文具店',
      recommendation: '事業 / 消耗品費',
      basis: 'rule',
      basisLabel: '分類ルール',
      confidence: 80,
    },
    {
      kind: 'reconciliation',
      itemKey: 'fixture-2',
      amount: -24_800,
      date: `${months.at(-1)}-12`,
      month: months.at(-1),
      content: '匿名の資材店',
      recommendation: null,
      basis: 'none',
      basisLabel: '照合待ち',
      confidence: null,
    },
    {
      kind: 'import',
      itemKey: 'fixture-3',
      amount: 0,
      date: `${months.at(-1)}-10`,
      month: months.at(-1),
      content: '匿名ファイルの列不足',
      recommendation: null,
      basis: 'none',
      basisLabel: '取込履歴',
      confidence: null,
    },
  ],
};

// 照合画面 (/analysis/reconciliation)。KPI・3カラム・下段・選択中バーが崩れないかを実描画で確かめる。
const reconMonth = months.at(-1);
const reconMf = (index, amount, day) => ({
  date: `${reconMonth}-${day}`,
  displayDate: `${reconMonth.slice(5)}/${day}`,
  content: `匿名の取引先${index}`,
  amount,
  io: 'expense',
  institution: '匿名カード',
  major: '通信費',
  middle: '',
  memo: '',
  cls: 'biz',
  clsSrc: 'ルール',
});
const reconFreee = (index, amount, day) => ({
  freeeIndex: index,
  freeeKey: `fixture-freee-${index}`,
  month: reconMonth,
  date: `${reconMonth}-${day}`,
  partner: `匿名の取引先${index}株式会社`,
  amount,
  io: 'expense',
  account: '通信費',
  settleAccount: '普通預金',
});
const reconRow = (index, status, extra = {}) => ({
  txId: `fixture-mf-${index}`,
  status,
  date: `${reconMonth}-${String(10 + (index % 18)).padStart(2, '0')}`,
  month: reconMonth,
  mf: reconMf(index, 1_000 * (index + 1), String(10 + (index % 18)).padStart(2, '0')),
  freee: null,
  difference: null,
  score: null,
  similarity: null,
  reasons: [],
  queues: [],
  verdict: null,
  matchedBy: null,
  excludedBy: null,
  excludedReason: null,
  reviewReason: null,
  candidateKeys: [],
  ...extra,
});
// 最新画面と同じ122件。選択対象・対応不要・解消済みを同時に置き、各状態の操作差を実ブラウザで検証する。
const reconAmounts = [4_800, 32_000, 1_200, 3_000, 1_800, 6_480];
const reconReviewRows = Array.from({ length: 39 }, (_, index) => {
  const day = String(10 + (index % 18)).padStart(2, '0');
  const amount = reconAmounts[index % reconAmounts.length];
  return reconRow(index, 'review', {
    mf: reconMf(index, amount, day),
    freee: reconFreee(index, amount, day),
    difference: 0,
    score: 88,
    similarity: 0.9,
    reasons: [
      { kind: 'amount', ok: true, label: '金額が一致' },
      { kind: 'date', ok: false, label: '日付が近い' },
      { kind: 'content', ok: true, label: '内容が類似' },
    ],
    queues: ['review', 'nearDate'],
    reviewReason: '発生日が一致しません',
    candidateKeys: [`fixture-freee-${index}`],
  });
});
const reconMatchedRows = Array.from({ length: 41 }, (_, offset) => {
  const index = 39 + offset;
  const day = String(10 + (index % 18)).padStart(2, '0');
  const amount = reconAmounts[index % reconAmounts.length];
  return reconRow(index, 'matched', {
    mf: reconMf(index, amount, day),
    freee: reconFreee(index, amount, day),
    difference: 0,
    score: 100,
    similarity: 1,
    matchedBy: 'auto',
  });
});
const reconOnlyRows = Array.from({ length: 42 }, (_, offset) => {
  const index = 80 + offset;
  const month = months[months.length - 1 - (Math.floor(offset / reconAmounts.length) % months.length)];
  const day = index % 2 === 0 ? '10' : '18';
  const amount = reconAmounts[index % reconAmounts.length];
  return reconRow(index, 'mfOnly', {
    date: `${month}-${day}`,
    month,
    mf: {
      ...reconMf(index, amount, day),
      date: `${month}-${day}`,
      displayDate: `${month.slice(5)}/${day}`,
    },
    queues: ['mfOnly'],
  });
});
// 先頭ページにも3状態を混在させ、選択可能/不可の列が同居しても崩れないことを撮影・検証する。
const reconRows = Array.from({ length: 42 }, (_, index) =>
  [reconReviewRows[index], reconMatchedRows[index], reconOnlyRows[index]].filter(Boolean),
).flat();
const reconOnlyAmount = reconOnlyRows.reduce((total, row) => total + row.mf.amount, 0);
const reconFreeeAmount = [...reconReviewRows, ...reconMatchedRows].reduce(
  (total, row) => total + (row.freee?.amount ?? 0),
  0,
);
const reconciliation = {
  kpi: {
    businessExpense: reconOnlyAmount + reconFreeeAmount,
    mfOnlyCount: 42,
    mfOnlyAmount: reconOnlyAmount,
    actionRequiredCount: 39,
    reviewCount: 39,
    resolvedCount: 41,
    resolvableCount: 80,
    resolutionRate: 41 / 80,
  },
  statusCounts: { unprocessed: 0, review: 39, matched: 41, mfOnly: 42, excluded: 0 },
  sourceCounts: { moneyforward: 122, freee: 80 },
  queues: { review: 39, mfOnly: 42, amountMismatch: 0, nearDate: 39 },
  rows: reconRows,
  mfOnly: reconOnlyRows,
  unmatchedFreee: [],
  lastAction: null,
  period: summary.period,
};

// サイドバーの要確認バッジが全画面で呼ぶ集約API。差し替えないと dev の /api 中継先へ抜け、
// そこで別の wrangler dev が 401 を返すとログイン画面へ落ちて描画待ちがタイムアウトする。
const analysisHub = {
  summary: { income: 0, expense: 0, net: 0, previous: null, change: null },
  views: {
    reconciliation: {
      id: 'reconciliation',
      priority: '高',
      count: 39,
      actionRequiredCount: 39,
      reviewCount: 39,
    },
    'total-cashflow': { id: 'total-cashflow', priority: '中', count: 0, reviewCount: 0 },
    matrix: { id: 'matrix', priority: '中', count: 0, unrecordedMonths: 0, normal: true },
    trends: { id: 'trends', priority: '中', count: 0, expenseChange: null },
    diagnosis: { id: 'diagnosis', priority: '中', count: 0, annualSavings: 0, candidateCount: 0 },
  },
};

/**
 * 総収支画面の応答 (SYS-TCSCREEN-P09)。
 *
 * 判定作業の3区分は空にしない。0 件だとペインが見出しだけになり、狭幅で縦積みになるかも、
 * 行が本体幅に収まるかも確かめないまま緑になる。各区分へ 1 件ずつ置いて実際に描かせる。
 * 値はすべて架空。
 */
const totalCashflowSegment = (income, expense) => ({
  income,
  expense,
  balance: income - expense,
  previousYear: null,
  change: null,
});
const totalCashflowTotals = (income, expense) => ({ income, expense, balance: income - expense });
const totalCashflowFreee = {
  freeeIndex: 0,
  freeeKey: 'v1:freee:fixture#0',
  month: months.at(-1),
  date: `${months.at(-1)}-05`,
  partner: '架空クラウド',
  amount: 3_300,
  io: 'expense',
  account: '通信費',
  settleAccount: '架空カード',
};
// core は `mfTxId`、API 応答は `txId`。画面が読むのは後者なので、ここも `txId` で書く。
// core 側の名前で書くと key が undefined になり、React の key 警告として跳ね返る
const totalCashflowReview = (txId, reason) => ({
  txId,
  reason,
  mf: {
    date: `${months.at(-1)}-07`,
    displayDate: '08/07',
    content: '架空クラウド 月額',
    amount: 3_300,
    io: 'expense',
    institution: '架空カード',
    major: '事業経費',
    middle: '通信費',
    memo: '',
    cls: 'biz',
    clsSrc: 'rule',
  },
  candidates: [{ ...totalCashflowFreee, dayGap: 2, accountConflict: false, score: 72 }],
});
const totalCashflowDuplicates = Array.from({ length: 24 }, (_, index) => {
  const review = totalCashflowReview(
    `fixture-duplicate-${index + 1}`,
    '対応する freee 取引が他の明細へ寄せられています',
  );
  const day = String((index % 20) + 1).padStart(2, '0');
  return {
    ...review,
    mf: {
      ...review.mf,
      date: `${months.at(-1)}-${day}`,
      displayDate: `08/${day}`,
      content: `架空クラウド 月額 ${index + 1}`,
    },
  };
});
const totalCashflow = {
  months: months.slice(-6).map((month) => ({
    month,
    shiftedCount: 0,
    reviewCount: 1,
    reviewAmount: 3_300,
    totalExpense: 892_400,
    householdExpense: 412_000,
  })),
  review: [totalCashflowReview('fixture-tx-1', '発生日が一致しません')],
  matched: [],
  freeeOnly: [totalCashflowFreee],
  excluded: [
    {
      ...totalCashflowFreee,
      freeeIndex: 1,
      freeeKey: 'v1:freee:fixture#1',
      reason: '口座間の振替なので数えない',
      reasonCode: 'transfer',
      memo: null,
    },
  ],
  coverage: { freeeTotal: 2, matched: 0, freeeOnly: 1, excluded: 1, mfReview: 1 },
  summary: {
    total: totalCashflowSegment(1_248_000, 892_400),
    biz: totalCashflowSegment(1_248_000, 480_400),
    household: totalCashflowSegment(0, 412_000),
  },
  series: months.slice(-6).map((month) => ({
    month,
    total: totalCashflowTotals(1_248_000, 892_400),
    biz: totalCashflowTotals(1_248_000, 480_400),
    household: totalCashflowTotals(0, 412_000),
  })),
  workbench: {
    duplicates: totalCashflowDuplicates,
    needsReview: [totalCashflowReview('fixture-tx-1', '発生日が一致しません')],
    excluded: [
      {
        ...totalCashflowFreee,
        freeeIndex: 1,
        freeeKey: 'v1:freee:fixture#1',
        reason: '口座間の振替なので数えない',
        reasonCode: 'transfer',
        memo: null,
      },
    ],
    progress: {
      duplicates: { total: totalCashflowDuplicates.length, decided: 0 },
      needsReview: { total: 1, decided: 0 },
      excluded: { total: 1, decided: 1 },
    },
  },
  autoMatches: [],
  lastOperation: null,
  period: {
    applied: { from: months.at(-6), to: months.at(-1) },
    label: `${months.at(-6)} 〜 ${months.at(-1)}`,
    full: { from: months[0], to: months.at(-1) },
    years: [...new Set(months.map((month) => month.slice(0, 4)))],
    monthCount: 6,
  },
};

const jsonBody = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const responseFor = (url) => {
  const requestUrl = new URL(url);
  const path = requestUrl.pathname;
  if (path === '/api/auth/me') return { authenticated: true };
  if (path === '/api/total-cashflow') return totalCashflow;
  if (path === '/api/summary') return summary;
  if (path === '/api/overview') return overviewFixture;
  if (path === '/api/review-queue') return reviewQueueFixture;
  if (path === '/api/analysis/hub') return analysisHub;
  if (path === '/api/imports') return { imports: [] };
  if (path === '/api/reconciliation') return reconciliation;
  if (path === '/api/matrix') return matrix;
  if (path === '/api/trends') {
    if (requestUrl.searchParams.get('span') !== '1') {
      throw new Error(`推移の実描画fixtureは初回1年queryを前提とします: ${requestUrl.search}`);
    }
    return trends;
  }
  if (path === '/api/subscriptions') return subscriptions;
  if (path === '/api/sub-vendors/candidates') return { candidates: [], excluded: [], dealRows: 0 };
  if (path === '/api/sub-vendors') return { vendors: [], accountOptions: [], review: [] };
  if (path === '/api/household') return household;
  if (path === '/api/statements') return statements;
  if (path === '/api/unsettled') return { rows: [] };
  if (path === '/api/ai/tasks') return { tasks: [] };
  if (path === '/api/ai/reports/anonymous-report-1') return aiReportDetail;
  if (path === '/api/ai/reports') return { reports: [aiReportRow], archivedCount: 0 };
  return undefined;
};

mkdirSync(OUTPUT_DIR, { recursive: true });
const profileDir = mkdtempSync(join(tmpdir(), 'kanjo-financial-chrome-'));

let chrome;
let ws;
const runtimeProblems = [];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  const launched = await launchHeadlessChrome({ profileRoot: profileDir, windowSize: '1600,1000' });
  chrome = launched.chrome;
  const { port, targets } = launched;
  const session = await openCdpSession({
    port,
    targets,
    // APIレスポンスを差し替えるため、id を持たない Fetch.requestPaused を自分で捌く。
    onEvent: (message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        runtimeProblems.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
        return;
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        runtimeProblems.push(
          message.params.args?.map((argument) => argument.value ?? argument.description ?? '').join(' ') ||
            'console.error',
        );
        return;
      }
      if (message.method !== 'Fetch.requestPaused') return;
      const response = responseFor(message.params.request.url);
      if (response === undefined) {
        void send('Fetch.continueRequest', { requestId: message.params.requestId });
        return;
      }
      void send('Fetch.fulfillRequest', {
        requestId: message.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
        body: jsonBody(response),
      });
    },
  });
  ws = session.socket;
  const { send, evaluate } = session;
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await evaluate(expression)) return;
      await sleep(250);
    }
    const body = await evaluate('document.body.innerText.slice(0, 500)');
    throw new Error(`${label} の描画待ちがタイムアウトしました: ${body}`);
  };
  const mouseClick = async (selector, label) => {
    const point = JSON.parse(
      await evaluate(`JSON.stringify((() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        const scroller = node.closest('.scroll-x');
        if (scroller) {
          const targetBox = node.getBoundingClientRect();
          const scrollBox = scroller.getBoundingClientRect();
          if (targetBox.left < scrollBox.left) scroller.scrollLeft -= scrollBox.left - targetBox.left + 8;
          if (targetBox.right > scrollBox.right) scroller.scrollLeft += targetBox.right - scrollBox.right + 8;
        }
        const clickSurface = node.querySelector('.recon-control-indicator') ?? node;
        const box = clickSurface.getBoundingClientRect();
        return box.width > 0 && box.height > 0
          ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
          : null;
      })())`),
    );
    if (!point) throw new Error(`${label} の実クリック対象が見つかりません: ${selector}`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    await sleep(100);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      globalThis.__kanjoVitals = { lcp: 0, cls: 0, inp: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) globalThis.__kanjoVitals.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) globalThis.__kanjoVitals.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.interactionId) globalThis.__kanjoVitals.inp = Math.max(globalThis.__kanjoVitals.inp, entry.duration);
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 0 });
    `,
  });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  const failures = [];
  const reconciliationFixtureCounts = {};
  for (const row of reconciliation.rows)
    reconciliationFixtureCounts[row.status] = (reconciliationFixtureCounts[row.status] ?? 0) + 1;
  if (
    reconciliation.rows.length !== 122 ||
    reconciliationFixtureCounts.mfOnly !== 42 ||
    reconciliationFixtureCounts.review !== 39 ||
    reconciliationFixtureCounts.matched !== 41
  )
    failures.push(
      `Reconciliation 匿名fixtureが122件(MFのみ42・要確認39・照合済み41)ではない: ${JSON.stringify(reconciliationFixtureCounts)}`,
    );
  if (VISUAL_SCOPE === 'all' || VISUAL_SCOPE === 'core') {
    for (const { label: viewportLabel, width, zoom } of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 640,
      });
      await send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
      await send('Page.navigate', { url: `${BASE_URL}/analysis/matrix` });
      await waitFor(
        "document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas').length === 1",
        'Matrix',
      );
      await evaluate('window.scrollTo(0, 0)');
      await sleep(300);
      const metrics = await evaluate(`(async () => {
      const wait = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await wait();
      const scroller = document.querySelector('.matrix-table')?.closest('.scroll-x');
      const label = document.querySelector('.matrix-table tbody th[scope="row"]');
      const labelStyle = label ? getComputedStyle(label) : null;
      const textRange = label ? document.createRange() : null;
      if (textRange && label) textRange.selectNodeContents(label);
      const textLineTops = textRange
        ? [...textRange.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))
        : [];
      const before = label?.getBoundingClientRect().left ?? null;
      if (scroller) scroller.scrollLeft = Math.min(280, scroller.scrollWidth - scroller.clientWidth);
      await wait();
      const after = label?.getBoundingClientRect().left ?? null;
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        firstColumnWidth: label?.getBoundingClientRect().width ?? 0,
        firstColumnHeight: label?.getBoundingClientRect().height ?? 0,
        whiteSpace: labelStyle?.whiteSpace ?? '',
        labelText: label?.textContent?.trim() ?? '',
        labelLines: new Set(textLineTops).size,
        scrollerWidth: scroller?.clientWidth ?? 0,
        tableWidth: scroller?.scrollWidth ?? 0,
        stickyDelta: before === null || after === null ? null : Math.abs(before - after),
        chartCount: document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas').length,
        fixedAmountGuide: document.querySelector('.matrix-summary .chart-guide')?.textContent?.includes('表示切替に関係なく増減額(円)') ?? false,
        contracts: [...document.querySelectorAll('[data-financial-figure]')].map((figure) => ({
          heading: Boolean(figure.querySelector('.financial-figure__caption h2, .financial-figure__caption h3, .financial-figure__caption h4')?.textContent?.trim()),
          summary: Boolean(figure.querySelector('[data-financial-summary]')?.textContent?.trim()),
          period: Boolean(figure.querySelector('[data-financial-period]')?.textContent?.trim()),
          unit: Boolean(figure.querySelector('[data-financial-unit]')?.textContent?.trim()),
          series: Boolean(figure.querySelector('[data-financial-series] li')?.textContent?.trim()),
          action: Boolean(figure.querySelector('[data-financial-action]')?.textContent?.trim()),
          table: Boolean(figure.querySelector('.financial-figure__details table, .heatmap-scroll table')),
          canvas: (() => {
            const canvas = figure.querySelector('.financial-figure__chart canvas');
            const box = canvas?.getBoundingClientRect();
            return Boolean(canvas && canvas.width > 0 && canvas.height > 0 && box && box.width > 0 && box.height > 0);
          })(),
        })),
      };
    })()`);
      if (metrics.firstColumnWidth < 191)
        failures.push(`${width}px 科目列が ${metrics.firstColumnWidth}px で12rem未満`);
      if (metrics.whiteSpace !== 'nowrap') failures.push(`${width}px 科目が nowrap ではない`);
      if (metrics.labelLines > 1)
        failures.push(`${width}px 科目「${metrics.labelText}」が ${metrics.labelLines} 行に折り返す`);
      if (metrics.tableWidth <= metrics.scrollerWidth)
        failures.push(`${width}px 月次表が表枠内で横スクロールしない`);
      if (metrics.stickyDelta === null || metrics.stickyDelta > 1)
        failures.push(`${width}px 横スクロール時に科目列が固定されない`);
      if (metrics.pageWidth > metrics.viewportWidth + 1)
        failures.push(`${width}px Matrixページ本体が横にはみ出す`);
      if (metrics.chartCount !== 1 || !metrics.fixedAmountGuide)
        failures.push(`${viewportLabel} Matrix 増減額固定の要約図が確認できない`);
      if (
        metrics.contracts.length !== 1 ||
        metrics.contracts.some((contract) => Object.values(contract).some((value) => !value))
      )
        failures.push(
          `${viewportLabel} Matrix 見出し・結論・期間・単位・系列・次の行動・正確な表・実canvasが不足`,
        );

      if (zoom === 1 && (width === 375 || width === 1280)) {
        const matrixShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(
          join(OUTPUT_DIR, `matrix-${viewportLabel}.png`),
          Buffer.from(matrixShot.data, 'base64'),
        );
      }
      console.log(
        `${viewportLabel} Matrix 科目列=${Math.round(metrics.firstColumnWidth)}px/${metrics.labelLines}行/${metrics.whiteSpace} ` +
          `表=${metrics.tableWidth}/${metrics.scrollerWidth}px sticky差=${metrics.stickyDelta}px 本体=${metrics.pageWidth}/${metrics.viewportWidth}px`,
      );

      await send('Page.navigate', { url: `${BASE_URL}/statements` });
      await waitFor(
        "document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas').length === 4",
        'Statements',
      );
      await evaluate('window.scrollTo(0, 0)');
      await sleep(300);
      const statementMetrics = await evaluate(`(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      chartCount: document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas').length,
      figures: [...document.querySelectorAll('[data-financial-figure] .financial-figure__caption h2, [data-financial-figure] .financial-figure__caption h3, [data-financial-figure] .financial-figure__caption h4')].map((node) => node.textContent?.trim()),
      tables: document.querySelectorAll('table.data').length,
      equationVisible: Boolean(document.querySelector('.financial-equation')),
      canvasBoxes: [...document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas')].map((canvas) => {
        const box = canvas.getBoundingClientRect();
        return { width: box.width, height: box.height, bitmapWidth: canvas.width, bitmapHeight: canvas.height };
      }),
      contracts: [...document.querySelectorAll('[data-financial-figure]')].map((figure) => ({
        heading: Boolean(figure.querySelector('.financial-figure__caption h2, .financial-figure__caption h3, .financial-figure__caption h4')?.textContent?.trim()),
        summary: Boolean(figure.querySelector('[data-financial-summary]')?.textContent?.trim()),
        period: Boolean(figure.querySelector('[data-financial-period]')?.textContent?.trim()),
        unit: Boolean(figure.querySelector('[data-financial-unit]')?.textContent?.trim()),
        series: Boolean(figure.querySelector('[data-financial-series] li')?.textContent?.trim()),
        action: Boolean(figure.querySelector('[data-financial-action]')?.textContent?.trim()),
        table: Boolean(figure.querySelector('.financial-figure__details table, .heatmap-scroll table')),
      })),
      bsFigureBottom: document.querySelectorAll('.financial-figure')[3]?.getBoundingClientRect().bottom ?? 0,
      bsTableTop: document.querySelectorAll('.table-heading.compact')[2]?.getBoundingClientRect().top ?? 0,
      bsTableBottom: document.querySelector('.liability-form')?.previousElementSibling?.getBoundingClientRect().bottom ?? 0,
      liabilityFormTop: document.querySelector('.liability-form')?.getBoundingClientRect().top ?? 0,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))()`);
      if (statementMetrics.pageWidth > statementMetrics.viewportWidth + 1)
        failures.push(`${width}px Statementsページ本体が横にはみ出す`);
      if (
        statementMetrics.chartCount !== 4 ||
        statementMetrics.tables < 3 ||
        !statementMetrics.equationVisible
      )
        failures.push(`${viewportLabel} Statements PL/CF/BSの図解または照合表が不足`);
      if (
        statementMetrics.canvasBoxes.some(
          (box) => box.width < 1 || box.height < 1 || box.bitmapWidth < 1 || box.bitmapHeight < 1,
        )
      )
        failures.push(`${viewportLabel} Statements PL/CF/BSのcanvas描画領域が0`);
      if (
        statementMetrics.contracts.length !== 4 ||
        statementMetrics.contracts.some((contract) => Object.values(contract).some((value) => !value))
      )
        failures.push(`${viewportLabel} Statements 見出し・結論・期間・単位・系列・次の行動・正確な表が不足`);
      if (
        statementMetrics.bsFigureBottom > statementMetrics.bsTableTop + 1 ||
        statementMetrics.bsTableBottom > statementMetrics.liabilityFormTop + 1
      )
        failures.push(`${width}px BS図・照合表・負債入力フォームの順序が重なる`);
      if (!statementMetrics.reducedMotion) failures.push(`${width}px reduced-motion の実描画条件を作れない`);
      if (zoom === 1 && (width === 375 || width === 1280)) {
        const statementsTopShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(
          join(OUTPUT_DIR, `statements-${viewportLabel}-top.png`),
          Buffer.from(statementsTopShot.data, 'base64'),
        );
        const targets = [
          { name: 'pl', expression: "document.querySelector('.financial-equation')" },
          { name: 'cf-monthly', expression: "document.querySelectorAll('.financial-figure')[1]" },
          { name: 'cf-cumulative', expression: "document.querySelectorAll('.financial-figure')[2]" },
          { name: 'bs', expression: "document.querySelectorAll('.financial-figure')[3]" },
        ];
        for (const target of targets) {
          await evaluate(`${target.expression}?.scrollIntoView({ block: 'center' })`);
          await sleep(150);
          const sectionShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          writeFileSync(
            join(OUTPUT_DIR, `statements-${viewportLabel}-${target.name}.png`),
            Buffer.from(sectionShot.data, 'base64'),
          );
        }
      }
      console.log(
        `${viewportLabel} Statements 図=${statementMetrics.chartCount} 表=${statementMetrics.tables} ` +
          `本体=${statementMetrics.pageWidth}/${statementMetrics.viewportWidth}px reduced-motion=${statementMetrics.reducedMotion}`,
      );
    }
  }

  if (
    VISUAL_SCOPE === 'all' ||
    VISUAL_SCOPE === 'additional' ||
    VISUAL_SCOPE === 'overview' ||
    VISUAL_SCOPE === 'reconciliation' ||
    VISUAL_SCOPE === 'trends'
  ) {
    const additionalRoutes = [
      { name: 'Overview', path: '/', expectedFigures: 1 },
      {
        name: 'Reconciliation',
        path: '/analysis/reconciliation',
        expectedFigures: 0,
        readySelector: '.recon-kpis',
      },
      {
        name: 'Trends',
        path: '/analysis/trends',
        expectedFigureTitles: ['収支の推移', '増減の要因(パレート図)'],
      },
      { name: 'Total cashflow', path: '/analysis/total-cashflow', expectedFigures: 1 },
      { name: 'Subscriptions', path: '/subscriptions', expectedFigures: 1 },
      { name: 'Household', path: '/household', expectedFigures: 1 },
      { name: 'AI report', path: '/ai', expectedFigures: 4, openReport: true },
    ];
    // rail境界は共通shellの変更なので、代表6画面をすべて同じ幅で監査する。
    const ADDITIONAL_WIDTHS = [360, 375, 390, 641, 768, 900, 1023, 1024, 1280, 1600];
    for (const { label: viewportLabel, width, zoom } of VIEWPORTS) {
      const auditAllRoutes =
        (zoom === 1 && ADDITIONAL_WIDTHS.includes(width)) || viewportLabel === 'rail-zoom200';
      const routes = additionalRoutes.filter((route) => {
        if (VISUAL_SCOPE === 'overview') return route.name === 'Overview';
        if (VISUAL_SCOPE === 'trends') return route.name === 'Trends';
        if (VISUAL_SCOPE === 'reconciliation')
          return (
            route.name === 'Reconciliation' && zoom === 1 && [375, 641, 768, 1024, 1280, 1600].includes(width)
          );
        return route.name === 'Overview' || auditAllRoutes;
      });
      if (!routes.length) continue;
      const tag = zoom === 1 ? `${width}px` : viewportLabel;
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 640,
      });
      await send('Emulation.setPageScaleFactor', { pageScaleFactor: zoom });
      for (const route of routes) {
        runtimeProblems.length = 0;
        let reconciliationInteraction = null;
        await send('Page.navigate', { url: `${BASE_URL}${route.path}` });
        if (route.openReport) {
          await waitFor(
            "[...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === '読む')",
            route.name,
          );
          await evaluate(
            "[...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === '読む')?.click()",
          );
        }
        if (route.readySelector)
          await waitFor(
            `Boolean(document.querySelector(${JSON.stringify(route.readySelector)}))`,
            route.name,
          );
        const figureReadyExpression = route.expectedFigureTitles
          ? `JSON.stringify([...document.querySelectorAll('[data-financial-figure] .financial-figure__caption h2, [data-financial-figure] .financial-figure__caption h3, [data-financial-figure] .financial-figure__caption h4')].map((node) => node.textContent?.trim())) === ${JSON.stringify(JSON.stringify(route.expectedFigureTitles))}`
          : `document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas').length === ${route.expectedFigures}`;
        await waitFor(figureReadyExpression, route.name);
        await waitFor(
          "Boolean(document.querySelector('.improve-trigger'))",
          `${route.name} improvement action`,
        );
        if (route.name === 'Total cashflow') {
          await evaluate(`(() => {
            document.querySelector('.tcf-row-open')?.click();
            document.querySelector('.tcf-workbench-main .tcf-pick input')?.click();
          })()`);
          await waitFor(
            "Boolean(document.querySelector('.tcf-detail') && document.querySelector('.tcf-selection-bar'))",
            'Total cashflow workbench context',
          );
          await evaluate("document.querySelector('.tcf-workbench')?.scrollIntoView({ block: 'start' })");
          await sleep(150);
        }
        if (route.name === 'Reconciliation') {
          // 表内の横移動はDOM代入ではなく、利用者と同じ横ホイール入力で確かめる。
          const scrollProbe = JSON.parse(
            await evaluate(`JSON.stringify((() => {
              const scroller = document.querySelector('.recon-table-scroll');
              if (!scroller) return null;
              scroller.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
              scroller.scrollLeft = 0;
              const rect = scroller.getBoundingClientRect();
              return {
                x: rect.left + Math.min(rect.width / 2, 120),
                y: rect.top + Math.min(rect.height / 2, 120),
                overflow: scroller.scrollWidth > scroller.clientWidth + 1,
              };
            })())`),
          );
          if (scrollProbe?.overflow) {
            await send('Input.dispatchMouseEvent', {
              type: 'mouseWheel',
              x: scrollProbe.x,
              y: scrollProbe.y,
              deltaX: 240,
              deltaY: 0,
            });
            await sleep(100);
          }
          const horizontalScrollWorked =
            !scrollProbe?.overflow ||
            Number(await evaluate("document.querySelector('.recon-table-scroll')?.scrollLeft ?? 0")) > 0;
          await evaluate(
            "document.querySelector('.recon-table-scroll')?.scrollTo({ left: 0, behavior: 'instant' })",
          );

          // 行の内容を実クリックし、active行とdetailが同じ取引へ切り替わることを確認する。
          const detailBefore = await evaluate(
            "document.querySelector('.recon-row-open[aria-current=\"true\"]')?.textContent?.trim() ?? ''",
          );
          const detailTarget = await evaluate(
            "document.querySelector('.recon-table tbody tr:nth-child(2) .recon-row-open')?.textContent?.trim() ?? ''",
          );
          await mouseClick(
            '.recon-table tbody tr:nth-child(2) .recon-row-open',
            `${tag} Reconciliation 行詳細`,
          );
          await waitFor(
            `document.querySelector('.recon-row-open[aria-current="true"]')?.textContent?.trim() === ${JSON.stringify(detailTarget)}`,
            `${tag} Reconciliation 行詳細同期`,
          );
          // 狭幅ではdetailへsmooth scrollするため、次の実クリック座標を採る前に移動完了を待つ。
          await sleep(width < 1024 ? 600 : 100);
          const afterClick = JSON.parse(
            await evaluate(`JSON.stringify((() => ({
              active: document.querySelector('.recon-row-open[aria-current="true"]')?.textContent?.trim() ?? '',
              detail: document.querySelector('.recon-detail')?.textContent ?? '',
            }))())`),
          );

          // 1行選択 → indeterminate → 表示中を全選択 → 全解除を、すべて実マウスで通す。
          await mouseClick(
            '.recon-table tbody tr:first-child .recon-selection-hit',
            `${tag} Reconciliation 行選択`,
          );
          await waitFor(
            "Boolean(document.querySelector('.recon-selection')) && document.querySelector('.recon-table thead input[type=\"checkbox\"]')?.indeterminate === true",
            `${tag} Reconciliation 1件選択`,
          );
          const rowSelected = JSON.parse(
            await evaluate(`JSON.stringify((() => ({
              rowChecked: document.querySelector('.recon-table tbody input[type="checkbox"]:checked') !== null,
              checkedCount: document.querySelectorAll('.recon-table tbody input[type="checkbox"]:checked').length,
              headerChecked: document.querySelector('.recon-table thead input[type="checkbox"]')?.checked === true,
              headerIndeterminate: document.querySelector('.recon-table thead input[type="checkbox"]')?.indeterminate === true,
              selectionCount: document.querySelector('.recon-selection-count')?.textContent?.trim() ?? '',
            }))())`),
          );
          await mouseClick('.recon-table thead .recon-selection-hit', `${tag} Reconciliation 表示中を全選択`);
          await waitFor(
            'document.querySelector(\'.recon-table thead input[type="checkbox"]\')?.checked === true',
            `${tag} Reconciliation 全選択`,
          );
          const allSelected = JSON.parse(
            await evaluate(`JSON.stringify((() => ({
              visibleSelectable: document.querySelectorAll('.recon-table tbody input[type="checkbox"]').length,
              checkedCount: document.querySelectorAll('.recon-table tbody input[type="checkbox"]:checked').length,
              headerChecked: document.querySelector('.recon-table thead input[type="checkbox"]')?.checked === true,
              headerIndeterminate: document.querySelector('.recon-table thead input[type="checkbox"]')?.indeterminate === true,
              selectionCount: document.querySelector('.recon-selection-count')?.textContent?.trim() ?? '',
            }))())`),
          );
          await mouseClick('.recon-table thead .recon-selection-hit', `${tag} Reconciliation 表示中を全解除`);
          await waitFor(
            "document.querySelectorAll('.recon-table tbody input[type=\"checkbox\"]:checked').length === 0 && !document.querySelector('.recon-selection')",
            `${tag} Reconciliation 全解除`,
          );
          const cleared = JSON.parse(
            await evaluate(`JSON.stringify((() => ({
              checkedCount: document.querySelectorAll('.recon-table tbody input[type="checkbox"]:checked').length,
              headerChecked: document.querySelector('.recon-table thead input[type="checkbox"]')?.checked === true,
              headerIndeterminate: document.querySelector('.recon-table thead input[type="checkbox"]')?.indeterminate === true,
              selectionBar: Boolean(document.querySelector('.recon-selection')),
            }))())`),
          );

          // 狭幅ではfilterが折り畳まれる。summaryも実クリックしてから候補有無を排他的に切り替える。
          if (!(await evaluate("document.querySelector('.recon-filters details')?.open === true"))) {
            await mouseClick('.recon-filters summary', `${tag} Reconciliation 絞り込みを開く`);
            await waitFor(
              "document.querySelector('.recon-filters details')?.open === true",
              `${tag} Reconciliation 絞り込み展開`,
            );
          }
          await mouseClick(
            '.recon-radio:has(input[type="radio"][aria-label="候補なし"])',
            `${tag} Reconciliation 候補なし`,
          );
          await waitFor(
            "document.querySelector('.recon-radio input[aria-label=\"候補なし\"]')?.checked === true && document.querySelector('#recon-list-title')?.textContent?.includes('42件')",
            `${tag} Reconciliation 候補なし42件`,
          );
          const withoutCandidate = JSON.parse(
            await evaluate(`JSON.stringify((() => {
              const rows = [...document.querySelectorAll('.recon-table tbody tr')];
              return {
                checked: document.querySelector('.recon-radio input[aria-label="候補なし"]')?.checked === true,
                heading: document.querySelector('#recon-list-title')?.textContent?.replaceAll(/\\s/g, '') ?? '',
                rowCount: rows.length,
                selectionCellsConsistent: rows.every((row) => {
                  const cell = row.cells[0];
                  return Boolean(cell) &&
                    !cell.querySelector('input[type="checkbox"]') &&
                    cell.querySelectorAll('.recon-selection-hit--unavailable').length === 1 &&
                    cell.querySelectorAll('.recon-selection-placeholder').length === 1;
                }),
              };
            })())`),
          );
          await mouseClick(
            '.recon-radio:has(input[type="radio"][aria-label="候補あり"])',
            `${tag} Reconciliation 候補あり`,
          );
          await waitFor(
            "document.querySelector('.recon-radio input[aria-label=\"候補あり\"]')?.checked === true && document.querySelector('#recon-list-title')?.textContent?.includes('80件')",
            `${tag} Reconciliation 候補あり80件`,
          );
          const withCandidate = JSON.parse(
            await evaluate(`JSON.stringify((() => {
              const rows = [...document.querySelectorAll('.recon-table tbody tr')];
              return {
                checked: document.querySelector('.recon-radio input[aria-label="候補あり"]')?.checked === true,
                heading: document.querySelector('#recon-list-title')?.textContent?.replaceAll(/\\s/g, '') ?? '',
                rowCount: rows.length,
                selectionCellsConsistent: rows.every((row) => {
                  const cell = row.cells[0];
                  const pending = row.querySelector('.recon-badge--review, .recon-badge--unprocessed') !== null;
                  const selectable = cell?.querySelectorAll('.recon-selection-hit:not(.recon-selection-hit--unavailable) input[type="checkbox"]').length === 1;
                  const unavailable = cell?.querySelectorAll('.recon-selection-hit--unavailable .recon-selection-placeholder').length === 1;
                  return Boolean(cell) && (pending ? selectable && !unavailable : unavailable && !selectable);
                }),
              };
            })())`),
          );
          // 検収画像は候補あり/なしの操作結果ではなく、全122件を俯瞰できる初期状態へ戻して撮る。
          await mouseClick(
            '.recon-radio:has(input[name="recon-candidate"][aria-label="すべて"])',
            `${tag} Reconciliation 候補すべて`,
          );
          await waitFor(
            "document.querySelector('.recon-radio input[name=\"recon-candidate\"][aria-label=\"すべて\"]')?.checked === true && document.querySelector('#recon-list-title')?.textContent?.includes('122件')",
            `${tag} Reconciliation 候補すべて122件`,
          );
          const allCandidates = JSON.parse(
            await evaluate(`JSON.stringify((() => ({
              checked: document.querySelector('.recon-radio input[name="recon-candidate"][aria-label="すべて"]')?.checked === true,
              heading: document.querySelector('#recon-list-title')?.textContent?.replaceAll(/\\s/g, '') ?? '',
              rowCount: document.querySelectorAll('.recon-table tbody tr').length,
            }))())`),
          );

          reconciliationInteraction = {
            attempted: Boolean(detailTarget),
            horizontallyScrolled: horizontalScrollWorked,
            changed:
              Boolean(detailTarget) &&
              detailBefore !== detailTarget &&
              afterClick.active === detailTarget &&
              afterClick.detail.includes(detailTarget),
            rowSelected,
            allSelected,
            cleared,
            withoutCandidate,
            withCandidate,
            allCandidates,
          };
          const vitals = JSON.parse(
            await evaluate(`JSON.stringify((() => {
              const navigation = performance.getEntriesByType('navigation')[0];
              const paints = performance.getEntriesByType('paint');
              return {
                lcp: Math.round(globalThis.__kanjoVitals?.lcp ?? 0),
                cls: Number((globalThis.__kanjoVitals?.cls ?? 0).toFixed(3)),
                inp: Math.round(globalThis.__kanjoVitals?.inp ?? 0),
                fcp: Math.round(paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0),
                domInteractive: Math.round(navigation?.domInteractive ?? 0),
                nodes: document.getElementsByTagName('*').length,
              };
            })())`),
          );
          console.log(
            `${tag} Reconciliation LCP=${vitals.lcp}ms FCP=${vitals.fcp}ms INP=${vitals.inp}ms CLS=${vitals.cls} ` +
              `interactive=${vitals.domInteractive}ms DOM=${vitals.nodes}`,
          );
          if (PERFORMANCE_GATE && vitals.lcp > 2_500)
            failures.push(`${tag} Reconciliation LCPが2.5秒を超えている`);
          if (PERFORMANCE_GATE && vitals.inp > 200)
            failures.push(`${tag} Reconciliation INPが200msを超えている`);
          if (PERFORMANCE_GATE && vitals.cls > 0.1)
            failures.push(`${tag} Reconciliation CLSが0.1を超えている`);
        }
        const routeMetrics = JSON.parse(
          await evaluate(`JSON.stringify((() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        shell: (() => {
          const box = (node) => {
            const value = node?.getBoundingClientRect();
            return value
              ? { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height }
              : null;
          };
          const insideHorizontally = (inner, outer) =>
            Boolean(inner && outer && inner.left >= outer.left - 1 && inner.right <= outer.right + 1);
          const overlaps = (a, b) =>
            Boolean(a && b && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1);
          const lineCount = (node) => {
            if (!node || getComputedStyle(node).display === 'none') return 0;
            const range = document.createRange();
            range.selectNodeContents(node);
            return new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top))).size;
          };
          const textNodesSingleLine = (node) => {
            if (!node || getComputedStyle(node).display === 'none') return true;
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(walker.currentNode);
              const tops = [...range.getClientRects()]
                .filter((rect) => rect.width > 0)
                .map((rect) => Math.round(rect.top));
              if (new Set(tops).size > 1) return false;
            }
            return true;
          };
          const rail = matchMedia('(min-width: 641px) and (max-width: 1023px)').matches;
          const sidebar = document.querySelector('.sidebar');
          const sidebarBox = box(sidebar);
          const sidebarContentBox = sidebarBox
            ? { ...sidebarBox, right: sidebarBox.left + sidebar.clientWidth }
            : null;
          const brandMark = document.querySelector('.sidebar .brand-mark');
          const brandCopy = document.querySelector('.sidebar .brand-copy');
          const firstNavIcon = document.querySelector('.sidebar .nav .route-icon');
          const improvement = document.querySelector('.improve-trigger');
          const improvementNav = document.querySelector('.sidebar a[href="/improvement"]');
          const close = document.querySelector('.monthly-close-card');
          const closeButton = close?.querySelector('.btn');
          const closeLongCopy = close
            ? [close.querySelector('h2'), close.querySelector('ol'), close.querySelector('.monthly-close-note')].filter(Boolean)
            : [];
          const badges = [...document.querySelectorAll('.sidebar .nav-badge')];
          const main = document.querySelector('main');
          const mainBox = box(main);
          const viewportWidth = document.documentElement.clientWidth;
          const headerGroups = [
            document.querySelector('.header-location'),
            document.querySelector('.header-period'),
            document.querySelector('.header-status'),
            document.querySelector('.header-actions'),
          ].map(box).filter(Boolean);
          const headerText = [
            ...document.querySelectorAll('.header-location span'),
            ...document.querySelectorAll('.header-period button, .header-period summary'),
            ...document.querySelectorAll('.header-status > *'),
            ...document.querySelectorAll('.header-actions button, .header-actions a'),
          ];
          const regions = [document.querySelector('.header'), main, document.querySelector('.review-action-bar')]
            .map(box)
            .filter(Boolean);
          const tableBoxesFit = [...document.querySelectorAll('main .scroll-x')].every((scroller) =>
            insideHorizontally(box(scroller), mainBox),
          );
          return {
            rail,
            pageRegionsFit: regions.every((region) => region.left >= -1 && region.right <= viewportWidth + 1),
            tableBoxesFit,
            headerGroupsDoNotOverlap: headerGroups.every((group, index) =>
              headerGroups.slice(0, index).every((previous) => !overlaps(previous, group)),
            ),
            headerTextSingleLine: headerText.every(textNodesSingleLine),
            sidebarFits:
              !rail ||
              (Boolean(sidebar) &&
                sidebar.scrollWidth <= sidebar.clientWidth + 1 &&
                insideHorizontally(box(brandMark), sidebarContentBox)),
            brandCompact:
              !rail ||
              (insideHorizontally(box(brandMark), sidebarContentBox) &&
                box(brandCopy)?.width <= 1 &&
                !overlaps(box(brandMark), box(firstNavIcon))),
            badgeDots:
              !rail ||
              badges.every((badge) => {
                const badgeBox = box(badge);
                const iconBox = box(badge.closest('a')?.querySelector('.route-icon'));
                return (
                  badgeBox.width <= 9 &&
                  badgeBox.height <= 9 &&
                  insideHorizontally(badgeBox, sidebarContentBox) &&
                  !overlaps(badgeBox, iconBox)
                );
              }),
            closeCompact:
              !rail ||
              !close ||
              (close.scrollWidth <= close.clientWidth + 1 &&
                insideHorizontally(box(close), sidebarContentBox) &&
                lineCount(close.querySelector('.monthly-close-count')) <= 1 &&
                closeLongCopy.every((node) => box(node)?.width <= 1) &&
                (!closeButton ||
                  (box(closeButton)?.width >= 43 &&
                    box(closeButton)?.width <= 45 &&
                    box(closeButton)?.height >= 43 &&
                    box(closeButton)?.height <= 45))),
            improvementDelegated:
              !rail ||
              (getComputedStyle(improvement).display === 'none' &&
                Boolean(improvementNav) &&
                box(improvementNav)?.height >= 43),
            noVerticalRailCopy:
              !rail ||
              (lineCount(close?.querySelector('.monthly-close-count')) <= 1 &&
                [...document.querySelectorAll('.sidebar .nav-label')].every(
                  (label) => box(label)?.width <= 1 && getComputedStyle(label).whiteSpace === 'nowrap',
                )),
            diagnostics: !rail
              ? null
              : {
                  sidebar: { box: sidebarBox, clientWidth: sidebar?.clientWidth, scrollWidth: sidebar?.scrollWidth },
                  badges: badges.map((badge) => ({
                    box: box(badge),
                    icon: box(badge.closest('a')?.querySelector('.route-icon')),
                  })),
                  close: {
                    box: box(close),
                    scrollWidth: close?.scrollWidth,
                    clientWidth: close?.clientWidth,
                    countLines: lineCount(close?.querySelector('.monthly-close-count')),
                    longCopy: closeLongCopy.map(box),
                    button: box(closeButton),
                  },
                },
          };
        })(),
        figures: [...document.querySelectorAll('[data-financial-figure]')].map((figure) => {
          const canvas = figure.querySelector('.financial-figure__chart canvas');
          const box = canvas?.getBoundingClientRect();
          return {
            title: figure.querySelector('.financial-figure__caption h2, .financial-figure__caption h3, .financial-figure__caption h4')?.textContent?.trim() ?? '',
            heading: Boolean(figure.querySelector('.financial-figure__caption h2, .financial-figure__caption h3, .financial-figure__caption h4')?.textContent?.trim()),
            summary: Boolean(figure.querySelector('[data-financial-summary]')?.textContent?.trim()),
            period: Boolean(figure.querySelector('[data-financial-period]')?.textContent?.trim()),
            unit: Boolean(figure.querySelector('[data-financial-unit]')?.textContent?.trim()),
            series: Boolean(figure.querySelector('[data-financial-series] li')?.textContent?.trim()),
            action: Boolean(figure.querySelector('[data-financial-action]')?.textContent?.trim()),
            table: Boolean(figure.querySelector('.financial-figure__details table, .heatmap-scroll table')),
            canvas: Boolean(canvas && canvas.width > 0 && canvas.height > 0 && box && box.width > 0 && box.height > 0),
          };
        }),
        trends: (() => {
          const conditions = document.querySelector('section[aria-label="比較条件"]');
          const conditionLabels = [...(conditions?.querySelectorAll('[role="tablist"], [role="group"]') ?? [])]
            .map((group) => group.getAttribute('aria-label'))
            .filter(Boolean);
          const visibleConditionLabels = [...(conditions?.querySelectorAll('.trends-condition-label') ?? [])]
            .map((label) => label.textContent?.trim())
            .filter(Boolean);
          const headers = [...document.querySelectorAll('.trends-table thead th')]
            .map((cell) => cell.textContent?.trim())
            .filter(Boolean);
          const initialAction = document.querySelector('.trends-detail-action');
          const rect = (node) => {
            const value = node?.getBoundingClientRect();
            return value && value.width > 0 && value.height > 0
              ? {
                  left: value.left,
                  right: value.right,
                  top: value.top,
                  bottom: value.bottom,
                  width: value.width,
                  height: value.height,
                }
              : null;
          };
          const categoryTable = document.querySelector('.trends-table');
          const categoryWrap = categoryTable?.closest('.scroll-x');
          const categoryHead = categoryTable?.querySelector('thead');
          const headerCells = [...(categoryTable?.querySelectorAll('thead th') ?? [])];
          const firstRowCells = [...(categoryTable?.querySelectorAll('tbody tr:first-child > th, tbody tr:first-child > td') ?? [])];
          const firstCategoryButton = categoryTable?.querySelector('.trends-category-button, tbody tr:first-child button');
          const sortButtons = [...(categoryTable?.querySelectorAll('thead .th-sort') ?? [])];
          const mobileSort = categoryWrap?.querySelector('.trends-category-sort-mobile select');
          const categoryNames = [...(categoryTable?.querySelectorAll('.trends-category-name') ?? [])];
          const categoryLineCount = (node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return range.getClientRects().length;
          };
          const categoryNameLines = categoryNames.map((node) => ({
            name: node.textContent?.trim() ?? '',
            lines: categoryLineCount(node),
          }));
          const longestCategoryName = categoryNames.reduce(
            (longest, current) =>
              (current.textContent?.length ?? 0) > (longest?.textContent?.length ?? 0) ? current : longest,
            null,
          );
          const categoryWrapBox = rect(categoryWrap);
          const categoryTableBox = rect(categoryTable);
          const categoryHeadBox = rect(categoryTable?.querySelector('thead'));
          const firstCategoryRowBox = rect(categoryTable?.querySelector('tbody > tr'));
          const headerBoxes = headerCells.map(rect).filter(Boolean);
          const cellWidths = firstRowCells.map((cell) => cell.getBoundingClientRect().width);
          const metricWidths = cellWidths.slice(2);
          const firstBodyCellBox = rect(firstRowCells[0]);
          const lastBodyCell = firstRowCells.at(-1);
          const lastBodyCellBox = rect(lastBodyCell);
          const lastBodyContentBox = (() => {
            if (!lastBodyCell) return null;
            const range = document.createRange();
            range.selectNodeContents(lastBodyCell);
            const box = range.getBoundingClientRect();
            return box.width > 0 || box.height > 0 ? box : null;
          })();
          const firstSortStyle = sortButtons[0] ? getComputedStyle(sortButtons[0]) : null;
          const lastSortStyle = sortButtons.at(-1) ? getComputedStyle(sortButtons.at(-1)) : null;
          const categoryMode = categoryHead && getComputedStyle(categoryHead).position === 'absolute' ? 'cards' : 'table';
          const categoryLayout = {
            mode: categoryMode,
            wrapperWidth: categoryWrap?.clientWidth ?? 0,
            wrapperScrollWidth: categoryWrap?.scrollWidth ?? 0,
            wrapperHeight: categoryWrap?.clientHeight ?? 0,
            wrapperScrollHeight: categoryWrap?.scrollHeight ?? 0,
            wrapperMaxHeight: categoryWrap ? getComputedStyle(categoryWrap).maxHeight : '',
            wrapperOverflowX: categoryWrap ? getComputedStyle(categoryWrap).overflowX : '',
            wrapperOverflowY: categoryWrap ? getComputedStyle(categoryWrap).overflowY : '',
            tableWidth: categoryTableBox?.width ?? 0,
            categoryWidth: cellWidths[0] ?? 0,
            sparkColumnWidth: cellWidths[1] ?? 0,
            sparkWidth: categoryTable?.querySelector('.spark')?.getBoundingClientRect().width ?? 0,
            metricWidths,
            metricWidthSpread: metricWidths.length ? Math.max(...metricWidths) - Math.min(...metricWidths) : 0,
            rightInset:
              categoryWrapBox && categoryTableBox ? categoryWrapBox.right - categoryTableBox.right : 0,
            leftInset:
              categoryWrapBox && categoryTableBox ? categoryTableBox.left - categoryWrapBox.left : 0,
            edgeContentInsets: {
              bodyLeft:
                firstBodyCellBox && firstCategoryButton
                  ? firstCategoryButton.getBoundingClientRect().left - firstBodyCellBox.left
                  : 0,
              bodyRight:
                lastBodyCellBox && lastBodyContentBox
                  ? lastBodyCellBox.right - lastBodyContentBox.right
                  : 0,
              headerLeft: firstSortStyle ? Number.parseFloat(firstSortStyle.paddingLeft) : 0,
              headerRight: lastSortStyle ? Number.parseFloat(lastSortStyle.paddingRight) : 0,
            },
            firstRowBelowHeader:
              categoryMode === 'cards' ||
              Boolean(
                categoryHeadBox &&
                  firstCategoryRowBox &&
                  firstCategoryRowBox.top >= categoryHeadBox.bottom - 1,
              ),
            headersInside:
              categoryMode === 'cards' ||
              (headerBoxes.length === 8 &&
                headerBoxes.every(
                  (header) =>
                    categoryWrapBox &&
                    header.left >= categoryWrapBox.left - 1 &&
                    header.right <= categoryWrapBox.right + 1,
                )),
            horizontalFit:
              Boolean(categoryWrap && categoryTableBox && categoryWrapBox) &&
              categoryWrap.scrollWidth <= categoryWrap.clientWidth + 1 &&
              categoryTableBox.left >= categoryWrapBox.left - 1 &&
              categoryTableBox.right <= categoryWrapBox.right + 1,
            singlePageScroll:
              Boolean(categoryWrap) &&
              categoryWrap.scrollHeight <= categoryWrap.clientHeight + 1 &&
              getComputedStyle(categoryWrap).maxHeight === 'none',
            leftActionFits: (() => {
              const buttonBox = rect(firstCategoryButton);
              const firstCellBox = rect(firstRowCells[0]);
              return Boolean(
                buttonBox &&
                  firstCellBox &&
                  buttonBox.left >= firstCellBox.left - 1 &&
                  buttonBox.right <= firstCellBox.right + 1 &&
                  buttonBox.height >= 44,
              );
            })(),
            singleLeftAction:
              categoryTable?.querySelectorAll('tbody tr:first-child > th button').length === 1 &&
              Boolean(firstCategoryButton?.querySelector('.trends-category-name[title]')) &&
              Boolean(firstCategoryButton?.querySelector('.pill')),
            sortControls:
              categoryMode === 'cards'
                ? Boolean(mobileSort && getComputedStyle(mobileSort).display !== 'none')
                : sortButtons.length === 8 && sortButtons.every((button) => button.getBoundingClientRect().height >= 43),
            horizontalFallback:
              categoryWrap != null && ['auto', 'scroll'].includes(getComputedStyle(categoryWrap).overflowX),
            longCategoryReadable:
              Boolean(longestCategoryName) &&
              longestCategoryName.scrollWidth <= longestCategoryName.clientWidth + 1 &&
              longestCategoryName.scrollHeight <= longestCategoryName.clientHeight + 1 &&
              getComputedStyle(longestCategoryName).whiteSpace !== 'nowrap',
            categoryNameLines,
            naturalNameWrapping:
              categoryMode === 'cards' ||
              (categoryNameLines.every(({ name, lines }) => (name.length <= 8 ? lines === 1 : lines <= 3)) &&
                categoryNameLines.some(({ name, lines }) => name.length > 8 && lines >= 2)),
          };
          return {
            conditionLabels,
            visibleConditionLabels,
            legacyJudgementAbsent: !document.querySelector('details.trends-judgement'),
            categoryHeaders: headers,
            initialAction: initialAction?.textContent?.trim() ?? '',
            initialActionHref: initialAction?.getAttribute('href') ?? '',
            categoryLayout,
          };
        })(),
        subscriptionDatasetCount: Number(document.querySelector('[data-financial-dataset-count]')?.getAttribute('data-financial-dataset-count') ?? 0),
        subscriptionDatasetLabels: document.querySelector('[data-financial-dataset-labels]')?.getAttribute('data-financial-dataset-labels') ?? '',
        subscriptionSummaryLabels: [...document.querySelectorAll('[data-financial-series] li')].map((item) => item.textContent?.trim() ?? '').join('|'),
        overview: (() => {
          const exact = (selector, text) =>
            [...document.querySelectorAll(selector)].find((node) => node.textContent?.trim() === text) ?? null;
          const rect = (node) => {
            const box = node?.getBoundingClientRect();
            return box && box.width > 0 && box.height > 0
              ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
              : null;
          };
          const hero = exact('h1', '今月の収支と、次に直すことは？');
          const income = exact('main div, main dt, main span', '総収入');
          const trend = exact('h2', '月次の収入・支出・純収支の推移');
          const review = exact('h2', '未処理の内訳');
          const priority = [...document.querySelectorAll('h2')].find((heading) =>
            heading.textContent?.trim().startsWith('優先して確認する明細'),
          );
          const summaryBox = rect(review?.closest('section'));
          const priorityBox = rect(priority?.closest('section'));
          const detailBox = rect(document.querySelector('aside[aria-label="選択中の明細"]'));
          const priorityScroll = document.querySelector('.review-priority .scroll-x');
          const priorityTable = document.querySelector('.review-priority-table');
          const reviewRows = [...document.querySelectorAll('.review-priority-table tbody tr')];
          const reviewHeaders = [...document.querySelectorAll('.review-priority-table thead th')];
          const kpiComparisons = [...document.querySelectorAll('.overview-kpi-strip .kpi-comparison')];
          const breakdownItems = [...document.querySelectorAll('.overview-breakdown .breakdown-list li')];
          const headerLocation = document.querySelector('.header-location');
          const headerPeriod = document.querySelector('.header-period');
          const headerActions = document.querySelector('.header-actions');
          const heroBox = rect(hero);
          const incomeBox = rect(income);
          const trendBox = rect(trend);
          const reviewBox = rect(review);
          const sidebarBrandBox = rect(document.querySelector('.sidebar .brand'));
          const headerBrandBox = rect(document.querySelector('.header-brand'));
          // 目標画像の固定ピクセルではなく、読む順序・非重複・同じ段にあることだけを契約にする。
          const verticalOverlap = (a, b) =>
            a && b ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0 : false;
          const reviewScrollContract = (() => {
            if (!priorityScroll || !priorityTable || !reviewHeaders.length || !reviewRows.length)
              return { contained: false, allColumns: false, aligned: false, stickyHeader: false, stickyState: false };
            const expectedHeaders = ['状態', '日付', '内容', '金額', '推奨', '信頼度'];
            const allColumns = reviewHeaders.map((header) => header.textContent?.trim() ?? '').join('|') === expectedHeaders.join('|') &&
              reviewHeaders.every((header) => getComputedStyle(header).display !== 'none');
            const firstCells = [...reviewRows[0].cells];
            const aligned = reviewHeaders.every((header, index) => {
              const headerBox = header.getBoundingClientRect();
              const cellBox = firstCells[index]?.getBoundingClientRect();
              return cellBox && Math.abs(headerBox.left - cellBox.left) <= 1 && Math.abs(headerBox.width - cellBox.width) <= 1;
            });
            const scrollBox = priorityScroll.getBoundingClientRect();
            const contained = Boolean(priorityBox) && priorityScroll.scrollWidth >= priorityScroll.clientWidth &&
              scrollBox.left >= priorityBox.left - 1 && scrollBox.right <= priorityBox.right + 1;
            const originalLeft = priorityScroll.scrollLeft;
            const originalTop = priorityScroll.scrollTop;
            const originalMaxHeight = priorityScroll.style.maxHeight;
            priorityScroll.scrollLeft = priorityScroll.scrollWidth;
            const stateHeaderBox = reviewHeaders[0].getBoundingClientRect();
            const stateBadgeBox = reviewRows[0].querySelector('.review-row-status')?.getBoundingClientRect();
            const stickyState = stateHeaderBox.left >= scrollBox.left - 1 &&
              stateHeaderBox.right <= scrollBox.right + 1 &&
              stateBadgeBox && stateBadgeBox.left >= scrollBox.left - 1 && stateBadgeBox.right <= scrollBox.right + 1;
            priorityScroll.style.maxHeight = '120px';
            priorityScroll.scrollTop = priorityScroll.scrollHeight;
            const stickyHeaderBox = reviewHeaders[0].getBoundingClientRect();
            const stickyHeader = Math.abs(stickyHeaderBox.top - priorityScroll.getBoundingClientRect().top) <= 2;
            priorityScroll.scrollLeft = originalLeft;
            priorityScroll.scrollTop = originalTop;
            priorityScroll.style.maxHeight = originalMaxHeight;
            return { contained, allColumns, aligned, stickyHeader, stickyState: Boolean(stickyState) };
          })();
          return {
            desktopBrandUnique: Boolean(sidebarBrandBox) && !headerBrandBox,
            mobileHeaderBrand: Boolean(headerBrandBox),
            hasGenericProgress: Boolean(document.querySelector('.sidebar .workflow-progress')),
            sectionOrder:
              Boolean(heroBox && incomeBox && trendBox && reviewBox) &&
              heroBox.top < incomeBox.top &&
              incomeBox.top < trendBox.top &&
              trendBox.top < reviewBox.top,
            threeReviewColumns:
              Boolean(summaryBox && priorityBox && detailBox) &&
              summaryBox.right <= priorityBox.left + 1 &&
              priorityBox.right <= detailBox.left + 1 &&
              verticalOverlap(summaryBox, priorityBox) &&
              verticalOverlap(priorityBox, detailBox),
            reviewTableContract: reviewScrollContract,
            kpiComparisonComplete:
              kpiComparisons.length === 3 &&
              kpiComparisons.every((note) => /[+−]¥[\\d,]+/.test(note.textContent ?? '') && /[+−-]?\\d+\\.\\d%/.test(note.textContent ?? '') && /前\\d+か月\\s+¥[\\d,]+/.test(note.textContent ?? '')),
            breakdownComplete:
              breakdownItems.length === 6 &&
              breakdownItems.every((item) => /^.+¥[\\d,]+\\d+\\.\\d%$/.test((item.textContent ?? '').replaceAll(/\\s/g, ''))) &&
              new Set(breakdownItems.map((item) => getComputedStyle(item.querySelector('.breakdown-bar > span')).backgroundColor)).size >= 5,
            comparisonColumns:
              [...(exact('h2', '前年との比較')?.closest('.card')?.querySelectorAll('thead th') ?? [])]
                .map((header) => header.textContent?.trim() ?? '')
                .join('|') === '項目|直近8か月|前8か月|増減|増減率',
            reviewRowsDoNotOverlap: reviewRows.every((row) => {
              const cells = [...row.cells].map(rect).filter(Boolean);
              return cells.every((cell, index) => index === 0 || cells[index - 1].right <= cell.left + 1);
            }),
            reviewRowsCompact: reviewRows.every((row) => row.getBoundingClientRect().height <= 96),
            distinctReviewStates:
              document.querySelector('.review-priority-table .review-row-status.danger')?.textContent?.trim() ===
                '不一致' &&
              document.querySelector('.review-priority-table .review-row-status.warning')?.textContent?.trim() ===
                '要仕分け' &&
              Boolean(document.querySelector('.review-priority-table .review-row-status.danger svg circle')) &&
              Boolean(document.querySelector('.review-priority-table .review-row-status.warning svg > path')),
            headerGroupsDoNotOverlap: (() => {
              const groups = [headerLocation, headerPeriod, headerActions].map(rect).filter(Boolean);
              return groups.every((group, index) =>
                groups.slice(0, index).every(
                  (previous) =>
                    previous.right <= group.left + 1 ||
                    group.right <= previous.left + 1 ||
                    previous.bottom <= group.top + 1 ||
                    group.bottom <= previous.top + 1,
                ),
              );
            })(),
            breadcrumbFits:
              Boolean(headerLocation) && headerLocation.scrollWidth <= headerLocation.clientWidth + 1,
          };
        })(),
        totalCashflow: (() => {
          const scroller = document.querySelector('.tcf-workbench-main');
          const table = scroller?.querySelector('table.data');
          const headers = [...(table?.querySelectorAll('thead th') ?? [])];
          const rows = [...(table?.querySelectorAll('tbody tr') ?? [])];
          const tabs = document.querySelector('.tcf-workbench-tabs');
          const detail = document.querySelector('.tcf-detail');
          const selection = document.querySelector('.tcf-selection-bar');
          const body = document.querySelector('.tcf-workbench-body');
          const box = (node) => {
            const value = node?.getBoundingClientRect();
            return value
              ? { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height }
              : null;
          };
          const opaque = (value) => value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)';
          if (!scroller || !table || !headers.length || !rows.length || !tabs || !detail || !selection || !body)
            return {
              present: false,
              viewport: false,
              stickyHeader: false,
              paneContext: false,
              selectionContext: false,
              responsive: false,
            };

          const compact = matchMedia('(max-width: 640px)').matches;
          const desktop = matchMedia('(min-width: 901px)').matches;
          const scrollerStyle = getComputedStyle(scroller);
          const headerStyle = getComputedStyle(headers[0]);
          const tabsStyle = getComputedStyle(tabs);
          const detailStyle = getComputedStyle(detail);
          const selectionStyle = getComputedStyle(selection);
          const bodyStyle = getComputedStyle(body);
          const scrollerBox = box(scroller);
          const tabsBefore = box(tabs);
          const detailBefore = box(detail);
          const originalTop = scroller.scrollTop;
          if (!compact) scroller.scrollTop = scroller.scrollHeight;
          const scrolledTop = scroller.scrollTop;
          const headerAfter = box(headers[0]);
          const tabsAfter = box(tabs);
          const detailAfter = box(detail);
          scroller.scrollTop = originalTop;

          const stableContext = (before, after) =>
            Boolean(before && after && Math.abs(before.top - after.top) <= 1 && Math.abs(before.left - after.left) <= 1);
          const cardLabels = rows.every((row) =>
            [...row.cells].every((cell) => Boolean(cell.dataset.label?.trim())),
          );
          const paneOrder = (() => {
            const tabsBox = box(tabs);
            const mainBox = box(scroller);
            const detailBox = box(detail);
            if (!tabsBox || !mainBox || !detailBox) return false;
            return desktop
              ? tabsBox.right <= mainBox.left + 1 && mainBox.right <= detailBox.left + 1
              : tabsBox.bottom <= mainBox.top + 1 && mainBox.bottom <= detailBox.top + 1;
          })();
          return {
            present: true,
            viewport: compact
              ? scrollerStyle.overflow === 'visible' && cardLabels
              : scroller.scrollHeight > scroller.clientHeight + 1 &&
                ['auto', 'scroll'].includes(scrollerStyle.overflowY) &&
                scrollerStyle.scrollbarGutter.startsWith('stable') &&
                Number.parseFloat(scrollerStyle.scrollPaddingBlockStart) > 0,
            stickyHeader: compact
              ? getComputedStyle(table.querySelector('thead')).position === 'absolute' && cardLabels
              : scrolledTop > 0 &&
                Boolean(scrollerBox && headerAfter) &&
                Math.abs(headerAfter.top - scrollerBox.top) <= 2 &&
                headerStyle.position === 'sticky' &&
                Number.parseInt(headerStyle.zIndex, 10) >= 3 &&
                opaque(headerStyle.backgroundColor),
            paneContext:
              paneOrder &&
              stableContext(tabsBefore, tabsAfter) &&
              stableContext(detailBefore, detailAfter) &&
              (desktop
                ? tabsStyle.position === 'sticky' && detailStyle.position === 'sticky'
                : tabsStyle.position !== 'sticky' && detailStyle.position === 'static'),
            selectionContext:
              selectionStyle.position === 'sticky' &&
              Number.parseInt(selectionStyle.zIndex, 10) >= 20 &&
              opaque(selectionStyle.backgroundColor),
            responsive:
              bodyStyle.display === 'grid' &&
              (desktop
                ? bodyStyle.gridTemplateColumns.split(' ').length === 3
                : bodyStyle.gridTemplateColumns.split(' ').length === 1),
          };
        })(),
        reconciliation: (() => {
          const rect = (node) => {
            const box = node?.getBoundingClientRect();
            return box && box.width > 0 && box.height > 0
              ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width }
              : null;
          };
          const side = rect(document.querySelector('.recon-side'));
          const list = rect(document.querySelector('.recon-list'));
          const detail = rect(document.querySelector('.recon-detail'));
          const active = document.querySelector('.recon-table tr.is-active');
          const summaryRows = [...document.querySelectorAll('.recon-summary')].map(
            (summary) => summary.querySelector('tbody')?.rows.length ?? 0,
          );
          const hiddenSecondaryColumns = [6, 7, 8].every((column) => {
            const header = document.querySelector('.recon-table thead th:nth-child(' + column + ')');
            return !header || getComputedStyle(header).display === 'none';
          });
          const verticalOverlap = (a, b) =>
            Boolean(a && b && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0);
          const tableScroll = (() => {
            const scroller = document.querySelector('.recon-table')?.closest('.scroll-x');
            if (!scroller) return { exists: false, overflow: false, movable: false, contained: false };
            const listBox = document.querySelector('.recon-list')?.getBoundingClientRect();
            const scrollBox = scroller.getBoundingClientRect();
            const original = scroller.scrollLeft;
            const overflow = scroller.scrollWidth > scroller.clientWidth + 1;
            scroller.scrollLeft = 0;
            scroller.scrollLeft = scroller.scrollWidth;
            const movable = !overflow || scroller.scrollLeft > 1;
            scroller.scrollLeft = original;
            return {
              exists: true,
              overflow,
              movable,
              contained: Boolean(
                listBox &&
                  scrollBox.left >= listBox.left - 1 &&
                  scrollBox.right <= listBox.right + 1
              ),
            };
          })();
          const rowOpenTargets = [...document.querySelectorAll('.recon-row-open')];
          const visible = (node) => {
            const box = node?.getBoundingClientRect();
            return Boolean(box && box.width > 0 && box.height > 0);
          };
          const choiceControls = [
            ...document.querySelectorAll('.recon input[type="checkbox"], .recon input[type="radio"]'),
          ].filter(visible);
          const controlContract = choiceControls.map((control) => {
            const indicator = control.nextElementSibling?.matches('.recon-control-indicator')
              ? control.nextElementSibling
              : null;
            const box = indicator?.getBoundingClientRect();
            const hitTarget = control.closest('label, .recon-radio') ?? control;
            const hitBox = hitTarget.getBoundingClientRect();
            return {
              type: control.type,
              label: control.getAttribute('aria-label') ?? '',
              width: box?.width ?? 0,
              height: box?.height ?? 0,
              hitWidth: hitBox.width,
              hitHeight: hitBox.height,
              labeled: Boolean(control.closest('label, .recon-radio')),
            };
          });
          const selectionCells = [...document.querySelectorAll('.recon-table tbody tr')].map(
            (row) => row.cells[0],
          );
          const selectionCellWidths = [
            document.querySelector('.recon-table thead th:first-child'),
            ...selectionCells,
          ]
            .filter(Boolean)
            .map((cell) => cell.getBoundingClientRect().width);
          return {
            hasMasterDetail: Boolean(list && detail && active),
            candidateFiltersClear:
              [...document.querySelectorAll('.recon-filters fieldset')].some((fieldset) =>
                fieldset.querySelector('legend')?.textContent?.trim() === 'freee\u5019\u88dc' &&
                Boolean(fieldset.querySelector('input[aria-label="\u5019\u88dc\u306a\u3057"]')) &&
                Boolean(fieldset.querySelector('input[aria-label="\u5019\u88dc\u3042\u308a"]')) &&
                !fieldset.textContent?.includes('MoneyForward\u306e\u307f')
              ),
            noDisabledRowSelectors:
              document.querySelectorAll('.recon-table tbody input[type="checkbox"]:disabled').length === 0,
            rowOpenTargetsReachable:
              rowOpenTargets.length > 0 &&
              rowOpenTargets.every((button) => button.getBoundingClientRect().height >= 43),
            fixtureCountsVisible:
              document.querySelector('.recon-radio input[aria-label="要確認 39"]') !== null &&
              document.querySelector('.recon-radio input[aria-label="照合済み 41"]') !== null &&
              document.querySelector('.recon-radio input[aria-label="MFのみ 42"]') !== null,
            controlContract,
            controlVisualSizes:
              controlContract.length > 0 &&
              controlContract.every(
                (control) =>
                  control.width >= 16 &&
                  control.width <= 20 &&
                  control.height >= 16 &&
                  control.height <= 20,
              ),
            controlHitAreas:
              controlContract.length > 0 &&
              controlContract.every((control) => control.hitWidth >= 44 && control.hitHeight >= 44),
            selectionColumnConsistent:
              selectionCells.length > 0 &&
              selectionCells.every(
                (cell) => {
                  const available = cell.querySelectorAll(
                    '.recon-selection-hit:not(.recon-selection-hit--unavailable) input[type="checkbox"]',
                  ).length;
                  const unavailable = cell.querySelectorAll(
                    '.recon-selection-hit--unavailable .recon-selection-placeholder',
                  ).length;
                  return available + unavailable === 1;
                },
              ) &&
              Math.max(...selectionCellWidths) - Math.min(...selectionCellWidths) <= 1,
            tableScroll,
            previewCapped: summaryRows.length === 2 && summaryRows.every((count) => count <= 3),
            desktopThreeColumns:
              Boolean(side && list && detail) &&
              side.right <= list.left + 1 &&
              list.right <= detail.left + 1 &&
              verticalOverlap(side, list) &&
              verticalOverlap(list, detail),
            stackedMasterDetail: Boolean(list && detail) && detail.top >= list.bottom - 1,
            compactMobileColumns: hiddenSecondaryColumns,
          };
        })(),
        legend: [...document.querySelectorAll('[data-financial-figure]')].map((figure) => ({
          // アンカーを持たない図は、結論のid「model.id + useIdの値 + summary」から model.id を復元する
          key: figure.id || (figure.querySelector('[data-financial-summary]')?.id ?? '').split('-').slice(0, -2).join('-'),
          chips: [...figure.querySelectorAll('[data-financial-series] li')].map((item) => ({
            label: item.textContent?.trim() ?? '',
            color: item.querySelector('span')?.style.getPropertyValue('--series-color') ?? '',
          })),
        })),
      }))())`),
        );
        if (routeMetrics.pageWidth > routeMetrics.viewportWidth + 1)
          failures.push(`${tag} ${route.name}ページ本体が横にはみ出す`);
        if (!routeMetrics.shell.pageRegionsFit)
          failures.push(`${tag} ${route.name} のheader・main・sticky actionがviewportをはみ出す`);
        if (!routeMetrics.shell.tableBoxesFit)
          failures.push(`${tag} ${route.name} の表containerがmainをはみ出す`);
        if (!routeMetrics.shell.headerGroupsDoNotOverlap)
          failures.push(`${tag} ${route.name} のheader群が重なる`);
        if (!routeMetrics.shell.headerTextSingleLine)
          failures.push(`${tag} ${route.name} のheader文言が複数行に分断される`);
        if (!routeMetrics.shell.sidebarFits)
          failures.push(`${tag} ${route.name} のsidebar内部が横にはみ出す`);
        if (!routeMetrics.shell.brandCompact)
          failures.push(`${tag} ${route.name} のrail brandが欠けるかnavと重なる`);
        if (!routeMetrics.shell.badgeDots)
          failures.push(`${tag} ${route.name} のrail badgeがiconまたはscrollbarと重なる`);
        if (!routeMetrics.shell.closeCompact)
          failures.push(`${tag} ${route.name} のrail月次進捗が縮約されていない`);
        if (!routeMetrics.shell.improvementDelegated)
          failures.push(`${tag} ${route.name} のrail改善操作が既存navへ安全に委譲されていない`);
        if (!routeMetrics.shell.noVerticalRailCopy)
          failures.push(`${tag} ${route.name} のrail文言が縦1文字に分断される`);
        if (
          route.name === 'Overview' &&
          routeMetrics.shell.rail &&
          (!routeMetrics.shell.badgeDots || !routeMetrics.shell.closeCompact)
        )
          console.log(`${tag} rail diagnostics ${JSON.stringify(routeMetrics.shell.diagnostics)}`);
        if (runtimeProblems.length)
          failures.push(`${tag} ${route.name} console/runtime error: ${runtimeProblems.join(' / ')}`);
        const expectedFigureTitles = route.expectedFigureTitles ?? null;
        const figuresMatch = expectedFigureTitles
          ? JSON.stringify(routeMetrics.figures.map((figure) => figure.title)) ===
            JSON.stringify(expectedFigureTitles)
          : routeMetrics.figures.length === route.expectedFigures;
        if (
          !figuresMatch ||
          routeMetrics.figures.some((contract) => Object.values(contract).some((value) => !value))
        )
          failures.push(
            `${tag} ${route.name} 見出し・結論・期間・単位・系列・次の行動・正確な表・実canvasが不足`,
          );
        if (
          route.name === 'Trends' &&
          (routeMetrics.trends.conditionLabels.join('|') !== '集計の範囲|表示する指標|比較対象' ||
            routeMetrics.trends.visibleConditionLabels.join('|') !== '分析の範囲|表示する指標|比較対象' ||
            !routeMetrics.trends.legacyJudgementAbsent ||
            routeMetrics.trends.categoryHeaders.join('|') !==
              'カテゴリ|12か月の推移|今回合計|比較期間|増減額|増減率|構成比|寄与度' ||
            routeMetrics.trends.initialAction !== '広告宣伝費の該当明細を開く' ||
            !routeMetrics.trends.initialActionHref.includes('month='))
        )
          failures.push(
            `${tag} Trends の比較条件、8列表、初期CTA、旧判定非重複、または主要2図構成が崩れている (${JSON.stringify(routeMetrics.trends)})`,
          );
        if (route.name === 'Trends') {
          const layout = routeMetrics.trends.categoryLayout;
          const edgeInsets = Object.values(layout.edgeContentInsets);
          const tableContract =
            layout.mode === 'cards' ||
            (layout.headersInside &&
              layout.leftInset >= 12 &&
              layout.rightInset >= 12 &&
              layout.firstRowBelowHeader &&
              layout.categoryWidth >= 180 &&
              layout.categoryWidth <= 245 &&
              layout.sparkColumnWidth >= 84 &&
              layout.sparkColumnWidth <= 168 &&
              layout.metricWidths.length === 6 &&
              layout.metricWidths.every((value) => value >= 96 && value <= 225) &&
              edgeInsets.every((value) => value >= 15.5 && value <= 24));
          if (
            !layout.horizontalFit ||
            !layout.firstRowBelowHeader ||
            !layout.singlePageScroll ||
            !layout.leftActionFits ||
            !layout.singleLeftAction ||
            !layout.sortControls ||
            !layout.horizontalFallback ||
            !layout.longCategoryReadable ||
            !layout.naturalNameWrapping ||
            !tableContract
          )
            failures.push(
              `${tag} Trends のカテゴリ表で列幅・8ヘッダ・単一縦スクロール・左端44px操作の契約が崩れている (${JSON.stringify(layout)})`,
            );
          console.log(`${tag} Trendsカテゴリ表 ${JSON.stringify(layout)}`);
        }
        if (route.name === 'Overview' && zoom === 1 && width === 1280) {
          if (!routeMetrics.overview.desktopBrandUnique)
            failures.push('1280px Overview で Focus Ledger がサイドバーとヘッダーに重複している');
          if (routeMetrics.overview.hasGenericProgress)
            failures.push('1280px Overview にサイドバーの汎用月次進捗が残っている');
          if (!routeMetrics.overview.sectionOrder)
            failures.push('1280px Overview の主要セクションが Hero→KPI→Trend→Review の順ではない');
          if (!routeMetrics.overview.threeReviewColumns)
            failures.push('1280px Overview の Review workspace が要約・明細表・詳細の3列になっていない');
        }
        if (route.name === 'Overview') {
          if (Object.values(routeMetrics.overview.reviewTableContract).some((value) => !value))
            failures.push(
              `${tag} Overview の優先明細表で6列・列対応・sticky見出し/状態・内部scroll契約が崩れている`,
            );
          if (!routeMetrics.overview.kpiComparisonComplete)
            failures.push(`${tag} Overview のKPIに符号付き差額・増減率・前期値が揃っていない`);
          if (!routeMetrics.overview.breakdownComplete)
            failures.push(`${tag} Overview の支出内訳が上位5+その他、金額、構成比、識別色を満たさない`);
          if (!routeMetrics.overview.comparisonColumns)
            failures.push(`${tag} Overview の前年比較が今期を含む5列構造ではない`);
          if (!routeMetrics.overview.reviewRowsDoNotOverlap)
            failures.push(`${tag} Overview の優先明細表で列が重なっている`);
          if (!routeMetrics.overview.reviewRowsCompact)
            failures.push(`${tag} Overview の優先明細表で行高が96pxを超えている`);
          if (!routeMetrics.overview.distinctReviewStates)
            failures.push(`${tag} Overview のwarning/dangerが状態語と異なるicon形状で区別できない`);
          if (!routeMetrics.overview.headerGroupsDoNotOverlap)
            failures.push(`${tag} Overview のbreadcrumb・期間・共通操作が重なっている`);
          if (!routeMetrics.overview.breadcrumbFits)
            failures.push(`${tag} Overview のbreadcrumbが省略表示になっている`);
        }
        if (route.name === 'Reconciliation') {
          if (!routeMetrics.reconciliation.hasMasterDetail)
            failures.push(`${tag} Reconciliation の一覧・active行・詳細が同時に成立していない`);
          if (!routeMetrics.reconciliation.candidateFiltersClear)
            failures.push(
              `${tag} Reconciliation の候補有無絞り込みが件数と重複しない明確な名称になっていない`,
            );
          if (!routeMetrics.reconciliation.noDisabledRowSelectors)
            failures.push(`${tag} Reconciliation の対応不要行に押せないチェック欄が残っている`);
          if (!routeMetrics.reconciliation.rowOpenTargetsReachable)
            failures.push(`${tag} Reconciliation の取引内容ボタンが44px相当の操作領域を満たさない`);
          if (!routeMetrics.reconciliation.fixtureCountsVisible)
            failures.push(
              `${tag} Reconciliation の匿名fixture件数(要確認39・照合済み41・MFのみ42)が表示と一致しない`,
            );
          if (!routeMetrics.reconciliation.controlVisualSizes)
            failures.push(
              `${tag} Reconciliation のcheckbox/radio視覚部品が16〜20pxではない: ${JSON.stringify(routeMetrics.reconciliation.controlContract)}`,
            );
          if (!routeMetrics.reconciliation.controlHitAreas)
            failures.push(
              `${tag} Reconciliation のcheckbox/radio操作領域が44px未満: ${JSON.stringify(routeMetrics.reconciliation.controlContract)}`,
            );
          if (!routeMetrics.reconciliation.selectionColumnConsistent)
            failures.push(`${tag} Reconciliation の各行で選択列の構造または列幅が一致しない`);
          if (
            !routeMetrics.reconciliation.tableScroll.exists ||
            !routeMetrics.reconciliation.tableScroll.movable ||
            !routeMetrics.reconciliation.tableScroll.contained
          )
            failures.push(`${tag} Reconciliation の候補表が表枠内で安全に横スクロールできない`);
          if (!reconciliationInteraction?.attempted || !reconciliationInteraction.changed)
            failures.push(`${tag} Reconciliation の別行を実クリックしても詳細が切り替わらない`);
          if (!reconciliationInteraction?.horizontallyScrolled)
            failures.push(`${tag} Reconciliation の候補表が実際の横ホイール操作で動かない`);
          if (
            !reconciliationInteraction?.rowSelected?.rowChecked ||
            reconciliationInteraction.rowSelected.checkedCount !== 1 ||
            reconciliationInteraction.rowSelected.headerChecked ||
            !reconciliationInteraction.rowSelected.headerIndeterminate ||
            reconciliationInteraction.rowSelected.selectionCount !== '1'
          )
            failures.push(
              `${tag} Reconciliation の行checkbox→選択バー/indeterminateが同期しない: ${JSON.stringify(reconciliationInteraction?.rowSelected)}`,
            );
          if (
            reconciliationInteraction?.allSelected?.visibleSelectable <= 0 ||
            reconciliationInteraction?.allSelected?.checkedCount !==
              reconciliationInteraction?.allSelected?.visibleSelectable ||
            !reconciliationInteraction?.allSelected?.headerChecked ||
            reconciliationInteraction?.allSelected?.headerIndeterminate ||
            reconciliationInteraction?.allSelected?.selectionCount !==
              String(reconciliationInteraction?.allSelected?.visibleSelectable)
          )
            failures.push(
              `${tag} Reconciliation のheader全選択が表示中の選択可能件数へ反映されない: ${JSON.stringify(reconciliationInteraction?.allSelected)}`,
            );
          if (
            reconciliationInteraction?.cleared?.checkedCount !== 0 ||
            reconciliationInteraction?.cleared?.headerChecked ||
            reconciliationInteraction?.cleared?.headerIndeterminate ||
            reconciliationInteraction?.cleared?.selectionBar
          )
            failures.push(
              `${tag} Reconciliation のheader全解除で選択状態が残る: ${JSON.stringify(reconciliationInteraction?.cleared)}`,
            );
          if (
            !reconciliationInteraction?.withoutCandidate?.checked ||
            reconciliationInteraction?.withoutCandidate?.heading !== '照合候補一覧42件' ||
            reconciliationInteraction?.withoutCandidate?.rowCount !== 10 ||
            !reconciliationInteraction?.withoutCandidate?.selectionCellsConsistent
          )
            failures.push(
              `${tag} Reconciliation の候補なしradio/42件/選択列が同期しない: ${JSON.stringify(reconciliationInteraction?.withoutCandidate)}`,
            );
          if (
            !reconciliationInteraction?.withCandidate?.checked ||
            reconciliationInteraction?.withCandidate?.heading !== '照合候補一覧80件' ||
            reconciliationInteraction?.withCandidate?.rowCount !== 10 ||
            !reconciliationInteraction?.withCandidate?.selectionCellsConsistent
          )
            failures.push(
              `${tag} Reconciliation の候補ありradio/80件/選択列が同期しない: ${JSON.stringify(reconciliationInteraction?.withCandidate)}`,
            );
          if (
            !reconciliationInteraction?.allCandidates?.checked ||
            reconciliationInteraction?.allCandidates?.heading !== '照合候補一覧122件' ||
            reconciliationInteraction?.allCandidates?.rowCount !== 10
          )
            failures.push(
              `${tag} Reconciliation の検収状態が全122件に復帰しない: ${JSON.stringify(reconciliationInteraction?.allCandidates)}`,
            );
          if (!routeMetrics.reconciliation.previewCapped)
            failures.push(`${tag} Reconciliation の下段summaryが3件previewを超えている`);
          if (zoom === 1 && width >= 1024 && !routeMetrics.reconciliation.desktopThreeColumns)
            failures.push(`${tag} Reconciliation の絞り込み・一覧・詳細が3列になっていない`);
          if (zoom === 1 && width < 1024 && !routeMetrics.reconciliation.stackedMasterDetail)
            failures.push(`${tag} Reconciliation の狭幅master-detailが安全に縦積みされていない`);
          if (zoom === 1 && width <= 767 && !routeMetrics.reconciliation.compactMobileColumns)
            failures.push(`${tag} Reconciliation のモバイル一覧が副次列を縮約していない`);
        }
        if (
          route.name === 'Total cashflow' &&
          Object.values(routeMetrics.totalCashflow).some((value) => !value)
        )
          failures.push(
            `${tag} Total cashflow の3ペイン・内部scroll・sticky見出し・選択操作の文脈が崩れている (${JSON.stringify(routeMetrics.totalCashflow)})`,
          );
        if (
          route.name === 'Overview' &&
          zoom === 1 &&
          width === 375 &&
          !routeMetrics.overview.mobileHeaderBrand
        )
          failures.push('375px Overview でサイドバー非表示時の Focus Ledger ブランドが無い');
        if (
          route.name === 'Subscriptions' &&
          (routeMetrics.subscriptionDatasetCount < 1 || routeMetrics.subscriptionDatasetCount > 7)
        )
          failures.push(
            `${tag} Subscriptionsの実Chart.js系列が${routeMetrics.subscriptionDatasetCount}件で上位6+他Nに収まらない`,
          );
        if (
          route.name === 'Subscriptions' &&
          routeMetrics.subscriptionDatasetLabels !== routeMetrics.subscriptionSummaryLabels
        )
          failures.push(`${tag} Subscriptionsの実canvas凡例と非canvas系列一覧が一致しない`);
        // 凡例チップの色は figure 側の inline --series-color でしか観測できない
        // (Chart.js の instance はモジュールスコープに閉じ、canvas には色しか残らない)。
        // 「系列名で色を引き当てられているか」の厳密な突合は
        // src/mobile-financial-visualization.dom.test.tsx が持ち、ここでは実描画での破れを見る。
        // 対象は「色の引き当てが非自明な図」だけに絞る。値ごとに色が変わる系列(Matrixの増減額など)は
        // 色を持たないのが正しいので、全ルートに一律の規則は置けない。
        // fig-4(waterfall)は増加=赤/減少=緑を1本のデータセットに色配列で塗るため、系列に1色は決まらない。
        const COLORED = { 'AI report': ['fig-2', 'fig-3'], Subscriptions: ['subscriptions-vendor-monthly'] };
        const COLORLESS = { 'AI report': ['fig-4'] };
        for (const figureLegend of routeMetrics.legend) {
          const colored = figureLegend.chips.filter((chip) => chip.color).length;
          const distinct = new Set(figureLegend.chips.map((chip) => chip.color)).size;
          if (COLORLESS[route.name]?.includes(figureLegend.key) && colored > 0)
            failures.push(`${tag} ${route.name} ${figureLegend.key} の凡例が図に無い色を主張している`);
          if (!COLORED[route.name]?.includes(figureLegend.key)) continue;
          if (colored !== figureLegend.chips.length)
            failures.push(
              `${tag} ${route.name} ${figureLegend.key} の凡例チップに色が付いていない(${colored}/${figureLegend.chips.length})`,
            );
          if (distinct < 2)
            failures.push(
              `${tag} ${route.name} ${figureLegend.key} の凡例チップが全て同じ色で、系列と照らし合わせられない`,
            );
        }
        for (const [name, keys] of [...Object.entries(COLORED), ...Object.entries(COLORLESS)])
          if (route.name === name)
            for (const key of keys)
              if (!routeMetrics.legend.some((figureLegend) => figureLegend.key === key))
                failures.push(`${tag} ${route.name} に凡例色の検査対象 ${key} が無い`);
        if (
          route.name === 'Overview' &&
          ((zoom === 1 && [375, 641, 768, 900, 1023, 1024, 1280].includes(width)) || zoom === 2)
        ) {
          const captureLabel = zoom === 1 ? String(width) : viewportLabel;
          const routeShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          writeFileSync(
            join(OUTPUT_DIR, `${route.name.toLowerCase().replaceAll(' ', '-')}-${captureLabel}.png`),
            Buffer.from(routeShot.data, 'base64'),
          );
          await evaluate("document.querySelector('.review-priority')?.scrollIntoView({ block: 'center' })");
          await sleep(150);
          const reviewShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          writeFileSync(
            join(OUTPUT_DIR, `${route.name.toLowerCase().replaceAll(' ', '-')}-${captureLabel}-review.png`),
            Buffer.from(reviewShot.data, 'base64'),
          );
          if (routeMetrics.shell.rail) {
            await evaluate(
              "document.querySelector('.sidebar')?.scrollTo({ top: document.querySelector('.sidebar').scrollHeight })",
            );
            await sleep(150);
            const railBottomShot = await send('Page.captureScreenshot', {
              format: 'png',
              fromSurface: true,
            });
            writeFileSync(
              join(
                OUTPUT_DIR,
                `${route.name.toLowerCase().replaceAll(' ', '-')}-${captureLabel}-rail-bottom.png`,
              ),
              Buffer.from(railBottomShot.data, 'base64'),
            );
          }
        }
        if (route.name === 'Total cashflow' && zoom === 1 && [375, 1280].includes(width)) {
          const routeShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          writeFileSync(
            join(OUTPUT_DIR, `total-cashflow-${width}.png`),
            Buffer.from(routeShot.data, 'base64'),
          );
        }
        if (route.name === 'Trends' && zoom === 1 && [1280, 1908].includes(width)) {
          const layout = await send('Page.getLayoutMetrics');
          const content = layout.cssContentSize ?? layout.contentSize;
          const routeShot = await send('Page.captureScreenshot', {
            format: 'png',
            fromSurface: true,
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: content.width, height: content.height, scale: 1 },
          });
          writeFileSync(join(OUTPUT_DIR, `trends-${width}-full.png`), Buffer.from(routeShot.data, 'base64'));
        }
        if (
          route.name === 'Reconciliation' &&
          zoom === 1 &&
          [375, 641, 768, 1024, 1280, 1600].includes(width)
        ) {
          await evaluate(`(() => {
            document.querySelector('.recon-table-scroll')?.scrollTo({ left: 0, top: 0, behavior: 'instant' });
            window.scrollTo({ top: 0, behavior: 'instant' });
          })()`);
          await sleep(100);
          const routeShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          writeFileSync(
            join(OUTPUT_DIR, `reconciliation-${width}.png`),
            Buffer.from(routeShot.data, 'base64'),
          );
        }
        console.log(
          `${tag} ${route.name} 図=${routeMetrics.figures.length} 本体=${routeMetrics.pageWidth}/${routeMetrics.viewportWidth}px${route.name === 'Subscriptions' ? ` Chart.js系列=${routeMetrics.subscriptionDatasetCount}` : ''}`,
        );
      }
    }
  }

  if (failures.length) {
    console.error(`\n財務画面の実描画検査: ${failures.length}件の不合格\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`\n財務画面の実描画検査: すべて合格\nスクリーンショット: ${OUTPUT_DIR}`);
  }
} finally {
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(profileDir);
}
