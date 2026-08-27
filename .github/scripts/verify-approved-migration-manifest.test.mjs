import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MANIFEST_REMEDIATION,
  pendingMigrationsFromWrangler,
  verifyApprovedManifest,
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

test('Wrangler pending一覧を順序どおり抽出し、失敗・未知形式はfail-closedにする', () => {
  assert.deepEqual(
    pendingMigrationsFromWrangler({
      exitCode: 0,
      stdout:
        'Migrations to be applied:\n┌──────┐\n│ 0014_password_login_rate_limits.sql │\n│ 0015_mf_source_columns.sql │\n└──────┘\n',
    }),
    pendingFilenames,
  );
  assert.throws(() => pendingMigrationsFromWrangler({ exitCode: 1, stderr: 'must-not-be-logged' }));
  assert.throws(() => pendingMigrationsFromWrangler({ exitCode: 0, stdout: '{"pending":[]}' }));
  assert.equal(
    MANIFEST_REMEDIATION,
    '承認manifest・repository head・remote pendingを再取得して承認し直してから、Migrateを再実行してください。',
  );
});
