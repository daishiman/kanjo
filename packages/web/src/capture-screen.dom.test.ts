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
import { afterEach, describe, expect, it } from 'vitest';
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
