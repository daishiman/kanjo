import type { StatementsScreen } from '@kanjo/core';
import type { ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { CashFlow, MatrixData } from '../api.js';
import { monthShort, yen, yenS } from '../format.js';
import { FinancialFigure } from './FinancialFigure.js';
import { tooltipOptions } from './chart-tooltip.js';
import { COLORS, baseChartOptions, chartDecorativeFill, chartSeriesColor, yenTick } from './charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from './figure-view-model.js';

const legend = {
  position: 'bottom' as const,
  labels: { usePointStyle: true, pointStyle: 'rectRounded' as const, boxWidth: 9, boxHeight: 9, padding: 16 },
};

const verticalOptions = (showLegend = true): ChartOptions<'bar' | 'line'> => ({
  ...baseChartOptions(),
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { callback: yenTick } },
  },
  plugins: {
    legend: showLegend ? legend : { display: false },
    tooltip: tooltipOptions('yen'),
  },
});

const horizontalOptions = (stacked = false): ChartOptions<'bar'> => ({
  ...baseChartOptions(),
  indexAxis: 'y',
  interaction: { mode: 'nearest', intersect: false },
  scales: {
    x: { beginAtZero: true, stacked, ticks: { callback: yenTick } },
    y: { stacked, grid: { display: false }, ticks: { autoSkip: false } },
  },
  plugins: {
    legend: stacked ? legend : { display: false },
    tooltip: tooltipOptions('yen'),
  },
});

/**
 * 決算書画面の「月別の損益推移」。売上高・売上原価を棒、営業利益を線で重ねる。
 * 数字は core の statementsScreen の PL 行 (monthly) をそのまま使い、ここでは足し直さない。
 */
export function StatementsPlTrendChart({ rows }: { rows: StatementsScreen['pl']['rows'] }) {
  const sales = rows.find((row) => row.key === 'sales');
  const cogs = rows.find((row) => row.key === 'cogs');
  const operating = rows.find((row) => row.key === 'operating');
  if (!sales || !cogs || !operating || sales.monthly.length === 0) return null;
  const labels = sales.monthly.map((point) => monthShort(point.month));
  const latestIndex = labels.length - 1;
  const latestOperating = operating.monthly[latestIndex]?.amount ?? 0;
  const model = createFinancialFigureModel({
    id: 'statements-pl-trend',
    title: '月別の損益推移',
    summary: `${labels[latestIndex]}の営業利益は${yenS(latestOperating)}です。`,
    period: financialPeriod(labels),
    labels,
    series: [
      {
        key: 'sales',
        label: '売上高',
        values: sales.monthly.map((p) => p.amount),
        unit: 'yen',
        color: COLORS.income,
      },
      {
        key: 'cogs',
        label: '売上原価',
        values: cogs.monthly.map((p) => p.amount),
        unit: 'yen',
        color: COLORS.expense,
      },
      {
        key: 'operating',
        label: '営業利益',
        values: operating.monthly.map((p) => p.amount),
        unit: 'yen',
        signed: true,
        color: COLORS.net,
      },
    ],
    action: '営業利益が落ちた月は、売上原価と販管費のどちらが増えたかを表で確かめます。',
  });
  return (
    <FinancialFigure
      model={model}
      variant="companion-table"
      className="card stmt-pl-trend"
      chartClassName="stmt-pl-trend-chart"
      beforeChart={<span className="table-unit stmt-pl-trend-unit">(万円)</span>}
    >
      <Chart
        type={'bar' as 'bar' | 'line'}
        role="img"
        aria-label="月別の売上高、売上原価、営業利益の推移を示す図"
        fallbackContent="月別の売上高、売上原価、営業利益の推移を示す図"
        data={{
          labels: figureLabels(model),
          datasets: [
            {
              label: model.series[0]?.label,
              data: seriesData(model, 0),
              backgroundColor: COLORS.income,
              borderRadius: 3,
            },
            {
              label: model.series[1]?.label,
              data: seriesData(model, 1),
              backgroundColor: COLORS.expense,
              borderRadius: 3,
            },
            {
              type: 'line' as const,
              label: model.series[2]?.label,
              data: seriesData(model, 2),
              borderColor: COLORS.net,
              backgroundColor: COLORS.net,
              pointBackgroundColor: seriesData(model, 2).map((value) =>
                (value ?? 0) >= 0 ? COLORS.good : COLORS.danger,
              ),
              pointRadius: 3,
              borderWidth: 2,
              tension: 0.18,
            },
          ],
        }}
        options={verticalOptions(false)}
      />
    </FinancialFigure>
  );
}

