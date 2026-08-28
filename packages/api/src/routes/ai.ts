import { zValidator } from '@hono/zod-validator';
import { subsCandidates } from '@kanjo/core';
/**
 * AI分析レポート(spec-v1.1 §16)。
 *  - aiRoute      : ログイン済みの画面から使う(依頼の発行、レポート一覧・詳細)
 *  - aiAgentRoute : Claude Code / Codex が使う(データ取得・結果送信)。
 *                   セッションではなく、依頼ごとの使い捨てトークン(Bearer)で認証する。
 * トークンは原文を保存せず SHA-256 で照合する。期限切れ・使用済みは 401。
 */
import { and, count, desc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import {
  type AiReportBody,
  type Period,
  type ReportInput,
  type ReportType,
  buildPrompt,
  normalizeReport,
  periodLabel,
  reportInputSchema,
  reportTypeOf,
  taskCreateSchema,
  upgradeBody,
} from '../ai/contract.js';
import { type PreviousReportSummary, buildAgentData } from '../ai/dataset.js';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { runtimeSchemaGuard } from '../schema-guard.js';
import { dealFromRow, getDb, loadDataset, loadSubVendorExclusions, loadSubVendors } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };
type AgentCtx = { Bindings: AuthEnv; Variables: { userId: string; task: typeof s.aiTasks.$inferSelect } };

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24時間
const TOKEN_PREFIX = 'kjo_';

// レポートJSONの形の誤りは、AI/貼り付けた人が直せるように「どこが・なぜ」を日本語で返す
const reportValidator = zValidator('json', reportInputSchema, (result, c) => {
  if (result.success) return;
  const issues = result.error.issues
    .slice(0, 20)
    .map((i) => ({ path: i.path.join('.'), message: i.message }));
  return c.json(
    {
      error: {
        code: 'invalid_report',
        message: `レポートJSONの形が違います(${issues.length}箇所)。references/report-schema.md の形に直して再送してください`,
        issues,
      },
    },
    400,
  );
});

const b64url = (b: Uint8Array): string =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

function taskStatus(t: typeof s.aiTasks.$inferSelect): 'done' | 'expired' | 'waiting' {
  if (t.usedAt) return 'done';
  if (Date.parse(t.expiresAt) < Date.now()) return 'expired';
  return 'waiting';
}

const periodOf = (t: { periodFrom: string; periodTo: string }): Period => ({
  from: t.periodFrom,
  to: t.periodTo,
});

const taskView = (t: typeof s.aiTasks.$inferSelect) => ({
  id: t.id,
  period: periodOf(t),
  type: t.reportType as ReportType,
  label: periodLabel(periodOf(t)),
  supplement: t.supplement ?? null,
  parentReportId: t.parentReportId ?? null,
  expiresAt: t.expiresAt,
  createdAt: t.createdAt,
  copiedAt: t.copiedAt ?? null,
  copiedTarget: t.copiedTarget ?? null,
  reportId: t.reportId,
  status: taskStatus(t),
});

const reportView = (r: typeof s.aiReports.$inferSelect) => ({
  id: r.id,
  taskId: r.taskId,
  period: periodOf(r),
  type: r.reportType as ReportType,
  label: periodLabel(periodOf(r)),
  version: r.version,
  parentReportId: r.parentReportId ?? null,
  generatedBy: r.generatedBy,
  title: r.title,
  summary: r.summary,
  createdAt: r.createdAt,
  /** アーカイブした日時。null = 通常表示 */
  archivedAt: r.archivedAt ?? null,
});

/** 前回レポート(同じ型)を LLM に渡す要約。本文全部は渡さず、指摘と対策だけ */
function previousSummary(r: typeof s.aiReports.$inferSelect): PreviousReportSummary {
  const body = upgradeBody(JSON.parse(r.bodyJson));
  const texts = (items: { label: string; note: string }[] | undefined) =>
    (items ?? []).map((i) => (i.note ? `${i.label}: ${i.note}` : i.label));
  // 要点は「事実 → 解釈 → 次のアクション」を1行に畳む(前回指摘の追跡に使う)
  const findings = (items: { label: string; fact: string; action: string }[]) =>
    items.map((f) => [f.label, f.fact, f.action].filter(Boolean).join(' / '));
  return {
    id: r.id,
    version: r.version,
    createdAt: r.createdAt,
    period: periodOf(r),
    title: r.title,
    summary: r.summary,
    keyFindings: {
      improvements: findings(body.keyFindings.improvements),
      wasted: findings(body.keyFindings.wasted),
      quickWins: findings(body.keyFindings.quickWins),
    },
    reductionItems: texts(body.sections.find((x) => x.id === 'reduction')?.items),
    needs: body.needs.map((n) => n.gap),
  };
}

