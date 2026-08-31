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

/*
 * 図の色の正本は styles.css の :root カスタムプロパティ。
 * ここに同じ16進を並べると、CSSバッジと図の系列で「警告色が2種類ある」状態(実際に --warn で発生した)
 * を止められない。フォールバックは styles.css と同じ値にしてあり、CSS が読めない環境
 * (SSR・jsdom・CSS適用前のモジュール初期化)でも見た目は変わらない。
 */
const COLOR_FALLBACKS = {
  biz: '#2f5da8',
  per: '#9c4257',
  neutral: '#7b8784',
  warn: '#805a12',
  danger: '#b23a3a',
  good: '#2e7d5b',
  ink: '#1d2a2c',
  inkSoft: '#51625f',
  line: '#dde3e1',
} as const;

type ColorName = keyof typeof COLOR_FALLBACKS;

/** styles.css に対応する変数を持たない、図の中でしか使わない中間色。 */
const WITHOUT_CSS_VARIABLE: ReadonlySet<ColorName> = new Set<ColorName>(['neutral']);

/** CSS変数名。名前が `--<キー>` と一致しないものだけ明示する。 */
const CSS_VARIABLE: Partial<Record<ColorName, string>> = { inkSoft: '--ink-soft' };

const resolved = new Map<ColorName, string>();

/**
 * CSS変数を1度だけ読んで覚える。
 * 読めなかった(空文字が返った)ときは覚えない ─ CSS適用前に一度触られただけで
 * フォールバックが焼き付いてしまうのを避けるため。
 */
function themeColor(name: ColorName): string {
  const cached = resolved.get(name);
  if (cached) return cached;
  if (WITHOUT_CSS_VARIABLE.has(name)) return COLOR_FALLBACKS[name];
  let value = '';
  try {
    if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
      value = getComputedStyle(document.documentElement)
        .getPropertyValue(CSS_VARIABLE[name] ?? `--${name}`)
        .trim();
    }
  } catch {
    value = '';
  }
  if (!value) return COLOR_FALLBACKS[name];
  resolved.set(name, value);
  return value;
}

/** 図の系列色。参照のたびに CSS 変数を引く(初回だけ実読み)。 */
export const COLORS: Record<ColorName, string> = {
  get biz() {
    return themeColor('biz');
  },
  get per() {
    return themeColor('per');
  },
  get neutral() {
    return themeColor('neutral');
  },
  get warn() {
    return themeColor('warn');
  },
  get danger() {
    return themeColor('danger');
  },
  get good() {
    return themeColor('good');
  },
  get ink() {
    return themeColor('ink');
  },
  get inkSoft() {
    return themeColor('inkSoft');
  },
  get line() {
    return themeColor('line');
  },
};

Chart.defaults.color = COLORS.inkSoft;
Chart.defaults.borderColor = COLORS.line;

/** ベンダー積み上げ用の追加色(テーマ色で足りない5色目以降)。 */
const VENDOR_EXTRA_COLORS = ['#5b4f9c', '#3a8ea8', '#b06a3a', '#6a7f3a', '#8a8a8a'];

/**
 * ベンダー積み上げ・レポート図のパレット(HTML版の系統色)。
 * 先頭4色はテーマ色そのものなので、COLORS 経由で CSS 変数に追随させる。
 */
export function vendorPalette(): string[] {
  return [COLORS.biz, COLORS.per, COLORS.warn, COLORS.good, ...VENDOR_EXTRA_COLORS];
}

/**
 * 図のアニメーション。動きを減らす設定の利用者には出さない。
 * ページ側で個別に animation:false と書くと画面ごとに方針がずれるので、必ずこれを通す。
 */
export const chartAnimation = (): false | { duration: number } =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? false
    : { duration: 220 };

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
