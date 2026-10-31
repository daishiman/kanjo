/**
 * 使い方画面 (spec-guide-screen) の導出の正本。
 *
 * 節・ステップ・よくある疑問・期間の表・このページの数値・関連ページ・ガイド内検索・
 * 用語と目安の現在値の合成をここ 1 か所に置く。web は pages/guide/view-model.ts だけが
 * これを呼び、api の /api/guide は数値 (期間・総収支・最終更新・進捗) だけを guideScreen で組む。
 * 画面の文言と計算の説明 (防衛ライン・信頼度の段階) が別々に直されて割れるのを防ぐため、
 * 説明文は算出側の定数から組む。
 */
import { DEFENSE_LINE_BASIS } from './analysis.js';
import { CONFIDENCE_TIER_DESCRIPTION } from './classify-status.js';
import { AI_DATA_NOTICE } from './data-notice.js';
import type { CloseStepKey, MonthlyCloseStatus } from './overview.js';
import { type PeriodRange, periodDefinitionText } from './period.js';

/* -------- 画面の骨格 -------- */

export type GuideTopicId = 'flow' | 'totals' | 'reconcile' | 'classify' | 'budget' | 'sources' | 'terms';

/** 元画面への行き先 */
export interface GuideLink {
  label: string;
  path: string;
}

const LINK = {
  import: { label: 'データ取込', path: '/import' },
  classify: { label: '明細仕分け', path: '/classify' },
  totals: { label: '総収支', path: '/analysis/total-cashflow' },
  reconcile: { label: '照合', path: '/analysis/reconciliation' },
  budget: { label: '予算', path: '/budget' },
  settings: { label: '設定', path: '/settings' },
  analysis: { label: '収支分析', path: '/analysis' },
} as const satisfies Record<string, GuideLink>;

export const GUIDE_HEADING = {
  title: '使い方',
  question: 'この数字を、どう読み・どこへ戻ればよいですか？',
  lead: 'Focus Ledger の見方と、つまずきやすいポイントを、実際の画面に戻りながら確認できます。',
} as const;

export interface GuideTopic {
  id: GuideTopicId;
  label: string;
  /** 下部固定バーの『{画面名}を開く →』の行き先 */
  destination: GuideLink;
}

/** 目次 7 項目。画像の 6 項目の末尾に『用語と目安』を置く (qa-guide-decision-001) */
export const GUIDE_TOPICS: readonly GuideTopic[] = [
  { id: 'flow', label: '月次の流れ', destination: LINK.totals },
  { id: 'totals', label: '総収支', destination: LINK.totals },
  { id: 'reconcile', label: '照合', destination: LINK.reconcile },
  { id: 'classify', label: '仕分け', destination: LINK.classify },
  { id: 'budget', label: '予算', destination: LINK.budget },
  { id: 'sources', label: 'データ出典', destination: LINK.import },
  { id: 'terms', label: '用語と目安', destination: LINK.analysis },
];

export const GUIDE_DEFAULT_TOPIC: GuideTopicId = 'flow';

/** URL の topic を解決する。未知・空は月次の流れに倒す */
export function resolveGuideTopic(raw: string | null | undefined): GuideTopicId {
  return GUIDE_TOPICS.find((t) => t.id === raw)?.id ?? GUIDE_DEFAULT_TOPIC;
}

export const guideTopic = (id: GuideTopicId): GuideTopic =>
  GUIDE_TOPICS.find((t) => t.id === id) ?? GUIDE_TOPICS[0];

/* -------- 4 ステップと月次の流れ -------- */

export interface GuideStep {
  key: 'import' | 'tidy' | 'check' | 'plan';
  label: string;
  sub: string;
  desc: string;
  destination: GuideLink;
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    key: 'import',
    label: '取込む',
    sub: 'データを集める',
    desc: '銀行・カード・レシートなどの取引データを取り込みます。',
    destination: LINK.import,
  },
  {
    key: 'tidy',
    label: '整える',
    sub: '仕訳・分類で整理',
    desc: '取引を正しいカテゴリに仕訳し、不要なものを除きます。',
    destination: LINK.classify,
  },
  {
    key: 'check',
    label: '確認',
    sub: '状況を見る&診断する',
    desc: '収入・支出の状態を確認し、疑問点を解消します。',
    destination: LINK.totals,
  },
  {
    key: 'plan',
    label: '計画',
    sub: '次の一手を考える',
    desc: '予算を設定し、今後の見通しをシミュレーションします。',
    destination: LINK.budget,
  },
];

