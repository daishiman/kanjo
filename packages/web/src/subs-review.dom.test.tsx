// @vitest-environment jsdom

/**
 * サブスクの四半期見直し導線の表示契約。
 *
 * サブスクの無駄は金額の異常では拾えず「解約し忘れ」で出るので、
 * 最後に見直してからの経過が一覧の中に出ていること、
 * 「見直した」が集計を触らない記録として送られることを固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubVendorsPanel } from './components/SubVendors.js';

const vendors = [
  { id: 1, name: 'note株式会社', aliases: [], accounts: [] },
  { id: 2, name: 'Adobe', aliases: [], accounts: [] },
];

function renderWith(review: { id: number; monthsSince: number | null; due: boolean }[]) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const body =
        url.endsWith('/api/sub-vendors') && (init?.method ?? 'GET') === 'GET'
          ? {
              vendors,
              accountOptions: [],
              review: review.map((r) => ({ ...r, name: '', reviewedAt: null })),
            }
          : { ok: true };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <SubVendorsPanel />
    </QueryClientProvider>,
  );
  return { ...view, calls };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('サブスクの四半期見直し', () => {
  it('見直し待ちの件数と、その理由が一覧の手前に出る', async () => {
    renderWith([
      { id: 1, monthsSince: null, due: true },
      { id: 2, monthsSince: 1, due: false },
    ]);
    expect(await screen.findByText('見直し待ちが 1件')).toBeTruthy();
    expect(screen.getByText(/解約し忘れ/)).toBeTruthy();
  });

  it('一度も見直していない登録は月数ではなく「未確認」と言い切る', async () => {
    renderWith([
      { id: 1, monthsSince: null, due: true },
      { id: 2, monthsSince: 4, due: true },
    ]);
    expect((await screen.findByText('未確認')).className).toContain('warn');
    expect(screen.getByText('4ヶ月前').className).toContain('warn');
  });

  it('期限内は落ち着いた見え方にする(催促を出しすぎない)', async () => {
    renderWith([
      { id: 1, monthsSince: 0, due: false },
      { id: 2, monthsSince: 2, due: false },
    ]);
    expect((await screen.findByText('今月')).className).toContain('calm');
    expect(screen.queryByText(/見直し待ちが/)).toBeNull();
  });

  it('「見直した」は記録だけを送る(登録内容は変えないので PUT しない)', async () => {
    const { calls } = renderWith([{ id: 1, monthsSince: null, due: true }]);
    fireEvent.click(await screen.findByRole('button', { name: 'note株式会社を見直した' }));
    await waitFor(() => expect(calls).toContain('POST /api/sub-vendors/1/review'));
    expect(calls.some((c) => c.startsWith('PUT '))).toBe(false);
  });
});
