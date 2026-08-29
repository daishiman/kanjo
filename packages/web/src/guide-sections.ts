import type { DiagnosisData, SummaryResponse } from './api.js';
import { pct, yen } from './format.js';
import { GLOSSARY, GUIDE_SECTIONS, type GlossaryEntry, type TermId } from './glossary.js';

export interface GuideRow {
  id: TermId;
  term: string;
  desc: string;
  currentKind: GuideCurrentKind;
  now: string;
  bench: string;
}

export type GuideCurrentKind = 'metric' | 'location' | 'prerequisite' | 'not_applicable';

interface GuideContext {
  summary?: SummaryResponse;
  diagnosis?: DiagnosisData;
}

interface GuideCurrent {
  kind: GuideCurrentKind;
  text: string | null;
}

type GuideCurrentProvider = (context: GuideContext) => GuideCurrent;

const metric =
  (resolve: (context: GuideContext) => string | null): GuideCurrentProvider =>
  (context) => ({
    kind: 'metric',
    text: resolve(context),
  });
const location =
  (text: string): GuideCurrentProvider =>
  () => ({ kind: 'location', text });
const prerequisite =
  (text: string): GuideCurrentProvider =>
  () => ({ kind: 'prerequisite', text });
const notApplicable: GuideCurrentProvider = () => ({ kind: 'not_applicable', text: null });

/**
 * 各用語の「現在値」欄が何を表すかを所有する正本。
 * TermIdを明示列挙するため、用語追加時に現在値の更新漏れを型検査で検出する。
 */
export const GUIDE_CURRENT = {
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
    return defense && defense.status !== 'nodata' ? yen(defense.line) : null;
  }),
  breakEven: metric(({ diagnosis }) => (diagnosis ? yen(diagnosis.bep.breakEven) : null)),
  safetyMargin: metric(({ diagnosis }) => (diagnosis ? pct(diagnosis.bep.safetyMargin, 0) : null)),
  expenseRatio: metric(({ diagnosis }) => (diagnosis ? pct(diagnosis.kpi.expenseRatio, 0) : null)),
  profitMargin: metric(({ diagnosis }) =>
    diagnosis ? `おおよそ ${pct(1 - diagnosis.kpi.expenseRatio, 0)}(決算書ページが正)` : null,
  ),
  share: location('決算書ページ(構成比の列)で表示'),
  annualized: metric(({ summary }) =>
    summary?.overview ? yen(summary.overview.kpi.currYearAnnualized) : null,
  ),
  yoy: location('概況・診断などの前年比較で表示'),
  pareto: metric(({ summary }) =>
    summary?.overview ? `上位2科目で${(summary.overview.top2Share * 100).toFixed(0)}%` : null,
  ),
  runway: prerequisite('BSの取込後に算出'),
  bcp: prerequisite('手元資金の取込後、固定費の何ヶ月分かで判断'),
  cv: metric(({ diagnosis }) => (diagnosis ? diagnosis.kpi.expenseCv.toFixed(2) : null)),
  median: metric(({ diagnosis }) => (diagnosis ? yen(diagnosis.kpi.expenseMedian) : null)),
  movingAvg: location('支出トレンドページで表示'),
  sigmaBand: location('支出トレンドページで表示'),
  zScore: location('科目別に診断ページで表示'),
  range: location('科目別に診断ページで表示'),
  mannKendall: location('科目別に支出トレンドページで表示'),
  theilSen: location('科目別に支出トレンドページで表示'),
  pValue: location('科目別に支出トレンドページで表示'),
  contribution: location('支出トレンドページの寄与度で表示'),
  judge: location('診断・予算・やりくり試算の各ページで行ごとに表示'),
  signal: location('科目別に診断ページで表示'),
  classification: location('科目別に診断ページで表示'),
  fixedCost: metric(({ diagnosis }) => (diagnosis ? yen(diagnosis.kpi.fixedCost) : null)),
  variance: location('予算管理ページで表示'),
  landing: location('予算管理ページで表示'),
  budgetOver: location('やりくり試算ページで表示'),
  unexplained: location('やりくり試算ページで表示'),
  subsDup: location('サブスク分析ページで表示'),
  subsSpike: location('サブスク分析ページで表示'),
  vendor: location('サブスク分析ページで表示'),
  revenueShare: location('サブスク分析ページで表示'),
  explainability: location('家計ページで表示'),
  savingsRate: location('家計ページで表示'),
  bizAdvance: location('家計ページで表示'),
  transfer: location('公私仕分けページで集計対象外として表示'),
  journalize: notApplicable,
  account: notApplicable,
  voucher: location('現金記帳ページの証憑列で表示'),
  houseworkSplit: notApplicable,
  closingAdjust: notApplicable,
  doubleCount: location('現金記帳ページで疑いがあれば件数を表示'),
  holderName: location('設定ページの口座名義一覧で表示'),
  unrecordedMonth: metric(({ summary }) => {
    const months = summary?.overview.unrecordedExpMonths;
    return months ? (months.length ? months.join(', ') : 'なし') : null;
  }),
  publicPrivate: location('公私仕分けページで表示'),
  reportType: location('AI分析ページで表示'),
  reportVersion: location('AI分析ページで表示'),
  mergedJson: location('取込・エクスポートで使用'),
} satisfies Record<TermId, GuideCurrentProvider>;

/** 静的な用語辞書へ、取得できた現在値だけを合成する純粋adapter。 */
export function buildGuideSections(summary?: SummaryResponse, diagnosis?: DiagnosisData) {
  const ov = summary?.overview;
  const annualizedBench = ov ? `前年実績${yen(ov.kpi.prevYearExpense)}との比較で増減を判断` : null;
  return GUIDE_SECTIONS.map((section) => ({
    ...section,
    rows: section.ids.map((id): GuideRow => {
      const entry = GLOSSARY[id] as GlossaryEntry;
      const current = GUIDE_CURRENT[id]({ summary, diagnosis });
      return {
        id,
        term: entry.term,
        desc: entry.desc ?? entry.short,
        currentKind: current.kind,
        now: current.kind === 'not_applicable' ? '該当なし' : (current.text ?? '—'),
        bench: (id === 'annualized' ? annualizedBench : null) ?? entry.bench ?? '—',
      };
    }),
  }));
}