export function CashFlowCharts({
  cf,
}: {
  cf: Pick<CashFlow, 'months' | 'cumulative' | 'total' | 'limits'>;
}) {
  if (!cf.months.length) return null;
  const labels = cf.months.map((month) => monthShort(month.month));
  const latest = cf.months[cf.months.length - 1];
  const comparisonModel = createFinancialFigureModel({
    id: 'cashflow-monthly',
    title: '月別の利益と営業キャッシュフロー',
    summary: `${labels[labels.length - 1]}は利益${yenS(latest?.profit)}、営業CF${yenS(
      latest?.operating,
    )}です。`,
    period: financialPeriod(labels),
    labels,
    series: [
      {
        key: 'profit',
        label: '利益',
        values: cf.months.map((month) => month.profit),
        unit: 'yen',
        signed: true,
        color: COLORS.neutral,
      },
      {
        key: 'operating',
        label: '営業CF',
        values: cf.months.map((month) => month.operating),
        unit: 'yen',
        signed: true,
      },
    ],
    action: '利益と営業CFがずれた月に、売掛金や在庫の増加がないか照合します。',
  });
  const cumulativeLatest = cf.cumulative[cf.cumulative.length - 1] ?? 0;
  const cumulativeModel = createFinancialFigureModel({
    id: 'cashflow-cumulative',
    title: '営業キャッシュフロー累計',
    summary: `期首から${labels[labels.length - 1]}までの現金増減は${yenS(cumulativeLatest)}です。`,
    period: financialPeriod(labels),
    unitLabel: '円（期首=0）',
    labels,
    series: [
      { key: 'cumulative', label: '累計（期首=0）', values: cf.cumulative, unit: 'yen', signed: true },
    ],
    action: '累計がマイナスに転じた月を起点に、支払いの前倒しがなかったか遡ります。',
  });
  return (
    <div className="analysis-visual">
      <FinancialFigure
        model={comparisonModel}
        afterChart={<p className="chart-guide">2本の棒の差で、入金・支払時期のズレを見つけます。</p>}
      >
        <Chart
          type="bar"
          role="img"
          aria-label="月別の利益と営業キャッシュフローの比較図"
          fallbackContent="月別の利益と営業キャッシュフローの比較図"
          data={{
            labels: figureLabels(comparisonModel),
            datasets: [
              {
                label: comparisonModel.series[0]?.label,
                data: seriesData(comparisonModel, 0),
                backgroundColor: chartSeriesColor('neutral'),
                borderRadius: 3,
              },
              {
                label: comparisonModel.series[1]?.label,
                data: seriesData(comparisonModel, 1),
                backgroundColor: seriesData(comparisonModel, 1).map((value) =>
                  (value ?? 0) >= 0 ? chartSeriesColor('good') : chartSeriesColor('danger'),
                ),
                borderRadius: 3,
              },
            ],
          }}
          options={verticalOptions(false)}
        />
      </FinancialFigure>
      <FinancialFigure
        model={cumulativeModel}
        chartClassName="cashflow-cumulative-chart"
        afterChart={<p className="chart-guide">期首を0として、期間中の現金の増減を追います。</p>}
      >
        <Chart
          type={'line' as 'bar' | 'line'}
          role="img"
          aria-label="期首を0とした営業キャッシュフロー累計の推移図"
          fallbackContent="期首を0とした営業キャッシュフロー累計の推移図"
          data={{
            labels: figureLabels(cumulativeModel),
            datasets: [
              {
                label: cumulativeModel.series[0]?.label,
                data: seriesData(cumulativeModel, 0),
                borderColor: COLORS.ink,
                backgroundColor: chartDecorativeFill(COLORS.good, 0.14),
                pointBackgroundColor: seriesData(cumulativeModel, 0).map((value) =>
                  (value ?? 0) >= 0 ? COLORS.good : COLORS.danger,
                ),
                pointRadius: 2,
                borderWidth: 2,
                tension: 0.18,
                fill: true,
              },
            ],
          }}
          options={verticalOptions(false)}
        />
      </FinancialFigure>
    </div>
  );
}

