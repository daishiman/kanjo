/**
 * 15画面のルート・ナビ・ページヘッダーの正本。
 * 表示順はサイドバーの業務順序と一致させる。
 *
 * 増減マトリクス・支出トレンド・統計診断は、いずれも「どの勘定科目に手を打つか」という
 * 同じ判断のための切り口だったので、支出分析(/analysis)のタブへ束ねている。
 * 束ねた側の説明文は ANALYSIS_TABS が持つ(消さずに移しただけ)。
 */
export const APP_ROUTES = [
  {
    id: 'overview',
    path: '/',
    label: '概況',
    task: '収支の現状と推移を確認します。',
    taskDetail: '今月の収支だけでなく、全期間の推移・売上高経費率・防衛ラインまで1画面で俯瞰する。',
    icon: 'gauge',
    navGroup: '見る',
    mobileLabel: '概況',
  },
  {
    id: 'analysis',
    path: '/analysis',
    label: '支出分析',
    task: '帳簿と実際の支出を照合し、次に手を打つ場所を決めます。',
    taskDetail:
      'freeeの帳簿確定、Money Forwardの未記帳、重複を除いた実質支出を切り分ける。その後、月別の増減・手を打つ順番・統計判定へ進む。',
    icon: 'chart-pie',
    navGroup: null,
    mobileLabel: '分析',
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    label: 'サブスク分析',
    task: '定期支出の重複と急な増加を確認します。',
    taskDetail: '支払先ごとの推移を並べ、重複契約疑いとサブスクの急増を検出する。年換算した負担額も添える。',
    icon: 'repeat-2',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'household',
    path: '/household',
    label: '家計',
    task: '暮らしのお金と名義別の収支を確認します。',
    taskDetail:
      '公私仕分けを反映したうえで、事業と個人のお金を並べる。名義別の収入と口座間振替の除外もここで確認する。',
    icon: 'house',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'statements',
    path: '/statements',
    label: '決算書',
    task: '損益と現金の動きを決算書の形で確認します。',
    taskDetail:
      '売上と経費の損益計算書(PL)、現金の動き(キャッシュフロー)を見る。発生主義の利益と現金のズレ、貸借対照表(BS)に要るCSVもここで確認する。',
    icon: 'landmark',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'ai',
    path: '/ai',
    label: 'AI分析',
    task: '外部AIに渡す指示文を作り、返ってきた分析結果を読みます。',
    taskDetail:
      'この画面が分析するのではなく、貼り付け用の指示文を作る。それを Claude Code / Codex で実行し、返ってきた結果をこの画面に取り込んで読む。同じ期間で作り直すとレポートの版が進み、前回分も残る。',
    icon: 'sparkles',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'classify',
    path: '/classify',
    label: '公私仕分け',
    task: '明細の事業・個人、科目、名義を確定します。',
    taskDetail:
      'ここで確定した公私区分・勘定科目・名義は、同じファイルを再取込しても上書きされず残る。事業立替の扱いもここで決める。',
    icon: 'list-checks',
    navGroup: '整える',
    mobileLabel: '仕分け',
  },
  {
    id: 'budget',
    path: '/budget',
    label: '予算管理',
    task: '科目別の予算を決め、実績との差を確認します。',
    taskDetail:
      '直近3ヶ月平均が予算の±10%の外かどうかで予算差異を判定する。着地見込み(実績累計+直近3ヶ月平均×残り月数)も並べて見る。',
    icon: 'calendar-range',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'tradeoff',
    path: '/tradeoff',
    label: 'やりくり試算',
    task: '新しい支出をどこから捻出するか試算します。',
    taskDetail:
      '予算超過・重複契約疑い・基準レンジ超過の科目を削減候補として並べ、新しい支出を賄えるかを試算する。',
    icon: 'scale',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'tax',
    path: '/tax',
    label: '確定申告の準備',
    task: '不足を確認し、申告に使う準備シートを作ります。',
    taskDetail:
      '不足している証憑や未記帳月を確認し、freee・e-Taxへ転記するための準備シートを作る。申告書そのものの生成や、内容の適法性の保証はしない。',
    icon: 'clipboard-check',
    navGroup: '申告',
    mobileLabel: null,
  },
  {
    id: 'taxReceipts',
    path: '/tax/receipts',
    label: '領収書の残り',
    task: '事業支出に不足している証憑を順番に添付します。',
    taskDetail:
      'このアプリで管理する事業支出のうち、証憑が未添付のものを優先順に解消する。freeeで入力した仕訳の証憑は、freee側で確認する。',
    icon: 'receipt-text',
    navGroup: null,
    mobileLabel: '領収書',
  },
  {
    id: 'import',
    path: '/import',
    label: 'データ取込',
    task: '収支ファイルを取り込み、結果と履歴を確認します。',
    taskDetail:
      'MF明細・freee仕訳・MF資産推移CSVを取り込み、結果と履歴を残す。資産推移CSVは決算書の貸借対照表(BS)に反映される。',
    icon: 'file-up',
    navGroup: '運用',
    mobileLabel: '取込',
  },
  {
    id: 'cash',
    path: '/cash',
    label: '現金の記帳',
    task: '口座明細に出ない現金の収支を記帳します。',
    taskDetail:
      '口座やカードの明細に出ない現金の受け渡し(会議費など)を仕訳する。証憑も一緒に残せて、再取込しても消えない。二重計上の検知もここで働く。',
    icon: 'badge-japanese-yen',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'settings',
    path: '/settings',
    label: '設定',
    task: '分類ルール、名義、科目、復元方法を管理します。',
    taskDetail:
      '分類ルール、口座の名義、勘定科目の正規化、未記帳月、夜間バックアップからの復元をここで管理する。',
    icon: 'sliders-horizontal',
    navGroup: null,
    mobileLabel: null,
  },
  {
    id: 'guide',
    path: '/guide',
    label: '指標ガイド',
    task: '画面に出る指標の意味と目安を確認します。',
    taskDetail:
      '損益分岐点や安全余裕率など、各画面に出る指標の意味と目安を、いまの数字と並べて参照する。未記帳月がある期間は目安の判定が偏るため、そこも合わせて示す。',
    icon: 'book-open',
    navGroup: null,
    mobileLabel: null,
  },
] as const;

