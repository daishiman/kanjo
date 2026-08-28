// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { MatrixData } from './api.js';
import { MatrixPage } from './pages/Matrix.js';

vi.mock('react-chartjs-2', () => ({
  Chart: ({ 'aria-label': ariaLabel }: { 'aria-label'?: string }) => (
    <div role="img" aria-label={ariaLabel} />
  ),
}));

const data: MatrixData = {
  months: ['2026-07', '2026-08'],
  unrecordedExpMonths: [],
  years: ['2026'],
  rows: [
    {
      label: '広告宣伝費',
      isTotal: false,
      series: [10_000, 40_000],
      yearTotals: [{ year: '2026', total: 50_000 }],
      yoy: 0,
    },
    {
      label: '経費計',
      isTotal: true,
      series: [10_000, 40_000],
      yearTotals: [{ year: '2026', total: 50_000 }],
      yoy: 0,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('増減の要約図から、1行の科目見出しを持つ明細表へ照合できる', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MatrixPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByRole('img', { name: /広告宣伝費.*¥30,000/ })).toBeTruthy();
  expect(screen.getByRole('rowheader', { name: '広告宣伝費' })).toBeTruthy();
  expect(screen.getByText(/月別の数値だけ横にスクロール/)).toBeTruthy();
});
