/**
 * 未認証で入れる経路 (§7.16)。/login・/mfa・/invite/accept・/reset-password・/help・/privacy の6つだけ。
 *
 * ログイン画面は最初に開かれるので同じ chunk に置き、それ以外は開いた人だけが読む (NFR-07 の初期 JS 予算)。
 */
import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { publicRoutePath, routePageTitle } from '../../routeMetadata.js';
import { LoginContainer } from './LoginContainer.js';
import type { AuthFlow, AuthFlowHandlers } from './flow.js';

const MfaPage = lazy(() => import('./MfaPage.js').then((m) => ({ default: m.MfaPage })));
const InviteAcceptPage = lazy(() =>
  import('./InviteAcceptPage.js').then((m) => ({ default: m.InviteAcceptPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./ResetPasswordPage.js').then((m) => ({ default: m.ResetPasswordPage })),
);
const HelpPage = lazy(() => import('./HelpPage.js').then((m) => ({ default: m.HelpPage })));
const PrivacyPage = lazy(() => import('./PrivacyPage.js').then((m) => ({ default: m.PrivacyPage })));

export interface PublicRoutesProps extends AuthFlowHandlers {
  flow: AuthFlow | null;
  /** 公開経路以外に来たときに描くもの。未認証なら /login?next= への置き換え、認証済みなら業務の枠 */
  fallback: JSX.Element;
}

export function PublicRoutes({ flow, onFlow, onAuthenticated, fallback }: PublicRoutesProps) {
  const { pathname } = useLocation();
  // 業務の枠の NavigationEffects はここでは動かない。タブ名だけは同じ正本から出す
  useEffect(() => {
    document.title = routePageTitle(pathname);
  }, [pathname]);
  return (
    <Suspense fallback={<div className="login-wrap">読み込み中…</div>}>
      <Routes>
        <Route
          path={publicRoutePath('login')}
          element={<LoginContainer onFlow={onFlow} onAuthenticated={onAuthenticated} />}
        />
        <Route
          path={publicRoutePath('mfa')}
          element={<MfaPage flow={flow} onAuthenticated={onAuthenticated} />}
        />
        <Route path={publicRoutePath('invite')} element={<InviteAcceptPage onFlow={onFlow} />} />
        <Route path={publicRoutePath('reset')} element={<ResetPasswordPage />} />
        <Route path={publicRoutePath('help')} element={<HelpPage />} />
        <Route path={publicRoutePath('privacy')} element={<PrivacyPage />} />
        <Route path="*" element={fallback} />
      </Routes>
    </Suspense>
  );
}
