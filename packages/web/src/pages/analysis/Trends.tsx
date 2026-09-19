/**
 * 推移画面のページ制御。
 * URL 状態・取得・rolling deploy 互換境界だけを持ち、表示責務は trends/ に分ける。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api-client.js';
import { type TrendsResponse, type TrendsScreen, api } from '../../api.js';
import { PageState } from '../../components/Page.js';
import { usePeriod } from '../../period.js';
import { ComparisonScreen } from './trends/ComparisonScreen.js';
import { ScopeTabs } from './trends/Conditions.js';
import { JudgementDisclosure } from './trends/LegacyJudgement.js';
import { signedYen } from './trends/format.js';
import { COMPARES, LEGACY_SCOPE, SCOPES, type TrendSide, type UrlState } from './trends/types.js';
import { choiceParam, patchSearchParams } from './url-state.js';
import './trends.css';

export { signedYen };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function readUrl(params: URLSearchParams): UrlState {
  const month = params.get('month');
  const metric = params.get('metric');
  const category = params.get('category');
  const side = params.get('side');
  const validSide = side === 'business' || side === 'household' ? (side as TrendSide) : null;
  return {
    scope: choiceParam(
      params,
      'scope',
      SCOPES.map((item) => item.id),
      'total',
    ),
    metric: metric && /^[a-z][a-z0-9_]*$/.test(metric) ? metric : null,
    compare: choiceParam(
      params,
      'compare',
      COMPARES.map((item) => item.id),
      'previous',
    ),
    month: month && MONTH_RE.test(month) ? month : null,
    category: category || null,
    side: category ? validSide : null,
    payee: category ? params.get('payee') || null : null,
  };
}

function screenQuery(state: UrlState): string {
  const query = new URLSearchParams({ scope: LEGACY_SCOPE[state.scope] });
  if (state.metric) query.set('metric', state.metric);
  if (state.compare !== 'previous') query.set('compare', state.compare);
  if (state.month) query.set('month', state.month);
  if (state.category) query.set('category', state.category);
  if (state.side) query.set('side', state.side);
  if (state.payee) query.set('payee', state.payee);
  return query.toString();
}

/** 新フィールドが揃う応答だけを比較画面へ渡す。旧 Worker は従来判定へフォールバックする。 */
function screenOf(response: TrendsResponse): TrendsScreen | null {
  if (
    !response.selection ||
    !response.series ||
    !response.kpis ||
    !response.metrics ||
    !response.categories ||
    !response.review
  )
    return null;
  return {
    metrics: response.metrics,
    selection: response.selection,
    comparePeriod: response.comparePeriod ?? null,
    compareUnavailable: response.compareUnavailable ?? null,
    series: response.series,
    kpis: response.kpis,
    detail: response.detail ?? null,
    sparkMonths: response.sparkMonths ?? [],
    categories: response.categories,
    changePareto: response.changePareto ?? [],
    topMovers: response.topMovers ?? [],
    review: response.review,
    recommended: response.recommended ?? null,
    focus: response.focus ?? null,
  };
}

export function TrendsPage() {
  const [params, setParams] = useSearchParams();
  const url = readUrl(params);
  const { key, withPeriod } = usePeriod();
  const query = useQuery({
    queryKey: [
      'trends',
      key,
      url.scope,
      url.metric,
      url.compare,
      url.month,
      url.category,
      url.side,
      url.payee,
    ],
    queryFn: () => api<TrendsResponse>(withPeriod(`/trends?${screenQuery(url)}`)),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<Record<keyof UrlState, string | null>>) => {
    setParams((previous) => patchSearchParams(previous, patch), { replace: true });
  };

  const invalidMetric = query.error instanceof ApiError && query.error.code === 'invalid_metric';
  // biome-ignore lint/correctness/useExhaustiveDependencies: invalid_metric へ変わったときだけ URL を正規化する。
  useEffect(() => {
    if (invalidMetric) update({ metric: null });
  }, [invalidMetric]);

  const selection = query.data?.selection;
  // biome-ignore lint/correctness/useExhaustiveDependencies: params と応答選択が正本。update は毎回作り直す。
  useEffect(() => {
    const patch: Partial<Record<keyof UrlState, string | null>> = {};
    const raw = (name: string) => params.get(name);
    if (raw('scope') !== null && raw('scope') !== url.scope) patch.scope = url.scope;
    if (raw('compare') !== null && raw('compare') !== url.compare) patch.compare = url.compare;
    if (raw('month') !== null && raw('month') !== url.month) patch.month = url.month;
    if (raw('side') !== null && !url.category) patch.side = null;
    if (raw('payee') !== null && !url.category) patch.payee = null;
    if (selection && !query.isPlaceholderData) {
      const selectedSide = selection.side ?? null;
      if (url.month && selection.month !== url.month) patch.month = selection.month;
      if (url.category && selection.category !== url.category) patch.category = selection.category;
      if (url.category && selectedSide !== url.side) patch.side = selectedSide;
      if (url.payee && selection.payee !== url.payee) patch.payee = selection.payee;
    }
    if (Object.keys(patch).length) update(patch);
  }, [params, selection, query.isPlaceholderData]);

  if (query.isLoading || (invalidMetric && !query.data)) return <PageState status="loading" />;
  if (!query.data) return <PageState status="error" error={query.error} />;

  const response = query.data;
  const screen = screenOf(response);
  const hasScreenData = screen ? screen.series.months.length > 0 : false;
  if (!response.recordedMonths.length && !hasScreenData) {
    return (
      <div className="trends">
        <div className="trends-empty-scope">
          <span className="trends-condition-label">分析の範囲</span>
          <ScopeTabs
            scope={url.scope}
            onChange={(scope) => update({ scope, category: null, side: null, payee: null })}
          />
        </div>
        <PageState
          status="empty"
          message="集計できる月がありません。データを取り込むか、未記帳月の設定を確認してください。"
          action={
            <Link className="btn primary" to="/import">
              データ取込へ
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={`trends${query.isPlaceholderData ? ' is-stale' : ''}`} aria-busy={query.isFetching}>
      {screen ? (
        <ComparisonScreen screen={screen} url={url} update={update} />
      ) : (
        <>
          <div className="trends-empty-scope">
            <span className="trends-condition-label">分析の範囲</span>
            <ScopeTabs
              scope={url.scope}
              onChange={(scope) => update({ scope, category: null, side: null, payee: null })}
            />
          </div>
          <JudgementDisclosure t={response} initiallyOpen />
        </>
      )}
    </div>
  );
}
