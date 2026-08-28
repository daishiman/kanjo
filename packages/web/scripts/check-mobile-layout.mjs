// スマホ幅のレイアウトを実描画で検証する。
// 「モバイルは閲覧+仕分け操作を最適化」(非機能要件)を、CSS の目視ではなく実測で固定する。
// 検査する不変条件は4つ:
//   1. ページ本体が横スクロールしない(広い表は表自身の枠内でスクロールする)
//   2. .stack-sm の表が本当に1行=1カードへ畳まれている(セルが縦に積まれている)
//   3. 仕分けカードの見出しが「内容」で、日付より上に出ている(order の効き)
//   4. 主要な操作ボタンのタップ領域が 44px 以上ある
// 使い方: node scripts/check-mobile-layout.mjs  (CHROME_PATH で Chrome の場所を指定できる)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const STYLES = readFileSync(process.env.STYLES_PATH ?? join(WEB_DIR, 'src/styles.css'), 'utf8');
/** iPhone SE(375) と小型 Android(360)。640px 超は既存の thead 検査が見ている */
const WIDTHS = [375, 360];
const PORT = 9700 + Math.floor(Math.random() * 200);
/** タップ領域の下限。WCAG 2.5.5 の 44x44 CSS px に合わせる */
const MIN_TAP = 44;

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

/** Classify.tsx の1行と同じ構造・同じ data-label で組む(列を増やしたらここも足す) */
const classifyRow = (i) => `
<tr>
  <td class="num" data-label="日付">08/${String(i + 1).padStart(2, '0')}</td>
  <td class="tx-description" data-label="内容">架空スーパー第一号店 ネットスーパー配送分</td>
  <td class="tx-institution" data-label="口座">架空カード</td>
  <td data-label="大項目/中項目">食費 / 食料品</td>
  <td class="num" data-label="金額">-12,345</td>
  <td data-label="判定"><span class="pill per">個人</span> <span class="pill neutral">既定</span></td>
  <td data-label="名義"><span class="pill neutral">未設定</span></td>
  <td data-label="証憑"><button type="button" class="mini classify-quick">添付</button></td>
  <td data-label="操作"><div class="classify-quick-actions">
    <button type="button" class="mini classify-quick">個人</button>
    <button type="button" class="mini classify-quick">事業</button>
    <button type="button" class="mini classify-quick">自動に戻す</button>
    <button type="button" class="mini classify-quick edit-trigger">編集する</button>
  </div></td>
</tr>`;

const CLASSIFY_TABLE = `
<div class="card scroll-x classify-table-card" data-pattern="classify">
  <table class="data classify-table stack-sm">
    <thead><tr><th>日付</th><th>内容</th><th>口座</th><th>大項目/中項目</th><th>金額</th><th>判定</th><th>名義</th><th>証憑</th><th>操作</th></tr></thead>
    <tbody>${[0, 1, 2].map(classifyRow).join('')}</tbody>
  </table>
</div>`;

/** 横に広い表。ページ本体ではなく表の枠内でスクロールしなければならない */
const WIDE_TABLE = `
<div class="card scroll-x" data-pattern="matrix">
  <table class="data">
    <thead><tr>${['科目', ...Array.from({ length: 20 }, (_, i) => `2026年${i + 1}月`)].map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody><tr>${['広告宣伝費', ...Array.from({ length: 20 }, () => '1,234,567')].map((v) => `<td class="num">${v}</td>`).join('')}</tr></tbody>
  </table>
</div>`;

const fixture = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${STYLES}</style></head><body>
<div class="shell">
  <aside class="sidebar"><a class="brand" href="#">収支統合管理</a></aside>
  <header class="header"><a class="header-brand" href="#">収支統合管理</a><span class="period">2026年8月</span><span class="spacer"></span><span class="badge ok">防衛ライン OK<span class="badge-detail"> 見込 ¥714,353</span></span></header>
  <main class="main">
    <h1 class="page-title">公私仕分け</h1>
    ${CLASSIFY_TABLE}
    ${WIDE_TABLE}
  </main>
  <footer class="footer">footer</footer>
  <nav class="tabbar">${['概況', '仕分け', '家計', '取込', '設定'].map((t) => `<a class="tab" href="#">${t}</a>`).join('')}</nav>
</div>
<script>
  const header = document.querySelector('.header');
  const apply = () => document.documentElement.style.setProperty('--header-h', Math.round(header.getBoundingClientRect().height) + 'px');
  apply();
  new ResizeObserver(apply).observe(header);
</script>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'kanjo-mobile-'));
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
    '--window-size=375,800',
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

