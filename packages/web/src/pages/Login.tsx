/**
 * ログイン画面。認証前の唯一の画面なので、アプリ枠(ヘッダー・サイドバー・フッター)の
 * 外側に置く。枠の中に置くと、未認証のまま業務APIを叩く経路が残ってしまう。
 *
 * 情報の優先度は architecture/account-login-ui-ux.md の規範に従う。
 *   1. 資格情報の入力と送信  2. 失敗からの復帰導線  3. 安心3項目  4. 月次の流れ  5. ブランド
 * 狭幅で情報パネルを後ろへ回すのも、この順位から導いている。
 */
import { type FormEvent, type KeyboardEvent, type ReactNode, useId, useState } from 'react';
import { ApiError, api } from '../api.js';
import { Button } from '../components/Button.js';

/**
 * Lucide stroke icon の geometry を必要な分だけ写したもの (lucide-static v1.37.0 / ISC)。
 * アイコンは必ずテキストラベルと併記し、単独で意味を担わせない。
 */
const Icon = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const ICONS = {
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </>
  ),
  file: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.64 0 8.36 2.88 9.94 6.65a1 1 0 0 1 0 .7 12.2 12.2 0 0 1-2.28 3.4" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.64 16.12 7.36 19 12 19a10.9 10.9 0 0 0 4.4-.93" />
      <path d="m2 2 20 20" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
} as const;

/**
 * 安心3項目。装飾ではなく規範。「セキュリティを整えていることをUIで確認できる」という
 * 要件の実体がこの3つなので、情報優先度の第3位として固定し、削らない。
 */
const ASSURANCES = [
  {
    icon: ICONS.shield,
    label: 'セキュリティについて',
    note: '全通信を暗号化し、業界標準に基づいて保護します',
  },
  {
    icon: ICONS.lock,
    label: 'プライバシーについて',
    note: 'ログイン情報は認証と保護の用途に限って使用します',
  },
  {
    icon: ICONS.file,
    label: 'お客様のデータについて',
    note: '通常は外部送信せず、AI分析時だけ明細を含まない集計データを24時間の使い捨て経路で渡します',
  },
] as const;

export interface LoginSuccess {
  mustChangePassword: boolean;
}

/**
 * 資格情報エラーの見せ方。
 *
 * 「そのメールアドレスは存在しません」と返すのは利用者に親切だが、
 * 在籍しているアドレスの一覧を外から作れてしまう。サーバは不在・停止・相違を
 * 1つの応答に畳んでいるので、画面もその区別を再発明しない。
 */
function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    const retry = (err.body as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    const minutes = retry ? Math.ceil(retry / 60) : null;
    return minutes
      ? `試行回数の上限に達しました。約${minutes}分後にもう一度お試しください`
      : '試行回数の上限に達しました。時間をおいてもう一度お試しください';
  }
  if (err instanceof ApiError && err.status === 401) {
    return 'メールアドレスまたはパスワードが正しくありません。';
  }
  if (err instanceof ApiError && err.status === 503) {
    return '認証が未設定です。管理者にお問い合わせください';
  }
  return 'ログインに失敗しました。通信状況を確認してもう一度お試しください';
}

