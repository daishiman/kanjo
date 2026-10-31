/**
 * 共通の入力欄 (spec-login-v2 §7.1 frontend-web-006)。
 *
 * type は `kind` から字面の分岐で決める。`<input type={式}>` は submit へ化けうる入力として
 * UI 契約検査 (scripts/ui-contract-ast.mjs) が拒否するので、式を type へ渡す経路を持たない。
 * kind にボタン系 (submit・button・reset) を含めないのも同じ理由。押す操作は Button が担う。
 */
import { type InputHTMLAttributes, forwardRef, useState } from 'react';

export type InputKind = 'text' | 'email' | 'password';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  kind?: InputKind;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { kind = 'text', className, ...rest },
  ref,
) {
  const classes = ['input', className].filter(Boolean).join(' ');
  if (kind === 'email') return <input ref={ref} type="email" className={classes} {...rest} />;
  if (kind === 'password') return <input ref={ref} type="password" className={classes} {...rest} />;
  return <input ref={ref} type="text" className={classes} {...rest} />;
});

/**
 * 表示切替つきのパスワード欄。切替で値は保ったまま type だけを入れ替える。
 * 目のアイコン単独では意味を運ばせず、「表示 / 隠す」を必ず併記する (状態は aria-pressed でも伝える)。
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'kind'>>(
  function PasswordInput(props, ref) {
    const [revealed, setRevealed] = useState(false);
    return (
      <div className="password-field">
        <Input ref={ref} kind={revealed ? 'text' : 'password'} {...props} />
        <button
          type="button"
          data-native-control="toggle"
          aria-pressed={revealed}
          className="password-reveal"
          onClick={() => setRevealed((shown) => !shown)}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {revealed ? (
              <>
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.64 0 8.36 2.88 9.94 6.65a1 1 0 0 1 0 .7 12.2 12.2 0 0 1-2.28 3.4" />
                <path d="M6.61 6.61A13.5 13.5 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.64 16.12 7.36 19 12 19a10.9 10.9 0 0 0 4.4-.93" />
                <path d="m2 2 20 20" />
              </>
            ) : (
              <>
                <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          <span>{revealed ? '隠す' : '表示'}</span>
        </button>
      </div>
    );
  },
);
