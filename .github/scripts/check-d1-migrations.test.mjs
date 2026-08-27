import assert from 'node:assert/strict';
import test from 'node:test';

import { MIGRATION_REMEDIATION, classifyMigrationList, runMigrationCheck } from './check-d1-migrations.mjs';

test('no-pending: Wranglerの明示的な適用済み応答だけを許可する', () => {
  assert.equal(
    classifyMigrationList({
      exitCode: 0,
      stdout: '\u001b[32m✅ No migrations to apply!\u001b[39m\r\n',
    }),
    'no-pending',
  );
});

test('pending: 未適用migrationの一覧を拒否する', () => {
  const result = runMigrationCheck(() => ({
    exitCode: 0,
    stdout: 'Migrations to be applied:\n┌────────┐\n│ Name   │\n├────────┤\n│ 0015.sql │\n└────────┘\n',
  }));

  assert.deepEqual(result, { ok: false, status: 'pending' });
});

test('unparseable: 新しい未知の形式をfail-closedで拒否する', () => {
  assert.equal(classifyMigrationList({ exitCode: 0, stdout: '{"migrations":[]}' }), 'unparseable');
  assert.equal(
    classifyMigrationList({
      exitCode: 0,
      stdout: '✅ No migrations to apply!',
      stderr: 'unexpected warning',
    }),
    'unparseable',
  );
});

test('command-failure: Wranglerが失敗したら出力内容に依存せず拒否する', () => {
  const result = runMigrationCheck(() => ({
    exitCode: 1,
    stderr: 'credential-like diagnostic must not be printed',
    stdout: '',
  }));

  assert.deepEqual(result, { ok: false, status: 'command-failure' });
  assert.equal(
    MIGRATION_REMEDIATION,
    'Migrate workflowをAPPLYで手動実行した後、Deployを再実行してください。',
  );
});
