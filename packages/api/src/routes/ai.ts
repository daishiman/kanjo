import { zValidator } from '@hono/zod-validator';
import {
  type FreeeDeal,
  aiPeriodRangeLabel,
  aiTaskCapabilities,
  aiTaskDisplayId,
  aiTaskLegacyStatus,
  aiTaskStage,
  aiVersionNote,
  sourceNeutralSubscriptionDeals,
  subsCandidates,
} from '@kanjo/core';
/**
 * AI分析レポート(spec-v1.1 §16)。
 *  - aiRoute      : ログイン済みの画面から使う(依頼の発行、レポート一覧・詳細)
 *  - aiAgentRoute : Claude Code / Codex が使う(データ取得・結果送信)。
 *                   セッションではなく、依頼ごとの使い捨てトークン(Bearer)で認証する。
 * トークンは原文を保存せず SHA-256 で照合する。期限切れ・使用済み・取り消し済みは 401。
 * 依頼の段階 (待機中・実行中・完了・失敗・キャンセル) は core の aiTaskStage 1 か所で決める。
 */
import { and, count, desc, eq, gte, isNotNull, isNull, lt, lte, max, sql } from 'drizzle-orm';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import {
  type AiCopyTarget,
  type AiReportBody,
  COPY_TARGETS,
  type Period,
  REPORT_BODY_MAX_BYTES,
  type ReportInput,
  type ReportType,
  buildPrompt,
  normalizeReport,
  periodLabel,
  periodSchema,
  reportInputSchema,
  reportTypeOf,
  taskCreateSchema,
  upgradeBody,
} from '../ai/contract.js';
import { type PreviousReportSummary, buildAgentData } from '../ai/dataset.js';
import type { AuthEnv } from '../auth.js';
import * as s from '../db/schema.js';
import { loadOwnerLabels } from '../owner-labels-store.js';
import { runtimeSchemaGuard } from '../schema-guard.js';
import { getDb, loadDataset, loadSubVendorExclusions, loadSubVendors } from '../store.js';

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

/**
 * トークンの導出に使う秘密鍵。未設定の環境はセッション middleware が先に 503 で断るので、
 * ここに来た時点では必ずある。万一無いときは弱い鍵で発行せず落とす。
 */
/**
 * 依頼ごとのトークン。保存するのは SHA-256 だけで、原文はこの1回の応答にしか現れない。
 * 推測されないよう 32 バイトの乱数から作る (秘密鍵からの導出にすると鍵1つで全依頼分が再現できてしまう)。
 */
function taskToken(): string {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  return TOKEN_PREFIX + b64url(raw);
}

/** キャンセル・再実行は body を使わない。空か {} だけを想定した小さな上限 */
export const ACTION_BODY_MAX_BYTES = 4 * 1024;

const limitBody = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: (c) =>
      c.json(
        {
          error: {
            code: 'payload_too_large',
            message: '送信できる大きさを超えています。内容を減らしてから送り直してください',
          },
        },
        413,
      ),
  });

/**
 * JSON として読めない本文を 400 invalid_json で返す。hono の validator は構文エラーを HTTPException で
 * 投げ、アプリの onError が 500 にしてしまうため、validator より前で先に読んで確かめる (読んだ本文は再利用される)。
 */
const jsonSyntaxGuard: MiddlewareHandler = async (c, next) => {
  try {
    await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          code: 'invalid_json',
          message: '送信内容を JSON として読めません。括弧や引用符の閉じ忘れ、末尾のカンマを確認してください',
        },
      },
      400,
    );
  }
  await next();
};

const stageOf = (t: typeof s.aiTasks.$inferSelect, now = Date.now()) => aiTaskStage(t, now);

const resultRefusal = (t: typeof s.aiTasks.$inferSelect) => {
  const stage = stageOf(t).stage;
  if (aiTaskCapabilities(stage).acceptResult) return null;
  if (stage === 'done') return { code: 'already_done', message: 'この依頼は結果を受信済みです' };
  if (stage === 'failed')
    return { code: 'already_expired', message: 'この依頼は受付期間を過ぎています。再実行してください' };
  return {
    code: 'task_canceled',
    message: 'この依頼は取り消されました。アプリで指示文を作り直してください',
  };
};

