/**
 * freee 未決済(未入金・未払)の契約。
 * 決済列の無い取込を未決済に見せないこと、期日の急ぐ順に並ぶことを固定する。架空データのみ。
 */
import { describe, expect, it } from 'vitest';
import {
  DUE_SOON_DAYS,
  type FreeeDeal,
  freeePersistedRow,
  hasSettlementColumns,
  unsettledDeals,
  unsettledSummary,
} from '../src/index.js';

const TODAY = '2026-08-27';

const deal = (over: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-08',
  date: '2026-08-01',
  io: 'expense',
  partner: '架空印刷',
  accountRaw: '外注費',
  accountNorm: '外注費',
  amount: 30_000,
  dueDate: '2026-08-31',
  settledDate: null,
  settleAccount: null,
  settledAmount: null,
  ...over,
});

/** 決済列の無い時期の取込(4つのキーが存在しない) */
const legacyDeal = (): FreeeDeal => ({
  month: '2026-01',
  date: '2026-01-10',
  io: 'expense',
  partner: '架空印刷',
  accountRaw: '外注費',
  accountNorm: '外注費',
  amount: 30_000,
});

describe('決済列の有無', () => {
  it('列の無い取込は未決済判定の対象外', () => {
    expect(hasSettlementColumns(legacyDeal())).toBe(false);
    expect(unsettledDeals([legacyDeal()], TODAY)).toEqual([]);
  });

  it('列はあるが全部空欄なら、期日なしの未決済として扱う', () => {
    const d = deal({ dueDate: null });
    expect(hasSettlementColumns(d)).toBe(true);
    expect(unsettledDeals([d], TODAY)[0]).toMatchObject({ status: 'no_due', daysOverdue: 0 });
  });
});

describe('未決済の抽出', () => {
  it('支払日が入っていれば一覧から外す', () => {
    expect(unsettledDeals([deal({ settledDate: '2026-08-20' })], TODAY)).toEqual([]);
  });

  it('支払日が空なら残額つきで拾う', () => {
    expect(unsettledDeals([deal()], TODAY)[0]).toMatchObject({ remaining: 30_000, dueDate: '2026-08-31' });
  });

  it('一部だけ支払金額が入っていても、支払日が空なら残額で拾う', () => {
    expect(unsettledDeals([deal({ settledAmount: 10_000 })], TODAY)[0]?.remaining).toBe(20_000);
  });

  it('残額が無くなったものは拾わない', () => {
    expect(unsettledDeals([deal({ settledAmount: 30_000 })], TODAY)).toEqual([]);
  });
});

describe('期日の状態', () => {
  it('期日を過ぎたら overdue と超過日数を持つ', () => {
    const row = unsettledDeals([deal({ dueDate: '2026-08-20' })], TODAY)[0];
    expect(row).toMatchObject({ status: 'overdue', daysOverdue: 7 });
  });

  it('当日は期日超過にしない', () => {
    expect(unsettledDeals([deal({ dueDate: TODAY })], TODAY)[0]?.status).toBe('due_soon');
  });

  it('期日まで一定日数以内は due_soon、それ以降は scheduled', () => {
    const soon = deal({ dueDate: '2026-09-03' }); // 7日後
    const later = deal({ dueDate: '2026-09-04' }); // 8日後
    expect(DUE_SOON_DAYS).toBe(7);
    expect(unsettledDeals([soon], TODAY)[0]?.status).toBe('due_soon');
    expect(unsettledDeals([later], TODAY)[0]?.status).toBe('scheduled');
  });
});

describe('並び順', () => {
  it('急ぐ順(超過 → 期日が近い → 期日待ち → 期日なし)に並ぶ', () => {
    const rows = unsettledDeals(
      [
        deal({ dueDate: null, partner: 'なし' }),
        deal({ dueDate: '2026-09-30', partner: '先' }),
        deal({ dueDate: '2026-08-20', partner: '超過' }),
        deal({ dueDate: '2026-08-29', partner: '近い' }),
      ],
      TODAY,
    );
    expect(rows.map((r) => r.deal.partner)).toEqual(['超過', '近い', '先', 'なし']);
  });

  it('期日超過どうしは、長く放置しているものが先', () => {
    const rows = unsettledDeals(
      [deal({ dueDate: '2026-08-25', partner: '2日' }), deal({ dueDate: '2026-08-10', partner: '17日' })],
      TODAY,
    );
    expect(rows.map((r) => r.deal.partner)).toEqual(['17日', '2日']);
  });
});

describe('未決済の集計', () => {
  it('未払・未入金・期日超過を分けて数える', () => {
    const rows = unsettledDeals(
      [
        deal({ io: 'expense', amount: 30_000, dueDate: '2026-08-20' }),
        deal({ io: 'expense', amount: 10_000, dueDate: '2026-09-30' }),
        deal({ io: 'income', amount: 50_000, dueDate: '2026-08-01' }),
      ],
      TODAY,
    );
    expect(unsettledSummary(rows)).toEqual({
      payable: { count: 2, amount: 40_000 },
      receivable: { count: 1, amount: 50_000 },
      overdue: { count: 2, amount: 80_000 },
    });
  });
});

describe('保存行への射影', () => {
  it('決済列の有無を settlementKnown として持ち越す', () => {
    expect(freeePersistedRow(deal()).at(-1)).toBe(1);
    expect(freeePersistedRow(legacyDeal()).at(-1)).toBe(0);
  });

  it('決済内容が変われば別の保存行になる(再取込で据え置かれない)', () => {
    const before = freeePersistedRow(deal());
    const after = freeePersistedRow(deal({ settledDate: '2026-08-25' }));
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  });
});
