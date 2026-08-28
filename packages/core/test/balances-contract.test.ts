/**
 * 残高(BS)の取込と組み立ての契約テスト。実データは使わず架空の数字だけで検証する。
 *
 * 見張っているのは2つ。
 *   1. 日次と月次が混ざったCSVを、月に1点へ丸めきること
 *      (丸め損ねると同じ月が何行も並び、資産が数倍に膨らむ)
 *   2. 負債を入れていない月の純資産を、資産合計で埋めないこと
 *      (埋めると「完済した月」と「入力し忘れた月」が見分けられなくなる)
 */
import { describe, expect, it } from 'vitest';
import {
  LIABILITY_CATEGORIES,
  assetCategoryName,
  buildBalanceSheet,
  isMfAssetHistoryHeader,
  lastDayOfMonth,
  parseMfAssetHistoryRows,
} from '../src/index.js';
import type { BalanceRow } from '../src/index.js';

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

const asset = (month: string, date: string, category: string, amount: number): BalanceRow => ({
  month,
  date,
  side: 'asset',
  category,
  amount,
  source: 'mf',
});
const liability = (month: string, category: string, amount: number): BalanceRow => ({
  month,
  date: `${month}-01`,
  side: 'liability',
  category,
  amount,
  source: 'manual',
});

describe('貸借対照表の組み立て', () => {
  it('負債を一度も入れていない月は純資産を出さない', () => {
    const bs = buildBalanceSheet([asset('2026-07', '2026-07-31', '預金・現金', 1000)]);
    expect(bs.months[0].assetTotal).toBe(1000);
    // 資産合計で埋めると、完済した月と入力し忘れた月が同じ顔になる
    expect(bs.months[0].netAssets).toBeNull();
    expect(bs.monthsWithoutLiabilities).toEqual(['2026-07']);
  });

  it('0円と入れた月は純資産を出す', () => {
    const bs = buildBalanceSheet([
      asset('2026-07', '2026-07-31', '預金・現金', 1000),
      liability('2026-07', 'クレジットカード未払金', 0),
    ]);
    // 「返し終えた」は分かっている情報なので伏せない
    expect(bs.months[0].netAssets).toBe(1000);
    expect(bs.monthsWithoutLiabilities).toEqual([]);
  });

  it('負債を引いた純資産を出す', () => {
    const bs = buildBalanceSheet([
      asset('2026-07', '2026-07-31', '預金・現金', 1000),
      asset('2026-07', '2026-07-31', '投資信託', 500),
      liability('2026-07', 'クレジットカード未払金', 200),
      liability('2026-07', '借入金', 300),
    ]);
    expect(bs.months[0].assetTotal).toBe(1500);
    expect(bs.months[0].liabilityTotal).toBe(500);
    expect(bs.months[0].netAssets).toBe(1000);
  });

  it('月末に達していない月は、いつ時点かを立てておく', () => {
    const bs = buildBalanceSheet([
      asset('2026-07', '2026-07-31', '預金・現金', 1),
      asset('2026-08', '2026-08-28', '預金・現金', 2),
    ]);
    expect(bs.months.map((m) => [m.month, m.asOf, m.partial])).toEqual([
      ['2026-07', '2026-07-31', false],
      // 8月はまだ終わっていない。31日の残高ではないと断れるようにする
      ['2026-08', '2026-08-28', true],
    ]);
  });

  it('月の並びは古い順で、種類は全月の和集合を返す', () => {
    const bs = buildBalanceSheet([
      asset('2026-08', '2026-08-31', '投資信託', 2),
      asset('2026-07', '2026-07-31', '預金・現金', 1),
    ]);
    expect(bs.months.map((m) => m.month)).toEqual(['2026-07', '2026-08']);
    // 月によって持っている種類が違っても、表の列がずれない
    expect(new Set(bs.assetCategories)).toEqual(new Set(['預金・現金', '投資信託']));
  });

  it('残高が1件も無ければ空のBSを返す', () => {
    const bs = buildBalanceSheet([]);
    expect(bs.months).toEqual([]);
    expect(bs.limits.length).toBeGreaterThan(0);
  });

  it('この表に入っていないものを必ず添える', () => {
    // 事業と家計が混ざっている点は、数字だけ見ても気づけない
    const bs = buildBalanceSheet([asset('2026-07', '2026-07-31', '預金・現金', 1)]);
    expect(bs.limits.some((t) => t.includes('事業と家計'))).toBe(true);
    expect(bs.limits.some((t) => t.includes('負債は手入力'))).toBe(true);
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
