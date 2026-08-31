// @vitest-environment jsdom

import type { DiagnosticPayload } from '@kanjo/core';
/**
 * 改善要望ボタンの撮影順序の契約。
 *
 * この機能の受入条件の中心は「撮れた画像にモーダルが写っていないこと」。
 * それを画素で確かめるのは jsdom では不可能なので、原因の側を固定する:
 *   撮影関数が呼ばれた瞬間、document にモーダルの要素が存在しない。
 * モーダルを除外リストで消すのではなく、開く前に撮り終える設計だから成り立つ。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImprovementRequestButton } from './components/ImprovementRequestButton.js';

// jsdom は <dialog> の showModal/close を実装していない。
// 本番と同じく「開いたら中身が見える」状態を作らないと、役割での問い合わせが全て隠れ要素になる。
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

vi.mock('./api.js', () => ({
  createImprovement: vi.fn(),
  markImprovementCopied: vi.fn(async () => ({ ok: true })),
}));
const api = await import('./api.js');
const createImprovement = vi.mocked(api.createImprovement);
const markImprovementCopied = vi.mocked(api.markImprovementCopied);

const payload = (over: Partial<DiagnosticPayload> = {}): DiagnosticPayload => ({
  environment: {
    userAgent: 'synthetic-agent',
    language: 'ja',
    viewport: '1280x800@2',
    route: '/classify',
    capturedAt: '2026-03-01T00:00:00.000Z',
  },
  entries: [{ at: '2026-03-01T00:00:00.000Z', kind: 'console_error', message: '架空のエラー', detail: '' }],
  omittedCount: 0,
  ...over,
});

const shot = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'screen.jpg', { type: 'image/jpeg' });

/** 撮影の完了時点を試験側で決めるための保留 Promise */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

