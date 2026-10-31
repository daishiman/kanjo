import type { CSSProperties, ChangeEventHandler, ComponentPropsWithoutRef, ReactNode } from 'react';

export type SelectionCheckboxProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'children' | 'checked' | 'onChange' | 'className' | 'style'
> & {
  label: ReactNode;
  labelHidden?: boolean;
  checked: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  indeterminate?: boolean;
  className?: string;
  inputClassName?: string;
  style?: CSSProperties;
};

/**
 * 全画面共通の選択 checkbox。
 * 見た目の20pxと44pxの操作領域を分け、native inputの意味・フォーカス・フォーム挙動は残す。
 */
export function SelectionCheckbox({
  label,
  labelHidden = false,
  checked,
  onChange,
  indeterminate = false,
  className,
  inputClassName,
  style,
  ...inputProps
}: SelectionCheckboxProps) {
  const rootClass = [
    'selection-checkbox',
    labelHidden ? 'selection-checkbox--icon-only' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const nativeClass = ['selection-checkbox__native', inputClassName ?? ''].filter(Boolean).join(' ');

  return (
    <label className={rootClass} style={style}>
      <input
        {...inputProps}
        ref={(node) => {
          if (node) node.indeterminate = indeterminate;
        }}
        type="checkbox"
        className={nativeClass}
        checked={checked}
        onChange={onChange}
      />
      <span className="selection-checkbox__indicator" aria-hidden="true" />
      <span className={labelHidden ? 'visually-hidden' : 'selection-checkbox__label'}>{label}</span>
    </label>
  );
}
