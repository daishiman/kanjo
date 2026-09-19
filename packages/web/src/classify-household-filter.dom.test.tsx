// @vitest-environment jsdom

/**
 * 家計収支画面から /classify?big=…、?hcat=other で来たときの表示 (SYS-HOUSEHOLD-P05)。
 *
 * 置換前の仕分け画面は big・hcat を読まず、同じ月の明細をすべて並べる。
 * 区分の判定は集計と同じ core の householdCategoryOfTx を使うので、事業側の「食費」は
 * 家計の食費に入らない。名義は保存した表示名で出す (未設定の行を含む)。
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

const SAVED_LABELS = { business: '事業主', spouse: '妻', family: '子', unset: '共通' };

/** 明細と名義の表示名を URL で分けて返す */
function mockFetch(transactions: TxRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/settings/owner-labels') ? { labels: SAVED_LABELS } : response(transactions);
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
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
  row({ id: 'A2', description: '架空弁当(事業)', cls: 'biz' }),
  row({ id: 'A3', description: '架空カフェ', big: '交際費', csvBig: '交際費' }),
  row({ id: 'A4', description: '架空電力', big: '水道・光熱費', csvBig: '水道・光熱費' }),
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('家計収支からの絞り込み', () => {
  it('big は個人側の大項目だけで絞り、事業側の同じ大項目は出さない', async () => {
    mockFetch(rows);
    renderAt('/classify?month=2026-07&big=%E9%A3%9F%E8%B2%BB');
    await screen.findByText(/家計収支から絞り込み中/);
    expect(shownDescriptions()).toEqual(['架空スーパー']);
    expect(screen.getByText(/家計収支から絞り込み中/).textContent).toContain('1件');
  });

  it('hcat=other は集計の「その他」と同じ行 (事業側の食費・対応表に無い大項目) を並べる', async () => {
    mockFetch(rows);
    renderAt('/classify?month=2026-07&hcat=other');
    await screen.findByText(/家計収支から絞り込み中: その他/);
    expect(shownDescriptions()).toEqual(['架空弁当(事業)', '架空カフェ']);
  });

  it('知らない hcat は絞り込みを出さず全件を並べる', async () => {
    mockFetch(rows);
    renderAt('/classify?month=2026-07&hcat=unknown');
    await waitFor(() => expect(shownDescriptions()).toHaveLength(4));
    expect(screen.queryByText(/家計収支から絞り込み中/)).toBeNull();
  });

  it('解除すると全件に戻る', async () => {
    mockFetch(rows);
    renderAt('/classify?month=2026-07&big=%E9%A3%9F%E8%B2%BB');
    await screen.findByText(/家計収支から絞り込み中/);
    fireEvent.click(screen.getByRole('button', { name: '絞り込みを解除' }));
    await waitFor(() => expect(shownDescriptions()).toHaveLength(4));
  });
});

describe('名義の表示名', () => {
  it('保存した表示名で名義を出す (未設定の行も固定の「未設定」ではなく表示名)', async () => {
    mockFetch([row({ id: 'A1', owner: null }), row({ id: 'A2', owner: 'spouse', description: '架空薬局' })]);
    renderAt('/classify?month=2026-07');
    // 一括操作の選択肢にも表示名が出るので、名義の欄だけを見る
    const ownerCells = () =>
      Array.from(document.querySelectorAll('td[data-label="名義"]')).map((cell) => cell.textContent);
    await waitFor(() => expect(ownerCells()).toEqual(['共通', expect.stringMatching(/^妻/)]));
  });
});
