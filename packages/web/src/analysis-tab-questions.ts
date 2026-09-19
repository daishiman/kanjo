import type { AnalysisTabId } from './routeMetadata.js';

/**
 * 問いの見出しを持つタブ。PageHeader の「支出分析」を問いに置き換え、説明文をタブより上に置く。
 * 照合は作業画面なので、ハブと同じく「どこから手を付けるか」を先頭で問う(spec-reconciliation UI・状態遷移)。
 *
 * `guideSummary` を持つタブは、畳んだ詳細だけを見出しの下に残す。総収支は判定の区分と
 * 除外の扱いを知らないと数字を誤読するので、lead の1文では足りない。
 *
 * `routeMetadata.ts` ではなくここに置くのは、読むのが `pages/Analysis.tsx` (遅延読込) だけだから。
 * `routeMetadata.ts` はサイドバーが起動時に読むので初期 JS に載る。そこへ同居させると、
 * 支出分析を開かない利用者にもこの文面が配信される (初期 JS budget 110KiB を圧迫する)。
 */
export const ANALYSIS_TAB_QUESTIONS: Partial<
  Record<AnalysisTabId, { question: string; lead: string; guideSummary?: string }>
> = {
  reconciliation: {
    question: '帳簿と口座の差異を、どこから解消しますか？',
    lead: 'MoneyForwardの取引とfreeeの仕訳を照合し、未処理の差異を一つずつ確認・解消しましょう。',
  },
  'total-cashflow': {
    question: '家計と事業を合わせた、本当の収支はいくらですか？',
    lead: '家計と事業の収入・支出を月次で確認し、重複や除外を調整した実質的な収支を把握しましょう。',
    guideSummary: 'データの見方',
  },
  trends: {
    question: '収支は、いつ・なぜ変わりましたか？',
    lead: '収入・支出・純収支の時系列の変化から、増減のタイミングや要因を把握しましょう。',
  },
  diagnosis: {
    question: '次に改善すると、最も効くのはどこですか？',
    lead: '収支データから改善余地の大きい項目を特定し、根拠を確認して実行へ進みましょう。',
  },
};
