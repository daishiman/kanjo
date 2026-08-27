import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { isAcceptableStderr, migrationListBody, normalizeOutput } from './wrangler-output.mjs';

export const MIGRATION_REMEDIATION = 'Migrate workflowをAPPLYで手動実行した後、Deployを再実行してください。';

export function classifyMigrationList({ exitCode, stdout = '', stderr = '', error }) {
  if (error !== undefined || exitCode !== 0) {
    return 'command-failure';
  }

  if (!isAcceptableStderr(normalizeOutput(stderr))) {
    return 'unparseable';
  }

  const parsed = migrationListBody(normalizeOutput(stdout));
  return parsed === null ? 'unparseable' : parsed.state;
}

export function runMigrationCheck(runCommand = runWranglerMigrationList) {
  const status = classifyMigrationList(runCommand());
  return { ok: status === 'no-pending', status };
}

function runWranglerMigrationList() {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@kanjo/api', 'exec', 'wrangler', 'd1', 'migrations', 'list', 'kanjo-db', '--remote'],
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
