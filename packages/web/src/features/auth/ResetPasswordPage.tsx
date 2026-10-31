/**
 * /reset-password (§7.12)。メールのリンクから来て、新しいパスワードを決める。
 * 使えないリンク (無効・期限切れ・token 無し) は1種類の文言にし、token が無ければ入力欄も出さない。
 */
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api.js';
import { Button } from '../../components/Button.js';
import { PublicCard } from './PublicCard.js';
import { postAuth } from './auth-client.js';
import { FormAlert, NewPasswordFields, isNewPasswordReady, newPasswordProblem } from './fields.js';
import { useTokenFromUrl } from './token-from-url.js';
import { MESSAGES } from './view-model.js';

function resetErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return MESSAGES.requestFailed;
  if (err.code === 'INVALID_TOKEN' || err.status === 404 || err.status === 410)
    return MESSAGES.resetUnavailable;
  if (err.code === 'PASSWORD_TOO_SHORT') return MESSAGES.passwordTooShort;
  if (err.code === 'weak_password') return err.message;
  return MESSAGES.requestFailed;
}

export function ResetPasswordPage() {
  const token = useTokenFromUrl();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !token || !isNewPasswordReady(password, confirm)) return;
    setBusy(true);
    setError('');
    try {
      await postAuth('/auth/reset-password', { token, newPassword: password });
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const problem = error || newPasswordProblem(password, confirm);

  return (
    <PublicCard labelledBy="reset-heading">
      <div className="login-heading-block">
        <h1 id="reset-heading">パスワードの再設定</h1>
        {token && !done && <p>新しいパスワードを入力してください。</p>}
      </div>
      {done ? (
        <output className="login-done">{MESSAGES.resetDone}</output>
      ) : token ? (
        <form
          className="login-form"
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-labelledby="reset-heading"
        >
          {problem && <FormAlert>{problem}</FormAlert>}
          <NewPasswordFields
            password={password}
            confirm={confirm}
            disabled={busy}
            onPassword={setPassword}
            onConfirm={setConfirm}
          />
          <Button
            type="submit"
            variant="primary"
            className="login-submit"
            disabled={busy || !isNewPasswordReady(password, confirm)}
            aria-busy={busy || undefined}
          >
            {busy ? '送信中…' : 'パスワードを再設定'}
          </Button>
        </form>
      ) : (
        <FormAlert>{MESSAGES.resetUnavailable}</FormAlert>
      )}
      <p className="login-back">
        <Link to="/login">ログインへ</Link>
      </p>
    </PublicCard>
  );
}
