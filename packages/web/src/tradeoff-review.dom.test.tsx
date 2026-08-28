// @vitest-environment jsdom

/**
 * やりくり計画の翌月実績突合(FR-09)の表示契約。
 *
 * 「捻出できる見込み」を出しただけで終わらせないための列なので、
 * 結論(達成/一部/未達)と、その根拠になる対象月・実績・基準が
 * 同じ行に揃っていることを固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TradeoffResponse } from './api.js';
import { TradeoffPage } from './pages/Tradeoff.js';

type ReviewRow = TradeoffResponse['review'][number];

const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
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

const payload = (r: ReviewRow): TradeoffResponse =>
  ({
    candidates: [],
    budgets: [],
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
  }) as unknown as TradeoffResponse;

function renderWith(r: ReviewRow) {
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

describe('やりくり計画の翌月実績突合', () => {
  it('達成なら削減額と、その根拠(対象月の実績と基準)が並ぶ', async () => {
    renderWith(review());
    const cell = (await screen.findByText('達成')).closest('td') as HTMLElement;
    // yenS は減った側に符号を付けない(増えた月だけ − が付く)
    expect(cell.textContent).toContain('¥100,000');
    expect(cell.textContent).toContain('2026-04');
    expect(cell.textContent).toContain('¥200,000');
    expect(cell.textContent).toContain('基準 ¥300,000');
  });

  it('一部達成と未達は別の見え方にする', async () => {
    renderWith(review({ status: 'partial', reduced: 50000, rate: 0.5 }));
    expect((await screen.findByText('一部')).className).toContain('warn');
    cleanup();
    vi.unstubAllGlobals();
    renderWith(review({ status: 'missed', reduced: -80000, rate: -0.8 }));
    const cell = (await screen.findByText('未達')).closest('td') as HTMLElement;
    // 増えた月も符号つきでそのまま見せる
    expect(cell.textContent).toContain('−¥80,000');
  });

  it('対象月がまだ記帳されていなければ、判定せず待っていることを見せる', async () => {
    renderWith(review({ status: 'pending', actual: null, reduced: null, rate: null }));
    expect(await screen.findByText('2026-04 の記帳待ち')).toBeTruthy();
    expect(screen.queryByText('達成')).toBeNull();
  });
});
