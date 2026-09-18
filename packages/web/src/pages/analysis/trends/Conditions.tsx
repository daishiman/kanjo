import { Link } from 'react-router-dom';
import type { TrendsScreen } from '../../../api.js';
import { yen } from '../../../format.js';
import { SegmentControl } from '../SegmentControl.js';
import { COMPARES, SCOPES, type Scope, type Update } from './types.js';

export function ScopeTabs({ scope, onChange }: { scope: Scope; onChange: (scope: Scope) => void }) {
  return (
    <SegmentControl ariaLabel="集計の範囲" kind="tabs" options={SCOPES} value={scope} onChange={onChange} />
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
        <SegmentControl
          ariaLabel="表示する指標"
          kind="toggle"
          options={orderedMetrics}
          value={selection.metric}
          onChange={(metric) => update({ metric, category: null, side: null, payee: null })}
        />
      </div>
      <div className="trends-condition-group">
        <span className="trends-condition-label">比較対象</span>
        <SegmentControl
          ariaLabel="比較対象"
          kind="toggle"
          options={COMPARES}
          value={selection.compare}
          disabled={allPeriod}
          onChange={(compare) => update({ compare })}
        />
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