/** 同じ型のレポートのうち、直近2件(自分自身を除く)。再分析なら親レポートを必ず含める */
async function loadPreviousReports(
  db: ReturnType<typeof getDb>,
  task: typeof s.aiTasks.$inferSelect,
): Promise<PreviousReportSummary[]> {
  const rows = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, task.userId), eq(s.aiReports.reportType, task.reportType)))
    .orderBy(desc(s.aiReports.createdAt))
    .limit(2);
  const list = rows.map(previousSummary);
  if (task.parentReportId && !list.some((r) => r.id === task.parentReportId)) {
    const parent = await db
      .select()
      .from(s.aiReports)
      .where(and(eq(s.aiReports.userId, task.userId), eq(s.aiReports.id, task.parentReportId)))
      .get();
    if (parent) list.unshift(previousSummary(parent));
  }
  return list;
}

async function agentPayload(db: ReturnType<typeof getDb>, task: typeof s.aiTasks.$inferSelect) {
  const data = await loadDataset(db, task.userId);
  if (data.months.length === 0) return null;
  const [previousReports, vendors, excluded, dealRows, analysis] = await Promise.all([
    loadPreviousReports(db, task),
    loadSubVendors(db, task.userId),
    loadSubVendorExclusions(db, task.userId),
    db.select().from(s.freeeDeals).where(eq(s.freeeDeals.userId, task.userId)),
    db.select().from(s.analysisSettings).where(eq(s.analysisSettings.userId, task.userId)),
  ]);
  // 「サブスクではない」と記録済みの支払先は、AIへの指示文でも候補に挙げない
  const candidates = subsCandidates(
    dealRows.map(dealFromRow),
    vendors,
    10,
    excluded.map((e) => e.partner),
  );
  return buildAgentData(data, periodOf(task), {
    previousReports,
    supplement: task.supplement,
    candidates,
    // 設定画面で変えられる統計の基準月数(行が無ければ既定の6ヶ月)
    statMinMonths: analysis[0]?.statMinMonths,
  });
}

/* ======== 画面用(セッション認証は index.ts の authGuard が担う) ======== */

export const aiRoute = new Hono<Ctx>();

aiRoute.post('/ai/tasks', zValidator('json', taskCreateSchema), async (c) => {
  const { from, to, supplement, parentReportId } = c.req.valid('json');
  const period: Period = { from, to };
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  if (parentReportId) {
    const parent = await db
      .select({ id: s.aiReports.id })
      .from(s.aiReports)
      .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, parentReportId)))
      .get();
    if (!parent)
      return c.json(
        { error: { code: 'not_found', message: '再分析の元になるレポートが見つかりません' } },
        404,
      );
  }
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = TOKEN_PREFIX + b64url(raw);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await db.insert(s.aiTasks).values({
    id,
    userId,
    periodFrom: from,
    periodTo: to,
    reportType: reportTypeOf(period),
    supplement: supplement?.trim() || null,
    parentReportId: parentReportId ?? null,
    tokenHash: await sha256Hex(token),
    expiresAt,
  });
  const origin = new URL(c.req.url).origin;
  const prompt = buildPrompt({
    origin,
    taskId: id,
    token,
    period,
    expiresAt,
    supplement: supplement?.trim() || null,
    parentReportId: parentReportId ?? null,
  });
  const row = (await db
    .select()
    .from(s.aiTasks)
    .where(eq(s.aiTasks.id, id))
    .get()) as typeof s.aiTasks.$inferSelect;
  return c.json({ task: taskView(row), prompt }, 201);
});

aiRoute.get('/ai/tasks', async (c) => {
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.aiTasks)
    .where(eq(s.aiTasks.userId, c.get('userId')))
    .orderBy(desc(s.aiTasks.createdAt))
    .limit(20);
  return c.json({ tasks: rows.map(taskView) });
});

