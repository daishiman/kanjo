/**
 * パスワード変更。2つの入口を1つの画面で兼ねる。
 *   - 強制 (forced): 一時パスワードで入った直後。変更するまで他の画面へ進めない。
 *   - 任意: 設定画面からの自主的な変更。
 *
 * ルータを持たない構成なので、強制の「遷移させない」は URL ではなくレンダリング分岐で表す。
 * ただしこれは UI 上の抑止にすぎず、正本はサーバ側の must_change_password 判定。
 */
import { type FormEvent, useId, useState } from 'react';
import { ApiError, api } from '../api.js';

/** サーバの passwordPolicyError と同じ下限。画面は事前に伝えるだけで、判定の正本はサーバ。 */
export const PASSWORD_MIN_LENGTH = 12;

function changeErrorMessage(err: unknown): string {
  if (err instanceof ApiError && (err.status === 400 || err.status === 401)) return err.message;
  return 'パスワードを変更できませんでした。通信状況を確認してもう一度お試しください';
}

export interface PasswordChangeProps {
  forced: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

/** 強制画面と設定画面で共有する、パスワード入力・送信の唯一の実装。 */
export function PasswordChangeForm({ forced, onDone, onCancel }: PasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();

  // 確認欄の不一致だけは手元で判定する。サーバへ送っても区別できない失敗なので、
  // 往復させる意味がなく、送れば平文が1回多くネットワークへ出る。
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const ready = currentPassword.length > 0 && newPassword.length > 0 && !mismatch;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError('');
    try {
      await api(
        '/auth/password',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        { recoverableUnauthorizedCodes: ['invalid_credentials'] },
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onDone();
    } catch (err) {
      setError(changeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p>
        {forced
          ? '一時パスワードのままではご利用いただけません。ご自身のパスワードを設定してください。'
          : '現在のパスワードを確認したうえで、新しいパスワードへ変更します。'}
      </p>
      <form onSubmit={submit} noValidate>
        <div className="login-field">
          <label htmlFor={currentId}>現在のパスワード</label>
          <input
            id={currentId}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="login-field">
          <label htmlFor={newId}>新しいパスワード</label>
          <input
            id={newId}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <small>{PASSWORD_MIN_LENGTH}文字以上。推測されやすい語や同じ文字の繰り返しは使えません</small>
        </div>
        <div className="login-field">
          <label htmlFor={confirmId}>新しいパスワード(確認)</label>
          <input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={mismatch || undefined}
          />
        </div>
        {mismatch && (
          <p className="login-error" role="alert">
            確認用のパスワードが一致しません
          </p>
        )}
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary login-submit" disabled={busy || !ready}>
          {busy ? '変更中…' : 'パスワードを変更'}
        </button>
        {/* 強制変更では「あとで」を作らない。抜け道があると強制の意味が消える */}
        {!forced && onCancel && (
          <button type="button" className="link" onClick={onCancel}>
            変更せずに戻る
          </button>
        )}
      </form>
      <p className="login-shortcut">
        変更するとこの端末以外のログイン状態は無効になります。ほかの端末では入り直してください。
      </p>
    </>
  );
}

export function PasswordChangePage(props: PasswordChangeProps) {
  return (
    <div className="login-page">
      <main className="login-main login-main-single">
        <section className="login-card" aria-labelledby="password-change-heading">
          <h1 id="password-change-heading">パスワードの変更</h1>
          <PasswordChangeForm {...props} />
        </section>
      </main>
    </div>
  );
}
