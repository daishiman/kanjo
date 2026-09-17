// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedApp } from './AuthenticatedApp.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

vi.mock('./pages/analysis/Reconciliation.js', () => ({
  ReconciliationPage: () => <p>照合詳細パネル</p>,
}));

vi.mock('./pages/analysis/matrix/MatrixPage.js', () => ({
  MatrixPage: () => <p>マトリックス詳細パネル</p>,
}));

const period = {
  applied: { from: '2026-08', to: '2026-08' },
  label: '2026年8月',
  full: { from: '2026-01', to: '2026-08' },
  years: ['2026'],
  monthCount: 1,
};

const hub = {
  period,
  summary: {
    income: 500_000,
    expense: 320_000,
    net: 180_000,
    previous: null,
    change: null,
  },
  views: {
    reconciliation: {
      id: 'reconciliation',
      priority: '中',
      count: 0,
      actionRequiredCount: 0,
      reviewCount: 0,
    },
    'total-cashflow': { id: 'total-cashflow', priority: '中', count: 0, reviewCount: 0 },
    matrix: { id: 'matrix', priority: '中', count: 0, unrecordedMonths: 0, normal: true },
    trends: { id: 'trends', priority: '中', count: 0, expenseChange: null },
    diagnosis: { id: 'diagnosis', priority: '中', count: 0, annualSavings: 0, candidateCount: 0 },
  },
};

// 全suiteでは別ファイルのtransform後にlazy importが1秒を超えることがある。
// UI契約の上限はvite.configの30秒より十分短い5秒に固定し、CPU速度を判定対象にしない。
const LAZY_WAIT = { timeout: 5_000 };

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

function renderApp(path: string) {
  window.history.replaceState({}, '', path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AuthenticatedApp />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  localStorage.clear();
  document.title = '';
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/analysis/hub')) return response(hub);
      if (url.startsWith('/api/summary')) {
        return response({
          overview: { months: ['2026-08'], unrecordedExpMonths: [] },
          defense: { status: 'safe', line: 400_000, incomeEstimate: 500_000 },
          benchmarks: [],
          period,
        });
      }
      if (url.startsWith('/api/imports')) return response({ imports: [] });
      return response({});
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('認証後シェルの支出分析遷移', () => {
  it('主要 CTA から lazy 詳細へ PUSH し、戻る/進むでハブと詳細を復元する', async () => {
    renderApp('/analysis');
    expect(
      await screen.findByRole('heading', { name: '支出のどこから確認しますか？' }, LAZY_WAIT),
    ).toBeTruthy();
    await waitFor(() => expect(document.title).toBe('支出分析 | Focus Ledger'));
    expect(window.scrollTo).not.toHaveBeenCalled();

    const action = screen.getByRole('region', { name: '選択中の分析の操作' });
    fireEvent.click(within(action).getByRole('link', { name: '照合を開く' }));

    expect(await screen.findByText('照合詳細パネル', {}, LAZY_WAIT)).toBeTruthy();
    expect(window.location.pathname).toBe('/analysis/reconciliation');
    await waitFor(() => expect(document.title).toBe('照合 | 支出分析 | Focus Ledger'));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('帳簿と口座の差異を、どこから解消しますか？'),
    );

    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/analysis'));
    expect(
      await screen.findByRole('heading', { name: '支出のどこから確認しますか？' }, LAZY_WAIT),
    ).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement?.textContent).toBe('支出のどこから確認しますか？'));

    act(() => window.history.forward());
    await waitFor(() => expect(window.location.pathname).toBe('/analysis/reconciliation'));
    expect(await screen.findByText('照合詳細パネル', {}, LAZY_WAIT)).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('詳細の deep link をリロード相当で直接描画する', async () => {
    renderApp('/analysis/matrix');

    expect(await screen.findByText('マトリックス詳細パネル', {}, LAZY_WAIT)).toBeTruthy();
    expect(window.location.pathname).toBe('/analysis/matrix');
    await waitFor(() => expect(document.title).toBe('マトリックス | 支出分析 | Focus Ledger'));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
