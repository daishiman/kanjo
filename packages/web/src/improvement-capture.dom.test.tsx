// @vitest-environment jsdom

import type { DiagnosticPayload } from '@kanjo/core';
/**
 * 『改善を送る』と浮動パネル「画面をキャプチャ」の契約 (spec-improvement-screen FR-23〜FR-25)。
 *
 * 受入条件の中心は「撮れた画像にパネルが写らないこと」。画素は jsdom で見られないので原因の側を固定する:
 *   パネル・範囲選択の覆い・右下のボタンの外枠が data-capture-hide を持つ (撮影用の複製から落ちる)。
 * 以前のモーダル方式 (撮り終えてから開く) と違い、パネルは撮影の前から出ているため、除外の印が契約になる。
 *
 * 撮った結果は端末に保存せず、メモリ上の受け渡しで作成フォームへ届ける (FR-25)。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImprovementRequestButton } from './components/ImprovementRequestButton.js';
import { putCaptureHandoff, resetCaptureHandoffForTest, useCaptureHandoff } from './improvement-handoff.js';

const payload = (route = '/classify?tab=all'): DiagnosticPayload => ({
  environment: {
    userAgent: 'synthetic-agent',
    language: 'ja',
    viewport: '1280x800@2',
    route,
    capturedAt: '2026-03-01T00:00:00.000Z',
  },
  entries: [{ at: '2026-03-01T00:00:00.000Z', kind: 'console_error', message: '架空のエラー', detail: '' }],
  omittedCount: 0,
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

let currentPath = '';
function PathProbe() {
  const loc = useLocation();
  currentPath = `${loc.pathname}${loc.search}`;
  return null;
}

let lastHandoff: ReturnType<typeof useCaptureHandoff>['handoff'] = null;
function HandoffProbe() {
  lastHandoff = useCaptureHandoff().handoff;
  return null;
}

function mount(
  options: {
    at?: string;
    capture?: (region?: unknown) => Promise<File | null>;
    snapshot?: (route: string) => DiagnosticPayload;
  } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options.at ?? '/classify?tab=all']}>
        <PathProbe />
        <HandoffProbe />
        <ImprovementRequestButton
          capture={options.capture ?? (async () => shot())}
          snapshot={options.snapshot ?? ((route) => payload(route))}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const trigger = () => screen.getByRole('button', { name: '改善を送る' });
const panel = () => document.querySelector('section.capture-panel');

async function openPanel() {
  fireEvent.click(trigger());
  await waitFor(() => expect(screen.getByRole('heading', { name: '画面をキャプチャ' })).toBeTruthy());
}

beforeEach(() => {
  resetCaptureHandoffForTest();
  currentPath = '';
  lastHandoff = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetCaptureHandoffForTest();
});

describe('写り込みの除外', () => {
  it('右下のボタン・パネルの外枠は data-capture-hide を持つ', async () => {
    mount();
    expect(trigger().hasAttribute('data-capture-hide')).toBe(true);
    await openPanel();
    expect(panel()?.hasAttribute('data-capture-hide')).toBe(true);
  });

  it('範囲選択の覆いも data-capture-hide を持つ', async () => {
    mount();
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: '範囲を選択する' }));
    const region = document.querySelector('.capture-region');
    expect(region?.hasAttribute('data-capture-hide')).toBe(true);
  });

  it('パネルは開くまで DOM に無く、ボタンは開閉状態を aria-expanded で伝える', async () => {
    mount();
    expect(panel()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    await openPanel();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '撮影パネルを閉じる' }));
    await waitFor(() => expect(panel()).toBeNull());
  });
});

describe('撮影から作成フォームへ', () => {
  it('撮った画像・元の画面・診断をメモリで受け渡し、/improvement へ移る', async () => {
    const snapshot = vi.fn((route: string) => payload(route));
    mount({ snapshot });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'キャプチャする' }));

    await waitFor(() => expect(currentPath).toBe('/improvement'));
    expect(lastHandoff?.screenshot).toBeInstanceOf(File);
    expect(lastHandoff?.route).toBe('/classify?tab=all');
    expect(lastHandoff?.captureFailed).toBe(false);
    expect(snapshot).toHaveBeenCalledWith('/classify?tab=all');
    // 撮り終えたらパネルは閉じる
    expect(panel()).toBeNull();
  });

  it('撮影中はボタンを押せず、待機中だと分かる', async () => {
    const gate = deferred<File | null>();
    mount({ capture: () => gate.promise });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'キャプチャする' }));

    const busy = screen.getByRole('button', { name: '撮影しています…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '範囲を選択する' }) as HTMLButtonElement).disabled).toBe(true);
    expect(currentPath).toBe('/classify?tab=all');

    await act(async () => gate.settle(shot()));
    await waitFor(() => expect(currentPath).toBe('/improvement'));
  });

  it('撮影できなくても作成フォームへ移り、画像なしで送れると伝える印が立つ', async () => {
    mount({ capture: async () => null });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'キャプチャする' }));
    await waitFor(() => expect(currentPath).toBe('/improvement'));
    expect(lastHandoff?.screenshot).toBeNull();
    expect(lastHandoff?.captureFailed).toBe(true);
  });

  it('撮影関数が例外を投げても止まらない', async () => {
    mount({
      capture: async () => {
        throw new Error('架空の撮影失敗');
      },
    });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'キャプチャする' }));
    await waitFor(() => expect(currentPath).toBe('/improvement'));
    expect(lastHandoff?.captureFailed).toBe(true);
  });

  it('作成フォームの上で直接撮ると、画像と関連ページを現在の画面に揃える', async () => {
    putCaptureHandoff({
      screenshot: shot(),
      route: '/budget',
      diagnostics: payload('/budget'),
      captureFailed: false,
    });
    mount({ at: '/improvement' });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'キャプチャする' }));
    await waitFor(() => expect(panel()).toBeNull());
    expect(lastHandoff?.route).toBe('/improvement');
    expect(currentPath).toBe('/improvement');
  });
});

describe('範囲選択', () => {
  it('矢印キーで動かし Enter で確定すると、その範囲だけを撮る', async () => {
    const capture = vi.fn(async (_region?: unknown) => shot());
    mount({ capture });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: '範囲を選択する' }));

    const surface = screen.getByRole('application');
    const before = screen.getByText(/^選択範囲:/).textContent;
    fireEvent.keyDown(surface, { key: 'ArrowRight' });
    const after = screen.getByText(/^選択範囲:/).textContent;
    expect(after).not.toBe(before);

    fireEvent.keyDown(surface, { key: 'Enter' });
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    const region = capture.mock.calls[0]?.[0] as { x: number; y: number; width: number; height: number };
    expect(region).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    await waitFor(() => expect(currentPath).toBe('/improvement'));
  });

  it('Escape で取り消すと撮らずにパネルへ戻る', async () => {
    const capture = vi.fn(async () => shot());
    mount({ capture });
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: '範囲を選択する' }));
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' });
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(capture).not.toHaveBeenCalled();
  });
});

describe('端末に残さない', () => {
  it('撮影と受け渡しで localStorage・sessionStorage に何も書かない', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    await openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'キャプチャする' }));
    await waitFor(() => expect(currentPath).toBe('/improvement'));
    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });
});
