import { zValidator } from '@hono/zod-validator';
/**
 * 改善要望(system-spec の D5〜D9)。
 *  - improvementRoute      : ログイン済みの画面から使う(投稿・一覧・詳細・状態更新・指示文発行)
 *  - improvementAgentRoute : Claude Code / Codex が使う(要望データとスクリーンショットの取得)。
 *                            セッションではなく、要望ごとの使い捨てトークン(Bearer)で認証する。
 *
 * 受け渡しの設計は既存 AI 分析 (routes/ai.ts) と同型にする。新方式を作らない。
 * R2 に対する公開 URL・署名付き URL は一切発行せず、配信は必ずこの Worker を通す。
 * 署名 URL は漏えい時に期限内無制限で再利用でき、個別失効もできない。指示文という
 * 「コピーされて出回る文字列」に載せる前提と適合しないため採らない。
 */
import {
  IMPROVEMENT_BODY_MAX,
  IMPROVEMENT_SCREENSHOT_MAX_BYTES,
  IMPROVEMENT_TITLE_MAX,
  IMPROVEMENT_TOKEN_MAX_FETCH,
  IMPROVEMENT_TOKEN_PREFIX,
  IMPROVEMENT_TOKEN_TTL_MS,
  improvementAttachmentExpired,
  improvementScreenshotR2Key,
  mintAgentToken,
  sha256Hex,
} from '@kanjo/core';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import type { AuthEnv } from '../auth.js';
import {
  type ImprovementRow,
  buildImprovementPrompt,
  improvementCopiedSchema,
  improvementCreateSchema,
  improvementRequests,
  improvementStatusSchema,
  improvementView,
  parseStoredDiagnostics,
  tokenStatus,
} from '../improvement/contract.js';
import { parseDiagnosticsField, redactText, sniffScreenshotType } from '../improvement/redact.js';
import { runtimeSchemaGuard } from '../schema-guard.js';
import { type Db, getDb } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };
type AgentCtx = { Bindings: AuthEnv; Variables: { userId: string; request: ImprovementRow } };

const PRIVATE_NO_STORE = 'private, no-store';

/** 新しいトークンの原文。発行・ハッシュ化の方式は core が正本(AI分析と同一) */
const mintToken = (): string => mintAgentToken(IMPROVEMENT_TOKEN_PREFIX);

export const improvementRoute = new Hono<Ctx>();

// 要望本文・スクリーンショット・診断のいずれも中間キャッシュに残さない。
improvementRoute.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', PRIVATE_NO_STORE);
});

const origin = (c: { req: { url: string } }): string => new URL(c.req.url).origin;

async function loadRow(db: Db, userId: string, id: string): Promise<ImprovementRow | undefined> {
  const [row] = await db
    .select()
    .from(improvementRequests)
    .where(and(eq(improvementRequests.userId, userId), eq(improvementRequests.id, id)));
  return row;
}

/**
 * 詳細取得時にも保持期限を判定する。削除ジョブが失敗していた場合の縮退経路。
 * 期限切れなら、その場で添付を落として「もう無い」状態へ寄せる。
 */
async function purgeIfExpired(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  db: Db,
  row: ImprovementRow,
  now: string,
): Promise<ImprovementRow> {
  if (row.purgedAt || !improvementAttachmentExpired(row.doneAt, now)) return row;
  await deleteAttachments(env, db, row, now);
  return {
    ...row,
    screenshotKey: null,
    screenshotSize: null,
    diagnosticsJson: null,
    tokenHash: null,
    tokenExpiresAt: null,
    purgedAt: now,
    updatedAt: now,
  };
}

/**
 * 添付だけを消す。本文・状態・対応記録は残す。
 * トークンも同時に失効させる(取得先が空になった指示文を生かしておく意味がない)。
 */
