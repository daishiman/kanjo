/**
 * 月次の実績・予算・見通しのグラフ (spec-budget-screen §7.4)。
 *
 * Chart.js を使わず SVG を自前で描く (C5。初期 JS と lazy chunk を増やさない)。
 * 色は budget.css のクラスがトークンから当てる。予算の棒は枠線と薄い塗り、実績の棒は塗りで区別し、
 * 色だけに意味を持たせない。同じ数値を視覚的に隠した表で添える。
 */
import type { BudgetFigures } from '@kanjo/core';
import { manYen, monthAxis, monthJa, niceTicks } from './view-model.js';

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };
const LEGEND = [
  { key: 'income-actual', label: '収入 実績' },
  { key: 'income-budget', label: '収入 予算' },
  { key: 'expense-actual', label: '支出 実績' },
  { key: 'expense-budget', label: '支出 予算' },
  { key: 'forecast', label: '見通し (収支)' },
] as const;

export function BudgetMonthlyChart({
  monthly,
  boundary,
}: {
  monthly: BudgetFigures['monthly'];
  boundary: BudgetFigures['boundary'];
}) {
  const values = monthly.flatMap((m) => [
    m.incomeBudget,
    -m.expenseBudget,
    m.incomeActual ?? 0,
    -(m.expenseActual ?? 0),
    m.forecastNet,
  ]);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((high - v) / (high - low || 1)) * innerH;
  const slot = innerW / Math.max(1, monthly.length);
  const groupW = Math.min(slot * 0.78, 44);
  const barGap = Math.max(1, groupW * 0.05);
  const barW = Math.max(3, (groupW - barGap * 3) / 4);
  const x0 = (index: number) => PAD.left + slot * index;
  const zero = y(0);
  const bar = (value: number) => ({ y: Math.min(y(value), zero), height: Math.abs(zero - y(value)) });
  const linePoints = monthly.map((m, i) => `${x0(i) + slot / 2},${y(m.forecastNet)}`).join(' ');
  const boundaryIndex = boundary.lastActualMonth
    ? monthly.findIndex((m) => m.month === boundary.lastActualMonth)
    : -1;
  const boundaryX = boundaryIndex >= 0 && boundaryIndex < monthly.length - 1 ? x0(boundaryIndex + 1) : null;

  return (
    <section className="card budget-chart" aria-labelledby="budget-chart-title">
      <div className="budget-chart-head">
        <h2 id="budget-chart-title">
          月次の実績・予算・見通し <span className="budget-unit">（万円）</span>
        </h2>
        <ul className="budget-legend" aria-hidden="true">
          {LEGEND.map((item) => (
            <li key={item.key}>
              <span className={`budget-swatch budget-swatch-${item.key}`} />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="budget-chart-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="月次の実績・予算・見通しのグラフ"
          focusable="false"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === 0 ? 'budget-axis-zero' : 'budget-grid'}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="budget-tick" x={PAD.left - 6} y={y(tick) + 4} textAnchor="end">
                {(tick / 10_000).toLocaleString('ja-JP')}
              </text>
            </g>
          ))}
          {monthly.map((m, i) => {
            const groupX = x0(i) + (slot - groupW) / 2;
            const incomeActualX = groupX;
            const incomeBudgetX = groupX + barW + barGap;
            const expenseActualX = groupX + (barW + barGap) * 2;
            const expenseBudgetX = groupX + (barW + barGap) * 3;
            return (
              <g key={m.month}>
                <rect
                  className="budget-bar-income-budget"
                  x={incomeBudgetX}
                  width={barW}
                  {...bar(m.incomeBudget)}
                />
                {m.incomeActual != null && (
                  <rect
                    className="budget-bar-income-actual"
                    x={incomeActualX}
                    width={barW}
                    {...bar(m.incomeActual)}
                  />
                )}
                <rect
                  className="budget-bar-expense-budget"
                  x={expenseBudgetX}
                  width={barW}
                  {...bar(-m.expenseBudget)}
                />
                {m.expenseActual != null && (
                  <rect
                    className="budget-bar-expense-actual"
                    x={expenseActualX}
                    width={barW}
                    {...bar(-m.expenseActual)}
                  />
                )}
                <text className="budget-tick" x={x0(i) + slot / 2} y={HEIGHT - 8} textAnchor="middle">
                  {monthAxis(m.month)}
                </text>
              </g>
            );
          })}
          <polyline className="budget-line-forecast" points={linePoints} />
          {monthly.map((m, i) => (
            <circle
              key={m.month}
              className="budget-dot-forecast"
              cx={x0(i) + slot / 2}
              cy={y(m.forecastNet)}
              r={3}
            />
          ))}
          {boundaryX != null && (
            <line
              className="budget-boundary"
              data-testid="budget-boundary"
              x1={boundaryX}
              x2={boundaryX}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
            />
          )}
        </svg>
      </div>
      {(boundary.actualLabel || boundary.forecastLabel) && (
        <p className="budget-chart-notes" aria-label="実績と見通しの期間">
          {boundary.actualLabel && <span>{boundary.actualLabel}</span>}
          {boundary.forecastLabel && <span>{boundary.forecastLabel}</span>}
        </p>
      )}
      <table
        className="visually-hidden"
        data-table-kind="matrix"
        data-sort-reason="図の横軸と同じ月順に固定する正確値マトリクス"
      >
        <caption>月次の実績・予算・見通し（万円）</caption>
        <thead>
          <tr>
            <th scope="col">月</th>
            {LEGEND.map((item) => (
              <th key={item.key} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthly.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthJa(m.month)}</th>
              <td>{manYen(m.incomeActual)}</td>
              <td>{manYen(m.incomeBudget)}</td>
              <td>{manYen(m.expenseActual)}</td>
              <td>{manYen(m.expenseBudget)}</td>
              <td>{manYen(m.forecastNet)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
