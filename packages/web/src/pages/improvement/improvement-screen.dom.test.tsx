import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @vitest-environment jsdom
/**
 * 改善リクエスト画面の受入 (specs/spec-improvement-screen.md AC-014〜AC-019)。
 *
 * api.js はメモリ上の偽の保存先に差し替える。一覧・件数・関連・履歴の計算は
 * api と同じ core の関数を通すので、画面が core の結果を並べているだけかも同時に見る。
 */
import {
  IMPROVEMENT_DRAFT_MESSAGES,
  IMPROVEMENT_MASK,
  type ImprovementListSource,
  type ImprovementStatus,
  allowedImprovementTransitions,
  buildImprovementList,
  formatImprovementNumber,
  improvementRouteLabel,
  improvementSummary,
  relatedImprovements,
} from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api-client.js';
import type { ImprovementDetailResponse, ImprovementRequestView } from '../../api.js';
import { maskSensitiveText } from '../../capture-screen.js';
import { KpiCard } from '../../components/Page.js';
import {
  putCaptureHandoff,
  resetCaptureHandoffForTest,
  useCaptureHandoff,
} from '../../improvement-handoff.js';

/* ------------------------------ 偽の保存先 ------------------------------ */

type Row = ImprovementListSource & { deletedAt: string | null };
const store = { rows: [] as Row[] };

function seed(count: number) {
  const statuses: ImprovementStatus[] = ['open', 'in_progress', 'done', 'reconfirm'];
  store.rows = Array.from({ length: count }, (_, i) => {
    const seq = i + 1;
    const day = String(1 + i).padStart(2, '0');
    return {
      id: `imp-${seq}`,
      seq,
      body: seq === 3 ? '予算画面のグラフが見づらい' : `架空の改善 ${seq} 件目の本文`,
      route: seq % 2 === 0 ? '/budget' : '/classify',
      status: statuses[i % statuses.length] as ImprovementStatus,
      createdAt: `2026-03-${day}T00:00:00.000Z`,
      updatedAt: `2026-03-${day}T00:00:00.000Z`,
      deletedAt: null,
    };
  });
}

const view = (row: Row): ImprovementRequestView => ({
  id: row.id,
  seq: row.seq,
  title: null,
  body: row.body,
  route: row.route,
  status: row.status,
  screenshot: { available: false, size: null },
  diagnostics: { available: false, entryCount: 0, omittedCount: 0 },
  token: { status: 'none', expiresAt: null, fetchCount: 0 },
  copiedAt: null,
  copiedTarget: null,
  doneAt: null,
  purgedAt: null,
  attachmentExpiresAt: null,
  deletedAt: row.deletedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const find = (id: string) => {
  const row = store.rows.find((r) => r.id === id && !r.deletedAt);
  if (!row) throw new ApiError(404, 'not_found', '見つかりません');
  return row;
};

const detailOf = (row: Row): ImprovementDetailResponse => ({
  request: view(row),
  number: formatImprovementNumber(row.seq),
  summary: improvementSummary(row.body),
  routeLabel: improvementRouteLabel(row.route),
  diagnosticsSummary: null,
  activities: [],
  related: relatedImprovements(row, store.rows),
  allowedTransitions: allowedImprovementTransitions(row.status),
  diagnostics: null,
});

const api = vi.hoisted(() => ({
  listImprovements: vi.fn(),
  getImprovement: vi.fn(),
  createImprovement: vi.fn(),
  deleteImprovement: vi.fn(),
  restoreImprovement: vi.fn(),
  setImprovementStatus: vi.fn(),
  reissueImprovementPrompt: vi.fn(),
  markImprovementCopied: vi.fn(),
}));

vi.mock('../../api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api.js')>();
  return { ...actual, ...api };
});

