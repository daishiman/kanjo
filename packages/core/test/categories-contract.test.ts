/** 科目候補の二系統と公私ガードの契約(架空データ) */
import { describe, expect, it } from 'vitest';
import { buildCandidates, categoryAllowed } from '../src/categories.js';
import { HOUSEHOLD_CATEGORIES } from '../src/household-categories.js';
import { TAX_ACCOUNTS } from '../src/tax-accounts.js';

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
  it('事業側は中項目を持たず、出どころが分かる', () => {
    const rows = cands.biz.map((m) => [m.name, m.source, m.mids.length]);
    expect(rows).toEqual(
      expect.arrayContaining([
        ['売上高', 'freee', 0],
        ['消耗品費', 'freee', 0],
        ['研修費', 'custom', 0],
        ['通信費', 'freee', 0],
      ]),
    );
    expect(cands.biz.every((m) => m.mids.length === 0)).toBe(true);
  });

  it('取込前でも確定申告の標準科目が事業側に並ぶ', () => {
    // 取込済みの科目しか出さないと、まだ払ったことのない支出を記帳できない
    const empty = buildCandidates([], [], []);
    for (const a of TAX_ACCOUNTS) {
      expect(empty.biz.find((m) => m.name === a.name)?.source).toBe('standard');
    }
    // 家計側は生活の標準費目。確定申告の科目は混ぜない(事業と家計でマスタを分ける)
    for (const c of HOUSEHOLD_CATEGORIES) {
      expect(empty.per.find((m) => m.name === c.major)?.source).toBe('standard');
    }
    expect(empty.per.some((m) => m.name === '外注工賃')).toBe(false);
    expect(empty.biz.some((m) => m.name === '住宅ローン')).toBe(false);
  });

  it('家を買ったときの費用を、取込前でも中項目まで選べる', () => {
    // 一生で数回しか出ない支出ほど、その場で費目を考えるのが難しい
    const empty = buildCandidates([], [], []);
    const buy = empty.per.find((m) => m.name === '住宅購入');
    const mids = buy?.mids.map((m) => m.name) ?? [];
    expect(mids).toEqual(expect.arrayContaining(['頭金', '仲介手数料', '登記費用', '不動産取得税']));
    const tax = empty.per.find((m) => m.name === '税・社会保障');
    expect(tax?.mids.map((m) => m.name)).toEqual(
      expect.arrayContaining(['固定資産税・都市計画税', '住民税', '国民年金']),
    );
    expect(empty.per.find((m) => m.name === '保険')?.mids.map((m) => m.name)).toEqual(
      expect.arrayContaining(['火災保険', '地震保険', '学資保険']),
    );
  });

  it('標準科目と同名でも、実データや追加分の出どころが優先される', () => {
    // 「freeeに実在する科目」と「最初から用意した科目」が同じ扱いになると、
    // どれが自分の実績かが読めなくなる
    expect(cands.biz.find((m) => m.name === '通信費')?.source).toBe('freee');
    expect(cands.biz.find((m) => m.name === '研修費')?.source).toBe('custom');
    expect(cands.biz.find((m) => m.name === '外注工賃')?.source).toBe('standard');
  });
  it('個人側は MF の組み合わせ + 追加分(中項目の出どころも保持)', () => {
    const food = cands.per.find((m) => m.name === '食費');
    expect(food?.source).toBe('mf');
    const midSource = new Map(food?.mids.map((m) => [m.name, m.source]));
    expect(midSource.get('カフェ')).toBe('custom'); // 標準にもあるが、追加した扱いが勝つ
    expect(midSource.get('外食')).toBe('mf');
    expect(midSource.get('食料品')).toBe('mf');
    expect(midSource.get('昼食')).toBe('standard');
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
