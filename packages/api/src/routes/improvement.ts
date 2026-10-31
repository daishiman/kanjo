import { zValidator } from '@hono/zod-validator';
/**
 * 改善リクエスト(system-spec の D5〜D9、specs/spec-improvement-screen.md の API 契約)。
 *  - improvementRoute      : ログイン済みの画面から使う(作成・一覧・詳細・状態・指示文・削除・復元)
 *  - improvementAgentRoute : Claude Code / Codex が使う(依頼データとスクリーンショットの取得)。
 *                            セッションではなく、依頼ごとの使い捨てトークン(Bearer)で認証する。
 *
 * 受け渡しの設計は既存 AI 分析 (routes/ai.ts) と同型にする。新方式を作らない。
 * R2 に対する公開 URL・署名付き URL は一切発行せず、配信は必ずこの Worker を通す。
 * 署名 URL は漏えい時に期限内無制限で再利用でき、個別失効もできない。指示文という
 * 「コピーされて出回る文字列」に載せる前提と適合しないため採らない。
 *
 * 一覧・関連・履歴・遷移の判定・診断の要約は core (improvement-screen.ts) が正本で、
 * ここは D1 の行を core へ渡して結果を JSON に写すだけにする。
 * 書き込みは依頼の行と履歴の行を 1 つの D1 batch で書く。削除中の行はどの読み取り経路からも見えない。
 */
import {
  IMPROVEMENT_NEW_BODY_MAX,
  IMPROVEMENT_RETENTION_DAYS,
  IMPROVEMENT_SCREENSHOT_MAX_BYTES,
  IMPROVEMENT_TOKEN_MAX_FETCH,
  IMPROVEMENT_TOKEN_PREFIX,
  IMPROVEMENT_TOKEN_TTL_MS,
  type ImprovementActivityKind,
  type ImprovementListSource,
  type ImprovementStatus,
  type MaskDictionary,
  allowedImprovementTransitions,
  buildImprovementList,
  buildMaskDictionary,
  canTransitionImprovement,
  checkImprovementDraft,
  describeImprovementActivity,
  formatImprovementNumber,
  improvementAttachmentExpired,
  improvementRouteLabel,
  improvementScreenshotR2Key,
  improvementSummary,
  mintAgentToken,
  nextImprovementDoneAt,
  normalizeImprovementListQuery,
  orderImprovementActivities,
  relatedImprovements,
  sha256Hex,
  summarizeDiagnosticEnvironment,
} from '@kanjo/core';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import type { AuthEnv } from '../auth.js';
import { sweepImprovementOrphans } from '../improvement-orphan-sweep.js';
import {
  type ImprovementActivityRow,
  type ImprovementRow,
  buildImprovementPrompt,
  improvementCopiedSchema,
  improvementCreateSchema,
  improvementRequestActivities,
  improvementRequests,
  improvementStatusSchema,
  improvementView,
  parseStoredDiagnostics,
  tokenStatus,
} from '../improvement/contract.js';
import { parseDiagnosticsField, redactText, sniffScreenshotType } from '../improvement/redact.js';
import { runtimeSchemaGuard } from '../schema-guard.js';
import { type Db, getDb } from '../store.js';

export {
  IMPROVEMENT_ORPHAN_CHECKPOINT_KEY,
  IMPROVEMENT_ORPHAN_GRACE_MS,
  IMPROVEMENT_ORPHAN_LOOKUP_MAX_BYTES,
  IMPROVEMENT_ORPHAN_SCAN_LIMIT,
  serializeImprovementOrphanLookupKeys,
} from '../improvement-orphan-sweep.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };
type AgentCtx = { Bindings: AuthEnv; Variables: { userId: string; request: ImprovementRow } };

const PRIVATE_NO_STORE = 'private, no-store';

/** 他の利用者・存在しない・削除中を同じ応答にして、存在を推測させない */
const NOT_FOUND = { code: 'not_found', message: 'その改善リクエストはありません' } as const;

