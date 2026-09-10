import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  MANIFEST_REMEDIATION,
  migrationSnapshot,
  pendingMigrationsFromWrangler,
  verifyApprovedManifest,
  verifyForWorkflow,
} from './verify-approved-migration-manifest.mjs';

const repositoryHead = '0123456789abcdef0123456789abcdef01234567';
const digestA = 'a'.repeat(64);
const digestB = 'b'.repeat(64);
const snapshot = {
  head: '0015_mf_source_columns.sql',
  orderedMigrationsDigestSha256: digestB,
  entries: [
    { order: 1, filename: '0013_attachment_object_tombstones.sql', sha256: 'c'.repeat(64) },
    { order: 2, filename: '0014_password_login_rate_limits.sql', sha256: digestA },
    { order: 3, filename: '0015_mf_source_columns.sql', sha256: digestB },
  ],
};
const pendingFilenames = ['0014_password_login_rate_limits.sql', '0015_mf_source_columns.sql'];

const approvedManifest = () => ({
  schema_version: 1,
  document_type: 'approved_pending_migration_manifest',
  manifest_status: 'approved',
  target: { environment: 'production', database: 'kanjo-db' },
  repository: {
    head: repositoryHead,
    migration_head: snapshot.head,
    ordered_migrations_digest_sha256: snapshot.orderedMigrationsDigestSha256,
  },
  remote_inspection: {
    captured_at: '2026-08-27T00:00:00Z',
    evidence_ref: 'non-secret-run-reference',
    applied_head: '0013_attachment_object_tombstones.sql',
    pending_count: 2,
  },
  approved_pending_entries: snapshot.entries.slice(1).map((entry, index) => ({
    ...entry,
    order: index + 1,
  })),
  approval: { approved_by: 'human-approver', approved_at: '2026-08-27T00:01:00Z' },
  pre_apply_freshness_check: {
    checked_at: '2026-08-27T00:02:00Z',
    repository_head_matches: true,
    ordered_migrations_digest_matches: true,
    remote_inspection_matches: true,
    evidence_ref: 'non-secret-freshness-reference',
  },
});

test('承認manifest・repository・remote pendingが完全一致すると通過する', () => {
  assert.deepEqual(
    verifyApprovedManifest({ manifest: approvedManifest(), repositoryHead, snapshot, pendingFilenames }),
    pendingFilenames,
  );
});

test('repository headまたはmigration digestの変更を拒否する', () => {
  const wrongHead = approvedManifest();
  wrongHead.repository.head = 'f'.repeat(40);
  assert.throws(() =>
    verifyApprovedManifest({ manifest: wrongHead, repositoryHead, snapshot, pendingFilenames }),
  );
  const wrongDigest = approvedManifest();
  wrongDigest.repository.ordered_migrations_digest_sha256 = 'c'.repeat(64);
  assert.throws(() =>
    verifyApprovedManifest({ manifest: wrongDigest, repositoryHead, snapshot, pendingFilenames }),
  );
});

test('承認後にremote pendingの順序・集合が変わると拒否する', () => {
  assert.throws(() =>
    verifyApprovedManifest({
      manifest: approvedManifest(),
      repositoryHead,
      snapshot,
      pendingFilenames: [...pendingFilenames].reverse(),
    }),
  );
});

test('remote applied headとpending境界が一致しないmanifestを拒否する', () => {
  const missingAppliedHead = approvedManifest();
  missingAppliedHead.remote_inspection.applied_head = null;
  assert.throws(() =>
    verifyApprovedManifest({
      manifest: missingAppliedHead,
      repositoryHead,
      snapshot,
      pendingFilenames,
    }),
  );

  assert.throws(() =>
    verifyApprovedManifest({
      manifest: approvedManifest(),
      repositoryHead,
      snapshot,
      pendingFilenames: ['0015_mf_source_columns.sql'],
    }),
  );
});

test('未承認またはfreshness未確認のmanifestを拒否する', () => {
  const unapproved = approvedManifest();
  unapproved.manifest_status = 'unapproved';
  assert.throws(() =>
    verifyApprovedManifest({ manifest: unapproved, repositoryHead, snapshot, pendingFilenames }),
  );
  const stale = approvedManifest();
  stale.pre_apply_freshness_check.remote_inspection_matches = false;
  assert.throws(() =>
    verifyApprovedManifest({ manifest: stale, repositoryHead, snapshot, pendingFilenames }),
  );
});

