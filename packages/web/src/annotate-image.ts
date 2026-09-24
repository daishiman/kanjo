/**
 * スクリーンショットへの書き込み(注釈)を画像へ焼き込む。
 *
 * 画面部品から切り離すのは、座標系の扱いがこの機能の壊れやすい箇所だから。
 * 表示は画面幅に合わせて縮むが、元画像は 1600px 近い。表示上の px で持つと、
 * 画面幅が変わった瞬間に描いた図形がずれる。だから図形は「元画像に対する比率」
 * (0..1) で持ち、描画時にだけ画素へ戻す。
 *
 * 道具は 4 つ。枠 (四角の囲み)・ペン (手書きの線)・文字 (短い書き込み)・マスク (塗りつぶし) である。
 * 書いたものは「移動」で動かせる。動かしても図形の種類・色・文字は変わらない。
 * 枠・ペン・文字は色を選べる。マスクは色を選べない (隠すための道具で、下の文字を残さない墨色に固定)。
 * マスクは、撮影用の複製の伏字が届かない画像内の文字などを、利用者が自分で隠すためにある。
 *
 * 焼き込みは送信直前に1回だけ行う。元画像を保ったまま図形を配列で持てば、
 * 「1つ戻す」(操作の履歴を1つ戻る) も「全部消す」も配列操作で済み、画像を再生成しなくてよい。
 */

import { COLOR, EFFECT_COLOR, TYPOGRAPHY } from '@kanjo/core';

/** 描く道具 4 つと、書いたものを動かす「移動」 */
export type AnnotationTool = 'rect' | 'pen' | 'text' | 'mask' | 'move';

/**
 * 書き込みの色。値ではなく名前で持つ。色の値は既存のトークンから引き、ここで新しい色を作らない。
 * 赤を既定にするのは、スクリーンショットの地の色 (白・墨・ティール) のどれとも紛れにくいから。
 */
export const ANNOTATION_COLORS = {
  red: { label: '赤', value: COLOR.annotateStroke },
  blue: { label: '青', value: COLOR.income },
  green: { label: '緑', value: COLOR.good },
  orange: { label: '橙', value: COLOR.warnFill },
  black: { label: '黒', value: COLOR.ink },
} as const;

export type AnnotationColor = keyof typeof ANNOTATION_COLORS;
export const DEFAULT_ANNOTATION_COLOR: AnnotationColor = 'red';

/** 枠とマスク。値はすべて元画像に対する比率(0..1)。負の幅は持たない(正規化して格納する) */
export interface BoxAnnotation {
  kind: 'rect' | 'mask';
  x: number;
  y: number;
  w: number;
  h: number;
  /** 枠の色。マスクでは使わない。無いときは既定の赤 */
  color?: AnnotationColor;
}

export interface Point {
  x: number;
  y: number;
}

/** 手書きの線。点は元画像に対する比率(0..1) */
export interface PenAnnotation {
  kind: 'pen';
  points: Point[];
  color?: AnnotationColor;
}

/** 文字。x, y は文字の左上で、元画像に対する比率(0..1) */
export interface TextAnnotation {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  color?: AnnotationColor;
}

export type Annotation = BoxAnnotation | PenAnnotation | TextAnnotation;

/** 枠・線・文字の縁取り。背景が白でも濃色でも見えるよう、選んだ色の外側に白を重ねる */
const HALO = EFFECT_COLOR.annotateHalo;
const colorOf = (a: { color?: AnnotationColor }) =>
  ANNOTATION_COLORS[a.color ?? DEFAULT_ANNOTATION_COLOR]?.value ?? COLOR.annotateStroke;
/** マスクの色。不透明の墨色で、下の文字を1画素も残さない */
const MASK = COLOR.ink;

/** 線の太さ(元画像の長辺に対する比率)。画像の大きさが変わっても見た目の太さを保つ */
const STROKE_RATIO = 0.004;
const MIN_STROKE = 2;

/** 文字の高さ(元画像の長辺に対する比率)。線と同じく、画像の大きさが変わっても見た目を保つ */
const TEXT_RATIO = 0.022;
const MIN_TEXT_PX = 12;
/** 文字の上限。画像への書き込みは短い指し示しで、説明は本文に書く */
export const MAX_ANNOTATION_TEXT = 40;

