import { zValidator } from '@hono/zod-validator';
/**
 * AI分析レポート(spec-v1.1 §16)。
 *  - aiRoute      : ログイン済みの画面から使う(依頼の発行、レポート一覧・詳細)
 *  - aiAgentRoute : Claude Code / Codex が使う(データ取得・結果送信)。
 *                   セッションではなく、依頼ごとの使い捨てトークン(Bearer)で認証する。
 * トークンは原文を保存せず SHA-256 で照合する。期限切れ・使用済みは 401。
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import {
  type AiReportBody,
  type PeriodKind,
  type ReportInput,
  buildPrompt,
  normalizeReport,
  periodLabel,
  periodSchema,
  reportInputSchema,
} from '../ai/contract.js';
import { buildAgentData } from '../ai/dataset.js';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { getDb, loadDataset } from '../store.js';

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

const taskView = (t: typeof s.aiTasks.$inferSelect) => ({
  id: t.id,
  kind: t.periodKind as PeriodKind,
  key: t.periodKey,
  label: periodLabel(t.periodKind as PeriodKind, t.periodKey),
  expiresAt: t.expiresAt,
  createdAt: t.createdAt,
  reportId: t.reportId,
  status: taskStatus(t),
});

const reportView = (r: typeof s.aiReports.$inferSelect) => ({
  id: r.id,
  taskId: r.taskId,
  kind: r.periodKind as PeriodKind,
  key: r.periodKey,
  label: periodLabel(r.periodKind as PeriodKind, r.periodKey),
  generatedBy: r.generatedBy,
  title: r.title,
  summary: r.summary,
  createdAt: r.createdAt,
});

/* ======== 画面用(セッション認証は index.ts の authGuard が担う) ======== */

export const aiRoute = new Hono<Ctx>();

aiRoute.post('/ai/tasks', zValidator('json', periodSchema), async (c) => {
  const { kind, key } = c.req.valid('json');
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = TOKEN_PREFIX + b64url(raw);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  await db.insert(s.aiTasks).values({
    id,
    userId,
    periodKind: kind,
    periodKey: key,
    tokenHash: await sha256Hex(token),
    expiresAt,
  });
  const origin = new URL(c.req.url).origin;
  const prompt = buildPrompt({ origin, taskId: id, token, kind, key, expiresAt });
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
  const rows = await db
    .select()
    .from(s.aiReports)
    .where(eq(s.aiReports.userId, c.get('userId')))
    .orderBy(desc(s.aiReports.createdAt))
    .limit(100);
  return c.json({ reports: rows.map(reportView) });
});

aiRoute.get('/ai/reports/:id', async (c) => {
  const db = getDb(c.env.DB);
  const row = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, c.get('userId')), eq(s.aiReports.id, c.req.param('id'))))
    .get();
  if (!row) return c.json({ error: { code: 'not_found', message: 'レポートが見つかりません' } }, 404);
  const body = JSON.parse(row.bodyJson) as AiReportBody;
  // 同じ種類の期間で、これより前に作られた直近のレポート(比較用)
  const prev = await db
    .select()
    .from(s.aiReports)
    .where(and(eq(s.aiReports.userId, row.userId), eq(s.aiReports.periodKind, row.periodKind)))
    .orderBy(desc(s.aiReports.createdAt))
    .limit(50);
  const previous = prev.find((p) => p.id !== row.id && p.createdAt < row.createdAt) ?? null;
  return c.json({ report: { ...reportView(row), body }, previous: previous ? reportView(previous) : null });
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
  const data = await loadDataset(db, task.userId);
  if (data.months.length === 0)
    return c.json({ error: { code: 'no_data', message: '取込済みデータがありません' } }, 404);
  return c.json(buildAgentData(data, task.periodKind, task.periodKey));
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

aiAgentRoute.get('/ai/tasks/:id/data', async (c) => {
  const task = c.get('task');
  const data = await loadDataset(getDb(c.env.DB), task.userId);
  if (data.months.length === 0) {
    return c.json({ error: { code: 'no_data', message: '取込済みデータがありません' } }, 404);
  }
  return c.json(buildAgentData(data, task.periodKind, task.periodKey));
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
  | { ok: false; status: 400 | 401; error: { code: string; message: string; missing?: string[] } }
> {
  const normalized = normalizeReport(input, { kind: task.periodKind, key: task.periodKey });
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      error: {
        code: 'missing_sections',
        message: `必須の節が不足しています: ${normalized.missing.join(', ')}`,
        missing: normalized.missing,
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
  await db.insert(s.aiReports).values({
    id: reportId,
    userId: task.userId,
    taskId: task.id,
    periodKind: task.periodKind,
    periodKey: task.periodKey,
    generatedBy: body.generatedBy,
    title: body.title,
    summary: body.summary,
    bodyJson: JSON.stringify(body),
  });
  return { ok: true, reportId };
}
