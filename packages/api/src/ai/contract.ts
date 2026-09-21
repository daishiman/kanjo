/**
 * AI分析レポートの契約(spec-v1.1 §16)。
 * - 期間は「開始年月〜終了年月」の1組で表す(月次1ヶ月 / 年次〜13ヶ月 / 長期14ヶ月以上)。
 * - 貼り付け用指示文、受信レポートの検証と無害化をここに集約する。
 * - レポートは毎回同じ5節で受け取る(節が欠けたら受け付けない)。
 *   v2 では冒頭の「要点サマリー」「精度を上げるために必要な情報」「図表データ」「前回からの変化」を追加で受け取る。
 *   v3(要望23/24/25)では要点を「事実→解釈→次のアクション」の3段に固定し、図は図表カタログの id と説明文だけを受け取る
 *   (数値はアプリが計算し、保存時にスナップショットとして本文へ同梱する)。節ごとの最低件数・文字数もここで検査する。
 *   v4 では、利用者へのヒアリング、外部情勢の出典、因果「仮説」と反証・限界を contextAnalysis へ分離する。
 *   外部情報は会計金額の根拠ではなく、背景仮説の根拠だけに使う。
 * - 本文はプレーンテキスト(改行・箇条書きのみ)。HTMLタグ・制御文字は保存前に落とす。
 */
import { AI_ANALYSIS_DEPTHS, type AiAnalysisDepth } from '@kanjo/core';
import { z } from 'zod';
import {
  CATALOG_IDS,
  CHART_CATALOG,
  type ChartData,
  type ChartKind,
  type ChartResult,
  type ChartUnit,
} from './catalog.js';

export * from './period.js';
import { type Period, REPORT_TYPE_LABEL, periodLabel, reportTypeOf } from './period.js';

/* -------- 受信レポートの検証 -------- */

/** 固定 4 MiB の request budget。個別 field・配列の上限は reportInputSchema が別に検証する。 */
export const REPORT_BODY_MAX_BYTES = 4 * 1024 * 1024;

const textField = (max: number) => z.string().max(max);

/** 節の中の1行(表の行)。要点(finding)より軽い */
const itemSchema = z.object({
  label: textField(200).min(1),
  amount: z.number().int().safe().nullable().optional(),
  note: textField(1000).nullable().optional(),
  priority: z.enum(['high', 'mid', 'low']).nullable().optional(),
});

/**
 * 要点(要望23b): 事実(数値+計算根拠)→解釈→次のアクション の3段を必ず持つ。
 * どれか1つでも欠けたら受け付けない(zod の min で拒否)。
 */
const findingSchema = z.object({
  label: textField(200).min(1),
  fact: textField(600).min(10),
  basis: textField(400).min(5),
  interpretation: textField(800).min(10),
  action: textField(600).min(5),
  expectedEffect: z.number().int().safe().nullable().optional(),
  amount: z.number().int().safe().nullable().optional(),
  priority: z.enum(['high', 'mid', 'low']).nullable().optional(),
  chart: z.string().max(40).nullable().optional(),
});