const MEASURE = `(async () => {
  const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (const a of document.getAnimations()) a.finish();
  await wait();
  const rect = (el) => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, w: r.width, h: r.height }; };

  // 1) ページ本体の横あふれ。
  //    ヘッドレスのデバイスエミュレーションでは window.innerWidth が実機と違う値のまま残るため、
  //    レイアウトが実際に使っている幅 = documentElement.clientWidth と比べる。
  const doc = document.documentElement;
  const overflow = { scrollWidth: doc.scrollWidth, viewport: doc.clientWidth };

  // 2) stack-sm が畳まれているか: 同じ行の1つ目と2つ目のセルが別の行に乗っている
  const table = document.querySelector('table.classify-table');
  const cells = [...table.querySelectorAll('tbody tr:first-child > td')];
  const stacked = { first: rect(cells[0]), second: rect(cells[1]) };
  const theadHidden = table.querySelector('thead').getBoundingClientRect().height <= 2;

  // 3) 見出し(内容)が日付より上か
  const desc = table.querySelector('td.tx-description');
  const date = table.querySelector('td.num[data-label="日付"]');
  const order = { descTop: desc.getBoundingClientRect().top, dateTop: date.getBoundingClientRect().top };

  // 4) セルの中身がカードから溢れていないか
  const overflowingCells = cells
    .filter((td) => td.scrollWidth > td.clientWidth + 1)
    .map((td) => ({ label: td.dataset.label, scrollWidth: td.scrollWidth, clientWidth: td.clientWidth }));

  // 5) タップ領域
  const taps = [...document.querySelectorAll('.classify-quick-actions button, .tabbar .tab, td[data-label="証憑"] button')]
    .map((el) => ({ text: el.textContent.trim(), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }));

  // 6) 広い表は表の枠内でスクロールする
  const wide = document.querySelector('[data-pattern="matrix"]');
  const wideScrolls = { scrollWidth: wide.scrollWidth, clientWidth: wide.clientWidth };

  return { overflow, stacked, theadHidden, order, overflowingCells, taps, wideScrolls };
})()`;

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

  const failures = [];
  for (const width of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await send('Page.navigate', { url: pathToFileURL(fixturePath).href });
    await new Promise((r) => setTimeout(r, 600));
    const m = await evalJs(MEASURE);

    if (m.overflow.scrollWidth > m.overflow.viewport + 1)
      failures.push(
        `${width}px ページ本体が横スクロールする(内容 ${m.overflow.scrollWidth}px > 画面 ${m.overflow.viewport}px)`,
      );
    if (!m.theadHidden) failures.push(`${width}px カード化した表の見出し行が視覚的に残っている`);
    // order で並べ替えるので上下どちらが先かは問わない。「同じ行に並んでいない」ことだけを見る
    if (Math.abs(m.stacked.second.top - m.stacked.first.top) <= 1)
      failures.push(
        `${width}px 仕分け表が畳まれていない(1つ目と2つ目のセルが同じ行 ${Math.round(m.stacked.first.top)}px に並んでいる)`,
      );
    if (m.order.descTop >= m.order.dateTop)
      failures.push(
        `${width}px カードの見出しが「内容」になっていない(内容 ${Math.round(m.order.descTop)}px が日付 ${Math.round(m.order.dateTop)}px より下)`,
      );
    for (const c of m.overflowingCells)
      failures.push(
        `${width}px セル「${c.label}」の中身がカードから溢れている(${c.scrollWidth}px > ${c.clientWidth}px)`,
      );
    for (const t of m.taps)
      if (t.h < MIN_TAP - 0.5)
        failures.push(`${width}px 操作「${t.text}」のタップ領域が ${Math.round(t.h)}px で ${MIN_TAP}px 未満`);
    if (m.wideScrolls.scrollWidth <= m.wideScrolls.clientWidth)
      failures.push(`${width}px 広い表が枠内でスクロールしていない(検査用フィクスチャが横に広くない)`);

    console.log(
      `${String(width).padStart(4)}px 本体幅 ${m.overflow.scrollWidth}/${m.overflow.viewport}  カード化 ${Math.abs(m.stacked.second.top - m.stacked.first.top) > 1 ? 'OK' : 'NG'}  見出し=内容 ${m.order.descTop < m.order.dateTop ? 'OK' : 'NG'}  タップ最小 ${Math.round(Math.min(...m.taps.map((t) => t.h)))}px  広い表 ${m.wideScrolls.scrollWidth}/${m.wideScrolls.clientWidth}`,
    );
  }
  await send('Page.navigate', { url: 'about:blank' });
  if (failures.length) {
    console.error(
      `\nスマホ幅レイアウトの実描画検査: ${failures.length} 件の不合格\n- ${failures.join('\n- ')}`,
    );
    process.exitCode = 1;
  } else {
    console.log('\nスマホ幅レイアウトの実描画検査: すべて合格');
  }
} finally {
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  if (!(await waitForChromeExit(5_000)) && chrome.exitCode === null) {
    chrome.kill('SIGKILL');
    await waitForChromeExit(1_000);
  }
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  } catch (error) {
    console.warn(`一時ディレクトリを削除できませんでした(検査結果には影響しません): ${dir}\n${error}`);
  }
}