/** 新しいトークンの原文。発行・ハッシュ化の方式は core が正本(AI分析と同一) */
const mintToken = (): string => mintAgentToken(IMPROVEMENT_TOKEN_PREFIX);

export const improvementRoute = new Hono<Ctx>();

// 依頼本文・スクリーンショット・診断のいずれも中間キャッシュに残さない。
improvementRoute.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', PRIVATE_NO_STORE);
});

const origin = (c: { req: { url: string } }): string => new URL(c.req.url).origin;

/** 削除中でない自分の行。画面のすべての読み取り経路はここを通す */
async function loadRow(db: Db, userId: string, id: string): Promise<ImprovementRow | undefined> {
  const [row] = await db
    .select()
    .from(improvementRequests)
    .where(
      and(
        eq(improvementRequests.userId, userId),
        eq(improvementRequests.id, id),
        isNull(improvementRequests.deletedAt),
      ),
    );
  return row;
}

/** 削除中も含めた自分の行。削除と復元のべき等判定だけが使う */
async function loadOwnRowIncludingDeleted(
  db: Db,
  userId: string,
  id: string,
): Promise<ImprovementRow | undefined> {
  const [row] = await db
    .select()
    .from(improvementRequests)
    .where(and(eq(improvementRequests.userId, userId), eq(improvementRequests.id, id)));
  return row;
}

/**
 * 履歴 1 行の INSERT。`onlyIfChanged` なら直前の文が 1 行以上変えたときだけ書く
 * (audit-log.ts と同じ `changes()` の形)。照合つき UPDATE と同じ batch に置き、
 * UPDATE が 0 行なら履歴も 0 行にする。
 */
function activityStatement(
  database: D1Database,
  input: {
    requestId: string;
    userId: string;
    kind: ImprovementActivityKind;
    fromStatus: ImprovementStatus | null;
    toStatus: ImprovementStatus | null;
    at: string;
  },
  onlyIfChanged: boolean,
): { id: string; statement: D1PreparedStatement } {
  const id = crypto.randomUUID();
  const statement = database
    .prepare(
      `INSERT INTO improvement_request_activities (id,request_id,user_id,kind,from_status,to_status,created_at)
       SELECT ?,?,?,?,?,?,?
        WHERE ?=0 OR changes()>0`,
    )
    .bind(
      id,
      input.requestId,
      input.userId,
      input.kind,
      input.fromStatus,
      input.toStatus,
      input.at,
      onlyIfChanged ? 1 : 0,
    );
  return { id, statement };
}

/**
 * 取引先名・持ち主の名前の辞書を 1 本のクエリで作る (qa-imp-decision-004)。
 * 取引先名は freee の仕訳とサブスク除外の partner 列にある (仕様の `transactions.partner` に当たる表は無い)。
 * リクエストのたびに作って捨て、保存しない。
 */
