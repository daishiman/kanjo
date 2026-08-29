/**
 * レシート・領収書の添付。原本はR2、D1にはメタデータと削除再試行状態を持つ。
 * 添付先の文字列解釈はcoreのAttachmentTargetに集約する。
 */
import {
  ATTACHMENT_MAX_PER_TARGET,
  type Attachment,
  type AttachmentCleanupStage,
  type AttachmentTarget,
  attachmentContentTypeFromSignature,
  attachmentQuotaUsage,
  attachmentR2Key,
  attachmentRejectReason,
  attachmentTargetColumns,
  attachmentTargetFromColumns,
  monthOf,
  parseAttachmentTarget,
  resolveAttachmentType,
  sanitizeAttachmentFilename,
  serializeAttachmentTarget,
} from '@kanjo/core';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  attachmentArchiveRequestSchema,
  reconcileAttachmentArchive,
  recoverAttachmentArchiveMetadata,
} from '../attachment-archive.js';
import {
  AttachmentAvailabilityError,
  getAvailableAttachmentObject,
  resolveAttachmentAvailability,
} from '../attachment-availability.js';
import {
  attachmentRuntimeConfig,
  enqueueAttachmentCleanup,
  loadAttachmentUsage,
  processAttachmentCleanupNow,
} from '../attachment-recovery.js';
import type { AuthEnv } from '../auth.js';
import { inClauseChunkSize } from '../d1-limits.js';
import * as s from '../db/schema.js';
import { type Db, getDb } from '../store.js';

type Ctx = { Bindings: AuthEnv; Variables: { userId: string } };
type AttachmentRow = typeof s.attachments.$inferSelect;

export const attachmentsRoute = new Hono<Ctx>();

const PRIVATE_NO_STORE = 'private, no-store';
const LIST_STATES = ['ready', 'delete_pending', 'delete_failed'] as const;

// 金融証憑のメタデータ/原本/エラーも中間キャッシュに残さない。
attachmentsRoute.use('*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', PRIVATE_NO_STORE);
});

const storedTarget = (row: Pick<AttachmentRow, 'targetKind' | 'targetKey'>): AttachmentTarget => {
  const target = attachmentTargetFromColumns(row.targetKind, row.targetKey);
  if (!target) throw new Error('invalid_attachment_target');
  return target;
};

const rowToAttachment = (
  row: AttachmentRow,
  originalAvailable = row.objectDeletedAt === null,
): Attachment => {
  const target = storedTarget(row);
  const cleanupStage: AttachmentCleanupStage = row.cleanupDeadLetterAt
    ? 'dead_letter'
    : originalAvailable && row.state === 'delete_failed'
      ? 'object_delete_failed'
      : originalAvailable && (row.objectDeletedAt !== null || row.state === 'delete_pending')
        ? 'object_delete_pending'
        : row.objectDeletedAt
          ? 'metadata_delete_pending'
          : !originalAvailable
            ? 'original_missing'
            : 'none';
  return {
    id: row.id,
    target,
    targetId: serializeAttachmentTarget(target),
    filename: row.filename,
    contentType: row.contentType,
    size: row.size,
    state: row.state,
    deleteAttempts: row.deleteAttempts,
    retryable: cleanupStage !== 'none',
    originalAvailable,
    cleanupStage,
    orphaned: row.parentMissingAt !== null,
    createdAt: row.createdAt,
  };
};

const targetWhere = (userId: string, target: AttachmentTarget) => {
  const { targetKind, targetKey } = attachmentTargetColumns(target);
  return and(
    eq(s.attachments.userId, userId),
    eq(s.attachments.targetKind, targetKind),
    eq(s.attachments.targetKey, targetKey),
  );
};

const normalizeTarget = (target: AttachmentTarget | string): AttachmentTarget | null =>
  typeof target === 'string' ? parseAttachmentTarget(target) : target;

/** 存在しない明細に原本が溜まらないよう、型に応じた正本tableを見る */
type TargetStatus = 'missing' | 'attachable' | 'unstable_identity';

async function targetStatus(db: Db, userId: string, target: AttachmentTarget): Promise<TargetStatus> {
  if (target.kind === 'cash') {
    const [row] = await db
      .select({ id: s.cashEntries.id })
      .from(s.cashEntries)
      .where(and(eq(s.cashEntries.userId, userId), eq(s.cashEntries.id, target.id)));
    return row === undefined ? 'missing' : 'attachable';
  }
  const [row] = await db
    .select({ id: s.mfTransactions.id, identityStable: s.mfTransactions.identityStable })
    .from(s.mfTransactions)
    .where(and(eq(s.mfTransactions.userId, userId), eq(s.mfTransactions.txId, target.txId)));
  if (!row) return 'missing';
  return row.identityStable === 1 ? 'attachable' : 'unstable_identity';
}

