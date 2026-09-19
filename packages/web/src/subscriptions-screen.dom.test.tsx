// @vitest-environment jsdom

/**
 * サブスク画面 (整える > サブスク) の表示契約。画像 design/FINAL-UI/images/09-subscriptions.png が
 * 構成の正本で、数値は core の検算済み fixture (spec §13.3) を写したもの。画像の数値は期待値にしない。
 *
 * 旧画面 (支払先別の積み上げ図 + 支払先の表) では、見出しの問い・KPI 5 枚・カバー率・8 列の一覧・
 * 詳細パネル・検出理由カードのどれも無いので、この describe の大半が落ちる。
 */
import type { SubscriptionRow, SubscriptionVendorDetail, SubscriptionsScreen } from '@kanjo/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SubscriptionsPage } from './pages/Subscriptions.js';
import { PeriodProvider } from './period.js';

vi.mock('react-chartjs-2', () => ({
  Chart: ({
    'aria-label': ariaLabel,
    data,
    options,
  }: {
    'aria-label'?: string;
    data?: { labels?: unknown[]; datasets?: { label?: string; data?: number[] }[] };
    options?: { plugins?: { legend?: { display?: boolean } } };
  }) => (
    <div
      role="img"
      aria-label={ariaLabel}
      data-chart-labels={data?.labels?.length ?? 0}
      data-chart-legend={String(options?.plugins?.legend?.display)}
      data-dataset-labels={data?.datasets?.map((dataset) => dataset.label).join('|')}
      data-dataset-sum={data?.datasets
        ?.flatMap((dataset) => dataset.data ?? [])
        .reduce((sum, value) => sum + value, 0)}
    />
  ),
}));

/* ---------------- core の検算済み fixture (subs-screen-fixture.ts) の出力を写したもの ---------------- */

function subRow(partial: Partial<SubscriptionRow> & Pick<SubscriptionRow, 'vendorKey' | 'normalizedName'>) {
  const monthly = partial.estimatedMonthly ?? 0;
  return {
    vendorId: null,
    status: 'registered',
    displayName: partial.normalizedName,
    matchedNameCount: 1,
    latestAmount: monthly,
    estimatedMonthly: monthly,
    annualized: monthly * 12,
    billing: 'monthly',
    active: true,
    category: 'その他',
    categorySource: 'dictionary',
    review: null,
    ...partial,
  } satisfies SubscriptionRow;
}

const adobe = subRow({
  vendorKey: 'adobecreativecloud',
  vendorId: 6,
  normalizedName: 'Adobe Creative Cloud',
  estimatedMonthly: 2_728,
  category: 'クリエイティブ',
  review: {
    state: 'pending',
    rules: ['priceUp'],
    fingerprint: 'priceUp:2728',
    reasons: ['2026年7月から ¥2,480 → ¥2,728 (+10.0%) に値上がりし、2か月続いています。'],
  },
});
const spotify = subRow({
  vendorKey: 'spotify',
  vendorId: 3,
  normalizedName: 'Spotify',
  matchedNameCount: 2,
  estimatedMonthly: 980,
  category: 'エンタメ',
  review: {
    state: 'pending',
    rules: ['overlap'],
    fingerprint: 'overlap:980',
    reasons: ['同じカテゴリ「エンタメ」に継続中のサブスクが 2 件あります (月額合計 ¥2,470)。'],
  },
});

const fixtureRows: SubscriptionRow[] = [
  adobe,
  spotify,
  subRow({
    vendorKey: 'notion',
    vendorId: 5,
    normalizedName: 'Notion',
    estimatedMonthly: 1_650,
    category: '仕事効率化',
  }),
  subRow({
    vendorKey: 'newspicks',
    vendorId: 8,
    normalizedName: 'NewsPicks',
    estimatedMonthly: 1_500,
    category: 'ニュース',
  }),
  subRow({
    vendorKey: 'netflix',
    vendorId: 1,
    normalizedName: 'Netflix',
    matchedNameCount: 2,
    estimatedMonthly: 1_490,
    category: 'エンタメ',
  }),
  subRow({
    vendorKey: 'amazonプライム',
    vendorId: 2,
    normalizedName: 'Amazonプライム',
    matchedNameCount: 2,
    estimatedMonthly: 600,
    category: 'ショッピング',
  }),
  subRow({
    vendorKey: '1password',
    vendorId: 7,
    normalizedName: '1Password',
    estimatedMonthly: 580,
    category: 'セキュリティ',
  }),
  subRow({
    vendorKey: 'googleone',
    vendorId: 4,
    normalizedName: 'Google One',
    estimatedMonthly: 250,
    category: 'クラウド',
  }),
];

const months = [
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
];
const flat = (value: number) => months.map(() => value);

