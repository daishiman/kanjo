import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CashEntryBody } from './api.js';
import {
  changeCashEntryMode,
  resetCashEntryAfterCreate,
  setCashTransitInput,
  transitInputFromCashBody,
} from './pages/Cash.js';

const CASH_SOURCE = readFileSync(new URL('./pages/Cash.tsx', import.meta.url), 'utf8');

const body = (patch: Partial<CashEntryBody> = {}): CashEntryBody => ({
  date: '2026-08-26',
  side: 'biz',
  io: 'expense',
  amount: 0,
  description: '',
  big: '旅費交通費',
  mid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  ...patch,
});

describe('現金・交通費入力の高リスク回帰', () => {
  it('新規と編集で同じ導出を使い、往復運賃を再編集で片道運賃に戻せる', () => {
    const created = setCashTransitInput(body(), {
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });

    expect(created).toMatchObject({
      amount: 560,
      transitFrom: '名古屋',
      transitTo: '金山',
      transitRound: true,
      receiptWaived: true,
    });
    expect(transitInputFromCashBody(created)).toEqual({
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });

    const edited = setCashTransitInput(created, {
      ...transitInputFromCashBody(created),
      oneWayAmount: 300,
    });
    expect(edited.amount).toBe(600);
  });

  it('通常記帳へ戻すと交通費metadataと証憑不要をclearする', () => {
    const transit = setCashTransitInput(body(), {
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });

    expect(changeCashEntryMode(transit, 'normal')).toMatchObject({
      amount: 0,
      description: '',
      transitFrom: null,
      transitTo: null,
      transitRound: false,
      receiptWaived: false,
    });
  });

  it('選択中の入力種別を再度選んでも入力値を消さない', () => {
    const normal = body({ amount: 500, description: '備品' });
    expect(changeCashEntryMode(normal, 'normal')).toBe(normal);

    const transit = setCashTransitInput(body(), {
      from: '名古屋',
      to: '金山',
      oneWayAmount: 280,
      round: true,
    });
    expect(changeCashEntryMode(transit, 'transit')).toBe(transit);
  });

  it('記帳成功後は次の入力に証憑不要を持ち越さない', () => {
    expect(resetCashEntryAfterCreate(body({ receiptWaived: true })).receiptWaived).toBe(false);
    expect(CASH_SOURCE).toContain('resetCashEntryAfterCreate');
    expect(CASH_SOURCE).toContain("setMode('normal')");
  });
});