/** これより小さいドラッグは「押しただけ」とみなして捨てる(誤って点が増えるのを防ぐ) */
const MIN_SIZE = 0.005;

/** ペンの点を間引く距離。ポインタの細かな揺れで点列が膨らまないようにする */
const PEN_MIN_STEP = 0.002;

/**
 * 画像の読み込みを待つ上限(ミリ秒)。
 * 手元の画像を読むだけなので通常は一瞬で終わる。10 秒はそれに対して十分に長く、
 * 送信ボタンを押した人が「壊れた」と感じる前には諦められる長さとして選んだ。
 */
export const LOAD_TIMEOUT_MS = 10_000;

/**
 * マスクを焼き込めなかったときの失敗。
 * マスクは隠すために描いたもので、元の画像を送ると隠したはずの情報が届いてしまう。
 * 枠やペンの失敗とは違い、元の画像で代わりにできない。
 */
export class MaskBurnError extends Error {
  constructor() {
    super('annotate_mask_burn_failed');
    this.name = 'MaskBurnError';
  }
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

/**
 * 2点から枠かマスクを作る。どちらの方向へドラッグしても左上起点へ正規化する。
 * 小さすぎるものは null を返し、呼び出し側は捨てる。
 */
export function annotationFromDrag(
  from: Point,
  to: Point,
  kind: BoxAnnotation['kind'] = 'rect',
  color?: AnnotationColor,
): BoxAnnotation | null {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  if (w < MIN_SIZE || h < MIN_SIZE) return null;
  // はみ出しは画像の中へ収める。枠が画像の外にあっても意味を持たない
  const clampedX = clamp01(x);
  const clampedY = clamp01(y);
  return {
    kind,
    x: clampedX,
    y: clampedY,
    w: Math.min(w, 1 - clampedX),
    h: Math.min(h, 1 - clampedY),
    // マスクは色を持たない。隠す色を選べると、薄い色で隠したつもりになれてしまう
    ...(color && kind === 'rect' ? { color } : {}),
  };
}

/** ペンの点列へ 1 点を足す。直前の点に近すぎる点は捨てる */
export function extendPen(points: readonly Point[], next: Point): Point[] {
  const p = { x: clamp01(next.x), y: clamp01(next.y) };
  const last = points[points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < PEN_MIN_STEP) return [...points];
  return [...points, p];
}

/** 書き終えた点列を線にする。点だけ・ごく短い線は「押しただけ」とみなして null */
export function penFromPoints(points: readonly Point[], color?: AnnotationColor): PenAnnotation | null {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (span < MIN_SIZE) return null;
  return { kind: 'pen', points: [...points], ...(color ? { color } : {}) };
}

/**
 * 入力された文字から文字の書き込みを作る。前後の空白を落とし、空なら null、長すぎれば上限で切る。
 * 改行は1行にまとめる(画像の上で折り返すと、下の画面を大きく覆ってしまう)
 */
export function textAnnotation(at: Point, raw: string, color?: AnnotationColor): TextAnnotation | null {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ANNOTATION_TEXT);
  if (!text) return null;
  return { kind: 'text', x: clamp01(at.x), y: clamp01(at.y), text, ...(color ? { color } : {}) };
}

/** 文字の高さ(px)。プレビューの入力欄も同じ値を使い、確定前後で大きさが変わらないようにする */
export function annotationTextPx(width: number, height: number): number {
  return Math.max(MIN_TEXT_PX, Math.round(Math.max(width, height) * TEXT_RATIO));
}

/**
 * 文字の幅を、文字の高さを 1 とした単位で見積もる。全角は 1、半角は 0.6。
 * 当たり判定に使うだけなので、実際の字形の幅と数 px ずれても掴めれば足りる
 */
function estimateTextEm(text: string): number {
  let em = 0;
  for (const ch of text) em += (ch.codePointAt(0) ?? 0) > 0xff ? 1 : 0.6;
  return em;
}

