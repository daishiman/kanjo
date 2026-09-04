// @vitest-environment jsdom

/** 仕分け画面のMF明細1件削除→その場取り消しの利用者導線を固定する。 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionsResponse, TxRow } from './api.js';
import { ClassifyPage } from './pages/Classify.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const row = (rowKind: TxRow['rowKind'], id: string, description: string): TxRow => ({
  id,
  rowKey: `${rowKind}:${id}`,
  rowKind,
  parentTxId: rowKind === 'split' ? 'MF-1' : null,
  lineId: rowKind === 'split' ? 'line-1' : null,
  splitSeq: rowKind === 'split' ? 1 : null,
  splitLineCount: rowKind === 'split' ? 2 : null,
  splitState: null,
  capabilities: {
    quickClass: rowKind !== 'split',
    edit: rowKind !== 'split',
    split: rowKind === 'mf',
    attach: rowKind !== 'split',
  },
  attachmentTargetId: null,
  idStable: rowKind === 'mf',
  date: '07/01',
  description,
  amount: -1000,
  institution: rowKind === 'cash' ? '現金' : '架空銀行',
  instSrc: '取込値',
  csvInstitution: rowKind === 'cash' ? '現金' : '架空銀行',
  paymentMethod: rowKind === 'cash' ? 'cash' : 'account',
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
  attachmentCount: 0,
  edit: null,
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
    totalExpense: transactions.length * 1000,
    bizExpense: 0,
    personalExpense: transactions.length * 1000,
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
  institutions: ['架空銀行'],
});

function renderPage(transactions: TxRow[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  let visibleTransactions = transactions;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push({ path, init });
      if (path.startsWith('/api/transactions?')) return json(response(visibleTransactions));
      if (path === '/api/attachments/orphans') return json({ attachments: [] });
      if (path === '/api/vendor-memory') return json({ memories: [] });
      if (path === '/api/data/deletions/preflight')
        return json({
          counts: { mfTx: 1, freeeDeals: 0, balanceEntries: 0, months: 1 },
          collateral: { txEdits: 0, txSplits: 0, attachments: 0, cashEntries: 0 },
          months: ['2026-07'],
          fingerprint: 'fp-one',
          undoable: true,
          undoRetentionDays: 30,
        });
      if (path === '/api/data/deletions') {
        visibleTransactions = [];
        return json({
          operationId: 'op-one',
          counts: { mfTx: 1, freeeDeals: 0, balanceEntries: 0, months: 1 },
          months: ['2026-07'],
          expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        });
      }
      if (path === '/api/data/undo/op-one') {
        visibleTransactions = transactions;
        return json({ operationId: 'undo-one', restored: { mf_transactions: 1 }, months: ['2026-07'] });
      }
      throw new Error(`unexpected request: ${path}`);
    }),
  );
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClassifyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('仕分け中の明細1件削除', () => {
  it('MF明細だけに入口を出し、確認した指紋付きで1件だけ消す', async () => {
    const calls = renderPage([
      row('mf', 'MF-1', '架空スーパー'),
      row('cash', 'cash:1', '手入力現金'),
      row('split', 'MF-1#1', '分割内訳'),
    ]);

    const buttons = await screen.findAllByRole('button', { name: 'この明細を削除' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(await screen.findByText('消える内容')).toBeTruthy();
    expect(calls.filter((call) => call.path === '/api/data/deletions')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'この明細1件を消す' }));
    await waitFor(() => expect(calls.filter((call) => call.path === '/api/data/deletions')).toHaveLength(1));
    const body = JSON.parse(
      String(calls.find((call) => call.path === '/api/data/deletions')?.init?.body ?? '{}'),
    );
    expect(body).toEqual({ granularity: 'transaction', txIds: ['MF-1'], fingerprint: 'fp-one' });
  });

  it('削除後の行再読込とは独立してその場取り消しを残す', async () => {
    const calls = renderPage([row('mf', 'MF-1', '架空スーパー')]);
    fireEvent.click(await screen.findByRole('button', { name: 'この明細を削除' }));
    fireEvent.click(await screen.findByRole('button', { name: 'この明細1件を消す' }));

    const undo = await screen.findByRole('button', { name: 'いま取り消す' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'この明細を削除' })).toBeNull());
    fireEvent.click(undo);
    await waitFor(() => expect(calls.some((call) => call.path === '/api/data/undo/op-one')).toBe(true));
  });
});
