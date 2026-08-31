/**
 * いま見えている画面を、外部ライブラリなしで画像にする。
 *
 * なぜ「モーダルを除外する」方式を採らないか:
 *   除外リストは網羅性に依存する。いま存在するモーダルを除いても、後からトーストや
 *   ポータルで別の要素が描かれれば、また写り込む。だから撮影そのものを
 *   「モーダルを開く前」に済ませ、順序で保証する。呼び出し側はこの Promise を
 *   await してから open にする(ImprovementRequestButton.tsx)。
 *
 * 実装は SVG の <foreignObject> に DOM の複製を入れ、それを <img> 経由で canvas へ描く。
 * 依存パッケージを増やさずに済む代わりに、次の制約がある:
 *   - <foreignObject> の中から外部リソース(画像・フォント)は取りに行けない。
 *     フォントは代替に落ち、画像は空欄になる。文字と配置は残るので、要望の
 *     「どこの何がおかしいか」を伝える用途には足りる。
 *   - <canvas> で描かれたグラフは複製すると空になるため、描画済みの内容を
 *     data URL にして差し替える。
 *   - この画像は読み込み時点(t=0)で静止画に焼き付く。CSS アニメーションは進まない。
 *     そのため `animation-fill-mode: both` と `from { opacity: 0 }` を持つ要素は
 *     透明のまま写る。実際 .main の page-in がこれに当たり、サイドバーとヘッダー
 *     だけが写る不具合になっていた。STATIC_CSS で全アニメーションを無効化して防ぐ。
 * 失敗したら null を返す。撮影の失敗は投稿の失敗ではない。
 */

/** 長辺の上限(px)。画面の判読に必要な下限として 1600 を採る */
const MAX_EDGE = 1600;
const QUALITY = 0.8;

/** 撮影に掛ける時間の上限。ここを超えたら諦めてモーダルを開く(利用者を待たせない) */
const TIMEOUT_MS = 4000;

/**
 * 焼き付く瞬間を「アニメーションが終わった後の状態」に固定する規則。
 *
 * 最後に流し込むことで、アプリ側の CSS より後勝ちにする。!important を付けるのは
 * ページ側の宣言も !important の可能性があるため。fill-mode:both の入場アニメーションを
 * 持つ要素が透明のまま写るのを、要素を列挙せず一律に止める。
 */
