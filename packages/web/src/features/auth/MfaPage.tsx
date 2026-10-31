/**
 * /mfa (§7.10)。ログインの途中 (AuthFlow) を App のメモリから受け取り、コード入力か設定を描く。
 *
 * 途中の状態が無い (再読込・直接開いた)、または設定トークンの期限 (10分) を過ぎたら、
 * 「もう一度ログインしてください。」を履歴の state に載せて /login へ戻す。トークンは URL にも storage にも置かない。
 */
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { PublicCard } from './PublicCard.js';
import { postAuth } from './auth-client.js';
import { FormAlert } from './fields.js';
import type { AuthFlow, AuthFlowHandlers, LoginNotice } from './flow.js';
import { BackupCodes, TotpCodeField, TotpEnrollment, type TotpStart } from './mfa-components.js';
import { MESSAGES, lockedMessage, loginPathFor, retryAfterSeconds } from './view-model.js';

type Setup = Extract<AuthFlow, { kind: 'setup' }>;

const isExpired = (flow: Setup): boolean => {
  const at = Date.parse(flow.expiresAt);
  return Number.isNaN(at) || at <= Date.now();
};

/**
 * setTimeout の待ち時間は 32bit 符号付き整数 (約24.8日) を超えると 0 に丸められ、即座に発火する。
 * 期限が遠い (試験の固定値など) ときに「期限切れ」で戻してしまわないよう、上限で止める
 */
const MAX_TIMER_MS = 2 ** 31 - 1;
const untilExpiry = (expiresAt: string): number =>
  Math.min(MAX_TIMER_MS, Math.max(0, Date.parse(expiresAt) - Date.now()));

/** /login へ戻す。next を保ったまま、理由を履歴の state で渡す */
function useBackToLogin(next: string) {
  const navigate = useNavigate();
  return (notice: string): void => {
    const state: LoginNotice = { notice };
    navigate(loginPathFor(next), { replace: true, state });
  };
}

/** ロック中の主ボタンの無効化。ログイン画面と同じく、待ち時間が過ぎたら自然に戻す */
function useLock() {
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const lockFor = (seconds: number): void => {
    clearTimeout(timer.current);
    setLocked(true);
    timer.current = setTimeout(() => setLocked(false), seconds * 1000);
  };
  return { locked, lockFor };
}

export function MfaPage({
  flow,
  onAuthenticated,
}: { flow: AuthFlow | null } & Pick<AuthFlowHandlers, 'onAuthenticated'>) {
  if (!flow || (flow.kind === 'setup' && isExpired(flow))) {
    const state: LoginNotice = { notice: MESSAGES.relogin };
    return <Navigate to={flow ? loginPathFor(flow.next) : '/login'} replace state={state} />;
  }
  return flow.kind === 'verify' ? (
    <MfaVerify next={flow.next} onAuthenticated={onAuthenticated} />
  ) : (
    <MfaSetup flow={flow} onAuthenticated={onAuthenticated} />
  );
}

function MfaVerify({ next, onAuthenticated }: { next: string } & Pick<AuthFlowHandlers, 'onAuthenticated'>) {
  const backToLogin = useBackToLogin(next);
  const backupId = useId();
  const [backup, setBackup] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { locked, lockFor } = useLock();

  const switchMode = (): void => {
    setBackup((current) => !current);
    setCode('');
    setError('');
  };

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || locked || !code.trim()) return;
    setBusy(true);
    setError('');
    try {
      await postAuth(backup ? '/auth/two-factor/verify-backup-code' : '/auth/two-factor/verify-totp', {
        code: code.trim(),
      });
      await onAuthenticated(next);
    } catch (err) {
      setCode('');
      if (err instanceof ApiError && err.code === 'INVALID_TWO_FACTOR_COOKIE') {
        backToLogin(MESSAGES.twoFactorExpired);
        return;
      }
      if (err instanceof ApiError && err.status === 429) {
        setError(lockedMessage(err));
        lockFor(retryAfterSeconds(err) ?? 60);
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError(MESSAGES.invalidCode);
      } else {
        setError(MESSAGES.network);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicCard labelledBy="mfa-heading">
      <div className="login-heading-block">
        <h1 id="mfa-heading">2段階認証</h1>
        <p>
          {backup
            ? '保存しておいた復旧コードを1つ入力してください。使った復旧コードは使えなくなります。'
            : '認証アプリに表示されている6桁のコードを入力してください。'}
        </p>
      </div>
      <form
        className="login-form"
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-labelledby="mfa-heading"
      >
        {error && <FormAlert>{error}</FormAlert>}
        {backup ? (
          <div className="login-field">
            <label htmlFor={backupId}>復旧コード</label>
            <Input
              id={backupId}
              autoComplete="one-time-code"
              autoCapitalize="off"
              spellCheck={false}
              required
              readOnly={busy}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
        ) : (
          <TotpCodeField code={code} disabled={busy} onCode={setCode} />
        )}
        <Button
          type="submit"
          variant="primary"
          className="login-submit"
          disabled={busy || locked}
          aria-busy={busy || undefined}
        >
          {busy ? '確認中…' : '確認'}
        </Button>
        <Button variant="text" className="login-forgot" onClick={switchMode}>
          {backup ? '認証アプリのコードを使う' : '復旧コードを使う'}
        </Button>
      </form>
    </PublicCard>
  );
}

