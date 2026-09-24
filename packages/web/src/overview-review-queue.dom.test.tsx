// @vitest-environment jsdom

/**
 * 概況の未処理件数が「サイドバーのバッジ・未処理カード・固定アクションバー」の 3 か所で一致することの表示契約 (AC-002)。
 *
 * 3 か所は同じ GET /api/review-queue の結果を読む。どれか 1 か所だけが別の数え方をすると、
 * 月次クローズで「まだ残っているのに終わった」と誤認するので、次の 3 点を固定する。
 *
 * | 観点 | テスト |
 * |---|---|
 * | 初期表示で 3 か所の件数が一致する | `3 か所が同じ件数を出す` |
 * | 「後で確認」で 3 か所が同時に 1 減る | `後で確認で 3 か所が同時に減る` |
 * | 期間を 1年→3年 に切り替えても件数は変わらない (件数は全期間) | `期間を切り替えても件数は変わらない` |
 * | 優先明細表は選んだ期間の月だけを並べる (件数は変えない) | `優先明細表は期間の外の明細を出さない` |
 * | 「後で確認」を解除すると 3 か所が同時に戻る | `後で確認を解除すると 3 か所が同時に戻る` |
 * | 0 件は「未処理なし」と伝える | `0 件は未処理なしと出す` |
 * | 狭幅のドロワーは閉じると開いた元へ、後で確認の成功後は未処理の内訳へフォーカスを移す | `狭幅のドロワーのフォーカス` |
 *
 * 表示値の fixture は架空の明細だけを使う。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverviewResponse, ReviewQueueItem, ReviewQueueResponse } from './api.js';
import { Layout } from './components/Layout.js';
import { OverviewPage } from './pages/Overview.js';
import { PeriodProvider } from './period.js';

vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

const item = (
  over: Partial<ReviewQueueItem> & Pick<ReviewQueueItem, 'kind' | 'itemKey'>,
): ReviewQueueItem => ({
  amount: -1_000,
  date: '2026-09-05',
  month: '2026-09',
  content: '架空商店',
  recommendation: null,
  basis: 'none',
  basisLabel: '根拠なし',
  confidence: null,
  ...over,
});

const ITEMS: ReviewQueueItem[] = [
  item({
    kind: 'reconciliation',
    itemKey: 'mf-r1',
    amount: -20_000,
    date: '2026-09-10',
    content: '架空工房',
  }),
  item({
    kind: 'classification',
    itemKey: 'mf-c1',
    amount: -9_000,
    content: '<img src=x onerror=alert(1)>架空書店',
    recommendation: '家計 / 書籍',
    basis: 'vendor_memory',
    basisLabel: '過去 10 件中 9 件',
    confidence: 90,
  }),
  // 期間 (1年) の外の月でも件数には入る
  item({
    kind: 'classification',
    itemKey: 'mf-c2',
    amount: -5_000,
    date: '2023-01-20',
    month: '2023-01',
    content: '期間外の架空明細',
  }),
  item({ kind: 'import', itemKey: 'run-1', amount: 0, date: '2026-09-11', content: '列が足りません' }),
];

/** 期間の指定 (span) に応じて API が解決する applied を返す。全期間は null */
const appliedFor = (span: string | null) =>
  span === '1'
    ? { from: '2025-10', to: '2026-09' }
    : span === '3'
      ? { from: '2023-10', to: '2026-09' }
      : null;

