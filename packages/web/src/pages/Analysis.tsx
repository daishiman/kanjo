/**
 * 支出分析: 「どの勘定科目に手を打つか」を5つの切り口で決める。
 *
 * 元は増減マトリクス・支出トレンド・統計診断という独立した3画面だった。
 * どれも出口は同じ(見直す科目を1つ選ぶ)で、利用者は3画面を行き来しながら
 * 1つの判断をしていた。サイドバーの17行はノートPCの実効高に収まらず、
 * 「並んでいる=別の仕事」という誤った合図も出していたので、タブへ束ねている。
 *
 * タブはボタンではなくリンク(URL)にしてある。切り口はブックマークと
 * 戻る/進むの対象で、リロードで先頭タブへ戻るのは実質的なデータの喪失になるため。
 * 非表示のタブは描画しない = APIも呼ばない。3本のクエリを同時に投げると
 * 束ねた瞬間に遅くなる。対象期間だけは PeriodProvider が持つのでタブ間で保たれ、
 * タブ内の表示切替(マトリクスの金額/前月比、トレンドの事業/家計)は切り替えで初期値へ戻る。
 *
 * /analysis 直下は「どこから見るか」を決めるハブ(docs/analysis-hub/architecture-decision.md)。
 * ハブは集約 API 1 本だけを呼び、5 タブの API は呼ばない。選択中の分析は ?focus= に置き、
 * 期間や金額は URL に載せない(共有した URL から金額が漏れないように)。
 */
import { useQuery } from '@tanstack/react-query';
import { type ComponentType, Suspense, lazy, useState } from 'react';
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ANALYSIS_HUB_ICONS } from '../analysis-hub-icons.js';
import { ANALYSIS_TAB_QUESTIONS } from '../analysis-tab-questions.js';
import { type AnalysisHubResponse, api } from '../api.js';
import { Button } from '../components/Button.js';
import { PageHeader, PageState, TaskCopy, TaskDetail } from '../components/Page.js';
import { RouteIcon } from '../components/RouteIcon.js';
import { usePeriod } from '../period.js';
import {
  ANALYSIS_HUB_STALE_TIME_MS,
  ANALYSIS_TABS,
  type AnalysisTabId,
  DEFAULT_ANALYSIS_TAB,
  analysisHubQueryKey,
  analysisTab,
} from '../routeMetadata.js';
import { AnalysisJourney } from './analysis-hub/AnalysisJourney.js';
import { AnalysisRouteTable, type HubDataState } from './analysis-hub/AnalysisRouteTable.js';
import { HubSummary } from './analysis-hub/HubSummary.js';
import { SelectedAnalysisPanel } from './analysis-hub/SelectedAnalysisPanel.js';
import './analysis-hub/analysis-hub.css';

const PANELS: Record<AnalysisTabId, ComponentType> = {
  reconciliation: lazy(() =>
    import('./analysis/Reconciliation.js').then((module) => ({ default: module.ReconciliationPage })),
  ),
  'total-cashflow': lazy(() =>
    import('./analysis/TotalCashflow.js').then((module) => ({ default: module.TotalCashflowPage })),
  ),
  matrix: lazy(() => import('./analysis/Matrix.js').then((module) => ({ default: module.MatrixPage }))),
  trends: lazy(() => import('./analysis/Trends.js').then((module) => ({ default: module.TrendsPage }))),
  diagnosis: lazy(() =>
    import('./analysis/Diagnosis.js').then((module) => ({ default: module.DiagnosisPage })),
  ),
};

export function AnalysisPage() {
  const { tab: requested } = useParams();
  // /analysis 直下はハブ。綴りの違うタブ名だけを履歴に積まずに既定のタブへ寄せる
  if (requested === undefined) {
    return <AnalysisHub />;
  }
  const tab = analysisTab(requested);
  if (!tab) return <Navigate to={DEFAULT_ANALYSIS_TAB.path} replace />;
  const Panel = PANELS[tab.id];
  const question = ANALYSIS_TAB_QUESTIONS[tab.id];

  return (
    <>
      {question ? (
        <>
          <PageHeader route="analysis" title={question.question} lead={question.lead} showTask={false} />
          {question.guideSummary && <TaskDetail detail={tab.taskDetail} summary={question.guideSummary} />}
        </>
      ) : (
        <PageHeader route="analysis" />
      )}
      <section aria-label={tab.label}>
        {!question && (
          <TaskCopy task={tab.task} detail={tab.taskDetail} summary={`${tab.label}のくわしい説明`} />
        )}
        <Suspense key={tab.id} fallback={<PageState status="loading" />}>
          <Panel />
        </Suspense>
      </section>
    </>
  );
}

