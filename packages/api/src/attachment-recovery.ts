import {
  ATTACHMENT_RETENTION_DEFAULTS,
  ATTACHMENT_USER_QUOTA_BYTES,
  attachmentQuotaUsage,
} from '@kanjo/core';
import type { AuthEnv } from './auth.js';

export interface AttachmentRuntimeConfig {
  quotaBytes: number;
  cleanupGraceDays: number;
  importUploadDays: number;
  reconcileBatchSize: number;
  maxAttempts: number;
}

const configuredInteger = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max ? value : fallback;
};

/** 非secret varsは不正値で起動不能にせず、安全なSSOT既定値へ戻す。 */
export function attachmentRuntimeConfig(env: AuthEnv): AttachmentRuntimeConfig {
  return {
    quotaBytes: configuredInteger(env.ATTACHMENT_QUOTA_BYTES, ATTACHMENT_USER_QUOTA_BYTES, 1, 10 * 1024 ** 3),
    cleanupGraceDays: configuredInteger(
      env.ATTACHMENT_CLEANUP_GRACE_DAYS,
      ATTACHMENT_RETENTION_DEFAULTS.cleanupGraceDays,
      1,
      90,
    ),
    importUploadDays: configuredInteger(
      env.ATTACHMENT_IMPORT_UPLOAD_DAYS,
      ATTACHMENT_RETENTION_DEFAULTS.importUploadDays,
      1,
      365,
    ),
    reconcileBatchSize: configuredInteger(
      env.ATTACHMENT_RECONCILE_BATCH_SIZE,
      ATTACHMENT_RETENTION_DEFAULTS.reconcileBatchSize,
      1,
      10,
    ),
    maxAttempts: configuredInteger(
      env.ATTACHMENT_CLEANUP_MAX_ATTEMPTS,
      ATTACHMENT_RETENTION_DEFAULTS.maxAttempts,
      1,
      10,
    ),
  };
}

export async function loadAttachmentUsage(env: Pick<AuthEnv, 'DB'> & Partial<AuthEnv>, userId: string) {
  const config = attachmentRuntimeConfig(env as AuthEnv);
  const row = await env.DB.prepare(
    `SELECT
       COALESCE((SELECT SUM(size) FROM attachments
                  WHERE user_id=? AND object_deleted_at IS NULL), 0)
       + COALESCE((SELECT SUM(size) FROM attachment_cleanup_jobs
                    WHERE user_id=? AND action='delete_object'), 0) AS used_bytes`,
  )
    .bind(userId, userId)
    .first<{ used_bytes: number }>();
  return attachmentQuotaUsage(row?.used_bytes ?? 0, 0, config.quotaBytes);
}

export type AttachmentCleanupReason = 'upload_intent' | 'attachment_delete' | 'import_retention';

export interface EnqueueAttachmentCleanup {
  userId: string;
  attachmentId?: number | null;
  importId?: number | null;
  r2Key: string;
  size?: number;
  reason: AttachmentCleanupReason;
  action?: 'delete_object' | 'delete_metadata';
  notBefore?: string;
  now?: string;
}

/** R2操作より前に呼び、processが落ちてもkeyを失わない。 */
export async function enqueueAttachmentCleanup(
  db: D1Database,
  input: EnqueueAttachmentCleanup,
): Promise<number> {
  const now = input.now ?? new Date().toISOString();
  const notBefore = input.notBefore ?? now;
  const row = await db
    .prepare(
      `INSERT INTO attachment_cleanup_jobs
       (user_id,attachment_id,import_id,r2_key,size,action,reason,state,attempts,not_before,last_error,created_at,updated_at)
       VALUES (?,?,?,?,?, ?,?,'pending',0,?,NULL,?,?)
       ON CONFLICT(user_id,r2_key) DO UPDATE SET
         attachment_id=COALESCE(excluded.attachment_id,attachment_cleanup_jobs.attachment_id),
         import_id=COALESCE(excluded.import_id,attachment_cleanup_jobs.import_id),
         size=MAX(excluded.size,attachment_cleanup_jobs.size),
         action=excluded.action, reason=excluded.reason,
         state='pending', attempts=0, last_error=NULL,
         not_before=excluded.not_before, updated_at=excluded.updated_at
       RETURNING id`,
    )
    .bind(
      input.userId,
      input.attachmentId ?? null,
      input.importId ?? null,
      input.r2Key,
      input.size ?? 0,
      input.action ?? 'delete_object',
      input.reason,
      notBefore,
      now,
      now,
    )
    .first<{ id: number }>();
  if (!row) throw new Error('attachment_cleanup_intent_missing');
  return row.id;
}

interface CleanupJob {
  id: number;
  user_id: string;
  attachment_id: number | null;
  import_id: number | null;
  r2_key: string;
  action: 'delete_object' | 'delete_metadata';
  reason: AttachmentCleanupReason;
  attempts: number;
  created_at: string;
}