function wireApi() {
  api.listImprovements.mockImplementation(async (q: { q?: string; tab?: string; page?: number }) =>
    buildImprovementList(store.rows, q as never),
  );
  api.getImprovement.mockImplementation(async (id: string) => detailOf(find(id)));
  api.deleteImprovement.mockImplementation(async (id: string) => {
    const row = find(id);
    row.deletedAt = '2026-03-20T00:00:00.000Z';
    return { id, deletedAt: row.deletedAt };
  });
  api.restoreImprovement.mockImplementation(async (id: string) => {
    const row = store.rows.find((r) => r.id === id);
    if (!row) throw new ApiError(404, 'not_found', '見つかりません');
    row.deletedAt = null;
    return { request: view(row) };
  });
  api.createImprovement.mockImplementation(async (input: { body: string; route: string }) => {
    const seq = Math.max(0, ...store.rows.map((r) => r.seq)) + 1;
    const row: Row = {
      id: `imp-${seq}`,
      seq,
      body: input.body,
      route: input.route,
      status: 'open',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      deletedAt: null,
    };
    store.rows.push(row);
    return {
      request: view(row),
      number: formatImprovementNumber(seq),
      prompt: '架空の指示文',
      diagnosticsRejected: false,
    };
  });
}

/* ------------------------------ 描画 ------------------------------ */

let currentUrl = '';
function UrlProbe() {
  const loc = useLocation();
  currentUrl = `${loc.pathname}${loc.search}`;
  return null;
}

