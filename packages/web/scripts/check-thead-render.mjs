// 表の見出し固定(sticky)を実描画で検証する。
// CSS 文字列の正規表現ではなく、本物の styles.css を headless Chrome に読み込ませ、
// 「見出し行が先頭データ行に重なるのは、ページ上部の固定ヘッダー直下に固定されている時だけ」を全パターン・全幅で実測する。
// 使い方: node scripts/check-thead-render.mjs  (CHROME_PATH で Chrome の場所を指定できる。無ければ既定の場所を探す)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
// STYLES_PATH を指定すると別の CSS で検査できる(過去版で不合格になることの確認用)
const STYLES = readFileSync(process.env.STYLES_PATH ?? join(WEB_DIR, 'src/styles.css'), 'utf8');
const WIDTHS = [1280, 768, 375];
const PORT = 9400 + Math.floor(Math.random() * 300);

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found)
    throw new Error(`Chrome が見つかりません。CHROME_PATH を指定してください: ${candidates.join(', ')}`);
  return found;
}

// 画面で実際に使っている表の置き方を網羅する(新しい置き方を増やしたらここにも足す)
const rows = (n) =>
  Array.from(
    { length: n },
    (_, i) => `<tr><td>行${i + 1}</td><td class="num">${(i + 1) * 1000}</td><td class="num">${i}</td></tr>`,
  ).join('');
const table = (extraClass = '') =>
  `<table class="data ${extraClass}"><thead><tr><th>項目</th><th>金額</th><th>件数</th></tr></thead><tbody>${rows(40)}</tbody></table>`;
const PATTERNS = [
  {
    id: 'card',
    label: '.card > table.data(通常のカード)',
    html: `<div class="card" data-pattern="card"><h2>通常のカード</h2>${table()}</div>`,
  },
  {
    id: 'card-scroll-x',
    label: '.card.scroll-x > table.data(横スクロール枠を兼ねたカード)',
    html: `<div class="card scroll-x" data-pattern="card-scroll-x"><h2>横スクロール枠のカード</h2>${table()}</div>`,
  },
  {
    id: 'card-inner-scroll-x',
    label: '.card > .scroll-x > table.data(カード内の横スクロール枠)',
    html: `<div class="card" data-pattern="card-inner-scroll-x"><h2>カード内の横スクロール枠</h2><div class="scroll-x">${table('ai-table')}</div></div>`,
  },
];

const fixture = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${STYLES}</style></head><body>
<div class="shell">
  <aside class="sidebar"><a class="brand" href="#">収支統合管理</a></aside>
  <header class="header"><a class="header-brand" href="#">収支統合管理</a><span class="period">2026年7月</span><span class="spacer"></span><span class="badge ok">防衛ライン OK</span><span class="badge warn">未記帳 2026年5月・2026年6月</span></header>
  <main class="main">
    <h1 class="page-title">実描画検査</h1>
    <div style="height:400px"></div>
    ${PATTERNS.map((p) => p.html).join('\n<div style="height:300px"></div>\n')}
    <div style="height:1200px"></div>
  </main>
  <footer class="footer">footer</footer>
</div>
<script>
  // Layout.tsx と同じ処理: 固定ヘッダーの実高さを --header-h に反映する(狭幅でヘッダーが折り返す場合に必要)
  const header = document.querySelector('.header');
  const apply = () => document.documentElement.style.setProperty('--header-h', Math.round(header.getBoundingClientRect().height) + 'px');
  apply();
  new ResizeObserver(apply).observe(header);
</script>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'kanjo-thead-'));
const fixturePath = join(dir, 'fixture.html');
writeFileSync(fixturePath, fixture);

