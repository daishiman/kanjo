// @vitest-environment jsdom

/**
 * 受入A8「取込完了時に要確認が残っていれば画面へ警告が出る」の画面契約。
 *
 * 実装より先に書く赤いテスト (SYS-TCF-P04)。実装は SYS-TCF-P05 以降。
 * 受入とテストの対応表は `packages/core/test/total-cashflow-contract.test.ts` の冒頭にある。
 *
 * 異常への気付きはこの画面警告 1 経路だけに一本化されている (`qa-anomaly-notice-001`)。
 * メール・push・外部監視は無いため、ここが出ないと二重計上が誰にも見えないまま残る。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportPage } from '../src/pages/Import.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const month = (reviewCount: number) => ({
  month: '2026-08',
  totalIncome: 0,
  totalExpense: 8_300,
  totalBalance: -8_300,
  bizExpense: 3_300,
  householdExpense: 5_000,
  bizIncome: 0,
  householdIncome: 0,
  shiftedCount: 1,
  shiftedAmount: 3_300,
  reviewCount,
  reviewAmount: reviewCount * 1_000,
  trend: '判定不可' as const,
});

/** 取込 POST は成功し、トータル収支 GET が要確認件数を返す fetch */
const stub = (reviewCount: number) => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      calls.push(`${init?.method ?? 'GET'} ${path}`);
      if (init?.method === 'POST' && path.startsWith('/api/imports')) {
        return json({
          results: [
            {
              filename: '架空-2026-08.csv',
              kind: 'mf',
              months: ['2026-08'],
              rows: 3,
              skipped: 0,
              status: 'committed',
            },
          ],
        });
      }
      if (path.startsWith('/api/total-cashflow')) return json({ months: [month(reviewCount)], review: [] });
      return json({ imports: [] });
    }),
  );
  return calls;
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

async function uploadOne() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['収支区分,発生日\n'], '架空-2026-08.csv', { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  fireEvent.click(await screen.findByRole('button', { name: '取込を実行' }));
  // 確認はアプリ内 dialog。window.confirm はブラウザ抑止で無反応になるため通さない
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '置き換えて取り込む' }),
  );
  // 取込が完了して結果欄が出るところまで進める。ここが出ない状態で警告の有無を語らない
  await waitFor(() => expect(screen.getByText('取込完了')).toBeTruthy());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('受入A8 取込完了時に要確認が残っていれば警告が出る', () => {
  it('要確認が 2 件残っていれば、取込完了の直後に件数つきの警告を出す', async () => {
    stub(2);
    renderPage();
    await uploadOne();

    const notice = await screen.findByRole('alert', { name: '重複の要確認' });
    expect(notice.textContent).toContain('2');
    expect(notice.textContent).toContain('要確認');
  });

  it('警告から判断の入口へ行ける', async () => {
    stub(2);
    renderPage();
    await uploadOne();

    const notice = await screen.findByRole('alert', { name: '重複の要確認' });
    const link = notice.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('total-cashflow');
  });

  // 「出ない」だけを見る検査は、警告そのものが存在しない実装でも緑になる。
  // 出る側と出ない側を同じ it の中で対にして、片側だけで緑にならないようにする。
  it('要確認が 0 件なら警告を出さず、2 件なら出す', async () => {
    stub(0);
    renderPage();
    await uploadOne();
    expect(screen.queryByRole('alert', { name: '重複の要確認' })).toBeNull();

    cleanup();
    vi.unstubAllGlobals();
    stub(2);
    renderPage();
    await uploadOne();
    expect(await screen.findByRole('alert', { name: '重複の要確認' })).toBeTruthy();
  });

  it('取込を実行する前は警告を出さず、実行して初めて出る', async () => {
    stub(2);
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'ファイルを選ぶ' })).toBeTruthy());
    expect(screen.queryByRole('alert', { name: '重複の要確認' })).toBeNull();

    await uploadOne();
    expect(await screen.findByRole('alert', { name: '重複の要確認' })).toBeTruthy();
  });
});
