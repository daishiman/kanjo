// @vitest-environment jsdom

/**
 * 帳簿データの取消と、失敗・重複履歴の破棄を混同しない画面契約。
 * ファイル単位の操作は、取込 1 回の詳細 (?run=) の中から呼ぶ (spec-import-screen 「既存 API の扱い」)。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportRunDetail, ImportRunDetailFile } from '../api.js';
import { ImportPage } from './Import.js';
import { createImportServer, jsonResponse, runDetail, runRow } from './import/import-test-fakes.js';

const file = (over: Partial<ImportRunDetailFile> = {}): ImportRunDetailFile => ({
  importId: 41,
  filename: '架空-失敗.csv',
  source: 'mf',
  state: 'failed',
  status: 'failed',
  rowCount: 0,
  months: ['2026-09'],
  reason: '架空の形式エラー',
  hasOriginal: true,
  generationState: null,
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
      <MemoryRouter initialEntries={['/?run=run-1']}>{(<ImportPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** run-1 の詳細にファイルを並べ、破棄したファイルはその場で詳細から外す */
const stubServer = (
  files: ImportRunDetailFile[],
  originalDisposition: 'delete' | 'keep_shared' | 'none' = 'delete',
  discardGate?: Promise<void>,
) => {
  const row = runRow({ id: 'run-1', fileCount: files.length, undoable: false });
  const details: Record<string, ImportRunDetail> = { 'run-1': runDetail(row, { files: [...files] }) };
  const server = createImportServer({
    runs: [row],
    details,
    route: async (method, path) => {
      if (path.endsWith('/original')) return new Response('収支区分,発生日\n');
      if (path.endsWith('/discard/preflight'))
        return jsonResponse({ fingerprint: 'v1:import-discard:架空', originalDisposition });
      const discard = /^\/api\/imports\/(\d+)\/discard$/.exec(path);
      if (discard && method === 'POST') {
        await discardGate;
        const id = Number(discard[1]);
        const detail = details['run-1'];
        details['run-1'] = { ...detail, files: detail.files.filter((entry) => entry.importId !== id) };
        return jsonResponse({
          discarded: true,
          original:
            originalDisposition === 'delete'
              ? 'deleted'
              : originalDisposition === 'keep_shared'
                ? 'kept_shared'
                : 'not_recorded',
        });
      }
      return undefined;
    },
  });
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest);
  return server;
};

