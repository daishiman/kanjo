import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const smokeScript = fileURLToPath(new URL('./preview-smoke.mjs', import.meta.url));

test(
  '一時local D1でmigrationから認証・現金記帳の作成・一覧・削除・空一覧と廃止API 404を確かめる',
  { timeout: 180_000 },
  async () => {
    const result = await execFileAsync(process.execPath, [smokeScript], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout: 170_000,
    });
    assert.match(
      result.stdout,
      /local preview smoke passed: migrations, SPA, auth, cash create\/list\/delete\/empty list, retired API 404/,
    );
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  },
);
