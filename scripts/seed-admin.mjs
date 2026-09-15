#!/usr/bin/env node
/**
 * ローカル D1 または本番投入用SQLに初期管理者を1件作る。
 *
 * architecture/account-login-database.md:81 が要求する「初回適用時に初期管理者を1件作成する seed」の
 * ローカル実装。migration には置けない: 保存するのは PBKDF2 ハッシュだけで、SQL では作れないため。
 *
 * 既定は --local のみ。本番への投入は P13 の切替作業に属するので、ここからは行わず
 * --print-sql で SQL を標準出力に出すだけにする(実行者が意図を持って流す)。
 *
 *   node scripts/seed-admin.mjs
 *   read -rs 'KANJO_SEED_PASSWORD?Password: '; print -r -- "$KANJO_SEED_PASSWORD" |
 *     node scripts/seed-admin.mjs --print-sql --mode bootstrap --email owner@example.com --password-stdin
 *   # break-glassは既存adminのidを指定し、同じidentityのpasswordだけを更新する
 *   node scripts/seed-admin.mjs --print-sql --mode reset-admin --user-id <id> --password-stdin
 */

import { spawnSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** packages/api/src/users.ts と同じ値。ずれるとログイン時に黙って再ハッシュが走る。 */
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_BYTES = 32;
const HASH_PREFIX = 'pbkdf2-sha256';
const TEMPORARY_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const b64url = (buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** WebCrypto 側の hashPassword と同一形式を Node の crypto で組む。 */
function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, DERIVED_BYTES, 'sha256');
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(derived)}`;
}

function flag(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const printSqlOnly = process.argv.includes('--print-sql');
const mode = flag('mode', printSqlOnly ? null : 'bootstrap');
/** 一時パスワード経路(初回の強制変更)を画面で確かめたいときだけ立てる。 */
const forceChange = process.argv.includes('--force-change');

if (process.argv.includes('--password')) {
  throw new Error('パスワードをargvへ置けません。--password-stdin を使用してください');
}

const passwordFromStdin = process.argv.includes('--password-stdin')
  ? readFileSync(0, 'utf8').replace(/[\r\n]+$/, '')
  : null;
const explicitEmail = flag('email');
const resetUserId = flag('user-id');
if (printSqlOnly && !passwordFromStdin) {
  throw new Error('--print-sql には --password-stdin が必要です');
}
if (!['bootstrap', 'reset-admin'].includes(mode)) {
  throw new Error('--mode は bootstrap または reset-admin を明示してください');
}
if (mode === 'bootstrap' && printSqlOnly && !explicitEmail) {
  throw new Error('bootstrap には --email が必要です');
}
if (mode === 'reset-admin' && !resetUserId) {
  throw new Error('reset-admin には --user-id が必要です');
}

const adminEmail = (explicitEmail ?? 'admin@kanjo.local').trim().toLowerCase();
const adminPassword = passwordFromStdin ?? 'LocalAdmin-2026-Kanjo';

const now = new Date().toISOString().replace(/\.(\d{3})\d*Z$/, '.$1Z');

// SQL リテラルへ入るのはハッシュと正規化済みメールだけ。平文はどの行にも現れない。
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const temporary = printSqlOnly || forceChange;
const expiresAt = new Date(Date.parse(now) + TEMPORARY_PASSWORD_TTL_MS).toISOString();
const passwordHash = hashPassword(adminPassword);
let sql;
if (mode === 'bootstrap') {
  const values = [
    quote('usr_seed_admin'),
    quote(adminEmail),
    quote(passwordHash),
    quote('admin'),
    quote('active'),
    '1',
    temporary ? '1' : '0',
    temporary ? quote(expiresAt) : 'NULL',
    quote(now),
    quote(now),
  ].join(', ');
  sql = [
    'INSERT INTO users (id, email, password_hash, role, status, session_generation,',
    '  must_change_password, temporary_password_expires_at, created_at, updated_at)',
    `SELECT ${values}`,
    'WHERE NOT EXISTS (SELECT 1 FROM users);',
  ].join('\n');
} else {
  sql = [
    'UPDATE users',
    `SET password_hash = ${quote(passwordHash)}, status = 'active', must_change_password = 1,`,
    `    temporary_password_expires_at = ${quote(expiresAt)},`,
    `    session_generation = session_generation + 1, updated_at = ${quote(now)}`,
    `WHERE id = ${quote(resetUserId)} AND role = 'admin';`,
  ].join('\n');
}
sql += '\n';

if (printSqlOnly) {
  process.stdout.write(sql);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), 'kanjo-seed-admin-'));
const sqlPath = join(dir, 'seed-admin.sql');
writeFileSync(sqlPath, sql, 'utf8');

const result = spawnSync(
  'pnpm',
  ['--filter', '@kanjo/api', 'exec', 'wrangler', 'd1', 'execute', 'kanjo-db', '--local', '--file', sqlPath],
  { cwd: projectRoot, stdio: 'inherit' },
);
if (result.status !== 0) {
  throw new Error(`wrangler d1 execute が失敗しました (${result.signal ?? result.status})`);
}

console.log('\nローカル D1 に seed しました:');
console.log(`  admin  ${adminEmail}`);
console.log('  ローカルfixtureの資格情報はdocs/runbooks/account-login-operations.mdを参照してください');
if (forceChange) console.log('  ※ 初回ログイン時にパスワード変更を求められます');