async function deleteAttachments(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  db: Db,
  row: ImprovementRow,
  now: string,
): Promise<void> {
  if (row.screenshotKey) await env.FILES.delete(row.screenshotKey);
  await db
    .update(improvementRequests)
    .set({
      screenshotKey: null,
      screenshotSize: null,
      diagnosticsJson: null,
      tokenHash: null,
      tokenExpiresAt: null,
      purgedAt: now,
      updatedAt: now,
    })
    .where(eq(improvementRequests.id, row.id));
}

/* -------- 投稿 -------- */

improvementRoute.post('/improvements', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const form = await c.req.formData();

  const parsed = improvementCreateSchema.safeParse({
    title: form.get('title'),
    body: form.get('body'),
    route: form.get('route') ?? '',
  });
  if (!parsed.success)
    return c.json(
      {
        error: {
          code: 'invalid_request',
          message: `件名(1〜${IMPROVEMENT_TITLE_MAX}文字)と内容(1〜${IMPROVEMENT_BODY_MAX}文字)を入力してください`,
        },
      },
      400,
    );

  const route = redactText(parsed.data.route, 500);
  const diagnostics = parseDiagnosticsField(
    typeof form.get('diagnostics') === 'string' ? (form.get('diagnostics') as string) : null,
    route,
    now,
  );

  // 撮影の失敗は投稿の失敗ではない。screenshot が無い/読めない場合も本文だけで成立させる
  const file = form.get('screenshot');
  let screenshotKey: string | null = null;
  let screenshotSize: number | null = null;
  let screenshotRejected: string | null = null;
  const id = crypto.randomUUID();

  if (file instanceof File && file.size > 0) {
    if (file.size > IMPROVEMENT_SCREENSHOT_MAX_BYTES) {
      screenshotRejected = 'too_large';
    } else {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = sniffScreenshotType(bytes);
      if (!type) {
        screenshotRejected = 'unsupported_type';
      } else {
        screenshotKey = improvementScreenshotR2Key(userId, id);
        screenshotSize = bytes.byteLength;
        await c.env.FILES.put(screenshotKey, bytes, {
          httpMetadata: { contentType: type },
          customMetadata: { ownerId: userId, kind: 'improvement_screenshot' },
        });
      }
    }
  }

  const token = mintToken();
  const expiresAt = new Date(Date.parse(now) + IMPROVEMENT_TOKEN_TTL_MS).toISOString();

  try {
    await db.insert(improvementRequests).values({
      id,
      userId,
      title: redactText(parsed.data.title, IMPROVEMENT_TITLE_MAX),
      body: redactText(parsed.data.body, IMPROVEMENT_BODY_MAX),
      route,
      status: 'open',
      screenshotKey,
      screenshotSize,
      diagnosticsJson: JSON.stringify(diagnostics.payload),
      diagnosticsOmitted: diagnostics.payload.omittedCount,
      tokenHash: await sha256Hex(token),
      tokenExpiresAt: expiresAt,
      tokenFetchCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    // D1 が落ちたら R2 に置いた原本だけが残る。孤児を作らずに戻す
    if (screenshotKey) await c.env.FILES.delete(screenshotKey);
    throw error;
  }

  const row = await loadRow(db, userId, id);
  if (!row) throw new Error('improvement_commit_missing');
  return c.json(
    {
      request: improvementView(row, now),
      // 原文はここでしか返らない。以後は /prompt で作り直す
      prompt: buildImprovementPrompt({
        origin: origin(c),
        requestId: id,
        token,
        expiresAt,
        title: row.title,
        route: row.route,
        hasScreenshot: screenshotKey !== null,
        diagnosticsCount: diagnostics.payload.entries.length,
        diagnosticsOmitted: diagnostics.payload.omittedCount,
        viewport: diagnostics.payload.environment.viewport,
        userAgent: diagnostics.payload.environment.userAgent,
        capturedAt: diagnostics.payload.environment.capturedAt,
        entries: diagnostics.payload.entries,
      }),
      screenshotRejected,
      diagnosticsRejected: diagnostics.rejected,
    },
    201,
  );
});

/* -------- 一覧・詳細 -------- */

improvementRoute.get('/improvements', async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const rows = await db
    .select()
    .from(improvementRequests)
    .where(eq(improvementRequests.userId, c.get('userId')))
    .orderBy(desc(improvementRequests.createdAt))
    .limit(200);
  return c.json({ requests: rows.map((row) => improvementView(row, now)) });
});

