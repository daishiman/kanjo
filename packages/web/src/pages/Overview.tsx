/** P1 概況: 今月の収支と全期間トレンドを俯瞰する */
import { useQuery } from '@tanstack/react-query';
import { Chart as ChartJS } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type DefenseForecast, type SummaryResponse, api } from '../api.js';
import { DataTable, termColumn } from '../components/DataTable.js';
import { HowTo } from '../components/HowTo.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { UnsettledPanel } from '../components/Unsettled.js';
import { COLORS, yenTick } from '../components/charts.js';
import { deltaCls, monthShort, pct, yen, yenS } from '../format.js';
import { usePeriod } from '../period.js';

void ChartJS; // 登録の副作用のためimport維持

/**
 * FR-08 防衛ライン割れの事前警告。
 *
 * 実績のバッジ(ヘッダー)は「もう割れた」ことしか教えられない。ここでは翌月の見込みと
 * 直近の割れ方を先に見せ、まだ手を打てるうちに やりくり試算 へ送る。
 * 判定そのものより「なぜそう判定したか」を読ませたいので、内訳を必ず併記する。
 */
function DefenseForecastPanel({ forecast }: { forecast: DefenseForecast }) {
  if (forecast.level === 'nodata' || forecast.level === 'none') return null;
  const warn = forecast.level === 'warn';
  const breached = forecast.history.filter((h) => h.breached);
  return (
    <div className={`notice${warn ? ' danger' : ''}`} role={warn ? 'alert' : undefined}>
      <strong>
        {warn ? '防衛ライン割れの事前警告' : '防衛ラインの見通しに注意'}
        {forecast.nextMonth ? `(${monthShort(forecast.nextMonth)}の見込み)` : ''}
      </strong>
      <p style={{ margin: '4px 0' }}>{forecast.reason}</p>
      <p style={{ margin: '4px 0' }}>
        内訳: 給与 <span className="num">{yen(forecast.nextSalary)}</span>(直近3ヶ月の中央値) + 事業入金{' '}
        <span className="num">{yen(forecast.nextBizIncome)}</span>(直近3ヶ月の平均) ={' '}
        <span className="num">{yen(forecast.nextEstimate)}</span> / <Term id="defenseLine" />{' '}
        <span className="num">{yen(forecast.line)}</span>
      </p>
      {breached.length > 0 && (
        <p style={{ margin: '4px 0' }}>
          割れた月: {breached.map((h) => `${monthShort(h.month)}(${yenS(h.diff)})`).join('・')}
        </p>
      )}
      <Link className="btn" to="/tradeoff">
        やりくり試算で捻出元を探す
      </Link>
    </div>
  );
}

export function OverviewPage() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });
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

      <DefenseForecastPanel forecast={defense.forecast} />

      <div className="card">
        <h2>
          売上・経費トレンド(
          <Term id="defenseLine" />・<Term id="movingAvg" />
          を重ね描き)
        </h2>
        <HowTo id="overviewMonthly" />
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
        <HowTo id="overviewPareto" />
        <div className="scroll-x">
          <DataTable columns={['科目', '累計額', termColumn('pareto')]}>
            {ov.pareto.map((r) => (
              <tr key={r.account} style={r.cumShare <= 0.82 ? { fontWeight: 700 } : undefined}>
                <td>{r.account}</td>
                <td className="num">{yen(r.total)}</td>
                <td className="num">{(r.cumShare * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </DataTable>
        </div>
        <p className="sub">
          上位2科目で全体の {(ov.top2Share * 100).toFixed(0)}%。82%以内(太字)が管理の主戦場。
        </p>
      </div>

      <UnsettledPanel />

      <p className="sub">
        次は <Link to="/analysis/matrix">増減マトリクス</Link> で「どの科目が増えたか」を特定 →{' '}
        <Link to="/analysis/diagnosis">統計診断</Link> で対応を決める。
      </p>
    </>
  );
}
