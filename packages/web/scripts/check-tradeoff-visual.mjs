// トレードオフ画面を匿名 fixture で実描画し、正本画像の構造とレスポンシブ配置を検証する。
// 使い方:
//   pnpm dev --host 127.0.0.1 --port 4177
//   KANJO_VISUAL_BASE_URL=http://127.0.0.1:4177 node scripts/check-tradeoff-visual.mjs
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCdpSession } from './cdp.mjs';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';

const BASE_URL = process.env.KANJO_VISUAL_BASE_URL ?? 'http://127.0.0.1:4177';
const OUTPUT_DIR = process.env.KANJO_VISUAL_OUTPUT_DIR ?? join(tmpdir(), 'kanjo-tradeoff-visual');
const key = (account, partner) => `v1:${JSON.stringify([account, partner])}`;
const rawCandidates = [
  ['広告・販促費', 'A社（Web広告）', 120_000, 'low', 'down', '効果指標が前年より低下'],
  ['業務委託費', 'B社（コンテンツ制作）', 80_000, 'mid', 'flat', '一部を内製化可能'],
  ['会議費', '', 15_000, 'low', 'flat', 'オンライン活用で削減余地'],
  ['サブスク', 'C社（デザインツール）', 12_000, 'mid', 'down', '利用頻度が低下'],
  ['消耗品費', '', 20_000, 'low', 'flat', '代替品で削減可能'],
  ['旅費・交通費', '', 30_000, 'mid', 'down', '出張のオンライン化'],
  ['通信費', '', 18_000, 'high', 'flat', '業務継続に必要'],
  ['オフィス費', '', 50_000, 'mid', 'flat', 'フリープランで削減余地'],
];
const candidates = rawCandidates.map(([account, partner, monthly, need, trend, reason]) => ({
  key: key(account, partner),
  account,
  partner,
  monthly,
  annual: monthly * 12,
  need,
  needSource: 'auto',
  trend,
  reason,
  memo: null,
  relatedTo: account === 'サブスク' ? '/subscriptions' : null,
}));
const period = {
  applied: { from: '2025-09', to: '2026-08' },
  label: '2025年9月 - 2026年8月',
  full: { from: '2025-09', to: '2026-08' },
  years: ['2025', '2026'],
  monthCount: 12,
};
const fixtures = {
  '/api/auth/me': {
    authenticated: true,
    user: {
      id: 'visual-user',
      email: 'visual@example.test',
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      lastLoginAt: null,
    },
  },
  '/api/summary': {
    overview: { months: ['2025-09', '2026-08'], unrecordedExpMonths: [] },
    defense: { status: 'nodata', forecast: { level: 'nodata' } },
    benchmarks: [],
    period,
  },
  '/api/imports': { imports: [] },
  '/api/review-queue': {
    total: 0,
    counts: { classification: 0, reconciliation: 0, import: 0 },
    snoozedCount: 0,
    items: [],
  },
  '/api/analysis/hub': { views: {}, period },
  '/api/tradeoff': {
    candidates,
    defense: { monthlyMargin: 820_000, status: 'ok' },
    latest: null,
  },
};