const fixtureScreen: SubscriptionsScreen = {
  period: { from: '2025-09', to: '2026-08' },
  previousPeriod: { from: '2024-09', to: '2025-08' },
  generatedAt: '2026-09-10T10:24:00+09:00',
  kpis: {
    monthlyTotal: 9_778,
    monthlyTotalPrev: 9_530,
    annualized: 117_336,
    annualizedPrev: 114_360,
    last12Total: 114_856,
    revenueShare: 0.05386296296296297,
    reviewCandidates: 2,
  },
  coverage: {
    bank: { percent: 0.9722222222222222, imported: 3, accounts: 3 },
    card: { percent: 1, imported: 2, accounts: 2 },
    emoney: { percent: 0.9166666666666666, imported: 1, accounts: 2 },
    unclassified: 0,
  },
  rows: fixtureRows,
  trend: {
    months,
    series: [
      { category: 'クリエイティブ', values: [...flat(2_480).slice(0, 10), 2_728, 2_728] },
      { category: 'エンタメ', values: flat(2_470) },
      { category: '仕事効率化', values: flat(1_650) },
      { category: 'その他', values: flat(2_930) },
    ],
  },
  comparison: [
    {
      category: 'クリエイティブ',
      monthly: 2_728,
      annualized: 32_736,
      share: 0.2789936592350174,
      prevMonthly: 2_480,
    },
    {
      category: 'エンタメ',
      monthly: 2_470,
      annualized: 29_640,
      share: 0.2526078952751074,
      prevMonthly: 2_470,
    },
    {
      category: '仕事効率化',
      monthly: 1_650,
      annualized: 19_800,
      share: 0.16874616485988955,
      prevMonthly: 1_650,
    },
    {
      category: 'ニュース',
      monthly: 1_500,
      annualized: 18_000,
      share: 0.1534056044180814,
      prevMonthly: 1_500,
    },
    {
      category: 'ショッピング',
      monthly: 600,
      annualized: 7_200,
      share: 0.06136224176723256,
      prevMonthly: 600,
    },
    {
      category: 'セキュリティ',
      monthly: 580,
      annualized: 6_960,
      share: 0.05931683370832481,
      prevMonthly: 580,
    },
    { category: 'クラウド', monthly: 250, annualized: 3_000, share: 0.0255676007363469, prevMonthly: 250 },
  ],
  comparisonTotal: { monthly: 9_778, annualized: 117_336, prevMonthly: 9_530 },
};

const spotifyRecent = months
  .map((month, index) => ({
    date: `${month}-01`,
    name: index % 2 === 0 ? 'Spotify' : 'SPOTIFY.COM',
    source: index % 2 === 0 ? ('card' as const) : ('bank' as const),
    amount: 980,
  }))
  .reverse();

const spotifyDetail: SubscriptionVendorDetail = {
  vendorKey: 'spotify',
  vendorId: 3,
  row: spotify,
  rawNames: [
    { name: 'Spotify', source: 'card', count: 6 },
    { name: 'SPOTIFY.COM', source: 'bank', count: 6 },
  ],
  estimatedMonthly: 980,
  annualized: 11_760,
  recent: spotifyRecent,
  transactionCount: 12,
  bySource: [
    { source: 'card', count: 6 },
    { source: 'bank', count: 6 },
  ],
  related: { aliases: ['SPOTIFY.COM'], accounts: ['通信費'], reviewedAt: '2026-08-01', reviewDue: false },
};

/** 未登録の候補 (まだ sub_vendors に無い取引先)。採用・除外の送り先を確かめる */
const unregistered = subRow({
  vendorKey: '架空動画',
  normalizedName: '架空動画',
  status: 'unregistered',
  estimatedMonthly: 1_200,
  category: 'その他',
  review: {
    state: 'pending',
    rules: ['dup'],
    fingerprint: 'dup:1200',
    reasons: ['2026年8月に同じ金額 ¥1,200 の請求が 2 回あります。'],
  },
});

const unregisteredDetail: SubscriptionVendorDetail = {
  vendorKey: unregistered.vendorKey,
  vendorId: null,
  row: unregistered,
  rawNames: [{ name: unregistered.normalizedName, source: 'card', count: 2 }],
  estimatedMonthly: unregistered.estimatedMonthly,
  annualized: unregistered.annualized,
  recent: [],
  transactionCount: 0,
  bySource: [{ source: 'card', count: 2 }],
  related: null,
};

const vendorsResponse = {
  vendors: fixtureRows.map((row) => ({
    id: row.vendorId ?? 0,
    name: row.normalizedName,
    aliases: [],
    accounts: [],
  })),
  accountOptions: ['通信費', '支払手数料'],
  review: [],
};
const candidatesResponse = { candidates: [], excluded: [], dealRows: 0 };

/* ---------------- 描画の道具 ---------------- */

type Handler = (url: string, init?: RequestInit) => Response | undefined | Promise<Response | undefined>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage({
  data = fixtureScreen,
  detail = spotifyDetail,
  handler,
  path = '/subscriptions',
}: { data?: SubscriptionsScreen; detail?: SubscriptionVendorDetail; handler?: Handler; path?: string } = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const custom = await handler?.(url, init);
    if (custom) return custom;
    if (method !== 'GET') return json({ ok: true, aliases: [] });
    if (url.includes('/api/subscriptions/vendors/')) return json(detail);
    if (url.includes('/api/subscriptions')) return json(data);
    if (url.includes('/api/sub-vendors/candidates')) return json(candidatesResponse);
    if (url.includes('/api/sub-vendors')) return json(vendorsResponse);
    return json({});
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter initialEntries={[path]}>
          <SubscriptionsPage />
          <LocationProbe />
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
  return { ...view, calls, fetchMock, client };
}

const getCount = (calls: readonly { method: string; url: string }[], path: string) =>
  calls.filter((call) => call.method === 'GET' && call.url.split('?')[0] === path).length;

const location = () => screen.getByTestId('location').textContent ?? '';
/** 読込中の骨格にも同じ KPI 領域があるので、読込後にだけ出る「最終更新」で待つ */
const kpiRegion = async () => {
  await screen.findByRole('region', { name: '最終更新' });
  return screen.getByRole('region', { name: 'サブスクの主要な数字' });
};
const table = () => screen.getByRole('table', { name: 'サブスク一覧' });
const bodyRows = () => within(table()).getAllByRole('row').slice(1, -1);
const detailPanel = () => screen.findByRole('complementary', { name: 'サブスクの詳細' });

beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* ---------------- 構成 ---------------- */

describe('サブスク画面の構成', () => {
  it('見出し・問い・説明文が出る', async () => {
    renderPage();
    await kpiRegion();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('サブスク');
    expect(screen.getByText('毎月の固定費に、重複や見直し候補はありますか？')).toBeTruthy();
    expect(screen.getByText(/見直しで、家計をすっきりさせましょう/)).toBeTruthy();
  });

  it('KPI 5 枚と前期間比', async () => {
    const { container } = renderPage();
    await kpiRegion();
    const cards = [...container.querySelectorAll<HTMLElement>('.subs-kpis .kpi')];
    expect(cards.map((card) => card.querySelector('.label')?.textContent)).toEqual([
      '月額のサブスク合計',
      '年換算の合計',
      '直近12か月の支払額',
      '売上比',
      '見直し候補',
    ]);
    expect(cards.map((card) => card.querySelector('.value')?.textContent)).toEqual([
      '¥9,778',
      '¥117,336',
      '¥114,856',
      '5.4%',
      '2件',
    ]);
    expect(cards.every((card) => card.querySelector('.kpi-icon .ui-icon'))).toBe(true);
    // 1・2 枚目だけが前期間比を持つ。差額・率・矢印 (増加は ↑)
    expect(cards[0]!.querySelector('.note')?.textContent).toContain('+¥248 (+2.6%)');
    expect(cards[0]!.querySelector('.note')?.textContent).toContain('↑');
    expect(cards[1]!.querySelector('.note')?.textContent).toContain('+¥2,976 (+2.6%)');
    expect(cards[2]!.querySelector('.note')?.textContent).not.toContain('前期間比');
    expect(cards[3]!.querySelector('.note')?.textContent).toBe('売上に占める割合');
  });

  it('前期間比の表記', async () => {
    const { container } = renderPage({
      data: {
        ...fixtureScreen,
        kpis: { ...fixtureScreen.kpis, monthlyTotal: 9_530, annualized: 100_000, annualizedPrev: 114_360 },
      },
    });
    await kpiRegion();
    const notes = [...container.querySelectorAll<HTMLElement>('.subs-kpis .kpi .note')];
    // 差 0 は矢印なし・「変化なし」と文字でも言う (色だけで区別しない)
    expect(notes[0]!.textContent).toContain('±¥0 (±0.0%)');
    expect(notes[0]!.textContent).not.toMatch(/[↑↓]/);
    expect(notes[0]!.textContent).toContain('変化なし');
    expect(notes[1]!.textContent).toContain('-¥14,360 (-12.6%)');
    expect(notes[1]!.textContent).toContain('↓');
    expect(notes[1]!.textContent).toContain('減少');
  });

  it('カバー率と再取得', async () => {
    const { calls } = renderPage();
    const coverage = await screen.findByRole('region', { name: 'データソースのカバー率' });
    const items = within(coverage).getAllByRole('listitem');
    expect(items.map((item) => item.textContent?.replace(/\s+/g, ''))).toEqual([
      '銀行口座97%(3/3)',
      'クレジットカード100%(2/2)',
      '電子マネー92%(1/2)',
    ]);
    const refresh = screen.getByRole('region', { name: '最終更新' });
    expect(refresh.textContent).toContain('最終更新');
    const before = calls.filter((call) => call.url.includes('/api/subscriptions')).length;
    fireEvent.click(within(refresh).getByRole('button', { name: /再取得/ }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url.includes('/api/subscriptions')).length).toBeGreaterThan(before),
    );
  });

  it('8 列・合計行・検索・絞込', async () => {
    renderPage();
    await kpiRegion();
    const headers = within(table()).getAllByRole('columnheader');
    expect(headers).toHaveLength(8);
    // ベンダー名の末尾の「?」は用語ヘルプ (glossary の vendor)
    expect(headers.map((th) => th.textContent?.trim())).toEqual([
      'ベンダー名?',
      '正規化名',
      '取引名数',
      '最新の金額',
      '月額の推定',
      '年換算',
      'カテゴリ',
      '候補',
    ]);
    // 一覧の行は詳細選択だけ。用途のないローカルチェックは置かない。
    expect(within(table()).queryAllByRole('checkbox')).toHaveLength(0);
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual(
      fixtureRows.map((row) => row.vendorKey),
    );
    // 未判断の 2 件だけ「候補」バッジ
    expect(within(bodyRows()[0]!).getByText('候補')).toBeTruthy();
    expect(within(bodyRows()[2]!).queryByText('候補')).toBeNull();
    const total = within(table()).getAllByRole('row').at(-1)!;
    expect(total.textContent).toContain('¥9,778');
    expect(total.textContent).toContain('¥117,336');

    fireEvent.change(screen.getByRole('searchbox', { name: 'ベンダー名・カテゴリで検索' }), {
      target: { value: 'エンタメ' },
    });
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual(['spotify', 'netflix']);
    // 絞込中も合計は全体の値のまま (見出しで分かるようにする)
    expect(within(table()).getAllByRole('row').at(-1)!.textContent).toContain('全体の合計');

    fireEvent.change(screen.getByRole('searchbox', { name: 'ベンダー名・カテゴリで検索' }), {
      target: { value: '' },
    });
    const filter = screen.getByRole('combobox', { name: 'ステータスで絞り込む' });
    expect(
      within(filter)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['すべてのステータス', '見直し候補', '登録済み', '未登録の候補']);
    fireEvent.change(filter, { target: { value: 'review' } });
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual([
      'adobecreativecloud',
      'spotify',
    ]);
  });

  it('ロゴ画像要素が 0 件', async () => {
    const { container } = renderPage({ path: '/subscriptions?vendor=spotify' });
    await detailPanel();
    await screen.findByText('マッチした生の取引名（2件）');
    expect(container.querySelectorAll('img')).toHaveLength(0);
    for (const element of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(element.style.backgroundImage, element.outerHTML).toBe('');
    }
    // 頭文字の丸 (アバター) も置かない
    expect(container.querySelectorAll('[class*="avatar"], [class*="logo"], [class*="initial"]')).toHaveLength(
      0,
    );
  });

  it('推移の棒と凡例', async () => {
    renderPage();
    const chart = await screen.findByRole('img', {
      name: '月別のサブスク支払いをカテゴリ別の積み上げで示す図',
    });
    expect(chart.getAttribute('data-chart-labels')).toBe('12');
    expect(chart.getAttribute('data-dataset-labels')).toBe('クリエイティブ|エンタメ|仕事効率化|その他');
    expect(chart.getAttribute('data-chart-legend')).toBe('false');
    // 棒の和 = 直近12か月の支払額
    expect(chart.getAttribute('data-dataset-sum')).toBe('114856');
    const card = screen.getByRole('region', { name: '月次のサブスク支出推移' });
    expect(within(card).getAllByRole('heading', { name: '月次のサブスク支出推移' })).toHaveLength(1);
    expect(within(card).getAllByText('円')).toHaveLength(1);
    expect(within(card).getAllByRole('list', { name: '図の系列' })).toHaveLength(1);
  });

  it('年換算の比較は月額の降順で、合計は一覧の合計と同じ', async () => {
    renderPage();
    const card = await screen.findByRole('region', { name: '年換算の比較（カテゴリ別）' });
    const rows = within(card).getAllByRole('row');
    expect(rows.slice(1, -1).map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      fixtureScreen.comparison.map((row) => row.category),
    );
    expect(rows.at(-1)!.textContent).toContain('¥9,778');
    expect(rows.at(-1)!.textContent).toContain('¥117,336');
    expect(rows.at(-1)!.textContent).toContain('100.0%');
  });
});