/**
 * 証憑の件数を数えるときに、1文へ載せる明細IDの数。
 * IN() のほかに user_id と target_kind の2つを同じ文に載せるので、その分だけ減らす。
 *
 * 本番で 1 ヶ月に 107 件の明細が集まったとき、ここが上限と同じ 100 だったために
 * 固定条件2つを足して 102 個になり、公私仕分けの一覧が丸ごと 500 で開けなくなった。
 * 「1ヶ月の明細が100件を超えたときだけ落ちる」ので、平常時は誰も踏まない。
 */
export const ATTACHMENT_COUNT_CHUNK = inClauseChunkSize(2);

export type AvailableAttachmentRow = Pick<
  AttachmentRow,
  | 'id'
  | 'targetKind'
  | 'targetKey'
  | 'r2Key'
  | 'filename'
  | 'contentType'
  | 'size'
  | 'createdAt'
  | 'objectDeletedAt'
>;

/**
 * 指定した親明細に紐づき、R2原本が現在も存在する証憑だけを返す。
 * 件数表示と申告用ZIPの双方がこの同じ棚卸しを使い、D1のstateだけで原本存在を推測しない。
 */
export async function loadAvailableAttachmentRows(
  db: Db,
  files: R2Bucket,
  userId: string,
  targets: readonly (AttachmentTarget | string)[],
): Promise<AvailableAttachmentRow[]> {
  const normalized = targets
    .map(normalizeTarget)
    .filter((target): target is AttachmentTarget => target !== null);
  const unique = [
    ...new Map(normalized.map((target) => [serializeAttachmentTarget(target), target])).values(),
  ];
  if (!unique.length) return [];

  const candidates: AvailableAttachmentRow[] = [];

  for (const targetKind of ['cash', 'mf'] as const) {
    const keys = unique
      .filter((target) => target.kind === targetKind)
      .map((target) => attachmentTargetColumns(target).targetKey);
    for (let i = 0; i < keys.length; i += ATTACHMENT_COUNT_CHUNK) {
      const rows = await db
        .select({
          id: s.attachments.id,
          targetKind: s.attachments.targetKind,
          targetKey: s.attachments.targetKey,
          r2Key: s.attachments.r2Key,
          filename: s.attachments.filename,
          contentType: s.attachments.contentType,
          size: s.attachments.size,
          createdAt: s.attachments.createdAt,
          objectDeletedAt: s.attachments.objectDeletedAt,
        })
        .from(s.attachments)
        .where(
          and(
            eq(s.attachments.userId, userId),
            eq(s.attachments.targetKind, targetKind),
            inArray(s.attachments.targetKey, keys.slice(i, i + ATTACHMENT_COUNT_CHUNK)),
          ),
        );
      candidates.push(...rows);
    }
  }
  const availability = await resolveAttachmentAvailability(files, candidates);
  return candidates.filter((row) => availability.get(row.r2Key) === true);
}

/** object_deleted_atがNULLの物理原本だけを数える。操作stateを原本存在の代理にしない。 */
export async function loadAttachmentCounts(
  db: Db,
  files: R2Bucket,
  userId: string,
  targets: readonly (AttachmentTarget | string)[],
): Promise<Record<string, number>> {
  const rows = await loadAvailableAttachmentRows(db, files, userId, targets);
  return attachmentCountsFromRows(rows);
}

