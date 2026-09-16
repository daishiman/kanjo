// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TotalCashflowResponse } from './api.js';
import { TotalCashflowPage } from './pages/analysis/TotalCashflow.js';
import { PeriodProvider } from './period.js';

const totalCashflow: TotalCashflowResponse = {
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
      candidates: [
        {
          freeeIndex: 0,
          freeeKey: 'v1:freee:sample#0',
          date: '2026-08-02',
          partner: 'サンプル店',
          amount: 1_000,
          account: '食費',
          settleAccount: 'サンプルカード',
          dayGap: 1,
          accountConflict: false,
          score: 90,
        },
      ],
    },
  ],
  // 判定 mutation の入口は単一のワークベンチに集約している。
  // 本試験も実際の画面と同じ状態経路から保存操作を検証する。
  summary: null,
  series: [],
  workbench: {
    duplicates: [],
    needsReview: [],
    excluded: [],
    progress: {
      duplicates: { total: 0, decided: 0 },
      needsReview: { total: 0, decided: 0 },
      excluded: { total: 0, decided: 0 },
    },
  },
  autoMatches: [],
  lastOperation: null,
  period: { applied: null, label: '全期間', full: null, years: [], monthCount: 0 },
};

totalCashflow.workbench!.duplicates = totalCashflow.review;
totalCashflow.workbench!.progress.duplicates.total = totalCashflow.review.length;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('総収支の成功 mutation', () => {
  it('重複判断の保存後に分析ハブ・照合・月次クローズのキューを無効化する', async () => {
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
    // 照合の件数とクローズのキューは同じ判断の表を読む。総収支で判断しても古い件数を残さない
    client.setQueryData(['reconciliation', 'all'], { marker: 'reconciliation' });
    client.setQueryData(['review-queue'], { marker: 'queue' });
    render(
      <QueryClientProvider client={client}>
        <PeriodProvider>
          <TotalCashflowPage />
        </PeriodProvider>
      </QueryClientProvider>,
    );

    const [rowVerdictButton] = await screen.findAllByRole('button', { name: '同じ取引' });
    fireEvent.click(rowVerdictButton!);

    await waitFor(() =>
      expect(calls).toContainEqual({ url: '/api/total-cashflow/verdicts', method: 'POST' }),
    );
    await waitFor(() => {
      expect(client.getQueryState(['analysis-hub', 'all'])?.isInvalidated).toBe(true);
      expect(client.getQueryState(['analysis-hub', 'year=2026'])?.isInvalidated).toBe(true);
      expect(client.getQueryState(['reconciliation', 'all'])?.isInvalidated).toBe(true);
      expect(client.getQueryState(['review-queue'])?.isInvalidated).toBe(true);
    });
  });
});
