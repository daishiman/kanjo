// @vitest-environment jsdom

/**
 * トレードオフ画面に翌月実績の突合を出さないことの契約 (FR-14、qa-tradeoff-decision-004)。
 *
 * このファイルは元々「突合の結論 (達成/一部/未達) と根拠が同じ行に揃う」ことを固定していた。
 * 作り直しで突合は画面から外すと利用者が決めたため、消さずに意図を置き換える:
 * 旧 API の形 (plans / review) を返されても、画面が保存一覧と突合を描かないことを確かめる。
 * 突合の数字そのものの契約は core の `tradeoffReview` のテストが持ち続ける。
 */
import type { TradeoffReviewRow } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TradeoffPage } from './pages/Tradeoff.js';

const review = (over: Partial<TradeoffReviewRow> = {}): TradeoffReviewRow => ({
  id: 1,
  title: '来月の資金繰り',
  amount: 100000,
  covered: 100000,
  planMonth: '2026-03',
  targetMonth: '2026-04',
  baseline: 300000,
  actual: 200000,
  reduced: 100000,
  rate: 1,
  status: 'achieved',
  ...over,
});

/** 新しい応答に、旧応答の plans / review が紛れ込んだ場合 */
const payload = (r: TradeoffReviewRow) => ({
  candidates: [],
  defense: { monthlyMargin: null, status: 'nodata' },
  latest: null,
  plans: [
    {
      id: 1,
      title: '来月の資金繰り',
      amount: 100000,
      recurring: false,
      selected: [{ label: '広告宣伝費 を予算内に戻す', value: 100000 }],
      covered: 100000,
      verdict: 'covered',
      createdAt: '2026-03-15T00:00:00.000Z',
    },
  ],
  review: [r],
});

function renderWith(r: TradeoffReviewRow) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(payload(r)), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TradeoffPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('翌月実績の突合を画面に出さない', () => {
  it.each([
    ['達成', review()],
    ['一部', review({ actual: 250000, reduced: 50000, rate: 0.5, status: 'partial' })],
    ['未達', review({ actual: 320000, reduced: -20000, rate: 0, status: 'missed' })],
    ['記帳待ち', review({ actual: null, reduced: null, rate: null, status: 'pending' })],
  ])('%s の突合行があっても結論と根拠を描かない', async (_label, r) => {
    renderWith(r);
    await screen.findByRole('heading', { name: /見直し候補の選択/ });
    expect(screen.queryByText(/達成|一部達成|未達|記帳待ち/)).toBeNull();
    expect(screen.queryByText(/2026-04|2026年4月/)).toBeNull();
  });

  it('保存済み試算の一覧 (旧 plans) を描かない', async () => {
    renderWith(review());
    await screen.findByRole('heading', { name: /見直し候補の選択/ });
    expect(screen.queryByText('来月の資金繰り')).toBeNull();
    expect(screen.queryByText('広告宣伝費 を予算内に戻す')).toBeNull();
  });
});
