/**
 * 認証前の画面で使い回す小さな部品。失敗の知らせと、新しいパスワードの2欄。
 */
import { type ReactNode, useId } from 'react';
import { PasswordInput } from '../../components/Input.js';
import { ICONS, Icon } from './icons.js';
import { MESSAGES, PASSWORD_MIN_LENGTH } from './view-model.js';

/** 失敗の文言。色だけに頼らず、アイコンと文言を並べる (§7.17) */
export function FormAlert({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="login-error" role="alert">
      <Icon>{ICONS.alert}</Icon>
      <span>{children}</span>
    </p>
  );
}

/**
 * 入力中の2欄から、送る前に分かる誤りを1つ返す。確認欄が空のうちは何も言わない (打っている途中で責めない)。
 * 強度の最終判定はサーバ (validatePasswordPolicy) が持ち、ここでは下限の長さだけを先に知らせる。
 */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (!confirm) return null;
  if (password !== confirm) return MESSAGES.passwordMismatch;
  if (password.length < PASSWORD_MIN_LENGTH) return MESSAGES.passwordTooShort;
  return null;
}

export const isNewPasswordReady = (password: string, confirm: string): boolean =>
  password.length > 0 && confirm.length > 0 && newPasswordProblem(password, confirm) === null;

/** 新しいパスワードと確認の2欄 (§7.11・§7.12)。どちらも new-password で、パスワード管理の生成を効かせる */
export function NewPasswordFields({
  password,
  confirm,
  disabled,
  onPassword,
  onConfirm,
}: {
  password: string;
  confirm: string;
  disabled: boolean;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
}) {
  const passwordId = useId();
  const confirmId = useId();
  const hintId = useId();
  return (
    <>
      <div className="login-field">
        <label htmlFor={passwordId}>新しいパスワード</label>
        <PasswordInput
          id={passwordId}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          readOnly={disabled}
          aria-describedby={hintId}
          value={password}
          onChange={(event) => onPassword(event.target.value)}
        />
        <p id={hintId} className="login-note">
          {PASSWORD_MIN_LENGTH}文字以上で設定してください。
        </p>
      </div>
      <div className="login-field">
        <label htmlFor={confirmId}>新しいパスワード（確認）</label>
        <PasswordInput
          id={confirmId}
          autoComplete="new-password"
          required
          readOnly={disabled}
          value={confirm}
          onChange={(event) => onConfirm(event.target.value)}
        />
      </div>
    </>
  );
}
