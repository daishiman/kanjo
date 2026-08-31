#!/usr/bin/env node

// 財務figureの responsive 契約を、実装の DOM と本物の styles.css で実測する。
//
// DOM の正本は FinancialFigure.tsx。かつてここは DOM を文字列リテラルで手書きしており、
// fixture が自分で書いた <details open> を検証する・実装に無い <a class="btn"> の
// タップ領域を測る、といった「実装を一切保証しない合格」を出していた。
// いまは Vite の SSR ローダーで FinancialFigure.tsx をそのまま読み、
// renderToStaticMarkup で1回描いた結果を fixture にしている。
// Chrome 起動は1回のままなので、実ルート検査(Vite常駐/数分)とは別に数秒で回せる。
//
// 使い方: node scripts/check-mobile-financial-layout.mjs [--output-dir=DIR]
//
// ソースの指紋(sourceDigest)は source-digest.mjs が自分で計算する。外から渡す口は持たない。

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { createServer } from 'vite';
import { openCdpSession } from './cdp.mjs';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';
import { computeSourceDigest } from './source-digest.mjs';
import { MIN_TAP_TARGET_PX, isMobileWidth, viewportsByLabel } from './viewports.mjs';

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const styles = readFileSync(join(WEB_ROOT, 'src/styles.css'), 'utf8');
const outputArgument = process.argv.find((argument) => argument.startsWith('--output-dir='));
const outputDir = outputArgument ? resolve(outputArgument.slice('--output-dir='.length)) : null;
// 廃止した引数を黙って無視すると、渡した側は指紋が反映されたと誤解する。
if (process.argv.some((argument) => argument.startsWith('--source-digest=')))
  throw new Error('--source-digest は廃止しました。指紋は scripts/source-digest.mjs が計算します');
const profileRoot = mkdtempSync(join(tmpdir(), 'kanjo-mobile-financial-chrome-'));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'kanjo-mobile-financial-fixture-'));
const fixturePath = join(fixtureRoot, 'index.html');

/**
 * 検査用の匿名モデル。
 * 表が狭幅で必ず枠外へ出る幅になるよう、系列は6本・行は12ヶ月ぶんにしてある
 * (かつてのようにインラインの min-width で幅を作らない)。
 */
const SERIES = [
  { key: 'sales', label: '売上', unit: 'yen' },
  { key: 'cost', label: '経費', unit: 'yen' },
  { key: 'profit', label: '利益', unit: 'yen', signed: true },
  { key: 'fixed', label: '固定費', unit: 'yen' },
  { key: 'variable', label: '変動費', unit: 'yen' },
  { key: 'balance', label: '現預金残高', unit: 'yen' },
];
const yen = (value) => `${value < 0 ? '-' : ''}¥${Math.abs(value).toLocaleString('ja-JP')}`;
const FIGURE_MODEL = {
  id: 'mobile-financial-fixture',
  title: '売上・経費トレンド',
  summary: '8月は売上が経費を上回っています。',
  period: '2026年01月〜2026年12月',
  unitLabel: '円',
  rowHeader: '月',
  summarySeries: SERIES.map(({ key, label }) => ({ key, label })),
  series: SERIES.map((series) => ({ ...series, values: [] })),
  rows: Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0');
    const base = (index + 1) * 1_000;
    return {
      key: `2026-${month}`,
      label: `2026年${month}月`,
      cells: [base * 12, base * 7, base * 5, base * 4, base * 3, base * 40].map((raw) => ({
        raw,
        text: yen(raw),
      })),
    };
  }),
  action: '赤字月は正確な値を表で確認します。',
  tableLabel: '売上・経費トレンドの正確な値',
};

