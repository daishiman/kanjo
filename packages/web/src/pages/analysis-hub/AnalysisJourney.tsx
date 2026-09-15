import { ANALYSIS_TABS, type AnalysisTabId } from '../../routeMetadata.js';

export function AnalysisJourney({ focus }: { focus: AnalysisTabId }) {
  return (
    <section className="analysis-journey card" aria-labelledby="analysis-journey-title">
      <div className="analysis-hub-section-heading">
        <div>
          <h2 id="analysis-journey-title">分析の読み順</h2>
          <p>上から順に進めると、差異の確認から改善判断までつながります。</p>
        </div>
      </div>
      <ol aria-label="読み順">
        {ANALYSIS_TABS.map((tab, index) => (
          <li
            key={tab.id}
            data-active={tab.id === focus || undefined}
            aria-current={tab.id === focus ? 'step' : undefined}
          >
            <span className="analysis-journey-number num">{index + 1}</span>
            <strong>{tab.step}</strong>
            <span>{tab.journeyHint}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
