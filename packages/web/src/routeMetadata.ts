/**
 * 17画面のルート・ナビ・ページヘッダーの正本。
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
    id: 'trends',
    path: '/trends',
    label: '支出トレンド',
    task: '項目ごとの規模と増減を見て、次に手を打つ科目を決める(事業・家計を並べて比較できる)。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'diagnosis',
    path: '/diagnosis',
    label: '統計診断',
    task: 'シグナルと判定基準を見て、対応すべき科目を決める。',
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
    task: '事業と個人のお金を並べ、収支と名義別の収入を確認する(公私仕分け反映後)。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'statements',
    path: '/statements',
    label: '決算書',
    task: '売上と経費の損益計算書(PL)、現金の動き(キャッシュフロー)を見る。発生主義の利益と現金のズレ、貸借対照表(BS)に要るCSVもここで確認する。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'ai',
    path: '/ai',
    label: 'AI分析',
    task: '期間を選んで指示文を作り、Claude Code / Codex に分析させた結果をここで読む。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'classify',
    path: '/classify',
    label: '公私仕分け',
    task: '明細の事業/個人・科目・名義を確定する(編集は再取込しても残る)。',
    navGroup: '整える',
    mobileLabel: '仕分け',
  },
  {
    id: 'budget',
    path: '/budget',
    label: '予算管理',
    task: '科目別予算の設定と予実を確認する(直近3ヶ月平均が予算±10%の外かで判定基準を置く)。',
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
    id: 'tax',
    path: '/tax',
    label: '確定申告の準備',
    task: '対象年の不足を確認し、freee・e-Taxへ転記するための準備シートを作る(申告書の生成や適法性の保証はしない)。',
    navGroup: '申告',
    mobileLabel: null,
  },
  {
    id: 'taxReceipts',
    path: '/tax/receipts',
    label: '領収書の残り',
    task: 'このアプリで管理する事業支出の未添付を優先順に解消する。freee仕訳の証憑はfreee側で確認する。',
    navGroup: null,
    mobileLabel: '領収書',
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
    id: 'cash',
    path: '/cash',
    label: '現金の記帳',
    task: '口座やカードの明細に出ない現金の受け渡し(会議費など)を仕訳する。証憑も一緒に残せる(再取込しても消えない)。',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'settings',
    path: '/settings',
    label: '設定',
    task: '分類ルール・口座の名義・勘定科目の正規化・未記帳月・復元を管理する。',
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
