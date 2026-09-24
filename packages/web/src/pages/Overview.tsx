/**
 * P1 概況: 「今月の収支と、次に直すことは？」に上から順に答える 4 層。
 *
 * 1 層: 問い・月次クローズ・範囲切替・KPI 3 枚と純収支の説明 (結論)
 * 2 層: 推移 (結論の時間的な裏付け)
 * 3 層: 未処理の内訳・優先明細・選択中の明細 (次に直すこと)
 * 4 層: 前年比較・支出内訳・詳細・固定アクションバー
 * 詳しく見る (未決済・科目別年比較) は初期は閉じ、開くまで取得もしない。
 *
 * 画面は OverviewResponse と ReviewQueueResponse を描くだけで再集計しない。
 * KPI と図の合計が別々の計算になると、同じ期間の数字が画面の中で食い違うため。
 */
import {
  type ConfidenceTier,
  OVERVIEW_SCOPES,
  type OverviewScope,
  confidenceTier,
  confidenceTierText,
  movingAvg,
} from '@kanjo/core';
import { useQuery } from '@tanstack/react-query';
import { Chart as ChartJS } from 'chart.js';
import { useState } from 'react';
import { Chart } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { type OverviewResponse, type ReviewQueueItem, type SummaryResponse, api } from '../api.js';
import { Button } from '../components/Button.js';
import { DataTable } from '../components/DataTable.js';
import { FinancialFigure } from '../components/FinancialFigure.js';
import {
  ReviewActionBar,
  ReviewDetailPanel,
  SnoozedReviewList,
  useWideReviewLayout,
} from '../components/OverviewReviewQueue.js';
import { AnnualComparisonTable, KpiCard, PageHeader, PageState, describeError } from '../components/Page.js';
import {
  REVIEW_KIND_LABEL,
  REVIEW_KIND_ORDER,
  REVIEW_KIND_PATH,
  reviewTotalText,
  useReviewQueue,
} from '../components/ReviewQueue.js';
import { Term } from '../components/Term.js';
import { UiIcon } from '../components/UiIcon.js';
import { UnsettledPanel } from '../components/Unsettled.js';
import { COLORS, baseChartOptions, yenTick } from '../components/charts.js';
import {
  createFinancialFigureModel,
  figureLabels,
  financialPeriod,
  seriesData,
} from '../components/figure-view-model.js';
import {
  REVIEW_KIND_ICON,
  REVIEW_KIND_STATUS_LABEL,
  REVIEW_KIND_TONE,
} from '../components/review-presentation.js';
import { dateTime, deltaCls, gainCls, monthLabel, monthShort, pct, ratio, yen, yenS } from '../format.js';
import { usePeriod } from '../period.js';

void ChartJS; // 登録の副作用のためimport維持

const SCOPE_LABEL: Record<OverviewScope, string> = { total: '総合', business: '事業', household: '家計' };

/** 増減と純収支は、正値にも符号を付けて色を見なくても方向が分かるようにする。 */
const signedYen = (value: number | null | undefined): string =>
  value == null ? '—' : value > 0 ? `+${yen(value)}` : yenS(value);

/** 優先明細の表に並べる上限。残りは各画面で見る (件数はカードとバーが全件を伝える) */
const PRIORITY_ROW_LIMIT = 8;

type Forecast = OverviewResponse['defenseForecast'];

/**
 * FR-08 防衛ライン割れの事前警告。caution/warn のときだけ KPI の上に出す。
 * どちらも role=alert で読み上げる (spec FR-006)。強さの違いは見出しの文言と色で伝える。
 * 判定より「なぜそう判定したか」を読ませたいので、内訳を必ず併記する。
 */
