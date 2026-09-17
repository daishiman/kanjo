// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
/**
 * 推移画面の意味ブロックと URL 状態 (SYS-TRENDS-P04/P05)。
 *
 * 置換前の画面は傾向の判定 (MF だけ) しか描かず、metric・compare・month・category を URL から読まない。
 * ここでは総収支と同じ集合の比較画面が並ぶ順番、URL の復元と書き戻し、遷移先、状態表示を固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrendRow, TrendsResponse, TrendsScreen } from '../../api.js';
import { TrendsPage } from './Trends.js';
import { Spark } from './trends/Spark.js';
import { changeTone } from './trends/format.js';
import { buildChangeParetoViewModel, buildTrendSeriesViewModel } from './trends/view-model.js';

const { chartRenderCalls } = vi.hoisted(() => ({ chartRenderCalls: [] as Record<string, unknown>[] }));

vi.mock('react-chartjs-2', async () => {
  const { createElement, forwardRef } = await import('react');
  const ChartDouble = forwardRef<unknown, Record<string, unknown>>((props, _ref) => {
    chartRenderCalls.push(props);
    return createElement('div', { role: 'img', 'aria-label': props['aria-label'] });
  });
  ChartDouble.displayName = 'ChartDouble';
  return { Chart: ChartDouble, getElementAtEvent: () => [] };
});

const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

const row = (over: Partial<TrendRow> & Pick<TrendRow, 'account' | 'side'>): TrendRow => ({
  key: `${over.side}:${over.account}`,
  total: 600000,
  share: 0.4,
  monthlyAvg: 100000,
  cv: 0.2,
  type: '固定費',
  slopePerMonth: 5000,
  slopeRatio: 0.05,
  annualImpact: 60000,
  mk: { s: 15, tau: 1, z: 2.6, p: 0.009, n: 6 },
  direction: '増加',
  recentAvg: 120000,
  priorAvg: 80000,
  presenceRate: 1,
  gapMonths: [],
  series: [80000, 90000, 100000, 110000, 115000, 120000],
  action: '削減を検討',
  score: 1000,
  reason: '毎月じわじわ増えている',
  ...over,
});

const payload = (over: Partial<TrendsResponse> = {}): TrendsResponse => ({
  months,
  recordedMonths: months,
  unrecordedExpMonths: [],
  expenseTotal: 1500000,
  monthlyAvg: 250000,
  rows: [
    row({ account: '外注費', side: 'biz' }),
    row({
      account: '食費',
      side: 'personal',
      total: 300000,
      share: 0.2,
      monthlyAvg: 50000,
      direction: '横ばい',
      action: '継続監視',
      annualImpact: 0,
      reason: '横ばいだが規模が大きい',
    }),
  ],
  pareto: [
    { account: '外注費', side: 'biz', key: 'biz:外注費', total: 600000, share: 0.4, cumShare: 0.4 },
    { account: '食費', side: 'personal', key: 'personal:食費', total: 300000, share: 0.2, cumShare: 0.6 },
  ],
  coreCount: 3,
  breakdown: {
    beforeMonths: months.slice(0, 3),
    afterMonths: months.slice(3),
    beforeTotal: 700000,
    afterTotal: 800000,
    diff: 100000,
    rows: [
      {
        account: '外注費',
        side: 'biz',
        key: 'biz:外注費',
        before: 80000,
        after: 120000,
        diff: 40000,
        contribution: 0.4,
      },
    ],
  },
  counts: { 削減を検討: 1, 継続監視: 1, 記録を整える: 0, 対応不要: 0 },
  scope: 'all',
  scopeLabel: '事業+家計',
  sides: [
    {
      side: 'biz',
      label: '事業',
      total: 1200000,
      monthlyAvg: 200000,
      share: 0.8,
      accountCount: 4,
      topAccount: { account: '外注費', total: 600000 },
    },
    {
      side: 'personal',
      label: '家計',
      total: 300000,
      monthlyAvg: 50000,
      share: 0.2,
      accountCount: 2,
      topAccount: { account: '食費', total: 300000 },
    },
  ],
  monthlySides: months.map((month) => ({ month, biz: 200000, personal: 50000, total: 250000 })),
  period: {
    applied: null,
    label: '全期間',
    full: { from: months[0], to: months[5] },
    years: ['2026'],
    monthCount: 6,
  },
  ...over,
});

const spark = (last: number) => [...Array<number | null>(9).fill(null), last / 3, last / 3, last / 3];

const screenPart = (over: Partial<TrendsScreen> = {}): TrendsScreen => ({
  metrics: [
    {
      id: 'income',
      label: '収入',
      betterWhen: 'higher',
      visualRole: 'income',
      controlOrder: 1,
      showInOverview: true,
    },
    {
      id: 'expense',
      label: '支出',
      betterWhen: 'lower',
      visualRole: 'expense',
      controlOrder: 0,
      showInOverview: true,
    },
    {
      id: 'net',
      label: '純収支',
      betterWhen: 'higher',
      visualRole: 'net',
      controlOrder: 2,
      showInOverview: true,
    },
  ],
  selection: {
    scope: 'total',
    metric: 'expense',
    compare: 'previous',
    month: '2026-03',
    side: null,
    category: null,
    payee: null,
  },
  comparePeriod: { from: '2025-07', to: '2025-12', label: '前6か月' },
  compareUnavailable: null,
  series: {
    months,
    compareMonths: ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'],
    values: {
      income: { current: months.map(() => 300000), compare: months.map(() => 300000) },
      expense: {
        current: [100000, 100000, 352300, 100000, 100000, 100000],
        compare: months.map(() => 100000),
      },
      net: { current: [200000, 200000, -52300, 200000, 200000, 200000], compare: months.map(() => 200000) },
    },
    diff: [0, 0, 252300, 0, 0, 0],
  },
  kpis: {
    current: 852300,
    change: { amount: 252300, rate: 0.42, basis: 'compare_period' },
    peakMonth: { month: '2026-03', diff: 252300, reason: '広告宣伝費が架空広告社1件で¥240,000増' },
  },
  detail: {
    month: '2026-03',
    values: {
      income: { current: 300000, compare: 300000 },
      expense: { current: 352300, compare: 100000 },
      net: { current: -52300, compare: 200000 },
    },
    drivers: [
      {
        category: '広告宣伝費',
        side: 'business',
        change: 240000,
        payee: '架空広告社',
        origin: 'freee',
        text: '広告宣伝費が架空広告社1件で¥240,000増',
      },
      {
        category: '食費',
        side: 'household',
        change: -12300,
        payee: '架空スーパー',
        origin: 'mf',
        text: '食費が架空スーパー1件で¥12,300減',
      },
    ],
    sources: [
      { origin: 'mf', account: '架空カード', count: 3 },
      { origin: 'freee', account: null, count: 1 },
    ],
  },
  sparkMonths: ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', ...months],
  categories: [
    {
      name: '広告宣伝費',
      side: 'business',
      origin: 'freee',
      spark: spark(252300),
      sparkMonths: [],
      current: 252300,
      compare: 12300,
      change: 240000,
      changeRate: 19.5,
      share: 0.3,
      contribution: 0.95,
      payees: [
        {
          payee: '架空広告社',
          side: 'business',
          origin: 'freee',
          spark: spark(252300),
          sparkMonths: [],
          current: 252300,
          compare: 12300,
          change: 240000,
          changeRate: 19.5,
          share: 0.3,
          contribution: 0.95,
        },
      ],
    },
    {
      name: '食費',
      side: 'household',
      origin: 'mf',
      spark: spark(600000),
      sparkMonths: [],
      current: 600000,
      compare: 612300,
      change: -12300,
      changeRate: -0.02,
      share: 0.7,
      contribution: -0.05,
      payees: [
        {
          payee: '架空スーパー',
          side: 'household',
          origin: 'mf',
          spark: spark(600000),
          sparkMonths: [],
          current: 600000,
          compare: 612300,
          change: -12300,
          changeRate: -0.02,
          share: 0.7,
          contribution: -0.05,
        },
      ],
    },
  ],
  changePareto: [
    { name: '広告宣伝費', side: 'business', change: 240000, cumulativeShare: 0.1 },
    { name: '食費', side: 'household', change: -12300, cumulativeShare: 0.2 },
  ],
  topMovers: [],
  review: { count: 2, amount: 8800, monthCount: 1, monthAmount: 4400 },
  recommended: {
    month: '2026-03',
    category: '広告宣伝費',
    payee: '架空広告社',
    change: 240000,
    changeRate: null,
    origin: 'freee',
    side: 'business',
    href: '/analysis/total-cashflow?month=2026-03',
  },
  focus: null,
  ...over,
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

const currentSearch = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

interface CapturedDataset {
  label?: string;
  type?: string;
  data?: unknown[];
  borderDash?: number[];
}

interface CapturedChart {
  type?: string;
  'aria-label'?: string;
  data?: { datasets?: CapturedDataset[] };
  options?: { plugins?: { legend?: { display?: boolean } } };
  plugins?: { id?: string }[];
}

const capturedChart = (name: string) =>
  chartRenderCalls.find((call) => call['aria-label'] === name) as CapturedChart | undefined;

function renderAt(path: string, make: (url: URL) => Partial<TrendsResponse> | Response = () => ({})) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const made = make(new URL(String(input), 'http://localhost'));
      if (made instanceof Response) return made;
      return new Response(JSON.stringify(payload(made)), { headers: { 'Content-Type': 'application/json' } });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <TrendsPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return urls;
}

const withScreen =
  (over: Partial<TrendsScreen> = {}) =>
  () => ({ ...screenPart(over), judgementBasis: 'mf_only' as const });

beforeEach(() => {
  chartRenderCalls.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('推移チャートの意味契約', () => {
  it('API 登録順の今回3系列・選択指標の比較・月次差・選択月帯を分離する', () => {
    const model = buildTrendSeriesViewModel(screenPart());

    expect(model.labels).toEqual(months);
    expect(model.currentSeries.map(({ key, label, role, values }) => ({ key, label, role, values }))).toEqual(
      [
        { key: 'current-income', label: '収入(今回)', role: 'income', values: months.map(() => 300000) },
        {
          key: 'current-expense',
          label: '支出(今回)',
          role: 'expense',
          values: [100000, 100000, 352300, 100000, 100000, 100000],
        },
        {
          key: 'current-net',
          label: '純収支(今回)',
          role: 'net',
          values: [200000, 200000, -52300, 200000, 200000, 200000],
        },
      ],
    );
    expect(model.comparisonSeries).toEqual({
      key: 'comparison-expense',
      label: '支出(前6か月)',
      role: 'comparison',
      values: months.map(() => 100000),
    });
    expect(model.differenceSeries).toEqual({
      key: 'difference',
      label: '月次差',
      role: 'difference',
      values: [0, 0, 252300, 0, 0, 0],
    });
    expect(model.selectionBand).toEqual({ month: '2026-03', index: 2 });
  });

  it('パレートは減少の符号を保ち、絶対寄与から累積比を再計算する', () => {
    const model = buildChangeParetoViewModel(screenPart());

    expect(model.rows.map(({ name, side, change }) => ({ name, side, change }))).toEqual([
      { name: '広告宣伝費', side: 'business', change: 240000 },
      { name: '食費', side: 'household', change: -12300 },
    ]);
    expect(model.rows[0]?.cumulativeShare).toBeCloseTo(240000 / 252300);
    expect(model.rows[1]?.cumulativeShare).toBe(1);
    expect(model.totalContribution).toBe(252300);
  });

  it('概要対象外の新指標でも選択時は主図へ出す', () => {
    const base = screenPart();
    const model = buildTrendSeriesViewModel({
      ...base,
      metrics: [
        ...base.metrics,
        {
          id: 'count',
          label: '件数',
          betterWhen: 'higher',
          visualRole: 'neutral',
          controlOrder: 3,
          showInOverview: false,
        },
      ],
      selection: { ...base.selection, metric: 'count' },
      series: {
        ...base.series,
        values: {
          ...base.series.values,
          count: { current: months.map(() => 3), compare: months.map(() => 2) },
        },
      },
    });

    expect(model.currentSeries.at(-1)).toMatchObject({ key: 'current-count', label: '件数(今回)' });
    expect(model.comparisonSeries).toMatchObject({ key: 'comparison-count', label: '件数(前6か月)' });
  });

  it('改善方向に応じて同じ符号を逆の意味色へ写す', () => {
    expect(changeTone(100, 'higher')).toBe('favorable');
    expect(changeTone(100, 'lower')).toBe('unfavorable');
    expect(changeTone(-100, 'higher')).toBe('unfavorable');
    expect(changeTone(-100, 'lower')).toBe('favorable');
    expect(changeTone(100, undefined)).toBe('neutral');
  });

  it('Spark は null の空白を線で跨がない', () => {
    const { container } = render(<Spark series={[1, 2, null, 3, 4]} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
  });
});

describe('推移画面の構成', () => {
  it('比較条件に名前があり、主要2図を並べ、新画面に旧判定を重複表示しない', async () => {
    renderAt('/analysis/trends', withScreen());
    const conditions = await screen.findByRole('region', { name: '比較条件' });
    expect(within(conditions).getByRole('tablist', { name: '集計の範囲' })).toBeTruthy();
    expect(within(conditions).getByRole('group', { name: '表示する指標' })).toBeTruthy();
    expect(within(conditions).getByRole('group', { name: '比較対象' })).toBeTruthy();
    for (const label of ['分析の範囲', '表示する指標', '比較対象']) {
      expect(within(conditions).getByText(label)).toBeTruthy();
    }

    const figureTitles = screen
      .getAllByRole('figure')
      .map((figure) => within(figure).getByRole('heading').textContent);
    expect(figureTitles).toEqual(['収支の推移', '増減の要因(パレート図)']);
    expect(
      screen.getByRole('img', { name: '収入・支出・純収支の月別推移と比較期間、月次差を示す図' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'カテゴリ別の符号付き増減額と累計絶対寄与を示す図' }),
    ).toBeTruthy();

    const order = [
      conditions,
      screen.getByText('最も変化が大きい月'),
      screen.getByRole('complementary', { name: '選択した月の詳細' }),
      screen.getByRole('heading', { name: 'カテゴリ別の推移と増減' }),
      screen.getByRole('heading', { name: '増減が大きい項目(上位3つ)' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByText('統計による傾向判定を表示')).toBeNull();
    expect(screen.queryByText('手を打つ順番')).toBeNull();
  });

  it('実描画へ今回3系列・比較点線・月次差棒を渡し、パレートの減少を負値のまま渡す', async () => {
    renderAt('/analysis/trends', withScreen());
    await screen.findByRole('img', {
      name: '収入・支出・純収支の月別推移と比較期間、月次差を示す図',
    });

    const series = capturedChart('収入・支出・純収支の月別推移と比較期間、月次差を示す図');
    const seriesDatasets = series?.data?.datasets ?? [];
    const dataset = (label: string) => seriesDatasets.find((item) => item.label === label);
    for (const label of ['収入(今回)', '支出(今回)', '純収支(今回)']) {
      expect(dataset(label)).toBeTruthy();
    }
    expect(dataset('支出(前6か月)')?.type ?? series?.type).toBe('line');
    expect(dataset('支出(前6か月)')?.borderDash?.length).toBeGreaterThan(0);
    expect(dataset('月次差')?.type).toBe('bar');
    expect(series?.plugins?.some((plugin) => plugin.id === 'trendsSelectedMonthBand')).toBe(true);
    expect(series?.options?.plugins?.legend?.display).toBe(false);

    const pareto = capturedChart('カテゴリ別の符号付き増減額と累計絶対寄与を示す図');
    expect(pareto?.data?.datasets?.find((item) => item.label === '増減額')?.data).toEqual([240000, -12300]);
    expect(pareto?.options?.plugins?.legend?.display).toBe(false);
  });

  it('カテゴリ比較表は8列の専用幅契約を持ち、カテゴリの展開と選択を1つの操作へ束ねる', async () => {
    renderAt('/analysis/trends', withScreen());
    const section = (await screen.findByRole('heading', { name: 'カテゴリ別の推移と増減' }))
      .parentElement as HTMLElement;
    const table = within(section).getByRole('table');
    expect(table.classList.contains('trends-category-table')).toBe(true);
    expect(table.classList.contains('stack-sm')).toBe(true);
    expect(table.parentElement?.classList.contains('trends-category-table-wrap')).toBe(true);
    expect(
      [...table.querySelectorAll('col')].map((column) =>
        [...column.classList].find((name) => name.startsWith('trends-category-col--')),
      ),
    ).toEqual([
      'trends-category-col--category',
      'trends-category-col--spark',
      'trends-category-col--current',
      'trends-category-col--compare',
      'trends-category-col--change',
      'trends-category-col--rate',
      'trends-category-col--share',
      'trends-category-col--contribution',
    ]);

    const disclosure = within(section).getByRole('button', {
      name: '広告宣伝費(事業)の取引先を表示',
    });
    const categoryCell = disclosure.closest('th');
    expect(categoryCell?.getAttribute('scope')).toBe('row');
    expect(within(categoryCell as HTMLElement).getAllByRole('button')).toHaveLength(1);
    expect(disclosure.querySelector('.trends-category-name')?.textContent).toBe('広告宣伝費');
    expect(disclosure.querySelector('.pill')?.textContent).toBe('事業');
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(within(section).getByText('取引先の内訳')).toBeTruthy();
  });

  it('カテゴリ比較表は8列すべてを3状態でソートし、展開行を親カテゴリと一緒に動かす', async () => {
    const categories = screenPart().categories.map((category) => ({
      ...category,
      spark:
        category.name === '広告宣伝費'
          ? [...Array<number | null>(10).fill(null), 10, 50]
          : [...Array<number | null>(10).fill(null), 100, 90],
    }));
    renderAt('/analysis/trends', withScreen({ categories }));
    const section = (await screen.findByRole('heading', { name: 'カテゴリ別の推移と増減' }))
      .parentElement as HTMLElement;
    const table = within(section).getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers).toHaveLength(8);
    for (const header of headers) expect(within(header).getByRole('button')).toBeTruthy();

    const categoryNames = () =>
      [...table.querySelectorAll('tbody > tr > th[scope="row"] .trends-category-name')].map(
        (node) => node.textContent,
      );
    const current = within(table).getByRole('button', { name: '今回合計' });
    fireEvent.click(current);
    expect(current.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(current);
    expect(current.closest('th')?.getAttribute('aria-sort')).toBe('descending');
    expect(categoryNames()).toEqual(['食費', '広告宣伝費']);
    fireEvent.click(current);
    expect(current.closest('th')?.getAttribute('aria-sort')).toBeNull();
    expect(categoryNames()).toEqual(['広告宣伝費', '食費']);

    const sparkHeader = within(table).getByRole('button', { name: '12か月の推移' });
    fireEvent.click(sparkHeader);
    expect(sparkHeader.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(categoryNames()).toEqual(['食費', '広告宣伝費']);

    fireEvent.click(within(section).getByRole('button', { name: '広告宣伝費(事業)の取引先を表示' }));
    expect(within(section).getByText('取引先の内訳')).toBeTruthy();
    expect(categoryNames()).toEqual(['食費', '広告宣伝費', '架空広告社']);
  });

  it('指標の切替は API の metrics から作り、増減は符号と文字を併記する', async () => {
    renderAt('/analysis/trends', withScreen());
    const group = await screen.findByRole('group', { name: '表示する指標' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['支出', '収入', '純収支']);
    expect(document.body.textContent).toContain('+252,300 円 (増)');
    expect(document.body.textContent).toContain('−12,300 円 (減)');
  });

  it('詳細パネルは要因・圧縮した出典・要確認件数・初期CTAを出す', async () => {
    renderAt('/analysis/trends', withScreen());
    const detail = await screen.findByRole('complementary', { name: '選択した月の詳細' });
    expect(detail.textContent).toContain('2026年3月');
    expect(detail.textContent).toContain('広告宣伝費が架空広告社1件で¥240,000増');
    expect(detail.textContent).toContain('MF ・ 架空カード ・ 3件、他1件');
    expect(detail.textContent).toContain('要確認 1 件');
    expect(screen.getByRole('region', { name: '比較条件' }).textContent).toContain('要確認 2 件');
    expect(within(detail).getByRole('link', { name: '広告宣伝費を総収支で確認' }).getAttribute('href')).toBe(
      '/analysis/total-cashflow?month=2026-03',
    );
  });

  it('新しいフィールドが無い応答では、傾向の判定だけを開いて描く', async () => {
    renderAt('/analysis/trends');
    const summary = await screen.findByText('統計による傾向判定を表示');
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(within(details).getByText('手を打つ順番')).toBeTruthy();
    expect(screen.queryByRole('region', { name: '比較条件' })).toBeNull();
  });
});

describe('URL の状態', () => {
  it('URL の条件を API へ渡し、scope は旧名で送る', async () => {
    const urls = renderAt(
      '/analysis/trends?scope=household&metric=net&compare=yoy&month=2026-02',
      withScreen(),
    );
    await screen.findByRole('region', { name: '比較条件' });
    const q = new URL(urls[0], 'http://localhost').searchParams;
    expect(q.get('scope')).toBe('personal');
    expect(q.get('metric')).toBe('net');
    expect(q.get('compare')).toBe('yoy');
    expect(q.get('month')).toBe('2026-02');
  });

  it('形式違反の値は既定値として読み、URL も書き換える', async () => {
    const urls = renderAt(
      '/analysis/trends?scope=x&compare=zz&month=2026-13&side=household&payee=a',
      withScreen(),
    );
    await screen.findByRole('region', { name: '比較条件' });
    const q = new URL(urls[0], 'http://localhost').searchParams;
    expect(q.get('scope')).toBe('all');
    expect(q.has('compare')).toBe(false);
    expect(q.has('month')).toBe(false);
    expect(q.has('side')).toBe(false);
    await waitFor(() => {
      const search = currentSearch();
      expect(search.get('scope')).toBe('total');
      expect(search.get('compare')).toBe('previous');
      expect(search.get('month')).toBeNull();
      expect(search.has('side')).toBe(false);
      expect(search.has('payee')).toBe(false);
    });
  });

  it('未登録の metric は URL から外して取り直す', async () => {
    const urls = renderAt('/analysis/trends?metric=unknown', (url) =>
      url.searchParams.get('metric')
        ? new Response(JSON.stringify({ error: { code: 'invalid_metric', message: 'metric が不正です' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        : withScreen()(),
    );
    await screen.findByRole('region', { name: '比較条件' });
    expect(currentSearch().has('metric')).toBe(false);
    expect(new URL(urls.at(-1) as string, 'http://localhost').searchParams.has('metric')).toBe(false);
  });

  it('範囲・指標・月・カテゴリの操作が URL へ残る', async () => {
    renderAt('/analysis/trends', withScreen());
    fireEvent.click(await screen.findByRole('tab', { name: '事業' }));
    await waitFor(() => expect(currentSearch().get('scope')).toBe('business'));
    fireEvent.click(
      within(screen.getByRole('group', { name: '表示する指標' })).getByRole('button', { name: '収入' }),
    );
    await waitFor(() => expect(currentSearch().get('metric')).toBe('income'));
    fireEvent.change(await screen.findByRole('combobox', { name: '詳細を表示する月' }), {
      target: { value: '2026-02' },
    });
    await waitFor(() => expect(currentSearch().get('month')).toBe('2026-02'));
    const categoryTable = (await screen.findByRole('heading', { name: 'カテゴリ別の推移と増減' }))
      .parentElement as HTMLElement;
    fireEvent.click(within(categoryTable).getByRole('button', { name: /食費.*取引先を表示/ }));
    await waitFor(() => {
      expect(currentSearch().get('side')).toBe('household');
      expect(currentSearch().get('category')).toBe('食費');
    });
  });
});

describe('比較できないとき・遷移先', () => {
  it('全期間では比較対象を押せず、その旨を出す', async () => {
    renderAt(
      '/analysis/trends',
      withScreen({ comparePeriod: null, compareUnavailable: 'all_period', changePareto: [] }),
    );
    const group = await screen.findByRole('group', { name: '比較対象' });
    for (const b of within(group).getAllByRole('button'))
      expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/全期間では比較できません/)).toBeTruthy();
    for (const heading of [
      'カテゴリ',
      '12か月の推移',
      '今回合計',
      '比較期間',
      '増減額',
      '増減率',
      '構成比',
      '寄与度',
    ]) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { name: '増減の要因' })).toBeTruthy();
  });

  it('比較期間にデータが無ければ案内を出す', async () => {
    renderAt('/analysis/trends', withScreen({ comparePeriod: null, compareUnavailable: 'no_data' }));
    expect(await screen.findByText('比較できるデータがありません')).toBeTruthy();
  });

  it('選択バーの確認ボタンは focus.href へ遷移する', async () => {
    renderAt(
      '/analysis/trends?side=household&category=食費&payee=架空スーパー',
      withScreen({
        selection: {
          scope: 'total',
          metric: 'expense',
          compare: 'previous',
          month: '2026-03',
          side: 'household',
          category: '食費',
          payee: '架空スーパー',
        },
        focus: {
          month: '2026-03',
          category: '食費',
          payee: '架空スーパー',
          change: -12300,
          changeRate: -0.02,
          origin: 'mf',
          side: 'household',
          href: '/classify?month=2026-03&cls=per&category=%E9%A3%9F%E8%B2%BB&payee=%E6%9E%B6%E7%A9%BA%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC',
        },
      }),
    );
    const bar = await screen.findByRole('region', { name: '選択中の項目' });
    const link = within(bar).getByRole('link', { name: '該当明細を開く' });
    expect(link.getAttribute('href')).toContain('/classify?month=2026-03&cls=per&category=');
    fireEvent.click(within(bar).getByRole('button', { name: '選択を解除' }));
    await waitFor(() => {
      expect(currentSearch().has('side')).toBe(false);
      expect(currentSearch().has('category')).toBe(false);
    });
  });

  it('データが 0 件なら空の案内を出す', async () => {
    renderAt('/analysis/trends', () => ({
      recordedMonths: [],
      ...screenPart({ series: { months: [], compareMonths: null, values: {}, diff: [] } }),
    }));
    expect(await screen.findByText(/集計できる月がありません/)).toBeTruthy();
  });
});

describe('スタイル', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/pages/analysis/trends.css'), 'utf8');
  it('trends.css に直書きの色が無い', () => {
    expect(css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi)).toBeNull();
  });
  it('Trends.tsx が trends.css を読み、画面に色の直書きが無い', () => {
    const tsx = readFileSync(resolve(process.cwd(), 'src/pages/analysis/Trends.tsx'), 'utf8');
    expect(tsx).toContain("import './trends.css';");
    expect(tsx.match(/#[0-9a-f]{6}\b|rgba?\(/gi)).toBeNull();
    // 指標 id で分岐しない (登録表に 1 件足せば画面に出る)
    expect(tsx).not.toMatch(/['"](income|expense|net)['"]/);
  });
  it('カテゴリ比較表は固定レイアウト・縦スクロール解除・狭幅カード化を専用契約にする', () => {
    expect(css).toMatch(/\.trends-category-table\s*\{[^}]*table-layout:\s*fixed/s);
    expect(css).toMatch(/\.trends-category-table-wrap\s*\{[^}]*max-height:\s*none/s);
    expect(css).toMatch(/\.trends-category-table-wrap\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/\.trends-category-table-wrap\s*\{[^}]*padding-inline:\s*16px/s);
    expect(css).toMatch(
      /\.trends-category-table-wrap\s*>\s*\.trends-category-table\s+thead\s+th\s*\{[^}]*top:\s*0/s,
    );
    expect(css).toMatch(/\.trends-category-col--category\s*\{[^}]*width:\s*20%/s);
    expect(css).toMatch(/\.trends-category-col--spark\s*\{[^}]*width:\s*10%/s);
    expect(css).toMatch(/\.trends-category-col--contribution\s*\{[^}]*width:\s*12%/s);
    expect(css).toMatch(
      /\.trends-category-table\s+:is\(tbody\s+th,\s*tbody\s+td\):first-child\s*\{[^}]*padding-inline-start:\s*16px/s,
    );
    expect(css).toMatch(
      /\.trends-category-table\s+:is\(tbody\s+th,\s*tbody\s+td\):last-child\s*\{[^}]*padding-inline-end:\s*16px/s,
    );
    expect(css).toMatch(
      /\.trends-category-table\s+thead\s+th:first-child\s*>\s*\.th-sort\s*\{[^}]*padding-inline-start:\s*16px/s,
    );
    expect(css).toMatch(
      /\.trends-category-table\s+thead\s+th:last-child\s*>\s*\.th-sort\s*\{[^}]*padding-inline-end:\s*16px/s,
    );
    expect(css).toMatch(/\.trends-category-button\s*\{[^}]*grid-template-columns:/s);
    expect(css).toMatch(/@container\s+trends-category-table\s*\(min-width:\s*75rem\)/);
    expect(css).toMatch(/@container\s+trends-category-table\s*\(max-width:\s*54rem\)/);
  });
});
