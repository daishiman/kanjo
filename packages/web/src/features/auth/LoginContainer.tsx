/**
 * ログイン画面の状態と API の呼び出し (§7.3・§7.4・§7.15)。表示は LoginView に任せる。
 *
 * URL から読むもの: next (ログイン後の移動先。BR-12 で同じオリジンの相対パスに限る)、
 * error=google (Google から失敗で戻った)、email (招待の承諾から来たときの入れておく値)。
 * 履歴の state から読むもの: /mfa などから戻したときの理由 (notice)。
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api.js';
import { LoginView } from './LoginView.js';
import type { RequestKind } from './RequestDialog.js';
import { type SignInResponse, postAuth, startGoogle } from './auth-client.js';
import { externalNavigation } from './external-navigation.js';
import type { AuthFlowHandlers } from './flow.js';
import { noticeOf } from './flow.js';
import {
  MESSAGES,
  loginErrorMessage,
  normalizeEmail,
  retryAfterSeconds,
  sanitizeNext,
} from './view-model.js';

export function LoginContainer({ onFlow, onAuthenticated }: AuthFlowHandlers) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const next = sanitizeNext(params.get('next'));
  const googleFailed = params.get('error') === 'google';

  const [email, setEmail] = useState(() => params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState(() =>
    googleFailed ? MESSAGES.googleFailed : (noticeOf(location.state) ?? ''),
  );
  const [locked, setLocked] = useState(false);
  const [invalidFields, setInvalidFields] = useState({ email: false, password: false });
  const [dialog, setDialog] = useState<RequestKind | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const authenticating = useRef(false);

  // Google の失敗は1回知らせたら URL から error だけを消す。再読込や共有で同じ失敗を出し直さない
  useEffect(() => {
    if (!googleFailed) return;
    const rest = new URLSearchParams(location.search);
    rest.delete('error');
    const search = rest.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [googleFailed, location.pathname, location.search, navigate]);

  // ロック中は主ボタンを待ち時間だけ無効にする。時間が来たら自然に戻す
  const lockTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(lockTimer.current), []);
  const lockFor = (seconds: number): void => {
    clearTimeout(lockTimer.current);
    setLocked(true);
    lockTimer.current = setTimeout(() => setLocked(false), seconds * 1000);
  };

  async function submitPassword(): Promise<void> {
    const missingEmail = !email.trim();
    const missingPassword = !password;
    if (missingEmail || missingPassword) {
      setInvalidFields({ email: missingEmail, password: missingPassword });
      setError(
        missingEmail && missingPassword
          ? MESSAGES.credentialsRequired
          : missingEmail
            ? MESSAGES.emailRequired
            : MESSAGES.passwordRequired,
      );
      (missingEmail ? emailRef : passwordRef).current?.focus();
      return;
    }
    // ref で共通に弾き、Google とパスワードの二重開始も同じ描画内で防ぐ
    if (authenticating.current || locked) return;
    authenticating.current = true;
    setBusy('password');
    setError('');
    setInvalidFields({ email: false, password: false });
    try {
      const result = await postAuth<SignInResponse>('/auth/sign-in/email', {
        email: normalizeEmail(email),
        password,
        rememberMe: remember,
      });
      // 平文を state に残さない。成功後の再描画まで保持する理由がない
      setPassword('');
      if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
        onFlow({ kind: 'verify', next });
      } else if ('mfaSetupRequired' in result && result.mfaSetupRequired) {
        onFlow({ kind: 'setup', setupToken: result.setupToken, expiresAt: result.expiresAt, next });
      } else {
        await onAuthenticated(next);
      }
    } catch (err) {
      setError(loginErrorMessage(err));
      const credentialsInvalid = err instanceof ApiError && err.status === 401;
      setInvalidFields({ email: credentialsInvalid, password: credentialsInvalid });
      if (err instanceof ApiError && err.status === 429) lockFor(retryAfterSeconds(err) ?? 60);
      if (err instanceof ApiError && err.status === 401) {
        setPassword('');
        passwordRef.current?.focus();
      }
    } finally {
      authenticating.current = false;
      setBusy(null);
    }
  }

  async function signInWithGoogle(): Promise<void> {
    if (authenticating.current) return;
    authenticating.current = true;
    setBusy('google');
    setError('');
    setInvalidFields({ email: false, password: false });
    try {
      const { url } = await startGoogle(
        { callbackURL: next, errorCallbackURL: '/login?error=google' },
        remember,
      );
      // 認可画面へ移るまでボタンは送信中のまま。戻る操作で戻ってきたら画面ごと作り直される
      externalNavigation.assign(url);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503 ? MESSAGES.notConfigured : MESSAGES.googleFailed,
      );
      authenticating.current = false;
      setBusy(null);
    }
  }

  return (
    <LoginView
      email={email}
      password={password}
      remember={remember}
      error={error}
      invalidEmail={invalidFields.email}
      invalidPassword={invalidFields.password}
      busy={busy !== null}
      submitting={busy === 'password'}
      locked={locked}
      emailRef={emailRef}
      passwordRef={passwordRef}
      onEmail={(value) => {
        setEmail(value);
        setInvalidFields((current) => ({ ...current, email: false }));
      }}
      onPassword={(value) => {
        setPassword(value);
        setInvalidFields((current) => ({ ...current, password: false }));
      }}
      onRemember={setRemember}
      onSubmit={() => void submitPassword()}
      onForgot={() => setDialog('reset')}
      googleBusy={busy === 'google'}
      onGoogle={() => void signInWithGoogle()}
      dialog={dialog}
      onResend={() => setDialog('resend')}
      onCloseDialog={() => setDialog(null)}
    />
  );
}
