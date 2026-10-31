/**
 * トータル収支: 事業と家計を合わせて、月ごとにいくら入っていくら出たか。
 *
 * 個人事業では事業と家計が同じ口座を通るため、割合は分かってもトータルの推移が読めない。
 * この画面は「トータル → 内訳」の順で並べ、まず総額の向きを見せる。
 *
 * 表の数値はサーバの導出値をそのまま写す。画面側で合計を組み直さないのは、
 * 表示と API が食い違ったときに、どちらが正しいかを利用者が判断できなくなるため。
 */
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChartOptions } from 'chart.js';
import { createContext, useContext, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { RECONCILIATION_QUERY_ROOT, invalidateAnalysisHub } from '../../analysis-query-invalidation.js';
import {
  ApiError,
  type DuplicateVerdictValue,
  EXCLUSION_MEMO_MAX,
  EXCLUSION_REASON_CODES,
  EXCLUSION_REASON_LABELS,
  type ExclusionReasonCode,
  type FreeeCoverage,
  type ReconcileExcluded,
  type ReconcileFreee,
  type TotalCashflowAutoMatch,
  type TotalCashflowMonth,
  type TotalCashflowOperation,
  type TotalCashflowResponse,
  type TotalCashflowReview,
  type TotalCashflowSeriesRow,
  type TotalCashflowWorkbenchView,
  api,
} from '../../api.js';
import { Button } from '../../components/Button.js';
import { DataTable } from '../../components/DataTable.js';
import { FinancialFigure } from '../../components/FinancialFigure.js';
import { KpiCard, PageState } from '../../components/Page.js';
import { REVIEW_QUEUE_KEY } from '../../components/ReviewQueue.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { UiIcon } from '../../components/UiIcon.js';
import { tooltipOptions } from '../../components/chart-tooltip.js';
import { COLORS, baseChartOptions, chartSeriesColor, yenTick } from '../../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from '../../components/figure-view-model.js';
import { deltaCls, gainCls, monthShort, pct, yen, yenS } from '../../format.js';
import { usePeriod } from '../../period.js';

/**
 * 重複の判断と freee の除外は、照合の件数と月次クローズのキューも同じ表から読む。
 * 総収支と要約だけを引き直すと、照合画面に戻ったとき古い件数が残る
 */
function refreshVerdictReaders(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['total-cashflow'] }),
    invalidateAnalysisHub(client),
    client.invalidateQueries({ queryKey: RECONCILIATION_QUERY_ROOT }),
    client.invalidateQueries({ queryKey: REVIEW_QUEUE_KEY }),
  ]);
}

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
            {/* 要確認はどの合計にも入っていない。金額を並べないと「保留中の額」が画面から消える */}
            <td data-label="要確認件数" className="num">
              {`${num(row.reviewCount)} 件 / ${num(row.reviewAmount)}`}
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

/** freee 側に候補が無いことも判断材料なので、行を消さず語で書く */
const NO_CANDIDATE = '同じ金額・同じ向きで前後 3 日以内の取引はありません';

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
/**
 * 直前に成功した操作の id を1か所へ集める口。
 *
 * 判定・除外・復元はこの画面の4か所から出るので、id を props で配り回すと
 * 経路を1本増やすたびに「取消が効かない場所」が生まれる。書き込みの成功を
 * 受け取る先を1つに固定すれば、取消の導線は常に最後の操作を指す。
 *
 * 既定が何もしない関数なのは、この画面の外 (テストや一覧のみの表示) で
 * 部品を単体で使えるようにするため。
 */
const OperationSink = createContext<(operationId: string | null) => void>(() => {});

/** 応答から操作 id だけを取り出す。無い応答 (0件の書き込み) は null */
const operationIdOf = (res: unknown): string | null => {
  const id = (res as { operationId?: unknown } | null)?.operationId;
  return typeof id === 'string' ? id : null;
};

/** 外した freee 取引を総額へ戻す */
function RestoreButton({ freeeKey }: { freeeKey: string }) {
  const client = useQueryClient();
  const sink = useContext(OperationSink);
  const run = useMutation({
    mutationFn: () =>
      api('/total-cashflow/freee-exclusions', {
        method: 'DELETE',
        body: JSON.stringify({ freeeKey }),
      }),
    onSuccess: (res) => {
      sink(operationIdOf(res));
      return refreshVerdictReaders(client);
    },
  });
  return (
    <Button size="mini" disabled={run.isPending} onClick={() => run.mutate()}>
      総額へ戻す
    </Button>
  );
}

/**
 * 操作列を持たない。この一覧は「一致でも除外でもない残り」を全部映す枠であって、
 * 二重登録の疑いを集めた枠ではない。行ごとに外す操作を置くと、
 * 「ここに並ぶ＝重複かもしれない」と読ませてしまう。
 */
const FREEE_ONLY_COLUMNS = ['発生日', '取引先', '向き', '金額', '決済口座', '勘定科目'];

/**
 * 1 リクエストで外せる件数。API 側の MAX_EXCLUSION_ITEMS と同じ値で、超える分だけ文を分ける。
 * 「すべて選ぶ」が数百件になる月でも、選んだ件数で成否が変わらないようにする。
 */
const MAX_EXCLUDE_PER_REQUEST = 200;

/**
 * freee 全件の保存則だけを確認する小さな検算欄。
 *
 * 自動一致と除外の明細は、それぞれ専用の作業区画にある。ここへ同じ行を再掲すると
 * 「どちらが操作の入口か」が二重になるため、件数の恒等式と未突合の残りだけに絞る。
 */
