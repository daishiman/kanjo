import { describe, expect, it } from 'vitest';
import {
  type Dataset,
  type DefenseForecastInput,
  type DefenseMonth,
  defenseForecast,
  defenseLine,
  emptyDataset,
  judgeDefenseForecast,
} from '../src/index.js';

/** 防衛ライン割れの事前警告(FR-08 の先行き見通し) */

const month = (over: Partial<DefenseMonth> = {}): DefenseMonth => ({
  month: '2026-01',
  income: 600000,
  diff: 100000,
  breached: false,
  ...over,
});

const judge = (over: Partial<DefenseForecastInput> = {}) =>
  judgeDefenseForecast({
    line: 500000,
    history: [month(), month(), month(), month(), month(), month()],
    breachCount: 0,
    nextDiff: 100000,
    slope: 0,
    hasData: true,
    ...over,
  });

/**
 * 個人の生活費と収入だけを持つ最小のデータセット。
 * 防衛ライン = 個人生活費の直近3ヶ月平均 + 事業固定費平均 なので、
 * 事業経費を空にしておけば line は生活費だけで決まり、期待値を手で置ける。
 */
function personalOnly(incomes: number[], livingCost: number): Dataset {
  const months = incomes.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  const data = emptyDataset();
  data.months = months;
  for (const [i, m] of months.entries()) {
    data.personal[m] = { income: { 給与: incomes[i] }, expense: { 生活費: livingCost } };
    data.bizPersonal[m] = { income: 0, expense: 0 };
  }
  return data;
}

describe('防衛ライン割れの事前警告', () => {
  it('データが無ければ nodata を返し、判定を装わない', () => {
    expect(judge({ hasData: false }).level).toBe('nodata');
    expect(judge({ history: [] }).level).toBe('nodata');
    expect(defenseForecast(emptyDataset()).level).toBe('nodata');
  });

  it('翌月そのものがラインを割る見込みなら warn を出し、根拠に不足額を書く', () => {
    const r = judge({ nextDiff: -80000 });
    expect(r.level).toBe('warn');
    // 利用者が自分で確かめられるよう、見込み・ライン・不足額の3つが文中に出る
    expect(r.reason).toContain('¥420,000');
    expect(r.reason).toContain('¥500,000');
    expect(r.reason).toContain('¥80,000');
  });

  it('割れが直近の過半なら、翌月が足りていても常態化として warn を出す', () => {
    expect(judge({ breachCount: 4, nextDiff: 10000 }).level).toBe('warn');
    // 過半に満たない割れは watch にとどめる(事業入金は単月の振れが大きいため)
    expect(judge({ breachCount: 2, nextDiff: 10000 }).level).toBe('watch');
  });

  it('今は足りていても、この傾きが3ヶ月以内にラインへ届くなら watch を出す', () => {
    // 余裕 90,000 / 減り方 30,000 per month = 3ヶ月後にライン
    const r = judge({ nextDiff: 90000, slope: -30000 });
    expect(r.level).toBe('watch');
    expect(r.reason).toContain('3ヶ月後');
    // 減っていても届くのがずっと先なら警告しない(出しすぎると無視されるため)
    expect(judge({ nextDiff: 90000, slope: -1000 }).level).toBe('none');
  });

  it('余裕がラインの10%未満なら watch、それ以上あれば none', () => {
    expect(judge({ nextDiff: 40000 }).level).toBe('watch');
    expect(judge({ nextDiff: 60000 }).level).toBe('none');
  });

  it('防衛ラインが0でも0除算にならず判定できる', () => {
    const r = judge({ line: 0, nextDiff: 0 });
    expect(r.level).toBe('none');
    expect(Number.isNaN(Number.parseFloat(r.reason.replace(/[^0-9.-]/g, '')))).toBe(false);
  });

  it('翌月見込みの給与は中央値で出すので、一度きりの賞与に引きずられない', () => {
    // 直近3ヶ月の給与が 30万・120万(賞与)・30万 → 中央値は30万
    const data = personalOnly([300000, 300000, 300000, 1200000, 300000], 200000);
    const f = defenseForecast(data);
    expect(f.nextSalary).toBe(300000);
    expect(f.nextEstimate).toBe(300000);
  });

  it('history は防衛ラインとの差と割れ有無を月ごとに持ち、breachCount と一致する', () => {
    const data = personalOnly([300000, 300000, 100000, 100000, 300000], 200000);
    const f = defenseForecast(data);
    const line = defenseLine(data).line;
    expect(f.line).toBe(line);
    expect(f.history).toHaveLength(5);
    for (const h of f.history) {
      expect(h.diff).toBe(h.income - line);
      expect(h.breached).toBe(h.diff < 0);
    }
    expect(f.breachCount).toBe(f.history.filter((h) => h.breached).length);
  });

  it('翌月は最新月の次の月を指し、年をまたぐ', () => {
    const data = emptyDataset();
    data.months = ['2026-12'];
    data.personal['2026-12'] = { income: { 給与: 300000 }, expense: { 生活費: 200000 } };
    data.bizPersonal['2026-12'] = { income: 0, expense: 0 };
    expect(defenseForecast(data).nextMonth).toBe('2027-01');
  });

  it('収入が減り続けていれば slope が負になる', () => {
    const data = personalOnly([500000, 450000, 400000, 350000, 300000], 200000);
    expect(defenseForecast(data).slope).toBeLessThan(0);
  });
});