const jsonBody = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
const profileRoot = mkdtempSync(join(tmpdir(), 'kanjo-tradeoff-chrome-'));
mkdirSync(OUTPUT_DIR, { recursive: true });
let chrome;
let socket;
let send;
const runtimeProblems = [];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  const launched = await launchHeadlessChrome({ profileRoot, windowSize: '1440,1100' });
  chrome = launched.chrome;
  const session = await openCdpSession({
    port: launched.port,
    targets: launched.targets,
    onEvent: (message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        runtimeProblems.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
        return;
      }
      if (message.method !== 'Fetch.requestPaused') return;
      const requestUrl = new URL(message.params.request.url);
      const response = fixtures[requestUrl.pathname];
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
  socket = session.socket;
  send = session.send;
  const { evaluate } = session;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`${label} の描画待ちがタイムアウトしました`);
  };
  const capture = async (name) => {
    const dimensions = await evaluate(`({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    })`);
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
    });
    writeFileSync(join(OUTPUT_DIR, name), Buffer.from(screenshot.data, 'base64'));
  };

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: `${BASE_URL}/tradeoff` });
  await waitFor("document.querySelectorAll('.tradeoff-candidates tbody tr').length === 8", 'Tradeoff');
  await evaluate(`(() => {
    const set = (selector, value) => {
      const input = document.querySelector(selector);
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('input[placeholder="例: 新しい業務ツール"]', '新規採用ツール');
    set('input[placeholder="円"]', '80000');
    const boxes = [...document.querySelectorAll('.tradeoff-candidates tbody input[type="checkbox"]')];
    boxes[1]?.click();
    boxes[3]?.click();
    boxes[5]?.click();
  })()`);
  await waitFor("Boolean(document.querySelector('.tradeoff-selection'))", '選択中バー');
  await sleep(200);

  const desktop = await evaluate(`(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    };
    const step = document.querySelector('.tradeoff-step-number');
    const style = step ? getComputedStyle(step) : null;
    return {
      viewport: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      primary: box('.tradeoff-primary'),
      side: box('.tradeoff-side'),
      recommendation: box('.tradeoff-recommendations'),
      calculations: box('.tradeoff-calculations'),
      layout: box('.tradeoff-layout'),
      step: step ? { width: step.offsetWidth, height: step.offsetHeight, radius: style.borderRadius } : null,
      sticky: getComputedStyle(document.querySelector('.tradeoff-side')).position,
      stickyTop: getComputedStyle(document.querySelector('.tradeoff-side')).top,
      cta: document.querySelector('.tradeoff-selection .primary')?.textContent?.trim(),
      summary: document.querySelector('.tradeoff-side')?.textContent?.replace(/\s+/g, ' ').trim(),
    };
  })()`);
  const failures = [];
  if (desktop.pageWidth > desktop.viewport + 1)
    failures.push(`desktop のページ本体が横にはみ出す: ${desktop.pageWidth}/${desktop.viewport}`);
  if (!desktop.primary || !desktop.side || desktop.primary.right > desktop.side.left + 1)
    failures.push('desktop で1・2と試算結果が2列に分かれていない');
  if (
    !desktop.layout ||
    !desktop.recommendation ||
    !desktop.calculations ||
    desktop.recommendation.width < desktop.layout.width - 1 ||
    desktop.calculations.width < desktop.layout.width - 1
  )
    failures.push('desktop で推奨の組み合わせまたは計算例が全幅ではない');
  if (!desktop.step || desktop.step.width !== desktop.step.height || desktop.step.radius !== '50%')
    failures.push(`ステップ番号が円形ではない: ${JSON.stringify(desktop.step)}`);
  if (desktop.sticky !== 'sticky' || Number.parseFloat(desktop.stickyTop) < 64)
    failures.push(`右パネルの sticky 位置がヘッダー下ではない: ${desktop.sticky}/${desktop.stickyTop}`);
  if (desktop.cta !== 'この試算を記録する') failures.push(`CTA が不正: ${desktop.cta}`);
  for (const expected of ['新規採用ツール', '毎月', '3 件', '122,000'])
    if (!desktop.summary?.includes(expected)) failures.push(`右サマリーに「${expected}」がない`);
  await capture('tradeoff-1440.png');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1024,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(250);
  const compactDesktop = await evaluate(`(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width } : null;
    };
    return {
      viewport: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      layout: box('.tradeoff-layout'),
      primary: box('.tradeoff-primary'),
      side: box('.tradeoff-side'),
      recommendation: box('.tradeoff-recommendations'),
      calculations: box('.tradeoff-calculations'),
      comboOverflow: [...document.querySelectorAll('.tradeoff-combos :is(th, td)')].some(
        (cell) => cell.scrollWidth > cell.clientWidth + 1,
      ),
      exampleOverflow: [...document.querySelectorAll('.tradeoff-examples li')].some(
        (item) => item.scrollWidth > item.clientWidth + 1,
      ),
      formFields: [...document.querySelectorAll('.tradeoff-form > .tradeoff-field')].map((field) => {
        const rect = field.getBoundingClientRect();
        return { className: field.className, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
      }),
      formOverflow: (() => {
        const form = document.querySelector('.tradeoff-form')?.getBoundingClientRect();
        return form
          ? [...document.querySelectorAll('.tradeoff-form > .tradeoff-field')].some(
              (field) => field.getBoundingClientRect().right > form.right + 1,
            )
          : true;
      })(),
    };
  })()`);
  if (compactDesktop.pageWidth > compactDesktop.viewport + 1)
    failures.push(
      `1024px のページ本体が横にはみ出す: ${compactDesktop.pageWidth}/${compactDesktop.viewport}`,
    );
  if (
    !compactDesktop.primary ||
    !compactDesktop.side ||
    compactDesktop.primary.right > compactDesktop.side.left + 1
  )
    failures.push('1024px で1・2と試算結果が2列に分かれていない');
  if (
    !compactDesktop.layout ||
    !compactDesktop.recommendation ||
    !compactDesktop.calculations ||
    compactDesktop.recommendation.width < compactDesktop.layout.width - 1 ||
    compactDesktop.calculations.width < compactDesktop.layout.width - 1
  )
    failures.push('1024px で推奨の組み合わせまたは計算例が全幅ではない');
  if (compactDesktop.comboOverflow) failures.push('1024px で推奨組み合わせのセル内容が重なる');
  if (compactDesktop.exampleOverflow) failures.push('1024px で計算例の内容がカードからはみ出す');
  if (compactDesktop.formOverflow) failures.push('1024px で新しい支出の入力がカードからはみ出す');
  if (compactDesktop.formFields.length !== 5)
    failures.push(`1024px で新しい支出の5項目が描画されない: ${compactDesktop.formFields.length}`);
  for (let index = 0; index < compactDesktop.formFields.length; index += 1) {
    for (const other of compactDesktop.formFields.slice(index + 1)) {
      const field = compactDesktop.formFields[index];
      const overlap =
        Math.min(field.right, other.right) - Math.max(field.left, other.left) > 1 &&
        Math.min(field.bottom, other.bottom) - Math.max(field.top, other.top) > 1;
      if (overlap) failures.push(`1024px で入力項目同士が重なる: ${field.className} / ${other.className}`);
    }
  }
  await capture('tradeoff-1024.png');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(250);
  const mobile = await evaluate(`(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    };
    const cta = document.querySelector('.tradeoff-selection .primary');
    return {
      viewport: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      primary: box('.tradeoff-primary'),
      side: box('.tradeoff-side'),
      recommendation: box('.tradeoff-recommendations'),
      ctaHeight: cta?.getBoundingClientRect().height ?? 0,
    };
  })()`);
  if (mobile.pageWidth > mobile.viewport + 1)
    failures.push(`mobile のページ本体が横にはみ出す: ${mobile.pageWidth}/${mobile.viewport}`);
  if (
    !mobile.primary ||
    !mobile.side ||
    !mobile.recommendation ||
    mobile.primary.bottom > mobile.side.top + 1 ||
    mobile.side.bottom > mobile.recommendation.top + 1
  )
    failures.push('mobile で1・2、試算結果、3が順に縦積みになっていない');
  if (mobile.ctaHeight < 44) failures.push(`mobile CTA が44px未満: ${mobile.ctaHeight}`);
  await capture('tradeoff-375.png');

  if (runtimeProblems.length) failures.push(`runtime: ${runtimeProblems.join(' / ')}`);
  if (failures.length) {
    console.error(`Tradeoff 実描画検査: ${failures.length}件の不合格\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Tradeoff 実描画検査: すべて合格\nスクリーンショット: ${OUTPUT_DIR}`);
  }
} finally {
  if (socket?.readyState < WebSocket.CLOSING) socket.close();
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(profileRoot);
}