async function loadMaskDictionary(database: D1Database, userId: string): Promise<MaskDictionary> {
  const { results } = await database
    .prepare(
      `SELECT partner AS term FROM freee_deals WHERE user_id=? AND partner IS NOT NULL
       UNION SELECT partner FROM sub_vendor_exclusions WHERE user_id=?
       UNION SELECT label FROM owner_labels WHERE user_id=?`,
    )
    .bind(userId, userId, userId)
    .all<{ term: string | null }>();
  return buildMaskDictionary(results.map((r) => r.term));
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

const toListSource = (row: Pick<ImprovementRow, keyof ImprovementListSource>): ImprovementListSource => ({
  id: row.id,
  seq: row.seq,
  body: row.body,
  route: row.route,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt,
});

/** 一覧と関連の材料。本文は概要と検索にだけ使い、応答には概要しか出さない */
async function loadListSources(db: Db, userId: string): Promise<ImprovementListSource[]> {
  const rows = await db
    .select({
      id: improvementRequests.id,
      seq: improvementRequests.seq,
      body: improvementRequests.body,
      route: improvementRequests.route,
      status: improvementRequests.status,
      createdAt: improvementRequests.createdAt,
      updatedAt: improvementRequests.updatedAt,
      deletedAt: improvementRequests.deletedAt,
    })
    .from(improvementRequests)
    .where(and(eq(improvementRequests.userId, userId), isNull(improvementRequests.deletedAt)));
  return rows.map(toListSource);
}

function promptFor(
  c: { req: { url: string } },
  row: ImprovementRow,
  token: string,
  expiresAt: string,
): string {
  const diagnostics = parseStoredDiagnostics(row.diagnosticsJson);
  return buildImprovementPrompt({
    origin: origin(c),
    requestId: row.id,
    token,
    expiresAt,
    summary: improvementSummary(row.body),
    route: row.route,
    hasScreenshot: row.screenshotKey !== null,
    diagnosticsCount: diagnostics?.entries.length ?? 0,
    diagnosticsOmitted: row.diagnosticsOmitted,
    viewport: diagnostics?.environment.viewport,
    userAgent: diagnostics?.environment.userAgent,
    capturedAt: diagnostics?.environment.capturedAt,
    entries: diagnostics?.entries,
  });
}

/* -------- 作成 -------- */

const invalidRequest = (message: string, fields?: Record<string, string>) => ({
  error: { code: 'invalid_request', message, ...(fields ? { fields } : {}) },
});

improvementRoute.post('/improvements', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const form = await c.req.formData();
  const text = (name: string): string => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };

  // 欄ごとの理由は core が正本。画面の欄の近くの文と同じものを返す。旧 title 欄は読まない
  const draft = checkImprovementDraft({
    body: text('body'),
    privacyConfirmed: text('privacyConfirmed') === 'true',
    privacyConsented: text('privacyConsented') === 'true',
  });
  const parsed = improvementCreateSchema.safeParse({
    body: text('body'),
    route: text('route'),
    privacyConfirmed: text('privacyConfirmed'),
    privacyConsented: text('privacyConsented'),
  });
  if (!draft.ok || !parsed.success)
    return c.json(
      invalidRequest(
        draft.message ?? `内容(1〜${IMPROVEMENT_NEW_BODY_MAX}文字)を入力してください`,
        draft.fields,
      ),
      400,
    );

  // 画像の不適合は投稿の失敗にする (S4)。黙って画像を落とすと、利用者は添えたつもりのまま送ってしまう
  const file = form.get('screenshot');
  let screenshot: { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > IMPROVEMENT_SCREENSHOT_MAX_BYTES)
      return c.json(
        invalidRequest('画像は 2MB 以下にしてください', { screenshot: '画像は 2MB 以下にしてください' }),
        400,
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffScreenshotType(bytes);
    if (!type)
      return c.json(
        invalidRequest('画像は JPEG か PNG にしてください', {
          screenshot: '画像は JPEG か PNG にしてください',
        }),
        400,
      );
    screenshot = { bytes, type };
  }

  // マスクはクライアントの処理に依存しない (O2)。辞書はこのリクエストのためだけに作る
  const dictionary = await loadMaskDictionary(c.env.DB, userId);
  const route = redactText(parsed.data.route, 500, dictionary);
  const body = redactText(parsed.data.body, IMPROVEMENT_NEW_BODY_MAX, dictionary);
  const diagnostics = parseDiagnosticsField(
    typeof form.get('diagnostics') === 'string' ? (form.get('diagnostics') as string) : null,
    route,
    now,
    dictionary,
  );

  const id = crypto.randomUUID();
  let screenshotKey: string | null = null;
  if (screenshot) {
    screenshotKey = improvementScreenshotR2Key(userId, id);
    await c.env.FILES.put(screenshotKey, screenshot.bytes, {
      httpMetadata: { contentType: screenshot.type },
      customMetadata: { ownerId: userId, kind: 'improvement_screenshot' },
    });
  }

  const token = mintToken();
  const expiresAt = new Date(Date.parse(now) + IMPROVEMENT_TOKEN_TTL_MS).toISOString();
  const created = activityStatement(
    c.env.DB,
    { requestId: id, userId, kind: 'created', fromStatus: null, toStatus: 'open', at: now },
    false,
  );

  try {
    // 採番・依頼の行・作成の履歴を 1 つの batch で書く。番号は削除しても戻さない
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO improvement_request_counters (user_id,last_seq) VALUES (?,1)
         ON CONFLICT(user_id) DO UPDATE SET last_seq=last_seq+1`,
      ).bind(userId),
      c.env.DB.prepare(
        `INSERT INTO improvement_requests
           (id,user_id,seq,title,body,route,status,screenshot_key,screenshot_size,
            diagnostics_json,diagnostics_omitted,token_hash,token_expires_at,token_fetch_count,created_at,updated_at)
         VALUES (?,?,(SELECT last_seq FROM improvement_request_counters WHERE user_id=?),NULL,?,?,'open',?,?,?,?,?,?,0,?,?)`,
      ).bind(
        id,
        userId,
        userId,
        body,
        route,
        screenshotKey,
        screenshot ? screenshot.bytes.byteLength : null,
        JSON.stringify(diagnostics.payload),
        diagnostics.payload.omittedCount,
        await sha256Hex(token),
        expiresAt,
        now,
        now,
      ),
      created.statement,
    ]);
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
      number: formatImprovementNumber(row.seq),
      // 原文はここでしか返らない。以後は /prompt で作り直す
      prompt: promptFor(c, row, token, expiresAt),
      diagnosticsRejected: diagnostics.rejected,
    },
    201,
  );
});

/* -------- 一覧・詳細 -------- */

improvementRoute.get('/improvements', async (c) => {
  const db = getDb(c.env.DB);
  const sources = await loadListSources(db, c.get('userId'));
  // 壊れた query は core が既定へ倒す。範囲外のページは最終ページへ寄せる
  const list = buildImprovementList(
    sources,
    normalizeImprovementListQuery({
      q: c.req.query('q'),
      tab: c.req.query('tab'),
      page: c.req.query('page'),
    }),
  );
  return c.json({
    items: list.items,
    counts: list.counts,
    page: list.page,
    pageSize: list.pageSize,
    total: list.total,
  });
});

improvementRoute.get('/improvements/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const found = await loadRow(db, userId, c.req.param('id'));
  if (!found) return c.json({ error: NOT_FOUND }, 404);
  const row = await purgeIfExpired(c.env, db, found, now);
  const [activities, siblings] = await Promise.all([
    db
      .select()
      .from(improvementRequestActivities)
      .where(
        and(
          eq(improvementRequestActivities.requestId, row.id),
          eq(improvementRequestActivities.userId, userId),
        ),
      ),
    row.route
      ? db
          .select({
            id: improvementRequests.id,
            seq: improvementRequests.seq,
            body: improvementRequests.body,
            route: improvementRequests.route,
            status: improvementRequests.status,
            createdAt: improvementRequests.createdAt,
            updatedAt: improvementRequests.updatedAt,
            deletedAt: improvementRequests.deletedAt,
          })
          .from(improvementRequests)
          .where(
            and(
              eq(improvementRequests.userId, userId),
              eq(improvementRequests.route, row.route),
              isNull(improvementRequests.deletedAt),
            ),
          )
      : Promise.resolve([]),
  ]);
  const diagnostics = parseStoredDiagnostics(row.diagnosticsJson);
  return c.json({
    request: improvementView(row, now),
    number: formatImprovementNumber(row.seq),
    summary: improvementSummary(row.body),
    routeLabel: improvementRouteLabel(row.route),
    diagnosticsSummary: diagnostics ? summarizeDiagnosticEnvironment(diagnostics.environment) : null,
    activities: orderImprovementActivities(activities.map(toActivitySource)),
    related: relatedImprovements(row, siblings.map(toListSource)),
    allowedTransitions: allowedImprovementTransitions(row.status),
    diagnostics,
  });
});

const toActivitySource = (row: ImprovementActivityRow) => ({
  id: row.id,
  kind: row.kind,
  fromStatus: row.fromStatus,
  toStatus: row.toStatus,
  createdAt: row.createdAt,
});

/** スクリーンショットの配信。R2 の公開 URL は作らず、ここを必ず通す */
improvementRoute.get('/improvements/:id/screenshot', async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const found = await loadRow(db, c.get('userId'), c.req.param('id'));
  if (!found) return c.json({ error: NOT_FOUND }, 404);
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
        : { code: 'no_screenshot', message: 'この依頼にスクリーンショットはありません' },
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
  const userId = c.get('userId');
  const now = new Date().toISOString();
  const found = await loadRow(db, userId, c.req.param('id'));
  if (!found) return c.json({ error: NOT_FOUND }, 404);
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
  const reissued = activityStatement(
    c.env.DB,
    { requestId: row.id, userId, kind: 'reissued', fromStatus: null, toStatus: null, at: now },
    true,
  );
  const [update] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE improvement_requests
          SET token_hash=?,token_expires_at=?,token_fetch_count=0,updated_at=?
        WHERE user_id=? AND id=? AND deleted_at IS NULL`,
    ).bind(await sha256Hex(token), expiresAt, now, userId, row.id),
    reissued.statement,
  ]);
  // 読んだ後に削除された場合。トークンは書かれていないので、返す指示文も無い
  if (Number(update.meta.changes ?? 0) === 0) return c.json({ error: NOT_FOUND }, 404);
  return c.json({ prompt: promptFor(c, row, token, expiresAt), expiresAt });
});

