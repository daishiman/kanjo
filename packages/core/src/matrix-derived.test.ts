/**
 * 仕様 §5.1 の選定規則を、§3.5 のフィクスチャで固定する。
 *
 * 仕様は「§3.5 へ §5.1 を適用すると 1位 広告宣伝費(2026-03) / 2位 外注費(2025-12) /
 * 3位 その他(2026-03) になる」と書いている（利用者決定 = 規則が正本、画像の表は記録）。
 * ここが緑であることが、規則と仕様本文が食い違っていないことの証明になる。
 */
import { describe, expect, it } from 'vitest';
import {
  type MatrixSkewInput,
  matrixBodyValues,
  matrixColumnSummary,
  matrixRowSummary,
  matrixSkewTop,
  recordedIndexes,
} from './matrix-derived.js';

const MONTHS = [
  '2025-08',
  '2025-09',
  '2025-10',
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
];

/** §3.5 の表（万円）。円へ直して渡す。並びは仕様の固定順で、`その他` を末尾に置く。 */
const FIXTURE: [string, number[]][] = [
  ['仕入高', [27.9, 28.5, 32.0, 31.2, 29.8, 26.4, 27.1, 35.6, 33.2, 30.1, 29.7, 32.8, 31.0]],
  ['人件費', [16.5, 16.8, 17.2, 17.5, 18.0, 18.4, 18.1, 18.6, 18.2, 17.9, 18.0, 17.8, 18.3]],
  ['家賃・地代', [12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0]],
  ['広告宣伝費', [3.9, 4.2, 6.8, 5.1, 7.4, 8.9, 12.0, 24.0, 16.2, 9.1, 6.8, 5.4, 4.7]],
  ['外注費', [8.2, 8.6, 10.2, 9.1, 11.5, 9.8, 8.7, 10.1, 9.6, 9.3, 8.9, 10.4, 9.7]],
  ['通信費', [2.0, 2.1, 2.3, 2.2, 2.4, 2.5, 2.5, 2.6, 2.4, 2.3, 2.4, 2.5, 2.5]],
  ['その他', [6.3, 6.7, 5.9, 6.1, 7.2, 6.8, 7.1, 8.5, 7.9, 6.6, 6.2, 5.8, 6.4]],
];

const input: MatrixSkewInput = {
  months: MONTHS,
  unrecordedMonths: [],
  rows: FIXTURE.map(([label, series]) => ({
    key: label,
    label,
    series: series.map((v) => Math.round(v * 10_000)),
  })),
  // §3.5.1 の表外データ。2026-03 の前年同月比（24.0 / 6.0 - 1 = +300%）に使う
  outside: { '2025-03': { 広告宣伝費: 60_000 } },
};

