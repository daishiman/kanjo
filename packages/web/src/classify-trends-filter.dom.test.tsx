// @vitest-environment jsdom

/**
 * 推移画面から /classify?category=…&payee=… で来たときの絞り込み (SYS-TRENDS-P04/P05)。
 *
 * 置換前の仕分け画面は category・payee を読まず、同じ月の明細をすべて並べる。
 * 取引先は完全一致だけで絞る (「架空スーパー」で「架空スーパーマーケット」を拾わない)。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionsResponse, TxRow } from './api.js';
import { ClassifyPage } from './pages/Classify.js';

const row = (over: Partial<TxRow>): TxRow => {
  const rowKind = over.rowKind ?? (over.paymentMethod === 'cash' ? 'cash' : 'mf');
  return {
    id: 'A1',
    idStable: true,
    date: '07/01',
    description: '架空スーパー',
    amount: -1000,
    institution: '架空銀行',
    instSrc: '取込値',
    csvInstitution: '架空銀行',
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
    origin: null,
    originKey: null,
    scopeMismatch: false,
    edit: null,
    ...over,
    rowKey: over.rowKey ?? `${rowKind}:${over.id ?? 'A1'}`,
    rowKind,
    parentTxId: over.parentTxId ?? null,
    lineId: over.lineId ?? null,
    splitSeq: over.splitSeq ?? null,
    splitLineCount: over.splitLineCount ?? null,
    splitState: over.splitState ?? null,
    capabilities:
      over.capabilities ??
      (rowKind === 'cash'
        ? { quickClass: true, edit: true, split: false }
        : { quickClass: true, edit: true, split: true }),
  };
};

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
      bySource: { 手動: 0, ルール: 0, 中項目: 0, 既定: transactions.length },
      reviewPending: transactions.length,
    },
    editedCount: 0,
    conflictCount: 0,
    noInstitutionCount: 0,
    nonCountableCount: 0,
  },
  transactions,
  candidates: { biz: [], per: [] } as unknown as TransactionsResponse['candidates'],
  institutions: ['架空銀行'],
});

function mockFetch(transactions: TxRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(response(transactions)), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ClassifyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const shownDescriptions = () =>
  Array.from(document.querySelectorAll('td.tx-description')).map((cell) => cell.getAttribute('title'));

const rows = [
  row({ id: 'A1', description: '架空スーパー' }),
  row({ id: 'A2', description: '架空スーパーマーケット' }),
  row({ id: 'A3', description: '架空カフェ', big: '交際費', csvBig: '交際費' }),
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('推移からの絞り込み', () => {
  it('category と payee が完全一致する明細だけを並べる', async () => {
    mockFetch(rows);
    renderAt(
      '/classify?month=2026-07&cls=per&category=%E9%A3%9F%E8%B2%BB&payee=%E6%9E%B6%E7%A9%BA%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC',
    );
    await screen.findByText(/推移から絞り込み中/);
    expect(shownDescriptions()).toEqual(['架空スーパー']);
    expect(screen.getByRole('status').textContent).toContain('食費 / 架空スーパー');
    expect(screen.getByRole('status').textContent).toContain('1件');
  });

  it('payee が無ければカテゴリだけで絞る', async () => {
    mockFetch(rows);
    renderAt('/classify?category=%E9%A3%9F%E8%B2%BB');
    await screen.findByText(/推移から絞り込み中/);
    expect(shownDescriptions()).toEqual(['架空スーパー', '架空スーパーマーケット']);
  });

  it('0 件でも解除でき、解除すると全件に戻る', async () => {
    mockFetch(rows);
    renderAt('/classify?category=%E5%AD%98%E5%9C%A8%E3%81%97%E3%81%AA%E3%81%84');
    await screen.findByText('該当する明細がありません');
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }));
    await waitFor(() => expect(shownDescriptions()).toHaveLength(3));
    expect(screen.queryByText(/推移から絞り込み中/)).toBeNull();
  });

  it('category が無ければ絞り込みの表示を出さない', async () => {
    mockFetch(rows);
    renderAt('/classify?payee=%E6%9E%B6%E7%A9%BA%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC');
    await waitFor(() => expect(shownDescriptions()).toHaveLength(3));
    expect(screen.queryByText(/推移から絞り込み中/)).toBeNull();
  });
});