export type AppRouteId = (typeof APP_ROUTES)[number]['id'];

/**
 * 支出分析(/analysis)のタブの正本。
 *
 * 元は3つの独立した画面で、利用者は1つの判断のために3画面を行き来していた。
 * 画面を減らしても「何を説明していたか」は減らさないため、label / task / taskDetail は
 * 当時のものをそのまま持ち、タブごとの見出しとして表示する。
 * icon は Cmd+K の検索結果とタブ見出しで使い、以前と同じ絵で辿り着けるようにしている。
 */
export const ANALYSIS_TABS = [
  {
    id: 'reconciliation',
    path: '/analysis/reconciliation',
    label: '支出照合',
    task: 'freeeとMoney Forwardの支出を一度だけ数えます。',
    taskDetail:
      '税務の正本はfreee。MFで事業と仕分けた支出のうち、freeeと厳密に一致するものは二重に数えず、それ以外を未記帳として示す。曖昧な一致は自動で統合しない。',
    icon: 'git-compare-arrows',
    navGroup: null,
  },
  {
    id: 'matrix',
    path: '/analysis/matrix',
    label: '増減マトリクス',
    task: '科目ごとの増減を月別に比較します。',
    taskDetail: '色は増=赤・減=緑で、支出が増えた月ほど赤くなる。前年同月比と年換算も同じ表で読む。',
    icon: 'grid-2x2',
    navGroup: null,
  },
  {
    id: 'trends',
    path: '/analysis/trends',
    label: '支出トレンド',
    task: '支出の規模と変化から、見直す科目を選びます。',
    taskDetail:
      '事業と家計を並べて比較できる。累積構成比と傾向検定で「規模が大きく、増え続けている科目」を絞り込む。',
    icon: 'trending-up',
    navGroup: null,
  },
  {
    id: 'diagnosis',
    path: '/analysis/diagnosis',
    label: '統計診断',
    task: '数値の変化から、対応が必要な科目を見つけます。',
    taskDetail:
      'シグナルごとに判定基準を明示する。損益分岐点・安全余裕率・売上高経費率の現在値もここで確認する。',
    icon: 'scan-search',
    navGroup: null,
  },
] as const;

export type AnalysisTabId = (typeof ANALYSIS_TABS)[number]['id'];

/**
 * 子パスを持つ画面。ナビの現在地判定を前方一致にする対象。
 * /analysis/matrix にいても開いている画面は「支出分析」なので、サイドバーはそこを現在地にする。
 * (/tax と /tax/receipts は別の画面なので、ここには入らない)
 */
export const TABBED_ROUTE_IDS: ReadonlySet<string> = new Set(['analysis']);

export const DEFAULT_ANALYSIS_TAB = ANALYSIS_TABS[0];

export function analysisTab(id: string | undefined): (typeof ANALYSIS_TABS)[number] | undefined {
  return ANALYSIS_TABS.find((tab) => tab.id === id);
}

/**
 * 旧URLからの読み替え表。/matrix 等はブックマークされている可能性があるので、
 * 404 にせずタブ付きの新URLへ置き換える(履歴には残さない)。
 */
export const LEGACY_ROUTE_REDIRECTS: readonly { from: string; to: string }[] = ANALYSIS_TABS.map((tab) => ({
  from: `/${tab.id}`,
  to: tab.path,
}));

/**
 * Cmd+K の検索対象。
 *
 * サイドバーから消えたタブ(増減マトリクスなど)を名前で引けなくすると、統合が
 * 「探せなくなった」に化ける。親の直後にタブを差し込み、業務順序を保ったまま並べる。
 */
export type SearchRoute = (typeof APP_ROUTES)[number] | (typeof ANALYSIS_TABS)[number];

export const SEARCH_ROUTES: readonly SearchRoute[] = APP_ROUTES.flatMap((route): SearchRoute[] =>
  route.id === 'analysis' ? [route, ...ANALYSIS_TABS] : [route],
);

export const MOBILE_ROUTES = APP_ROUTES.filter((route) => route.mobileLabel !== null);

export function routeMetadata(id: AppRouteId): (typeof APP_ROUTES)[number] {
  const route = APP_ROUTES.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Unknown route metadata: ${id}`);
  return route;
}
