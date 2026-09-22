/**
 * 調整によるインパクト (spec-budget-screen §7.8)。
 *
 * 本文は core の `impact.text` をそのまま出す (BR-14)。注意書きは固定文。
 */
import type { BudgetFigures } from '@kanjo/core';
import { IMPACT_NOTE } from './view-model.js';

export function BudgetImpactCard({ impact }: { impact: BudgetFigures['impact'] }) {
  return (
    <section className="card budget-impact" aria-labelledby="budget-impact-title">
      <h2 id="budget-impact-title">調整によるインパクト</h2>
      <p>{impact.text}</p>
      <p className="budget-impact-note">{IMPACT_NOTE}</p>
    </section>
  );
}
