import { SUBS_OTHER_CATEGORY, type SubscriptionsScreen } from '@kanjo/core';
import { Chart } from 'react-chartjs-2';
import { FinancialFigure } from '../../components/FinancialFigure.js';
import { type ChartColorName, baseChartOptions, chartSeriesColor, yenTick } from '../../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
} from '../../components/figure-view-model.js';
import { monthShort, yen } from '../../format.js';

/**
 * 系列の色 (U-5)。応答の系列順 (上位 3 カテゴリ → その他) に固定順で割り当て、月ごとに変えない。
 * 「その他」は常に neutral にして、上位のカテゴリと取り違えないようにする。
 */
const SERIES_COLORS: readonly ChartColorName[] = ['biz', 'per', 'good'];
const trendSeriesRole = (category: string, index: number): ChartColorName =>
  category === SUBS_OTHER_CATEGORY ? 'neutral' : (SERIES_COLORS[index] ?? 'neutral');

/** 月次のサブスク支出推移 (spec §7)。カテゴリ別の積み上げ棒で、棒の和 = 直近12か月の支払額 */
export function CategoryTrendChart({ trend }: { trend: SubscriptionsScreen['trend'] }) {
  const labels = trend.months.map(monthShort);
  const colors = trend.series.map((series, index) =>
    chartSeriesColor(trendSeriesRole(series.category, index)),
  );
  const latest = trend.months.length - 1;
  const latestTotal = trend.series.reduce((sum, series) => sum + (series.values[latest] ?? 0), 0);
  const model = createFinancialFigureModel({
    id: 'subscriptions-category-monthly',
    title: '月次のサブスク支出推移',
    summary:
      latest >= 0
        ? `${labels[latest]}のサブスク支払いは${yen(latestTotal)}です。`
        : '対象期間の支払いはありません。',
    period: financialPeriod(labels),
    labels,
    summarySeries: trend.series.map((series, index) => ({
      key: series.category,
      label: series.category,
      color: colors[index] as string,
    })),
    series: trend.series.map((series) => ({
      key: series.category,
      label: series.category,
      values: series.values,
      unit: 'yen' as const,
    })),
    action: '支払いが増えた月のカテゴリから、重複や値上げの契約を探します。',
  });
  const labelList = trend.series.map((series) => series.category);

  return (
    <section className="card subs-trend" aria-label="月次のサブスク支出推移">
      <FinancialFigure model={model} headingLevel={2}>
        <Chart
          type="bar"
          role="img"
          aria-label="月別のサブスク支払いをカテゴリ別の積み上げで示す図"
          fallbackContent="月別のサブスク支払いをカテゴリ別の積み上げで示す図"
          data-financial-dataset-count={trend.series.length}
          data-financial-dataset-labels={labelList.join('|')}
          data={{
            labels: figureLabels(model),
            datasets: trend.series.map((series, index) => ({
              label: series.category,
              data: series.values,
              backgroundColor: chartSeriesColor(trendSeriesRole(series.category, index)),
              stack: 's',
            })),
          }}
          options={{
            ...baseChartOptions(),
            scales: {
              x: { stacked: true },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: { callback: yenTick },
              },
            },
            interaction: { mode: 'index', intersect: false },
            plugins: {
              // canvas 内の凡例は出さず、FinancialFigure の DOM 凡例を単一の正本にする。
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (item) => `${item.dataset.label}: ${yen(Number(item.parsed.y))}`,
                  footer: (items) =>
                    `この月の合計: ${yen(items.reduce((sum, i) => sum + Number(i.parsed.y), 0))}`,
                },
              },
            },
          }}
        />
      </FinancialFigure>
    </section>
  );
}