export const SECTION_IDS = ['spend', 'change', 'reduction', 'split', 'subscriptions'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABEL: Record<SectionId, string> = {
  spend: '何にいくらかかっているか',
  change: '前年・前月との増減と要因',
  reduction: '削減余地と根拠・優先順位',
  split: '事業/個人・名義(事業/妻/家族)の別',
  subscriptions: 'サブスクの整理候補',
};

/** 節ごとの最低行数(要望23a)。満たせないときは section.gap にデータ不足の理由(10字以上)を書く */
export const SECTION_MIN_ITEMS: Record<SectionId, number> = {
  spend: 3,
  change: 1,
  reduction: 2,
  split: 2,
  subscriptions: 1,
};

/** 文字数の下限・上限(要望23a)。短すぎる=分析していない、長すぎる=読めない */
export const TEXT_LIMITS = {
  summary: { min: 60, max: 1200 },
  sectionBody: { min: 80, max: 6000 },
  gap: { min: 10, max: 400 },
  caption: { min: 15, max: 400 },
} as const;

const sectionSchema = z.object({
  id: z.enum(SECTION_IDS),
  title: textField(120).nullable().optional(),
  body: textField(TEXT_LIMITS.sectionBody.max).min(TEXT_LIMITS.sectionBody.min),
  items: z.array(itemSchema).max(60).optional(),
  gap: textField(TEXT_LIMITS.gap.max).nullable().optional(),
});

/** 「精度を上げるために必要な情報」の行き先(アプリ内の画面 id)。画面に無い id は保存時に落とす */
export const NEED_SCREENS = [
  'import',
  'classify',
  'settings',
  'budget',
  'subscriptions',
  'household',
  'overview',
] as const;
export type NeedScreen = (typeof NEED_SCREENS)[number];

const needSchema = z.object({
  gap: textField(300).min(1),
  action: textField(500).min(1),
  screen: z.string().max(40).nullable().optional(),
});

/** 図(要望25b): AI が送るのはカタログ id と説明文だけ。数値は受け取らない */
const chartRefSchema = z.object({
  catalogId: textField(40).min(1),
  caption: textField(TEXT_LIMITS.caption.max),
});

const keyFindingsSchema = z.object({
  improvements: z.array(findingSchema).max(10).optional(),
  wasted: z.array(findingSchema).max(10).optional(),
  quickWins: z.array(findingSchema).max(10).optional(),
  /** 該当なしの分類には、なぜ無いかを書く(空のまま黙って省くのを禁止) */
  notes: z
    .object({
      improvements: textField(400).nullable().optional(),
      wasted: textField(400).nullable().optional(),
      quickWins: textField(400).nullable().optional(),
    })
    .optional(),
});

const followUpSchema = z.object({
  body: textField(6000),
  items: z.array(itemSchema).max(30).optional(),
});

const interviewFactSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
  source: z.literal('user_reported'),
  question: textField(300).min(1),
  answer: textField(1200).min(1),
});

const statisticalFactSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
  statement: textField(1000).min(10),
  basis: textField(800).min(5),
  evidenceRefs: z.array(textField(120).min(1)).min(1).max(20),
});

const interpretationSchema = z.object({
  statement: textField(1000).min(10),
  factRefs: z.array(textField(40).min(1)).min(1).max(20),
  limitation: textField(800).min(5),
});

const externalEvidenceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
  title: textField(300).min(1),
  url: z
    .string()
    .url()
    .max(2000)
    .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
      message: 'http(s) URL だけを指定してください',
    }),
  publishedAt: z.string().max(40).nullable().optional(),
  accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  claim: textField(1000).min(10),
  relevance: textField(1000).min(10),
  evidenceLevel: z.literal('published_source'),
});

const causalHypothesisSchema = z.object({
  role: z.enum(['primary', 'alternative']),
  hypothesis: textField(1000).min(10),
  /** 未検証の因果スレッド。 */
  cause: textField(500).min(1),
  mechanism: textField(700).min(1),
  outcome: textField(500).min(1),
  evidenceFor: z.array(textField(600).min(1)).min(1).max(12),
  evidenceAgainst: z.array(textField(600).min(1)).min(1).max(12),
  confounders: z.array(textField(600).min(1)).min(1).max(12),
  falsificationCondition: textField(800).min(5),
  evidenceLevel: z.enum(['data_confirmed', 'user_reported', 'published_source', 'assumption']),
  /** published_source は externalEvidence.id、data_confirmed は dataset 内の根拠名を指す。 */
  evidenceRefs: z.array(textField(80).min(1)).max(20),
  confidence: z.enum(['low', 'medium', 'high']),
  validationAction: textField(800).min(5),
});

