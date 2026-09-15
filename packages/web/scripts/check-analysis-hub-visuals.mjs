// 支出分析ハブを匿名レスポンスで実描画し、端末幅・選択・遷移・履歴・focusを検証する。
// 使い方:
//   pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4175
//   KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 pnpm --filter @kanjo/web check:analysis-hub
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCdpSession } from './cdp.mjs';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';
import { MIN_TAP_TARGET_PX, isMobileWidth, viewportsByLabel } from './viewports.mjs';

const BASE_URL = process.env.KANJO_VISUAL_BASE_URL ?? 'http://127.0.0.1:4175';
const OUTPUT_DIR = process.env.KANJO_VISUAL_OUTPUT_DIR ?? join(tmpdir(), 'kanjo-analysis-hub-review');
const VIEWPORTS = viewportsByLabel([
  '320',
  '375',
  '390',
  '430',
  '768',
  '820',
  '1024',
  '1180',
  '1280',
  '1600',
  'zoom200',
]);
const DESKTOP_VIEWPORT = viewportsByLabel(['1280'])[0];
const MOBILE_VIEWPORT = viewportsByLabel(['390'])[0];
const OPEN_LABELS = ['照合を開く', '総収支を開く', 'マトリクスを開く', '推移を開く', '診断を開く'];
const period = {
  applied: { from: '2026-01', to: '2026-08' },
  label: '2026年1月 〜 2026年8月',
  full: { from: '2025-05', to: '2026-08' },
  years: ['2025', '2026'],
  monthCount: 8,
};
const hub = {
  period,
  summary: {
    income: 1_248_000,
    expense: 892_400,
    net: 355_600,
    previous: {
      label: '前8か月',
      range: { from: '2025-05', to: '2025-12' },
      months: 8,
      income: 1_151_200,
      expense: 941_600,
      net: 209_600,
    },
    change: { income: 0.084, expense: -0.052, net: 0.697 },
  },
  views: {
    reconciliation: { id: 'reconciliation', priority: '高', count: 5, reviewCount: 5 },
    'total-cashflow': { id: 'total-cashflow', priority: '高', count: 3, reviewCount: 3 },
    matrix: { id: 'matrix', priority: '中', count: 0, unrecordedMonths: 0, normal: true },
    trends: { id: 'trends', priority: '中', count: 0, expenseChange: -0.052 },
    diagnosis: { id: 'diagnosis', priority: '中', count: 2, annualSavings: 48_600, candidateCount: 2 },
  },
};
const summary = {
  overview: { months: ['2026-01', '2026-08'], unrecordedExpMonths: [] },
  defense: { line: 444_163, incomeEstimate: 850_760, status: 'ok' },
  benchmarks: [],
  period,
};

const jsonBody = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const responseFor = (url) => {
  const path = new URL(url).pathname;
  if (path === '/api/auth/me') return { authenticated: true };
  if (path === '/api/summary') return summary;
  if (path === '/api/imports') return { imports: [] };
  if (path === '/api/analysis/hub') return hub;
  if (path === '/api/total-cashflow')
    return {
      months: [],
      review: [],
      matched: [],
      freeeOnly: [],
      excluded: [],
      coverage: { freeeTotal: 0, matched: 0, freeeOnly: 0, excluded: 0, mfReview: 0 },
    };
  return undefined;
};

mkdirSync(OUTPUT_DIR, { recursive: true });
const profileDir = mkdtempSync(join(tmpdir(), 'kanjo-analysis-hub-chrome-'));
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let chrome;
let ws;

