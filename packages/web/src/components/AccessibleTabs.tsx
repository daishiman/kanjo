import { type KeyboardEvent, useRef } from 'react';

export interface AccessibleTabItem<T extends string> {
  id: T;
  label: string;
}

/**
 * 同じ面の表示内容を切り替える、小さなARIA tabs部品。
 *
 * 画面ごとの状態とtabpanelは呼出し側に残し、ここでは選択状態・roving tabindex・
 * 左右/Home/Endキーだけを共通化する。ページ遷移用のタブには使わない。
 */
export function AccessibleTabs<T extends string>({
  ariaLabel,
  idPrefix,
  items,
  value,
  onChange,
  ariaControls,
}: {
  ariaLabel: string;
  idPrefix: string;
  items: readonly AccessibleTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaControls: (value: T) => string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAt = (index: number) => {
    const item = items[index];
    if (!item) return;
    onChange(item.id);
    refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (items.length === 0) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next == null) return;
    event.preventDefault();
    selectAt(next);
  };

  return (
    <span className="segment" role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            data-native-control="tab"
            type="button"
            id={`${idPrefix}-${item.id}`}
            role="tab"
            aria-selected={selected}
            aria-controls={ariaControls(item.id)}
            tabIndex={selected ? 0 : -1}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={selected ? 'on' : undefined}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </span>
  );
}
