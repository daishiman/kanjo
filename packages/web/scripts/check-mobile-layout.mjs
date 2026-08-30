// スマホ幅のレイアウトを実描画で検証する。
// 「モバイルは閲覧+仕分け操作を最適化」(非機能要件)を、CSS の目視ではなく実測で固定する。
// 検査する不変条件は9つ:
//   1. ページ本体が横スクロールしない(広い表は表自身の枠内でスクロールする)
//   2. .stack-sm の表が本当に1行=1カードへ畳まれている(セルが縦に積まれている)
//   3. 仕分けカードの見出しが「内容」で、日付より上に出ている(order の効き)
//   4. 主要な操作ボタンのタップ領域が 44px 以上ある
//   5. 200%相当でも下部navのラベルを分断せず、nav内だけを横スクロールできる
//   6. 書き出しaction sheetがvisual viewportの左右に収まり、項目が欠けない
//   7. ナビの視覚契約(44pxの行、iconとlabelの間隔、現在地の色以外の手掛かり、reduced-motion)
//   8. デスクトップ幅のサイドバー総高(同じフィクスチャを常設サイドバーの幅で描き直して測る。
//      画面を足すたびに縦が伸びて一覧性を失う退行を、上限で止める)
//   9. 開いた分割科目パネルが切れず、狭幅でも科目をタップして選べる
// 使い方: node scripts/check-mobile-layout.mjs  (CHROME_PATH で Chrome の場所を指定できる)
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// タブに載るrouteの一覧は routeMetadata.ts が正本。ここで手書きすると二重管理になり、
// 画面を1つ足した時にフィクスチャだけ古いまま「合格」を出す。
// Node 22.18以降の型ストリップで .ts をそのまま読める(CIも node-version: 22)。
import { APP_ROUTES, MOBILE_ROUTES } from '../src/routeMetadata.ts';
import { launchHeadlessChrome, removeProfileRoot, stopHeadlessChrome } from './headless-chrome.mjs';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const STYLES = readFileSync(process.env.STYLES_PATH ?? join(WEB_DIR, 'src/styles.css'), 'utf8');
/** iPhone SE(375) と小型 Android(360)。640px 超は既存の thead 検査が見ている */
const WIDTHS = [375, 360];
const CASES = [...WIDTHS.map((width) => ({ width, zoom: 1 })), { width: 375, zoom: 2 }];
/** タップ領域の下限。WCAG 2.5.5 の 44x44 CSS px に合わせる */
const MIN_TAP = 44;
/** サイドバーnavの1行の下限(--nav-row-min の実効値) */
const MIN_NAV_ROW = 44;
/** iconとlabelが視覚的にくっつかない最小の間隔(--nav-icon-label-gap の実効値) */
const MIN_ICON_LABEL_GAP = 8;
/** 下部タブのicon寸法(--tab-icon-size の実効値) */
const TAB_ICON_SIZE = 18;
/**
 * デスクトップ幅でのサイドバー総高の上限。
 *
 * 実測値そのものではなく上限で持つ(実測値を書くと、詰めた/緩めた両方向で落ちてしまい、
 * 「今の値」を写経するだけの検査になる)。880px の根拠:
 *   - 一般的なノートPCのブラウザ実効高は 600〜700px。15画面ある以上どの行高でも収まらないので、
 *     「収まる」ではなく「増え続けない」を守る値にする。
 *   - icon とグループ見出しを足す前の総高が約870px。ここへ戻し、+40px の余地だけ残す。
 *     画面を1つ足すと超えるので、そのとき行高ではなく情報設計を見直す合図になる。
 */
const MAX_SIDEBAR_H = 880;
/** ポインタ環境で緩めた行の下限。WCAG 2.5.8 Target Size (Minimum, AA) の 24px を割らない */
const MIN_POINTER_NAV_ROW = 24;

/**
 * Layout.tsx のナビを、同じ要素・class・属性で組む。
 *
 * ここが本番とズレると「44px以上ある」という合格が別のDOMについての合格になるため、
 * icon(RouteIcon.tsx の svg.route-icon)まで含めて構造を揃える。
 * svg の中身の path はレイアウトに一切影響しない(寸法はCSSのwidth/heightで決まる)ので省く。
 * 「本番のリンクが icon + 可視label で組まれている」ことは navigation-ux.dom.test.tsx が別途固定する。
 */
