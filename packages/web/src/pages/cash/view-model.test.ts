// @vitest-environment jsdom

/**
 * 現金入力画面の表示用の導出 (spec-cash-screen FR-1〜FR-12)。
 * 画面の部品は core を直接読まず、ここを通すので、境界の値をここで固定する。
 */
import { cashDraftKey } from '@kanjo/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { CashEntry } from '../../api.js';
import { clearAllCashDrafts } from './draft.js';
import {
  addedElsewhereNotice,
  cashListMonths,
  cashListView,
  cashPeriodLabel,
  cashRowView,
  cashSignedAmount,
  changeSide,
  emptyNormalDraft,
  emptyTransitDraft,
  entryToForms,
  readCashUrl,
  sampleCashEntries,
  todayIso,
  transitAmount,
  transitError,
  visibleSelection,
} from './view-model.js';

const MONTHS = ['2026-07', '2026-08'];

const entry = (patch: Partial<CashEntry> = {}): CashEntry => ({
  id: 1,
  date: '2026-08-05',
  month: '2026-08',
  side: 'biz',
  io: 'expense',
  amount: 1_200,
  description: 'コピー用紙',
  categoryMajor: '消耗品費',
  categoryMid: '',
  memo: null,
  transitFrom: null,
  transitTo: null,
  transitRound: false,
  receiptWaived: false,
  owner: 'business',
  transitPurpose: null,
  ...patch,
});

afterEach(() => localStorage.clear());

describe('日付と期間', () => {
  it('今日は利用者の時刻で YYYY-MM-DD にする', () => {
    expect(todayIso(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03');
  });

  it('対象期間は月数で、12 の倍数なら年で数える', () => {
    expect(cashPeriodLabel({ from: '2026-07', to: '2026-08' })).toMatch(/（2か月）$/);
    expect(cashPeriodLabel({ from: '2025-01', to: '2025-12' })).toMatch(/（1年）$/);
  });

  it('期間が無いときに送れる月は今日の月だけ', () => {
    expect(cashListMonths(null, '2026-09-22')).toEqual(['2026-09']);
    expect(cashListMonths({ from: '2026-07', to: '2026-08' }, '2026-09-22')).toEqual(MONTHS);
  });

  it('別の月へ追加したら移る先を返し、期間の外なら文だけにする', () => {
    expect(addedElsewhereNotice('2026-08-01', '2026-08', MONTHS)).toBeNull();
    expect(addedElsewhereNotice('2026-07-31', '2026-08', MONTHS)).toMatchObject({ month: '2026-07' });
    expect(addedElsewhereNotice('2026-10-01', '2026-08', MONTHS)).toEqual({
      text: '選択中の期間の外に追加しました',
      month: null,
    });
  });

  it('収支差額は符号でも示す', () => {
    expect([cashSignedAmount(1200), cashSignedAmount(-1200), cashSignedAmount(0)]).toEqual([
      '+1,200',
      '-1,200',
      '0',
    ]);
  });
});

describe('入力欄', () => {
  it('事業 / 個人を切り替えるとカテゴリを空にし、既定のままの担当者だけを寄せる', () => {
    const biz = { ...emptyNormalDraft('2026-08-01'), categoryMajor: '消耗品費' };
    expect(changeSide(biz, 'per')).toMatchObject({ side: 'per', categoryMajor: '', owner: '' });
    expect(changeSide({ ...biz, owner: 'spouse' }, 'per').owner).toBe('spouse');
    expect(changeSide(biz, 'biz')).toBe(biz);
  });

  it('交通費の合計は区間と運賃が揃うまで出さない', () => {
    const t = { ...emptyTransitDraft(), from: '名古屋', to: '金山', oneWay: '280' };
    expect(transitAmount({ ...t, to: '' })).toBeNull();
    expect(transitAmount(t)).toBe(560);
    expect(transitAmount({ ...t, round: false })).toBe(280);
  });

  it('個人の交通費はカテゴリを先に求める', () => {
    const t = {
      ...emptyTransitDraft(),
      from: '名古屋',
      to: '金山',
      oneWay: '280',
      purpose: '客先訪問' as const,
    };
    const per = { ...emptyNormalDraft('2026-08-01'), side: 'per' as const, owner: 'spouse' as const };
    expect(transitError(per, t)).toBe('個人の交通費はカテゴリを選んでください');
    expect(transitError({ ...per, categoryMajor: '交通費' }, t)).toBeNull();
  });

  it('担当者が未設定の行 (0051 より前) は未選択で編集に入る', () => {
    const forms = entryToForms(entry({ owner: null }), emptyNormalDraft('2026-08-26'));
    expect(forms.tab).toBe('normal');
    expect(forms.normal.owner).toBe('');
    expect(cashRowView(entry({ owner: null }), () => '事業').ownerLabel).not.toBe('事業');
  });
});

describe('一覧', () => {
  it('サンプルは選択中の月の中に置き、id を負にして実在の行と混ぜない', () => {
    const rows = sampleCashEntries('2026-08');
    expect(rows).toHaveLength(5);
    expect(rows.every((e) => e.id < 0 && e.month === '2026-08' && e.date.startsWith('2026-08-'))).toBe(true);
  });

  it('月に行が無く絞り込みも既定なら空状態、絞り込みの結果だけが 0 件なら noMatch', () => {
    const url = readCashUrl(new URLSearchParams(), MONTHS);
    expect(cashListView([], '2026-08', url)).toMatchObject({ empty: true, noMatch: false });
    const q = readCashUrl(new URLSearchParams('q=存在しない'), MONTHS);
    expect(cashListView([entry()], '2026-08', q)).toMatchObject({ empty: false, noMatch: true });
    expect(cashListView([entry()], '2026-07', url)).toMatchObject({ empty: true });
  });

  it('合計は選択中の月の行だけで数える', () => {
    const url = readCashUrl(new URLSearchParams(), MONTHS);
    const view = cashListView(
      [
        entry(),
        entry({ id: 2, io: 'income', amount: 5_000 }),
        entry({ id: 3, month: '2026-07', date: '2026-07-01' }),
      ],
      '2026-08',
      url,
    );
    expect(view.monthRows.map((e) => e.id)).toEqual([1, 2]);
    expect(view.totals).toMatchObject({ income: 5_000, expense: 1_200 });
  });

  it('一括削除は今の絞り込みに残っている行だけを対象にする', () => {
    expect(visibleSelection(new Set([1, 2, 9]), [entry(), entry({ id: 2 })])).toEqual([1, 2]);
  });
});

describe('下書きの後始末', () => {
  it('ログアウトでは全利用者の現金の下書きだけを消す', () => {
    localStorage.setItem(cashDraftKey('u1'), '{}');
    localStorage.setItem(cashDraftKey('u2'), '{}');
    localStorage.setItem('kanjo:other', 'keep');
    clearAllCashDrafts();
    expect(localStorage.getItem(cashDraftKey('u1'))).toBeNull();
    expect(localStorage.getItem(cashDraftKey('u2'))).toBeNull();
    expect(localStorage.getItem('kanjo:other')).toBe('keep');
  });
});
