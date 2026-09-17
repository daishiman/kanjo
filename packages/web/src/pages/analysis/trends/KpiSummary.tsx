import type { TrendsScreen } from '../../../api.js';
import { monthLabel, pct, yen } from '../../../format.js';
import { changeClass, signedYen } from './format.js';

export function TrendKpiSummary({ screen }: { screen: TrendsScreen }) {
  const metric = screen.metrics.find((item) => item.id === screen.selection.metric);
  const metricLabel = metric?.label ?? screen.selection.metric;
  const betterWhen = metric?.betterWhen;
  const compareLabel = screen.comparePeriod?.label ?? '比較';
  const { kpis } = screen;
  return (
    <section className="card trends-summary" aria-label="推移の要約">
      <div className="trends-summary-item">
        <span className="trends-summary-label">{metricLabel}(今回)</span>
        <strong className="num trends-summary-value">{yen(kpis.current)}</strong>
        <span className="sub">{screen.series.months.length}ヶ月の合計</span>
      </div>
      <div className="trends-summary-item">
        <span className="trends-summary-label">
          {kpis.change.basis === 'peak_month_mom' ? '最大の前月差' : `${compareLabel}からの増減`}
        </span>
        <strong className={`num trends-summary-value ${changeClass(kpis.change.amount, betterWhen)}`}>
          {signedYen(kpis.change.amount)}
        </strong>
        <span className="sub">増減率 {pct(kpis.change.rate)}</span>
      </div>
      <div className="trends-summary-item">
        <span className="trends-summary-label">最も変化が大きい月</span>
        <strong className="trends-summary-value">
          {kpis.peakMonth ? monthLabel(kpis.peakMonth.month) : '—'}
        </strong>
        <span className="sub">
          {kpis.peakMonth ? (
            <span className={changeClass(kpis.peakMonth.diff, betterWhen)}>
              {signedYen(kpis.peakMonth.diff)}
            </span>
          ) : (
            'データがありません'
          )}
        </span>
      </div>
    </section>
  );
}
