/**
 * AI分析レポートの契約(spec-v1.1 §16)。
 * - 期間の表記、貼り付け用指示文、受信レポートの検証と無害化をここに集約する。
 * - レポートは毎回同じ5節で受け取る(節が欠けたら受け付けない)。
 * - 本文はプレーンテキスト(改行・箇条書きのみ)。HTMLタグ・制御文字は保存前に落とす。
 */
import { z } from 'zod';

export type PeriodKind = 'month' | 'year';

export const SECTION_IDS = ['spend', 'change', 'reduction', 'split', 'subscriptions'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABEL: Record<SectionId, string> = {
  spend: '何にいくらかかっているか',
  change: '前年・前月との増減と要因',
  reduction: '削減余地と根拠・優先順位',
  split: '事業/個人・本人/妻の別',
  subscriptions: 'サブスクの整理候補',
};

const PERIOD_RE: Record<PeriodKind, RegExp> = { month: /^\d{4}-(0[1-9]|1[0-2])$/, year: /^\d{4}$/ };

export const periodSchema = z
  .object({ kind: z.enum(['month', 'year']), key: z.string().min(4).max(7) })
  .refine((p) => PERIOD_RE[p.kind].test(p.key), { message: '期間の形式が不正です(YYYY-MM または YYYY)' });

export function periodLabel(kind: PeriodKind, key: string): string {
  if (kind === 'year') return `${key}年(年間)`;
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月(月次)`;
}

/* -------- 受信レポートの検証 -------- */

const textField = (max: number) => z.string().max(max);

const itemSchema = z.object({
  label: textField(200).min(1),
  amount: z.number().int().safe().nullable().optional(),
  note: textField(1000).optional(),
  priority: z.enum(['high', 'mid', 'low']).nullable().optional(),
});

const sectionSchema = z.object({
  id: z.enum(SECTION_IDS),
  title: textField(120).optional(),
  body: textField(12000),
  items: z.array(itemSchema).max(60).optional(),
});

export const reportInputSchema = z.object({
  generatedBy: textField(60).min(1),
  model: textField(120).nullable().optional(),
  title: textField(120).optional(),
  summary: textField(3000).min(1),
  sections: z
    .array(sectionSchema)
    .min(SECTION_IDS.length)
    .max(SECTION_IDS.length * 2),
  dataGaps: z.array(textField(500)).max(40).optional(),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

export interface ReportItem {
  label: string;
  amount: number | null;
  note: string;
  priority: 'high' | 'mid' | 'low' | null;
}
export interface ReportSection {
  id: SectionId;
  title: string;
  body: string;
  items: ReportItem[];
}
export interface AiReportBody {
  version: 1;
  generatedBy: string;
  model: string | null;
  title: string;
  summary: string;
  sections: ReportSection[];
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

/** 5節が揃っているかを確認し、既定の順序に並べ替えて無害化する。欠けた節名を返す */
export function normalizeReport(
  input: ReportInput,
  period: { kind: PeriodKind; key: string },
): { ok: true; body: AiReportBody } | { ok: false; missing: SectionId[] } {
  const byId = new Map<SectionId, (typeof input.sections)[number]>();
  for (const sec of input.sections) if (!byId.has(sec.id)) byId.set(sec.id, sec);
  const missing = SECTION_IDS.filter((id) => !byId.has(id));
  if (missing.length) return { ok: false, missing };
  const sections: ReportSection[] = SECTION_IDS.map((id) => {
    const sec = byId.get(id) as (typeof input.sections)[number];
    return {
      id,
      title: sanitizeText(sec.title || '') || SECTION_LABEL[id],
      body: sanitizeText(sec.body),
      items: (sec.items ?? []).map((it) => ({
        label: sanitizeText(it.label),
        amount: typeof it.amount === 'number' ? it.amount : null,
        note: sanitizeText(it.note ?? ''),
        priority: it.priority ?? null,
      })),
    };
  });
  return {
    ok: true,
    body: {
      version: 1,
      generatedBy: sanitizeText(input.generatedBy) || 'unknown',
      model: input.model ? sanitizeText(input.model) || null : null,
      title: sanitizeText(input.title ?? '') || `${periodLabel(period.kind, period.key)}の会計分析`,
      summary: sanitizeText(input.summary),
      sections,
      dataGaps: (input.dataGaps ?? []).map(sanitizeText).filter((g) => g.length > 0),
    },
  };
}

/* -------- 貼り付け用の指示文 -------- */

export const SKILL_NAME = 'kanjo-accounting-report';

export function buildPrompt(p: {
  origin: string;
  taskId: string;
  token: string;
  kind: PeriodKind;
  key: string;
  expiresAt: string;
}): string {
  const exp = new Date(p.expiresAt);
  const expText = `${exp.getUTCFullYear()}-${String(exp.getUTCMonth() + 1).padStart(2, '0')}-${String(exp.getUTCDate()).padStart(2, '0')} ${String(exp.getUTCHours()).padStart(2, '0')}:${String(exp.getUTCMinutes()).padStart(2, '0')} UTC`;
  return [
    `このリポジトリの Skill「${SKILL_NAME}」を読み、その手順どおりに会計分析レポートを作成して送信してください。`,
    '',
    `- 対象期間: ${periodLabel(p.kind, p.key)}`,
    `- データ取得(GET): ${p.origin}/api/ai/tasks/${p.taskId}/data`,
    `- 結果送信(POST): ${p.origin}/api/ai/tasks/${p.taskId}/report`,
    `- 認証ヘッダー: Authorization: Bearer ${p.token}`,
    `- 有効期限: ${expText}(結果送信は1回だけ受け付けます)`,
    '',
    '守ること:',
    '- 数字は取得したデータにある値だけを使う。推測で金額や科目を作らない。不足は「データ不足」と書く。',
    '- レポートは Skill が定める5節(spend / change / reduction / split / subscriptions)を必ず全て含める。',
    '- 本文はプレーンテキスト(HTMLやMarkdownの表は使わない)。',
    '- 送信が 201 で受け付けられたら、返ってきた reportId を表示して終了する。',
  ].join('\n');
}