const periodOf = (t: { periodFrom: string; periodTo: string }): Period => ({
  from: t.periodFrom,
  to: t.periodTo,
});

const taskView = (t: typeof s.aiTasks.$inferSelect) => {
  const { stage, progress } = stageOf(t);
  return {
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
    /** 旧来の3値。段階から導く (旧画面・旧テストとの互換) */
    status: aiTaskLegacyStatus(stage),
    seq: t.seq ?? null,
    displayId: aiTaskDisplayId(t.seq ?? null, t.createdAt),
    stage,
    progress,
    dataFetchedAt: t.dataFetchedAt ?? null,
    rejectedAt: t.rejectedAt ?? null,
    rejectCount: t.rejectCount ?? 0,
    canceledAt: t.canceledAt ?? null,
  };
};

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
  const [previousReports, vendors, excluded, dealRows, analysis, ownerLabels] = await Promise.all([
    loadPreviousReports(db, task),
    loadSubVendors(db, task.userId),
    loadSubVendorExclusions(db, task.userId),
    // memo/importId などの原本列をこの経路へ読み込まない。サブスク候補に必要な列だけを投影する。
    db
      .select({
        month: s.freeeDeals.month,
        date: s.freeeDeals.date,
        io: s.freeeDeals.io,
        partner: s.freeeDeals.partner,
        accountRaw: s.freeeDeals.accountRaw,
        accountNorm: s.freeeDeals.accountNorm,
        amount: s.freeeDeals.amount,
        settlementKnown: s.freeeDeals.settlementKnown,
        dueDate: s.freeeDeals.dueDate,
        settledDate: s.freeeDeals.settledDate,
        settleAccount: s.freeeDeals.settleAccount,
        settledAmount: s.freeeDeals.settledAmount,
      })
      .from(s.freeeDeals)
      .where(eq(s.freeeDeals.userId, task.userId)),
    db.select().from(s.analysisSettings).where(eq(s.analysisSettings.userId, task.userId)),
    loadOwnerLabels(db, task.userId),
  ]);
  // 「サブスクではない」と記録済みの支払先は、AIへの指示文でも候補に挙げない
  const candidates = subsCandidates(
    sourceNeutralSubscriptionDeals(
      data,
      dealRows.map(
        (row): FreeeDeal => ({
          month: row.month,
          date: row.date,
          io: row.io,
          partner: row.partner ?? '',
          accountRaw: row.accountRaw ?? '',
          accountNorm: row.accountNorm ?? '',
          amount: row.amount,
          ...(row.settlementKnown === 1
            ? {
                dueDate: row.dueDate,
                settledDate: row.settledDate,
                settleAccount: row.settleAccount,
                settledAmount: row.settledAmount,
              }
            : {}),
        }),
      ),
    ),
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
    ownerLabels,
  });
}

/* ======== 画面用(セッション認証は index.ts の authGuard が担う) ======== */

export const aiRoute = new Hono<Ctx>();

aiRoute.post('/ai/tasks', zValidator('json', taskCreateSchema), async (c) => {
  const { from, to, supplement, parentReportId, target } = c.req.valid('json');
  let period: Period = { from, to };
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  if (parentReportId) {
    const parent = await db
      .select({ id: s.aiReports.id, periodFrom: s.aiReports.periodFrom, periodTo: s.aiReports.periodTo })
      .from(s.aiReports)
      .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, parentReportId)))
      .get();
    if (!parent)
      return c.json(
        { error: { code: 'not_found', message: '再分析の元になるレポートが見つかりません' } },
        404,
      );
    // 再分析の期間は画面から送られた値を信用せず、所有確認済みの親レポートから固定する。
    period = { from: parent.periodFrom, to: parent.periodTo };
  }
  const issued = await issueTask(db, userId, new URL(c.req.url).origin, {
    period,
    supplement: supplement?.trim() || null,
    parentReportId: parentReportId ?? null,
    target: target ?? 'claude_code',
  });
  return c.json(issued, 201);
});

