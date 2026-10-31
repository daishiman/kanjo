import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

import {
  APPROVALS_PATH,
  parseApprovals,
  readApprovals,
  sha256,
  unapprovedDestructiveMigrations,
} from './migration-approvals.mjs';
import { destructiveFindings } from './plan-auto-migration.mjs';

const DROP = 'DROP TABLE old;';
const ADD = 'CREATE TABLE memo (id TEXT);';

const ledger = (baseline, entries) =>
  JSON.stringify({
    schema_version: 1,
    baseline,
    approvals: entries.map(([filename, sql]) => ({
      filename,
      sha256: sha256(sql),
      reason: '確認済み',
      approved_by: 'test',
    })),
  });

const dirs = [];
function migrationsDirWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'kanjo-approvals-'));
  dirs.push(dir);
  for (const [filename, sql] of Object.entries(files)) writeFileSync(join(dir, filename), sql);
  return dir;
}

after(() => {
  for (const dir of dirs) rmSync(dir, { force: true, recursive: true });
});

const check = (files, baseline, entries) =>
  unapprovedDestructiveMigrations({
    migrationsDir: migrationsDirWith(files),
    approvals: parseApprovals(ledger(baseline, entries)),
    findings: destructiveFindings,
  });

describe('parseApprovals', () => {
  it('形の崩れた台帳は読まない', () => {
    assert.throws(() => parseApprovals('{"schema_version":2,"baseline":"0001_a.sql","approvals":[]}'));
    assert.throws(() => parseApprovals('{"schema_version":1,"baseline":"latest","approvals":[]}'));
  });

  it('理由・承認者の無い承認と重複承認を拒む', () => {
    const entry = { filename: '0002_b.sql', sha256: sha256(DROP), reason: '', approved_by: 'x' };
    assert.throws(() =>
      parseApprovals(JSON.stringify({ schema_version: 1, baseline: '0001_a.sql', approvals: [entry] })),
    );
    const ok = { ...entry, reason: 'r' };
    assert.throws(() =>
      parseApprovals(JSON.stringify({ schema_version: 1, baseline: '0001_a.sql', approvals: [ok, ok] })),
    );
  });
});

describe('unapprovedDestructiveMigrations', () => {
  it('承認の無い破壊的 migration を挙げる', () => {
    const problems = check({ '0002_drop.sql': DROP }, '0001_base.sql', []);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /0002_drop\.sql/);
  });

  it('承認済み・追加だけ・baseline 以前は通す', () => {
    const problems = check(
      { '0001_old_drop.sql': DROP, '0002_add.sql': ADD, '0003_drop.sql': DROP },
      '0001_old_drop.sql',
      [['0003_drop.sql', DROP]],
    );
    assert.deepEqual(problems, []);
  });

  it('承認後に本文が変わったら挙げる', () => {
    const problems = check({ '0002_drop.sql': `${DROP}\nDROP TABLE other;` }, '0001_base.sql', [
      ['0002_drop.sql', DROP],
    ]);
    assert.match(problems.join('\n'), /承認後に本文が変わりました/);
  });

  it('migration の無い承認を挙げる', () => {
    const problems = check({}, '0001_base.sql', [['0002_gone.sql', DROP]]);
    assert.match(problems.join('\n'), /見つかりません/);
  });
});

describe('リポジトリの承認台帳', () => {
  const root = resolve(import.meta.dirname, '../..');

  it('台帳は契約どおりに読める', () => {
    assert.doesNotThrow(() => readApprovals(root));
    assert.ok(readFileSync(resolve(root, APPROVALS_PATH), 'utf8').endsWith('\n'));
  });

  it('いまの migrations に未承認の破壊的変更は無い', () => {
    const problems = unapprovedDestructiveMigrations({
      migrationsDir: resolve(root, 'migrations'),
      approvals: readApprovals(root),
      findings: destructiveFindings,
    });
    assert.deepEqual(problems, []);
  });
});
