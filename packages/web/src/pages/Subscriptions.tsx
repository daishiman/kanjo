/** P4 サブスク分析: いま何にいくら払っているか(月額・年換算)と、推移・重複・急増を確認する */
import { useQuery } from '@tanstack/react-query';
import { Chart } from 'react-chartjs-2';
import { Link, useSearchParams } from 'react-router-dom';
import { type SubscriptionsData, api } from '../api.js';
import { DataTable, termColumn } from '../components/DataTable.js';
import { FinancialFigure } from '../components/FinancialFigure.js';
import { HowTo } from '../components/HowTo.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState } from '../components/Page.js';
import { SubVendorsPanel, SubsCandidatesPanel } from '../components/SubVendors.js';
import { Term } from '../components/Term.js';
import { COLORS, baseChartOptions, stackTotalLabels, vendorPalette, yenTick } from '../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
} from '../components/figure-view-model.js';
import { monthLabel, monthShort, ratio, yen } from '../format.js';
import { usePeriod } from '../period.js';
import { targetChoice, targetMonth } from './target-query.js';

export function SubscriptionsPage() {
  const [searchParams] = useSearchParams();
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
  const vendorAccounts = s.vendorAccounts ?? {};
  const requestedVendor = targetChoice(searchParams, 'vendor', s.vendors);
  const accountChoices = [...new Set(Object.values(vendorAccounts).flat())];
  const requestedAccount = targetChoice(searchParams, 'account', accountChoices);
  const requestedMonth = targetMonth(searchParams, s.months);
  const matchingVendors = s.vendors.filter(
    (vendor) =>
      (!requestedVendor || vendor === requestedVendor) &&
      (!requestedAccount || (vendorAccounts[vendor] ?? []).includes(requestedAccount)),
  );
  // 個々には実在しても組み合わせが存在しない query は、安全に全ベンダーへ戻す。
  const hasVendorFocus = Boolean((requestedVendor || requestedAccount) && matchingVendors.length);
  const focusedVendors = hasVendorFocus ? matchingVendors : s.vendors;
  const focusedVendorTable = s.vendorTable.filter((row) => focusedVendors.includes(row.vendor));
  const monthIndexes = requestedMonth
    ? [s.months.indexOf(requestedMonth)]
    : s.months.map((_, index) => index);
  const labels = monthIndexes.map((index) => monthShort(s.months[index]!));
  const latestMonthIndex = s.months.length - 1;
  const rankedVendors = focusedVendors
    .map((vendor, originalIndex) => ({
      vendor,
      originalIndex,
      total: (s.matrix[vendor] ?? []).reduce((total, value) => total + Math.abs(value), 0),
    }))
    .sort((left, right) => right.total - left.total || left.originalIndex - right.originalIndex);
  const visibleVendors = rankedVendors.slice(0, 6);
  const hiddenVendors = rankedVendors.slice(6);
  const chartSeries = [
    ...visibleVendors.map(({ vendor }) => ({
      key: vendor,
      label: vendor,
      values: monthIndexes.map((index) => s.matrix[vendor]?.[index] ?? 0),
    })),
    hiddenVendors.length > 0
      ? {
          key: 'collapsed',
          label: `他${hiddenVendors.length}件`,
          values: monthIndexes.map(
            (monthIndex) =>
              (hasVendorFocus ? 0 : (s.other[monthIndex] ?? 0)) +
              hiddenVendors.reduce((total, { vendor }) => total + (s.matrix[vendor]?.[monthIndex] ?? 0), 0),
          ),
        }
      : {
          key: 'other',
          label: 'その他',
          values: monthIndexes.map((index) => (hasVendorFocus ? 0 : (s.other[index] ?? 0))),
        },
  ];
  /* 図の色と凡例チップの色を1箇所で決める(別々に選ぶと凡例が図の色と対応しなくなる) */
  const palette = vendorPalette();
  const chartSeriesColor = (key: string, index: number) =>
    key === 'other' || key === 'collapsed' ? COLORS.neutral : (palette[index % palette.length] as string);
  const vendorModel = createFinancialFigureModel({
    id: 'subscriptions-vendor-monthly',
    title: '支払いの内訳推移',
    summary: requestedMonth
      ? `${monthLabel(requestedMonth)}の対象支払いを表示しています。`
      : `${monthLabel(s.months[latestMonthIndex]!)}のサブスク合計は${yen(s.now.monthlyTotal)}です。`,
    period: financialPeriod(labels),
    labels,
    summarySeries: chartSeries.map(({ key, label }, index) => ({
      key,
      label,
      color: chartSeriesColor(key, index),
    })),
    series: [
      ...focusedVendors.map((vendor) => ({
        key: vendor,
        label: vendor,
        values: monthIndexes.map((index) => s.matrix[vendor]?.[index] ?? 0),
        unit: 'yen' as const,
      })),
      {
        key: 'other',
        label: 'その他',
        values: monthIndexes.map((index) => (hasVendorFocus ? 0 : (s.other[index] ?? 0))),
        unit: 'yen' as const,
      },
    ],
    action: '月額が増えた月に始まった契約を洗い出し、重複と解約候補を見直します。',
  });

  return (
    <>
      <PageHeader route="subscriptions" />

      {(hasVendorFocus || requestedMonth) && (
        <output className="notice" aria-label="診断からの絞り込み">
          <strong>診断からの絞り込み</strong>{' '}
          {[requestedAccount, requestedVendor, requestedMonth ? monthLabel(requestedMonth) : null]
            .filter(Boolean)
            .join(' / ')}
          {' · '}
          <Link to="/subscriptions">すべて表示</Link>
        </output>
      )}

      {s.alerts.filter(
        (alert) =>
          focusedVendors.includes(alert.vendor) && (!requestedMonth || alert.month === requestedMonth),
      ).length > 0 && (
        <section className="notice" aria-label="検知アラート">
          <strong>
            検知アラート{' '}
            {
              s.alerts.filter(
                (alert) =>
                  focusedVendors.includes(alert.vendor) &&
                  (!requestedMonth || alert.month === requestedMonth),
              ).length
            }
            件
          </strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {s.alerts
              .filter(
                (alert) =>
                  focusedVendors.includes(alert.vendor) &&
                  (!requestedMonth || alert.month === requestedMonth),
              )
              .map((a) => (
                <li key={`${a.vendor}-${a.month}-${a.type}`}>
                  {monthLabel(a.month)} <strong>{a.vendor}</strong>{' '}
                  {a.type === 'dup' ? <Term id="subsDup" /> : <Term id="subsSpike" />}:{' '}
                  <span className="num">{yen(a.value)}</span>(通常月
                  <Term id="median" /> <span className="num">{yen(a.median)}</span>)
                </li>
              ))}
          </ul>
        </section>
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

      {s.sourceCoverage && (
        <p className="sub subscriptions-source-note">
          freee {s.sourceCoverage.freee}件とMoney Forward {s.sourceCoverage.moneyForward}
          件から集計。両方の厳密一致 {s.sourceCoverage.matched}件は1度だけ数え、要確認{' '}
          {s.sourceCoverage.review}件は自動統合していません。
        </p>
      )}

      <section className="card scroll-x" aria-label="現在のサブスク支払い">
        <h2>いま何にいくら払っているか</h2>
        <DataTable
          className="data stack-sm"
          columns={[
            termColumn('vendor'),
            '直近月額',
            '平均月額',
            '支払月数',
            '直近12ヶ月合計',
            termColumn('annualized', { label: '年換算(直近月額×12)' }),
          ]}
          foot={
            <tr className="total">
              <td data-label="ベンダー">合計(その他を含む)</td>
              <td data-label="直近月額" className="num">
                {yen(focusedVendorTable.reduce((total, row) => total + row.lastMonthly, 0))}
              </td>
              <td />
              <td />
              <td data-label="直近12ヶ月合計" className="num">
                {yen(focusedVendorTable.reduce((total, row) => total + row.last12Total, 0))}
              </td>
              <td data-label="年換算" className="num">
                {yen(focusedVendorTable.reduce((total, row) => total + row.lastMonthly * 12, 0))}
              </td>
            </tr>
          }
        >
          {focusedVendorTable
            .filter(
              (row) => !requestedMonth || (s.matrix[row.vendor]?.[s.months.indexOf(requestedMonth)] ?? 0) > 0,
            )
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
      </section>

      <div className="card">
        <h2>ベンダー別月次(積み上げ)</h2>
        <HowTo id="subsMonthly" />
        <FinancialFigure model={vendorModel}>
          <Chart
            type="bar"
            role="img"
            aria-label="月別のサブスク支払い内訳を積み上げで示す図"
            fallbackContent="月別のサブスク支払い内訳を積み上げで示す図"
            data-financial-dataset-count={chartSeries.length}
            data-financial-dataset-labels={chartSeries.map(({ label }) => label).join('|')}
            /* 棒の上に月の合計を書く。色が20を超える図で、目分量の足し算をさせないため */
            plugins={[stackTotalLabels]}
            data={{
              labels: figureLabels(vendorModel),
              datasets: chartSeries.map((series, index) => ({
                label: series.label,
                data: series.values,
                backgroundColor: chartSeriesColor(series.key, index),
                stack: 's',
              })),
            }}
            options={{
              ...baseChartOptions(),
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
        </FinancialFigure>
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
          rows={s.vendorTable
            .filter((row) => focusedVendors.includes(row.vendor))
            .map((r) => ({
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
