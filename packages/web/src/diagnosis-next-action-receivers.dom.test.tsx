// @vitest-environment jsdom

/**
 * 診断画面が出す nextAction の遷移先が、実在する受け手の画面に「届く」かを端から端で固定する。
 *
 * 診断側は遷移先 URL を作るだけなので、受け手が query をどう読むかを知らないまま壊れうる。
 * サブスク画面は URL の vendor を正規化済みキー (core の `vendorKey`) で引くため、
 * 表示名をそのまま渡すと当たらず、URL から静かに捨てられる。この非対称を DOM で接地する。
 */
import { vendorKey } from '@kanjo/core';
import type { SubscriptionRow, SubscriptionVendorDetail, SubscriptionsScreen } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetPage } from './pages/Budget.js';
import { SubscriptionsPage } from './pages/Subscriptions.js';
import { PeriodProvider } from './period.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

/** 表示名と正規化キーがずれる名前にする (ずれない名前だと正規化の有無を判別できない) */
const CLOUD_NAME = '株式会社 架空クラウド';
const CLOUD_KEY = vendorKey(CLOUD_NAME);
const ADS_NAME = '架空広告';

function subRow(name: string, monthly: number, category: string): SubscriptionRow {
  return {
    vendorKey: vendorKey(name),
    vendorId: null,
    status: 'registered',
    displayName: name,
    normalizedName: name,
    matchedNameCount: 1,
    latestAmount: monthly,
    estimatedMonthly: monthly,
    annualized: monthly * 12,
    billing: 'monthly',
    active: true,
    category,
    categorySource: 'dictionary',
    review: null,
  };
}

const cloudRow = subRow(CLOUD_NAME, 6_600, 'クラウド');
const adsRow = subRow(ADS_NAME, 20_000, '広告');

const subscriptionsScreen: SubscriptionsScreen = {
  period: null,
  previousPeriod: null,
  generatedAt: '2026-08-31T00:00:00.000Z',
  kpis: {
    monthlyTotal: 26_600,
    monthlyTotalPrev: null,
    annualized: 319_200,
    annualizedPrev: null,
    last12Total: 39_900,
    revenueShare: null,
    reviewCandidates: 0,
  },
  coverage: {
    bank: { percent: 1, imported: 1, accounts: 1 },
    card: { percent: 1, imported: 1, accounts: 1 },
    emoney: { percent: null, imported: 0, accounts: 0 },
    unclassified: 0,
  },
  rows: [cloudRow, adsRow],
  trend: {
    months: ['2026-07', '2026-08'],
    series: [
      { category: 'クラウド', values: [3_300, 6_600] },
      { category: '広告', values: [10_000, 20_000] },
    ],
  },
  comparison: [
    { category: '広告', monthly: 20_000, annualized: 240_000, share: 0.75, prevMonthly: 10_000 },
    { category: 'クラウド', monthly: 6_600, annualized: 79_200, share: 0.25, prevMonthly: 3_300 },
  ],
  comparisonTotal: { monthly: 26_600, annualized: 319_200, prevMonthly: 13_300 },
};

const cloudDetail: SubscriptionVendorDetail = {
  vendorKey: CLOUD_KEY,
  vendorId: null,
  row: cloudRow,
  rawNames: [{ name: CLOUD_NAME, source: 'card', count: 2 }],
  estimatedMonthly: 6_600,
  annualized: 79_200,
  recent: [{ date: '2026-08-01', name: CLOUD_NAME, source: 'card', amount: 6_600 }],
  transactionCount: 2,
  bySource: [{ source: 'card', count: 2 }],
  related: null,
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

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const location = () => screen.getByTestId('location').textContent ?? '';

function renderAt(page: 'subscriptions' | 'budget', path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
      if ((init?.method ?? 'GET') !== 'GET') return json({ ok: true, aliases: [] });
      if (url.includes('/api/subscriptions/vendors/')) return json(cloudDetail);
      if (url.includes('/api/subscriptions')) return json(subscriptionsScreen);
      if (url.includes('/api/budgets')) return json(budgetPayload);
      if (url.includes('/api/sub-vendors/candidates'))
        return json({ candidates: [], excluded: [], dealRows: 0 });
      return json({ vendors: [], accountOptions: [], review: [] });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter initialEntries={[path]}>
          {page === 'subscriptions' ? <SubscriptionsPage /> : <BudgetPage />}
          <LocationProbe />
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('診断 nextAction の受信契約', () => {
  it('Subscriptions は診断が渡す正規化キーで対象の詳細を開く', async () => {
    renderAt('subscriptions', `/subscriptions?vendor=${encodeURIComponent(CLOUD_KEY)}`);
    const panel = await screen.findByRole('complementary', { name: 'サブスクの詳細' });
    // 詳細は URL の vendor で別途 fetch する。読込が終わってから中身を見る
    await within(panel).findByText('マッチした生の取引名（1件）');
    expect(within(panel).getAllByText(CLOUD_NAME).length).toBeGreaterThan(0);
    expect(location()).toBe(`/subscriptions?vendor=${encodeURIComponent(CLOUD_KEY)}`);
  });

  it('Subscriptions は表示名のままや不存在の vendor を静かに捨てる', async () => {
    // 診断が vendorKey を通し忘れると (表示名のまま渡すと) この経路に落ちる
    renderAt('subscriptions', `/subscriptions?vendor=${encodeURIComponent(CLOUD_NAME)}`);
    await screen.findByRole('region', { name: '最終更新' });
    await waitFor(() => expect(location()).toBe('/subscriptions'));
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
    const list = screen.getByRole('table', { name: 'サブスク一覧' });
    expect(list.textContent).toContain(CLOUD_NAME);
    expect(list.textContent).toContain(ADS_NAME);
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