export function BalanceSheetChart({ bs }: { bs: StatementsScreen['bs'] }) {
  if (!bs.complete || bs.liabilities === null || bs.liabilityTotal === null || bs.netAssets === null) {
    return <p className="sub">資産と負債・純資産の図は、負債を入力した月ができると表示します。</p>;
  }
  const netAssets = bs.netAssets;
  const model = createFinancialFigureModel({
    id: 'balance-sheet-equation',
    title: netAssets < 0 ? '資産と負債の比較' : '資産と負債・純資産の均衡',
    summary:
      netAssets < 0
        ? `負債が資産を${yen(Math.abs(netAssets))}上回っています。`
        : `資産${yen(bs.assetTotal)}と、負債・純資産の合計が均衡しています。`,
    period: `${monthShort(bs.referenceMonth)} / ${bs.asOf}時点`,
    rowHeader: '内訳',
    labels: ['資産', '負債', '純資産'],
    series: [
      {
        key: 'balance',
        label: '残高',
        values: [bs.assetTotal, bs.liabilityTotal, netAssets],
        unit: 'yen',
        signed: true,
      },
    ],
    action:
      netAssets < 0
        ? '負債の明細を開き、返済期限が近いものから対応の順番を決めます。'
        : '資産と負債の内訳が、実際に把握している残高と一致するか照合します。',
  });
  if (netAssets < 0) {
    return (
      <div className="analysis-visual">
        <FinancialFigure
          model={model}
          chartClassName="balance-chart"
          afterChart={<p className="chart-guide">赤の負債が資産より長い場合は負債超過です。</p>}
        >
          <Chart
            type="bar"
            role="img"
            aria-label="資産と負債の長さを比較する図"
            fallbackContent="資産と負債の長さを比較する図"
            data={{
              labels: figureLabels(model).slice(0, 2),
              datasets: [
                {
                  label: model.series[0]?.label,
                  data: seriesData(model, 0).slice(0, 2),
                  backgroundColor: [chartSeriesColor('biz'), chartSeriesColor('danger')],
                },
              ],
            }}
            options={horizontalOptions()}
          />
        </FinancialFigure>
      </div>
    );
  }
  return (
    <div className="analysis-visual">
      <FinancialFigure
        model={model}
        chartClassName="balance-chart"
        afterChart={<p className="chart-guide">左右の長さで、資産 = 負債 + 純資産を確認します。</p>}
      >
        <Chart
          type="bar"
          role="img"
          aria-label="資産と負債・純資産の均衡を比較する図"
          fallbackContent="資産と負債・純資産の均衡を比較する図"
          data={{
            labels: ['資産', '負債・純資産'],
            datasets: [
              {
                label: '資産',
                data: [seriesData(model, 0)[0], null],
                backgroundColor: chartSeriesColor('biz'),
              },
              {
                label: '負債',
                data: [null, seriesData(model, 0)[1]],
                backgroundColor: chartSeriesColor('neutral'),
              },
              {
                label: '純資産',
                data: [null, seriesData(model, 0)[2]],
                backgroundColor: chartSeriesColor('good'),
              },
            ],
          }}
          options={horizontalOptions(true)}
        />
      </FinancialFigure>
    </div>
  );
}