const routeIcon = () =>
  '<svg class="route-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"></svg>';

/** 仕分け画面を開いている状態のフィクスチャなので、現在地は公私仕分け */
const CURRENT_ROUTE_ID = 'classify';
const isCurrent = (route) => (route.id === CURRENT_ROUTE_ID ? ' aria-current="page"' : '');

const SIDEBAR = `
<aside class="sidebar">
  <a class="brand" href="#">収支統合管理<small>freee × マネーフォワード</small></a>
  <nav class="nav" aria-label="メインナビゲーション">${APP_ROUTES.map(
    (route) => `<div>${route.navGroup ? `<div class="nav-group">${route.navGroup}</div>` : ''}
      <a href="#${route.id}"${isCurrent(route)}>${routeIcon()}<span class="nav-label">${route.label}</span></a>
    </div>`,
  ).join('')}</nav>
</aside>`;

/** 最後の「メニュー」だけは Layout.tsx でも icon なしの button。ここも同じにする */
const TABBAR = `
<nav class="tabbar" aria-label="モバイルナビゲーション">${MOBILE_ROUTES.map(
  (route) =>
    `<a class="tab" href="#${route.id}"${isCurrent(route)}>${routeIcon()}<span>${route.mobileLabel}</span></a>`,
).join('')}<button type="button" class="tab" aria-expanded="false">メニュー</button></nav>`;

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

/** SplitEditor と開いた CategoryPicker の実DOMに合わせた最小フィクスチャ */
const OPEN_SPLIT_EDITOR = `
<tr class="editing-open" data-pattern="split-editor">
  <td colspan="9">
    <div class="split-editor">
      <p class="sub lines">架空カード引き落としの 50,000円 を、用途ごとに分けます。</p>
      <fieldset class="split-mode"><legend class="visually-hidden">入力の仕方</legend><button type="button" class="mini" aria-pressed="true">✓ 金額で入れる</button><button type="button" class="mini" aria-pressed="false">割合で入れる</button></fieldset>
      <div class="split-lines">
        <table class="data stack-sm">
          <thead><tr><th>公私</th><th>科目</th><th>金額</th><th>メモ</th><th>操作</th></tr></thead>
          <tbody><tr>
            <td data-label="公私"><select aria-label="1行目の公私"><option>個人</option></select></td>
            <td data-label="科目"><span class="cat-picker">
              <button type="button" class="cat-current on" aria-expanded="true" aria-controls="split-category-panel">食費</button>
              <select aria-label="中項目"><option>食料品</option></select>
              <div class="cat-panel" id="split-category-panel">
                <p class="cat-principle">仕事に必要だった理由を説明できる支出だけを事業にします。</p>
                <div class="cat-tabs" role="tablist" aria-label="科目の分類"><button type="button" role="tab" aria-selected="true" class="mini on">よく使う</button><button type="button" role="tab" aria-selected="false" class="mini">食べる</button></div>
                <div class="cat-grid" role="tabpanel" aria-label="よく使う"><button type="button" class="cat-chip on">食費</button><button type="button" class="cat-chip">日用品</button></div>
                <div class="cat-detail"><p class="cat-when">毎月かならず出る費目。</p></div>
                <button type="button" class="mini linklike">候補にない科目を追加</button>
              </div>
            </span></td>
            <td class="num" data-label="金額"><input type="number" inputmode="numeric" aria-label="1行目の金額" value="50000"></td>
            <td data-label="メモ"><input type="text" aria-label="1行目のメモ" value="食料品"></td>
            <td data-label="操作"><button type="button" class="mini">残りを入れる</button></td>
          </tr></tbody>
        </table>
      </div>
      <div class="split-actions"><button type="button">行を足す</button><button type="button" class="primary">分割を保存</button><button type="button">閉じる</button></div>
    </div>
  </td>
</tr>`;

