// @vitest-environment jsdom

/**
 * 取込履歴からの「置換」(保存した原本で取り込み直す) の画面契約。
 * 押しただけでは何も書き換わらず、月単位の洗い替えはアプリ内の確認を経てから起きること。
 *
 * 取込画面の作り直し (spec-import-screen) で、旧「やり直し」(原本を取込枠へ戻してから通常の取込で送る)
 * は履歴の行の「置換」(`POST /imports/runs/:id/reimport`) に置き換わった。
 * 押しただけでは書き換えない・window.confirm を使わない・原本が無ければ理由を出す、の 3 点は旧契約から引き継ぐ。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportRunCommitResponse, ImportRunRowView } from './api.js';
import { ImportPage } from './pages/Import.js';
import { createImportServer, jsonResponse, runRow } from './pages/import/import-test-fakes.js';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // 取込画面は結果の案内から他ページへリンクするため、Router が無いと描画できない
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{(<ImportPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const reimported = (filename: string, remaining: string[]): ImportRunCommitResponse => ({
  run: {
    id: 'run-2',
    result: 'success',
    files: [{ id: filename, filename, state: 'imported', rowCount: 12, reason: null }],
    impact: { added: 12, skipped: 0, subsCandidates: 0 },
    duplicateCandidates: 0,
  },
  remaining,
});

/** 置換 POST の応答を差し替えられる偽サーバ */
const stub = (runs: ImportRunRowView[], reimport: (body: unknown, index: number) => Response) => {
  let index = 0;
  const server = createImportServer({
    runs,
    route: (method, path, init) => {
      if (method === 'POST' && /^\/api\/imports\/runs\/[^/]+\/reimport$/.test(path)) {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        return reimport(body, index++);
      }
      return undefined;
    },
  });
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest);
  return server;
};

const replaceButtons = () => screen.findAllByRole('button', { name: /の取込を置換$/ });

beforeEach(() => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('取込履歴の置換', () => {
  it('押すとアプリ内の確認を出すだけで、書き換え系の要求は走らない', async () => {
    const server = stub([runRow({ id: 'run-1' })], () => jsonResponse(reimported('架空.csv', []), 201));
    renderPage();

    const [trigger] = await replaceButtons();
    fireEvent.click(trigger);

    /*
      確認は画面の中に出す。window.confirm はブラウザの「このページでこれ以上ダイアログを
      表示しない」抑止が効くと即 false を返し、押しても何も起きないボタンになる。
      window.confirm を残した実装をここで落とすため、呼ばれていないことまで固定する。
    */
    const dialog = await screen.findByRole('dialog', { name: 'この取込を保存した原本で置換しますか？' });
    expect(confirm).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain('同じ月の明細を洗い替えます');
    expect(server.calls.filter((call) => call.startsWith('POST'))).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'やめる' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(server.calls.filter((call) => call.startsWith('POST'))).toEqual([]);
    expect(document.activeElement).toBe(trigger);
  });

  it('確認してから押すと送り、残りのファイルは同じ置換先へ続けて送る', async () => {
    const bodies: unknown[] = [];
    const server = stub([runRow({ id: 'run-1', fileCount: 2 })], (body, index) => {
      bodies.push(body);
      return jsonResponse(index === 0 ? reimported('a.csv', ['b.csv']) : reimported('b.csv', []), 201);
    });
    renderPage();

    fireEvent.click((await replaceButtons())[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '原本で置換する' }));

    expect(await screen.findByText('保存した原本で置換しました。')).toBeTruthy();
    expect(server.calls.filter((call) => call.startsWith('POST'))).toEqual([
      'POST /api/imports/runs/run-1/reimport',
      'POST /api/imports/runs/run-1/reimport',
    ]);
    // 2 回目以降は、1 回目が作った取込へ残りを足す (取込 1 回が 2 つに割れない)
    expect(bodies).toEqual([null, { filenames: ['b.csv'], intoRunId: 'run-2' }]);
  });

  it('続きが 429 なら Retry-After だけ待って同じ要求を送り直し、置換を最後まで続ける', async () => {
    const bodies: unknown[] = [];
    stub([runRow({ id: 'run-1', fileCount: 2 })], (body, index) => {
      bodies.push(body);
      if (index === 0) return jsonResponse(reimported('a.csv', ['b.csv']), 201);
      if (index === 1) {
        const limited = jsonResponse({ error: { code: 'rate_limited', message: '集中しました' } }, 429);
        limited.headers.set('Retry-After', '1');
        return limited;
      }
      return jsonResponse(reimported('b.csv', []), 201);
    });
    renderPage();

    fireEvent.click((await replaceButtons())[0]);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '原本で置換する' }),
    );

    expect(
      await screen.findByText('短時間に操作が集中したため、1秒待ってから続きを置換します。'),
    ).toBeTruthy();
    expect(
      await screen.findByText('保存した原本で置換しました。', undefined, { timeout: 3000 }),
    ).toBeTruthy();
    const continuation = { filenames: ['b.csv'], intoRunId: 'run-2' };
    expect(bodies).toEqual([null, continuation, continuation]);
  });

  it('原本がR2に無ければ理由を出し、取込ファイル一覧へは何も入れない', async () => {
    stub([runRow({ id: 'run-1' })], () =>
      jsonResponse(
        { error: { code: 'import_original_missing', message: '取込の原本が保管先に見つかりません' } },
        404,
      ),
    );
    renderPage();

    fireEvent.click((await replaceButtons())[0]);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '原本で置換する' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('取込の原本が保管先に見つかりません');
    expect(screen.queryByRole('table', { name: '取込ファイル一覧' })).toBeNull();
    expect(screen.queryByRole('region', { name: '選択中のファイル' })).toBeNull();
  });

  it('原本を保存していない履歴では置換を押せない', async () => {
    stub(
      [
        runRow({
          id: 'run-1',
          createdAt: '2026-09-20T01:00:00.000Z',
          hasOriginal: false,
          replaceable: false,
        }),
        runRow({ id: 'run-2', createdAt: '2026-09-19T01:00:00.000Z' }),
      ],
      () => jsonResponse(reimported('架空.csv', []), 201),
    );
    renderPage();

    const buttons = (await replaceButtons()) as HTMLButtonElement[];
    expect(buttons.map((button) => button.disabled)).toEqual([true, false]);
  });
});
