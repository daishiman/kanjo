// @vitest-environment jsdom
/**
 * 作成フォームで、撮った画像へ書き込めることの契約 (spec-improvement-screen FR-27)。
 *
 * 書き込みの道具は、一度「番号の印を付ける」という目立たないボタンの奥へ移り、
 * あることに気づかれなくなった。どのゲートも赤にならなかったのは、画面側の試験が無かったから。
 * ここでは次を固定する:
 *   - 画像があれば、枠・ペン・文字・マスクの道具が最初から見えている
 *   - 道具を選び替えられ、選んだ道具で書いたものが件数に出る
 *   - 枠・ペン・文字は選んだ色で残り、マスクは色を選べない
 *   - 文字は押した場所で打ち込み、Enter で1個だけ確定し、Esc でやめられる
 *   - 書いたものは「移動」で動かせ、「1つ戻す」は動かす前の位置へ戻す(図形を消さない)
 *   - マスクを焼き込めないときは送信しない (元の画像では隠したはずの文字が届く)
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type Annotation,
  type AnnotationHistory,
  EMPTY_ANNOTATION_HISTORY,
  recordAnnotations,
  undoAnnotations,
} from './annotate-image.js';
import * as api from './api.js';
import { ScreenshotAnnotator } from './components/ScreenshotAnnotator.js';
import { putCaptureHandoff, resetCaptureHandoffForTest } from './improvement-handoff.js';
import { CreateForm } from './pages/improvement/CreateForm.js';
import { PRIVACY_CONFIRM_LABEL, PRIVACY_CONSENT_LABEL } from './pages/improvement/view-model.js';

const shot = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'screen.jpg', { type: 'image/jpeg' });

/** 画像の表示枠を 400x200 に固定する。jsdom は配置を計算しないので、比率への換算にこれを使う */
function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 400,
    bottom: 200,
    width: 400,
    height: 200,
    toJSON: () => ({}),
  } as DOMRect);
}

function mount() {
  putCaptureHandoff({ screenshot: shot(), route: '/classify', diagnostics: null, captureFailed: false });
  return render(
    <MemoryRouter initialEntries={['/improvement']}>
      <CreateForm onCreated={() => undefined} />
    </MemoryRouter>,
  );
}

const toolButton = (name: string) => screen.getByRole('button', { name });

/** 表示枠の上で、from から to までドラッグする。within を渡すと、その中の表示枠を使う */
function drag(from: [number, number], to: [number, number], within: ParentNode = document) {
  const surface = within.querySelector('.improve-annotate-canvas') as HTMLElement;
  fireEvent.pointerDown(surface, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: to[0], clientY: to[1], pointerId: 1 });
  fireEvent.pointerUp(surface, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

// jsdom 26 (lockfile の版) には PointerEvent が無く、fireEvent.pointer* は素の Event になって
// clientX が落ち、座標が NaN になる。無いときだけ MouseEvent に pointerId を足したもので補う
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventStub extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
}

beforeEach(() => {
  resetCaptureHandoffForTest();
  // jsdom の URL は object URL を作れない。縮小画像の表示に要るので、この試験の間だけ足す
  URL.createObjectURL = () => 'blob:shot';
  URL.revokeObjectURL = () => undefined;
  // jsdom は canvas を描かない。描画先が無いときは描かずに戻る経路を通す
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  stubLayout();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  URL.createObjectURL = original.create;
  URL.revokeObjectURL = original.revoke;
  resetCaptureHandoffForTest();
});