const CLASSIFY_TABLE = `
<div class="card scroll-x classify-table-card" data-pattern="classify">
  <table class="data classify-table stack-sm">
    <thead><tr><th>日付</th><th>内容</th><th>口座</th><th>大項目/中項目</th><th>金額</th><th>判定</th><th>名義</th><th>証憑</th><th>操作</th></tr></thead>
    <tbody>${[0, 1, 2].map(classifyRow).join('')}${OPEN_SPLIT_EDITOR}</tbody>
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
  ${SIDEBAR}
  <header class="header"><a class="header-brand" href="#">収支統合管理</a><span class="period">2026年8月</span><span class="spacer"></span><span class="badge ok">防衛ライン OK<span class="badge-detail"> 見込 ¥714,353</span></span><span class="popover-host"><button type="button" aria-expanded="true" aria-haspopup="menu">書き出し ▾</button><span class="popover" role="menu"><a class="btn" role="menuitem" href="#json">統合データJSON</a><a class="btn" role="menuitem" href="#csv">マトリクスCSV</a></span></span></header>
  <main class="main">
    <h1 class="page-title">公私仕分け</h1>
    ${CLASSIFY_TABLE}
    ${WIDE_TABLE}
  </main>
  <footer class="footer">footer</footer>
  ${TABBAR}
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

let chrome;
let ws;

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
  const taps = [...document.querySelectorAll('.classify-quick-actions button, .tabbar .tab, td[data-label="証憑"] button, .header .popover-host > button, .header .popover .btn')]
    .map((el) => ({ text: el.textContent.trim(), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }));

  // 6) 200%相当でもnavラベルは1行。横幅不足はページ本体でなくnav自身が受け持つ。
  const tabbar = document.querySelector('.tabbar');
  const tabLabels = [...tabbar.querySelectorAll('.tab')].map((el) => {
    // iconとlabelは縦に積むので、行数は文字を包む span だけで数える(「メニュー」はicon無しの裸テキスト)
    const labelNode = el.querySelector('span') ?? el;
    const range = document.createRange();
    range.selectNodeContents(labelNode);
    return {
      text: el.textContent.trim(),
      lines: range.getClientRects().length,
      whiteSpace: getComputedStyle(labelNode).whiteSpace,
    };
  });
  const tabScroll = { scrollWidth: tabbar.scrollWidth, clientWidth: tabbar.clientWidth };

  // 7) 書き出しaction sheetと文字がvisual viewport内に収まるか
  const exportSheet = document.querySelector('.header .popover');
  const exportRect = exportSheet.getBoundingClientRect();
  const exportLabels = [...exportSheet.querySelectorAll('[role="menuitem"]')].map((el) => ({
    text: el.textContent.trim(),
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    whiteSpace: getComputedStyle(el).whiteSpace,
  }));
  const exportSheetLayout = {
    left: exportRect.left,
    right: exportRect.right,
    viewport: doc.clientWidth,
    scrollWidth: exportSheet.scrollWidth,
    clientWidth: exportSheet.clientWidth,
  };

  // 8) 広い表は表の枠内でスクロールする
  const wide = document.querySelector('[data-pattern="matrix"]');
  const wideScrolls = { scrollWidth: wide.scrollWidth, clientWidth: wide.clientWidth };

  // 9) 開いた分割科目パネル。祖先の overflow で切られず、狭幅で選択操作を押せること。
  const splitEditor = document.querySelector('[data-pattern="split-editor"] .split-editor');
  const splitPanel = splitEditor.querySelector('.cat-panel');
  const splitPanelRect = splitPanel.getBoundingClientRect();
  const splitPanelStyle = getComputedStyle(splitPanel);
  const splitPanelClippers = [];
  // 外側の明細一覧は意図したスクロール領域で、パネルへ到達できる。
  // ここでは、以前パネルを小窓にしていた分割エディタ内部の overflow だけを検出する。
  for (let ancestor = splitPanel.parentElement; ancestor && splitEditor.contains(ancestor); ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const bounds = ancestor.getBoundingClientRect();
    if (splitPanelRect.left < bounds.left - 1 || splitPanelRect.right > bounds.right + 1 || splitPanelRect.top < bounds.top - 1 || splitPanelRect.bottom > bounds.bottom + 1)
      splitPanelClippers.push({ className: ancestor.className, overflowX: style.overflowX, overflowY: style.overflowY });
  }
  const splitPanelLayout = {
    display: splitPanelStyle.display,
    visibility: splitPanelStyle.visibility,
    w: splitPanelRect.width,
    h: splitPanelRect.height,
    scrollHeight: splitPanel.scrollHeight,
    clientHeight: splitPanel.clientHeight,
    clippers: splitPanelClippers,
  };
  const splitCategoryTaps = [...splitEditor.querySelectorAll('.cat-current, .cat-panel button')]
    .map((el) => ({ text: el.textContent.trim(), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }));
  const splitEditorRect = splitEditor.getBoundingClientRect();
  const splitOverflowers = [...splitEditor.querySelectorAll('*')]
    .map((el) => ({
      name: el.className ? String(el.className) : el.tagName.toLowerCase(),
      right: el.getBoundingClientRect().right,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    .filter((el) => el.right > splitEditorRect.right + 1 || el.scrollWidth > el.clientWidth + 1)
    .slice(0, 5);
  const splitEditorWidth = {
    scrollWidth: splitEditor.scrollWidth,
    clientWidth: splitEditor.clientWidth,
    overflowers: splitOverflowers,
  };

  // 7・8) ナビの視覚契約。token が styles.css に「書いてあるか」ではなく、
  //    カスケード後に実際その寸法・手掛かりで描かれているかを見る。
  //    サイドバーは狭幅ではドロワー(translateX(-100%))だが、幅・高さ・間隔は画面外でも同じに測れる。
  const navLinks = [...document.querySelectorAll('.nav a')];
  const navRows = navLinks.map((a) => {
    const icon = a.querySelector('.route-icon').getBoundingClientRect();
    const label = a.querySelector('.nav-label').getBoundingClientRect();
    return {
      text: a.textContent.trim(),
      h: a.getBoundingClientRect().height,
      gap: label.left - icon.right,
    };
  });
  const currentNav = document.querySelector('.nav a[aria-current="page"]');
  const plainNav = navLinks.find((a) => a !== currentNav);
  const markerOf = (el) => {
    const s = getComputedStyle(el, '::before');
    return { content: s.content, width: Number.parseFloat(s.width) || 0, background: s.backgroundColor };
  };
  const navCurrentMark = { current: markerOf(currentNav), plain: markerOf(plainNav) };
  const channelsOf = (el) => {
    const s = getComputedStyle(el);
    return {
      color: s.color,
      background: s.backgroundColor,
      borderColor: s.borderLeftColor,
      weight: s.fontWeight,
      iconColor: getComputedStyle(el.querySelector('.route-icon')).color,
    };
  };
  const navCurrentStyle = { current: channelsOf(currentNav), plain: channelsOf(plainNav) };

  const currentTab = document.querySelector('.tabbar .tab[aria-current="page"]');
  const plainTab = [...tabbar.querySelectorAll('.tab')].find((t) => t !== currentTab);
  const tabCurrentMark = {
    color: getComputedStyle(currentTab).color,
    plainColor: getComputedStyle(plainTab).color,
    borderTopColor: getComputedStyle(currentTab).borderTopColor,
    plainBorderTopColor: getComputedStyle(plainTab).borderTopColor,
    borderTopWidth: Number.parseFloat(getComputedStyle(currentTab).borderTopWidth) || 0,
  };
  const tabIconRect = tabbar.querySelector('.route-icon').getBoundingClientRect();
  const tabIcon = { w: tabIconRect.width, h: tabIconRect.height };

  return { overflow, stacked, theadHidden, order, overflowingCells, taps, tabLabels, tabScroll, exportSheetLayout, exportLabels, wideScrolls, splitPanelLayout, splitCategoryTaps, splitEditorWidth, navRows, navCurrentMark, navCurrentStyle, tabCurrentMark, tabIcon };
})()`;

