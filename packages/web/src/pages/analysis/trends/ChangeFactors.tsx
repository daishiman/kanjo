import { Chart } from 'react-chartjs-2';
import type { TrendsScreen } from '../../../api.js';
import { Button } from '../../../components/Button.js';
import { FinancialFigure } from '../../../components/FinancialFigure.js';
import { COLORS, baseChartOptions, chartDecorativeFill, yenTick } from '../../../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  seriesData,
} from '../../../components/figure-view-model.js';
import { pct, ratio } from '../../../format.js';
import { changeClass, changeTone, sideLabel, signedYen } from './format.js';
import type { TrendSide } from './types.js';
import { buildChangeParetoViewModel } from './view-model.js';

export function ChangeFactors({
  screen,
  onSelect,
}: {
  screen: TrendsScreen;
  onSelect: (category: string, side: TrendSide) => void;
}) {
  const view = buildChangeParetoViewModel(screen);
  const metric = screen.metrics.find((item) => item.id === screen.selection.metric);
  const selectedSide = screen.selection.side ?? null;
  const total = Math.max(1, view.totalContribution);
  const model = createFinancialFigureModel({
    id: 'trends-change-pareto',
    title: '増減の要因(パレート図)',
    summary: view.rows[0]
      ? `${view.rows[0].name}が増減の${ratio(Math.abs(view.rows[0].change) / total)}を占めます。`
      : '増減はありません。',
    period: screen.comparePeriod?.label ?? '選択期間',
    unitLabel: '増減額（円） / 累計絶対寄与（%）',
    rowHeader: 'カテゴリ',
    labels: view.rows.map((row) => row.name),
    series: [
      {
        key: 'change',
        label: '増減額',
        values: view.rows.map((row) => row.change),
        unit: 'yen',
        signed: true,
      },
      {
        key: 'cumulative',
        label: '累計絶対寄与',
        values: view.rows.map((row) => row.cumulativeShare),
        unit: 'pct',
        color: COLORS.accent,
      },
    ],
    action: '累計8割に届くまでのカテゴリから、明細を確認します。',
  });
  return (
    <section className="trends-factors" aria-label="増減の要因">
      <div className="card trends-pareto">
        <FinancialFigure model={model}>
          <Chart
            type="bar"
            role="img"
            aria-label="カテゴリ別の符号付き増減額と累計絶対寄与を示す図"
            fallbackContent="カテゴリ別の符号付き増減額と累計絶対寄与を示す図"
            data={{
              labels: figureLabels(model),
              datasets: [
                {
                  type: 'bar' as const,
                  label: model.series[0]?.label,
                  data: seriesData(model, 0),
                  backgroundColor: view.rows.map((row) =>
                    chartDecorativeFill(
                      changeTone(row.change, metric?.betterWhen) === 'favorable'
                        ? COLORS.good
                        : changeTone(row.change, metric?.betterWhen) === 'unfavorable'
                          ? COLORS.danger
                          : COLORS.neutral,
                      0.72,
                    ),
                  ),
                  borderColor: view.rows.map((row) => {
                    const tone = changeTone(row.change, metric?.betterWhen);
                    return tone === 'favorable'
                      ? COLORS.good
                      : tone === 'unfavorable'
                        ? COLORS.danger
                        : COLORS.neutral;
                  }),
                  borderWidth: 1,
                  yAxisID: 'y',
                },
                {
                  type: 'line' as const,
                  label: model.series[1]?.label,
                  data: seriesData(model, 1).map((value) => (value ?? 0) * 100),
                  borderColor: COLORS.accent,
                  backgroundColor: COLORS.accent,
                  yAxisID: 'y1',
                },
              ],
            }}
            options={{
              ...baseChartOptions(),
              scales: {
                y: { ticks: { callback: yenTick } },
                y1: {
                  position: 'right' as const,
                  min: 0,
                  max: 100,
                  grid: { drawOnChartArea: false },
                  ticks: { callback: (value: number | string) => `${value}%` },
                },
              },
              plugins: { legend: { display: false } },
            }}
          />
        </FinancialFigure>
      </div>
      <aside className="card trends-top-movers" aria-labelledby="trends-top-movers-title">
        <h3 id="trends-top-movers-title">増減が大きい項目(上位3つ)</h3>
        <ol className="trends-movers">
          {screen.topMovers.slice(0, 3).map((mover) => {
            const selected = screen.selection.category === mover.name && selectedSide === mover.side;
            return (
              <li key={`${mover.side}-${mover.name}`}>
                <Button
                  className="trends-mover"
                  aria-pressed={selected}
                  onClick={() => onSelect(mover.name, mover.side)}
                >
                  <span className="trends-mover-rank" aria-hidden="true" />
                  <span>
                    <strong>{mover.name}</strong>
                    <span className="sub">
                      {sideLabel(mover.side)} ・ 寄与度 {pct(mover.contribution)}
                    </span>
                    <span className="sub">
                      {mover.payees[0]
                        ? `${mover.payees[0].payee}の${(mover.payees[0].change ?? 0) >= 0 ? '増加' : '減少'}が中心`
                        : '取引先別の内訳はありません'}
                    </span>
                  </span>
                  <span className={changeClass(mover.change, metric?.betterWhen)}>
                    {signedYen(mover.change)}
                  </span>
                </Button>
              </li>
            );
          })}
        </ol>
      </aside>
    </section>
  );
}
