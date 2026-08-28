import type { ChartOptions } from 'chart.js';
import type { ReactNode } from 'react';
import { Chart } from 'react-chartjs-2';
import type { BalanceSheet, CashFlow, MatrixData, ProfitAndLoss } from '../api.js';
import { gainCls, monthShort, yen, yenS } from '../format.js';
import { tooltipOptions } from './chart-tooltip.js';
import { COLORS, yenTick } from './charts.js';
import { latestCompleteBalance, matrixMovers } from './financial-chart-model.js';

const legend = {
  position: 'bottom' as const,
  labels: { usePointStyle: true, pointStyle: 'rectRounded' as const, boxWidth: 9, boxHeight: 9, padding: 16 },
};

const chartAnimation = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? false
    : { duration: 220 };

const verticalOptions = (showLegend = true): ChartOptions<'bar' | 'line'> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: chartAnimation(),
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
  responsive: true,
  maintainAspectRatio: false,
  animation: chartAnimation(),
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

function Figure({ title, note, children }: { title: string; note: ReactNode; children: ReactNode }) {
  return (
    <figure className="financial-figure">
      <figcaption>
        <strong>{title}</strong>
        <span>{note}</span>
      </figcaption>
      {children}
    </figure>
  );
}

/** 科目×月の全表へ入る前に、変化量が大きい行だけを先に見つける。 */
export function MatrixMoversChart({ data }: { data: MatrixData }) {
  const movers = matrixMovers(data);
  if (!movers) {
    return <p className="sub">増減図は、記帳済みの月が2ヶ月以上になると表示します。</p>;
  }
  if (!movers.rows.length) {
    return <p className="sub">直近2記帳月で金額が変わった科目はありません。</p>;
  }

  const aria = `${monthShort(movers.fromMonth)}から${monthShort(movers.toMonth)}の増減上位。${movers.rows
    .map((row) => `${row.label}${yenS(row.delta)}`)
    .join('、')}`;

  return (
    <Figure
      title="変化が大きい科目"
      note={`${monthShort(movers.fromMonth)} → ${monthShort(movers.toMonth)} / 増減額の絶対値順`}
    >
      <div className="chart-shell matrix-movers-chart">
        <Chart
          type="bar"
          role="img"
          aria-label={aria}
          fallbackContent={aria}
          data={{
            labels: movers.rows.map((row) => row.label),
            datasets: [
              {
                label: '増減額',
                data: movers.rows.map((row) => row.delta),
                backgroundColor: movers.rows.map((row) =>
                  row.delta > 0 ? `${COLORS.danger}d9` : `${COLORS.good}d9`,
                ),
                borderRadius: 3,
              },
            ],
          }}
          options={horizontalOptions()}
        />
      </div>
      <p className="chart-guide">
        赤は増加、緑は減少。上の表示切替に関係なく増減額(円)を示し、正確な月別金額は下の表で照合できます。
      </p>
    </Figure>
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
  return (
    <div className="analysis-visual">
      <ProfitEquation pl={pl} />
      <Figure title="月別の売上・経費・利益" note="棒で収支を比べ、利益の線で赤字月を見つけます">
        <div className="chart-shell">
          <Chart
            type={'bar' as 'bar' | 'line'}
            role="img"
            aria-label="月別の売上、経費、利益の推移"
            fallbackContent="月別の売上、経費、利益の推移"
            data={{
              labels,
              datasets: [
                {
                  label: '売上',
                  data: pl.revenue.monthly,
                  backgroundColor: `${COLORS.biz}d9`,
                  borderRadius: 3,
                },
                {
                  label: '経費',
                  data: pl.expense.monthly,
                  backgroundColor: `${COLORS.neutral}b8`,
                  borderRadius: 3,
                },
                {
                  type: 'line' as const,
                  label: '利益',
                  data: pl.profit.monthly,
                  borderColor: COLORS.ink,
                  backgroundColor: COLORS.ink,
                  pointBackgroundColor: pl.profit.monthly.map((value) =>
                    value >= 0 ? COLORS.good : COLORS.danger,
                  ),
                  pointRadius: 3,
                  borderWidth: 2,
                  tension: 0.18,
                },
              ],
            }}
            options={verticalOptions()}
          />
        </div>
      </Figure>
    </div>
  );
}

export function CashFlowCharts({ cf }: { cf: CashFlow }) {
  if (!cf.months.length) return null;
  return (
    <div className="analysis-visual">
      <Figure
        title="月別の利益と営業キャッシュフロー"
        note="2本の棒の差で、入金・支払時期によるズレを見つけます"
      >
        <div className="chart-shell">
          <Chart
            type="bar"
            role="img"
            aria-label="月別の利益と営業キャッシュフローの比較"
            fallbackContent="月別の利益と営業キャッシュフローの比較"
            data={{
              labels: cf.months.map((month) => monthShort(month.month)),
              datasets: [
                {
                  label: '利益',
                  data: cf.months.map((month) => month.profit),
                  backgroundColor: `${COLORS.neutral}8f`,
                  borderRadius: 3,
                },
                {
                  label: '営業CF',
                  data: cf.months.map((month) => month.operating),
                  backgroundColor: cf.months.map((month) =>
                    month.operating >= 0 ? `${COLORS.good}d9` : `${COLORS.danger}d9`,
                  ),
                  borderRadius: 3,
                },
              ],
            }}
            options={verticalOptions()}
          />
        </div>
      </Figure>
      <Figure
        title="営業キャッシュフロー累計"
        note="期首を0として、期間中に現金がどれだけ増減したかを追います"
      >
        <div className="chart-shell cashflow-cumulative-chart">
          <Chart
            type={'line' as 'bar' | 'line'}
            role="img"
            aria-label="期首を0とした営業キャッシュフロー累計の推移"
            fallbackContent="期首を0とした営業キャッシュフロー累計の推移"
            data={{
              labels: cf.months.map((month) => monthShort(month.month)),
              datasets: [
                {
                  label: '累計(期首=0)',
                  data: cf.cumulative,
                  borderColor: COLORS.ink,
                  backgroundColor: `${COLORS.good}24`,
                  pointBackgroundColor: cf.cumulative.map((value) =>
                    value >= 0 ? COLORS.good : COLORS.danger,
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
        </div>
      </Figure>
    </div>
  );
}

export function BalanceSheetChart({ bs }: { bs: BalanceSheet }) {
  const month = latestCompleteBalance(bs);
  if (!month) {
    return <p className="sub">資産と負債・純資産の図は、負債を入力した月ができると表示します。</p>;
  }
  const netAssets = month.netAssets ?? 0;
  const aria = `${monthShort(month.month)}時点。資産${yen(month.assetTotal)}。負債${yen(
    month.liabilityTotal,
  )}。純資産${yenS(netAssets)}。`;
  if (netAssets < 0) {
    return (
      <div className="analysis-visual">
        <Figure title="資産と負債の比較" note={`${monthShort(month.month)} / ${month.asOf}時点`}>
          <div className="chart-shell balance-chart">
            <Chart
              type="bar"
              role="img"
              aria-label={aria}
              fallbackContent={aria}
              data={{
                labels: ['資産', '負債'],
                datasets: [
                  {
                    label: '残高',
                    data: [month.assetTotal, month.liabilityTotal],
                    backgroundColor: [`${COLORS.biz}d9`, `${COLORS.danger}d9`],
                  },
                ],
              }}
              options={horizontalOptions()}
            />
          </div>
          <p className="chart-guide">
            負債が資産を上回っています。差額 {yen(Math.abs(netAssets))} が負債超過です。
          </p>
        </Figure>
      </div>
    );
  }
  return (
    <div className="analysis-visual">
      <Figure title="資産と負債・純資産の均衡" note={`${monthShort(month.month)} / ${month.asOf}時点`}>
        <div className="chart-shell balance-chart">
          <Chart
            type="bar"
            role="img"
            aria-label={aria}
            fallbackContent={aria}
            data={{
              labels: ['資産', '負債・純資産'],
              datasets: [
                { label: '資産', data: [month.assetTotal, null], backgroundColor: `${COLORS.biz}d9` },
                { label: '負債', data: [null, month.liabilityTotal], backgroundColor: `${COLORS.neutral}cc` },
                {
                  label: '純資産',
                  data: [null, netAssets],
                  backgroundColor: netAssets >= 0 ? `${COLORS.good}d9` : `${COLORS.danger}d9`,
                },
              ],
            }}
            options={horizontalOptions(true)}
          />
        </div>
        <p className="chart-guide">左右の長さが一致すると、資産 = 負債 + 純資産の関係を確認できます。</p>
      </Figure>
    </div>
  );
}
