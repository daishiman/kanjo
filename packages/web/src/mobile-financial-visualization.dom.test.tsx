// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiReportChart, CashFlow, MatrixData } from './api.js';
import { CashFlowCharts, MatrixMoversChart } from './components/FinancialCharts.js';
import { ReportChartView } from './components/ReportChart.js';
import { SubscriptionsPage } from './pages/Subscriptions.js';

interface MockDataset {
  label?: string;
  borderColor?: unknown;
  backgroundColor?: unknown;
}

/**
 * 実 Chart.js は canvas にしか色を残さず、instance もモジュールスコープに閉じているため、
 * 「凡例チップの色 = 図のデータセットの色」を実ブラウザから突き合わせる手段がない。
 * ここでは Chart へ渡された datasets をそのまま DOM に出し、突き合わせを可能にする。
 * 1系列=1色への畳み込み(線は borderColor、棒は backgroundColor)だけを担い、
 * 「どの系列にどの色を割り当てるか」の引き当ては検証対象のまま残す。
 */
const datasetColor = (dataset: MockDataset): string =>
  typeof dataset.borderColor === 'string'
    ? dataset.borderColor
    : typeof dataset.backgroundColor === 'string'
      ? dataset.backgroundColor
      : '';

vi.mock('react-chartjs-2', () => ({
  Chart: ({
    'aria-label': ariaLabel,
    data,
  }: {
    'aria-label'?: string;
    data?: { datasets?: MockDataset[] };
  }) => (
    <div
      role="img"
      aria-label={ariaLabel}
      data-chart-placeholder="true"
      data-dataset-labels={data?.datasets?.map((dataset) => dataset.label).join('|')}
      data-dataset-colors={data?.datasets
        ?.map((dataset) => `${dataset.label}:${datasetColor(dataset)}`)
        .join('|')}
    />
  ),
}));

/** 図の凡例チップが主張している色。色を主張していない系列は undefined。 */
function legendColors(figure: HTMLElement): Map<string, string | undefined> {
  const items = [...figure.querySelectorAll('[data-financial-series] li')];
  return new Map(
    items.map((item) => [
      item.textContent?.trim() ?? '',
      item.querySelector('span')?.style.getPropertyValue('--series-color') || undefined,
    ]),
  );
}

/** 図に渡された datasets の「系列名 → 色」。色を持たない(値ごとに色が変わる)系列は undefined。 */
function chartColors(figure: HTMLElement): Map<string, string | undefined> {
  const attribute = within(figure).getByRole('img').getAttribute('data-dataset-colors') ?? '';
  return new Map(
    attribute.split('|').map((entry) => {
      const separator = entry.lastIndexOf(':');
      return [entry.slice(0, separator), entry.slice(separator + 1) || undefined];
    }),
  );
}

/** 図を2つ(月別の利益と営業CF・営業CF累計)描く最小データ。 */
const cashFlow: CashFlow = {
  months: [
    { month: '2026-07', profit: 120_000, receivableIncrease: 30_000, payableIncrease: 0, operating: 90_000 },
    { month: '2026-08', profit: 80_000, receivableIncrease: 0, payableIncrease: 20_000, operating: 100_000 },
  ],
  cumulative: [90_000, 190_000],
  total: 190_000,
  settlementUnknown: false,
  limits: [],
};

const reportChart = (overrides: Partial<AiReportChart>): AiReportChart => ({
  id: 'anonymous-chart',
  figure: 1,
  title: '匿名の図',
  kind: 'line',
  unit: 'yen',
  purpose: '匿名データの確認へ進みます。',
  readingGuide: '左から右へ変化を追います。',
  available: true,
  reason: null,
  monthsNeeded: null,
  granularity: 'month',
  data: { labels: [], series: [] },
  status: 'ok',
  caption: '匿名データ。',
  ...overrides,
});

