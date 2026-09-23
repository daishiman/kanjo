// @vitest-environment jsdom

/**
 * 複数ファイルを選んだときの取込の送り方。
 *
 * 実データで 3 ファイルを選んだところ「取込の安全上限を超えます(計画 61 queries / 上限未満 50)」
 * で丸ごと失敗した。上限は Cloudflare Workers Free の 1 invocation あたり 50 D1 queries で、
 * アプリ側では上げられない (`packages/api/src/import-lifecycle.ts` の `D1_FREE_QUERY_LIMIT`)。
 * 取込画面の作り直し後は、検査済みのファイルを `POST /imports/runs` で確定し、
 * サーバが 1 要求で扱いきれなかった分を `remaining` で返す。画面は remaining が空になるまで呼び直す。
 *
 * ここで固定するのは送り方の契約であって、1 要求で何ファイル扱うかはサーバ (API 側のテスト) が持つ。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from '../src/pages/Import.js';
import {
  type ImportServerOptions,
  chooseImportFiles,
  createImportServer,
  csvFile,
} from '../src/pages/import/import-test-fakes.js';

/** 取込元に依存しない複数ファイル確定の契約を、freee の検査結果で固定する。 */
const stub = (over: ImportServerOptions = {}) => {
  const server = createImportServer({ inspect: () => ({ source: 'freee' }), ...over });
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest);
  return server;
};

/** 確定要求ごとの fileIds */
const commitRequests = (server: ReturnType<typeof createImportServer>) =>
  server.bodies
    .filter(({ path }) => path === '/api/imports/runs')
    .map(({ body }) => (body as { fileIds: string[] }).fileIds);

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

/** 全テストを並べて流すと、3 回の確定と検査の往復が既定の 1 秒を超えることがある。契約ではなく待ち時間だけを延ばす */
const SLOW = { timeout: 5000 };

async function upload(names: string[]) {
  chooseImportFiles(names.map((name) => csvFile(name)));
  const commit = await screen.findByRole('button', { name: `✓ ${names.length}ファイルを取り込む` }, SLOW);
  // 検査が全部返ってから押す。検査中のファイルは確定の対象にならない
  await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false), SLOW);
  fireEvent.click(commit);
  // 確認はアプリ内 dialog。window.confirm はブラウザ抑止で無反応になるため通さない
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('複数ファイルの取込は remaining が空になるまで確定し直す', () => {
  it('最初に選んだ複数ファイルは 1 回の multipart で検査へ送る', async () => {
    const server = stub();
    renderPage();

    chooseImportFiles([csvFile('a-2026-08.csv'), csvFile('b-2026-08.csv'), csvFile('c-2026-08.csv')]);

    await waitFor(() => expect(server.inspectionFiles()).toHaveLength(3), SLOW);
    expect(server.uploadBatches).toEqual([['a-2026-08.csv', 'b-2026-08.csv', 'c-2026-08.csv']]);
    expect(server.calls.filter((call) => call === 'POST /api/imports/inspections')).toHaveLength(1);
    expect(server.calls.filter((call) => /\/api\/imports\/inspections\/.+\/files/.test(call))).toEqual([]);
  });

  /*
    remaining を読まずに 1 回で終える実装は、この検査で「要求が 1 回」となって落ちる。
  */
  it('3 ファイルを選ぶと、サーバが返す残りを送り直して 3 回で終える', async () => {
    const server = stub();
    renderPage();
    await upload(['a-2026-08.csv', 'b-2026-08.csv', 'c-2026-08.csv']);

    expect(commitRequests(server)).toEqual([
      ['file-1', 'file-2', 'file-3'],
      ['file-2', 'file-3'],
      ['file-3'],
    ]);
    expect(await screen.findByText('3 件のファイルを正常に取り込みました')).toBeTruthy();
  });

  it('結果には分けて確定した全ファイル分が並ぶ', async () => {
    stub();
    renderPage();
    await upload(['a-2026-08.csv', 'b-2026-08.csv']);

    const table = await screen.findByRole('table', { name: '取込ファイル一覧' });
    expect(within(table).getByText('a-2026-08.csv')).toBeTruthy();
    expect(within(table).getByText('b-2026-08.csv')).toBeTruthy();
  });

  /*
    分割確定の一番の危険は「途中で 1 本落ちたら残りを送らず、成功した分の結果も消える」こと。
    落ちた側と通った側を同じ it の中で対にして、片側だけで緑にならないようにする。
  */
  it('途中の 1 本が落ちても残りは確定し、落ちた分だけを失敗として残す', async () => {
    const server = stub({
      commitFails: (file) => (file.filename === 'b-2026-08.csv' ? '架空の形式エラー' : null),
    });
    renderPage();
    await upload(['a-2026-08.csv', 'b-2026-08.csv', 'c-2026-08.csv']);

    // 2 本目で止まらず 3 本とも確定を依頼している
    expect(commitRequests(server)).toHaveLength(3);
    expect(await screen.findByText('2 件のファイルを正常に取り込みました')).toBeTruthy();
    expect(screen.getByText('エラーのあった 1 件のファイルは取り込みませんでした。')).toBeTruthy();
    expect(screen.getByText('取り込んだデータは会計データに追加されています。')).toBeTruthy();
    // 落ちた 2 本目は、理由つきで一覧に残る
    const table = screen.getByRole('table', { name: '取込ファイル一覧' });
    expect(within(table).getByText('b-2026-08.csv')).toBeTruthy();
    expect(within(table).getByText(/架空の形式エラー/)).toBeTruthy();
  });
});
