/**
 * 使い方画面の『用語と目安』の行。
 *
 * どの用語の「現在値」欄が何を表すか (数値・画面の場所・前提・該当なし) は core の
 * `GUIDE_TERM_CURRENT` が正本で、ここは円・% の書式を付けて用語集の文言と並べるだけ。
 */
import {
  type GuideTermCurrentKind,
  type GuideTermValue,
  guideTermBench,
  guideTermCurrent,
} from '@kanjo/core';
import type { DiagnosisData, SummaryResponse } from './api.js';
import { pct, yen } from './format.js';
import { GLOSSARY, GUIDE_SECTIONS, type GlossaryEntry, type TermId } from './glossary.js';

export type GuideCurrentKind = GuideTermCurrentKind;

export interface GuideRow {
  id: TermId;
  term: string;
  desc: string;
  currentKind: GuideCurrentKind;
  now: string;
  bench: string;
}

/** 現在値の書式。取得できない数値は「—」 */
function formatTermValue(value: GuideTermValue): string {
  if (!value) return '—';
  if (value.type === 'yen') return yen(value.value);
  if (value.type === 'percent') return `${value.prefix ?? ''}${pct(value.value, 0)}${value.suffix ?? ''}`;
  return value.value;
}

/** 静的な用語辞書へ、取得できた現在値だけを合成する純粋adapter。 */
export function buildGuideSections(summary?: SummaryResponse, diagnosis?: DiagnosisData) {
  const context = { summary, diagnosis };
  return GUIDE_SECTIONS.map((section) => ({
    ...section,
    rows: section.ids.map((id): GuideRow => {
      const entry = GLOSSARY[id] as GlossaryEntry;
      const current = guideTermCurrent(id, context);
      const bench = guideTermBench(id, context);
      return {
        id,
        term: entry.term,
        desc: entry.desc ?? entry.short,
        currentKind: current.kind,
        now: current.kind === 'not_applicable' ? '該当なし' : formatTermValue(current.value),
        bench: (bench ? `前年実績${yen(bench.value)}との比較で増減を判断` : null) ?? entry.bench ?? '—',
      };
    }),
  }));
}