/** 同じR2棚卸し結果から件数とZIP対象を分岐させ、再HEADと判定差を作らない。 */
export function attachmentCountsFromRows(
  rows: readonly Pick<AvailableAttachmentRow, 'targetKind' | 'targetKey'>[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const target = attachmentTargetFromColumns(row.targetKind, row.targetKey);
    if (!target) continue;
    const key = serializeAttachmentTarget(target);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export interface AttachmentDeleteSummary {
  deleted: number;
  failed: number;
}

type DeleteOriginalResult = 'r2_deleted' | 'not_found' | 'delete_failed';

/** 単体削除はroute/scheduled共通ledgerへ登録し、そのjobを同期実行する。 */
async function deleteStoredAttachment(
  env: AuthEnv,
  userId: string,
  row: Pick<AttachmentRow, 'id' | 'r2Key' | 'objectDeletedAt'>,
): Promise<'deleted' | 'not_found' | 'object_delete_failed' | 'metadata_cleanup_failed'> {
  const db = getDb(env.DB);
  const [pending] = await db
    .update(s.attachments)
    .set({
      state: 'delete_pending',
      deleteAttempts: sql`${s.attachments.deleteAttempts} + 1`,
      deleteRequestedAt: new Date().toISOString(),
      lastDeleteError: null,
    })
    .where(and(eq(s.attachments.userId, userId), eq(s.attachments.id, row.id)))
    .returning({ id: s.attachments.id });
  if (!pending) return 'not_found';
  const jobId = await enqueueAttachmentCleanup(env.DB, {
    userId,
    attachmentId: row.id,
    r2Key: row.r2Key,
    reason: 'attachment_delete',
    action: row.objectDeletedAt ? 'delete_metadata' : 'delete_object',
  });
  const result = await processAttachmentCleanupNow(env, jobId);
  if (result === 'completed') return 'deleted';
  const [after] = await db
    .select({ objectDeletedAt: s.attachments.objectDeletedAt })
    .from(s.attachments)
    .where(and(eq(s.attachments.userId, userId), eq(s.attachments.id, row.id)));
  return after?.objectDeletedAt ? 'metadata_cleanup_failed' : 'object_delete_failed';
}

/** 親削除はR2だけを先に確定し、metadataは親と同じD1 batchへ残す。 */
async function deleteAttachmentOriginalForParent(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  userId: string,
  row: Pick<AttachmentRow, 'id' | 'r2Key' | 'objectDeletedAt'>,
): Promise<DeleteOriginalResult> {
  if (row.objectDeletedAt) {
    try {
      if ((await env.FILES.head(row.r2Key)) === null) return 'r2_deleted';
    } catch {
      return 'delete_failed';
    }
  }
  const now = new Date().toISOString();
  const jobId = await enqueueAttachmentCleanup(env.DB, {
    userId,
    attachmentId: row.id,
    r2Key: row.r2Key,
    reason: 'attachment_delete',
    notBefore: now,
  });
  await env.DB.prepare(
    `UPDATE attachments
        SET state='delete_pending',delete_attempts=delete_attempts+1,delete_requested_at=?,last_delete_error=NULL
      WHERE id=? AND user_id=?`,
  )
    .bind(now, row.id, userId)
    .run();
  try {
    await env.FILES.delete(row.r2Key);
  } catch {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE attachments SET state='delete_failed',last_delete_error='r2_delete_failed'
          WHERE id=? AND user_id=?`,
      ).bind(row.id, userId),
      env.DB.prepare(
        `UPDATE attachment_cleanup_jobs
            SET state='retry',attempts=attempts+1,last_error='r2_delete_failed',updated_at=?
          WHERE id=?`,
      ).bind(now, jobId),
    ]);
    return 'delete_failed';
  }
  // R2成功を単調factとして先に永続化する。後続job更新が失敗しても
  // scheduledはdelete_objectを冪等再実行し、metadata段階へ収束できる。
  try {
    await env.DB.prepare(
      `UPDATE attachments
          SET object_deleted_at=COALESCE(object_deleted_at,?),state='delete_pending',last_delete_error=NULL
        WHERE id=? AND user_id=?`,
    )
      .bind(now, row.id, userId)
      .run();
    await env.DB.prepare(
      `UPDATE attachment_cleanup_jobs
          SET action='delete_metadata',state='pending',not_before=?,last_error=NULL,updated_at=?
        WHERE id=?`,
    )
      .bind(now, now, jobId)
      .run();
    return 'r2_deleted';
  } catch {
    await env.DB.prepare(
      `UPDATE attachment_cleanup_jobs
          SET state='retry',attempts=attempts+1,last_error='d1_object_fact_failed_after_r2',updated_at=?
        WHERE id=?`,
    )
      .bind(now, jobId)
      .run();
    return 'delete_failed';
  }
}

/**
 * 親明細削除の事前処理。R2原本だけを冪等削除し、metadataはdelete_pendingで残す。
 * 親・metadata・集計は呼び出し元の単一D1 batchで確定するため、batch失敗後も再開できる。
 */
export async function prepareAttachmentOriginalsForParentDelete(
  db: Db,
  files: R2Bucket,
  userId: string,
  targetInput: AttachmentTarget | string,
): Promise<AttachmentDeleteSummary> {
  const target = normalizeTarget(targetInput);
  if (!target) return { deleted: 0, failed: 0 };
  const rows = await db.select().from(s.attachments).where(targetWhere(userId, target));
  const summary: AttachmentDeleteSummary = { deleted: 0, failed: 0 };
  for (const row of rows) {
    const result = await deleteAttachmentOriginalForParent({ DB: db.$client, FILES: files }, userId, row);
    if (result === 'r2_deleted') summary.deleted += 1;
    else if (result === 'delete_failed') summary.failed += 1;
  }
  return summary;
}

/** R2削除済みmetadataを親明細と同じD1 batchに参加させる。 */
export function deleteAttachmentMetadataForTargetQuery(
  db: Db,
  userId: string,
  targetInput: AttachmentTarget | string,
) {
  const target = normalizeTarget(targetInput);
  if (!target) throw new Error('invalid_attachment_target');
  return db.delete(s.attachments).where(targetWhere(userId, target));
}

/** 親削除batch前に、R2削除済みkeyをarchive復活不可の単調factへ移す。 */
export async function recordAttachmentTombstonesForTarget(
  db: Db,
  userId: string,
  targetInput: AttachmentTarget | string,
): Promise<void> {
  const target = normalizeTarget(targetInput);
  if (!target) throw new Error('invalid_attachment_target');
  const columns = attachmentTargetColumns(target);
  await db.$client
    .prepare(
      `INSERT INTO attachment_object_tombstones (user_id,r2_key,deleted_at)
       SELECT user_id,r2_key,COALESCE(object_deleted_at,?)
         FROM attachments
        WHERE user_id=? AND target_kind=? AND target_key=? AND delete_requested_at IS NOT NULL
       ON CONFLICT(user_id,r2_key) DO UPDATE SET
         deleted_at=excluded.deleted_at`,
    )
    .bind(new Date().toISOString(), userId, columns.targetKind, columns.targetKey)
    .run();
}

const sha256Hex = async (buf: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

attachmentsRoute.get('/attachments', async (c) => {
  const userId = c.get('userId');
  const target = parseAttachmentTarget(c.req.query('target') ?? '');
  if (!target) return c.json({ error: { code: 'invalid_input', message: '添付先を指定してください' } }, 400);
  const [rows, usage] = await Promise.all([
    getDb(c.env.DB)
      .select()
      .from(s.attachments)
      .where(and(targetWhere(userId, target), inArray(s.attachments.state, [...LIST_STATES]))),
    loadAttachmentUsage(c.env, userId),
  ]);
  const availability = await resolveAttachmentAvailability(c.env.FILES, rows);
  return c.json({
    attachments: rows
      .map((row) => rowToAttachment(row, availability.get(row.r2Key) ?? false))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    limit: ATTACHMENT_MAX_PER_TARGET,
    usage,
  });
});

/** MF洗替えで親が消えた証憑の管理導線。原本は明示削除まで保持する。 */
attachmentsRoute.get('/attachments/orphans', async (c) => {
  const userId = c.get('userId');
  const [rows, usage] = await Promise.all([
    getDb(c.env.DB)
      .select()
      .from(s.attachments)
      .where(
        and(
          eq(s.attachments.userId, userId),
          eq(s.attachments.targetKind, 'mf'),
          isNotNull(s.attachments.parentMissingAt),
        ),
      ),
    loadAttachmentUsage(c.env, userId),
  ]);
  const availability = await resolveAttachmentAvailability(c.env.FILES, rows);
  return c.json({
    attachments: rows
      .map((row) => rowToAttachment(row, availability.get(row.r2Key) ?? false))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    usage,
  });
});

/** Settings等から対象明細なしでも参照できる、利用者別のauthoritative quota。 */
attachmentsRoute.get('/attachments/quota', async (c) =>
  c.json({ usage: await loadAttachmentUsage(c.env, c.get('userId')) }),
);

attachmentsRoute.post('/attachments', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: { code: 'invalid_input', message: 'ファイルを受け取れませんでした' } }, 400);
  }
  const target = parseAttachmentTarget(String(form.get('target') ?? ''));
  const file = form.get('file');
  if (!target) return c.json({ error: { code: 'invalid_input', message: '添付先を指定してください' } }, 400);
  if (!(file instanceof File))
    return c.json({ error: { code: 'invalid_input', message: 'ファイルを選んでください' } }, 400);
  const targetState = await targetStatus(db, userId, target);
  if (targetState === 'missing')
    return c.json({ error: { code: 'not_found', message: '添付先の明細が見つかりません' } }, 404);
  if (targetState === 'unstable_identity')
    return c.json(
      {
        error: {
          code: 'unstable_attachment_target',
          message: 'ID列のない取込明細には添付できません。ID列を含むMFファイルで再取込してください',
        },
      },
      409,
    );

  const existing = await db
    .select({ id: s.attachments.id })
    .from(s.attachments)
    .where(and(targetWhere(userId, target), isNull(s.attachments.objectDeletedAt)));
  // 拡張子はraw file.nameから解決する。先に長さを詰めると.pdf等が消える。
  const type = resolveAttachmentType(file.type, file.name);
  const reject = attachmentRejectReason({
    contentType: file.type,
    filename: file.name,
    size: file.size,
    existingCount: existing.length,
  });
  if (reject) return c.json({ error: reject }, reject.code === 'too_many' ? 409 : 400);
  if (!type)
    return c.json(
      { error: { code: 'unsupported_type', message: '写真(JPEG/PNG/WebP/HEIC)か PDF を添付してください' } },
      400,
    );
  const filename = sanitizeAttachmentFilename(file.name);

  const buf = await file.arrayBuffer();
  const detectedType = attachmentContentTypeFromSignature(new Uint8Array(buf));
  if (!detectedType || detectedType !== type)
    return c.json(
      {
        error: {
          code: 'content_mismatch',
          message: 'ファイルの中身と形式が一致しません。元の写真またはPDFを選び直してください',
        },
      },
      400,
    );
  const usage = await loadAttachmentUsage(c.env, userId);
  const nextUsage = attachmentQuotaUsage(usage.usedBytes, file.size, usage.limitBytes);
  if (!nextUsage.accepted)
    return c.json(
      {
        error: {
          code: 'attachment_quota_exceeded',
          message: '証憑の保管容量が上限に達するため添付できません。不要な証憑を削除してください',
        },
        usage,
      },
      413,
    );
  const contentHash = await sha256Hex(buf);
  const duplicateWhere = and(targetWhere(userId, target), eq(s.attachments.contentHash, contentHash));
  const [duplicate] = await db.select({ id: s.attachments.id }).from(s.attachments).where(duplicateWhere);
  if (duplicate)
    return c.json(
      { error: { code: 'duplicate', message: 'この明細には同じ内容のファイルが既に添付されています' } },
      409,
    );

  const now = new Date().toISOString();
  const key = attachmentR2Key(userId, monthOf(now.slice(0, 10)), crypto.randomUUID(), type);
  const intentId = await enqueueAttachmentCleanup(c.env.DB, {
    userId,
    r2Key: key,
    size: file.size,
    reason: 'upload_intent',
    // live requestとの競合を避け、失敗時だけ次回Cronが引き継ぐ。
    notBefore: new Date(Date.now() + 5 * 60_000).toISOString(),
    now,
  });
  await c.env.FILES.put(key, buf, {
    httpMetadata: { contentType: type },
    customMetadata: { ownerId: userId, contentHash },
  });
  let inserted: AttachmentRow;
  try {
    const targetColumns = attachmentTargetColumns(target);
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO attachments
         (user_id,target_kind,target_key,r2_key,filename,content_type,size,content_hash,state,
          delete_attempts,delete_requested_at,last_delete_error,object_deleted_at,parent_missing_at,
          cleanup_dead_letter_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,'ready',0,NULL,NULL,NULL,NULL,NULL,?)`,
      ).bind(
        userId,
        targetColumns.targetKind,
        targetColumns.targetKey,
        key,
        filename,
        type,
        file.size,
        contentHash,
        now,
      ),
      c.env.DB.prepare('DELETE FROM attachment_cleanup_jobs WHERE id=?').bind(intentId),
    ]);
    const [row] = await db.select().from(s.attachments).where(eq(s.attachments.r2Key, key));
    if (!row) throw new Error('attachment_commit_missing');
    inserted = row;
  } catch (error) {
    await processAttachmentCleanupNow(c.env, intentId);
    const [conflict] = await db.select({ id: s.attachments.id }).from(s.attachments).where(duplicateWhere);
    if (conflict)
      return c.json(
        { error: { code: 'duplicate', message: 'この明細には同じ内容のファイルが既に添付されています' } },
        409,
      );
    if (error instanceof Error && /unique/i.test(error.message))
      return c.json(
        {
          error: {
            code: 'attachment_conflict',
            message: '添付の状態が更新されました。一覧を読み直してもう一度お試しください',
          },
        },
        409,
      );
    throw error;
  }
  try {
    const availability = await resolveAttachmentAvailability(c.env.FILES, [inserted]);
    return c.json({ attachment: rowToAttachment(inserted, availability.get(inserted.r2Key) === true) }, 201);
  } catch (error) {
    if (!(error instanceof AttachmentAvailabilityError)) throw error;
    return c.json(
      {
        attachment: rowToAttachment(inserted, false),
        error: {
          code: 'attachment_availability_unavailable',
          message:
            '添付は保存済みです。原本の保管状況を確認できないため、同じファイルを再送せず一覧を読み直してください',
          committed: true,
          retryable: false,
        },
      },
      503,
    );
  }
});