/**
 * 一意索引の衝突か。drizzle は D1 のエラーを DrizzleQueryError に包み、元の文言を cause へ移すので、
 * cause を辿って探す (String(e) だけでは "Failed query: …" しか見えず、採り直しが一度も働かない)。
 */
export const isUniqueViolation = (e: unknown): boolean => {
  for (let cur: unknown = e, depth = 0; cur != null && depth < 5; depth++) {
    if (/UNIQUE constraint failed/i.test(String(cur))) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
};

/**
 * 依頼の発行 (POST /ai/tasks と再実行で共有)。seq は利用者ごとの max+1。
 * 同時に発行して一意索引 (user_id, seq) に当たったら、1 回だけ採り直す。
 */
async function issueTask(
  db: ReturnType<typeof getDb>,
  userId: string,
  origin: string,
  p: { period: Period; supplement: string | null; parentReportId: string | null; target: AiCopyTarget },
) {
  const id = crypto.randomUUID();
  const token = taskToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const tokenHash = await sha256Hex(token);
  const insert = async () => {
    const top = await db
      .select({ value: max(s.aiTasks.seq) })
      .from(s.aiTasks)
      .where(eq(s.aiTasks.userId, userId))
      .get();
    await db.insert(s.aiTasks).values({
      id,
      userId,
      periodFrom: p.period.from,
      periodTo: p.period.to,
      reportType: reportTypeOf(p.period),
      supplement: p.supplement,
      parentReportId: p.parentReportId,
      tokenHash,
      expiresAt,
      seq: (top?.value ?? 0) + 1,
    });
  };
  try {
    await insert();
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    await insert();
  }
  const prompt = buildPrompt({
    origin,
    taskId: id,
    token,
    period: p.period,
    expiresAt,
    target: p.target,
    supplement: p.supplement,
    parentReportId: p.parentReportId,
  });
  const row = (await db
    .select()
    .from(s.aiTasks)
    .where(eq(s.aiTasks.id, id))
    .get()) as typeof s.aiTasks.$inferSelect;
  return { task: taskView(row), prompt };
}

const taskListQuery = zValidator(
  'query',
  z.object({
    id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .optional(),
  }),
);

aiRoute.get('/ai/tasks', taskListQuery, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const requestedId = c.req.valid('query').id;
  if (requestedId) {
    const requested = await db
      .select()
      .from(s.aiTasks)
      .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.id, requestedId)))
      .limit(1);
    return c.json({ tasks: requested.map(taskView) });
  }
  const recent = await db
    .select()
    .from(s.aiTasks)
    .where(eq(s.aiTasks.userId, userId))
    .orderBy(desc(s.aiTasks.createdAt))
    .limit(20);
  return c.json({ tasks: recent.map(taskView) });
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
  const [previousRows, versionRows] = await db.batch([
    // 前回: 同じ型でこれより前に作られた直近のレポート
    db
      .select()
      .from(s.aiReports)
      .where(
        and(
          eq(s.aiReports.userId, row.userId),
          eq(s.aiReports.reportType, row.reportType),
          lt(s.aiReports.createdAt, row.createdAt),
        ),
      )
      .orderBy(desc(s.aiReports.createdAt))
      .limit(1),
    // 版履歴は一覧の表示上限に依存せず、同じ版系列を直接取る。
    db
      .select({ report: s.aiReports, supplement: s.aiTasks.supplement })
      .from(s.aiReports)
      .leftJoin(
        s.aiTasks,
        and(eq(s.aiTasks.id, s.aiReports.taskId), eq(s.aiTasks.userId, s.aiReports.userId)),
      )
      .where(
        and(
          eq(s.aiReports.userId, row.userId),
          eq(s.aiReports.reportType, row.reportType),
          eq(s.aiReports.periodFrom, row.periodFrom),
          eq(s.aiReports.periodTo, row.periodTo),
        ),
      )
      .orderBy(s.aiReports.version),
  ]);
  const previous = previousRows[0] ?? null;
  // 版の説明はJOINで一緒に取る。版数がD1の変数上限を超えても IN (...) に依存しない。
  const versions = versionRows.map(({ report, supplement }) => ({
    ...reportView(report),
    versionNote: aiVersionNote(supplement, report.version),
  }));
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
 * 旧クライアントの DELETE 互換経路。依頼・版履歴の参照を壊さないよう、
 * 物理削除は行わずアーカイブと同じ可逆な状態遷移とする。
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
  const archivedAt = row.archivedAt ?? new Date().toISOString();
  await db
    .update(s.aiReports)
    .set({ archivedAt })
    .where(and(eq(s.aiReports.userId, userId), eq(s.aiReports.id, id)));
  return c.json({ ok: true, archived: true, archivedAt });
});

