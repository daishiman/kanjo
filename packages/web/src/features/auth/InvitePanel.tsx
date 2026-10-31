import { Button } from '../../components/Button.js';
import { ICONS, Icon } from './icons.js';

/** 招待の囲み (§7.5)。操作は再送の依頼だけ。承諾はメールのリンク (/invite/accept) から始まる */
export function InvitePanel({ onResend }: { onResend: () => void }) {
  return (
    <section className="login-invite" aria-labelledby="login-invite-heading">
      <h2 id="login-invite-heading">
        <Icon>{ICONS.mail}</Icon>
        招待を受けた方
      </h2>
      <p>招待メールのリンクから、Googleアカウントまたはメール＋パスワードを選んで登録を完了してください。</p>
      <p>管理者が仮パスワードを設定することはありません。</p>
      <Button className="login-invite-resend" onClick={onResend}>
        招待メールを再送
      </Button>
      <p className="login-note">アカウントはテナント管理者からの招待で作成されます。</p>
    </section>
  );
}