export interface AttachmentMaintenanceSummary {
  selected: number;
  completed: number;
  retried: number;
  dead: number;
  importJobsEnqueued: number;
}

const backoffAt = (now: Date, attempts: number): string =>
  new Date(now.getTime() + Math.min(24 * 60, 2 ** Math.min(attempts, 10)) * 60_000).toISOString();

async function failCleanupJob(
  db: D1Database,
  job: CleanupJob,
  config: AttachmentRuntimeConfig,
  now: Date,
  errorCode: string,
): Promise<'retry' | 'dead'> {
  const attempts = job.attempts + 1;
  const graceElapsed =
    new Date(job.created_at).getTime() <= now.getTime() - config.cleanupGraceDays * 24 * 60 * 60 * 1000;
  const dead = attempts >= config.maxAttempts && graceElapsed;
  await db
    .prepare(
      `UPDATE attachment_cleanup_jobs
          SET state=?, attempts=?, not_before=?, last_error=?, updated_at=?
        WHERE id=?`,
    )
    .bind(dead ? 'dead' : 'retry', attempts, backoffAt(now, attempts), errorCode, now.toISOString(), job.id)
    .run();
  if (job.attachment_id != null) {
    await db
      .prepare(
        `UPDATE attachments
            SET state='delete_failed', last_delete_error=?,
                cleanup_dead_letter_at=CASE WHEN ?=1 THEN ? ELSE cleanup_dead_letter_at END
          WHERE id=? AND user_id=?`,
      )
      .bind(errorCode, dead ? 1 : 0, now.toISOString(), job.attachment_id, job.user_id)
      .run();
  }
  return dead ? 'dead' : 'retry';
}

async function cleanupMetadata(db: D1Database, job: CleanupJob): Promise<void> {
  const tombstone = db
    .prepare(
      `INSERT INTO attachment_object_tombstones (user_id,r2_key,deleted_at)
       VALUES (?,?,?)
       ON CONFLICT(user_id,r2_key) DO UPDATE SET
         deleted_at=excluded.deleted_at`,
    )
    .bind(job.user_id, job.r2_key, new Date().toISOString());
  const statements: D1PreparedStatement[] = [];
  // 永続tombstoneは古いattachmentArchiveによる明示削除の復活だけを防ぐ。
  // upload補償/import retentionはarchive対象でなく、job完了後の永久factを要しない。
  if (job.reason === 'attachment_delete') statements.push(tombstone);
  if (job.attachment_id != null) {
    // tombstone作成と0012 FK CASCADEによるjob削除を同一transactionに閉じる。
    statements.push(
      db.prepare('DELETE FROM attachments WHERE id=? AND user_id=?').bind(job.attachment_id, job.user_id),
    );
    await db.batch(statements);
    return;
  }
  if (job.import_id != null) {
    statements.push(
      db.prepare('UPDATE imports SET r2_key=NULL WHERE user_id=? AND r2_key=?').bind(job.user_id, job.r2_key),
    );
  }
  statements.push(db.prepare('DELETE FROM attachment_cleanup_jobs WHERE id=?').bind(job.id));
  await db.batch(statements);
}

async function processCleanupJob(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  job: CleanupJob,
  config: AttachmentRuntimeConfig,
  now: Date,
): Promise<'completed' | 'retry' | 'dead'> {
  if (job.action === 'delete_metadata') {
    let reappeared: R2Object | null;
    try {
      reappeared = await env.FILES.head(job.r2_key);
    } catch {
      return failCleanupJob(env.DB, job, config, now, 'r2_head_failed_before_metadata_cleanup');
    }
    // object_deleted_at後に同keyが帯域外復活してもmetadataだけを消して孤児化しない。
    if (reappeared !== null) return processCleanupJob(env, { ...job, action: 'delete_object' }, config, now);
    try {
      await cleanupMetadata(env.DB, job);
      return 'completed';
    } catch {
      return failCleanupJob(env.DB, job, config, now, 'd1_delete_failed_after_r2');
    }
  }

  if (job.reason === 'import_retention') {
    const active = await env.DB.prepare(
      `SELECT 1 AS active
         FROM imports i
         JOIN import_active_targets a ON a.user_id=i.user_id AND a.import_id=i.id
        WHERE i.user_id=? AND i.r2_key=?
        LIMIT 1`,
    )
      .bind(job.user_id, job.r2_key)
      .first<{ active: number }>();
    if (active) {
      // enqueue後にactive pointerが復帰したraceでも原本を消さない。
      await env.DB.prepare('DELETE FROM attachment_cleanup_jobs WHERE id=?').bind(job.id).run();
      return 'completed';
    }
  }

  try {
    await env.FILES.delete(job.r2_key);
  } catch {
    return failCleanupJob(env.DB, job, config, now, 'r2_delete_failed');
  }

  if (job.attachment_id != null) {
    try {
      await env.DB.prepare(
        `UPDATE attachments
            SET object_deleted_at=COALESCE(object_deleted_at,?), state='delete_pending', last_delete_error=NULL
          WHERE id=? AND user_id=?`,
      )
        .bind(now.toISOString(), job.attachment_id, job.user_id)
        .run();
      await env.DB.prepare(
        `UPDATE attachment_cleanup_jobs
            SET action='delete_metadata', state='pending', last_error=NULL, not_before=?, updated_at=?
          WHERE id=?`,
      )
        .bind(now.toISOString(), now.toISOString(), job.id)
        .run();
      return processCleanupJob(env, { ...job, action: 'delete_metadata' }, config, now);
    } catch {
      return failCleanupJob(env.DB, job, config, now, 'd1_object_fact_failed_after_r2');
    }
  }

  try {
    await cleanupMetadata(env.DB, job);
    return 'completed';
  } catch {
    return failCleanupJob(env.DB, job, config, now, 'd1_cleanup_job_delete_failed_after_r2');
  }
}

