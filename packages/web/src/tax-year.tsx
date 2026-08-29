import type { TaxYear } from '@kanjo/core';
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'kanjo:tax-year';
const TAX_YEAR_RE = /^20\d{2}$/;

export function parseStoredTaxYear(value: string | null): TaxYear | null {
  return value && TAX_YEAR_RE.test(value) ? (value as TaxYear) : null;
}

const currentTaxYear = (): TaxYear => {
  const value = String(new Date().getFullYear());
  return (parseStoredTaxYear(value) ?? '2099') as TaxYear;
};

interface TaxYearContextValue {
  year: TaxYear;
  setYear: (year: TaxYear) => void;
  key: string;
  withTaxYear: (path: string) => string;
}

const TaxYearContext = createContext<TaxYearContextValue | null>(null);

export function TaxYearProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState<TaxYear>(() => {
    try {
      return parseStoredTaxYear(localStorage.getItem(STORAGE_KEY)) ?? currentTaxYear();
    } catch {
      return currentTaxYear();
    }
  });

  const setYear = useCallback((next: TaxYear) => {
    if (!parseStoredTaxYear(next)) return;
    setYearState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 保存できなくても、このセッション中は選択を維持する
    }
  }, []);

  const value = useMemo<TaxYearContextValue>(
    () => ({
      year,
      setYear,
      key: year,
      withTaxYear: (path) => `${path}${path.includes('?') ? '&' : '?'}year=${year}`,
    }),
    [year, setYear],
  );

  return <TaxYearContext.Provider value={value}>{children}</TaxYearContext.Provider>;
}

const FALLBACK_YEAR = currentTaxYear();
const FALLBACK: TaxYearContextValue = {
  year: FALLBACK_YEAR,
  setYear: () => {},
  key: FALLBACK_YEAR,
  withTaxYear: (path) => `${path}${path.includes('?') ? '&' : '?'}year=${FALLBACK_YEAR}`,
};

export const useTaxYear = (): TaxYearContextValue => useContext(TaxYearContext) ?? FALLBACK;

export function TaxYearPicker({ years }: { years: readonly string[] }) {
  const { year, setYear } = useTaxYear();
  const options = [
    ...new Set([year, ...years.filter((value): value is TaxYear => parseStoredTaxYear(value) !== null)]),
  ]
    .sort()
    .reverse();

  return (
    <span className="period-picker tax-year-picker">
      <label htmlFor="tax-year-select">申告対象年</label>
      <select
        id="tax-year-select"
        className="period-select"
        value={year}
        onChange={(event) => {
          const next = parseStoredTaxYear(event.target.value);
          if (next) setYear(next);
        }}
      >
        {options.map((value) => (
          <option key={value} value={value}>
            {value}年
          </option>
        ))}
      </select>
    </span>
  );
}
