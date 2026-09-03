// @vitest-environment jsdom
//
// 増減マトリクスは色分けが読み取りの中核。凡例が消えると「増=赤」が伝わらず、
// 一般的な「赤=悪」と取り違えられる。凡例の見本と実際のセルの色クラスが
// 一致していること(凡例が嘘をつかないこと)まで確かめる。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { MatrixData } from './api.js';
import { MatrixPage } from './pages/analysis/Matrix.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).AccessibleChart,
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
      yoy: 0.25,
    },
    {
      label: '通信費',
      isTotal: false,
      series: [40_000, 10_000],
      yearTotals: [{ year: '2026', total: 50_000 }],
      yoy: -0.25,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderMatrix() {
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
  const table = await screen.findByRole('table', { name: /科目別の月次増減明細/ });
  return within(table).getByRole('rowheader', { name: '広告宣伝費' });
}

it('色凡例が初期表示で見えていて、色以外の手掛かり(符号と語)を伴う', async () => {
  await renderMatrix();

  const legend = screen.getByText(/色の凡例/).closest('p');
  expect(legend).toBeTruthy();
  const text = legend?.textContent ?? '';
  expect(text).toMatch(/先頭がプラスで赤.*増えた/);
  expect(text).toMatch(/先頭がマイナスで緑.*減った/);
  expect(text).toContain('未記帳');
});

it('凡例の見本の色クラスが、表のセルに実際に付く色クラスと一致する', async () => {
  const head = await renderMatrix();

  const legend = screen.getByText(/色の凡例/).closest('p');
  const up = legend?.querySelector('.pos');
  const down = legend?.querySelector('.neg');
  // 見本は「増加=pos(赤) / 減少=neg(緑)」
  expect(up?.textContent).toBe('+12.3%');
  expect(down?.textContent).toBe('-12.3%');

  // 実データ: 増えた科目の前年比セルは pos、減った科目は neg
  const upCell = head.parentElement?.querySelector('td.pos');
  expect(upCell?.textContent).toBe('+25.0%');
  const monthlyTable = screen.getByRole('table', { name: /科目別の月次増減明細/ });
  const downRow = within(monthlyTable).getByRole('rowheader', { name: '通信費' }).parentElement;
  expect(downRow?.querySelector('td.neg')?.textContent).toBe('-25.0%');
});
