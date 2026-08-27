import { pathToFileURL } from 'node:url';

import { parseWranglerMigrationListResult, runWranglerMigrationList } from './wrangler-output.mjs';

export const MIGRATION_REMEDIATION = 'Migrate workflowをAPPLYで手動実行した後、Deployを再実行してください。';

export function classifyMigrationList({ exitCode, stdout = '', stderr = '', error }) {
  return parseWranglerMigrationListResult({ exitCode, stdout, stderr, error }).state;
}

export function runMigrationCheck(runCommand = runWranglerMigrationList) {
  const status = classifyMigrationList(runCommand());
  return { ok: status === 'no-pending', status };
}

function isMainModule() {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const result = runMigrationCheck();
  if (result.ok) {
    console.log('✅ D1 migrationの未適用はありません。');
  } else {
    console.error(`::error::${MIGRATION_REMEDIATION}`);
    process.exitCode = 1;
  }
}
