import { Chart } from 'react-chartjs-2';
import type { DiagnosisWaterfallBar } from '../../../api.js';
import { FinancialFigure } from '../../../components/FinancialFigure.js';
import { COLORS, baseChartOptions, chartDecorativeFill, yenTick } from '../../../components/charts.js';
import { createFinancialFigureModel, figureLabels } from '../../../components/figure-view-model.js';
import { yen } from '../../../format.js';

/**
 * 改善インパクトのウォーターフォール (FR-006 / ADR-005)。
 *
 * chart.js 4 の floating bar (1 本を [from, to] で与える) で描く。専用の
 * waterfall プラグインを足さないのは、依存を 1 つ増やすほどの表現でないため。
 * 棒の並びと値は core が組んだ `waterfall` をそのまま使い、ここで積み直さない。
 */
/*
 * 棒の色は COLORS の三項をその場に書く。ヘルパ関数へ畳むと chart-series-contract の
 * AST 検査が色の出どころを辿れず「承認済み role 由来でない」と判定される。
 */

export function DiagnosisImpactWaterfall({ waterfall }: { waterfall: readonly DiagnosisWaterfallBar[] }) {
  if (waterfall.length < 2) return null;
  const base = waterfall[0];
  const result = waterfall[waterfall.length - 1];
  const model = createFinancialFigureModel({
    id: 'diagnosis-waterfall',
    title: '改善インパクト',
    summary: `未対応の改善をすべて実行すると、${base.label.replace('現状の', '')}は ${yen(base.to)} から ${yen(result.to)} になります。`,
    period: '直近12ヶ月換算',
    rowHeader: '項目',
    labels: waterfall.map((bar) => bar.label),
    series: [
      { key: 'from', label: '変化前', values: waterfall.map((bar) => bar.from), unit: 'yen' },
      { key: 'to', label: '変化後', values: waterfall.map((bar) => bar.to), unit: 'yen' },
    ],
    action: '上位の項目から着手し、表のステータスを「対応中」に変えて進みを残します。',
  });
  return (
    <div className="card diagnosis-waterfall">
      <FinancialFigure model={model}>
        <Chart
          type="bar"
          role="img"
          aria-label={`${base.label}から改善余地を順に反映し、${result.label}に至る図`}
          fallbackContent={`${base.label}から改善余地を順に反映し、${result.label}に至る図`}
          data={{
            labels: figureLabels(model),
            datasets: [
              {
                type: 'bar' as const,
                label: base.label.replace('現状の', ''),
                data: waterfall.map((bar) => [bar.from, bar.to] as [number, number]),
                backgroundColor: waterfall.map((bar) =>
                  chartDecorativeFill(
                    bar.kind === 'base'
                      ? COLORS.neutral
                      : bar.kind === 'cut' || bar.kind === 'gain'
                        ? COLORS.good
                        : COLORS.accent,
                    0.72,
                  ),
                ),
                borderColor: waterfall.map((bar) =>
                  bar.kind === 'base'
                    ? COLORS.neutral
                    : bar.kind === 'cut' || bar.kind === 'gain'
                      ? COLORS.good
                      : COLORS.accent,
                ),
                borderWidth: 1,
              },
            ],
          }}
          options={{
            ...baseChartOptions(),
            scales: {
              x: { grid: { display: false } },
              y: { beginAtZero: true, ticks: { callback: yenTick } },
            },
            plugins: { legend: { display: false } },
          }}
        />
      </FinancialFigure>
    </div>
  );
}
