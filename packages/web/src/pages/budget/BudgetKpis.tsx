/**
 * KPI 4 枚 (spec-budget-screen §7.3)。
 *
 * 値は `applyBudgetInputs` の `kpi` をそのまま出し、画面で数え直さない (FR-12)。
 * 予算純収支と防衛ライン余裕が負のときは、符号に加えて『不足』を併記する (色だけで区別しない)。
 */
import type { BudgetFigures } from '@kanjo/core';
import { KpiCard } from '../../components/Page.js';
import { Term } from '../../components/Term.js';
import { UiIcon } from '../../components/UiIcon.js';
import { shortfallNote, signedYen, yenOf } from './view-model.js';

function Signed({ value }: { value: number }) {
  const note = shortfallNote(value);
  return (
    <span className={note ? 'budget-shortfall' : undefined}>
      {signedYen(value)}
      {note && <span className="budget-shortfall-note">{note}</span>}
    </span>
  );
}

export function BudgetKpis({ kpi, defenseMonthly }: { kpi: BudgetFigures['kpi']; defenseMonthly: number }) {
  return (
    <div className="kpis budget-kpis">
      <KpiCard label="年間収入予算" value={yenOf(kpi.incomeBudget)} icon={<UiIcon name="wallet" />} />
      <KpiCard label="年間支出予算" value={yenOf(kpi.expenseBudget)} icon={<UiIcon name="book-open" />} />
      <KpiCard label="予算純収支" value={<Signed value={kpi.net} />} icon={<UiIcon name="brand-bars" />} />
      <KpiCard
        label={<Term id="defenseMargin" />}
        value={<Signed value={kpi.defenseMargin} />}
        icon={<UiIcon name="shield-check" />}
        note={`防衛ライン 月額 ${yenOf(defenseMonthly)} × 12 と比べた額`}
      />
    </div>
  );
}
