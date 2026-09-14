import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AuthenticatedApp } from './AuthenticatedApp.js';
import { AUTH_EVENT, type AuthState, api } from './api.js';
import { installDiagnostics } from './diagnostics-buffer.js';
import { LoginPage } from './pages/Login.js';
import { PasswordChangePage } from './pages/PasswordChange.js';

// 収集は最初の描画より前に始める。エラーは改善要望ボタンを押す「前」に起きているため、
// useEffect まで待つと肝心の1件目を取り逃がす。二重 install は buffer 側が弾く
installDiagnostics();

export function App() {
  const qc = useQueryClient();
  const [loggedOut, setLoggedOut] = useState(false);

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

  if (me.isLoading) {
    return <div className="login-wrap">ログイン状態を確認中…</div>;
  }
  // 認証前の画面はアプリ枠の外に出す。枠の中に置くと、未認証のままヘッダーや
  // サイドバーが業務APIを叩きにいく経路が残ってしまう。
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
  /*
   * 一時パスワードのままの利用者は、変更するまでどの業務画面にも入れない。
   * ルータを持たない構成なので、遷移の抑止は URL ではなくこの分岐で表す。
   * 抑止の正本はサーバ側の must_change_password fence であり、これはその写し。
   */
  if (me.data?.user?.mustChangePassword) {
    return <PasswordChangePage forced onDone={() => void qc.invalidateQueries()} />;
  }

  return <AuthenticatedApp />;
}