/**
 * 依頼の削除。消せる段階は core の能力表 (aiTaskCapabilities.delete) だけで決め、ここに別の if を持たない。
 * 結果待ち (待機中・実行中) は取り消し (cancel) の担当で、受信済みはレポートの出所なので消さない。
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
  if (!aiTaskCapabilities(stageOf(task).stage).delete)
    return c.json(
      {
        code: 'not_deletable',
        error: {
          code: 'not_deletable',
          message: '削除できるのは失敗かキャンセルの依頼だけです。結果待ちの依頼は取り消してください',
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
        message: 'この依頼はすでに結果を受け取っています。受信済みの依頼はレポートの出所なので消せません',
      },
    },
    409,
  );
});

/**
 * 待機中・実行中の依頼の取り消し。行は残し、トークンだけを使えなくする。
 * 更新は used_at と canceled_at がともに NULL の行だけを対象にした 1 文 (CAS)。
 */
aiRoute.post('/ai/tasks/:id/cancel', limitBody(ACTION_BODY_MAX_BYTES), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const load = () =>
    db
      .select()
      .from(s.aiTasks)
      .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.id, id)))
      .get();
  const task = await load();
  if (!task) return c.json({ error: { code: 'not_found', message: '依頼が見つかりません' } }, 404);
  const refuse = (t: typeof s.aiTasks.$inferSelect) => {
    const { stage } = stageOf(t);
    if (stage === 'done')
      return c.json(
        { error: { code: 'already_done', message: 'この依頼はすでに結果を受け取っています' } },
        409,
      );
    if (stage === 'failed')
      return c.json(
        {
          error: {
            code: 'already_expired',
            message: 'この依頼は期限が切れています。再実行か削除を選んでください',
          },
        },
        409,
      );
    return null;
  };
  // 2回目の取り消しは何もしないで今の状態を返す (canceledAt は最初の時刻のまま)
  if (task.canceledAt) return c.json({ ok: true, task: taskView(task) });
  const refused = refuse(task);
  if (refused) return refused;
  await db
    .update(s.aiTasks)
    .set({ canceledAt: new Date().toISOString() })
    .where(
      and(
        eq(s.aiTasks.userId, userId),
        eq(s.aiTasks.id, id),
        isNull(s.aiTasks.usedAt),
        isNull(s.aiTasks.canceledAt),
      ),
    )
    .run();
  // 受信と競合して used_at が先に入った場合は、読み直した行で 409 already_done になる
  const after = (await load()) as typeof s.aiTasks.$inferSelect;
  if (after.usedAt) return refuse(after) as Response;
  return c.json({ ok: true, task: taskView(after) });
});

/** 失敗・キャンセルの依頼を、同じ期間・補足指示・再分析元で発行し直す。元の行は残す */
aiRoute.post('/ai/tasks/:id/retry', limitBody(ACTION_BODY_MAX_BYTES), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const task = await db
    .select()
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.userId, userId), eq(s.aiTasks.id, c.req.param('id'))))
    .get();
  if (!task) return c.json({ error: { code: 'not_found', message: '依頼が見つかりません' } }, 404);
  if (!aiTaskCapabilities(stageOf(task).stage).retry)
    return c.json(
      {
        error: {
          code: 'not_retryable',
          message: '再実行できるのは失敗かキャンセルの依頼だけです',
        },
      },
      409,
    );
  const issued = await issueTask(db, userId, new URL(c.req.url).origin, {
    period: periodOf(task),
    supplement: task.supplement ?? null,
    parentReportId: task.parentReportId ?? null,
    // 再実行は元の依頼をコピーした先へ貼り直すので、記録済みの宛先をそのまま引き継ぐ
    target: task.copiedTarget ?? 'claude_code',
  });
  return c.json(issued, 201);
});

