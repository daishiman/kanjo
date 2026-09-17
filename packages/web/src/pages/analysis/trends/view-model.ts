import type { TrendMetricVisualRole, TrendsScreen } from '@kanjo/core';

export type TrendSeriesRole = TrendMetricVisualRole | 'comparison' | 'difference';

export interface TrendSeriesViewModelItem {
  key: string;
  label: string;
  values: readonly (number | null)[];
  role: TrendSeriesRole;
}

export interface TrendSeriesViewModel {
  labels: readonly string[];
  currentSeries: readonly TrendSeriesViewModelItem[];
  comparisonSeries: TrendSeriesViewModelItem | null;
  differenceSeries: TrendSeriesViewModelItem;
  selectionBand: { month: string; index: number } | null;
}

/**
 * API の集計値を描画契約へ写す pure adapter。
 * 色・canvas・React には依存せず、図と検証が同じ値を参照できるようにする。
 */
export function buildTrendSeriesViewModel(screen: TrendsScreen): TrendSeriesViewModel {
  const currentSeries = screen.metrics
    .filter((metric) => metric.showInOverview || metric.id === screen.selection.metric)
    .flatMap((metric) => {
      const values = screen.series.values[metric.id];
      if (!values) return [];
      return [
        {
          key: `current-${metric.id}`,
          label: `${metric.label}(今回)`,
          values: values.current,
          role: metric.visualRole,
        },
      ];
    });
  const selectedMetric = screen.metrics.find((metric) => metric.id === screen.selection.metric);
  const selectedValues = screen.series.values[screen.selection.metric];
  const comparisonSeries =
    selectedValues?.compare && selectedMetric
      ? {
          key: `comparison-${selectedMetric.id}`,
          label: `${selectedMetric.label}(${screen.comparePeriod?.label ?? '比較'})`,
          values: selectedValues.compare,
          role: 'comparison' as const,
        }
      : null;
  const selectedIndex = screen.selection.month ? screen.series.months.indexOf(screen.selection.month) : -1;

  return {
    labels: screen.series.months,
    currentSeries,
    comparisonSeries,
    differenceSeries: {
      key: 'difference',
      label: '月次差',
      values: screen.series.diff,
      role: 'difference',
    },
    selectionBand:
      selectedIndex >= 0 && screen.selection.month
        ? { month: screen.selection.month, index: selectedIndex }
        : null,
  };
}

export interface ChangeParetoViewModelRow {
  name: string;
  side: TrendsScreen['changePareto'][number]['side'];
  change: number;
  cumulativeShare: number;
}

export interface ChangeParetoViewModel {
  rows: readonly ChangeParetoViewModelRow[];
  totalContribution: number;
}

/** 棒は符号を保ち、累積線は増減方向に関わらず絶対寄与から作る。 */
export function buildChangeParetoViewModel(screen: TrendsScreen): ChangeParetoViewModel {
  const source = screen.changePareto.slice(0, 15);
  const totalContribution = screen.changePareto.reduce((sum, row) => sum + Math.abs(row.change), 0);
  let cumulative = 0;
  return {
    rows: source.map((row) => {
      cumulative += Math.abs(row.change);
      return {
        name: row.name,
        side: row.side,
        change: row.change,
        cumulativeShare: totalContribution === 0 ? 0 : cumulative / totalContribution,
      };
    }),
    totalContribution,
  };
}