improvementRoute.post('/improvements/:id/copied', zValidator('json', improvementCopiedSchema), async (c) => {
  const db = getDb(c.env.DB);
  const now = new Date().toISOString();
  const updated = await db
    .update(improvementRequests)
    .set({ copiedAt: now, copiedTarget: c.req.valid('json').target, updatedAt: now })
    .where(
      and(
        eq(improvementRequests.userId, c.get('userId')),
        eq(improvementRequests.id, c.req.param('id')),
        isNull(improvementRequests.deletedAt),
      ),
    )
    .returning({ id: improvementRequests.id });
  if (!updated.length) return c.json({ error: NOT_FOUND }, 404);
  return c.json({ ok: true, copiedAt: now });
});

improvementRoute.post(
  '/improvements/:id/status',
  zValidator('json', improvementStatusSchema, (result, c) => {
    if (!result.success) return c.json(invalidRequest('状態の値が正しくありません'), 400);
  }),
  async (c) => {
    const db = getDb(c.env.DB);
    const userId = c.get('userId');
    const now = new Date().toISOString();
    const to = c.req.valid('json').status;
    const found = await loadRow(db, userId, c.req.param('id'));
    if (!found) return c.json({ error: NOT_FOUND }, 404);
    // 同じ状態はべき等。何も書かない
    if (found.status === to) return c.json({ request: improvementView(found, now), activity: null });
    const invalidTransition = () =>
      c.json(
        {
          error: {
            code: 'invalid_transition',
            message: 'この状態からは変更できません。画面を読み直してください',
          },
        },
        409,
      );
    if (!canTransitionImprovement(found.status, to)) return invalidTransition();
    const doneAt = nextImprovementDoneAt(found.status, to, found.doneAt, now);
    const changed = activityStatement(
      c.env.DB,
      {
        requestId: found.id,
        userId,
        kind: 'status_changed',
        fromStatus: found.status,
        toStatus: to,
        at: now,
      },
      true,
    );
    // 読んだ時点の状態で照合する。間に別の変更が入っていたら 0 行になり、履歴も書かれない
    const [update] = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE improvement_requests SET status=?,done_at=?,updated_at=?
          WHERE user_id=? AND id=? AND deleted_at IS NULL AND status=?`,
      ).bind(to, doneAt, now, userId, found.id, found.status),
      changed.statement,
    ]);
    if (Number(update.meta.changes ?? 0) === 0) return invalidTransition();
    const row = await loadRow(db, userId, found.id);
    if (!row) return c.json({ error: NOT_FOUND }, 404);
    return c.json({
      request: improvementView(row, now),
      activity: describeImprovementActivity({
        id: changed.id,
        kind: 'status_changed',
        fromStatus: found.status,
        toStatus: to,
        createdAt: now,
      }),
    });
  },
);

/* -------- 論理削除と復元 -------- */

improvementRoute.delete('/improvements/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const deleted = activityStatement(
    c.env.DB,
    { requestId: id, userId, kind: 'deleted', fromStatus: null, toStatus: null, at: now },
    true,
  );
  const [update] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE improvement_requests SET deleted_at=?,updated_at=?
        WHERE user_id=? AND id=? AND deleted_at IS NULL`,
    ).bind(now, now, userId, id),
    deleted.statement,
  ]);
  if (Number(update.meta.changes ?? 0) > 0) return c.json({ id, deletedAt: now });
  // 2 回目の削除はべき等。最初の時刻をそのまま返す
  const existing = await loadOwnRowIncludingDeleted(getDb(c.env.DB), userId, id);
  if (!existing?.deletedAt) return c.json({ error: NOT_FOUND }, 404);
  return c.json({ id, deletedAt: existing.deletedAt });
});

