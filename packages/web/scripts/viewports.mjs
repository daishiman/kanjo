/**
 * 検査で使う画面条件の唯一の定義。
 *
 * かつて check-financial-visuals.mjs と check-mobile-financial-layout.mjs が
 * それぞれ8ケースを手書きしており、幅は一致していたのに8件目だけ中身が違った
 * (前者=375の200%zoom / 後者=320x640で実体は reduced-motion)。
 * 「幅」以外の条件を label 文字列に埋め込んでいたのが原因なので、
 * zoom / reducedMotion は明示フラグとして持ち、各スクリプトは必要な条件で filter する。
 */

/** これ以下の幅をモバイル扱いにする閾値。タップ領域やタブバーの検査もこの境界で切り替える。 */
export const MOBILE_MAX_WIDTH = 390;

/** 指で押せる最小サイズ (WCAG 2.5.5 Target Size)。 */
export const MIN_TAP_TARGET_PX = 44;

/**
 * label は成果物(screenshot名・mobile-viewport-results.json の case)に出るため、
 * 幅そのもの、または「幅では表せない条件」を表す名前にする。
 */
export const VIEWPORT_CASES = [
  { label: '320', width: 320, height: 720, zoom: 1, reducedMotion: false },
  { label: '360', width: 360, height: 720, zoom: 1, reducedMotion: false },
  { label: '375', width: 375, height: 812, zoom: 1, reducedMotion: false },
  { label: '390', width: 390, height: 844, zoom: 1, reducedMotion: false },
  { label: '768', width: 768, height: 900, zoom: 1, reducedMotion: false },
  { label: '1280', width: 1280, height: 900, zoom: 1, reducedMotion: false },
  { label: '1600', width: 1600, height: 1000, zoom: 1, reducedMotion: false },
  // 本物の200%拡大。setPageScaleFactor を伴うのはこのケースだけ。
  { label: 'zoom200', width: 375, height: 812, zoom: 2, reducedMotion: false },
  // 拡大ではなく「動きを減らす」設定。かつて 200pct-equivalent と誤称していたケース。
  { label: 'reduced-motion', width: 320, height: 640, zoom: 1, reducedMotion: true },
];

/** ラベル名で必要なケースだけ取り出す。並び順は VIEWPORT_CASES に従う。 */
export function viewportsByLabel(labels) {
  const wanted = new Set(labels);
  const picked = VIEWPORT_CASES.filter((testCase) => wanted.has(testCase.label));
  if (picked.length !== wanted.size) {
    const missing = labels.filter((label) => !picked.some((testCase) => testCase.label === label));
    throw new Error(`未定義のviewportラベル: ${missing.join(', ')}`);
  }
  return picked;
}

export const isMobileWidth = (width) => width <= MOBILE_MAX_WIDTH;
