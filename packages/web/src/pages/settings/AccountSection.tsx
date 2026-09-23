/**
 * アカウントの節 (spec-settings-screen §7.11)。
 *
 * パスワードの変更と、admin にだけ見える利用者管理を旧画面から移して並べる。
 * どちらも保存バーとは別に、その場で確定する (設定の下書きには入らない)。
 */
import { useState } from 'react';
import { UserAdmin } from '../../components/UserAdmin.js';
import { PasswordChangeForm } from '../PasswordChange.js';

export function AccountSection() {
  const [passwordChanged, setPasswordChanged] = useState(false);
  return (
    <section className="settings-section settings-group" id="account" aria-labelledby="account-heading">
      <h2 id="account-heading" className="settings-group-heading">
        アカウント
      </h2>
      <section className="card" id="account-password" aria-labelledby="account-password-heading">
        <h3 id="account-password-heading">パスワードの変更</h3>
        {passwordChanged && (
          <output className="notice">パスワードを変更しました。この端末はそのまま利用できます。</output>
        )}
        <PasswordChangeForm forced={false} onDone={() => setPasswordChanged(true)} />
      </section>
      {/* 利用者管理は admin にだけ描画される */}
      <UserAdmin />
    </section>
  );
}
