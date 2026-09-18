// @vitest-environment jsdom
//
// 増減マトリクスは色分けが読み取りの中核。凡例が消えると「増=赤」が伝わらず、
// 一般的な「赤=悪」と取り違えられる。凡例の見本と実際のセルの色クラスが
// 一致していること(凡例が嘘をつかないこと)まで確かめる。

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import type { MatrixData } from './api.js';
import { MatrixPage } from './pages/analysis/matrix/MatrixPage.js';

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
  return await screen.findByRole('table', { name: /科目別の月次明細/ });
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
  const table = await renderMatrix();

  const legend = screen.getByText(/色の凡例/).closest('p');
  const up = legend?.querySelector('.pos');
  const down = legend?.querySelector('.neg');
  // 見本は「増加=pos(赤) / 減少=neg(緑)」
  expect(up?.textContent).toBe('+12.3%');
  expect(down?.textContent).toBe('-12.3%');

  // 色が付くのは率のモードだけ。金額のモードは濃淡で表すので色クラスを持たない
  expect(table.querySelectorAll('td.pos, td.neg').length).toBe(0);
  // 偏り表にも「前月比」列のソートボタンがあるので、押された状態を持つ切替の方を選ぶ
  fireEvent.click(screen.getByRole('button', { name: '前月比', pressed: false }));

  const rates = await screen.findByRole('table', { name: /科目別の月次明細/ });
  // 広告宣伝費は 1.0万 → 4.0万 で +300%、通信費は 4.0万 → 1.0万 で -75%
  const upRow = within(rates).getByRole('rowheader', { name: '広告宣伝費' }).parentElement;
  expect(upRow?.querySelector('td.pos')?.textContent).toBe('+300.0%');
  const downRow = within(rates).getByRole('rowheader', { name: '通信費' }).parentElement;
  expect(downRow?.querySelector('td.neg')?.textContent).toBe('-75.0%');
});
