/**
 * 現金の記帳と freee 仕訳の二重計上検知の契約。
 * 消し込みはせず候補を出すだけで、額・入出金・科目の一致を必須とする。架空データのみを使用する。
 */
import { describe, expect, it } from 'vitest';
import {
  type CashEntry,
  DUPLICATE_NEAR_DAY_LIMIT,
  type FreeeDeal,
  cashBizDeals,
  findCashDealDuplicates,
} from '../src/index.js';

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
  ...over,
});

const deal = (over: Partial<FreeeDeal> = {}): FreeeDeal => ({
  month: '2026-07',
  date: '2026-07-10',
  io: 'expense',
  partner: '架空商工会議所',
  accountRaw: '会議費',
  accountNorm: '会議費',
  amount: 5000,
  ...over,
});

describe('二重計上の検知', () => {
  it('同日・同額・同科目の組を same_day で拾う', () => {
    const found = findCashDealDuplicates([entry()], [deal()]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ cashEntryId: 1, confidence: 'same_day', dayGap: 0 });
  });

  it('日付が数日ずれた組は near_day として区別する', () => {
    const found = findCashDealDuplicates([entry()], [deal({ date: '2026-07-12' })]);
    expect(found[0]).toMatchObject({ confidence: 'near_day', dayGap: 2 });
  });

  it('上限を超えて離れた日付は別の支払いとみなす', () => {
    const beyond = findCashDealDuplicates([entry()], [deal({ date: '2026-07-14' })]);
    expect(beyond).toEqual([]);
    const atLimit = findCashDealDuplicates([entry()], [deal({ date: '2026-07-13' })]);
    expect(atLimit[0]?.dayGap).toBe(DUPLICATE_NEAR_DAY_LIMIT);
  });

  it('月をまたいでも日付が近ければ拾う', () => {
    const found = findCashDealDuplicates(
      [entry({ date: '2026-07-31', month: '2026-07' })],
      [deal({ date: '2026-08-01', month: '2026-08' })],
    );
    expect(found[0]).toMatchObject({ confidence: 'near_day', dayGap: 1 });
  });

  it('金額・入出金・科目のどれかが違えば拾わない', () => {
    expect(findCashDealDuplicates([entry()], [deal({ amount: 5001 })])).toEqual([]);
    expect(findCashDealDuplicates([entry()], [deal({ io: 'income' })])).toEqual([]);
    expect(findCashDealDuplicates([entry()], [deal({ accountNorm: '交際費' })])).toEqual([]);
  });

  it('科目は正規化してから突合する(表記違いで取りこぼさない)', () => {
    const found = findCashDealDuplicates([entry({ categoryMajor: '会議費用' })], [deal()], {
      会議費用: '会議費',
    });
    expect(found).toHaveLength(1);
  });

  it('家計分(per)の記帳は freee に載らないため対象外', () => {
    expect(findCashDealDuplicates([entry({ side: 'per' })], [deal()])).toEqual([]);
  });

  it('現金由来の仕訳を渡しても自分自身とは突合しない前提を明示する', () => {
    const entries = [entry()];
    // 呼び出し側は取込由来の仕訳だけを渡す。現金由来を混ぜると当然一致してしまう
    const selfMade = cashBizDeals(entries, {});
    expect(findCashDealDuplicates(entries, selfMade)).toHaveLength(1);
    expect(findCashDealDuplicates(entries, [])).toEqual([]);
  });

  it('疑いの強い順(同日が先)に並べる', () => {
    const found = findCashDealDuplicates(
      [entry({ id: 1 }), entry({ id: 2 })],
      [deal({ date: '2026-07-12' }), deal()],
    );
    expect(found.map((f) => f.dayGap)).toEqual([0, 0, 2, 2]);
  });

  it('記帳も仕訳も無ければ空を返す', () => {
    expect(findCashDealDuplicates([], [deal()])).toEqual([]);
    expect(findCashDealDuplicates([entry()], [])).toEqual([]);
  });
});