/**
 * デスクトップ幅でのサイドバー総高。
 *
 * `.sidebar` 自身は `height: 100vh` なので getBoundingClientRect では常に画面高が返る。
 * 知りたいのは「中身が何px あるか」なので scrollHeight を見る。これが画面の実効高を超えると
 * 下の項目はスクロールしないと見えない = 一覧性が失われる。
 */
const SIDEBAR_PROBE = `(() => {
  const sidebar = document.querySelector('.sidebar');
  const nav = document.querySelector('.nav');
  const rows = [...nav.querySelectorAll('a')].map((a) => a.getBoundingClientRect().height);
  const groups = [...nav.querySelectorAll('.nav-group')].map((g) => {
    const r = g.getBoundingClientRect();
    const s = getComputedStyle(g);
    return { text: g.textContent.trim(), h: r.height, marginTop: Number.parseFloat(s.marginTop) || 0 };
  });
  const style = getComputedStyle(sidebar);
  return {
    pointerFine: matchMedia('(pointer: fine)').matches,
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    content: sidebar.scrollHeight,
    padding: (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0),
    navHeight: nav.getBoundingClientRect().height,
    rowMin: Math.min(...rows),
    rowMax: Math.max(...rows),
    rowCount: rows.length,
    groups,
  };
})()`;