attachmentsRoute.post('/attachments/archive/reconcile', async (c) => {
  const parsed = attachmentArchiveRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return c.json(
      { error: { code: 'invalid_attachment_archive', message: '証憑の棚卸データを読み取れません' } },
      400,
    );
  const report = await reconcileAttachmentArchive(
    c.env,
    c.get('userId'),
    parsed.data.attachmentArchive.records,
  );
  return c.json({ ok: true, report });
});

attachmentsRoute.post('/attachments/archive/recover', async (c) => {
  const parsed = attachmentArchiveRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || parsed.data.confirm !== true)
    return c.json(
      { error: { code: 'recovery_confirmation_required', message: '管理情報を復元する確認が必要です' } },
      400,
    );
  const result = await recoverAttachmentArchiveMetadata(
    c.env,
    c.get('userId'),
    parsed.data.attachmentArchive.records,
  );
  if (!result.ok)
    return c.json(
      {
        ok: false,
        error: {
          code: 'attachment_archive_incomplete',
          message:
            result.recovered > 0
              ? '一致した原本の管理情報だけ復元しました。欠損または不一致の原本は復元していません'
              : '原本の欠損または不一致があるため、管理情報は復元しませんでした',
        },
        recovered: result.recovered,
        alreadyPresent: result.alreadyPresent,
        skipped: result.skipped,
        report: result.report,
      },
      409,
    );
  return c.json(result);
});