/**
 * 「使用するデータ」の件数。明細・摘要・金額は返さず、期間内の件数と種類数だけを 1 回の batch で数える。
 * 科目は freee の勘定科目と MF の大項目を出所ごとに別の種類として数える。
 */
const inventoryQuery = zValidator('query', periodSchema, (result, c) => {
  if (result.success) return;
  return c.json(
    {
      error: {
        code: 'invalid_request',
        message: result.error.issues[0]?.message ?? '期間の指定が正しくありません',
      },
    },
    400,
  );
});

aiRoute.get('/ai/inventory', inventoryQuery, async (c) => {
  const { from, to } = c.req.valid('query');
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const deals = and(
    eq(s.freeeDeals.userId, userId),
    gte(s.freeeDeals.month, from),
    lte(s.freeeDeals.month, to),
  );
  const mf = and(
    eq(s.mfTransactions.userId, userId),
    gte(s.mfTransactions.month, from),
    lte(s.mfTransactions.month, to),
    eq(s.mfTransactions.isTarget, 1),
    eq(s.mfTransactions.isTransfer, 0),
  );
  const [freee, mfRows] = await db.batch([
    db
      .select({
        deals: count(),
        accounts: sql<number>`count(distinct coalesce(nullif(trim(${s.freeeDeals.accountNorm}), ''), nullif(trim(${s.freeeDeals.accountRaw}), '')))`,
        partners: sql<number>`count(distinct nullif(trim(${s.freeeDeals.partner}), ''))`,
      })
      .from(s.freeeDeals)
      .where(deals),
    db
      .select({
        transactions: count(),
        categories: sql<number>`count(distinct nullif(trim(${s.mfTransactions.categoryMajor}), ''))`,
      })
      .from(s.mfTransactions)
      .where(mf),
  ]);
  return c.json({
    period: { from, to, label: aiPeriodRangeLabel(from, to) },
    freeeDeals: freee[0]?.deals ?? 0,
    mfTransactions: mfRows[0]?.transactions ?? 0,
    categories: (freee[0]?.accounts ?? 0) + (mfRows[0]?.categories ?? 0),
    counterparties: freee[0]?.partners ?? 0,
  });
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
aiRoute.post(
  '/ai/tasks/:id/paste',
  limitBody(REPORT_BODY_MAX_BYTES),
  jsonSyntaxGuard,
  reportValidator,
  async (c) => {
    const db = getDb(c.env.DB);
    const task = await db
      .select()
      .from(s.aiTasks)
      .where(and(eq(s.aiTasks.userId, c.get('userId')), eq(s.aiTasks.id, c.req.param('id'))))
      .get();
    if (!task) return c.json({ error: { code: 'not_found', message: '依頼が見つかりません' } }, 404);
    const refused = resultRefusal(task);
    if (refused) return c.json({ error: refused }, 409);
    const r = await storeReport(c.env.DB, db, task, c.req.valid('json'));
    if (!r.ok) return c.json({ error: r.error }, r.status);
    return c.json({ ok: true, reportId: r.reportId }, 201);
  },
);

/* ======== エージェント用(使い捨てトークン認証) ======== */

export const aiAgentRoute = new Hono<AgentCtx>();

const agentUnauthorized = (c: Context<AgentCtx>, message: string) =>
  c.json({ error: { code: 'unauthorized', message } }, 401);

/**
 * token の認証。0046 より前からある列だけを読むので、migration が遅れた D1 でも
 * 「認証してから schema 503」の順が崩れない (全列 select は未適用の列名で失敗する)。
 */
const agentGuard: MiddlewareHandler<AgentCtx, '/ai/tasks/:id/data' | '/ai/tasks/:id/report'> = async (
  c,
  next,
) => {
  const auth = c.req.header('Authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (!m || !m[1].startsWith(TOKEN_PREFIX))
    return agentUnauthorized(c, 'Authorization: Bearer <token> が必要です');
  const task = await getDb(c.env.DB)
    .select({ userId: s.aiTasks.userId, expiresAt: s.aiTasks.expiresAt, usedAt: s.aiTasks.usedAt })
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.tokenHash, await sha256Hex(m[1])), eq(s.aiTasks.id, c.req.param('id'))))
    .get();
  if (!task) return agentUnauthorized(c, 'トークンが無効です');
  if (task.usedAt)
    return agentUnauthorized(c, 'この依頼は結果を受信済みです。アプリで指示文を作り直してください');
  if (Date.parse(task.expiresAt) < Date.now())
    return agentUnauthorized(c, 'トークンの有効期限が切れています。アプリで指示文を作り直してください');
  c.set('userId', task.userId);
  await next();
};

