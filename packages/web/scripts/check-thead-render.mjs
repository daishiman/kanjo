// 表の見出し固定(sticky)を実描画で検証する。
// CSS 文字列の正規表現ではなく、本物の styles.css を headless Chrome に読み込ませ、
// 「見出し行が先頭データ行に重なるのは、ページ上部の固定ヘッダー直下に固定されている時だけ」を全パターン・全幅で実測する。
// 使い方: node scripts/check-thead-render.mjs  (CHROME_PATH で Chrome の場所を指定できる。無ければ既定の場所を探す)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
// STYLES_PATH を指定すると別の CSS で検査できる(過去版で不合格になることの確認用)
const STYLES = readFileSync(process.env.STYLES_PATH ?? join(WEB_DIR, 'src/styles.css'), 'utf8');
const WIDTHS = [1280, 768, 375];
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

// viewport 指定は index.html と揃える。無いと狭幅のエミュレーションで画面高が実機とかけ離れ、
// 100vh を基準にした高さ(--table-max-h)が検査だけ別物になる。
const fixture = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${STYLES}</style></head><body>
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

let chrome;
let ws;

try {
  const launched = await launchHeadlessChrome({ profileRoot: dir, windowSize: '1280,900' });
  chrome = launched.chrome;
  const { port, targets } = launched;
  let page = targets.find((t) => t.type === 'page');
  if (!page)
    page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
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
      // 3) 表の途中の行を読んでいる状態。
      //    見出し行が固定されていても、それが「表の入れ物の上端」でしかなければ、
      //    入れ物ごとページ外へ出た時点で見出しは消える。ここではその状態を作って、
      //    データ行が見えている間は見出し行も画面内に残ることを確かめる。
      const box = t.parentElement.closest('.scroll-x') ?? (t.closest('.scroll-x'));
      if (box && box.scrollHeight > box.clientHeight + 1) {
        // 入れ物の中でスクロールする表: 入れ物を画面内に置いてから、中ほどまで進める
        window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - 200);
        await wait();
        box.scrollTop = Math.round(box.scrollHeight / 2);
      } else {
        // ページごとスクロールする表: 表の中ほどが画面に来るまで進める
        window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY + Math.round(t.offsetHeight / 2));
      }
      await wait();
      const rows = [...t.querySelectorAll('tbody tr')];
      const visibleRows = rows.filter((r) => {
        const b = r.getBoundingClientRect();
        return b.bottom > header.getBoundingClientRect().bottom && b.top < window.innerHeight;
      }).length;
      states.mid = {
        thTop: th.getBoundingClientRect().top,
        thBottom: th.getBoundingClientRect().bottom,
        headerBottom: header.getBoundingClientRect().bottom,
        viewportH: window.innerHeight,
        visibleRows,
        scrolledInsideBox: Boolean(box && box.scrollTop > 0),
      };
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
      // 表の途中の行を読んでいる間は、見出し行も画面に残っていなければ列の意味が分からなくなる。
      // データ行が1行でも見えているのに見出しが画面外にある置き方を不合格にする。
      const m = states.mid;
      if (m.visibleRows > 0 && (m.thBottom <= m.headerBottom + 0.5 || m.thTop >= m.viewportH)) {
        failures.push(
          `${width}px ${label}: 表の途中(データ行${m.visibleRows}行が見えている状態)で見出し行が画面外(上端 ${Math.round(m.thTop)}px / 表示域 ${Math.round(m.headerBottom)}〜${m.viewportH}px)にある`,
        );
      }
      console.log(
        `${String(width).padStart(4)}px ${pattern.padEnd(20)} 自然: 見出し下端 ${Math.round(n.thBottom)} / 先頭行上端 ${Math.round(n.row1Top)}  読み進め: 見出し上端 ${Math.round(s.thTop)} / ヘッダー下端 ${Math.round(s.headerBottom)} / 先頭行上端 ${Math.round(s.row1Top)}  途中: 見出し上端 ${Math.round(m.thTop)} / 可視行 ${m.visibleRows}${m.scrolledInsideBox ? ' (枠内スクロール)' : ''}`,
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
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(dir);
}
