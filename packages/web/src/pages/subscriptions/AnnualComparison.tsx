import type { SubscriptionsScreen } from '@kanjo/core';
import { yen } from '../../format.js';
import { periodDelta, plain } from './format.js';

function DeltaCell({ current, previous }: { current: number; previous: number | null }) {
  const delta = periodDelta(current, previous);
  if (!delta) return <td className="num">—</td>;
  return (
    <td className={`num subs-delta is-${delta.tone}`}>
      {delta.text}
      <span className="visually-hidden">（{delta.spoken}）</span>
    </td>
  );
}

/** 構成比。表示は小数 1 桁 (合計行は丸めの和ではなく 100.0% 固定。spec §8) */
const shareText = (share: number) => `${(share * 100).toFixed(1)}%`;

/** 年換算の比較（カテゴリ別）(spec §8)。並びは core の月額降順のまま */
export function AnnualComparison({
  comparison,
  total,
}: {
  comparison: SubscriptionsScreen['comparison'];
  total: SubscriptionsScreen['comparisonTotal'];
}) {
  return (
    <section className="card subs-comparison" aria-labelledby="subs-comparison-title">
      <h2 id="subs-comparison-title">年換算の比較（カテゴリ別）</h2>
      {comparison.length ? (
        <div className="scroll-x">
          <table
            className="data subs-comparison-table"
            data-table-kind="comparison"
            data-sort-reason="カテゴリを年換算の降順に並べ、合計行を末尾に固定する比較表"
          >
            <caption className="visually-hidden">カテゴリ別の月額・年換算・構成比・前期間比</caption>
            <thead>
              <tr>
                <th scope="col">カテゴリ</th>
                <th scope="col" className="num">
                  月額
                </th>
                <th scope="col" className="num">
                  年換算
                </th>
                <th scope="col" className="num">
                  構成比
                </th>
                <th scope="col" className="num">
                  前期間比
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{row.category}</th>
                  <td className="num">{plain(row.monthly)}</td>
                  <td className="num">{plain(row.annualized)}</td>
                  <td className="num">{shareText(row.share)}</td>
                  <DeltaCell current={row.monthly} previous={row.prevMonthly} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <th scope="row">合計</th>
                <td className="num">{yen(total.monthly)}</td>
                <td className="num">{yen(total.annualized)}</td>
                <td className="num">100.0%</td>
                <DeltaCell current={total.monthly} previous={total.prevMonthly} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="sub">継続中のサブスクはありません。</p>
      )}
    </section>
  );
}