export const GUIDE_STEP_OPEN_LABEL = '元画面を開く →';

export interface GuideFlowStage {
  label: string;
  /** null = 進捗を読めていない (読込中・失敗) */
  done: boolean | null;
}

/** 月次クローズの進捗。上段の「計画」は行動案内であり review の完了を意味しない。 */
const FLOW_STAGES = [
  { key: 'import', label: '取込' },
  { key: 'classification', label: '整える' },
  { key: 'reconciliation', label: '確認' },
  { key: 'review', label: '月次レビュー' },
] as const satisfies readonly { key: CloseStepKey; label: string }[];

export const GUIDE_FLOW_LEAD = '毎月のクローズ作業で、数字を確認し、次のアクションにつなげる流れです。';

/** ステッパーの 4 段。完了は monthlyCloseStatus の実進捗で決める */
export function guideFlowStages(close: MonthlyCloseStatus | null | undefined): GuideFlowStage[] {
  return FLOW_STAGES.map(({ key, label }) => ({
    label,
    done: close ? (close.steps.find((s) => s.key === key)?.done ?? false) : null,
  }));
}

/* -------- 総収支・含まれるもの・期間の表 -------- */

export const GUIDE_TOTALS_LEAD = '選択した期間の、収入・支出・純収支のバランスを示す最も基本的な指標です。';

export const GUIDE_TOTALS_LABELS = { income: '総収入', expense: '総支出', net: '純収支' } as const;

export const GUIDE_INCLUDES: readonly { title: string; text: string }[] = [
  { title: '何が含まれる？', text: '家計・事業の収入と支出（振替を除く）' },
  { title: '振替は除外', text: '口座間の資金移動（振替）は収入・支出に含みません' },
  { title: 'freee の権限', text: 'ご自身のfreeeアカウントの参照権限の範囲で取得したデータのみを集計します' },
];

export const GUIDE_PERIOD_TABLE = {
  title: '期間の切り替えによる表示の違い',
  columns: ['期間', '表示内容'] as const,
  rows: [
    { key: 'span1', label: '1年', text: '選択した1年間の合計を表示します。月次のクローズで主に使用します。' },
    { key: 'span2', label: '2年', text: '過去2年間の合計を表示します。前年との比較に使用します。' },
    { key: 'span3', label: '3年', text: '過去3年間の合計を表示します。中長期の傾向を確認できます。' },
    {
      key: 'custom',
      label: '任意',
      text: '指定した期間の合計を表示します。特定の期間を詳しく確認できます。',
    },
  ] as const,
};

/* -------- 右カラム -------- */

export const GUIDE_SOURCES_TEXT = 'freeeから取得した取引データ（振替は除く）';

export const GUIDE_RELATED_PAGES: readonly GuideLink[] = [
  LINK.totals,
  LINK.classify,
  LINK.reconcile,
  LINK.settings,
  LINK.analysis,
];

export const GUIDE_SEARCH = {
  title: 'ガイド内を検索',
  placeholder: '使い方のキーワードを検索',
  examples: ['振替', '重複', '信頼度', '予算'] as const,
  empty: '該当するガイドがありません',
  maxLength: 100,
} as const;

/** 期間の長さの表示。12 の倍数は「n年」、それ以外は「nか月」 */
function spanText(range: PeriodRange): string {
  const months =
    (Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4))) * 12 +
    Number(range.to.slice(5, 7)) -
    Number(range.from.slice(5, 7)) +
    1;
  return months % 12 === 0 ? `${months / 12}年` : `${months}か月`;
}

export const GUIDE_FACT_LABELS = {
  period: '選択中の期間',
  definition: '期間の定義',
  sources: 'データの出所',
  updated: '最終更新',
} as const;

export interface GuideFact {
  key: keyof typeof GUIDE_FACT_LABELS;
  label: string;
  value: string;
}

/**
 * このページの数値 4 項目。最終更新の日時の書式は画面の書式 (web の dateTime) を使うため引数で受ける。
 * 取込が無ければ「未取込」。
 */
