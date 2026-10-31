// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccessibleTabs } from './AccessibleTabs.js';

const ITEMS = [
  { id: 'basis', label: '提案の根拠' },
  { id: 'data', label: '関連データ' },
  { id: 'history', label: '変更履歴' },
] as const;

function Harness() {
  const [value, setValue] = useState<(typeof ITEMS)[number]['id']>('basis');
  return (
    <AccessibleTabs
      ariaLabel="詳細の表示"
      idPrefix="trial-tab"
      items={ITEMS}
      value={value}
      onChange={setValue}
      ariaControls={(id) => `trial-panel-${id}`}
    />
  );
}

afterEach(cleanup);

describe('AccessibleTabs', () => {
  it('選択状態とtabpanelの対応をARIAへ出し、クリックで選択を変える', () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');

    expect(screen.getByRole('tablist', { name: '詳細の表示' })).toBeTruthy();
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('aria-controls')).toBe('trial-panel-basis');
    expect(tabs[0]?.tabIndex).toBe(0);
    expect(tabs[1]?.tabIndex).toBe(-1);

    fireEvent.click(screen.getByRole('tab', { name: '関連データ' }));
    expect(screen.getByRole('tab', { name: '関連データ' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '提案の根拠' }).tabIndex).toBe(-1);
  });

  it('左右キーは循環し、HomeとEndは端へ移動してフォーカスも追随する', () => {
    render(<Harness />);
    const basis = screen.getByRole('tab', { name: '提案の根拠' });
    basis.focus();

    fireEvent.keyDown(basis, { key: 'ArrowLeft' });
    const history = screen.getByRole('tab', { name: '変更履歴' });
    expect(history.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(history);

    fireEvent.keyDown(history, { key: 'Home' });
    expect(basis.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(basis);

    fireEvent.keyDown(basis, { key: 'End' });
    expect(history.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(history);

    fireEvent.keyDown(history, { key: 'ArrowRight' });
    expect(basis.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(basis);
  });
});
