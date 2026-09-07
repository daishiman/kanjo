// @vitest-environment jsdom

/**
 * 複数ファイルを選んだときの取込の送り方。
 *
 * 実データで 3 ファイルを選んだところ「取込の安全上限を超えます(計画 61 queries / 上限未満 50)」
 * で丸ごと失敗した。上限は Cloudflare Workers Free の 1 invocation あたり 50 D1 queries で、
 * アプリ側では上げられない (`packages/api/src/import-lifecycle.ts` の `D1_FREE_QUERY_LIMIT`)。
 * したがって「1 リクエストに全部載せる」という送り方そのものを変える必要がある。
 *
 * ここで固定するのは送り方の契約であって、上限値そのものは API 側のテストが持つ。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from '../src/pages/Import.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const committed = (filename: string) => ({
  filename,
  kind: 'mf',
  months: ['2026-08'],
  rows: 3,
  skipped: 0,
  status: 'committed' as const,
});

/**
 * 取込 POST ごとに、載っていたファイル名を記録する fetch。
 *
 * `handler` を渡すと、その POST が何回目かに応じて応答を差し替えられる (失敗の混在を作るため)。
 */
const stub = (handler?: (names: string[], index: number) => Response | undefined) => {
  const posts: string[][] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (init?.method === 'POST' && path.startsWith('/api/imports')) {
        const form = init.body as FormData;
        const names = form.getAll('file').map((f) => (f as File).name);
        const index = posts.length;
        posts.push(names);
        return handler?.(names, index) ?? json({ results: names.map(committed) });
      }
      if (path.startsWith('/api/total-cashflow')) return json({ months: [], review: [] });
      return json({ imports: [] });
    }),
  );
  return posts;
};

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

async function upload(names: string[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const files = names.map((name) => new File(['収支区分,発生日\n'], name, { type: 'text/csv' }));
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
  fireEvent.click(await screen.findByRole('button', { name: '取込を実行' }));
  // 確認はアプリ内 dialog。window.confirm はブラウザ抑止で無反応になるため通さない
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '置き換えて取り込む' }),
  );
  // 分けて送るので結果行は複数出る。単数前提で待つと、成功していても落ちる
  await waitFor(() => expect(screen.getByRole('heading', { name: '取込結果' })).toBeTruthy());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('複数ファイルの取込は 1 ファイルずつ送る', () => {
  /*
    旧実装は全ファイルを 1 つの FormData に載せていたため、この検査は
    「3 ファイルが載った POST が 1 回」となって必ず落ちる。
  */
  it('3 ファイルを選ぶと POST が 3 回に分かれ、各回に 1 ファイルだけ載る', async () => {
    const posts = stub();
    renderPage();
    await upload(['a-2026-08.csv', 'b-2026-08.csv', 'c-2026-08.csv']);

    expect(posts).toEqual([['a-2026-08.csv'], ['b-2026-08.csv'], ['c-2026-08.csv']]);
  });

  it('結果表には分けて送った全ファイル分が並ぶ', async () => {
    stub();
    renderPage();
    await upload(['a-2026-08.csv', 'b-2026-08.csv']);

    expect(screen.getByText('a-2026-08.csv')).toBeTruthy();
    expect(screen.getByText('b-2026-08.csv')).toBeTruthy();
  });

  /*
    分割送信の一番の危険は「途中で 1 本落ちたら残りを送らず、成功した分の結果も消える」こと。
    落ちた側と通った側を同じ it の中で対にして、片側だけで緑にならないようにする。
  */
  it('途中の 1 本が落ちても残りは送り、落ちた分だけを失敗として残す', async () => {
    const posts = stub((_names, index) =>
      index === 1 ? json({ error: { message: '取込の安全上限を超えます' } }, 413) : undefined,
    );
    renderPage();
    await upload(['a-2026-08.csv', 'b-2026-08.csv', 'c-2026-08.csv']);

    // 2 本目で止まらず 3 本とも送っている
    expect(posts).toHaveLength(3);
    // 成功した 1・3 本目の結果は消えていない
    expect(screen.getByText('a-2026-08.csv')).toBeTruthy();
    expect(screen.getByText('c-2026-08.csv')).toBeTruthy();
    // 落ちた 2 本目は失敗として残る
    expect(screen.getByText('b-2026-08.csv')).toBeTruthy();
    expect(screen.getByText(/失敗したファイルは反映されていません/)).toBeTruthy();
  });
});
