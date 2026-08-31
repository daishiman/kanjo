/**
 * スクリーンショットへの書き込み(注釈)を画像へ焼き込む。
 *
 * 画面部品から切り離すのは、座標系の扱いがこの機能の壊れやすい箇所だから。
 * 表示は画面幅に合わせて縮むが、元画像は 1600px 近い。表示上の px で持つと、
 * 画面幅が変わった瞬間に描いた枠がずれる。だから図形は「元画像に対する比率」
 * (0..1) で持ち、描画時にだけ画素へ戻す。
 *
 * 焼き込みは送信直前に1回だけ行う。元画像を保ったまま図形を配列で持てば、
 * 「1つ戻す」も「全部消す」も配列操作で済み、画像を再生成しなくてよい。
 */

/** 注釈1つ。値はすべて元画像に対する比率(0..1)。負の幅は持たない(正規化して格納する) */
export interface Annotation {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 枠の色。背景が白でも濃色でも見えるよう、彩度の高い赤に白の縁取りを重ねる */
const STROKE = '#e11d48';
const HALO = 'rgba(255,255,255,0.9)';

/** 線の太さ(元画像の長辺に対する比率)。画像の大きさが変わっても見た目の太さを保つ */
const STROKE_RATIO = 0.004;
const MIN_STROKE = 2;

/** これより小さいドラッグは「押しただけ」とみなして捨てる(誤って点が増えるのを防ぐ) */
const MIN_SIZE = 0.005;

/**
 * 2点から注釈を作る。どちらの方向へドラッグしても左上起点へ正規化する。
 * 小さすぎるものは null を返し、呼び出し側は捨てる。
 */
export function annotationFromDrag(
  from: { x: number; y: number },
  to: { x: number; y: number },
): Annotation | null {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  if (w < MIN_SIZE || h < MIN_SIZE) return null;
  // はみ出しは画像の中へ収める。枠が画像の外にあっても意味を持たない
  const clampedX = Math.min(Math.max(x, 0), 1);
  const clampedY = Math.min(Math.max(y, 0), 1);
  return {
    x: clampedX,
    y: clampedY,
    w: Math.min(w, 1 - clampedX),
    h: Math.min(h, 1 - clampedY),
  };
}

/** 比率の座標を、指定した大きさの画素へ戻す */
export function toPixels(a: Annotation, width: number, height: number) {
  return { x: a.x * width, y: a.y * height, w: a.w * width, h: a.h * height };
}

/**
 * 注釈を 2D コンテキストへ描く。表示中のプレビューにも、焼き込みにも同じ関数を使う。
 * 同じ描き方を2箇所に書くと、プレビューと実際に送られる画像がずれる。
 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: readonly Annotation[],
  width: number,
  height: number,
): void {
  const stroke = Math.max(MIN_STROKE, Math.round(Math.max(width, height) * STROKE_RATIO));
  for (const a of annotations) {
    const { x, y, w, h } = toPixels(a, width, height);
    // 白を先に太く描いて縁取りにする。濃い背景の上でも赤が沈まない
    ctx.lineWidth = stroke * 2;
    ctx.strokeStyle = HALO;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = STROKE;
    ctx.strokeRect(x, y, w, h);
  }
}

/** File を <img> として読む。読めなければ reject */
function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('annotate_load_failed'));
    };
    img.src = url;
  });
}

/**
 * 注釈を焼き込んだ新しい JPEG を返す。
 *
 * 注釈が無いときは元の File をそのまま返す。再エンコードすると画質だけが落ちる。
 * 焼き込みに失敗したときも元の File を返す。書き込みができなかったことは
 * 送信できない理由にならない(本文と画像は届いたほうがよい)。
 */
export async function burnAnnotations(file: File, annotations: readonly Annotation[]): Promise<File> {
  if (annotations.length === 0) return file;
  try {
    const img = await loadFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawAnnotations(ctx, annotations, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