const matrix: MatrixData = {
  months: ['2026-07', '2026-08'],
  unrecordedExpMonths: [],
  years: ['2026'],
  rows: [
    {
      label: '広告宣伝費',
      isTotal: false,
      series: [10_000, 40_000],
      yearTotals: [{ year: '2026', total: 50_000 }],
      yoy: 0,
    },
    {
      label: '通信費',
      isTotal: false,
      series: [25_000, 20_000],
      yearTotals: [{ year: '2026', total: 45_000 }],
      yoy: 0,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('モバイル財務figureの意味同等性', () => {
  it('canvasに依存せず、見出し・結論・期間・単位・series・次の行動・正確な表を読める', () => {
    const { container } = render(<MatrixMoversChart data={matrix} />);
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');

    expect(figure).not.toBeNull();
    if (!figure) throw new Error('financial figure contract missing');

    expect(within(figure).getByRole('heading', { name: '変化が大きい科目' })).toBeTruthy();
    expect(figure.querySelector('[data-financial-summary]')?.textContent).toMatch(/広告宣伝費.*30,000/);
    expect(figure.querySelector('[data-financial-period]')?.textContent).toMatch(/7月.*8月/);
    expect(figure.querySelector('[data-financial-unit]')?.textContent).toContain('円');
    expect(figure.querySelector('[data-financial-series]')?.textContent).toContain('増減額');
    expect(figure.querySelector('[data-financial-action]')?.textContent).toMatch(/表|明細/);

    const table = within(figure).getByRole('table', { name: /正確な値/ });
    expect(within(table).getByRole('columnheader', { name: /増減額/ })).toBeTruthy();
    expect(within(table).getByRole('rowheader', { name: '広告宣伝費' })).toBeTruthy();
    expect(within(table).getByRole('cell', { name: '+¥30,000' })).toBeTruthy();
  });

  it('semantic tableの値はchartと同じmover modelから生成される', () => {
    const { container } = render(<MatrixMoversChart data={matrix} />);
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');
    if (!figure) throw new Error('financial figure contract missing');

    const chart = within(figure).getByRole('img');
    expect(chart.getAttribute('aria-label')).not.toContain('¥30,000');

    const table = within(figure).getByRole('table', { name: /正確な値/ });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('cell', { name: '-¥5,000' })).toBeTruthy();
  });

  it('正確な値は展開操作の下にあり、閉じても結論・期間・単位は残る', () => {
    const { container } = render(<MatrixMoversChart data={matrix} />);
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');
    if (!figure) throw new Error('financial figure contract missing');

    const disclosure = within(figure).getByText('正確な値を表で確認');
    expect(disclosure.closest('summary')).not.toBeNull();
    expect(figure.querySelector('[data-financial-summary]')).not.toBeNull();
    expect(figure.querySelector('[data-financial-period]')).not.toBeNull();
    expect(figure.querySelector('[data-financial-unit]')).not.toBeNull();
  });

  it('20系列でもChart.jsは上位6件+他N件に集約し、正確な表は全支払先を保つ', async () => {
    const vendors = Array.from({ length: 20 }, (_, index) => `支払先${String(index + 1).padStart(2, '0')}`);
    const months = ['2026-07', '2026-08'];
    const matrix = Object.fromEntries(
      vendors.map((vendor, index) => [vendor, months.map(() => (index + 1) * 1_000)]),
    );
    const payload = {
      months,
      vendors,
      matrix,
      other: [500, 500],
      vendorTable: vendors.map((vendor, index) => ({
        vendor,
        prevActual: 0,
        currAnnualized: (index + 1) * 12_000,
        delta: 1,
        lastMonthly: (index + 1) * 1_000,
        avgMonthly: (index + 1) * 1_000,
        last12Total: (index + 1) * 2_000,
        activeMonths: 2,
      })),
      now: {
        month: '2026-08',
        monthlyTotal: 210_500,
        annualized: 2_526_000,
        last12Total: 421_000,
        revenueShare: 0.1,
      },
      alerts: [],
      years: { curr: '2026', prev: '2025' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/api/subscriptions')
          ? payload
          : url.includes('/api/sub-vendors/candidates')
            ? { candidates: [], excluded: [], dealRows: 0 }
            : { vendors: [], accountOptions: [], review: [] };
        return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SubscriptionsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const chart = await screen.findByRole('img', { name: '月別のサブスク支払い内訳を積み上げで示す図' });
    expect(chart.getAttribute('data-dataset-labels')).toBe(
      '支払先20|支払先19|支払先18|支払先17|支払先16|支払先15|他14件',
    );
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');
    if (!figure) throw new Error('subscription financial figure missing');
    const visibleSeries = within(figure).getByRole('list', { name: '図の系列' });
    expect(
      within(visibleSeries)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['支払先20', '支払先19', '支払先18', '支払先17', '支払先16', '支払先15', '他14件']);
    const table = within(figure).getByRole('table', { name: /正確な値/ });
    // 図は上位6件+他N件へ畳むが、正確な表は20支払先すべてを残す。ここが表の存在理由なので、
    // 一部を抜き取るのではなく見出しの全件を固定する(畳まれたら件数が合わずに落ちる)。
    //
    // アクセシブル名の文字列そのものは見ない。見出しは「ラベルのテキストノード + 単位のspan」の
    // 2ノードでできており、その連結に区切りの空白を入れるかは算出側の実装差になる
    // (同一バージョンでも macOS では「支払先01（円）」、CI(Linux)では「支払先01 （円）」)。
    // 守りたいのは表記と読み上げ用の単位が両方あることなので、その2つを別々に確かめる。
    const headers = within(table).getAllByRole('columnheader');
    const headerLabels = headers.map((th) => {
      const visible = th.cloneNode(true) as HTMLElement;
      for (const hidden of visible.querySelectorAll('.visually-hidden')) hidden.remove();
      return visible.textContent?.trim() ?? '';
    });
    expect(headerLabels).toEqual(['月', ...vendors, 'その他']);
    // 数値列は見出し文に単位を出さず、読み上げにだけ渡す。
    expect(headers.slice(1).map((th) => th.querySelector('.visually-hidden')?.textContent)).toEqual(
      Array.from({ length: vendors.length + 1 }, () => '（円）'),
    );

    // 集約後の7系列は、凡例チップと図で同じ色でなければ対応が読めない。
    const legend = legendColors(figure);
    const chartByLabel = chartColors(figure);
    for (const label of chartByLabel.keys()) {
      expect(legend.get(label), `${label} の凡例チップ`).toBe(chartByLabel.get(label));
    }
    expect(new Set([...legend.values()]).size).toBe(legend.size);
  });
});

/**
 * 凡例チップの色と図の色の対応。
 *
 * ReportChart は kind ごとに色の付け方が違うので、系列の並び順(index)ではなく
 * 構築済み datasets から系列名で色を引き当てている。ここがずれても
 * 「静かに間違った色の凡例が出る」だけで気づけないため、非自明な kind を名指しで固定する。
 */
describe('凡例チップの色は図のデータセットから引く', () => {
  it('pareto: 系列の並び順ではなく系列名で引き当てる', () => {
    // 累積構成比を先に置く。index で引くと金額の色が累積構成比に付いてしまう並び。
    const { container } = render(
      <ReportChartView
        chart={reportChart({
          kind: 'pareto',
          title: '科目別の金額と累積構成比',
          data: {
            labels: ['科目A', '科目B', '科目C'],
            series: [
              { label: '累積構成比', data: [0.5, 0.8, 1], role: 'cum' },
              { label: '金額', data: [500, 300, 200] },
            ],
          },
        })}
      />,
    );
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');
    if (!figure) throw new Error('pareto figure missing');

    const legend = legendColors(figure);
    const chartByLabel = chartColors(figure);
    expect([...chartByLabel.keys()]).toEqual(['金額', '累積構成比']);
    expect(legend.get('金額')).toBe(chartByLabel.get('金額'));
    expect(legend.get('累積構成比')).toBe(chartByLabel.get('累積構成比'));
    expect(legend.get('金額')).toBeTruthy();
    expect(legend.get('金額')).not.toBe(legend.get('累積構成比'));
  });

  it('band: 帯の系列が専用色でも他の系列の色がずれない', () => {
    const { container } = render(
      <ReportChartView
        chart={reportChart({
          kind: 'band',
          title: '経費と平均±2σ',
          data: {
            labels: ['1月', '2月', '3月'],
            series: [
              { label: '月次経費', data: [100, 120, 90] },
              { label: '平均', data: [103, 103, 103], role: 'line' },
              { label: '平均+2σ', data: [150, 150, 150], role: 'band' },
              { label: '平均-2σ', data: [60, 60, 60], role: 'band' },
            ],
          },
        })}
      />,
    );
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');
    if (!figure) throw new Error('band figure missing');

    const legend = legendColors(figure);
    const chartByLabel = chartColors(figure);
    for (const label of ['月次経費', '平均', '平均+2σ', '平均-2σ']) {
      expect(legend.get(label), `${label} の凡例チップ`).toBe(chartByLabel.get(label));
      expect(legend.get(label), `${label} の凡例チップ`).toBeTruthy();
    }
    // 帯の2本は同じ色でよいが、実線・破線とは別の色でなければ帯だと読めない。
    expect(legend.get('平均+2σ')).toBe(legend.get('平均-2σ'));
    expect(legend.get('平均+2σ')).not.toBe(legend.get('月次経費'));
    expect(legend.get('月次経費')).not.toBe(legend.get('平均'));
  });

  it('waterfall: 値ごとに色が変わる図では凡例が色を主張しない', () => {
    const { container } = render(
      <ReportChartView
        chart={reportChart({
          kind: 'waterfall',
          title: '残高の増減',
          data: {
            labels: ['期首', '増加', '減少', '期末'],
            series: [
              { label: '残高', data: [1000, null, null, 900], role: 'total' },
              { label: '増減', data: [null, 200, -300, null] },
            ],
          },
        })}
      />,
    );
    const figure = container.querySelector<HTMLElement>('[data-financial-figure]');
    if (!figure) throw new Error('waterfall figure missing');

    // 増加=赤/減少=緑を1本のデータセットに色配列で塗るため、系列に1色は決まらない。
    // ここで色を主張すると、図に無い色のチップが出る。
    const legend = legendColors(figure);
    expect(legend.size).toBeGreaterThan(0);
    for (const [label, color] of legend) {
      expect(color, `${label} の凡例チップ`).toBeUndefined();
    }
  });

  it('同じ画面に並ぶ図の「次の行動」は、互いに違う次の一手を指す', () => {
    // 1画面に図が複数並ぶとき、全部が同じ書き出し(「…を表で確認し、」)になると
    // どれも次の行動として読まれなくなる。かつ直下の <details> の見出しが
    // 「正確な値を表で確認」なので、その前置きは逐語の重複でもある。
    const { container } = render(<CashFlowCharts cf={cashFlow} />);
    const actions = [...container.querySelectorAll('[data-financial-action]')].map(
      (element) => element.textContent?.replace('次の行動:', '').trim() ?? '',
    );

    // 対象0件で緑にならないよう、まず件数を固定する。
    expect(actions).toHaveLength(2);
    expect(new Set(actions).size, `重複した次の行動: ${actions.join(' / ')}`).toBe(actions.length);
    for (const action of actions) {
      expect(action.length).toBeGreaterThan(0);
      expect(action, '直下の details 見出しと同じ「表で確認」を前置きにしない').not.toMatch(/表で.*確認/);
    }
  });
});
