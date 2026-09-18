/**
 * 表の組み立て（仕様 §3.2 / §3.3）を固定する。
 *
 * 要になるのは「合計行・平均行を階級の分母から外す」ことで、これは見た目では判定できない。
 * 潰れているかどうかは**階級値そのもの**でしか分からないので、`intensity` を直接見る。
 */
import { describe, expect, it } from 'vitest';
import type { MatrixData } from '../../../api.js';
import { matrixTableModel } from './model.js';

/** 総計が個々のセルより一桁大きい形。合計を分母へ混ぜたときの潰れがここで出る。 */
const data: MatrixData = {
  months: ['2026-01', '2026-02', '2026-03'],
  unrecordedExpMonths: [],
  years: ['2026'],
  rows: [
    { label: 'A', isTotal: false, series: [100_000, 200_000, 300_000], yearTotals: [], yoy: 0 },
    { label: 'B', isTotal: false, series: [50_000, 60_000, 70_000], yearTotals: [], yoy: 0 },
    { label: '経費計', isTotal: true, series: [150_000, 260_000, 370_000], yearTotals: [], yoy: 0 },
  ],
};

const rowOf = (model: ReturnType<typeof matrixTableModel>, label: string) =>
  model.rows.find((r) => r.key === label);

describe('matrixTableModel（§3.2 の表構造）', () => {
  it('列は月 13 相当 + 合計 + 平均の順で並ぶ', () => {
    const model = matrixTableModel(data, 'val');
    expect(model.columns).toEqual(['2026/01', '2026/02', '2026/03', '合計', '平均']);
  });

  it('core の集計行は本体に出さず、合計行・平均行をここで作る', () => {
    const model = matrixTableModel(data, 'val');
    expect(model.rows.map((r) => r.key)).toEqual(['A', 'B', '合計', '平均']);
  });

  it('合計行と合計列の交点が総計になる', () => {
    const model = matrixTableModel(data, 'val');
    const total = rowOf(model, '合計');
    // 月の合計は 150,000 / 260,000 / 370,000、その和が 780,000
    expect(total?.cells.slice(0, 3).map((c) => c.value)).toEqual([150_000, 260_000, 370_000]);
    expect(total?.cells[3]?.value).toBe(780_000);
    expect(rowOf(model, 'A')?.cells[3]?.value).toBe(600_000);
    expect(rowOf(model, 'B')?.cells[3]?.value).toBe(180_000);
  });

  it('平均行の合計列・平均列は値を持たない（§3.2 の `-`）', () => {
    const model = matrixTableModel(data, 'val');
    const avg = rowOf(model, '平均');
    expect(avg?.cells.slice(0, 3).map((c) => c.value)).toEqual([75_000, 130_000, 185_000]);
    expect(avg?.cells[3]?.value).toBeNull();
    expect(avg?.cells[4]?.value).toBeNull();
  });

  it('濃淡の分母は本体セルだけから取る（合計行で潰れない）', () => {
    const model = matrixTableModel(data, 'val');
    // 本体セルの最小 50,000 が最下位、最大 300,000 が最上位。合計 780,000 を混ぜていれば
    // 300,000 は最上位に届かない
    expect(model.scale.min).toBe(50_000);
    expect(model.scale.max).toBe(300_000);
    expect(rowOf(model, 'A')?.cells[2]?.intensity).toBe(1);
    expect(rowOf(model, 'B')?.cells[0]?.intensity).toBe(0);
  });

  it('本体セルの階級値が最下位へ潰れていない（7 段のうち 3 段以上を使う）', () => {
    const model = matrixTableModel(data, 'val');
    const body = ['A', 'B'].flatMap((k) => rowOf(model, k)?.cells.slice(0, 3) ?? []);
    const bands = new Set(body.map((c) => c.intensity));
    expect(bands.size).toBeGreaterThanOrEqual(3);
  });

  it('合計行・平均行・合計列・平均列は塗らない', () => {
    const model = matrixTableModel(data, 'val');
    expect(rowOf(model, '合計')?.cells.every((c) => c.intensity === null)).toBe(true);
    expect(rowOf(model, '平均')?.cells.every((c) => c.intensity === null)).toBe(true);
    expect(
      rowOf(model, 'A')
        ?.cells.slice(3)
        .every((c) => c.intensity === null),
    ).toBe(true);
  });

  it('未記帳月は未記帳として名乗り、合計・平均・濃淡から外れる', () => {
    const model = matrixTableModel({ ...data, unrecordedExpMonths: ['2026-03'] }, 'val');
    const a = rowOf(model, 'A');
    expect(a?.cells[2]).toEqual({ value: null, intensity: null, absence: 'unrecorded' });
    // 合計は 100,000 + 200,000、平均は 2 か月で割る
    expect(a?.cells[3]?.value).toBe(300_000);
    expect(a?.cells[4]?.value).toBe(150_000);
    expect(model.scale.max).toBe(200_000);
  });

  it('率モードでは濃淡を付けず、増=pos / 減=neg のクラスだけを持つ', () => {
    const model = matrixTableModel(data, 'mom');
    const a = rowOf(model, 'A');
    expect(model.shaded).toBe(false);
    // 先頭の月は比較の相手がいない
    expect(a?.cells[0]?.value).toBeNull();
    expect(a?.cells[1]?.value).toBeCloseTo(1.0);
    expect(a?.cells[1]?.className).toBe('pos');
    expect(a?.cells.every((c) => c.intensity === null)).toBe(true);
    // 率モードに合計行・平均行は出さない
    expect(model.rows.map((r) => r.key)).toEqual(['A', 'B']);
  });
});
