import { Button } from '../../components/Button.js';
import { GoogleG } from './icons.js';

/**
 * Google の認可を始めるボタン (§7.3)。白地・枠線の型で、主ボタン (teal) とは並べて区別する。
 * 押したら送信中として無効にし、二重に認可を始めない。
 */
export function GoogleButton({
  label,
  busy,
  disabled = busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button className="login-google" disabled={disabled} aria-busy={busy || undefined} onClick={onClick}>
      <GoogleG />
      {busy ? 'Googleへ移動中…' : label}
    </Button>
  );
}
