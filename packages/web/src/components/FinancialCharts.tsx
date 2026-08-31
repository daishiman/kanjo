import type { ChartOptions } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { BalanceSheet, CashFlow, MatrixData, ProfitAndLoss } from '../api.js';
import { gainCls, monthShort, yen, yenS } from '../format.js';
import { FinancialFigure } from './FinancialFigure.js';
import { tooltipOptions } from './chart-tooltip.js';
import { COLORS, baseChartOptions, yenTick } from './charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from './figure-view-model.js';
import { latestCompleteBalance, matrixMovers } from './financial-chart-model.js';

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

/** 科目×月の全表へ入る前に、変化量が大きい行だけを先に見つける。 */
export function MatrixMoversChart({ data }: { data: MatrixData }) {
  const movers = matrixMovers(data);
  if (!movers) {
    return <p className="sub">増減図は、記帳済みの月が2ヶ月以上になると表示します。</p>;
  }
  if (!movers.rows.length) {
    return <p className="sub">直近2記帳月で金額が変わった科目はありません。</p>;
  }

  const top = movers.rows[0];
  const model = createFinancialFigureModel({
    id: 'matrix-movers',
    title: '変化が大きい科目',
    summary: top ? `${top.label}の変化が最大で、${yenS(top.delta)}です。` : '変化した科目はありません。',
    period: `${monthShort(movers.fromMonth)}〜${monthShort(movers.toMonth)}`,
    unitLabel: '増減額（円）',
    rowHeader: '科目',
    labels: movers.rows.map((row) => row.label),
    series: [
      {
        key: 'delta',
        label: '増減額',
        values: movers.rows.map((row) => row.delta),
        unit: 'yen',
        signed: true,
      },
    ],
    action: '増減が大きい科目の月別明細へ進み、増えた取引を特定します。',
  });

  return (
    <FinancialFigure
      model={model}
      chartClassName="matrix-movers-chart"
      afterChart={
        <p className="chart-guide">赤は増加、緑は減少。上の表示切替に関係なく増減額(円)を示します。</p>
      }
    >
      <Chart
        type="bar"
        role="img"
        aria-label="直近2記帳月の科目別増減を比較する図"
        fallbackContent="直近2記帳月の科目別増減を比較する図"
        data={{
          labels: figureLabels(model),
          datasets: [
            {
              label: model.series[0]?.label,
              data: seriesData(model, 0),
              backgroundColor: seriesData(model, 0).map((value) =>
                (value ?? 0) > 0 ? `${COLORS.danger}d9` : `${COLORS.good}d9`,
              ),
              borderRadius: 3,
            },
          ],
        }}
        options={horizontalOptions()}
      />
    </FinancialFigure>
  );
}

function ProfitEquation({ pl }: { pl: ProfitAndLoss }) {
  return (
    <div
      className="financial-equation"
      aria-label={`売上${yen(pl.revenue.total)}から経費${yen(pl.expense.total)}を引き、利益は${yenS(pl.profit.total)}です`}
    >
      <div>
        <span>売上</span>
        <strong className="num">{yen(pl.revenue.total)}</strong>
      </div>
      <span className="equation-operator">−</span>
      <div>
        <span>経費</span>
        <strong className="num">{yen(pl.expense.total)}</strong>
      </div>
      <span className="equation-operator">＝</span>
      <div>
        <span>利益</span>
        <strong className={`num ${gainCls(pl.profit.total)}`}>{yenS(pl.profit.total)}</strong>
      </div>
    </div>
  );
}