async function mount(at = '/improvement') {
  const { ImprovementPage } = await import('./ImprovementPage.js');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <UrlProbe />
        <ImprovementPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const listSection = () => screen.getByRole('region', { name: '改善リクエスト一覧' });
const detailPanel = () => screen.getByRole('complementary', { name: '改善リクエストの詳細' });
const submitButton = () => screen.getByRole('button', { name: '改善リクエストを送信' });
const bodyInput = () => screen.getByRole('textbox', { name: /どのような改善を希望しますか/ });
/** 詳細欄は読み込み中と表示後で別の要素になるので、毎回引き直して待つ */
const expectDetail = (number: string) =>
  waitFor(() => expect(within(detailPanel()).getByText(number)).toBeTruthy());

beforeEach(() => {
  seed(12);
  wireApi();
  resetCaptureHandoffForTest();
  currentUrl = '';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/* ------------------------------ AC-014 ------------------------------ */

describe('画面の要素が揃う (AC-014)', () => {
  it('見出し・作成フォーム・一覧・詳細・使い方の入口が出る', async () => {
    await mount();
    expect(screen.getByRole('heading', { level: 1, name: '改善リクエスト' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '新しい改善リクエストを作成' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '改善リクエストの使い方' }).getAttribute('href')).toBe('/guide');
    await within(listSection()).findByRole('table');
    for (const col of ['ID', '関連ページ', '改善の概要', 'ステータス', '作成日', '更新日']) {
      expect(within(listSection()).getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeTruthy();
    }
    // 件数タブは core の件数をそのまま出す
    expect(screen.getByRole('tab', { name: 'すべて 12' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '受付 3' })).toBeTruthy();
    // 1 ページ 10 件、範囲の文も core の文
    expect(within(listSection()).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('10件 / 全12件')).toBeTruthy();
    expect(within(detailPanel()).getByText(/選/)).toBeTruthy();
  });

  it('撮り直しは関連ページへ戻ってパネルを出す。端末のファイルは受け付けない (FR-3・OI-04)', async () => {
    const created = vi.fn(() => 'blob:improvement-shot');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: created });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    try {
      let panelOpen = false;
      function PanelProbe() {
        panelOpen = useCaptureHandoff().panelOpen;
        return null;
      }
      putCaptureHandoff({
        screenshot: new File([new Uint8Array([1])], 'shot.jpg', { type: 'image/jpeg' }),
        route: '/budget?period=2026',
        diagnostics: null,
        captureFailed: false,
      });
      const { ImprovementPage } = await import('./ImprovementPage.js');
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/improvement']}>
            <UrlProbe />
            <PanelProbe />
            <ImprovementPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByRole('img', { name: '送信するスクリーンショットの縮小画像' });
      expect(screen.getByText(/送信前に縮小画像を確認し、個人情報や機密情報が残っていないか/)).toBeTruthy();
      // 撮影用の複製の伏字を通らない画像を送らせないため、ファイルを選ぶ入口を置かない
      expect(document.querySelector('input[type="file"]')).toBeNull();
      expect(screen.queryByRole('button', { name: '画像を選ぶ' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'キャプチャを撮り直す' }));
      await waitFor(() => expect(currentUrl).toBe('/budget?period=2026'));
      expect(panelOpen).toBe(true);
      expect(screen.queryByRole('button', { name: '画像を差し替え' })).toBeNull();
    } finally {
      Reflect.deleteProperty(URL, 'createObjectURL');
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('1 件も無いときは、作成へ誘う空の状態を出し詳細欄は出さない', async () => {
    store.rows = [];
    await mount();
    expect(await screen.findByRole('button', { name: '最初の改善リクエストを作成' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: '改善リクエストの詳細' })).toBeNull();
  });
});

/* ------------------------------ AC-015 ------------------------------ */

describe('送信の条件 (AC-015)', () => {
  it('本文があってもプライバシーの確認が 2 つ揃うまで送れない', async () => {
    await mount();
    fireEvent.change(bodyInput(), { target: { value: '予算画面の説明を増やしてほしい' } });
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(submitButton());
    expect(await screen.findByText(IMPROVEMENT_DRAFT_MESSAGES.privacy)).toBeTruthy();
    expect(api.createImprovement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /個人情報や機密情報が含まれていない/ }));
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox', { name: /取り扱いに同意します/ }));
    expect(submitButton().getAttribute('aria-disabled')).toBe('false');

    fireEvent.click(submitButton());
    await waitFor(() => expect(api.createImprovement).toHaveBeenCalledTimes(1));
    // 作った依頼が選ばれ、URL に番号の id が載る
    await waitFor(() => expect(currentUrl).toBe('/improvement?id=imp-13'));
    await expectDetail('IMP-013');
  });

  it('1000 字を超えると押す前から理由を出し、送れない', async () => {
    await mount();
    fireEvent.click(screen.getByRole('checkbox', { name: /個人情報や機密情報が含まれていない/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /取り扱いに同意します/ }));
    fireEvent.change(bodyInput(), { target: { value: 'あ'.repeat(1001) } });
    expect(screen.getByText('1001/1000')).toBeTruthy();
    expect(screen.getByText(IMPROVEMENT_DRAFT_MESSAGES.bodyTooLong)).toBeTruthy();
    expect(bodyInput().getAttribute('aria-invalid')).toBe('true');
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(submitButton());
    expect(api.createImprovement).not.toHaveBeenCalled();

    fireEvent.change(bodyInput(), { target: { value: 'あ'.repeat(1000) } });
    expect(submitButton().getAttribute('aria-disabled')).toBe('false');
  });
});

/* ------------------------------ AC-016 ------------------------------ */

describe('撮影用の複製で金額を伏せる (AC-016)', () => {
  it('KPI の値は data-capture-mask を持ち、複製の上で伏字になる', () => {
    const { container } = render(<KpiCard label="今月の支出" value="¥123,456" />);
    const value = container.querySelector('[data-capture-mask]');
    expect(value?.textContent).toBe('¥123,456');
    const clone = container.cloneNode(true) as HTMLElement;
    maskSensitiveText(clone);
    expect(clone.textContent).not.toContain('123,456');
    expect(clone.textContent).toContain(IMPROVEMENT_MASK);
    // 見出しは伏せない (どの欄かは改善の手掛かり)
    expect(clone.textContent).toContain('今月の支出');
    // 元の画面は変わらない
    expect(value?.textContent).toBe('¥123,456');
  });
});

/* ------------------------------ AC-017 ------------------------------ */

describe('URL から同じ一覧と詳細が戻る (AC-017)', () => {
  it('詳細の取得失敗は読み込み中に戻さず、再読み込みで回復する', async () => {
    api.getImprovement.mockRejectedValueOnce(new Error('一時的な接続エラー'));
    await mount('/improvement?id=imp-3');
    const detail = detailPanel();
    expect((await within(detail).findByRole('alert')).textContent).toContain('詳細の読み込みに失敗しました');
    expect(within(detail).queryByText('詳細を読み込み中…')).toBeNull();
    fireEvent.click(within(detail).getByRole('button', { name: '詳細を再読み込みする' }));
    await expectDetail('IMP-003');
  });

  it('指示文が手元にないときの再発行と旧指示文の失効をコピー前に知らせる', async () => {
    await mount('/improvement?id=imp-3');
    await expectDetail('IMP-003');
    expect(
      within(detailPanel()).getByText(/コピー時に再発行し、以前の指示文は使えなくなります/),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: '選択中の改善リクエスト' })).getByText(
        /コピー時に再発行し、以前の指示文は使えなくなります/,
      ),
    ).toBeTruthy();
  });

  it('タブ・検索語・選択が URL から復元される', async () => {
    await mount('/improvement?id=imp-3&q=%E3%82%B0%E3%83%A9%E3%83%95');
    await expectDetail('IMP-003');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('グラフ');
    await waitFor(() => expect(within(listSection()).getAllByRole('row')).toHaveLength(2));
    expect(screen.getByRole('button', { name: /IMP-003 .* を選ぶ/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    // 選択中バーにも同じ番号が出る
    expect(
      within(screen.getByRole('region', { name: '選択中の改善リクエスト' })).getByText('IMP-003'),
    ).toBeTruthy();
  });

  it('タブとページの操作は URL に書かれ、既定値は書かない', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: '2 ページ目' }));
    await waitFor(() => expect(currentUrl).toBe('/improvement?page=2'));
    expect(await screen.findByText('2件 / 全12件')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: '受付 3' }));
    await waitFor(() => expect(currentUrl).toBe('/improvement?tab=open'));
    fireEvent.click(await screen.findByRole('button', { name: /IMP-005 .* を選ぶ/ }));
    await waitFor(() => expect(currentUrl).toBe('/improvement?id=imp-5&tab=open'));
  });

  it('URL の id が見つからなければ、選択を外して一覧だけにする', async () => {
    await mount('/improvement?id=imp-999');
    await waitFor(() => expect(currentUrl).toBe('/improvement'));
    expect(within(detailPanel()).queryByText(/IMP-999/)).toBeNull();
  });
});

