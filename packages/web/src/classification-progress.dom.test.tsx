// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TransactionsResponse } from './api.js';
import { ClassificationProgressPanel } from './pages/Classify.js';

const summary = (over: Partial<TransactionsResponse['summary']> = {}): TransactionsResponse['summary'] => ({
  month: '2026-07',
  count: 10,
  totalIncome: 300_000,
  bizIncome: 200_000,
  personalIncome: 100_000,
  totalExpense: 150_000,
  bizExpense: 50_000,
  personalExpense: 100_000,
  incomeByOwner: { business: 100_000, spouse: 0, family: 0, unset: 0 },
  progress: {
    total: 10,
    bizCount: 3,
    personalCount: 7,
    bySource: { 手動: 2, ルール: 4, 既定: 4 },
    reviewPending: 4,
  },
  editedCount: 2,
  conflictCount: 0,
  noInstitutionCount: 0,
  ...over,
});

/** 説明枠にも同じ語(事業/個人)が出るため、KPI カードのラベルだけを対象にする。 */
const kpi = (label: string): HTMLElement => {
  const found = screen
    .getAllByText(label)
    .find((el) => el.classList.contains('label') && el.closest('.kpi') !== null);
  if (!found) throw new Error(`KPI カード「${label}」が見つからない`);
  return found.closest('.kpi') as HTMLElement;
};

afterEach(cleanup);

describe('月別の仕分けサマリー', () => {
  it('対象月を見出しに出す', () => {
    render(<ClassificationProgressPanel summary={summary()} month="2026-07" />);
    expect(screen.getByRole('heading', { name: '2026年7月の仕分け' })).toBeTruthy();
  });

  it('事業と個人を件数と金額の両方で出す', () => {
    render(<ClassificationProgressPanel summary={summary()} month="2026-07" />);
    expect(within(kpi('事業')).getByText('3件')).toBeTruthy();
    expect(within(kpi('事業')).getByText(/入金 ¥200,000 \/ 立替 ¥50,000/)).toBeTruthy();
    expect(within(kpi('個人')).getByText('7件')).toBeTruthy();
    expect(within(kpi('個人')).getByText(/収入 ¥100,000 \/ 支出 ¥100,000/)).toBeTruthy();
  });

  it('確認済みは総数から未確認を引いた件数で、出どころの内訳を添える', () => {
    render(<ClassificationProgressPanel summary={summary()} month="2026-07" />);
    expect(within(kpi('確認済み')).getByText('6件')).toBeTruthy();
    expect(within(kpi('確認済み')).getByText('手動 2件 / ルール 4件')).toBeTruthy();
  });

  it('未確認が残っていれば既定で個人に入っている旨を注意書きする', () => {
    render(<ClassificationProgressPanel summary={summary()} month="2026-07" />);
    expect(within(kpi('未確認')).getByText('4件')).toBeTruthy();
    expect(screen.getByText(/未確認の 4 件は、判断がまだ無いため既定の「個人」として集計/)).toBeTruthy();
  });

  it('未確認が 0 なら注意書きを出さず一巡した旨を示す', () => {
    render(
      <ClassificationProgressPanel
        summary={summary({
          progress: {
            total: 10,
            bizCount: 3,
            personalCount: 7,
            bySource: { 手動: 6, ルール: 4, 既定: 0 },
            reviewPending: 0,
          },
        })}
        month="2026-07"
      />,
    );
    expect(within(kpi('未確認')).getByText('当月は一巡しました')).toBeTruthy();
    expect(screen.queryByText(/既定の「個人」として集計/)).toBeNull();
  });

  it('仕分けの考え方を折りたたみで置く', () => {
    render(<ClassificationProgressPanel summary={summary()} month="2026-07" />);
    const details = screen.getByText('仕分けの考え方').closest('details');
    expect(details).toBeTruthy();
    expect((details as HTMLDetailsElement).open).toBe(false);
    expect(within(details as HTMLElement).getByText(/この支払いが無かったら仕事が回らないか/)).toBeTruthy();
  });

  it('月が未選択なら summary の月へ落ちる', () => {
    render(<ClassificationProgressPanel summary={summary()} month={null} />);
    expect(screen.getByRole('heading', { name: '2026年7月の仕分け' })).toBeTruthy();
  });
});
