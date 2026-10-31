#!/usr/bin/env node
/**
 * Better Auth のローカル D1 に、本人が承諾する管理者招待を1件作る。
 *
 * 旧来の「初期パスワードをハッシュ化して利用者へ直接投入」は行わない。
 * 本番の利用者追加は「設定 → 利用者管理」から招待し、この script は使わない。
 * ファイル名は既存のローカル手順と package script の互換性のためだけに残す。
 *
 *   node scripts/seed-admin.mjs
 *   printf '%s\n' '<synthetic-token>' | node scripts/seed-admin.mjs \
 *     --print-sql --local-fixture --email preview@example.test --role member --token-stdin
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
const DEFAULT_EMAIL = 'admin@kanjo.local';
const DEFAULT_ROLE = 'admin';
const DEFAULT_ORIGIN = 'http://localhost:8787';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function flag(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const legacyFlags = ['password', 'password-stdin', 'mode', 'user-id', 'force-change'];
const usedLegacyFlag = legacyFlags.find((name) => process.argv.includes(`--${name}`));
if (usedLegacyFlag) {
  throw new Error(
    `--${usedLegacyFlag} は廃止しました。本番は利用者管理画面の招待、ローカルはこの script の招待を使ってください`,
  );
}

const printSqlOnly = process.argv.includes('--print-sql');
if (printSqlOnly && !process.argv.includes('--local-fixture')) {
  throw new Error('--print-sql は一時ローカルD1用です。--local-fixture を明示してください');
}

const email = String(flag('email', DEFAULT_EMAIL)).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  throw new Error('--email に有効なメールアドレスを指定してください');
}

const role = String(flag('role', DEFAULT_ROLE));
if (!['admin', 'member'].includes(role)) throw new Error('--role は admin または member です');

const origin = String(flag('origin', DEFAULT_ORIGIN)).replace(/\/$/, '');
if (!/^https?:\/\/[^/]+(?::\d+)?$/.test(origin)) {
  throw new Error('--origin はパスなしの http(s) URL です');
}

const tokenFromStdin = process.argv.includes('--token-stdin')
  ? readFileSync(0, 'utf8').replace(/[\r\n]+$/, '')
  : null;
if (printSqlOnly && !tokenFromStdin) {
  throw new Error('--print-sql には --token-stdin が必要です');
}
const token = tokenFromStdin ?? randomBytes(32).toString('base64url');
if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) throw new Error('招待tokenの形式が正しくありません');

const now = new Date();
const nowIso = now.toISOString();
const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS).toISOString();
const invitationId = randomUUID();
const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

// 平文tokenやパスワードはSQLに入れない。同じ未承諾招待は新しいtokenへ更新する。
const sql = [
  'UPDATE invitations',
  `   SET role=${quote(role)},token_hash=${quote(tokenHash)},expires_at=${quote(expiresAt)},updated_at=${quote(nowIso)}`,
  ` WHERE email=${quote(email)} AND accepted_at IS NULL AND revoked_at IS NULL`,
  `   AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=${quote(email)});`,
  'INSERT INTO invitations',
  '  (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)',
  `SELECT ${quote(invitationId)},${quote(email)},${quote(role)},${quote(tokenHash)},${quote(expiresAt)},NULL,NULL,NULL,${quote(nowIso)},${quote(nowIso)}`,
  ` WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE email=${quote(email)})`,
  `   AND NOT EXISTS (SELECT 1 FROM invitations WHERE email=${quote(email)} AND accepted_at IS NULL AND revoked_at IS NULL);`,
  '',
].join('\n');

if (printSqlOnly) {
  process.stdout.write(sql);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'kanjo-local-invitation-'));
const sqlPath = join(dir, 'local-invitation.sql');
try {
  writeFileSync(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
  const result = spawnSync(
    'pnpm',
    ['--filter', '@kanjo/api', 'exec', 'wrangler', 'd1', 'execute', 'kanjo-db', '--local', '--file', sqlPath],
    { cwd: projectRoot, stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute が失敗しました (${result.signal ?? result.status})`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('\nローカルD1に本人承諾用の招待を作成しました。');
console.log(`  メール: ${email}`);
console.log(`  役割: ${role}`);
console.log(`  承諾URL: ${origin}/invite/accept?token=${encodeURIComponent(token)}`);
console.log('このURLはローカル検証専用です。本番の招待には使用しないでください。');
