/** P1 概況: 今月の収支と全期間トレンドを俯瞰する */
import { useQuery } from '@tanstack/react-query';
import { Chart as ChartJS } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type SummaryResponse, api } from '../api.js';
import { COLORS, yenTick } from '../components/charts.js';
import { deltaCls, monthShort, pct, yen, yenS } from '../format.js';

void ChartJS; // 登録の副作用のためimport維持

export function OverviewPage() {
  const q = useQuery({ queryKey: ['summary'], queryFn: () => api<SummaryResponse>('/summary') });
  if (q.isLoading) return <p>読み込み中…</p>;
  if (q.isError || !q.data) return <p>読み込みに失敗しました</p>;
  const { overview: ov, defense } = q.data;

  if (!ov.months.length) {
    return (
      <div className="empty">
        <p>まだデータがありません。</p>
        <Link className="btn primary" to="/import">
          データ取込へ
        </Link>
      </div>
    );
  }

  const labels = ov.months.map(monthShort);
  const co = ov.cashOverride ?? {};

  return (
    <>
      <h1 className="page-title">概況</h1>
      <p className="page-task">今月の収支と全期間トレンドを俯瞰する。</p>

      <div className="kpis">
        <div className="kpi">
          <div className="label">平均月商(売上のある{ov.kpi.revenueMonths}ヶ月)</div>
          <div className="value">{yen(ov.kpi.avgRevenue)}</div>
        </div>
        <div className="kpi">
          <div className="label">平均経費(記帳月)</div>
          <div className="value">{yen(ov.kpi.avgExpense)}</div>
        </div>
        <div className="kpi">
          <div className="label">直近経費 / 前月比</div>
          <div className="value">{yen(ov.kpi.lastExpense)}</div>
          <div className={`note num ${deltaCls(ov.kpi.expenseMom)}`}>{pct(ov.kpi.expenseMom)}</div>
        </div>
        <div className="kpi">
          <div className="label">{ov.years.prev}年 利益(記帳ベース)</div>
          <div className="value">{yenS(ov.kpi.prevYearProfit)}</div>
          <div className="note">経費率 {pct(ov.kpi.prevYearExpenseRatio, 0)}</div>
        </div>
        <div className="kpi">
          <div className="label">{ov.years.curr}年 経費(年換算)</div>
          <div className="value">{yen(ov.kpi.currYearAnnualized)}</div>
          <div className="note">前年 {yen(ov.kpi.prevYearExpense)}</div>
        </div>
      </div>

      <div className="card">
        <h2>売上・経費トレンド(防衛ライン重ね描き)</h2>
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
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>科目</th>
                <th>{ov.years.prev}年実績</th>
                <th>{ov.years.curr}年換算</th>
                <th>増減</th>
              </tr>
            </thead>
            <tbody>
              {ov.yearTable.map((r) => (
                <tr key={r.account}>
                  <td>{r.account}</td>
                  <td className="num">{yen(r.prevActual)}</td>
                  <td className="num">{yen(r.currAnnualized)}</td>
                  <td className={`num ${deltaCls(r.delta)}`}>{yenS(r.delta)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>経費計</td>
                <td className="num">{yen(ov.yearTotals.prevActual)}</td>
                <td className="num">{yen(ov.yearTotals.currAnnualized)}</td>
                <td className={`num ${deltaCls(ov.yearTotals.delta)}`}>{yenS(ov.yearTotals.delta)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>経費パレート(累積構成比)</h2>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>科目</th>
                <th>累計額</th>
                <th>累積構成比</th>
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

      <p className="sub">
        次は <Link to="/matrix">増減マトリクス</Link> で「どの科目が増えたか」を特定 →{' '}
        <Link to="/diagnosis">統計診断</Link> で対応を決める。
      </p>
    </>
  );
}
