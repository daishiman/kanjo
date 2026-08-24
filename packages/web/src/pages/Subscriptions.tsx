/** P4 サブスク分析: ベンダー別推移と重複・急増を確認する */
import { useQuery } from '@tanstack/react-query';
import { Chart } from 'react-chartjs-2';
import { type SubscriptionsData, api } from '../api.js';
import { VENDOR_PALETTE, yenTick } from '../components/charts.js';
import { deltaCls, monthLabel, monthShort, yen, yenS } from '../format.js';

export function SubscriptionsPage() {
  const q = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api<SubscriptionsData>('/subscriptions'),
  });
  if (q.isLoading) return <p>読み込み中…</p>;
  if (q.isError || !q.data) return <p>読み込みに失敗しました</p>;
  const s = q.data;
  if (!s.months.length) return <p className="empty">データ未取込です。</p>;

  return (
    <>
      <h1 className="page-title">サブスク分析</h1>
      <p className="page-task">ベンダー別推移と重複・急増を確認する。</p>

      {s.alerts.length > 0 && (
        <div className="notice">
          <strong>検知アラート {s.alerts.length}件</strong>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {s.alerts.map((a) => (
              <li key={`${a.vendor}-${a.month}-${a.type}`}>
                {monthLabel(a.month)} <strong>{a.vendor}</strong> {a.type === 'dup' ? '重複契約疑い' : '急増'}
                : <span className="num">{yen(a.value)}</span>(通常月中央値{' '}
                <span className="num">{yen(a.median)}</span>)
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="card scroll-x">
        <h2>
          ベンダー別 年間比較({s.years.prev}年 vs {s.years.curr}年換算)
        </h2>
        <table className="data">
          <thead>
            <tr>
              <th>ベンダー</th>
              <th>{s.years.prev}年実績</th>
              <th>{s.years.curr}年換算</th>
              <th>増減</th>
            </tr>
          </thead>
          <tbody>
            {s.vendorTable.map((r) => (
              <tr key={r.vendor}>
                <td>{r.vendor}</td>
                <td className="num">{yen(r.prevActual)}</td>
                <td className="num">{yen(r.currAnnualized)}</td>
                <td className={`num ${deltaCls(r.delta)}`}>{yenS(r.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub">重複疑い=中央値の1.8倍超かつ2万円超 / 急増=3倍超かつ1.5万円超(HTML版と同一基準)。</p>
    </>
  );
}
