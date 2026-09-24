// @vitest-environment jsdom
/**
 * スクリーンショットへの書き込みの契約。
 *
 * ここで守りたいのは「見えている枠と、送られる画像の枠が一致する」こと。
 * 実際の画素を比べるのは jsdom では出来ない(canvas の描画実体が無い)ので、
 * 代わりに座標の作り方(比率・正規化・クランプ)と、描画呼び出しの並びを見る。
 * プレビューと焼き込みが同じ drawAnnotations を通る限り、両者はずれない。
 */
import { COLOR, EFFECT_COLOR, TYPOGRAPHY } from '@kanjo/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANNOTATION_COLORS,
  type Annotation,
  type BoxAnnotation,
  EMPTY_ANNOTATION_HISTORY,
  LOAD_TIMEOUT_MS,
  MAX_ANNOTATION_TEXT,
  MaskBurnError,
  annotationFromDrag,
  annotationTextPx,
  burnAnnotations,
  drawAnnotations,
  extendPen,
  hitAnnotation,
  moveAnnotation,
  penFromPoints,
  recordAnnotations,
  textAnnotation,
  toPixels,
  undoAnnotations,
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
    expect((a as BoxAnnotation).x + (a as BoxAnnotation).w).toBeLessThanOrEqual(1);
    expect((a as BoxAnnotation).y + (a as BoxAnnotation).h).toBeLessThanOrEqual(1);
  });

  it('道具を渡すと、同じ正規化でマスクになる', () => {
    const m = annotationFromDrag({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.3 }, 'mask');
    expect(m?.kind).toBe('mask');
    expect(m?.w).toBeCloseTo(0.4, 6);
    // 省略時は枠。既存の呼び出しの意味を変えない
    expect(annotationFromDrag({ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.8 })?.kind).toBe('rect');
  });
});

describe('ペンの点列', () => {
  it('直前の点に近すぎる点は足さない(揺れで点列が膨らまない)', () => {
    const start = [{ x: 0.5, y: 0.5 }];
    expect(extendPen(start, { x: 0.5001, y: 0.5 })).toHaveLength(1);
    expect(extendPen(start, { x: 0.52, y: 0.5 })).toHaveLength(2);
  });

  it('画像の外の点は画像の縁へ収める', () => {
    const out = extendPen([], { x: 1.4, y: -0.2 });
    expect(out).toEqual([{ x: 1, y: 0 }]);
  });

  it('点だけ・ごく短い線は線にしない', () => {
    expect(penFromPoints([{ x: 0.5, y: 0.5 }])).toBeNull();
    expect(
      penFromPoints([
        { x: 0.5, y: 0.5 },
        { x: 0.501, y: 0.501 },
      ]),
    ).toBeNull();
    const line = penFromPoints([
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.2 },
    ]);
    expect(line).toEqual({
      kind: 'pen',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.2 },
      ],
    });
  });
});

