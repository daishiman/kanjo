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

/* -------- 統計指標の基準月数(設定画面から変えられる) -------- */

/** 平均・標準偏差・移動平均・固定費判定に必要な記帳月数の既定 */
export const DEFAULT_STAT_MIN_MONTHS = 6;
/** 3ヶ月未満では平均もブレも意味を持たず、24ヶ月を超えると誰のデータでも何も出せない */
export const STAT_MIN_MONTHS_MIN = 3;
export const STAT_MIN_MONTHS_MAX = 24;

/** 設定値を受け取り、範囲外・数値でない値は既定に寄せる(保存側と表示側で同じ規則を使う) */
export const clampStatMinMonths = (value: unknown): number => {
  const n = typeof value === 'number' ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(n)) return DEFAULT_STAT_MIN_MONTHS;
  return Math.min(STAT_MIN_MONTHS_MAX, Math.max(STAT_MIN_MONTHS_MIN, n));
};

export interface StatThresholds {
  /** 外れ値(zスコア)を出すのに必要な記帳月数 */
  outliers: number;
  /** 移動平均・固定費/変動費の判定に必要な記帳月数 */
  movingAverage: number;
  /** 傾向(増えている/減っている)を言うのに必要な記帳月数 */
  trend: number;
  /** 季節性を言うのに必要な記帳月数 */
  seasonality: number;
  /** 前年同月比に必要な記帳月数 */
  yearOverYear: number;
}

/**
 * 基準月数から、手法ごとの必要月数を決める。
 * - outliers / movingAverage は基準月数そのもの(利用者が変えられる)。
 * - trend / seasonality / yearOverYear は暦で決まる周期(12・24・13ヶ月)なので基準月数では下げない。
 *   基準月数の方が長い場合だけ、そちらへ引き上げる(基準より緩い判定を作らない)。
 */
export const statThresholds = (base: number = DEFAULT_STAT_MIN_MONTHS): StatThresholds => {
  const b = clampStatMinMonths(base);
  return {
    outliers: b,
    movingAverage: b,
    trend: Math.max(12, b),
    seasonality: Math.max(24, b),
    yearOverYear: Math.max(13, b),
  };
};
