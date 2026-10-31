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
import {
  chooseImportFiles,
  createImportServer,
  csvFile,
  jsonResponse,
} from '../src/pages/import/import-test-fakes.js';

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

/** 検査と確定は成功し、トータル収支 GET が要確認件数を返す偽サーバ */
const stub = (reviewCount: number) => {
  const server = createImportServer({
    // freee の取込後に出る要確認件数の導線だけを検証する。
    inspect: () => ({ source: 'freee', periodFrom: '2026-08', periodTo: '2026-08' }),
    route: (method, path) =>
      method === 'GET' && path.startsWith('/api/total-cashflow')
        ? jsonResponse({ months: [month(reviewCount)], review: [] })
        : undefined,
  });
  vi.stubGlobal('fetch', vi.fn(server.fetch));
  vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest);
  return server.calls;
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
  chooseImportFiles([csvFile('架空-2026-08.csv')]);
  const commit = await screen.findByRole('button', { name: '✓ 1ファイルを取り込む' });
  await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(commit);
  // 確認はアプリ内 dialog。window.confirm はブラウザ抑止で無反応になるため通さない
  fireEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
  );
  // 取込が完了して結果欄が出るところまで進める。ここが出ない状態で警告の有無を語らない
  await screen.findByText('1 件のファイルを正常に取り込みました');
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

    await waitFor(() => expect(screen.getByRole('button', { name: 'ファイルを選択' })).toBeTruthy());
    expect(screen.queryByRole('alert', { name: '重複の要確認' })).toBeNull();

    await uploadOne();
    expect(await screen.findByRole('alert', { name: '重複の要確認' })).toBeTruthy();
  });
});
