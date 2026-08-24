/**
 * 11画面のルート・ナビ・ページヘッダーの正本。
 * 表示順はサイドバーの業務順序と一致させる。
 */
export const APP_ROUTES = [
  {
    id: 'overview',
    path: '/',
    label: '概況',
    task: '今月の収支と全期間トレンドを俯瞰する。',
    navGroup: '見る',
    mobileLabel: '概況',
  },
  {
    id: 'matrix',
    path: '/matrix',
    label: '増減マトリクス',
    task: '科目×月で「増えた/減った」を特定する(増=赤・減=緑)。',
    navGroup: null,
    mobileLabel: 'マトリクス',
  },
  {
    id: 'diagnosis',
    path: '/diagnosis',
    label: '統計診断',
    task: '信号(判定)を見て、対応すべき科目を決める。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    label: 'サブスク分析',
    task: 'ベンダー別推移と重複・急増を確認する。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'household',
    path: '/household',
    label: '家計',
    task: '個人分の月次比較を確認する(公私仕分け反映後)。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'classify',
    path: '/classify',
    label: '公私仕分け',
    task: '明細を事業/個人に確定する。',
    navGroup: '整える',
    mobileLabel: '仕分け',
  },
  {
    id: 'budget',
    path: '/budget',
    label: '予算管理',
    task: '科目別予算の設定と予実を確認する(実績は予算±10%で判定)。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'tradeoff',
    path: '/tradeoff',
    label: 'やりくり試算',
    task: '新規支出の捻出元(どこを削るか)を決める。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'import',
    path: '/import',
    label: 'データ取込',
    task: 'ファイルを投入し、取込結果と履歴を確認する。',
    navGroup: '運用',
    mobileLabel: '取込',
  },
  {
    id: 'settings',
    path: '/settings',
    label: '設定',
    task: '科目正規化・未記帳月・現金補正・復元を管理する。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'guide',
    path: '/guide',
    label: '指標ガイド',
    task: '指標の意味とベンチマークを現在値とともに参照する。',
    navGroup: null,
    mobileLabel: null,
  },
] as const;

export type AppRouteId = (typeof APP_ROUTES)[number]['id'];

export const MOBILE_ROUTES = APP_ROUTES.filter((route) => route.mobileLabel !== null);

export function routeMetadata(id: AppRouteId): (typeof APP_ROUTES)[number] {
  const route = APP_ROUTES.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Unknown route metadata: ${id}`);
  return route;
}