test('承認manifestはR2 cleanupのRelease世代境界も検証する', () => {
  const releaseSnapshot = {
    head: '0039_drop_tax_and_receipt_tables.sql',
    orderedMigrationsDigestSha256: 'd'.repeat(64),
    entries: [
      { order: 1, filename: '0037_unrelated.sql', sha256: '7'.repeat(64) },
      { order: 2, filename: '0038_prepare_r2_cleanup.sql', sha256: '8'.repeat(64) },
      { order: 3, filename: '0039_drop_tax_and_receipt_tables.sql', sha256: '9'.repeat(64) },
    ],
  };
  const manifest = approvedManifest();
  manifest.repository.migration_head = releaseSnapshot.head;
  manifest.repository.ordered_migrations_digest_sha256 = releaseSnapshot.orderedMigrationsDigestSha256;
  manifest.remote_inspection.applied_head = '0037_unrelated.sql';
  manifest.approved_pending_entries = releaseSnapshot.entries.slice(1).map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
  assert.throws(
    () =>
      verifyApprovedManifest({
        manifest,
        repositoryHead,
        snapshot: releaseSnapshot,
        pendingFilenames: ['0038_prepare_r2_cleanup.sql', '0039_drop_tax_and_receipt_tables.sql'],
      }),
    /r2-cleanup-release-boundary-invalid/,
  );
});

test('Migrate経路はRelease Bのみremote cleanup残件を検証する', () => {
  const migrationsDir = mkdtempSync(join(tmpdir(), 'kanjo-migrations-'));
  try {
    for (const filename of [
      '0037_unrelated.sql',
      '0038_prepare_r2_cleanup.sql',
      '0039_drop_tax_and_receipt_tables.sql',
    ]) {
      writeFileSync(join(migrationsDir, filename), `-- ${filename}\nSELECT 1;\n`);
    }
    const releaseSnapshot = migrationSnapshot(migrationsDir);
    const manifest = {
      ...approvedManifest(),
      repository: {
        head: repositoryHead,
        migration_head: releaseSnapshot.head,
        ordered_migrations_digest_sha256: releaseSnapshot.orderedMigrationsDigestSha256,
      },
      remote_inspection: {
        ...approvedManifest().remote_inspection,
        applied_head: '0038_prepare_r2_cleanup.sql',
        pending_count: 1,
      },
      approved_pending_entries: [{ ...releaseSnapshot.entries[2], order: 1 }],
    };
    const runRemoteList = () => ({
      exitCode: 0,
      stdout:
        'Migrations to be applied:\n' +
        '┌──────┐\n' +
        '│ Name │\n' +
        '├──────┤\n' +
        '│ 0039_drop_tax_and_receipt_tables.sql │\n' +
        '└──────┘',
      stderr: '',
    });
    let cleanupInspections = 0;
    const runCleanupStatus = () => {
      cleanupInspections += 1;
      return {
        exitCode: 0,
        stdout:
          '[{"success":true,"results":[{"pending":0,"retry":0,"dead":0,"attachments":0,"attachment_cleanup_jobs":0}]}]',
        stderr: '',
      };
    };

    assert.deepEqual(
      verifyForWorkflow({
        manifestJson: JSON.stringify(manifest),
        repositoryHead,
        migrationsDir,
        runRemoteList,
        runCleanupStatus,
      }),
      ['0039_drop_tax_and_receipt_tables.sql'],
    );
    assert.equal(cleanupInspections, 1);
  } finally {
    rmSync(migrationsDir, { recursive: true, force: true });
  }
});

test('装飾付きWrangler pending一覧を順序どおり抽出する', () => {
  assert.deepEqual(
    pendingMigrationsFromWrangler({
      exitCode: 0,
      stdout:
        ' ⛅️ wrangler 4.84.1 (update available 4.127.0)\n' +
        '──────────────────────────────────────────────\n' +
        'Resource location: remote\n\n' +
        'Migrations to be applied:\n' +
        '┌──────┐\n' +
        '│ Name │\n' +
        '├──────┤\n' +
        '│ 0014_password_login_rate_limits.sql │\n' +
        '├──────┤\n' +
        '│ 0015_mf_source_columns.sql │\n' +
        '└──────┘\n',
      stderr:
        '▲ [WARNING] Processing wrangler.jsonc configuration:\n\n    - "secrets" fields are experimental.\n',
    }),
    pendingFilenames,
  );
});

test('Wrangler command失敗と未知出力を別のエラーに分類する', () => {
  assert.throws(
    () => pendingMigrationsFromWrangler({ exitCode: 1, stderr: 'must-not-be-logged' }),
    /remote-inspection-failed/,
  );
  assert.throws(
    () => pendingMigrationsFromWrangler({ exitCode: 0, stdout: '{"pending":[]}' }),
    /remote-inspection-unparseable/,
  );
  assert.throws(
    () =>
      pendingMigrationsFromWrangler({
        exitCode: 0,
        stdout: 'Migrations to be applied:\n┌──────┐\n│ Name │\n├──────┤\n└──────┘',
      }),
    /remote-pending-empty-or-unparseable/,
  );
  assert.throws(
    () =>
      pendingMigrationsFromWrangler({
        exitCode: 0,
        stdout: '✅ No migrations to apply!',
        stderr: '▲ [WARNING] unexpected warning',
      }),
    /remote-inspection-failed/,
  );
  assert.equal(
    MANIFEST_REMEDIATION,
    '承認manifest・repository head・remote pendingを再取得して承認し直してから、Migrateを再実行してください。',
  );
});