export function LoginPage({ onSuccess }: { onSuccess: (result: LoginSuccess) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ ok: true; user: { mustChangePassword: boolean } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember }),
      });
      // 平文を state に残さない。成功後の再描画まで保持する理由がない。
      setPassword('');
      onSuccess({ mustChangePassword: result.user.mustChangePassword });
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  /** Ctrl + Enter でも送信する。入力欄から手を離さずに完了できるようにする。 */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit(event);
  };

  return (
    <div className="login-page">
      {/* 認証前はカード1枚だけ。脇に説明パネルを置くとサイドバーに見え、
          ブランド見出しはヘッダーに見える。この画面に枠は一切持たせない */}
      <main className="login-main login-main-single">
        <section className="login-card" aria-labelledby="login-heading">
          <h1 id="login-heading">ログイン</h1>
          <p>登録済みのメールアドレスとパスワードでご利用いただけます。</p>
          <form onSubmit={submit} onKeyDown={onKeyDown} noValidate>
            <div className="login-field">
              <label htmlFor={emailId}>メールアドレス</label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="username"
                // 初期フォーカスはここ。毎回同じ位置から始められるようにする
                // biome-ignore lint/a11y/noAutofocus: 認証前の唯一の画面で、入力は必ずここから始まる
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
                placeholder="you@example.com"
              />
            </div>
            <div className="login-field">
              <label htmlFor={passwordId}>パスワード</label>
              <div className="login-password">
                {/* type を式にすると submit へ化けうる入力として UI 契約検査が拒否する。リテラル2択に分ける */}
                {revealed ? (
                  <input
                    id={passwordId}
                    type="text"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                ) : (
                  <input
                    id={passwordId}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                )}
                <button
                  type="button"
                  data-native-control="toggle"
                  aria-pressed={revealed}
                  className="login-reveal"
                  onClick={() => setRevealed((shown) => !shown)}
                >
                  <Icon>{revealed ? ICONS.eyeOff : ICONS.eye}</Icon>
                  <span>{revealed ? '隠す' : '表示'}</span>
                </button>
              </div>
            </div>
            {error && (
              <p className="login-error" role="alert">
                <Icon>{ICONS.alert}</Icon>
                <span>{error}</span>
              </p>
            )}
            <div className="login-remember">
              <input
                id={rememberId}
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <label htmlFor={rememberId}>
                次回からもログイン状態を保持する
                {/* 既定ONの帰結を隠さない。30日という長さは開示した上で選んでもらう */}
                <small>保持する場合は30日間、しない場合は12時間でログイン状態が切れます</small>
              </label>
            </div>
            <Button
              type="submit"
              variant="primary"
              className="login-submit"
              disabled={busy || !email || !password}
            >
              {busy ? '確認中…' : 'ログイン'}
            </Button>
            <p className="login-shortcut">
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd> でも送信できます
            </p>
          </form>
          <hr className="login-divider" />
          {/* 脇のパネルではなくカードの中。ここが「セキュリティを整えていることを
              画面で確かめられる」という要件の実体なので、枠を外しても残す */}
          <h2 className="login-assure-title">安心してご利用いただくために</h2>
          <ul className="login-assurances">
            {ASSURANCES.map((item) => (
              <li key={item.label}>
                <Icon>{item.icon}</Icon>
                <span className="login-assure-label">{item.label}</span>
                <span className="login-assure-note">{item.note}</span>
              </li>
            ))}
          </ul>
          <div className="login-help">
            <Button variant="text" className="link" onClick={() => setForgotOpen(true)}>
              パスワードをお忘れの方
            </Button>
            <a href="mailto:support@example.invalid">サポートに問い合わせる</a>
          </div>
        </section>
      </main>

      {forgotOpen && (
        <div className="login-modal-backdrop">
          {/* role="dialog" を付けた div ではなく実要素にする。見出しとの結び付けは aria-labelledby が担う */}
          <dialog open className="login-modal" aria-modal="true" aria-labelledby="forgot-title">
            <h2 id="forgot-title">パスワードをお忘れの場合</h2>
            {/* メール送信基盤を持たないため、自動再発行は提供しない。誰に頼めばよいかだけを示す */}
            <p>
              このシステムは再発行メールを送信しません。管理者に連絡して、一時パスワードの発行を受けてください。
            </p>
            <p>
              管理者は「設定 → 利用者管理」から再発行できます。一時パスワードは発行直後に1度だけ表示され、
              最初のログイン時に必ず変更します。
            </p>
            <Button variant="primary" onClick={() => setForgotOpen(false)}>
              閉じる
            </Button>
          </dialog>
        </div>
      )}
    </div>
  );
}
