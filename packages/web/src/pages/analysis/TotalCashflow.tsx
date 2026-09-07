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
  type FreeeCoverage,
  type ReconcileExcluded,
  type ReconcileFreee,
  type ReconcileMatch,
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
  /** freee 候補の行だけが持つ鍵。どの候補と組むかを名指しするために使う */
  freeeKey?: string;
  date: ReactNode;
  content: string;
  amount: string;
  account: string;
  category: string;
  /**
   * MF 行と食い違っている項目。候補は「同じ金額・同じ向き・前後 3 日以内」で既に絞られており、
   * 実際に違いうるのは日付と口座だけ。どこが違うかは機械が知っているので、利用者に目で
   * 探させず、そのセル自体へ印を出す。MF 行は比較の基準なので常に空。
   */
  differs: { date?: boolean; account?: boolean };
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
    differs: {},
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
        differs: {},
        note: '',
      },
    ];
  }
  return [
    mfLine,
    ...item.candidates.map((cand) => ({
      key: `f${cand.freeeIndex}`,
      source: 'freee' as const,
      freeeKey: cand.freeeKey,
      date: cand.dayGap === 0 ? cand.date : `${cand.date} (${gapLabel(cand.dayGap)})`,
      content: cand.partner || '(取引先なし)',
      amount: `${sign}${num(cand.amount)}`,
      account: cand.settleAccount || '(記載なし)',
      category: cand.account,
      differs: { date: cand.dayGap !== 0, account: cand.accountConflict },
      // 食い違いは各セルの印が伝える。ここは「差が無い」ことだけを引き受け、二重に書かない
      note: cand.dayGap === 0 && !cand.accountConflict ? '日付も口座も一致' : '違うところに印があります',
    })),
  ];
}

/**
 * 1 セル分の積み重ね。長い値でも 1 行に収め、行の高さを列ごとにずらさない。
 *
 * field を渡した列では、その項目が MF と食い違う freee 行にだけ印を出す。一致している
 * 側には何も足さない(全部に印を付けると、どこを見ればよいかがまた分からなくなる)。
 */
function Stack({
  lines,
  render,
  field,
}: {
  lines: CompareLine[];
  render: (line: CompareLine) => ReactNode;
  /** 食い違いを目立たせる項目。渡さない列は素のまま並べる */
  field?: keyof CompareLine['differs'];
}) {
  return (
    <>
      {lines.map((line) => {
        const differs = field ? line.differs[field] === true : false;
        return (
          <div
            key={line.key}
            className={`tcf-line tcf-line-${line.source === 'MF' ? 'mf' : 'freee'}${
              differs ? ' tcf-differs' : ''
            }`}
          >
            {differs && (
              <span className="tcf-differs-mark" aria-label="MF と違う">
                ≠
              </span>
            )}
            {render(line)}
          </div>
        );
      })}
    </>
  );
}

/** 向きを語で書く。符号だけだと、収入の freee 取引が支出に見える */
const ioLabel = (io: 'income' | 'expense'): string => (io === 'income' ? '収入' : '支出');

/** 金額に向きの符号を付ける。実額だけを並べると、収入と支出が同じ見た目になる */
const signed = (io: 'income' | 'expense', amount: number): string =>
  `${io === 'income' ? '+' : '-'}${num(amount)}`;

/**
 * freee 取引を「二重登録として外す / 戻す」入口。
 *
 * 突合 (MF と freee のどちらを正とするか) とは別の操作として置く。既定はあくまで freee が正で、
 * ここで外したものだけが総額から落ちる。理由の記入を挟むのは、後から金額の差を追うときに
 * 「なぜ外したか」が読めないと元へ戻す判断ができないため。
 */
