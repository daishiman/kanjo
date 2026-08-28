/**
 * 表の並べ替えの比較規則。
 *
 * ここが決めているのは「どの順に並ぶのが読み手にとって正しいか」。
 * 金額の列を文字列として並べると ¥1,000 が ¥900 より前に来て、
 * 「一番高いのはどれか」を見るための並べ替えが機能しなくなる。
 */
import { describe, expect, it } from 'vitest';
import { type SortDir, compareSortValues, parseSortNumber, sortedRowOrder } from './table-sort.js';

const sortTexts = (values: string[], dir: SortDir = 'asc'): string[] =>
  sortedRowOrder(
    values.map((v) => [v]),
    0,
    dir,
  ).map((i) => values[i]);

describe('parseSortNumber', () => {
  it('金額・割合・件数の表記から数を取り出す', () => {
    expect(parseSortNumber('¥1,234')).toBe(1234);
    expect(parseSortNumber('-1,234')).toBe(-1234);
    expect(parseSortNumber('△1,234')).toBe(-1234);
    expect(parseSortNumber('12.3%')).toBe(12.3);
    expect(parseSortNumber('12')).toBe(12);
  });

  it('数として読めない表記は null にする', () => {
    expect(parseSortNumber('—')).toBeNull();
    expect(parseSortNumber('')).toBeNull();
    expect(parseSortNumber('Anthropic')).toBeNull();
  });
});

describe('compareSortValues', () => {
  it('金額は数の大小で並ぶ(文字列比較にしない)', () => {
    expect(sortTexts(['¥900', '¥1,000', '¥90'])).toEqual(['¥90', '¥900', '¥1,000']);
  });

  it('マイナスはプラスより小さい', () => {
    expect(sortTexts(['¥100', '-¥50', '¥0'])).toEqual(['-¥50', '¥0', '¥100']);
  });

  it('文字は日本語の読みやすい順(localeCompare)で並ぶ', () => {
    expect(sortTexts(['りんご', 'あんず', 'みかん'])).toEqual(['あんず', 'みかん', 'りんご']);
  });

  it('数と文字が混ざる列では、数を先に置く', () => {
    expect(sortTexts(['Anthropic', '¥100', '¥50'])).toEqual(['¥50', '¥100', 'Anthropic']);
  });

  it('空欄と「—」は、昇順でも降順でも末尾に置く', () => {
    // 未入力を先頭に集めると、並べ替えるたびに中身のない行が最初に来て読めない
    expect(sortTexts(['¥100', '—', '¥50', ''])).toEqual(['¥50', '¥100', '—', '']);
    expect(sortTexts(['¥100', '—', '¥50', ''], 'desc')).toEqual(['¥100', '¥50', '—', '']);
  });

  it('前後の空白は無視する', () => {
    expect(compareSortValues(' あんず ', 'あんず')).toBe(0);
  });
});

describe('sortedRowOrder', () => {
  it('同値の行は元の並びを保つ', () => {
    const cells = [['¥100'], ['¥100'], ['¥50']];
    expect(sortedRowOrder(cells, 0, 'asc')).toEqual([2, 0, 1]);
  });

  it('固定行(合計行)は動かさず、その場に残す', () => {
    const cells = [['¥50'], ['¥100'], ['合計']];
    expect(sortedRowOrder(cells, 0, 'desc', [false, false, true])).toEqual([1, 0, 2]);
  });
});
