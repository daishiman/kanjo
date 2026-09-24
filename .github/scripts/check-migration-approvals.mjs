import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readApprovals, unapprovedDestructiveMigrations } from './migration-approvals.mjs';
import { destructiveFindings } from './plan-auto-migration.mjs';

// PR ゲート (pnpm lint)。行や列を失う migration は、承認を足さないと merge できない。
// ここで止めておけば、merge 後の Deploy が承認待ちで止まることはない。
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const problems = unapprovedDestructiveMigrations({
  migrationsDir: resolve(repositoryRoot, 'migrations'),
  approvals: readApprovals(repositoryRoot),
  findings: destructiveFindings,
});
if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exitCode = 1;
} else {
  console.log('✅ 破壊的な D1 migration はすべて承認済みです。');
}
