/**
 * 今後の見通し（累計・来期）と見通しコメント (spec-budget-screen §7.5)。
 *
 * 累計は予算対象 12 か月の月次予算の累計で、KPI と一致する (BR-12)。文は core が組んだものを出す (BR-15)。
 */
import type { BudgetFigures } from '@kanjo/core';
import { diffClass, plainYen, signedPlain } from './view-model.js';

export function BudgetOutlookCard({ outlook }: { outlook: BudgetFigures['outlook'] }) {
  return (
    <section className="card budget-outlook" aria-labelledby="budget-outlook-title">
      <h2 id="budget-outlook-title">今後の見通し（累計・来期）</h2>
      <dl className="budget-outlook-list">
        <div>
          <dt>累計収入</dt>
          <dd>{plainYen(outlook.income)}</dd>
        </div>
        <div>
          <dt>累計支出</dt>
          <dd>{plainYen(outlook.expense)}</dd>
        </div>
        <div>
          <dt>累計純収支</dt>
          <dd className={diffClass(-outlook.net)}>{signedPlain(outlook.net)}</dd>
        </div>
      </dl>
      <p className="budget-outlook-comment">{outlook.comment}</p>
    </section>
  );
}
