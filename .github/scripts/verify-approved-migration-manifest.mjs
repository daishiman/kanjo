import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  MIGRATION_NAME,
  parseWranglerMigrationListResult,
  runWranglerMigrationList,
} from './wrangler-output.mjs';

export const MANIFEST_REMEDIATION =
  '承認manifest・repository head・remote pendingを再取得して承認し直してから、Migrateを再実行してください。';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function migrationSnapshot(migrationsDir) {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => MIGRATION_NAME.test(filename))
    .sort();
  if (filenames.length === 0) throw new Error('migration-set-empty');
  const entries = filenames.map((filename, index) => ({
    order: index + 1,
    filename,
    sha256: sha256(readFileSync(resolve(migrationsDir, filename))),
  }));
  return {
    head: filenames.at(-1),
    orderedMigrationsDigestSha256: sha256(
      entries.map(({ filename, sha256: digest }) => `${filename}\t${digest}\n`).join(''),
    ),
    entries,
  };
}

export function pendingMigrationsFromWrangler(result) {
  const parsed = parseWranglerMigrationListResult(result);
  if (parsed.state === 'command-failure' || parsed.reason === 'stderr') {
    throw new Error('remote-inspection-failed');
  }
  if (parsed.state !== 'pending') throw new Error('remote-inspection-unparseable');
  if (parsed.filenames.length === 0) throw new Error('remote-pending-empty-or-unparseable');
  return parsed.filenames;
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isSha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function verifyApprovedManifest({ manifest, repositoryHead, snapshot, pendingFilenames }) {
  if (
    manifest?.schema_version !== 1 ||
    manifest?.document_type !== 'approved_pending_migration_manifest' ||
    manifest?.manifest_status !== 'approved' ||
    manifest?.target?.environment !== 'production' ||
    manifest?.target?.database !== 'kanjo-db'
  ) {
    throw new Error('manifest-contract-invalid');
  }

  if (!isNonEmptyString(repositoryHead) || manifest.repository?.head !== repositoryHead) {
    throw new Error('repository-head-mismatch');
  }
  if (
    manifest.repository?.migration_head !== snapshot.head ||
    manifest.repository?.ordered_migrations_digest_sha256 !== snapshot.orderedMigrationsDigestSha256
  ) {
    throw new Error('repository-migrations-mismatch');
  }

  if (
    !isNonEmptyString(manifest.remote_inspection?.captured_at) ||
    !isNonEmptyString(manifest.remote_inspection?.evidence_ref) ||
    !Number.isInteger(manifest.remote_inspection?.pending_count) ||
    manifest.remote_inspection.pending_count !== pendingFilenames.length ||
    !isNonEmptyString(manifest.approval?.approved_by) ||
    !isNonEmptyString(manifest.approval?.approved_at)
  ) {
    throw new Error('approval-evidence-invalid');
  }

  const localFilenames = snapshot.entries.map((entry) => entry.filename);
  const firstPendingIndex = localFilenames.indexOf(pendingFilenames[0]);
  const expectedPendingSuffix = firstPendingIndex >= 0 ? localFilenames.slice(firstPendingIndex) : [];
  const expectedAppliedHead = firstPendingIndex > 0 ? localFilenames[firstPendingIndex - 1] : null;
  if (
    expectedPendingSuffix.length !== pendingFilenames.length ||
    expectedPendingSuffix.some((filename, index) => filename !== pendingFilenames[index]) ||
    manifest.remote_inspection.applied_head !== expectedAppliedHead
  ) {
    throw new Error('remote-migration-boundary-mismatch');
  }

  const approved = manifest.approved_pending_entries;
  if (!Array.isArray(approved) || approved.length === 0 || approved.length !== pendingFilenames.length) {
    throw new Error('approved-pending-count-mismatch');
  }
  const snapshotByName = new Map(snapshot.entries.map((entry) => [entry.filename, entry]));
  const canonicalApproved = approved.map((entry, index) => {
    const local = snapshotByName.get(entry?.filename);
    if (
      entry?.order !== index + 1 ||
      !MIGRATION_NAME.test(entry?.filename ?? '') ||
      !isSha256(entry?.sha256) ||
      local?.sha256 !== entry.sha256 ||
      entry.filename !== pendingFilenames[index]
    ) {
      throw new Error('approved-pending-mismatch');
    }
    return entry.filename;
  });

  const freshness = manifest.pre_apply_freshness_check;
  if (
    !isNonEmptyString(freshness?.checked_at) ||
    !isNonEmptyString(freshness?.evidence_ref) ||
    freshness?.repository_head_matches !== true ||
    freshness?.ordered_migrations_digest_matches !== true ||
    freshness?.remote_inspection_matches !== true
  ) {
    throw new Error('manifest-freshness-not-approved');
  }
  return canonicalApproved;
}

export function verifyForWorkflow({
  manifestJson,
  repositoryHead,
  migrationsDir,
  runRemoteList = runWranglerMigrationList,
}) {
  const manifest = JSON.parse(manifestJson);
  const snapshot = migrationSnapshot(migrationsDir);
  const pendingFilenames = pendingMigrationsFromWrangler(runRemoteList());
  return verifyApprovedManifest({ manifest, repositoryHead, snapshot, pendingFilenames });
}

function isMainModule() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  try {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    verifyForWorkflow({
      manifestJson: process.env.APPROVED_MIGRATION_MANIFEST_JSON ?? '',
      repositoryHead: process.env.GITHUB_SHA ?? '',
      migrationsDir: resolve(repositoryRoot, 'migrations'),
    });
    console.log('✅ 承認manifestと現在のpending migrationが一致しました。');
  } catch {
    console.error(`::error::${MANIFEST_REMEDIATION}`);
    process.exitCode = 1;
  }
}
