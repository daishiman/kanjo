/**
 * 濃淡の分母（仕様 §3.3 / §9.1 の `heatScale`）。
 *
 * ここに置くのは**分母の算出だけ**で、階級値や色は持たない。消費者が 2 人いるためである:
 * API は §9.1 のレスポンスに `heatScale` を載せ、画面はその分母で各セルの階級値を作る。
 * 表示の概念（色・不透明度）は web の `components/heatmap/heat-model.ts` が持つ。
 */

/** 仕様 §3.3 の階級数。API のレスポンスと画面の塗り分けが同じ数を使う。 */
export const HEAT_BANDS = 7;

export interface HeatScale {
  min: number;
  max: number;
  steps: number;
}

/**
 * 塗る対象の値から分母を作る。`null` と 0 以下は対象外（未記帳・データ無し）。
 *
 * **合計・平均の行列を渡さないのは呼び出し側の責務**である（§3.3）。総計は個々のセルより
 * 一桁大きいので、混ぜて min/max を取ると本体セルが最下位階級へ潰れる。何が本体セルかを
 * 知っているのは表を組み立てる側であり、この関数ではない。
 */
export function heatScaleOf(values: readonly (number | null)[], bands: number = HEAT_BANDS): HeatScale {
  const nums = values.filter((v): v is number => v != null && v > 0);
  if (nums.length === 0) return { min: 0, max: 0, steps: bands };
  return { min: Math.min(...nums), max: Math.max(...nums), steps: bands };
}
