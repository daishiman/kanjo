// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TotalCashflowPage } from './pages/analysis/TotalCashflow.js';
import { PeriodProvider } from './period.js';

const totalCashflow = {
  months: [],
  matched: [],
  freeeOnly: [],
  excluded: [],
  coverage: { freeeTotal: 0, matched: 0, freeeOnly: 0, excluded: 0, mfReview: 1 },
  review: [
    {
      txId: 'mf-1',
      reason: '発生日が一致しません',
      mf: {
        date: '2026-08-01',
        displayDate: '08/01',
        content: 'サンプル店',
        amount: 1_000,
        io: 'expense',
        institution: 'サンプルカード',
        major: '食費',
        middle: '外食',
        memo: '',
        cls: 'per',
        clsSrc: '既定',
      },
      candidates: [],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('総収支の成功 mutation', () => {
  it('重複判断の保存後に分析ハブの全期間キャッシュを無効化する', async () => {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        calls.push({ url, method });
        const body = method === 'POST' ? { ok: true } : totalCashflow;
        return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
      }),
    );

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['analysis-hub', 'all'], { marker: 'all' });
    client.setQueryData(['analysis-hub', 'year=2026'], { marker: 'year' });
    render(
      <QueryClientProvider client={client}>
        <PeriodProvider>
          <TotalCashflowPage />
        </PeriodProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '同じ取引' }));

    await waitFor(() =>
      expect(calls).toContainEqual({ url: '/api/total-cashflow/verdicts', method: 'POST' }),
    );
    await waitFor(() => {
      expect(client.getQueryState(['analysis-hub', 'all'])?.isInvalidated).toBe(true);
      expect(client.getQueryState(['analysis-hub', 'year=2026'])?.isInvalidated).toBe(true);
    });
  });
});
