/**
 * 統計ユーティリティ。仕様書で固定した計算契約を実装する。
 */

export const mean = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** 不偏標準偏差（n-1）。n<2 は 0 */
export const std = (a: number[]): number => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

export const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const sum = (a: number[]): number => a.reduce((s, x) => s + x, 0);

/** 単純移動平均。窓に満たない先頭は null */
export const movingAvg = (arr: number[], w: number): (number | null)[] =>
  arr.map((_, i) => (i < w - 1 ? null : mean(arr.slice(i - w + 1, i + 1))));

export const yearOf = (m: string): string => m.slice(0, 4);
