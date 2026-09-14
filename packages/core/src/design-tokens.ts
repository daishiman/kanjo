/**
 * デザイントークンの正本(design/FINAL-UI/spec/DESIGN-SYSTEM.md を値に落としたもの)。
 *
 * - packages/web/src/styles.css の :root は、ここから scripts/design-token-css.mjs が生成する写し
 * - packages/web/src/components/charts.ts は CSS 変数を読めないときの予備値をここから取る
 * - 値を変えるときの唯一の編集点。テストは不変条件、lint は承認済み fingerprint を検査する
 *
 * このファイルは他モジュールを import しない。検査スクリプトが Node の型除去で直接読むため。
 */

/** DESIGN-SYSTEM.md「3. 視覚ルール」から取り込んだ10色 */
const DESIGN_SYSTEM_COLORS_VALUE = {
  bg: '#f6f8f9',
  surface: '#ffffff',
  line: '#d7e0e2',
  ink: '#15262b',
  inkSoft: '#617177',
  primary: '#14353d',
  accent: '#087f78',
  warnFill: '#b97000',
  danger: '#b33a3a',
  good: '#247a52',
} as const;

/**
 * 役割ごとの色。キーを kebab-case にしたものが CSS 変数名になる(inkSoft → --ink-soft)。
 * 値は小文字6桁 hex に揃える。透明な装飾面が必要なら web 側の chartDecorativeFill を通す。
 */
const COLOR_VALUE = {
  ...DESIGN_SYSTEM_COLORS_VALUE,
  /** 装飾罫線より一段濃い罫線(hover 時の輪郭など)。部品の枠には使わない */
  lineStrong: '#c6cecb',
  primaryHover: '#1d4852',
  /** 主色・事業色で塗った面の上の文字 */
  onPrimary: DESIGN_SYSTEM_COLORS_VALUE.surface,
  /** 事業(=ティール)。既存の --biz 参照を保つための別名 */
  biz: DESIGN_SYSTEM_COLORS_VALUE.accent,
  bizSoft: '#edf7f6',
  bizSoftLine: '#9fcac6',
  bizStrong: '#075f5a',
  per: '#9c4257',
  perSoft: '#f9eff2',
  /** 注意の文字。画像のアンバー(warnFill)は背景に 3.66:1 で文字に使えないため明度だけ下げた */
  warn: '#9a5d00',
  warnSoft: '#fdf9ef',
  dangerSoft: '#fdf3f3',
  dangerSoftStrong: '#fdf0ef',
  dangerTint: '#fffafa',
  goodSoft: '#f1f7f4',
  surfaceAlt: '#f6f6f4',
  /** 月次図の系列。画像の #599ae9 / #eb9099 を色相そのままで 3:1 まで暗くした(dec-chart-series-contrast) */
  income: '#428ce6',
  expense: '#e2606d',
  neutral: '#7b8784',
  /** 入力欄・選択欄・チェックボックスの枠。WCAG 1.4.11 の 3:1 を満たす(dec-border-color-roles) */
  controlBorder: '#7f9095',
  controlBorderHover: '#6e8086',
  sidebarLine: '#0d2b32',
  sidebarAccent: '#72ddd3',
  sidebarIndicator: '#4ed0c5',
  onSidebarAccent: '#062f2c',
  rowStripe: '#f6f8f8',
  rowHover: '#eef3f6',
  rowTotal: '#eff3f1',
  rowGroup: '#f2f5f7',
  rowDetail: '#f7faf9',
  rowTotalStacked: '#fafbfa',
  /** 改善要望のスクリーンショットに描く囲み線(canvas なので CSS 変数が届かない) */
  annotateStroke: '#e11d48',
} as const;

export type ColorToken = keyof typeof COLOR_VALUE;

/** 高コントラスト設定(prefers-contrast: more)で上書きする値 */
const HIGH_CONTRAST_COLOR_VALUE = {
  line: '#9aa5a2',
  bizSoft: '#d3ebe8',
  bizStrong: '#04403c',
} as const;

/**
 * コントラスト検査の母数(docs/design-system/requirements-baseline.md §3.1)。
 * text は背景・面に 4.5:1、controlBorder と chartSeries は 3:1。
 * decorativeLine は WCAG 1.4.11 の対象外で、部品の枠に使われていないことだけを検査する。
 */
const CONTRAST_ROLES_VALUE = {
  text: ['ink', 'inkSoft', 'primary', 'accent', 'biz', 'bizStrong', 'per', 'warn', 'danger', 'good'],
  controlBorder: ['controlBorder', 'controlBorderHover'],
  chartSeries: ['income', 'expense', 'accent', 'neutral', 'per', 'warnFill', 'good'],
  decorativeLine: ['line', 'lineStrong'],
} as const satisfies Record<string, readonly ColorToken[]>;

/** ベンダー積み上げの5色目以降(テーマ色で足りない分) */
const VENDOR_EXTRA_COLORS_VALUE = ['#5b4f9c', '#3a8ea8', '#b06a3a', '#6a7f3a', '#8a8a8a'] as const;

const SIZE_VALUE = {
  sidebarWidth: 220,
  headerHeight: 64,
  /** 読む・判断する標準ページの本文幅 */
  contentReadingMaxWidth: 1180,
  /** 月×科目など横長データを扱うページの上限 */
  contentDataMaxWidth: 1800,
  /** WCAG 2.5.5 Target Size (Enhanced) のタップ領域。緩和しない */
  tapTargetMin: 44,
  asidePanelWidth: 320,
  iconRailWidth: 68,
  tabbarHeight: 56,
  /** 狭幅のドロワーは常設サイドバーより一段広い(重ねて開くので本文幅を削らない) */
  drawerWidth: 240,
  financialChartHeight: 300,
  navIconSize: 20,
  tabIconSize: 18,
} as const;