/** FinancialFigure.tsx を実装のまま描き、fixture の DOM にする。 */
async function renderFigureMarkup() {
  const vite = await createServer({
    root: WEB_ROOT,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const { FinancialFigure } = await vite.ssrLoadModule('/src/components/FinancialFigure.tsx');
    const reactDomServer = await import('react-dom/server');
    const renderToStaticMarkup =
      reactDomServer.renderToStaticMarkup ?? reactDomServer.default?.renderToStaticMarkup;
    return renderToStaticMarkup(
      createElement(
        FinancialFigure,
        { model: FIGURE_MODEL },
        // 実画面の Chart.js canvas に相当する子。値そのものは読み上げに含めない契約を保つ。
        createElement('canvas', {
          width: 640,
          height: 240,
          'aria-label': '売上・経費トレンドの図',
        }),
      ),
    );
  } finally {
    await vite.close();
  }
}

const figureMarkup = await renderFigureMarkup();

writeFileSync(
  fixturePath,
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body>
  <div class="shell"><header class="header"><a href="#main">収支統合管理</a></header><main class="main" id="main">
    <div style="height: 48px"></div>
    ${figureMarkup}
  </main><nav class="tabbar" aria-label="モバイルナビゲーション"><a class="tab" aria-current="page" href="#main">概況</a><a class="tab" href="#done">分析</a></nav></div>
  </body></html>`,
);

// 実ルート検査(check-financial-visuals.mjs)が同じ幅を全件走らせるので、
// ここは「実ルートでは再現しない条件」だけに絞る:
//   320 = 最小幅の reflow、375 = 代表的なモバイル幅、reduced-motion = 動きを止めた状態。
// (実ルート側は prefers-reduced-motion: reduce を常時かけるため、動きのある状態はここでしか測れない)
const cases = viewportsByLabel(['320', '375', 'reduced-motion']);
const startedAt = new Date().toISOString();
const measurements = [];

let chrome;
let session;

function assert(condition, message, detail) {
  if (!condition) throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
}

try {
  const launched = await launchHeadlessChrome({ profileRoot, windowSize: '1600,1000' });
  chrome = launched.chrome;
  session = await openCdpSession(launched);
  const { send, evaluate } = session;

  await send('Page.enable');
  await send('Runtime.enable');
  const browserVersion = await send('Browser.getVersion');

  if (outputDir) mkdirSync(join(outputDir, 'screenshots'), { recursive: true });

  for (const testCase of cases) {
    const mobile = isMobileWidth(testCase.width);
    await session.setViewport({ ...testCase, mobile });
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'pointer', value: mobile ? 'coarse' : 'fine' },
        {
          name: 'prefers-reduced-motion',
          value: testCase.reducedMotion ? 'reduce' : 'no-preference',
        },
      ],
    });
    await send('Page.navigate', { url: pathToFileURL(fixturePath).href });
    await new Promise((resolve) => setTimeout(resolve, 180));

    // :focus-visible は「キーボード入力が起点」のときに表示される。
    // DOMの focus() だけではポインター操作扱いになるChromeのヒューリスティックを避け、
    // 実際のTab入力を送って検査対象(実装で唯一の操作要素である details の summary)まで進める。
    let keyboardReachedSummary = false;
    for (let tabIndex = 0; tabIndex < 10; tabIndex += 1) {
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
      const reached = await evaluate(
        `document.activeElement === document.querySelector('.financial-figure__details > summary')`,
      );
      if (reached) {
        keyboardReachedSummary = true;
        break;
      }
    }

    const value = await evaluate(`(async () => {
        const wait = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await wait();
        const rect = (element) => { const value = element.getBoundingClientRect(); return { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height }; };
        const doc = document.documentElement;
        const figure = document.querySelector('[data-financial-figure]');
        const chart = document.querySelector('.financial-figure__chart');
        const details = document.querySelector('.financial-figure__details');
        const detailsSummary = details.querySelector('summary');
        const tabbar = document.querySelector('.tabbar');
        const focusStyle = getComputedStyle(detailsSummary);
        const closed = {
          overflow: doc.scrollWidth - doc.clientWidth,
          detailsOpen: details.open,
          detailsHeight: rect(details).height,
        };

        details.open = true;
        await wait();
        const scroll = document.querySelector('.financial-figure__table-scroll');
        details.scrollIntoView({ block: 'end' });
        await wait();

        return {
          viewport: doc.clientWidth,
          closed,
          overflow: doc.scrollWidth - doc.clientWidth,
          figure: rect(figure),
          chart: rect(chart),
          seven: ['[data-financial-summary]','[data-financial-period]','[data-financial-unit]','[data-financial-series] li','[data-financial-action]','.financial-figure__details table, .heatmap-scroll table'].every((selector) => figure.querySelector(selector)),
          scroll: { ...rect(scroll), overflow: scroll.scrollWidth - scroll.clientWidth, role: scroll.getAttribute('role'), label: scroll.getAttribute('aria-label'), tabIndex: scroll.tabIndex },
          summary: rect(detailsSummary),
          details: rect(details),
          tabbar: rect(tabbar),
          mainPaddingBottom: Number.parseFloat(getComputedStyle(document.querySelector('.main')).paddingBottom) || 0,
          containerType: getComputedStyle(figure).containerType,
          focusOutline: focusStyle.outlineStyle,
          focusTarget: document.activeElement === detailsSummary,
          canvasName: document.querySelector('canvas').getAttribute('aria-label'),
          mainAnimationSeconds: Number.parseFloat(getComputedStyle(document.querySelector('.main')).animationDuration) || 0,
        };
      })()`);

    assert(keyboardReachedSummary && value.focusTarget, `${testCase.label}: keyboard focus order`, value);
    assert(value.focusOutline !== 'none', `${testCase.label}: focus-visible missing`, value);

    // 実装の既定は「閉じた表」。閉じた状態が本当に成立しているか(=高さを持つ図として読めるか)を先に測る。
    assert(
      value.closed.detailsOpen === false,
      `${testCase.label}: disclosure must start closed`,
      value.closed,
    );
    assert(value.closed.overflow <= 1, `${testCase.label}: document overflow (closed)`, value.closed);
    // 開いても本体は横に伸びない = 広い表が枠内でスクロールしている、が responsive 契約の核。
    assert(value.overflow <= 1, `${testCase.label}: document overflow (open)`, value);
    assert(
      value.figure.width > 0 && value.figure.height > 0,
      `${testCase.label}: figure zero-size`,
      value.figure,
    );
    assert(
      value.chart.width > 0 && value.chart.height > 0,
      `${testCase.label}: chart host zero-size`,
      value.chart,
    );
    assert(value.seven, `${testCase.label}: semantic seven elements missing`, value);
    // figure 自身がコンテナでないと、サイドバー有無で実効幅が変わる場所の @container が効かない。
    assert(
      value.containerType.includes('inline-size'),
      `${testCase.label}: figure is not an inline-size container`,
      value.containerType,
    );
    assert(
      value.scroll.role === 'region' && value.scroll.label && value.scroll.tabIndex === 0,
      `${testCase.label}: local scroll is not accessible`,
      value.scroll,
    );
    if (mobile) {
      // 狭幅では表が枠内に収まりきらないのが前提。ここが0だと「枠内スクロール」の検査が空振りする。
      assert(
        value.scroll.overflow > 0,
        `${testCase.label}: wide table is not scrolled locally`,
        value.scroll,
      );
      assert(
        value.summary.height >= MIN_TAP_TARGET_PX && value.summary.width >= MIN_TAP_TARGET_PX,
        `${testCase.label}: summary tap target`,
        value.summary,
      );
      assert(
        value.details.bottom <= value.tabbar.top + 1,
        `${testCase.label}: disclosure obscured by tabbar`,
        value,
      );
      assert(
        value.mainPaddingBottom >= value.tabbar.height,
        `${testCase.label}: safe-area/tabbar padding`,
        value,
      );
    }
    assert(
      value.canvasName && !value.canvasName.includes('¥'),
      `${testCase.label}: canvas repeats table values`,
      value.canvasName,
    );
    if (testCase.reducedMotion) {
      assert(
        value.mainAnimationSeconds <= 0.001,
        `${testCase.label}: reduced-motion did not stop the page animation`,
        value.mainAnimationSeconds,
      );
    } else {
      // reduce 側の合格が「そもそも動いていなかっただけ」にならないよう、通常時に動きがあることを固定する。
      assert(
        value.mainAnimationSeconds > 0.001,
        `${testCase.label}: baseline animation missing (reduced-motion check would be vacuous)`,
        value.mainAnimationSeconds,
      );
    }

    let screenshot = null;
    if (outputDir) {
      const screenshotName = `${testCase.label}.png`;
      const captured = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      writeFileSync(join(outputDir, 'screenshots', screenshotName), Buffer.from(captured.data, 'base64'));
      screenshot = `screenshots/${screenshotName}`;
    }
    measurements.push({
      case: testCase.label,
      width: testCase.width,
      height: testCase.height,
      zoom: testCase.zoom,
      reducedMotion: testCase.reducedMotion,
      result: 'PASS',
      screenshot,
      actual: value,
    });
    process.stdout.write(`${testCase.label}: PASS\n`);
  }

  if (outputDir) {
    // 値だけでなく、対象一覧・各ファイルの個別ハッシュ・算出手段も一緒に残す。
    // どのファイルが変わって digest が動いたのかを、読み手が手で突き合わせずに済むようにする。
    const { sourceDigest, ...digestInputs } = computeSourceDigest();
    writeFileSync(
      join(outputDir, 'mobile-viewport-results.json'),
      `${JSON.stringify(
        {
          schemaVersion: 3,
          featureId: 'feat-mobile-financial-visualization',
          sourceDigest,
          digestInputs,
          startedAt,
          completedAt: new Date().toISOString(),
          runtime: {
            node: process.version,
            chrome: browserVersion.product,
            userAgent: browserVersion.userAgent,
          },
          fixture: 'FinancialFigure.tsx を renderToStaticMarkup で描画し、src/styles.css を被せた匿名データ',
          result: 'PASS',
          measurements,
        },
        null,
        2,
      )}\n`,
    );
  }

  process.stdout.write('mobile financial layout: すべて合格\n');
} finally {
  session?.close();
  await stopHeadlessChrome(chrome);
  // Chromeのutility processが親終了後もstderrのpipeを保持する場合がある。
  // 検査本体は既に終了しているためread側を明示的に閉じ、VitestのexecFileが
  // 出力EOFを待ち続けないようにする。
  chrome?.stderr?.destroy();
  await removeProfileRoot(profileRoot);
  await removeProfileRoot(fixtureRoot);
}
