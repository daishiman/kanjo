/**
 * 支出分析: 「どの勘定科目に手を打つか」を3つの切り口で決める。
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
 */
import { type ComponentType, Suspense, lazy } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { PageHeader, PageState, TaskCopy } from '../components/Page.js';
import { RouteIcon } from '../components/RouteIcon.js';
import { ANALYSIS_TABS, type AnalysisTabId, DEFAULT_ANALYSIS_TAB, analysisTab } from '../routeMetadata.js';

const PANELS: Record<AnalysisTabId, ComponentType> = {
  reconciliation: lazy(() =>
    import('./analysis/Reconciliation.js').then((module) => ({ default: module.ReconciliationPage })),
  ),
  matrix: lazy(() => import('./analysis/Matrix.js').then((module) => ({ default: module.MatrixPage }))),
  trends: lazy(() => import('./analysis/Trends.js').then((module) => ({ default: module.TrendsPage }))),
  diagnosis: lazy(() =>
    import('./analysis/Diagnosis.js').then((module) => ({ default: module.DiagnosisPage })),
  ),
};

export function AnalysisPage() {
  const { tab: requested } = useParams();
  const tab = analysisTab(requested);
  // /analysis 直下と、綴りの違うタブ名。履歴に積まずに既定のタブへ寄せる
  if (!tab) return <Navigate to={DEFAULT_ANALYSIS_TAB.path} replace />;
  const Panel = PANELS[tab.id];

  return (
    <>
      <PageHeader route="analysis" />

      {/* role="tab" を手で組まず、素のリンクにする。切り替えが実際にページ遷移
          (URLが変わる)なので、支援技術にもそう伝わるほうが嘘がない */}
      <nav className="page-tabs" aria-label="支出分析の切り口">
        {ANALYSIS_TABS.map((item) => (
          <NavLink key={item.id} to={item.path} className={() => undefined}>
            <RouteIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <section aria-label={tab.label}>
        <TaskCopy task={tab.task} detail={tab.taskDetail} summary={`${tab.label}のくわしい説明`} />
        <Suspense key={tab.id} fallback={<PageState status="loading" />}>
          <Panel />
        </Suspense>
      </section>
    </>
  );
}
