/**
 * ログイン画面の表示 (§7.1 の 2〜9)。並びは画像 01-login-v2.png の上から下で、DOM 順もそれに揃える
 * (フォーカス順が見た目の順と食い違わないように)。状態は LoginContainer が持つ。
 */
import { GoogleButton } from './GoogleButton.js';
import { InvitePanel } from './InvitePanel.js';
import { LinkPanel } from './LinkPanel.js';
import { PasswordForm, type PasswordFormProps } from './PasswordForm.js';
import { PublicCard } from './PublicCard.js';
import { RequestDialog, type RequestKind } from './RequestDialog.js';
import { TrustList } from './TrustList.js';

export interface LoginViewProps extends PasswordFormProps {
  googleBusy: boolean;
  onGoogle: () => void;
  dialog: RequestKind | null;
  onResend: () => void;
  onCloseDialog: () => void;
}

export function LoginView(props: LoginViewProps) {
  const { googleBusy, onGoogle, dialog, onResend, onCloseDialog, ...form } = props;
  return (
    <PublicCard labelledBy="login-heading">
      <div className="login-heading-block">
        <h1 id="login-heading">ログイン</h1>
        <p>登録済みの認証方法でログインしてください。</p>
      </div>
      <div className="login-google-block">
        <GoogleButton label="Googleでログイン" busy={googleBusy} disabled={form.busy} onClick={onGoogle} />
        <p className="login-note">招待先と同じメールアドレスのGoogleアカウントを使用してください。</p>
      </div>
      <p className="login-or">
        <span>または</span>
      </p>
      <PasswordForm {...form} />
      <InvitePanel onResend={onResend} />
      <LinkPanel />
      <hr className="login-rule" />
      <TrustList />
      {dialog && <RequestDialog kind={dialog} initialEmail={form.email} onClose={onCloseDialog} />}
    </PublicCard>
  );
}
