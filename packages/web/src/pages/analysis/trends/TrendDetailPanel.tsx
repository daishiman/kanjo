import { Link } from 'react-router-dom';
import type { TrendsScreen } from '../../../api.js';
import { monthLabel, yen } from '../../../format.js';
import { changeClass, drilldownLabel, recommendedDrilldownLabel } from './format.js';

export function TrendDetailPanel({ screen }: { screen: TrendsScreen }) {
  const { detail, focus, metrics, recommended, review } = screen;
  if (!detail) return null;
  const metric = metrics.find((item) => item.id === screen.selection.metric);
  const compareLabel = screen.comparePeriod?.label ?? '比較';
  const action = focus ?? recommended;
  const primarySource = detail.sources[0] ?? null;
  const sourceSummary = primarySource
    ? `${primarySource.origin === 'freee' ? 'freee' : 'MF'} ・ ${primarySource.account ?? '口座情報なし'} ・ ${primarySource.count}件${detail.sources.length > 1 ? `、他${detail.sources.length - 1}件` : ''}`
    : '出典情報がありません';
  return (
    <aside className="card trends-detail" aria-label="選択した月の詳細">
      <h3>{monthLabel(detail.month)}の詳細</h3>
      <dl className="trends-detail-values">
        {metrics.map((item) => {
          const value = detail.values[item.id];
          if (!value) return null;
          return (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd>
                {yen(value.current)}
                {screen.comparePeriod && (
                  <span className="sub">
                    {' '}
                    ({compareLabel} {yen(value.compare)})
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <h4>主な要因</h4>
      {detail.drivers.length === 0 ? (
        <p className="sub">大きな増減はありません。</p>
      ) : (
        <ol className="trends-drivers">
          {detail.drivers.map((driver) => (
            <li key={`${driver.side}-${driver.category}-${driver.payee}`}>
              <span className={changeClass(driver.change, metric?.betterWhen)}>{driver.text}</span>
            </li>
          ))}
        </ol>
      )}
      <h4>データの出典</h4>
      {detail.sources.length <= 1 ? (
        <p className="sub trends-source-summary">{sourceSummary}</p>
      ) : (
        <details className="trends-source-details">
          <summary>{sourceSummary}</summary>
          <ul className="trends-sources">
            {detail.sources.map((source) => (
              <li key={`${source.origin}-${source.account ?? ''}`}>
                {source.origin === 'freee' ? 'freee' : 'MF'} ・ {source.account ?? '口座情報なし'} ・{' '}
                {source.count}件
              </li>
            ))}
          </ul>
        </details>
      )}
      {review.monthCount > 0 && (
        <p className="sub trends-review">
          この月の要確認 {review.monthCount} 件 (計 {yen(review.monthAmount)}) は含みません
        </p>
      )}
      {action && (
        <Link className="btn secondary trends-detail-action" to={action.href}>
          {focus ? drilldownLabel(action.origin) : recommendedDrilldownLabel(action.category, action.origin)}
        </Link>
      )}
    </aside>
  );
}