function DefenseForecastPanel({ forecast }: { forecast: Forecast }) {
  if (forecast.level !== 'caution' && forecast.level !== 'warn') return null;
  const warn = forecast.level === 'warn';
  const breached = forecast.history.filter((h) => h.breached);
  return (
    <div className={`notice${warn ? ' danger' : ''}`} role="alert">
      <strong>
        {warn ? '防衛ライン割れの事前警告' : '防衛ラインの見通しに注意'}
        {forecast.nextMonth ? `(${monthShort(forecast.nextMonth)}の見込み)` : ''}
      </strong>
      <p className="notice-line">{forecast.reason}</p>
      <p className="notice-line">
        内訳: 給与 <span className="num">{yen(forecast.nextSalary)}</span>(直近3ヶ月の中央値) + 事業入金{' '}
        <span className="num">{yen(forecast.nextBizIncome)}</span>(直近3ヶ月の平均) ={' '}
        <span className="num">{yen(forecast.nextEstimate)}</span> / <Term id="defenseLine" />{' '}
        <span className="num">{yen(forecast.line)}</span>
      </p>
      {breached.length > 0 && (
        <p className="notice-line">
          割れた月: {breached.map((h) => `${monthShort(h.month)}(${yenS(h.diff)})`).join('・')}
        </p>
      )}
      <Link className="btn" to="/tradeoff">
        やりくり試算で捻出元を探す
      </Link>
    </div>
  );
}

/** 問い直下に置く締めの結論。4ステップと記録操作はsidebarの進捗カードへ一本化する。 */
function OverviewLead({ data, updating }: { data: OverviewResponse | undefined; updating: boolean }) {
  const close = data?.closeStatus;
  return (
    <div className="overview-lead">
      {close && (
        <div className="overview-close">
          <p>
            <strong>
              月次クローズ {close.doneCount}/{close.total}
            </strong>
            {close.month ? `(${monthLabel(close.month)})` : ''} —{' '}
            {close.doneCount >= close.total ? '今月の締めは完了しています' : '確認が残っています'}
          </p>
        </div>
      )}
      {data && (
        <div className="overview-freshness sub">
          <p>
            <UiIcon name={updating ? 'refresh' : 'check'} className="status-icon" />
            {updating ? '表示を更新中… / ' : ''}データの最終更新{' '}
            <span className="num">{data.dataUpdatedAt ? dateTime(data.dataUpdatedAt) : '取込なし'}</span>
          </p>
          <Link to="/guide">データ出典と除外項目について</Link>
        </div>
      )}
    </div>
  );
}

/** APG radio group。矢印キーでの移動はネイティブの radio が担う */
function ScopeSwitch({
  value,
  onChange,
}: { value: OverviewScope; onChange: (scope: OverviewScope) => void }) {
  return (
    <fieldset className="scope-switch">
      <legend>表示する範囲</legend>
      {OVERVIEW_SCOPES.map((scope) => (
        <label key={scope}>
          <input
            type="radio"
            name="overview-scope"
            value={scope}
            checked={value === scope}
            onChange={() => onChange(scope)}
          />
          {SCOPE_LABEL[scope]}
        </label>
      ))}
    </fieldset>
  );
}

function KpiSection({ data }: { data: OverviewResponse }) {
  const rows = new Map(data.yearComparison.rows.map((row) => [row.key, row]));
  const note = (key: 'income' | 'expense' | 'balance') => {
    const row = rows.get(key);
    if (!row || row.previous == null || row.delta == null || !data.yearComparison.previousLabel) {
      return <span className="kpi-comparison is-missing">比較できる前期データがありません</span>;
    }
    // 支出は増えると悪い、収入と純収支は増えると良い。色の向きを逆にする
    const cls = key === 'expense' ? deltaCls(row.delta) : gainCls(row.delta);
    const direction = row.delta >= 0 ? 'up' : 'down';
    return (
      <span className="kpi-comparison">
        <span className={`kpi-delta ${cls}`}>
          <UiIcon name={direction} className="delta-icon" />
          <span className="num">{signedYen(row.delta)}</span>
          <span className="num">({pct(row.deltaRate)})</span>
        </span>
        <span className="kpi-previous">
          {data.yearComparison.previousLabel} {yenS(row.previous)}
        </span>
      </span>
    );
  };
  const label = (text: string) => (
    <span className="kpi-label">
      {text}
      <UiIcon name="info" className="kpi-info" />
    </span>
  );
  return (
    <section className="overview-kpi-strip" aria-label="収支の概要">
      <KpiCard label={label('総収入')} value={yen(data.kpi.income)} note={note('income')} />
      <KpiCard label={label('総支出')} value={yen(data.kpi.expense)} note={note('expense')} />
      <KpiCard label={label('純収支')} value={signedYen(data.kpi.balance)} note={note('balance')} />
      <div className="overview-net-help">
        <h2>純収支とは？</h2>
        <p>
          総収入から総支出を引いた残りです。{SCOPE_LABEL[data.scope]}の{data.period.label}
          について、プラスなら手元に残り、マイナスなら貯えを取り崩しています。
        </p>
      </div>
    </section>
  );
}

