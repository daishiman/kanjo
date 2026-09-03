/**
 * 支出照合: freeeを税務の正本に保ち、MF-onlyの事業支出を未記帳として見せる。
 * 対応の曖昧な明細は隠さず、公私仕分けと取込履歴の既存の安全な操作へ戻す。
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type BusinessSpendResponse, api } from '../../api.js';
import { DataTable } from '../../components/DataTable.js';
import { KpiCard, PageState } from '../../components/Page.js';
import { monthLabel, yen } from '../../format.js';
import { usePeriod } from '../../period.js';

const purposeLabel = (purpose: 'business' | 'personal') => (purpose === 'business' ? '事業' : '個人');

export function ReconciliationPage() {
  const { key, withPeriod } = usePeriod();
  const query = useQuery({
    queryKey: ['business-spend', key],
    queryFn: () => api<BusinessSpendResponse>(withPeriod('/business-spend')),
  });
  if (query.isLoading) return <PageState status="loading" />;
  if (query.isError || !query.data) return <PageState status="error" error={query.error} />;

  const data = query.data;
  if (!data.months.length) {
    return (
      <PageState
        status="empty"
        message="照合できる支出がまだありません。"
        action={
          <Link className="btn primary" to="/import">
            freee・MFを取り込む
          </Link>
        }
      />
    );
  }

  const needsAction = data.summary.unbooked > 0 || data.summary.reviewCount > 0;
  return (
    <>
      <div className="kpis reconciliation-kpis" aria-label="支出照合の合計">
        <KpiCard label="帳簿確定" value={yen(data.summary.booked)} note="freeeに記帳済み" tone="biz" />
        <KpiCard label="未記帳" value={yen(data.summary.unbooked)} note="MFで事業・freeeと未照合" />
        <KpiCard
          label="実質支出"
          value={yen(data.summary.effective)}
          note={`重複 ${data.summary.matchedCount}件を1度だけ計上`}
        />
      </div>

      <section
        className={`reconciliation-next${needsAction ? ' needs-action' : ''}`}
        aria-labelledby="reconciliation-next-title"
      >
        <div>
          <h2 id="reconciliation-next-title">{needsAction ? '次に確認すること' : '照合済みです'}</h2>
          <p>
            {needsAction
              ? `未記帳 ${data.unbooked.length}件、自動照合しなかった候補 ${data.summary.reviewCount}件があります。`
              : 'freeeとMFの厳密一致は二重に数えていません。'}
          </p>
        </div>
        {data.summary.unbooked > 0 && (
          <Link className="btn primary" to="/classify?cls=biz">
            MFの事業明細を確認する
          </Link>
        )}
        {data.summary.unbooked === 0 && data.summary.reviewCount > 0 && (
          <a className="btn primary" href="#reconciliation-review">
            照合候補を見る
          </a>
        )}
      </section>

      <section className="card scroll-x" aria-labelledby="reconciliation-monthly-title">
        <h2 id="reconciliation-monthly-title">月別の帳簿と実態</h2>
        <DataTable className="data stack-sm" columns={['月', '帳簿確定', '未記帳', '実質支出']}>
          {data.months.map((row) => (
            <tr key={row.month}>
              <td data-label="月">{monthLabel(row.month)}</td>
              <td data-label="帳簿確定" className="num">
                {yen(row.booked)}
              </td>
              <td data-label="未記帳" className="num">
                {yen(row.unbooked)}
              </td>
              <td data-label="実質支出" className="num reconciliation-effective">
                {yen(row.effective)}
              </td>
            </tr>
          ))}
        </DataTable>
        <p className="sub">MFの未記帳額はfreeeの税務上の確定額には含みません。</p>
      </section>

      {data.unbooked.length > 0 && (
        <details id="reconciliation-review" className="card reconciliation-disclosure">
          <summary>未記帳のMF事業支出 {data.unbooked.length}件</summary>
          <ul className="reconciliation-list">
            {data.unbooked.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.party || '支払先未設定'}</strong>
                  <span>
                    {row.date} ・ {row.category || '科目未設定'}
                  </span>
                </div>
                <span className="num">{yen(row.amount)}</span>
                <Link to={`/classify?month=${encodeURIComponent(row.month)}&cls=biz`}>明細を直す</Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {data.review.length > 0 && (
        <details className="card reconciliation-disclosure">
          <summary>自動照合しなかった候補 {data.review.length}件</summary>
          <p className="sub">
            これらは勝手に統合していません。原本の事実を直すと次の照合に自動反映されます。
          </p>
          <ul className="reconciliation-list review">
            {data.review.map((item) => (
              <li key={item.mf.id}>
                <div>
                  <strong>{item.reason}</strong>
                  <span>
                    MF: {item.mf.date} ・ {item.mf.party || '支払先未設定'} ・ {purposeLabel(item.mf.purpose)}
                  </span>
                  {item.freee && (
                    <span>
                      freee: {item.freee.date} ・ {item.freee.party || '支払先未設定'} ・{' '}
                      {purposeLabel(item.freee.purpose)}
                    </span>
                  )}
                  {!item.freee && <span>freee側の候補 {item.candidateCount}件</span>}
                </div>
                <span className="num">{yen(item.mf.amount)}</span>
                <Link to={`/classify?month=${encodeURIComponent(item.mf.month)}`}>公私を確認する</Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="reconciliation-safe-actions">
        個別明細の削除・リセットは<Link to="/classify">公私仕分け</Link>、取込単位の取り消しは
        <Link to="/import#import-history">データ取込履歴</Link>から、それぞれ30日間のundo付きで行えます。
      </p>
    </>
  );
}