function FreeeCoverageDetails({
  coverage,
  freeeOnly,
}: {
  coverage: FreeeCoverage;
  freeeOnly: readonly ReconcileFreee[];
}) {
  return (
    <details className="card">
      <summary>freee取引の検算を表示</summary>
      <p className="sub">
        一致 {coverage.matched} 件 ＋ 残り {coverage.freeeOnly} 件 ＋ 除外 {coverage.excluded} 件 ＝ 取込{' '}
        {coverage.freeeTotal} 件
      </p>
      <p className="sub">MF 側の要確認 {coverage.mfReview} 件は、この和には含みません。</p>
      {freeeOnly.length > 0 && (
        <>
          <h3>一致にも除外にも入らない freee {freeeOnly.length} 件</h3>
          <DataTable className="data stack-sm" columns={FREEE_ONLY_COLUMNS}>
            {freeeOnly.map((item) => (
              <tr key={item.freeeKey}>
                <td data-label="発生日">{item.date}</td>
                <td data-label="取引先">{item.partner || '(取引先なし)'}</td>
                <td data-label="向き">{ioLabel(item.io)}</td>
                <td data-label="金額" className="num">
                  {signed(item.io, item.amount)}
                </td>
                <td data-label="決済口座">{item.settleAccount || '(記載なし)'}</td>
                <td data-label="勘定科目">{item.account}</td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </details>
  );
}

/* ==================================================================
 * 0041: 期間サマリ・月次推移・判定作業・自動一致・取消
 *
 * 画像 design/FINAL-UI/images/05-total-cashflow.png の構成を、既存の9列月次表の
 * 「上」に足す (AD-007)。既存表を置き換えないのは、あの表が唯一「事業費 + 家計費 =
 * 総支出」を1行の中で見せている場所だからで、上の要約はその関係を持たない。
 * ================================================================== */

/** 画面に出す区分。総合は事業と家計の和で、3つを足し引きしても総額は動かない (BR-004) */
type Segment = 'total' | 'biz' | 'household';

const SEGMENTS: readonly { key: Segment; label: string }[] = [
  { key: 'total', label: '総合' },
  { key: 'biz', label: '事業' },
  { key: 'household', label: '家計' },
];

/**
 * 表示する区分の切替。
 *
 * ネイティブの radio を使うのは、矢印キーでの移動を自前で書かないため。
 * role="tab" を手で組むと、左右キー・Home/End・focus の輪をすべて自分で保つことになる。
 */
function SegmentSwitch({ value, onChange }: { value: Segment; onChange: (next: Segment) => void }) {
  return (
    <fieldset className="scope-switch">
      <legend>表示する区分</legend>
      {SEGMENTS.map((seg) => (
        <label key={seg.key}>
          <input
            type="radio"
            name="total-cashflow-segment"
            value={seg.key}
            checked={value === seg.key}
            onChange={() => onChange(seg.key)}
          />
          {seg.label}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * 期間の総収入・総支出・純収支と、前年同期比 (BR-006)。
 *
 * 比較の相手は「前期」ではなく前年同期に固定する。事業と家計はどちらも季節で動くので、
 * 直前の期間と比べると、増えたのが商売の変化なのか毎年の波なのかを切り分けられない。
 */
/**
 * 'YYYY-MM' を1年前へずらす。前年同期の見出しにだけ使う。
 *
 * 月をまたいだ計算をしないので日付ライブラリを入れない。年の4桁を引くだけなら、
 * 閏日も月末も関係しない。
 */
const shiftYearLabel = (month: string): string =>
  `${String(Number(month.slice(0, 4)) - 1).padStart(4, '0')}-${month.slice(5, 7)}`;

function SummarySection({
  summary,
  segment,
  onSegment,
  periodLabel,
  previousLabel,
}: {
  summary: NonNullable<TotalCashflowResponse['summary']>;
  segment: Segment;
  onSegment: (next: Segment) => void;
  periodLabel: string;
  previousLabel: string | null;
}) {
  const current = summary[segment];

  const comparison = (key: 'income' | 'expense' | 'balance') => {
    if (!current.change || !current.previousYear) {
      return <span className="kpi-comparison is-missing">前年同期のデータがそろっていません</span>;
    }
    const change = current.change[key];
    // 支出は増えると悪い、収入と純収支は増えると良い。色の向きだけを逆にする
    const cls = key === 'expense' ? deltaCls(change.diff) : gainCls(change.diff);
    return (
      <span className="kpi-comparison">
        <span className={`kpi-delta ${cls}`}>
          <UiIcon name={change.diff >= 0 ? 'up' : 'down'} className="delta-icon" />
          <span className="num">{yenS(change.diff)}</span>
          {/* 前年が 0 だと率は出せない。0% と書くと「変わらなかった」と読めてしまう */}
          <span className="num">({change.rate == null ? '率は出せません' : pct(change.rate)})</span>
        </span>
        <span className="kpi-previous">前年同期 {yenS(current.previousYear[key])}</span>
      </span>
    );
  };

  return (
    <section className="card tcf-summary" aria-label="期間の収支">
      <div className="tcf-summary-head">
        <SegmentSwitch value={segment} onChange={onSegment} />
        <p className="sub tcf-summary-period">
          選択中の期間: {periodLabel}
          {previousLabel ? ` / 前年同期: ${previousLabel} との比較` : ''}
        </p>
      </div>
      <div className="kpis">
        <KpiCard label="総収入" value={yen(current.income)} note={comparison('income')} />
        <KpiCard label="総支出" value={yen(current.expense)} note={comparison('expense')} />
        <KpiCard label="純収支" value={yenS(current.balance)} note={comparison('balance')} />
      </div>
    </section>
  );
}

/** 収入・支出の棒と純収支の線を重ねる図の共通設定。金額軸は既存の財務図と同じ刻みを使う */
const seriesChartOptions = (): ChartOptions<'bar' | 'line'> => ({
  ...baseChartOptions(),
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { callback: yenTick } },
  },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 9, boxHeight: 9, padding: 16 },
    },
    tooltip: tooltipOptions('yen'),
  },
});

/**
 * 月次の収入・支出・純収支の推移。
 *
 * 収入と支出を棒、純収支を線にする。3本とも棒にすると、純収支が収入・支出と同じ種類の量に
 * 見えてしまう。純収支は他の2本の差であって、並べて比べる対象ではない。
 */
function SeriesFigure({ series, segment }: { series: readonly TotalCashflowSeriesRow[]; segment: Segment }) {
  if (!series.length) return null;
  const labels = series.map((row) => monthShort(row.month));
  const rows = series.map((row) => row[segment]);
  const last = rows[rows.length - 1];
  const segmentLabel = SEGMENTS.find((s) => s.key === segment)?.label ?? '総合';

  const model = createFinancialFigureModel({
    id: `total-cashflow-series-${segment}`,
    title: '月次の収入・支出・純収支の推移',
    summary: `${segmentLabel}の${labels[labels.length - 1] ?? ''}は純収支${yenS(last?.balance)}です。`,
    period: financialPeriod(labels),
    labels,
    series: [
      { key: 'income', label: '収入', values: rows.map((r) => r.income), unit: 'yen', color: COLORS.income },
      {
        key: 'expense',
        label: '支出',
        values: rows.map((r) => r.expense),
        unit: 'yen',
        color: COLORS.expense,
      },
      {
        key: 'balance',
        label: '純収支',
        values: rows.map((r) => r.balance),
        unit: 'yen',
        signed: true,
        color: COLORS.ink,
      },
    ],
    action: '純収支がマイナスへ振れた月を見つけ、その月の明細へ進みます。',
  });

  return (
    <FinancialFigure
      model={model}
      afterChart={
        <p className="chart-guide">
          棒は月ごとの収入と支出、線はその差の純収支です。線が 0 を下回った月は、貯えを取り崩しています。
        </p>
      }
    >
      <Chart
        type="bar"
        role="img"
        aria-label={`${segmentLabel}の月次の収入・支出・純収支を比べる図`}
        fallbackContent={`${segmentLabel}の月次の収入・支出・純収支を比べる図`}
        data={{
          labels: figureLabels(model),
          datasets: [
            {
              type: 'bar' as const,
              label: '収入',
              data: seriesData(model, 0),
              backgroundColor: chartSeriesColor('income'),
              borderRadius: 3,
              order: 2,
            },
            {
              type: 'bar' as const,
              label: '支出',
              data: seriesData(model, 1),
              backgroundColor: chartSeriesColor('expense'),
              borderRadius: 3,
              order: 2,
            },
            {
              type: 'line' as const,
              label: '純収支',
              data: seriesData(model, 2),
              borderColor: COLORS.ink,
              backgroundColor: COLORS.ink,
              pointRadius: 2,
              borderWidth: 2,
              tension: 0.18,
              order: 1,
            },
          ],
        }}
        options={seriesChartOptions()}
      />
    </FinancialFigure>
  );
}

/**
 * 判定・除外・取消の入口をひとまとめにして渡す。
 *
 * 表・詳細ペイン・下部バーの3か所から同じ操作が出るので、各所で mutation を作り直さない。
 * 作り直すと「どこから押したか」で無効化するキャッシュが変わりうる。
 */
interface WorkbenchActions {
  decide: (txIds: readonly string[], verdict: DuplicateVerdictValue, freeeKey?: string) => void;
  exclude: (
    freeeKeys: readonly string[],
    reason: string,
    reasonCode?: ExclusionReasonCode,
    memo?: string,
  ) => void;
  pending: boolean;
}

/**
 * 「直前の操作を元に戻す」(BR-008)。
 *
 * 出すのは、この画面でいま操作した直後だけ。再読込した後に出さないのは decision-017 による。
 * 読み込んだだけの画面に取消が出ていると、押した人は「自分が今やったこと」が戻ると読むが、
 * 実際に戻るのは前回いつか行った操作で、金額が動く向きが予想と食い違う。
 */
function UndoControl({
  operationId,
  onUndone,
  onGone,
}: {
  operationId: string | null;
  onUndone: () => void;
  onGone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () =>
      api(`/total-cashflow/operations/${encodeURIComponent(operationId ?? '')}/undo`, {
        method: 'POST',
      }),
    onSuccess: () => {
      setError(null);
      onUndone();
    },
    onError: (err) => {
      /*
       * 失敗の種類で、選択を残すかどうかを変える (U-001)。
       *
       * canonical_write_busy は「同じ操作をもう一度送れば通る」種類なので、取消の対象を
       * 保ったまま再試行できるようにする。それ以外の 409 と 404 は対象そのものが
       * もう最新でないので、対象を消して再読込へ誘導する。どちらも 409 だからと
       * 同じ扱いにすると、直せば通る失敗の後に押す先が消える。
       */
      const busy = err instanceof ApiError && err.code === 'canonical_write_busy';
      if (busy) {
        setError('別の更新と重なりました。もう一度お試しください');
        return;
      }
      setError('別の画面で新しい操作があったため取り消せません。画面を再読込してください');
      onGone();
    },
  });

  // 失敗の文言は、取消の対象が消えた後も残す。`!operationId` だけで畳むと、
  // 対象が最新でなくなったときにボタンと一緒に理由まで消え、
  // 利用者は「押したのに何も起きなかった」としか読めなくなる
  if (!operationId && !error) return null;
  return (
    <div className="tcf-detail-last">
      {operationId && <h4>直前の操作</h4>}
      <p className="tcf-undo">
        {operationId && (
          <Button size="mini" disabled={run.isPending} onClick={() => run.mutate()}>
            元に戻す
          </Button>
        )}
        {error && <output className="tcf-undo-error">{error}</output>}
      </p>
    </div>
  );
}

/** 判定作業の3区分 (BR-002)。名前と説明は画像の左ペインに合わせる */
const WORKBENCH_TABS: readonly {
  key: keyof TotalCashflowWorkbenchView['progress'];
  label: string;
  help: string;
}[] = [
  {
    key: 'duplicates',
    label: '重複候補',
    help: '相手が1件に絞れていて、日付のずれだけが残っている組です。同じ取引かを選べば終わります。',
  },
  {
    key: 'excluded',
    label: 'freee除外',
    help: '二重登録として総額から外した freee の取引です。戻せば総額に再び入ります。',
  },
  {
    key: 'needsReview',
    label: '要確認',
    help: '相手が複数あるか、相手が見つからない明細です。どれと組むかを人が選ぶ必要があります。',
  },
];

/** 判定作業の表の列。選択欄と判定欄は並べ替えの対象にしない */
const WORKBENCH_COLUMNS = [
  { label: <span className="visually-hidden">選択</span>, sortable: false, className: 'tcf-pick' },
  '発生日',
  '内容',
  '金額',
  '対応候補',
  '一致度',
  { label: '判定', sortable: false },
];

/**
 * 一致度を数と帯の両方で出す。
 *
 * 帯だけだと「92% と 88% のどちらが上か」を目分量に頼ることになり、数だけだと
 * 一覧の中で高い行を探すのに全行を読む必要がある。`<progress>` を使うのは、
 * 読み上げと拡大が自前の div より確実に効くため。
 */
function ScoreBar({ score }: { score: number }) {
  return (
    <span className="tcf-score">
      <progress className="tcf-score-bar" max={100} value={score} aria-hidden="true" />
      <span className="num">{score}%</span>
    </span>
  );
}

/**
 * 選択中の明細の詳細。MF 側と freee 側を上下に並べ、一致度と判定の入口を置く。
 *
 * 一覧の行の中に全部を詰めない。判断に要るのは日付・内容・金額・口座の4つで、
 * それを一覧の1行に押し込むと、どの画面幅でも読めない列が出る。
 */
function DetailPane({
  item,
  actions,
  onClose,
  undoableId,
  onUndone,
  onGone,
}: {
  item: TotalCashflowReview;
  actions: WorkbenchActions;
  onClose: () => void;
  undoableId: string | null;
  onUndone: () => void;
  onGone: () => void;
}) {
  const [pickedKey, setPickedKey] = useState<string | null>(item.candidates[0]?.freeeKey ?? null);
  const candidate = item.candidates.find((c) => c.freeeKey === pickedKey) ?? item.candidates[0] ?? null;

  return (
    <aside className="card tcf-detail" aria-label="選択中の明細の詳細">
      <div className="tcf-detail-head">
        <h3>選択中の明細の詳細</h3>
        <Button size="mini" onClick={onClose}>
          閉じる
        </Button>
      </div>

      <dl className="tcf-detail-block">
        <dt>MoneyForward の明細</dt>
        <dd>
          <span>{item.mf.date}</span>
          <span>{item.mf.content}</span>
          <span className="num">{signed(item.mf.io, item.mf.amount)}</span>
          <span>{item.mf.institution}</span>
        </dd>
      </dl>

      {candidate ? (
        <>
          <dl className="tcf-detail-block">
            <dt>freee の明細（対応候補）</dt>
            <dd>
              <span>{candidate.date}</span>
              <span>{candidate.partner}</span>
              <span className="num">{num(candidate.amount)}</span>
              <span>{candidate.settleAccount || candidate.account}</span>
            </dd>
          </dl>
          {/* 候補が複数あるときだけ選ばせる。1件しかない組に選択肢を出しても判断は変わらない */}
          {item.candidates.length > 1 && (
            <fieldset className="tcf-detail-candidates">
              <legend>どの候補と組むか</legend>
              {item.candidates.map((cand) => (
                <label key={cand.freeeKey}>
                  <input
                    type="radio"
                    name={`detail-freee-${item.txId}`}
                    checked={pickedKey === cand.freeeKey}
                    onChange={() => setPickedKey(cand.freeeKey)}
                  />
                  {cand.date} {cand.partner} <ScoreBar score={cand.score} />
                </label>
              ))}
            </fieldset>
          )}
          <p className="tcf-detail-score">
            一致度 <ScoreBar score={candidate.score} />
          </p>
        </>
      ) : (
        <p className="sub">対応する freee の取引は見つかりませんでした。</p>
      )}

      <div className="tcf-detail-actions">
        <Button
          variant="primary"
          disabled={actions.pending || !candidate}
          onClick={() => actions.decide([item.txId], 'same', candidate?.freeeKey)}
        >
          同じ取引
        </Button>
        <Button disabled={actions.pending} onClick={() => actions.decide([item.txId], 'different')}>
          別の取引
        </Button>
        <Button
          disabled={actions.pending || !candidate}
          onClick={() =>
            candidate && actions.exclude([candidate.freeeKey], '二重登録のため集計から除外', 'duplicate')
          }
        >
          集計から除外
        </Button>
      </div>

      {/* 畳むかどうかは UndoControl だけが決める。ここでも同じ条件を書くと、
          取消に失敗して対象が消えた瞬間に外側が先に畳み、理由が読めなくなる */}
      <UndoControl operationId={undoableId} onUndone={onUndone} onGone={onGone} />
    </aside>
  );
}

/** 除外理由の選択肢。core の正本をそのまま並べ、画面で語を作らない */
const REASON_OPTIONS = EXCLUSION_REASON_CODES.map((code) => ({
  code,
  label: EXCLUSION_REASON_LABELS[code],
}));

/**
 * 外した freee 明細の一覧。理由を定型のバッジで出し、まとめて付け替えられるようにする。
 *
 * 自由文だけだと同じ意味の除外が「振替」「振り替え」「口座間移動」と散らばり、
 * 後から「振替の除外はいくつか」に答えられない (0041)。
 */
function ExcludedWorkbenchTable({
  excluded,
  actions,
}: { excluded: readonly ReconcileExcluded[]; actions: WorkbenchActions }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [code, setCode] = useState<ExclusionReasonCode>('transfer');
  const [memo, setMemo] = useState('');

  const keys = new Set(excluded.map((row) => row.freeeKey));
  const selected = [...picked].filter((k) => keys.has(k));
  const allPicked = excluded.length > 0 && selected.length === excluded.length;

  const toggle = (freeeKey: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(freeeKey)) next.add(freeeKey);
      return next;
    });

  if (!excluded.length) return <p className="sub">総額から外した freee の取引はありません。</p>;

  return (
    <>
      <div className="tcf-bulk">
        <SelectionCheckbox
          className="tcf-pick-all"
          label="すべて選択"
          checked={allPicked}
          onChange={() => setPicked(allPicked ? new Set() : new Set(excluded.map((r) => r.freeeKey)))}
        />
        <span className="tcf-bulk-count">{selected.length} 件を選択中</span>
        <label>
          一括で理由を設定
          <select value={code} onChange={(e) => setCode(e.target.value as ExclusionReasonCode)}>
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          value={memo}
          maxLength={EXCLUSION_MEMO_MAX}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="メモ（任意）"
          aria-label="まとめて付けるメモ"
        />
        <Button
          variant="primary"
          disabled={actions.pending || selected.length === 0}
          onClick={() => {
            actions.exclude(selected, EXCLUSION_REASON_LABELS[code], code, memo.trim() || undefined);
            setPicked(new Set());
            setMemo('');
          }}
        >
          適用
        </Button>
        <Button disabled={selected.length === 0} onClick={() => setPicked(new Set())}>
          選択をクリア
        </Button>
      </div>
      <DataTable
        className="data"
        columns={[
          { label: <span className="visually-hidden">選択</span>, sortable: false, className: 'tcf-pick' },
          '発生日',
          '内容',
          '金額',
          '理由',
          'メモ',
          { label: '操作', sortable: false },
        ]}
      >
        {excluded.map((row) => (
          <tr key={row.freeeKey}>
            <td data-label="選択" className="tcf-pick">
              <SelectionCheckbox
                labelHidden
                label=""
                aria-label={`${row.date} ${row.partner} を選ぶ`}
                checked={picked.has(row.freeeKey)}
                onChange={() => toggle(row.freeeKey)}
              />
            </td>
            <td data-label="発生日">{row.date}</td>
            <td data-label="内容">{row.partner}</td>
            <td data-label="金額" className="num">
              {signed(row.io, row.amount)}
            </td>
            <td data-label="理由">
              {/* 定型の理由が付いていない行 (0037 以前) はバッジを出さない。
                  出どころの違う分類を同じ見た目にすると、数えた件数の意味が変わる */}
              {row.reasonCode ? (
                <span className="pill neutral">{EXCLUSION_REASON_LABELS[row.reasonCode]}</span>
              ) : (
                <span className="sub">未分類</span>
              )}
            </td>
            <td data-label="メモ">{row.memo ?? row.reason}</td>
            <td data-label="操作">
              <RestoreButton freeeKey={row.freeeKey} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}

/**
 * 判定作業の3区分。区分ごとに件数と進捗を出す (BR-007)。
 *
 * 進捗を区分ごとに出すのは、全体の N/M だけだと「あと何をすれば終わるか」が読めないため。
 * 重複候補が全部済んでいても要確認が残っていれば、次に押す場所は要確認の側にある。
 */
function WorkbenchSection({
  workbench,
  actions,
  undoableId,
  onUndone,
  onGone,
}: {
  workbench: TotalCashflowWorkbenchView;
  actions: WorkbenchActions;
  undoableId: string | null;
  onUndone: () => void;
  onGone: () => void;
}) {
  const [tab, setTab] = useState<keyof TotalCashflowWorkbenchView['progress']>('duplicates');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'undecided'>('all');

  const rows: readonly TotalCashflowReview[] =
    tab === 'duplicates' ? workbench.duplicates : tab === 'needsReview' ? workbench.needsReview : [];
  const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP');
  // この作業台に入る時点で全行が未判定。状態フィルタは将来 API が判定済みを返しても
  // UI の契約を変えずに済むよう置き、現状は「すべて / 未判定」が同じ集合になる。
  const visibleRows = rows.filter((item) => {
    if (verdictFilter !== 'all' && verdictFilter !== 'undecided') return false;
    if (!normalizedQuery) return true;
    const searchable = [
      item.mf.date,
      item.mf.content,
      item.mf.memo,
      item.mf.institution,
      item.mf.amount,
      ...item.candidates.flatMap((candidate) => [
        candidate.date,
        candidate.partner,
        candidate.amount,
        candidate.settleAccount,
        candidate.account,
      ]),
    ]
      .filter((value) => value != null)
      .join(' ')
      .toLocaleLowerCase('ja-JP');
    return searchable.includes(normalizedQuery);
  });
  const ids = new Set(visibleRows.map((r) => r.txId));
  const selected = [...picked].filter((id) => ids.has(id));
  const selectedRows = visibleRows.filter((row) => picked.has(row.txId));
  const allVisiblePicked = visibleRows.length > 0 && selected.length === visibleRows.length;
  const canExcludeSelected =
    selectedRows.length > 0 && selectedRows.every((item) => item.candidates.length === 1);
  const progress = workbench.progress[tab];
  const active = detailOpen
    ? (visibleRows.find((r) => r.txId === selectedId) ?? visibleRows[0] ?? null)
    : null;

  const toggle = (txId: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(txId)) next.add(txId);
      return next;
    });

  const countOf = (key: keyof TotalCashflowWorkbenchView['progress']) =>
    key === 'excluded' ? workbench.excluded.length : workbench[key].length;

  return (
    <section className="card tcf-workbench" aria-label="重複・除外の判定作業">
      <h2>重複・除外の判定作業</h2>
      <div className="tcf-workbench-body">
        {/* 区分の切替はページ遷移ではなく同じ表の絞り込みなので tablist。
            共通 Button ではなく native button なのは、role=tab と aria-selected が
            「今どの区分を見ているか」を読み上げる唯一の手段だから */}
        <nav className="tcf-workbench-tabs" role="tablist" aria-label="判定作業の区分">
          {WORKBENCH_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              data-native-control="tab"
              role="tab"
              id={`tcf-tab-${item.key}`}
              aria-controls="tcf-workbench-panel"
              className={`tcf-workbench-tab${tab === item.key ? ' is-active' : ''}`}
              aria-selected={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setSelectedId(null);
                setDetailOpen(true);
                setPicked(new Set());
                setQuery('');
                setVerdictFilter('all');
              }}
            >
              <span className="tcf-workbench-tab-label">
                {item.label} {countOf(item.key)}
              </span>
              <span className="sub">{item.help}</span>
            </button>
          ))}
        </nav>

        <div
          className="tcf-workbench-main"
          role="tabpanel"
          id="tcf-workbench-panel"
          aria-labelledby={`tcf-tab-${tab}`}
        >
          {/* 進捗は「終わったか」ではなく「あと何件か」を出す。割合だけだと、
              残り1件と残り40件が同じ 98% に見える月がある */}
          <p className="tcf-progress">
            <progress max={progress.total} value={progress.decided} />
            <span>
              {progress.total} 件中 {progress.decided} 件の判定が完了しました
            </span>
          </p>

          {tab === 'excluded' ? (
            <ExcludedWorkbenchTable excluded={workbench.excluded} actions={actions} />
          ) : rows.length === 0 ? (
            <p className="sub">この区分に残っている作業はありません。</p>
          ) : (
            <>
              <div className="tcf-bulk" aria-label="判定候補の絞り込み">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="内容・金額を検索"
                  aria-label="取引内容・金額で検索"
                />
                <label>
                  判定
                  <select
                    value={verdictFilter}
                    onChange={(event) => setVerdictFilter(event.target.value as 'all' | 'undecided')}
                    aria-label="判定状態で絞り込む"
                  >
                    <option value="all">すべて</option>
                    <option value="undecided">未判定</option>
                  </select>
                </label>
                <SelectionCheckbox
                  className="tcf-pick-all"
                  label="表示中をすべて選択"
                  aria-label={`表示中の${visibleRows.length}件をすべて選択`}
                  checked={allVisiblePicked}
                  disabled={visibleRows.length === 0}
                  onChange={() =>
                    setPicked(allVisiblePicked ? new Set() : new Set(visibleRows.map((item) => item.txId)))
                  }
                />
              </div>
              {visibleRows.length === 0 ? (
                <p className="sub">検索条件に合う明細はありません。</p>
              ) : (
                <DataTable
                  // 狭幅では 1行=1カードへ畳む。判定作業は行ごとに「同じ取引/別の取引」を押す作業で、
                  // 最右の判定列が横スクロールの先にあると 1 件ごとに横へ送る操作が挟まる。
                  className="data stack-sm"
                  columns={WORKBENCH_COLUMNS}
                >
                  {visibleRows.map((item) => {
                    const best = item.candidates[0] ?? null;
                    return (
                      <tr
                        key={item.txId}
                        className={[
                          picked.has(item.txId) ? 'tcf-picked' : '',
                          active?.txId === item.txId ? 'is-selected' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <td data-label="選択" className="tcf-pick">
                          <SelectionCheckbox
                            labelHidden
                            label=""
                            aria-label={`${item.mf.date} ${item.mf.content} を選ぶ`}
                            checked={picked.has(item.txId)}
                            onChange={() => toggle(item.txId)}
                          />
                        </td>
                        <td data-label="発生日">
                          <button
                            type="button"
                            data-native-control="disclosure"
                            className="tcf-row-open"
                            aria-expanded={active?.txId === item.txId}
                            onClick={() => {
                              setSelectedId(item.txId);
                              setDetailOpen(true);
                            }}
                          >
                            {item.mf.date}
                          </button>
                        </td>
                        <td data-label="内容">{item.mf.content}</td>
                        <td data-label="金額" className="num">
                          {signed(item.mf.io, item.mf.amount)}
                        </td>
                        <td data-label="対応候補">{best ? `${best.date} ${best.partner}` : NO_CANDIDATE}</td>
                        <td data-label="一致度">{best ? <ScoreBar score={best.score} /> : '—'}</td>
                        <td data-label="判定" className="tcf-verdict">
                          <Button
                            size="mini"
                            disabled={actions.pending || !best}
                            onClick={() => actions.decide([item.txId], 'same', best?.freeeKey)}
                          >
                            同じ取引
                          </Button>
                          <Button
                            size="mini"
                            disabled={actions.pending}
                            onClick={() => actions.decide([item.txId], 'different')}
                          >
                            別の取引
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}
            </>
          )}
        </div>

        {active && (
          <DetailPane
            key={active.txId}
            item={active}
            actions={actions}
            onClose={() => setDetailOpen(false)}
            undoableId={undoableId}
            onUndone={onUndone}
            onGone={onGone}
          />
        )}
      </div>

      {/* 選んだ件数と、その件数に対して押せる操作を画面の下に固定する。
          表を下までたどった位置で操作できないと、選び直しのたびに上へ戻ることになる */}
      {selected.length > 0 && (
        <section className="tcf-selection-bar" aria-label="選択中の操作">
          <span>{selected.length} 件選択中</span>
          <Button onClick={() => setPicked(new Set())}>選択をクリア</Button>
          <Button
            variant="primary"
            disabled={actions.pending}
            onClick={() => {
              actions.decide(selected, 'same');
              setPicked(new Set());
            }}
          >
            同じ取引にする
          </Button>
          <Button
            disabled={actions.pending}
            onClick={() => {
              actions.decide(selected, 'different');
              setPicked(new Set());
            }}
          >
            別の取引にする
          </Button>
          <Button
            disabled={actions.pending || !canExcludeSelected}
            onClick={() => {
              if (!canExcludeSelected) return;
              actions.exclude(
                selectedRows.map((item) => item.candidates[0]!.freeeKey),
                '二重登録のため集計から除外',
                'duplicate',
              );
              setPicked(new Set());
            }}
          >
            集計から除外
          </Button>
        </section>
      )}
    </section>
  );
}

/**
 * 日付と金額が一致して自動で寄った組 (BR-003)。
 *
 * 一致度は 78〜100 をそのまま出し、100 に丸めない。全部 100% と書くと、
 * 口座名まで一致した組と日付だけ一致した組の差が画面から消える。
 */
function AutoMatchSection({
  autoMatches,
  actions,
}: { autoMatches: readonly TotalCashflowAutoMatch[]; actions: WorkbenchActions }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [undecidedOnly, setUndecidedOnly] = useState(true);

  const rows = undecidedOnly ? autoMatches.filter((m) => m.verdict == null) : autoMatches;
  const ids = new Set(rows.map((r) => r.txId));
  const selected = [...picked].filter((id) => ids.has(id));

  if (!autoMatches.length) return null;

  return (
    <section className="card scroll-x" aria-label="自動一致の候補">
      <h2>自動一致の候補 {autoMatches.length} 件</h2>
      <p className="sub">
        日付と金額が一致したため機械が組にした分です。総額にはすでに反映されており、ここでの判定は
        「その組が正しいか」の記録になります。
      </p>
      <div className="tcf-bulk">
        <SelectionCheckbox
          className="tcf-pick-all"
          label="未判定だけを表示"
          checked={undecidedOnly}
          onChange={() => setUndecidedOnly((cur) => !cur)}
        />
        <span className="tcf-bulk-count">{selected.length} 件を選択中</span>
        <Button
          variant="primary"
          disabled={actions.pending || selected.length === 0}
          onClick={() => {
            actions.decide(selected, 'same');
            setPicked(new Set());
          }}
        >
          選択した取引を同じ取引にする
        </Button>
      </div>
      <DataTable
        className="data"
        columns={[
          { label: <span className="visually-hidden">選択</span>, sortable: false, className: 'tcf-pick' },
          '発生日',
          '内容',
          '金額',
          '対応候補',
          '一致度',
          '判定',
        ]}
      >
        {rows.map((row) => (
          <tr key={`${row.txId}:${row.freeeKey}`}>
            <td data-label="選択" className="tcf-pick">
              <SelectionCheckbox
                labelHidden
                label=""
                aria-label={`${row.mf.date} ${row.mf.content} を選ぶ`}
                checked={picked.has(row.txId)}
                onChange={() =>
                  setPicked((cur) => {
                    const next = new Set(cur);
                    if (!next.delete(row.txId)) next.add(row.txId);
                    return next;
                  })
                }
              />
            </td>
            <td data-label="発生日">{row.mf.date}</td>
            <td data-label="内容">{row.mf.content}</td>
            <td data-label="金額" className="num">
              {signed(row.mf.io, row.mf.amount)}
            </td>
            <td data-label="対応候補">
              {row.freee.date} {row.freee.partner}
            </td>
            <td data-label="一致度">
              <ScoreBar score={row.score} />
            </td>
            <td data-label="判定">
              {row.verdict === 'same' ? '同じ取引' : row.verdict === 'different' ? '別の取引' : '未判定'}
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}

export function TotalCashflowPage() {
  const { key, withPeriod } = usePeriod();
  // このページは既存の単体テストや埋込先でも Router なしで使う。画面遷移時には
  // route 要素が mount し直されるため、遷移元の月だけを location から読む。
  const requestedMonth =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('month');
  const linkedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth ?? '') ? requestedMonth : null;
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ['total-cashflow', key, linkedMonth],
    queryFn: () =>
      api<TotalCashflowResponse>(
        linkedMonth
          ? `/total-cashflow?from=${encodeURIComponent(linkedMonth)}&to=${encodeURIComponent(linkedMonth)}`
          : withPeriod('/total-cashflow'),
      ),
  });
  /** 表示する区分 (総合 / 事業 / 家計)。保存せず画面ごとに持つ */
  const [segment, setSegment] = useState<Segment>('total');
  /**
   * いま取り消せる操作の id。
   *
   * 応答から受け取った分だけを持ち、再読込では復元しない。サーバの `lastOperation` を
   * そのまま入れると、画面を開いただけで前回いつかの操作に「元に戻す」が付く (U-005)。
   */
  const [undoableId, setUndoableId] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: (input: {
      txIds: readonly string[];
      verdict: DuplicateVerdictValue;
      freeeKey?: string;
    }) => {
      // 「違う」に相手の名指しは意味を持たない。付けて送ると、後で「同じ」に変えたとき古い相手が復活する
      const keyOf = (_txId: string) => {
        if (input.verdict !== 'same') return {};
        const freeeKey = input.freeeKey;
        return freeeKey ? { freeeKey } : {};
      };
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
    onSuccess: (res) => {
      setUndoableId(operationIdOf(res));
      return refreshVerdictReaders(client);
    },
  });

  /**
   * 判定作業から外す入口。件数の上限は API と同じ値で割る。
   *
   * 最後の 1 回の id だけを取消の対象にするのは、分けて送った塊が別々の操作行になるため。
   * 途中の id を指すと、押した人が選んだ範囲の一部だけが戻る。
   */
  const excludeMany = useMutation({
    mutationFn: async (input: {
      freeeKeys: readonly string[];
      reason: string;
      reasonCode?: ExclusionReasonCode;
      memo?: string;
    }) => {
      let last: unknown = null;
      for (let at = 0; at < input.freeeKeys.length; at += MAX_EXCLUDE_PER_REQUEST) {
        last = await api('/total-cashflow/freee-exclusions', {
          method: 'POST',
          body: JSON.stringify({
            freeeKeys: input.freeeKeys.slice(at, at + MAX_EXCLUDE_PER_REQUEST),
            reason: input.reason,
            reasonCode: input.reasonCode,
            memo: input.memo,
          }),
        });
      }
      return last;
    },
    onSuccess: (res) => {
      setUndoableId(operationIdOf(res));
      return Promise.all([
        client.invalidateQueries({ queryKey: ['total-cashflow'] }),
        invalidateAnalysisHub(client),
      ]);
    },
  });

  const actions: WorkbenchActions = {
    decide: (txIds, verdict, freeeKey) => decide.mutate({ txIds, verdict, freeeKey }),
    exclude: (freeeKeys, reason, reasonCode, memo) =>
      excludeMany.mutate({ freeeKeys, reason, reasonCode, memo }),
    pending: decide.isPending || excludeMany.isPending,
  };

  if (q.isLoading) return <PageState status="loading" />;
  if (q.error) return <PageState status="error" error={q.error} />;
  if (!q.data) return <PageState status="empty" />;

  /**
   * 前年同期の見出し。適用中の期間を12か月ずらして作る (BR-006)。
   *
   * サーバが返した期間から作るので、画面の期間選択と表示がずれない。
   * 別々に作ると、期間を変えた直後の1描画だけ古い年が残る。
   */
  const applied = q.data.period.applied;
  const previousLabel = applied ? `${shiftYearLabel(applied.from)} 〜 ${shiftYearLabel(applied.to)}` : null;

  return (
    <OperationSink.Provider value={setUndoableId}>
      {linkedMonth && (
        <output className="sub total-cashflow-linked-month">
          推移画面で選んだ {linkedMonth} の総収支を表示しています。
        </output>
      )}
      {q.data.summary && (
        <SummarySection
          summary={q.data.summary}
          segment={segment}
          onSegment={setSegment}
          periodLabel={q.data.period.label}
          previousLabel={previousLabel}
        />
      )}

      {q.data.series.length > 0 && <SeriesFigure series={q.data.series} segment={segment} />}

      {q.data.workbench && (
        <WorkbenchSection
          workbench={q.data.workbench}
          actions={actions}
          undoableId={undoableId}
          onUndone={() => {
            // 取消が通ったら対象を消す。同じ id をもう一度送っても 1 回分しか戻らないが、
            // 押せる見た目を残すと「効かないボタン」を押させることになる
            setUndoableId(null);
            void Promise.all([
              client.invalidateQueries({ queryKey: ['total-cashflow'] }),
              invalidateAnalysisHub(client),
            ]);
          }}
          onGone={() => setUndoableId(null)}
        />
      )}

      <AutoMatchSection autoMatches={q.data.autoMatches} actions={actions} />

      <details className="card">
        <summary>月次の内訳を表示</summary>
        <TotalCashflowTable rows={q.data.months} />
      </details>

      <FreeeCoverageDetails coverage={q.data.coverage} freeeOnly={q.data.freeeOnly} />
    </OperationSink.Provider>
  );
}