const REVIEW_SUMMARY_HEADING_ID = 'overview-review-summary';

const REVIEW_KIND_HELP: Record<ReviewQueueItem['kind'], string> = {
  classification: '取込済みの明細を仕分けします',
  reconciliation: '帳簿と実際の支出を照合します',
  import: '失敗した取込の理由を確認します',
};

/** 色は段階に従う (高 good・中 warning・低 danger)。境界の比較は core の confidenceTier だけが持つ */
const CONFIDENCE_TONE: Record<ConfidenceTier, string> = { high: 'good', medium: 'warning', low: 'danger' };
const confidenceClass = (confidence: number | null): string => {
  const tier = confidenceTier(confidence);
  return tier == null ? 'neutral' : CONFIDENCE_TONE[tier];
};

function ReviewStatusBadge({ kind }: { kind: ReviewQueueItem['kind'] }) {
  return (
    <span className={`review-row-status ${REVIEW_KIND_TONE[kind]}`}>
      <UiIcon name={REVIEW_KIND_ICON[kind]} />
      <span>{REVIEW_KIND_STATUS_LABEL[kind]}</span>
    </span>
  );
}

function ReviewSummaryCard({ queue }: { queue: ReturnType<typeof useReviewQueue> }) {
  return (
    <section className="card review-summary" aria-labelledby={REVIEW_SUMMARY_HEADING_ID}>
      {/* 後で確認の成功後のフォーカス先。行が消えても件数の変化をすぐ読める位置に置く */}
      <h2 id={REVIEW_SUMMARY_HEADING_ID} tabIndex={-1}>
        未処理の内訳
      </h2>
      {queue.isError ? (
        <div role="alert">
          <p>未処理の件数を読み込めませんでした。{describeError(queue.error)}</p>
          <Button size="mini" onClick={() => queue.refetch()}>
            もう一度読み込む
          </Button>
        </div>
      ) : !queue.data ? (
        <p className="sub">未処理の件数を確認中…</p>
      ) : (
        <>
          <p className="review-total">{reviewTotalText(queue.data.total)}</p>
          <ul className="review-kinds">
            {REVIEW_KIND_ORDER.map((kind) => (
              <li key={kind} className={`review-kind-${REVIEW_KIND_TONE[kind]}`}>
                <div className="review-kind-heading">
                  <UiIcon name={REVIEW_KIND_ICON[kind]} className="review-kind-icon" />
                  <Link className="btn linklike" to={REVIEW_KIND_PATH[kind]}>
                    {REVIEW_KIND_LABEL[kind]}
                  </Link>
                  <strong className="num">{queue.data.counts[kind]} 件</strong>
                </div>
                <p>{REVIEW_KIND_HELP[kind]}</p>
              </li>
            ))}
          </ul>
          {queue.data.snoozedItems ? (
            <SnoozedReviewList items={queue.data.snoozedItems} />
          ) : (
            queue.data.snoozedCount > 0 && (
              <p className="sub">後で確認にした明細: {queue.data.snoozedCount} 件</p>
            )
          )}
        </>
      )}
    </section>
  );
}

/**
 * 優先明細表。呼び出し元が API で解決済みの期間に絞り、ここは表示に専念する。
 * 未処理の総数は全期間のままなので、表の件数とは意図的に異なる (BR-002)。
 */
