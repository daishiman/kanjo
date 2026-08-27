/**
 * freee 未決済(未入金・未払)の一覧。
 *
 * 損益は発生ベースなので、支払っていない外注費も入金されていない売上も損益には既に載っている。
 * つまり「黒字なのに払えない/回収できていない」は損益からは見えない。ここだけが期日の側の眺め。
 *
 * 決済列のあるエクスポートを取り込んだ分だけが対象で、列の無い時期の取込は数に入らない。
 * 空のときに何も出さないのは、その区別が画面から見えず「0件」が誤解を招くため。
 */
import { useQuery } from '@tanstack/react-query';
import { type UnsettledResponse, api } from '../api.js';
import { yen } from '../format.js';
import { KpiCard } from './Page.js';

const STATUS_LABEL: Record<UnsettledResponse['rows'][number]['status'], string> = {
  overdue: '期日超過',
  due_soon: '期日が近い',
  scheduled: '期日待ち',
  no_due: '期日なし',
};

/** 期日超過だけを警告色にする。全部が色付きだと本当に急ぐ行が埋もれる */
const statusPill = (status: UnsettledResponse['rows'][number]['status']): string =>
  status === 'overdue' ? 'pill warn' : 'pill neutral';

/** 一覧に出す上限。これを超える分は件数だけ伝える(全件は取込元の freee で見る) */
export const UNSETTLED_ROW_LIMIT = 20;

export function UnsettledPanel() {
  const q = useQuery({ queryKey: ['unsettled'], queryFn: () => api<UnsettledResponse>('/unsettled') });
  // 読み込み中と失敗は静かに畳む。概況の主役は収支で、ここは添え物のため
  if (!q.data || !q.data.rows.length) return null;
  const { rows, summary, today } = q.data;
  const shown = rows.slice(0, UNSETTLED_ROW_LIMIT);

  return (
    <div className="card unsettled" style={{ marginTop: 16 }}>
      <h2>未決済(未払・未入金) {rows.length}件</h2>
      <p className="sub">
        freee
        で「発生」だけ記録され、支払日が入っていない取引です。損益にはすでに入っているため、この一覧にしか出ません(基準日{' '}
        {today})。
      </p>
      <div className="kpis">
        <KpiCard
          label="未払(これから出ていく)"
          value={yen(summary.payable.amount)}
          note={`${summary.payable.count}件`}
        />
        <KpiCard
          label="未入金(これから入る)"
          value={yen(summary.receivable.amount)}
          note={`${summary.receivable.count}件`}
        />
        <KpiCard
          label="うち期日超過"
          value={yen(summary.overdue.amount)}
          note={`${summary.overdue.count}件`}
        />
      </div>
      <div className="scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>期日</th>
              <th>状態</th>
              <th>区分</th>
              <th>取引先</th>
              <th>科目</th>
              <th>残額</th>
            </tr>
          </thead>
          <tbody>
            {/* 同じ取引先へ同じ額・同じ期日の請求が2件あることは普通にあるため、行の識別は位置で持つ */}
            {shown.map((row, i) => (
              <tr key={`${i}-${row.deal.date}-${row.deal.partner}-${row.deal.amount}`}>
                <td className="num">{row.dueDate ?? '—'}</td>
                <td>
                  <span className={statusPill(row.status)}>{STATUS_LABEL[row.status]}</span>
                  {row.status === 'overdue' && <span className="sub"> {row.daysOverdue}日</span>}
                </td>
                <td>{row.deal.io === 'expense' ? '未払' : '未入金'}</td>
                <td>{row.deal.partner || '—'}</td>
                <td>{row.deal.accountNorm}</td>
                <td className="num">{yen(row.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="sub">
          期日の急ぐ順に{UNSETTLED_ROW_LIMIT}件まで表示しています(残り{rows.length - shown.length}件)。
        </p>
      )}
    </div>
  );
}
