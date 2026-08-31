/**
 * スクリーンショットに赤枠を書き込む部品。
 *
 * 「どこがおかしいか」は文章より枠のほうが速い。逆に、枠だけで意図が伝わることは
 * 少ないので、書き込みは本文の代わりではなく補助として置く(必須にしない)。
 *
 * 図形は比率で持ち(annotate-image.ts)、焼き込みは送信直前に1回だけ。ここでは
 * 画像の上に透明な <canvas> を重ねてプレビューを描くだけで、元の File は触らない。
 * ポインタ操作は Pointer Events で受ける。マウス・タッチ・ペンを1経路で扱える。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Annotation, annotationFromDrag, drawAnnotations } from '../annotate-image.js';

export interface ScreenshotAnnotatorProps {
  /** 表示する画像の URL(Object URL) */
  src: string;
  annotations: Annotation[];
  onChange: (next: Annotation[]) => void;
}

export function ScreenshotAnnotator({ src, annotations, onChange }: ScreenshotAnnotatorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragging, setDragging] = useState<{ from: Annotation; to: Annotation } | null>(null);

  /** ポインタ位置を、画像に対する比率(0..1)へ直す */
  const ratio = useCallback((e: { clientX: number; clientY: number }) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1),
      y: Math.min(Math.max((e.clientY - box.top) / box.height, 0), 1),
    };
  }, []);

  /** 確定済みの枠と、いま引いている途中の枠を描き直す */
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = wrapRef.current?.getBoundingClientRect();
    if (!canvas || !box) return;
    // 表示寸法に合わせる。ここは見た目だけなので、焼き込みの解像度とは無関係
    canvas.width = Math.max(1, Math.round(box.width));
    canvas.height = Math.max(1, Math.round(box.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const inProgress = dragging
      ? annotationFromDrag({ x: dragging.from.x, y: dragging.from.y }, { x: dragging.to.x, y: dragging.to.y })
      : null;
    const all = inProgress ? [...annotations, inProgress] : annotations;
    drawAnnotations(ctx, all, canvas.width, canvas.height);
  }, [annotations, dragging]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const p = ratio(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ from: { ...p, w: 0, h: 0 }, to: { ...p, w: 0, h: 0 } });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const p = ratio(e);
    setDragging({ from: dragging.from, to: { ...p, w: 0, h: 0 } });
  }

  function onPointerUp() {
    if (!dragging) return;
    const made = annotationFromDrag(dragging.from, dragging.to);
    setDragging(null);
    // 小さすぎる操作は捨てる。「押しただけ」で点が増えない
    if (made) onChange([...annotations, made]);
  }

  return (
    <div className="improve-annotate">
      <div
        className="improve-annotate-canvas"
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={src} alt="送信されるスクリーンショットのプレビュー" draggable={false} />
        {/*
          描画は canvas。マウス操作は親が受けるので、canvas 自体は当たり判定を持たない。
          aria-hidden は付けない。canvas は tabindex 次第で focusable になり得るため、
          読み上げから外す指定と focus 可能性が矛盾する(biome a11y)。中身を持たない
          canvas は読み上げ対象にならないので、指定なしで意図どおりになる。
        */}
        <canvas ref={canvasRef} />
      </div>
      <div className="improve-annotate-actions">
        <span className="improve-note">
          画像の上をドラッグすると赤い枠を書き込めます(書き込み {annotations.length} 個)
        </span>
        <button
          type="button"
          onClick={() => onChange(annotations.slice(0, -1))}
          disabled={annotations.length === 0}
        >
          1つ戻す
        </button>
        <button type="button" onClick={() => onChange([])} disabled={annotations.length === 0}>
          全部消す
        </button>
      </div>
    </div>
  );
}