export function guidePageFacts(screen: GuideScreen, formatDateTime: (iso: string) => string): GuideFact[] {
  const applied = screen.period.applied;
  return [
    {
      key: 'period',
      label: GUIDE_FACT_LABELS.period,
      value: applied ? `${screen.period.label}（${spanText(applied)}）` : screen.period.label,
    },
    { key: 'definition', label: GUIDE_FACT_LABELS.definition, value: screen.period.definition },
    { key: 'sources', label: GUIDE_FACT_LABELS.sources, value: screen.sources },
    {
      key: 'updated',
      label: GUIDE_FACT_LABELS.updated,
      value: screen.dataUpdatedAt ? formatDateTime(screen.dataUpdatedAt) : '未取込',
    },
  ];
}

/* -------- よくある疑問 -------- */

export interface GuideFaqRow {
  id: 'duplicate' | 'confidence' | 'scope' | 'defense' | 'fix';
  question: string;
  note: string;
  source: string;
  condition: string;
  destination: GuideLink;
}

const GUIDE_DUPLICATE_CONDITION = '同額・同方向のfreee取引が±3日以内に1件あり、発生日か取込月にずれがある';

export const GUIDE_FAQ = {
  title: 'よくある疑問と対処法',
  lead: 'つまずきやすいポイントと、確認方法をまとめました。',
  columns: ['疑問', 'データの出所', '確認の条件', '関連ページ'] as const,
  rows: [
    {
      id: 'duplicate',
      question: 'なぜ重複候補があるのか？',
      note: '同じ取引かどうか確認が必要になる理由と対処方法です。',
      source: '銀行・カード明細とfreeeの取引',
      condition: GUIDE_DUPLICATE_CONDITION,
      destination: LINK.reconcile,
    },
    {
      id: 'confidence',
      question: '信頼度は何を意味するか？',
      note: '仕分けの自動判定における信頼度の意味です。',
      source: '取引内容・過去の仕分け履歴・AIによる判定',
      condition: CONFIDENCE_TIER_DESCRIPTION,
      destination: LINK.classify,
    },
    {
      id: 'scope',
      question: '家計・事業の範囲はどう分けている？',
      note: '家計と事業の重複計上を避ける仕組みです。',
      source: 'freeeの口座・取引先分類',
      condition: '事業用に分類された口座・取引先は事業として集計',
      destination: LINK.settings,
    },
    {
      id: 'defense',
      question: '防衛ラインとは何か？',
      note: '収支が悪化したときに注意すべき基準値です。',
      source: '過去の収支データ',
      condition: DEFENSE_LINE_BASIS,
      destination: LINK.analysis,
    },
    {
      id: 'fix',
      question: '取込・仕分けの誤りを修正するには？',
      note: '誤った取込・仕分けを修正し、再集計する方法です。',
      source: '取込データ・手動入力',
      condition: '該当の取引を修正後、再集計が反映される',
      destination: LINK.import,
    },
  ] satisfies GuideFaqRow[],
} as const;

export const guideOpenLabel = (link: GuideLink) => `${link.label}を開く`;

/* -------- トピックの本文 (検索の対象にもなる) -------- */

/**
 * 月次の流れ・総収支以外のトピックの本文。月次の流れと総収支は上の定数 (リード文・3 枚・期間の表) が本文になる。
 * 用語と目安は用語集そのもの (web の glossary) を描くので、ここにはリード文だけを置く。
 */
