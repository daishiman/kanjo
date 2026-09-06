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
  type TotalCashflowReview,
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
  // 列名は system-spec/ui-ux.md の利用者承認 (appr-foundation-total-cashflow-005) が正本。
  // セルには金額も併記するが、承認済みの見出しを実装都合で改名しない
  '事業費へ寄せた件数',
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

/** 日付の差を人が読める形に。0 は「同じ日」と言い切る (「0 日ずれ」は読み手が一拍止まる) */
const gapLabel = (dayGap: number): string =>
  dayGap === 0 ? '同じ日' : dayGap > 0 ? `freee が ${dayGap} 日あと` : `freee が ${-dayGap} 日まえ`;

/**
 * 要確認 1 件を MF と freee の対比で見せる。
 *
 * 判断に要るのは識別子ではなく中身なので、同じ列 (発生日・内容・金額・口座・分類) に
 * 両者を並べる。行の並びを揃えないと、金額が一致しているかを目で追えない。
 * freee 候補が 0 件なら「相手がいない」ことをそのまま書く。これも判断材料である。
 */
function ReviewCompare({ item }: { item: TotalCashflowReview }) {
  return (
    <div data-review-compare style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th scope="col">出所</th>
            <th scope="col">発生日</th>
            <th scope="col">内容 / 取引先</th>
            <th scope="col">金額</th>
            <th scope="col">口座</th>
            <th scope="col">分類</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Money Forward</th>
            <td>
              {item.mf.date}
              {/* 取込月と表示日が食い違う明細では、どちらの日付で照合したかが理由そのものになる */}
              {item.mf.date.slice(5).replace('-', '/') === item.mf.displayDate ? null : (
                <> (表示 {item.mf.displayDate})</>
              )}
            </td>
            <td>
              {item.mf.content}
              {item.mf.memo ? <> / {item.mf.memo}</> : null}
            </td>
            <td>{`${item.mf.io === 'income' ? '+' : '-'}${num(item.mf.amount)}`}</td>
            <td>{item.mf.institution || '(記載なし)'}</td>
            <td>{[item.mf.major, item.mf.middle].filter(Boolean).join(' / ') || '(未分類)'}</td>
          </tr>
          {item.candidates.length === 0 ? (
            <tr>
              <th scope="row">freee</th>
              <td colSpan={5}>同じ金額・同じ向きで前後 3 日以内の取引はありません</td>
            </tr>
          ) : (
            item.candidates.map((cand) => (
              <tr key={cand.freeeIndex}>
                <th scope="row">freee</th>
                <td>
                  {cand.date} ({gapLabel(cand.dayGap)})
                </td>
                <td>{cand.partner || '(取引先なし)'}</td>
                <td>{`${item.mf.io === 'income' ? '+' : '-'}${num(cand.amount)}`}</td>
                <td>
                  {cand.settleAccount || '(記載なし)'}
                  {cand.accountConflict ? <> ⚠ 口座が食い違う</> : null}
                </td>
                <td>{cand.account}</td>
              </tr>
            ))
          )}
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
                <p>{item.reason}</p>
                <ReviewCompare item={item} />
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
