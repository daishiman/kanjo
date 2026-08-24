import { type FormEvent, useState } from 'react';
import { ApiError, api } from '../api.js';

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'access_mode') {
        setError('Cloudflare Access認証が有効です。Accessのログイン画面からアクセスしてください。');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('パスワードが違います');
      } else {
        setError('ログインに失敗しました。時間をおいて再度お試しください。');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>収支統合管理</h1>
        <p>金融明細を扱うため、ログインが必要です。</p>
        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="primary" disabled={busy || !password}>
            {busy ? '確認中…' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