/**
 * 現在地が通常行と「どの手段で」違って見えるかを、計算後のスタイルから列挙する。
 * icon の色は文字色を継ぐので、文字色と別に数えると同じ1つを二重に数えてしまう。
 */
const navChannels = ({ current, plain }, mark) => {
  const channels = [];
  if (current.color !== plain.color) channels.push('文字色');
  if (current.background !== plain.background) channels.push('塗り');
  if (current.borderColor !== plain.borderColor) channels.push('枠');
  if (current.weight !== plain.weight) channels.push('太さ');
  if (current.iconColor !== current.color) channels.push('icon別色');
  if (mark.current.content !== 'none' && mark.current.width >= 1) channels.push('帯');
  return channels;
};

/** 現在地の強調だけを取り出す軽い測定(prefers-contrast を切り替えて2回撮る) */
const NAV_CHANNEL_PROBE = `(() => {
  const links = [...document.querySelectorAll('.nav a')];
  const current = document.querySelector('.nav a[aria-current="page"]');
  const plain = links.find((a) => a !== current);
  const channelsOf = (el) => {
    const s = getComputedStyle(el);
    return { color: s.color, background: s.backgroundColor, borderColor: s.borderLeftColor, weight: s.fontWeight, iconColor: getComputedStyle(el.querySelector('.route-icon')).color };
  };
  const markerOf = (el) => { const s = getComputedStyle(el, '::before'); return { content: s.content, width: Number.parseFloat(s.width) || 0 }; };
  return { style: { current: channelsOf(current), plain: channelsOf(plain) }, mark: { current: markerOf(current), plain: markerOf(plain) } };
})()`;

/** reduced-motion は media emulation を切り替えて前後を比べる(片方だけでは「元から動いていない」と区別できない) */
const MOTION_PROBE = `(() => {
  const s = getComputedStyle(document.querySelector('.nav a'));
  return { transition: s.transitionDuration, seconds: Number.parseFloat(s.transitionDuration) || 0 };
})()`;

