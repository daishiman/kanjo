import { Link } from 'react-router-dom';
import { RouteIcon } from '../../components/RouteIcon.js';
import type { ANALYSIS_TABS } from '../../routeMetadata.js';

type AnalysisTab = (typeof ANALYSIS_TABS)[number];

export function SelectedAnalysisPanel({ selected }: { selected: AnalysisTab }) {
  return (
    <aside className="analysis-selected card" aria-label="選択中の分析">
      <div className="analysis-selected-heading">
        <span className="analysis-selected-icon">
          <RouteIcon name={selected.icon} />
        </span>
        <div>
          <span>選択中の分析</span>
          <h2 id="selected-analysis-title">{selected.label}</h2>
        </div>
      </div>
      <p className="analysis-selected-task">{selected.summary}</p>
      <dl>
        <div>
          <dt>この分析でわかること</dt>
          <dd>{selected.learn}</dd>
        </div>
        <div>
          <dt>主なデータソース</dt>
          <dd>
            <ul className="analysis-selected-data-list">
              {selected.sources.map((source) => (
                <li key={source.label}>
                  <RouteIcon name={source.icon} />
                  <span>{source.label}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt>対象外のデータ</dt>
          <dd>
            <ul className="analysis-selected-data-list analysis-selected-data-list--excluded">
              {selected.excluded.map((item) => (
                <li key={item.label}>
                  <RouteIcon name={item.icon} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <Link className="btn primary analysis-selected-open" to={selected.path}>
        {selected.label}を開く
        <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}