const overview = (applied: { from: string; to: string } | null = null): OverviewResponse => ({
  scope: 'total',
  kpi: { income: 1_248_000, expense: 892_400, balance: 355_600, months: 12 },
  trend: [
    { month: '2026-08', income: 600_000, expense: 400_000, balance: 200_000 },
    { month: '2026-09', income: 648_000, expense: 492_400, balance: 155_600 },
  ],
  yearComparison: {
    rows: [
      {
        key: 'income',
        label: '総収入',
        current: 1_248_000,
        previous: 1_151_200,
        delta: 96_800,
        deltaRate: 0.084,
      },
      {
        key: 'expense',
        label: '総支出',
        current: 892_400,
        previous: 941_600,
        delta: -49_200,
        deltaRate: -0.052,
      },
      {
        key: 'balance',
        label: '純収支',
        current: 355_600,
        previous: 209_600,
        delta: 146_000,
        deltaRate: 0.697,
      },
    ],
    currentLabel: '2025年10月 - 2026年9月',
    previousLabel: '前12か月',
  },
  breakdown: {
    items: [
      { label: '事業 / 仕入高', amount: 298_400, share: 298_400 / 892_400 },
      { label: '事業 / 人件費', amount: 180_000, share: 180_000 / 892_400 },
      { label: '家計 / 住居費', amount: 120_000, share: 120_000 / 892_400 },
      { label: '事業 / 広告宣伝費', amount: 65_000, share: 65_000 / 892_400 },
      { label: '事業 / 外注費', amount: 52_000, share: 52_000 / 892_400 },
      { label: 'その他', amount: 177_000, share: 177_000 / 892_400 },
    ],
    total: 892_400,
  },
  closeStatus: {
    month: '2026-09',
    steps: [
      { key: 'import', label: 'データ取込', done: true, count: null },
      { key: 'classification', label: '仕分け', done: false, count: 2 },
      { key: 'reconciliation', label: '照合', done: false, count: 1 },
      { key: 'review', label: '月次レビュー', done: false, count: null },
    ],
    doneCount: 1,
    total: 4,
    reviewedAt: null,
  },
  dataUpdatedAt: '2026-09-10T01:24:00.000Z',
  defenseForecast: {
    line: 0,
    history: [],
    breachCount: 0,
    nextMonth: null,
    nextEstimate: 0,
    nextSalary: 0,
    nextBizIncome: 0,
    nextDiff: 0,
    slope: 0,
    level: 'none',
    reason: '',
  },
  period: {
    applied,
    label: applied ? `${applied.from} - ${applied.to}` : '全期間',
    full: { from: '2023-01', to: '2026-09' },
    years: ['2026', '2025', '2024', '2023'],
    monthCount: 45,
  },
});

