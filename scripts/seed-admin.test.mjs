import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./seed-admin.mjs', import.meta.url));
const productionSetup = fileURLToPath(new URL('../.cloudflare/setup-production.mjs', import.meta.url));
const syntheticToken = 'synthetic_local_invitation_token_1234567890';

function generate(args = [], token = syntheticToken) {
  return spawnSync(process.execPath, [script, '--print-sql', '--local-fixture', ...args, '--token-stdin'], {
    encoding: 'utf8',
    input: `${token}\n`,
  });
}

test('ローカルfixtureは利用者や仮パスワードを作らず、本人承諾用の招待だけを作る', () => {
  const result = generate(['--email', 'owner@example.test', '--role', 'admin']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /INSERT INTO invitations/);
  assert.match(result.stdout, /UPDATE invitations/);
  assert.match(result.stdout, /owner@example\.test/);
  assert.match(result.stdout, /'admin'/);
  assert.match(result.stdout, new RegExp(createHash('sha256').update(syntheticToken).digest('hex')));
  assert.doesNotMatch(result.stdout, new RegExp(syntheticToken));
  assert.doesNotMatch(result.stdout, /INSERT INTO (?:users|"user"|account)|password_hash|must_change/i);
});

test('本番投入に見える呼び出しと旧パスワードフラグを拒否する', () => {
  const withoutLocalMarker = spawnSync(process.execPath, [script, '--print-sql', '--token-stdin'], {
    encoding: 'utf8',
    input: `${syntheticToken}\n`,
  });
  assert.notEqual(withoutLocalMarker.status, 0);
  assert.match(withoutLocalMarker.stderr, /--local-fixture/);

  const legacy = spawnSync(process.execPath, [script, '--password-stdin'], {
    encoding: 'utf8',
    input: 'unused\n',
  });
  assert.notEqual(legacy.status, 0);
  assert.match(legacy.stderr, /廃止/);
});

test('招待tokenの平文をSQLとエラーに出さない', () => {
  const invalidToken = 'too-short';
  const result = generate([], invalidToken);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, new RegExp(invalidToken));
  assert.doesNotMatch(result.stderr, new RegExp(invalidToken));
});

test('本番setup helperはBetter Auth・Google・メールの4 secret名だけを扱う', () => {
  const source = readFileSync(productionSetup, 'utf8');
  for (const name of ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'RESEND_API_KEY']) {
    assert.match(source, new RegExp(name));
  }
  const retiredName = ['SESSION', 'SECRET'].join('_');
  assert.doesNotMatch(source, new RegExp(retiredName));
  assert.doesNotMatch(source, /AUTH_PASSWORD|rotate-auth-password/);
  assert.match(source, /actions\/variables/);
  assert.doesNotMatch(source, /\['variable', 'set'/);
  assert.match(source, /MAIL_FROM/);
  assert.match(source, /validateMailFrom/);
});
