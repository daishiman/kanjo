/**
 * ルート・ナビ・ページヘッダーの正本。
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
    label: '概要',
    task: '収支の現状と推移を確認します。',
    taskDetail: '今月の収支だけでなく、全期間の推移・売上高経費率・防衛ラインまで1画面で俯瞰する。',
    icon: 'gauge',
    navGroup: '取込',
    mobileLabel: '概要',
    contentWidth: 'data',
  },
  {
    id: 'import',
    path: '/import',
    label: 'データ取込',
    task: '収支ファイルを取り込み、結果と履歴を確認します。',
    taskDetail:
      'MF明細・freee仕訳・MF資産推移CSVを取り込み、結果と履歴を残す。資産推移CSVは決算書の貸借対照表(BS)に反映される。',
    icon: 'file-up',
    navGroup: null,
    mobileLabel: '取込',
    contentWidth: 'data',
  },
  {
    id: 'cash',
    path: '/cash',
    label: '現金入力',
    task: '口座明細に出ない現金の収支を記帳します。',
    taskDetail:
      '口座やカードの明細に出ない現金の受け渡し(会議費など)を仕訳する。再取込しても消えない。二重計上の検知もここで働く。',
    icon: 'badge-japanese-yen',
    navGroup: null,
    mobileLabel: null,
    contentWidth: 'data',
  },
  {
    id: 'classify',
    path: '/classify',
    label: '明細仕分け',
    task: '明細の事業・個人、科目、名義を確定します。',
    taskDetail:
      'ここで確定した公私区分・勘定科目・名義は、同じファイルを再取込しても上書きされず残る。事業立替の扱いもここで決める。',
    icon: 'list-checks',
    navGroup: '整える',
    mobileLabel: '仕分け',
    contentWidth: 'data',
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    label: 'サブスク',
    task: '定期支出の重複と急な増加を確認します。',
    taskDetail: '支払先ごとの推移を並べ、重複契約疑いとサブスクの急増を検出する。年換算した負担額も添える。',
    icon: 'repeat-2',
    navGroup: null,
    mobileLabel: null,
    contentWidth: 'data',
  },
  {
    id: 'household',
    path: '/household',
    label: '家計収支',
    task: '家計の総収入・総支出・純収支の変化と、その要因を確認します。',
    taskDetail:
      '公私仕分けを反映したうえで、事業と個人を合わせた家計全体の収支を月ごとに並べ、前年と比べる。生活費の内訳・名義別の収入・除外した振替もここで確認する。',
    icon: 'house',
    navGroup: null,
    mobileLabel: null,
    contentWidth: 'data',
  },
  {
    id: 'analysis',
    path: '/analysis',
    label: '支出分析',
    task: '帳簿と実際の支出を照合し、次に手を打つ場所を決めます。',
    taskDetail:
      'freeeの帳簿確定、Money Forwardの未記帳、重複を除いた実質支出を切り分ける。その後、月別の増減・手を打つ順番・統計判定へ進む。',
    icon: 'chart-pie',
    navGroup: '確認',
    mobileLabel: '分析',
    contentWidth: 'data',
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
    contentWidth: 'data',
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
    contentWidth: 'reading',
  },
  {
    id: 'budget',
    path: '/budget',
    label: '予算',
    task: '実績をもとに、来期12か月の科目別の予算を決めます。',
    taskDetail:
      '前期実績・増減率・季節性補正・計画による調整から自動提案を組み、年間の純収支と防衛ラインの余裕を確かめながら予算対象の期間ごとに保存する。',
    icon: 'calendar-range',
    navGroup: '計画',
    mobileLabel: null,
    contentWidth: 'data',
  },
  {
    id: 'tradeoff',
    path: '/tradeoff',
    label: 'トレードオフ',
    task: '新しい支出をどこから捻出するか試算します。',
    taskDetail:
      '直近3か月の経費を科目と取引先ごとに削減候補として並べ、固定費かどうかと推移から必要度を付ける。選んだ候補の削減額を年換算して、新しい支出を賄えるかと防衛ラインへの影響を試算する。',
    icon: 'scale',
    navGroup: null,
    mobileLabel: null,
    contentWidth: 'reading',
  },
  {
    id: 'settings',
    path: '/settings',
    label: '設定',
    task: '分類ルール、名義、科目、復元方法を管理します。',
    taskDetail:
      '分類ルール、口座の名義、勘定科目の正規化、未記帳月、夜間バックアップからの復元をここで管理する。',
    icon: 'sliders-horizontal',
    navGroup: '管理',
    mobileLabel: null,
    contentWidth: 'data',
  },
  {
    id: 'guide',
    path: '/guide',
    label: '使い方',
    task: '画面に出る指標の意味と目安を確認します。',
    taskDetail:
      '損益分岐点や安全余裕率など、各画面に出る指標の意味と目安を、いまの数字と並べて参照する。未記帳月がある期間は目安の判定が偏るため、そこも合わせて示す。',
    icon: 'book-open',
    navGroup: null,
    mobileLabel: null,
    contentWidth: 'reading',
  },
] as const;

export type AppRouteId = (typeof APP_ROUTES)[number]['id'];

/**
 * 支出分析(/analysis)のタブの正本。
 *
 * 元は3つの独立した画面で、利用者は1つの判断のために3画面を行き来していた。
 * 画面を減らしても「何を説明していたか」は減らさないため、task / taskDetail は
 * 当時のものをそのまま持ち、タブごとの見出しとして表示する。
 * label は支出分析ハブ導入時に 5 文字以内の短縮形へ揃えた(qa-analysis-hub-decision-004)。
 * step / learn / sources / excluded はハブの「読み順」と「選択中の分析」パネルが使う静的定義(FR-006)。
 * 数字を含めない。数字はサーバの集約応答だけが持つ。
 * icon は Cmd+K の検索結果とタブ見出しで使い、以前と同じ絵で辿り着けるようにしている。
 */
