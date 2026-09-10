/**
 * R2/D1の非原子境界を時間軸へ引き継ぐ、用途中立なdurable cleanup outbox。
 * R2 keyは応答やログに出さず、処理は有界・冪等に保つ。
 */
import type { AuthEnv } from './auth.js';

export const R2_CLEANUP_JOB_LIMIT = 3;
export const R2_CLEANUP_MAX_ATTEMPTS = 5;
export const R2_CLEANUP_DEAD_GRACE_DAYS = 7;
export const IMPORT_ORIGINAL_RETENTION_DAYS = 30;

export type R2CleanupPurpose = 'import_original' | 'retired_attachment';

interface R2CleanupJob {
  id: number;
  user_id: string;
  r2_key: string;
  purpose: R2CleanupPurpose;
  attempts: number;
  created_at: string;
}

interface LegacyCleanupTables {
  attachments: boolean;
  attachmentCleanupJobs: boolean;
}

export interface R2CleanupSummary {
  selected: number;
  completed: number;
  retried: number;
  dead: number;
  importJobsEnqueued: number;
}

/**
 * cleanup_key(user_id,r2_key)が参照する取込原本のうち、1rowでも削除不可な参照があるか。
 * enqueueとR2 DELETE直前guardがこの同一SQL契約を共有し、key単位の判定をずらさない。
 * `?`は30日cutoffの安全なbindにだけ使う。
 */
const IMPORT_ORIGINAL_HAS_PROTECTED_REFERENCE_SQL = `
  EXISTS (
    SELECT 1 FROM imports sibling
     WHERE sibling.user_id=cleanup_key.user_id
       AND sibling.r2_key=cleanup_key.r2_key
       AND (
         julianday(sibling.created_at) IS NULL
         OR julianday(sibling.created_at)>=julianday(?)
         OR sibling.status IS NULL
         OR sibling.status NOT IN ('failed','duplicate','committed')
       )
  )
  OR EXISTS (
    SELECT 1
      FROM imports active_import
      JOIN import_active_targets active_target
        ON active_target.user_id=active_import.user_id
       AND active_target.import_id=active_import.id
     WHERE active_import.user_id=cleanup_key.user_id
       AND active_import.r2_key=cleanup_key.r2_key
  )`;

