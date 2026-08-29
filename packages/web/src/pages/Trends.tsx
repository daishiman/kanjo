/**
 * 支出トレンド: どの科目が大きく、増えているのか。次に何をするのか。
 *
 * 「見て終わり」にしないため、表の並び順を金額順ではなく管理優先度順にする。
 * 上から順に手を打てば効果が大きい順になる、というのがこの画面の約束。
 */
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type ExpenseScope, type TrendRow, type TrendsResponse, api } from '../api.js';
import { DataTable, termColumn } from '../components/DataTable.js';
import { HowTo } from '../components/HowTo.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { COLORS, yenTick } from '../components/charts.js';
import { deltaCls, monthShort, pct, yen, yenS } from '../format.js';
import { usePeriod } from '../period.js';

const SCOPES: { id: ExpenseScope; label: string }[] = [
  { id: 'all', label: '事業+家計' },
  { id: 'biz', label: '事業' },
  { id: 'personal', label: '家計' },
];

/** 増=赤・減=緑。マトリクス画面と揃える(色の意味が画面ごとに変わるのが一番危ない) */
const DIRECTION_CLS: Record<TrendRow['direction'], string> = {
  増加: 'pill alert',
  減少: 'pill calm',
  横ばい: 'pill neutral',
  判定不可: 'pill neutral',
};

const ACTION_CLS: Record<TrendRow['action'], string> = {
  削減を検討: 'pill alert',
  記録を整える: 'pill warn',
  継続監視: 'pill warn',
  対応不要: 'pill neutral',
};

