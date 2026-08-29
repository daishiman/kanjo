import { SETTLEMENT_STATUS_LABEL } from '@kanjo/core';
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
import { yen, yenS } from '../format.js';
import { DataTable } from './DataTable.js';
import { KpiCard } from './Page.js';
import { Term } from './Term.js';

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
  // rolling deploy中に旧Workerへ当たる場合だけ空配列へ正規化する
  const schedule = q.data.schedule ?? [];
  const shown = rows.slice(0, UNSETTLED_ROW_LIMIT);
  // 実際に月へ割り当てられた予定だけを繰越の対象にする(期日なしは「いつ動くか」が決まっていない)
  // 予定の表は後から足したもの。schedule を返さない版の Worker に当たっても一覧は出す
  const dated = schedule.filter((m) => m.month !== null);
  const undated = schedule.find((m) => m.month === null);
  let running = 0;
  const forecast = dated.map((m) => {
    running += m.net;
    return { ...m, running };
  });

  return (
    <div className="card unsettled" style={{ marginTop: 16 }}>
      <h2>未決済(未払・未入金) {rows.length}件</h2>
      <p className="sub">
        freee で「発生」だけ記録され、支払日が入っていない取引です。損益は
        <Term id="accrual" />
        で計算するのですでに入っており、現金の側から見えるのはこの一覧だけです(基準日 {today})。
      </p>
      <div className="kpis">
        <KpiCard
          label={<Term id="payable">未払(これから出ていく)</Term>}
          value={yen(summary.payable.amount)}
          note={`${summary.payable.count}件`}
        />
        <KpiCard
          label={<Term id="receivable">未入金(これから入る)</Term>}
          value={yen(summary.receivable.amount)}
          note={`${summary.receivable.count}件`}
        />
        <KpiCard
          label={<Term id="overdue">うち期日超過</Term>}
          value={yen(summary.overdue.amount)}
          note={`${summary.overdue.count}件`}
        />
      </div>
      {forecast.length > 0 && (
        <>
          <h3>これから現金がいつ動くか</h3>
          <p className="sub">
            期日を月ごとに束ねたものです。決算書の
            <Term id="cashFlow" />
            が「もう起きたこと」を現金に直すのに対し、こちらはこれから起きる分。
            <Term id="pl" />
            にはすでに載っているので、この表にしか出てきません。期日を過ぎた分は、過ぎた月ではなく今月に寄せています。
          </p>
          <div className="scroll-x">
            <DataTable
              className="data stack-sm"
              columns={[
                '期日の月',
                { label: '入る予定', className: 'num' },
                { label: '出る予定', className: 'num' },
                { label: '差引', className: 'num' },
                { label: '予定差引の累計', className: 'num' },
              ]}
            >
              {forecast.map((m) => (
                <tr key={m.month}>
                  <th scope="row">
                    {m.month}
                    {m.overdue > 0 && <span className="sub"> 期日超過{yen(m.overdue)}を含む</span>}
                  </th>
                  <td className="num" data-label="入る予定">
                    {m.receipt ? yen(m.receipt) : '—'}
                  </td>
                  <td className="num" data-label="出る予定">
                    {m.payment ? yen(m.payment) : '—'}
                  </td>
                  <td className={`num ${m.net < 0 ? 'neg' : 'pos'}`} data-label="差引">
                    {yenS(m.net)}
                  </td>
                  <td className={`num ${m.running < 0 ? 'neg' : 'pos'}`} data-label="予定差引の累計">
                    {yenS(m.running)}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
          <p className="sub">
            予定差引の累計は、現在の手元残高を含まない入出金予定の純増減です。マイナスでも、それだけで資金不足とは判定しません。
            {undated && (
              <>
                {' '}
                期日の入っていない{undated.count}件({yen(undated.receipt + undated.payment)}
                )は、いつ動くか決まらないためこの表には数えていません。
              </>
            )}
          </p>
        </>
      )}

      <h3>未決済の明細</h3>
      <div className="scroll-x">
        <DataTable columns={['期日', '状態', '区分', '取引先', '科目', '残額']}>
          {/* 同じ取引先へ同じ額・同じ期日の請求が2件あることは普通にあるため、行の識別は位置で持つ */}
          {shown.map((row, i) => (
            <tr key={`${i}-${row.deal.date}-${row.deal.partner}-${row.deal.amount}`}>
              <td className="num">{row.dueDate ?? '—'}</td>
              <td>
                <span className={statusPill(row.status)}>{SETTLEMENT_STATUS_LABEL[row.status]}</span>
                {row.status === 'overdue' && <span className="sub"> {row.daysOverdue}日</span>}
              </td>
              <td>{row.deal.io === 'expense' ? '未払' : '未入金'}</td>
              <td>{row.deal.partner || '—'}</td>
              <td>{row.deal.accountNorm}</td>
              <td className="num">{yen(row.remaining)}</td>
            </tr>
          ))}
        </DataTable>
      </div>
      {rows.length > shown.length && (
        <p className="sub">
          期日の急ぐ順に{UNSETTLED_ROW_LIMIT}件まで表示しています(残り{rows.length - shown.length}件)。
        </p>
      )}
    </div>
  );
}
