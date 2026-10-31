import { ICONS, Icon } from './icons.js';

/**
 * 安心3項目 (§7.7)。飾りではなく規範で、文言の中身は本仕様の他の節が事実にしている
 * (暗号化は HTTPS と Secure Cookie、MFA と不正ログイン対策は FR-21・FR-22、分離は FR-28)。
 */
const ITEMS = [
  {
    icon: ICONS.shieldCheck,
    label: 'セキュリティについて',
    note: '全通信を暗号化し、MFAと不正ログイン対策で保護します',
  },
  {
    icon: ICONS.lock,
    label: 'プライバシーについて',
    note: 'ログイン情報は認証と保護の用途に限って使用します',
  },
  {
    icon: ICONS.fileText,
    label: 'お客様のデータについて',
    note: '認証情報とテナント内データを分離して管理します',
  },
] as const;

export function TrustList() {
  return (
    <section className="login-trust" aria-labelledby="login-trust-heading">
      <h2 id="login-trust-heading">安心してご利用いただくために</h2>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.label}>
            <Icon>{item.icon}</Icon>
            <span className="login-trust-label">{item.label}</span>
            <span className="login-trust-note">{item.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