const detailPane = () => screen.findByRole('complementary', { name: '履歴の詳細' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('履歴を削除する確認', () => {
  it('帳簿データを変えない不可逆操作としてdialogで確認し、やめるへ初期focusする', async () => {
    stubServer([file()]);
    renderPage();
    const trigger = await within(await detailPane()).findByRole('button', { name: 'この取込履歴を削除' });
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
    stubServer([file()], 'keep_shared');
    renderPage();
    fireEvent.click(await within(await detailPane()).findByRole('button', { name: 'この取込履歴を削除' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/保存原本はほかの取込でも使われているため残します/)).toBeTruthy();
  });

  it('preflightの指紋を実行APIへ渡し、完了後も帳簿を変えていないと示す', async () => {
    const server = stubServer([file()]);
    renderPage();
    fireEvent.click(await within(await detailPane()).findByRole('button', { name: 'この取込履歴を削除' }));
    fireEvent.click(await screen.findByRole('button', { name: '履歴を削除する' }));

    expect(await screen.findByRole('heading', { name: '履歴を削除しました' })).toBeTruthy();
    expect(screen.getByText('帳簿データは変更していません。')).toBeTruthy();
    expect(server.calls).toContain('POST /api/imports/41/discard');
    expect(server.bodies.find(({ path }) => path === '/api/imports/41/discard')?.body).toEqual({
      fingerprint: 'v1:import-discard:架空',
    });

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    await waitFor(() => expect(screen.queryByText('架空-失敗.csv')).toBeNull());
  });

  it('削除実行中はEscapeで確認を閉じず、完了を同じ場所で示す', async () => {
    let releaseDiscard: (() => void) | undefined;
    const discardGate = new Promise<void>((resolve) => {
      releaseDiscard = resolve;
    });
    stubServer([file()], 'delete', discardGate);
    renderPage();

    fireEvent.click(await within(await detailPane()).findByRole('button', { name: 'この取込履歴を削除' }));
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
    stubServer([
      file({
        importId: 1,
        filename: 'active.csv',
        status: 'committed',
        state: 'imported',
        generationState: 'active',
        cancelable: true,
        discardable: false,
      }),
      file({
        importId: 2,
        filename: 'partial.csv',
        status: 'committed',
        state: 'imported',
        generationState: 'partial',
        cancelable: true,
        discardable: false,
      }),
      file({
        importId: 3,
        filename: 'superseded.csv',
        status: 'committed',
        state: 'imported',
        generationState: 'superseded',
        cancelable: false,
        discardable: false,
      }),
      file({ importId: 4, filename: 'failed.csv' }),
      file({ importId: 5, filename: 'duplicate.csv', status: 'duplicate', state: 'imported', reason: null }),
      file({ importId: 6, filename: 'processing.csv', status: 'processing', discardable: false }),
      file({ importId: 7, filename: 'applying.csv', status: 'applying', discardable: false }),
      file({
        importId: 8,
        filename: 'legacy.csv',
        status: 'ok',
        generationState: 'legacy',
        discardable: false,
      }),
    ]);
    renderPage();
    const pane = await detailPane();
    await within(pane).findByText('active.csv');

    expect(within(pane).getAllByRole('button', { name: 'この取込を取り消す' })).toHaveLength(2);
    expect(within(pane).getAllByRole('button', { name: 'この取込履歴を削除' })).toHaveLength(2);
    for (const filename of ['superseded.csv', 'processing.csv', 'applying.csv', 'legacy.csv']) {
      const record = within(pane).getByRole('listitem', { name: `${filename}の取込履歴` });
      expect(within(record).queryByRole('button', { name: /取り消す|履歴を削除/ })).toBeNull();
    }
  });

  it('更新済み表示でもサーバが帳簿参照を検出した履歴は取り消せる', async () => {
    stubServer([
      file({
        importId: 9,
        filename: 'superseded-with-reference.json',
        status: 'committed',
        state: 'imported',
        generationState: 'superseded',
        cancelable: true,
        discardable: false,
      }),
    ]);
    renderPage();

    const record = await within(await detailPane()).findByRole('listitem', {
      name: 'superseded-with-reference.jsonの取込履歴',
    });
    expect(within(record).getByText('更新済み')).toBeTruthy();
    expect(within(record).getByRole('button', { name: 'この取込を取り消す' })).toBeTruthy();
    expect(within(record).queryByRole('button', { name: 'この取込履歴を削除' })).toBeNull();
  });
});

describe('データを消した取込の履歴', () => {
  const deleted = (over: Partial<ImportRunDetailFile> = {}) =>
    file({ status: 'committed', state: 'imported', generationState: 'deleted', reason: null, ...over });

  it('消したデータの履歴を「取込完了」と表示しない', async () => {
    stubServer([deleted({ importId: 11, filename: 'deleted.csv' })]);
    renderPage();

    const record = await within(await detailPane()).findByRole('listitem', { name: 'deleted.csvの取込履歴' });
    expect(within(record).getByText('データ削除済み')).toBeTruthy();
    expect(within(record).queryByText('取込完了')).toBeNull();
  });

  it('取り消しの控えが残る間は片づけず、その旨を出す', async () => {
    stubServer([deleted({ importId: 12, filename: 'undoable.csv', discardable: false })]);
    renderPage();

    const record = await within(await detailPane()).findByRole('listitem', {
      name: 'undoable.csvの取込履歴',
    });
    expect(within(record).getByText('取り消し可能')).toBeTruthy();
    expect(within(record).queryByRole('button', { name: 'この取込履歴を削除' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'データ削除済みの取込履歴をまとめて片づける' })).toBeNull();
  });

  it('片づけられる削除済みだけを数え、1件ずつ破棄して一覧から消す', async () => {
    const server = stubServer([
      deleted({ importId: 13, filename: 'deleted-a.csv' }),
      deleted({ importId: 14, filename: 'deleted-b.csv' }),
      deleted({ importId: 15, filename: 'undoable.csv', discardable: false }),
      file({
        importId: 16,
        filename: 'active.csv',
        status: 'committed',
        state: 'imported',
        generationState: 'active',
        discardable: false,
      }),
    ]);
    renderPage();

    const bulk = await within(await detailPane()).findByRole('button', {
      name: 'データ削除済みの取込履歴をまとめて片づける',
    });
    expect(bulk.textContent).toContain('2件');
    fireEvent.click(bulk);

    const dialog = await screen.findByRole('dialog', { name: '削除済みの履歴 2 件を片づけますか？' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'まとめて片づける' }));

    expect(await screen.findByRole('heading', { name: '片づけが終わりました' })).toBeTruthy();
    expect(server.calls.filter((call) => call.startsWith('POST') && call.endsWith('/discard'))).toEqual([
      'POST /api/imports/13/discard',
      'POST /api/imports/14/discard',
    ]);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    await waitFor(() => expect(screen.queryByText('deleted-a.csv')).toBeNull());
    expect(screen.queryByText('deleted-b.csv')).toBeNull();
    expect(screen.getByText('undoable.csv')).toBeTruthy();
  });
});
