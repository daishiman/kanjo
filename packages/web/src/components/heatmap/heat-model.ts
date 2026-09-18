/**
 * 濃淡の階級値と色（仕様 §3.3 が正本）。
 *
 * 分母の取り方は画面によって違ってよいが、名前の無い違いは事故になるので両方に名前を持たせる。
 * - `table`: 表示中の全データセルの最小〜最大を 7 階級へ畳む。行をまたいで濃さを比べられる（マトリックス画面）
 * - `row`: その行の最大を分母にする。行内の山を見る図（AI レポートの図 9）
 *
 * `HeatGrid` はここが返した階級値だけを塗る。分母は `HeatGrid` の props に現れない。
 *
 * **分母そのものの算出は core の `heat-scale.ts` が持つ**。API が §9.1 の `heatScale` を返すため、
 * core と web の 2 人の消費者がいるからである。ここが持つのは階級値と色という表示の概念だけ。
 */
import { HEAT_BANDS, type HeatScale, heatScaleOf } from '@kanjo/core';

export { HEAT_BANDS, heatScaleOf };
export type { HeatScale };

/** 濃淡の分母の取り方。名前を持たない正規化を作らない。 */
export type HeatNormalize = 'table' | 'row';

/** セルの塗り分け値（0..1）。`null` は塗らない（未記帳・データ無し）。 */
export type HeatIntensity = number | null;

/** 値と階級値が 1 つの型に同居する。片方だけを `HeatGrid` へ渡せない。 */
export interface HeatCell {
  value: number | null;
  intensity: HeatIntensity;
  /**
   * 値が無い理由。`value: null` だけでは「未記帳」と「そもそも計上が無い」を区別できず、
   * 仕様 §3.3 は前者に `未記帳` ピルを出すと定めている。既定（省略）は後者で、空欄になる。
   */
  absence?: 'unrecorded';
  /**
   * セルに足すクラス。増=赤 / 減=緑 のような**文字の**色に使う（`deltaCls` の出力）。
   * 背景の濃さは `intensity` だけが決めるので、ここに濃さを持ち込むことはできない。
   */
  className?: string;
}

export interface HeatRow {
  key: string;
  label: string;
  cells: readonly HeatCell[];
}

/**
 * 各階級の下限（階級 1..steps の順）。§3.3 の濃淡凡例もこの値を表示する。
 *
 * 階級の境界を式の副産物にせず、データとして 1 か所に持つ。`335000 / 7` のように割り切れない
 * 幅では、同じ境界でも計算の順序が違うだけで値がわずかにずれ、境界ちょうどの帰属が静かに
 * 変わってしまう。判定も凡例もこの配列を見ることで、ずれる余地そのものを無くす。
 */
export function heatBandLowerBounds(scale: HeatScale): number[] {
  const { min, max, steps } = scale;
  if (steps <= 1 || max <= min) return [min];
  return Array.from({ length: steps }, (_, i) => min + ((max - min) * i) / steps);
}

/**
 * 値が 1..steps のどの階級に属するか。
 *
 * 各階級を `[下限, 上限)` の半開区間として扱う。すなわち**境界ちょうどに乗った値は上位側の
 * 階級に属する**（仕様 §3.3 は階級数しか書いておらず帰属を決めていないので、ここが正本になる。
 * 四捨五入で寄せると最上位と最下位だけ区間の幅が半分になり、「7 等分」という仕様の言葉と
 * 食い違うため半開区間に揃えた）。
 *
 * `max` は上限そのものなので最上位の階級へ入れる。`min === max`（全セル同額）のときは
 * 濃淡で区別すべき差が無く、かつその値は表全体の最大でもあるため最上位を返す。
 * 「塗らない」との区別は呼び出し側が `null` で行う。
 */
function bandOf(value: number, scale: HeatScale): number {
  const bounds = heatBandLowerBounds(scale);
  if (bounds.length <= 1) return scale.steps;
  for (let band = bounds.length; band >= 2; band--) {
    if (value >= (bounds[band - 1] as number)) return band;
  }
  return 1;
}

/**
 * セルごとの階級値を作る。分母は戻り値の `scale` に入るが、呼び出し側が
 * `HeatGrid` へ渡す経路は無い（`HeatGridProps` が `scale` を受け取らない）。
 */
export function heatIntensities(
  series: readonly (number | null)[],
  normalize: HeatNormalize,
  opts?: { bands?: number; scale?: HeatScale },
): { intensities: HeatIntensity[]; scale: HeatScale } {
  const bands = opts?.bands ?? HEAT_BANDS;

  if (normalize === 'row') {
    // 行ごとの最大を分母にする。階級へ畳まず連続値のまま返す（AI レポートの現行挙動）
    const max = series.reduce<number>((m, v) => Math.max(m, v ?? 0), 0);
    const scale: HeatScale = { min: 0, max, steps: bands };
    if (max <= 0) return { intensities: series.map(() => null), scale };
    return { intensities: series.map((v) => (v == null ? null : v / max)), scale };
  }

  // table: 表全体で共通の階級。scale が渡されなければ series 自身から作る
  const scale = opts?.scale ?? heatScaleOf(series, bands);
  if (scale.max <= 0) return { intensities: series.map(() => null), scale };
  // 階級が 1 つしかない設定では全セルが同じ濃さになる (段階が無いので最濃へ倒す)
  const toIntensity = (band: number) => (scale.steps <= 1 ? 1 : (band - 1) / (scale.steps - 1));
  return {
    intensities: series.map((v) => (v == null || v <= 0 ? null : toIntensity(bandOf(v, scale)))),
    scale,
  };
}

/**
 * 階級値を装飾の不透明度へ写す（5% 〜 90%）。
 * 値を文字でも併記する表なので、最も薄い階級でも下限を持たせて「塗られていない」と区別する。
 */
export function heatShade(intensity: number): number {
  return (13 + Math.min(1, Math.max(0, intensity)) * (230 - 13)) / 255;
}

/** 行と列から `HeatRow` を組み立てる。値と階級値を必ず対にする。 */
export function heatRow(
  key: string,
  label: string,
  values: readonly (number | null)[],
  normalize: HeatNormalize,
  opts?: { bands?: number; scale?: HeatScale },
): HeatRow {
  const { intensities } = heatIntensities(values, normalize, opts);
  return {
    key,
    label,
    cells: values.map((value, i) => ({ value, intensity: intensities[i] ?? null })),
  };
}
