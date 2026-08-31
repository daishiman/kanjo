/** P6 家計: 事業/個人の比較・収支バランス・名義別収入・生活費の内訳を月別・全期間で確認する(仕分け反映後) */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type HouseholdData, api, ownerLabel } from '../api.js';
import { DataTable, termColumn } from '../components/DataTable.js';
import { FinancialFigure } from '../components/FinancialFigure.js';
import { HowTo } from '../components/HowTo.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { COLORS, baseChartOptions, yenTick } from '../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from '../components/figure-view-model.js';
import { deltaCls, gainCls, monthLabel, monthShort, ratio, yen, yenS } from '../format.js';
import { usePeriod } from '../period.js';

const rate = (v: number | null) => ratio(v, 0);

export function HouseholdPage() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['household', key],
    queryFn: () => api<HouseholdData>(withPeriod('/household')),
  });
  const [sel, setSel] = useState<string | null>(null);
  if (q.isLoading)
    return (
      <>
        <PageHeader route="household" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="household" />
        <PageState status="error" error={q.error} />
      </>
    );
  const d = q.data;
  if (!d.months.length)
    return (
      <>
        <PageHeader route="household" />
        <PageState
          status="empty"
          message="MF明細が未取込です。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );

  const month = sel && d.months.includes(sel) ? sel : d.months[d.months.length - 1];
  const mi = d.months.indexOf(month);
  const prev = mi > 0 ? d.months[mi - 1] : null;
  const cur = d.personal[month];
  const pv = prev ? d.personal[prev] : null;
  const bal = d.balance.find((b) => b.month === month) ?? d.balance[d.balance.length - 1];
  const t = d.totals;
  const single = d.balance.length === 1;
  const balanceLabels = d.balance.map((entry) => monthShort(entry.month));
  const latestBalance = d.balance[d.balance.length - 1];
  const latestBalanceTone = (latestBalance?.balance ?? 0) >= 0 ? '黒字' : '赤字';
  const balanceModel = createFinancialFigureModel({
    id: 'household-monthly-balance',
    title: '収入と支出の推移',
    summary: `${balanceLabels[balanceLabels.length - 1]}の収支は${yenS(
      latestBalance?.balance,
    )}で、${latestBalanceTone}です。`,
    period: financialPeriod(balanceLabels),
    labels: balanceLabels,
    series: [
      {
        key: 'income',
        label: '収入計',
        values: d.balance.map((entry) => entry.income),
        unit: 'yen',
        color: COLORS.good,
      },
      {
        key: 'expense',
        label: '支出計',
        values: d.balance.map((entry) => entry.expense),
        unit: 'yen',
        color: COLORS.per,
      },
    ],
    action: '支出が収入を上回った月の生活費の内訳を開き、固定費から見直します。',
  });

  const expTotal = Object.values(cur.expense).reduce((s, v) => s + v, 0);
  const incTotal = Object.values(cur.income).reduce((s, v) => s + v, 0);
  const cats = Object.entries(cur.expense).sort((a, b) => b[1] - a[1]);
  const incCats = Object.entries(cur.income).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader route="household" />

      <div className="toolbar">
        <select value={month} onChange={(e) => setSel(e.target.value)}>
          {d.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        {d.explainability && d.explainability.month === month && (
          <span className={`badge ${d.explainability.rate >= 0.8 ? 'ok' : 'warn'}`}>
            <Term id="explainability" /> {(d.explainability.rate * 100).toFixed(0)}%(未分類+カード引落{' '}
            {yen(d.explainability.unexplained)})
          </span>
        )}
      </div>

      <div className="kpis">
        <KpiCard
          label={`収入計(${monthLabel(month)})`}
          value={yen(bal.income)}
          note={`個人 ${yen(bal.personalIncome)} + 事業入金 ${yen(bal.bizIncome)}`}
        />
        <KpiCard
          label="支出計"
          value={yen(bal.expense)}
          note={`生活費 ${yen(bal.livingCost)} + 事業立替 ${yen(bal.bizAdvance)}`}
        />
        <KpiCard
          label="収支"
          value={<span className={gainCls(bal.balance)}>{yenS(bal.balance)}</span>}
          note={
            bal.saveRate === null
              ? '収入がないため貯蓄率は出せません'
              : `貯蓄率 ${rate(bal.saveRate)}(目安 20〜30%)`
          }
        />
        <KpiCard
          label="事業側(freee) 売上 / 経費"
          value={
            bal.revenue === null ? (
              'freee未取込'
            ) : (
              <>
                {yen(bal.revenue)} / {bal.bizExpense === null ? '未記帳' : yen(bal.bizExpense)}
              </>
            )
          }
          tone="biz"
          compact
        />
      </div>
      <p className="sub">
        個人収入・生活費・事業入金・事業立替はMF明細(仕分け画面の結果)、売上・経費はfreeeから集計。
        <Term id="transfer">口座間の振替</Term>は含みません。
      </p>

      <div className="card">
        <h2>
          事業と個人を並べる(月別・月平均・
          <Term id="annualized" />)
        </h2>
        <p className="sub">
          事業はfreeeの売上と事業経費、個人はMF明細で「個人」と仕分けた収入と生活費。片方しか無い月は「—」。合計はデータのある月数で平均します。
        </p>
        <div className="scroll-x">
          <table className="data stack-sm">
            <thead>
              <tr>
                <th rowSpan={2}>月</th>
                <th colSpan={3}>事業(freee)</th>
                <th colSpan={3}>個人(MF)</th>
              </tr>
              <tr>
                <th>売上</th>
                <th>経費</th>
                <th>収支</th>
                <th>収入</th>
                <th>生活費</th>
                <th>収支</th>
              </tr>
            </thead>
            <tbody>
              {d.comparison.rows.map((r) => (
                <tr key={r.month} className={r.month === month ? 'selected' : undefined}>
                  <td data-label="月">{monthLabel(r.month)}</td>
                  <td data-label="事業 売上" className="num">
                    {yen(r.biz.income)}
                  </td>
                  <td data-label="事業 経費" className="num">
                    {yen(r.biz.expense)}
                  </td>
                  <td data-label="事業 収支" className={`num ${gainCls(r.biz.balance)}`}>
                    {yenS(r.biz.balance)}
                  </td>
                  <td data-label="個人 収入" className="num">
                    {yen(r.personal.income)}
                  </td>
                  <td data-label="個人 生活費" className="num">
                    {yen(r.personal.expense)}
                  </td>
                  <td data-label="個人 収支" className={`num ${gainCls(r.personal.balance)}`}>
                    {yenS(r.personal.balance)}
                  </td>
                </tr>
              ))}
              {(
                [
                  ['合計', (x: typeof d.comparison.biz) => x, true],
                  ['月平均', (x: typeof d.comparison.biz) => x.monthlyAvg, false],
                  ['年換算(月平均×12)', (x: typeof d.comparison.biz) => x.annualized, false],
                ] as const
              ).map(([label, pick, isTotal]) => {
                const b = pick(d.comparison.biz);
                const p = pick(d.comparison.personal);
                return (
                  <tr key={label} className={isTotal ? 'total' : undefined}>
                    <td data-label="月">
                      {label}
                      {isTotal
                        ? `(事業${d.comparison.biz.months}ヶ月 / 個人${d.comparison.personal.months}ヶ月)`
                        : ''}
                    </td>
                    <td data-label="事業 売上" className="num">
                      {yen(b.income)}
                    </td>
                    <td data-label="事業 経費" className="num">
                      {yen(b.expense)}
                    </td>
                    <td data-label="事業 収支" className={`num ${gainCls(b.balance)}`}>
                      {yenS(b.balance)}
                    </td>
                    <td data-label="個人 収入" className="num">
                      {yen(p.income)}
                    </td>
                    <td data-label="個人 生活費" className="num">
                      {yen(p.expense)}
                    </td>
                    <td data-label="個人 収支" className={`num ${gainCls(p.balance)}`}>
                      {yenS(p.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>収支バランス(月別)</h2>
        <HowTo id="householdBalance" />
        {single ? (
          <div className="notice info">
            まだ1ヶ月分です。翌月のMF明細を取り込むと、月ごとの推移と前月比が並びます(目標:
            未分類ゼロ・説明可能率90%・貯蓄率30%以上)。
          </div>
        ) : (
          <FinancialFigure model={balanceModel}>
            <Chart
              type="bar"
              role="img"
              aria-label="月別の家計収入と支出を比較する図"
              fallbackContent="月別の家計収入と支出を比較する図"
              data={{
                labels: figureLabels(balanceModel),
                datasets: [
                  {
                    label: balanceModel.series[0]?.label,
                    data: seriesData(balanceModel, 0),
                    backgroundColor: COLORS.good,
                  },
                  {
                    label: balanceModel.series[1]?.label,
                    data: seriesData(balanceModel, 1),
                    backgroundColor: COLORS.per,
                  },
                ],
              }}
              options={{
                ...baseChartOptions(),
                scales: { y: { ticks: { callback: yenTick } } },
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          </FinancialFigure>
        )}
        <div className="scroll-x">
          <DataTable
            className="data stack-sm"
            columns={[
              '月',
              '収入計',
              '生活費',
              termColumn('bizAdvance'),
              '支出計',
              '収支',
              termColumn('savingsRate'),
              'freee 事業経費',
            ]}
            /* 合計・月平均・年換算は明細ではないので、並べ替えの対象から外して末尾に固定する */
            foot={
              <>
                <tr className="total">
                  <td data-label="月">合計({t.months}ヶ月)</td>
                  <td data-label="収入計" className="num">
                    {yen(t.income)}
                  </td>
                  <td data-label="生活費" className="num">
                    {yen(t.livingCost)}
                  </td>
                  <td data-label="事業立替" className="num">
                    {yen(t.bizAdvance)}
                  </td>
                  <td data-label="支出計" className="num">
                    {yen(t.expense)}
                  </td>
                  <td data-label="収支" className={`num ${gainCls(t.balance)}`}>
                    {yenS(t.balance)}
                  </td>
                  <td data-label="貯蓄率" className="num">
                    {rate(t.saveRate)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td data-label="月">月平均</td>
                  <td data-label="収入計" className="num">
                    {yen(t.monthlyAvg.income)}
                  </td>
                  <td data-label="生活費" className="num">
                    {yen(t.monthlyAvg.livingCost)}
                  </td>
                  <td data-label="事業立替" className="num">
                    {yen(t.monthlyAvg.expense - t.monthlyAvg.livingCost)}
                  </td>
                  <td data-label="支出計" className="num">
                    {yen(t.monthlyAvg.expense)}
                  </td>
                  <td data-label="収支" className={`num ${gainCls(t.monthlyAvg.balance)}`}>
                    {yenS(t.monthlyAvg.balance)}
                  </td>
                  <td />
                  <td />
                </tr>
                <tr>
                  <td data-label="月">年換算(月平均×12)</td>
                  <td data-label="収入計" className="num">
                    {yen(t.annualized.income)}
                  </td>
                  <td data-label="生活費" className="num">
                    {yen(t.annualized.livingCost)}
                  </td>
                  <td data-label="事業立替" className="num">
                    {yen(t.annualized.expense - t.annualized.livingCost)}
                  </td>
                  <td data-label="支出計" className="num">
                    {yen(t.annualized.expense)}
                  </td>
                  <td data-label="収支" className={`num ${gainCls(t.annualized.balance)}`}>
                    {yenS(t.annualized.balance)}
                  </td>
                  <td />
                  <td />
                </tr>
              </>
            }
          >
            {d.balance.map((b) => (
              <tr key={b.month} className={b.month === month ? 'selected' : undefined}>
                <td data-label="月">{monthLabel(b.month)}</td>
                <td data-label="収入計" className="num">
                  {yen(b.income)}
                </td>
                <td data-label="生活費" className="num">
                  {yen(b.livingCost)}
                </td>
                <td data-label="事業立替" className="num">
                  {yen(b.bizAdvance)}
                </td>
                <td data-label="支出計" className="num">
                  {yen(b.expense)}
                </td>
                <td data-label="収支" className={`num ${gainCls(b.balance)}`}>
                  {yenS(b.balance)}
                </td>
                <td data-label="貯蓄率" className="num">
                  {rate(b.saveRate)}
                </td>
                <td data-label="freee 事業経費" className="num">
                  {b.bizExpense === null ? '—' : yen(b.bizExpense)}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      </div>

      <div className="card scroll-x">
        <h2>生活費の内訳(全期間 {t.months}ヶ月・大項目別)</h2>
        <HowTo id="householdBreakdown" />
        <DataTable
          className="data stack-sm"
          columns={[
            '大項目',
            '合計',
            '月平均',
            termColumn('annualized'),
            termColumn('share', { label: '構成比' }),
          ]}
          foot={
            <tr className="total">
              <td data-label="大項目">生活費計</td>
              <td data-label="合計" className="num">
                {yen(t.livingCost)}
              </td>
              <td data-label="月平均" className="num">
                {yen(t.monthlyAvg.livingCost)}
              </td>
              <td data-label="年換算" className="num">
                {yen(t.annualized.livingCost)}
              </td>
              <td data-label="構成比" className="num">
                100%
              </td>
            </tr>
          }
        >
          {d.livingCost.map((r) => (
            <tr key={r.big}>
              <td data-label="大項目">{r.big}</td>
              <td data-label="合計" className="num">
                {yen(r.total)}
              </td>
              <td data-label="月平均" className="num">
                {yen(r.monthlyAvg)}
              </td>
              <td data-label="年換算" className="num">
                {yen(r.annualized)}
              </td>
              <td data-label="構成比" className="num">
                {ratio(r.share, 0)}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="card scroll-x">
        <h2>支出内訳(大項目別{prev ? ` / 前月 ${monthLabel(prev)} 比` : ''})</h2>
        <DataTable
          className="data stack-sm"
          columns={['大項目', monthLabel(month), ...(prev ? ['前月', '増減'] : [])]}
          foot={
            <tr className="total">
              <td data-label="大項目">支出計</td>
              <td data-label={monthLabel(month)} className="num">
                {yen(expTotal)}
              </td>
              {prev && pv && (
                <td data-label="前月" className="num">
                  {yen(Object.values(pv.expense).reduce((s, v) => s + v, 0))}
                </td>
              )}
              {prev && pv && (
                <td
                  data-label="増減"
                  className={`num ${deltaCls(expTotal - Object.values(pv.expense).reduce((s, v) => s + v, 0))}`}
                >
                  {yenS(expTotal - Object.values(pv.expense).reduce((s, v) => s + v, 0))}
                </td>
              )}
            </tr>
          }
        >
          {cats.map(([k, v]) => {
            const p = pv?.expense[k] ?? 0;
            return (
              <tr key={k}>
                <td data-label="大項目">{k}</td>
                <td data-label={monthLabel(month)} className="num">
                  {yen(v)}
                </td>
                {prev && (
                  <td data-label="前月" className="num">
                    {yen(p)}
                  </td>
                )}
                {prev && (
                  <td data-label="増減" className={`num ${deltaCls(v - p)}`}>
                    {yenS(v - p)}
                  </td>
                )}
              </tr>
            );
          })}
        </DataTable>
      </div>

      <div className="card">
        <h2>収入内訳(名義別: 事業 / 妻 / 家族)</h2>
        <p className="sub">
          名義の根拠はMF明細の「保有金融機関」(口座ごとに設定した名義)と、明細ごとの手動編集・ルール。推測では割り振りません。
        </p>
        {d.byOwner.unmappedInstitutions.length > 0 && (
          <div className="notice info">
            名義が未設定の口座: {d.byOwner.unmappedInstitutions.join(' / ')}。
            <Link to="/settings">設定の「口座の名義」</Link>で事業/妻/家族を選ぶと「未設定」が解消します。
          </div>
        )}
        {d.byOwner.noInstitutionCount > 0 && (
          <div className="notice info">
            口座が記録されていない明細が {d.byOwner.noInstitutionCount}{' '}
            件あります。MF明細を取り込み直すと名義が判定できるようになります。
          </div>
        )}
        <div className="scroll-x">
          <DataTable
            className="data stack-sm"
            columns={[
              '月',
              ownerLabel('business'),
              ownerLabel('spouse'),
              ownerLabel('family'),
              ownerLabel(null),
              '個人収入計',
            ]}
            /* 合計・月平均・年換算は明細ではないので、並べ替えの対象から外して末尾に固定する */
            foot={
              <>
                <tr className="total">
                  <td data-label="月">合計({d.byOwner.rows.length}ヶ月)</td>
                  <td data-label={ownerLabel('business')} className="num">
                    {yen(d.byOwner.totals.business.income)}
                  </td>
                  <td data-label={ownerLabel('spouse')} className="num">
                    {yen(d.byOwner.totals.spouse.income)}
                  </td>
                  <td data-label={ownerLabel('family')} className="num">
                    {yen(d.byOwner.totals.family.income)}
                  </td>
                  <td data-label={ownerLabel(null)} className="num">
                    {yen(d.byOwner.totals.unset.income)}
                  </td>
                  <td data-label="個人収入計" className="num">
                    {yen(
                      d.byOwner.totals.business.income +
                        d.byOwner.totals.spouse.income +
                        d.byOwner.totals.family.income +
                        d.byOwner.totals.unset.income,
                    )}
                  </td>
                </tr>
                <tr>
                  <td data-label="月">構成比</td>
                  <td data-label={ownerLabel('business')} className="num">
                    {ratio(d.byOwner.totals.business.incomeShare, 0)}
                  </td>
                  <td data-label={ownerLabel('spouse')} className="num">
                    {ratio(d.byOwner.totals.spouse.incomeShare, 0)}
                  </td>
                  <td data-label={ownerLabel('family')} className="num">
                    {ratio(d.byOwner.totals.family.incomeShare, 0)}
                  </td>
                  <td data-label={ownerLabel(null)} className="num">
                    {ratio(d.byOwner.totals.unset.incomeShare, 0)}
                  </td>
                  <td data-label="個人収入計" className="num">
                    100%
                  </td>
                </tr>
                <tr>
                  <td data-label="月">月平均</td>
                  <td data-label={ownerLabel('business')} className="num">
                    {yen(d.byOwner.totals.business.monthlyAvg.income)}
                  </td>
                  <td data-label={ownerLabel('spouse')} className="num">
                    {yen(d.byOwner.totals.spouse.monthlyAvg.income)}
                  </td>
                  <td data-label={ownerLabel('family')} className="num">
                    {yen(d.byOwner.totals.family.monthlyAvg.income)}
                  </td>
                  <td data-label={ownerLabel(null)} className="num">
                    {yen(d.byOwner.totals.unset.monthlyAvg.income)}
                  </td>
                  <td />
                </tr>
                <tr>
                  <td data-label="月">年換算(月平均×12)</td>
                  <td data-label={ownerLabel('business')} className="num">
                    {yen(d.byOwner.totals.business.annualized.income)}
                  </td>
                  <td data-label={ownerLabel('spouse')} className="num">
                    {yen(d.byOwner.totals.spouse.annualized.income)}
                  </td>
                  <td data-label={ownerLabel('family')} className="num">
                    {yen(d.byOwner.totals.family.annualized.income)}
                  </td>
                  <td data-label={ownerLabel(null)} className="num">
                    {yen(d.byOwner.totals.unset.annualized.income)}
                  </td>
                  <td />
                </tr>
              </>
            }
          >
            {d.byOwner.rows.map((r) => (
              <tr key={r.month} className={r.month === month ? 'selected' : undefined}>
                <td data-label="月">{monthLabel(r.month)}</td>
                <td data-label={ownerLabel('business')} className="num">
                  {yen(r.business.income)}
                </td>
                <td data-label={ownerLabel('spouse')} className="num">
                  {yen(r.spouse.income)}
                </td>
                <td data-label={ownerLabel('family')} className="num">
                  {yen(r.family.income)}
                </td>
                <td data-label={ownerLabel(null)} className="num">
                  {yen(r.unset.income)}
                </td>
                <td data-label="個人収入計" className="num">
                  {yen(r.business.income + r.spouse.income + r.family.income + r.unset.income)}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      </div>

      <div className="card scroll-x">
        <h2>収入内訳(中項目別)</h2>
        <DataTable className="data stack-sm" columns={['中項目', monthLabel(month)]}>
          {incCats.map(([k, v]) => (
            <tr key={k}>
              <td data-label="中項目">{k}</td>
              <td data-label={monthLabel(month)} className="num">
                {yen(v)}
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </>
  );
}
