import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLocalAuthConfiguration } from './check-login-v2-readiness.mjs';

const settings = [
  `BETTER_AUTH_SECRET=${'synthetic-secret-'.repeat(3)}`,
  'BETTER_AUTH_URL=http://localhost:8787',
  'GOOGLE_CLIENT_ID=synthetic-client-id',
  'GOOGLE_CLIENT_SECRET=synthetic-client-secret',
  'RESEND_API_KEY=synthetic-mail-key',
  'MAIL_FROM=Focus Ledger <noreply@synthetic.local>',
  'ACCESS_AUD=',
  'ACCESS_TEAM_DOMAIN=',
];

test('設定が揃ったローカル構成を値を含めずに報告する', () => {
  const report = checkLocalAuthConfiguration(settings.join('\n'));
  assert.equal(report.ready, true);
  for (const entry of settings.filter((line) => !line.endsWith('='))) {
    assert.equal(JSON.stringify(report).includes(entry.slice(entry.indexOf('=') + 1)), false);
  }
});

test('空設定・空引用符・短いsecret・プレースホルダーの送信元を通さない', () => {
  const report = checkLocalAuthConfiguration(
    'BETTER_AUTH_SECRET=short\nGOOGLE_CLIENT_SECRET=""\nMAIL_FROM=no-reply@example.com',
  );
  assert.equal(report.ready, false);
  assert.equal(
    report.checks.find((check) => check.name === 'BETTER_AUTH_SECRET').status,
    'missing_or_invalid',
  );
  assert.equal(report.checks.find((check) => check.name === 'MAIL_FROM').status, 'missing_or_invalid');
});

test('コメントと引用符に対応し、入力中のシェル構文を実行・公開しない', () => {
  const report = checkLocalAuthConfiguration(
    `${settings.join('\n')}\nexport GOOGLE_CLIENT_SECRET="$(throw secret)" # comment`,
  );
  assert.equal(report.ready, true);
  assert.equal(JSON.stringify(report).includes('throw secret'), false);
});

test('Access片側設定と、資格情報・パスを含むoriginを通さない', () => {
  for (const suffix of [
    'ACCESS_AUD=only-one',
    'BETTER_AUTH_URL=https://user:secret@host.local',
    'BETTER_AUTH_URL=https://host.local/path',
  ]) {
    assert.equal(checkLocalAuthConfiguration(`${settings.join('\n')}\n${suffix}`).ready, false);
  }
});

test('送信元の予約ドメインはサブドメイン・大文字・末尾空白でも拒否する', () => {
  for (const from of [
    'Focus Ledger <noreply@sub.example.com>',
    'noreply@SUB.EXAMPLE.NET  ',
    'Name <noreply@example.org>',
  ]) {
    assert.equal(checkLocalAuthConfiguration(`${settings.join('\n')}\nMAIL_FROM=${from}`).ready, false);
  }
});
