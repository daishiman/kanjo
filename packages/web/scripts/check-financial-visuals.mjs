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
// 実ルートは高さを1000で揃えて測る(縦は検査対象ではない)ため、幅とzoomだけ使う。
const VIEWPORTS = viewportsByLabel(['320', '360', '375', '390', '768', '1280', '1600', 'zoom200']);
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

const jsonBody = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const responseFor = (url) => {
  const path = new URL(url).pathname;
  if (path === '/api/auth/me') return { authenticated: true };
  if (path === '/api/summary') return summary;
  if (path === '/api/matrix') return matrix;
  if (path === '/api/trends') return trends;
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
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  const failures = [];
  if (VISUAL_SCOPE !== 'additional') {
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

  if (VISUAL_SCOPE !== 'core') {
    const additionalRoutes = [
      { name: 'Overview', path: '/', expectedFigures: 1 },
      { name: 'Trends', path: '/analysis/trends', expectedFigures: 3 },
      { name: 'Subscriptions', path: '/subscriptions', expectedFigures: 1 },
      { name: 'Household', path: '/household', expectedFigures: 1 },
      { name: 'AI report', path: '/ai', expectedFigures: 4, openReport: true },
    ];
    for (const width of [360, 375, 390, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 640,
      });
      await send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      for (const route of additionalRoutes) {
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
        await waitFor(
          `document.querySelectorAll('[data-financial-figure] .financial-figure__chart canvas').length === ${route.expectedFigures}`,
          route.name,
        );
        const routeMetrics = await evaluate(`(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        figures: [...document.querySelectorAll('[data-financial-figure]')].map((figure) => {
          const canvas = figure.querySelector('.financial-figure__chart canvas');
          const box = canvas?.getBoundingClientRect();
          return {
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
        subscriptionDatasetCount: Number(document.querySelector('[data-financial-dataset-count]')?.getAttribute('data-financial-dataset-count') ?? 0),
        subscriptionDatasetLabels: document.querySelector('[data-financial-dataset-labels]')?.getAttribute('data-financial-dataset-labels') ?? '',
        subscriptionSummaryLabels: [...document.querySelectorAll('[data-financial-series] li')].map((item) => item.textContent?.trim() ?? '').join('|'),
        legend: [...document.querySelectorAll('[data-financial-figure]')].map((figure) => ({
          // アンカーを持たない図は、結論のid「model.id + useIdの値 + summary」から model.id を復元する
          key: figure.id || (figure.querySelector('[data-financial-summary]')?.id ?? '').split('-').slice(0, -2).join('-'),
          chips: [...figure.querySelectorAll('[data-financial-series] li')].map((item) => ({
            label: item.textContent?.trim() ?? '',
            color: item.querySelector('span')?.style.getPropertyValue('--series-color') ?? '',
          })),
        })),
      }))()`);
        if (routeMetrics.pageWidth > routeMetrics.viewportWidth + 1)
          failures.push(`${width}px ${route.name}ページ本体が横にはみ出す`);
        if (
          routeMetrics.figures.length !== route.expectedFigures ||
          routeMetrics.figures.some((contract) => Object.values(contract).some((value) => !value))
        )
          failures.push(
            `${width}px ${route.name} 見出し・結論・期間・単位・系列・次の行動・正確な表・実canvasが不足`,
          );
        if (
          route.name === 'Subscriptions' &&
          (routeMetrics.subscriptionDatasetCount < 1 || routeMetrics.subscriptionDatasetCount > 7)
        )
          failures.push(
            `${width}px Subscriptionsの実Chart.js系列が${routeMetrics.subscriptionDatasetCount}件で上位6+他Nに収まらない`,
          );
        if (
          route.name === 'Subscriptions' &&
          routeMetrics.subscriptionDatasetLabels !== routeMetrics.subscriptionSummaryLabels
        )
          failures.push(`${width}px Subscriptionsの実canvas凡例と非canvas系列一覧が一致しない`);
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
            failures.push(`${width}px ${route.name} ${figureLegend.key} の凡例が図に無い色を主張している`);
          if (!COLORED[route.name]?.includes(figureLegend.key)) continue;
          if (colored !== figureLegend.chips.length)
            failures.push(
              `${width}px ${route.name} ${figureLegend.key} の凡例チップに色が付いていない(${colored}/${figureLegend.chips.length})`,
            );
          if (distinct < 2)
            failures.push(
              `${width}px ${route.name} ${figureLegend.key} の凡例チップが全て同じ色で、系列と照らし合わせられない`,
            );
        }
        for (const [name, keys] of [...Object.entries(COLORED), ...Object.entries(COLORLESS)])
          if (route.name === name)
            for (const key of keys)
              if (!routeMetrics.legend.some((figureLegend) => figureLegend.key === key))
                failures.push(`${width}px ${route.name} に凡例色の検査対象 ${key} が無い`);
        if (width === 375 || width === 1280) {
          const routeShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
          writeFileSync(
            join(OUTPUT_DIR, `${route.name.toLowerCase().replaceAll(' ', '-')}-${width}.png`),
            Buffer.from(routeShot.data, 'base64'),
          );
        }
        console.log(
          `${width}px ${route.name} 図=${routeMetrics.figures.length} 本体=${routeMetrics.pageWidth}/${routeMetrics.viewportWidth}px${route.name === 'Subscriptions' ? ` Chart.js系列=${routeMetrics.subscriptionDatasetCount}` : ''}`,
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
