import assert from 'node:assert/strict';
import test from 'node:test';

import { MIGRATION_REMEDIATION, classifyMigrationList, runMigrationCheck } from './check-d1-migrations.mjs';

test('Wrangler結果をDeploy用の4状態へ分類する', () => {
  assert.equal(classifyMigrationList({ exitCode: 0, stdout: '✅ No migrations to apply!' }), 'no-pending');
  assert.equal(
    classifyMigrationList({
      exitCode: 0,
      stdout:
        'Migrations to be applied:\n┌────────┐\n│ Name   │\n├────────┤\n│ 0015_mf_source_columns.sql │\n└────────┘',
    }),
    'pending',
  );
  assert.equal(classifyMigrationList({ exitCode: 0, stdout: '{"migrations":[]}' }), 'unparseable');
  assert.equal(
    classifyMigrationList({ exitCode: 1, stderr: 'credential-like diagnostic must not be printed' }),
    'command-failure',
  );
});

test('依存注入したrunnerの判定をokへ変換する', () => {
  assert.deepEqual(
    runMigrationCheck(() => ({ exitCode: 0, stdout: '✅ No migrations to apply!' })),
    { ok: true, status: 'no-pending' },
  );
  assert.deepEqual(
    runMigrationCheck(() => ({ exitCode: 0, stdout: 'unknown' })),
    {
      ok: false,
      status: 'unparseable',
    },
  );
});

test('失敗時の利用者向け修復案内を固定する', () => {
  assert.equal(
    MIGRATION_REMEDIATION,
    'Migrate workflowをAPPLYで手動実行した後、Deployを再実行してください。',
  );
});