try {
  const launched = await launchHeadlessChrome({ profileRoot: profileDir, windowSize: '1600,1000' });
  chrome = launched.chrome;
  let send;
  const session = await openCdpSession({
    port: launched.port,
    targets: launched.targets,
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
  send = session.send;
  const { evaluate, setViewport } = session;
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (await evaluate(expression)) return;
      await sleep(125);
    }
    const body = await evaluate('document.body.innerText.slice(0, 500)');
    throw new Error(`${label} の描画待ちがタイムアウトしました: ${body}`);
  };

  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });
  const failures = [];
  for (const viewport of VIEWPORTS) {
    const mobile = isMobileWidth(viewport.width);
    await setViewport({ ...viewport, mobile });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'pointer', value: mobile ? 'coarse' : 'fine' },
        { name: 'hover', value: mobile ? 'none' : 'hover' },
      ],
    });
    await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=total-cashflow` });
    if (viewport.zoom !== 1) {
      await send('Emulation.setPageScaleFactor', { pageScaleFactor: viewport.zoom });
    }
    await waitFor(
      "document.querySelector('.analysis-hub-kpi-value')?.textContent?.includes('1,248,000')",
      `${viewport.label}px hub`,
    );
    await sleep(150);
    const metrics = await evaluate(`(async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const visible = (node) => Boolean(node && node.getBoundingClientRect().width && node.getBoundingClientRect().height);
      const box = (node) => {
        const rect = node?.getBoundingClientRect();
        return rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height } : null;
      };
      const selectedRow = document.querySelector('.analysis-route-table tr[data-selected]');
      const selectedRowStyle = selectedRow ? getComputedStyle(selectedRow) : null;
      const selectedFirst = selectedRow?.firstElementChild;
      const selectedFirstStyle = selectedFirst ? getComputedStyle(selectedFirst) : null;
      const openCtas = [...document.querySelectorAll('.analysis-route-open, .analysis-route-card-actions a')].filter(visible);
      const touchTargets = [...document.querySelectorAll(
        '.analysis-hub .page-tabs a, .analysis-route-table tbody tr, .analysis-route-table .analysis-route-open, .analysis-route-cards button, .analysis-route-cards a, .analysis-selected-open, .analysis-hub-action .btn',
      )].filter(visible);
      const routeList = document.querySelector('.analysis-route-list');
      const panel = document.querySelector('.analysis-selected');
      const tabbar = document.querySelector('.tabbar');
      const main = document.querySelector('main');
      const narrowPanelAfterRoutes = ${viewport.width < 1200} ? box(panel)?.top >= box(routeList)?.bottom - 1 : true;
      const panelFollowsRoutes = Boolean(routeList.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING);
      window.scrollTo(0, document.documentElement.scrollHeight);
      await frame();
      const action = document.querySelector('.analysis-hub-action');
      const actionBox = box(action);
      const tabbarBox = visible(tabbar) ? box(tabbar) : null;
      const tabbarOverlap = Boolean(
        actionBox && tabbarBox && actionBox.bottom > tabbarBox.top && actionBox.top < tabbarBox.bottom
      );
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        h1Count: document.querySelectorAll('main h1').length,
        tabCount: document.querySelectorAll('.analysis-hub .page-tabs a').length,
        selectedTabCount: document.querySelectorAll('.analysis-hub .page-tabs a[data-selected]').length,
        visibleTable: visible(document.querySelector('.analysis-route-table')),
        visibleCards: visible(document.querySelector('.analysis-route-cards')),
        selectedRows: document.querySelectorAll('.analysis-route-table tr[data-selected]').length,
        selectedCards: document.querySelectorAll('.analysis-route-cards > li[data-selected]').length,
        selectedRowBackground: selectedRowStyle?.backgroundColor ?? '',
        selectedRowAccent: selectedFirstStyle?.boxShadow ?? '',
        statusIcons: document.querySelectorAll('.analysis-route-status .route-icon').length,
        priorityBadges: document.querySelectorAll('.analysis-route-table .badge, .analysis-route-cards .badge').length,
        panelLists: document.querySelectorAll('.analysis-selected-data-list').length,
        panelListItems: document.querySelectorAll('.analysis-selected-data-list li').length,
        panelCta: Boolean(document.querySelector('.analysis-selected-open[href="/analysis/total-cashflow"]')),
        activeJourney: document.querySelectorAll('.analysis-journey [aria-current="step"]').length,
        comparisonRows: document.querySelectorAll('.analysis-hub-kpi-change small').length,
        minTabHeight: Math.min(...[...document.querySelectorAll('.analysis-hub .page-tabs a')].map((node) => node.getBoundingClientRect().height)),
        openCtas: openCtas.map((node) => ({
          label: node.textContent.trim(),
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          height: node.getBoundingClientRect().height,
          whiteSpace: getComputedStyle(node).whiteSpace,
        })),
        minTouchHeight: Math.min(...touchTargets.map((node) => node.getBoundingClientRect().height)),
        panelFollowsRoutes,
        narrowPanelAfterRoutes,
        tabbarVisible: visible(tabbar),
        tabbarOverlap,
        mainPaddingBottom: Number.parseFloat(getComputedStyle(main).paddingBottom),
        tabbarHeight: tabbarBox?.height ?? 0,
        visualScale: window.visualViewport?.scale ?? 1,
        overflowing: [...document.querySelectorAll('body *')]
          .filter((node) => {
            const box = node.getBoundingClientRect();
            return box.width > 0 && box.right > document.documentElement.clientWidth + 1;
          })
          .slice(0, 8)
          .map((node) => {
            const box = node.getBoundingClientRect();
            return node.tagName.toLowerCase() + '.' + (node.className || '-') + ' right=' + Math.round(box.right) + ' width=' + Math.round(box.width);
          }),
      };
    })()`);
    if (metrics.pageWidth > metrics.viewportWidth + 1)
      failures.push(
        `${viewport.label}px ページが横にはみ出す (${metrics.pageWidth}/${metrics.viewportWidth}): ${metrics.overflowing.join(', ')}`,
      );
    if (metrics.h1Count !== 1 || metrics.tabCount !== 5 || metrics.selectedTabCount !== 1)
      failures.push(`${viewport.label}px hero/tab階層が不正`);
    if (viewport.width < 1200 ? !metrics.visibleCards || metrics.visibleTable : !metrics.visibleTable)
      failures.push(`${viewport.label}px route一覧のresponsive表示が不正`);
    if (
      metrics.selectedRows !== 1 ||
      metrics.selectedCards !== 1 ||
      !metrics.selectedRowBackground ||
      metrics.selectedRowAccent === 'none'
    )
      failures.push(`${viewport.label}px 選択行の背景または左accentが不足`);
    if (
      metrics.statusIcons !== 10 ||
      metrics.priorityBadges !== 10 ||
      metrics.panelLists !== 2 ||
      metrics.panelListItems < 4 ||
      !metrics.panelCta ||
      metrics.activeJourney !== 1 ||
      metrics.comparisonRows !== 3
    )
      failures.push(`${viewport.label}px 状態・panel・journey・KPI情報が不足`);
    if (metrics.minTabHeight < 44) failures.push(`${viewport.label}px tabのタップ高が44px未満`);
    if (
      metrics.openCtas.length !== OPEN_LABELS.length ||
      metrics.openCtas.some(
        (cta, index) =>
          cta.label !== OPEN_LABELS[index] ||
          cta.scrollWidth > cta.clientWidth + 1 ||
          cta.scrollHeight > cta.clientHeight + 1 ||
          cta.height < MIN_TAP_TARGET_PX ||
          cta.whiteSpace !== 'nowrap',
      )
    )
      failures.push(`${viewport.label}px 行末CTAの1行表示/44px高が不正: ${JSON.stringify(metrics.openCtas)}`);
    if (metrics.minTouchHeight < MIN_TAP_TARGET_PX)
      failures.push(`${viewport.label}px 操作対象の高さが44px未満 (${metrics.minTouchHeight})`);
    if (!metrics.panelFollowsRoutes || !metrics.narrowPanelAfterRoutes)
      failures.push(`${viewport.label}px 選択panelのDOM順または狭幅の表示順が不正`);
    if (viewport.width < 640) {
      if (!metrics.tabbarVisible || metrics.tabbarOverlap)
        failures.push(`${viewport.label}px 下部ナビが非表示、または本文CTAと重なる`);
      if (metrics.mainPaddingBottom < metrics.tabbarHeight)
        failures.push(`${viewport.label}px 下部ナビ/safe-area用の本文退避が不足`);
    }
    if (viewport.zoom === 2 && metrics.visualScale < 1.9)
      failures.push(`${viewport.label} で200%拡大が適用されていない (${metrics.visualScale})`);

    await evaluate('window.scrollTo(0, 0)');
    await sleep(50);
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    });
    writeFileSync(
      join(OUTPUT_DIR, `analysis-hub-${viewport.label}.png`),
      Buffer.from(screenshot.data, 'base64'),
    );
    console.log(
      `${viewport.label} hub=${metrics.pageWidth}/${metrics.viewportWidth}px table=${metrics.visibleTable} cards=${metrics.visibleCards} CTA=${metrics.openCtas.length} min操作高=${Math.round(metrics.minTouchHeight)}px`,
    );
  }

  const setInteractionViewport = async (viewport, mobile) => {
    await setViewport({ ...viewport, mobile });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'pointer', value: mobile ? 'coarse' : 'fine' },
        { name: 'hover', value: mobile ? 'none' : 'hover' },
      ],
    });
  };
  const clickAt = async (selector) => {
    const point = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return null;
      node.scrollIntoView({ block: 'center' });
      const box = node.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    if (!point) throw new Error(`クリック対象がありません: ${selector}`);
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
  };

  await setInteractionViewport(DESKTOP_VIEWPORT, false);
  await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=reconciliation` });
  await waitFor("Boolean(document.querySelector('tr[data-route-id=matrix]'))", 'デスクトップ行選択');
  await clickAt('tr[data-route-id="matrix"] > td:nth-child(3)');
  await waitFor("location.search === '?focus=matrix'", '目的セル選択');
  await clickAt('tr[data-route-id="trends"] > td:nth-child(4)');
  await waitFor("location.search === '?focus=trends'", '状態セル選択');
  await clickAt('tr[data-route-id="diagnosis"] > td:nth-child(5)');
  await waitFor("location.search === '?focus=diagnosis'", '優先度セル選択');
  await waitFor(
    "document.querySelector('.analysis-selected h2')?.textContent === '診断'",
    '行選択後のpanel同期',
  );
  const synchronized = await evaluate(`({
    panel: document.querySelector('.analysis-selected h2')?.textContent,
    tab: document.querySelector('.page-tabs a[data-selected]')?.getAttribute('href'),
    journey: document.querySelector('.analysis-journey [aria-current="step"] strong')?.textContent,
    action: document.querySelector('.analysis-hub-action a')?.getAttribute('href'),
  })`);
  if (
    synchronized.panel !== '診断' ||
    synchronized.tab !== '/analysis/diagnosis' ||
    synchronized.journey !== '行動を決める' ||
    synchronized.action !== '/analysis/diagnosis'
  )
    failures.push(`行選択後のpanel/tab/journey/CTA同期が不正: ${JSON.stringify(synchronized)}`);

  await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=total-cashflow` });
  await waitFor("Boolean(document.querySelector('tr[data-route-id=matrix]'))", 'hover確認');
  await evaluate(
    "document.querySelector('tr[data-route-id=matrix] > td:nth-child(3)').scrollIntoView({ block: 'center' })",
  );
  const hoverBefore = await evaluate(
    "getComputedStyle(document.querySelector('tr[data-route-id=matrix] > td:nth-child(3)')).backgroundColor",
  );
  const hoverPoint = await evaluate(`(() => {
    const box = document.querySelector('tr[data-route-id="matrix"] > td:nth-child(3)').getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hoverPoint });
  await sleep(50);
  const hoverAfter = await evaluate(`(() => {
    const row = document.querySelector('tr[data-route-id="matrix"]');
    const hoveredCell = row.querySelector('td:nth-child(3)');
    const pointNode = document.elementFromPoint(${hoverPoint.x}, ${hoverPoint.y});
    return {
      background: getComputedStyle(hoveredCell).backgroundColor,
      cursor: getComputedStyle(row).cursor,
      hovered: row.matches(':hover'),
      pointNode: pointNode?.tagName + '.' + (pointNode?.className || ''),
    };
  })()`);
  if (hoverAfter.background === hoverBefore || hoverAfter.cursor !== 'pointer')
    failures.push(`選択行のhover/cursorが不正: ${JSON.stringify({ hoverBefore, hoverAfter })}`);

  await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=reconciliation` });
  await waitFor("Boolean(document.querySelector('tr[data-route-id=matrix]'))", 'keyboard focus確認');
  await evaluate("document.querySelector('tr[data-route-id=total-cashflow] .analysis-route-open').focus()");
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  const focusedMatrix = await evaluate("document.activeElement?.dataset?.routeId === 'matrix'");
  const focusStyle = await evaluate(`(() => {
    const row = document.querySelector('tr[data-route-id="matrix"]');
    const style = getComputedStyle(row);
    return {
      focused: document.activeElement === row,
      visible: row.matches(':focus-visible'),
      outlineWidth: style.outlineWidth,
    };
  })()`);
  if (!focusedMatrix || !focusStyle.visible || Number.parseFloat(focusStyle.outlineWidth) < 2)
    failures.push(`選択行のkeyboard focusが不正: ${JSON.stringify(focusStyle)}`);
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await waitFor("location.search === '?focus=matrix'", 'keyboard行選択');

  await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=reconciliation` });
  await waitFor(
    "Boolean(document.querySelector('tr[data-route-id=total-cashflow] .analysis-route-open'))",
    '行末CTA確認',
  );
  await clickAt('tr[data-route-id="total-cashflow"] .analysis-route-open');
  await waitFor("location.pathname === '/analysis/total-cashflow'", '行末CTA詳細遷移');
  const rowCtaResult = await evaluate('({ path: location.pathname, search: location.search })');
  if (rowCtaResult.search) failures.push(`行末CTAが行選択も発火した: ${JSON.stringify(rowCtaResult)}`);
  await evaluate('history.back()');
  await waitFor(
    "location.pathname === '/analysis' && location.search === '?focus=reconciliation'",
    '行末CTAから戻る',
  );

  await setInteractionViewport(MOBILE_VIEWPORT, true);
  await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=reconciliation` });
  await waitFor(
    "Boolean(document.querySelector('.analysis-route-cards [data-route-id=matrix]'))",
    'カード選択',
  );
  await clickAt('.analysis-route-cards [data-route-id="matrix"] > p');
  await waitFor("location.search === '?focus=matrix'", 'カード余白選択');
  await waitFor(
    "document.querySelector('.analysis-selected h2')?.textContent === 'マトリクス'",
    'カード選択後のpanel同期',
  );
  const mobileSynchronized = await evaluate(`({
    panel: document.querySelector('.analysis-selected h2')?.textContent,
    tab: document.querySelector('.page-tabs a[data-selected]')?.getAttribute('href'),
    journey: document.querySelector('.analysis-journey [aria-current="step"] strong')?.textContent,
    action: document.querySelector('.analysis-hub-action a')?.getAttribute('href'),
  })`);
  if (
    mobileSynchronized.panel !== 'マトリクス' ||
    mobileSynchronized.tab !== '/analysis/matrix' ||
    mobileSynchronized.journey !== '偏りを見る' ||
    mobileSynchronized.action !== '/analysis/matrix'
  )
    failures.push(`カード選択後の同期が不正: ${JSON.stringify(mobileSynchronized)}`);

  await setInteractionViewport(DESKTOP_VIEWPORT, false);
  await send('Page.navigate', { url: `${BASE_URL}/analysis?focus=total-cashflow` });
  await waitFor("Boolean(document.querySelector('.analysis-selected-open'))", '操作確認');
  await evaluate(`(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    document.querySelector('.analysis-selected-open')?.click();
  })()`);
  await waitFor("location.pathname === '/analysis/total-cashflow'", '詳細遷移');
  await waitFor("Boolean(document.querySelector('#tcf-monthly-title'))", 'lazy詳細');
  const pushResult = await evaluate(`({
    path: location.pathname,
    scrollY: window.scrollY,
    focusedHeading: document.activeElement === document.querySelector('main h1'),
  })`);
  if (
    pushResult.path !== '/analysis/total-cashflow' ||
    pushResult.scrollY !== 0 ||
    !pushResult.focusedHeading
  )
    failures.push(`PUSH遷移後のpath/scroll/focusが不正: ${JSON.stringify(pushResult)}`);
  await evaluate('history.back()');
  await waitFor("location.pathname === '/analysis'", 'Back');
  await evaluate('history.forward()');
  await waitFor("location.pathname === '/analysis/total-cashflow'", 'Forward');

  if (failures.length) {
    console.error(`\n支出分析ハブ実描画検査: ${failures.length}件の不合格\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(
      `\n支出分析ハブ実描画検査: ${VIEWPORTS.length}条件・選択・遷移・履歴すべて合格\nスクリーンショット: ${OUTPUT_DIR}`,
    );
  }
} finally {
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(profileDir);
}
