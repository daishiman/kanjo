import { Fragment, useState } from 'react';
import type { TrendsResponse } from '../../../api.js';
import { Button } from '../../../components/Button.js';
import { SortableTableHeader } from '../../../components/SortableTableHeader.js';
import { Term } from '../../../components/Term.js';
import { deltaCls, monthShort, pct, yen, yenS } from '../../../format.js';
import { type TableSort, sortedRowsBy } from '../../../table-sort.js';
import { Spark } from './Spark.js';
import { ACTION_CLS, DIRECTION_CLS } from './format.js';

export function JudgementDisclosure({ t, initiallyOpen }: { t: TrendsResponse; initiallyOpen: boolean }) {
  const [expanded, setExpanded] = useState(initiallyOpen);
  return (
    <details
      className="card trends-judgement"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span>統計による傾向判定を表示</span>
        <span className="sub">(MF の明細だけで判定)</span>
      </summary>
      {expanded && (
        <div className="trends-legacy-body">
          <p className="sub">
            この判定は MF の明細だけを使うため、上の推移(freee を含む総収支)と一致しないことがあります。
          </p>
          <LegacyJudgement t={t} />
        </div>
      )}
    </details>
  );
}

/** MF 明細に対する統計判定だけを残し、新しい比較画面と重複する図は持たない。 */
export function LegacyJudgement({ t }: { t: TrendsResponse }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  type LegacySortColumn = 'account' | 'action' | 'direction' | 'monthly' | 'share' | 'impact' | 'spark';
  const [sort, setSort] = useState<TableSort<LegacySortColumn>>(null);
  if (!t.recordedMonths.length) return <p className="sub">MF の明細で判定できる月がありません。</p>;

  const rows = sortedRowsBy(
    t.rows.filter((row) => row.action !== '対応不要').slice(0, 12),
    sort,
    (row, column) => {
      switch (column) {
        case 'account':
          return `${row.account}\u0000${row.side}`;
        case 'action':
          return row.action;
        case 'direction':
          return row.direction;
        case 'monthly':
          return row.monthlyAvg;
        case 'share':
          return row.share;
        case 'impact':
          return row.annualImpact;
        case 'spark': {
          const values = row.series.filter((value): value is number => value !== null);
          return values.length >= 2 ? values[values.length - 1]! - values[0]! : null;
        }
      }
    },
  );
  const header = (column: LegacySortColumn, label: string, className?: string) => (
    <SortableTableHeader column={column} sort={sort} onSort={setSort} className={className}>
      {label}
    </SortableTableHeader>
  );
  return (
    <section aria-labelledby="legacy-priority-title">
      <h3 id="legacy-priority-title">手を打つ順番</h3>
      {rows.length === 0 ? (
        <p className="sub">いま対応が要る科目はありません。今の水準を保てています。</p>
      ) : (
        <div className="scroll-x">
          <table className="data stack-sm" data-table-kind="sortable">
            <thead>
              <tr>
                {header('account', '科目')}
                {header('action', '次の行動')}
                {header('direction', '判定')}
                {header('monthly', '月あたり', 'num')}
                {header('share', '構成比', 'num')}
                {header('impact', '1年後の影響', 'num')}
                {header('spark', '推移')}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.key}>
                  <tr>
                    <td data-label="科目">
                      <Button
                        variant="text"
                        aria-expanded={openKey === row.key}
                        onClick={() => setOpenKey(openKey === row.key ? null : row.key)}
                      >
                        {row.account}
                      </Button>{' '}
                      <span className={`pill ${row.side === 'biz' ? 'biz' : 'per'}`}>
                        {row.side === 'biz' ? '事業' : '家計'}
                      </span>{' '}
                      <span className="pill neutral">{row.type}</span>
                    </td>
                    <td data-label="次の行動">
                      <span className={ACTION_CLS[row.action]}>{row.action}</span>
                    </td>
                    <td data-label="判定">
                      <span className={DIRECTION_CLS[row.direction]}>{row.direction}</span>
                    </td>
                    <td data-label="月あたり" className="num">
                      {yen(row.monthlyAvg)}
                    </td>
                    <td data-label="構成比" className="num">
                      {pct(row.share)}
                    </td>
                    <td data-label="1年後の影響" className={`num ${deltaCls(row.annualImpact)}`}>
                      {row.direction === '増加' || row.direction === '減少' ? yenS(row.annualImpact) : '—'}
                    </td>
                    <td data-label="推移">
                      <Spark series={row.series} />
                    </td>
                  </tr>
                  {openKey === row.key && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <p>{row.reason}</p>
                        <p className="sub">
                          傾き {yenS(Math.round(row.slopePerMonth))}/月 ・ <Term id="pValue" />=
                          {row.mk.p.toFixed(3)} ・<Term id="cv">変動係数</Term> {row.cv.toFixed(2)} ・
                          直近平均 {yen(row.recentAvg)} / それ以前 {yen(row.priorAvg)}
                          {row.gapMonths.length > 0 && (
                            <> ・ 金額が立っていない月: {row.gapMonths.map(monthShort).join('・')}</>
                          )}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sub">
        並び順は管理優先度。<Term id="mannKendall">Mann-Kendall検定</Term>と
        <Term id="theilSen">Theil-Sen傾き</Term>で、単発の大きな支払い1件だけで「増加」と判定しません。
      </p>
      {t.unrecordedExpMonths.length > 0 && (
        <p className="sub">
          <Term id="unrecordedMonth">未記帳</Term>の月({t.unrecordedExpMonths.map(monthShort).join('・')}
          )は判定から除いています。
        </p>
      )}
    </section>
  );
}