export function ProfitAndLossCharts({ pl }: { pl: ProfitAndLoss }) {
  const labels = pl.months.map(monthShort);
  const latestIndex = Math.max(0, pl.months.length - 1);
  const latestProfit = pl.profit.monthly[latestIndex] ?? 0;
  const model = createFinancialFigureModel({
    id: 'profit-and-loss-monthly',
    title: '月別の売上・経費・利益',
    summary: `${labels[latestIndex] ?? '直近月'}の利益は${yenS(latestProfit)}で、${
      latestProfit >= 0 ? '黒字' : '赤字'
    }です。`,
    period: financialPeriod(labels),
    labels,
    series: [
      { key: 'revenue', label: '売上', values: pl.revenue.monthly, unit: 'yen', color: COLORS.biz },
      { key: 'expense', label: '経費', values: pl.expense.monthly, unit: 'yen', color: COLORS.neutral },
      {
        key: 'profit',
        label: '利益',
        values: pl.profit.monthly,
        unit: 'yen',
        signed: true,
        color: COLORS.ink,
      },
    ],
    action: '赤字の月について、科目別の経費で原因になった科目を絞り込みます。',
  });
  return (
    <div className="analysis-visual">
      <ProfitEquation pl={pl} />
      <FinancialFigure
        model={model}
        afterChart={<p className="chart-guide">棒で収支を比べ、利益の線で赤字月を見つけます。</p>}
      >
        <Chart
          type={'bar' as 'bar' | 'line'}
          role="img"
          aria-label="月別の売上、経費、利益の推移を示す図"
          fallbackContent="月別の売上、経費、利益の推移を示す図"
          data={{
            labels: figureLabels(model),
            datasets: [
              {
                label: model.series[0]?.label,
                data: seriesData(model, 0),
                backgroundColor: `${COLORS.biz}d9`,
                borderRadius: 3,
              },
              {
                label: model.series[1]?.label,
                data: seriesData(model, 1),
                backgroundColor: `${COLORS.neutral}b8`,
                borderRadius: 3,
              },
              {
                type: 'line' as const,
                label: model.series[2]?.label,
                data: seriesData(model, 2),
                borderColor: COLORS.ink,
                backgroundColor: COLORS.ink,
                pointBackgroundColor: seriesData(model, 2).map((value) =>
                  (value ?? 0) >= 0 ? COLORS.good : COLORS.danger,
                ),
                pointRadius: 3,
                borderWidth: 2,
                tension: 0.18,
              },
            ],
          }}
          options={verticalOptions()}
        />
      </FinancialFigure>
    </div>
  );
}

export function CashFlowCharts({ cf }: { cf: CashFlow }) {
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
                backgroundColor: `${COLORS.neutral}8f`,
                borderRadius: 3,
              },
              {
                label: comparisonModel.series[1]?.label,
                data: seriesData(comparisonModel, 1),
                backgroundColor: seriesData(comparisonModel, 1).map((value) =>
                  (value ?? 0) >= 0 ? `${COLORS.good}d9` : `${COLORS.danger}d9`,
                ),
                borderRadius: 3,
              },
            ],
          }}
          options={verticalOptions()}
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
                backgroundColor: `${COLORS.good}24`,
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

export function BalanceSheetChart({ bs }: { bs: BalanceSheet }) {
  const month = latestCompleteBalance(bs);
  if (!month) {
    return <p className="sub">資産と負債・純資産の図は、負債を入力した月ができると表示します。</p>;
  }
  const netAssets = month.netAssets ?? 0;
  const model = createFinancialFigureModel({
    id: 'balance-sheet-equation',
    title: netAssets < 0 ? '資産と負債の比較' : '資産と負債・純資産の均衡',
    summary:
      netAssets < 0
        ? `負債が資産を${yen(Math.abs(netAssets))}上回っています。`
        : `資産${yen(month.assetTotal)}と、負債・純資産の合計が均衡しています。`,
    period: `${monthShort(month.month)} / ${month.asOf}時点`,
    rowHeader: '内訳',
    labels: ['資産', '負債', '純資産'],
    series: [
      {
        key: 'balance',
        label: '残高',
        values: [month.assetTotal, month.liabilityTotal, netAssets],
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
                  backgroundColor: [`${COLORS.biz}d9`, `${COLORS.danger}d9`],
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
                backgroundColor: `${COLORS.biz}d9`,
              },
              {
                label: '負債',
                data: [null, seriesData(model, 0)[1]],
                backgroundColor: `${COLORS.neutral}cc`,
              },
              {
                label: '純資産',
                data: [null, seriesData(model, 0)[2]],
                backgroundColor: `${COLORS.good}d9`,
              },
            ],
          }}
          options={horizontalOptions(true)}
        />
      </FinancialFigure>
    </div>
  );
}
