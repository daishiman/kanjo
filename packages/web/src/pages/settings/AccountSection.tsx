/** 本人の認証手段と、管理者だけが使える招待管理。その場で確定し、設定の下書きには含めない。 */
import { AccountSettings } from '../../components/AccountSettings.js';
import { UserAdmin } from '../../components/UserAdmin.js';

export function AccountSection() {
  return (
    <div className="settings-section settings-group">
      <AccountSettings />
      <UserAdmin />
    </div>
  );
}
