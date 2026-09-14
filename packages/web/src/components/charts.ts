import { MOTION, COLOR as TOKEN_COLOR, TYPOGRAPHY, VENDOR_EXTRA_COLORS } from '@kanjo/core';
/** Chart.js の登録とテーマ共通設定(1箇所に集約) */
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  type Plugin,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  Filler,
);

Chart.defaults.font.family = TYPOGRAPHY.fontHead;
Chart.defaults.font.size = TYPOGRAPHY.chartFontSize;

/*
 * 図の色は実行時に styles.css の :root カスタムプロパティを読む(高コントラスト設定の上書きに追随するため)。
 * 読めない環境(SSR・jsdom・CSS適用前のモジュール初期化)の予備値は、:root と同じ正本
 * packages/core/src/design-tokens.ts から取る。ここに16進を並べると CSS と図で色が2種類になる。
 */
const COLOR_NAMES = [
  'biz',
  'per',
  'neutral',
  'warn',
  'warnFill',
  'danger',
  'good',
  'ink',
  'inkSoft',
  'line',
  'income',
  'expense',
  'accent',
] as const;

export type ChartColorName = (typeof COLOR_NAMES)[number] | 'net';

const cssVariable = (name: Exclude<ChartColorName, 'net'>) =>
  `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/**
 * CSS 変数は参照ごとに読む。prefers-contrast の変更やテスト中の theme 差し替えを
 * module 初期化時の値へ固定しないため、意図的に cache しない。
 */
function themeColor(name: Exclude<ChartColorName, 'net'>): string {
  let value = '';
  try {
    if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
      value = getComputedStyle(document.documentElement).getPropertyValue(cssVariable(name)).trim();
    }
  } catch {
    value = '';
  }
  if (!value) return TOKEN_COLOR[name];
  return value;
}

/**
 * 図の系列色。参照のたびに CSS 変数を引く(初回だけ実読み)。
 * 月次の収支図は income(青い棒)/ expense(赤系の棒)/ net(ティールの線)を使う。
 */
export const COLORS = Object.defineProperties(
  {} as Record<ChartColorName, string>,
  Object.fromEntries([
    ...COLOR_NAMES.map((name) => [name, { enumerable: true, get: () => themeColor(name) }]),
    ['net', { enumerable: true, get: () => themeColor('accent') }],
  ]),
);

/** 判別に使うデータ系列は不透明色だけを返す。 */
export function chartSeriesColor(name: ChartColorName): string {
  return name === 'net' ? themeColor('accent') : themeColor(name);
}

/**
 * 面・帯・heatmap など、値や不透明な輪郭を別に持つ装飾レイヤー専用。
 * 呼び出し側で16進 suffix を組み立てず、透明度の意図をこの境界に閉じる。
 */
export function chartDecorativeFill(color: string, opacity: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${alpha}`;
}

type ChartThemeSyncOptions = {
  matchMedia?: (query: string) => {
    addEventListener?: (type: 'change', listener: () => void) => void;
    removeEventListener?: (type: 'change', listener: () => void) => void;
  };
  readColor?: (name: 'inkSoft' | 'line') => string;
};

/**
 * OS の contrast/theme 変更時に global defaults と描画済み instance を同時更新する。
 * 初期化時だけ値を写すと CSS custom property の変更後に canvas だけ古くなるため、change ごとに再読込する。
 */
export function installChartThemeSync(options: ChartThemeSyncOptions = {}) {
  const media =
    options.matchMedia ?? (typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window));
  const readColor = options.readColor ?? ((name: 'inkSoft' | 'line') => themeColor(name));
  const query = media?.('(prefers-contrast: more)');
  const current = () => ({ color: readColor('inkSoft'), borderColor: readColor('line') });
  const sync = () => {
    const next = current();
    Chart.defaults.color = next.color;
    Chart.defaults.borderColor = next.borderColor;
    for (const instance of Object.values(Chart.instances)) instance.update('none');
  };
  sync();
  query?.addEventListener?.('change', sync);
  return {
    current,
    dispose: () => query?.removeEventListener?.('change', sync),
  };
}

installChartThemeSync();

/**
 * ベンダー積み上げ・レポート図のパレット(HTML版の系統色)。
 * 先頭4色はテーマ色そのものなので、COLORS 経由で CSS 変数に追随させる。
 * 注意系列は棒の塗りなので、文字用の warn ではなく塗り用の warnFill を使う。
 */
export function vendorPalette(): string[] {
  return [COLORS.biz, COLORS.per, COLORS.warnFill, COLORS.good, ...VENDOR_EXTRA_COLORS];
}

/**
 * 図のアニメーション。動きを減らす設定の利用者には出さない。
 * ページ側で個別に animation:false と書くと画面ごとに方針がずれるので、必ずこれを通す。
 */
export const chartAnimation = (): false | { duration: number } =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? false
    : { duration: MOTION.chart };

/**
 * 全図に共通の骨格。高さは CSS(.financial-figure__chart)が決めるので
 * maintainAspectRatio は必ず false にする。
 */
export const baseChartOptions = () => ({
  responsive: true as const,
  maintainAspectRatio: false as const,
  animation: chartAnimation(),
});

export const yenTick = (v: number | string): string => {
  const n = Number(v);
  if (Math.abs(n) >= 10000) return `${(n / 10000).toLocaleString('ja-JP')}万`;
  return n.toLocaleString('ja-JP');
};

/**
 * 積み上げ棒の、各期間の合計。
 *
 * 積み上げ図は「何が多いか」は色で分かるが、「その月に結局いくら払ったか」が読めない。
 * 目盛りから目分量で足すことになり、色が20を超えると当てにならない。合計は数字で出す。
 *
 * 凡例で系列を隠したときは、隠した分を除いた合計にする(図と数字がずれると図のほうを疑わせる)。
 */
export function stackedTotals(
  datasets: readonly { readonly data: readonly (number | null)[]; readonly hidden?: boolean }[],
): number[] {
  const totals: number[] = [];
  for (const ds of datasets) {
    if (ds.hidden) continue;
    ds.data.forEach((v, i) => {
      totals[i] = (totals[i] ?? 0) + (Number(v) || 0);
    });
  }
  return totals.map((v) => v ?? 0);
}

/**
 * 積み上げ棒の上に、その期間の合計を書き込むプラグイン。
 * 全グラフに効かせず、必要な図にだけ plugins={[stackTotalLabels]} で渡す。
 */
export const stackTotalLabels: Plugin<'bar'> = {
  id: 'stackTotalLabels',
  afterDatasetsDraw(chart) {
    const y = chart.scales.y;
    if (!y) return;
    const totals = stackedTotals(
      chart.data.datasets.map((ds, i) => ({
        data: (ds.data as (number | null)[]) ?? [],
        hidden: !chart.isDatasetVisible(i),
      })),
    );
    const firstVisible = chart.data.datasets.findIndex((_, i) => chart.isDatasetVisible(i));
    if (firstVisible < 0) return;
    const bars = chart.getDatasetMeta(firstVisible).data;
    const { ctx } = chart;
    ctx.save();
    ctx.font = `700 ${Chart.defaults.font.size}px ${Chart.defaults.font.family}`;
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    totals.forEach((total, i) => {
      const bar = bars[i];
      // 0円の月に「0」を並べても読む値が無い。棒が無い月は空けておく
      if (!total || !bar) return;
      ctx.fillText(yenTick(total), bar.x, y.getPixelForValue(total) - 3);
    });
    ctx.restore();
  },
};
