// @vitest-environment jsdom

/**
 * 支払手段の見え方と絞り込みの回帰。
 * 手入力(現金)の明細を取込明細と見分けられること、絞り込みが API のクエリに乗ることを固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionsResponse, TxRow } from './api.js';
import { ClassifyPage } from './pages/Classify.js';

const row = (over: Partial<TxRow>): TxRow => ({
  id: 'A1',
  idStable: true,
  date: '07/01',
  description: '架空スーパー',
  amount: -1000,
  institution: '架空銀行',
  paymentMethod: 'account',
  csvBig: '食費',
  csvMid: '食料品',
  big: '食費',
  mid: '食料品',
  catSrc: '取込値',
  cls: 'per',
  src: '既定',
  owner: null,
  ownerSrc: '既定',
  edited: false,
  conflict: false,
  scopeMismatch: false,
  attachmentCount: 0,
  edit: null,
  ...over,
});

const response = (transactions: TxRow[]): TransactionsResponse => ({
  months: ['2026-07'],
  month: '2026-07',
  summary: {
    month: '2026-07',
    count: transactions.length,
    totalIncome: 0,
    bizIncome: 0,
    personalIncome: 0,
    totalExpense: 1000,
    bizExpense: 0,
    personalExpense: 1000,
    incomeByOwner: { business: 0, spouse: 0, family: 0, unset: 0 },
    progress: {
      total: transactions.length,
      bizCount: 0,
      personalCount: transactions.length,
      bySource: { 手動: 0, ルール: 0, 既定: transactions.length },
      reviewPending: transactions.length,
    },
    editedCount: 0,
    conflictCount: 0,
    noInstitutionCount: 0,
    nonCountableCount: 0,
  },
  transactions,
  candidates: { biz: [], per: [] } as unknown as TransactionsResponse['candidates'],
});

const requestedPaths: string[] = [];

function mockFetch(transactions: TxRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === 'string' ? input : String(input);
      requestedPaths.push(path);
      if (path.startsWith('/api/attachments'))
        return new Response(JSON.stringify({ attachments: [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      return new Response(JSON.stringify(response(transactions)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClassifyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  requestedPaths.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('支払手段の見え方と絞り込み', () => {
  it('手入力(現金)の明細に「手入力」バッジを出す', async () => {
    mockFetch([row({ id: 'cash:1', institution: '現金', paymentMethod: 'cash' })]);
    renderPage();
    const cell = await screen.findByTitle('現金の記帳から追加した明細(取込ではない)');
    expect(cell.textContent).toBe('手入力');
  });

  it('取込明細にはバッジを出さない', async () => {
    mockFetch([row({})]);
    renderPage();
    await screen.findByText('架空スーパー');
    expect(screen.queryByText('手入力')).toBeNull();
  });

  it('支払手段を選ぶと method クエリを付けて取り直す', async () => {
    mockFetch([row({})]);
    renderPage();
    await screen.findByText('架空スーパー');
    const toolbar = screen.getByRole('button', { name: '支払: すべて' }).parentElement as HTMLElement;
    fireEvent.click(within(toolbar).getByRole('button', { name: '現金' }));
    await waitFor(() => {
      expect(requestedPaths.some((path) => path.includes('method=cash'))).toBe(true);
    });
  });

  it('絞り込みを解除したら method クエリを付けない', async () => {
    mockFetch([row({})]);
    renderPage();
    await screen.findByText('架空スーパー');
    const toolbar = screen.getByRole('button', { name: '支払: すべて' }).parentElement as HTMLElement;
    fireEvent.click(within(toolbar).getByRole('button', { name: 'カード' }));
    await waitFor(() => expect(requestedPaths.some((path) => path.includes('method=card'))).toBe(true));
    requestedPaths.length = 0;
    fireEvent.click(within(toolbar).getByRole('button', { name: '支払: すべて' }));
    await waitFor(() => expect(requestedPaths.length).toBeGreaterThan(0));
    expect(requestedPaths.every((path) => !path.includes('method='))).toBe(true);
  });

  it('選択中の支払手段を aria-pressed で示す', async () => {
    mockFetch([row({})]);
    renderPage();
    await screen.findByText('架空スーパー');
    // 再レンダリングでボタンの DOM ノードは差し替わるため、参照を持たず毎回引き直す
    const cash = () => screen.getByRole('button', { name: '現金' });
    expect(cash().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(cash());
    await waitFor(() => expect(cash().getAttribute('aria-pressed')).toBe('true'));
  });
});