export const GUIDE_TOPIC_BODY: Record<GuideTopicId, readonly string[]> = {
  flow: [GUIDE_FLOW_LEAD, ...FLOW_STAGES.map((stage) => stage.label)],
  totals: [
    GUIDE_TOTALS_LEAD,
    `${GUIDE_TOTALS_LABELS.income} − ${GUIDE_TOTALS_LABELS.expense} = ${GUIDE_TOTALS_LABELS.net}`,
    ...GUIDE_INCLUDES.flatMap((c) => [c.title, c.text]),
    GUIDE_PERIOD_TABLE.title,
    ...GUIDE_PERIOD_TABLE.rows.map((r) => r.text),
  ],
  reconcile: [
    '銀行・カードの明細とfreeeの取引を突き合わせ、同じ取引が二重に数えられていないかを確かめます。',
    `重複候補は、${GUIDE_DUPLICATE_CONDITION}場合に表示されます。`,
    '振替（同一名義の口座間の資金移動）は収入・支出に含めません。',
  ],
  classify: [
    '取引を家計・事業とカテゴリに仕分けます。提案には信頼度が付きます。',
    `信頼度は${CONFIDENCE_TIER_DESCRIPTION}します。要確認の印が付いた取引から見直してください。`,
  ],
  budget: [
    '科目ごとに年額の予算を立て、実績との差を確かめます。',
    `防衛ライン（${DEFENSE_LINE_BASIS}）を下回らない計画かどうかも確認できます。`,
  ],
  sources: [
    GUIDE_SOURCES_TEXT,
    '取込データは外部送信しません。',
    `${AI_DATA_NOTICE}。`,
    '税務上の正本はfreeeです。',
  ],
  terms: ['決算書や分析画面に出てくる用語・略語の意味と、いまの数字の目安をまとめました。'],
};

/* -------- ガイド内検索 -------- */

/** 全角半角・大小を同一視する (NFKC ＋小文字) */
export const normalizeGuideText = (text: string): string => text.normalize('NFKC').toLowerCase();

/** URL の q を 100 字で切る */
export const clampGuideQuery = (raw: string | null | undefined): string =>
  Array.from(raw ?? '')
    .slice(0, GUIDE_SEARCH.maxLength)
    .join('');

export interface GuideSearchResult {
  /** 検索語が空か */
  empty: boolean;
  /** 見出しか本文が当たったトピック (目次の順) */
  topics: GuideTopicId[];
  /** 当たったよくある疑問の行 id */
  faq: GuideFaqRow['id'][];
  /** 1 件も当たらなかったか (空の検索語は false) */
  none: boolean;
}

/**
 * 目次の見出し・本文・よくある疑問の文言を部分一致で絞る。ブラウザ内だけで動き、サーバへは送らない。
 * extraTopicText は画面側で描く本文 (用語と目安の用語集) を検索の対象に加えるための口。
 */
export function searchGuide(
  rawQuery: string | null | undefined,
  extraTopicText: Partial<Record<GuideTopicId, readonly string[]>> = {},
): GuideSearchResult {
  const query = normalizeGuideText(clampGuideQuery(rawQuery).trim());
  if (!query) {
    return {
      empty: true,
      topics: GUIDE_TOPICS.map((t) => t.id),
      faq: GUIDE_FAQ.rows.map((r) => r.id),
      none: false,
    };
  }
  const hit = (texts: readonly string[]) => texts.some((t) => normalizeGuideText(t).includes(query));
  const topics = GUIDE_TOPICS.filter((t) =>
    hit([t.label, ...GUIDE_TOPIC_BODY[t.id], ...(extraTopicText[t.id] ?? [])]),
  ).map((t) => t.id);
  const faq = GUIDE_FAQ.rows
    .filter((r) => hit([r.question, r.note, r.source, r.condition, r.destination.label]))
    .map((r) => r.id);
  return { empty: false, topics, faq, none: topics.length === 0 && faq.length === 0 };
}

/* -------- /api/guide の応答 -------- */

export interface GuideTotals {
  income: number;
  expense: number;
  /** 総収入 − 総支出 (符号つき) */
  net: number;
}

export interface GuideScreen {
  period: {
    /** 実際に適用された期間。null = 全期間 */
    applied: PeriodRange | null;
    /** データ全体の範囲 (前後移動の端) */
    full: PeriodRange | null;
    label: string;
    definition: string;
  };
  totals: GuideTotals;
  /** 取込の確定時刻の最大。取込が無ければ null */
  dataUpdatedAt: string | null;
  sources: string;
  /** 月次の流れの進捗。データが無ければ null */
  closeStatus: MonthlyCloseStatus | null;
}

export interface GuideScreenInput {
  period: { applied: PeriodRange | null; full: PeriodRange | null; label: string };
  /** 総収支画面の summary.total と同じ値 (振替除外)。範囲が無いときは null */
  totals: { income: number; expense: number } | null;
  dataUpdatedAt: string | null;
  closeStatus: MonthlyCloseStatus | null;
}