improvementRoute.post('/improvements/:id/restore', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const restored = activityStatement(
    c.env.DB,
    { requestId: id, userId, kind: 'restored', fromStatus: null, toStatus: null, at: now },
    true,
  );
  // seq は変えない。同じ id と IMP 番号のまま戻る
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE improvement_requests SET deleted_at=NULL,updated_at=?
        WHERE user_id=? AND id=? AND deleted_at IS NOT NULL`,
    ).bind(now, userId, id),
    restored.statement,
  ]);
  const row = await loadOwnRowIncludingDeleted(db, userId, id);
  if (!row || row.deletedAt) return c.json({ error: NOT_FOUND }, 404);
  return c.json({ request: improvementView(row, now), number: formatImprovementNumber(row.seq) });
});

/* ======== エージェント用(使い捨てトークン認証) ======== */

export const improvementAgentRoute = new Hono<AgentCtx>();

/**
 * 期限切れと取得回数超過は区別した拒否理由を返す。汎用 500 へ丸めない。
 * トークン値そのものはログにも応答にも出さない。
 * 削除中の依頼は、トークンが生きていても見えない (照合の条件に deleted_at IS NULL を含める)。
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
  if (row.deletedAt) return c.json({ error: NOT_FOUND }, 404);
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
    .where(and(eq(improvementRequests.id, row.id), isNull(improvementRequests.deletedAt)));
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
        number: formatImprovementNumber(row.seq),
        // 件名は廃止した。エージェントには本文の先頭から作る概要を渡す
        title: improvementSummary(row.body),
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
  /** 期限の検索で拾った行の数 (添付の期限と完全消去の期限の合計) */
  selected: number;
  /** 添付を消した行の数 */
  purged: number;
  /** 論理削除から 30 日を過ぎて、行・履歴・画像ごと消した数 */
  erased: number;
  failed: number;
  /** D1 に対応する行が無い R2 オブジェクトを消した件数 */
  orphans: number;
  /** この実行で照合したR2 object数 */
  orphanScanned: number;
  /** 投稿処理中の可能性があり、5分の猶予で次回へ送った件数 */
  orphanDeferredRecent: number;
  /** R2の続きpageがあるか */
  orphanHasMore: boolean;
  /** R2の末尾へ到達し、次回は先頭から始まるか */
  orphanCycleCompleted: boolean;
}

/**
 * 夜間の保持処理。新規 Cron は増やさない (D-imp-008)。
 *  - 完了から30日: 添付だけを消す。本文・状態・対応記録は残す
 *  - 論理削除から30日: R2 の画像を消し、成功した行だけを DELETE する (履歴は CASCADE)
 * 2 種類を 1 本の検索で古い順に 500 件まで読む。D1 は 4 本 (検索・UPDATE・DELETE・孤立画像の照合)。
 */
export async function runImprovementRetention(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  now = new Date().toISOString(),
): Promise<ImprovementRetentionResult> {
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) throw new Error('invalid_improvement_retention_time');
  const cutoff = new Date(nowMs - IMPROVEMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // 期限超過だけを古い順に最大500件読む。本文・診断・利用者IDはCronへ持ち出さない。
  // 削除中の行は完全消去を優先する (添付だけ消しても翌晩に行ごと消えるため)。
  const due = await env.DB.prepare(
    `SELECT id,screenshot_key,kind FROM (
       SELECT id,screenshot_key,'erase' AS kind,deleted_at AS due_at
         FROM improvement_requests
        WHERE deleted_at IS NOT NULL AND julianday(deleted_at) IS NOT NULL AND deleted_at<=?
       UNION ALL
       SELECT id,screenshot_key,'purge' AS kind,done_at AS due_at
         FROM improvement_requests
        WHERE deleted_at IS NULL AND status='done' AND done_at IS NOT NULL AND purged_at IS NULL
          AND julianday(done_at) IS NOT NULL AND done_at<=?
     )
     ORDER BY due_at,id
     LIMIT 500`,
  )
    .bind(cutoff, cutoff)
    .all<{ id: string; screenshot_key: string | null; kind: 'erase' | 'purge' }>();
  const purgeIds: string[] = [];
  const eraseIds: string[] = [];
  let failed = 0;
  // R2は1件ごとに成否が分かれる。成功IDだけを後段の集合更新へ渡す。
  for (const row of due.results) {
    try {
      if (row.screenshot_key) await env.FILES.delete(row.screenshot_key);
      (row.kind === 'erase' ? eraseIds : purgeIds).push(row.id);
    } catch {
      // D1を触らないため、失敗行は次回も同じ対象として拾われる。
      failed += 1;
    }
  }

  let purged = 0;
  if (purgeIds.length) {
    try {
      // D1のbind上限100を避け、500 IDをJSON 1 paramの集合更新へ閉じ込める。
      // idはこのserviceが発行するUUIDなので、500件でもJSONは約20KBに有界である。
      const updated = await env.DB.prepare(
        `UPDATE improvement_requests
            SET screenshot_key=NULL,screenshot_size=NULL,diagnostics_json=NULL,
                token_hash=NULL,token_expires_at=NULL,purged_at=?,updated_at=?
          WHERE purged_at IS NULL AND deleted_at IS NULL
            AND id IN (SELECT CAST(value AS TEXT) FROM json_each(?))`,
      )
        .bind(now, now, JSON.stringify(purgeIds))
        .run();
      purged = Number(updated.meta.changes ?? 0);
      failed += purgeIds.length - purged;
    } catch {
      // R2 deleteは冪等。集合更新が失敗した全行を未処理のまま次回へ回す。
      failed += purgeIds.length;
    }
  }

  let erased = 0;
  if (eraseIds.length) {
    try {
      // 条件に deleted_at を残す。検索の後に『元に戻す』が入った行は消さない。
      // 件数は RETURNING で数える。D1 の meta.changes は CASCADE で消えた履歴の行まで含むため
      const removed = await env.DB.prepare(
        `DELETE FROM improvement_requests
          WHERE deleted_at IS NOT NULL AND deleted_at<=?
            AND id IN (SELECT CAST(value AS TEXT) FROM json_each(?))
          RETURNING id`,
      )
        .bind(cutoff, JSON.stringify(eraseIds))
        .all<{ id: string }>();
      erased = removed.results.length;
      failed += eraseIds.length - erased;
    } catch {
      failed += eraseIds.length;
    }
  }
  const orphanSweep = await sweepImprovementOrphans(env, nowMs);
  return {
    selected: due.results.length,
    purged,
    erased,
    failed,
    orphans: orphanSweep.removed,
    orphanScanned: orphanSweep.scanned,
    orphanDeferredRecent: orphanSweep.deferredRecent,
    orphanHasMore: orphanSweep.hasMore,
    orphanCycleCompleted: orphanSweep.cycleCompleted,
  };
}