export const ANALYSIS_TABS = [
  {
    id: 'reconciliation',
    path: '/analysis/reconciliation',
    label: '照合',
    task: 'MoneyForwardの取引とfreeeの仕訳を照合し、差異を解消します。',
    taskDetail:
      '税務の正本はfreee。金額・日付・内容から一致度を出し、同じ取引として照合するか、別の取引・対象外として処理するかを利用者が決める。曖昧な一致は自動で統合しない。直前の操作は元に戻せる。',
    icon: 'git-compare-arrows',
    navGroup: null,
    step: '差異を消す',
    summary: 'データの整合性を確認します。',
    purpose: '取込データに不備や重複がないかを確認します。',
    journeyHint: '照合でデータの整合性を確認',
    learn: 'freeeの帳簿に載っていない事業支出と、二重に数えそうな支払がどれだけあるか。',
    sources: [
      { label: 'freeeの取引', icon: 'file-text' },
      { label: 'Money Forwardの明細（事業に仕分けたもの）', icon: 'credit-card' },
    ],
    excluded: [
      { label: '家計に仕分けた明細', icon: 'folder-x' },
      { label: '振替・計算対象外にした明細', icon: 'folder-x' },
    ],
  },
  {
    id: 'total-cashflow',
    path: '/analysis/total-cashflow',
    label: '総収支',
    task: '事業と家計を合わせて、月ごとの収支を確認します。',
    taskDetail:
      '同じ口座を通る事業と家計を1本の表にする。freeeとMoney Forwardに重複して載る支払は、日付と金額が一致するものだけを事業費として1度だけ数えて二重計上を避け、残りを家計費として並べる。機械で決められない組は要確認として残す。',
    icon: 'sigma',
    navGroup: null,
    step: '全体を掴む',
    summary: '支出の全体像と収支バランスを把握します。',
    purpose: '支出の全体像と収支バランスを確認します。',
    journeyHint: '総収支で収支バランスを把握',
    learn: '事業と家計を合わせた月ごとの収入・支出・純収支と、機械で決められない重複の候補。',
    sources: [
      { label: '銀行口座の取引', icon: 'landmark' },
      { label: 'クレジットカード・決済サービス', icon: 'credit-card' },
      { label: '電子マネー・Money Forward明細', icon: 'credit-card' },
      { label: 'freee取引・保存済みの重複判断', icon: 'file-text' },
    ],
    excluded: [
      { label: '振替取引（同一名義の口座間）', icon: 'folder-x' },
      { label: '除外したfreee取引・期間外の月', icon: 'folder-x' },
    ],
  },
  {
    id: 'matrix',
    path: '/analysis/matrix',
    label: 'マトリックス',
    task: '科目ごとの増減を月別に比較します。',
    taskDetail:
      '金額は濃淡、前月比・前年同月比は増=赤・減=緑で読む。偏りが大きい3点から同じ科目と月へ降りられる。',
    icon: 'grid-2x2',
    navGroup: null,
    step: '偏りを見る',
    summary: '支出の内訳と構成のバランスを分析します。',
    purpose: '支出の内訳を科目と月の2軸で確認します。',
    journeyHint: 'マトリックスで支出の構成を分析',
    learn: 'どの科目がどの月に増えたか、減ったか。いつもの額から離れていた月。',
    sources: [
      { label: 'Money Forwardの明細', icon: 'credit-card' },
      { label: '科目・月ごとの集計', icon: 'grid-2x2' },
    ],
    excluded: [
      { label: '明細を取り込んでいない月（未記録月）', icon: 'folder-x' },
      { label: '振替取引', icon: 'folder-x' },
    ],
  },
  {
    id: 'trends',
    path: '/analysis/trends',
    label: '推移',
    task: '支出の規模と変化から、見直す科目を選びます。',
    taskDetail:
      '事業と家計を並べて比較できる。累積構成比と傾向検定で「規模が大きく、増え続けている科目」を絞り込む。',
    icon: 'trending-up',
    navGroup: null,
    step: '変化を追う',
    summary: '支出の増減傾向と季節変動を確認します。',
    purpose: '支出の増減傾向や季節変動を確認します。',
    journeyHint: '推移で増減の傾向を確認',
    learn: '規模が大きく、増え続けている科目。前の同じ長さの期間と比べた支出の変化。',
    sources: [
      { label: 'Money Forwardの明細（事業・家計）', icon: 'credit-card' },
      { label: '月次の支出集計', icon: 'trending-up' },
    ],
    excluded: [
      { label: '振替取引', icon: 'folder-x' },
      { label: '計算対象外にした明細', icon: 'folder-x' },
    ],
  },
  {
    id: 'diagnosis',
    path: '/analysis/diagnosis',
    label: '診断',
    task: '数値の変化から、対応が必要な科目を見つけます。',
    taskDetail:
      'シグナルごとに判定基準を明示する。損益分岐点・安全余裕率・売上高経費率の現在値もここで確認する。',
    icon: 'scan-search',
    navGroup: null,
    step: '行動を決める',
    summary: '課題を特定し、改善の余地を見つけます。',
    purpose: '課題を特定し、改善の余地を見つけます。',
    journeyHint: '診断で改善の余地を特定',
    learn: '普段からぶれた科目と、見直すと年間でいくら浮くかの目安。',
    sources: [
      { label: 'Money Forwardの明細の月次集計', icon: 'credit-card' },
      { label: '損益の現在値', icon: 'file-text' },
    ],
    excluded: [
      { label: '振替・計算対象外にした明細', icon: 'folder-x' },
      { label: '比較に足る月数がない科目', icon: 'folder-x' },
    ],
  },
] as const;

