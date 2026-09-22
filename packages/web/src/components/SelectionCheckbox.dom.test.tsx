// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionCheckbox } from './SelectionCheckbox.js';

describe('SelectionCheckbox', () => {
  it('表示ラベルとnative checkboxの意味を一体にする', () => {
    const onChange = vi.fn();
    render(<SelectionCheckbox label="対象を選ぶ" checked={false} onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox', { name: '対象を選ぶ' });
    fireEvent.click(screen.getByText('対象を選ぶ'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(checkbox.closest('label')?.classList.contains('selection-checkbox')).toBe(true);
  });

  it('ラベル非表示でも名前を保ち、disabledとindeterminateをnativeへ渡す', () => {
    const { rerender } = render(
      <SelectionCheckbox label="表示中をすべて選択" labelHidden checked={false} onChange={() => {}} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: '表示中をすべて選択' }) as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(false);
    expect(checkbox.closest('label')?.classList.contains('selection-checkbox--icon-only')).toBe(true);

    rerender(
      <SelectionCheckbox
        label="表示中をすべて選択"
        labelHidden
        checked={false}
        indeterminate
        disabled
        onChange={() => {}}
      />,
    );
    expect(checkbox.indeterminate).toBe(true);
    expect(checkbox.disabled).toBe(true);
  });

  it('inputのclick handlerを保持する', () => {
    const parent = vi.fn();
    render(
      <div onClick={parent} onKeyDown={parent}>
        <SelectionCheckbox
          label="行を選択"
          labelHidden
          checked={false}
          onChange={() => {}}
          onClick={(event) => event.stopPropagation()}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: '行を選択' }));
    expect(parent).not.toHaveBeenCalled();
  });
});