try {
  const launched = await launchHeadlessChrome({ profileRoot: dir, windowSize: '375,800' });
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

  const failures = [];
  for (const { width, zoom } of CASES) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await send('Page.navigate', { url: pathToFileURL(fixturePath).href });
    await new Promise((r) => setTimeout(r, 600));
    await evalJs(`document.body.style.zoom = '${zoom}'`);
    const m = await evalJs(MEASURE);

    if (m.overflow.scrollWidth > m.overflow.viewport + 1)
      failures.push(
        `${width}px ページ本体が横スクロールする(内容 ${m.overflow.scrollWidth}px > 画面 ${m.overflow.viewport}px)`,
      );
    // 200%相当ではnavの不変条件だけを追加検査する。仕分けfixtureのセル幅は実ページの
    // tax contentではなく、zoom 1の既存mobile contractで引き続き固定する。
    if (zoom === 1) {
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
      const panel = m.splitPanelLayout;
      if (panel.display === 'none' || panel.visibility === 'hidden' || panel.w < 1 || panel.h < 1)
        failures.push(`${width}px 分割の科目パネルが開いた状態で描画されていない`);
      if (panel.scrollHeight > panel.clientHeight + 1)
        failures.push(
          `${width}px 分割の科目パネル内が縦に切れている(${panel.scrollHeight}px > ${panel.clientHeight}px)`,
        );
      for (const clipper of panel.clippers)
        failures.push(
          `${width}px 分割の科目パネルが祖先「${clipper.className || '(classなし)'}」の overflow=${clipper.overflowX}/${clipper.overflowY} で切れる`,
        );
      if (m.splitEditorWidth.scrollWidth > m.splitEditorWidth.clientWidth + 1)
        failures.push(
          `${width}px 分割エディタが横に溢れている(${m.splitEditorWidth.scrollWidth}px > ${m.splitEditorWidth.clientWidth}px): ${m.splitEditorWidth.overflowers.map((el) => `${el.name}=${el.scrollWidth}/${el.clientWidth}`).join(', ')}`,
        );
      for (const target of m.splitCategoryTaps)
        if (target.h < MIN_TAP - 0.5)
          failures.push(
            `${width}px 分割の科目操作「${target.text}」のタップ領域が ${Math.round(target.h)}px で ${MIN_TAP}px 未満`,
          );

      // ナビの視覚契約。zoom 2 では全長が2倍になるので、寸法の契約は等倍でだけ見る
      for (const row of m.navRows) {
        if (row.h < MIN_NAV_ROW - 0.5)
          failures.push(
            `${width}px navの行「${row.text}」の高さが ${Math.round(row.h)}px で ${MIN_NAV_ROW}px 未満`,
          );
        if (row.gap < MIN_ICON_LABEL_GAP - 0.5)
          failures.push(
            `${width}px navの行「${row.text}」のiconとlabelの間隔が ${Math.round(row.gap)}px で ${MIN_ICON_LABEL_GAP}px 未満`,
          );
      }
      const mark = m.navCurrentMark;
      if (mark.current.content === 'none' || mark.current.width < 1)
        failures.push(
          `${width}px navの現在地に色以外の手掛かり(::before の帯)が描かれていない(content=${mark.current.content} / width=${mark.current.width}px)`,
        );
      if (mark.plain.content !== 'none')
        failures.push(
          `${width}px navの現在地以外にも ::before の帯が出ている(content=${mark.plain.content})`,
        );
      // 現在地の強調が「何重か」を実測で固定する。以前は 塗り・枠・文字色・太字・帯・icon別色 の
      // 6つが同時に効いて、17行のナビが本文より騒がしくなっていた(M-18)。
      // 残すのは 帯(白地と 6.46:1 で WCAG 1.4.11 の 3:1 を満たす唯一の手掛かり)と
      // 文字色(11.0:1)の2つ。減らしすぎ(帯だけ・色だけ)も増やし直しも、ここで落ちる。
      const channels = navChannels(m.navCurrentStyle, mark);
      if (channels.join('+') !== '文字色+帯')
        failures.push(
          `${width}px navの現在地の強調が「文字色+帯」ではなく「${channels.join('+') || 'なし'}」になっている`,
        );
      const tabMark = m.tabCurrentMark;
      if (tabMark.color === tabMark.plainColor)
        failures.push(`${width}px 下部タブの現在地が色で区別されていない(${tabMark.color})`);
      if (tabMark.borderTopColor === tabMark.plainBorderTopColor || tabMark.borderTopWidth < 1)
        failures.push(
          `${width}px 下部タブの現在地に色以外の手掛かり(上端の線)がない(${tabMark.borderTopColor} / ${tabMark.borderTopWidth}px)`,
        );
      if (Math.abs(m.tabIcon.w - TAB_ICON_SIZE) > 0.5 || Math.abs(m.tabIcon.h - TAB_ICON_SIZE) > 0.5)
        failures.push(
          `${width}px 下部タブのiconが ${Math.round(m.tabIcon.w)}x${Math.round(m.tabIcon.h)}px で ${TAB_ICON_SIZE}px と違う`,
        );
    }
    for (const t of m.taps)
      if (t.h < MIN_TAP - 0.5)
        failures.push(
          `${width}px/zoom${zoom} 操作「${t.text}」のタップ領域が ${Math.round(t.h)}px で ${MIN_TAP}px 未満`,
        );
    for (const label of m.tabLabels)
      if (label.lines !== 1 || label.whiteSpace !== 'nowrap')
        failures.push(
          `${width}px/zoom${zoom} nav「${label.text}」が${label.lines}行・white-space=${label.whiteSpace}で分断される`,
        );
    if (m.tabScroll.scrollWidth <= m.tabScroll.clientWidth)
      failures.push(
        `${width}px/zoom${zoom} navが横幅不足を自身のscrollで受けていない(${m.tabScroll.scrollWidth}/${m.tabScroll.clientWidth})`,
      );
    if (m.exportSheetLayout.left < -0.5 || m.exportSheetLayout.right > m.exportSheetLayout.viewport + 0.5)
      failures.push(
        `${width}px/zoom${zoom} 書き出しが画面外に欠ける(left ${Math.round(m.exportSheetLayout.left)}px / right ${Math.round(m.exportSheetLayout.right)}px / viewport ${m.exportSheetLayout.viewport}px)`,
      );
    if (m.exportSheetLayout.scrollWidth > m.exportSheetLayout.clientWidth + 1)
      failures.push(
        `${width}px/zoom${zoom} 書き出し内容が横に欠ける(${m.exportSheetLayout.scrollWidth}px > ${m.exportSheetLayout.clientWidth}px)`,
      );
    for (const label of m.exportLabels)
      if (label.scrollWidth > label.clientWidth + 1 || label.whiteSpace !== 'nowrap')
        failures.push(
          `${width}px/zoom${zoom} 書き出し「${label.text}」が欠ける(${label.scrollWidth}px/${label.clientWidth}px, white-space=${label.whiteSpace})`,
        );
    if (m.wideScrolls.scrollWidth <= m.wideScrolls.clientWidth)
      failures.push(`${width}px 広い表が枠内でスクロールしていない(検査用フィクスチャが横に広くない)`);

    console.log(
      `${String(width).padStart(4)}px zoom${zoom} 本体幅 ${m.overflow.scrollWidth}/${m.overflow.viewport}  カード化 ${Math.abs(m.stacked.second.top - m.stacked.first.top) > 1 ? 'OK' : 'NG'}  見出し=内容 ${m.order.descTop < m.order.dateTop ? 'OK' : 'NG'}  タップ最小 ${Math.round(Math.min(...m.taps.map((t) => t.h)))}px  分割科目 ${Math.round(m.splitPanelLayout.w)}x${Math.round(m.splitPanelLayout.h)}px/操作最小${Math.round(Math.min(...m.splitCategoryTaps.map((t) => t.h)))}px  nav ${m.tabScroll.scrollWidth}/${m.tabScroll.clientWidth}  書き出し ${Math.round(m.exportSheetLayout.left)}-${Math.round(m.exportSheetLayout.right)}/${m.exportSheetLayout.viewport}  広い表 ${m.wideScrolls.scrollWidth}/${m.wideScrolls.clientWidth}  nav行最小 ${Math.round(Math.min(...m.navRows.map((r) => r.h)))}px  tab icon ${Math.round(m.tabIcon.w)}px`,
    );
  }

  // デスクトップ幅のサイドバー総高。狭幅では常時 100vh のドロワーなので、常設sidebarの幅で測る。
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: pathToFileURL(fixturePath).href });
  await new Promise((r) => setTimeout(r, 400));
  // 行を詰めるのは「常設幅 かつ タップ環境でない」ときだけ。pointer メディア特性は
  // setEmulatedMedia では動かせず(features に pointer は無い)、タッチのエミュレーションで
  // 決まるので、touch 無効 / 有効 の2状態を実際に切り替えて両方測る。
  //
  // touch 無効側は fine とは限らない。ポインタデバイスを持たない環境(CI の Linux headless)は
  // none を返す。ここで見たいのは「タップ環境かどうか」なので、fine の成立ではなく
  // coarse の切り替わりを判定に使う。
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  const sidebar = await evalJs(SIDEBAR_PROBE);
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const sidebarCoarse = await evalJs(SIDEBAR_PROBE);
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  if (sidebar.pointerCoarse || !sidebarCoarse.pointerCoarse)
    failures.push(
      `pointer のエミュレーションが効いていない(touch無効側 coarse=${sidebar.pointerCoarse} fine=${sidebar.pointerFine} / touch有効側 coarse=${sidebarCoarse.pointerCoarse})。行高の分岐を検査できていない`,
    );
  console.log(
    `     サイドバー総高 ${sidebar.content}px (nav ${Math.round(sidebar.navHeight)}px / ${sidebar.rowCount}行 ${Math.round(sidebar.rowMin)}〜${Math.round(sidebar.rowMax)}px / 見出し ${sidebar.groups.map((g) => Math.round(g.h)).join(',')}px) / タップ環境 ${sidebarCoarse.content}px 行 ${Math.round(sidebarCoarse.rowMin)}px`,
  );
  if (sidebar.content > MAX_SIDEBAR_H)
    failures.push(
      `デスクトップのサイドバー総高が ${sidebar.content}px で上限 ${MAX_SIDEBAR_H}px を超える(${sidebar.rowCount}行 × ${Math.round(sidebar.rowMin)}px)。行を詰めるより先に、画面を減らすかグループを畳めないか見直す`,
    );
  if (sidebar.rowMin < MIN_POINTER_NAV_ROW)
    failures.push(
      `ポインタ環境のnav行が ${Math.round(sidebar.rowMin)}px で、WCAG 2.5.8 の ${MIN_POINTER_NAV_ROW}px を下回る`,
    );
  // 緩和が「ポインタ環境だけ」に閉じていることを実測で確かめる。
  // (pointer 条件を落として全環境で詰めてしまう変更は、この行がないと素通りする)
  if (sidebarCoarse.rowMin < MIN_NAV_ROW - 0.5)
    failures.push(
      `タップ環境のnav行が ${Math.round(sidebarCoarse.rowMin)}px で ${MIN_NAV_ROW}px 未満。行の緩和が「タップ環境以外」に閉じていない`,
    );

  // prefers-contrast: more。既定では2重に絞った現在地の強調を、要求されたときだけ
  // 「太さ」を足して3重に増やす。塗りは戻さない(濃くしても白地と 1.26:1 で 3:1 に届かない)。
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-contrast', value: 'more' }],
  });
  const highContrast = await evalJs(NAV_CHANNEL_PROBE);
  await send('Emulation.setEmulatedMedia', { features: [] });
  const hcChannels = navChannels(highContrast.style, highContrast.mark);
  if (hcChannels.join('+') !== '文字色+太さ+帯')
    failures.push(
      `prefers-contrast: more でnavの現在地の強調が「文字色+太さ+帯」ではなく「${hcChannels.join('+') || 'なし'}」になっている`,
    );
  console.log(`     現在地の強調  既定 文字色+帯 → more ${hcChannels.join('+')}`);

  // reduced-motion。等倍375pxで、通常→reduce と切り替えて transition が止まるかを実測する
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send('Page.navigate', { url: pathToFileURL(fixturePath).href });
  await new Promise((r) => setTimeout(r, 400));
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  const motionNormal = await evalJs(MOTION_PROBE);
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  const motionReduced = await evalJs(MOTION_PROBE);
  await send('Emulation.setEmulatedMedia', { features: [] });
  if (motionNormal.seconds <= 0.01)
    failures.push(
      `navに元から動きがない(transition=${motionNormal.transition})。reduced-motionの検査が意味を持たない`,
    );
  if (motionReduced.seconds > 0.001)
    failures.push(
      `prefers-reduced-motion: reduce でもnavのtransitionが止まらない(${motionReduced.transition})`,
    );
  console.log(`     reduced-motion  通常 ${motionNormal.transition} → reduce ${motionReduced.transition}`);

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
  await stopHeadlessChrome(chrome);
  await removeProfileRoot(dir);
}
