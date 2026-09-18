/**
 * 濃淡の分母の作り方を固定する（仕様 §3.3）。
 *
 * ここで釘付けにするのは次の4点:
 * - `table` は表全体で共通の 7 階級。境界ちょうどの値は**上位側**の階級に属する
 * - `row` は行ごとの最大が分母。同じ値でも行が違えば濃さが違ってよい
 * - 分母が作れない入力（全セルが `null` / 0 以下 / 全セル同額）で落ちない
 * - 表示粒度を一切参照しない。月次13点でも四半期5点でも、同じ数値列なら同じ濃さになる
 */
import { describe, expect, it } from 'vitest';
import {
  HEAT_BANDS,
  heatBandLowerBounds,
  heatIntensities,
  heatRow,
  heatScaleOf,
  heatShade,
} from './heat-model.js';

/** 仕様 §3.5 のフィクスチャから出る表全体のスケール。期待値をここから導く */
const SCALE = { min: 21_000, max: 356_000, steps: HEAT_BANDS } as const;
/**
 * 階級 n の下限（n は 1 始まり）。凡例が表示する値と同じものを使う。
 * 335000 / 7 は割り切れないので、期待値を別の式で書き直すと浮動小数で境界がずれる
 */
const lowerOf = (band: number) => heatBandLowerBounds({ ...SCALE })[band - 1] as number;
/** 階級 n のセルに出る塗り値 */
const intensityOf = (band: number) => (band - 1) / (SCALE.steps - 1);

const asTable = (series: readonly (number | null)[]) =>
  heatIntensities(series, 'table', { scale: { ...SCALE } }).intensities;

describe('heatIntensities: table 正規化（表全体で共通の 7 階級）', () => {
  it('最小値は最も薄い階級、最大値は最も濃い階級になる', () => {
    expect(asTable([SCALE.min, SCALE.max])).toEqual([intensityOf(1), intensityOf(7)]);
  });

  it('境界ちょうどの値は上位側の階級に属する', () => {
    // 階級 2〜7 の下限そのものを渡す。下位側に落ちるなら band-1 になり期待値が崩れる
    for (const band of [2, 3, 4, 5, 6, 7]) {
      expect(asTable([lowerOf(band)])).toEqual([intensityOf(band)]);
    }
  });

  it('境界の直前の値は下位側の階級に留まる', () => {
    for (const band of [2, 3, 4, 5, 6, 7]) {
      expect(asTable([lowerOf(band) - 1])).toEqual([intensityOf(band - 1)]);
    }
  });

  it('7 階級ちょうどで、それ以上の段階を作らない', () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) => SCALE.min + ((SCALE.max - SCALE.min) * i) / 199).flatMap((v) =>
        asTable([v]),
      ),
    );
    expect(seen.size).toBe(HEAT_BANDS);
  });

  it('行が違っても、同じ値なら同じ濃さになる（表全体で比べられる）', () => {
    const rowA = asTable([SCALE.max, 100_000]);
    const rowB = asTable([100_000, SCALE.min]);
    expect(rowA[1]).toBe(rowB[0]);
  });

  it('値が無いセルと 0 以下のセルは塗らない', () => {
    expect(asTable([null, 0, -5_000, 100_000])).toEqual([null, null, null, intensityOf(2)]);
  });

  it('全セルが同額のときは最も濃い階級へ倒す（ばらつきが無いので段階が作れない）', () => {
    const { intensities, scale } = heatIntensities([50_000, 50_000, 50_000], 'table');
    expect(scale).toEqual({ min: 50_000, max: 50_000, steps: HEAT_BANDS });
    expect(intensities).toEqual([1, 1, 1]);
  });

  it('塗れる値が 1 つも無ければ全セルを塗らない', () => {
    const { intensities, scale } = heatIntensities([null, 0, null], 'table');
    expect(scale).toEqual({ min: 0, max: 0, steps: HEAT_BANDS });
    expect(intensities).toEqual([null, null, null]);
  });
});

describe('heatIntensities: row 正規化（行ごとの最大が分母）', () => {
  it('その行の最大を 1 とする連続値になる', () => {
    expect(heatIntensities([50_000, 100_000, null], 'row').intensities).toEqual([0.5, 1, null]);
  });

  it('行の最大が 0 以下なら塗らない', () => {
    expect(heatIntensities([0, null, 0], 'row').intensities).toEqual([null, null, null]);
  });

  it('table とは違う濃さを出す（同じ系列でも分母が違う）', () => {
    const series = [50_000, 100_000];
    expect(heatIntensities(series, 'row').intensities).not.toEqual(asTable(series));
  });
});

describe('heatBandLowerBounds（凡例が表示する階級の下限）', () => {
  it('階級数ぶんの下限を、最小値から単調増加で返す', () => {
    const bounds = heatBandLowerBounds({ ...SCALE });
    expect(bounds.length).toBe(HEAT_BANDS);
    expect(bounds[0]).toBe(SCALE.min);
    expect(bounds.every((v, i) => i === 0 || v > (bounds[i - 1] as number))).toBe(true);
    expect(bounds[bounds.length - 1]).toBeLessThan(SCALE.max);
  });

  it('ばらつきが無ければ階級は 1 つしか無い', () => {
    expect(heatBandLowerBounds({ min: 50_000, max: 50_000, steps: HEAT_BANDS })).toEqual([50_000]);
  });
});

describe('heatScaleOf', () => {
  it('塗れる値だけから min/max を作る（null と 0 以下は分母に入れない）', () => {
    expect(heatScaleOf([null, 0, -1, 21_000, 356_000])).toEqual({
      min: 21_000,
      max: 356_000,
      steps: HEAT_BANDS,
    });
  });
});

describe('表示粒度を参照しない', () => {
  it('月次 13 点でも四半期 5 点でも、同じ数値列なら同じ濃さになる', () => {
    // 37 か月以上の期間では表示前に四半期へ畳まれる。heat-model が受け取るのは畳んだ後の値で、
    // 粒度そのものは引数に無い。長さが違っても値が同じなら結果が一致することで示す
    const quarterly = [120_000, 240_000, 356_000, 21_000, 90_000];
    const monthly = [...quarterly, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 95_000];
    const scale = { ...SCALE };
    const q = heatIntensities(quarterly, 'table', { scale }).intensities;
    const m = heatIntensities(monthly, 'table', { scale }).intensities;
    expect(m.slice(0, quarterly.length)).toEqual(q);
  });
});

describe('heatRow', () => {
  it('値と階級値を必ず対にして返す（片方だけのセルを作らない）', () => {
    const row = heatRow('広告宣伝費', '広告宣伝費', [SCALE.max, null], 'table', {
      scale: { ...SCALE },
    });
    expect(row).toEqual({
      key: '広告宣伝費',
      label: '広告宣伝費',
      cells: [
        { value: SCALE.max, intensity: intensityOf(7) },
        { value: null, intensity: null },
      ],
    });
  });
});

describe('heatShade', () => {
  it('最も薄い階級でも下限の濃度を持つ（塗っていないセルと区別できる）', () => {
    expect(heatShade(0)).toBe(13 / 255);
    expect(heatShade(1)).toBe(230 / 255);
  });

  it('範囲外の値は 0..1 へ丸める', () => {
    expect(heatShade(-1)).toBe(heatShade(0));
    expect(heatShade(2)).toBe(heatShade(1));
  });
});
