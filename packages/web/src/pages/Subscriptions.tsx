/** P4 サブスク分析: いま何にいくら払っているか(月額・年換算)と、推移・重複・急増を確認する */
import { useQuery } from '@tanstack/react-query';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type SubscriptionsData, api } from '../api.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from '../components/Page.js';
import { SubVendorsPanel, SubsCandidatesPanel } from '../components/SubVendors.js';
import { Term } from '../components/Term.js';
import { VENDOR_PALETTE, yenTick } from '../components/charts.js';
import { monthLabel, monthShort, ratio, yen } from '../format.js';

export function SubscriptionsPage() {
  const q = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api<SubscriptionsData>('/subscriptions'),
  });
  if (q.isLoading)
    return (
      <>
        <PageHeader route="subscriptions" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="subscriptions" />
        <PageState status="error" error={q.error} />
      </>
    );
  const s = q.data;
  if (!s.months.length)
    return (
      <>
        <PageHeader route="subscriptions" />
        <PageState
          status="empty"
          message="サブスクデータが未取込です。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
        <SubVendorsPanel />
      </>
    );

  return (
    <>
      <PageHeader route="subscriptions" />

      {s.alerts.length > 0 && (
        <div className="notice">
          <strong>検知アラート {s.alerts.length}件</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {s.alerts.map((a) => (
              <li key={`${a.vendor}-${a.month}-${a.type}`}>
                {monthLabel(a.month)} <strong>{a.vendor}</strong>{' '}
                {a.type === 'dup' ? <Term id="subsDup" /> : <Term id="subsSpike" />}:{' '}
                <span className="num">{yen(a.value)}</span>(通常月
                <Term id="median" /> <span className="num">{yen(a.median)}</span>)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="kpis">
        <KpiCard
          label={`サブスク合計(${s.now.month ? monthLabel(s.now.month) : '—'})`}
          value={yen(s.now.monthlyTotal)}
          note="月額"
        />
        <KpiCard
          label={
            <>
              <Term id="annualized" />
              (月額×12)
            </>
          }
          value={yen(s.now.annualized)}
          note="いまの契約を1年続けた場合"
        />
        <KpiCard
          label="直近12ヶ月の実支払"
          value={yen(s.now.last12Total)}
          note={
            <>
              <Term id="unrecordedMonth" />
              は除く
            </>
          }
        />
        <KpiCard
          label={<Term id="revenueShare" />}
          value={s.now.revenueShare === null ? '—' : ratio(s.now.revenueShare, 1)}
          note={s.now.revenueShare === null ? '売上データがありません' : '目安 10〜15%以内'}
        />
      </div>

      <div className="card scroll-x">
        <h2>いま何にいくら払っているか</h2>
        <table className="data">
          <thead>
            <tr>
              <th>ベンダー</th>
              <th>直近月額</th>
              <th>平均月額</th>
              <th>支払月数</th>
              <th>直近12ヶ月合計</th>
              <th>
                <Term id="annualized" />
                (直近月額×12)
              </th>
            </tr>
          </thead>
          <tbody>
            {[...s.vendorTable]
              .sort((a, b) => b.lastMonthly - a.lastMonthly || b.avgMonthly - a.avgMonthly)
              .map((r) => (
                <tr key={r.vendor}>
                  <td>{r.vendor}</td>
                  <td className="num">{yen(r.lastMonthly)}</td>
                  <td className="num">{yen(r.avgMonthly)}</td>
                  <td className="num">{r.activeMonths}</td>
                  <td className="num">{yen(r.last12Total)}</td>
                  <td className="num">{yen(r.lastMonthly * 12)}</td>
                </tr>
              ))}
            <tr className="total">
              <td>合計(その他を含む)</td>
              <td className="num">{yen(s.now.monthlyTotal)}</td>
              <td />
              <td />
              <td className="num">{yen(s.now.last12Total)}</td>
              <td className="num">{yen(s.now.annualized)}</td>
            </tr>
          </tbody>
        </table>
        <p className="sub">
          「その他」はベンダー名を特定していないサブスク・通信の支払。月3,000円のサブスクは年3.6万円。契約は月次にし、解約の見直しは四半期ごとに行う。
        </p>
      </div>

      <div className="card">
        <h2>ベンダー別月次(積み上げ)</h2>
        <Chart
          type="bar"
          height={90}
          data={{
            labels: s.months.map(monthShort),
            datasets: [
              ...s.vendors.map((v, i) => ({
                label: v,
                data: s.matrix[v],
                backgroundColor: VENDOR_PALETTE[i % VENDOR_PALETTE.length],
                stack: 's',
              })),
              { label: 'その他', data: s.other, backgroundColor: '#c4ccc9', stack: 's' },
            ],
          }}
          options={{
            responsive: true,
            scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: yenTick } } },
            plugins: { legend: { position: 'bottom' } },
          }}
        />
      </div>

      <div className="card">
        <h2>
          ベンダー別 年間比較({s.years.prev}年 vs {s.years.curr}年換算)
        </h2>
        <AnnualComparisonTable
          subjectLabel="ベンダー"
          previousLabel={`${s.years.prev}年実績`}
          currentLabel={`${s.years.curr}年換算`}
          rows={s.vendorTable.map((r) => ({
            key: r.vendor,
            label: r.vendor,
            previous: r.prevActual,
            current: r.currAnnualized,
            delta: r.delta,
          }))}
        />
      </div>
      <SubVendorsPanel />
      <SubsCandidatesPanel hasDeals={s.months.length > 0} />

      <p className="sub">
        <Term id="subsDup">重複疑い</Term>=中央値の1.8倍超かつ2万円超 / <Term id="subsSpike" />
        =3倍超かつ1.5万円超(HTML版と同一基準)。
      </p>
    </>
  );
}
