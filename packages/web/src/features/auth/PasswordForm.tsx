/**
 * メールアドレスとパスワードのフォーム (§7.4)。状態は持たず、LoginContainer から受け取る。
 *
 * 失敗の文言 (alert) はフォームの先頭に1か所だけ置き、401・429・503・Google の失敗・戻ってきた理由で共用する。
 * 場所が1つなら、どの失敗でも読み上げと視線の行き先が変わらない。
 */
import { type FormEvent, type KeyboardEvent, type RefObject, useId } from 'react';
import { Button } from '../../components/Button.js';
import { Input, PasswordInput } from '../../components/Input.js';
import { SelectionCheckbox } from '../../components/SelectionCheckbox.js';
import { FormAlert } from './fields.js';

export interface PasswordFormProps {
  email: string;
  password: string;
  remember: boolean;
  error: string;
  invalidEmail: boolean;
  invalidPassword: boolean;
  busy: boolean;
  submitting: boolean;
  locked: boolean;
  emailRef: RefObject<HTMLInputElement>;
  passwordRef: RefObject<HTMLInputElement>;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onRemember: (value: boolean) => void;
  onSubmit: () => void;
  onForgot: () => void;
}

export function PasswordForm(props: PasswordFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();
  const rememberNoteId = useId();
  const errorId = useId();
  const { busy, submitting, locked, error, invalidEmail, invalidPassword } = props;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    props.onSubmit();
  };
  /** Ctrl + Enter (macOS は ⌘ + Enter) でも送る。入力欄から手を離さずに完了できるようにする */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      props.onSubmit();
    }
  };

  return (
    <form
      className="login-form"
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      aria-labelledby="login-form-heading"
    >
      <h2 id="login-form-heading" className="login-form-heading">
        メールアドレスとパスワードでログイン
      </h2>
      {error && <FormAlert id={errorId}>{error}</FormAlert>}
      <div className="login-field">
        <label htmlFor={emailId}>メールアドレス</label>
        <Input
          ref={props.emailRef}
          id={emailId}
          kind="email"
          inputMode="email"
          autoComplete="email"
          required
          // 初期フォーカスはここ。毎回同じ位置から始められるようにする
          autoFocus
          readOnly={busy}
          value={props.email}
          onChange={(event) => props.onEmail(event.target.value)}
          aria-invalid={invalidEmail || undefined}
          aria-describedby={invalidEmail ? errorId : undefined}
          placeholder="you@example.com"
        />
      </div>
      <div className="login-field">
        <label htmlFor={passwordId}>パスワード</label>
        <PasswordInput
          ref={props.passwordRef}
          id={passwordId}
          autoComplete="current-password"
          required
          readOnly={busy}
          value={props.password}
          onChange={(event) => props.onPassword(event.target.value)}
          aria-invalid={invalidPassword || undefined}
          aria-describedby={invalidPassword ? errorId : undefined}
        />
      </div>
      <div className="login-remember">
        <SelectionCheckbox
          className="login-remember-control"
          id={rememberId}
          label="次回からもログイン状態を保持する"
          checked={props.remember}
          disabled={busy}
          aria-describedby={rememberNoteId}
          onChange={(event) => props.onRemember(event.target.checked)}
        />
        {/* 既定ONの帰結を隠さない。30日という長さは開示した上で選んでもらう */}
        <p id={rememberNoteId} className="login-remember-note">
          保持する場合は30日間、しない場合は12時間でログイン状態が切れます
        </p>
      </div>
      <Button
        type="submit"
        variant="primary"
        className="login-submit"
        disabled={busy || locked}
        aria-busy={submitting || undefined}
      >
        {submitting ? '確認中…' : 'ログイン'}
      </Button>
      <Button variant="text" className="login-forgot" disabled={busy} onClick={props.onForgot}>
        パスワードをお忘れの方
      </Button>
    </form>
  );
}
