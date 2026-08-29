// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaxYearPicker, TaxYearProvider, parseStoredTaxYear, useTaxYear } from './tax-year.js';

function Probe() {
  const { year, withTaxYear } = useTaxYear();
  return <output>{`${year}|${withTaxYear('/tax/overview')}`}</output>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('確定申告の対象年', () => {
  it('2000〜2099の西暦だけを保存値として受ける', () => {
    expect(parseStoredTaxYear('2025')).toBe('2025');
    for (const value of [null, 'all', '1999', '2100', '2025-01', ' 2025 '])
      expect(parseStoredTaxYear(value)).toBeNull();
  });

  it('分析用の全期間/任意期間と混ぜず、全APIへyearだけを付ける', () => {
    localStorage.setItem('kanjo:tax-year', '2025');
    render(
      <TaxYearProvider>
        <Probe />
      </TaxYearProvider>,
    );
    expect(screen.getByText('2025|/tax/overview?year=2025')).toBeTruthy();
  });

  it('申告対象年の選択を共有し、変更直後からAPI境界へ反映する', () => {
    localStorage.setItem('kanjo:tax-year', '2025');
    render(
      <TaxYearProvider>
        <TaxYearPicker years={['2026', '2025']} />
        <Probe />
      </TaxYearProvider>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: '申告対象年' }), {
      target: { value: '2026' },
    });
    expect(screen.getByText('2026|/tax/overview?year=2026')).toBeTruthy();
    expect(localStorage.getItem('kanjo:tax-year')).toBe('2026');
  });
});
