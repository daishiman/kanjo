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
import type { DefenseForecast, SummaryResponse } from './api.js';
import { OverviewPage } from './pages/Overview.js';

// jsdom には canvas が無く、Chart.js は描画のたびに context を取れず例外を投げる。
// 例外はテストを落とさない代わりにスタックだけをログへ積み、CIで本当の失敗を
// 覆い隠す。ここで検証したいのは警告の文言と根拠なので、グラフは差し替える
// (trends-scope.dom.test.tsx と同じ扱い)
vi.mock('react-chartjs-2', async () => ({
  Chart: (await import('./test-support/chart-test-doubles.js')).SilentChart,
}));

const forecast = (over: Partial<DefenseForecast> = {}): DefenseForecast => ({
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

const summary = (f: DefenseForecast): SummaryResponse =>
  ({
    overview: {
      months: ['2026-06', '2026-07'],
      revenue: [0, 0],
      expenseTotal: [0, 0],
      profit: [null, null],
      expenseMovingAvg: [null, null],
      cashOverride: {},
      unrecordedExpMonths: [],
      kpi: {
        avgRevenue: 0,
        revenueMonths: 0,
        avgExpense: 0,
        lastExpense: 0,
        expenseMom: 0,
        prevYearExpense: 0,
        currYearAnnualized: 0,
        prevYearRevenue: 0,
        prevYearProfit: 0,
        prevYearExpenseRatio: 0,
      },
      yearTable: [],
      yearTotals: { prevActual: 0, currAnnualized: 0, delta: 0 },
      pareto: [],
      top2Share: 0,
      years: { curr: '2026', prev: '2025' },
    },
    defense: {
      line: f.line,
      personalAvg: 0,
      bizFixedAvg: 0,
      month: '2026-07',
      incomeEstimate: 450000,
      salary: 300000,
      bizIncome: 150000,
      diff: -50000,
      status: 'danger',
      forecast: f,
    },
    benchmarks: [],
  }) as unknown as SummaryResponse;

function renderWith(f: DefenseForecast) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(JSON.stringify(String(input).includes('/unsettled') ? { rows: [] } : summary(f)), {
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

  it('watch は警告として割り込まず、注意として出す', async () => {
    renderWith(forecast({ level: 'watch', nextDiff: 20000, reason: '余裕がわずかです。' }));
    expect(await screen.findByText('余裕がわずかです。')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/防衛ラインの見通しに注意/)).toBeTruthy();
  });

  it('none と nodata では何も出さない(警告の出しすぎで無視されるのを避ける)', async () => {
    const { container } = renderWith(forecast({ level: 'none' }));
    await screen.findByRole('heading', { name: '売上・経費トレンド' });
    expect(container.querySelector('.notice')).toBeNull();

    cleanup();
    vi.unstubAllGlobals();
    const second = renderWith(forecast({ level: 'nodata' }));
    await screen.findByRole('heading', { name: '売上・経費トレンド' });
    expect(second.container.querySelector('.notice')).toBeNull();
  });
});