let snoozed: Set<string>;
let items: ReviewQueueItem[];
let calls: { method: string; path: string }[];
let overviewForRequest: (url: URL) => OverviewResponse;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function queueBody(): ReviewQueueResponse {
  const isSnoozed = (x: ReviewQueueItem) => snoozed.has(`${x.kind}/${x.itemKey}`);
  const visible = items.filter((x) => !isSnoozed(x));
  const count = (kind: ReviewQueueItem['kind']) => visible.filter((x) => x.kind === kind).length;
  return {
    total: visible.length,
    counts: {
      reconciliation: count('reconciliation'),
      classification: count('classification'),
      import: count('import'),
    },
    snoozedCount: snoozed.size,
    items: visible,
    snoozedItems: items.filter(isSnoozed),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  snoozed = new Set();
  items = ITEMS;
  calls = [];
  overviewForRequest = (url) => overview(appliedFor(url.searchParams.get('span')));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      calls.push({ method, path: `${url.pathname}${url.search}` });
      const snooze = url.pathname.match(/^\/api\/review-queue\/snoozes\/([^/]+)\/([^/]+)$/);
      if (snooze && method === 'PUT') {
        snoozed.add(`${snooze[1]}/${decodeURIComponent(snooze[2])}`);
        return json({ kind: snooze[1], itemKey: snooze[2], snoozedAt: '2026-09-15T00:00:00.000Z' });
      }
      if (snooze && method === 'DELETE') {
        snoozed.delete(`${snooze[1]}/${decodeURIComponent(snooze[2])}`);
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/api/review-queue') return json(queueBody());
      if (url.pathname === '/api/overview') return json(overviewForRequest(url));
      if (/^\/api\/monthly-close\/[^/]+\/review$/.test(url.pathname) && method === 'PUT') {
        return json({ month: '2026-09', reviewedAt: '2026-09-15T00:00:00.000Z' });
      }
      if (url.pathname === '/api/imports') return json({ imports: [] });
      if (url.pathname === '/api/unsettled') return json({ rows: [] });
      if (url.pathname === '/api/summary')
        return json({
          overview: { months: ['2026-09'], unrecordedExpMonths: [] },
          defense: {
            status: 'ok',
            line: 100_000,
            incomeEstimate: 200_000,
            forecast: overview().defenseForecast,
          },
          period: overview().period,
        });
      return json({ error: { code: 'not_found', message: 'not found' } }, 404);
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <MemoryRouter initialEntries={['/']}>
          <Layout>
            <OverviewPage />
          </Layout>
        </MemoryRouter>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

const countIn = (text: string | null | undefined): number | null => {
  const m = (text ?? '').match(/未処理\s*(\d+)\s*件/);
  return m ? Number(m[1]) : null;
};

/** 3 か所それぞれの表示件数を読む */
function counts() {
  const nav = screen.getByRole('navigation', { name: 'メインナビゲーション' });
  const link = within(nav).getByRole('link', { name: /概要/ });
  const card = screen.getByRole('region', { name: '未処理の内訳' });
  const bar = screen.getByRole('region', { name: '未処理の確認' });
  return {
    badge: countIn(link.textContent),
    card: countIn(card.textContent),
    bar: countIn(within(bar).getByRole('status').textContent),
  };
}

const reviewQueueGets = () =>
  calls.filter((c) => c.method === 'GET' && c.path.startsWith('/api/review-queue'));

const expectBefore = (first: Element, second: Element) => {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
};

describe('未処理件数の 3 か所一致 (AC-002)', () => {
  it('3 か所が同じ件数を出し、件数は 1 つのクエリから描く', async () => {
    renderOverview();
    await waitFor(() => expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 }));
    // 種別ごとの内訳もカードに出る
    const card = screen.getByRole('region', { name: '未処理の内訳' });
    expect(within(card).getByText('仕分けの確認').closest('li')?.textContent).toContain('2');
    expect(within(card).getByText('照合の確認').closest('li')?.textContent).toContain('1');
    expect(within(card).getByText('取込の確認').closest('li')?.textContent).toContain('1');
    // バッジ・カード・アクションバーは同じ queryKey を共有するので取得は 1 回
    expect(reviewQueueGets()).toHaveLength(1);
  });

  it('後で確認で 3 か所が同時に減り、変化を role=status で伝える', async () => {
    renderOverview();
    await waitFor(() => expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 }));

    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    fireEvent.click(within(table).getByRole('button', { name: /架空書店/ }));
    const panel = await screen.findByRole('complementary', { name: '選択中の明細' });
    // 推奨と根拠 (FR-005) が選択中の明細に出る
    expect(panel.textContent).toContain('家計 / 書籍');
    expect(panel.textContent).toContain('過去 10 件中 9 件');
    expect(panel.textContent).toContain('高 90%');
    fireEvent.click(within(panel).getByRole('button', { name: '後で確認' }));

    await waitFor(() => expect(counts()).toEqual({ badge: 3, card: 3, bar: 3 }));
    expect(calls).toContainEqual({ method: 'PUT', path: '/api/review-queue/snoozes/classification/mf-c1' });
    const bar = screen.getByRole('region', { name: '未処理の確認' });
    expect(within(bar).getByRole('status').textContent).toContain('3');
  });

  it('期間を 1年→3年 に切り替えても件数は変わらず、review-queue に期間を渡さない', async () => {
    renderOverview();
    await waitFor(() => expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 }));

    fireEvent.click(screen.getByRole('button', { name: '1年で表示' }));
    await waitFor(() =>
      expect(calls.some((c) => c.path.startsWith('/api/overview') && c.path.includes('span=1'))).toBe(true),
    );
    expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 });

    fireEvent.click(screen.getByRole('button', { name: '3年で表示' }));
    await waitFor(() =>
      expect(calls.some((c) => c.path.startsWith('/api/overview') && c.path.includes('span=3'))).toBe(true),
    );
    expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 });

    expect(reviewQueueGets().every((c) => c.path === '/api/review-queue')).toBe(true);
  });

  it('優先明細表は期間の外の明細を出さないが、件数は全期間のまま', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'all' }));
    renderOverview();
    await waitFor(() => expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 }));
    const rows = () =>
      within(screen.getByRole('table', { name: '優先して確認する明細' })).queryAllByRole('button', {
        name: '期間外の架空明細',
      });
    // 全期間なら 2023-01 の明細も並ぶ
    expect(rows()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '1年で表示' }));
    await waitFor(() => expect(rows()).toHaveLength(0));
    expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 });
  });

  it('期間から外れた選択明細を詳細に残さない', async () => {
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'all' }));
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));
    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    fireEvent.click(within(table).getByRole('button', { name: '期間外の架空明細' }));
    const panel = await screen.findByRole('complementary', { name: '選択中の明細' });
    expect(within(panel).getByText('期間外の架空明細')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '1年で表示' }));

    await waitFor(() => {
      const currentTable = screen.getByRole('table', { name: '優先して確認する明細' });
      expect(within(currentTable).queryByText('期間外の架空明細')).toBeNull();
    });
    expect(within(panel).queryByText('期間外の架空明細')).toBeNull();
  });

  it('選択中の明細は行ではなくボタンに aria-current を付ける', async () => {
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));
    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    const button = within(table).getByRole('button', { name: /架空書店/ });
    fireEvent.click(button);
    await screen.findByRole('complementary', { name: '選択中の明細' });
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(table.querySelector('[aria-selected]')).toBeNull();
  });

  it('後で確認を解除すると 3 か所が同時に戻る', async () => {
    snoozed.add('classification/mf-c1');
    renderOverview();
    await waitFor(() => expect(counts()).toEqual({ badge: 3, card: 3, bar: 3 }));

    const card = screen.getByRole('region', { name: '未処理の内訳' });
    expect(within(card).getByText(/後で確認にした明細 \(1 件\)/)).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: /架空書店 の後で確認を解除/ }));

    await waitFor(() => expect(counts()).toEqual({ badge: 4, card: 4, bar: 4 }));
    expect(calls).toContainEqual({
      method: 'DELETE',
      path: '/api/review-queue/snoozes/classification/mf-c1',
    });
    expect(within(card).queryByText(/後で確認にした明細/)).toBeNull();
  });

  it('0 件は未処理なしと出す', async () => {
    items = [];
    renderOverview();
    const card = await screen.findByRole('region', { name: '未処理の内訳' });
    await waitFor(() => expect(card.textContent).toContain('未処理なし'));
    const bar = screen.getByRole('region', { name: '未処理の確認' });
    expect(within(bar).getByRole('status').textContent).toBe('未処理なし');
    expect(card.textContent).not.toMatch(/未処理\s*0\s*件/);
  });

  it('狭幅のドロワーのフォーカス: 閉じると開いた元へ、後で確認の成功後は消えない見出しへ移す', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));
    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    const button = within(table).getByRole('button', { name: /架空書店/ });
    button.focus();
    fireEvent.click(button);

    // 閉じるだけなら明細は残るので、開いた元のボタンへ戻す
    const first = await screen.findByRole('dialog', { name: '選択中の明細' });
    fireEvent.click(within(first).getByRole('button', { name: '閉じる' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '選択中の明細' })).toBeNull());
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: '選択中の明細' });
    fireEvent.click(within(dialog).getByRole('button', { name: '後で確認' }));

    // 後で確認にした行は表から消える。フォーカスを body へ落とさず、件数の見出しへ移す
    await waitFor(() => expect(counts()).toEqual({ badge: 3, card: 3, bar: 3 }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '選択中の明細' })).toBeNull());
    expect(button.isConnected).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '未処理の内訳' }));
  });

  it('明細の内容はテキストとして描画し、HTML として解釈しない', async () => {
    const { container } = renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));
    expect(screen.getAllByText(/<img src=x onerror=alert\(1\)>架空書店/).length).toBeGreaterThan(0);
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('未処理キューの取得に失敗しても KPI は描画し、未処理の領域だけにエラーを出す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), 'http://localhost').pathname;
        if (path === '/api/review-queue') return json({ error: { code: 'internal', message: 'boom' } }, 500);
        if (path === '/api/overview') return json(overview());
        if (path === '/api/imports') return json({ imports: [] });
        return json({ overview: { months: [], unrecordedExpMonths: [] }, period: overview().period });
      }),
    );
    renderOverview();
    expect((await screen.findAllByText('¥1,248,000')).length).toBeGreaterThan(0);
    const card = await screen.findByRole('region', { name: '未処理の内訳' });
    await waitFor(() => expect(within(card).getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('優先して確認する明細はありません。')).toBeNull();
  });

  it('未処理キューの読込中を「明細なし」と誤表示しない', async () => {
    const queue = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost');
        if (url.pathname === '/api/review-queue') return queue.promise;
        if (url.pathname === '/api/overview') return json(overview());
        if (url.pathname === '/api/imports') return json({ imports: [] });
        return json({ overview: { months: [], unrecordedExpMonths: [] }, period: overview().period });
      }),
    );

    renderOverview();

    expect((await screen.findAllByText('¥1,248,000')).length).toBeGreaterThan(0);
    const card = screen.getByRole('region', { name: '未処理の内訳' });
    expect(card.textContent).toContain('確認中');
    expect(screen.queryByText('優先して確認する明細はありません。')).toBeNull();
  });
});

