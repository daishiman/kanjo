/**
 * /privacy (§7.13)。ログイン情報の扱いを静的に示す。期間の値は docs/data-schema.md と spec の FR から転記した。
 */
import { Link } from 'react-router-dom';
import { PublicCard } from './PublicCard.js';

export function PrivacyPage() {
  return (
    <PublicCard labelledBy="privacy-heading">
      <div className="login-heading-block">
        <h1 id="privacy-heading">プライバシー</h1>
        <p>ログインに関わる情報の扱いです。</p>
      </div>
      <article className="login-doc">
        <section>
          <h2>利用目的</h2>
          <p>ログイン情報は、本人の確認と、不正なログインからアカウントを守るためだけに使います。</p>
        </section>
        <section>
          <h2>保存するもの</h2>
          <ul>
            <li>メールアドレス</li>
            <li>パスワードのハッシュ（パスワードそのものは保存しません）</li>
            <li>ログイン状態（セッション）</li>
            <li>2段階認証の秘密鍵の暗号文と、復旧コード</li>
            <li>ログインの履歴などの監査記録</li>
          </ul>
        </section>
        <section>
          <h2>保存期間</h2>
          <ul>
            <li>ログイン状態: 保持する場合は30日、しない場合は12時間</li>
            <li>招待のリンク: 72時間</li>
            <li>パスワード再設定のリンク: 1時間</li>
            <li>2段階認証の設定の途中: 10分</li>
            <li>監査記録: 400日</li>
          </ul>
        </section>
        <section>
          <h2>外部送信先</h2>
          <ul>
            <li>Google: Googleでログインするときの認可と、IDトークンの検証</li>
            <li>Resend: 招待・再設定・連携の確認メールの送信（宛先のメールアドレスとメール本文）</li>
          </ul>
          <p>明細や金額などの業務データは、どちらにも送りません。</p>
        </section>
      </article>
      <p className="login-back">
        <Link to="/login">ログイン画面へ</Link>
      </p>
    </PublicCard>
  );
}