/** schema guard の後で全列を読み、取り消し・期限切れ・受信済みを段階で判定する。 */
const agentTask: MiddlewareHandler<AgentCtx, '/ai/tasks/:id/data' | '/ai/tasks/:id/report'> = async (
  c,
  next,
) => {
  const task = await getDb(c.env.DB)
    .select()
    .from(s.aiTasks)
    .where(and(eq(s.aiTasks.id, c.req.param('id')), eq(s.aiTasks.userId, c.get('userId'))))
    .get();
  if (!task) return agentUnauthorized(c, 'トークンが無効です');
  const refused = resultRefusal(task);
  if (refused) return agentUnauthorized(c, refused.message);
  c.set('task', task);
  await next();
};
aiAgentRoute.use('/ai/tasks/:id/data', agentGuard);
aiAgentRoute.use('/ai/tasks/:id/report', agentGuard);
// token検証はD1に保存したtaskで行い、schema検査はその認証後・payload/reportの業務D1前に置く。
aiAgentRoute.use('/ai/tasks/:id/data', runtimeSchemaGuard);
aiAgentRoute.use('/ai/tasks/:id/report', runtimeSchemaGuard);
aiAgentRoute.use('/ai/tasks/:id/data', agentTask);
aiAgentRoute.use('/ai/tasks/:id/report', agentTask);

aiAgentRoute.get('/ai/tasks/:id/data', async (c) => {
  const db = getDb(c.env.DB);
  const task = c.get('task');
  const payload = await agentPayload(db, task);
  if (!payload) return c.json({ error: { code: 'no_data', message: '取込済みデータがありません' } }, 404);
  // 応答直前に受付可能な依頼だけを CAS 更新する。agentTask 通過後の取消と競合したらデータを返さない。
  const fetchedAt = new Date().toISOString();
  const delivered = await db
    .update(s.aiTasks)
    .set({ dataFetchedAt: sql`coalesce(${s.aiTasks.dataFetchedAt}, ${fetchedAt})` })
    .where(
      and(
        eq(s.aiTasks.id, task.id),
        isNull(s.aiTasks.usedAt),
        isNull(s.aiTasks.canceledAt),
        gte(s.aiTasks.expiresAt, fetchedAt),
      ),
    )
    .returning({ id: s.aiTasks.id });
  if (!delivered.length) {
    const current = await db.select().from(s.aiTasks).where(eq(s.aiTasks.id, task.id)).get();
    return agentUnauthorized(
      c,
      current ? (resultRefusal(current)?.message ?? 'この依頼は受付できません') : 'トークンが無効です',
    );
  }
  return c.json(payload);
});

/**
 * 契約違反 (400) で差し戻した事実の記録 (実行中 75%)。JSON の構文・形の誤り (validator) と
 * 内容の規則違反 (normalizeReport) のどちらも 400 なので、応答の状態で判定する (no_data の 400 は除く)。
 */
