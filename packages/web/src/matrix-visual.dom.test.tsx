// @vitest-environment jsdom
//
// α(偏りが見えても明細に降りられない)を塞ぐ回路のテスト。
// 「偏りが大きい 3 点」で名指しされた科目と月が、下の月次明細表に**同じ語で**
// 実在することまで確かめる。片方だけ表記が変わると照合の手掛かりが切れる。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { MatrixData } from './api.js';
import { MatrixPage } from './pages/analysis/matrix/MatrixPage.js';

const data: MatrixData = {
  months: ['2026-06', '2026-07', '2026-08'],
  unrecordedExpMonths: [],
  years: ['2026'],
  rows: [
    {
      label: '広告宣伝費',
      isTotal: false,
      series: [10_000, 10_000, 240_000],
      yearTotals: [{ year: '2026', total: 260_000 }],
      yoy: 0,
    },
    {
      label: '通信費',
      isTotal: false,
      series: [40_000, 41_000, 39_000],
      yearTotals: [{ year: '2026', total: 120_000 }],
      yoy: 0,
    },
    {
      label: '経費計',
      isTotal: true,
      series: [50_000, 51_000, 279_000],
      yearTotals: [{ year: '2026', total: 380_000 }],
      yoy: 0,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('偏りが大きい点で名指しされた科目と月へ、下の月次明細表から降りられる', async () => {
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

  const skew = await screen.findByRole('table', { name: /偏りが大きい/ });
  // 1 位は広告宣伝費 2026-08。通信費は 3 か月ほぼ横ばいなので上には来ない
  const top = within(skew).getByRole('rowheader', { name: '1' }).parentElement;
  expect(within(top as HTMLElement).getByText('広告宣伝費')).toBeTruthy();
  expect(within(top as HTMLElement).getByText('2026年8月')).toBeTruthy();
  // 金額は万円。前月比は 1.0万 → 24.0万 で +2300%
  expect(within(top as HTMLElement).getByText('24.0万')).toBeTruthy();
  expect(top?.querySelector('td.pos')?.textContent).toBe('+2300.0%');

  // 同じ科目と月が明細表にあり、そこから降りられる
  const monthly = screen.getByRole('table', { name: /科目別の月次明細/ });
  expect(within(monthly).getByRole('rowheader', { name: '広告宣伝費' })).toBeTruthy();
  expect(within(monthly).getByRole('columnheader', { name: '2026/08' })).toBeTruthy();
  expect(screen.getByText(/月別の数値だけ横にスクロール/)).toBeTruthy();
});
