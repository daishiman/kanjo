/**
 * AI分析レポートの契約(spec-v1.1 §16)。
 * - 期間は「開始年月〜終了年月」の1組で表す(月次1ヶ月 / 年次〜13ヶ月 / 長期14ヶ月以上)。
 * - 貼り付け用指示文、受信レポートの検証と無害化をここに集約する。
 * - レポートは毎回同じ5節で受け取る(節が欠けたら受け付けない)。
 *   v2 では冒頭の「要点サマリー」「精度を上げるために必要な情報」「図表データ」「前回からの変化」を追加で受け取る。
 * - 本文はプレーンテキスト(改行・箇条書きのみ)。HTMLタグ・制御文字は保存前に落とす。
 */
import { z } from 'zod';

/* -------- 期間 -------- */

/** レポートの型。期間の長さから機械的に決まる(利用者に選ばせない) */
export type ReportType = 'monthly' | 'annual' | 'longterm';

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  monthly: '月次',
  annual: '年次',
  longterm: '長期',
};

/** 1画面の説明文に使う、型の決まり方 */
export const REPORT_TYPE_RULE = '1ヶ月=月次 / 2〜13ヶ月=年次(四半期を含む) / 14ヶ月以上=長期';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** 受け付ける最長期間(月数)。過去5年+当月 */
export const MAX_RANGE_MONTHS = 61;

export interface Period {
  from: string;
  to: string;
}

/** YYYY-MM の通し番号(月差の計算用) */
export const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
export const monthFromIndex = (i: number): string =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const addMonths = (m: string, n: number): string => monthFromIndex(monthIndex(m) + n);

export function rangeMonths(p: Period): string[] {
  const out: string[] = [];
  for (let i = monthIndex(p.from); i <= monthIndex(p.to); i++) out.push(monthFromIndex(i));
  return out;
}

export function rangeLength(p: Period): number {
  return monthIndex(p.to) - monthIndex(p.from) + 1;
}

export function reportTypeOf(p: Period): ReportType {
  const n = rangeLength(p);
  if (n <= 1) return 'monthly';
  if (n <= 13) return 'annual';
  return 'longterm';
}

export const periodSchema = z
  .object({
    from: z.string().regex(MONTH_RE, '開始年月は YYYY-MM で指定してください'),
    to: z.string().regex(MONTH_RE, '終了年月は YYYY-MM で指定してください'),
  })
  .refine((p) => monthIndex(p.from) <= monthIndex(p.to), {
    message: '開始年月が終了年月より後になっています',
  })
  .refine((p) => rangeLength(p) <= MAX_RANGE_MONTHS, {
    message: `期間は最長${MAX_RANGE_MONTHS}ヶ月(過去5年+当月)までです`,
  });

/** 依頼の作成(期間 + 任意の補足情報 + 再分析元のレポート) */
export const taskCreateSchema = periodSchema.and(
  z.object({
    supplement: z.string().max(4000).optional(),
    parentReportId: z.string().max(64).optional(),
  }),
);

const monthJa = (m: string): string => `${m.slice(0, 4)}年${Number(m.slice(5, 7))}月`;

export function periodLabel(p: Period): string {
  const n = rangeLength(p);
  const type = REPORT_TYPE_LABEL[reportTypeOf(p)];
  if (n === 1) return `${monthJa(p.from)}(${type})`;
  return `${monthJa(p.from)}〜${monthJa(p.to)}(${n}ヶ月・${type})`;
}

/**
 * 旧データ(period_kind=month/year, period_key)から期間を復元する。
 * マイグレーション 0004 で列は埋めるが、念のため画面側でも同じ規則で解釈できるようにしておく。
 */
export function legacyPeriod(kind: string, key: string): Period {
  if (kind === 'year') return { from: `${key}-01`, to: `${key}-12` };
  return { from: key, to: key };
}

/* -------- 受信レポートの検証 -------- */

const textField = (max: number) => z.string().max(max);

const itemSchema = z.object({
  label: textField(200).min(1),
  amount: z.number().int().safe().nullable().optional(),
  note: textField(1000).optional(),
  priority: z.enum(['high', 'mid', 'low']).nullable().optional(),
});

