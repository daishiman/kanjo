// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BusinessSpendResponse } from './api.js';
import { ReconciliationPage } from './pages/analysis/Reconciliation.js';

const response: BusinessSpendResponse = {
  summary: { booked: 10_000, unbooked: 3_300, effective: 13_300, matchedCount: 1, reviewCount: 1 },
  months: [{ month: '2026-08', booked: 10_000, unbooked: 3_300, effective: 13_300 }],
  unbooked: [
    {
      id: 'anonymous-mf-1',
      month: '2026-08',
      date: '2026-08-05',
      amount: 3_300,
      party: '架空クラウド',
      category: '通信費',
    },
  ],
  review: [
    {
      mf: {
        id: 'anonymous-mf-2',
        month: '2026-08',
        date: '2026-08-06',
        amount: 1_200,
        party: '架空動画A',
        purpose: 'personal',
      },
      freee: {
        date: '2026-08-06',
        amount: 1_200,
        party: '架空動画B',
        purpose: 'personal',
      },
      candidateCount: 1,
      reason: '支払先が一致しません',
    },
  ],
  period: {
    applied: null,
    label: '全期間',
    full: { from: '2026-08', to: '2026-08' },
    years: ['2026'],
    monthCount: 1,
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(payload: BusinessSpendResponse = response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReconciliationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('支出照合画面', () => {
  it('帳簿確定・未記帳・実質支出を別々の数字と月別表で示す', async () => {
    renderPage();

    const summary = await screen.findByLabelText('支出照合の合計');
    expect(summary.textContent).toContain('帳簿確定');
    expect(summary.textContent).toContain('未記帳');
    expect(summary.textContent).toContain('実質支出');
    expect(summary.textContent).toContain('重複 1件を1度だけ計上');

    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['月', '帳簿確定', '未記帳', '実質支出']);
  });

  it('曖昧一致を自動統合せず理由と修正導線を示す', async () => {
    renderPage({
      ...response,
      summary: { ...response.summary, unbooked: 0 },
      unbooked: [],
    });

    const disclosure = (await screen.findByText('自動照合しなかった候補 1件')).closest('details');
    expect(disclosure).toBeTruthy();
    disclosure?.setAttribute('open', '');
    expect(within(disclosure as HTMLElement).getByText('支払先が一致しません')).toBeTruthy();
    expect(
      within(disclosure as HTMLElement)
        .getByRole('link', { name: '公私を確認する' })
        .getAttribute('href'),
    ).toBe('/classify?month=2026-08');
    expect(screen.getByRole('link', { name: '照合候補を見る' }).getAttribute('href')).toBe(
      '#reconciliation-review',
    );
  });

  it('個別明細と取込単位の安全な削除入口を既存画面へ集約する', async () => {
    renderPage();
    await screen.findByText('月別の帳簿と実態');

    expect(screen.getByRole('link', { name: '公私仕分け' }).getAttribute('href')).toBe('/classify');
    expect(screen.getByRole('link', { name: 'データ取込履歴' }).getAttribute('href')).toBe(
      '/import#import-history',
    );
    expect(screen.getByText(/30日間のundo付き/)).toBeTruthy();
  });
});