aiRoute.get('/ai/reports', async (c) => {
  const db = getDb(c.env.DB);
  const type = c.req.query('type');
  const from = c.req.query('from');
  const to = c.req.query('to');
  // 既定ではアーカイブ済みを隠す(?archived=1 で一緒に返す)
  const withArchived = c.req.query('archived') === '1';
  // 絞り込みを LIMIT より前に行い、古い一致行も一覧上限の母集団へ含める。
  const population = and(
    eq(s.aiReports.userId, c.get('userId')),
    type ? eq(s.aiReports.reportType, type as ReportType) : undefined,
    from ? gte(s.aiReports.periodTo, from) : undefined,
    to ? lte(s.aiReports.periodFrom, to) : undefined,
  );
  const [rows, archived] = await db.batch([
    db
      .select()
      .from(s.aiReports)
      .where(and(population, withArchived ? undefined : isNull(s.aiReports.archivedAt)))
      .orderBy(desc(s.aiReports.createdAt))
      .limit(200),
    // archivedCount は表示上限や archived=1 に依存せず、同じ型・期間母集団を数える。
    db
      .select({ value: count() })
      .from(s.aiReports)
      .where(and(population, isNotNull(s.aiReports.archivedAt))),
  ]);
  return c.json({
    reports: rows.map(reportView),
    archivedCount: archived[0]?.value ?? 0,
  });
});

aiRoute.get('/ai/reports/:id', async (c) => {
  const db = getDb(c.env.DB);
  const row = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, c.get('userId')), eq(s.aiReports.id, c.req.param('id'))))
    .get();
  if (!row) return c.json({ error: { code: 'not_found', message: 'レポートが見つかりません' } }, 404);
  const body: AiReportBody = upgradeBody(JSON.parse(row.bodyJson));
  const sameType = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, row.userId), eq(s.aiReports.reportType, row.reportType)))
    .orderBy(desc(s.aiReports.createdAt))
    .limit(100);
  // 前回: 同じ型でこれより前に作られた直近のレポート
  const previous = sameType.find((p) => p.id !== row.id && p.createdAt < row.createdAt) ?? null;
  // 版履歴: 同じ期間のレポート(再分析で増える)。古い順
  const versions = sameType
    .filter((p) => p.periodFrom === row.periodFrom && p.periodTo === row.periodTo)
    .sort((a, b) => a.version - b.version)
    .map(reportView);
  return c.json({
    report: { ...reportView(row), body },
    previous: previous ? reportView(previous) : null,
    versions,
  });
});

/**
 * アーカイブの切り替え(本文は消さずに一覧から外す)。
 * 削除と違って元に戻せるので、確認は挟まない。
 */
aiRoute.put('/ai/reports/:id/archive', zValidator('json', z.object({ archived: z.boolean() })), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const row = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, id)))
    .get();
  if (!row) return c.json({ error: { code: 'not_found', message: 'レポートが見つかりません' } }, 404);
  const archivedAt = c.req.valid('json').archived ? new Date().toISOString() : null;
  await db
    .update(s.aiReports)
    .set({ archivedAt })
    .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, id)));
  return c.json({ ok: true, archivedAt });
});

/**
 * レポートの削除。本文ごと消えて元に戻せないので、画面側で確認を挟んでから呼ぶ。
 * 発行元の依頼(ai_tasks)からの参照は外し、依頼の履歴自体は残す(いつ何を依頼したかは追えるようにする)。
 */
aiRoute.delete('/ai/reports/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const row = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, id)))
    .get();
  if (!row) return c.json({ error: { code: 'not_found', message: 'レポートが見つかりません' } }, 404);
  await db.batch([
    db
      .update(s.aiTasks)
      .set({ reportId: null })
      .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.reportId, id))),
    db
      .update(s.aiTasks)
      .set({ parentReportId: null })
      .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.parentReportId, id))),
    // 再分析の親として参照している後続レポートは、親を失っても本文は読めるので参照だけ外す
    db
      .update(s.aiReports)
      .set({ parentReportId: null })
      .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.parentReportId, id))),
    db.delete(s.aiReports).where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, id))),
  ]);
  return c.json({ ok: true });
});