function ExcludeControl({
  freeeKey,
  label,
  defaultReason = '',
}: {
  freeeKey: string;
  label: string;
  /**
   * 理由欄の初期値。決め手が画面に出ている行 (一致した組) では、その決め手をそのまま入れる。
   * 同じ言葉を毎回打たせるための空欄には意味がなく、打つのが面倒だから理由を省く方向へ働く。
   */
  defaultReason?: string;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason);
  const run = useMutation({
    mutationFn: () =>
      api('/total-cashflow/freee-exclusions', {
        method: 'POST',
        body: JSON.stringify({ freeeKey, reason: reason.trim() }),
      }),
    onSuccess: () => {
      setOpen(false);
      setReason(defaultReason);
      return client.invalidateQueries({ queryKey: ['total-cashflow'] });
    },
  });

  if (!open)
    return (
      <button type="button" className="mini" onClick={() => setOpen(true)}>
        二重登録として外す
      </button>
    );
  return (
    <span className="tcf-exclude-form">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="外す理由"
        aria-label={`${label} を外す理由`}
      />
      <button
        type="button"
        className="mini"
        disabled={run.isPending || reason.trim().length === 0}
        onClick={() => run.mutate()}
      >
        外す
      </button>
      <button type="button" className="mini" onClick={() => setOpen(false)}>
        やめる
      </button>
    </span>
  );
}

