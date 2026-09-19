export interface SegmentOption<Value extends string> {
  id: Value;
  label: string;
}

/** 分析画面にだけある、同じ罫線・選択表現の tabs / toggle。 */
export function SegmentControl<Value extends string>({
  ariaLabel,
  kind,
  options,
  value,
  disabled = false,
  onChange,
}: {
  ariaLabel: string;
  kind: 'tabs' | 'toggle';
  options: readonly SegmentOption<Value>[];
  value: Value;
  disabled?: boolean;
  onChange: (value: Value) => void;
}) {
  const tabs = kind === 'tabs';
  return (
    <span className="segment" role={tabs ? 'tablist' : 'group'} aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = !disabled && option.id === value;
        // data-native-control と ARIA 状態は静的リテラルで書く。
        // common-shell-routes の契約ガードは marker と必要な ARIA 状態の一体性を
        // JSX の字面で検査するため、三項式で組み立てると分類できない。
        return tabs ? (
          <button
            key={option.id}
            type="button"
            data-native-control="tab"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            className={selected ? 'on' : ''}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ) : (
          <button
            key={option.id}
            type="button"
            data-native-control="toggle"
            aria-pressed={selected}
            disabled={disabled}
            className={selected ? 'on' : ''}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}
