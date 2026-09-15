// @vitest-environment jsdom

/**
 * 防衛ライン割れの事前警告(FR-08 の先行き見通し)の表示契約。
 *
 * 事前警告は「まだ手を打てるうちに気づかせる」ためのものなので、
 * 判定の結論だけでなく根拠(内訳・割れた月)と次の行動(やりくり試算)が
 * 同じ場所に揃っていることを固定する。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OverviewResponse, ReviewQueueResponse } from './api.js';
import { OverviewPage } from './pages/Overview.js';

// jsdom には canvas が無く、Chart.js は描画のたびに context を取れず例外を投げる。
// 例外はテストを落とさない代わりにスタックだけをログへ積み、CIで本当の失敗を
// 覆い隠す。ここで検証したいのは警告の文言と根拠なので、グラフは差し替える
// (trends-scope.dom.test.tsx と同じ扱い)
vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

type Forecast = OverviewResponse['defenseForecast'];

const forecast = (over: Partial<Forecast> = {}): Forecast => ({
  line: 500000,
  history: [
    { month: '2026-06', income: 600000, diff: 100000, breached: false },
    { month: '2026-07', income: 450000, diff: -50000, breached: true },
  ],
  breachCount: 1,
  nextMonth: '2026-08',
  nextEstimate: 420000,
  nextSalary: 300000,
  nextBizIncome: 120000,
  nextDiff: -80000,
  slope: -75000,
  level: 'warn',
  reason: '翌月の収入見込み ¥420,000 が防衛ライン ¥500,000 を ¥80,000 下回る見込みです。',
  ...over,
});

/** 概況は /api/overview の集計をそのまま描く。警告の判定もサーバの defenseForecast が正本 */
const overview = (f: Forecast): OverviewResponse => ({
  scope: 'total',
  kpi: { income: 450000, expense: 380000, balance: 70000, months: 2 },
  trend: [
    { month: '2026-06', income: 600000, expense: 400000, balance: 200000 },
    { month: '2026-07', income: 450000, expense: 380000, balance: 70000 },
  ],
  yearComparison: { rows: [], currentLabel: '2026年', previousLabel: null },
  breakdown: { items: [], total: 380000 },
  closeStatus: { month: '2026-07', steps: [], doneCount: 0, total: 4, reviewedAt: null },
  dataUpdatedAt: null,
  defenseForecast: f,
  period: { label: '全期間' } as OverviewResponse['period'],
});

// 未処理キューは正常に返す。失敗させると role=alert が 2 つになり、警告の検証と混ざる
const reviewQueue: ReviewQueueResponse = {
  total: 0,
  counts: { classification: 0, reconciliation: 0, import: 0 },
  snoozedCount: 0,
  items: [],
};

function renderWith(f: Forecast) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(JSON.stringify(String(input).includes('/review-queue') ? reviewQueue : overview(f)), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('防衛ライン割れの事前警告', () => {
  it('warn では警告として読み上げられ、根拠の文と内訳と次の行動が揃う', async () => {
    renderWith(forecast());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('防衛ライン割れの事前警告');
    // 判定の再現に必要な数字がそのまま出ている
    expect(alert.textContent).toContain('¥420,000');
    expect(alert.textContent).toContain('¥500,000');
    // 見込みの作り方(給与=中央値 / 事業入金=平均)を明かす
    expect(alert.textContent).toContain('中央値');
    expect(alert.textContent).toContain('平均');
    // 割れた月は差額つきで並ぶ(月表記はトレンドグラフの軸と同じ monthShort に揃える)
    expect(alert.textContent).toContain('7月(−¥50,000)');
    expect(screen.getByRole('link', { name: 'やりくり試算で捻出元を探す' }).getAttribute('href')).toBe(
      '/tradeoff',
    );
  });

  it('caution も role=alert で読み上げ、見出しで注意の段階だと伝える (spec FR-006)', async () => {
    renderWith(forecast({ level: 'caution', nextDiff: 20000, reason: '余裕がわずかです。' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('余裕がわずかです。');
    expect(alert.textContent).toMatch(/防衛ラインの見通しに注意/);
  });

  it('none と nodata では何も出さない(警告の出しすぎで無視されるのを避ける)', async () => {
    const { container } = renderWith(forecast({ level: 'none' }));
    await screen.findByRole('heading', { name: '月次の収入・支出・純収支の推移' });
    expect(container.querySelector('.notice')).toBeNull();

    cleanup();
    vi.unstubAllGlobals();
    const second = renderWith(forecast({ level: 'nodata' }));
    await screen.findByRole('heading', { name: '月次の収入・支出・純収支の推移' });
    expect(second.container.querySelector('.notice')).toBeNull();
  });
});
