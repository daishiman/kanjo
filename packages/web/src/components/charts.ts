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
