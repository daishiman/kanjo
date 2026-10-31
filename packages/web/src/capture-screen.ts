/**
 * いま見えている画面を、外部ライブラリなしで画像にする。
 *
 * 写り込みの除外は印で行う (spec-improvement-screen FR-23):
 *   撮影の入口は浮動パネル「画面をキャプチャ」で、撮る前から画面に出ている。
 *   以前のモーダル方式のように「開く前に撮る」順序では防げないため、パネル・範囲選択の
 *   覆い・起動ボタンの外枠に data-capture-hide を付け、複製から落とす。
 *   金額・取引先・名義を出す共通部品は data-capture-mask を付け、複製の上で伏字にする。
 *   その他の文字も core の辞書なし規則で伏せる。画像の中身は検査できないので複製へ持ち込まない。
 *
 * 実装は SVG の <foreignObject> に DOM の複製を入れ、それを <img> 経由で canvas へ描く。
 * 依存パッケージを増やさずに済む代わりに、次の制約がある:
 *   - <foreignObject> の中から外部リソース(画像・フォント)は取りに行けない。
 *     フォントは代替に落ち、画像は空欄になる。文字と配置は残るので、要望の
 *     「どこの何がおかしいか」を伝える用途には足りる。
 *   - <canvas> と <img> のピクセルは文字のようにマスクできないため、撮影では伏字にする。
 *   - この画像は読み込み時点(t=0)で静止画に焼き付く。CSS アニメーションは進まない。
 *     そのため `animation-fill-mode: both` と `from { opacity: 0 }` を持つ要素は
 *     透明のまま写る。実際 .main の page-in がこれに当たり、サイドバーとヘッダー
 *     だけが写る不具合になっていた。STATIC_CSS で全アニメーションを無効化して防ぐ。
 * 失敗したら null を返す。撮影の失敗は投稿の失敗ではない。
 */

import { COLOR, IMPROVEMENT_MASK, redactPersonalInfo } from '@kanjo/core';

/** 長辺の上限(px)。画面の判読に必要な下限として 1600 を採る */
const MAX_EDGE = 1600;
const QUALITY = 0.8;

/** 撮影に掛ける時間の上限。ここを超えたら諦めて画像なしで作成フォームへ進む(利用者を待たせない) */
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

/** URL の先にある画像・フォント等は画素を検査できない。CSS の URL 参照も撮影へ入れない。 */
function safeCssText(css: string): string {
  let withoutUrls = '';
  for (let i = 0; i < css.length; ) {
    const imageFunction = /^(?:url|(?:-webkit-)?image-set)\(/i.exec(css.slice(i));
    if (imageFunction) {
      let depth = 1;
      let quote = '';
      i += imageFunction[0].length;
      while (i < css.length && depth > 0) {
        const char = css[i++];
        if (char === '\\') {
          i += 1;
        } else if (quote) {
          if (char === quote) quote = '';
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === '(') {
          depth += 1;
        } else if (char === ')') {
          depth -= 1;
        }
      }
      withoutUrls += 'none';
    } else {
      withoutUrls += css[i++];
    }
  }
  return redactPersonalInfo(withoutUrls);
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
        if (isFontFaceRule(rule) || rule.cssText.trimStart().startsWith('@import')) continue;
        chunks.push(safeCssText(rule.cssText));
      } catch {
        // 読めない規則だけを飛ばす
      }
    }
  }
  return chunks.join('\n');
}

/**
 * 撮影用 DOM の文字と属性を伏せる (spec FR-24)。
 *
 * 金額・取引先名・名義・口座を出す共通部品が印を付ける。消すのではなく伏字にするのは、
 * 「そこに値があった」という配置の情報は改善の手掛かりとして残したいから。
 * 辞書がないブラウザでは未知の固有名詞を判定できない。共通部品の印で覆い、
 * 印がない文字には core の規則を掛ける。入力値・画像・URL は内容を検査せず外す。
 */
