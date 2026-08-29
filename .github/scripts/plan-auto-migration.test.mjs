import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

import { destructiveFindings, planAutoMigration, stripSqlNoise } from './plan-auto-migration.mjs';

const BANNER = ['⛅️ wrangler 4.42.0', '─────────────────', 'Resource location: remote'].join('\n');

const noPendingStdout = () => `${BANNER}\n✅ No migrations to apply!\n`;

const pendingStdout = (filenames) => {
  const rows = filenames.map((filename) => `│ ${filename} │`).join('\n├──────────────────────┤\n');
  return [
    BANNER,
    'Migrations to be applied:',
    '┌──────────────────────┐',
    '│ Name │',
    '├──────────────────────┤',
    rows,
    '└──────────────────────┘',
  ].join('\n');
};

const listing = (stdout) => () => ({ exitCode: 0, stdout, stderr: '' });

const dirs = [];
function migrationsDirWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'kanjo-migrations-'));
  dirs.push(dir);
  for (const [filename, sql] of Object.entries(files)) writeFileSync(join(dir, filename), sql);
  return dir;
}

after(() => {
  for (const dir of dirs) rmSync(dir, { force: true, recursive: true });
});

describe('planAutoMigration', () => {
  it('pendingが無ければ適用せずskipする', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({}),
      runRemoteList: listing(noPendingStdout()),
    });
    assert.equal(plan.decision, 'skip');
    assert.deepEqual(plan.filenames, []);
  });

  it('追加だけのmigrationは自動適用へ回す', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({
        '0029_add_table.sql': 'CREATE TABLE memo (id TEXT PRIMARY KEY);\nCREATE INDEX i ON memo(id);',
      }),
      runRemoteList: listing(pendingStdout(['0029_add_table.sql'])),
    });
    assert.equal(plan.decision, 'apply');
    assert.deepEqual(plan.filenames, ['0029_add_table.sql']);
  });

  it('複数pendingの順序を保ったまま返す', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({
        '0029_a.sql': 'CREATE TABLE a (id TEXT);',
        '0030_b.sql': 'ALTER TABLE a ADD COLUMN note TEXT;',
      }),
      runRemoteList: listing(pendingStdout(['0029_a.sql', '0030_b.sql'])),
    });
    assert.equal(plan.decision, 'apply');
    assert.deepEqual(plan.filenames, ['0029_a.sql', '0030_b.sql']);
  });

  it('本文を読み取れないpendingは自動適用しない', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({}),
      runRemoteList: listing(pendingStdout(['0029_missing.sql'])),
    });
    assert.equal(plan.decision, 'blocked');
    assert.match(plan.blockers.join('\n'), /0029_missing\.sql/);
  });

  it('wranglerが失敗したらskipではなくblockedにする', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({}),
      runRemoteList: () => ({ exitCode: 1, stdout: '', stderr: 'boom' }),
    });
    assert.equal(plan.decision, 'blocked');
  });

  it('出力を解釈できないときもblockedにする', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({}),
      runRemoteList: listing('想定外の出力'),
    });
    assert.equal(plan.decision, 'blocked');
  });

  it('検出したlabelをファイル名つきで理由に載せる', () => {
    const plan = planAutoMigration({
      migrationsDir: migrationsDirWith({ '0029_x.sql': 'SELECT 1;' }),
      runRemoteList: listing(pendingStdout(['0029_x.sql'])),
      findings: () => ['列を削除します'],
    });
    assert.equal(plan.decision, 'blocked');
    assert.deepEqual(plan.blockers, ['0029_x.sql: 列を削除します']);
  });
});

describe('stripSqlNoise', () => {
  it('行コメント・ブロックコメントを落とす', () => {
    assert.equal(
      stripSqlNoise('SELECT 1; -- DROP TABLE t\n/* DROP TABLE u */ SELECT 2;'),
      'SELECT 1; SELECT 2;',
    );
  });

  it('文字列リテラルの中身を落とす', () => {
    assert.equal(stripSqlNoise("INSERT INTO t VALUES ('DROP TABLE u');"), "INSERT INTO t VALUES ( '' );");
  });

  it('隣接トークンを連結させない', () => {
    assert.equal(stripSqlNoise('ALTER TABLE "a"ADD COLUMN b TEXT;'), 'ALTER TABLE "" ADD COLUMN b TEXT;');
  });
});

describe('destructiveFindings', () => {
  it('列や行を失う変更を検出する', () => {
    assert.notEqual(destructiveFindings('DROP TABLE entries;').length, 0);
    assert.notEqual(destructiveFindings('ALTER TABLE entries DROP COLUMN memo;').length, 0);
    assert.notEqual(destructiveFindings('DELETE FROM entries WHERE 1;').length, 0);
  });

  it('追加だけの変更は検出しない', () => {
    assert.deepEqual(destructiveFindings('CREATE TABLE entries (id TEXT PRIMARY KEY);'), []);
    assert.deepEqual(destructiveFindings('ALTER TABLE entries ADD COLUMN memo TEXT;'), []);
    assert.deepEqual(destructiveFindings('CREATE INDEX idx_entries_id ON entries(id);'), []);
  });

  it('コメントや文字列に現れた語で誤検出しない', () => {
    assert.deepEqual(destructiveFindings('-- DROP TABLE entries は行わない\nSELECT 1;'), []);
    assert.deepEqual(destructiveFindings("INSERT INTO log (msg) VALUES ('DROP TABLE entries');"), []);
  });

  it('同じ本文を2回判定しても結果が変わらない', () => {
    const sql = 'DROP TABLE entries;';
    assert.deepEqual(destructiveFindings(sql), destructiveFindings(sql));
  });
});