export const SECTION_IDS = ['spend', 'change', 'reduction', 'split', 'subscriptions'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABEL: Record<SectionId, string> = {
  spend: '何にいくらかかっているか',
  change: '前年・前月との増減と要因',
  reduction: '削減余地と根拠・優先順位',
  split: '事業/個人・本人/妻の別',
  subscriptions: 'サブスクの整理候補',
};

const sectionSchema = z.object({
  id: z.enum(SECTION_IDS),
  title: textField(120).optional(),
  body: textField(12000),
  items: z.array(itemSchema).max(60).optional(),
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

export const CHART_KINDS = ['bar', 'line', 'stackedBar'] as const;
export const CHART_UNITS = ['yen', 'pct', 'count'] as const;
const chartSchema = z.object({
  id: textField(40).min(1),
  kind: z.enum(CHART_KINDS),
  title: textField(120).min(1),
  unit: z.enum(CHART_UNITS).optional(),
  labels: z.array(textField(40)).min(1).max(72),
  series: z
    .array(
      z.object({
        label: textField(60).min(1),
        data: z.array(z.number().finite().nullable()).min(1).max(72),
      }),
    )
    .min(1)
    .max(8),
  note: textField(300).optional(),
});

const keyFindingsSchema = z.object({
  improvements: z.array(itemSchema).max(10).optional(),
  wasted: z.array(itemSchema).max(10).optional(),
  quickWins: z.array(itemSchema).max(10).optional(),
});

const followUpSchema = z.object({
  body: textField(6000),
  items: z.array(itemSchema).max(30).optional(),
});

export const reportInputSchema = z.object({
  generatedBy: textField(60).min(1),
  model: textField(120).nullable().optional(),
  title: textField(120).optional(),
  summary: textField(3000).min(1),
  keyFindings: keyFindingsSchema.optional(),
  sections: z
    .array(sectionSchema)
    .min(SECTION_IDS.length)
    .max(SECTION_IDS.length * 2),
  followUp: followUpSchema.nullable().optional(),
  needs: z.array(needSchema).max(30).optional(),
  charts: z.array(chartSchema).max(6).optional(),
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
export interface ReportNeed {
  gap: string;
  action: string;
  screen: NeedScreen | null;
}
export interface ReportChart {
  id: string;
  kind: (typeof CHART_KINDS)[number];
  title: string;
  unit: (typeof CHART_UNITS)[number];
  labels: string[];
  series: { label: string; data: (number | null)[] }[];
  note: string;
}
export interface ReportKeyFindings {
  improvements: ReportItem[];
  wasted: ReportItem[];
  quickWins: ReportItem[];
}
export interface AiReportBody {
  version: 2;
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

/** 5節が揃っているかを確認し、既定の順序に並べ替えて無害化する。欠けた節名を返す */
export function normalizeReport(
  input: ReportInput,
  period: Period,
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
      items: normItems(sec.items),
    };
  });
  const screens = new Set<string>(NEED_SCREENS);
  const needs: ReportNeed[] = (input.needs ?? []).map((n) => ({
    gap: sanitizeText(n.gap),
    action: sanitizeText(n.action),
    screen: n.screen && screens.has(n.screen) ? (n.screen as NeedScreen) : null,
  }));
  const charts: ReportChart[] = (input.charts ?? [])
    .map((ch) => ({
      id: sanitizeText(ch.id),
      kind: ch.kind,
      title: sanitizeText(ch.title),
      unit: ch.unit ?? 'yen',
      labels: ch.labels.map(sanitizeText),
      // 系列の長さはラベル数に揃える(足りない分は null、余りは捨てる)
      series: ch.series.map((sr) => ({
        label: sanitizeText(sr.label),
        data: ch.labels.map((_, i) => (typeof sr.data[i] === 'number' ? (sr.data[i] as number) : null)),
      })),
      note: sanitizeText(ch.note ?? ''),
    }))
    .filter((ch) => ch.id && ch.title);
  return {
    ok: true,
    body: {
      version: 2,
      generatedBy: sanitizeText(input.generatedBy) || 'unknown',
      model: input.model ? sanitizeText(input.model) || null : null,
      title: sanitizeText(input.title ?? '') || `${periodLabel(period)}の会計分析`,
      summary: sanitizeText(input.summary),
      keyFindings: {
        improvements: normItems(input.keyFindings?.improvements),
        wasted: normItems(input.keyFindings?.wasted),
        quickWins: normItems(input.keyFindings?.quickWins),
      },
      sections,
      followUp: input.followUp
        ? { body: sanitizeText(input.followUp.body), items: normItems(input.followUp.items) }
        : null,
      needs,
      charts,
      dataGaps: (input.dataGaps ?? []).map(sanitizeText).filter((g) => g.length > 0),
    },
  };
}

/** 保存済みの本文(v1 も含む)を v2 の形に揃えて返す。画面はこの形だけを扱う */
export function upgradeBody(raw: unknown): AiReportBody {
  const b = (raw ?? {}) as Partial<AiReportBody> & { version?: number };
  return {
    version: 2,
    generatedBy: b.generatedBy ?? 'unknown',
    model: b.model ?? null,
    title: b.title ?? '',
    summary: b.summary ?? '',
    keyFindings: {
      improvements: b.keyFindings?.improvements ?? [],
      wasted: b.keyFindings?.wasted ?? [],
      quickWins: b.keyFindings?.quickWins ?? [],
    },
    sections: b.sections ?? [],
    followUp: b.followUp ?? null,
    needs: b.needs ?? [],
    charts: b.charts ?? [],
    dataGaps: b.dataGaps ?? [],
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
    '- レポートは Skill が定める5節(spend / change / reduction / split / subscriptions)を必ず全て含め、冒頭の keyFindings(改善すべき点・無駄なコスト・すぐ効く対策)と charts(図表データ)も付ける。',
    '- 本文はプレーンテキスト(HTMLやMarkdownの表は使わない)。専門用語は括弧で言い換える。',
    '- 送信が 201 で受け付けられたら、返ってきた reportId を表示して終了する。',
  );
  return lines.join('\n');
}