describe('色と文字', () => {
  it('マスクには色を付けない。何色を選んでいても墨色で塗る', () => {
    const m = annotationFromDrag({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 'mask', 'blue');
    expect(m).not.toHaveProperty('color');
    expect(annotationFromDrag({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 'rect', 'blue')?.color).toBe('blue');
  });

  it('ペンは選んだ色を持つ', () => {
    const line = penFromPoints(
      [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.2 },
      ],
      'black',
    );
    expect(line?.color).toBe('black');
  });

  it('文字は前後の空白を落とし、改行は1つの空白にまとめる', () => {
    expect(textAnnotation({ x: 0.2, y: 0.3 }, '  金額が\n  ずれる  ', 'red')).toEqual({
      kind: 'text',
      x: 0.2,
      y: 0.3,
      text: '金額が ずれる',
      color: 'red',
    });
  });

  it('空白だけの文字は書き込みにしない', () => {
    expect(textAnnotation({ x: 0.2, y: 0.3 }, '')).toBeNull();
    expect(textAnnotation({ x: 0.2, y: 0.3 }, ' \n\t ')).toBeNull();
  });

  it('長すぎる文字は上限で切り、画像の外の点は縁へ収める', () => {
    const t = textAnnotation({ x: 1.4, y: -0.2 }, 'あ'.repeat(MAX_ANNOTATION_TEXT + 10));
    expect(t?.text).toHaveLength(MAX_ANNOTATION_TEXT);
    expect([t?.x, t?.y]).toEqual([1, 0]);
  });

  it('文字の大きさは画像の長辺に比例し、小さい画像でも読める下限を持つ', () => {
    expect(annotationTextPx(2000, 1000)).toBe(2 * annotationTextPx(1000, 500));
    expect(annotationTextPx(100, 50)).toBeGreaterThanOrEqual(12);
  });
});

describe('書いたものを掴んで動かす', () => {
  // 表示枠 400x200 px。掴める距離は 10px
  const W = 400;
  const H = 200;
  const scene: Annotation[] = [
    { kind: 'rect', x: 0.1, y: 0.1, w: 0.8, h: 0.8, color: 'blue' },
    // 大きな枠の内側に書いた線。枠の内側より線を先に掴む
    {
      kind: 'pen',
      points: [
        { x: 0.3, y: 0.5 },
        { x: 0.5, y: 0.5 },
      ],
    },
    { kind: 'mask', x: 0.6, y: 0.4, w: 0.1, h: 0.2 },
    { kind: 'text', x: 0.5, y: 0, text: 'ここ', color: 'orange' },
  ];

  it('押した点にある図形を返し、無ければ -1', () => {
    expect(hitAnnotation(scene, { x: 0.4, y: 0.51 }, W, H)).toBe(1);
    expect(hitAnnotation(scene, { x: 0.65, y: 0.5 }, W, H)).toBe(2);
    expect(hitAnnotation(scene, { x: 0.53, y: 0.03 }, W, H)).toBe(3);
    expect(hitAnnotation(scene, { x: 0.105, y: 0.5 }, W, H)).toBe(0);
    expect(hitAnnotation(scene, { x: 0.97, y: 0.97 }, W, H)).toBe(-1);
    expect(hitAnnotation([], { x: 0.5, y: 0.5 }, W, H)).toBe(-1);
  });

  it('枠の内側は最後に探す。先に書いた線でも、あとから書いた大きな枠の中で掴める', () => {
    const [rect, pen] = scene;
    const penFirst = [pen, rect];
    expect(hitAnnotation(penFirst, { x: 0.4, y: 0.5 }, W, H)).toBe(0);
    // 線の無い内側を押せば枠を掴める
    expect(hitAnnotation(penFirst, { x: 0.3, y: 0.3 }, W, H)).toBe(1);
  });

  it('重なったときは、あとから書いたほうを掴む', () => {
    const masks: Annotation[] = [
      { kind: 'mask', x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
      { kind: 'mask', x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
    ];
    expect(hitAnnotation(masks, { x: 0.4, y: 0.4 }, W, H)).toBe(1);
    expect(hitAnnotation(masks, { x: 0.25, y: 0.25 }, W, H)).toBe(0);
  });

  it('枠は大きさと色を保ったまま動き、画像の外へは出ない', () => {
    const box: Annotation = { kind: 'rect', x: 0.8, y: 0.1, w: 0.15, h: 0.2, color: 'green' };
    const moved = moveAnnotation(box, 0.3, -0.5);
    expect(moved).toEqual({ kind: 'rect', x: 0.85, y: 0, w: 0.15, h: 0.2, color: 'green' });
    const inside = moveAnnotation(box, -0.2, 0.1);
    expect(inside.kind === 'rect' && [inside.x, inside.y].map((v) => Number(v.toFixed(6)))).toEqual([
      0.6, 0.2,
    ]);
  });

  it('マスクは動かしても色を持たず、種類も変わらない', () => {
    const moved = moveAnnotation({ kind: 'mask', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, 0.1, 0.1);
    expect(moved.kind).toBe('mask');
    expect(moved).not.toHaveProperty('color');
  });

  it('線は形を保ったまま動き、端で止まる', () => {
    const pen: Annotation = {
      kind: 'pen',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.3, y: 0.2 },
      ],
      color: 'red',
    };
    const moved = moveAnnotation(pen, -0.5, 0.05);
    expect(
      moved.kind === 'pen' && moved.points.map((p) => [p.x, p.y].map((v) => Number(v.toFixed(6)))),
    ).toEqual([
      [0, 0.15],
      [0.2, 0.25],
    ]);
    expect(moved.kind === 'pen' && moved.color).toBe('red');
  });

  it('文字は中身と色を保ったまま動き、左上の点は画像の中に留まる', () => {
    const text: Annotation = { kind: 'text', x: 0.5, y: 0.5, text: 'ここ', color: 'orange' };
    expect(moveAnnotation(text, 0.2, -0.1)).toEqual({ ...text, x: 0.7, y: 0.4 });
    expect(moveAnnotation(text, 0.9, 0.9)).toEqual({ ...text, x: 1, y: 1 });
  });
});

describe('書き込みの履歴', () => {
  const a: Annotation = { kind: 'mask', x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
  const b: Annotation = { kind: 'rect', x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

  it('1つ戻すと直前の操作の前へ戻る。動かした操作も、全部消した操作も戻せる', () => {
    let h = recordAnnotations(EMPTY_ANNOTATION_HISTORY, [a]);
    h = recordAnnotations(h, [a, b]);
    const movedB = moveAnnotation(b, 0.1, 0);
    h = recordAnnotations(h, [a, movedB]);
    h = recordAnnotations(h, []);
    h = undoAnnotations(h);
    expect(h.current).toEqual([a, movedB]);
    h = undoAnnotations(h);
    // 動かす前の位置に戻る。図形は消えない
    expect(h.current).toEqual([a, b]);
    h = undoAnnotations(undoAnnotations(h));
    expect(h.current).toEqual([]);
    expect(h.past).toEqual([]);
    // 戻れる操作が無いときは何もしない
    expect(undoAnnotations(h)).toBe(h);
  });

  it('同じ配列を渡されたら積まない。積む数には上限がある', () => {
    const h = recordAnnotations(EMPTY_ANNOTATION_HISTORY, [a]);
    expect(recordAnnotations(h, h.current)).toBe(h);
    let long = EMPTY_ANNOTATION_HISTORY;
    for (let i = 0; i < 150; i++) long = recordAnnotations(long, [a]);
    expect(long.past).toHaveLength(100);
  });
});

describe('比率と画素', () => {
  it('同じ比率は、表示寸法と元画像寸法のどちらでも同じ位置を指す', () => {
    const a: BoxAnnotation = { kind: 'rect', x: 0.25, y: 0.5, w: 0.25, h: 0.25 };
    const small = toPixels(a, 400, 200);
    const large = toPixels(a, 1600, 800);
    expect(small).toEqual({ x: 100, y: 100, w: 100, h: 50 });
    // 4倍の画像なら座標も4倍。表示幅が変わっても枠がずれない根拠
    expect(large).toEqual({ x: 400, y: 400, w: 400, h: 200 });
  });
});

describe('枠を描く', () => {
  /** 描画の呼び出しと、その時点の線幅・色を記録するだけの偽 ctx */
  function recorder() {
    const calls: { rect: number[]; width: number; color: string }[] = [];
    const fills: { rect: number[]; color: string }[] = [];
    const strokes: { path: number[][]; width: number; color: string }[] = [];
    const texts: { op: 'stroke' | 'fill'; text: string; at: number[]; color: string; font: string }[] = [];
    let path: number[][] = [];
    const ctx = {
      lineWidth: 0,
      font: '',
      textBaseline: '',
      strokeText(text: string, x: number, y: number) {
        texts.push({ op: 'stroke', text, at: [x, y], color: String(ctx.strokeStyle), font: ctx.font });
      },
      fillText(text: string, x: number, y: number) {
        texts.push({ op: 'fill', text, at: [x, y], color: String(ctx.fillStyle), font: ctx.font });
      },
      strokeStyle: '',
      fillStyle: '',
      lineCap: '',
      lineJoin: '',
      strokeRect(x: number, y: number, w: number, h: number) {
        calls.push({ rect: [x, y, w, h], width: ctx.lineWidth, color: String(ctx.strokeStyle) });
      },
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push({ rect: [x, y, w, h], color: String(ctx.fillStyle) });
      },
      beginPath() {
        path = [];
      },
      moveTo(x: number, y: number) {
        path.push([x, y]);
      },
      lineTo(x: number, y: number) {
        path.push([x, y]);
      },
      stroke() {
        strokes.push({ path, width: ctx.lineWidth, color: String(ctx.strokeStyle) });
      },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, fills, strokes, texts };
  }

  it('1つの枠につき、白い縁取りと赤い線を重ねて描く', () => {
    const { ctx, calls } = recorder();
    drawAnnotations(ctx, [{ kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], 1000, 500);
    expect(calls).toHaveLength(2);
    expect(calls[0].rect).toEqual([100, 50, 200, 100]);
    expect(calls[1].rect).toEqual([100, 50, 200, 100]);
    // 白が先、赤があと。順序が逆だと縁取りが赤を覆う
    expect(calls[0].color).toBe(EFFECT_COLOR.annotateHalo);
    expect(calls[1].color).toBe('#e11d48');
    expect(calls[0].width).toBeGreaterThan(calls[1].width);
  });

  it('小さい画像でも線が消えない太さを持つ', () => {
    const { ctx, calls } = recorder();
    drawAnnotations(ctx, [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1 }], 40, 20);
    expect(calls[1].width).toBeGreaterThanOrEqual(2);
  });

  it('マスクは不透明の墨色で塗りつぶし、枠線は引かない', () => {
    const { ctx, calls, fills } = recorder();
    drawAnnotations(ctx, [{ kind: 'mask', x: 0.1, y: 0.2, w: 0.3, h: 0.1 }], 1000, 500);
    expect(fills).toEqual([{ rect: [100, 100, 300, 50], color: COLOR.ink }]);
    expect(calls).toHaveLength(0);
  });

  it('ペンは点列をなぞり、白い縁取りのあとに赤い線を重ねる', () => {
    const { ctx, strokes } = recorder();
    drawAnnotations(
      ctx,
      [
        {
          kind: 'pen',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.5, y: 0.2 },
            { x: 0.9, y: 0.8 },
          ],
        },
      ],
      1000,
      500,
    );
    expect(strokes).toHaveLength(2);
    expect(strokes[0].path).toEqual([
      [100, 50],
      [500, 100],
      [900, 400],
    ]);
    expect(strokes[0].color).toBe(EFFECT_COLOR.annotateHalo);
    expect(strokes[1].color).toBe('#e11d48');
    expect(strokes[0].width).toBeGreaterThan(strokes[1].width);
  });

  it('枠とペンは選んだ色で描き、縁取りは色によらず白のまま', () => {
    const { ctx, calls, strokes } = recorder();
    drawAnnotations(
      ctx,
      [
        { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2, color: 'blue' },
        {
          kind: 'pen',
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.5, y: 0.5 },
          ],
          color: 'green',
        },
      ],
      1000,
      500,
    );
    expect(calls.map((c) => c.color)).toEqual([EFFECT_COLOR.annotateHalo, COLOR.income]);
    expect(strokes.map((c) => c.color)).toEqual([EFFECT_COLOR.annotateHalo, COLOR.good]);
  });

  it('文字は押した点を左上に、白い縁取りのあとに選んだ色で書く', () => {
    const { ctx, texts } = recorder();
    drawAnnotations(ctx, [{ kind: 'text', x: 0.25, y: 0.5, text: '桁がずれる', color: 'orange' }], 1000, 500);
    expect(texts.map((t) => [t.op, t.text, t.at, t.color])).toEqual([
      ['stroke', '桁がずれる', [250, 250], EFFECT_COLOR.annotateHalo],
      ['fill', '桁がずれる', [250, 250], COLOR.warnFill],
    ]);
    // 見出しと同じ字体・画像の大きさに比例した字の大きさ。プレビューと焼き込みで同じ式を通る
    expect(texts[1].font).toBe(`700 ${annotationTextPx(1000, 500)}px ${TYPOGRAPHY.fontHead}`);
  });

  it('色を持たない書き込みは、これまでどおり赤で描く', () => {
    const { ctx, texts } = recorder();
    drawAnnotations(ctx, [{ kind: 'text', x: 0, y: 0, text: 'ここ' }], 100, 100);
    expect(texts[1].color).toBe(COLOR.annotateStroke);
    expect(ANNOTATION_COLORS.red.value).toBe(COLOR.annotateStroke);
  });

  it('書いた順に重ねる。あとのマスクは先の枠の上に塗られる', () => {
    const order: string[] = [];
    const { ctx } = recorder();
    const c = ctx as unknown as Record<string, (...a: number[]) => void>;
    const origRect = c.strokeRect;
    const origFill = c.fillRect;
    c.strokeRect = (...a) => {
      order.push('rect');
      origRect(...a);
    };
    c.fillRect = (...a) => {
      order.push('mask');
      origFill(...a);
    };
    drawAnnotations(
      ctx,
      [
        { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        { kind: 'mask', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      ],
      100,
      100,
    );
    expect(order).toEqual(['rect', 'rect', 'mask']);
  });
});

describe('焼き込み', () => {
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], 'shot.jpg', { type: 'image/jpeg' });

  /**
   * <img> の振る舞いを指定して差し替える。
   *
   * jsdom は object URL を実際には取りに行かないため、素の Image が load と error の
   * どちらを出すかは実行環境まかせになる。ここで固定しないと、通したい失敗経路を
   * 通らないまま緑になる(実際 vitest 3 ではそうなっていた)。
   */
  function stubImage(behaviour: 'error' | 'silent') {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_url: string) {
        if (behaviour === 'error') queueMicrotask(() => this.onerror?.());
        // 'silent' は何も発火しない = 読み込みが返ってこない端末の再現
      }
    }
    vi.stubGlobal('Image', FakeImage);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('書き込みが無ければ元の画像をそのまま返す', async () => {
    const file = jpeg();
    // 再エンコードで画質だけ落とさないための取り決め。同一参照であることまで見る
    expect(await burnAnnotations(file, [])).toBe(file);
  });

  it('画像を読めなくても送信を止めず、元の画像を返す', async () => {
    stubImage('error');
    const file = jpeg();
    const out = await burnAnnotations(file, [
      { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      {
        kind: 'pen',
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.4, y: 0.4 },
        ],
      },
    ]);
    expect(out).toBe(file);
  });

  it('マスクを焼き込めないときは、元の画像を返さずに失敗させる', async () => {
    stubImage('error');
    // 元の画像を返すと、隠したつもりの文字がそのまま届く
    await expect(
      burnAnnotations(jpeg(), [{ kind: 'mask', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }]),
    ).rejects.toBeInstanceOf(MaskBurnError);
  });

  it('マスクを含む読み込み待ちの打ち切りも、元の画像を返さない', async () => {
    stubImage('silent');
    vi.useFakeTimers();
    const pending = burnAnnotations(jpeg(), [
      { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
      { kind: 'mask', x: 0.5, y: 0.5, w: 0.2, h: 0.2 },
    ]);
    const settled = expect(pending).rejects.toBeInstanceOf(MaskBurnError);
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    await settled;
  });

  it('読み込みが返ってこなくても、待ち上限で諦めて元の画像を返す', async () => {
    stubImage('silent');
    vi.useFakeTimers();
    const file = jpeg();
    const pending = burnAnnotations(file, [{ kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.2 }]);
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(await pending).toBe(file);
  });
});
