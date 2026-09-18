// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetPage } from './pages/Budget.js';
import { SubscriptionsPage } from './pages/Subscriptions.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

const subscriptionPayload = {
  months: ['2026-07', '2026-08'],
  vendors: ['架空クラウド', '架空広告'],
  vendorAccounts: { 架空クラウド: ['通信費'], 架空広告: ['広告宣伝費'] },
  matrix: { 架空クラウド: [3_300, 6_600], 架空広告: [10_000, 20_000] },
  other: [0, 0],
  vendorTable: [
    {
      vendor: '架空クラウド',
      prevActual: 0,
      currAnnualized: 59_400,
      delta: 1,
      lastMonthly: 6_600,
      avgMonthly: 4_950,
      last12Total: 9_900,
      activeMonths: 2,
    },
    {
      vendor: '架空広告',
      prevActual: 0,
      currAnnualized: 180_000,
      delta: 1,
      lastMonthly: 20_000,
      avgMonthly: 15_000,
      last12Total: 30_000,
      activeMonths: 2,
    },
  ],
  now: {
    month: '2026-08',
    monthlyTotal: 26_600,
    annualized: 319_200,
    last12Total: 39_900,
    revenueShare: 0.1,
  },
  alerts: [
    { month: '2026-08', vendor: '架空クラウド', value: 6_600, median: 3_300, type: 'dup' },
    { month: '2026-07', vendor: '架空広告', value: 10_000, median: 5_000, type: `sp${'ike'}` as const },
  ],
  years: { curr: '2026', prev: '2025' },
};

const budgetPayload = {
  budgets: { 広告宣伝費: 10_000, 通信費: 5_000 },
  table: [
    { account: '広告宣伝費', type: '変動費', recentAvg: 30_000, budget: 10_000, diff: 20_000, judge: '超過' },
    { account: '通信費', type: '固定費', recentAvg: 5_000, budget: 5_000, diff: 0, judge: '範囲内' },
  ],
  outlook: {
    year: '2026',
    recordedMonths: 6,
    remainingMonths: 6,
    rows: [
      {
        account: '広告宣伝費',
        budget: 10_000,
        annualBudget: 120_000,
        ytd: 90_000,
        recentAvg: 30_000,
        landing: 270_000,
        diff: 150_000,
        judge: '超過',
      },
      {
        account: '通信費',
        budget: 5_000,
        annualBudget: 60_000,
        ytd: 30_000,
        recentAvg: 5_000,
        landing: 60_000,
        diff: 0,
        judge: '範囲内',
      },
    ],
    totals: { annualBudget: 180_000, ytd: 120_000, landing: 330_000, diff: 150_000 },
  },
};

function renderAt(page: 'subscriptions' | 'budget', path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/subscriptions')
        ? subscriptionPayload
        : url.includes('/api/budgets')
          ? budgetPayload
          : url.includes('/api/sub-vendors/candidates')
            ? { candidates: [], excluded: [], dealRows: 0 }
            : { vendors: [], accountOptions: [], review: [] };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {page === 'subscriptions' ? <SubscriptionsPage /> : <BudgetPage />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('診断 nextAction の受信契約', () => {
  it('Subscriptions は account/vendor/month が一致する対象だけを初期表示する', async () => {
    renderAt(
      'subscriptions',
      '/subscriptions?account=%E9%80%9A%E4%BF%A1%E8%B2%BB&vendor=%E6%9E%B6%E7%A9%BA%E3%82%AF%E3%83%A9%E3%82%A6%E3%83%89&month=2026-08',
    );
    const status = await screen.findByRole('status', { name: '診断からの絞り込み' });
    expect(status.textContent).toContain('通信費');
    expect(status.textContent).toContain('架空クラウド');
    expect(status.textContent).toContain('2026年8月');
    const section = screen.getByRole('region', { name: '現在のサブスク支払い' });
    expect(section.textContent).toContain('架空クラウド');
    expect(section.textContent).not.toContain('架空広告');
    const alerts = screen.getByRole('region', { name: '検知アラート' });
    expect(alerts.textContent).toContain('架空クラウド');
    expect(alerts.textContent).not.toContain('架空広告');
  });

  it('Subscriptions は不正・不存在queryを無視して全件表示する', async () => {
    renderAt('subscriptions', '/subscriptions?account=x&vendor=x&month=2026-99');
    await screen.findByText('いま何にいくら払っているか');
    expect(screen.queryByRole('status', { name: '診断からの絞り込み' })).toBeNull();
    const section = screen.getByRole('region', { name: '現在のサブスク支払い' });
    expect(section.textContent).toContain('架空クラウド');
    expect(section.textContent).toContain('架空広告');
  });

  it('Budget は存在する account を初期表示し、不存在accountは全件へ戻す', async () => {
    renderAt('budget', '/budget?account=%E5%BA%83%E5%91%8A%E5%AE%A3%E4%BC%9D%E8%B2%BB');
    const status = await screen.findByRole('status', { name: '診断からの絞り込み' });
    expect(status.textContent).toContain('広告宣伝費');
    const table = screen.getByRole('table', { name: '科目別の月次予算' });
    expect(within(table).getByText('広告宣伝費')).toBeTruthy();
    expect(within(table).queryByText('通信費')).toBeNull();

    cleanup();
    renderAt('budget', '/budget?account=%E5%AD%98%E5%9C%A8%E3%81%97%E3%81%AA%E3%81%84');
    const full = await screen.findByRole('table', { name: '科目別の月次予算' });
    expect(within(full).getByText('広告宣伝費')).toBeTruthy();
    expect(within(full).getByText('通信費')).toBeTruthy();
  });
});
