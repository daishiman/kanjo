// @vitest-environment jsdom

/**
 * 撮影対象の SVG 組み立ての回帰テスト。
 *
 * 発見された不具合: スクリーンショットにサイドバーとヘッダーしか写らない。
 * 原因は .main の `animation: page-in ... both` で、SVG を <img> 経由で描く方式では
 * 画像が t=0 で静止するため、`from { opacity: 0 }` がそのまま焼き付いていた。
 *
 * jsdom は SVG を画像として描けないので画素は見ない。代わりに
 * 「何を写そうとしているか」= 生成される SVG 文字列の契約を固定する:
 *   - 本文の要素が写る対象に含まれている
 *   - アニメーションを止める規則が、ページ側 CSS より後ろにある
 * 後ろに無いと後勝ちで負けるため、順序まで見ないと退行を捕まえられない。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCaptureSvg } from './capture-screen.js';

/** 入場アニメーション付きの画面を模した DOM を作る */
function setupPage(): void {
  const style = document.createElement('style');
  style.textContent = `
    .sidebar { background: #fff; }
    .main { animation: page-in 200ms both; }
    @keyframes page-in { from { opacity: 0 } to { opacity: 1 } }
  `;
  document.head.append(style);
  document.body.innerHTML = `
    <div class="shell">
      <nav class="sidebar">サイドバー</nav>
      <main class="main"><h1>今月の収支</h1><p>本文の中身</p></main>
    </div>`;
}

const svg = () => buildCaptureSvg(document, 1280, 800);

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('撮影対象の組み立て', () => {
  it('本文もサイドバーも写す対象に含める', () => {
    setupPage();
    const out = svg();
    expect(out).toContain('サイドバー');
    // ここが落ちるのが「サイドバーしか写らない」不具合の markup 側
    expect(out).toContain('本文の中身');
    expect(out).toContain('今月の収支');
  });

  it('アニメーションを止める規則を持つ', () => {
    setupPage();
    expect(svg()).toContain('animation:none!important');
  });

  it('止める規則はページ側 CSS より後ろに置く(後勝ちで負けないため)', () => {
    setupPage();
    const out = svg();
    const pageRule = out.indexOf('page-in');
    const stopRule = out.indexOf('animation:none!important');
    expect(pageRule).toBeGreaterThan(-1);
    expect(stopRule).toBeGreaterThan(pageRule);
  });

  it('CSSFontFaceRule を持たない環境でもページ側 CSS を落とさない', () => {
    // instanceof CSSFontFaceRule に頼ると、この識別子が無い環境で TypeError になり
    // シート全体が catch に飲まれて消える。実際 jsdom 26 と一部ブラウザがこれに当たる
    const g = globalThis as { CSSFontFaceRule?: unknown };
    const saved = g.CSSFontFaceRule;
    // biome-ignore lint/performance/noDelete: グローバル未定義そのものを再現する
    delete g.CSSFontFaceRule;
    try {
      setupPage();
      expect(svg()).toContain('page-in');
    } finally {
      if (saved !== undefined) g.CSSFontFaceRule = saved;
    }
  });

  it('@font-face だけを外し、同じシートの他の規則は残す', () => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family: Foo; src: url(https://example.test/foo.woff2); }
      .after-font { color: rgb(1, 2, 3); }
    `;
    document.head.append(style);
    const out = svg();
    expect(out).not.toContain('@font-face');
    expect(out).toContain('.after-font');
  });

  it('遅延つきアニメーションも 0 に潰す(遅延中は開始前の状態で焼き付くため)', () => {
    setupPage();
    const out = svg();
    expect(out).toContain('animation-delay:0s!important');
    expect(out).toContain('animation-duration:0s!important');
  });

  it('指定した寸法で撮る', () => {
    setupPage();
    expect(svg()).toContain('width="1280"');
    expect(svg()).toContain('height="800"');
  });

  it('data-capture-hide を付けた要素は写さない(自分自身の起動ボタン)', () => {
    setupPage();
    const fab = document.createElement('button');
    fab.setAttribute('data-capture-hide', '');
    fab.textContent = '改善要望';
    document.body.append(fab);
    const out = svg();
    expect(out).not.toContain('改善要望');
    // 本文は残る。除外は「常に浮いていて内容を覆うもの」だけに閉じる
    expect(out).toContain('本文の中身');
  });

  it('script は写さない(画像化できず、再実行の余地も残さない)', () => {
    setupPage();
    document.body.append(document.createElement('script'));
    expect(svg()).not.toContain('<script');
  });
});

describe('撮影用複製のプライバシー', () => {
  it('印のない本文・可視属性・入力値にも core の規則を掛け、印のある固有名詞は伏せる', () => {
    document.body.innerHTML = `
      <p title="contact@example.test">請求額 ¥12,345 / contact@example.test</p>
      <div data-capture-mask><span>架空取引先</span></div>
      <input value="090-1234-5678" aria-label="口座番号 1234567" />
      <textarea>東京都千代田区丸の内1-1</textarea>
      <a href="/transactions?account=1234567" data-label="架空取引先" data-private="架空取引先">明細を見る</a>`;

    const out = svg();
    expect(out).toContain('明細を見る');
    expect(out).toContain('***');
    for (const secret of [
      '¥12,345',
      'contact@example.test',
      '架空取引先',
      '090-1234-5678',
      '1234567',
      '東京都千代田区丸の内1-1',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).not.toContain('data-private');
    expect(out).not.toContain('data-label');
    expect(out).not.toContain('href=');
    // 撮影用の複製だけを加工し、画面と入力は変えない。
    expect(document.querySelector('input')?.getAttribute('value')).toBe('090-1234-5678');
  });

  it('canvas と画像の画素、CSS の URL を複製へ持ち込まず配置を残す', () => {
    const style = document.createElement('style');
    style.textContent = '.chart { background-image: url("data:image/png;base64,HEADSECRET"); color: red; }';
    document.head.append(style);
    document.body.innerHTML = `
      <div style="background-image:url('data:image/svg+xml,<svg><text>(INLINESECRET)</text></svg>');mask-image:image-set('data:image/png;base64,IMAGESETSECRET')">
        <img src="data:image/png;base64,IMAGESECRET" alt="グラフ" />
        <canvas width="640" height="300">CANVASSECRET</canvas>
      </div>`;
    const toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL');

    const out = svg();
    expect(out).toContain('width:640px;height:300px');
    expect(out).toContain('図: ***');
    // 規則の cssText は jsdom の版で波括弧の内側の空白が違う (26 は詰め、29 とブラウザは空ける)
    expect(out).toMatch(/\.chart \{\s*background-image: none; color: red;\s*\}/);
    expect(out).toContain('background-image:none;mask-image:none');
    for (const secret of ['HEADSECRET', 'INLINESECRET', 'IMAGESETSECRET', 'IMAGESECRET', 'CANVASSECRET']) {
      expect(out).not.toContain(secret);
    }
    expect(out).not.toContain('data:image');
    expect(toDataUrl).not.toHaveBeenCalled();
    toDataUrl.mockRestore();
  });
});
