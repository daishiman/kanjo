import { execFile } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const smokeScript = fileURLToPath(new URL('./preview-smoke.mjs', import.meta.url));

test(
  '一時local D1/R2でmigrationから現金記帳・証憑の登録/閲覧/削除まで有限に往復する',
  { timeout: 180_000 },
  async () => {
    const result = await execFileAsync(process.execPath, [smokeScript], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout: 170_000,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  },
);
