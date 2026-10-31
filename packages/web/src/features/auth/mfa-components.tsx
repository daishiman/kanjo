import { Suspense, lazy, useId } from 'react';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { totpSecretOf } from './view-model.js';

const QrCode = lazy(() => import('./QrCode.js'));

export interface TotpStart {
  totpURI: string;
  secret?: string;
}

/** QR と手入力用の秘密鍵。初回設定とアカウント設定の双方で使うroute非依存部品。 */
export function TotpEnrollment({ start }: { start: TotpStart | null }) {
  if (!start) return <p className="login-note">QRコードを準備しています…</p>;
  const secret = start.secret || totpSecretOf(start.totpURI);
  return (
    <div className="login-enroll">
      <p>認証アプリでQRコードを読み取ってください。読み取れない場合は、次の秘密鍵を入力してください。</p>
      <Suspense fallback={<p className="login-note">QRコードを準備しています…</p>}>
        <QrCode value={start.totpURI} />
      </Suspense>
      {secret && (
        <p className="login-secret">
          <span>秘密鍵</span>
          <code>{secret}</code>
        </p>
      )}
    </div>
  );
}

/** 6桁のコード欄 (§7.10)。数字以外は入力の時点で落とす。 */
export function TotpCodeField({
  code,
  disabled,
  onCode,
}: {
  code: string;
  disabled: boolean;
  onCode: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="login-field">
      <label htmlFor={id}>確認コード</label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        readOnly={disabled}
        value={code}
        onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))}
      />
    </div>
  );
}

export function BackupCodes({
  codes,
  busy = false,
  onSaved,
}: {
  codes: readonly string[];
  busy?: boolean;
  onSaved?: () => void;
}) {
  const headingId = useId();
  return (
    <section className="login-backup" aria-labelledby={headingId}>
      <h2 id={headingId}>復旧コード</h2>
      <p>
        認証アプリを使えなくなったときに、1つずつ使えます。この画面を閉じると二度と表示されません。安全な場所に保存してください。
      </p>
      <ul className="login-backup-codes" aria-label="復旧コード">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      {onSaved && (
        <Button variant="primary" className="login-submit" disabled={busy} onClick={onSaved}>
          保存しました
        </Button>
      )}
    </section>
  );
}
