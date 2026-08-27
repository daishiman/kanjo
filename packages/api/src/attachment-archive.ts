import {
  type AttachmentTarget,
  attachmentContentTypeFromSignature,
  attachmentTargetColumns,
  parseAttachmentTarget,
  parseMfAttachmentTarget,
} from '@kanjo/core';
import { z } from 'zod';
import type { AuthEnv } from './auth.js';

const archiveRecordSchema = z
  .object({
    target: z.object({ kind: z.enum(['cash', 'mf']), key: z.string().min(1).max(200) }).strict(),
    r2Key: z.string().min(1).max(500),
    filename: z.string().min(1).max(80),
    contentType: z.enum([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ]),
    size: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/),
    createdAt: z.string().datetime(),
    state: z.enum(['ready', 'delete_pending', 'delete_failed']).default('ready'),
    deleteAttempts: z.number().int().nonnegative().default(0),
    deleteRequestedAt: z.string().datetime().nullable().default(null),
    lastDeleteError: z.string().max(200).nullable().default(null),
    objectDeletedAt: z.string().datetime().nullable().optional(),
    parentMissingAt: z.string().datetime().nullable().optional(),
    cleanupDeadLetterAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const attachmentArchiveRequestSchema = z
  .object({
    confirm: z.boolean().optional(),
    attachmentArchive: z
      .object({
        version: z.literal(1),
        basis: z.literal('inventory-only'),
        restoreCapable: z.literal(false).optional(),
        metadataRecoveryCapable: z.literal(true).optional(),
        recoveryEndpoint: z.literal('/api/attachments/archive/recover').optional(),
        records: z.array(archiveRecordSchema).max(10),
      })
      .strict(),
  })
  .strict();

type ArchiveRecord = z.infer<typeof archiveRecordSchema>;
export type AttachmentArchiveRecordStatus =
  | 'matched'
  | 'metadata_missing'
  | 'target_missing'
  | 'missing'
  | 'mismatch'
  | 'skipped';

export interface AttachmentArchiveReportRecord {
  r2Key: string;
  status: AttachmentArchiveRecordStatus;
}

export interface AttachmentArchiveReport {
  matched: number;
  metadataMissing: number;
  targetMissing: number;
  missing: number;
  mismatch: number;
  skipped: number;
  records: AttachmentArchiveReportRecord[];
}

const sha256Hex = async (buf: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const recordTarget = (record: ArchiveRecord): AttachmentTarget | null =>
  record.target.kind === 'cash'
    ? parseAttachmentTarget(`cash:${record.target.key}`)
    : parseMfAttachmentTarget(record.target.key);

const recordIdentity = (record: ArchiveRecord): string =>
  `${record.target.kind}:${record.target.key}:${record.contentHash}`;

async function targetExists(
  env: Pick<AuthEnv, 'DB'>,
  userId: string,
  target: AttachmentTarget,
): Promise<boolean> {
  const row =
    target.kind === 'cash'
      ? await env.DB.prepare('SELECT 1 AS found FROM cash_entries WHERE user_id=? AND id=?')
          .bind(userId, target.id)
          .first<{ found: number }>()
      : await env.DB.prepare(
          'SELECT 1 AS found FROM mf_transactions WHERE user_id=? AND tx_id=? AND identity_stable=1',
        )
          .bind(userId, target.txId)
          .first<{ found: number }>();
  return row !== null;
}

interface CurrentAttachmentMetadata {
  targetKind: 'cash' | 'mf';
  targetKey: string;
  r2Key: string;
  contentType: string;
  size: number;
  contentHash: string;
  objectDeletedAt: string | null;
  deleteRequestedAt: string | null;
  cleanupDeadLetterAt: string | null;
}

interface AttachmentInspectionContext extends CurrentAttachmentMetadata {
  metadataId: number | null;
  cleanupIntent: number;
}

const deletionWasRequested = (row: CurrentAttachmentMetadata): boolean =>
  Boolean(row.objectDeletedAt || row.deleteRequestedAt || row.cleanupDeadLetterAt);

async function inspectArchiveObject(
  files: R2Bucket,
  userId: string,
  record: ArchiveRecord,
): Promise<'missing' | 'mismatch' | null> {
  const object = await files.get(record.r2Key);
  if (!object) return 'missing';
  if (object.size !== record.size) return 'mismatch';
  if (object.customMetadata?.ownerId && object.customMetadata.ownerId !== userId) return 'mismatch';
  if (object.customMetadata?.contentHash && object.customMetadata.contentHash !== record.contentHash)
    return 'mismatch';
  const bytes = await object.arrayBuffer();
  if ((await sha256Hex(bytes)) !== record.contentHash) return 'mismatch';
  if (attachmentContentTypeFromSignature(new Uint8Array(bytes)) !== record.contentType) return 'mismatch';
  return null;
}

async function inspectRecord(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  userId: string,
  record: ArchiveRecord,
): Promise<AttachmentArchiveRecordStatus> {
  const target = recordTarget(record);
  if (!target || !record.r2Key.startsWith(`attachments/${userId}/`)) return 'mismatch';
  if (
    record.state !== 'ready' ||
    record.objectDeletedAt ||
    record.deleteRequestedAt ||
    record.cleanupDeadLetterAt
  )
    return 'skipped';
  const targetColumns = attachmentTargetColumns(target);
  const context = await env.DB.prepare(
    `WITH candidate AS (
       SELECT id,target_kind,target_key,r2_key,content_type,size,content_hash,
              object_deleted_at,delete_requested_at,cleanup_dead_letter_at
         FROM attachments
        WHERE user_id=?
          AND (r2_key=? OR (target_kind=? AND target_key=? AND content_hash=?))
        ORDER BY CASE WHEN r2_key=? THEN 0 ELSE 1 END,id
        LIMIT 1
     )
     SELECT candidate.id AS metadataId,
            candidate.target_kind AS targetKind,candidate.target_key AS targetKey,
            candidate.r2_key AS r2Key,candidate.content_type AS contentType,
            candidate.size,candidate.content_hash AS contentHash,
            candidate.object_deleted_at AS objectDeletedAt,
            candidate.delete_requested_at AS deleteRequestedAt,
            candidate.cleanup_dead_letter_at AS cleanupDeadLetterAt,
            (EXISTS(SELECT 1 FROM attachment_cleanup_jobs
                    WHERE user_id=? AND r2_key=?)
             OR EXISTS(SELECT 1 FROM attachment_object_tombstones
                       WHERE user_id=? AND r2_key=?)) AS cleanupIntent
       FROM (SELECT 1) seed LEFT JOIN candidate ON 1=1`,
  )
    .bind(
      userId,
      record.r2Key,
      targetColumns.targetKind,
      targetColumns.targetKey,
      record.contentHash,
      record.r2Key,
      userId,
      record.r2Key,
      userId,
      record.r2Key,
    )
    .first<AttachmentInspectionContext>();
  if (!context) throw new Error('attachment_archive_inspection_missing');
  const current = context.metadataId == null ? null : context;
  if (context.cleanupIntent || (current && deletionWasRequested(current))) return 'skipped';

  // metadataの有無に関係なく、archiveが指すexact objectを実byteで検証する。
  const objectStatus = await inspectArchiveObject(env.FILES, userId, record);
  if (objectStatus) return objectStatus;
  if (!(await targetExists(env, userId, target))) return 'target_missing';
  if (current) {
    return current.targetKind === targetColumns.targetKind &&
      current.targetKey === targetColumns.targetKey &&
      current.contentHash === record.contentHash &&
      current.size === record.size &&
      current.contentType === record.contentType
      ? 'matched'
      : 'mismatch';
  }
  return 'metadata_missing';
}

export async function reconcileAttachmentArchive(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  userId: string,
  records: ArchiveRecord[],
): Promise<AttachmentArchiveReport> {
  const report: AttachmentArchiveReport = {
    matched: 0,
    metadataMissing: 0,
    targetMissing: 0,
    missing: 0,
    mismatch: 0,
    skipped: 0,
    records: [],
  };
  const recoverableIdentities = new Set<string>();
  for (const record of records) {
    let status = await inspectRecord(env, userId, record);
    if (status === 'metadata_missing') {
      const identity = recordIdentity(record);
      if (recoverableIdentities.has(identity)) status = 'skipped';
      else recoverableIdentities.add(identity);
    }
    report.records.push({ r2Key: record.r2Key, status });
    if (status === 'matched') report.matched += 1;
    else if (status === 'metadata_missing') report.metadataMissing += 1;
    else if (status === 'target_missing') report.targetMissing += 1;
    else if (status === 'missing') report.missing += 1;
    else if (status === 'skipped') report.skipped += 1;
    else report.mismatch += 1;
  }
  return report;
}

export async function recoverAttachmentArchiveMetadata(
  env: Pick<AuthEnv, 'DB' | 'FILES'>,
  userId: string,
  records: ArchiveRecord[],
): Promise<
  | { ok: true; recovered: number; alreadyPresent: number; skipped: number; report: AttachmentArchiveReport }
  | { ok: false; recovered: number; alreadyPresent: number; skipped: number; report: AttachmentArchiveReport }
> {
  const report = await reconcileAttachmentArchive(env, userId, records);
  const recoverable = report.records.flatMap((entry, index) => {
    if (entry.status !== 'metadata_missing') return [];
    const record = records[index];
    if (!record) throw new Error('attachment_archive_record_missing');
    const target = recordTarget(record);
    if (!target) throw new Error('attachment_archive_target_invalid');
    const columns = attachmentTargetColumns(target);
    // 原本の実在性を検証済みなのでreadyとして再結合する。削除途中の古い操作stateは復元しない。
    return [
      {
        reportIndex: index,
        statement: env.DB.prepare(
          `INSERT INTO attachments
         (user_id,target_kind,target_key,r2_key,filename,content_type,size,content_hash,state,
          delete_attempts,delete_requested_at,last_delete_error,object_deleted_at,parent_missing_at,
          cleanup_dead_letter_at,created_at)
         SELECT ?,?,?,?,?,?,?,?,'ready',0,NULL,NULL,NULL,NULL,NULL,?
          WHERE NOT EXISTS (SELECT 1 FROM attachment_cleanup_jobs WHERE user_id=? AND r2_key=?)
            AND NOT EXISTS (SELECT 1 FROM attachment_object_tombstones WHERE user_id=? AND r2_key=?)`,
        ).bind(
          userId,
          columns.targetKind,
          columns.targetKey,
          record.r2Key,
          record.filename,
          record.contentType,
          record.size,
          record.contentHash,
          record.createdAt,
          userId,
          record.r2Key,
          userId,
          record.r2Key,
        ),
      },
    ];
  });
  let recovered = 0;
  if (recoverable.length) {
    const results = await env.DB.batch(recoverable.map((entry) => entry.statement));
    results.forEach((result, index) => {
      if ((result.meta.changes ?? 0) === 1) recovered += 1;
      else {
        const reportIndex = recoverable[index]?.reportIndex;
        if (reportIndex === undefined) return;
        report.records[reportIndex] = { ...report.records[reportIndex], status: 'skipped' };
        report.metadataMissing -= 1;
        report.skipped += 1;
      }
    });
  }
  const result = {
    recovered,
    alreadyPresent: report.matched,
    skipped: report.skipped,
    report,
  };
  return report.missing > 0 || report.mismatch > 0 || report.targetMissing > 0
    ? { ok: false, ...result }
    : { ok: true, ...result };
}