attachmentsRoute.get('/attachments/:id/content', async (c) => {
  const userId = c.get('userId');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0)
    return c.json({ error: { code: 'invalid_input', message: '添付が見つかりません' } }, 400);
  const [row] = await getDb(c.env.DB)
    .select()
    .from(s.attachments)
    .where(and(eq(s.attachments.userId, userId), eq(s.attachments.id, id)));
  if (!row) return c.json({ error: { code: 'not_found', message: '添付が見つかりません' } }, 404);
  if (row.objectDeletedAt)
    return c.json(
      {
        error: {
          code: 'attachment_original_deleted',
          message: '原本は削除済みで、管理情報の後処理中です',
        },
      },
      410,
    );
  const object = await getAvailableAttachmentObject(c.env.FILES, row);
  if (!object)
    return c.json(
      {
        error: { code: 'attachment_original_missing', message: '添付の原本が保管先に見つかりません' },
      },
      404,
    );
  return new Response(object.body, {
    headers: {
      'Content-Type': row.contentType,
      'Content-Length': String(row.size),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

attachmentsRoute.delete('/attachments/:id', async (c) => {
  const userId = c.get('userId');
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0)
    return c.json({ error: { code: 'invalid_input', message: '添付が見つかりません' } }, 400);
  const db = getDb(c.env.DB);
  const [row] = await db
    .select()
    .from(s.attachments)
    .where(and(eq(s.attachments.userId, userId), eq(s.attachments.id, id)));
  if (!row) return c.json({ error: { code: 'not_found', message: '添付が見つかりません' } }, 404);

  const result = await deleteStoredAttachment(c.env, userId, row);
  if (result === 'object_delete_failed' || result === 'metadata_cleanup_failed')
    return c.json(
      {
        error: {
          code: 'attachment_delete_failed',
          message:
            result === 'metadata_cleanup_failed'
              ? '原本は削除済みですが、管理情報を整理できませんでした。時間をおいて再試行してください'
              : '原本を削除できませんでした。時間をおいてもう一度お試しください',
          retryable: true,
        },
      },
      503,
    );
  if (result === 'not_found')
    return c.json({ error: { code: 'not_found', message: '添付が見つかりません' } }, 404);
  return c.json({ ok: true });
});