/** 外した freee 取引を総額へ戻す */
function RestoreButton({ freeeKey }: { freeeKey: string }) {
  const client = useQueryClient();
  const run = useMutation({
    mutationFn: () =>
      api('/total-cashflow/freee-exclusions', {
        method: 'DELETE',
        body: JSON.stringify({ freeeKey }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['total-cashflow'] }),
  });
  return (
    <button type="button" className="mini" disabled={run.isPending} onClick={() => run.mutate()}>
      総額へ戻す
    </button>
  );
}

const MATCHED_COLUMNS = [
  { label: '選択', sortable: false },
  '発生日',
  'MF の内容',
  'freee の取引先',
  '金額',
  '口座 (MF / freee)',
  '分類 / 勘定科目',
  '決め方',
  { label: '操作', sortable: false },
];

const FREEE_ONLY_COLUMNS = [
  '発生日',
  '取引先',
  '向き',
  '金額',
  '決済口座',
  '勘定科目',
  { label: '操作', sortable: false },
];

const EXCLUDED_COLUMNS = ['発生日', '取引先', '金額', '外した理由', { label: '操作', sortable: false }];

/**
 * 一致した組を外すときの既定の理由。決め手がそのまま理由になるので、同じ言葉を打たせない。
 * 「自動」は決め方の呼び名であって理由ではないため、理由の文からは落とす。
 */
const AUTO_MATCH_REASON = '日付と金額が一致';
const MANUAL_MATCH_REASON = 'あなたの判断で同じ取引とした';
const matchReason = (by: ReconcileMatch['by']) => (by === 'auto' ? AUTO_MATCH_REASON : MANUAL_MATCH_REASON);

/**
 * 1 リクエストで外せる件数。API 側の MAX_EXCLUSION_ITEMS と同じ値で、超える分だけ文を分ける。
 * 「すべて選ぶ」が数百件になる月でも、選んだ件数で成否が変わらないようにする。
 */
const MAX_EXCLUDE_PER_REQUEST = 200;

/**
 * 一致した組の表。決め手が画面に出ているので、外す理由の既定値もその決め手にする。
 *
 * まとめて外せる口を表の上に置くのは、freee 側の二重登録が「同じ理由で並んで出る」ためである。
 * 一件ずつ開いて同じ言葉を打つ手順しか無いと、理由を書くこと自体が省かれる方へ働く。
 */
function MatchedTable({ matched }: { matched: readonly ReconcileMatch[] }) {
  const client = useQueryClient();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [reason, setReason] = useState(AUTO_MATCH_REASON);

  const keys = new Set(matched.map((m) => m.freeeKey));
  // 外した組はこの表から消える。選択だけが残ると、いま何を選んでいるか画面と食い違う
  const selected = [...picked].filter((k) => keys.has(k));
  const allPicked = matched.length > 0 && selected.length === matched.length;

  const excludeMany = useMutation({
    mutationFn: async (input: { freeeKeys: readonly string[]; reason: string }) => {
      for (let at = 0; at < input.freeeKeys.length; at += MAX_EXCLUDE_PER_REQUEST) {
        await api('/total-cashflow/freee-exclusions', {
          method: 'POST',
          body: JSON.stringify({
            freeeKeys: input.freeeKeys.slice(at, at + MAX_EXCLUDE_PER_REQUEST),
            reason: input.reason,
          }),
        });
      }
    },
    onSuccess: () => {
      setPicked(new Set());
      setReason(AUTO_MATCH_REASON);
      return client.invalidateQueries({ queryKey: ['total-cashflow'] });
    },
  });

  const toggle = (freeeKey: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(freeeKey)) next.add(freeeKey);
      return next;
    });

  return (
    <>
      <h3>一致した組 {matched.length} 件</h3>
      {matched.length === 0 ? (
        <p className="sub">日付と金額が一致した組はありません。</p>
      ) : (
        <>
          <div className="tcf-bulk">
            <label className="tcf-pick-all">
              <input
                type="checkbox"
                checked={allPicked}
                onChange={() => setPicked(allPicked ? new Set() : new Set(matched.map((m) => m.freeeKey)))}
              />
              すべて選ぶ
            </label>
            <span className="tcf-bulk-count">{selected.length} 件を選択中</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="外す理由"
              aria-label="選択したものを外す理由"
            />
            <button
              type="button"
              className="btn primary"
              disabled={excludeMany.isPending || selected.length === 0 || reason.trim().length === 0}
              onClick={() => excludeMany.mutate({ freeeKeys: selected, reason: reason.trim() })}
            >
              選択したものを二重登録として外す
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
          <DataTable className="data stack-sm" columns={MATCHED_COLUMNS}>
            {matched.map((m) => {
              const checked = picked.has(m.freeeKey);
              return (
                <tr key={m.freeeKey} className={checked ? 'tcf-picked' : undefined}>
                  <td data-label="選択" className="tcf-pick">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.freeeKey)}
                      aria-label={`${m.freee.date} ${m.freee.partner} を選ぶ`}
                    />
                  </td>
                  <td data-label="発生日">
                    {m.mf.date}
                    {m.mf.date === m.freee.date ? null : <> / freee {m.freee.date}</>}
                  </td>
                  <td data-label="MF の内容">{m.mf.content}</td>
                  <td data-label="freee の取引先">{m.freee.partner || '(取引先なし)'}</td>
                  <td data-label="金額" className="num">
                    {signed(m.freee.io, m.freee.amount)}
                  </td>
                  <td data-label="口座 (MF / freee)">
                    {`${m.mf.institution || '(記載なし)'} / ${m.freee.settleAccount || '(記載なし)'}`}
                  </td>
                  <td data-label="分類 / 勘定科目">
                    {`${[m.mf.major, m.mf.middle].filter(Boolean).join(' / ') || '(未分類)'} / ${m.freee.account}`}
                  </td>
                  {/* 自動と判断を見分けられるようにする。数が合わないとき、どちらを疑うかが変わる */}
                  <td data-label="決め方">{m.by === 'auto' ? '自動 (日付と金額が一致)' : 'あなたの判断'}</td>
                  <td data-label="操作">
                    <ExcludeControl
                      freeeKey={m.freeeKey}
                      label={`${m.freee.date} ${m.freee.partner}`}
                      defaultReason={matchReason(m.by)}
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </>
      )}
    </>
  );
}

/**
 * freee 全件がどこへ行ったかを、件数の内訳と中身で示す節。
 *
 * 「取り込んだ内容に抜け漏れはないか」に答えられるのは、freee の総数が
 * 一致 + 相手なし + 除外 に必ず割れる形だけである。一致した組を画面に出さないと、
 * 寄った件数が正しいかを利用者が確かめる手立てが無い。
 */
function FreeeCoverageSection({
  coverage,
  matched,
  freeeOnly,
  excluded,
}: {
  coverage: FreeeCoverage;
  matched: readonly ReconcileMatch[];
  freeeOnly: readonly ReconcileFreee[];
  excluded: readonly ReconcileExcluded[];
}) {
  return (
    <section className="card scroll-x" aria-label="freee 取引の行き先">
      <h2>取り込んだ freee {coverage.freeeTotal} 件の行き先</h2>
      <p className="sub">
        一致 {coverage.matched} 件 ＋ MF に相手なし {coverage.freeeOnly} 件 ＋ 二重登録として外した{' '}
        {coverage.excluded} 件 ＝ {coverage.freeeTotal} 件。この 3 つで freee の全件が説明されます（MF
        側の要確認 {coverage.mfReview} 件は MF 明細ごとに立つので、この和には入りません）。
      </p>

      <MatchedTable matched={matched} />

      <h3>MF に相手がいない freee {freeeOnly.length} 件</h3>
      {freeeOnly.length === 0 ? (
        <p className="sub">MF に相手のいない freee 取引はありません。</p>
      ) : (
        <DataTable className="data stack-sm" columns={FREEE_ONLY_COLUMNS}>
          {freeeOnly.map((d) => (
            <tr key={d.freeeKey}>
              <td data-label="発生日">{d.date}</td>
              <td data-label="取引先">{d.partner || '(取引先なし)'}</td>
              <td data-label="向き">{ioLabel(d.io)}</td>
              <td data-label="金額" className="num">
                {signed(d.io, d.amount)}
              </td>
              <td data-label="決済口座">{d.settleAccount || '(記載なし)'}</td>
              <td data-label="勘定科目">{d.account}</td>
              <td data-label="操作">
                <ExcludeControl freeeKey={d.freeeKey} label={`${d.date} ${d.partner}`} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <h3>二重登録として外した {excluded.length} 件</h3>
      {excluded.length === 0 ? (
        <p className="sub">総額から外した freee 取引はありません。</p>
      ) : (
        <DataTable className="data stack-sm" columns={EXCLUDED_COLUMNS}>
          {excluded.map((d) => (
            <tr key={d.freeeKey}>
              <td data-label="発生日">{d.date}</td>
              <td data-label="取引先">{d.partner || '(取引先なし)'}</td>
              <td data-label="金額" className="num">
                {signed(d.io, d.amount)}
              </td>
              <td data-label="外した理由">{d.reason}</td>
              <td data-label="操作">
                <RestoreButton freeeKey={d.freeeKey} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
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
  /**
   * 明細ごとに「どの freee 候補と組むか」。同じ日・同じ額の候補が複数あるとき、
   * 名指ししないと機械が近い順に片方を選ぶ。選んだ相手と実際に寄る相手をずらさないために持つ。
   */
  const [pickedFreee, setPickedFreee] = useState<Readonly<Record<string, string>>>({});

  const decide = useMutation({
    mutationFn: (input: { txIds: readonly string[]; verdict: DuplicateVerdictValue }) => {
      // 「違う」に相手の名指しは意味を持たない。付けて送ると、後で「同じ」に変えたとき古い相手が復活する
      const keyOf = (txId: string) =>
        input.verdict === 'same' && pickedFreee[txId] ? { freeeKey: pickedFreee[txId] } : {};
      return api('/total-cashflow/verdicts', {
        method: 'POST',
        // 1 件のときは従来どおり単票で送る。まとめて送ると「その 1 件がなぜ保存できないか」が
        // 件ごとの理由の配列になり、その場で出すべき 404/409 の言葉が薄まる
        body: JSON.stringify(
          input.txIds.length === 1
            ? { txId: input.txIds[0], verdict: input.verdict, ...keyOf(input.txIds[0]!) }
            : {
                items: input.txIds.map((txId) => ({ txId, verdict: input.verdict, ...keyOf(txId) })),
              },
        ),
      });
    },
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

      <FreeeCoverageSection
        coverage={q.data.coverage}
        matched={q.data.matched}
        freeeOnly={q.data.freeeOnly}
        excluded={q.data.excluded}
      />

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
            {/* 候補の絞り込み条件そのものを書く。「金額は見比べなくてよい」と分かって初めて、
                日付と口座だけに目を向けられる */}
            <p className="sub">
              並んでいる freee 候補は<strong>金額と向きが MF と一致するもの</strong>だけです。
              残る違いは発生日と口座で、MF と食い違うところに <span className="tcf-differs-mark">≠</span>{' '}
              が付きます。印が 1 つも無い候補は日付も口座も一致しています。
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
                    {/* 候補が複数あるときだけ選べるようにする。1 件しかない組に選択肢を出しても、
                        押す操作が増えるだけで判断は変わらない */}
                    <td data-label="出所">
                      <Stack
                        lines={lines}
                        render={(line) =>
                          line.freeeKey && item.candidates.length > 1 ? (
                            <label className="tcf-pick-freee">
                              <input
                                type="radio"
                                name={`freee-${item.txId}`}
                                checked={pickedFreee[item.txId] === line.freeeKey}
                                onChange={() =>
                                  setPickedFreee((cur) => ({ ...cur, [item.txId]: line.freeeKey as string }))
                                }
                                aria-label={`${line.content} を組む相手にする`}
                              />
                              freee
                            </label>
                          ) : (
                            line.source
                          )
                        }
                      />
                    </td>
                    <td data-label="発生日">
                      <Stack lines={lines} field="date" render={(line) => line.date} />
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
                        field="account"
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
