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

Chart.defaults.font.family =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.color = '#51625f';
Chart.defaults.borderColor = '#dde3e1';

export const COLORS = {
  biz: '#2f5da8',
  per: '#9c4257',
  neutral: '#7b8784',
  warn: '#a8781c',
  danger: '#b23a3a',
  good: '#2e7d5b',
  ink: '#1d2a2c',
  line: '#dde3e1',
};

/** ベンダー積み上げ用のパレット(HTML版の系統色) */
export const VENDOR_PALETTE = [
  '#2f5da8',
  '#9c4257',
  '#a8781c',
  '#2e7d5b',
  '#5b4f9c',
  '#3a8ea8',
  '#b06a3a',
  '#6a7f3a',
  '#8a8a8a',
];

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
