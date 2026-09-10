import { spawnSync } from 'node:child_process';

export const R2_CLEANUP_PREPARE_MIGRATION = '0038_prepare_r2_cleanup.sql';
export const R2_CLEANUP_DROP_MIGRATION = '0039_drop_tax_and_receipt_tables.sql';
export const R2_CLEANUP_REMEDIATION =
  '0038だけを先に適用し、r2_cleanup_jobsと旧attachments metadataの残件を0件にしてから、別Releaseで0039を承認してください。';

const COUNT_FIELDS = ['pending', 'retry', 'dead', 'attachments', 'attachment_cleanup_jobs'];

export function requiresR2CleanupReleaseGate(pendingFilenames) {
  return pendingFilenames.includes(R2_CLEANUP_DROP_MIGRATION);
}

export function assertR2CleanupReleaseBoundary(pendingFilenames) {
  if (
    pendingFilenames.includes(R2_CLEANUP_PREPARE_MIGRATION) &&
    pendingFilenames.includes(R2_CLEANUP_DROP_MIGRATION)
  ) {
    throw new Error('r2-cleanup-release-boundary-invalid');
  }
}

/** Wrangler D1 JSON出力の台帳・旧metadata件数だけをfail-closedに受理する。 */
export function parseR2CleanupStatusResult({ exitCode, stdout = '', error }) {
  if (error !== undefined || exitCode !== 0 || typeof stdout !== 'string') {
    throw new Error('r2-cleanup-inspection-failed');
  }
  try {
    const payload = JSON.parse(stdout.trim());
    if (!Array.isArray(payload) || payload.length !== 1 || payload[0]?.success !== true) {
      throw new Error('invalid-result-envelope');
    }
    const rows = payload[0].results;
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('invalid-result-rows');
    const row = rows[0];
    if (
      row === null ||
      typeof row !== 'object' ||
      COUNT_FIELDS.some((field) => !Number.isSafeInteger(row[field]) || row[field] < 0)
    )
      throw new Error('invalid-result-row');
    return {
      pending: row.pending,
      retry: row.retry,
      dead: row.dead,
      attachments: row.attachments,
      attachmentCleanupJobs: row.attachment_cleanup_jobs,
    };
  } catch {
    throw new Error('r2-cleanup-inspection-failed');
  }
}

export function verifyR2CleanupIsDrained(result) {
  const counts = parseR2CleanupStatusResult(result);
  if (Object.values(counts).some((count) => count !== 0)) {
    throw new Error('r2-cleanup-not-drained');
  }
  return counts;
}

/** Release Bのみ実行するread-only remote precondition。raw出力はlogに出さない。 */
export function runR2CleanupStatus() {
  const result = spawnSync(
    'pnpm',
    [
      '--filter',
      '@kanjo/api',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'kanjo-db',
      '--remote',
      '--command',
      `SELECT
         COUNT(CASE WHEN state='pending' THEN 1 END) AS pending,
         COUNT(CASE WHEN state='retry' THEN 1 END) AS retry,
         COUNT(CASE WHEN state='dead' THEN 1 END) AS dead,
         (SELECT COUNT(*) FROM attachments) AS attachments,
         (SELECT COUNT(*) FROM attachment_cleanup_jobs) AS attachment_cleanup_jobs
       FROM r2_cleanup_jobs`,
      '--json',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    },
  );
  return {
    error: result.error,
    exitCode: result.status,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}