function MfaSetup({ flow, onAuthenticated }: { flow: Setup } & Pick<AuthFlowHandlers, 'onAuthenticated'>) {
  const backToLogin = useBackToLogin(flow.next);
  const [start, setStart] = useState<TotpStart | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const { locked, lockFor } = useLock();

  const tokenRejected = (err: unknown): boolean =>
    err instanceof ApiError && err.code === 'mfa_setup_token_invalid';

  async function begin(): Promise<void> {
    setStart(null);
    try {
      setStart(await postAuth<TotpStart>('/auth/mfa-setup/start', { setupToken: flow.setupToken }));
    } catch (err) {
      if (tokenRejected(err)) backToLogin(MESSAGES.relogin);
      else setError(MESSAGES.network);
    }
  }

  // 開いたら1回だけ start を呼ぶ。StrictMode の二重実行で秘密鍵を作り直させない
  const begun = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 設定トークンごとに1回だけ始める
  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    void begin();
  }, []);

  // 期限 (10分) を過ぎたら戻す。復旧コードを出した後はセッションができているので戻さない
  // biome-ignore lint/correctness/useExhaustiveDependencies: 期限と表示の段階だけで決まる
  useEffect(() => {
    if (backupCodes) return;
    const timer = setTimeout(() => backToLogin(MESSAGES.relogin), untilExpiry(flow.expiresAt));
    return () => clearTimeout(timer);
  }, [flow.expiresAt, backupCodes]);

  async function complete(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || locked || !start || !code.trim()) return;
    setBusy(true);
    setError('');
    try {
      // 保持の指定はサーバがトークンの行に持つ (design-decisions 3.3)。ここからは送り直さない
      const result = await postAuth<{ backupCodes: string[] }>('/auth/mfa-setup/complete', {
        setupToken: flow.setupToken,
        code: code.trim(),
      });
      setBackupCodes(result.backupCodes);
    } catch (err) {
      setCode('');
      if (tokenRejected(err)) {
        backToLogin(MESSAGES.relogin);
      } else if (err instanceof ApiError && err.status === 409) {
        // start の前 (または秘密鍵が失われた) の complete。QR から出し直す
        await begin();
      } else if (err instanceof ApiError && err.status === 429) {
        setError(lockedMessage(err));
        lockFor(retryAfterSeconds(err) ?? 60);
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError(MESSAGES.invalidCode);
      } else {
        setError(MESSAGES.network);
      }
    } finally {
      setBusy(false);
    }
  }

  const [leaving, setLeaving] = useState(false);
  async function saved(): Promise<void> {
    setLeaving(true);
    await onAuthenticated(flow.next);
  }

  return (
    <PublicCard labelledBy="mfa-heading">
      <div className="login-heading-block">
        <h1 id="mfa-heading">2段階認証の設定</h1>
        <p>管理者は、2段階認証の設定を終えるまでログインできません。</p>
      </div>
      {backupCodes ? (
        <BackupCodes codes={backupCodes} busy={leaving} onSaved={() => void saved()} />
      ) : (
        <>
          <TotpEnrollment start={start} />
          <form
            className="login-form"
            onSubmit={(event) => void complete(event)}
            noValidate
            aria-labelledby="mfa-heading"
          >
            {error && <FormAlert>{error}</FormAlert>}
            <TotpCodeField code={code} disabled={busy} onCode={setCode} />
            <Button
              type="submit"
              variant="primary"
              className="login-submit"
              disabled={busy || locked || !start}
              aria-busy={busy || undefined}
            >
              {busy ? '確認中…' : '設定を完了'}
            </Button>
          </form>
        </>
      )}
    </PublicCard>
  );
}
