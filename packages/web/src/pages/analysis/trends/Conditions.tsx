import { Link } from 'react-router-dom';
import type { TrendsScreen } from '../../../api.js';
import { yen } from '../../../format.js';
import { COMPARES, SCOPES, type Scope, type Update } from './types.js';

export function ScopeTabs({ scope, onChange }: { scope: Scope; onChange: (scope: Scope) => void }) {
  return (
    <span className="segment" role="tablist" aria-label="集計の範囲">
      {SCOPES.map((item) => (
        <button
          key={item.id}
          data-native-control="tab"
          type="button"
          role="tab"
          aria-selected={scope === item.id}
          className={scope === item.id ? 'on' : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </span>
  );
}

export function TrendConditions({ screen, update }: { screen: TrendsScreen; update: Update }) {
  const { selection, metrics, review } = screen;
  const allPeriod = screen.compareUnavailable === 'all_period';
  const orderedMetrics = [...metrics].sort((left, right) => left.controlOrder - right.controlOrder);
  return (
    <section className="card trends-conditions" aria-label="比較条件">
      <div className="trends-condition-group">
        <span className="trends-condition-label">分析の範囲</span>
        <ScopeTabs
          scope={selection.scope}
          onChange={(scope) => update({ scope, category: null, side: null, payee: null })}
        />
      </div>
      <div className="trends-condition-group">
        <span className="trends-condition-label">表示する指標</span>
        {/* biome-ignore lint/a11y/useSemanticElements: 共通 segment は罫線の無い inline control として使う。 */}
        <span className="segment" role="group" aria-label="表示する指標">
          {orderedMetrics.map((metric) => (
            <button
              key={metric.id}
              type="button"
              data-native-control="toggle"
              aria-pressed={metric.id === selection.metric}
              className={metric.id === selection.metric ? 'on' : ''}
              onClick={() => update({ metric: metric.id, category: null, side: null, payee: null })}
            >
              {metric.label}
            </button>
          ))}
        </span>
      </div>
      <div className="trends-condition-group">
        <span className="trends-condition-label">比較対象</span>
        {/* biome-ignore lint/a11y/useSemanticElements: 共通 segment は罫線の無い inline control として使う。 */}
        <span className="segment" role="group" aria-label="比較対象">
          {COMPARES.map((compare) => (
            <button
              key={compare.id}
              type="button"
              data-native-control="toggle"
              disabled={allPeriod}
              aria-pressed={!allPeriod && compare.id === selection.compare}
              className={!allPeriod && compare.id === selection.compare ? 'on' : ''}
              onClick={() => update({ compare: compare.id })}
            >
              {compare.label}
            </button>
          ))}
        </span>
      </div>
      <div className="trends-condition-notes">
        {screen.comparePeriod && (
          <span className="sub">
            {screen.comparePeriod.label}: {screen.comparePeriod.from}〜{screen.comparePeriod.to}
          </span>
        )}
        {allPeriod && (
          <span className="sub trends-note">
            全期間では比較できません。上部の「1年」を選ぶと前期間と比較できます
          </span>
        )}
        {screen.compareUnavailable === 'no_data' && (
          <span className="sub trends-note">比較できるデータがありません</span>
        )}
        {review.count > 0 && (
          <span className="sub trends-review">
            要確認 {review.count} 件 (計 {yen(review.amount)}) は含みません{' '}
            <Link to="/analysis/total-cashflow">総収支で確認する</Link>
          </span>
        )}
      </div>
    </section>
  );
}
