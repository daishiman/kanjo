/**
 * 設定画面の「アカウント」欄 (spec-login-v2 §7.14・UC-9)。全利用者に出す。
 *
 * ここで扱うのは本人の認証手段だけ。管理者も他人の手段には触れない (auth-web の least privilege)。
 *   - 手段の追加は「現在のパスワードでの再認証 → 確認メール → リンクを開いて続き」の2段を経る (O5)
 *   - 解除は手段が2つあるときだけ。最後の1つは消せない
 *   - 2段階認証の無効化は一般利用者だけ。管理者は無効にできない (BR-10)
 *
 * 失敗の 401 (再認証の誤り) はこの欄の入力の誤りであって、セッション切れではない。
 * AUTH_EVENT を出さない postAuth で呼び、ログイン画面へ飛ばさない。
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ApiError, type AuthState, api } from '../api.js';
import { postAuth } from '../features/auth/auth-client.js';
import { externalNavigation } from '../features/auth/external-navigation.js';
import {
  FormAlert,
  NewPasswordFields,
  isNewPasswordReady,
  newPasswordProblem,
} from '../features/auth/fields.js';
import { BackupCodes, TotpCodeField, TotpEnrollment } from '../features/auth/mfa-components.js';
import { useTokenFromUrl } from '../features/auth/token-from-url.js';
import { MESSAGES, lockedMessage } from '../features/auth/view-model.js';
import { Button } from './Button.js';
import { PasswordInput } from './Input.js';

const ACCOUNT_MESSAGES = {
  linkMailSent: '確認メールを送りました。メールのリンクを開くと連携を続けられます。',
  linkUnavailable: 'この確認リンクは使えません。',
  alreadyLinked: 'この認証手段は登録済みです。',
  passwordAdded: 'パスワードを追加しました。',
  passwordChanged: 'パスワードを変更しました。この端末はそのまま利用できます。',
  twoFactorEnabled: '2段階認証を有効にしました。',
  twoFactorDisabled: '2段階認証を無効にしました。',
  adminCannotDisable: '管理者は2段階認証を無効にできません。',
} as const;

/** 開いている小さな操作。同時に開くのは1つだけにして、どのパスワード欄が何のためかを取り違えさせない */
type Panel = 'link' | 'enable' | 'disable' | 'regenerate' | null;

interface Enrollment {
  totpURI: string;
  backupCodes: string[];
}

/** 失敗を文言へ。どの操作でも同じ code は同じ言い方にする */
function accountErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return MESSAGES.requestFailed;
  if (err.status === 429) return lockedMessage(err);
  if (err.code === 'reauth_failed' || err.code === 'INVALID_PASSWORD') return MESSAGES.wrongCurrentPassword;
  if (err.code === 'INVALID_CODE') return MESSAGES.invalidCode;
  if (err.code === 'PASSWORD_TOO_SHORT') return MESSAGES.passwordTooShort;
  if (err.code === 'link_token_unavailable' || err.status === 404) return ACCOUNT_MESSAGES.linkUnavailable;
  if (err.code === 'already_linked') return ACCOUNT_MESSAGES.alreadyLinked;
  return err.message;
}

