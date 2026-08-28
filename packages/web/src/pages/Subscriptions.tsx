/** P4 サブスク分析: いま何にいくら払っているか(月額・年換算)と、推移・重複・急増を確認する */
import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type SubscriptionsData, api } from '../api.js';
import { DataTable } from '../components/DataTable.js';
import { HowTo } from '../components/HowTo.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from '../components/Page.js';
import { SubVendorsPanel, SubsCandidatesPanel } from '../components/SubVendors.js';
import { Term } from '../components/Term.js';
import { VENDOR_PALETTE, stackTotalLabels, yenTick } from '../components/charts.js';
import { monthLabel, monthShort, ratio, yen } from '../format.js';
import { usePeriod } from '../period.js';

export function SubscriptionsPage() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['subscriptions', key],
    queryFn: () => api<SubscriptionsData>(withPeriod('/subscriptions')),
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
        <DataTable
          className="data stack-sm"
          columns={[
            'ベンダー',
            '直近月額',
            '平均月額',
            '支払月数',
            '直近12ヶ月合計',
            <Fragment key="annualized">
              <Term id="annualized" />
              (直近月額×12)
            </Fragment>,
          ]}
          foot={
            <tr className="total">
              <td data-label="ベンダー">合計(その他を含む)</td>
              <td data-label="直近月額" className="num">
                {yen(s.now.monthlyTotal)}
              </td>
              <td />
              <td />
              <td data-label="直近12ヶ月合計" className="num">
                {yen(s.now.last12Total)}
              </td>
              <td data-label="年換算" className="num">
                {yen(s.now.annualized)}
              </td>
            </tr>
          }
        >
          {[...s.vendorTable]
            .sort((a, b) => b.lastMonthly - a.lastMonthly || b.avgMonthly - a.avgMonthly)
            .map((r) => (
              <tr key={r.vendor}>
                <td data-label="ベンダー">{r.vendor}</td>
                <td data-label="直近月額" className="num">
                  {yen(r.lastMonthly)}
                </td>
                <td data-label="平均月額" className="num">
                  {yen(r.avgMonthly)}
                </td>
                <td data-label="支払月数" className="num">
                  {r.activeMonths}
                </td>
                <td data-label="直近12ヶ月合計" className="num">
                  {yen(r.last12Total)}
                </td>
                <td data-label="年換算" className="num">
                  {yen(r.lastMonthly * 12)}
                </td>
              </tr>
            ))}
        </DataTable>
        <p className="sub">
          「その他」はベンダー名を特定していないサブスク・通信の支払。月3,000円のサブスクは年3.6万円。契約は月次にし、解約の見直しは四半期ごとに行う。
        </p>
      </div>

      <div className="card">
        <h2>ベンダー別月次(積み上げ)</h2>
        <HowTo id="subsMonthly" />
        <Chart
          type="bar"
          height={90}
          /* 棒の上に月の合計を書く。色が20を超える図で、目分量の足し算をさせないため */
          plugins={[stackTotalLabels]}
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
            /* 触れた月は、その月に払った全ベンダーを一度に出す(1社ずつ触って足させない) */
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                // 払っていないベンダーまで並べると、実際に払った数社が埋もれる
                filter: (item) => Number(item.parsed.y) > 0,
                callbacks: {
                  label: (item) => `${item.dataset.label}: ${yen(Number(item.parsed.y))}`,
                  footer: (items) =>
                    `この月の合計: ${yen(items.reduce((sum, i) => sum + Number(i.parsed.y), 0))}`,
                },
              },
            },
          }}
        />
        <p className="sub">
          棒の上の数字はその月の合計。凡例をクリックしてベンダーを隠すと、隠した分を除いた合計に変わります。
        </p>
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
