/**
 * 残高(BS)の取込と共通ルールの契約テスト。実データは使わず架空の数字だけで検証する。
 *
 * 日次と月次が混ざったCSVを、月に1点へ丸めきることを見張る。
 * 丸め損ねると同じ月が何行も並び、資産が数倍に膨らむ。
 */
import { describe, expect, it } from 'vitest';
import {
  LIABILITY_CATEGORIES,
  assetCategoryName,
  isMfAssetHistoryHeader,
  lastDayOfMonth,
  parseMfAssetHistoryRows,
} from '../src/index.js';

const HEADER = ['日付', '合計（円）', '預金・現金（円）', '投資信託（円）'];

/** 直近だけ日次、それ以前は月末。MFの資産推移CSVがそのままこの形で出てくる */
const MIXED_ROWS = [
  HEADER,
  ['2026/08/28', '300', '100', '200'],
  ['2026/08/27', '280', '80', '200'],
  ['2026/08/01', '250', '50', '200'],
  ['2026/07/31', '240', '40', '200'],
  ['2026/06/30', '230', '30', '200'],
];

describe('資産推移CSVの判定', () => {
  it('日付と合計の列がそろっていれば資産推移として受ける', () => {
    expect(isMfAssetHistoryHeader(HEADER)).toBe(true);
  });

  it('MFの収入・支出詳細は資産推移として受けない', () => {
    // どちらも「日付」を持つので、日付だけを鍵にすると取り違える
    const detail = ['計算対象', '日付', '内容', '金額（円）', '保有金融機関', '大項目', '中項目', 'ID'];
    expect(isMfAssetHistoryHeader(detail)).toBe(false);
  });

  it('残高付きの口座明細も受けない', () => {
    expect(isMfAssetHistoryHeader(['日付', '内容', '金額', '残高'])).toBe(false);
  });

  it('列名から「（円）」を落として種類の名前にする', () => {
    expect(assetCategoryName('預金・現金（円）')).toBe('預金・現金');
    expect(assetCategoryName('株式(現物)（円）')).toBe('株式(現物)');
    // 半角括弧で書き出される場合もある
    expect(assetCategoryName('合計(円)')).toBe('合計');
  });
});

describe('資産推移CSVの取込', () => {
  it('日次と月次が混ざっていても、月ごとに1点へ丸める', () => {
    const r = parseMfAssetHistoryRows(MIXED_ROWS);
    expect(r.months).toEqual(['2026-06', '2026-07', '2026-08']);
    // 8月は3行あるが、残るのは1日分だけ
    expect(r.collapsed).toBe(2);
    expect(r.rows).toBe(5);
    expect(r.skipped).toBe(0);
  });

  it('月内でいちばん新しい日付の残高を採り、その日付を残す', () => {
    const r = parseMfAssetHistoryRows(MIXED_ROWS);
    const aug = r.balances.filter((b) => b.month === '2026-08');
    // 08/28 の 100 が残る(08/27 の 80 でも 08/01 の 50 でもない)
    expect(aug.map((b) => [b.category, b.amount])).toEqual([
      ['預金・現金', 100],
      ['投資信託', 200],
    ]);
    expect(new Set(aug.map((b) => b.date))).toEqual(new Set(['2026-08-28']));
  });

  it('合計の列は保存しない', () => {
    const r = parseMfAssetHistoryRows(MIXED_ROWS);
    // 内訳と合計を両方持つと、片方だけ直したときに食い違う
    expect(r.categories).toEqual(['預金・現金', '投資信託']);
    expect(r.balances.some((b) => b.category === '合計')).toBe(false);
  });

  it('内訳の和が合計の列と合わない月を挙げる', () => {
    const r = parseMfAssetHistoryRows([HEADER, ['2026/05/31', '999', '10', '20']]);
    expect(r.totalMismatchMonths).toEqual(['2026-05']);
  });

  it('0円の種類も残す', () => {
    // 「持っていない」と「取り込めていない」を画面で区別するため、行自体は作る
    const r = parseMfAssetHistoryRows([HEADER, ['2026/05/31', '10', '10', '0']]);
    expect(r.balances.find((b) => b.category === '投資信託')?.amount).toBe(0);
  });

  it('日付を読めない行は数えて捨てる', () => {
    const r = parseMfAssetHistoryRows([HEADER, ['合計', '1', '1', '0'], ['2026/05/31', '10', '10', '0']]);
    expect(r.skipped).toBe(1);
    expect(r.months).toEqual(['2026-05']);
  });

  it('持っている種類だけ列が出ても読める', () => {
    // 投資をしていない人のCSVには投資信託の列が最初から無い
    const r = parseMfAssetHistoryRows([
      ['日付', '合計（円）', '預金・現金（円）'],
      ['2026/05/31', '7', '7'],
    ]);
    expect(r.categories).toEqual(['預金・現金']);
    expect(r.totalMismatchMonths).toEqual([]);
  });
});

describe('月末日', () => {
  it('うるう年の2月を29日にする', () => {
    expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
  });

  it('30日の月と31日の月を取り違えない', () => {
    expect(lastDayOfMonth('2026-06')).toBe('2026-06-30');
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31');
  });
});

describe('手入力で受ける負債の種類', () => {
  it('決め打ちの並びを持つ', () => {
    // 自由入力にすると月ごとに名前が揺れて、前月と比べられなくなる
    expect(LIABILITY_CATEGORIES).toContain('クレジットカード未払金');
    expect(LIABILITY_CATEGORIES).toContain('借入金');
    expect(new Set(LIABILITY_CATEGORIES).size).toBe(LIABILITY_CATEGORIES.length);
  });
});