describe('撮った画像への書き込み', () => {
  it('画像があれば、枠・ペン・文字・マスクの道具が最初から見えている', () => {
    mount();
    // 何も押さずに見えること。奥に隠れると、書き込めることに気づかれない
    expect(screen.getByRole('group', { name: '書き込みの道具' })).toBeTruthy();
    for (const name of ['枠', 'ペン', '文字', 'マスク']) expect(toolButton(name)).toBeTruthy();
    expect(screen.getByRole('group', { name: '色' })).toBeTruthy();
    expect(toolButton('枠').getAttribute('aria-pressed')).toBe('true');
    expect(toolButton('マスク').getAttribute('aria-pressed')).toBe('false');
  });

  it('画像が無ければ道具は出さない', () => {
    putCaptureHandoff({ screenshot: null, route: '/classify', diagnostics: null, captureFailed: false });
    render(
      <MemoryRouter initialEntries={['/improvement']}>
        <CreateForm onCreated={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('group', { name: '書き込みの道具' })).toBeNull();
  });

  it('道具を選び替えると、押された状態と描き方が切り替わる', () => {
    mount();
    fireEvent.click(toolButton('マスク'));
    expect(toolButton('マスク').getAttribute('aria-pressed')).toBe('true');
    expect(toolButton('枠').getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-annotate-tool]')?.getAttribute('data-annotate-tool')).toBe('mask');
    fireEvent.click(toolButton('ペン'));
    expect(document.querySelector('[data-annotate-tool]')?.getAttribute('data-annotate-tool')).toBe('pen');
  });

  it('枠・マスク・ペンで書いたものが件数に出て、1つ戻すと減る', () => {
    mount();
    drag([40, 20], [200, 120]);
    fireEvent.click(toolButton('マスク'));
    drag([220, 40], [360, 80]);
    fireEvent.click(toolButton('ペン'));
    drag([10, 150], [300, 190]);
    expect(screen.getByText(/書き込み 3 個・うちマスク 1 個/)).toBeTruthy();
    expect(screen.getByText('書き込み 3 件は、送信するときに画像へ焼き込みます。')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '1つ戻す' }));
    expect(screen.getByText(/書き込み 2 個・うちマスク 1 個/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '全部消す' }));
    expect(screen.getByText(/書き込み 0 個/)).toBeTruthy();
  });

  it('押しただけの操作は書き込みにしない', () => {
    mount();
    drag([100, 100], [100, 100]);
    expect(screen.getByText(/書き込み 0 個/)).toBeTruthy();
  });

  it('拡大して書き込むと、大きな画像で書いたものがフォームの縮小画像にも残る', () => {
    mount();
    // 縮小画像は列の幅に縮むので、細かい場所を塗るには拡大が要る
    const trigger = screen.getByRole('button', { name: '拡大して書き込む' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '画像を拡大して書き込む' });
    expect(within(dialog).getByRole('img', { name: '書き込み用に拡大したスクリーンショット' })).toBeTruthy();
    expect(dialog.querySelector('.improve-annotate.is-expanded')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'マスク' }));
    drag([40, 20], [200, 120], dialog);
    expect(within(dialog).getByText(/書き込み 1 個・うちマスク 1 個/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '書き込みを終える' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // 同じ配列を共有しているので、閉じた後も件数が残る
    expect(screen.getByText(/書き込み 1 個・うちマスク 1 個/)).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
  });

  it('マスクを焼き込めないときは送信せず、理由を出して入力を保つ', async () => {
    const create = vi.spyOn(api, 'createImprovement');
    // 画像の読み込みが失敗する端末を再現する
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);

    mount();
    fireEvent.click(toolButton('マスク'));
    drag([40, 20], [200, 120]);
    const body = screen.getByRole('textbox');
    fireEvent.change(body, { target: { value: '分類の一覧で金額の桁がずれて見えます。' } });
    fireEvent.click(screen.getByLabelText(PRIVACY_CONFIRM_LABEL));
    fireEvent.click(screen.getByLabelText(PRIVACY_CONSENT_LABEL));
    fireEvent.click(screen.getByRole('button', { name: '改善リクエストを送信' }));

    await waitFor(() => expect(screen.getByText(/マスクを画像に焼き込めませんでした/)).toBeTruthy());
    expect(create).not.toHaveBeenCalled();
    expect((body as HTMLTextAreaElement).value).toBe('分類の一覧で金額の桁がずれて見えます。');
  });
});