/**
 * 結果待ちの依頼の取り消し。まだ結果を受け取っていない依頼だけ消せる。
 * 受信済み(usedAt あり)の依頼はレポートの出所なので消さない。
 */
aiRoute.delete('/ai/tasks/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const task = await db
    .select()
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.id, id)))
    .get();
  if (!task) return c.json({ error: { code: 'not_found', message: '依頼が見つかりません' } }, 404);
  if (taskStatus(task) === 'done')
    return c.json(
      {
        code: 'already_done',
        error: {
          code: 'already_done',
          message: 'この依頼はすでに結果を受け取っています。取り消せるのは結果待ちの依頼だけです',
        },
      },
      409,
    );
  // 結果受信との競合で used_at が入った依頼を消さないよう、削除自体をCASにする。
  const deleted = await db
    .delete(s.aiTasks)
    .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.id, id), isNull(s.aiTasks.usedAt)))
    .run();
  if (deleted.meta.changes) return c.json({ ok: true });
  return c.json(
    {
      code: 'already_done',
      error: {
        code: 'already_done',
        message: 'この依頼はすでに結果を受け取っています。取り消せるのは結果待ちの依頼だけです',
      },
    },
    409,
  );
});

// ネットワークが使えない環境向け: 画面からデータJSONを見る(セッション認証。トークンは不要)
aiRoute.get('/ai/tasks/:id/dataset', async (c) => {
  const db = getDb(c.env.DB);
  const task = await db
    .select()
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.userId, c.get('userId')), eq(s.aiTasks.id, c.req.param('id'))))
    .get();
  if (!task) return c.json({ error: { code: 'not_found', message: '依頼が見つかりません' } }, 404);
  const payload = await agentPayload(db, task);
  if (!payload) return c.json({ error: { code: 'no_data', message: '取込済みデータがありません' } }, 404);
  return c.json(payload);
});

// ネットワークが使えない環境向け: 画面から結果JSONを貼り付けて保存する(セッション認証)
aiRoute.post('/ai/tasks/:id/paste', reportValidator, async (c) => {
  const db = getDb(c.env.DB);
  const task = await db
    .select()
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.userId, c.get('userId')), eq(s.aiTasks.id, c.req.param('id'))))
    .get();
  if (!task) return c.json({ error: { code: 'not_found', message: '依頼が見つかりません' } }, 404);
  if (task.usedAt)
    return c.json({ error: { code: 'already_done', message: 'この依頼は結果を受信済みです' } }, 409);
  const r = await storeReport(db, task, c.req.valid('json'));
  if (!r.ok) return c.json({ error: r.error }, r.status);
  return c.json({ ok: true, reportId: r.reportId }, 201);
});

/* ======== エージェント用(使い捨てトークン認証) ======== */

export const aiAgentRoute = new Hono<AgentCtx>();

const agentGuard: MiddlewareHandler<AgentCtx, '/ai/tasks/:id/data' | '/ai/tasks/:id/report'> = async (
  c,
  next,
) => {
  const auth = c.req.header('Authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  const unauthorized = (message: string) => c.json({ error: { code: 'unauthorized', message } }, 401);
  if (!m || !m[1].startsWith(TOKEN_PREFIX)) return unauthorized('Authorization: Bearer <token> が必要です');
  const db = getDb(c.env.DB);
  const task = await db
    .select()
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.tokenHash, await sha256Hex(m[1])), eq(s.aiTasks.id, c.req.param('id'))))
    .get();
  if (!task) return unauthorized('トークンが無効です');
  const status = taskStatus(task);
  if (status === 'expired')
    return unauthorized('トークンの有効期限が切れています。アプリで指示文を作り直してください');
  if (status === 'done')
    return unauthorized('この依頼は結果を受信済みです。アプリで指示文を作り直してください');
  c.set('userId', task.userId);
  c.set('task', task);
  await next();
};
aiAgentRoute.use('/ai/tasks/:id/data', agentGuard);
aiAgentRoute.use('/ai/tasks/:id/report', agentGuard);
// token検証はD1に保存したtaskで行い、schema検査はその認証後・payload/reportの業務D1前に置く。
aiAgentRoute.use('/ai/tasks/:id/data', runtimeSchemaGuard);
aiAgentRoute.use('/ai/tasks/:id/report', runtimeSchemaGuard);