const importOriginalRetentionCutoff = (now: Date): string =>
  new Date(now.getTime() - IMPORT_ORIGINAL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

export function r2CleanupEnqueueStatement(
  database: D1Database,
  input: {
    userId: string;
    r2Key: string;
    purpose: R2CleanupPurpose;
    now: string;
  },
): D1PreparedStatement {
  return database
    .prepare(
      `INSERT INTO r2_cleanup_jobs
       (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
       VALUES (?,?,?,'pending',0,?,NULL,?,?)
       ON CONFLICT(user_id,r2_key) DO UPDATE SET
         purpose=excluded.purpose,state='pending',attempts=0,
         not_before=excluded.not_before,last_error=NULL,updated_at=excluded.updated_at
       RETURNING id`,
    )
    .bind(input.userId, input.r2Key, input.purpose, input.now, input.now, input.now);
}

const backoffAt = (now: Date, attempts: number): string =>
  new Date(now.getTime() + Math.min(24 * 60, 2 ** Math.min(attempts, 10)) * 60_000).toISOString();

async function recordFailure(database: D1Database, job: R2CleanupJob, now: Date): Promise<'retry' | 'dead'> {
  const attempts = job.attempts + 1;
  const graceElapsed =
    new Date(job.created_at).getTime() <= now.getTime() - R2_CLEANUP_DEAD_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const state = attempts >= R2_CLEANUP_MAX_ATTEMPTS && graceElapsed ? 'dead' : 'retry';
  await database
    .prepare(
      `UPDATE r2_cleanup_jobs
          SET state=?,attempts=?,not_before=?,last_error='r2_delete_failed',updated_at=?
        WHERE id=?`,
    )
    .bind(state, attempts, backoffAt(now, attempts), now.toISOString(), job.id)
    .run();
  return state;
}

async function inspectLegacyCleanupTables(database: D1Database): Promise<LegacyCleanupTables> {
  const rows = await database
    .prepare(
      `SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('attachments','attachment_cleanup_jobs')`,
    )
    .all<{ name: string }>();
  const names = new Set(rows.results.map(({ name }) => name));
  return {
    attachments: names.has('attachments'),
    attachmentCleanupJobs: names.has('attachment_cleanup_jobs'),
  };
}

async function reconcileLegacyCleanupJobs(
  database: D1Database,
  legacyTables: LegacyCleanupTables,
  nowIso: string,
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  if (legacyTables.attachmentCleanupJobs)
    statements.push(
      database
        .prepare(
          `INSERT INTO r2_cleanup_jobs
         (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
         SELECT user_id,r2_key,
                CASE WHEN reason='import_retention' THEN 'import_original' ELSE 'retired_attachment' END,
                CASE WHEN state='dead' THEN 'retry' ELSE state END,
                CASE WHEN state='dead' THEN 0 ELSE attempts END,
                CASE WHEN state='dead' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE not_before END,
                CASE WHEN state='dead' THEN NULL ELSE last_error END,
                created_at,
                CASE WHEN state='dead' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
           FROM attachment_cleanup_jobs
          WHERE 1
          ON CONFLICT(user_id,r2_key) DO UPDATE SET
            purpose=excluded.purpose,state='retry',attempts=0,not_before=?,last_error=NULL,updated_at=?
          WHERE r2_cleanup_jobs.state='dead'`,
        )
        .bind(nowIso, nowIso),
    );
  if (legacyTables.attachments)
    statements.push(
      database
        .prepare(
          `INSERT INTO r2_cleanup_jobs
         (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
         SELECT user_id,r2_key,'retired_attachment','pending',0,
                strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL,created_at,
                strftime('%Y-%m-%dT%H:%M:%fZ','now')
           FROM attachments
          WHERE 1
          ON CONFLICT(user_id,r2_key) DO UPDATE SET
            purpose=excluded.purpose,state='retry',attempts=0,not_before=?,last_error=NULL,updated_at=?
          WHERE r2_cleanup_jobs.state='dead'`,
        )
        .bind(nowIso, nowIso),
    );
  if (statements.length > 0) await database.batch(statements);
}

function legacyMetadataCleanupStatements(
  database: D1Database,
  job: Pick<R2CleanupJob, 'user_id' | 'r2_key'>,
  legacyTables: LegacyCleanupTables,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];
  if (legacyTables.attachmentCleanupJobs)
    statements.push(
      database
        .prepare('DELETE FROM attachment_cleanup_jobs WHERE user_id=? AND r2_key=?')
        .bind(job.user_id, job.r2_key),
    );
  if (legacyTables.attachments)
    statements.push(
      database.prepare('DELETE FROM attachments WHERE user_id=? AND r2_key=?').bind(job.user_id, job.r2_key),
    );
  return statements;
}

/**
 * 共有keyの全参照が保持対象外になった期限超過取込原本を共通outboxへ移す。
 * 既存jobはstateによらずLIMIT前に除外し、dead keyで次の候補が詰まるのを防ぐ。
 */
export async function enqueueExpiredImportOriginals(
  database: D1Database,
  now: Date,
  limit = R2_CLEANUP_JOB_LIMIT,
): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > R2_CLEANUP_JOB_LIMIT)
    throw new Error('invalid_r2_cleanup_enqueue_limit');
  const nowIso = now.toISOString();
  const cutoff = importOriginalRetentionCutoff(now);
  const result = await database
    .prepare(
      `INSERT OR IGNORE INTO r2_cleanup_jobs
       (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
       SELECT candidate.user_id,candidate.r2_key,'import_original','pending',0,?,NULL,?,?
         FROM (
           SELECT cleanup_key.user_id,cleanup_key.r2_key,
                  MIN(cleanup_key.created_at) AS oldest_created_at,MIN(cleanup_key.id) AS oldest_id
             FROM imports cleanup_key
            WHERE cleanup_key.r2_key IS NOT NULL
              AND NOT (${IMPORT_ORIGINAL_HAS_PROTECTED_REFERENCE_SQL})
              AND NOT EXISTS (
                SELECT 1 FROM r2_cleanup_jobs existing
                 WHERE existing.user_id=cleanup_key.user_id AND existing.r2_key=cleanup_key.r2_key
              )
            GROUP BY cleanup_key.user_id,cleanup_key.r2_key
            ORDER BY oldest_created_at,oldest_id
            LIMIT ?
         ) candidate`,
    )
    .bind(nowIso, nowIso, nowIso, cutoff, limit)
    .run();
  return result.meta.changes ?? 0;
}