function PriorityTable({
  items,
  hasItemsOutsideRange,
  state,
  selected,
  onSelect,
}: {
  items: ReviewQueueItem[];
  hasItemsOutsideRange: boolean;
  state: 'loading' | 'error' | 'ready';
  selected: ReviewQueueItem | null;
  onSelect: (item: ReviewQueueItem) => void;
}) {
  if (state !== 'ready') {
    return (
      <section className="card review-priority" aria-labelledby="overview-priority-heading">
        <h2 id="overview-priority-heading">優先して確認する明細</h2>
        <p className="sub" role={state === 'loading' ? 'status' : undefined}>
          {state === 'loading'
            ? '優先明細を確認中…'
            : '未処理の明細を表示できません。左の「もう一度読み込む」から再試行できます。'}
        </p>
      </section>
    );
  }
  if (!items.length) {
    return (
      <section className="card review-priority" aria-labelledby="overview-priority-heading">
        <h2 id="overview-priority-heading">優先して確認する明細</h2>
        <p className="sub">
          {hasItemsOutsideRange
            ? 'この期間に優先して確認する明細はありません。件数は全期間で数えています。'
            : '優先して確認する明細はありません。'}
        </p>
      </section>
    );
  }
  const visibleCount = Math.min(items.length, PRIORITY_ROW_LIMIT);
  return (
    <section className="card review-priority" aria-labelledby="overview-priority-heading">
      <h2 id="overview-priority-heading">
        優先して確認する明細{' '}
        <span className="sub">
          （{items.length > visibleCount ? `上位 ${visibleCount} / ${items.length} 件` : `${items.length} 件`}
          ）
        </span>
      </h2>
      <div className="scroll-x">
        <DataTable
          className="data review-priority-table"
          caption={<caption className="visually-hidden">優先して確認する明細</caption>}
          columns={[
            { label: '状態', sortable: false, className: 'review-col-status' },
            { label: '日付', className: 'review-col-date' },
            { label: '内容', sortable: false, className: 'review-col-content' },
            { label: '金額', className: 'review-col-amount num' },
            { label: '推奨', sortable: false, className: 'review-col-recommendation' },
            { label: '信頼度', sortable: false, className: 'review-col-confidence' },
          ]}
        >
          {items.slice(0, PRIORITY_ROW_LIMIT).map((item) => (
            <tr
              key={`${item.kind}/${item.itemKey}`}
              className={
                selected?.kind === item.kind && selected.itemKey === item.itemKey ? 'selected' : undefined
              }
            >
              <td className="review-col-status">
                <ReviewStatusBadge kind={item.kind} />
              </td>
              <td className="review-col-date">
                <time dateTime={item.date}>{item.date}</time>
              </td>
              <td className="review-col-content">
                <Button
                  variant="text"
                  className="review-item-button"
                  onClick={() => onSelect(item)}
                  // aria-selected は grid/listbox の行にしか効かない。普通の表では選択中のボタンに aria-current を付ける
                  aria-current={
                    selected?.kind === item.kind && selected.itemKey === item.itemKey ? 'true' : undefined
                  }
                >
                  {item.content}
                </Button>
              </td>
              <td
                className={`review-col-amount num ${item.amount < 0 ? 'pos' : item.amount > 0 ? 'neg' : ''}`}
              >
                {yenS(item.amount)}
              </td>
              <td className="review-col-recommendation">
                {item.recommendation ? (
                  <span className="review-recommendation">{item.recommendation}</span>
                ) : (
                  <span className="sub">推奨なし</span>
                )}
              </td>
              <td className="review-col-confidence">
                <span className={`review-confidence ${confidenceClass(item.confidence)}`}>
                  {confidenceTierText(item.confidence)}
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </section>
  );
}

function TrendCard({ data }: { data: OverviewResponse }) {
  const [showAverage, setShowAverage] = useState(false);
  const [years, setYears] = useState<1 | 2 | 3>(1);
  const visibleTrend = data.trend.slice(-years * 12);
  // 1年でも年をまたぐため、軸上は「月」だけにせず 2026/08 の形で曖昧さを消す。
  const labels = visibleTrend.map((point) => point.month.replace('-', '/'));
  const balances = visibleTrend.map((p) => p.balance);
  const latest = visibleTrend[visibleTrend.length - 1];
  const model = createFinancialFigureModel({
    id: 'overview-monthly-trend',
    title: '月次の収入・支出・純収支の推移',
    summary: latest
      ? `${monthShort(latest.month)}は収入${yen(latest.income)}、支出${yen(latest.expense)}で、純収支は${yenS(latest.balance)}です。`
      : '表示する月がありません。',
    period: financialPeriod(labels),
    labels,
    series: [
      {
        key: 'income',
        label: '収入',
        values: visibleTrend.map((p) => p.income),
        unit: 'yen',
        color: COLORS.income,
      },
      {
        key: 'expense',
        label: '支出',
        values: visibleTrend.map((p) => p.expense),
        unit: 'yen',
        color: COLORS.expense,
      },
      { key: 'balance', label: '純収支', values: balances, unit: 'yen', signed: true, color: COLORS.net },
      ...(showAverage
        ? [
            {
              key: 'balance-moving-average',
              label: '純収支の3ヶ月移動平均',
              values: movingAvg(balances, 3),
              unit: 'yen' as const,
              signed: true,
              color: COLORS.warnFill,
            },
          ]
        : []),
    ],
    action: '純収支が落ちた月は、支出内訳で増えた項目を確かめます。',
  });
  return (
    <div className="card overview-trend">
      <FinancialFigure
        model={model}
        headingLevel={2}
        beforeChart={
          <div className="trend-controls">
            <fieldset className="trend-range">
              <legend className="visually-hidden">図に表示する期間</legend>
              {([1, 2, 3] as const).map((value) => (
                <Button
                  key={value}
                  size="mini"
                  aria-pressed={years === value}
                  onClick={() => setYears(value)}
                >
                  {value}年
                </Button>
              ))}
            </fieldset>
            <span className="trend-average-control">
              <button
                type="button"
                className="btn mini"
                data-native-control="toggle"
                aria-pressed={showAverage}
                onClick={() => setShowAverage((v) => !v)}
              >
                3か月平均
              </button>{' '}
              <Term id="movingAvg">?</Term>
            </span>
          </div>
        }
      >
        <Chart
          type="bar"
          role="img"
          aria-label="月別の収入・支出と純収支の推移を示す図"
          fallbackContent="月別の収入・支出と純収支の推移を示す図"
          data={{
            labels: figureLabels(model),
            datasets: [
              {
                type: 'bar' as const,
                label: model.series[0]?.label,
                data: seriesData(model, 0),
                backgroundColor: COLORS.income,
              },
              {
                type: 'bar' as const,
                label: model.series[1]?.label,
                data: seriesData(model, 1),
                backgroundColor: COLORS.expense,
              },
              {
                type: 'line' as const,
                label: model.series[2]?.label,
                data: seriesData(model, 2),
                borderColor: COLORS.net,
                pointRadius: 2,
                borderWidth: 2,
              },
              ...(showAverage
                ? [
                    {
                      type: 'line' as const,
                      label: model.series[3]?.label,
                      data: seriesData(model, 3),
                      borderColor: COLORS.warnFill,
                      borderDash: [6, 4],
                      pointRadius: 0,
                      borderWidth: 2,
                    },
                  ]
                : []),
            ],
          }}
          options={{
            ...baseChartOptions(),
            scales: { y: { ticks: { callback: yenTick } } },
            // canvas外の凡例を正本にし、同じ系列名を図の下へ重ねない。
            plugins: { legend: { display: false } },
          }}
        />
      </FinancialFigure>
    </div>
  );
}

/** 前年比較。横方向に今期→前期→差を追える同一構造を、比較不能時にも保つ。 */
function YearComparisonCard({ data }: { data: OverviewResponse }) {
  const { rows, currentLabel, previousLabel } = data.yearComparison;
  return (
    <div className="card">
      <h2>前年との比較</h2>
      <p className="sub">
        {previousLabel
          ? `${currentLabel}と${previousLabel}を比べます。`
          : '比較できる前期データがないため、今期の値だけを表示します。'}
      </p>
      <div className="scroll-x">
        <DataTable columns={['項目', currentLabel || '今期', previousLabel || '前期', '増減', '増減率']}>
          {rows.map((row) => {
            const cls = row.key === 'expense' ? deltaCls(row.delta) : gainCls(row.delta);
            return (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="num">{row.key === 'balance' ? signedYen(row.current) : yen(row.current)}</td>
                <td className="num">
                  {row.previous == null
                    ? '—'
                    : row.key === 'balance'
                      ? signedYen(row.previous)
                      : yen(row.previous)}
                </td>
                <td className={`num ${cls}`}>{signedYen(row.delta)}</td>
                <td className={`num ${cls}`}>{pct(row.deltaRate)}</td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </div>
  );
}

/** 支出内訳。上位 5 + その他をサーバが作り、金額と構成比の両方を行内で確認できる。 */
function BreakdownCard({ data }: { data: OverviewResponse }) {
  const { items, total } = data.breakdown;
  const [metric, setMetric] = useState<'amount' | 'share'>('amount');
  return (
    <div className="card overview-breakdown">
      <div className="breakdown-heading">
        <h2>
          支出の内訳 <span className="sub">(上位5項目)</span>
        </h2>
        <fieldset className="breakdown-metric">
          <legend className="visually-hidden">内訳の表示値</legend>
          <Button size="mini" aria-pressed={metric === 'amount'} onClick={() => setMetric('amount')}>
            金額
          </Button>
          <Button size="mini" aria-pressed={metric === 'share'} onClick={() => setMetric('share')}>
            構成比
          </Button>
        </fieldset>
      </div>
      {items.length ? (
        <>
          <ul className="breakdown-list">
            {items.map((item, index) => (
              <li key={item.label} className={`breakdown-rank-${Math.min(index + 1, 6)}`}>
                <span className="breakdown-label">{item.label}</span>
                <span className="breakdown-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(1, item.share)) * 100}%` }} />
                </span>
                <span className="breakdown-value num">
                  {metric === 'amount' ? yen(item.amount) : ratio(item.share)}
                </span>
                <span className="breakdown-secondary num">
                  {metric === 'amount' ? ratio(item.share) : yen(item.amount)}
                </span>
              </li>
            ))}
          </ul>
          <p className="sub">支出計 {yen(total)}</p>
        </>
      ) : (
        <p className="sub">この期間の支出はありません。</p>
      )}
    </div>
  );
}

/** 科目別年比較。詳しく見るを開いたときだけ取得する */
function AccountYearComparison() {
  const { key, withPeriod } = usePeriod();
  const q = useQuery({
    queryKey: ['summary', key],
    queryFn: () => api<SummaryResponse>(withPeriod('/summary')),
  });
  if (q.isLoading) return <PageState status="loading" />;
  const ov = q.data?.overview;
  if (q.isError || !ov?.yearTable) return <PageState status="error" error={q.error} />;
  if (!ov.yearTable.length) return <p className="sub">比べられる科目がありません。</p>;
  return (
    <div className="card">
      <h3>
        科目別の年間比較({ov.years.prev}年実績 vs {ov.years.curr}年 年換算)
      </h3>
      <AnnualComparisonTable
        subjectLabel="科目"
        previousLabel={`${ov.years.prev}年実績`}
        currentLabel={`${ov.years.curr}年換算`}
        rows={ov.yearTable.map((r) => ({
          key: r.account,
          label: r.account,
          previous: r.prevActual,
          current: r.currAnnualized,
          delta: r.delta,
        }))}
        total={{
          label: '経費計',
          previous: ov.yearTotals.prevActual,
          current: ov.yearTotals.currAnnualized,
          delta: ov.yearTotals.delta,
        }}
      />
    </div>
  );
}

function MoreDetails() {
  const [open, setOpen] = useState(false);
  return (
    <details className="overview-more" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>詳しく見る(未決済・科目別の年間比較)</summary>
      {open && (
        <>
          <UnsettledPanel />
          <AccountYearComparison />
        </>
      )}
    </details>
  );
}

const reviewItemsInRange = (
  items: ReviewQueueItem[],
  range: { from: string; to: string } | null,
): ReviewQueueItem[] =>
  range ? items.filter((item) => item.month >= range.from && item.month <= range.to) : items;

export function OverviewPage() {
  const { key, withPeriod } = usePeriod();
  const [scope, setScope] = useState<OverviewScope>('total');
  // undefined は広幅の初期選択、null は利用者が明示的に閉じた状態として区別する。
  const [selectedKey, setSelectedKey] = useState<string | null | undefined>(undefined);
  const wideReviewLayout = useWideReviewLayout();
  const q = useQuery({
    queryKey: ['overview', scope, key],
    queryFn: () => api<OverviewResponse>(withPeriod(`/overview?scope=${scope}`)),
    // 範囲や期間を切り替える間も前の結果を残し、画面全体を読込表示に戻さない
    placeholderData: (previous) => previous,
  });
  const queue = useReviewQueue();
  const items = queue.data?.items ?? [];
  const activeRange =
    q.isPlaceholderData && q.data?.kpi.months === 0 ? null : (q.data?.period.applied ?? null);
  const visibleItems = reviewItemsInRange(items, activeRange);
  const selectedByKey = visibleItems.find((item) => `${item.kind}/${item.itemKey}` === selectedKey) ?? null;
  // 広幅は正式UIどおり最優先の根拠を初期表示。狭幅は明示的に選ぶまで dialog を開かない。
  const selected =
    selectedKey === null
      ? null
      : selectedKey === undefined
        ? wideReviewLayout
          ? (visibleItems[0] ?? null)
          : null
        : selectedByKey;
  const next = items[0];

  const empty = Boolean(q.data && q.data.kpi.months === 0 && q.data.trend.length === 0);
  const refreshingFromEmpty = q.isPlaceholderData && empty;
  // 取込済みのデータ全体 (full) があるのに空なら、選んだ期間に月が無いだけ。取込へ誘導しない
  const periodOnlyEmpty = !q.isPlaceholderData && empty && q.data?.period.full != null;

  return (
    <div className="overview-page" aria-busy={q.isPlaceholderData || undefined}>
      <section className="overview-hero" aria-label="今月の収支と月次クローズ">
        <PageHeader route="overview" title="今月の収支と、次に直すことは？" showTask={false} />
        <OverviewLead data={q.data} updating={q.isPlaceholderData} />
        <ScopeSwitch value={scope} onChange={setScope} />
      </section>

      {q.isLoading || refreshingFromEmpty ? (
        <PageState status="loading" />
      ) : q.isError || !q.data ? (
        <PageState status="error" error={q.error} />
      ) : periodOnlyEmpty ? (
        <PageState
          status="empty"
          message="選んだ期間には収支データがありません。期間を切り替えてください。"
        />
      ) : empty ? (
        <PageState
          status="empty"
          message="まだデータがありません。最初に収支データを取り込んでください。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      ) : (
        <>
          <DefenseForecastPanel forecast={q.data.defenseForecast} />
          <KpiSection data={q.data} />
          <TrendCard data={q.data} />
        </>
      )}

      <div className="overview-work">
        <ReviewSummaryCard queue={queue} />
        <PriorityTable
          items={visibleItems}
          hasItemsOutsideRange={items.length > visibleItems.length}
          state={queue.isError ? 'error' : queue.data ? 'ready' : 'loading'}
          selected={selected}
          onSelect={(item) => setSelectedKey(`${item.kind}/${item.itemKey}`)}
        />
        <ReviewDetailPanel
          item={selected}
          wide={wideReviewLayout}
          onClose={() => setSelectedKey(null)}
          focusAfterSnooze={() => document.getElementById(REVIEW_SUMMARY_HEADING_ID)?.focus()}
        />
      </div>

      {q.data && !empty && (
        <div className="overview-evidence">
          <YearComparisonCard data={q.data} />
          <BreakdownCard data={q.data} />
        </div>
      )}

      <MoreDetails />

      <ReviewActionBar
        total={queue.data ? queue.data.total : null}
        next={
          next ? (
            <Link className="btn primary" to={REVIEW_KIND_PATH[next.kind]}>
              次の未処理へ({REVIEW_KIND_LABEL[next.kind]})
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