aiAgentRoute.get('/ai/tasks/:id/data', async (c) => {
  const payload = await agentPayload(getDb(c.env.DB), c.get('task'));
  if (!payload) return c.json({ error: { code: 'no_data', message: '取込済みデータがありません' } }, 404);
  return c.json(payload);
});

aiAgentRoute.post('/ai/tasks/:id/report', reportValidator, async (c) => {
  const r = await storeReport(getDb(c.env.DB), c.get('task'), c.req.valid('json'));
  if (!r.ok) return c.json({ error: r.error }, r.status);
  return c.json(
    { ok: true, reportId: r.reportId, message: 'レポートを受け付けました。アプリの「AI分析」で確認できます' },
    201,
  );
});

/* ======== 共通: レポートの検証・保存(使い捨ての確定を含む) ======== */

async function storeReport(
  db: ReturnType<typeof getDb>,
  task: typeof s.aiTasks.$inferSelect,
  input: ReportInput,
): Promise<
  | { ok: true; reportId: string }
  | {
      ok: false;
      status: 400 | 401;
      error: { code: string; message: string; missing?: string[]; issues?: string[] };
    }
> {
  // 図の数値は GET data と同じ計算をここでやり直し、レポートにスナップショットとして同梱する(要望25b)
  const payload = await agentPayload(db, task);
  if (!payload) {
    return { ok: false, status: 400, error: { code: 'no_data', message: '取込済みデータがありません' } };
  }
  const normalized = normalizeReport(input, periodOf(task), payload.charts);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      error: {
        code: normalized.code,
        message:
          normalized.code === 'missing_sections'
            ? `必須の節が不足しています: ${normalized.missing.join(', ')}`
            : `レポートの内容が規則を満たしていません(${normalized.issues.length}箇所)。issues を直して再送してください`,
        missing: normalized.missing,
        issues: normalized.issues,
      },
    };
  }
  const reportId = crypto.randomUUID();
  // 使い捨て: used_at が NULL の行だけを更新し、更新できなければ二重送信として拒否する
  const claimed = await db
    .update(s.aiTasks)
    .set({ usedAt: new Date().toISOString(), reportId })
    .where(and(eq(s.aiTasks.id, task.id), isNull(s.aiTasks.usedAt)))
    .run();
  if (!claimed.meta.changes) {
    return {
      ok: false,
      status: 401,
      error: { code: 'unauthorized', message: 'この依頼は結果を受信済みです' },
    };
  }
  const body = normalized.body;
  // 同じ期間の既存レポート数 + 1 を版番号にする(再分析でなくても同じ期間なら版が進む)
  const siblings = await db
    .select({ version: s.aiReports.version })
    .from(s.aiReports)
    .where(
      and(
        eq(s.aiReports.userId, task.userId),
        eq(s.aiReports.periodFrom, task.periodFrom),
        eq(s.aiReports.periodTo, task.periodTo),
      ),
    );
  const version = siblings.reduce((m, r) => Math.max(m, r.version), 0) + 1;
  await db.insert(s.aiReports).values({
    id: reportId,
    userId: task.userId,
    taskId: task.id,
    periodFrom: task.periodFrom,
    periodTo: task.periodTo,
    reportType: task.reportType,
    version,
    parentReportId: task.parentReportId ?? null,
    generatedBy: body.generatedBy,
    title: body.title,
    summary: body.summary,
    bodyJson: JSON.stringify(body),
  });
  return { ok: true, reportId };
}

/** 指示文をコピーした事実の記録。作っただけの依頼と、渡したのに返ってこない依頼を見分ける */
const copySchema = z.object({ target: z.enum(['claude_code', 'codex']) });

aiRoute.post('/ai/tasks/:id/copied', zValidator('json', copySchema), async (c) => {
  const db = getDb(c.env.DB);
  const copiedAt = new Date().toISOString();
  const updated = await db
    .update(s.aiTasks)
    .set({ copiedAt, copiedTarget: c.req.valid('json').target })
    .where(and(eq(s.aiTasks.userId, c.get('userId')), eq(s.aiTasks.id, c.req.param('id'))))
    .returning({ id: s.aiTasks.id });
  if (!updated.length) return c.json({ error: { code: 'not_found', message: 'その依頼はありません' } }, 404);
  return c.json({ ok: true, copiedAt });
});
