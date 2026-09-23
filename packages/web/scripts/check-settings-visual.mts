// 設定画面を匿名fixtureで実描画し、参照画像の3領域と狭幅の1列構造を検証する。
// 使い方:
//   pnpm --filter @kanjo/web dev --host 127.0.0.1 --port 4175
//   KANJO_VISUAL_BASE_URL=http://127.0.0.1:4175 pnpm --filter @kanjo/web check:settings-visual
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCdpSession } from './cdp.mjs';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';

const BASE_URL = process.env.KANJO_VISUAL_BASE_URL ?? 'http://127.0.0.1:4175';
const OUTPUT_DIR = process.env.KANJO_SETTINGS_EVIDENCE_DIR ?? join(tmpdir(), 'kanjo-settings-review');
const VIEWPORTS = [
  { label: 'desktop-1024x1536', width: 1024, height: 1536, mobile: false },
  { label: 'mobile-375x812', width: 375, height: 812, mobile: true },
] as const;
const sleep = (milliseconds: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const jsonBody = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');

const savedAt = '2026-09-10T05:32:00.000Z';
const rules = [
  ['rule-1', 'スターバックス', 'カフェ・外食'],
  ['rule-2', 'スタバ', 'カフェ・外食'],
  ['rule-3', 'Starbucks', 'カフェ・外食'],
  ['rule-4', 'スーパーマーケット', '食料品'],
  ['rule-5', 'Amazon.co.jp', '通信販売'],
  ['rule-6', 'アマゾン', '通信販売'],
].map(([ruleId, raw, norm], index) => ({
  ruleId,
  kind: 'vendor',
  raw,
  norm,
  order: index + 1,
  enabled: true,
  updatedAt: savedAt,
  updatedBy: 'visual-fixture',
  canUndo: true,
  shadowedBy: null,
}));
const user = {
  id: 'visual-user',
  email: 'visual@example.test',
  role: 'admin',
  status: 'active',
  mustChangePassword: false,
  createdAt: savedAt,
  lastLoginAt: savedAt,
};
const ownerLabels = { business: '本人', spouse: 'パートナー', family: '家族', unset: '未設定' };
const period = {
  applied: { from: '2025-09', to: '2026-08' },
  label: '2025年9月 〜 2026年8月',
  full: { from: '2025-09', to: '2026-08' },
  years: ['2025', '2026'],
  monthCount: 12,
};

const responseFor = (url: string): unknown => {
  const path = new URL(url).pathname;
  if (path === '/api/auth/me') return { authenticated: true, user };
  if (path === '/api/settings/screen')
    return {
      savedAt,
      normRules: rules,
      ownerLabels,
      ownerLabelsSaved: true,
      statMinMonths: 12,
      statMinMonthsRange: { min: 1, max: 60, default: 6 },
      cashOverrides: [],
      impacts: {
        account: ['月次サマリー', '分析グラフ'],
        vendor: ['支出のカテゴリ集計', '月次サマリー', '分析グラフ', 'レポート出力'],
      },
      limits: { normRules: 500, text: 60, memo: 100 },
    };
  if (path === '/api/backups') return { backups: [] };
  if (path === '/api/settings')
    return {
      normMap: {},
      unrecordedExpMonths: [],
      cashOverrides: {},
      statMinMonths: 12,
      statMinMonthsRange: { min: 1, max: 60, default: 6 },
    };
  if (path === '/api/settings/owner-labels') return { labels: ownerLabels };
  if (path === '/api/admin/users') return { users: [user] };
  if (path === '/api/rules') return { rules: [], usingDefaults: false };
  if (path === '/api/vendor-memory') return { memories: [] };
  if (path === '/api/classification')
    return {
      institutions: [],
      noInstitutionCount: 0,
      institutionOwners: {},
      categoryOptions: [],
      candidates: { biz: [], per: [] },
      edits: [],
    };
  if (path === '/api/summary')
    return {
      overview: { months: ['2025-09', '2026-08'], unrecordedExpMonths: [] },
      defense: { line: 500_000, incomeEstimate: 800_000, status: 'ok' },
      benchmarks: [],
      period,
    };
  if (path === '/api/imports') return { imports: [] };
  if (path === '/api/review-queue')
    return {
      total: 0,
      counts: { classification: 0, reconciliation: 0, import: 0 },
      snoozedCount: 0,
      items: [],
      snoozedItems: [],
    };
  if (path === '/api/analysis/hub') return { views: {} };
  return undefined;
};

mkdirSync(OUTPUT_DIR, { recursive: true });
const profileRoot = mkdtempSync(join(tmpdir(), 'kanjo-settings-chrome-'));
const runtimeProblems: string[] = [];
const unmockedApiPaths = new Set<string>();
const reports: unknown[] = [];
const visualFailures: string[] = [];
let chrome: Awaited<ReturnType<typeof launchHeadlessChrome>>['chrome'] | undefined;
let socket: WebSocket | undefined;

try {
  const launched = await launchHeadlessChrome({ profileRoot, windowSize: '1024,1536' });
  chrome = launched.chrome;
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
        unmockedApiPaths.add(new URL(message.params.request.url).pathname);
        void send('Fetch.fulfillRequest', {
          requestId: message.params.requestId,
          responseCode: 404,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
          body: jsonBody({ error: { code: 'visual_fixture_missing', message: 'fixture missing' } }),
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
  const { evaluate, setViewport } = session;
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });

  for (const viewport of VIEWPORTS) {
    await setViewport(viewport);
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'pointer', value: viewport.mobile ? 'coarse' : 'fine' },
        { name: 'hover', value: viewport.mobile ? 'none' : 'hover' },
      ],
    });
    await send('Page.navigate', { url: `${BASE_URL}/settings` });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const ready = await evaluate(`
        document.querySelector('h1')?.textContent?.trim() === '設定' &&
        document.querySelectorAll('.settings-rules-table tbody tr').length === ${rules.length} &&
        document.querySelector('.settings-panel')?.textContent?.includes('スターバックス')
      `);
      if (ready) break;
      if (attempt === 99)
        throw new Error(
          `${viewport.label} の描画待ちがタイムアウトしました: ${await evaluate(
            'document.body.innerText.slice(0, 800)',
          )}`,
        );
      await sleep(125);
    }
    await evaluate('document.fonts?.ready');
    await sleep(150);

    const metrics = (await evaluate(`(() => {
      const boxOf = (node) => {
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const box = (selector) => boxOf(document.querySelector(selector));
      const workspace = document.querySelector('.settings-workspace');
      const nav = document.querySelector('.settings-workspace > .settings-nav');
      const content = document.querySelector('.settings-workspace > .settings-content');
      const inspector = document.querySelector('.settings-workspace > .settings-inspector');
      const firstRule = document.querySelector('.settings-rule-row');
      const firstRuleInputs = firstRule?.querySelectorAll('input[type="text"]') ?? [];
      const kindControl = firstRule?.querySelector('select');
      const reorderHandle = firstRule?.querySelector('.settings-handle');
      const moveButtons = firstRule?.querySelector('.settings-move');
      const navLinks = [...document.querySelectorAll('.settings-nav a')];
      return {
        viewport: { width: innerWidth, height: innerHeight },
        page: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
        workspace: box('.settings-workspace'),
        nav: box('.settings-workspace > .settings-nav'),
        content: box('.settings-workspace > .settings-content'),
        inspector: box('.settings-workspace > .settings-inspector'),
        normRules: box('#norm-rules'),
        ownerLabels: box('#owner-labels'),
        firstRule: boxOf(firstRule),
        rawInput: boxOf(firstRuleInputs[0]),
        normInput: boxOf(firstRuleInputs[1]),
        kindControl: boxOf(kindControl),
        kindText: kindControl?.selectedOptions[0]?.textContent?.trim() ?? '',
        reorderHandle: boxOf(reorderHandle),
        moveButtonsDisplay: moveButtons ? getComputedStyle(moveButtons).display : '',
        sameWorkspace: Boolean(workspace && nav?.parentElement === workspace && content?.parentElement === workspace && inspector?.parentElement === workspace),
        inspectorVisible: Boolean(inspector && inspector.getBoundingClientRect().width && inspector.getBoundingClientRect().height),
        inspectorText: document.querySelector('.settings-panel')?.textContent ?? '',
        navDisplay: nav ? getComputedStyle(nav.querySelector('ul')).display : '',
        navOverflowX: nav ? getComputedStyle(nav).overflowX : '',
        navScrollable: nav ? nav.scrollWidth > nav.clientWidth + 1 : false,
        minNavTarget: Math.min(...navLinks.map((link) => link.getBoundingClientRect().height)),
        workspaceColumns: workspace ? getComputedStyle(workspace).gridTemplateColumns : '',
      };
    })()`)) as {
      page: { clientWidth: number; scrollWidth: number };
      workspace: { width: number } | null;
      nav: { x: number; y: number; right: number; bottom: number; width: number } | null;
      content: { x: number; y: number; right: number; bottom: number; width: number } | null;
      inspector: { x: number; y: number; right: number; bottom: number; width: number } | null;
      normRules: { y: number; bottom: number } | null;
      ownerLabels: { y: number } | null;
      firstRule: { height: number } | null;
      rawInput: { x: number; right: number; width: number } | null;
      normInput: { x: number; right: number; width: number } | null;
      kindControl: { width: number } | null;
      kindText: string;
      reorderHandle: { width: number; height: number } | null;
      moveButtonsDisplay: string;
      sameWorkspace: boolean;
      inspectorVisible: boolean;
      inspectorText: string;
      navDisplay: string;
      navOverflowX: string;
      navScrollable: boolean;
      minNavTarget: number;
      workspaceColumns: string;
    };

    const failures: string[] = [];
    if (metrics.page.scrollWidth > metrics.page.clientWidth + 1)
      failures.push(`ページ全体に横overflow: ${metrics.page.scrollWidth}-${metrics.page.clientWidth}`);
    if (!metrics.sameWorkspace) failures.push('nav/main/inspectorが同じワークスペースにない');
    if (!metrics.inspectorVisible || !metrics.inspectorText.includes('スターバックス'))
      failures.push('先頭ルールのインスペクタが初期表示されていない');
    if (metrics.minNavTarget < 44) failures.push(`節ナビの操作領域が44px未満: ${metrics.minNavTarget}px`);

    if (!viewport.mobile) {
      if (!metrics.nav || !metrics.content || !metrics.inspector) {
        failures.push('デスクトップの3領域を計測できない');
      } else {
        if (!(metrics.nav.x < metrics.content.x && metrics.content.x < metrics.inspector.x))
          failures.push('デスクトップのX順が nav → main → inspector ではない');
        if (metrics.nav.right > metrics.content.x + 1 || metrics.content.right > metrics.inspector.x + 1)
          failures.push('デスクトップの3領域が重なっている');
      }
      if (metrics.navDisplay !== 'grid')
        failures.push(`デスクトップの節ナビが縦型でない: ${metrics.navDisplay}`);
      for (const [name, input] of [
        ['元の表記', metrics.rawInput],
        ['正規化後', metrics.normInput],
      ] as const) {
        if (
          !metrics.content ||
          !input ||
          input.width <= 0 ||
          input.x < metrics.content.x - 1 ||
          input.right > metrics.content.right + 1
        )
          failures.push(`${name}入力が中央contentの初期可視範囲に収まっていない`);
      }
      if (!metrics.firstRule || metrics.firstRule.height < 44 || metrics.firstRule.height > 80)
        failures.push(`先頭ルール行が44〜80pxに収まっていない: ${metrics.firstRule?.height ?? 0}px`);
      if (
        !metrics.kindControl ||
        metrics.kindControl.width < 68 ||
        !['取引先', '科目'].includes(metrics.kindText)
      )
        failures.push(`種別を判別できない: ${metrics.kindControl?.width ?? 0}px / ${metrics.kindText}`);
      if (!metrics.reorderHandle || metrics.reorderHandle.width < 44 || metrics.reorderHandle.height < 44)
        failures.push(
          `並べ替えハンドルが44px未満: ${metrics.reorderHandle?.width ?? 0}x${metrics.reorderHandle?.height ?? 0}`,
        );
      if (metrics.moveButtonsDisplay !== 'none')
        failures.push(`PCで重複する上下ボタンが表示されている: ${metrics.moveButtonsDisplay}`);
      if (
        !metrics.normRules ||
        !metrics.ownerLabels ||
        metrics.ownerLabels.y < metrics.normRules.bottom ||
        metrics.ownerLabels.y - metrics.normRules.bottom > 16
      )
        failures.push('PCで中央の後続節が集計ルールから離れている');
    } else {
      if (!metrics.nav || !metrics.content || !metrics.inspector) {
        failures.push('モバイルの3領域を計測できない');
      } else {
        if (
          Math.abs(metrics.nav.x - metrics.content.x) > 1 ||
          Math.abs(metrics.content.x - metrics.inspector.x) > 1
        )
          failures.push('モバイルが1列に揃っていない');
        if (metrics.content.y < metrics.nav.bottom - 1) failures.push('モバイルの順序が nav → main ではない');
      }
      if (
        !metrics.normRules ||
        !metrics.inspector ||
        !metrics.ownerLabels ||
        metrics.normRules.bottom > metrics.inspector.y + 1 ||
        metrics.inspector.y >= metrics.ownerLabels.y
      )
        failures.push('モバイルでインスペクタが集計ルール直後かつ名義より前にない');
      if (metrics.navDisplay !== 'flex' || !metrics.navScrollable || metrics.navOverflowX !== 'auto')
        failures.push(
          `モバイルの節ナビが横スクロールでない: ${metrics.navDisplay}/${metrics.navOverflowX}/${metrics.navScrollable}`,
        );
      if (metrics.moveButtonsDisplay === 'none') failures.push('モバイルで上下移動ボタンが表示されていない');
    }

    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const screenshotPath = join(OUTPUT_DIR, `${viewport.label}.png`);
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    let inspectorScreenshotPath: string | undefined;
    if (viewport.mobile) {
      await evaluate(
        `document.querySelector('.settings-inspector')?.scrollIntoView({ block: 'start', behavior: 'instant' })`,
      );
      await sleep(100);
      const inspectorScreenshot = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      inspectorScreenshotPath = join(OUTPUT_DIR, `${viewport.label}-inspector.png`);
      writeFileSync(inspectorScreenshotPath, Buffer.from(inspectorScreenshot.data, 'base64'));
    }
    reports.push({ viewport, metrics, failures, screenshotPath, inspectorScreenshotPath });
    if (failures.length) visualFailures.push(`${viewport.label} の設定画面検査:\n- ${failures.join('\n- ')}`);
  }

  const reportPath = join(OUTPUT_DIR, 'settings-visual.json');
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        target: '/Users/dm/dev/dev/個人開発/kanjo/design/FINAL-UI/images/18-settings.png',
        reports,
        runtimeProblems,
        unmockedApiPaths: [...unmockedApiPaths],
      },
      null,
      2,
    )}\n`,
  );
  if (unmockedApiPaths.size)
    visualFailures.push(`匿名fixtureに無いAPI: ${[...unmockedApiPaths].sort().join(', ')}`);
  if (runtimeProblems.length) visualFailures.push(`実行時エラー: ${runtimeProblems.join(' | ')}`);
  if (visualFailures.length) throw new Error(visualFailures.join('\n\n'));
  console.log(`設定画面の実描画検査: すべて合格\n${OUTPUT_DIR}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(profileRoot);
}
