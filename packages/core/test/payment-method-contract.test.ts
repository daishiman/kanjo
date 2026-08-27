/**
 * 支払手段(現金/カード/口座/不明)の判定契約。
 * MF 明細は支払手段の列を持たないため、口座名と現金の ID から導出する。架空データのみを使用する。
 */
import { describe, expect, it } from 'vitest';
import { CASH_INSTITUTION, type CashEntry, cashToTx, paymentMethodOf } from '../src/index.js';

const cash: CashEntry = {
  id: 8,
  date: '2026-07-03',
  month: '2026-07',
  side: 'per',
  io: 'expense',
  amount: 1200,
  description: '架空食堂 昼食',
  categoryMajor: '食費',
  categoryMid: '外食',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
};

describe('支払手段の判定', () => {
  it('手入力の現金は ID(cash:) を正とし、口座名が変わっても現金のまま', () => {
    expect(paymentMethodOf(cashToTx(cash))).toBe('cash');
    expect(paymentMethodOf({ id: 'cash:8', inst: '架空銀行' })).toBe('cash');
  });

  it('口座名が「現金」の取込明細も現金として扱う', () => {
    expect(paymentMethodOf({ id: 'A1', inst: CASH_INSTITUTION })).toBe('cash');
  });

  it('口座名がカードを名乗ればカード', () => {
    expect(paymentMethodOf({ id: 'A1', inst: '架空カード' })).toBe('card');
    expect(paymentMethodOf({ id: 'A2', inst: '架空ｶｰﾄﾞ' })).toBe('card');
    expect(paymentMethodOf({ id: 'A3', inst: 'KAKUU CARD' })).toBe('card');
    expect(paymentMethodOf({ id: 'A4', inst: '架空クレジット' })).toBe('card');
  });

  it('それ以外の口座名は口座', () => {
    expect(paymentMethodOf({ id: 'A1', inst: '架空銀行 普通' })).toBe('account');
  });

  it('口座名が無い旧取込は不明にし、口座と混ぜない', () => {
    expect(paymentMethodOf({ id: 'A1' })).toBe('unknown');
    expect(paymentMethodOf({ id: 'A1', inst: null })).toBe('unknown');
    expect(paymentMethodOf({ id: 'A1', inst: '   ' })).toBe('unknown');
  });
});
