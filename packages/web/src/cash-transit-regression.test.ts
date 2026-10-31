import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CashEntry } from './api.js';
import {
  type CashNormalDraft,
  type CashTransitDraft,
  emptyNormalDraft,
  emptyTransitDraft,
  entryToForms,
  normalBody,
  resetFormsAfterCreate,
  transitBody,
} from './pages/cash/view-model.js';

const PAGE_SOURCE = readFileSync(new URL('./pages/cash/CashPage.tsx', import.meta.url), 'utf8');

const normal = (patch: Partial<CashNormalDraft> = {}): CashNormalDraft => ({
  ...emptyNormalDraft('2026-08-26'),
  ...patch,
});
const transit = (patch: Partial<CashTransitDraft> = {}): CashTransitDraft => ({
  ...emptyTransitDraft(),
  from: '名古屋',
  to: '金山',
  oneWay: '280',
  round: true,
  purpose: '客先訪問',
  ...patch,
});

/** 保存された交通費の行 (API の応答の形) */
const savedTransit = (patch: Partial<CashEntry> = {}): CashEntry => ({
  id: 7,
  date: '2026-08-26',
  month: '2026-08',
  side: 'biz',
  io: 'expense',
  amount: 560,
  description: '名古屋→金山 往復',
  categoryMajor: '旅費交通費',
  categoryMid: '',
  memo: null,
  transitFrom: '名古屋',
  transitTo: '金山',
  transitRound: true,
  receiptWaived: true,
  owner: 'business',
  transitPurpose: '客先訪問',
  ...patch,
});

describe('現金・交通費入力の高リスク回帰', () => {
  it('往復の交通費は片道の 2 倍で送り、再編集では片道運賃に戻る', () => {
    const body = transitBody(normal(), transit());
    expect(body).toMatchObject({
      amount: 560,
      transitFrom: '名古屋',
      transitTo: '金山',
      transitRound: true,
      receiptWaived: true,
      big: '旅費交通費',
    });

    const forms = entryToForms(savedTransit(), normal());
    expect(forms.tab).toBe('transit');
    expect(forms.transit.oneWay).toBe('280');

    // 片道を直して保存し直すと、合計は新しい片道の 2 倍になる
    expect(transitBody(forms.normal, { ...forms.transit, oneWay: '300' }).amount).toBe(600);
  });

  it('片道の交通費を再編集しても金額を半分にしない', () => {
    const forms = entryToForms(savedTransit({ amount: 280, transitRound: false }), normal());
    expect(forms.transit.oneWay).toBe('280');
    expect(forms.transit.round).toBe(false);
  });

  it('通常入力の送信は交通費の欄と証憑不要を持ち越さない', () => {
    expect(
      normalBody(normal({ amount: '500', description: '備品', categoryMajor: '消耗品費' })),
    ).toMatchObject({
      amount: 500,
      transitFrom: null,
      transitTo: null,
      transitRound: false,
      receiptWaived: false,
      transitPurpose: null,
    });
  });

  it('追加の成功後は日付・事業 / 個人・担当者だけを残し、交通費の入力は空に戻す', () => {
    const next = resetFormsAfterCreate(
      normal({
        date: '2026-08-20',
        side: 'per',
        owner: 'spouse',
        amount: '900',
        description: 'ランチ',
        memo: 'x',
      }),
    );
    expect(next.normal).toMatchObject({
      date: '2026-08-20',
      side: 'per',
      owner: 'spouse',
      amount: '',
      description: '',
      memo: '',
    });
    expect(next.transit).toEqual(emptyTransitDraft());
    // 画面は追加の成功時に必ずこの関数を通す (手書きで欄を消して担当者まで落とす退行を防ぐ)
    expect(PAGE_SOURCE).toContain('resetFormsAfterCreate(normal)');
  });
});
