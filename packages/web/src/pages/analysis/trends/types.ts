import type { ExpenseScope, TrendCategoryRow, TrendsScreen } from '../../../api.js';

export type Scope = TrendsScreen['selection']['scope'];
export type Compare = TrendsScreen['selection']['compare'];
export type TrendSide = TrendCategoryRow['side'];

export const SCOPES: readonly { id: Scope; label: string }[] = [
  { id: 'business', label: '事業' },
  { id: 'household', label: '家計' },
  { id: 'total', label: '総合' },
];

export const COMPARES: readonly { id: Compare; label: string }[] = [
  { id: 'previous', label: '前期間' },
  { id: 'yoy', label: '前年' },
];

export const LEGACY_SCOPE: Record<Scope, ExpenseScope> = {
  total: 'all',
  business: 'biz',
  household: 'personal',
};

export interface UrlState {
  scope: Scope;
  metric: string | null;
  compare: Compare;
  month: string | null;
  category: string | null;
  side: TrendSide | null;
  payee: string | null;
}

export type Update = (patch: Partial<Record<keyof UrlState, string | null>>) => void;
