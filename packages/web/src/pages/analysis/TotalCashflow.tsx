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
import { type ReactNode, useState } from 'react';
import {
  type DuplicateVerdictValue,
  type TotalCashflowMonth,
  type TotalCashflowResponse,
  type TotalCashflowReview,
  api,
} from '../../api.js';
import { DataTable } from '../../components/DataTable.js';
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
    <section className="card scroll-x" data-total-cashflow-scroll aria-labelledby="tcf-monthly-title">
      <h2 id="tcf-monthly-title">月ごとのトータル収支</h2>
      <DataTable
        className="data stack-sm"
        caption={<caption>金額の単位は円。事業費と家計費の合計が総支出になる。</caption>}
        columns={[...COLUMNS]}
      >
        {rows.map((row) => (
          <tr key={row.month}>
            <td data-label="月">{row.month}</td>
            <td data-label="総収入" className="num">
              {num(row.totalIncome)}
            </td>
            <td data-label="総支出" className="num">
              {num(row.totalExpense)}
            </td>
            <td data-label="総収支" className={`num ${row.totalBalance < 0 ? 'neg' : 'pos'}`}>
              {num(row.totalBalance)}
            </td>
            <td data-label="事業費" className="num">
              {num(row.bizExpense)}
            </td>
            <td data-label="家計費" className="num">
              {num(row.householdExpense)}
            </td>
            {/*
              件数と金額を同じセルに並べる。列を 10 本目に増やすと F9 の「9 列」が崩れ、
              件数だけ出すと「3 件寄った」が 300 円なのか 30 万円なのか読めない。
            */}
            <td data-label="事業費へ寄せた件数" className="num">
              {`${num(row.shiftedCount)} 件 / ${num(row.shiftedAmount)}`}
            </td>
            <td data-label="要確認件数" className="num">
              {num(row.reviewCount)}
            </td>
            <td data-label="トレンド">
              <span className={TREND_CLS[row.trend]}>{row.trend}</span>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

/** 日付の差を人が読める形に。0 は「同じ日」と言い切る (「0 日ずれ」は読み手が一拍止まる) */
const gapLabel = (dayGap: number): string =>
  dayGap === 0 ? '同じ日' : dayGap > 0 ? `freee が ${dayGap} 日あと` : `freee が ${-dayGap} 日まえ`;

/**
 * 要確認 1 件を、MF 1 行 + freee 候補 n 行の「行」へほどいたもの。
 *
 * 入れ子の表をやめて 1 枚の表に畳むための中間形。列 (発生日・内容・金額・口座・分類) は
 * MF と freee で共通にする。列が揃っていないと、金額が一致しているかを目で追えない。
 */
interface CompareLine {
  key: string;
  source: 'MF' | 'freee';
  date: ReactNode;
  content: string;
  amount: string;
  account: string;
  category: string;
  /** その行が自動で決まらなかった事情。MF 行には理由、freee 行には日付のずれ・口座の食い違い */
  note: string;
}

/** freee 側に候補が無いことも判断材料なので、行を消さず語で書く */
const NO_CANDIDATE = '同じ金額・同じ向きで前後 3 日以内の取引はありません';

function compareLines(item: TotalCashflowReview): CompareLine[] {
  const sign = item.mf.io === 'income' ? '+' : '-';
  const mfLine: CompareLine = {
    key: 'mf',
    source: 'MF',
    date: (
      <>
        {item.mf.date}
        {/* 取込月と表示日が食い違う明細では、どちらの日付で照合したかが理由そのものになる */}
        {item.mf.date.slice(5).replace('-', '/') === item.mf.displayDate ? null : (
          <> (表示 {item.mf.displayDate})</>
        )}
      </>
    ),
    content: item.mf.memo ? `${item.mf.content} / ${item.mf.memo}` : item.mf.content,
    amount: `${sign}${num(item.mf.amount)}`,
    account: item.mf.institution || '(記載なし)',
    category: [item.mf.major, item.mf.middle].filter(Boolean).join(' / ') || '(未分類)',
    note: item.reason,
  };
  if (item.candidates.length === 0) {
    return [
      mfLine,
      {
        key: 'none',
        source: 'freee',
        date: '—',
        content: NO_CANDIDATE,
        amount: '—',
        account: '—',
        category: '—',
        note: '',
      },
    ];
  }
  return [
    mfLine,
    ...item.candidates.map((cand) => ({
      key: `f${cand.freeeIndex}`,
      source: 'freee' as const,
      date: cand.date,
      content: cand.partner || '(取引先なし)',
      amount: `${sign}${num(cand.amount)}`,
      account: cand.settleAccount || '(記載なし)',
      category: cand.account,
      note: [gapLabel(cand.dayGap), cand.accountConflict ? '口座が食い違う' : '']
        .filter(Boolean)
        .join(' ・ '),
    })),
  ];
}

/** 1 セル分の積み重ね。長い値でも 1 行に収め、行の高さを列ごとにずらさない */
function Stack({ lines, render }: { lines: CompareLine[]; render: (line: CompareLine) => ReactNode }) {
  return (
    <>
      {lines.map((line) => (
        <div key={line.key} className={`tcf-line tcf-line-${line.source === 'MF' ? 'mf' : 'freee'}`}>
          {render(line)}
        </div>
      ))}
    </>
  );
}

/** 要確認の表の列。チェック欄と判定欄は並べ替えの対象にしない */
const REVIEW_COLUMNS = [
  { label: <span className="visually-hidden">選択</span>, sortable: false, className: 'tcf-pick' },
  { label: '出所', sortable: false },
  '発生日',
  '内容 / 取引先',
  '金額',
  '口座',
  '分類 / 勘定科目',
  '自動で決まらなかった理由',
  { label: '判定', sortable: false },
];

export function TotalCashflowPage() {
  const { key, withPeriod } = usePeriod();
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ['total-cashflow', key],
    queryFn: () => api<TotalCashflowResponse>(withPeriod('/total-cashflow')),
  });
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const decide = useMutation({
    mutationFn: (input: { txIds: readonly string[]; verdict: DuplicateVerdictValue }) =>
      api('/total-cashflow/verdicts', {
        method: 'POST',
        // 1 件のときは従来どおり単票で送る。まとめて送ると「その 1 件がなぜ保存できないか」が
        // 件ごとの理由の配列になり、その場で出すべき 404/409 の言葉が薄まる
        body: JSON.stringify(
          input.txIds.length === 1
            ? { txId: input.txIds[0], verdict: input.verdict }
            : { items: input.txIds.map((txId) => ({ txId, verdict: input.verdict })) },
        ),
      }),
    // 判断は帰属を動かすので、一覧表と要確認キューを両方引き直す
    onSuccess: () => {
      setPicked(new Set());
      return client.invalidateQueries({ queryKey: ['total-cashflow'] });
    },
  });

  if (q.isLoading) return <PageState status="loading" />;
  if (q.error) return <PageState status="error" error={q.error} />;
  if (!q.data) return <PageState status="empty" />;

  const review = q.data.review;
  // 判定した明細はキューから消える。選択だけが残ると、いま何を選んでいるか画面と食い違う
  const ids = new Set(review.map((item) => item.txId));
  const selected = [...picked].filter((id) => ids.has(id));
  const allPicked = review.length > 0 && selected.length === review.length;

  const toggle = (txId: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(txId)) next.add(txId);
      return next;
    });

  /** 同じ日・同じ金額で残っている組。口座名の食い違いだけで残った分をまとめて拾う近道 */
  const sameDay = review.filter((item) => item.candidates.some((cand) => cand.dayGap === 0));

  return (
    <>
      <TotalCashflowTable rows={q.data.months} />

      {/* 節の名前は「重複の要確認」で固定する。見出しは件数を持つので、名前に使うと
          件数が変わるたびに節の呼び名まで変わってしまう */}
      <section className="card scroll-x" aria-label="重複の要確認">
        <h2>要確認 {review.length} 件</h2>
        {review.length === 0 ? (
          <p className="sub">機械では決められない重複はありません。</p>
        ) : (
          <>
            <p className="sub">
              同じ取引が MF と freee の両方にあるかを見比べます。「同じ取引」にすると freee 側 1
              件だけが事業費に残り、家計費からは外れます。
            </p>
            <div className="tcf-bulk">
              <label className="tcf-pick-all">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => setPicked(allPicked ? new Set() : new Set(review.map((item) => item.txId)))}
                />
                すべて選ぶ
              </label>
              <span className="tcf-bulk-count">{selected.length} 件を選択中</span>
              <button
                type="button"
                className="btn primary"
                disabled={decide.isPending || selected.length === 0}
                onClick={() => decide.mutate({ txIds: selected, verdict: 'same' })}
              >
                選択したものを「同じ取引」にする
              </button>
              <button
                type="button"
                className="btn"
                disabled={decide.isPending || selected.length === 0}
                onClick={() => decide.mutate({ txIds: selected, verdict: 'different' })}
              >
                選択したものを「違う取引」にする
              </button>
              {/* 残る大半は「同じ日・同額なのに口座名の書き方が違う」組。一件ずつ押させない */}
              <button
                type="button"
                className="btn"
                disabled={sameDay.length === 0}
                onClick={() => setPicked(new Set(sameDay.map((item) => item.txId)))}
              >
                同じ日・同額のものを選ぶ ({sameDay.length})
              </button>
              <button
                type="button"
                className="btn"
                disabled={selected.length === 0}
                onClick={() => setPicked(new Set())}
              >
                選択を解除
              </button>
            </div>
            <DataTable className="data tcf-review-table" columns={REVIEW_COLUMNS}>
              {review.map((item) => {
                const lines = compareLines(item);
                const checked = ids.has(item.txId) && picked.has(item.txId);
                return (
                  <tr key={item.txId} className={checked ? 'tcf-picked' : undefined}>
                    <td data-label="選択" className="tcf-pick">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.txId)}
                        aria-label={`${item.mf.date} ${item.mf.content} ${num(item.mf.amount)} を選ぶ`}
                      />
                    </td>
                    <td data-label="出所">
                      <Stack lines={lines} render={(line) => line.source} />
                    </td>
                    <td data-label="発生日">
                      <Stack lines={lines} render={(line) => line.date} />
                    </td>
                    <td data-label="内容 / 取引先">
                      <Stack
                        lines={lines}
                        render={(line) => <span title={line.content}>{line.content}</span>}
                      />
                    </td>
                    <td data-label="金額" className="num">
                      <Stack lines={lines} render={(line) => line.amount} />
                    </td>
                    <td data-label="口座">
                      <Stack
                        lines={lines}
                        render={(line) => <span title={line.account}>{line.account}</span>}
                      />
                    </td>
                    <td data-label="分類 / 勘定科目">
                      <Stack
                        lines={lines}
                        render={(line) => <span title={line.category}>{line.category}</span>}
                      />
                    </td>
                    <td data-label="自動で決まらなかった理由">
                      <Stack lines={lines} render={(line) => line.note} />
                    </td>
                    {/* 「同じ」だけを置くと、違うと分かった組が要確認に残り続ける。
                        どちらの答えも同じ重さで置き、判断は片方向に誘導しない */}
                    <td data-label="判定" className="tcf-verdict">
                      <button
                        type="button"
                        className="mini"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ txIds: [item.txId], verdict: 'same' })}
                      >
                        同じ取引
                      </button>
                      <button
                        type="button"
                        className="mini"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ txIds: [item.txId], verdict: 'different' })}
                      >
                        違う取引
                      </button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </>
        )}
      </section>
    </>
  );
}