function CurrentPasswordField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="login-field">
      <label htmlFor={id}>現在のパスワード</label>
      <PasswordInput
        id={id}
        autoComplete="current-password"
        required
        readOnly={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** 現在のパスワードだけを受ける小さなフォーム。有効化・無効化・再発行・連携の開始が同じ形を使う */
function ReauthForm({
  label,
  submit,
  busy,
  needsPassword = true,
  children,
  onSubmit,
}: {
  label: string;
  submit: string;
  busy: boolean;
  needsPassword?: boolean;
  children?: ReactNode;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const handle = (event: FormEvent) => {
    event.preventDefault();
    if (busy || (needsPassword && !password)) return;
    onSubmit(password);
  };
  return (
    <form className="account-form" aria-label={label} onSubmit={handle}>
      {children}
      {needsPassword && <CurrentPasswordField value={password} disabled={busy} onChange={setPassword} />}
      <Button
        type="submit"
        variant="primary"
        disabled={busy || (needsPassword && !password)}
        aria-busy={busy || undefined}
      >
        {submit}
      </Button>
    </form>
  );
}

export function AccountSettings() {
  const qc = useQueryClient();
  const headingId = useId();
  const linkToken = useTokenFromUrl('link_token');
  const me = useQuery({
    queryKey: ['auth'],
    queryFn: () => api<AuthState>('/auth/me'),
    retry: false,
  });

  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [linkGrant, setLinkGrant] = useState<string | null>(null);
  const [grantPassword, setGrantPassword] = useState({ password: '', confirm: '' });
  const [change, setChange] = useState({ current: '', password: '', confirm: '' });

  /** 1つの操作を走らせ、成否を欄の上の1か所に出す。成功後は /auth/me を取り直して手段と状態を揃える */
  const run = async <T,>(task: () => Promise<T>, onDone: (result: T) => void): Promise<void> => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await task();
      onDone(result);
      void qc.invalidateQueries({ queryKey: ['auth'] });
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // 確認メールのリンク (?link_token=) から来たら、1回だけ消費して続きへ進む。StrictMode の二重実行でも1回
  const confirmed = useRef(false);
  // run は毎回作り直される関数だが、ここで見たいのは token の到着だけ
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上のとおり
  useEffect(() => {
    if (!linkToken || confirmed.current) return;
    confirmed.current = true;
    void run(
      async () => {
        const grant = await postAuth<{ target: 'google' | 'password'; linkGrant: string }>(
          '/account/link/confirm',
          {
            token: linkToken,
          },
        );
        if (grant.target === 'google') {
          const next = await postAuth<{ url: string }>(
            '/auth/link-social',
            { provider: 'google', callbackURL: '/settings' },
            { 'x-kanjo-link-grant': grant.linkGrant },
          );
          externalNavigation.assign(next.url);
        }
        return grant;
      },
      (grant) => {
        if (grant.target === 'password') setLinkGrant(grant.linkGrant);
      },
    );
  }, [linkToken]);

  const user = me.data?.user;
  if (!user) return null;

  const hasPassword = user.providers.includes('credential');
  const hasGoogle = user.providers.includes('google');
  const googleAccountId = user.authAccounts.find(({ providerId }) => providerId === 'google')?.id;
  const credentialAccountId = user.authAccounts.find(({ providerId }) => providerId === 'credential')?.id;
  const canUnlink = hasPassword && hasGoogle;
  const toggle = (next: Exclude<Panel, null>) => {
    setNotice('');
    setError('');
    setPanel((open) => (open === next ? null : next));
  };

  const changeProblem = newPasswordProblem(change.password, change.confirm);
  const grantProblem = newPasswordProblem(grantPassword.password, grantPassword.confirm);

  return (
    <section className="card account-settings" id="account" aria-labelledby={headingId}>
      <h2 id={headingId}>アカウント</h2>
      <p className="sub">{user.email}</p>

      {notice && <output className="notice">{notice}</output>}
      {error && <FormAlert>{error}</FormAlert>}

      <h3>認証手段</h3>
      <ul className="account-methods" aria-label="認証手段">
        <li>
          <span>パスワード</span>
          <span>{hasPassword ? '登録済み' : '未登録'}</span>
        </li>
        <li>
          <span>Google</span>
          <span>{hasGoogle ? '連携済み' : '未連携'}</span>
        </li>
      </ul>
      <div className="account-actions">
        {hasPassword && !hasGoogle && (
          <Button aria-expanded={panel === 'link'} onClick={() => toggle('link')}>
            Googleを連携
          </Button>
        )}
        {!hasPassword && (
          <Button aria-expanded={panel === 'link'} onClick={() => toggle('link')}>
            パスワードを追加
          </Button>
        )}
        {canUnlink && (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => postAuth('/auth/unlink-account', { accountId: googleAccountId }),
                  () => setNotice('Googleの連携を解除しました。'),
                )
              }
            >
              Googleの連携を解除
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => postAuth('/auth/unlink-account', { accountId: credentialAccountId }),
                  () => setNotice('パスワードの登録を解除しました。'),
                )
              }
            >
              パスワードの登録を解除
            </Button>
          </>
        )}
      </div>
      {panel === 'link' && (
        <ReauthForm
          label={hasPassword ? 'Googleを連携' : 'パスワードを追加'}
          submit="確認メールを送る"
          busy={busy}
          needsPassword={hasPassword}
          onSubmit={(currentPassword) =>
            void run(
              () =>
                postAuth(
                  '/account/link/start',
                  hasPassword ? { target: 'google', currentPassword } : { target: 'password' },
                ),
              () => {
                setPanel(null);
                setNotice(ACCOUNT_MESSAGES.linkMailSent);
              },
            )
          }
        >
          <p className="login-note">
            {hasPassword
              ? '本人確認のため、現在のパスワードを入力してください。確認メールのリンクから Google の連携を続けます。'
              : '確認メールのリンクから、新しいパスワードを設定します。'}
          </p>
        </ReauthForm>
      )}
      {linkGrant && (
        <form
          className="account-form"
          aria-label="パスワードを設定"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || !isNewPasswordReady(grantPassword.password, grantPassword.confirm)) return;
            void run(
              () =>
                postAuth('/account/link/password', { token: linkGrant, newPassword: grantPassword.password }),
              () => {
                setLinkGrant(null);
                setGrantPassword({ password: '', confirm: '' });
                setNotice(ACCOUNT_MESSAGES.passwordAdded);
              },
            );
          }}
        >
          {grantProblem && <FormAlert>{grantProblem}</FormAlert>}
          <NewPasswordFields
            password={grantPassword.password}
            confirm={grantPassword.confirm}
            disabled={busy}
            onPassword={(password) => setGrantPassword((draft) => ({ ...draft, password }))}
            onConfirm={(confirm) => setGrantPassword((draft) => ({ ...draft, confirm }))}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !isNewPasswordReady(grantPassword.password, grantPassword.confirm)}
          >
            パスワードを設定
          </Button>
        </form>
      )}

      <h3>2段階認証</h3>
      <p>{`2段階認証: ${user.twoFactorEnabled ? '設定済み' : '未設定'}`}</p>
      <div className="account-actions">
        {!user.twoFactorEnabled && hasPassword && !enrollment && (
          <Button aria-expanded={panel === 'enable'} onClick={() => toggle('enable')}>
            2段階認証を有効にする
          </Button>
        )}
        {user.twoFactorEnabled && user.role !== 'admin' && hasPassword && (
          <Button aria-expanded={panel === 'disable'} onClick={() => toggle('disable')}>
            2段階認証を無効にする
          </Button>
        )}
        {user.twoFactorEnabled && hasPassword && (
          <Button aria-expanded={panel === 'regenerate'} onClick={() => toggle('regenerate')}>
            復旧コードを再発行
          </Button>
        )}
      </div>
      {user.twoFactorEnabled && user.role === 'admin' && (
        <p className="login-note">{ACCOUNT_MESSAGES.adminCannotDisable}</p>
      )}
      {!hasPassword && <p className="login-note">2段階認証の設定には、パスワードの登録が必要です。</p>}

      {panel === 'enable' && !enrollment && (
        <ReauthForm
          label="2段階認証を有効にする"
          submit="次へ"
          busy={busy}
          onSubmit={(password) =>
            void run(
              () => postAuth<Enrollment>('/auth/two-factor/enable', { password }),
              (result) => {
                setPanel(null);
                setEnrollCode('');
                setEnrollment(result);
              },
            )
          }
        />
      )}
      {enrollment && (
        <div className="account-enroll">
          <TotpEnrollment start={{ totpURI: enrollment.totpURI }} />
          <BackupCodes codes={enrollment.backupCodes} />
          <form
            className="account-form"
            aria-label="初回の確認コード"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || enrollCode.length !== 6) return;
              void run(
                () => postAuth('/auth/two-factor/verify-totp', { code: enrollCode }),
                () => {
                  setEnrollment(null);
                  setNotice(ACCOUNT_MESSAGES.twoFactorEnabled);
                },
              );
            }}
          >
            <TotpCodeField code={enrollCode} disabled={busy} onCode={setEnrollCode} />
            <Button type="submit" variant="primary" disabled={busy || enrollCode.length !== 6}>
              設定を完了
            </Button>
          </form>
        </div>
      )}
      {panel === 'disable' && (
        <ReauthForm
          label="2段階認証を無効にする"
          submit="無効にする"
          busy={busy}
          onSubmit={(password) =>
            void run(
              () => postAuth('/auth/two-factor/disable', { password }),
              () => {
                setPanel(null);
                setNotice(ACCOUNT_MESSAGES.twoFactorDisabled);
              },
            )
          }
        />
      )}
      {panel === 'regenerate' && (
        <ReauthForm
          label="復旧コードを再発行"
          submit="再発行する"
          busy={busy}
          onSubmit={(password) =>
            void run(
              () =>
                postAuth<{ backupCodes: string[] }>('/auth/two-factor/generate-backup-codes', { password }),
              (result) => {
                setPanel(null);
                setFreshCodes(result.backupCodes);
              },
            )
          }
        />
      )}
      {freshCodes && <BackupCodes codes={freshCodes} onSaved={() => setFreshCodes(null)} />}

      {hasPassword && (
        <>
          <h3>パスワードの変更</h3>
          <form
            className="account-form"
            aria-label="パスワードの変更"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || !change.current || !isNewPasswordReady(change.password, change.confirm)) return;
              void run(
                () =>
                  postAuth('/auth/change-password', {
                    currentPassword: change.current,
                    newPassword: change.password,
                    // 他の端末のログインは切り、この端末は新しいセッションで続ける (§7.14)
                    revokeOtherSessions: true,
                  }),
                () => {
                  setChange({ current: '', password: '', confirm: '' });
                  setNotice(ACCOUNT_MESSAGES.passwordChanged);
                },
              );
            }}
          >
            {changeProblem && <FormAlert>{changeProblem}</FormAlert>}
            <CurrentPasswordField
              value={change.current}
              disabled={busy}
              onChange={(current) => setChange((draft) => ({ ...draft, current }))}
            />
            <NewPasswordFields
              password={change.password}
              confirm={change.confirm}
              disabled={busy}
              onPassword={(password) => setChange((draft) => ({ ...draft, password }))}
              onConfirm={(confirm) => setChange((draft) => ({ ...draft, confirm }))}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !change.current || !isNewPasswordReady(change.password, change.confirm)}
            >
              パスワードを変更
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
