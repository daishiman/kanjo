import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AUTH_EVENT, api } from './api.js';
import { Layout } from './components/Layout.js';
import { BudgetPage } from './pages/Budget.js';
import { ClassifyPage } from './pages/Classify.js';
import { DiagnosisPage } from './pages/Diagnosis.js';
import { GuidePage } from './pages/Guide.js';
import { HouseholdPage } from './pages/Household.js';
import { ImportPage } from './pages/Import.js';
import { LoginPage } from './pages/Login.js';
import { MatrixPage } from './pages/Matrix.js';
import { OverviewPage } from './pages/Overview.js';
import { SettingsPage } from './pages/Settings.js';
import { SubscriptionsPage } from './pages/Subscriptions.js';
import { TradeoffPage } from './pages/Tradeoff.js';
import { APP_ROUTES, type AppRouteId } from './routeMetadata.js';

export const ROUTE_COMPONENTS: Record<AppRouteId, ComponentType> = {
  overview: OverviewPage,
  matrix: MatrixPage,
  diagnosis: DiagnosisPage,
  subscriptions: SubscriptionsPage,
  household: HouseholdPage,
  classify: ClassifyPage,
  budget: BudgetPage,
  tradeoff: TradeoffPage,
  import: ImportPage,
  settings: SettingsPage,
  guide: GuidePage,
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
    <Layout>
      <Routes>
        {APP_ROUTES.map((route) => {
          const Component = ROUTE_COMPONENTS[route.id];
          return <Route key={route.id} path={route.path} element={<Component />} />;
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
