// 財務画面を匿名データで実描画し、Matrix の科目固定と PL/CF/BS 図解を検証する。
// 使い方:
//   pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4175
//   KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 node scripts/check-financial-visuals.mjs
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';

const BASE_URL = process.env.KANJO_VISUAL_BASE_URL ?? 'http://127.0.0.1:4175';
const WIDTHS = [375, 768, 1280, 1600];
const OUTPUT_DIR = join(tmpdir(), 'kanjo-financial-review');
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

const summary = {
  overview: { months, unrecordedExpMonths: [] },
  defense: { status: 'nodata' },
  benchmarks: [],
  period: statements.period,
};

const jsonBody = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const responseFor = (url) => {
  const path = new URL(url).pathname;
  if (path === '/api/auth/me') return { authenticated: true };
  if (path === '/api/summary') return summary;
  if (path === '/api/matrix') return matrix;
  if (path === '/api/statements') return statements;
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
  let page = targets.find((target) => target.type === 'page');
  if (!page)
    page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    if (message.method !== 'Fetch.requestPaused') return;
    const response = responseFor(message.params.request.url);
    if (response === undefined) {
      ws.send(
        JSON.stringify({
          id: ++id,
          method: 'Fetch.continueRequest',
          params: { requestId: message.params.requestId },
        }),
      );
      return;
    }
    ws.send(
      JSON.stringify({
        id: ++id,
        method: 'Fetch.fulfillRequest',
        params: {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
          body: jsonBody(response),
        },
      }),
    );
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const requestId = ++id;
      pending.set(requestId, resolve);
      ws.send(JSON.stringify({ id: requestId, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.result?.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails));
    return result.result?.result?.value;
  };
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
  for (const width of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });
    await send('Page.navigate', { url: `${BASE_URL}/matrix` });
    await waitFor('Boolean(document.querySelector(\'.matrix-table tbody th[scope="row"]\'))', 'Matrix');
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
        chartCount: document.querySelectorAll('.matrix-summary canvas').length,
        fixedAmountGuide: document.querySelector('.matrix-summary .chart-guide')?.textContent?.includes('表示切替に関係なく増減額(円)') ?? false,
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
      failures.push(`${width}px 増減額固定の要約図が確認できない`);

    const matrixShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(OUTPUT_DIR, `matrix-${width}.png`), Buffer.from(matrixShot.result.data, 'base64'));
    console.log(
      `${width}px Matrix 科目列=${Math.round(metrics.firstColumnWidth)}px/${metrics.labelLines}行/${metrics.whiteSpace} ` +
        `表=${metrics.tableWidth}/${metrics.scrollerWidth}px sticky差=${metrics.stickyDelta}px 本体=${metrics.pageWidth}/${metrics.viewportWidth}px`,
    );

    await send('Page.navigate', { url: `${BASE_URL}/statements` });
    await waitFor("document.querySelectorAll('.chart-shell canvas').length === 4", 'Statements');
    await evaluate('window.scrollTo(0, 0)');
    await sleep(300);
    const statementMetrics = await evaluate(`(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      chartCount: document.querySelectorAll('.chart-shell canvas').length,
      figures: [...document.querySelectorAll('.financial-figure figcaption strong')].map((node) => node.textContent?.trim()),
      tables: document.querySelectorAll('table.data').length,
      equationVisible: Boolean(document.querySelector('.financial-equation')),
      canvasBoxes: [...document.querySelectorAll('.chart-shell canvas')].map((canvas) => {
        const box = canvas.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
      bsFigureBottom: document.querySelectorAll('.financial-figure')[3]?.getBoundingClientRect().bottom ?? 0,
      bsTableTop: document.querySelectorAll('.table-heading.compact')[2]?.getBoundingClientRect().top ?? 0,
      bsTableBottom: document.querySelector('.liability-form')?.previousElementSibling?.getBoundingClientRect().bottom ?? 0,
      liabilityFormTop: document.querySelector('.liability-form')?.getBoundingClientRect().top ?? 0,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))()`);
    if (statementMetrics.pageWidth > statementMetrics.viewportWidth + 1)
      failures.push(`${width}px Statementsページ本体が横にはみ出す`);
    if (statementMetrics.chartCount !== 4 || statementMetrics.tables < 3 || !statementMetrics.equationVisible)
      failures.push(`${width}px PL/CF/BSの図解または照合表が不足`);
    if (statementMetrics.canvasBoxes.some((box) => box.width < 1 || box.height < 1))
      failures.push(`${width}px PL/CF/BSのcanvas描画領域が0`);
    if (
      statementMetrics.bsFigureBottom > statementMetrics.bsTableTop + 1 ||
      statementMetrics.bsTableBottom > statementMetrics.liabilityFormTop + 1
    )
      failures.push(`${width}px BS図・照合表・負債入力フォームの順序が重なる`);
    if (!statementMetrics.reducedMotion) failures.push(`${width}px reduced-motion の実描画条件を作れない`);
    const statementsTopShot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(
      join(OUTPUT_DIR, `statements-${width}-top.png`),
      Buffer.from(statementsTopShot.result.data, 'base64'),
    );
    if (width === 375 || width === 1280) {
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
          join(OUTPUT_DIR, `statements-${width}-${target.name}.png`),
          Buffer.from(sectionShot.result.data, 'base64'),
        );
      }
    }
    console.log(
      `${width}px Statements 図=${statementMetrics.chartCount} 表=${statementMetrics.tables} ` +
        `本体=${statementMetrics.pageWidth}/${statementMetrics.viewportWidth}px reduced-motion=${statementMetrics.reducedMotion}`,
    );
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
