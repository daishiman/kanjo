/**
 * スクリーンショットに書き込む部品。道具は 枠・ペン・文字・マスク の 4 つと、書いたものを動かす「移動」。
 *
 * 「どこがおかしいか」は文章より枠や線のほうが速い。逆に、書き込みだけで意図が伝わることは
 * 少ないので、書き込みは本文の代わりではなく補助として置く(必須にしない)。
 * マスクは、自動の伏字が届かない画像内の文字を、利用者が自分で隠すための道具。
 * 枠・ペン・文字は色を選べる。複数の場所を指すとき、色で「ここ」と「あそこ」を分けられる。
 * 動かすのを別の道具にするのは、枠の道具で既存の枠の上からドラッグしたとき、
 * 「新しく囲む」のか「動かす」のかを区別できないから。
 *
 * 図形は比率で持ち(annotate-image.ts)、焼き込みは送信直前に1回だけ。ここでは
 * 画像の上に透明な <canvas> を重ねてプレビューを描くだけで、元の File は触らない。
 * ポインタ操作は Pointer Events で受ける。マウス・タッチ・ペンを1経路で扱える。
 */
import { type Ref, useCallback, useEffect, useRef, useState } from 'react';
import {
  ANNOTATION_COLORS,
  type Annotation,
  type AnnotationColor,
  type AnnotationTool,
  DEFAULT_ANNOTATION_COLOR,
  MAX_ANNOTATION_TEXT,
  type Point,
  annotationFromDrag,
  annotationTextPx,
  drawAnnotations,
  extendPen,
  hitAnnotation,
  moveAnnotation,
  penFromPoints,
  textAnnotation,
} from '../annotate-image.js';
import { Button } from './Button.js';

export interface ScreenshotAnnotatorProps {
  /** 表示する画像の URL(Object URL) */
  src: string;
  annotations: Annotation[];
  onChange: (next: Annotation[]) => void;
  /** 最後の操作(描く・動かす・全部消す)を取り消す。履歴は親が持ち、縮小表示と拡大表示で共有する */
  onUndo: () => void;
  /** 取り消せる操作があるか */
  canUndo: boolean;
  /**
   * 拡大表示で使うとき true。画像を画面の高さいっぱいまで大きく出す。
   * 図形は比率で持つので、縮小表示と拡大表示で同じ配列を共有しても位置はずれない
   */
  expanded?: boolean;
  /** 渡すと「拡大して書き込む」を出す。縮小表示では細かい場所を塗りにくいため */
  onExpand?: () => void;
  /** 「拡大して書き込む」への参照。拡大表示を閉じたとき、フォーカスをここへ戻す */
  expandButtonRef?: Ref<HTMLButtonElement>;
}

/** 道具の名前と、選んだときに出す使い方の文 */
export const ANNOTATION_TOOLS: readonly { tool: AnnotationTool; label: string; hint: string }[] = [
  { tool: 'rect', label: '枠', hint: 'ドラッグすると、気になる場所を四角で囲めます。' },
  { tool: 'pen', label: 'ペン', hint: 'なぞった形のまま、線を書き込めます。' },
  {
    tool: 'text',
    label: '文字',
    hint: `文字を置きたい場所を押して入力し、Enter で確定します(${MAX_ANNOTATION_TEXT} 文字まで)。`,
  },
  {
    tool: 'mask',
    label: 'マスク',
    hint: 'ドラッグした範囲を塗りつぶします。画像に残った名前や金額を隠すときに使います。',
  },
  {
    tool: 'move',
    label: '移動',
    hint: '書き込んだ枠・線・文字・マスクをドラッグすると、場所を動かせます。',
  },
];

const COLOR_CHOICES = Object.entries(ANNOTATION_COLORS) as [
  AnnotationColor,
  (typeof ANNOTATION_COLORS)[AnnotationColor],
][];

/** 描いている途中の図形。枠とマスクは始点と現在点、ペンは点列を持つ */
type Draft =
  | { kind: 'rect' | 'mask'; from: Point; to: Point; color: AnnotationColor }
  | { kind: 'pen'; points: Point[]; color: AnnotationColor };

/** 動かしている途中の図形。from は押した点、moved は今の位置まで動かした図形 */
interface Moving {
  index: number;
  from: Point;
  original: Annotation;
  moved: Annotation;
}

function finish(draft: Draft): Annotation | null {
  return draft.kind === 'pen'
    ? penFromPoints(draft.points, draft.color)
    : annotationFromDrag(draft.from, draft.to, draft.kind, draft.color);
}

