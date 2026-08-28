/** P3 統計診断: 信号(判定)を見て対応すべき科目を決める */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type DiagnosisData, api } from '../api.js';
import { KpiCard, PageHeader, PageState } from '../components/Page.js';
import { Term } from '../components/Term.js';
import { pct, yen } from '../format.js';
import { usePeriod } from '../period.js';

const judgePill: Record<string, string> = {
  要確認: 'pill alert',
  やや高い: 'pill warn',
  低め: 'pill calm',
  通常レンジ: 'pill neutral',
};

const kindLabel: Record<string, string> = {
  cut: '削減',
  watch: '監視',
  invest: '投資',
  fix: '固定費',
};

export function DiagnosisPage() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['diagnosis', key],
    queryFn: () => api<DiagnosisData>(withPeriod('/diagnosis')),
  });
  if (q.isLoading)
    return (
      <>
        <PageHeader route="diagnosis" />
        <PageState status="loading" />
      </>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader route="diagnosis" />
        <PageState status="error" error={q.error} />
      </>
    );
  const d = q.data;
  if (!d.entries.length)
    return (
      <>
        <PageHeader route="diagnosis" />
        <PageState
          status="empty"
          message="診断できるデータが未取込です。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </>
    );

  return (
    <>
      <PageHeader route="diagnosis" />

      <div className="kpis">
        <KpiCard
          label={
            <>
              経費 平均 / <Term id="median" />({d.kpi.months}ヶ月)
            </>
          }
          value={yen(d.kpi.expenseMean)}
          note={
            <span className="num">
              中央値 {yen(d.kpi.expenseMedian)} / <Term id="cv" /> {d.kpi.expenseCv.toFixed(2)}
            </span>
          }
        />
        <KpiCard
          label={
            <>
              <Term id="fixedCost" />
              (CV&lt;0.6 直近3ヶ月平均)
            </>
          }
          value={yen(d.kpi.fixedCost)}
        />
        <KpiCard
          label={
            <>
              <Term id="breakEven" />
              (BEP)
            </>
          }
          value={yen(d.bep.breakEven)}
          note={
            <span className="num">
              <Term id="safetyMargin" /> {pct(d.bep.safetyMargin, 0)}
            </span>
          }
        />
        <KpiCard
          label={`平均月商(売上${d.bep.revenueMonths}ヶ月)`}
          value={yen(d.bep.avgRevenue)}
          note={
            <span className="num">
              <Term id="expenseRatio" /> {pct(d.kpi.expenseRatio, 0)}
            </span>
          }
        />
      </div>

      <div className="card scroll-x">
        <h2>
          科目別プロファイル(
          <Term id="unrecordedMonth" />
          は除外)
        </h2>
        <table className="data">
          <thead>
            <tr>
              <th>科目</th>
              <th>
                <Term id="classification" />
              </th>
              <th>直近3ヶ月平均</th>
              <th>平均</th>
              <th>
                <Term id="median" />
              </th>
              <th>
                <Term id="cv" />
              </th>
              <th>
                <Term id="range" />
              </th>
              <th>
                <Term id="zScore" />
              </th>
              <th>判定</th>
              <th>シグナル</th>
            </tr>
          </thead>
          <tbody>
            {d.entries.map((e) => (
              <tr key={e.account}>
                <td>{e.account}</td>
                <td>
                  <span className="pill neutral">{e.profile.type}</span>
                </td>
                <td className="num">{yen(e.profile.rAvg)}</td>
                <td className="num">{yen(e.profile.mean)}</td>
                <td className="num">{yen(e.profile.med)}</td>
                <td className="num">{e.profile.cv.toFixed(2)}</td>
                <td className="num">
                  {yen(e.range.lo)}〜{yen(e.range.hi)}
                </td>
                <td className="num">{e.profile.z.toFixed(1)}</td>
                <td>
                  <span className={judgePill[e.judge]}>{e.judge}</span>
                </td>
                <td>
                  {e.signals.map((s) => (
                    <span
                      key={s}
                      className={`pill ${s === '契約見直し対象' ? 'warn' : s === '上昇' ? 'alert' : 'calm'}`}
                    >
                      {s}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>自動診断</h2>
        {d.autoDiagnosis.map((a) => (
          <div key={a.title} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <span className={`pill ${a.kind === 'cut' ? 'alert' : a.kind === 'watch' ? 'warn' : 'neutral'}`}>
              {kindLabel[a.kind] ?? a.tag}
            </span>{' '}
            <strong>{a.title}</strong> <span className="num">{a.value}</span>
            <div className="sub">{a.body}</div>
          </div>
        ))}
      </div>

      <p className="sub">
        高止まりの科目は <Link to="/classify">公私仕分け</Link> で内訳を確認 →{' '}
        <Link to="/budget">予算管理</Link> で上限を決める。
      </p>
    </>
  );
}
