// @vitest-environment jsdom

/**
 * 受入A7「一覧表の 9 列すべてが常時表示される」の画面契約。
 *
 * 実装より先に書く赤いテスト (SYS-TCF-P04)。実装は SYS-TCF-P05 以降。
 * 受入とテストの対応表は `packages/core/test/total-cashflow-contract.test.ts` の冒頭にある。
 *
 * CI の headless Chrome は `pointer: none` である。表示条件を `@media (pointer: fine)` へ
 * 依存させないため、ここでは列の増減をポインタ種別に紐付けた検査を書かない。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TotalCashflowPage, TotalCashflowTable } from '../src/pages/analysis/TotalCashflow.js';

/** 一覧表の列見出し。9 列で確定しており、小画面でも落とさない */
const COLUMNS = [
  '月',
  '総収入',
  '総支出',
  '総収支',
  '事業費',
  '家計費',
  '事業費へ寄せた件数',
  '要確認件数',
  'トレンド',
];

const row = (over: Record<string, unknown> = {}) => ({
  month: '2026-08',
  totalIncome: 250_000,
  totalExpense: 8_300,
  totalBalance: 241_700,
  bizExpense: 3_300,
  householdExpense: 5_000,
  bizIncome: 200_000,
  householdIncome: 50_000,
  shiftedCount: 1,
  shiftedAmount: 3_300,
  reviewCount: 0,
  trend: '判定不可' as const,
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function wrap(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('受入A7 一覧表の 9 列が常時表示される', () => {
  it('見出しが 9 列ちょうどで、順序も固定である', async () => {
    render(<TotalCashflowTable rows={[row()]} />);

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(9);
    expect(headers.map((cell) => cell.textContent)).toEqual(COLUMNS);
  });

  it('行が 1 件でも 3 件でも列は 9 のままで、行ごとのセルも 9 個ある', async () => {
    const { rerender } = render(<TotalCashflowTable rows={[row()]} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);

    rerender(
      <TotalCashflowTable
        rows={[row({ month: '2026-06' }), row({ month: '2026-07' }), row({ month: '2026-08' })]}
      />,
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);

    const bodyRows = screen.getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0);
    expect(bodyRows).toHaveLength(3);
    for (const bodyRow of bodyRows) {
      expect(within(bodyRow).getAllByRole('cell')).toHaveLength(9);
    }
  });

  it('表を横スクロール領域に収め、列を落とす分岐を持たない', async () => {
    const { container } = render(<TotalCashflowTable rows={[row()]} />);
    const table = screen.getByRole('table');
    expect(table.closest('[data-total-cashflow-scroll]')).not.toBeNull();
    // 列を隠すための hidden 属性が 1 つも無いこと
    expect(container.querySelectorAll('th[hidden], td[hidden]')).toHaveLength(0);
  });

  it('記帳月数が足りない期間ではトレンド列に「判定不可」を明示し、空欄にしない', async () => {
    render(<TotalCashflowTable rows={[row({ trend: '判定不可' })]} />);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(9);
    expect(cells[8]!.textContent).toBe('判定不可');
  });

  it('サーバ導出値をそのまま写し、画面側で合計を計算し直さない', async () => {
    // 総収支がサーバ側の値と食い違っていても、画面は自分で計算し直さない。
    // ここが再計算されると、どちらが正しいかを利用者が判断できなくなる。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ months: [row({ totalBalance: 999 })], review: [] })),
    );
    wrap(<TotalCashflowPage />);

    expect(await screen.findByText('999')).toBeTruthy();
    expect(screen.queryByText('241,700')).toBeNull();
  });
});

describe('受入F3 寄せた件数と金額を同じセルに併記する', () => {
  it('件数だけでなく金額も出す', () => {
    render(<TotalCashflowTable rows={[row({ shiftedCount: 3, shiftedAmount: 300_000 })]} />);
    // 件数だけの実装だと「3」で通ってしまうので、金額まで含めた文字列で固定する
    expect(screen.getAllByRole('cell')[6]!.textContent).toBe('3 件 / 300,000');
  });

  it('金額を併記しても列は 9 のままである', () => {
    render(<TotalCashflowTable rows={[row({ shiftedCount: 3, shiftedAmount: 300_000 })]} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(9);
    expect(screen.getAllByRole('cell')).toHaveLength(9);
  });

  it('寄せが 0 件の月は 0 件 / 0 と書き、空欄にしない', () => {
    // 空欄だと「寄らなかった」と「まだ照合していない」が同じ見た目になる
    render(<TotalCashflowTable rows={[row({ shiftedCount: 0, shiftedAmount: 0 })]} />);
    expect(screen.getAllByRole('cell')[6]!.textContent).toBe('0 件 / 0');
  });
});

describe('受入F4 重複候補は理由付きで列挙され、0 件のときは 0 件と明示される', () => {
  const review = [
    { txId: 'mf-near', reason: '発生日が一致しません' },
    { txId: 'mf-inst', reason: '口座不一致' },
  ];

  it('候補があれば件数と理由をそれぞれ出す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ months: [row({ reviewCount: 2 })], review })),
    );
    wrap(<TotalCashflowPage />);

    const section = await screen.findByRole('region', { name: '重複の要確認' });
    expect(within(section).getByRole('heading').textContent).toBe('要確認 2 件');

    // 理由は候補ごとに出す。まとめて 1 つにすると、どれがなぜ残ったか分からない
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items.map((li) => li.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('発生日が一致しません'),
        expect.stringContaining('口座不一致'),
      ]),
    );
  });

  it('候補が 0 件でも節ごと消さず、0 件であることを文字で明示する', async () => {
    // 節ごと消すと「0 件だった」と「まだ数えていない」が画面上で同じ見た目になる。
    // 空欄ではなく語で断ることが受入の要求。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ months: [row({ reviewCount: 0 })], review: [] })),
    );
    wrap(<TotalCashflowPage />);

    const section = await screen.findByRole('region', { name: '重複の要確認' });
    expect(within(section).getByRole('heading').textContent).toBe('要確認 0 件');
    expect(within(section).getByText('機械では決められない重複はありません。')).toBeTruthy();
    expect(within(section).queryAllByRole('listitem')).toHaveLength(0);
  });
});
