import type { Chart as ChartJS, ChartOptions, Plugin } from 'chart.js';
import { useRef } from 'react';
import { Chart, getElementAtEvent } from 'react-chartjs-2';
import type { TrendsScreen } from '../../../api.js';
import { FinancialFigure } from '../../../components/FinancialFigure.js';
import { tooltipOptions } from '../../../components/chart-tooltip.js';
import {
  COLORS,
  baseChartOptions,
  chartDecorativeFill,
  chartSeriesColor,
  yenTick,
} from '../../../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from '../../../components/figure-view-model.js';
import { monthLabel, monthShort } from '../../../format.js';
import { TrendDetailPanel } from './TrendDetailPanel.js';
import { changeTone, signedYen } from './format.js';
import {
  type TrendSeriesRole,
  type TrendSeriesViewModelItem,
  buildTrendSeriesViewModel,
} from './view-model.js';

const roleColor = (role: TrendSeriesRole): string => {
  if (role === 'income') return chartSeriesColor('income');
  if (role === 'expense') return chartSeriesColor('expense');
  if (role === 'net') return chartSeriesColor('net');
  if (role === 'difference') return COLORS.warnFill;
  return chartSeriesColor('neutral');
};

const selectedMonthBand = (index: number): Plugin<'bar' | 'line'> => ({
  id: 'trendsSelectedMonthBand',
  beforeDatasetsDraw(chart) {
    if (index < 0) return;
    const x = chart.scales.x;
    const area = chart.chartArea;
    if (!x || !area) return;
    const center = x.getPixelForValue(index);
    const labelCount = chart.data.labels?.length ?? 0;
    if (labelCount <= 1) {
      const halfWidth = Math.max(8, (area.right - area.left) / 2);
      chart.ctx.save();
      chart.ctx.fillStyle = chartDecorativeFill(COLORS.accent, 0.1);
      chart.ctx.fillRect(center - halfWidth, area.top, halfWidth * 2, area.bottom - area.top);
      chart.ctx.restore();
      return;
    }
    const before =
      index > 0 ? x.getPixelForValue(index - 1) : center - (x.getPixelForValue(index + 1) - center);
    const after =
      index < chart.data.labels!.length - 1
        ? x.getPixelForValue(index + 1)
        : center + (center - x.getPixelForValue(index - 1));
    const halfWidth = Math.max(8, Math.min(Math.abs(center - before), Math.abs(after - center)) / 2);
    chart.ctx.save();
    chart.ctx.fillStyle = chartDecorativeFill(COLORS.accent, 0.1);
    chart.ctx.fillRect(center - halfWidth, area.top, halfWidth * 2, area.bottom - area.top);
    chart.ctx.restore();
  },
});

const chartOptions = (): ChartOptions<'bar' | 'line'> => ({
  ...baseChartOptions(),
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { callback: yenTick } },
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: tooltipOptions('yen'),
  },
});

const seriesForFigure = (series: TrendSeriesViewModelItem) => ({
  key: series.key,
  label: series.label,
  values: series.values,
  unit: 'yen' as const,
  signed: series.role === 'difference',
  color: roleColor(series.role),
});

export function TrendSeriesPanel({
  screen,
  onSelect,
}: { screen: TrendsScreen; onSelect: (month: string) => void }) {
  const chartRef = useRef<ChartJS<'line' | 'bar'>>(null);
  const view = buildTrendSeriesViewModel(screen);
  const selectedMetric = screen.metrics.find((item) => item.id === screen.selection.metric);
  const allSeries = [
    ...view.currentSeries,
    ...(view.comparisonSeries ? [view.comparisonSeries] : []),
    view.differenceSeries,
  ];
  const model = createFinancialFigureModel({
    id: 'trends-series',
    title: '収支の推移',
    summary: screen.kpis.peakMonth
      ? `最も変化が大きいのは${monthLabel(screen.kpis.peakMonth.month)}で、${signedYen(screen.kpis.peakMonth.diff)}です。`
      : 'この期間に変化はありません。',
    period: financialPeriod(view.labels.map(monthShort)),
    labels: view.labels.map(monthShort),
    series: allSeries.map(seriesForFigure),
    action: '変化が大きい月を選び、右の詳細で要因を確認します。',
  });
  const currentCount = view.currentSeries.length;
  const comparisonIndex = view.comparisonSeries ? currentCount : -1;
  const differenceIndex = currentCount + (view.comparisonSeries ? 1 : 0);
  return (
    <div className="trends-main">
      <div className="card trends-chart">
        <FinancialFigure model={model}>
          <Chart
            type="line"
            role="img"
            aria-label="収入・支出・純収支の月別推移と比較期間、月次差を示す図"
            fallbackContent="収入・支出・純収支の月別推移と比較期間、月次差を示す図"
            data={{
              labels: figureLabels(model),
              datasets: [
                ...view.currentSeries.map((item, index) => ({
                  type: item.role === 'income' ? ('bar' as const) : ('line' as const),
                  label: model.series[index]?.label,
                  data: seriesData(model, index),
                  borderColor:
                    item.role === 'income'
                      ? COLORS.income
                      : item.role === 'expense'
                        ? COLORS.expense
                        : item.role === 'net'
                          ? COLORS.net
                          : COLORS.neutral,
                  backgroundColor:
                    item.role === 'income'
                      ? chartDecorativeFill(COLORS.income, 0.72)
                      : item.role === 'expense'
                        ? COLORS.expense
                        : item.role === 'net'
                          ? COLORS.net
                          : COLORS.neutral,
                  pointRadius: item.role === 'income' ? 0 : 2,
                  order: item.role === 'income' ? 2 : 1,
                })),
                ...(view.comparisonSeries
                  ? [
                      {
                        type: 'line' as const,
                        label: model.series[comparisonIndex]?.label,
                        data: seriesData(model, comparisonIndex),
                        borderColor: COLORS.neutral,
                        backgroundColor: COLORS.neutral,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        order: 1,
                      },
                    ]
                  : []),
                {
                  type: 'bar' as const,
                  label: model.series[differenceIndex]?.label,
                  data: seriesData(model, differenceIndex),
                  backgroundColor: view.differenceSeries.values.map((value) =>
                    chartDecorativeFill(
                      changeTone(value, selectedMetric?.betterWhen) === 'favorable'
                        ? COLORS.good
                        : changeTone(value, selectedMetric?.betterWhen) === 'unfavorable'
                          ? COLORS.danger
                          : COLORS.neutral,
                      0.36,
                    ),
                  ),
                  borderColor: view.differenceSeries.values.map((value) => {
                    const tone = changeTone(value, selectedMetric?.betterWhen);
                    return tone === 'favorable'
                      ? COLORS.good
                      : tone === 'unfavorable'
                        ? COLORS.danger
                        : COLORS.neutral;
                  }),
                  borderWidth: 1,
                  order: 3,
                },
              ],
            }}
            options={chartOptions()}
            plugins={[selectedMonthBand(view.selectionBand?.index ?? -1)]}
            ref={chartRef}
            onClick={(event) => {
              if (!chartRef.current) return;
              const month = view.labels[getElementAtEvent(chartRef.current, event)[0]?.index ?? -1];
              if (month) onSelect(month);
            }}
          />
        </FinancialFigure>
        <label className="trends-month-picker">
          <span>詳細を表示する月</span>
          <select
            aria-label="詳細を表示する月"
            value={screen.selection.month ?? ''}
            onChange={(event) => onSelect(event.target.value)}
          >
            {view.labels.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TrendDetailPanel screen={screen} />
    </div>
  );
}