/** 図形が占める範囲(比率)。移動の当たり判定と、画像からはみ出さないための制限に使う */
export interface AnnotationBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function annotationBounds(a: Annotation, width: number, height: number): AnnotationBounds {
  if (a.kind === 'pen') {
    const xs = a.points.map((p) => p.x);
    const ys = a.points.map((p) => p.y);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }
  if (a.kind === 'text') {
    const px = annotationTextPx(width, height);
    return {
      x0: a.x,
      y0: a.y,
      x1: a.x + (estimateTextEm(a.text) * px) / Math.max(width, 1),
      y1: a.y + (px * 1.2) / Math.max(height, 1),
    };
  }
  return { x0: a.x, y0: a.y, x1: a.x + a.w, y1: a.y + a.h };
}

/** 掴める距離(px)。指でも掴めるよう、線の太さより広く取る */
const HIT_PX = 10;

/** 点 p と線分 ab の距離(px) */
function segmentDistancePx(p: Point, a: Point, b: Point, width: number, height: number): number {
  const [px, py, ax, ay, bx, by] = [
    p.x * width,
    p.y * height,
    a.x * width,
    a.y * height,
    b.x * width,
    b.y * height,
  ];
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / len2, 0), 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 範囲の中か(掴める距離のぶん外側まで含める) */
function insidePx(p: Point, b: AnnotationBounds, width: number, height: number): boolean {
  const tx = HIT_PX / Math.max(width, 1);
  const ty = HIT_PX / Math.max(height, 1);
  return p.x >= b.x0 - tx && p.x <= b.x1 + tx && p.y >= b.y0 - ty && p.y <= b.y1 + ty;
}

/**
 * 押した点にある図形の位置を返す。無ければ -1。width, height は表示枠の px。
 *
 * 上に重なっているもの(あとから書いたもの)を先に探す。ただし枠の内側は最後に回す。
 * 大きな枠の中に書いたペンや文字は、枠より先に書いていても掴めないと困るから。
 * 枠は線の近くを押せば、ほかの図形より先に掴める。
 */
export function hitAnnotation(
  annotations: readonly Annotation[],
  p: Point,
  width: number,
  height: number,
): number {
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.kind === 'pen') {
      const [first, ...rest] = a.points;
      let prev = first;
      if (prev && rest.length === 0 && segmentDistancePx(p, prev, prev, width, height) <= HIT_PX) return i;
      for (const next of rest) {
        if (prev && segmentDistancePx(p, prev, next, width, height) <= HIT_PX) return i;
        prev = next;
      }
      continue;
    }
    if (a.kind === 'rect') {
      const { x0, y0, x1, y1 } = annotationBounds(a, width, height);
      const corners: Point[] = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ];
      if (corners.some((c, k) => segmentDistancePx(p, c, corners[(k + 1) % 4], width, height) <= HIT_PX)) {
        return i;
      }
      continue;
    }
    if (insidePx(p, annotationBounds(a, width, height), width, height)) return i;
  }
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.kind === 'rect' && insidePx(p, annotationBounds(a, width, height), width, height)) return i;
  }
  return -1;
}

/**
 * 図形を dx, dy(比率)だけ動かす。画像の外へは出さない(焼き込むと外に出た部分は消えるため)。
 * 色や文字は変えない。文字は左上の点を画像の中に保つ(作るときと同じ扱い)
 */
export function moveAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  if (a.kind === 'text') return { ...a, x: clamp01(a.x + dx), y: clamp01(a.y + dy) };
  const b = annotationBounds(a, 1, 1);
  const mx = Math.min(Math.max(dx, -b.x0), 1 - b.x1);
  const my = Math.min(Math.max(dy, -b.y0), 1 - b.y1);
  if (a.kind === 'pen') return { ...a, points: a.points.map((p) => ({ x: p.x + mx, y: p.y + my })) };
  return { ...a, x: a.x + mx, y: a.y + my };
}

/**
 * 書き込みの履歴。「1つ戻す」は最後の図形を消すのではなく、最後の操作を取り消す。
 * 図形を動かしたあとに押して、動かした図形が消えると困るから。「全部消す」も戻せる
 */
export interface AnnotationHistory {
  current: Annotation[];
  past: Annotation[][];
}

export const EMPTY_ANNOTATION_HISTORY: AnnotationHistory = { current: [], past: [] };

/** 戻せる回数の上限。書き込みは数十個に収まり、これを超えて戻したい場面は無い */
const MAX_HISTORY = 100;