const contextAnalysisSchema = z
  .object({
    /** off のときは外部検索をしない。used は URL と取得日の記録が必須。 */
    externalResearch: z.enum(['off', 'used']).default('off'),
    questionType: z.enum([
      'distribution',
      'comparison',
      'relationship',
      'decomposition',
      'trend',
      'concentration',
      'anomaly',
    ]),
    question: z.object({
      decision: textField(500).min(1),
      metric: textField(300).min(1),
      comparison: textField(500).min(1),
      range: textField(200).min(1),
    }),
    interviewFacts: z.array(interviewFactSchema).max(20).optional(),
    statisticalFacts: z.array(statisticalFactSchema).max(30),
    interpretations: z.array(interpretationSchema).max(30),
    externalEvidence: z.array(externalEvidenceSchema).max(20).optional(),
    causalHypotheses: z.array(causalHypothesisSchema).max(12).optional(),
  })
  .superRefine((value, ctx) => {
    const evidenceCount = value.externalEvidence?.length ?? 0;
    if (value.externalResearch === 'off' && evidenceCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalEvidence'],
        message: '外部調査OFFのレポートに外部出典は保存できません',
      });
    }
    if (value.externalResearch === 'used' && evidenceCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalEvidence'],
        message: '外部調査を使った場合は URL・取得日・主張を少なくとも1件記録してください',
      });
    }
    const sourceIds = new Set((value.externalEvidence ?? []).map((evidence) => evidence.id));
    if (sourceIds.size !== evidenceCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalEvidence'],
        message: '外部出典の id は重複できません',
      });
    }
    const interviewIds = new Set((value.interviewFacts ?? []).map((fact) => fact.id));
    const hypotheses = value.causalHypotheses ?? [];
    const factIds = new Set((value.statisticalFacts ?? []).map((fact) => fact.id));
    if (factIds.size !== (value.statisticalFacts?.length ?? 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['statisticalFacts'],
        message: '統計的事実の id は重複できません',
      });
    }
    for (const [index, interpretation] of (value.interpretations ?? []).entries()) {
      if (interpretation.factRefs.some((reference) => !factIds.has(reference))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['interpretations', index, 'factRefs'],
          message: 'factRefs は statisticalFacts.id を参照してください',
        });
      }
    }
    const roles = new Set(hypotheses.map((hypothesis) => hypothesis.role));
    if (hypotheses.length > 0 && (!roles.has('primary') || !roles.has('alternative'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['causalHypotheses'],
        message: '背景仮説を出す場合は主仮説と対立仮説を各1件以上記録してください',
      });
    }
    const assumptions = hypotheses.filter((hypothesis) => hypothesis.evidenceLevel === 'assumption').length;
    if (hypotheses.length > 0 && assumptions * 2 > hypotheses.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['causalHypotheses'],
        message: '想定(assumption)の仮説は全体の半数以下にしてください',
      });
    }
    for (const [index, hypothesis] of hypotheses.entries()) {
      if (
        hypothesis.evidenceLevel === 'user_reported' &&
        (hypothesis.evidenceRefs.length === 0 ||
          hypothesis.evidenceRefs.some((reference) => !interviewIds.has(reference)))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['causalHypotheses', index, 'evidenceRefs'],
          message: '利用者回答を根拠にする仮説は interviewFacts.id を参照してください',
        });
      }
      if (hypothesis.evidenceLevel !== 'published_source') continue;
      if (
        hypothesis.evidenceRefs.length === 0 ||
        hypothesis.evidenceRefs.some((reference) => !sourceIds.has(reference))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['causalHypotheses', index, 'evidenceRefs'],
          message: '公表資料を根拠にする仮説は externalEvidence.id を参照してください',
        });
      }
    }
  });