const STATIC_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;
  animation-delay:0s!important;animation-duration:0s!important;caret-color:transparent!important}`;

/**
 * @font-face かどうかを cssText から判定する。
 * `instanceof CSSFontFaceRule` は使わない。この識別子を公開しない実行環境があり、
 * 未定義だと instanceof 自体が TypeError を投げて、規則ではなくシート全体が失われる。
 */
function isFontFaceRule(rule: CSSRule): boolean {
  return rule.cssText.trimStart().startsWith('@font-face');
}

/** 同一オリジンの CSS をまとめる。cross-origin の stylesheet は cssRules が読めないので飛ばす */
function collectCss(doc: Document): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRule[];
    try {
      rules = Array.from((sheet as CSSStyleSheet).cssRules);
    } catch {
      // cross-origin。読めないものは諦める
      continue;
    }
    for (const rule of rules) {
      // 1 規則の失敗でシート全体を捨てない。捨てるとページ CSS が丸ごと消え、
      // 無スタイルのまま焼き付く (サイドバーしか写らない不具合と同じ結果になる)
      try {
        // @font-face は foreignObject 内で解決できず、解決待ちで文字が消える環境がある
        if (isFontFaceRule(rule)) continue;
        chunks.push(rule.cssText);
      } catch {
        // 読めない規則だけを飛ばす
      }
    }
  }
  return chunks.join('\n');
}

/** 複製した DOM から、画像化できない/してはいけない要素を落とす */
function sanitizeClone(source: Element, clone: Element): void {
  for (const node of Array.from(clone.querySelectorAll('script, noscript, iframe, object, embed'))) {
    node.remove();
  }
  /*
   * data-capture-hide が付いた要素を落とす。
   *
   * モーダルを除外リストで消す方式は依然として採らない(順序で保証する)。ここで消すのは
   * 「常に画面に浮いていて、必ず内容を覆う」自分自身の起動ボタンだけ。右下に固定した
   * 結果、撮影のたびにボタンが右下の内容を隠すようになった。除外の対象が増えたら、
   * それは順序で解けない別種の問題なので、この判断からやり直す。
   */
  for (const node of Array.from(clone.querySelectorAll('[data-capture-hide]'))) {
    node.remove();
  }
  // 取りに行けない画像は空欄にする。src を残すと読み込み待ちで撮影ごと失敗する
  for (const img of Array.from(clone.querySelectorAll('img'))) {
    if (!img.src.startsWith('data:')) img.removeAttribute('src');
  }
  // canvas は複製すると中身が消える。描画済みの内容を静止画に置き換える
  const sourceCanvases = source.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  for (let i = 0; i < cloneCanvases.length; i += 1) {
    const original = sourceCanvases[i];
    const target = cloneCanvases[i];
    let dataUrl = '';
    try {
      dataUrl = original?.toDataURL('image/png') ?? '';
    } catch {
      // 汚染された canvas。空欄のままにする
    }
    const replacement = clone.ownerDocument.createElement('img');
    replacement.setAttribute('style', target.getAttribute('style') ?? '');
    replacement.width = target.width;
    replacement.height = target.height;
    if (dataUrl) replacement.src = dataUrl;
    target.replaceWith(replacement);
  }
}

/** SVG を <img> にして読み込む。読めないブラウザ・壊れた SVG は reject */
function loadImage(svg: string, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('capture_timeout')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('capture_render_failed'));
    };
    // encodeURIComponent 経由にするのは、SVG 中の # や & が data URL を途中で切るため
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * 撮影に使う SVG 文字列を組み立てる。
 *
 * canvas への描画から切り離して export するのは、jsdom が SVG を画像として
 * 描けないため。「何を写そうとしているか」はこの文字列で検証できる。
 */
export function buildCaptureSvg(doc: Document, width: number, height: number): string {
  const body = doc.body;
  const clone = body.cloneNode(true) as HTMLElement;
  sanitizeClone(body, clone);
  // 見えている範囲だけを撮る。スクロール位置ぶん上へずらす
  const scrollX = typeof window === 'undefined' ? 0 : window.scrollX;
  const scrollY = typeof window === 'undefined' ? 0 : window.scrollY;
  clone.setAttribute(
    'style',
    `${body.getAttribute('style') ?? ''};margin:0;transform:translate(${-scrollX}px,${-scrollY}px);`,
  );

  const serialized = new XMLSerializer().serializeToString(clone);
  // STATIC_CSS はページ側 CSS の後ろへ置く。順序が逆だと入場アニメーションに負ける
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${escapeCss(
    collectCss(doc),
  )}${STATIC_CSS}</style>${serialized}</div></foreignObject></svg>`;
}

/**
 * いまのビューポートを撮る。撮れなければ null。
 *
 * @param doc 撮影対象の document(テストで差し替える)
 * @returns JPEG の File、または撮れなかったときは null
 */
export async function captureScreen(doc: Document = document): Promise<File | null> {
  try {
    if (typeof window === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
    if (!doc.body) return null;

    const width = Math.max(1, Math.min(doc.documentElement.clientWidth, 2400));
    const height = Math.max(1, Math.min(doc.documentElement.clientHeight, 2400));

    const image = await loadImage(buildCaptureSvg(doc, width, height), TIMEOUT_MS);
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // 背景を白で塗る。JPEG は透過を持てず、塗らないと透明部分が黒くなる
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) return null;
    return new File([blob], 'screen.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return null;
  }
}

/** CSS 中の </style> でタグが閉じてしまうのを防ぐ */
const escapeCss = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1');