export function recordAnnotations(history: AnnotationHistory, next: Annotation[]): AnnotationHistory {
  if (next === history.current) return history;
  return { current: next, past: [...history.past, history.current].slice(-MAX_HISTORY) };
}

export function undoAnnotations(history: AnnotationHistory): AnnotationHistory {
  const prev = history.past[history.past.length - 1];
  if (!prev) return history;
  return { current: prev, past: history.past.slice(0, -1) };
}

/** 比率の座標を、指定した大きさの画素へ戻す */
export function toPixels(a: Omit<BoxAnnotation, 'kind'>, width: number, height: number) {
  return { x: a.x * width, y: a.y * height, w: a.w * width, h: a.h * height };
}

/** 図形にマスクが含まれるか。焼き込みの失敗をどう扱うかがこれで変わる */
export const hasMask = (annotations: readonly Annotation[]) => annotations.some((a) => a.kind === 'mask');

function strokePen(ctx: CanvasRenderingContext2D, points: readonly Point[], width: number, height: number) {
  const [first, ...rest] = points;
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x * width, first.y * height);
  for (const p of rest) ctx.lineTo(p.x * width, p.y * height);
  ctx.stroke();
}

/**
 * 図形を 2D コンテキストへ描く。表示中のプレビューにも、焼き込みにも同じ関数を使う。
 * 同じ描き方を2箇所に書くと、プレビューと実際に送られる画像がずれる。
 * 描く順は書いた順。あとから書いた図形が上に重なる。
 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: readonly Annotation[],
  width: number,
  height: number,
): void {
  const stroke = Math.max(MIN_STROKE, Math.round(Math.max(width, height) * STROKE_RATIO));
  for (const a of annotations) {
    if (a.kind === 'mask') {
      const { x, y, w, h } = toPixels(a, width, height);
      ctx.fillStyle = MASK;
      ctx.fillRect(x, y, w, h);
      continue;
    }
    if (a.kind === 'pen') {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 白を先に太く描いて縁取りにする。濃い背景の上でも色が沈まない
      ctx.lineWidth = stroke * 2;
      ctx.strokeStyle = HALO;
      strokePen(ctx, a.points, width, height);
      ctx.lineWidth = stroke;
      ctx.strokeStyle = colorOf(a);
      strokePen(ctx, a.points, width, height);
      continue;
    }
    if (a.kind === 'text') {
      const px = annotationTextPx(width, height);
      ctx.font = `700 ${px}px ${TYPOGRAPHY.fontHead}`;
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3, Math.round(px / 4));
      ctx.strokeStyle = HALO;
      ctx.strokeText(a.text, a.x * width, a.y * height);
      ctx.fillStyle = colorOf(a);
      ctx.fillText(a.text, a.x * width, a.y * height);
      continue;
    }
    const { x, y, w, h } = toPixels(a, width, height);
    ctx.lineWidth = stroke * 2;
    ctx.strokeStyle = HALO;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = colorOf(a);
    ctx.strokeRect(x, y, w, h);
  }
}

/** File を <img> として読む。読めなければ reject */
function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // load も error も来ないまま黙る環境がある(object URL を取りに行かない実装など)。
    // 待ちに上限を置かないと、送信ボタンが押されたまま戻らない経路が残る。
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('annotate_load_timeout'));
    }, LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('annotate_load_failed'));
    };
    img.src = url;
  });
}

async function burn(file: File, annotations: readonly Annotation[]): Promise<File | null> {
  const img = await loadFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  drawAnnotations(ctx, annotations, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) return null;
  return new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * 図形を焼き込んだ新しい JPEG を返す。
 *
 * 図形が無いときは元の File をそのまま返す。再エンコードすると画質だけが落ちる。
 * 枠とペンだけなら、焼き込みに失敗しても元の File を返す。書き込みができなかったことは
 * 送信できない理由にならない(本文と画像は届いたほうがよい)。
 * マスクを含むときの失敗は MaskBurnError を投げる。元の画像を返すと隠した情報が届く。
 */
export async function burnAnnotations(file: File, annotations: readonly Annotation[]): Promise<File> {
  if (annotations.length === 0) return file;
  let out: File | null = null;
  try {
    out = await burn(file, annotations);
  } catch {
    out = null;
  }
  if (out) return out;
  if (hasMask(annotations)) throw new MaskBurnError();
  return file;
}
