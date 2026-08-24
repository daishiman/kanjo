/** P3 統計診断: 信号(判定)を見て対応すべき科目を決める */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type DiagnosisData, api } from '../api.js';
import { pct, yen } from '../format.js';

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
  const q = useQuery({ queryKey: ['diagnosis'], queryFn: () => api<DiagnosisData>('/diagnosis') });
  if (q.isLoading) return <p>読み込み中…</p>;
  if (q.isError || !q.data) return <p>読み込みに失敗しました</p>;
  const d = q.data;
  if (!d.entries.length) return <p className="empty">データ未取込です。</p>;

  return (
    <>
      <h1 className="page-title">統計診断</h1>
      <p className="page-task">信号(判定)を見て、対応すべき科目を決める。</p>

      <div className="kpis">
        <div className="kpi">
          <div className="label">経費 平均 / 中央値({d.kpi.months}ヶ月)</div>
          <div className="value">{yen(d.kpi.expenseMean)}</div>
          <div className="note num">
            中央値 {yen(d.kpi.expenseMedian)} / CV {d.kpi.expenseCv.toFixed(2)}
          </div>
        </div>
        <div className="kpi">
          <div className="label">固定費(CV&lt;0.6 直近3ヶ月平均)</div>
          <div className="value">{yen(d.kpi.fixedCost)}</div>
        </div>
        <div className="kpi">
          <div className="label">損益分岐点(BEP)</div>
          <div className="value">{yen(d.bep.breakEven)}</div>
          <div className="note num">安全余裕率 {pct(d.bep.safetyMargin, 0)}</div>
        </div>
        <div className="kpi">
          <div className="label">平均月商(売上{d.bep.revenueMonths}ヶ月)</div>
          <div className="value">{yen(d.bep.avgRevenue)}</div>
          <div className="note num">経費率 {pct(d.kpi.expenseRatio, 0)}</div>
        </div>
      </div>

      <div className="card scroll-x">
        <h2>科目別プロファイル(未記帳月は除外)</h2>
        <table className="data">
          <thead>
            <tr>
              <th>科目</th>
              <th>分類</th>
              <th>直近3ヶ月平均</th>
              <th>平均</th>
              <th>中央値</th>
              <th>CV</th>
              <th>基準レンジ</th>
              <th>z</th>
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