export const reportInputSchema = z.object({
  generatedBy: textField(60).min(1),
  model: textField(120).nullable().optional(),
  title: textField(120).nullable().optional(),
  analysisDepth: z.enum(AI_ANALYSIS_DEPTHS),
  summary: textField(TEXT_LIMITS.summary.max).min(TEXT_LIMITS.summary.min),
  keyFindings: keyFindingsSchema,
  sections: z
    .array(sectionSchema)
    .min(SECTION_IDS.length)
    .max(SECTION_IDS.length * 2),
  followUp: followUpSchema.nullable().optional(),
  needs: z.array(needSchema).max(30).optional(),
  charts: z.array(chartRefSchema).max(CHART_CATALOG.length).optional(),
  dataGaps: z.array(textField(500)).max(40).optional(),
  /**
   * v4 で足した背景分析。兄弟の節 (followUp / needs / charts / dataGaps) と同じく任意で、
   * 無いレポートも受け付ける (契約 v3 を壊さない)。無ければ保存本文でも null のままにする。
   */
  contextAnalysis: contextAnalysisSchema.optional(),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

export interface ReportItem {
  label: string;
  amount: number | null;
  note: string;
  priority: 'high' | 'mid' | 'low' | null;
}
export interface ReportFinding {
  label: string;
  fact: string;
  basis: string;
  interpretation: string;
  action: string;
  expectedEffect: number | null;
  amount: number | null;
  priority: 'high' | 'mid' | 'low' | null;
  /** 根拠にした図(カタログ id)。無ければ null */
  chart: string | null;
}
export interface ReportSection {
  id: SectionId;
  title: string;
  body: string;
  items: ReportItem[];
  /** 最低行数を満たせなかった理由(データ不足)。満たしていれば null */
  gap: string | null;
}
export interface ReportNeed {
  gap: string;
  action: string;
  screen: NeedScreen | null;
}
/** 保存される図: アプリが計算した数値のスナップショット + AI の説明文 */
export interface ReportChart {
  id: string;
  figure: number;
  title: string;
  kind: ChartKind;
  unit: ChartUnit;
  purpose: string;
  readingGuide: string;
  available: boolean;
  reason: string | null;
  monthsNeeded: number | null;
  granularity: 'month' | 'quarter' | null;
  data: ChartData | null;
  status: ChartResult['status'];
  caption: string;
}
export interface ReportKeyFindings {
  improvements: ReportFinding[];
  wasted: ReportFinding[];
  quickWins: ReportFinding[];
  notes: { improvements: string; wasted: string; quickWins: string };
}
export interface ReportContextAnalysis {
  externalResearch: 'off' | 'used';
  questionType:
    | 'distribution'
    | 'comparison'
    | 'relationship'
    | 'decomposition'
    | 'trend'
    | 'concentration'
    | 'anomaly';
  question: { decision: string; metric: string; comparison: string; range: string };
  interviewFacts: { id: string; source: 'user_reported'; question: string; answer: string }[];
  statisticalFacts: { id: string; statement: string; basis: string; evidenceRefs: string[] }[];
  interpretations: { statement: string; factRefs: string[]; limitation: string }[];
  externalEvidence: {
    id: string;
    title: string;
    url: string;
    publishedAt: string | null;
    accessedAt: string;
    claim: string;
    relevance: string;
    evidenceLevel: 'published_source';
  }[];
  causalHypotheses: {
    role: 'primary' | 'alternative';
    hypothesis: string;
    cause: string;
    mechanism: string;
    outcome: string;
    evidenceFor: string[];
    evidenceAgainst: string[];
    confounders: string[];
    falsificationCondition: string;
    evidenceLevel: 'data_confirmed' | 'user_reported' | 'published_source' | 'assumption';
    evidenceRefs: string[];
    confidence: 'low' | 'medium' | 'high';
    validationAction: string;
  }[];
}
export interface AiReportBody {
  version: 4;
  generatedBy: string;
  model: string | null;
  title: string;
  analysisDepth: AiAnalysisDepth;
  summary: string;
  keyFindings: ReportKeyFindings;
  sections: ReportSection[];
  followUp: { body: string; items: ReportItem[] } | null;
  needs: ReportNeed[];
  charts: ReportChart[];
  dataGaps: string[];
  contextAnalysis: ReportContextAnalysis | null;
}

/** HTMLタグ・制御文字を落とし、改行は最大2連続に丸める。保存も表示もこの文字列だけを使う */
export function sanitizeText(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&(lt|gt|amp|quot|#\d+);/g, ' ')
    .replace(/[^\P{C}\n\t]/gu, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type InputItem = z.infer<typeof itemSchema>;
const normItems = (items: InputItem[] | undefined): ReportItem[] =>
  (items ?? []).map((it) => ({
    label: sanitizeText(it.label),
    amount: typeof it.amount === 'number' ? it.amount : null,
    note: sanitizeText(it.note ?? ''),
    priority: it.priority ?? null,
  }));

type InputFinding = z.infer<typeof findingSchema>;
const catalogSet = new Set<string>(CATALOG_IDS);
const normFindings = (items: InputFinding[] | undefined): ReportFinding[] =>
  (items ?? []).map((it) => ({
    label: sanitizeText(it.label),
    fact: sanitizeText(it.fact),
    basis: sanitizeText(it.basis),
    interpretation: sanitizeText(it.interpretation),
    action: sanitizeText(it.action),
    expectedEffect: typeof it.expectedEffect === 'number' ? it.expectedEffect : null,
    amount: typeof it.amount === 'number' ? it.amount : null,
    priority: it.priority ?? null,
    chart: it.chart && catalogSet.has(it.chart) ? it.chart : null,
  }));

const normTextList = (items: string[] | undefined): string[] =>
  (items ?? []).map(sanitizeText).filter((item) => item.length > 0);

function normContext(input: ReportInput['contextAnalysis'] | undefined): ReportContextAnalysis {
  return {
    externalResearch: input?.externalResearch ?? 'off',
    questionType: input?.questionType ?? 'trend',
    question: input?.question
      ? {
          decision: sanitizeText(input.question.decision),
          metric: sanitizeText(input.question.metric),
          comparison: sanitizeText(input.question.comparison),
          range: sanitizeText(input.question.range),
        }
      : { decision: '', metric: '', comparison: '', range: '' },
    interviewFacts: (input?.interviewFacts ?? []).map((fact, index) => ({
      id: fact.id ?? `interview-${index + 1}`,
      source: 'user_reported',
      question: sanitizeText(fact.question),
      answer: sanitizeText(fact.answer),
    })),
    statisticalFacts: (input?.statisticalFacts ?? []).map((fact) => ({
      id: fact.id,
      statement: sanitizeText(fact.statement),
      basis: sanitizeText(fact.basis),
      evidenceRefs: normTextList(fact.evidenceRefs),
    })),
    interpretations: (input?.interpretations ?? []).map((interpretation) => ({
      statement: sanitizeText(interpretation.statement),
      factRefs: normTextList(interpretation.factRefs),
      limitation: sanitizeText(interpretation.limitation),
    })),
    externalEvidence: (input?.externalEvidence ?? []).map((evidence) => ({
      id: evidence.id,
      title: sanitizeText(evidence.title),
      url: evidence.url,
      publishedAt: evidence.publishedAt ? sanitizeText(evidence.publishedAt) || null : null,
      accessedAt: evidence.accessedAt,
      claim: sanitizeText(evidence.claim),
      relevance: sanitizeText(evidence.relevance),
      evidenceLevel: evidence.evidenceLevel,
    })),
    causalHypotheses: (input?.causalHypotheses ?? []).map((hypothesis, index) => ({
      role: hypothesis.role ?? (index === 0 ? 'primary' : 'alternative'),
      hypothesis: sanitizeText(hypothesis.hypothesis),
      cause: sanitizeText(hypothesis.cause ?? hypothesis.hypothesis),
      mechanism: sanitizeText(hypothesis.mechanism ?? '作用経路は未確認'),
      outcome: sanitizeText(hypothesis.outcome ?? '会計指標との関連を検証する'),
      evidenceFor: normTextList(hypothesis.evidenceFor),
      evidenceAgainst: normTextList(hypothesis.evidenceAgainst),
      confounders: normTextList(hypothesis.confounders),
      falsificationCondition: sanitizeText(hypothesis.falsificationCondition),
      evidenceLevel: hypothesis.evidenceLevel,
      evidenceRefs: normTextList(hypothesis.evidenceRefs),
      confidence: hypothesis.confidence,
      validationAction: sanitizeText(hypothesis.validationAction),
    })),
  };
}

export const FINDING_KEYS = ['improvements', 'wasted', 'quickWins'] as const;
export const FINDING_LABEL: Record<(typeof FINDING_KEYS)[number], string> = {
  improvements: '改善すべき点',
  wasted: '無駄なコスト',
  quickWins: 'すぐ効く対策',
};

/** 図の参照表記(本文で「図3」と書く)。全角数字も受け付ける */
const figureRefs = (text: string): Set<number> => {
  const out = new Set<number>();
  for (const m of text.matchAll(/図\s*([0-9０-９]+)/g)) {
    const n = Number(m[1].replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10)));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
};

export type NormalizeResult =
  | { ok: true; body: AiReportBody }
  | { ok: false; code: 'missing_sections'; missing: SectionId[]; issues: string[] }
  | { ok: false; code: 'report_rules'; missing: SectionId[]; issues: string[] };

/**
 * 5節が揃っているかを確認し、既定の順序に並べ替えて無害化する。
 * v3 では要点の3段・節の最低行数・図の参照(要望23)もここで検査し、満たさなければ理由を列挙して拒否する。
 * charts にはアプリが計算した図(GET data と同じもの)を渡す。保存時に数値をスナップショットとして同梱する。
 */
export function normalizeReport(input: ReportInput, period: Period, charts: ChartResult[]): NormalizeResult {
  const byId = new Map<SectionId, (typeof input.sections)[number]>();
  for (const sec of input.sections) if (!byId.has(sec.id)) byId.set(sec.id, sec);
  const missing = SECTION_IDS.filter((id) => !byId.has(id));
  if (missing.length)
    return {
      ok: false,
      code: 'missing_sections',
      missing,
      issues: missing.map((m) => `節 ${m} がありません`),
    };
  const issues: string[] = [];
  const sections: ReportSection[] = SECTION_IDS.map((id) => {
    const sec = byId.get(id) as (typeof input.sections)[number];
    const items = normItems(sec.items);
    const gap = sanitizeText(sec.gap ?? '') || null;
    if (items.length < SECTION_MIN_ITEMS[id] && (!gap || gap.length < TEXT_LIMITS.gap.min)) {
      issues.push(
        `節 ${id}(${SECTION_LABEL[id]})は items が${SECTION_MIN_ITEMS[id]}行以上必要です(現在${items.length}行)。データ不足なら gap に理由を${TEXT_LIMITS.gap.min}字以上で書いてください`,
      );
    }
    return {
      id,
      title: sanitizeText(sec.title || '') || SECTION_LABEL[id],
      body: sanitizeText(sec.body),
      items,
      gap,
    };
  });
  const notes = {
    improvements: sanitizeText(input.keyFindings.notes?.improvements ?? ''),
    wasted: sanitizeText(input.keyFindings.notes?.wasted ?? ''),
    quickWins: sanitizeText(input.keyFindings.notes?.quickWins ?? ''),
  };
  const keyFindings: ReportKeyFindings = {
    improvements: normFindings(input.keyFindings.improvements),
    wasted: normFindings(input.keyFindings.wasted),
    quickWins: normFindings(input.keyFindings.quickWins),
    notes,
  };
  for (const k of FINDING_KEYS) {
    if (keyFindings[k].length === 0 && notes[k].length < 10)
      issues.push(
        `keyFindings.${k}(${FINDING_LABEL[k]})が空です。該当なしなら keyFindings.notes.${k} に理由を10字以上で書いてください`,
      );
  }
  const screens = new Set<string>(NEED_SCREENS);
  const needs: ReportNeed[] = (input.needs ?? []).map((n) => ({
    gap: sanitizeText(n.gap),
    action: sanitizeText(n.action),
    screen: n.screen && screens.has(n.screen) ? (n.screen as NeedScreen) : null,
  }));
  // 図: カタログ外の id は拒否。出せる図には caption と本文中の「図N」参照を必須にする
  const captions = new Map<string, string>();
  for (const ref of input.charts ?? []) {
    const id = sanitizeText(ref.catalogId);
    if (!catalogSet.has(id)) {
      issues.push(
        `charts.catalogId「${id}」は図表カタログにありません(使える id: ${CATALOG_IDS.join(', ')})`,
      );
      continue;
    }
    captions.set(id, sanitizeText(ref.caption));
  }
  const referenced = new Set<number>();
  for (const t of [input.summary, ...sections.map((x) => x.body)])
    for (const n of figureRefs(t)) referenced.add(n);
  const storedCharts: ReportChart[] = charts.map((c) => {
    const caption = captions.get(c.id) ?? '';
    if (c.available) {
      if (caption.length < TEXT_LIMITS.caption.min)
        issues.push(
          `図${c.figure}(${c.id})は出せる図です。charts に caption を${TEXT_LIMITS.caption.min}字以上で付けてください`,
        );
      if (!referenced.has(c.figure))
        issues.push(
          `図${c.figure}(${c.id})が summary か各節の body で「図${c.figure}」として参照されていません`,
        );
    }
    return {
      id: c.id,
      figure: c.figure,
      title: c.title,
      kind: c.kind,
      unit: c.unit,
      purpose: c.purpose,
      readingGuide: c.readingGuide,
      available: c.available,
      reason: c.reason,
      monthsNeeded: c.monthsNeeded,
      granularity: c.granularity,
      data: c.data,
      status: c.status,
      caption,
    };
  });
  const availableFigures = new Set(charts.filter((c) => c.available).map((c) => c.figure));
  for (const n of referenced) {
    if (!availableFigures.has(n))
      issues.push(`本文が「図${n}」を参照していますが、その図は出せません(available=false)か存在しません`);
  }
  if (issues.length) return { ok: false, code: 'report_rules', missing: [], issues };
  return {
    ok: true,
    body: {
      version: 4,
      generatedBy: sanitizeText(input.generatedBy) || 'unknown',
      model: input.model ? sanitizeText(input.model) || null : null,
      title: sanitizeText(input.title ?? '') || `${periodLabel(period)}の会計分析`,
      analysisDepth: input.analysisDepth,
      summary: sanitizeText(input.summary),
      keyFindings,
      sections,
      followUp: input.followUp
        ? { body: sanitizeText(input.followUp.body), items: normItems(input.followUp.items) }
        : null,
      needs,
      charts: storedCharts,
      dataGaps: (input.dataGaps ?? []).map(sanitizeText).filter((g) => g.length > 0),
      // 送られてこなかった背景分析は作らない (空の節を捏造せず、無かったことを null で残す)
      contextAnalysis: input.contextAnalysis ? normContext(input.contextAnalysis) : null,
    },
  };
}

interface LegacyItem {
  label?: string;
  amount?: number | null;
  note?: string;
  priority?: 'high' | 'mid' | 'low' | null;
}
interface LegacyChart {
  id?: string;
  kind?: string;
  title?: string;
  unit?: string;
  labels?: string[];
  series?: { label: string; data: (number | null)[] }[];
  note?: string;
}

const legacyFinding = (it: LegacyItem): ReportFinding => ({
  label: it.label ?? '',
  fact: [it.label ?? '', typeof it.amount === 'number' ? `${it.amount.toLocaleString('ja-JP')}円` : '']
    .filter(Boolean)
    .join(' '),
  basis: '(旧版のレポートのため計算根拠の記録なし)',
  interpretation: it.note ?? '',
  action: '',
  expectedEffect: null,
  amount: typeof it.amount === 'number' ? it.amount : null,
  priority: it.priority ?? null,
  chart: null,
});

const legacyChart = (ch: LegacyChart, i: number): ReportChart => ({
  id: ch.id ?? `legacy-${i}`,
  figure: 0,
  title: ch.title ?? '',
  kind: ch.kind === 'line' || ch.kind === 'stackedBar' ? ch.kind : 'bar',
  unit: ch.unit === 'pct' || ch.unit === 'count' ? ch.unit : 'yen',
  purpose: '',
  readingGuide: '',
  available: true,
  reason: null,
  monthsNeeded: null,
  granularity: null,
  data: { labels: ch.labels ?? [], series: ch.series ?? [] },
  status: 'ok',
  caption: ch.note ?? '',
});

/** 保存済みの本文(v1〜v4)を表示用の形に揃える。旧版の contextAnalysis は null のままにする。 */
export function upgradeBody(raw: unknown): AiReportBody {
  const b = (raw ?? {}) as Record<string, unknown> & { version?: number };
  const kf = (b.keyFindings ?? {}) as Record<string, unknown>;
  const isV3OrLater = b.version === 3 || b.version === 4;
  const findings = (k: string): ReportFinding[] => {
    const arr = (kf[k] ?? []) as (LegacyItem | ReportFinding)[];
    return isV3OrLater ? (arr as ReportFinding[]) : (arr as LegacyItem[]).map(legacyFinding);
  };
  const notesRaw = (kf.notes ?? {}) as Partial<ReportKeyFindings['notes']>;
  const sections = ((b.sections ?? []) as Partial<ReportSection>[]).map((sec) => ({
    id: sec.id as SectionId,
    title: sec.title ?? '',
    body: sec.body ?? '',
    items: sec.items ?? [],
    gap: sec.gap ?? null,
  }));
  const chartsRaw = (b.charts ?? []) as (LegacyChart | ReportChart)[];
  return {
    version: 4,
    generatedBy: (b.generatedBy as string) ?? 'unknown',
    model: (b.model as string | null) ?? null,
    title: (b.title as string) ?? '',
    analysisDepth:
      b.analysisDepth === 'concise' || b.analysisDepth === 'detailed' ? b.analysisDepth : 'standard',
    summary: (b.summary as string) ?? '',
    keyFindings: {
      improvements: findings('improvements'),
      wasted: findings('wasted'),
      quickWins: findings('quickWins'),
      notes: {
        improvements: notesRaw.improvements ?? '',
        wasted: notesRaw.wasted ?? '',
        quickWins: notesRaw.quickWins ?? '',
      },
    },
    sections,
    followUp: (b.followUp as AiReportBody['followUp']) ?? null,
    needs: (b.needs as ReportNeed[]) ?? [],
    charts: isV3OrLater ? (chartsRaw as ReportChart[]) : (chartsRaw as LegacyChart[]).map(legacyChart),
    dataGaps: (b.dataGaps as string[]) ?? [],
    contextAnalysis:
      Number(b.version ?? 0) >= 4 && b.contextAnalysis
        ? normContext(b.contextAnalysis as ReportInput['contextAnalysis'])
        : null,
  };
}

/* -------- 貼り付け用の指示文 -------- */

export const SKILL_NAME = 'run-kanjo-accounting-report';

export const COPY_TARGETS = ['claude_code', 'codex'] as const;
export type AiCopyTarget = (typeof COPY_TARGETS)[number];

/**
 * コピー先ごとの差は「どの道具に貼るか」と「その道具が読む Skill の置き場所」だけにする。
 * 同じ Skill をリポジトリが2か所に置いている (Claude Code は .claude/skills、Codex は .agents/skills) ので、
 * 宛先を間違えた指示文は相手が読めない。それ以外の手順は共通で、宛先ごとに変えない。
 */
export const COPY_TARGET_GUIDE: Record<AiCopyTarget, { tool: string; skillPath: string }> = {
  claude_code: { tool: 'Claude Code', skillPath: `.claude/skills/${SKILL_NAME}/SKILL.md` },
  codex: { tool: 'Codex', skillPath: `.agents/skills/${SKILL_NAME}/SKILL.md` },
};

export function buildPrompt(p: {
  origin: string;
  taskId: string;
  token: string;
  period: Period;
  expiresAt: string;
  /** 貼り付け先。指示文の宛先と Skill の置き場所がこれで変わる */
  target: AiCopyTarget;
  supplement?: string | null;
  parentReportId?: string | null;
}): string {
  const exp = new Date(p.expiresAt);
  const expText = `${exp.getUTCFullYear()}-${String(exp.getUTCMonth() + 1).padStart(2, '0')}-${String(exp.getUTCDate()).padStart(2, '0')} ${String(exp.getUTCHours()).padStart(2, '0')}:${String(exp.getUTCMinutes()).padStart(2, '0')} UTC`;
  const type = reportTypeOf(p.period);
  const guide = COPY_TARGET_GUIDE[p.target];
  const lines = [
    `${guide.tool} で、このリポジトリの Skill「${SKILL_NAME}」(${guide.skillPath}) を読み、その手順どおりに会計分析レポートを作成して送信してください。`,
    '',
    `- 対象期間: ${periodLabel(p.period)}(${p.period.from} 〜 ${p.period.to})`,
    `- レポートの型: ${REPORT_TYPE_LABEL[type]}(${type})`,
    `- データ取得(GET): ${p.origin}/api/ai/tasks/${p.taskId}/data`,
    `- 結果送信(POST): ${p.origin}/api/ai/tasks/${p.taskId}/report`,
    `- 認証ヘッダー: Authorization: Bearer ${p.token}`,
    `- 有効期限: ${expText}(結果送信は1回だけ受け付けます)`,
  ];
  if (p.parentReportId) {
    lines.push(
      `- 再分析: 前回レポート(${p.parentReportId})の改訂版。取得データの previousReports に前回の内容が入っています`,
    );
  }
  const sup = (p.supplement ?? '').trim();
  if (sup) {
    lines.push(
      '',
      '利用者からの補足情報(背景仮説と interviewFacts にだけ使う。会計金額の fact / basis / expectedEffect の根拠には使わない):',
    );
    for (const l of sup.split('\n')) lines.push(`  ${l}`);
  }
  lines.push(
    '',
    '守ること:',
    '- 数字は取得したデータにある値だけを使う。推測で金額や科目を作らない。不足は「データ不足」と書き、何をすれば分かるかを needs に書く。',
    '- レポートは Skill が定める5節(spend / change / reduction / split / subscriptions)を必ず全て含め、節ごとの最低行数(足りなければ gap に理由)を守る。',
    '- 冒頭の keyFindings(改善すべき点・無駄なコスト・すぐ効く対策)は1件ごとに fact(数値+計算根拠)・basis(どのデータ・期間から)・interpretation(統計的な解釈)・action(次の一手と期待効果 expectedEffect 円)の4つを必ず書く。',
    '- 図は取得データの charts(図表カタログ)にある図だけを使う。available=true の図は本文で「図N」と参照し、charts に {catalogId, caption} を付けて送る。図の数値は送らない(アプリが計算済み)。',
    '- 本文はプレーンテキスト(HTMLやMarkdownの表は使わない)。専門用語は括弧で言い換える。',
    '- 第4版の contextAnalysis を含める。補足の回答は interviewFacts に質問/回答で記録する。',
    '- analysisDepth は依頼のレポート量(concise / standard / detailed)を必ず書く。contextAnalysis で statisticalFacts(統計的事実)→interpretations(解釈)→causalHypotheses(主/対立仮説)を分離し、id参照でつなぐ。',
    '- 因果を断定せず、仮説ごとに cause→mechanism→outcome、支持/反証、交絡候補、反証条件、次の確認を書く。',
    '- 外部調査は利用者が希望した場合だけ。取引先名・個人名・具体金額・明細は検索語に含めず、公的資料優先でURL/取得日/主張を externalEvidence に記録する。',
    '- 外部出典は背景仮説の材料に限り、会計金額・科目の fact/basis に使わない。',
    '- 送信が 201 で受け付けられたら、返ってきた reportId を表示して終了する。',
  );
  return lines.join('\n');
}