export type AnalysisTabId = (typeof ANALYSIS_TABS)[number]['id'];

/**
 * 問いの見出しの本文は `analysis-tab-questions.ts` にある。
 * 読むのが支出分析タブ (遅延読込) だけなので、初期 JS へ載せないため分けている。
 */

/**
 * 子パスを持つ画面。ナビの現在地判定を前方一致にする対象。
 * /analysis/matrix にいても開いている画面は「支出分析」なので、サイドバーはそこを現在地にする。
 */
export const TABBED_ROUTE_IDS: ReadonlySet<string> = new Set(['analysis']);

export const DEFAULT_ANALYSIS_TAB = ANALYSIS_TABS[0];

/**
 * 支出分析ハブの集約 API (/api/analysis/hub) のクエリキー。
 * ハブ画面とサイドバーの件数バッジが同じキーを使い、同時に表示しても 1 本しか呼ばない。
 * Analysis.tsx は遅延読み込みなので、Layout から参照できるここに置く。
 */
export const ANALYSIS_HUB_QUERY_ROOT = ['analysis-hub'] as const;
/** 月次確定後の操作中に無駄な再取得を増やさず、変更時は明示 invalidate で即時更新する。 */
export const ANALYSIS_HUB_STALE_TIME_MS = 30_000;
export const analysisHubQueryKey = (periodKey: string) => [...ANALYSIS_HUB_QUERY_ROOT, periodKey] as const;

