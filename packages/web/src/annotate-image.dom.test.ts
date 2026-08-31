// @vitest-environment jsdom
/**
 * スクリーンショットへの書き込みの契約。
 *
 * ここで守りたいのは「見えている枠と、送られる画像の枠が一致する」こと。
 * 実際の画素を比べるのは jsdom では出来ない(canvas の描画実体が無い)ので、
 * 代わりに座標の作り方(比率・正規化・クランプ)と、描画呼び出しの並びを見る。
 * プレビューと焼き込みが同じ drawAnnotations を通る限り、両者はずれない。
 */
import { describe, expect, it } from 'vitest';
import {
  type Annotation,
  annotationFromDrag,
  burnAnnotations,
  drawAnnotations,
  toPixels,
} from './annotate-image.js';

describe('ドラッグから枠を作る', () => {
  it('右下へ引いても左上へ引いても同じ枠になる', () => {
    const a = annotationFromDrag({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.8 });
    const b = annotationFromDrag({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 });
    expect(a).toEqual(b);
    expect(a?.x).toBeCloseTo(0.2, 6);
    expect(a?.y).toBeCloseTo(0.3, 6);
    expect(a?.w).toBeCloseTo(0.4, 6);
    expect(a?.h).toBeCloseTo(0.5, 6);
  });

  it('押しただけ・ごく短い操作は枠にしない', () => {
    expect(annotationFromDrag({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBeNull();
    expect(annotationFromDrag({ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.9 })).toBeNull();
  });

  it('画像の外へはみ出す枠は画像の中へ収める', () => {
    const a = annotationFromDrag({ x: 0.8, y: 0.9 }, { x: 1.6, y: 1.4 });
    expect(a).not.toBeNull();
    // 右端・下端を越えない
    expect((a as Annotation).x + (a as Annotation).w).toBeLessThanOrEqual(1);
    expect((a as Annotation).y + (a as Annotation).h).toBeLessThanOrEqual(1);
  });
});

describe('比率と画素', () => {
  it('同じ比率は、表示寸法と元画像寸法のどちらでも同じ位置を指す', () => {
    const a: Annotation = { x: 0.25, y: 0.5, w: 0.25, h: 0.25 };
    const small = toPixels(a, 400, 200);
    const large = toPixels(a, 1600, 800);
    expect(small).toEqual({ x: 100, y: 100, w: 100, h: 50 });
    // 4倍の画像なら座標も4倍。表示幅が変わっても枠がずれない根拠
    expect(large).toEqual({ x: 400, y: 400, w: 400, h: 200 });
  });
});

describe('枠を描く', () => {
  /** strokeRect の呼び出しと、その直前の線幅・色を記録するだけの偽 ctx */
  function recorder() {
    const calls: { rect: number[]; width: number; color: string }[] = [];
    const ctx = {
      lineWidth: 0,
      strokeStyle: '',
      strokeRect(x: number, y: number, w: number, h: number) {
        calls.push({ rect: [x, y, w, h], width: ctx.lineWidth, color: String(ctx.strokeStyle) });
      },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
  }

  it('1つの枠につき、白い縁取りと赤い線を重ねて描く', () => {
    const { ctx, calls } = recorder();
    drawAnnotations(ctx, [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], 1000, 500);
    expect(calls).toHaveLength(2);
    expect(calls[0].rect).toEqual([100, 50, 200, 100]);
    expect(calls[1].rect).toEqual([100, 50, 200, 100]);
    // 白が先、赤があと。順序が逆だと縁取りが赤を覆う
    expect(calls[0].color).toContain('255,255,255');
    expect(calls[1].color).toBe('#e11d48');
    expect(calls[0].width).toBeGreaterThan(calls[1].width);
  });

  it('小さい画像でも線が消えない太さを持つ', () => {
    const { ctx, calls } = recorder();
    drawAnnotations(ctx, [{ x: 0, y: 0, w: 1, h: 1 }], 40, 20);
    expect(calls[1].width).toBeGreaterThanOrEqual(2);
  });
});

describe('焼き込み', () => {
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', { type: 'image/jpeg' });

  it('書き込みが無ければ元の画像をそのまま返す', async () => {
    const file = jpeg();
    // 再エンコードで画質だけ落とさないための取り決め。同一参照であることまで見る
    expect(await burnAnnotations(file, [])).toBe(file);
  });

  it('画像を読めなくても送信を止めず、元の画像を返す', async () => {
    const file = jpeg();
    const out = await burnAnnotations(file, [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }]);
    expect(out).toBe(file);
  });
});
