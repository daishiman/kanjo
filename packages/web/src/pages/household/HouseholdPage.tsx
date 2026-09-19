import type { HouseholdSummary } from '@kanjo/core';
/**
 * 家計収支画面のページ制御 (spec §0・§2・§3・§7・§8・§9)。
 *
 * URL 状態 (`seg` / `month` / `cat`) と取得だけを持ち、各カードの表示は同じディレクトリの部品へ分ける。
 * 期間は既存 `usePeriod` のもので、本画面は新しい期間状態を持たない。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api-client.js';
import { type HouseholdResponse, api } from '../../api.js';
import { KpiCard, PageHeader, PageState } from '../../components/Page.js';
import { monthLabel, yen } from '../../format.js';
import { usePeriod } from '../../period.js';
import { HouseholdCategories } from './HouseholdCategories.js';
import { HouseholdOwners } from './HouseholdOwners.js';
import { HouseholdSeries } from './HouseholdSeries.js';
import {
  type HouseholdUrlState,
  comparisonSentence,
  diffWithRate,
  expenseDiffClass,
  incomeDiffClass,
  periodSpanLabel,
  previousYearSentence,
  readHouseholdUrl,
  selectedCategory,
  signedYen,
} from './view-model.js';
import './household.css';

const TITLE = '家計の総収入・総支出・純収支は、どう変わりましたか？';
const LEAD = '収入・支出の推移から、家計の動きと変化の要因を確認しましょう。';

type Patch = Partial<Record<keyof HouseholdUrlState, string | null>>;

export function HouseholdPage() {
  const [params, setParams] = useSearchParams();
  const url = readHouseholdUrl(params);
  const { key, selection, withPeriod } = usePeriod();
  const query = useQuery({
    queryKey: ['household', key, url.month],
    queryFn: () =>
      api<HouseholdResponse>(
        withPeriod(url.month ? `/household?month=${encodeURIComponent(url.month)}` : '/household'),
      ),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Patch) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(patch)) {
          if (value === undefined) continue;
          // 既定値は URL に書かない (seg=all)
          if (value === null || (name === 'seg' && value === 'all')) next.delete(name);
          else next.set(name, value);
        }
        return next;
      },
      { replace: true },
    );
  };

  // 期間を変えて選択月が期間外になったら、月の指定を外して期間の最終月へ戻す (R8)
  const invalidMonth = query.error instanceof ApiError && query.error.code === 'invalid_month';
  // biome-ignore lint/correctness/useExhaustiveDependencies: invalid_month へ変わったときだけ URL を正規化する。
  useEffect(() => {
    if (invalidMonth) update({ month: null });
  }, [invalidMonth]);

  const header = <PageHeader route="household" title={TITLE} lead={LEAD} showTask={false} />;

  if (query.isLoading || (invalidMonth && !query.data))
    return (
      <>
        {header}
        <PageState status="loading" />
      </>
    );
  if (!query.data)
    return (
      <>
        {header}
        <PageState status="error" error={query.error} />
      </>
    );

  const response = query.data;
  if (response.empty) {
    return (
      <>
        {header}
        <section className="household-empty" aria-labelledby="household-empty-title">
          <h2 id="household-empty-title">表示するデータがありません</h2>
          <p>収入・支出のデータを取り込むと、家計収支を表示できます。</p>
          <Link className="btn primary" to="/import">
            データ取込へ
          </Link>
        </section>
      </>
    );
  }

  const data: HouseholdSummary = response;
  const month = data.selectedMonth;
  const span = periodSpanLabel(selection);
  const { summary } = data;
  const change = summary.change;
  const selectedRow = data.series.find((row) => row.month === month);

  return (
    <div className={`household${query.isPlaceholderData ? ' is-stale' : ''}`} aria-busy={query.isFetching}>
      <div className="household-head">
        {header}
        <aside className="card household-source" aria-label="データの出典">
          <h2>データの出典</h2>
          <p>
            {data.sources
              ? `${data.sources.primary}${data.sources.otherCount > 0 ? ` 他${data.sources.otherCount}件` : ''}`
              : '—'}
          </p>
          <Link to="/import">取込明細を確認 →</Link>
        </aside>
      </div>

      <div className="kpis household-kpis">
        <KpiCard
          label={`総収入（${span}）`}
          value={yen(summary.total.income)}
          note={`月平均 ${yen(summary.monthlyAverage.income)} / 年換算 ${yen(summary.annualized.income)}`}
        />
        <KpiCard
          label={`総支出（${span}）`}
          value={yen(summary.total.expense)}
          note={`月平均 ${yen(summary.monthlyAverage.expense)} / 年換算 ${yen(summary.annualized.expense)}`}
        />
        <KpiCard
          label={`純収支（${span}）`}
          value={signedYen(summary.total.balance)}
          note={`月平均 ${signedYen(summary.monthlyAverage.balance)} / 年換算 ${signedYen(summary.annualized.balance)}`}
        />
        <KpiCard
          label="前年より"
          value={
            change ? (
              <span className={incomeDiffClass(change.balance.diff)}>
                {change.balance.diff > 0 ? '▲ ' : change.balance.diff < 0 ? '▼ ' : ''}
                {diffWithRate(change.balance.diff, change.balance.rate)}
              </span>
            ) : (
              '—'
            )
          }
          note={previousYearSentence(summary)}
        />
      </div>

      <HouseholdSeries
        data={data}
        seg={url.seg}
        month={month}
        onSeg={(seg) => update({ seg })}
        onMonth={(next) => update({ month: next })}
      />

      <HouseholdCategories
        data={data}
        selected={selectedCategory(url.cat, data.defaultCategory)}
        month={month}
        onSelect={(cat) => update({ cat })}
      />

      <HouseholdOwners data={data} />

      <section className="card household-compare" aria-labelledby="household-compare-title">
        <h2 id="household-compare-title">前年との比較（同じ期間・月次）</h2>
        <dl className="household-compare-grid">
          <div>
            <dt>総収入</dt>
            <dd className={incomeDiffClass(change?.income.diff)}>
              {change ? diffWithRate(change.income.diff, change.income.rate) : '—'}
            </dd>
          </div>
          <div>
            <dt>総支出</dt>
            <dd className={expenseDiffClass(change?.expense.diff)}>
              {change ? diffWithRate(change.expense.diff, change.expense.rate) : '—'}
            </dd>
          </div>
          <div>
            <dt>純収支</dt>
            <dd className={incomeDiffClass(change?.balance.diff)}>
              {change ? diffWithRate(change.balance.diff, change.balance.rate) : '—'}
            </dd>
          </div>
        </dl>
        <p>{comparisonSentence(change)}</p>
      </section>

      <section className="household-selection-bar" aria-label="選択中の月">
        <span>
          選択中： <strong>{monthLabel(month)}</strong>
        </span>
        <span>
          純収支 <strong>{signedYen(selectedRow?.total.balance ?? null)}</strong>
        </span>
        <Link className="btn primary" to={`/classify?month=${month}`}>
          内訳の明細を確認 →
        </Link>
      </section>
    </div>
  );
}
