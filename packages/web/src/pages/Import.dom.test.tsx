// @vitest-environment jsdom
/**
 * 取込結果の件数と対象月を、実際より良く見せない (旧 ImportResultTable の契約を新画面へ引き継ぐ)。
 *
 * - 取込成功の明細数は、検査の見込み (rowCount) ではなく確定応答が返した保存行数で数える
 * - 取り消しの対象月は、連続していれば範囲と月数、飛んでいれば月を並べる (間の月まで消えるように見せない)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportRunCommitResponse, ImportRunUndoPreflight } from '../api.js';
import { ImportPage } from './Import.js';
import {
  chooseImportFiles,
  createImportServer,
  csvFile,
  jsonResponse,
  runDetail,
  runRow,
} from './import/import-test-fakes.js';
import { importMonthsText } from './import/view-model.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(server: ReturnType<typeof createImportServer>, initialEntries = ['/']) {
  vi.stubGlobal('fetch', server.fetch);
  vi.stubGlobal('XMLHttpRequest', server.XMLHttpRequest);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ImportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const preflight = (months: string[]): ImportRunUndoPreflight => ({
  imports: [
    {
      importId: 41,
      fingerprint: 'fp-41',
      counts: { mfTx: 2, freeeDeals: 0, balanceEntries: 0, months: months.length },
      months,
    },
  ],
  counts: { mfTx: 2, freeeDeals: 0, balanceEntries: 0, months: months.length },
  months,
  undoRetentionDays: 30,
});

describe('取込結果の件数表示', () => {
  it('検査で 5 行と見込んでも、保存が 2 行なら取込成功には 2 件の明細と出す', async () => {
    const server = createImportServer({
      inspect: () => ({ source: 'freee', rowCount: 5 }),
      route: (method, path, init) => {
        if (method !== 'POST' || path !== '/api/imports/runs') return undefined;
        const { fileIds } = JSON.parse(String(init?.body)) as { fileIds: string[] };
        const response: ImportRunCommitResponse = {
          run: {
            id: 'run-1',
            result: 'success',
            files: [
              {
                id: fileIds[0],
                filename: 'anonymous-counts.csv',
                state: 'imported',
                rowCount: 2,
                reason: null,
              },
            ],
            impact: { added: 2, skipped: 3, subsCandidates: 0 },
            duplicateCandidates: 0,
          },
          remaining: [],
        };
        return jsonResponse(response, 201);
      },
    });
    mount(server);

    chooseImportFiles([csvFile('anonymous-counts.csv')]);
    const commit = await screen.findByRole('button', { name: '✓ 1ファイルを取り込む' });
    await waitFor(() => expect((commit as HTMLButtonElement).disabled).toBe(false));
    expect(within(screen.getByRole('region', { name: /取込内容の確認/ })).getByText('5件')).toBeTruthy();
    fireEvent.click(commit);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: '会計データに追加する' }),
    );

    await screen.findByText('1 件のファイルを正常に取り込みました');
    const result = screen.getByRole('region', { name: /取込結果/ });
    expect(within(result).getByText('2件の明細')).toBeTruthy();
    expect(within(result).queryByText('5件の明細')).toBeNull();
  });
});

describe('取り消しの対象月', () => {
  it('連続する月は範囲と月数にまとめ、飛んでいる月は並べて連続していないと書く', () => {
    expect(importMonthsText(['2026-03', '2026-01', '2026-02'])).toBe('2026/01/01 - 2026/03/31（3か月）');
    expect(importMonthsText(['2026-01', '2026-03'])).toBe('2026/01、2026/03（2か月・連続していません）');
    expect(importMonthsText(['2025-12', '2026-01'])).toBe('2025/12/01 - 2026/01/31（2か月）');
    expect(importMonthsText([])).toBe('なし');
  });

  it('取り消しの確認に、飛んでいる対象月を範囲に丸めずに出す', async () => {
    const row = runRow({ id: 'run-1' });
    const server = createImportServer({
      runs: [row],
      details: { 'run-1': runDetail(row) },
      route: (method, path) =>
        method === 'POST' && path === '/api/imports/runs/run-1/undo/preflight'
          ? jsonResponse(preflight(['2026-01', '2026-03']))
          : undefined,
    });
    mount(server);

    fireEvent.click(await screen.findByRole('button', { name: /の取込を取り消し$/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/2026\/01、2026\/03（2か月・連続していません）/)).toBeTruthy();
    expect(within(dialog).queryByText(/2026\/01\/01 - 2026\/03\/31/)).toBeNull();
  });
});
