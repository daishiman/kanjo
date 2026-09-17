import { Link } from 'react-router-dom';
import type { TrendsScreen } from '../../../api.js';
import { Button } from '../../../components/Button.js';
import { monthLabel, pct } from '../../../format.js';
import { CategoryBreakdown } from './CategoryBreakdown.js';
import { ChangeFactors } from './ChangeFactors.js';
import { TrendConditions } from './Conditions.js';
import { TrendKpiSummary } from './KpiSummary.js';
import { TrendSeriesPanel } from './TrendSeriesPanel.js';
import { changeClass, drilldownLabel, signedYen } from './format.js';
import type { TrendSide, Update, UrlState } from './types.js';

export function ComparisonScreen({
  screen,
  url,
  update,
}: {
  screen: TrendsScreen;
  url: UrlState;
  update: Update;
}) {
  const metric = screen.metrics.find((item) => item.id === screen.selection.metric);
  const selectCategory = (category: string, side: TrendSide, payee: string | null = null) =>
    update({ category, side, payee });

  return (
    <>
      <TrendConditions screen={screen} update={update} />
      <TrendKpiSummary screen={screen} />
      {screen.series.months.length > 0 && (
        <TrendSeriesPanel screen={screen} onSelect={(month) => update({ month })} />
      )}
      <CategoryBreakdown screen={screen} onSelect={selectCategory} />
      {screen.comparePeriod && screen.changePareto.length > 0 && (
        <ChangeFactors screen={screen} onSelect={(category, side) => selectCategory(category, side)} />
      )}
      {(!screen.comparePeriod || screen.changePareto.length === 0) && (
        <section
          className="card trends-factors-unavailable"
          aria-labelledby="trends-factors-unavailable-title"
        >
          <h3 id="trends-factors-unavailable-title">増減の要因</h3>
          <p className="sub">
            {screen.compareUnavailable === 'all_period'
              ? '全期間では比較の基準が定まらないため、パレート図は表示しません。上部の「1年」を選んでください。'
              : '比較期間のデータが揃うと、増減額と累計寄与を表示します。'}
          </p>
        </section>
      )}
      {screen.focus && (
        <section className="tcf-selection-bar trends-selection" aria-label="選択中の項目">
          <span>{screen.focus.month ? monthLabel(screen.focus.month) : '期間全体'}</span>
          <strong>
            {screen.focus.category}
            {screen.focus.payee && ` (${screen.focus.payee})`}
          </strong>
          <span className={changeClass(screen.focus.change, metric?.betterWhen)}>
            {signedYen(screen.focus.change)}
          </span>
          <span className="sub">{pct(screen.focus.changeRate)}</span>
          <Link className="btn primary" to={screen.focus.href}>
            {drilldownLabel(screen.focus.origin)}
          </Link>
          {url.category && (
            <Button
              size="mini"
              variant="text"
              onClick={() => update({ category: null, side: null, payee: null })}
            >
              選択を解除
            </Button>
          )}
        </section>
      )}
    </>
  );
}
