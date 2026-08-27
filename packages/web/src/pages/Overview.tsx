/** P1 概況: 今月の収支と全期間トレンドを俯瞰する */
import { useQuery } from '@tanstack/react-query';
import { Chart as ChartJS } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type SummaryResponse, api } from '../api.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { UnsettledPanel } from '../components/Unsettled.js';
import { COLORS, yenTick } from '../components/charts.js';
import { deltaCls, monthShort, pct, yen, yenS } from '../format.js';

void ChartJS; // 登録の副作用のためimport維持

export function OverviewPage() {
  const q = useQuery({ queryKey: ['summary'], queryFn: () => api<SummaryResponse>('/summary') });
  if (q.isLoading)
    return (
      <>
        <PageHeader route="overview" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="overview" />
        <PageState status="error" error={q.error} />
      </>
    );
  const { overview: ov, defense } = q.data;

  if (!ov.months.length) {
    return (
      <>
        <PageHeader route="overview" />
        <PageState
          status="empty"
          message="まだデータがありません。最初に収支データを取り込んでください。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );
  }

  const labels = ov.months.map(monthShort);
  const co = ov.cashOverride ?? {};

  return (
    <>
      <PageHeader route="overview" />

      <div className="kpis">
        <KpiCard label={`平均月商(売上のある${ov.kpi.revenueMonths}ヶ月)`} value={yen(ov.kpi.avgRevenue)} />
        <KpiCard label="平均経費(記帳月)" value={yen(ov.kpi.avgExpense)} />
        <KpiCard
          label="直近経費 / 前月比"
          value={yen(ov.kpi.lastExpense)}
          note={<span className={`num ${deltaCls(ov.kpi.expenseMom)}`}>{pct(ov.kpi.expenseMom)}</span>}
        />
        <KpiCard
          label={`${ov.years.prev}年 利益(記帳ベース)`}
          value={yenS(ov.kpi.prevYearProfit)}
          note={
            <>
              {' '}
              <Term id="expenseRatio" /> {pct(ov.kpi.prevYearExpenseRatio, 0)}
            </>
          }
        />
        <KpiCard
          label={
            <>
              {ov.years.curr}年 経費(
              <Term id="annualized" />)
            </>
          }
          value={yen(ov.kpi.currYearAnnualized)}
          note={<> 前年 {yen(ov.kpi.prevYearExpense)}</>}
        />
      </div>

      <div className="card">
        <h2>
          売上・経費トレンド(
          <Term id="defenseLine" />・<Term id="movingAvg" />
          を重ね描き)
        </h2>
        <Chart
          type="bar"
          height={90}
          data={{
            labels,
            datasets: [
              {
                type: 'bar' as const,
                label: '売上(記帳)',
                data: ov.revenue,
                backgroundColor: `${COLORS.biz}cc`,
              },
              {
                type: 'bar' as const,
                label: '経費計',
                data: ov.expenseTotal.map((v, i) =>
                  ov.unrecordedExpMonths.includes(ov.months[i]) ? null : v,
                ),
                backgroundColor: `${COLORS.per}b3`,
              },
              {
                type: 'line' as const,
                label: '経費3ヶ月移動平均',
                data: ov.expenseMovingAvg,
                borderColor: COLORS.warn,
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.2,
              },
              {
                type: 'line' as const,
                label: '防衛ライン',
                data: ov.months.map(() => (defense.status === 'nodata' ? null : defense.line)),
                borderColor: COLORS.danger,
                borderDash: [6, 4],
                pointRadius: 0,
                borderWidth: 2,
              },
            ],
          }}
          options={{
            responsive: true,
            scales: { y: { ticks: { callback: yenTick } } },
            plugins: { legend: { position: 'bottom' } },
          }}
        />
        {Object.keys(co).length > 0 && (
          <p className="sub">
            銀行実測の補正値:{' '}
            {Object.entries(co)
              .map(([m, v]) => `${m} 入金${yen(v.revenue)}・支出${yen(v.expense)}`)
              .join(' / ')}
          </p>
        )}
      </div>

      <div className="card">
        <h2>
          年間比較({ov.years.prev}年実績 vs {ov.years.curr}年 年換算)
        </h2>
        <AnnualComparisonTable
          subjectLabel="科目"
          previousLabel={`${ov.years.prev}年実績`}
          currentLabel={`${ov.years.curr}年換算`}
          rows={ov.yearTable.map((r) => ({
            key: r.account,
            label: r.account,
            previous: r.prevActual,
            current: r.currAnnualized,
            delta: r.delta,
          }))}
          total={{
            label: '経費計',
            previous: ov.yearTotals.prevActual,
            current: ov.yearTotals.currAnnualized,
            delta: ov.yearTotals.delta,
          }}
        />
      </div>

      <div className="card">
        <h2>
          経費パレート(
          <Term id="pareto" />)
        </h2>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>科目</th>
                <th>累計額</th>
                <th>
                  <Term id="pareto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {ov.pareto.map((r) => (
                <tr key={r.account} style={r.cumShare <= 0.82 ? { fontWeight: 700 } : undefined}>
                  <td>{r.account}</td>
                  <td className="num">{yen(r.total)}</td>
                  <td className="num">{(r.cumShare * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sub">
          上位2科目で全体の {(ov.top2Share * 100).toFixed(0)}%。82%以内(太字)が管理の主戦場。
        </p>
      </div>

      <UnsettledPanel />

      <p className="sub">
        次は <Link to="/matrix">増減マトリクス</Link> で「どの科目が増えたか」を特定 →{' '}
        <Link to="/diagnosis">統計診断</Link> で対応を決める。
      </p>
    </>
  );
}