describe('色と文字', () => {
  /** 部品だけを置き、onChange に渡った配列と履歴を親(CreateForm)の代わりに持つ */
  function mountAnnotator() {
    let history: AnnotationHistory = EMPTY_ANNOTATION_HISTORY;
    const el = () => (
      <ScreenshotAnnotator
        src="blob:shot"
        annotations={history.current}
        onChange={onChange}
        onUndo={onUndo}
        canUndo={history.past.length > 0}
      />
    );
    const onChange = vi.fn((next: Annotation[]) => {
      history = recordAnnotations(history, next);
      view.rerender(el());
    });
    const onUndo = () => {
      history = undoAnnotations(history);
      view.rerender(el());
    };
    const view = render(el());
    return { latest: () => history.current, onChange };
  }
  const colorButton = (name: string) =>
    within(screen.getByRole('group', { name: '色' })).getByRole('button', { name });
  const surface = () => document.querySelector('.improve-annotate-canvas') as HTMLElement;
  const textBox = () =>
    screen.queryByRole('textbox', { name: '画像に書き込む文字' }) as HTMLInputElement | null;

  it('色を選ぶと押された状態が移り、そのあと書いた枠とペンがその色になる', () => {
    const { latest } = mountAnnotator();
    // 何も選ばなければ赤。これまでの見た目を変えない
    expect(colorButton('赤').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(colorButton('青'));
    expect(colorButton('青').getAttribute('aria-pressed')).toBe('true');
    expect(colorButton('赤').getAttribute('aria-pressed')).toBe('false');
    drag([40, 20], [200, 120]);
    fireEvent.click(toolButton('ペン'));
    fireEvent.click(colorButton('緑'));
    drag([10, 150], [300, 190]);
    expect(latest().map((a) => [a.kind, 'color' in a ? a.color : undefined])).toEqual([
      ['rect', 'blue'],
      ['pen', 'green'],
    ]);
  });

  it('速く引いて、描き直しより先に指を離しても枠は消えない', () => {
    const { latest } = mountAnnotator();
    const el = surface();
    // pointermove は連続イベントなので描き直しが後回しになる。同じ act に入れてその順序を再現する
    act(() => {
      fireEvent.pointerDown(el, { clientX: 40, clientY: 20, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 120, clientY: 80, pointerId: 1 });
      fireEvent.pointerUp(el, { clientX: 200, clientY: 120, pointerId: 1 });
    });
    expect(latest()).toHaveLength(1);
    // 離した位置 (200, 120) まで伸びている。400x200 の表示枠で 0.1..0.5 × 0.1..0.6
    const [box] = latest();
    expect(box.kind === 'rect' && [box.x, box.y, box.w, box.h].map((v) => Number(v.toFixed(3)))).toEqual([
      0.1, 0.1, 0.4, 0.5,
    ]);
  });

  it('マスクを選んでいる間は色を選べず、塗ったマスクは色を持たない', () => {
    const { latest } = mountAnnotator();
    fireEvent.click(colorButton('青'));
    fireEvent.click(toolButton('マスク'));
    expect((screen.getByRole('group', { name: '色' }) as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByText(/マスクは色を選べません/)).toBeTruthy();
    drag([40, 20], [200, 120]);
    expect(latest()).toHaveLength(1);
    expect(latest()[0]).not.toHaveProperty('color');
  });

  it('文字の道具で押した場所に入力欄が出て、Enter で選んだ色の文字が1個だけ残る', () => {
    const { latest, onChange } = mountAnnotator();
    fireEvent.click(toolButton('文字'));
    fireEvent.click(colorButton('黒'));
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 50, pointerId: 1 });
    const box = textBox();
    expect(box).not.toBeNull();
    // 押した点が入力欄の左上。400x200 の表示枠で (100, 50) は 25% / 25%
    expect(box?.style.left).toBe('25%');
    expect(box?.style.top).toBe('25%');
    expect(document.activeElement).toBe(box);
    fireEvent.change(box as HTMLInputElement, { target: { value: '  ここの金額  ' } });
    // Enter の確定と、入力欄が消えるときの blur が、描き直しより先に続けて届く端末がある。
    // 同じ act に入れて描き直しを後回しにし、その順序を再現する。同じ文字をもう一度足さないこと
    act(() => {
      fireEvent.keyDown(box as HTMLInputElement, { key: 'Enter' });
      fireEvent.blur(box as HTMLInputElement);
    });
    expect(textBox()).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(latest()).toEqual([{ kind: 'text', x: 0.25, y: 0.25, text: 'ここの金額', color: 'black' }]);
    expect(screen.getByText(/書き込み 1 個/)).toBeTruthy();
  });

  it('Esc で入力をやめると何も残らず、空のまま離れても何も残らない', () => {
    const { latest } = mountAnnotator();
    fireEvent.click(toolButton('文字'));
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.change(textBox() as HTMLInputElement, { target: { value: 'やめる' } });
    fireEvent.keyDown(textBox() as HTMLInputElement, { key: 'Escape' });
    expect(textBox()).toBeNull();
    fireEvent.pointerDown(surface(), { clientX: 300, clientY: 150, pointerId: 1 });
    fireEvent.blur(textBox() as HTMLInputElement);
    expect(textBox()).toBeNull();
    expect(latest()).toEqual([]);
  });

  it('入力中に別の場所を押すと、いまの文字を確定してから新しい場所で書き始める', () => {
    const { latest } = mountAnnotator();
    fireEvent.click(toolButton('文字'));
    fireEvent.pointerDown(surface(), { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.change(textBox() as HTMLInputElement, { target: { value: '1つめ' } });
    fireEvent.pointerDown(surface(), { clientX: 300, clientY: 150, pointerId: 1 });
    expect(latest().map((a) => (a.kind === 'text' ? a.text : a.kind))).toEqual(['1つめ']);
    expect(textBox()?.value).toBe('');
    expect(textBox()?.style.left).toBe('75%');
  });
});

describe('書いたものを動かす', () => {
  function mountAnnotator() {
    let history: AnnotationHistory = EMPTY_ANNOTATION_HISTORY;
    const el = () => (
      <ScreenshotAnnotator
        src="blob:shot"
        annotations={history.current}
        onChange={onChange}
        onUndo={() => {
          history = undoAnnotations(history);
          view.rerender(el());
        }}
        canUndo={history.past.length > 0}
      />
    );
    const onChange = vi.fn((next: Annotation[]) => {
      history = recordAnnotations(history, next);
      view.rerender(el());
    });
    const view = render(el());
    return { latest: () => history.current, onChange };
  }
  const surface = () => document.querySelector('.improve-annotate-canvas') as HTMLElement;
  const rounded = (a: Annotation | undefined) =>
    a && a.kind !== 'pen' && a.kind !== 'text' ? [a.x, a.y, a.w, a.h].map((v) => Number(v.toFixed(3))) : a;

  it('移動の道具で枠を掴んでずらすと、大きさと色を保ったまま動き、数は増えない', () => {
    const { latest } = mountAnnotator();
    fireEvent.click(within(screen.getByRole('group', { name: '色' })).getByRole('button', { name: '青' }));
    // 400x200 の表示枠で 0.1..0.5 × 0.1..0.6
    drag([40, 20], [200, 120]);
    fireEvent.click(toolButton('移動'));
    expect(toolButton('移動').getAttribute('aria-pressed')).toBe('true');
    expect(surface().getAttribute('data-annotate-tool')).toBe('move');
    // 移動では色を変えないので、色は選べない
    expect((screen.getByRole('group', { name: '色' }) as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByText('移動しても色は変わりません')).toBeTruthy();

    // 左の辺 (40, 60) を掴んで右下へ (80, 40) ずらす
    drag([40, 60], [120, 100]);
    expect(latest()).toHaveLength(1);
    expect(rounded(latest()[0])).toEqual([0.3, 0.3, 0.4, 0.5]);
    expect(latest()[0]).toMatchObject({ kind: 'rect', color: 'blue' });
    expect(screen.getByText(/書き込み 1 個/)).toBeTruthy();
  });

  it('1つ戻すと、動かした図形は消えずに動かす前の位置へ戻る', () => {
    const { latest } = mountAnnotator();
    drag([40, 20], [200, 120]);
    fireEvent.click(toolButton('移動'));
    drag([40, 60], [120, 100]);
    fireEvent.click(screen.getByRole('button', { name: '1つ戻す' }));
    expect(latest()).toHaveLength(1);
    expect(rounded(latest()[0])).toEqual([0.1, 0.1, 0.4, 0.5]);
    fireEvent.click(screen.getByRole('button', { name: '1つ戻す' }));
    expect(latest()).toEqual([]);
    expect((screen.getByRole('button', { name: '1つ戻す' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('何も無い場所を押しても、押しただけでも、何も変えない', () => {
    const { onChange } = mountAnnotator();
    drag([40, 20], [200, 120]);
    fireEvent.click(toolButton('移動'));
    drag([380, 190], [300, 150]);
    drag([40, 60], [40, 60]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('文字もマスクも掴んで動かせる。文字は中身と色を保つ', () => {
    const { latest } = mountAnnotator();
    fireEvent.click(toolButton('マスク'));
    drag([280, 20], [360, 60]);
    fireEvent.click(toolButton('文字'));
    fireEvent.pointerDown(surface(), { clientX: 40, clientY: 140, pointerId: 1 });
    const box = screen.getByRole('textbox', { name: '画像に書き込む文字' });
    fireEvent.change(box, { target: { value: 'ここ' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(toolButton('移動'));
    // 文字 (左上 40,140) の中ほどを掴んで上へ 100 ずらす
    drag([50, 145], [50, 45]);
    // マスクの中を掴んで左へ 200 ずらす
    drag([320, 40], [120, 40]);
    const [mask, text] = latest();
    expect(rounded(mask)).toEqual([0.2, 0.1, 0.2, 0.2]);
    expect(mask).not.toHaveProperty('color');
    expect(text).toEqual({
      kind: 'text',
      x: expect.closeTo(0.1, 6),
      y: expect.closeTo(0.2, 6),
      text: 'ここ',
      color: 'red',
    });
  });

  it('速く動かして、描き直しより先に指を離しても、離した位置まで動く', () => {
    const { latest } = mountAnnotator();
    drag([40, 20], [200, 120]);
    fireEvent.click(toolButton('移動'));
    const el = surface();
    act(() => {
      fireEvent.pointerDown(el, { clientX: 40, clientY: 60, pointerId: 1 });
      fireEvent.pointerMove(el, { clientX: 60, clientY: 70, pointerId: 1 });
      fireEvent.pointerUp(el, { clientX: 120, clientY: 100, pointerId: 1 });
    });
    expect(rounded(latest()[0])).toEqual([0.3, 0.3, 0.4, 0.5]);
  });
});