async function enqueueExpiredImportUploads(
  env: Pick<AuthEnv, 'DB'>,
  config: AttachmentRuntimeConfig,
  now: Date,
  limit: number,
): Promise<number> {
  const cutoff = new Date(now.getTime() - config.importUploadDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO attachment_cleanup_jobs
     (user_id,attachment_id,import_id,r2_key,size,action,reason,state,attempts,not_before,
      last_error,created_at,updated_at)
     SELECT i.user_id,NULL,i.id,i.r2_key,0,'delete_object','import_retention','pending',0,?,NULL,?,?
       FROM imports i
      WHERE i.r2_key IS NOT NULL
        AND (
          i.status IN ('failed','duplicate')
          OR (
            i.status='committed'
            AND NOT EXISTS (
              SELECT 1 FROM import_active_targets own_active
               WHERE own_active.user_id=i.user_id AND own_active.import_id=i.id
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1
            FROM imports active_import
            JOIN import_active_targets active_target
              ON active_target.user_id=active_import.user_id
             AND active_target.import_id=active_import.id
           WHERE active_import.user_id=i.user_id
             AND active_import.r2_key=i.r2_key
        )
        AND i.created_at < ?
      ORDER BY i.created_at,i.id
      LIMIT ?`,
  )
    .bind(now.toISOString(), now.toISOString(), now.toISOString(), cutoff, limit)
    .run();
  return result.meta.changes ?? 0;
}

/** Cronとrouteが共有するbounded/idempotent reconciler。bucket listは行わない。 */
export async function runAttachmentMaintenance(
  env: Pick<AuthEnv, 'DB' | 'FILES'> & Partial<AuthEnv>,
  nowInput = new Date(),
  options: { maxJobs?: number } = {},
): Promise<AttachmentMaintenanceSummary> {
  const config = attachmentRuntimeConfig(env as AuthEnv);
  const requestedMax = options.maxJobs ?? config.reconcileBatchSize;
  if (!Number.isSafeInteger(requestedMax) || requestedMax < 1 || requestedMax > 10)
    throw new Error('invalid_attachment_maintenance_limit');
  // envで通常上限を下げている場合は、その意図をscheduled側の指定で引き上げない。
  const maxJobs = Math.min(config.reconcileBatchSize, requestedMax);
  const importJobsEnqueued = await enqueueExpiredImportUploads(env, config, nowInput, maxJobs);
  const jobs = await env.DB.prepare(
    `SELECT id,user_id,attachment_id,import_id,r2_key,action,reason,attempts,created_at
       FROM attachment_cleanup_jobs
      WHERE state IN ('pending','retry') AND not_before<=?
      ORDER BY not_before,id
      LIMIT ?`,
  )
    .bind(nowInput.toISOString(), maxJobs)
    .all<CleanupJob>();
  const summary: AttachmentMaintenanceSummary = {
    selected: jobs.results.length,
    completed: 0,
    retried: 0,
    dead: 0,
    importJobsEnqueued,
  };
  for (const job of jobs.results) {
    const result = await processCleanupJob(env, job, config, nowInput);
    if (result === 'completed') summary.completed += 1;
    else if (result === 'retry') summary.retried += 1;
    else summary.dead += 1;
  }
  return summary;
}

/** HTTP DELETEは作成直後のjobだけを同期処理し、同じreconciler契約を使う。 */
export async function processAttachmentCleanupNow(
  env: Pick<AuthEnv, 'DB' | 'FILES'> & Partial<AuthEnv>,
  jobId: number,
  nowInput = new Date(),
): Promise<'completed' | 'retry' | 'dead' | 'not_found'> {
  const job = await env.DB.prepare(
    `SELECT id,user_id,attachment_id,import_id,r2_key,action,reason,attempts,created_at
       FROM attachment_cleanup_jobs WHERE id=?`,
  )
    .bind(jobId)
    .first<CleanupJob>();
  if (!job) return 'not_found';
  return processCleanupJob(env, job, attachmentRuntimeConfig(env as AuthEnv), nowInput);
}
