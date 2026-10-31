import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthenticatedApp } from './AuthenticatedApp.js';
import { AUTH_EVENT, type AuthState, api } from './api.js';
import { installDiagnostics } from './diagnostics-buffer.js';
import { PublicRoutes } from './features/auth/PublicRoutes.js';
import type { AuthFlow } from './features/auth/flow.js';
import { loginPathFor, sanitizeNext } from './features/auth/view-model.js';
import { isPublicRoute, publicRoutePolicy } from './routeMetadata.js';

// 収集は最初の描画より前に始める。エラーは「改善を送る」ボタンを押す前に起きているため、
// useEffect まで待つと肝心の1件目を取り逃がす。二重 install は buffer 側が弾く
installDiagnostics();

/** 認証状態と稼働状態の他は、前の利用者の結果を次の利用者へ見せない */
const KEEP_ACROSS_SIGN_IN = new Set(['auth', 'service-status']);

export function App() {
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [loggedOut, setLoggedOut] = useState(false);
  /*
   * ログインの途中の状態 (§7.16)。MFA の設定トークンもここにだけ置き、URL・storage・history.state に出さない。
   * 再読込で消えるのは意図どおりで、/mfa は「もう一度ログインしてください。」で /login へ戻す。
   */
  const [flow, setFlow] = useState<AuthFlow | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const me = useQuery({
    queryKey: ['auth'],
    queryFn: () => api<AuthState>('/auth/me'),
    retry: false,
  });

  useEffect(() => {
    const onUnauthorized = () => setLoggedOut(true);
    window.addEventListener(AUTH_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_EVENT, onUnauthorized);
  }, []);

  // ログインの経路を出たら途中の状態を捨てる。戻る操作で古いトークンの画面を描き直させない
  useEffect(() => {
    if (publicRoutePolicy(location.pathname)?.preserveSignInFlow) return;
    setFlow(null);
    setReturnTo(null);
  }, [location.pathname]);

  const onFlow = useCallback(
    (next: AuthFlow) => {
      setFlow(next);
      navigate('/mfa');
    },
    [navigate],
  );

  const onAuthenticated = useCallback(
    async (next: string) => {
      // flow はここでは消さない。認証状態の取り直しが遅れて届く間に、/mfa が「途中の状態が無い」と読んで
      // /login へ戻してしまう。経路を出たときに上の effect が消す
      setReturnTo(next);
      setLoggedOut(false);
      qc.removeQueries({ predicate: (query) => !KEEP_ACROSS_SIGN_IN.has(String(query.queryKey[0])) });
      await qc.refetchQueries({ queryKey: ['auth'] });
    },
    [qc],
  );

  if (me.isLoading) {
    return <div className="login-wrap">ログイン状態を確認中…</div>;
  }

  const { pathname, search } = location;
  const authenticated = !loggedOut && !me.isError && me.data?.authenticated === true;
  if (authenticated) {
    const policy = publicRoutePolicy(pathname);
    if (policy?.authenticated === 'return') {
      return <Navigate to={returnTo ?? sanitizeNext(new URLSearchParams(search).get('next'))} replace />;
    }
    // 復旧コードを出している間は、窓のフォーカスなどで認証状態が先に届いても画面を保つ
    if (policy?.authenticated === 'mfa' && !(flow && returnTo === null)) {
      return <Navigate to={returnTo ?? '/'} replace />;
    }
    // 招待の承諾と再設定はログアウト中の操作とする (§7.16)
    if (policy?.authenticated === 'home') return <Navigate to="/" replace />;
    if (!isPublicRoute(pathname)) return <AuthenticatedApp />;
  }

  // 認証前の画面はアプリ枠の外に出す。枠の中に置くと、未認証のままヘッダーや
  // サイドバーが業務APIを叩きにいく経路が残ってしまう。
  return (
    <PublicRoutes
      flow={flow}
      onFlow={onFlow}
      onAuthenticated={onAuthenticated}
      fallback={<Navigate to={loginPathFor(`${pathname}${search}`)} replace />}
    />
  );
}