/* ---------------- 詳細パネル ---------------- */

describe('サブスクの詳細', () => {
  it('初期表示と登録済みの概要では補助データを取得しない', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(getCount(calls, '/api/sub-vendors')).toBe(0);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(0);
  });

  it('関連データを開いた時だけ登録情報と除外情報を各1回取得する', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    await within(panel).findByRole('checkbox', { name: '支払手数料' });
    await waitFor(() => expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(1));
    expect(getCount(calls, '/api/sub-vendors')).toBe(1);
  });

  it('未登録の概要では統合先だけを取得し、除外情報は関連データまで取得しない', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    const path = `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`;
    const { calls } = renderPage({ data, detail: unregisteredDetail, path });
    const panel = await detailPanel();
    await within(panel).findByRole('combobox', { name: '統合先' });
    expect(getCount(calls, '/api/sub-vendors')).toBe(1);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(0);
  });

  it('行を選ぶと URL に vendor が付き詳細が開く', async () => {
    renderPage();
    await kpiRegion();
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    expect(location()).toBe('/subscriptions?vendor=spotify');
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(
      within(panel)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['概要', '取引履歴', '関連データ']);
    expect(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }).getAttribute('aria-current')).toBe(
      'true',
    );

    fireEvent.click(within(panel).getByRole('button', { name: '詳細を閉じる' }));
    expect(location()).toBe('/subscriptions');
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
  });

  it('タブは矢印キーで折り返して移り、Home / End で両端へ飛び、選択と tabIndex と tabpanel が付いてくる', async () => {
    renderPage();
    await kpiRegion();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    const tablist = within(panel).getByRole('tablist', { name: '詳細の表示' });
    const selected = () => {
      const tabs = within(panel).getAllByRole('tab');
      const on = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(on).toHaveLength(1);
      // roving tabindex: 選ばれたタブだけが Tab キーの到達点で、フォーカスもそこにある (初期表示は除く)
      expect(tabs.map((tab) => tab.tabIndex)).toEqual(tabs.map((tab) => (tab === on[0] ? 0 : -1)));
      const tabpanel = within(panel).getByRole('tabpanel');
      expect(on[0].getAttribute('aria-controls')).toBe(tabpanel.id);
      expect(tabpanel.getAttribute('aria-labelledby')).toBe(on[0].id);
      return on[0];
    };
    expect(selected().textContent).toBe('概要');

    const press = (key: string) => {
      fireEvent.keyDown(tablist, { key });
      const tab = selected();
      expect(document.activeElement).toBe(tab);
      return tab.textContent;
    };
    expect(press('ArrowRight')).toBe('取引履歴');
    expect(press('ArrowRight')).toBe('関連データ');
    expect(press('ArrowRight')).toBe('概要');
    expect(press('ArrowLeft')).toBe('関連データ');
    expect(press('Home')).toBe('概要');
    expect(press('End')).toBe('関連データ');
    // 関係ないキーでは動かない
    expect(press('ArrowDown')).toBe('関連データ');
  });

  it('再読込しても URL の vendor から詳細を復元し、期間外の vendor は URL から消す', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    cleanup();
    vi.unstubAllGlobals();

    renderPage({ path: '/subscriptions?vendor=nosuch' });
    await kpiRegion();
    await waitFor(() => expect(location()).toBe('/subscriptions'));
    expect(screen.queryByRole('complementary', { name: 'サブスクの詳細' })).toBeNull();
  });

  it('詳細パネルの概要タブ', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    await within(panel).findByText('マッチした生の取引名（2件）');
    expect(within(panel).getByText('見直し候補')).toBeTruthy();
    expect(within(panel).getByText('エンタメ')).toBeTruthy();
    const raw = within(panel).getByRole('group', { name: 'マッチした生の取引名（2件）' });
    expect(within(raw).getAllByRole('checkbox')).toHaveLength(2);
    expect(raw.textContent).toContain('クレジットカード');
    expect(raw.textContent).toContain('銀行口座');
    expect(panel.textContent).toContain('¥980');
    expect(panel.textContent).toContain('¥11,760');
    // 直近の取引は先頭 3 件だけ。残りは「すべて見る」で取引履歴タブへ
    const recent = within(panel).getByRole('table', { name: '直近の取引' });
    expect(within(recent).getAllByRole('row')).toHaveLength(4);
    fireEvent.click(within(panel).getByRole('button', { name: 'すべて見る (12件) →' }));
    expect(within(panel).getByRole('tab', { name: '取引履歴' }).getAttribute('aria-selected')).toBe('true');
    expect(
      within(within(panel).getByRole('list', { name: '直近の取引履歴' })).getAllByRole('listitem'),
    ).toHaveLength(3);
    expect(within(panel).getByRole('button', { name: '取引履歴を大きく表示（12件）' })).toBeTruthy();
  });

  it('狭い詳細は直近3件に要約し、全履歴は広いdialogで省略せず読める', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '取引履歴' }));

    const summary = within(panel).getByRole('list', { name: '直近の取引履歴' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(3);
    const trigger = within(panel).getByRole('button', { name: '取引履歴を大きく表示（12件）' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Spotifyの取引履歴' });
    const usageSummary = within(dialog).getByRole('region', { name: '履歴からわかる利用状況' });
    expect(usageSummary.textContent).toContain('対象期間内の履歴から算出');
    expect(usageSummary.textContent).toContain('確認できる利用期間');
    expect(usageSummary.textContent).toContain('2025/09/01〜2026/08/01');
    expect(usageSummary.textContent).toContain('支払い実績');
    expect(usageSummary.textContent).toContain('12か月・12件');
    expect(usageSummary.textContent).toContain('合計支払額');
    expect(usageSummary.textContent).toContain('¥11,760');
    expect(usageSummary.textContent).toContain('支払い月あたり平均');
    expect(usageSummary.textContent).toContain('¥980');
    const history = within(dialog).getByRole('table', { name: 'Spotifyの取引履歴' });
    expect(history.classList.contains('is-expanded')).toBe(true);
    expect(within(history).getAllByRole('row')).toHaveLength(13);
    expect(history.textContent).toContain('SPOTIFY.COM');
    expect(history.textContent).toContain('クレジットカード');
    expect(history.textContent).toContain('銀行口座');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Spotifyの取引履歴' })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('1件の履歴は1日の記録として要約し、長い名称もdialogでは省略しない', async () => {
    const longVendorName = 'とても長い名称のテスト用クラウドストレージ年間利用サービス';
    const longTransactionName = 'とても長い名称のテスト用クラウドストレージ年間利用サービス決済明細';
    const row = { ...spotify, displayName: longVendorName, normalizedName: longVendorName };
    const detail: SubscriptionVendorDetail = {
      ...spotifyDetail,
      row,
      recent: [{ date: '2026-08-13', name: longTransactionName, source: 'card', amount: 8_454 }],
      transactionCount: 1,
      bySource: [{ source: 'card', count: 1 }],
    };
    renderPage({
      data: {
        ...fixtureScreen,
        rows: fixtureScreen.rows.map((item) => (item.vendorKey === row.vendorKey ? row : item)),
      },
      detail,
      path: '/subscriptions?vendor=spotify',
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '取引履歴' }));
    fireEvent.click(within(panel).getByRole('button', { name: '取引履歴を大きく表示（1件）' }));

    const dialog = await screen.findByRole('dialog', { name: `${longVendorName}の取引履歴` });
    const usageSummary = within(dialog).getByRole('region', { name: '履歴からわかる利用状況' });
    expect(usageSummary.textContent).toContain('2026/08/13（1日の記録）');
    expect(usageSummary.textContent).toContain('1か月・1件');
    expect(usageSummary.textContent).toContain('合計支払額¥8,454');
    expect(usageSummary.textContent).toContain('支払い月あたり平均¥8,454');
    expect(within(dialog).getByRole('table').textContent).toContain(longTransactionName);
  });

  it('履歴が0件なら利用要約と全件dialogの入口を出さず、理由を表示する', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    renderPage({
      data,
      detail: unregisteredDetail,
      path: `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`,
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '取引履歴' }));

    expect(within(panel).getByText('期間内の取引はありません。')).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: /取引履歴を大きく表示/ })).toBeNull();
    expect(screen.queryByRole('region', { name: '履歴からわかる利用状況' })).toBeNull();
  });

  it('未登録の概要から新しい統合先を登録し、その統合先を自動選択する', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    const path = `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`;
    let created = false;
    const { calls } = renderPage({
      data,
      detail: unregisteredDetail,
      path,
      handler: (url, init) => {
        const method = init?.method ?? 'GET';
        if (url === '/api/sub-vendors' && method === 'POST') {
          created = true;
          return json({ ok: true, id: 99 });
        }
        if (url === '/api/sub-vendors' && method === 'GET' && created) {
          return json({
            ...vendorsResponse,
            vendors: [
              ...vendorsResponse.vendors,
              { id: 99, name: '新しいクラウド', aliases: [], accounts: [] },
            ],
          });
        }
        return undefined;
      },
    });
    const panel = await detailPanel();
    const select = await within(panel).findByRole('combobox', { name: '統合先' });
    const createTrigger = within(panel).getByRole('button', { name: '新しい統合先を登録' });
    fireEvent.click(createTrigger);
    const input = within(panel).getByRole('textbox', { name: '新しい統合先の名前' });
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('maxlength')).toBe('120');
    fireEvent.change(input, { target: { value: '新しいクラウド' } });
    fireEvent.click(within(panel).getByRole('button', { name: '登録して統合先に選ぶ' }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/sub-vendors',
        body: { name: '新しいクラウド', aliases: [], accounts: [] },
      }),
    );
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe('99'));
    expect(within(panel).getByRole('status').textContent).toContain('登録し、統合先に選びました');
  });

  it('統合先の登録をやめると開始ボタンへフォーカスを戻す', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    const path = `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`;
    renderPage({ data, detail: unregisteredDetail, path });
    const panel = await detailPanel();
    await within(panel).findByRole('combobox', { name: '統合先' });
    const trigger = within(panel).getByRole('button', { name: '新しい統合先を登録' });
    fireEvent.click(trigger);

    const input = within(panel).getByRole('textbox', { name: '新しい統合先の名前' });
    expect(document.activeElement).toBe(input);
    fireEvent.click(within(panel).getByRole('button', { name: 'やめる' }));

    const restoredTrigger = within(panel).getByRole('button', { name: '新しい統合先を登録' });
    expect(document.activeElement).toBe(restoredTrigger);
  });

  it('新しい統合先の重複は入力の近くで既存選択へ案内する', async () => {
    const data = { ...fixtureScreen, rows: [unregistered, ...fixtureRows] };
    const path = `/subscriptions?vendor=${encodeURIComponent(unregistered.vendorKey)}`;
    renderPage({
      data,
      detail: unregisteredDetail,
      path,
      handler: (url, init) => {
        if (url === '/api/sub-vendors' && init?.method === 'POST') {
          return json(
            { error: { code: 'duplicate', message: '同じ名前のベンダーが既に登録されています' } },
            409,
          );
        }
        return undefined;
      },
    });
    const panel = await detailPanel();
    await within(panel).findByRole('combobox', { name: '統合先' });
    fireEvent.click(within(panel).getByRole('button', { name: '新しい統合先を登録' }));
    fireEvent.change(within(panel).getByRole('textbox', { name: '新しい統合先の名前' }), {
      target: { value: 'Spotify' },
    });
    fireEvent.click(within(panel).getByRole('button', { name: '登録して統合先に選ぶ' }));

    const error = await within(panel).findByRole('alert');
    expect(error.textContent).toContain('すでにあります');
    expect(error.textContent).toContain('上の一覧から選んでください');
  });

  it('候補として確認すると判断 API に confirmed を送る', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/subscriptions/review-decisions?span=1',
        body: { vendorKey: 'spotify', decision: 'confirmed' },
      }),
    );
  });

  it('判断後は画面と詳細だけを再取得し、開いた補助データを取り直さず状態を更新する', async () => {
    let confirmed = false;
    const { calls } = renderPage({
      path: '/subscriptions?vendor=spotify',
      handler: (url, init) => {
        const method = init?.method ?? 'GET';
        if (url.startsWith('/api/subscriptions/review-decisions') && method === 'POST') {
          confirmed = true;
          return json({ ok: true });
        }
        if (!confirmed || method !== 'GET') return undefined;
        const confirmedRow = { ...spotify, review: { ...spotify.review!, state: 'confirmed' as const } };
        if (url.includes('/api/subscriptions/vendors/')) {
          return json({ ...spotifyDetail, row: confirmedRow });
        }
        if (url.includes('/api/subscriptions')) {
          return json({
            ...fixtureScreen,
            rows: fixtureRows.map((row) => (row.vendorKey === 'spotify' ? confirmedRow : row)),
          });
        }
        return undefined;
      },
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    await within(panel).findByRole('checkbox', { name: '支払手数料' });
    await waitFor(() => expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(1));
    const vendorGets = getCount(calls, '/api/sub-vendors');
    const candidateGets = getCount(calls, '/api/sub-vendors/candidates');
    fireEvent.click(within(panel).getByRole('tab', { name: '概要' }));
    fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
    await within(panel).findByRole('button', { name: '確認を取り消す' });
    expect(getCount(calls, '/api/sub-vendors')).toBe(vendorGets);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(candidateGets);
  });

  it('判断は表示中の期間を付けて送る (指紋はサーバがその期間で求める)', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'span', span: 3 }));
    try {
      const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
      const panel = await detailPanel();
      fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
      await waitFor(() =>
        expect(calls.filter((call) => call.method === 'POST').map((call) => call.url)).toContain(
          '/api/subscriptions/review-decisions?span=3',
        ),
      );
    } finally {
      localStorage.removeItem('kanjo:period');
    }
  });

  it('2 件チェックで選択中バーが出て統合 API を呼ぶ', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();
    for (const box of within(raw).getAllByRole('checkbox')) fireEvent.click(box);

    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(bar.textContent).toContain('2件の取引を選択中');
    expect(screen.getAllByRole('button', { name: /統合/ })).toHaveLength(1);
    expect(within(panel).queryByRole('button', { name: '名称を統合' })).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: '選択した2件を統合' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/sub-vendors/3/aliases',
        body: { aliases: ['Spotify', 'SPOTIFY.COM'] },
      }),
    );
    // 統合が通ったら選択は空になり、バーは消える
    await waitFor(() => expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull());
  });

  it('選択を解除すると下部バーが消え、チェックも外れる', async () => {
    renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    const raw = await within(panel).findByRole('group', { name: 'マッチした生の取引名（2件）' });
    fireEvent.click(within(raw).getAllByRole('checkbox')[0]!);
    const bar = screen.getByRole('region', { name: '選択中の取引' });
    expect(within(bar).getAllByRole('button', { name: '選択を解除' })).toHaveLength(1);
    fireEvent.click(within(bar).getByRole('button', { name: '選択を解除' }));
    expect(screen.queryByRole('region', { name: '選択中の取引' })).toBeNull();
    expect(
      within(raw)
        .getAllByRole('checkbox')
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
  });

  it('関連データタブ', async () => {
    const { calls } = renderPage({ path: '/subscriptions?vendor=spotify' });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    expect(within(panel).getByRole('heading', { name: '別名' })).toBeTruthy();
    expect(within(panel).getByText('SPOTIFY.COM')).toBeTruthy();
    expect(within(panel).getByRole('group', { name: '対象科目' })).toBeTruthy();
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    fireEvent.click(within(review).getAllByRole('button')[0]!);
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'POST' && call.url === '/api/sub-vendors/3/review')).toBe(
        true,
      ),
    );
  });
});