/** /api/guide の { screen }。防衛ラインの値は持たない (qa-guide-backend-web-004) */
export function guideScreen(input: GuideScreenInput): GuideScreen {
  const income = input.totals?.income ?? 0;
  const expense = input.totals?.expense ?? 0;
  return {
    period: {
      applied: input.period.applied,
      full: input.period.full,
      label: input.period.label,
      definition: periodDefinitionText(input.period.applied),
    },
    totals: { income, expense, net: income - expense },
    dataUpdatedAt: input.dataUpdatedAt,
    sources: GUIDE_SOURCES_TEXT,
    closeStatus: input.closeStatus,
  };
}

/* -------- 用語と目安の現在値 (旧 web/guide-sections.ts の GUIDE_CURRENT) -------- */

/** 現在値の合成に要る値だけを構造で受ける (web の SummaryResponse / DiagnosisData の部分形) */
export interface GuideTermContext {
  summary?: {
    defense?: { status: string; line: number } | null;
    overview?: {
      kpi: { currYearAnnualized: number; prevYearExpense: number };
      top2Share: number;
      unrecordedExpMonths: readonly string[];
    } | null;
  };
  diagnosis?: {
    bep: { breakEven: number; safetyMargin: number };
    kpi: { expenseRatio: number; expenseCv: number; expenseMedian: number; fixedCost: number };
  };
}

export type GuideTermCurrentKind = 'metric' | 'location' | 'prerequisite' | 'not_applicable';

/** 現在値。書式 (円・%) は web の format で付けるため、種類と数を返す */
export type GuideTermValue =
  | { type: 'yen'; value: number }
  /** 前後の文言は web が % 書式の両側に添える (例: おおよそ …(決算書ページが正)) */
  | { type: 'percent'; value: number; prefix?: string; suffix?: string }
  | { type: 'text'; value: string }
  | null;

export interface GuideTermCurrent {
  kind: GuideTermCurrentKind;
  value: GuideTermValue;
}

type Provider = (context: GuideTermContext) => GuideTermCurrent;

const metric =
  (resolve: (context: GuideTermContext) => GuideTermValue): Provider =>
  (context) => ({ kind: 'metric', value: resolve(context) });
const location =
  (text: string): Provider =>
  () => ({ kind: 'location', value: { type: 'text', value: text } });
const prerequisite =
  (text: string): Provider =>
  () => ({ kind: 'prerequisite', value: { type: 'text', value: text } });
const notApplicable: Provider = () => ({ kind: 'not_applicable', value: null });

const yenOf = (value: number): GuideTermValue => ({ type: 'yen', value });
const percentOf = (value: number): GuideTermValue => ({ type: 'percent', value });

/**
 * 各用語の「現在値」欄が何を表すかの正本。キーは web の glossary の TermId と一致させ、
 * web 側で Record<TermId, …> への代入とキー集合のテストで更新漏れを検出する。
 */
