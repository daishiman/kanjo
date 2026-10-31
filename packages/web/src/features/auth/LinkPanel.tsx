import { ICONS, Icon } from './icons.js';

/** 連携の囲み (§7.6)。操作は持たない。連携の入口は設定画面のアカウント欄 (UC-9) */
export function LinkPanel() {
  return (
    <div className="login-link">
      <p className="login-link-lead">
        <Icon>{ICONS.link}</Icon>
        <strong>
          同じメールアドレスでGoogleとパスワードを登録した場合は、1つのアカウントとして安全に連携します。
        </strong>
      </p>
      <p>連携時は再認証とメール確認が必要です。</p>
    </div>
  );
}
