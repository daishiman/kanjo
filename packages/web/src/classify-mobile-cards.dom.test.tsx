// @vitest-environment jsdom

/**
 * 仕分け表のスマホカード化の契約。
 *
 * jsdom はレイアウトを計算しないため「見た目が崩れないこと」は試験できない。
 * カード化が成立する前提だけを固定する: `stack-sm` が付いていること、
 * 各セルに見出しを復元する `data-label` があること、
 * 見出しに使う「内容」セルが特定できること。実際の折り返しは実機手動確認に残す。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionsResponse, TxRow } from './api.js';
import { ClassifyPage } from './pages/Classify.js';

const row = (over: Partial<TxRow> = {}): TxRow => ({
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

function mockFetch(transactions: TxRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = typeof input === 'string' ? input : String(input);
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** 見出しの並び。data-label はこの見出しと一致していなければカード化で意味が変わる */
const HEADERS = ['日付', '内容', '口座', '大項目/中項目', '金額', '判定', '名義', '証憑', '操作'];

describe('仕分け表のスマホカード化', () => {
  it('仕分け表に stack-sm を付け、640px以下で1行=1カードへ切り替えられる状態にする', async () => {
    mockFetch([row()]);
    const { container } = renderPage();
    await screen.findByText('架空スーパー');
    const table = container.querySelector('table.classify-table');
    expect(table).not.toBeNull();
    expect(table?.classList.contains('stack-sm')).toBe(true);
  });

  it('明細行の全セルに data-label があり、thead の見出しと同じ語で復元できる', async () => {
    mockFetch([row()]);
    const { container } = renderPage();
    await screen.findByText('架空スーパー');
    const table = container.querySelector('table.classify-table');
    const headers = [...(table?.querySelectorAll('thead th') ?? [])].map((th) => th.textContent);
    expect(headers).toEqual(HEADERS);

    const cells = [...(table?.querySelectorAll('tbody tr:not(.editor) > td') ?? [])];
    expect(cells).toHaveLength(HEADERS.length);
    expect(cells.map((td) => td.getAttribute('data-label'))).toEqual(HEADERS);
  });

  it('カードの見出しへ回す「内容」セルを tx-description で特定でき、DOM順は列順のまま保つ', async () => {
    mockFetch([row()]);
    const { container } = renderPage();
    await screen.findByText('架空スーパー');
    const cells = [...(container.querySelectorAll('tbody tr:not(.editor) > td') ?? [])];
    // 内容は2列目のまま(読み上げ順・デスクトップの列順を変えない)。前へ出すのは CSS の order だけ
    expect(cells[1]?.classList.contains('tx-description')).toBe(true);
    expect(cells[1]?.getAttribute('data-label')).toBe('内容');
    expect(cells[0]?.getAttribute('data-label')).toBe('日付');
  });

  it('編集フォームの行は9列ぶんを1セルで占め、カード化しても操作を欠かさない', async () => {
    mockFetch([row()]);
    const { container } = renderPage();
    const trigger = await screen.findByRole('button', { name: '編集する' });
    trigger.click();
    await waitFor(() => {
      const editor = container.querySelector('tbody tr.editor > td');
      expect(editor?.getAttribute('colspan')).toBe(String(HEADERS.length));
    });
  });
});
