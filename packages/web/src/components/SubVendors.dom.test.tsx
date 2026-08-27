// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubVendorsPanel, SubsCandidatesPanel } from './SubVendors.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function withQueryClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const candidate = {
  partner: '架空家賃',
  activeMonths: 2,
  spanMonths: 2,
  count: 2,
  total: 160000,
  avgMonthly: 80000,
  cv: 0,
  accounts: ['地代家賃'],
  lastMonth: '2026-02',
  score: 80,
  reasons: ['2ヶ月中2ヶ月に支払', '毎回ほぼ同額'],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('登録支払先の対象科目', () => {
  it('対象科目を編集して保存すると accounts つきで PUT する', async () => {
    const puts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          puts.push(JSON.parse(String(init.body)));
          return json({ ok: true });
        }
        return json({
          vendors: [{ id: 7, name: '架空モール', aliases: [], accounts: [] }],
          accountOptions: ['サブスク・通信', '消耗品費'],
        });
      }),
    );
    withQueryClient(<SubVendorsPanel />);

    const input = await screen.findByLabelText('架空モールの対象科目を追加');
    fireEvent.change(input, { target: { value: 'サブスク・通信' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ name: '架空モール', aliases: [], accounts: ['サブスク・通信'] });
  });
});

describe('候補一覧の「サブスクではない」', () => {
  const stub = (excluded: { id: number; partner: string }[], calls: string[]) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method && init.method !== 'GET') {
          calls.push(`${init.method} ${url}`);
          return json({ ok: true });
        }
        return json({
          candidates: excluded.length ? [] : [candidate],
          excluded,
          dealRows: 2,
        });
      }),
    );

  it('候補行のボタンから除外を記録する', async () => {
    const calls: string[] = [];
    stub([], calls);
    withQueryClient(<SubsCandidatesPanel hasDeals />);

    fireEvent.click(await screen.findByRole('button', { name: 'サブスクではない' }));
    await waitFor(() => expect(calls).toEqual(['POST /api/sub-vendors/exclusions']));
  });

  it('除外済みは一覧に出て「候補に戻す」で取り消せる', async () => {
    const calls: string[] = [];
    stub([{ id: 3, partner: '架空家賃' }], calls);
    withQueryClient(<SubsCandidatesPanel hasDeals />);

    fireEvent.click(await screen.findByRole('button', { name: '候補に戻す' }));
    await waitFor(() => expect(calls).toEqual(['DELETE /api/sub-vendors/exclusions/3']));
  });

  it('採点の根拠は広い画面用と、スマホ幅で畳む details の両方を出す', async () => {
    stub([], []);
    const { container } = withQueryClient(<SubsCandidatesPanel hasDeals />);
    await screen.findByText('架空家賃');

    const wide = container.querySelector('.reasons-wide');
    const narrow = container.querySelector('details.reasons-narrow');
    expect(wide?.textContent).toBe('2ヶ月中2ヶ月に支払 / 毎回ほぼ同額');
    expect(narrow?.querySelector('summary')?.textContent).toBe('架空家賃の採点の根拠');
    // details は既定で閉じている(スマホ幅で場所を取らない)
    expect((narrow as HTMLDetailsElement).open).toBe(false);
  });
});
