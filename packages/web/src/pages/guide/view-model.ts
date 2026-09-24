/**
 * 使い方画面 (spec-guide-screen) の表示用の薄い層。
 *
 * 節・ステップ・よくある疑問・期間の表・このページの数値・検索の規則は core の guide-screen が正本で、
 * pages/guide の中で core を読むのはこのファイルだけにする。ここで足すのは URL 状態と円の書式だけ。
 */
import {
  AI_DATA_NOTICE,
  GUIDE_DEFAULT_TOPIC,
  GUIDE_FACT_LABELS,
  GUIDE_FAQ,
  GUIDE_FLOW_LEAD,
  GUIDE_HEADING,
  GUIDE_INCLUDES,
  GUIDE_PERIOD_TABLE,
  GUIDE_RELATED_PAGES,
  GUIDE_SEARCH,
  GUIDE_STEPS,
  GUIDE_STEP_OPEN_LABEL,
  GUIDE_TOPICS,
  GUIDE_TOPIC_BODY,
  GUIDE_TOTALS_LABELS,
  GUIDE_TOTALS_LEAD,
  type GuideFact,
  type GuideFaqRow,
  type GuideFlowStage,
  type GuideLink,
  type GuideScreen,
  type GuideSearchResult,
  type GuideStep,
  type GuideTopic,
  type GuideTopicId,
  clampGuideQuery,
  guideFlowStages,
  guideOpenLabel,
  guidePageFacts,
  guideTopic,
  resolveGuideTopic,
  searchGuide,
} from '@kanjo/core';
import { dateTime } from '../../format.js';
import { ABBREVIATIONS, GLOSSARY, GUIDE_SECTIONS, type GlossaryEntry } from '../../glossary.js';

export {
  AI_DATA_NOTICE,
  GUIDE_FAQ,
  GUIDE_FACT_LABELS,
  GUIDE_FLOW_LEAD,
  GUIDE_HEADING,
  GUIDE_INCLUDES,
  GUIDE_PERIOD_TABLE,
  GUIDE_RELATED_PAGES,
  GUIDE_SEARCH,
  GUIDE_STEPS,
  GUIDE_STEP_OPEN_LABEL,
  GUIDE_TOPICS,
  GUIDE_TOPIC_BODY,
  GUIDE_TOTALS_LABELS,
  GUIDE_TOTALS_LEAD,
  guideFlowStages,
  guideOpenLabel,
  guideTopic,
};
export type {
  GuideFact,
  GuideFaqRow,
  GuideFlowStage,
  GuideLink,
  GuideScreen,
  GuideSearchResult,
  GuideStep,
  GuideTopic,
  GuideTopicId,
};

/* -------- URL -------- */

export interface GuideUrlState {
  topic: GuideTopicId;
  /** 100 字で切った検索語 */
  q: string;
}

/** URL の topic / q を読む。未知の topic は月次の流れ、q は 100 字で切る */
export function readGuideUrl(params: URLSearchParams): GuideUrlState {
  return { topic: resolveGuideTopic(params.get('topic')), q: clampGuideQuery(params.get('q')) };
}

/**
 * URL の更新。既定値 (月次の流れ・空の検索語) はキーごと消し、期間など他のキーは残す。
 */
export function writeGuideUrl(params: URLSearchParams, patch: Partial<GuideUrlState>): URLSearchParams {
  const next = new URLSearchParams(params);
  if (patch.topic !== undefined) {
    if (patch.topic === GUIDE_DEFAULT_TOPIC) next.delete('topic');
    else next.set('topic', patch.topic);
  }
  if (patch.q !== undefined) {
    const q = clampGuideQuery(patch.q);
    if (q) next.set('q', q);
    else next.delete('q');
  }
  return next;
}

/* -------- 数値の書式 -------- */

export { signedYen } from '../../format.js';

/** このページの数値 4 項目。最終更新は画面共通の日時書式で出す */
export const pageFacts = (screen: GuideScreen): GuideFact[] => guidePageFacts(screen, dateTime);

/* -------- 検索 -------- */

/**
 * 『用語と目安』の本文は web の用語集そのものなので、その文言 (用語・説明・略語) を検索の対象に足す。
 */
const TERMS_TEXT: readonly string[] = [
  ...GUIDE_SECTIONS.flatMap((section) => [
    section.title,
    section.lead,
    ...section.ids.flatMap((id) => {
      const entry = GLOSSARY[id] as GlossaryEntry;
      return [entry.term, entry.desc ?? entry.short];
    }),
  ]),
  ...ABBREVIATIONS.flatMap((a) => [a.abbr.abbr, a.abbr.full, a.abbr.ja]),
];

export const searchGuideTopics = (q: string): GuideSearchResult => searchGuide(q, { terms: TERMS_TEXT });

/** 検索で絞った目次。検索語が空なら 7 項目すべて */
export function visibleTopics(result: GuideSearchResult): GuideTopic[] {
  return GUIDE_TOPICS.filter((t) => result.topics.includes(t.id));
}

/** 検索結果に残る選択トピック。現在の項目が外れたら最初の一致へ移る。 */
export function selectedGuideTopic(result: GuideSearchResult, requested: GuideTopicId): GuideTopicId | null {
  return result.topics.includes(requested) ? requested : (result.topics[0] ?? null);
}

/** 検索で絞ったよくある疑問の行 */
export function visibleFaqRows(result: GuideSearchResult): readonly GuideFaqRow[] {
  return GUIDE_FAQ.rows.filter((row) => result.faq.includes(row.id));
}