export function maskSensitiveText(root: Element): void {
  const doc = root.ownerDocument;
  const targets = [
    ...(root.matches('[data-capture-mask]') ? [root] : []),
    ...Array.from(root.querySelectorAll('[data-capture-mask]')),
  ];
  for (const target of targets) {
    const walker = doc.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
    for (const text of texts) {
      if (text.data.trim()) text.data = IMPROVEMENT_MASK;
    }
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    text.data = redactPersonalInfo(text.data);
  }

  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const tag = element.tagName.toLowerCase();
    // パス・data URL・srcset に生値や未検査の画素を埋め込ませない。
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        name === 'src' ||
        name === 'srcset' ||
        name === 'href' ||
        name === 'xlink:href' ||
        name === 'poster' ||
        name === 'formaction' ||
        name.startsWith('on') ||
        name.startsWith('data-')
      ) {
        element.removeAttribute(attribute.name);
      } else if (name === 'style') {
        element.setAttribute(attribute.name, safeCssText(attribute.value));
      } else if (name === 'value') {
        element.setAttribute(attribute.name, attribute.value ? IMPROVEMENT_MASK : '');
      } else {
        element.setAttribute(attribute.name, redactPersonalInfo(attribute.value));
      }
    }
    // cloneNode が複製する現在値は属性と異なる場合がある。入力は一律伏せる。
    if (tag === 'input') {
      const input = element as HTMLInputElement;
      if (input.value) input.setAttribute('value', IMPROVEMENT_MASK);
    } else if (tag === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      if (textarea.value || textarea.textContent) textarea.textContent = IMPROVEMENT_MASK;
    }
  }
}

/** 複製した DOM から、画像化できない/してはいけない要素を落とす */
function sanitizeClone(clone: Element): void {
  for (const node of Array.from(clone.querySelectorAll('script, noscript, iframe, object, embed'))) {
    node.remove();
  }
  /*
   * data-capture-hide が付いた要素を落とす。
   *
   * 対象は撮影の道具そのもの (右下の起動ボタン・浮動パネル・範囲選択の覆い)。
   * どれも撮る瞬間に画面へ出ているので、順序ではなく印で落とす。
   * 画面の中身 (トースト・ダイアログ) には付けない。それも改善の手掛かりだから。
   */
  for (const node of Array.from(clone.querySelectorAll('[data-capture-hide]'))) {
    node.remove();
  }
  maskSensitiveText(clone);
  for (const style of Array.from(clone.querySelectorAll('style'))) {
    style.textContent = safeCssText(style.textContent ?? '');
  }
  // canvas の描画済みピクセルは安全に読めても文字と機微値を識別できない。
  for (const target of Array.from(clone.querySelectorAll('canvas'))) {
    const replacement = clone.ownerDocument.createElement('div');
    replacement.setAttribute('class', target.getAttribute('class') ?? '');
    replacement.setAttribute(
      'style',
      `width:${target.getAttribute('width') ?? '300'}px;height:${target.getAttribute('height') ?? '150'}px;${target.getAttribute('style') ?? ''}`,
    );
    replacement.textContent = `図: ${IMPROVEMENT_MASK}`;
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
  sanitizeClone(clone);
  // 見えている範囲だけを撮る。スクロール位置ぶん上へずらす
  const scrollX = typeof window === 'undefined' ? 0 : window.scrollX;
  const scrollY = typeof window === 'undefined' ? 0 : window.scrollY;
  clone.setAttribute(
    'style',
    `${safeCssText(body.getAttribute('style') ?? '')};margin:0;transform:translate(${-scrollX}px,${-scrollY}px);`,
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
export async function captureScreen(doc: Document = document, region?: CaptureRegion): Promise<File | null> {
  try {
    if (typeof window === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
    if (!doc.body) return null;

    const width = Math.max(1, Math.min(doc.documentElement.clientWidth, 2400));
    const height = Math.max(1, Math.min(doc.documentElement.clientHeight, 2400));
    // 範囲選択 (spec FR-23) は見えている範囲を撮ってから切り抜く。範囲外は画面の内側へ寄せる
    const crop = clampRegion(region ?? { x: 0, y: 0, width, height }, width, height);

    const image = await loadImage(buildCaptureSvg(doc, width, height), TIMEOUT_MS);
    const scale = Math.min(1, MAX_EDGE / Math.max(crop.width, crop.height));
    const canvas = doc.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width * scale));
    canvas.height = Math.max(1, Math.round(crop.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // 背景を白で塗る。JPEG は透過を持てず、塗らないと透明部分が黒くなる
    ctx.fillStyle = COLOR.surface;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
    if (!blob) return null;
    return new File([blob], 'screen.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return null;
  }
}

/** 画面 (CSS px、見えている範囲の左上が原点) の中の切り抜き範囲 */
export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 範囲を画面の内側へ収め、最小 1px にする。キーボードで端まで動かしても撮影が壊れない */
export function clampRegion(region: CaptureRegion, width: number, height: number): CaptureRegion {
  const x = Math.min(Math.max(0, Math.round(region.x)), width - 1);
  const y = Math.min(Math.max(0, Math.round(region.y)), height - 1);
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(region.width), width - x)),
    height: Math.max(1, Math.min(Math.round(region.height), height - y)),
  };
}

/** CSS 中の </style> でタグが閉じてしまうのを防ぐ */
const escapeCss = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1');