const chrome = spawn(
  chromePath(),
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(dir, 'profile')}`,
    '--no-first-run',
    '--window-size=1280,900',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore'] },
);
let ws;

const waitForChromeExit = (timeoutMs) => {
  if (chrome.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      chrome.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    chrome.once('exit', onExit);
  });
};

try {
  let targets;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      break;
    } catch {}
  }
  if (!targets) throw new Error('Chrome が起動しませんでした');
  let page = targets.find((t) => t.type === 'page');
  if (!page)
    page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evalJs = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
    return res.result?.result?.value;
  };
  await send('Page.enable');

  const MEASURE = `(async () => {
    const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // ページ登場アニメーション(.main の translateY)の途中を測ると、変形の分だけ位置がずれる。
    // CSS は変えず、アニメーションを完了状態へ送ってから測る(定常状態の sticky を検証するため)。
    for (const a of document.getAnimations()) a.finish();
    await wait();
    const header = document.querySelector('.header');
    const out = [];
    for (const t of document.querySelectorAll('table.data')) {
      const pattern = t.closest('[data-pattern]').dataset.pattern;
      const th = t.querySelector('thead th');
      const row1 = t.querySelector('tbody tr');
      const states = {};
      // 1) 表全体が画面内にある自然な状態(表の上端を画面上から 300px に置く)
      window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 300);
      await wait();
      states.natural = { thTop: th.getBoundingClientRect().top, thBottom: th.getBoundingClientRect().bottom, row1Top: row1.getBoundingClientRect().top, headerBottom: header.getBoundingClientRect().bottom };
      // 2) 表の途中まで読み進めた状態(表の上端が画面の上に 150px 隠れる)
      window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY + 150);
      await wait();
      states.scrolled = { thTop: th.getBoundingClientRect().top, thBottom: th.getBoundingClientRect().bottom, row1Top: row1.getBoundingClientRect().top, headerBottom: header.getBoundingClientRect().bottom, headerPos: getComputedStyle(header).position };
      out.push({ pattern, states });
    }
    window.scrollTo(0, 0);
    return out;
  })()`;

  const failures = [];
  for (const width of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });
    await send('Page.navigate', { url: pathToFileURL(fixturePath).href });
    await new Promise((r) => setTimeout(r, 600));
    const results = await evalJs(MEASURE);
    for (const { pattern, states } of results) {
      const label = PATTERNS.find((p) => p.id === pattern)?.label ?? pattern;
      const n = states.natural;
      // 自然な状態では見出し行は必ず先頭データ行の上にある(押し出されて重なったら不合格)
      if (n.thBottom > n.row1Top + 0.5) {
        failures.push(
          `${width}px ${label}: 表が画面内にある状態で見出し行が先頭行に ${Math.round(n.thBottom - n.row1Top)}px 重なっている`,
        );
      }
      const s = states.scrolled;
      // 読み進めた状態: 見出しが先頭行に重なってよいのは「固定ヘッダーの直下に固定されている」時だけ
      if (s.thBottom > s.row1Top + 0.5 && Math.abs(s.thTop - s.headerBottom) > 1) {
        failures.push(
          `${width}px ${label}: 読み進めた状態で見出し行が固定ヘッダー直下(${Math.round(s.headerBottom)}px)ではなく ${Math.round(s.thTop)}px にあり、先頭行に重なっている`,
        );
      }
      // 固定ヘッダーの裏に見出しが隠れてはいけない(見出しが画面内にある間)
      if (s.thBottom > 0 && s.thTop < s.headerBottom - 1) {
        failures.push(
          `${width}px ${label}: 読み進めた状態で見出し行(上端 ${Math.round(s.thTop)}px)が固定ヘッダー(下端 ${Math.round(s.headerBottom)}px)の裏に隠れている`,
        );
      }
      console.log(
        `${String(width).padStart(4)}px ${pattern.padEnd(20)} 自然: 見出し下端 ${Math.round(n.thBottom)} / 先頭行上端 ${Math.round(n.row1Top)}  読み進め: 見出し上端 ${Math.round(s.thTop)} / ヘッダー下端 ${Math.round(s.headerBottom)} / 先頭行上端 ${Math.round(s.row1Top)}`,
      );
    }
  }
  await send('Page.navigate', { url: 'about:blank' });
  if (failures.length) {
    console.error(`\n表の見出し固定の実描画検査: ${failures.length} 件の不合格\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('\n表の見出し固定の実描画検査: すべて合格');
  }
} finally {
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  if (!(await waitForChromeExit(5_000)) && chrome.exitCode === null) {
    chrome.kill('SIGKILL');
    await waitForChromeExit(1_000);
  }
  // Chromeの子プロセスがprofile配下を掴んだまま終わることがある(Linuxで顕著)。
  // 一時ディレクトリの後片付けは再試行し、それでも残る場合も検査結果は落とさない。
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  } catch (error) {
    console.warn(`一時ディレクトリを削除できませんでした(検査結果には影響しません): ${dir}\n${error}`);
  }
}