function AnalysisTabsNav({ focus }: { focus?: AnalysisTabId }) {
  return (
    // role="tab" を手で組まず、素のリンクにする。切り替えが実際にページ遷移
    // (URLが変わる)なので、支援技術にもそう伝わるほうが嘘がない
    <nav className="page-tabs" aria-label="支出分析の切り口">
      {ANALYSIS_TABS.map((item) =>
        focus ? (
          <Link
            key={item.id}
            to={item.path}
            data-selected={focus === item.id || undefined}
            aria-current={focus === item.id ? 'step' : undefined}
            aria-label={`${item.label}の詳細を開く`}
          >
            <RouteIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ) : (
          <NavLink
            key={item.id}
            to={item.path}
            className={() => undefined}
            aria-label={`${item.label}の詳細を開く`}
          >
            <RouteIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ),
      )}
    </nav>
  );
}

/* ======================== ハブ ======================== */

const focusOf = (value: string | null): AnalysisTabId =>
  analysisTab(value ?? undefined)?.id ?? DEFAULT_ANALYSIS_TAB.id;

function AnalysisHub() {
  const { key, withPeriod } = usePeriod();
  const [params, setParams] = useSearchParams();
  // 不正な値(../../etc など)は既定へ。URL に書き戻さず、表示だけ既定にする
  const focus = focusOf(params.get('focus'));
  const selected = analysisTab(focus) ?? DEFAULT_ANALYSIS_TAB;
  const [copyMessage, setCopyMessage] = useState('');

  const hub = useQuery({
    queryKey: analysisHubQueryKey(key),
    queryFn: () => api<AnalysisHubResponse>(withPeriod('/analysis/hub')),
    staleTime: ANALYSIS_HUB_STALE_TIME_MS,
  });

  const copyUrl = async () => {
    // 期間や金額は載せない。受け取った人は自分の期間で同じ分析を開く
    const url = `${window.location.origin}/analysis?focus=${encodeURIComponent(focus)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('URLをコピーしました');
    } catch {
      setCopyMessage('URLをコピーできませんでした。アドレスバーから手動でコピーしてください');
    }
  };

  const state: HubDataState = hub.isError
    ? 'error'
    : hub.isPending
      ? 'loading'
      : hub.data?.period.monthCount === 0
        ? 'empty'
        : 'success';
  const summaryFallback = hub.isError ? (
    <PageState
      status="error"
      error={hub.error}
      action={<Button onClick={() => void hub.refetch()}>もう一度読み込む</Button>}
    />
  ) : (
    <PageState status="loading" />
  );

  return (
    <div className="analysis-hub">
      <header className="analysis-hub-hero">
        <div>
          <h1 className="analysis-hub-title">支出のどこから確認しますか？</h1>
          <p>5つの視点から支出を分析し、課題の発見から改善アクションにつなげましょう。</p>
        </div>
        <div className="analysis-hub-copy">
          <Button onClick={() => void copyUrl()}>
            <RouteIcon name={ANALYSIS_HUB_ICONS.copy} />
            このページのURLをコピー
          </Button>
          {copyMessage && <output aria-live="polite">{copyMessage}</output>}
        </div>
      </header>

      <AnalysisTabsNav focus={focus} />

      <HubSummary data={hub.data} fallback={summaryFallback} />

      <div className="analysis-hub-workspace">
        <AnalysisRouteTable
          views={hub.data?.views}
          state={state}
          focus={focus}
          onSelect={(id) => setParams({ focus: id }, { replace: true })}
        />
        <SelectedAnalysisPanel selected={selected} />
      </div>

      <AnalysisJourney focus={focus} />

      <section aria-label="選択中の分析の操作" className="analysis-hub-action">
        <span>
          選択中: <strong>{selected.label}</strong>
          <small>{selected.summary}</small>
        </span>
        <Link to={selected.path} className="btn primary">
          {selected.label}を開く
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