improvementRoute.get('/improvements/:id', async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const found = await loadRow(db, c.get('userId'), c.req.param('id'));
  if (!found) return c.json({ error: { code: 'not_found', message: 'その改善要望はありません' } }, 404);
  const row = await purgeIfExpired(c.env, db, found, now);
  return c.json({
    request: improvementView(row, now),
    diagnostics: parseStoredDiagnostics(row.diagnosticsJson),
  });
});

/** スクリーンショットの配信。R2 の公開 URL は作らず、ここを必ず通す */
improvementRoute.get('/improvements/:id/screenshot', async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const found = await loadRow(db, c.get('userId'), c.req.param('id'));
  if (!found) return c.json({ error: { code: 'not_found', message: 'その改善要望はありません' } }, 404);
  const row = await purgeIfExpired(c.env, db, found, now);
  return serveScreenshot(c.env, row, (status, error) => c.json({ error }, status));
});

type JsonError = (status: 404 | 410, error: { code: string; message: string }) => Response;

async function serveScreenshot(
  env: Pick<AuthEnv, 'FILES'>,
  row: ImprovementRow,
  fail: JsonError,
): Promise<Response> {
  if (!row.screenshotKey)
    return fail(
      row.purgedAt ? 410 : 404,
      row.purgedAt
        ? { code: 'attachment_purged', message: '保持期限を過ぎたため、この画像は削除されています' }
        : { code: 'no_screenshot', message: 'この要望にスクリーンショットはありません' },
    );
  const object = await env.FILES.get(row.screenshotKey);
  if (!object)
    return fail(404, {
      code: 'screenshot_missing',
      message: '画像の原本が見つかりません。削除済みの可能性があります',
    });
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': PRIVATE_NO_STORE,
      'Content-Disposition': 'inline',
    },
  });
}

/* -------- 指示文の再発行・コピー記録・状態更新 -------- */

/**
 * 指示文を作り直す。既存トークンのハッシュを新しいものへ置き換えるので、
 * 前に配った指示文はこの時点で失効する(配り直しが失効操作を兼ねる)。
 */
improvementRoute.post('/improvements/:id/prompt', async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const found = await loadRow(db, c.get('userId'), c.req.param('id'));
  if (!found) return c.json({ error: { code: 'not_found', message: 'その改善要望はありません' } }, 404);
  const row = await purgeIfExpired(c.env, db, found, now);
  if (row.purgedAt)
    return c.json(
      {
        error: {
          code: 'attachment_purged',
          message: '保持期限を過ぎて添付が削除されているため、指示文は作れません',
        },
      },
      410,
    );
  const token = mintToken();
  const expiresAt = new Date(Date.parse(now) + IMPROVEMENT_TOKEN_TTL_MS).toISOString();
  await db
    .update(improvementRequests)
    .set({
      tokenHash: await sha256Hex(token),
      tokenExpiresAt: expiresAt,
      tokenFetchCount: 0,
      updatedAt: now,
    })
    .where(eq(improvementRequests.id, row.id));
  const diagnostics = parseStoredDiagnostics(row.diagnosticsJson);
  return c.json({
    prompt: buildImprovementPrompt({
      origin: origin(c),
      requestId: row.id,
      token,
      expiresAt,
      title: row.title,
      route: row.route,
      hasScreenshot: row.screenshotKey !== null,
      diagnosticsCount: diagnostics?.entries.length ?? 0,
      diagnosticsOmitted: row.diagnosticsOmitted,
      viewport: diagnostics?.environment.viewport,
      userAgent: diagnostics?.environment.userAgent,
      capturedAt: diagnostics?.environment.capturedAt,
      entries: diagnostics?.entries,
    }),
    expiresAt,
  });
});