export const GUIDE_TERM_CURRENT = {
  pl: location('決算書ページで表示'),
  bs: prerequisite('残高のCSV取込後に作成(決算書ページ参照)'),
  cashFlow: location('決算書ページで表示'),
  accrual: notApplicable,
  operatingCf: location('決算書ページのキャッシュフロー表で表示'),
  receivable: prerequisite('取引CSVに決済列(支払期日・支払日)を含めて取込むと表示'),
  payable: prerequisite('取引CSVに決済列(支払期日・支払日)を含めて取込むと表示'),
  overdue: prerequisite('取引CSVに決済列を含めて取込み、支払期日を過ぎた分を表示'),
  netAssets: prerequisite('残高のCSV取込後に決算書ページで表示'),
  openingBalance: prerequisite('残高のCSV取込後に決算書ページで表示'),
  defenseLine: metric(({ summary }) => {
    const defense = summary?.defense;
    return defense && defense.status !== 'nodata' ? yenOf(defense.line) : null;
  }),
  breakEven: metric(({ diagnosis }) => (diagnosis ? yenOf(diagnosis.bep.breakEven) : null)),
  safetyMargin: metric(({ diagnosis }) => (diagnosis ? percentOf(diagnosis.bep.safetyMargin) : null)),
  expenseRatio: metric(({ diagnosis }) => (diagnosis ? percentOf(diagnosis.kpi.expenseRatio) : null)),
  profitMargin: metric(({ diagnosis }) =>
    diagnosis
      ? {
          type: 'percent',
          value: 1 - diagnosis.kpi.expenseRatio,
          prefix: 'おおよそ ',
          suffix: '(決算書ページが正)',
        }
      : null,
  ),
  share: location('決算書ページ(構成比の列)で表示'),
  annualized: metric(({ summary }) =>
    summary?.overview ? yenOf(summary.overview.kpi.currYearAnnualized) : null,
  ),
  yoy: location('概況・診断などの前年比較で表示'),
  pareto: metric(({ summary }) =>
    summary?.overview
      ? { type: 'text', value: `上位2科目で${(summary.overview.top2Share * 100).toFixed(0)}%` }
      : null,
  ),
  runway: prerequisite('BSの取込後に算出'),
  bcp: prerequisite('手元資金の取込後、固定費の何ヶ月分かで判断'),
  cv: metric(({ diagnosis }) =>
    diagnosis ? { type: 'text', value: diagnosis.kpi.expenseCv.toFixed(2) } : null,
  ),
  median: metric(({ diagnosis }) => (diagnosis ? yenOf(diagnosis.kpi.expenseMedian) : null)),
  movingAvg: location('支出分析>支出トレンドで表示'),
  sigmaBand: location('支出分析>支出トレンドで表示'),
  zScore: location('科目別に支出分析>統計診断で表示'),
  range: location('科目別に支出分析>統計診断で表示'),
  mannKendall: location('科目別に支出分析>支出トレンドで表示'),
  theilSen: location('科目別に支出分析>支出トレンドで表示'),
  pValue: location('科目別に支出分析>支出トレンドで表示'),
  contribution: location('支出分析>支出トレンドの寄与度で表示'),
  judge: location('支出分析>統計診断・予算・トレードオフで行ごとに表示'),
  signal: location('科目別に支出分析>統計診断で表示'),
  classification: location('科目別に支出分析>統計診断で表示'),
  fixedCost: metric(({ diagnosis }) => (diagnosis ? yenOf(diagnosis.kpi.fixedCost) : null)),
  budgetSuggestion: location('予算ページの予算一覧と科目パネルで表示'),
  defenseMargin: location('予算ページのKPIで表示'),
  subsDup: location('サブスクページで表示'),
  subsSpike: location('サブスクページで表示'),
  vendor: location('サブスクページで表示'),
  revenueShare: location('サブスクページで表示'),
  bizAdvance: location('明細仕分けページの使い方で表示'),
  transfer: location('公私仕分けページで集計対象外として表示'),
  journalize: notApplicable,
  account: notApplicable,
  voucher: location('現金記帳ページの交通費入力で「証憑不要」として表示'),
  houseworkSplit: notApplicable,
  closingAdjust: notApplicable,
  doubleCount: location('現金記帳ページで疑いがあれば件数を表示'),
  holderName: location('設定ページの口座名義一覧で表示'),
  unrecordedMonth: metric(({ summary }) => {
    const months = summary?.overview?.unrecordedExpMonths;
    return months ? { type: 'text', value: months.length ? months.join(', ') : 'なし' } : null;
  }),
  publicPrivate: location('明細仕分けページで表示'),
  reportType: location('AI分析ページで表示'),
  reportVersion: location('AI分析ページで表示'),
  mergedJson: location('取込・エクスポートで使用'),
} satisfies Record<string, Provider>;

export type GuideTermId = keyof typeof GUIDE_TERM_CURRENT;

/** 用語の現在値。未知の id は該当なし */
export function guideTermCurrent(id: string, context: GuideTermContext): GuideTermCurrent {
  const provider = (GUIDE_TERM_CURRENT as Record<string, Provider>)[id];
  return provider ? provider(context) : { kind: 'not_applicable', value: null };
}

/** 年換算の目安は前年実績から組む (他の用語は用語集の bench をそのまま使う) */
export function guideTermBench(
  id: string,
  context: GuideTermContext,
): { type: 'yen-prefix'; value: number } | null {
  if (id !== 'annualized' || !context.summary?.overview) return null;
  return { type: 'yen-prefix', value: context.summary.overview.kpi.prevYearExpense };
}
