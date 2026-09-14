import { Suspense, lazy } from 'react';
import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { PeriodProvider } from './period.js';
import { APP_ROUTES, type AppRouteId, LEGACY_ROUTE_REDIRECTS } from './routeMetadata.js';

/** 改善要望は業務画面ではないため routeMetadata に載せず、ここで明示的に登録する。 */
const ImprovementPage = lazy(() =>
  import('./pages/Improvement.js').then((module) => ({ default: module.ImprovementPage })),
);

export const ROUTE_COMPONENTS: Record<AppRouteId, ComponentType> = {
  overview: lazy(() => import('./pages/Overview.js').then((module) => ({ default: module.OverviewPage }))),
  analysis: lazy(() => import('./pages/Analysis.js').then((module) => ({ default: module.AnalysisPage }))),
  subscriptions: lazy(() =>
    import('./pages/Subscriptions.js').then((module) => ({ default: module.SubscriptionsPage })),
  ),
  household: lazy(() => import('./pages/Household.js').then((module) => ({ default: module.HouseholdPage }))),
  statements: lazy(() =>
    import('./pages/Statements.js').then((module) => ({ default: module.StatementsPage })),
  ),
  ai: lazy(() => import('./pages/Ai.js').then((module) => ({ default: module.AiPage }))),
  classify: lazy(() => import('./pages/Classify.js').then((module) => ({ default: module.ClassifyPage }))),
  budget: lazy(() => import('./pages/Budget.js').then((module) => ({ default: module.BudgetPage }))),
  tradeoff: lazy(() => import('./pages/Tradeoff.js').then((module) => ({ default: module.TradeoffPage }))),
  import: lazy(() => import('./pages/Import.js').then((module) => ({ default: module.ImportPage }))),
  cash: lazy(() => import('./pages/Cash.js').then((module) => ({ default: module.CashPage }))),
  settings: lazy(() => import('./pages/Settings.js').then((module) => ({ default: module.SettingsPage }))),
  guide: lazy(() => import('./pages/Guide.js').then((module) => ({ default: module.GuidePage }))),
};

/** 認証後だけ到達できる業務画面の枠とルート。認証状態の分岐は App に閉じ込める。 */
export function AuthenticatedApp() {
  return (
    <PeriodProvider>
      <Layout>
        <Suspense
          fallback={
            <output className="page-state loading" aria-busy="true" aria-live="polite">
              画面を読み込み中…
            </output>
          }
        >
          <Routes>
            {APP_ROUTES.map((route) => {
              const Component = ROUTE_COMPONENTS[route.id];
              return <Route key={route.id} path={route.path} element={<Component />} />;
            })}
            <Route path="/analysis/:tab" element={<ROUTE_COMPONENTS.analysis />} />
            <Route path="/improvement" element={<ImprovementPage />} />
            {LEGACY_ROUTE_REDIRECTS.map((redirect) => (
              <Route
                key={redirect.from}
                path={redirect.from}
                element={<Navigate to={redirect.to} replace />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </PeriodProvider>
  );
}