improvementRoute.post('/improvements/:id/copied', zValidator('json', improvementCopiedSchema), async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const updated = await db
    .update(improvementRequests)
    .set({ copiedAt: now, copiedTarget: c.req.valid('json').target, updatedAt: now })
    .where(
      and(eq(improvementRequests.userId, c.get('userId')), eq(improvementRequests.id, c.req.param('id'))),
    )
    .returning({ id: improvementRequests.id });
  if (!updated.length)
    return c.json({ error: { code: 'not_found', message: 'その改善要望はありません' } }, 404);
  return c.json({ ok: true, copiedAt: now });
});

improvementRoute.post('/improvements/:id/status', zValidator('json', improvementStatusSchema), async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const status = c.req.valid('json').status;
  const found = await loadRow(db, c.get('userId'), c.req.param('id'));
  if (!found) return c.json({ error: { code: 'not_found', message: 'その改善要望はありません' } }, 404);
  // done へ入った時刻が30日削除の起点。done から戻したら起点も消す
  const doneAt = status === 'done' ? (found.doneAt ?? now) : null;
  await db
    .update(improvementRequests)
    .set({ status, doneAt, updatedAt: now })
    .where(eq(improvementRequests.id, found.id));
  const row = await loadRow(db, c.get('userId'), found.id);
  if (!row) throw new Error('improvement_status_missing');
  return c.json({ request: improvementView(row, now) });
});

/* ======== エージェント用(使い捨てトークン認証) ======== */

export const improvementAgentRoute = new Hono<AgentCtx>();

/**
 * 期限切れと取得回数超過は区別した拒否理由を返す。汎用 500 へ丸めない。
 * トークン値そのものはログにも応答にも出さない。
 */
