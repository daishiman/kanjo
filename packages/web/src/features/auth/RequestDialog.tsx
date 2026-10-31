/**
 * 招待メールの再送・パスワード再設定の依頼ダイアログ (§7.9)。2つは同じ部品で、違いは文言と送り先だけ。
 *
 * 受付の文言は宛先の有無でもロックの有無 (429) でも変えない。変えると、ここから在籍の有無を探れてしまう。
 * 通信そのものが失敗したときだけは「届いていない」ので、送り直せる形で知らせる。
 */
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { ApiError, api } from '../../api.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { FormAlert } from './fields.js';
import { MESSAGES, normalizeEmail } from './view-model.js';

export type RequestKind = 'reset' | 'resend';

const COPY: Record<RequestKind, { title: string; description: string; submit: string; path: string }> = {
  reset: {
    title: 'パスワードの再設定',
    description: '登録済みのメールアドレスに、パスワードを再設定するためのリンクを送ります。',
    submit: '再設定メールを送信',
    path: '/auth/password-reset/request',
  },
  resend: {
    title: '招待メールを再送',
    description: '招待されたメールアドレスに、招待メールを送り直します。',
    submit: '送信',
    path: '/auth/invite/resend-request',
  },
};

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

export function RequestDialog({
  kind,
  initialEmail,
  onClose,
}: {
  kind: RequestKind;
  initialEmail: string;
  onClose: () => void;
}) {
  const copy = COPY[kind];
  const titleId = useId();
  const emailId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'accepted' | 'failed'>('idle');

  // 開いたらメール欄へ。閉じたら、開く前にフォーカスのあった要素 (開いたボタン) へ戻す
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    emailRef.current?.focus();
    return () => opener?.focus();
  }, []);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (phase === 'sending' || phase === 'accepted' || !email.trim()) return;
    setPhase('sending');
    try {
      await api(copy.path, { method: 'POST', body: JSON.stringify({ email: normalizeEmail(email) }) });
      setPhase('accepted');
    } catch (err) {
      // サーバが何かを答えたなら、429 でも 400 でも受付として扱う (§7.9)
      setPhase(err instanceof ApiError ? 'accepted' : 'failed');
    }
  }

  /** フォーカスをダイアログの中に閉じ込める。端から端へだけ手で回し、途中はブラウザに任せる */
  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    // 選択子のグループ順で返す実装 (jsdom の nwsapi) があるので、文書順に並べ直してから端を決める
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="login-modal-backdrop">
      <dialog
        ref={dialogRef}
        open
        className="login-modal"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{copy.title}</h2>
        <p>{copy.description}</p>
        <form className="login-modal-form" onSubmit={submit} noValidate>
          <div className="login-field">
            <label htmlFor={emailId}>メールアドレス</label>
            <Input
              ref={emailRef}
              id={emailId}
              kind="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              readOnly={phase === 'sending'}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {phase === 'accepted' && <output className="login-accepted">{MESSAGES.accepted}</output>}
          {phase === 'failed' && <FormAlert>{MESSAGES.network}</FormAlert>}
          <Button type="submit" variant="primary" disabled={phase === 'sending' || phase === 'accepted'}>
            {copy.submit}
          </Button>
        </form>
        <Button variant="text" className="login-modal-close" onClick={onClose}>
          閉じる
        </Button>
      </dialog>
    </div>
  );
}