export function analysisTab(id: string | undefined): (typeof ANALYSIS_TABS)[number] | undefined {
  return ANALYSIS_TABS.find((tab) => tab.id === id);
}

/**
 * 旧URLからの読み替え表。/matrix 等はブックマークされている可能性があるので、
 * 404 にせずタブ付きの新URLへ置き換える(履歴には残さない)。
 *
 * ここは ANALYSIS_TABS から導出しない。載るのは「かつて単独の画面として存在したURL」だけで、
 * それは過去の履歴であってタブ一覧の写像ではない。導出にすると、統合後に増やしたタブ
 * (トータル収支など、単独URLを持ったことがない画面) にも転送元が生えてしまう。
 */
export const LEGACY_ROUTE_REDIRECTS: readonly { from: string; to: string }[] = [
  { from: '/reconciliation', to: '/analysis/reconciliation' },
  { from: '/matrix', to: '/analysis/matrix' },
  { from: '/trends', to: '/analysis/trends' },
  { from: '/diagnosis', to: '/analysis/diagnosis' },
];

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

// サイドバーは月次フロー順、モバイルは従来の最頻導線順。
// APP_ROUTES の並べ替えでタブの手の位置まで変わらないよう、意図を別に固定する。
const MOBILE_ROUTE_ORDER: readonly AppRouteId[] = ['overview', 'analysis', 'classify', 'import'];
export const MOBILE_ROUTES = APP_ROUTES.filter((route) => route.mobileLabel !== null).sort(
  (a, b) => MOBILE_ROUTE_ORDER.indexOf(a.id) - MOBILE_ROUTE_ORDER.indexOf(b.id),
);

export function routeMetadata(id: AppRouteId): (typeof APP_ROUTES)[number] {
  const route = APP_ROUTES.find((candidate) => candidate.id === id);
  if (!route) throw new Error(`Unknown route metadata: ${id}`);
  return route;
}

/** path から本文幅を決める唯一の境界。analysis の子タブは親 route の用途を継承する。 */
export function routeContentWidth(pathname: string): 'reading' | 'data' {
  if (pathname === '/improvement' || pathname === '/login') return 'reading';
  // ハブは5視点の判断に必要な情報だけへ絞る。詳細の横長分析表は従来どおり data 幅。
  if (pathname === '/analysis') return 'reading';
  const route = APP_ROUTES.find((candidate) =>
    candidate.path === '/'
      ? pathname === '/'
      : pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
  );
  return route?.contentWidth ?? 'reading';
}

/** ブラウザのタブ名も表示中ルートの正本から導く。 */
export function routePageTitle(pathname: string): string {
  const tab = ANALYSIS_TABS.find((candidate) => candidate.path === pathname);
  if (tab) return `${tab.label} | 支出分析 | Focus Ledger`;
  if (pathname === '/improvement') return '改善要望 | Focus Ledger';
  const route = APP_ROUTES.find((candidate) =>
    candidate.path === '/'
      ? pathname === '/'
      : pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
  );
  return route ? `${route.label} | Focus Ledger` : 'Focus Ledger';
}
