/**
 * /invite/accept (§7.11)。招待のメールと役割を見せ、Google かパスワードで登録を完了させる。
 *
 * 使えない招待 (期限切れ・承諾済み・取消・不明・token 無し) は1種類の文言に畳み、どれに当たったかを見せない。
 * 管理者として招待された人は、パスワードで登録した直後に MFA の設定 (/mfa) へ進む (decision-005)。
 */
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api.js';
import { Button } from '../../components/Button.js';
import { GoogleButton } from './GoogleButton.js';
import { PublicCard } from './PublicCard.js';
import { postAuth, startGoogle } from './auth-client.js';
import { externalNavigation } from './external-navigation.js';
import { FormAlert, NewPasswordFields, isNewPasswordReady, newPasswordProblem } from './fields.js';
import type { AuthFlowHandlers } from './flow.js';
import { useTokenFromUrl } from './token-from-url.js';
import { MESSAGES, ROLE_LABEL } from './view-model.js';

interface Invitation {
  email: string;
  role: keyof typeof ROLE_LABEL;
  expiresAt: string;
}

type AcceptResponse =
  | { next: 'login'; email: string }
  | { next: 'mfa_setup'; setupToken: string; expiresAt: string };

type Inspect =
  | { state: 'loading' }
  | { state: 'ready'; invitation: Invitation }
  | { state: 'failed'; message: string };

function acceptErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return MESSAGES.requestFailed;
  if (err.status === 409) return MESSAGES.userExists;
  if (err.status === 404 || err.status === 410) return MESSAGES.inviteUnavailable;
  // 強度の規則はサーバの validatePasswordPolicy が持つ。文言もサーバの日本語をそのまま出す
  if (err.code === 'weak_password') return err.message;
  return MESSAGES.requestFailed;
}

export function InviteAcceptPage({ onFlow }: Pick<AuthFlowHandlers, 'onFlow'>) {
  const location = useLocation();
  const navigate = useNavigate();
  const [googleMismatch] = useState(
    () => new URLSearchParams(location.search).get('error') === 'google_mismatch',
  );
  const token = useTokenFromUrl();
  const [inspect, setInspect] = useState<Inspect>(() =>
    token ? { state: 'loading' } : { state: 'failed', message: MESSAGES.inviteUnavailable },
  );

  // 招待の中身は token を本文で送って読む (URL に載せ直さない)。StrictMode の二重実行でも1回にする
  const inspected = useRef(false);
  useEffect(() => {
    if (!token || inspected.current) return;
    inspected.current = true;
    postAuth<Invitation>('/auth/invite/inspect', { token })
      .then((invitation) => setInspect({ state: 'ready', invitation }))
      .catch((err: unknown) =>
        setInspect({
          state: 'failed',
          message: err instanceof ApiError ? MESSAGES.inviteUnavailable : MESSAGES.requestFailed,
        }),
      );
  }, [token]);

  const [choice, setChoice] = useState<'password' | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);

  async function signUpWithGoogle(): Promise<void> {
    if (busy) return;
    setBusy('google');
    setError('');
    try {
      const { url } = await startGoogle({
        callbackURL: '/',
        errorCallbackURL: '/invite/accept?error=google_mismatch',
        requestSignUp: true,
      });
      externalNavigation.assign(url);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503 ? MESSAGES.notConfigured : MESSAGES.googleFailed,
      );
      setBusy(null);
    }
  }

  async function signUpWithPassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !token || !isNewPasswordReady(password, confirm)) return;
    setBusy('password');
    setError('');
    try {
      const result = await postAuth<AcceptResponse>('/auth/invite/accept', { token, password });
      setPassword('');
      setConfirm('');
      if (result.next === 'mfa_setup') {
        onFlow({ kind: 'setup', setupToken: result.setupToken, expiresAt: result.expiresAt, next: '/' });
      } else {
        navigate(`/login?${new URLSearchParams({ email: result.email })}`, { replace: true });
      }
    } catch (err) {
      setError(acceptErrorMessage(err));
      setBusy(null);
    }
  }

  const problem = newPasswordProblem(password, confirm);

  return (
    <PublicCard labelledBy="invite-heading">
      <div className="login-heading-block">
        <h1 id="invite-heading">招待の承諾</h1>
        <p>登録の方法を選んでください。どちらで登録しても、あとから設定画面でもう一方を連携できます。</p>
      </div>
      {googleMismatch ? (
        <>
          <FormAlert>{MESSAGES.inviteGoogleMismatch}</FormAlert>
          <p className="login-note">招待メールのリンクをもう一度開いて、登録し直してください。</p>
        </>
      ) : inspect.state === 'failed' ? (
        <FormAlert>{inspect.message}</FormAlert>
      ) : inspect.state === 'loading' ? (
        <output className="login-note">招待を確認しています…</output>
      ) : (
        <>
          <dl className="login-invitation">
            <div>
              <dt>メールアドレス</dt>
              <dd>{inspect.invitation.email}</dd>
            </div>
            <div>
              <dt>役割</dt>
              <dd>{ROLE_LABEL[inspect.invitation.role] ?? inspect.invitation.role}</dd>
            </div>
          </dl>
          {inspect.invitation.role === 'admin' && (
            <p className="login-note">管理者は、登録のあとに2段階認証の設定が必要です。</p>
          )}
          {error && <FormAlert>{error}</FormAlert>}
          <div className="login-google-block">
            <GoogleButton
              label="Googleで登録"
              busy={busy === 'google'}
              onClick={() => void signUpWithGoogle()}
            />
            <p className="login-note">招待されたメールアドレスと同じGoogleアカウントを選んでください。</p>
          </div>
          <p className="login-or">
            <span>または</span>
          </p>
          {choice === 'password' ? (
            <form
              className="login-form"
              onSubmit={(event) => void signUpWithPassword(event)}
              noValidate
              aria-label="パスワードで登録"
            >
              {problem && <FormAlert>{problem}</FormAlert>}
              <NewPasswordFields
                password={password}
                confirm={confirm}
                disabled={busy === 'password'}
                onPassword={setPassword}
                onConfirm={setConfirm}
              />
              <Button
                type="submit"
                variant="primary"
                className="login-submit"
                disabled={busy !== null || !isNewPasswordReady(password, confirm)}
                aria-busy={busy === 'password' || undefined}
              >
                {busy === 'password' ? '登録中…' : '登録する'}
              </Button>
            </form>
          ) : (
            <Button className="login-submit" onClick={() => setChoice('password')}>
              メールアドレスとパスワードで登録
            </Button>
          )}
        </>
      )}
      <p className="login-back">
        <Link to="/login">ログイン画面へ</Link>
      </p>
    </PublicCard>
  );
}
