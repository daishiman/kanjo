// @vitest-environment jsdom

/**
 * 未保存のまま編集から離れようとしたときのガード。
 *
 * 確認はアプリ内の <dialog> で出す。window.confirm はブラウザの「このページでこれ以上
 * ダイアログを表示しない」が効くと即 false を返し、呼び出し側に抑止を知る手立てが無い。
 * その状態では絞り込みを押しても何も起きず、理由も画面に出ない。
 * 同期的に答えを受け取れなくなった代わりに、押した操作を預けて確認の後に実行する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionsResponse, TxRow } from './api.js';
import { ClassifyPage } from './pages/Classify.js';

const row = (): TxRow => ({
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
  attachmentCount: 0,
  edit: null,
  rowKey: 'mf:A1',
  rowKind: 'mf',
  parentTxId: null,
  lineId: null,
  splitSeq: null,
  splitLineCount: null,
  splitState: null,
  capabilities: { quickClass: true, edit: true, split: true, attach: true },
  attachmentTargetId: 'A1',
});

const response = (): TransactionsResponse => ({
  months: ['2026-07'],
  month: '2026-07',
  summary: {
    month: '2026-07',
    count: 1,
    totalIncome: 0,
    bizIncome: 0,
    personalIncome: 0,
    totalExpense: 1000,
    bizExpense: 0,
    personalExpense: 1000,
    incomeByOwner: { business: 0, spouse: 0, family: 0, unset: 0 },
    progress: {
      total: 1,
      bizCount: 0,
      personalCount: 1,
      bySource: { 手動: 0, ルール: 0, 既定: 1 },
      reviewPending: 1,
    },
    editedCount: 0,
    conflictCount: 0,
    noInstitutionCount: 0,
    nonCountableCount: 0,
  },
  transactions: [row()],
  candidates: { biz: [], per: [] } as unknown as TransactionsResponse['candidates'],
  institutions: ['架空銀行'],
});

const requestedPaths: string[] = [];

function renderPage() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      requestedPaths.push(path);
      const body = path.startsWith('/api/attachments') ? { attachments: [] } : response();
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClassifyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 編集を開き、公私を変えて未保存の状態にする */
async function openDirtyEditor() {
  fireEvent.click(await screen.findByRole('button', { name: '編集する' }));
  fireEvent.change(await screen.findByLabelText('公私'), { target: { value: 'biz' } });
}

const paymentFilter = (name: string) =>
  within(screen.getByRole('button', { name: '支払: すべて' }).parentElement as HTMLElement).getByRole(
    'button',
    { name },
  );

beforeEach(() => {
  requestedPaths.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('未保存の編集を離れるときの確認', () => {
  it('絞り込みを押すと画面の中で確認し、window.confirm は通さない', async () => {
    const confirm = vi.fn(() => false);
    renderPage();
    vi.stubGlobal('confirm', confirm);
    await openDirtyEditor();

    fireEvent.click(paymentFilter('現金'));
    expect(confirm).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    // 何を失うのかが確認の中で読める
    expect(dialog.textContent).toContain('保存されずに消えます');
    // 答えが出るまで絞り込みは動かない
    expect(requestedPaths.some((p) => p.includes('method=cash'))).toBe(false);
  });

  it('やめるを押すと編集に戻り、絞り込みは動かない', async () => {
    renderPage();
    await openDirtyEditor();
    fireEvent.click(paymentFilter('現金'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'やめる' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(requestedPaths.some((p) => p.includes('method=cash'))).toBe(false);
    // 編集は開いたまま。閉じてしまうと、破棄しない選択が破棄と同じ結果になる
    expect(screen.getByRole('region', { name: '架空スーパー' })).toBeTruthy();
  });

  it('破棄して移るを押すと、押した絞り込みがそのまま適用される', async () => {
    renderPage();
    await openDirtyEditor();
    fireEvent.click(paymentFilter('現金'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '破棄して移る' }));
    // 確認のあとで押した操作が実行される(押し直させない)
    await waitFor(() => expect(requestedPaths.some((p) => p.includes('method=cash'))).toBe(true));
    await waitFor(() => expect(screen.queryByRole('region', { name: '架空スーパー' })).toBeNull());
  });
});
