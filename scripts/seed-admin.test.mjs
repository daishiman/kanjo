import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./seed-admin.mjs', import.meta.url));
const productionSetup = fileURLToPath(new URL('../.cloudflare/setup-production.mjs', import.meta.url));

function generate(args, password = 'Secret-Plaintext-For-Test') {
  return spawnSync(process.execPath, [script, '--print-sql', ...args, '--password-stdin'], {
    encoding: 'utf8',
    input: `${password}\n`,
  });
}

test('bootstrapは利用者が0件のときだけ初期adminを作る', () => {
  const result = generate(['--mode', 'bootstrap', '--email', 'owner@example.test']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /INSERT INTO users/);
  assert.match(result.stdout, /WHERE NOT EXISTS \(SELECT 1 FROM users\)/);
  assert.doesNotMatch(result.stdout, /DELETE FROM users/i);
  assert.doesNotMatch(result.stdout, /Secret-Plaintext-For-Test/);
});

test('break-glass resetは指定済みadminのidentityを保って更新する', () => {
  const result = generate([
    '--mode',
    'reset-admin',
    '--user-id',
    'usr_existing_admin',
    '--email',
    'ignored@example.test',
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /UPDATE users/);
  assert.match(result.stdout, /WHERE id = 'usr_existing_admin' AND role = 'admin'/);
  assert.doesNotMatch(result.stdout, /DELETE FROM users|INSERT INTO users/i);
  assert.doesNotMatch(result.stdout, /Secret-Plaintext-For-Test|ignored@example\.test/);
});

test('modeやreset対象を省略した本番SQL生成は拒否する', () => {
  assert.notEqual(generate(['--email', 'owner@example.test']).status, 0);
  assert.notEqual(generate(['--mode', 'reset-admin', '--email', 'owner@example.test']).status, 0);
});

test('本番setup helperが登録するWorker secretはSESSION_SECRETだけ', () => {
  const source = readFileSync(productionSetup, 'utf8');
  assert.match(source, /SESSION_SECRET/);
  assert.doesNotMatch(source, /AUTH_PASSWORD|rotate-auth-password/);
});
