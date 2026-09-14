import { type ButtonHTMLAttributes, forwardRef } from 'react';

/**
 * 共通ボタン(docs/design-system/requirements-baseline.md §3.2)。
 *
 * 見た目は styles.css の `.btn` / `.btn.primary` / `button.danger-btn` / `.linklike` / `button.mini` が持ち、
 * この部品はクラスの組み合わせだけを決める。新しい画面では `<button className="...">` を
 * 手書きせずこれを使う。既存画面は `btn` クラスを併記して同じ見た目に揃えている。
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';

/**
 * 共通 Button を通さない native button の例外。
 * 見た目ではなく、ARIA の composite widget 状態と一体の control だけに閉じる。
 * `common-shell-routes.dom.test.tsx` が全 TSX を走査し、未知の値と未標識の native button を拒否する。
 */
export const NATIVE_BUTTON_EXCEPTION_MARKERS = [
  'disclosure',
  'menu-trigger',
  'tab',
  'toggle',
  'sort',
] as const;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn primary',
  secondary: 'btn',
  danger: 'btn danger-btn',
  // 行を開くなど、ページ遷移しない「リンクに見える操作」。btn は操作領域44pxの契約だけを担う
  text: 'btn linklike',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 表の行内など、密に並ぶ場所の小さいボタン */
  size?: 'mini';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size, className, type = 'button', ...rest },
  ref,
) {
  const classes = [VARIANT_CLASS[variant], size, className].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={classes} data-component="Button" {...rest} />;
});
