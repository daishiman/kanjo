// @vitest-environment jsdom

/** 帳簿データの取消と、失敗・重複履歴の破棄を混同しない画面契約。 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportHistoryRow } from '../api.js';
import { ImportPage } from './Import.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const row = (over: Partial<ImportHistoryRow> = {}): ImportHistoryRow => ({
  id: 41,
  filename: '架空-失敗.csv',
  kind: 'mf',
  months: ['2026-09'],
  rows: 0,
  status: 'failed',
  duplicateOf: null,
  failureReason: '架空の形式エラー',
  generationState: null,
  committedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  originalRecorded: true,
  cancelable: false,
  discardable: true,
  ...over,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{(<ImportPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const stubFetch = (
  imports: ImportHistoryRow[],
  originalDisposition: 'delete' | 'keep_shared' | 'none' = 'delete',
  discardGate?: Promise<void>,
) => {
  const calls: Array<{ path: string; method: string; body?: string }> = [];
  let currentImports = [...imports];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ path, method, body: typeof init?.body === 'string' ? init.body : undefined });
      if (path.endsWith('/original')) return new Response('収支区分,発生日\n');
      if (path.endsWith('/discard/preflight'))
        return json({ fingerprint: 'v1:import-discard:架空', originalDisposition });
      if (path.endsWith('/discard')) {
        await discardGate;
        const discardedId = Number(/\/imports\/(\d+)\/discard$/.exec(path)?.[1]);
        currentImports = currentImports.filter(({ id }) => id !== discardedId);
        return json({
          discarded: true,
          original:
            originalDisposition === 'delete'
              ? 'deleted'
              : originalDisposition === 'keep_shared'
                ? 'kept_shared'
                : 'not_recorded',
        });
      }
      if (path === '/api/data/operations') return json({ operations: [] });
      if (path.startsWith('/api/imports')) return json({ imports: currentImports });
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  return calls;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('履歴を削除する確認', () => {
  it('帳簿データを変えない不可逆操作としてdialogで確認し、やめるへ初期focusする', async () => {
    stubFetch([row()]);
    renderPage();
    const trigger = await screen.findByRole('button', { name: 'この取込履歴を削除' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'この取込履歴を削除しますか？' });
    expect(within(dialog).getByText('帳簿データは変わりません。')).toBeTruthy();
    expect(within(dialog).getByText(/履歴と、ほかで使われていない保存原本を削除/)).toBeTruthy();
    expect(within(dialog).getByText(/元に戻せません/)).toBeTruthy();
    const cancel = within(dialog).getByRole('button', { name: 'やめる' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('共有原本は残すことを実行前に明示する', async () => {
    stubFetch([row()], 'keep_shared');
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'この取込履歴を削除' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/保存原本はほかの取込でも使われているため残します/)).toBeTruthy();
  });

  it('preflightの指紋を実行APIへ渡し、完了後も帳簿を変えていないと示す', async () => {
    const calls = stubFetch([row()]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'この取込履歴を削除' }));
    fireEvent.click(await screen.findByRole('button', { name: '履歴を削除する' }));

    expect(await screen.findByRole('heading', { name: '履歴を削除しました' })).toBeTruthy();
    expect(screen.getByText('帳簿データは変更していません。')).toBeTruthy();
    const execute = calls.find(({ path }) => path === '/api/imports/41/discard');
    expect(execute).toMatchObject({ method: 'POST' });
    expect(JSON.parse(execute?.body ?? '{}')).toEqual({ fingerprint: 'v1:import-discard:架空' });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    await waitFor(() => expect(screen.queryByText('架空-失敗.csv')).toBeNull());
  });

  it('やり直し中の失敗履歴を削除したら、選択中の原本も手元から外す', async () => {
    stubFetch([row()]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'この取込をやり直す' }));
    expect(await screen.findByRole('heading', { name: '1件のファイルを選択中' })).toBeTruthy();

    const record = screen.getByRole('listitem', { name: '架空-失敗.csvの取込履歴' });
    expect(within(record).getByRole('button', { name: 'やり直しをやめる' })).toBeTruthy();
    fireEvent.click(within(record).getByRole('button', { name: 'この取込履歴を削除' }));
    fireEvent.click(await screen.findByRole('button', { name: '履歴を削除する' }));

    expect(await screen.findByRole('heading', { name: '履歴を削除しました' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '1件のファイルを選択中' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    await waitFor(() => expect(screen.queryByText('架空-失敗.csv')).toBeNull());
  });

  it('削除実行中はEscapeで確認を閉じず、完了を同じ場所で示す', async () => {
    let releaseDiscard: (() => void) | undefined;
    const discardGate = new Promise<void>((resolve) => {
      releaseDiscard = resolve;
    });
    stubFetch([row()], 'delete', discardGate);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'この取込履歴を削除' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '履歴を削除する' }));
    await within(dialog).findByRole('button', { name: '削除中…' });

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBe(dialog);

    releaseDiscard?.();
    expect(await screen.findByRole('heading', { name: '履歴を削除しました' })).toBeTruthy();
  });
});

describe('履歴状態ごとの操作', () => {
  it('active/partialだけは取消、failed/duplicateだけは履歴削除を出す', async () => {
    stubFetch([
      row({
        id: 1,
        filename: 'active.csv',
        status: 'committed',
        generationState: 'active',
        cancelable: true,
        discardable: false,
      }),
      row({
        id: 2,
        filename: 'partial.csv',
        status: 'committed',
        generationState: 'partial',
        cancelable: true,
        discardable: false,
      }),
      row({
        id: 3,
        filename: 'superseded.csv',
        status: 'committed',
        generationState: 'superseded',
        cancelable: false,
        discardable: false,
      }),
      row({ id: 4, filename: 'failed.csv' }),
      row({ id: 5, filename: 'duplicate.csv', status: 'duplicate', failureReason: null }),
      row({ id: 6, filename: 'processing.csv', status: 'processing', discardable: false }),
      row({ id: 7, filename: 'applying.csv', status: 'applying', discardable: false }),
      row({ id: 8, filename: 'legacy.csv', status: 'ok', generationState: 'legacy', discardable: false }),
    ]);
    renderPage();
    await screen.findByText('active.csv');

    expect(screen.getAllByRole('button', { name: 'この取込を取り消す' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'この取込履歴を削除' })).toHaveLength(2);
    const superseded = screen.getByRole('listitem', { name: 'superseded.csvの取込履歴' });
    expect(within(superseded).queryByRole('button', { name: /取り消す|履歴を削除/ })).toBeNull();
    for (const filename of ['processing.csv', 'applying.csv', 'legacy.csv']) {
      const record = screen.getByRole('listitem', { name: `${filename}の取込履歴` });
      expect(within(record).queryByRole('button', { name: /取り消す|履歴を削除/ })).toBeNull();
    }
  });

  it('更新済み表示でもサーバが帳簿参照を検出した履歴は取り消せる', async () => {
    stubFetch([
      row({
        id: 9,
        filename: 'superseded-with-reference.json',
        status: 'committed',
        generationState: 'superseded',
        cancelable: true,
        discardable: false,
      }),
    ]);
    renderPage();

    const record = await screen.findByRole('listitem', {
      name: 'superseded-with-reference.jsonの取込履歴',
    });
    expect(within(record).getByRole('button', { name: 'この取込を取り消す' })).toBeTruthy();
    expect(within(record).queryByRole('button', { name: 'この取込履歴を削除' })).toBeNull();
  });
});