describe('概況の情報設計と状態の整合', () => {
  it('Hero → KPI → Trend → Review の順に主要情報を読む', async () => {
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));

    const hero = screen.getByRole('heading', { level: 1, name: '今月の収支と、次に直すことは？' });
    const income = screen.getAllByText('総収入')[0];
    const trend = screen.getByRole('heading', { name: '月次の収入・支出・純収支の推移' });
    const review = screen.getByRole('heading', { name: '未処理の内訳' });

    expectBefore(hero, income);
    expectBefore(income, trend);
    expectBefore(trend, review);
  });

  it('前年差・図の局所期間・推奨・信頼度・出典を、実データだけで補足する', async () => {
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));

    const kpis = screen.getByRole('region', { name: '収支の概要' });
    expect(kpis.textContent).toContain('+¥96,800');
    expect(kpis.textContent).toContain('+8.4%');
    expect(kpis.textContent).toContain('前12か月 ¥1,151,200');
    expect(screen.getByRole('link', { name: 'データ出典と除外項目について' })).toBeTruthy();

    const trendRange = screen.getByRole('group', { name: '図に表示する期間' });
    const oneYear = within(trendRange).getByRole('button', { name: '1年' });
    const threeYears = within(trendRange).getByRole('button', { name: '3年' });
    expect(oneYear.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(threeYears);
    expect(threeYears.getAttribute('aria-pressed')).toBe('true');

    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    expect(within(table).getAllByText('家計 / 書籍')).toHaveLength(1);
    expect(within(table).getByText('高 90%')).toBeTruthy();

    const breakdown = screen.getByRole('group', { name: '内訳の表示値' });
    const firstBreakdown = document.querySelector('.breakdown-list li');
    expect(firstBreakdown?.querySelector('.breakdown-value')?.textContent).toBe('¥298,400');
    expect(firstBreakdown?.querySelector('.breakdown-secondary')?.textContent).toBe('33.4%');
    const share = within(breakdown).getByRole('button', { name: '構成比' });
    fireEvent.click(share);
    expect(share.getAttribute('aria-pressed')).toBe('true');
    expect(firstBreakdown?.querySelector('.breakdown-value')?.textContent).toBe('33.4%');
    expect(firstBreakdown?.querySelector('.breakdown-secondary')?.textContent).toBe('¥298,400');
    expect(within(firstBreakdown as HTMLElement).getAllByText('33.4%')).toHaveLength(1);
  });

  it('前期データが無いときもKPIと比較表で欠損を明示し、今期値を残す', async () => {
    overviewForRequest = (url) => {
      const data = overview(appliedFor(url.searchParams.get('span')));
      data.yearComparison = {
        ...data.yearComparison,
        previousLabel: null,
        rows: data.yearComparison.rows.map((row) => ({
          ...row,
          previous: null,
          delta: null,
          deltaRate: null,
        })),
      };
      return data;
    };
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));

    const kpis = screen.getByRole('region', { name: '収支の概要' });
    expect(within(kpis).getAllByText('比較できる前期データがありません')).toHaveLength(3);
    const comparison = screen.getByRole('heading', { name: '前年との比較' }).closest('.card');
    if (!comparison) throw new Error('comparison card is required');
    expect(within(comparison as HTMLElement).getByText(/今期の値だけを表示/)).toBeTruthy();
    const table = within(comparison as HTMLElement).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: '前期' })).toBeTruthy();
    expect(within(table).getAllByText('¥1,248,000')).toHaveLength(1);
    expect(within(table).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('warning と danger を状態語・背景用class・異なるicon形状で区別する', async () => {
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));

    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    const danger = table.querySelector('.review-col-status .review-row-status.danger');
    const warning = table.querySelector('.review-col-status .review-row-status.warning');
    expect(danger?.textContent).toBe('不一致');
    expect(warning?.textContent).toBe('要仕分け');
    expect(danger?.classList.contains('danger')).toBe(true);
    expect(warning?.classList.contains('warning')).toBe(true);
    expect(danger?.querySelector('svg circle')).toBeTruthy();
    expect(warning?.querySelector('svg > path')).toBeTruthy();
    expect(warning?.querySelector('svg circle')).toBeNull();

    const summary = screen.getByRole('region', { name: '未処理の内訳' });
    expect(summary.querySelector('.review-kind-danger')).toBeTruthy();
    expect(summary.querySelector('.review-kind-warning')).toBeTruthy();
  });

  it('優先明細表は全6列を同じ表に保ち、横・縦スクロール用containerで包む', async () => {
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));

    const table = screen.getByRole('table', { name: '優先して確認する明細' });
    expect(table.classList.contains('review-priority-table')).toBe(true);
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['状態', '日付', '内容', '金額', '推奨', '信頼度']);
    expect(table.closest('.scroll-x')).toBeTruthy();

    const row = within(table)
      .getByRole('button', { name: /架空書店/ })
      .closest('tr');
    expect(row?.querySelector('.review-item-button')).toBeTruthy();
    expect(row?.querySelector('.review-col-date')?.textContent).toBe('2026-09-05');
    expect(row?.querySelector('.review-col-recommendation')?.textContent).toBe('家計 / 書籍');
    expect(row?.querySelector('.review-col-confidence')?.textContent).toContain('高 90%');
  });

  it('wide では Review workspace の要約・明細表・詳細を同時に提供する', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(min-width: 1280px)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    );
    renderOverview();
    await waitFor(() => expect(counts().card).toBe(4));

    expect(screen.getByRole('region', { name: '未処理の内訳' })).toBeTruthy();
    expect(screen.getByRole('table', { name: '優先して確認する明細' })).toBeTruthy();
    const panel = screen.getByRole('complementary', { name: '選択中の明細' });
    const close = within(panel).getByRole('button', { name: '選択を閉じる' });
    fireEvent.click(close);
    expect(within(panel).getByText(/優先して確認する明細を選ぶと/)).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: '選択を閉じる' })).toBeNull();
  });

  it('範囲切替の応答待ちに旧 KPI を新しい範囲の値として説明しない', async () => {
    const businessResponse = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost');
        if (url.pathname === '/api/review-queue') return json(queueBody());
        if (url.pathname === '/api/overview' && url.searchParams.get('scope') === 'business') {
          return businessResponse.promise;
        }
        if (url.pathname === '/api/overview') return json(overview());
        if (url.pathname === '/api/imports') return json({ imports: [] });
        return json({ overview: { months: [], unrecordedExpMonths: [] }, period: overview().period });
      }),
    );
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'all' }));
    renderOverview();
    expect((await screen.findAllByText('¥1,248,000')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('radio', { name: '事業' }));

    expect(screen.getByText(/総合の全期間について/)).toBeTruthy();
    expect(screen.queryByText(/事業の全期間について/)).toBeNull();

    const business = overview();
    business.scope = 'business';
    business.kpi = { ...business.kpi, income: 444_000 };
    businessResponse.resolve(json(business));
    expect(await screen.findByText('¥444,000')).toBeTruthy();
    expect(screen.getByText(/事業の全期間について/)).toBeTruthy();
  });

  it('期間切替の応答待ちに旧 KPI の期間ラベルを保ち、応答後に一緒に更新する', async () => {
    const periodResponse = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), 'http://localhost');
        if (url.pathname === '/api/review-queue') return json(queueBody());
        if (url.pathname === '/api/overview' && url.searchParams.get('span') === '1') {
          return periodResponse.promise;
        }
        if (url.pathname === '/api/overview') return json(overview());
        if (url.pathname === '/api/imports') return json({ imports: [] });
        return json({ overview: { months: [], unrecordedExpMonths: [] }, period: overview().period });
      }),
    );
    localStorage.setItem('kanjo:period', JSON.stringify({ mode: 'all' }));
    renderOverview();
    expect((await screen.findAllByText('¥1,248,000')).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '1年で表示' }));

    expect(screen.getByText(/総合の全期間について/)).toBeTruthy();
    expect(screen.queryByText(/総合の2025-10 - 2026-09について/)).toBeNull();

    const oneYear = overview(appliedFor('1'));
    oneYear.kpi = { ...oneYear.kpi, income: 777_000 };
    periodResponse.resolve(json(oneYear));
    expect(await screen.findByText('¥777,000')).toBeTruthy();
    expect(screen.getByText(/総合の2025-10 - 2026-09について/)).toBeTruthy();
  });

  it('月次レビューは前提の取込・仕分け・照合が終わるまで操作できない', async () => {
    renderOverview();
    expect((await screen.findAllByText('¥1,248,000')).length).toBeGreaterThan(0);

    const review = screen.getByRole('button', { name: '月次レビューを記録する' });
    expect(review.hasAttribute('disabled')).toBe(true);
    const reasonId = review.getAttribute('aria-describedby');
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)?.textContent).toContain(
      'データ取込・仕分け・照合が完了すると、月次レビューを記録できます。',
    );
  });

  it('icon railへ縮約できるbrand・月次進捗・改善操作の構造と読み上げ名を保つ', async () => {
    renderOverview();
    expect((await screen.findAllByText('¥1,248,000')).length).toBeGreaterThan(0);

    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    expect(sidebar).toBeTruthy();
    if (!sidebar) throw new Error('sidebar is required');
    expect(sidebar.querySelector('.brand-mark')).toBeTruthy();
    expect(sidebar.querySelector('.brand-copy')?.textContent).toContain('Focus Ledger');

    const close = within(sidebar).getByRole('region', { name: '月次クローズの進捗' });
    expect(close.querySelector('.monthly-close-count')?.textContent).toBe('1/4');
    const review = within(close).getByRole('button', { name: '月次レビューを記録する' });
    expect(review.querySelector('.monthly-close-action-icon')).toBeTruthy();
    expect(review.querySelector('.monthly-close-action-label')?.textContent).toBe('月次レビューを記録する');

    const improve = await screen.findByRole('button', { name: '改善要望' });
    expect(improve.querySelector('.action-icon')).toBeTruthy();
    expect(improve.querySelector('.improve-trigger-label')?.textContent).toBe('改善を送る');
  });

  it('前提が終われば月次レビューを記録できる', async () => {
    overviewForRequest = (url) => {
      const data = overview(appliedFor(url.searchParams.get('span')));
      data.closeStatus = {
        ...data.closeStatus,
        steps: data.closeStatus.steps.map((step) =>
          step.key === 'review' ? step : { ...step, done: true, count: step.count == null ? null : 0 },
        ),
        doneCount: 3,
      };
      return data;
    };
    renderOverview();

    const review = await screen.findByRole('button', { name: '月次レビューを記録する' });
    expect(review.hasAttribute('disabled')).toBe(false);
    fireEvent.click(review);
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'PUT', path: '/api/monthly-close/2026-09/review' }),
    );
  });
});
