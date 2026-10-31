// 予算画面を匿名データで実描画し、参照画像の主要レイアウト契約を 1024×1536 で検証する。
// 使い方:
//   pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4175
//   KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 pnpm --filter @kanjo/web check:budget-visual
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { BudgetBaseRow, BudgetInput } from '@kanjo/core';
import { budgetScreenBase, budgetScreenResponse } from '../src/test-support/budget-screen-fixture.js';
import { openCdpSession } from './cdp.mjs';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';

const BASE_URL = process.env.KANJO_VISUAL_BASE_URL ?? 'http://127.0.0.1:4175';
const OUTPUT_DIR = resolve(
  process.cwd(),
  process.env.KANJO_BUDGET_EVIDENCE_DIR ?? '../../docs/budget-screen/evidence',
);
const SCREENSHOT = join(OUTPUT_DIR, 'budget-1024x1536.png');
const REPORT = join(OUTPUT_DIR, 'budget-1024x1536.json');
const sleep = (milliseconds: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const jsonBody = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

const original = budgetScreenBase();
const template = original.rows.find((row) => row.kind === 'expense') as BudgetBaseRow;
const saved = (annualAmount: number, planAdjustment = 0, planReason: string | null = null): BudgetInput => ({
  annualAmount,
  planAdjustment,
  planReason,
});
const makeRow = (
  account: string,
  order: number,
  prevActual: number,
  annualAmount: number,
  growthRate: number,
  kind: 'income' | 'expense' = 'expense',
): BudgetBaseRow => ({
  ...template,
  account,
  order,
  kind,
  manualOnly: account === 'その他収入',
  prevActual,
  growthRate,
  recentMonthly: template.recentMonthly.map((month) => ({ ...month, amount: Math.round(prevActual / 12) })),
  targetActuals: Array.from({ length: 12 }, (_, index) => (index < 7 ? Math.round(prevActual / 12) : null)),
  saved: saved(annualAmount),
});

const rows: BudgetBaseRow[] = [
  makeRow('売上高', 1, 128_400_000, 132_000_000, 0.04, 'income'),
  makeRow('その他収入', 2, 2_100_000, 1_200_000, 0, 'income'),
  makeRow('人件費', 3, 38_200_000, 39_600_000, 0.028),
  makeRow('外注費', 4, 12_800_000, 13_200_000, 0.015),
  makeRow('広告・販促費', 5, 6_100_000, 6_000_000, 0.08),
  makeRow('旅費・交通費', 6, 2_400_000, 2_640_000, 0.05),
  makeRow('通信費', 7, 1_800_000, 1_920_000, 0.03),
  makeRow('地代・家賃', 8, 9_600_000, 9_600_000, 0),
  makeRow('消耗品費', 9, 2_200_000, 2_400_000, 0.06),
  makeRow('その他費用', 10, 3_200_000, 2_400_000, -0.04),
];
const budget = budgetScreenResponse({ rows, defenseLine: { monthly: 4_300_000, annual: 51_600_000 } });

const responseFor = (url: string): unknown => {
  const path = new URL(url).pathname;
  if (path === '/api/auth/me')
    return { authenticated: true, user: { id: 'budget-visual-user', email: 'visual@example.test' } };
  if (path === '/api/budget-screen') return budget;
  if (path === '/api/summary') return {};
  if (path === '/api/imports') return { imports: [] };
  if (path === '/api/review-queue')
    return {
      total: 0,
      counts: { classification: 0, reconciliation: 0, import: 0 },
      snoozedCount: 0,
      items: [],
    };
  if (path === '/api/analysis/hub') return { views: {} };
  return undefined;
};

mkdirSync(OUTPUT_DIR, { recursive: true });
const profileRoot = mkdtempSync(join(tmpdir(), 'kanjo-budget-chrome-'));
const runtimeProblems: string[] = [];
let chrome: Awaited<ReturnType<typeof launchHeadlessChrome>>['chrome'] | undefined;
let socket: WebSocket | undefined;

try {
  const launched = await launchHeadlessChrome({ profileRoot, windowSize: '1024,1536' });
  chrome = launched.chrome;
  // biome-ignore lint/style/useConst: request interception callback needs the session sender assigned after creation.
  let send!: Awaited<ReturnType<typeof openCdpSession>>['send'];
  const session = await openCdpSession({
    port: launched.port,
    targets: launched.targets,
    onEvent: (message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        runtimeProblems.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
        return;
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        runtimeProblems.push(
          message.params.args
            ?.map(
              (argument: { value?: string; description?: string }) =>
                argument.value ?? argument.description ?? '',
            )
            .join(' ') || 'console.error',
        );
        return;
      }
      if (message.method !== 'Fetch.requestPaused') return;
      const response = responseFor(message.params.request.url);
      if (response === undefined) {
        void send('Fetch.fulfillRequest', {
          requestId: message.params.requestId,
          responseCode: 404,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
          body: jsonBody({ error: 'visual fixture missing' }),
        });
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
  socket = session.socket;
  send = session.send;
  const { evaluate } = session;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 1536,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1024,
    screenHeight: 1536,
  });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await send('Page.navigate', { url: `${BASE_URL}/budget` });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      await evaluate(
        "document.querySelector('h1')?.textContent?.trim() === '予算' && document.querySelector('.budget-panel h2')?.textContent?.trim() === '人件費' && document.querySelectorAll('.budget-table tbody tr').length === 10",
      )
    )
      break;
    if (attempt === 99)
      throw new Error(
        `予算画面の描画待ちがタイムアウトしました: ${await evaluate('document.body.innerText.slice(0, 800)')}`,
      );
    await sleep(200);
  }
  await evaluate('document.fonts?.ready');
  await sleep(250);

  const metrics = (await evaluate(`(() => {
    const nodeBox = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
    };
    const box = (selector) => nodeBox(document.querySelector(selector));
    const chart = document.querySelector('.budget-chart svg');
    const firstBarX = Object.fromEntries(
      ['income-actual', 'income-budget', 'expense-actual', 'expense-budget'].map((kind) => [
        kind,
        Number(chart?.querySelector('.budget-bar-' + kind)?.getAttribute('x')),
      ]),
    );
    const visibleTextSizes = [...document.querySelectorAll('.budget *')]
      .filter((node) => node instanceof HTMLElement && node.offsetParent !== null && node.childElementCount === 0 && node.textContent?.trim())
      .map((node) => Number.parseFloat(getComputedStyle(node).fontSize))
      .filter(Number.isFinite);
    const mainTable = box('.budget-grid-main > :first-child');
    const mainPanel = box('.budget-grid-main > .budget-panel');
    const firstCheckbox = document.querySelector('.budget-table tbody input[type="checkbox"]');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      title: document.querySelector('h1')?.textContent?.trim(),
      question: document.querySelector('.budget-question')?.textContent?.trim(),
      kpiIconCount: document.querySelectorAll('.budget-kpis .kpi-icon').length,
      tableRowCount: document.querySelectorAll('.budget-table tbody tr').length,
      selectedPanel: document.querySelector('.budget-panel h2')?.textContent?.trim(),
      mainTable,
      mainPanel,
      mainWidthRatio: mainTable && mainPanel ? mainTable.width / mainPanel.width : null,
      selectionControl: {
        visual: nodeBox(firstCheckbox?.nextElementSibling),
        native: nodeBox(firstCheckbox),
        hitArea: nodeBox(firstCheckbox?.closest('label') ?? firstCheckbox),
        firstRow: box('.budget-table tbody tr'),
      },
      chart: box('.budget-chart svg'),
      chartNotes: box('.budget-chart-notes'),
      firstMonthBarX: firstBarX,
      minVisibleBudgetFontPx: Math.min(...visibleTextSizes),
    };
  })()`)) as Record<string, unknown>;

  const mainTable = metrics.mainTable as { y: number; width: number } | null;
  const mainPanel = metrics.mainPanel as { y: number; width: number } | null;
  const selectionControl = metrics.selectionControl as {
    visual: { width: number; height: number } | null;
    hitArea: { width: number; height: number } | null;
    firstRow: { height: number } | null;
  };
  const chartBox = metrics.chart as { bottom: number } | null;
  const notesBox = metrics.chartNotes as { y: number } | null;
  const barX = Object.values(metrics.firstMonthBarX as Record<string, number>);
  const failures = [
    metrics.title === '予算' ? null : `h1=${String(metrics.title)}`,
    typeof metrics.question === 'string' && metrics.question.includes('実績に合う予算')
      ? null
      : '問いが見出しから分離されていない',
    metrics.kpiIconCount === 4 ? null : `KPIアイコン=${String(metrics.kpiIconCount)}`,
    metrics.selectedPanel === '人件費' ? null : `初期パネル=${String(metrics.selectedPanel)}`,
    metrics.tableRowCount === 10 ? null : `一覧行=${String(metrics.tableRowCount)}`,
    (metrics.page as { scrollWidth: number; clientWidth: number }).scrollWidth <=
    (metrics.page as { scrollWidth: number; clientWidth: number }).clientWidth + 1
      ? null
      : 'ページ全体が横スクロールする',
    mainTable && mainPanel && Math.abs(mainTable.y - mainPanel.y) <= 2
      ? null
      : '1024pxで右パネルが横並びになっていない',
    mainTable && mainPanel && mainTable.width >= mainPanel.width * 1.8
      ? null
      : `1024pxで一覧が右パネルより十分広くない: ${mainTable?.width ?? 'なし'} / ${mainPanel?.width ?? 'なし'}`,
    selectionControl.visual?.width === 20 && selectionControl.visual.height === 20
      ? null
      : `checkboxの見た目が共通20pxではない: ${selectionControl.visual?.width ?? 'なし'}×${selectionControl.visual?.height ?? 'なし'}`,
    selectionControl.hitArea && selectionControl.hitArea.width >= 44 && selectionControl.hitArea.height >= 44
      ? null
      : `checkboxの操作領域が44px未満: ${selectionControl.hitArea?.width ?? 'なし'}×${selectionControl.hitArea?.height ?? 'なし'}`,
    selectionControl.firstRow &&
    selectionControl.firstRow.height >= 44 &&
    selectionControl.firstRow.height <= 48
      ? null
      : `予算一覧の行高が共通密度ではない: ${selectionControl.firstRow?.height ?? 'なし'}px`,
    new Set(barX).size === 4 && barX.every(Number.isFinite)
      ? null
      : `4系列のx位置が分離されていない: ${barX.join(',')}`,
    chartBox && notesBox && notesBox.y >= chartBox.bottom ? null : '期間注記がグラフ下にない',
    Number(metrics.minVisibleBudgetFontPx) >= 12
      ? null
      : `予算領域の最小文字が12px未満: ${String(metrics.minVisibleBudgetFontPx)}`,
    runtimeProblems.length === 0 ? null : `runtime errors: ${runtimeProblems.join(' | ')}`,
  ].filter((failure): failure is string => Boolean(failure));

  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  writeFileSync(SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
  writeFileSync(
    REPORT,
    `${JSON.stringify({ target: 'design/FINAL-UI/images/14-budget.png', metrics, runtimeProblems, failures }, null, 2)}\n`,
  );
  if (failures.length) throw new Error(`予算画面の実描画検査に失敗しました:\n- ${failures.join('\n- ')}`);
  console.log(`予算画面の実描画検査: すべて合格\n${SCREENSHOT}\n${REPORT}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(profileRoot);
}
