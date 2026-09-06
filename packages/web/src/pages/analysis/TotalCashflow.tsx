/**
 * トータル収支: 事業と家計を合わせて、月ごとにいくら入っていくら出たか。
 *
 * 個人事業では事業と家計が同じ口座を通るため、割合は分かってもトータルの推移が読めない。
 * この画面は「トータル → 内訳」の順で並べ、まず総額の向きを見せる。
 *
 * 表の数値はサーバの導出値をそのまま写す。画面側で合計を組み直さないのは、
 * 表示と API が食い違ったときに、どちらが正しいかを利用者が判断できなくなるため。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DuplicateVerdictValue,
  type TotalCashflowMonth,
  type TotalCashflowResponse,
  api,
} from '../../api.js';
import { PageState } from '../../components/Page.js';
import { usePeriod } from '../../period.js';

/** 一覧表の列。9 列で確定しており、画面幅で落とさない(落とすと内訳が読めなくなる) */
const COLUMNS = [
  '月',
  '総収入',
  '総支出',
  '総収支',
  '事業費',
  '家計費',
  '事業費へ寄せた分',
  '要確認件数',
  'トレンド',
] as const;

/** 表内の数値。単位は表の見出し外(caption)で一度だけ断り、桁区切りだけを付ける */
const num = (v: number): string => Math.round(v).toLocaleString('ja-JP');

/** 増=赤・減=緑。支出トレンド画面と揃える(色の意味が画面ごとに変わるのが一番危ない) */
const TREND_CLS: Record<TotalCashflowMonth['trend'], string> = {
  増加: 'pill alert',
  減少: 'pill calm',
  横ばい: 'pill neutral',
  判定不可: 'pill neutral',
};

export function TotalCashflowTable({ rows }: { rows: readonly TotalCashflowMonth[] }) {
  return (
    // 列を隠す分岐を持たず、狭い画面では表ごと横スクロールさせる。
    // 小画面で列を落とすと「事業費と家計費の合計が総支出」という関係が画面上で切れる。
    <div data-total-cashflow-scroll style={{ overflowX: 'auto' }}>
      <table>
        <caption>金額の単位は円。事業費と家計費の合計が総支出になる。</caption>
        <thead>
          <tr>
            {COLUMNS.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month}>
              <td>{row.month}</td>
              <td>{num(row.totalIncome)}</td>
              <td>{num(row.totalExpense)}</td>
              <td>{num(row.totalBalance)}</td>
              <td>{num(row.bizExpense)}</td>
              <td>{num(row.householdExpense)}</td>
              {/*
                件数と金額を同じセルに並べる。列を 10 本目に増やすと F9 の「9 列」が崩れ、
                件数だけ出すと「3 件寄った」が 300 円なのか 30 万円なのか読めない。
              */}
              <td>{`${num(row.shiftedCount)} 件 / ${num(row.shiftedAmount)}`}</td>
              <td>{num(row.reviewCount)}</td>
              <td>
                <span className={TREND_CLS[row.trend]}>{row.trend}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TotalCashflowPage() {
  const { key, withPeriod } = usePeriod();
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ['total-cashflow', key],
    queryFn: () => api<TotalCashflowResponse>(withPeriod('/total-cashflow')),
  });

  const decide = useMutation({
    mutationFn: (input: { txId: string; verdict: DuplicateVerdictValue }) =>
      api('/total-cashflow/verdicts', { method: 'POST', body: JSON.stringify(input) }),
    // 判断は帰属を動かすので、一覧表と要確認キューを両方引き直す
    onSuccess: () => client.invalidateQueries({ queryKey: ['total-cashflow'] }),
  });

  if (q.isLoading) return <PageState status="loading" />;
  if (q.error) return <PageState status="error" error={q.error} />;
  if (!q.data) return <PageState status="empty" />;

  return (
    <>
      <TotalCashflowTable rows={q.data.months} />

      <section aria-label="重複の要確認">
        <h3>要確認 {q.data.review.length} 件</h3>
        {q.data.review.length === 0 ? (
          <p>機械では決められない重複はありません。</p>
        ) : (
          <ul>
            {q.data.review.map((item) => (
              <li key={item.txId}>
                <span>{item.txId}</span>
                <span>{item.reason}</span>
                {/* 「同じ」だけを置くと、違うと分かった組が要確認に残り続ける。
                    どちらの答えも同じ重さで置き、判断は片方向に誘導しない */}
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ txId: item.txId, verdict: 'same' })}
                >
                  同じ取引
                </button>
                <button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ txId: item.txId, verdict: 'different' })}
                >
                  違う取引
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