/* ---------------- 検出理由 ---------------- */

describe('サブスク候補の検出理由', () => {
  it('最優先の1件を代表表示し、残りは既存の候補絞り込みへ渡す', async () => {
    renderPage();
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute('data-vendor-key')).toBe('adobecreativecloud');
    expect(items[0]!.textContent).toContain('¥2,480 → ¥2,728 (+10.0%)');

    fireEvent.click(within(card).getByRole('button', { name: '他1件を候補一覧で見る →' }));
    const filter = screen.getByRole('combobox', { name: 'ステータスで絞り込む' });
    await waitFor(() => expect((filter as HTMLSelectElement).value).toBe('review'));
    expect(bodyRows().map((row) => row.getAttribute('data-vendor-key'))).toEqual([
      'adobecreativecloud',
      'spotify',
    ]);
  });

  it('理由カードは判断を持たず、詳細内のみから判断 API に送る', async () => {
    const { calls } = renderPage();
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    expect(within(card).queryByRole('button', { name: /候補から除外/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    const panel = await detailPanel();
    const decisions = await within(panel).findByRole('region', { name: '候補の判断' });
    fireEvent.click(within(decisions).getByRole('button', { name: '候補から除外' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/subscriptions/review-decisions?span=1',
        body: { vendorKey: 'spotify', decision: 'dismissed' },
      }),
    );
  });

  it('未登録の候補も詳細内の一か所で採用・除外する', async () => {
    const data = {
      ...fixtureScreen,
      kpis: { ...fixtureScreen.kpis, reviewCandidates: 3 },
      rows: [unregistered, ...fixtureRows],
    };
    const { calls } = renderPage({ data, detail: unregisteredDetail });
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(1);
    expect(within(card).getByRole('button', { name: '他2件を候補一覧で見る →' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'この候補を詳しく見る →' }));
    const panel = await detailPanel();
    const decisions = await within(panel).findByRole('region', { name: '候補の判断' });
    fireEvent.click(within(decisions).getByRole('button', { name: '架空動画を候補として採用' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/sub-vendors',
        body: { name: '架空動画', aliases: [], accounts: [] },
      }),
    );
    fireEvent.click(within(decisions).getByRole('button', { name: '架空動画を候補から除外' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        url: '/api/sub-vendors/exclusions',
        body: { partner: '架空動画' },
      }),
    );
  });
});

/* ---------------- 読込・空・失敗 ---------------- */

describe('読込中・空・失敗', () => {
  it('読込中は枠と見出しを先に出す', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderPage({
      handler: async (url) => {
        if (url.includes('/api/subscriptions')) {
          await gate;
          return json(fixtureScreen);
        }
        return undefined;
      },
    });
    expect(screen.getByRole('heading', { name: 'サブスク一覧' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'データソースのカバー率' })).toBeTruthy();
    expect(screen.getByText('サブスクを読み込んでいます')).toBeTruthy();
    release();
    await kpiRegion();
    expect(screen.getByRole('table', { name: 'サブスク一覧' })).toBeTruthy();
  });

  it('期間にサブスクが無ければ取込への導線を出す', async () => {
    renderPage({
      data: {
        ...fixtureScreen,
        kpis: { ...fixtureScreen.kpis, monthlyTotal: 0, annualized: 0, reviewCandidates: 0 },
        rows: [],
      },
    });
    const empty = await screen.findByText('この期間にサブスクの支払いはありません');
    expect(empty.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'データ取込へ' }).getAttribute('href')).toBe('/import');
    expect(screen.queryByRole('table', { name: 'サブスク一覧' })).toBeNull();
  });

  it('取得に失敗したら再試行できる', async () => {
    let fail = true;
    renderPage({
      handler: (url) => {
        if (url.includes('/api/subscriptions') && fail) return json({ error: 'internal' }, 500);
        return undefined;
      },
    });
    const alert = await screen.findByRole('alert');
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: '再試行' }));
    await kpiRegion();
  });

  it('更新に失敗したら上部に通知し、再試行で同じ操作を送り直す', async () => {
    let fail = true;
    const { calls } = renderPage({
      handler: (url, init) => {
        if (url.includes('/review-decisions') && init?.method === 'POST' && fail) {
          return json({ error: 'internal' }, 500);
        }
        return undefined;
      },
    });
    const card = await screen.findByRole('region', { name: 'サブスク候補の検出理由' });
    expect(within(card).queryByRole('button', { name: /候補から除外/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spotifyの詳細を表示' }));
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('button', { name: '候補として確認' }));
    const alert = await screen.findByRole('alert');
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: /再試行する/ }));
    await waitFor(() =>
      expect(calls.filter((call) => call.url === '/api/subscriptions/review-decisions?span=1')).toHaveLength(
        2,
      ),
    );
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('関連データの補助取得に失敗したら対象ごとの失敗と再試行を表示する', async () => {
    const { calls } = renderPage({
      path: '/subscriptions?vendor=spotify',
      handler: (url, init) => {
        if ((init?.method ?? 'GET') !== 'GET') return undefined;
        if (url === '/api/sub-vendors' || url === '/api/sub-vendors/candidates') {
          return json({ error: 'internal' }, 500);
        }
        return undefined;
      },
    });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    expect(await within(panel).findByText('対象科目の候補を読み込めませんでした。')).toBeTruthy();
    expect(await within(panel).findByText('除外した支払先を読み込めませんでした。')).toBeTruthy();
    expect(within(panel).getAllByRole('button', { name: '再試行' })).toHaveLength(2);
    expect(getCount(calls, '/api/sub-vendors')).toBe(1);
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(1);
  });
});