const recordReject: MiddlewareHandler<AgentCtx> = async (c, next) => {
  await next();
  if (c.res.status !== 400) return;
  // 取込データが無い 400 (no_data) は送信側の契約違反ではないので数えない
  const body = (await c.res
    .clone()
    .json()
    .catch(() => null)) as { error?: { code?: string } } | null;
  if (body?.error?.code === 'no_data') return;
  const task = c.get('task');
  await getDb(c.env.DB)
    .update(s.aiTasks)
    .set({ rejectedAt: new Date().toISOString(), rejectCount: sql`${s.aiTasks.rejectCount} + 1` })
    .where(and(eq(s.aiTasks.id, task.id), isNull(s.aiTasks.usedAt), isNull(s.aiTasks.canceledAt)))
    .run();
};

aiAgentRoute.post(
  '/ai/tasks/:id/report',
  limitBody(REPORT_BODY_MAX_BYTES),
  recordReject,
  jsonSyntaxGuard,
  reportValidator,
  async (c) => {
    const r = await storeReport(c.env.DB, getDb(c.env.DB), c.get('task'), c.req.valid('json'));
    if (!r.ok) return c.json({ error: r.error }, r.status);
    return c.json(
      {
        ok: true,
        reportId: r.reportId,
        message: 'レポートを受け付けました。アプリの「AI分析」で確認できます',
      },
      201,
    );
  },
);

/* ======== 共通: レポートの検証・保存(使い捨ての確定を含む) ======== */

async function storeReport(
  database: D1Database,
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
  const body = normalized.body;
  const reportId = crypto.randomUUID();
  const claimAt = new Date().toISOString();
  const reportJson = JSON.stringify(body);
  const commit = async () => {
    const results = await database.batch([
      database
        .prepare(
          `UPDATE ai_tasks SET used_at=?, report_id=?
           WHERE id=? AND user_id=? AND used_at IS NULL AND canceled_at IS NULL AND expires_at>=?`,
        )
        .bind(claimAt, reportId, task.id, task.userId, claimAt),
      database
        .prepare(
          `INSERT INTO ai_reports
             (id,user_id,task_id,period_kind,period_key,period_from,period_to,report_type,version,
              parent_report_id,generated_by,title,summary,body_json,archived_at,created_at)
           SELECT ?,?,?,'range','',?,?,?,
             COALESCE((
               SELECT MAX(version) FROM ai_reports
               WHERE user_id=? AND report_type=? AND period_from=? AND period_to=?
             ),0)+1,
             ?,?,?,?,?,NULL,?
           FROM ai_tasks
           WHERE id=? AND user_id=? AND used_at=? AND report_id=?
             AND canceled_at IS NULL AND expires_at>=?`,
        )
        .bind(
          reportId,
          task.userId,
          task.id,
          task.periodFrom,
          task.periodTo,
          task.reportType,
          task.userId,
          task.reportType,
          task.periodFrom,
          task.periodTo,
          task.parentReportId ?? null,
          body.generatedBy,
          body.title,
          body.summary,
          reportJson,
          claimAt,
          task.id,
          task.userId,
          claimAt,
          reportId,
          claimAt,
        ),
    ]);
    return results[1].meta.changes === 1;
  };
  try {
    if (!(await commit())) {
      const current = await db.select().from(s.aiTasks).where(eq(s.aiTasks.id, task.id)).get();
      const refused = current ? resultRefusal(current) : null;
      return {
        ok: false,
        status: 401,
        error: { code: 'unauthorized', message: refused?.message ?? 'この依頼は受付できません' },
      };
    }
  } catch (error) {
    const current = await db.select().from(s.aiTasks).where(eq(s.aiTasks.id, task.id)).get();
    const refused = current
      ? resultRefusal(current)
      : { code: 'unauthorized', message: 'トークンが無効です' };
    if (refused) return { ok: false, status: 401, error: { code: 'unauthorized', message: refused.message } };
    // 異なる依頼が同じ版番号を読んだ場合は、batch rollback 後に最大版を1回だけ採り直す。
    if (!isUniqueViolation(error)) throw error;
    if (!(await commit())) {
      return {
        ok: false,
        status: 401,
        error: { code: 'unauthorized', message: 'この依頼は別の受信処理で確定済みです' },
      };
    }
  }
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
