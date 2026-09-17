/**
 * ハブの補助アイコン。状態・操作の意味と図形の対応をまとめる。
 *
 * `routeMetadata.ts` から分けているのは、読むのが支出分析ハブ (遅延読込) だけだから。
 * `routeMetadata.ts` はサイドバーが起動時に読むので初期 JS に載る。
 */
export const ANALYSIS_HUB_ICONS = {
  copy: 'link-2',
  status: {
    success: 'circle-check',
    error: 'circle-alert',
    neutral: 'circle-minus',
    warning: 'triangle-alert',
    trendDown: 'arrow-down',
    trendUp: 'trending-up',
  },
} as const;
