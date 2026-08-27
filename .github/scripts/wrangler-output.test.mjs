import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeOutput,
  parseMigrationListOutput,
  parseWranglerMigrationListResult,
} from './wrangler-output.mjs';

const banner = (version = '4.84.1', update = '4.127.0') =>
  ` ⛅️ wrangler ${version}${update === undefined ? '' : ` (update available ${update})`}\n${'─'.repeat(46)}\nResource location: remote\n\n`;

const pendingTable = (...filenames) => {
  const width = Math.max('Name'.length, ...filenames.map((filename) => filename.length)) + 2;
  const row = (value) => `│ ${value.padEnd(width - 2)} │`;
  const divider = `├${'─'.repeat(width)}┤`;
  const migrationRows = filenames.flatMap((filename, index) =>
    index === filenames.length - 1 ? [row(filename)] : [row(filename), divider],
  );
  return [
    'Migrations to be applied:',
    `┌${'─'.repeat(width)}┐`,
    row('Name'),
    divider,
    ...migrationRows,
    `└${'─'.repeat(width)}┘`,
  ].join('\n');
};

const parse = (stdout) => parseMigrationListOutput(normalizeOutput(stdout));

test('ANSIとCRLFを正規化してno-pendingを解析する', () => {
  assert.deepEqual(parse('\u001b[32m✅ No migrations to apply!\u001b[39m\r\n'), {
    state: 'no-pending',
    body: '✅ No migrations to apply!',
  });
});

test('版数非固定の既知banner付きpending/no-pendingを受理する', () => {
  assert.deepEqual(parse(`${banner('12.345.678', undefined)}✅ No migrations to apply!`), {
    state: 'no-pending',
    body: '✅ No migrations to apply!',
  });

  const parsed = parse(`${banner()}${pendingTable('0014_password_login_rate_limits.sql')}`);
  assert.equal(parsed?.state, 'pending');
  assert.deepEqual(parsed?.filenames, ['0014_password_login_rate_limits.sql']);
});

test('観測済みwrangler.jsonc secrets WARNINGだけを許容する', () => {
  assert.equal(
    parseWranglerMigrationListResult({
      exitCode: 0,
      stdout: '✅ No migrations to apply!',
      stderr:
        '▲ [WARNING] Processing wrangler.jsonc configuration:\r\n\r\n    - "secrets" fields are experimental.\r\n',
    }).state,
    'no-pending',
  );
});

test('未知WARNINGは同じ装飾形状でも拒否する', () => {
  assert.equal(
    parseWranglerMigrationListResult({
      exitCode: 0,
      stdout: '✅ No migrations to apply!',
      stderr:
        '▲ [WARNING] Processing wrangler.jsonc configuration:\n\n    - "vars" fields are experimental.\n',
    }).state,
    'unparseable',
  );
});

test('両markerがある出力を拒否する', () => {
  assert.equal(
    parse(`${pendingTable('0014_password_login_rate_limits.sql')}\n✅ No migrations to apply!`),
    null,
  );
});

test('同一markerが重複する出力を拒否する', () => {
  assert.equal(parse('✅ No migrations to apply!\n✅ No migrations to apply!'), null);
  assert.equal(
    parse(
      `${pendingTable('0014_password_login_rate_limits.sql')}\n${pendingTable('0015_mf_source_columns.sql')}`,
    ),
    null,
  );
});

test('未知prefixと未知suffixを拒否する', () => {
  const pending = pendingTable('0014_password_login_rate_limits.sql');
  assert.equal(parse(`unexpected prefix\n${pending}`), null);
  assert.equal(parse(`${pending}\nunexpected suffix`), null);
});

test('no-pending marker後の余剰行を拒否する', () => {
  assert.equal(parse('✅ No migrations to apply!\nextra line'), null);
});

test('pending filenameはMIGRATION_NAMEの単一文法で抽出し重複を除く', () => {
  const parsed = parse(
    pendingTable(
      '0014_password_login_rate_limits.sql',
      '0014_password_login_rate_limits.sql',
      '0015_mf_source_columns.sql',
    ),
  );
  assert.deepEqual(parsed?.filenames, ['0014_password_login_rate_limits.sql', '0015_mf_source_columns.sql']);
});

test('複数migration行の間に区切り線がない未知table形式を拒否する', () => {
  assert.equal(
    parse(
      'Migrations to be applied:\n' +
        '┌──────┐\n' +
        '│ Name │\n' +
        '├──────┤\n' +
        '│ 0014_password_login_rate_limits.sql │\n' +
        '│ 0015_mf_source_columns.sql │\n' +
        '└──────┘',
    ),
    null,
  );
});
