/** 科目候補の二系統と公私ガードの契約(架空データ) */
import { describe, expect, it } from 'vitest';
import { buildCandidates, categoryAllowed } from '../src/categories.js';

const cands = buildCandidates(
  ['売上高', '通信費', '消耗品費', '通信費'],
  [
    { big: '食費', mid: '外食' },
    { big: '食費', mid: '食料品' },
    { big: '通信費', mid: '携帯電話' },
    { big: '未分類', mid: '' },
  ],
  [
    { scope: 'biz', major: '研修費', mid: '' },
    { scope: 'per', major: '食費', mid: 'カフェ' },
    { scope: 'per', major: '教育費', mid: '' },
    { scope: 'biz', major: '通信費', mid: '' }, // 実データにもある → freee 扱い
  ],
);

describe('buildCandidates', () => {
  it('事業側は freee 勘定科目のみ(中項目なし)、追加分は custom と分かる', () => {
    const rows = cands.biz.map((m) => [m.name, m.source, m.mids.length]);
    expect(rows).toHaveLength(4);
    expect(rows).toEqual(
      expect.arrayContaining([
        ['売上高', 'freee', 0],
        ['消耗品費', 'freee', 0],
        ['研修費', 'custom', 0],
        ['通信費', 'freee', 0],
      ]),
    );
  });
  it('個人側は MF の組み合わせ + 追加分(中項目の出どころも保持)', () => {
    const food = cands.per.find((m) => m.name === '食費');
    expect(food?.source).toBe('mf');
    expect(food?.mids).toEqual([
      { name: 'カフェ', source: 'custom' },
      { name: '外食', source: 'mf' },
      { name: '食料品', source: 'mf' },
    ]);
    expect(cands.per.find((m) => m.name === '教育費')?.source).toBe('custom');
    // 事業側にしか無い科目は個人側に出ない
    expect(cands.per.some((m) => m.name === '売上高')).toBe(false);
  });
});

describe('categoryAllowed', () => {
  it('事業行には freee 勘定科目だけ、中項目は不可', () => {
    expect(categoryAllowed(cands, 'biz', '通信費', null)).toBe(true);
    expect(categoryAllowed(cands, 'biz', '研修費', '')).toBe(true);
    expect(categoryAllowed(cands, 'biz', '食費', null)).toBe(false);
    expect(categoryAllowed(cands, 'biz', '通信費', '携帯電話')).toBe(false);
  });
  it('個人行には MF の組み合わせだけ', () => {
    expect(categoryAllowed(cands, 'per', '食費', '外食')).toBe(true);
    expect(categoryAllowed(cands, 'per', '食費', 'カフェ')).toBe(true);
    expect(categoryAllowed(cands, 'per', '食費', null)).toBe(true);
    expect(categoryAllowed(cands, 'per', '食費', '携帯電話')).toBe(false);
    expect(categoryAllowed(cands, 'per', '売上高', null)).toBe(false);
  });
  it('科目未指定は可、中項目だけの指定は不可', () => {
    expect(categoryAllowed(cands, 'per', null, null)).toBe(true);
    expect(categoryAllowed(cands, 'per', '', '外食')).toBe(false);
  });
});