export function ScreenshotAnnotator({
  src,
  annotations,
  onChange,
  onUndo,
  canUndo,
  expanded = false,
  onExpand,
  expandButtonRef,
}: ScreenshotAnnotatorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('rect');
  const [color, setColor] = useState<AnnotationColor>(DEFAULT_ANNOTATION_COLOR);
  const [draft, setDraftState] = useState<Draft | null>(null);
  /**
   * 描いている途中の図形の写し。pointermove は連続イベントなので描き直しが後回しになり、
   * 速く引くと pointerup が先に届く。state だけを見ると最後の移動が落ち、枠が「押しただけ」扱いで消える
   */
  const draftRef = useRef<Draft | null>(null);
  const setDraft = useCallback((next: Draft | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);
  /** 動かしている途中の図形。draft と同じ理由で、写しを持って pointerup の先着に備える */
  const [moving, setMovingState] = useState<Moving | null>(null);
  const movingRef = useRef<Moving | null>(null);
  const setMoving = useCallback((next: Moving | null) => {
    movingRef.current = next;
    setMovingState(next);
  }, []);
  /** 文字を入力している場所。null の間は入力欄を出さない */
  const [typing, setTypingState] = useState<{ at: Point; value: string } | null>(null);
  /**
   * 確定済みかどうかを同期的に見るための写し。Enter で確定すると入力欄が消え、その消え方次第で
   * blur も届く。state だけを見ると、どちらの経路も同じ文字を確定して2個に増える
   */
  const typingRef = useRef(typing);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setTyping = useCallback((next: { at: Point; value: string } | null) => {
    typingRef.current = next;
    setTypingState(next);
  }, []);
  /** 表示枠の大きさ(px)。画像の読込完了・画面幅の変化で変わり、そのたびに描き直す */
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  // 表示枠の大きさは、画像を読み終えたときと画面幅が変わったときに変わる。
  // 描き直さないと canvas の画素数が古いままで、図形が伸びたり欠けたりする
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const box = wrap.getBoundingClientRect();
      setFrame({ width: box.width, height: box.height });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  /** ポインタ位置を、画像に対する比率(0..1)へ直す */
  const ratio = useCallback((e: { clientX: number; clientY: number }): Point => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((e.clientY - box.top) / box.height, 0), 1),
    };
  }, []);

  /** 確定済みの図形と、いま描いている途中の図形を描き直す */
  useEffect(() => {
    const canvas = canvasRef.current;
    // 大きさの監視が無い環境では、その場で測る
    const box = frame ?? wrapRef.current?.getBoundingClientRect();
    if (!canvas || !box) return;
    // 表示寸法に合わせる。ここは見た目だけなので、焼き込みの解像度とは無関係
    canvas.width = Math.max(1, Math.round(box.width));
    canvas.height = Math.max(1, Math.round(box.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const inProgress = draft ? finish(draft) : null;
    // 動かしている間は、元の位置ではなく動かした先に描く。重なりの順は変えない
    const shown = moving ? annotations.map((a, i) => (i === moving.index ? moving.moved : a)) : annotations;
    const all = inProgress ? [...shown, inProgress] : shown;
    drawAnnotations(ctx, all, canvas.width, canvas.height);
  }, [annotations, draft, moving, frame]);

  // 押した場所に入力欄を出したら、すぐ打ち込めるようにフォーカスを移す。
  // 位置が変わるたびに移す(同じ入力欄が別の場所へ動くとき、autoFocus は効かない)
  const typingAt = typing?.at;
  useEffect(() => {
    if (typingAt) inputRef.current?.focus();
  }, [typingAt]);

  /** 入力中の文字を確定する。空なら何も足さずに入力欄を閉じる。二度呼ばれても1個しか増えない */
  function commitText() {
    const current = typingRef.current;
    if (!current) return;
    setTyping(null);
    const made = textAnnotation(current.at, current.value, color);
    if (made) onChange([...annotations, made]);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // 入力欄の中の操作(文字の選択など)は、書き込みの操作にしない
    if (e.target instanceof HTMLInputElement) return;
    const p = ratio(e);
    if (tool === 'text') {
      // 押した操作でフォーカスが画像へ移ると、出したばかりの入力欄が blur で閉じてしまう
      e.preventDefault();
      // 入力中に別の場所を押したら、いまの文字を確定してから新しい場所で書き始める
      commitText();
      setTyping({ at: p, value: '' });
      return;
    }
    if (tool === 'move') {
      const box = wrapRef.current?.getBoundingClientRect();
      const index = box ? hitAnnotation(annotations, p, box.width, box.height) : -1;
      const original = annotations[index];
      // 何も無い場所を押したときは何もしない。新しく描くのは描く道具の役目
      if (!original) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setMoving({ index, from: p, original, moved: original });
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDraft(tool === 'pen' ? { kind: 'pen', points: [p], color } : { kind: tool, from: p, to: p, color });
  }

  /** 途中の図形を、いまのポインタ位置まで伸ばす */
  function extend(current: Draft, p: Point): Draft {
    return current.kind === 'pen'
      ? { ...current, points: extendPen(current.points, p) }
      : { ...current, to: p };
  }

  /** 動かしている図形を、押した点からいまの点までずらす */
  function shift(current: Moving, p: Point): Moving {
    return {
      ...current,
      moved: moveAnnotation(current.original, p.x - current.from.x, p.y - current.from.y),
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const held = movingRef.current;
    if (held) {
      setMoving(shift(held, ratio(e)));
      return;
    }
    const current = draftRef.current;
    if (!current) return;
    setDraft(extend(current, ratio(e)));
  }

  /**
   * 途中の図形を確定する。離したときは離した位置まで伸ばす(直前の移動がまだ描き直されていなくても落とさない)。
   * 取り消し(pointercancel)の座標は当てにならないので、そこまでに届いた位置で確定する
   */
  function settle(e: React.PointerEvent<HTMLDivElement>) {
    const held = movingRef.current;
    if (held) {
      const done = e.type === 'pointerup' ? shift(held, ratio(e)) : held;
      setMoving(null);
      // 動いていなければ履歴に積まない。押しただけで「1つ戻す」が空振りする操作を増やさない
      if (JSON.stringify(done.moved) !== JSON.stringify(done.original)) {
        onChange(annotations.map((a, i) => (i === done.index ? done.moved : a)));
      }
      return;
    }
    const current = draftRef.current;
    if (!current) return;
    const made = finish(e.type === 'pointerup' ? extend(current, ratio(e)) : current);
    setDraft(null);
    // 小さすぎる操作は捨てる。「押しただけ」で点が増えない
    if (made) onChange([...annotations, made]);
  }

  function chooseTool(next: AnnotationTool) {
    commitText();
    setTool(next);
  }

  const current = ANNOTATION_TOOLS.find((t) => t.tool === tool) ?? ANNOTATION_TOOLS[0];
  const masks = annotations.filter((a) => a.kind === 'mask').length;
  // マスクは墨色に固定なので、色を選べるのは描く道具のうちマスク以外のときだけ。
  // 移動は書いたものの色を変えない(色を変えたいときは書き直す)
  const colorable = tool !== 'mask' && tool !== 'move';
  const box = frame ?? { width: 0, height: 0 };
  const textPx = annotationTextPx(box.width, box.height);

  return (
    <div className={`improve-annotate${expanded ? ' is-expanded' : ''}`}>
      <div className="improve-annotate-bar">
        <fieldset className="improve-annotate-tools">
          <legend>書き込みの道具</legend>
          {ANNOTATION_TOOLS.map((t) => (
            <Button
              key={t.tool}
              size="mini"
              variant={t.tool === tool ? 'primary' : 'secondary'}
              aria-pressed={t.tool === tool}
              onClick={() => chooseTool(t.tool)}
            >
              {t.label}
            </Button>
          ))}
        </fieldset>
        {onExpand && (
          <Button ref={expandButtonRef} size="mini" onClick={onExpand}>
            拡大して書き込む
          </Button>
        )}
      </div>
      <fieldset className="improve-annotate-tools improve-annotate-colors" disabled={!colorable}>
        <legend>色</legend>
        {COLOR_CHOICES.map(([id, c]) => (
          <Button
            key={id}
            size="mini"
            className={`improve-annotate-color is-${id}`}
            aria-pressed={id === color}
            onClick={() => setColor(id)}
          >
            <span className="improve-annotate-swatch" aria-hidden="true" />
            {c.label}
          </Button>
        ))}
        {tool === 'mask' && <span className="improve-note">マスクは色を選べません(墨色で塗ります)</span>}
        {tool === 'move' && <span className="improve-note">移動しても色は変わりません</span>}
      </fieldset>
      <div
        className={`improve-annotate-canvas is-${tool}${moving ? ' is-moving' : ''}`}
        ref={wrapRef}
        data-annotate-tool={tool}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
      >
        <img
          src={src}
          alt={expanded ? '書き込み用に拡大したスクリーンショット' : '送信するスクリーンショットの縮小画像'}
          draggable={false}
        />
        {/*
          描画は canvas。マウス操作は親が受けるので、canvas 自体は当たり判定を持たない。
          aria-hidden は付けない。canvas は tabindex 次第で focusable になり得るため、
          読み上げから外す指定と focus 可能性が矛盾する(biome a11y)。中身を持たない
          canvas は読み上げ対象にならないので、指定なしで意図どおりになる。
        */}
        <canvas ref={canvasRef} />
        {typing && (
          <input
            className={`improve-annotate-text-input is-${color}`}
            aria-label="画像に書き込む文字"
            ref={inputRef}
            maxLength={MAX_ANNOTATION_TEXT}
            value={typing.value}
            style={{
              left: `${typing.at.x * 100}%`,
              top: `${typing.at.y * 100}%`,
              fontSize: `${textPx}px`,
            }}
            onChange={(e) => setTyping({ at: typing.at, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitText();
              } else if (e.key === 'Escape') {
                // 拡大表示のダイアログまで閉じないよう、Esc はここで止める
                e.preventDefault();
                e.stopPropagation();
                setTyping(null);
              }
            }}
            onBlur={commitText}
          />
        )}
      </div>
      <div className="improve-annotate-actions">
        <output className="improve-note" aria-live="polite">
          {current.hint}(書き込み {annotations.length} 個{masks > 0 ? `・うちマスク ${masks} 個` : ''})
        </output>
        <Button size="mini" onClick={onUndo} disabled={!canUndo}>
          1つ戻す
        </Button>
        <Button size="mini" onClick={() => onChange([])} disabled={annotations.length === 0}>
          全部消す
        </Button>
      </div>
    </div>
  );
}