function mount(options: { capture?: () => Promise<File | null>; snapshot?: () => DiagnosticPayload } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/classify?tab=all']}>
        <ImprovementRequestButton
          capture={options.capture ?? (async () => shot())}
          snapshot={options.snapshot ?? (() => payload())}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const modal = () => document.querySelector('dialog.improve-modal');

beforeEach(() => {
  createImprovement.mockResolvedValue({
    request: { id: 'imp-1' } as never,
    prompt: '架空の指示文\nAuthorization: Bearer imp_dummy',
    screenshotRejected: null,
    diagnosticsRejected: false,
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('撮影とモーダルの順序', () => {
  it('撮影関数が呼ばれた時点でモーダルの要素が DOM に無い', async () => {
    let modalAtCapture: Element | null | undefined;
    mount({
      capture: async () => {
        modalAtCapture = modal();
        return shot();
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    // 撮影の瞬間には無く、撮り終えてから現れる
    expect(modalAtCapture).toBeNull();
  });

  it('撮影が終わるまでモーダルを開かない', async () => {
    const gate = deferred<File | null>();
    mount({ capture: () => gate.promise });
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));

    expect(modal()).toBeNull();
    expect(screen.getByText('モーダルを開く前に画面を撮影しています…')).toBeTruthy();

    gate.settle(shot());
    await waitFor(() => expect(modal()).not.toBeNull());
  });

  it('撮影中はボタンを押せず、待機中だと分かる', async () => {
    const gate = deferred<File | null>();
    mount({ capture: () => gate.promise });
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));

    const button = screen.getByRole('button', { name: '画面を撮影中…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    gate.settle(null);
    await waitFor(() => expect(modal()).not.toBeNull());
  });
});

describe('撮影の失敗', () => {
  it('撮影できなくてもモーダルは開き、本文だけで送信できる', async () => {
    mount({ capture: async () => null });
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(screen.getByText('画面の撮影ができませんでした。本文だけで送信できます。')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('件名'), { target: { value: '架空の不具合' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: '保存ボタンが反応しません' } });
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(createImprovement).toHaveBeenCalled());
    expect(createImprovement.mock.calls[0][0].screenshot).toBeNull();
  });

  it('撮影関数が例外を投げても投稿経路が止まらない', async () => {
    mount({
      capture: async () => {
        throw new Error('架空の撮影失敗');
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    expect(screen.getByText('画面の撮影ができませんでした。本文だけで送信できます。')).toBeTruthy();
  });
});

describe('添付の確認', () => {
  it('撮れた画像は既定で添付し、チェックを外すと送らない', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());

    const checkbox = screen.getByLabelText('このスクリーンショットを添付する') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);

    fireEvent.change(screen.getByLabelText('件名'), { target: { value: '架空の不具合' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: '保存ボタンが反応しません' } });
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(createImprovement).toHaveBeenCalled());
    expect(createImprovement.mock.calls[0][0].screenshot).toBeNull();
  });

  it('添付したままなら撮れた画像を送る', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    fireEvent.change(screen.getByLabelText('件名'), { target: { value: '架空の不具合' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: '保存ボタンが反応しません' } });
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(createImprovement).toHaveBeenCalled());
    const sent = createImprovement.mock.calls[0][0];
    expect(sent.screenshot).toBeInstanceOf(File);
    expect(sent.route).toBe('/classify?tab=all');
  });

  /*
   * 「何が一緒に送られるのか」は送信前に読めていないと、送る側が判断できない。
   * 件数だけの表示では「何が」に答えていなかったので、画面・表示サイズ・時刻・
   * ブラウザと、記録の中身そのものを出す。ここはその表示の契約。
   */
  it('診断の件数と、上限で省略された件数を先に見せる', async () => {
    mount({ snapshot: () => payload({ omittedCount: 7 }) });
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    const note = modal()?.textContent ?? '';
    expect(note).toContain('記録 1 件');
    expect(note).toContain('上限を超えた 7 件は省略');
  });

  it('発生していた画面と表示環境を、送る前に読める', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    const note = modal()?.textContent ?? '';
    expect(note).toContain('一緒に送られる情報');
    expect(note).toContain('/classify');
    expect(note).toContain('1280x800@2');
    expect(note).toContain('synthetic-agent');
  });

  it('記録された不具合の中身そのものを一覧で見せる', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    const note = modal()?.textContent ?? '';
    // 種類は生の kind ではなく日本語で。読む側は console_error を知らない
    expect(note).toContain('コンソール(エラー)');
    expect(note).toContain('架空のエラー');
  });

  it('先に見るべき数件を、全件の折りたたみより前に出す', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    const note = modal()?.textContent ?? '';
    expect(note).toContain('気になっている点');
    expect(note).toContain('エラーとして記録されています');
    // 折りたたみを開かなくても読める位置にあること
    expect(note.indexOf('気になっている点')).toBeLessThan(note.indexOf('画面の裏で起きていた記録'));
  });

  it('件名か内容が空なら送らずに知らせる', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));
    expect(screen.getByText('件名と内容を入力してください')).toBeTruthy();
    expect(createImprovement).not.toHaveBeenCalled();
  });
});

describe('指示文の受け取り', () => {
  async function submit() {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '改善要望' }));
    await waitFor(() => expect(modal()).not.toBeNull());
    fireEvent.change(screen.getByLabelText('件名'), { target: { value: '架空の不具合' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: '保存ボタンが反応しません' } });
    fireEvent.click(screen.getByRole('button', { name: '送信する' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Claude Code 用にコピー' })).toBeTruthy());
  }

  it('送信後に Claude Code / Codex 用のコピーができ、コピー先を記録する', async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await submit();
    fireEvent.click(screen.getByRole('button', { name: 'Codex 用にコピー' }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('架空の指示文');
    expect(markImprovementCopied).toHaveBeenCalledWith('imp-1', 'codex');
    expect(screen.getByText('コピーしました')).toBeTruthy();
  });

  it('指示文が一度しか出ないことを画面で伝える', async () => {
    await submit();
    expect(modal()?.textContent).toContain('表示はこの1回だけ');
  });
});