async function processJob(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  job: R2CleanupJob,
  now: Date,
  legacyTables: LegacyCleanupTables,
): Promise<'completed' | 'retry' | 'dead'> {
  // purposeは起点ラベルに留め、同じkeyを参照する取込原本は全jobで同じ契約により保護する。
  const protectedReference = await env.DB.prepare(
    `WITH cleanup_key(user_id,r2_key) AS (VALUES (?,?))
     SELECT CASE WHEN (${IMPORT_ORIGINAL_HAS_PROTECTED_REFERENCE_SQL}) THEN 1 ELSE 0 END AS is_protected
       FROM cleanup_key`,
  )
    .bind(job.user_id, job.r2_key, importOriginalRetentionCutoff(now))
    .first<{ is_protected: number }>();
  if (protectedReference?.is_protected !== 0) {
    // R2と取込参照は保持し、退役metadataと全cleanup intentだけを同じtransactionで閉じる。
    await env.DB.batch([
      ...legacyMetadataCleanupStatements(env.DB, job, legacyTables),
      env.DB.prepare('DELETE FROM r2_cleanup_jobs WHERE id=?').bind(job.id),
    ]);
    return 'completed';
  }
  try {
    // R2 DELETEは存在しないkeyにも再実行できる。D1完了書込みの前後で中断しても同じjobを再試行する。
    await env.FILES.delete(job.r2_key);
  } catch {
    return recordFailure(env.DB, job, now);
  }
  // R2成功後は起点にかかわらず全DB参照を同じtransactionで閉じる。失敗時はjobを残し再試行する。
  await env.DB.batch([
    ...legacyMetadataCleanupStatements(env.DB, job, legacyTables),
    env.DB.prepare('UPDATE imports SET r2_key=NULL WHERE user_id=? AND r2_key=?').bind(
      job.user_id,
      job.r2_key,
    ),
    env.DB.prepare('DELETE FROM r2_cleanup_jobs WHERE id=?').bind(job.id),
  ]);
  return 'completed';
}

export async function processR2CleanupJobNow(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  jobId: number,
  now = new Date(),
): Promise<'completed' | 'retry' | 'dead' | 'not_found'> {
  const legacyTables = await inspectLegacyCleanupTables(env.DB);
  const job = await env.DB.prepare(
    'SELECT id,user_id,r2_key,purpose,attempts,created_at FROM r2_cleanup_jobs WHERE id=?',
  )
    .bind(jobId)
    .first<R2CleanupJob>();
  if (!job) return 'not_found';
  return processJob(env, job, now, legacyTables);
}

export async function runR2Cleanup(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  now = new Date(),
): Promise<R2CleanupSummary> {
  const legacyTables = await inspectLegacyCleanupTables(env.DB);
  // 0038適用後から新Worker配信完了までの旧Worker late writeを、処理直前に必ず回収する。
  await reconcileLegacyCleanupJobs(env.DB, legacyTables, now.toISOString());
  // DBの参照だけから候補を作る。bucket scanは行わず、このrunの後続due scanで即時処理する。
  const importJobsEnqueued = await enqueueExpiredImportOriginals(env.DB, now);
  const jobs = await env.DB.prepare(
    `SELECT id,user_id,r2_key,purpose,attempts,created_at
       FROM r2_cleanup_jobs
      WHERE state IN ('pending','retry') AND not_before<=?
      ORDER BY not_before,id
      LIMIT ?`,
  )
    .bind(now.toISOString(), R2_CLEANUP_JOB_LIMIT)
    .all<R2CleanupJob>();
  const summary: R2CleanupSummary = {
    selected: jobs.results.length,
    completed: 0,
    retried: 0,
    dead: 0,
    importJobsEnqueued,
  };
  for (const job of jobs.results) {
    const result = await processJob(env, job, now, legacyTables);
    summary[result === 'completed' ? 'completed' : result === 'retry' ? 'retried' : 'dead'] += 1;
  }
  return summary;
}