/* ------------------------------ AC-018 ------------------------------ */

describe('削除と元に戻す (AC-018)', () => {
  it('削除すると一覧から消え、『元に戻す』で同じ番号が戻る', async () => {
    await mount('/improvement?id=imp-12');
    await expectDetail('IMP-012');
    fireEvent.click(within(detailPanel()).getByRole('button', { name: 'このリクエストを削除' }));

    const undo = await screen.findByRole('button', { name: '元に戻す' });
    await waitFor(() => expect(currentUrl).toBe('/improvement'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /IMP-012 .* を選ぶ/ })).toBeNull());
    // 押した削除ボタンは詳細ごと消えるので、フォーカスは『元に戻す』へ移る
    expect(document.activeElement).toBe(undo);

    fireEvent.click(undo);
    await waitFor(() => expect(api.restoreImprovement).toHaveBeenCalledWith('imp-12'));
    await waitFor(() => expect(currentUrl).toBe('/improvement?id=imp-12'));
    await expectDetail('IMP-012');
    expect(await screen.findByRole('button', { name: /IMP-012 .* を選ぶ/ })).toBeTruthy();
  });
});

/* ------------------------------ AC-019 ------------------------------ */

describe('見た目の契約 (AC-019)', () => {
  it('状態は色だけでなく文字で出る', async () => {
    await mount();
    await within(listSection()).findByRole('table');
    const badges = Array.from(listSection().querySelectorAll('.improvement-status'));
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) expect(badge.textContent?.trim()).toMatch(/^(受付|対応中|完了|再確認)$/);
  });

  it('ボタンはすべて共通の Button 部品を通る', async () => {
    await mount('/improvement?id=imp-2');
    await expectDetail('IMP-002');
    const page = document.querySelector('.improvement-page');
    const buttons = Array.from(page?.querySelectorAll('button') ?? []);
    expect(buttons.length).toBeGreaterThan(10);
    const native = buttons.filter(
      (b) => b.getAttribute('data-component') !== 'Button' && !b.closest('[role="tablist"]'),
    );
    expect(native.map((b) => b.textContent)).toEqual([]);
  });

  it('画面と撮影パネルの CSS は生の色を持たず、トークンだけを使う', () => {
    const files = [
      // vitest は packages/web を起点に走る
      resolve(process.cwd(), 'src/pages/improvement/improvement.css'),
      resolve(process.cwd(), 'src/components/capture-panel.css'),
    ];
    for (const file of files) {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g) ?? []).toEqual([]);
    }
  });
});
