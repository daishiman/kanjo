// @vitest-environment jsdom

/**
 * 取込履歴からの「やり直し(再取込)」の画面契約。
 * 押しただけでは何も書き換わらず、月単位の洗い替えは通常の取込と同じ確認を経てから起きること。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportHistoryRow } from './api.js';
import { ImportPage } from './pages/Import.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const historyRow = (over: Partial<ImportHistoryRow> = {}): ImportHistoryRow => ({
  id: 41,
  filename: '架空-2026-07.csv',
  kind: 'freee',
  months: ['2026-07'],
  rows: 12,
  status: 'committed',
  duplicateOf: null,
  failureReason: null,
  generationState: 'superseded',
  committedAt: '2026-07-31T00:00:00.000Z',
  createdAt: '2026-07-31T00:00:00.000Z',
  originalRecorded: true,
  ...over,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // 取込画面は資産推移の説明から他ページへリンクするため、Router が無いと描画できない
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{(<ImportPage />) as ReactNode}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 履歴GETと原本GETだけを返す fetch。原本は呼ばれた回数を数える */
const stubFetch = (imports: ImportHistoryRow[], original: () => Response) => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (path.endsWith('/original')) return original();
      if (path.startsWith('/api/imports')) return json({ imports });
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  return calls;
};

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

describe('取込履歴のやり直し', () => {
  it('押すと原本を取込枠へ戻すだけで、取込POSTは走らない', async () => {
    const calls = stubFetch([historyRow()], () => new Response('収支区分,発生日\n'));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'この取込をやり直す' }));

    expect(await screen.findByText(/取込履歴 #41/)).toBeTruthy();
    expect(screen.getByText(/まだ何も書き換えていません/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1件のファイルを選択中' })).toBeTruthy();
    expect(screen.getAllByText('架空-2026-07.csv')).toHaveLength(2);
    const cancel = screen.getAllByRole('button', { name: 'やり直しをやめる' });
    expect(cancel).toHaveLength(2);
    // 戻しただけの段階では書き換え系のリクエストを一切出さない
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([]);
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.click(cancel[1]);
    expect(screen.queryByRole('heading', { name: '1件のファイルを選択中' })).toBeNull();
    expect(screen.getByRole('button', { name: 'この取込をやり直す' })).toBeTruthy();
  });

  it('戻した原本は「取込を実行」で初めて、月単位の洗い替え確認を経て送られる', async () => {
    const calls = stubFetch([historyRow()], () => new Response('収支区分,発生日\n'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        calls.push(`${init?.method ?? 'GET'} ${path}`);
        if (init?.method === 'POST') return json({ results: [] });
        if (path.endsWith('/original')) return new Response('収支区分,発生日\n');
        return json({ imports: [historyRow()] });
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'この取込をやり直す' }));
    fireEvent.click(await screen.findByRole('button', { name: '取込を実行' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('月単位の洗い替え'));
    await waitFor(() => expect(calls).toContain('POST /api/imports'));
  });

  it('原本がR2に無ければ理由をその行に出し、取込枠へは何も入れない', async () => {
    stubFetch([historyRow()], () =>
      json(
        { error: { code: 'import_original_missing', message: '取込の原本が保管先に見つかりません' } },
        404,
      ),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'この取込をやり直す' }));

    fireEvent.click(await screen.findByText('詳細を見る'));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '取込の原本が保管先に見つかりません',
    );
    expect(screen.queryByRole('heading', { name: /ファイルを選択中/ })).toBeNull();
  });

  it('原本を保存していない履歴にはボタンを出さない', async () => {
    stubFetch([historyRow({ originalRecorded: false }), historyRow({ id: 42 })], () => new Response(''));
    renderPage();

    const legacy = (await screen.findByText('原本なし')).closest('.import-record');
    expect(legacy).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'この取込をやり直す' })).toHaveLength(1);
  });
});