const agentGuard: MiddlewareHandler<AgentCtx> = async (c, next) => {
  const auth = c.req.header('Authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  const unauthorized = (code: string, message: string) => c.json({ error: { code, message } }, 401);
  if (!m || !m[1].startsWith(IMPROVEMENT_TOKEN_PREFIX))
    return unauthorized('unauthorized', 'Authorization: Bearer <token> が必要です');
  const db = getDb(c.env.DB);
  const [row] = await db
    .select()
    .from(improvementRequests)
    .where(
      and(
        eq(improvementRequests.tokenHash, await sha256Hex(m[1])),
        eq(improvementRequests.id, c.req.param('id') ?? ''),
      ),
    );
  if (!row) return unauthorized('unauthorized', 'トークンが無効です');
  const status = tokenStatus(row);
  if (status === 'expired')
    return unauthorized(
      'token_expired',
      'トークンの有効期限が切れています。アプリで指示文を作り直してください',
    );
  if (status === 'exhausted')
    return unauthorized(
      'token_fetch_limit',
      `取得回数の上限(${IMPROVEMENT_TOKEN_MAX_FETCH}回)を超えました。アプリで指示文を作り直してください`,
    );
  if (row.purgedAt) return unauthorized('attachment_purged', '保持期限を過ぎて添付が削除されています');
  // 上限は「取得のたびに1」で数える。データも画像も同じ枠から引く
  await db
    .update(improvementRequests)
    .set({ tokenFetchCount: sql`${improvementRequests.tokenFetchCount} + 1` })
    .where(eq(improvementRequests.id, row.id));
  c.set('userId', row.userId);
  c.set('request', row);
  await next();
};

improvementAgentRoute.use('/improvements/:id/agent/data', agentGuard);
improvementAgentRoute.use('/improvements/:id/agent/screenshot', agentGuard);
improvementAgentRoute.use('/improvements/:id/agent/data', runtimeSchemaGuard);
improvementAgentRoute.use('/improvements/:id/agent/screenshot', runtimeSchemaGuard);

improvementAgentRoute.get('/improvements/:id/agent/data', (c) => {
  const row = c.get('request');
  const diagnostics = parseStoredDiagnostics(row.diagnosticsJson);
  return c.json(
    {
      request: {
        id: row.id,
        title: row.title,
        body: row.body,
        route: row.route,
        status: row.status,
        createdAt: row.createdAt,
      },
      screenshot: {
        available: row.screenshotKey !== null,
        // 署名URLは発行しない。取得はこの Worker の endpoint を同じトークンで叩く
        url: row.screenshotKey ? `${origin(c)}/api/improvements/${row.id}/agent/screenshot` : null,
        size: row.screenshotSize,
      },
      diagnostics: diagnostics ?? { environment: null, entries: [], omittedCount: 0 },
      limits: {
        omittedCount: row.diagnosticsOmitted,
        note: '診断は件数と総バイトの上限で切り詰めてある。秘匿値は *** でマスク済み',
      },
    },
    { headers: { 'Cache-Control': PRIVATE_NO_STORE } },
  );
});

improvementAgentRoute.get('/improvements/:id/agent/screenshot', (c) =>
  serveScreenshot(c.env, c.get('request'), (status, error) => c.json({ error }, status)),
);

/* ======== 保持期限切れの削除(既存 scheduledMaintenance へ相乗り) ======== */

export interface ImprovementRetentionResult {
  selected: number;
  purged: number;
  failed: number;
  /** D1 に対応する行が無い R2 オブジェクトを消した件数 */
  orphans: number;
}

/** 1回の実行で触る R2 オブジェクトの上限。長時間の Cron で他ジョブを圧迫しない */
const ORPHAN_SCAN_LIMIT = 1000;

/**
 * 対応完了から30日を過ぎた要望の添付だけを消す。新規 Cron は増やさない。
 * 本文・状態・対応記録は残すので、何をいつ直したかの記録は失われない。
 */
export async function runImprovementRetention(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  now = new Date().toISOString(),
): Promise<ImprovementRetentionResult> {
  const db = getDb(env.DB);
  const rows = await db
    .select()
    .from(improvementRequests)
    .where(and(eq(improvementRequests.status, 'done'), isNotNull(improvementRequests.doneAt)))
    .limit(500);
  // 1回のCronで無制限に消さない。期限超過だけを対象にし、失敗は次回へ持ち越す
  const due = rows.filter((row) => !row.purgedAt && improvementAttachmentExpired(row.doneAt, now));
  let purged = 0;
  let failed = 0;
  for (const row of due) {
    try {
      await deleteAttachments(env, db, row, now);
      purged += 1;
    } catch {
      // R2 と D1 のどちらで落ちても次回の Cron が同じ行を拾い直す(冪等)
      failed += 1;
    }
  }
  return { selected: due.length, purged, failed, orphans: await sweepOrphans(env) };
}

/**
 * R2 だけに残ったスクリーンショットを消す。
 *
 * 投稿時に「R2 へ put → D1 へ insert」の順で書くため、間で落ちると原本だけが残る。
 * 投稿経路は catch で消しにいくが、Worker ごと落ちた場合はそこも通らない。
 * D1 側に生きているキーの集合を作り、そこに無いオブジェクトを孤児として消す。
 */
async function sweepOrphans(env: Pick<AuthEnv, 'DB' | 'FILES'>): Promise<number> {
  const db = getDb(env.DB);
  const live = new Set(
    (
      await db
        .select({ key: improvementRequests.screenshotKey })
        .from(improvementRequests)
        .where(isNotNull(improvementRequests.screenshotKey))
        .limit(ORPHAN_SCAN_LIMIT)
    )
      .map((row) => row.key)
      .filter((key): key is string => key !== null),
  );
  const listed = await env.FILES.list({ prefix: 'improvements/', limit: ORPHAN_SCAN_LIMIT });
  let removed = 0;
  for (const object of listed.objects) {
    if (live.has(object.key)) continue;
    // 直近に置かれたものは投稿処理の途中かもしれない。5分の猶予を置く
    if (Date.now() - object.uploaded.getTime() < 5 * 60_000) continue;
    await env.FILES.delete(object.key);
    removed += 1;
  }
  return removed;
}
