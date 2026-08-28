/**
 * 家計の標準費目の契約。
 *
 * 守りたいのは「その場で費目を考えさせない」こと。
 * 一生で数回しか出ない支出(家の購入・固定資産税)ほど、名前が出てこない。
 * そこで (1) 生活に必要な費目が漏れていない (2) 2クリックで届く形を保つ、の2点を固定する。
 */
import { describe, expect, it } from 'vitest';
import {
  HOUSEHOLD_CATEGORIES,
  HOUSEHOLD_GROUPS,
  HOUSEHOLD_GUIDE,
  commonHouseholdCategories,
  householdCategoriesByGroup,
  householdCategoryByName,
  householdStandardPairs,
} from '../src/household-categories.js';

describe('家計の標準費目', () => {
  it('生活に必要な費目が揃っている', () => {
    const names = HOUSEHOLD_CATEGORIES.map((c) => c.major);
    expect(names).toEqual(
      expect.arrayContaining([
        '住まい',
        '住宅ローン',
        '住宅購入',
        '水道・光熱費',
        '食費',
        '日用品',
        '通信費',
        '健康・医療',
        '交通費',
        '税・社会保障',
        '保険',
        '教養・教育',
      ]),
    );
  });

  it('家の購入と、そのあと毎年かかる税を中項目まで持つ', () => {
    // 買ったあとに届く不動産取得税・固定資産税は、名前が出てこないまま放置されやすい
    expect(householdCategoryByName('住宅購入')?.mids).toEqual(
      expect.arrayContaining(['頭金', '仲介手数料', '登記費用', '不動産取得税']),
    );
    expect(householdCategoryByName('税・社会保障')?.mids).toEqual(
      expect.arrayContaining(['固定資産税・都市計画税', '住民税', '国民健康保険', '国民年金']),
    );
    expect(householdCategoryByName('保険')?.mids).toEqual(
      expect.arrayContaining(['生命保険', '火災保険', '地震保険', '自動車保険', '学資保険']),
    );
  });

  it('社会保険と民間の保険を混ぜない', () => {
    // 国民年金を「保険」に入れると、備えの見直しをするとき金額が読めなくなる
    expect(householdCategoryByName('保険')?.mids).not.toContain('国民年金');
    expect(householdCategoryByName('税・社会保障')?.mids).not.toContain('生命保険');
  });

  it('全ての費目に選ぶ基準と例がある', () => {
    for (const c of HOUSEHOLD_CATEGORIES) {
      expect(c.when.length).toBeGreaterThan(0);
      expect(c.examples.length).toBeGreaterThan(0);
    }
  });

  it('スクロールせずクリックだけで選べる形を保つ', () => {
    // 分類を増やすほど1画面に収まらなくなる。増やすなら分類の切り方から見直す
    expect(HOUSEHOLD_GROUPS.length).toBeLessThanOrEqual(6);
    for (const g of HOUSEHOLD_GROUPS) {
      const list = householdCategoriesByGroup(g);
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(8);
    }
    expect(HOUSEHOLD_CATEGORIES.every((c) => HOUSEHOLD_GROUPS.includes(c.group))).toBe(true);
  });

  it('よく使う費目は毎月出るものに絞る', () => {
    const common = commonHouseholdCategories().map((c) => c.major);
    expect(common.length).toBeGreaterThanOrEqual(4);
    expect(common.length).toBeLessThanOrEqual(8);
    expect(common).toEqual(expect.arrayContaining(['食費', '日用品', '水道・光熱費', '通信費']));
  });

  it('大項目の名前が重複しない', () => {
    const names = HOUSEHOLD_CATEGORIES.map((c) => c.major);
    expect(new Set(names).size).toBe(names.length);
  });

  it('候補生成に渡す組は、大項目×中項目に展開される', () => {
    const pairs = householdStandardPairs();
    expect(pairs).toEqual(expect.arrayContaining([{ big: '住宅ローン', mid: '返済(元金)' }]));
    expect(pairs.every((p) => p.big.length > 0)).toBe(true);
  });

  it('迷ったときの目安は実在する費目を指す', () => {
    const names = HOUSEHOLD_CATEGORIES.map((c) => c.major);
    for (const line of HOUSEHOLD_GUIDE) {
      expect(names.some((n) => line.includes(n))).toBe(true);
    }
  });

  it('前後の空白を落として引ける', () => {
    expect(householdCategoryByName(' 住宅ローン ')?.group).toBe('住まい');
    expect(householdCategoryByName('存在しない費目')).toBeNull();
  });
});