export function TrendsPage() {
  const [scope, setScope] = useState<ExpenseScope>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['trends', key, scope],
    queryFn: () => api<TrendsResponse>(withPeriod(`/trends?scope=${scope}`)),
  });

  if (q.isLoading)
    return (
      <>
        <PageHeader route="trends" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="trends" />
        <PageState status="error" error={q.error} />
      </>
    );

  const t = q.data;
  if (!t.recordedMonths.length)
    return (
      <>
        <PageHeader route="trends" />
        <ScopeTabs scope={scope} onChange={setScope} />
        <PageState
          status="empty"
          message="集計できる月がありません。データを取り込むか、未記帳月の設定を確認してください。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );

  const need = t.counts.削減を検討 + t.counts.記録を整える;
  const top = t.rows.filter((r) => r.action !== '対応不要').slice(0, 12);
  const months = t.recordedMonths;

  return (
    <>
      <PageHeader route="trends" />
      <ScopeTabs scope={scope} onChange={setScope} />

      <div className="kpis">
        <KpiCard
          label={`支出合計(${t.scopeLabel})`}
          value={yen(t.expenseTotal)}
          note={`${months.length}ヶ月 / 月あたり ${yen(t.monthlyAvg)}`}
        />
        <KpiCard
          label="支出の8割を占める科目数"
          value={`${t.coreCount}科目`}
          note={`全${t.rows.length}科目中。少ないほど手を打つ先が絞れている`}
        />
        <KpiCard
          label="前半→後半の増減"
          value={<span className={deltaCls(t.breakdown.diff)}>{yenS(t.breakdown.diff)}</span>}
          note="月あたりの平均で比較"
        />
        <KpiCard
          label="手を打つ科目"
          value={`${need}件`}
          note={`削減を検討 ${t.counts.削減を検討} / 記録を整える ${t.counts.記録を整える}`}
        />
      </div>

      {t.sides.length > 1 && (
        <div className="card">
          <h2>事業と家計の内訳</h2>
          <HowTo id="trendsSplit" />
          <div className="scroll-x">
            <DataTable
              columns={[
                '区分',
                { label: '合計', className: 'num' },
                { label: '月あたり', className: 'num' },
                termColumn('share', { label: '構成比', className: 'num' }),
                { label: '科目数', className: 'num' },
                '最大の科目',
              ]}
            >
              {t.sides.map((s) => (
                <tr key={s.side}>
                  <td data-label="区分">
                    <span className={`pill ${s.side === 'biz' ? 'biz' : 'per'}`}>{s.label}</span>
                  </td>
                  <td data-label="合計" className="num">
                    {yen(s.total)}
                  </td>
                  <td data-label="月あたり" className="num">
                    {yen(s.monthlyAvg)}
                  </td>
                  <td data-label="構成比" className="num">
                    {pct(s.share)}
                  </td>
                  <td data-label="科目数" className="num">
                    {s.accountCount}
                  </td>
                  <td data-label="最大の科目">
                    {s.topAccount ? `${s.topAccount.account}(${yen(s.topAccount.total)})` : '—'}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
          <Chart
            type="bar"
            height={90}
            data={{
              labels: t.monthlySides.map((m) => monthShort(m.month)),
              datasets: [
                {
                  label: '事業',
                  data: t.monthlySides.map((m) => m.biz),
                  backgroundColor: COLORS.biz,
                  stack: 's',
                },
                {
                  label: '家計',
                  data: t.monthlySides.map((m) => m.personal),
                  backgroundColor: COLORS.per,
                  stack: 's',
                },
              ],
            }}
            options={{
              responsive: true,
              scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: yenTick } } },
              plugins: { legend: { position: 'bottom' } },
            }}
          />
          <p className="sub">
            スコープを切り替えても、この推移は事業と家計の両方を出す。片方だけを見ているときに
            「もう片方はどうなのか」が同じ画面で分かるようにするため。
          </p>
        </div>
      )}

      <div className="card">
        <h2>手を打つ順番</h2>
        <HowTo id="trendsPriority" />
        {top.length === 0 ? (
          <p className="sub">いま対応が要る科目はありません。今の水準を保てています。</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>科目</th>
                <th>次の行動</th>
                <th>増減</th>
                <th className="num">月あたり</th>
                <th className="num">構成比</th>
                <th className="num">1年続いた場合</th>
                <th>推移</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <Fragment key={r.key}>
                  <tr>
                    <td data-label="科目">
                      <button
                        type="button"
                        className="linklike"
                        aria-expanded={openKey === r.key}
                        onClick={() => setOpenKey(openKey === r.key ? null : r.key)}
                      >
                        {r.account}
                      </button>{' '}
                      <span className={`pill ${r.side === 'biz' ? 'biz' : 'per'}`}>
                        {r.side === 'biz' ? '事業' : '家計'}
                      </span>{' '}
                      <span className="pill neutral">{r.type}</span>
                    </td>
                    <td data-label="次の行動">
                      <span className={ACTION_CLS[r.action]}>{r.action}</span>
                    </td>
                    <td data-label="増減">
                      <span className={DIRECTION_CLS[r.direction]}>{r.direction}</span>
                    </td>
                    <td data-label="月あたり" className="num">
                      {yen(r.monthlyAvg)}
                    </td>
                    <td data-label="構成比" className="num">
                      {pct(r.share)}
                    </td>
                    <td data-label="1年続いた場合" className={`num ${deltaCls(r.annualImpact)}`}>
                      {r.direction === '増加' || r.direction === '減少' ? yenS(r.annualImpact) : '—'}
                    </td>
                    <td data-label="推移">
                      <Spark series={r.series} />
                    </td>
                  </tr>
                  {openKey === r.key && (
                    <tr className="detail-row">
                      <td colSpan={7}>
                        <p>{r.reason}</p>
                        <p className="sub">
                          傾き {yenS(Math.round(r.slopePerMonth))}/月 ・ <Term id="pValue" />=
                          {r.mk.p.toFixed(3)} ・<Term id="cv">変動係数</Term> {r.cv.toFixed(2)} ・ 直近平均{' '}
                          {yen(r.recentAvg)} / それ以前 {yen(r.priorAvg)}
                          {r.gapMonths.length > 0 && (
                            <> ・ 金額が立っていない月: {r.gapMonths.map(monthShort).join('・')}</>
                          )}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        <p className="sub">
          並び順は金額ではなく管理優先度。順位は「記録の欠けている科目 &gt; 有意に増えている大きい科目 &gt;
          大きいが横ばいの科目」の順に決めている。増減の判定は
          <Term id="mannKendall">Mann-Kendall検定</Term>(順位ベース)と
          <Term id="theilSen">Theil-Sen傾き</Term>
          (中央値ベース)で、単発の大きな支払い1件では「増加」と言い切らない。
        </p>
      </div>

      <div className="card">
        <h2>
          増減はどこから来たか(前半 {t.breakdown.beforeMonths.length}ヶ月 → 後半{' '}
          {t.breakdown.afterMonths.length}ヶ月)
        </h2>
        <HowTo id="trendsWaterfall" />
        <Chart
          type="bar"
          height={90}
          data={{
            labels: waterfall(t).map((r) => r.account),
            datasets: [
              {
                label: '月あたりの差',
                data: waterfall(t).map((r) => r.diff),
                backgroundColor: waterfall(t).map((r) => (r.diff > 0 ? COLORS.danger : COLORS.good)),
              },
            ],
          }}
          options={{
            indexAxis: 'y' as const,
            responsive: true,
            scales: { x: { ticks: { callback: yenTick } } },
            plugins: { legend: { display: false } },
          }}
        />
        <div className="scroll-x">
          <DataTable
            columns={[
              '科目',
              { label: '前半(月平均)', className: 'num' },
              { label: '後半(月平均)', className: 'num' },
              { label: '差', className: 'num' },
              termColumn('contribution', { className: 'num' }),
            ]}
          >
            {waterfall(t).map((r) => (
              <tr key={r.key}>
                <td data-label="科目">
                  {r.account}{' '}
                  <span className={`pill ${r.side === 'biz' ? 'biz' : 'per'}`}>
                    {r.side === 'biz' ? '事業' : '家計'}
                  </span>
                </td>
                <td data-label="前半(月平均)" className="num">
                  {yen(r.before)}
                </td>
                <td data-label="後半(月平均)" className="num">
                  {yen(r.after)}
                </td>
                <td data-label="差" className={`num ${deltaCls(r.diff)}`}>
                  {yenS(r.diff)}
                </td>
                <td data-label="寄与度" className="num">
                  {t.breakdown.diff === 0 ? '—' : pct(r.contribution)}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
        <p className="sub">
          「先月より5万円増えた」だけでは動けない。それが外注費の+6万と通信費の-1万の合成だと分かって
          初めて手を打つ先が決まる。寄与は全体の増減に対する割合で、増えた科目と減った科目が打ち消し合う。
        </p>
      </div>

      <div className="card">
        <h2>
          金額の集中(<Term id="pareto">パレート</Term>)
        </h2>
        <HowTo id="trendsPareto" />
        <Chart
          type="bar"
          height={90}
          data={{
            labels: t.pareto.slice(0, 15).map((p) => p.account),
            datasets: [
              {
                type: 'bar' as const,
                label: '合計',
                data: t.pareto.slice(0, 15).map((p) => p.total),
                backgroundColor: t.pareto
                  .slice(0, 15)
                  .map((p) => (p.side === 'biz' ? COLORS.biz : COLORS.per)),
                yAxisID: 'y',
              },
              {
                type: 'line' as const,
                label: '累積構成比',
                data: t.pareto.slice(0, 15).map((p) => p.cumShare * 100),
                borderColor: COLORS.warn,
                backgroundColor: COLORS.warn,
                yAxisID: 'y1',
              },
            ],
          }}
          options={{
            responsive: true,
            scales: {
              y: { ticks: { callback: yenTick } },
              y1: {
                position: 'right' as const,
                min: 0,
                max: 100,
                grid: { drawOnChartArea: false },
                ticks: { callback: (v: number | string) => `${v}%` },
              },
            },
            plugins: { legend: { position: 'bottom' } },
          }}
        />
        <p className="sub">
          上位{t.coreCount}科目で支出の8割。まずここを動かさない限り、合計はほとんど変わらない。
        </p>
      </div>

      {t.unrecordedExpMonths.length > 0 && (
        <p className="sub">
          <Term id="unrecordedMonth">未記帳</Term>の月({t.unrecordedExpMonths.map(monthShort).join('・')}
          )はすべての指標から除いている。0円として混ぜると「取込が遅れているだけ」の月が「減少」に見えるため。
        </p>
      )}
    </>
  );
}

function ScopeTabs({ scope, onChange }: { scope: ExpenseScope; onChange: (s: ExpenseScope) => void }) {
  return (
    <div className="toolbar">
      <span className="segment" role="tablist" aria-label="集計の範囲">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            className={scope === s.id ? 'on' : ''}
            onClick={() => onChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </span>
    </div>
  );
}

/** 増減の大きい順に上下から取る。真ん中の「ほぼ動いていない科目」は読む意味がない */
function waterfall(t: TrendsResponse) {
  const sorted = [...t.breakdown.rows].sort((a, b) => b.diff - a.diff);
  const up = sorted.filter((r) => r.diff > 0).slice(0, 6);
  const down = sorted.filter((r) => r.diff < 0).slice(-6);
  return [...up, ...down];
}

/** 科目ごとの推移。数字の羅列より、形のほうが速く読める */
function Spark({ series }: { series: number[] }) {
  if (series.length < 2) return <span className="sub">—</span>;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => `${(i / (series.length - 1)) * 100},${20 - ((v - min) / span) * 18}`)
    .join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 20" preserveAspectRatio="none" role="img" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
