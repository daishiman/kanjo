import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertR2CleanupReleaseBoundary,
  parseR2CleanupStatusResult,
  requiresR2CleanupReleaseGate,
  verifyR2CleanupIsDrained,
} from './verify-r2-cleanup-release-gate.mjs';

const PREPARE = '0038_prepare_r2_cleanup.sql';
const DROP = '0039_drop_tax_and_receipt_tables.sql';

test('Release AではR2 cleanupゲートを開動しない', () => {
  assert.equal(requiresR2CleanupReleaseGate([PREPARE]), false);
  assert.doesNotThrow(() => assertR2CleanupReleaseBoundary([PREPARE]));
});

test('0038と0039の初回連続適用を拒否する', () => {
  assert.throws(() => assertR2CleanupReleaseBoundary([PREPARE, DROP]), /r2-cleanup-release-boundary-invalid/);
});

test('Release Bは0039だけがpendingならcleanup残件ゲートを開動する', () => {
  assert.equal(requiresR2CleanupReleaseGate([DROP]), true);
  assert.doesNotThrow(() => assertR2CleanupReleaseBoundary([DROP]));
});

test('中立台帳と旧metadataがすべて0件な場合だけRelease Bを通す', () => {
  const result = {
    exitCode: 0,
    stdout: JSON.stringify([
      {
        success: true,
        results: [{ pending: 0, retry: 0, dead: 0, attachments: 0, attachment_cleanup_jobs: 0 }],
      },
    ]),
    stderr: '',
  };
  assert.deepEqual(parseR2CleanupStatusResult(result), {
    pending: 0,
    retry: 0,
    dead: 0,
    attachments: 0,
    attachmentCleanupJobs: 0,
  });
  assert.doesNotThrow(() => verifyR2CleanupIsDrained(result));

  for (const nonzero of [
    { pending: 1, retry: 0, dead: 0, attachments: 0, attachment_cleanup_jobs: 0 },
    { pending: 0, retry: 0, dead: 0, attachments: 1, attachment_cleanup_jobs: 0 },
    { pending: 0, retry: 0, dead: 0, attachments: 0, attachment_cleanup_jobs: 1 },
  ])
    assert.throws(
      () =>
        verifyR2CleanupIsDrained({
          exitCode: 0,
          stdout: JSON.stringify([{ success: true, results: [nonzero] }]),
          stderr: '',
        }),
      /r2-cleanup-not-drained/,
    );
});

test('remote確認の失敗・未知state・不正countはfail-closedに拒否する', () => {
  for (const result of [
    { exitCode: 1, stdout: '', stderr: 'must-not-be-logged' },
    { exitCode: 0, stdout: 'not-json', stderr: '' },
    {
      exitCode: 0,
      stdout: JSON.stringify([{ success: true, results: [{ pending: 0 }] }]),
      stderr: '',
    },
    {
      exitCode: 0,
      stdout: JSON.stringify([
        {
          success: true,
          results: [{ pending: 0, retry: -1, dead: 0, attachments: 0, attachment_cleanup_jobs: 0 }],
        },
      ]),
      stderr: '',
    },
  ]) {
    assert.throws(() => parseR2CleanupStatusResult(result), /r2-cleanup-inspection-failed/);
  }
});