/* ---------------- 旧 UI から移した操作 (旧 SubVendors.dom.test / subs-review.dom.test の検査を移設) ---------------- */

describe('旧 UI から移した操作', () => {
  const openRelated = async (options: Parameters<typeof renderPage>[0] = {}) => {
    const view = renderPage({ path: '/subscriptions?vendor=spotify', ...options });
    const panel = await detailPanel();
    fireEvent.click(await within(panel).findByRole('tab', { name: '関連データ' }));
    await within(panel).findByRole('checkbox', { name: '支払手数料' });
    await waitFor(() => expect(getCount(view.calls, '/api/sub-vendors/candidates')).toBe(1));
    return { ...view, panel };
  };

  it('対象科目をチェックすると accounts だけを PUT する (旧: 対象科目を編集して保存)', async () => {
    const { calls, panel } = await openRelated();
    const accounts = within(panel).getByRole('group', { name: '対象科目' });
    expect((within(accounts).getByRole('checkbox', { name: '通信費' }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(within(accounts).getByRole('checkbox', { name: '支払手数料' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PUT',
        url: '/api/sub-vendors/3',
        body: { accounts: ['通信費', '支払手数料'] },
      }),
    );
  });

  it('別名を消すと残りの別名で PUT する (統合の取消)', async () => {
    const { calls, panel } = await openRelated();
    fireEvent.click(within(panel).getByRole('button', { name: '別名「SPOTIFY.COM」を削除' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'PUT', url: '/api/sub-vendors/3', body: { aliases: [] } }),
    );
  });

  it('「見直した」は記録だけを送る (登録内容は変えないので PUT しない)', async () => {
    const { calls, panel } = await openRelated();
    const vendorGets = getCount(calls, '/api/sub-vendors');
    const candidateGets = getCount(calls, '/api/sub-vendors/candidates');
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    fireEvent.click(within(review).getByRole('button', { name: '見直した' }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.url === '/api/sub-vendors/3/review')).toBe(true),
    );
    expect(calls.some((call) => call.method === 'PUT')).toBe(false);
    await waitFor(() => expect(getCount(calls, '/api/sub-vendors')).toBeGreaterThan(vendorGets));
    expect(getCount(calls, '/api/sub-vendors/candidates')).toBe(candidateGets);
  });

  it('一度も見直していなければ「まだ見直していません」、期限を過ぎたら「見直し時期」を出す', async () => {
    const { panel } = await openRelated({
      detail: { ...spotifyDetail, related: { ...spotifyDetail.related!, reviewedAt: null, reviewDue: true } },
    });
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    expect(review.textContent).toContain('まだ見直していません');
    expect(within(review).getByText('見直し時期')).toBeTruthy();
  });

  it('期限内は「見直し時期」を出さない (催促を出しすぎない)', async () => {
    const { panel } = await openRelated();
    const review = within(panel).getByRole('region', { name: '四半期の見直し' });
    expect(within(review).queryByText('見直し時期')).toBeNull();
  });

  it('除外した支払先は関連データに出て、取り消すと DELETE を送る', async () => {
    const { calls, panel } = await openRelated({
      handler: (url, init) =>
        url.includes('/api/sub-vendors/candidates') && (init?.method ?? 'GET') === 'GET'
          ? json({ candidates: [], excluded: [{ id: 3, partner: '架空家賃' }], dealRows: 0 })
          : undefined,
    });
    const vendorGets = getCount(calls, '/api/sub-vendors');
    const candidateGets = getCount(calls, '/api/sub-vendors/candidates');
    fireEvent.click(await within(panel).findByRole('button', { name: '架空家賃の除外を取り消す' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'DELETE',
        url: '/api/sub-vendors/exclusions/3',
        body: undefined,
      }),
    );
    await waitFor(() =>
      expect(getCount(calls, '/api/sub-vendors/candidates')).toBeGreaterThan(candidateGets),
    );
    expect(getCount(calls, '/api/sub-vendors')).toBe(vendorGets);
  });

  it('登録の解除は確認ダイアログを経てから DELETE を送る', async () => {
    const { calls, panel } = await openRelated();
    fireEvent.click(within(panel).getByRole('button', { name: '登録の解除' }));
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    const dialog = await screen.findByRole('dialog', { name: '「Spotify」の登録を解除しますか？' });
    fireEvent.click(within(dialog).getByRole('button', { name: '登録を解除する' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'DELETE', url: '/api/sub-vendors/3', body: undefined }),
    );
  });
});
