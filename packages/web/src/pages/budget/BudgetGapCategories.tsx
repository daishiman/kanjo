/**
 * 予算の過不足カテゴリ (来期見通し) (spec-budget-screen §7.8)。
 *
 * 件数・上位 5 件・要因の文は core の `gaps` をそのまま出す (BR-14・BR-19)。
 */
import type { BudgetFigures } from '@kanjo/core';
import { useState } from 'react';
import { AccessibleTabs } from '../../components/AccessibleTabs.js';
import { Button } from '../../components/Button.js';
import { signedYen, yenOf } from './view-model.js';

type GapTab = 'increase' | 'decrease';

export function BudgetGapCategories({
  gaps,
  onOpen,
}: {
  gaps: BudgetFigures['gaps'];
  onOpen?: (account: string) => void;
}) {
  const [tab, setTab] = useState<GapTab>('increase');
  const tabs: { id: GapTab; label: string }[] = [
    { id: 'increase', label: `支出の増加が見込まれる (${gaps.increase.count})` },
    { id: 'decrease', label: `支出の減少が見込まれる (${gaps.decrease.count})` },
  ];
  const rows = gaps[tab].rows;
  return (
    <section className="card budget-gaps" aria-labelledby="budget-gaps-title">
      <h2 id="budget-gaps-title">予算の過不足カテゴリ (来期見通し)</h2>
      <AccessibleTabs
        ariaLabel="過不足の向き"
        idPrefix="budget-gap-tab"
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaControls={() => 'budget-gap-body'}
      />
      <div id="budget-gap-body" role="tabpanel" aria-labelledby={`budget-gap-tab-${tab}`}>
        {rows.length === 0 ? (
          <p className="budget-empty-note">該当する科目はありません。</p>
        ) : (
          <table
            className="budget-mini-table"
            data-table-kind="comparison"
            data-sort-reason="差額の大きい順の上位5件を core が決めた順位で出し、#列と対応させる"
          >
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">カテゴリ</th>
                <th scope="col" className="num">
                  見通し
                </th>
                <th scope="col" className="num">
                  差額
                </th>
                <th scope="col">要因</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.account}>
                  <td>{index + 1}</td>
                  <th scope="row">
                    {onOpen ? (
                      <Button variant="text" onClick={() => onOpen(row.account)}>
                        {row.account}
                      </Button>
                    ) : (
                      row.account
                    )}
                  </th>
                  <td className="num">{yenOf(row.forecast)}</td>
                  <td className={`num ${row.gap > 0 ? 'budget-up' : 'budget-down'}`}>{signedYen(row.gap)}</td>
                  <td>{row.factor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