const SPACE_VALUE = {
  pageGutter: 32,
  compactPageGutter: 20,
  navIconLabelGap: 10,
  navGroupGap: 14,
} as const;

const RADIUS_VALUE = {
  base: 8,
} as const;

const TYPOGRAPHY_VALUE = {
  fontHead:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  /** @fontsource から自己配信する Latin weight。consumer はこのどちらかを明示する */
  fontMonoWeights: [400, 600],
  minFontSize: 12,
  bodyFontSize: { min: 14, max: 16 },
  lineHeight: 1.6,
  /** 文字サイズの段。本文 15px を基準に一段ずつ。最小段は minFontSize と同じ */
  scale: { '2xs': 12, xs: 13, sm: 14, md: 15, base: 16, lg: 17, xl: 19, '2xl': 21, '3xl': 24 },
  /** 図の目盛り・凡例の文字 */
  chartFontSize: 12,
} as const;

const MOTION_VALUE = {
  instant: 90,
  fast: 140,
  base: 200,
  chart: 220,
  easeStandard: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/** 浮かせる面の影と、その背後を暗くする幕。色は ink を半透明にしたもの */
const SHADOW_VALUE = {
  popover: '0 8px 24px rgb(21 38 43 / 14%)',
  overlay: '0 12px 32px rgb(21 38 43 / 25%)',
  scrim: 'rgb(21 38 43 / 45%)',
  categoryPanel: '0 8px 24px rgb(0 0 0 / 12%)',
  drawer: '4px 0 20px rgb(0 0 0 / 12%)',
  compactPopover: '0 4px 16px rgb(0 0 0 / 12%)',
  floatingAction: '0 6px 20px rgb(29 42 44 / 28%)',
  floatingActionCompact: '0 2px 8px rgb(29 42 44 / 20%)',
} as const;

/** CSS・canvasだけが必要とする半透明色。媒体別の名前変換は外側の adapter が担う。 */
const EFFECT_COLOR_VALUE = {
  sidebarTextMuted: 'rgb(255 255 255 / 68%)',
  sidebarTextSubtle: 'rgb(255 255 255 / 62%)',
  sidebarDivider: 'rgb(255 255 255 / 14%)',
  sidebarText: 'rgb(255 255 255 / 86%)',
  sidebarRailDivider: 'rgb(255 255 255 / 18%)',
  sidebarHover: 'rgb(255 255 255 / 8%)',
  sidebarControlBorder: 'rgb(255 255 255 / 30%)',
  sidebarControlText: 'rgb(255 255 255 / 76%)',
  darkScrim: 'rgb(0 0 0 / 30%)',
  floatingPanelScrim: 'rgb(29 42 44 / 32%)',
  annotateHalo: 'rgb(255 255 255 / 90%)',
} as const;

/**
 * integrity fingerprint の唯一の公開 registry。
 * 表示 token はこの object の property として定義し、個別 export は下の alias から導出する。
 * 新しい表示 token を export だけして fingerprint から取りこぼす経路を作らない。
 */
export const DESIGN_TOKEN_INTEGRITY_VALUES = {
  designSystemColors: DESIGN_SYSTEM_COLORS_VALUE,
  color: COLOR_VALUE,
  highContrastColor: HIGH_CONTRAST_COLOR_VALUE,
  contrastRoles: CONTRAST_ROLES_VALUE,
  vendorExtraColors: VENDOR_EXTRA_COLORS_VALUE,
  size: SIZE_VALUE,
  space: SPACE_VALUE,
  radius: RADIUS_VALUE,
  typography: TYPOGRAPHY_VALUE,
  motion: MOTION_VALUE,
  shadow: SHADOW_VALUE,
  effectColor: EFFECT_COLOR_VALUE,
} as const;

export const DESIGN_SYSTEM_COLORS = DESIGN_TOKEN_INTEGRITY_VALUES.designSystemColors;
export const COLOR = DESIGN_TOKEN_INTEGRITY_VALUES.color;
export const HIGH_CONTRAST_COLOR = DESIGN_TOKEN_INTEGRITY_VALUES.highContrastColor;
export const CONTRAST_ROLES = DESIGN_TOKEN_INTEGRITY_VALUES.contrastRoles;
export const VENDOR_EXTRA_COLORS = DESIGN_TOKEN_INTEGRITY_VALUES.vendorExtraColors;
export const SIZE = DESIGN_TOKEN_INTEGRITY_VALUES.size;
export const SPACE = DESIGN_TOKEN_INTEGRITY_VALUES.space;
export const RADIUS = DESIGN_TOKEN_INTEGRITY_VALUES.radius;
export const TYPOGRAPHY = DESIGN_TOKEN_INTEGRITY_VALUES.typography;
export const MOTION = DESIGN_TOKEN_INTEGRITY_VALUES.motion;
export const SHADOW = DESIGN_TOKEN_INTEGRITY_VALUES.shadow;
export const EFFECT_COLOR = DESIGN_TOKEN_INTEGRITY_VALUES.effectColor;

/** object の宣言順に依存しない fingerprint 入力文字列。Node/browser 共通の pure helper。 */
export function stableValueJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValueJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableValueJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** WCAG 2.2 の相対輝度から求めるコントラスト比(#rrggbb 同士) */
export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((index) => {
      const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}