describe('matrixSkewTop（§5.1 の選定規則）', () => {
  it('§3.5 のフィクスチャから、仕様が明記した 3 点をこの順で選ぶ', () => {
    const top = matrixSkewTop(input);
    expect(top.map((p) => [p.rank, p.rowKey, p.month])).toEqual([
      [1, '広告宣伝費', '2026-03'],
      [2, '外注費', '2025-12'],
      [3, 'その他', '2026-03'],
    ]);
  });

  it('1 位の前月比・前年同月比が §4.2 の実値と一致する', () => {
    const first = matrixSkewTop(input)[0];
    expect(first?.amount).toBe(240_000);
    expect(first?.momRate).toBeCloseTo(1.0, 10); // 24.0 / 12.0 - 1
    expect(first?.yoyRate).toBeCloseTo(3.0, 10); // 24.0 / 6.0 - 1（表の外を参照）
  });

  it('偏りの定義は zScores と同じもので、ここに別の式を持たない', () => {
    // 家賃・地代は 13 か月すべて同額なので行内偏りが 0。月内偏りだけで拾われるか、
    // 拾われないかのどちらかであり、「ばらつきが無いのに偏っている」とは絶対にならない
    const top = matrixSkewTop(input, 50);
    for (const p of top.filter((x) => x.rowKey === '家賃・地代')) {
      expect(p.score).toBeLessThan(1);
    }
  });

  it('未記帳月はスコアの計算にも候補にも入れない', () => {
    const withUnrecorded = matrixSkewTop({ ...input, unrecordedMonths: ['2026-03'] }, 50);
    expect(withUnrecorded.some((p) => p.month === '2026-03')).toBe(false);
    // 2026-03 が消えると、外れ値を含まない系列になるので広告宣伝費の最上位は別の月になる
    expect(withUnrecorded[0]?.month).not.toBe('2026-03');
  });

  it('前月が未記帳なら前月比を出さない（0 を前月として割らない）', () => {
    const top = matrixSkewTop({ ...input, unrecordedMonths: ['2026-02'] }, 50);
    const march = top.find((p) => p.rowKey === '広告宣伝費' && p.month === '2026-03');
    expect(march?.momRate).toBeNull();
  });

  it('前年同月が表の中にも外にも無ければ前年同月比は出さない', () => {
    const top = matrixSkewTop({ ...input, outside: undefined }, 50);
    // 2025-08 の前年同月（2024-08）は §3.5.1 が定義していない
    const aug = top.find((p) => p.month === '2025-08');
    expect(aug?.yoyRate).toBeNull();
  });

  it('候補が limit 未満ならある分だけ返し、0 件なら空を返す', () => {
    expect(matrixSkewTop({ months: [], unrecordedMonths: [], rows: [] })).toEqual([]);
    expect(matrixSkewTop({ ...input, rows: [] })).toEqual([]);
    expect(matrixSkewTop(input, 1).length).toBe(1);
  });

  it('同点は 金額降順 → 新しい月 → 行の固定順 で決まる', () => {
    // 2 行 2 列すべて同額にすると、z は全て 0・前月比も 0 で score が並ぶ。
    // このとき決着するのは月の新しさ、次に行の固定順だけである
    const flat = matrixSkewTop(
      {
        months: ['2026-01', '2026-02'],
        unrecordedMonths: [],
        rows: [
          { key: 'a', label: 'A', series: [100, 100] },
          { key: 'b', label: 'B', series: [100, 100] },
        ],
      },
      4,
    );
    expect(flat.map((p) => [p.rowKey, p.month])).toEqual([
      ['a', '2026-02'],
      ['b', '2026-02'],
      ['a', '2026-01'],
      ['b', '2026-01'],
    ]);
  });
});

describe('合計・平均・濃淡の対象（§3.2 / §3.3 / §9.3）', () => {
  const recorded = recordedIndexes(MONTHS, []);

  it('§3.5 の全行合計が三者一致の 1,139.4 万になる', () => {
    const total = input.rows.reduce((s, r) => s + matrixRowSummary(r.series, recorded).total, 0);
    expect(total).toBe(11_394_000);
  });

  it('行の平均は記帳済み月数で割る（未記帳月を 0 として数えない）', () => {
    const series = [100, 200, 0];
    const months = ['2026-01', '2026-02', '2026-03'];
    const all = matrixRowSummary(series, recordedIndexes(months, []));
    const skip = matrixRowSummary(series, recordedIndexes(months, ['2026-03']));
    expect(all).toEqual({ total: 300, average: 100 });
    // 未記帳の 3 月を除けば分母は 2 になる。0 を混ぜた 100 とは違う値になること自体が要点
    expect(skip).toEqual({ total: 300, average: 150 });
  });

  it('列の合計・平均は本体行だけから出る', () => {
    const rows = [{ series: [10, 20] }, { series: [30, 40] }];
    expect(matrixColumnSummary(rows, 0)).toEqual({ total: 40, average: 20 });
    expect(matrixColumnSummary(rows, 1)).toEqual({ total: 60, average: 30 });
  });

  it('濃淡の対象は本体セルだけで、合計行・未記帳月を含まない', () => {
    const values = matrixBodyValues(input.rows, recorded);
    expect(values.length).toBe(7 * 13);
    // 最も濃いセルは仕入高 2026-03 の 35.6 万であって、§5.1 で 1 位になる広告宣伝費 24.0 万ではない。
    // 濃淡は絶対額、偏りは z スコアで、別のものを見ている（§3.3 と §5.1 を分けている理由）
    expect(Math.max(...values)).toBe(356_000);
    expect(Math.min(...values)).toBe(20_000);
    // 行合計（最小でも通信費の 30.7 万、最大は仕入高の 395.3 万）が混ざっていないこと
    expect(values).not.toContain(3_953_000);
  });

  it('未記帳月を落とすと濃淡の対象からもその列が消える', () => {
    const values = matrixBodyValues(input.rows, recordedIndexes(MONTHS, ['2026-03']));
    expect(values.length).toBe(7 * 12);
    expect(values).not.toContain(356_000);
  });
});
