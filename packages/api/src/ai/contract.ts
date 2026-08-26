/**
 * AI分析レポートの契約(spec-v1.1 §16)。
 * - 期間は「開始年月〜終了年月」の1組で表す(月次1ヶ月 / 年次〜13ヶ月 / 長期14ヶ月以上)。
 * - 貼り付け用指示文、受信レポートの検証と無害化をここに集約する。
 * - レポートは毎回同じ5節で受け取る(節が欠けたら受け付けない)。
 *   v2 では冒頭の「要点サマリー」「精度を上げるために必要な情報」「図表データ」「前回からの変化」を追加で受け取る。
 *   v3(要望23/24/25)では要点を「事実→解釈→次のアクション」の3段に固定し、図は図表カタログの id と説明文だけを受け取る
 *   (数値はアプリが計算し、保存時にスナップショットとして本文へ同梱する)。節ごとの最低件数・文字数もここで検査する。
 * - 本文はプレーンテキスト(改行・箇条書きのみ)。HTMLタグ・制御文字は保存前に落とす。
 */
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

export const reportInputSchema = z.object({
  generatedBy: textField(60).min(1),
  model: textField(120).nullable().optional(),
  title: textField(120).nullable().optional(),
  summary: textField(TEXT_LIMITS.summary.max).min(TEXT_LIMITS.summary.min),
  keyFindings: keyFindingsSchema,
  sections: z
    .array(sectionSchema)
    .min(SECTION_IDS.length)
    .max(SECTION_IDS.length * 2),
  followUp: followUpSchema.nullable().optional(),
  needs: z.array(needSchema).max(30).optional(),
  charts: z
    .array(chartRefSchema)
    .max(CHART_CATALOG.length * 2)
    .optional(),
  dataGaps: z.array(textField(500)).max(40).optional(),
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
export interface AiReportBody {
  version: 3;
  generatedBy: string;
  model: string | null;
  title: string;
  summary: string;
  keyFindings: ReportKeyFindings;
  sections: ReportSection[];
  followUp: { body: string; items: ReportItem[] } | null;
  needs: ReportNeed[];
  charts: ReportChart[];
  dataGaps: string[];
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
      version: 3,
      generatedBy: sanitizeText(input.generatedBy) || 'unknown',
      model: input.model ? sanitizeText(input.model) || null : null,
      title: sanitizeText(input.title ?? '') || `${periodLabel(period)}の会計分析`,
      summary: sanitizeText(input.summary),
      keyFindings,
      sections,
      followUp: input.followUp
        ? { body: sanitizeText(input.followUp.body), items: normItems(input.followUp.items) }
        : null,
      needs,
      charts: storedCharts,
      dataGaps: (input.dataGaps ?? []).map(sanitizeText).filter((g) => g.length > 0),
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

/** 保存済みの本文(v1 / v2 も含む)を v3 の形に揃えて返す。画面はこの形だけを扱う */
export function upgradeBody(raw: unknown): AiReportBody {
  const b = (raw ?? {}) as Record<string, unknown> & { version?: number };
  const kf = (b.keyFindings ?? {}) as Record<string, unknown>;
  const isV3 = b.version === 3;
  const findings = (k: string): ReportFinding[] => {
    const arr = (kf[k] ?? []) as (LegacyItem | ReportFinding)[];
    return isV3 ? (arr as ReportFinding[]) : (arr as LegacyItem[]).map(legacyFinding);
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
    version: 3,
    generatedBy: (b.generatedBy as string) ?? 'unknown',
    model: (b.model as string | null) ?? null,
    title: (b.title as string) ?? '',
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
    charts: isV3 ? (chartsRaw as ReportChart[]) : (chartsRaw as LegacyChart[]).map(legacyChart),
    dataGaps: (b.dataGaps as string[]) ?? [],
  };
}

/* -------- 貼り付け用の指示文 -------- */

export const SKILL_NAME = 'run-kanjo-accounting-report';

export function buildPrompt(p: {
  origin: string;
  taskId: string;
  token: string;
  period: Period;
  expiresAt: string;
  supplement?: string | null;
  parentReportId?: string | null;
}): string {
  const exp = new Date(p.expiresAt);
  const expText = `${exp.getUTCFullYear()}-${String(exp.getUTCMonth() + 1).padStart(2, '0')}-${String(exp.getUTCDate()).padStart(2, '0')} ${String(exp.getUTCHours()).padStart(2, '0')}:${String(exp.getUTCMinutes()).padStart(2, '0')} UTC`;
  const type = reportTypeOf(p.period);
  const lines = [
    `このリポジトリの Skill「${SKILL_NAME}」を読み、その手順どおりに会計分析レポートを作成して送信してください。`,
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
      '利用者からの補足情報(数字の根拠として使ってよいが、データと矛盾する場合はデータを優先し、その旨を書く):',
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
    '- 送信が 201 で受け付けられたら、返ってきた reportId を表示して終了する。',
  );
  return lines.join('\n');
}
