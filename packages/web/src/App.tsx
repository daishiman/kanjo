import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AUTH_EVENT, api } from './api.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/Login.js';
import { TaxReturnPage } from './pages/TaxReturn.js';
import { PeriodProvider } from './period.js';
import { APP_ROUTES, type AppRouteId } from './routeMetadata.js';
import { TaxYearProvider } from './tax-year.js';

export const ROUTE_COMPONENTS: Record<AppRouteId, ComponentType> = {
  overview: lazy(() => import('./pages/Overview.js').then((module) => ({ default: module.OverviewPage }))),
  matrix: lazy(() => import('./pages/Matrix.js').then((module) => ({ default: module.MatrixPage }))),
  trends: lazy(() => import('./pages/Trends.js').then((module) => ({ default: module.TrendsPage }))),
  diagnosis: lazy(() => import('./pages/Diagnosis.js').then((module) => ({ default: module.DiagnosisPage }))),
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
  // 申告画面は年1回のcold-loadが主経路。4KB gzip程度をmainへ含め、
  // main取得後にTaxReturn chunkを発見する直列requestを1段減らす。
  tax: TaxReturnPage,
  taxReceipts: lazy(() =>
    import('./pages/TaxReceipts.js').then((module) => ({ default: module.TaxReceiptsPage })),
  ),
};

export function App() {
  const qc = useQueryClient();
  const [loggedOut, setLoggedOut] = useState(false);

  const me = useQuery({
    queryKey: ['auth'],
    queryFn: () => api<{ authenticated: boolean }>('/auth/me'),
    retry: false,
  });

  useEffect(() => {
    const onUnauthorized = () => setLoggedOut(true);
    window.addEventListener(AUTH_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_EVENT, onUnauthorized);
  }, []);

  if (me.isLoading) {
    return <div className="login-wrap">読み込み中…</div>;
  }
  if (loggedOut || me.isError) {
    return (
      <LoginPage
        onSuccess={() => {
          setLoggedOut(false);
          void qc.invalidateQueries();
        }}
      />
    );
  }

  return (
    <PeriodProvider>
      <TaxYearProvider>
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </TaxYearProvider>
    </PeriodProvider>
  );
}
