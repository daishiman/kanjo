import { describe, expect, it } from 'vitest';
import { type Dataset, type TradeoffPlanRecord, emptyDataset, tradeoffReview } from '../src/index.js';

/** やりくり計画の翌月実績突合(立てた計画が実際に効いたか) */

/** 経費1科目だけを 2026-01 から連番で持つデータセット */
function expenseData(series: number[], unrecorded: string[] = []): Dataset {
  const months = series.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  const data = emptyDataset();
  data.months = months;
  data.biz = { revenue: months.map(() => 0), categories: ['広告宣伝費'], expense: { 広告宣伝費: series } };
  data.unrecordedExpMonths = unrecorded;
  return data;
}

const plan = (over: Partial<TradeoffPlanRecord> = {}): TradeoffPlanRecord => ({
  id: 1,
  title: '来月の資金繰り',
  amount: 100000,
  covered: 100000,
  createdAt: '2026-03-15T00:00:00.000Z',
  ...over,
});

describe('やりくり計画の翌月実績突合', () => {
  it('突合対象は計画を立てた月の翌月で、基準は計画月までの直近3ヶ月平均', () => {
    // 1〜3月は各 300,000 → 基準 300,000。4月は 200,000 で 100,000 削減
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000, 200000]), [plan()]);
    expect(r.planMonth).toBe('2026-03');
    expect(r.targetMonth).toBe('2026-04');
    expect(r.baseline).toBe(300000);
    expect(r.actual).toBe(200000);
    expect(r.reduced).toBe(100000);
    expect(r.rate).toBe(1);
    expect(r.status).toBe('achieved');
  });

  it('予定どおり削れることは稀なので、8割以上の削減は達成に入れる', () => {
    // 300,000 → 220,000 の 80,000 削減。予定 100,000 に対して 80%
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000, 220000]), [plan()]);
    expect(r.rate).toBeCloseTo(0.8);
    expect(r.status).toBe('achieved');
  });

  it('3割以上8割未満は一部達成、3割未満は効かなかった扱い', () => {
    const partial = tradeoffReview(expenseData([300000, 300000, 300000, 250000]), [plan()])[0];
    expect(partial.status).toBe('partial');
    const missed = tradeoffReview(expenseData([300000, 300000, 300000, 290000]), [plan()])[0];
    expect(missed.status).toBe('missed');
  });

  it('むしろ増えた月も、削減量を負のまま返して見えるようにする', () => {
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000, 380000]), [plan()]);
    expect(r.reduced).toBe(-80000);
    expect(r.status).toBe('missed');
  });

  it('対象月がまだ無ければ判定を保留する', () => {
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000]), [plan()]);
    expect(r.targetMonth).toBe('2026-04');
    expect(r.actual).toBeNull();
    expect(r.status).toBe('pending');
  });

  it('対象月が未記帳なら、数字が揃っていないので判定しない', () => {
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000, 200000], ['2026-04']), [plan()]);
    expect(r.actual).toBeNull();
    expect(r.status).toBe('pending');
  });

  it('基準の直近3ヶ月からも未記帳月を除く', () => {
    // 2月が未記帳 → 基準は 1月と3月の平均 = 250,000
    const [r] = tradeoffReview(expenseData([300000, 999999, 200000, 100000], ['2026-02']), [plan()]);
    expect(r.baseline).toBe(250000);
    expect(r.reduced).toBe(150000);
  });

  it('捻出予定額が0なら率は出さず、減ったかどうかだけで判定する', () => {
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000, 290000]), [plan({ covered: 0 })]);
    expect(r.rate).toBeNull();
    expect(r.status).toBe('achieved');
  });

  it('12月の計画は翌年1月と突合する', () => {
    const [r] = tradeoffReview(emptyDataset(), [plan({ createdAt: '2026-12-01T00:00:00.000Z' })]);
    expect(r.targetMonth).toBe('2027-01');
    expect(r.status).toBe('pending');
  });

  it('作成日時が無い計画は突合できないので保留のまま返す', () => {
    const [r] = tradeoffReview(expenseData([300000, 300000, 300000, 200000]), [plan({ createdAt: null })]);
    expect(r.planMonth).toBeNull();
    expect(r.status).toBe('pending');
  });
});
