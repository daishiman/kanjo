// @vitest-environment jsdom

/**
 * 二重計上の疑いの見え方。
 * 「気づかせるが数え直さない」ことと、月の絞り込みと足並みが揃うことを固定する。架空データのみ。
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CashDealDuplicate, CashEntry } from './api.js';
import { CashDuplicateNotice } from './pages/Cash.js';

const entry = (over: Partial<CashEntry> = {}): CashEntry => ({
  id: 1,
  date: '2026-07-10',
  month: '2026-07',
  side: 'biz',
  io: 'expense',
  amount: 5000,
  description: '架空商工会議所 定例会',
  categoryMajor: '会議費',
  categoryMid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  attachmentCount: 0,
  ...over,
});

const dup = (over: Partial<CashDealDuplicate> = {}): CashDealDuplicate => ({
  cashEntryId: 1,
  cashDate: '2026-07-10',
  deal: { date: '2026-07-10', partner: '架空商工会議所', accountNorm: '会議費', amount: 5000 },
  confidence: 'same_day',
  dayGap: 0,
  ...over,
});

afterEach(cleanup);

describe('二重計上の疑いの知らせ', () => {
  it('疑いが無ければ何も出さない', () => {
    const { container } = render(<CashDuplicateNotice duplicates={[]} entries={[entry()]} />);
    expect(container.textContent).toBe('');
  });

  it('件数と両方の中身を出す', () => {
    render(<CashDuplicateNotice duplicates={[dup()]} entries={[entry()]} />);
    expect(screen.getByText('二重計上の疑い 1件')).toBeTruthy();
    const item = screen.getByRole('listitem');
    expect(item.textContent).toContain('架空商工会議所 定例会');
    expect(item.textContent).toContain('会議費');
    expect(item.textContent).toContain('¥5,000');
  });

  it('同日と日付ちがいを見分けられる形で出す', () => {
    render(
      <CashDuplicateNotice
        duplicates={[dup(), dup({ cashEntryId: 2, confidence: 'near_day', dayGap: 2 })]}
        entries={[entry(), entry({ id: 2 })]}
      />,
    );
    expect(screen.getByText('同日')).toBeTruthy();
    expect(screen.getByText('2日ちがい')).toBeTruthy();
  });

  it('自動で消し込まないことを文面で伝える', () => {
    render(<CashDuplicateNotice duplicates={[dup()]} entries={[entry()]} />);
    expect(screen.getByText(/どちらか一方だけを残してください/)).toBeTruthy();
  });

  it('表に無い記帳の疑いは出さない(月の絞り込みと足並みを揃える)', () => {
    render(<CashDuplicateNotice duplicates={[dup({ cashEntryId: 99 })]} entries={[entry()]} />);
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
