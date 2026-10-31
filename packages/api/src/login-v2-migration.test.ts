/**
 * 0059 (ログイン v2) の migration の回帰テスト。
 *
 * 見張っているのは5つ。
 *   1. 0049 までの上に当たり、移行可能な旧 users の行を user / account へ写す (C3・C4)
 *   2. 一時パスワードの利用者は user/account の両方から除外し、招待を妨げない (Q-16)
 *   3. 複写の INSERT を再実行しても重複しない (R-6)
 *   4. 利用者を消すと認証の従属行が cascade で消える (R-12)
 *   5. 新しい表の CHECK と部分一意索引が規則を守る (BR-05・2.7)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const LOGIN_V2 = '0059_login_v2_better_auth.sql';
const T = '2026-09-01T00:00:00.000Z';
const HASH = `pbkdf2-sha256$600000$${'a'.repeat(22)}$${'b'.repeat(43)}`;
const hex = (char: string) => char.repeat(64);

let mf: Miniflare | undefined;
let d1: D1Database;

const loginV2Statements = () =>
  splitMigrationStatements(readFileSync(resolve(migrationsDir, LOGIN_V2), 'utf8'));

async function applyUpTo(database: D1Database, last: string): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql') && filename <= last)
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const statement of statements) await database.prepare(statement).run();
  }
}

const count = async (sql: string, ...binds: unknown[]) =>
  (await d1
    .prepare(sql)
    .bind(...binds)
    .first<number>('n')) ?? 0;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'login-v2-migration',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyUpTo(d1, '0049_ai_report_invariants.sql');
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, status, must_change_password,
                            temporary_password_expires_at, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('u-admin', 'owner@example.com', HASH, 'admin', 'active', 0, null, T, T, T),
    d1
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, status, must_change_password,
                            temporary_password_expires_at, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('u-temp', 'temp@example.com', HASH, 'member', 'active', 1, T, T, T, null),
    d1
      .prepare(
        `INSERT INTO users (id, email, password_hash, role, status, must_change_password,
                            temporary_password_expires_at, created_at, updated_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('u-off', 'off@example.com', HASH, 'member', 'suspended', 0, null, T, T, null),
  ]);
  for (const statement of loginV2Statements()) await d1.prepare(statement).run();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('旧 users からの複写', () => {
  it('確定済み利用者だけを user へ写し、役割・状態・日時・メール確認済みを引き継ぐ', async () => {
    const rows = await d1
      .prepare(
        `SELECT id, name, email, emailVerified, role, status, twoFactorEnabled, createdAt, lastLoginAt
           FROM "user" ORDER BY id`,
      )
      .all();
    expect(rows.results).toEqual([
      {
        id: 'u-admin',
        name: 'owner',
        email: 'owner@example.com',
        emailVerified: 1,
        role: 'admin',
        status: 'active',
        twoFactorEnabled: 0,
        createdAt: T,
        lastLoginAt: T,
      },
      {
        id: 'u-off',
        name: 'off',
        email: 'off@example.com',
        emailVerified: 1,
        role: 'member',
        status: 'suspended',
        twoFactorEnabled: 0,
        createdAt: T,
        lastLoginAt: null,
      },
    ]);
  });

  it('パスワードの account は一時パスワードのままの利用者を除いて写し、ハッシュを形式ごと持つ', async () => {
    const rows = await d1
      .prepare('SELECT id, accountId, providerId, userId, password FROM account ORDER BY id')
      .all();
    expect(rows.results).toEqual([
      {
        id: 'cred-u-admin',
        accountId: 'u-admin',
        providerId: 'credential',
        userId: 'u-admin',
        password: HASH,
      },
      { id: 'cred-u-off', accountId: 'u-off', providerId: 'credential', userId: 'u-off', password: HASH },
    ]);
  });

  it('複写の INSERT を再実行しても行は増えない', async () => {
    const inserts = loginV2Statements().filter((statement) => /^INSERT INTO/i.test(statement));
    expect(inserts).toHaveLength(2);
    for (const statement of inserts) await d1.prepare(statement).run();
    expect(await count('SELECT count(*) AS n FROM "user"')).toBe(2);
    expect(await count('SELECT count(*) AS n FROM account')).toBe(2);
  });

  it('旧 users の行は残し、書き換えない', async () => {
    expect(await count('SELECT count(*) AS n FROM users')).toBe(3);
    expect(await count('SELECT count(*) AS n FROM users WHERE session_generation = 1')).toBe(3);
  });

  it('一時パスワード利用者のメールは新しい招待へ再利用でき、管理者は到達可能なまま', async () => {
    expect(await count(`SELECT count(*) AS n FROM "user" WHERE email='temp@example.com'`)).toBe(0);
    await d1
      .prepare(
        `INSERT INTO invitations
           (id,email,role,token_hash,expires_at,accepted_at,revoked_at,invited_by,created_at,updated_at)
         VALUES ('inv-temp','temp@example.com','member',?,?,NULL,NULL,'u-admin',?,?)`,
      )
      .bind(hex('e'), T, T, T)
      .run();
    expect(
      await count(
        `SELECT count(*) AS n FROM "user" u
          JOIN account a ON a."userId"=u.id AND a."providerId"='credential'
         WHERE u.role='admin' AND u.status='active'`,
      ),
    ).toBe(1);
  });

  it('DROP・DELETE・UPDATE・RENAME を含まない (Deploy の自動適用を止めない)', () => {
    for (const statement of loginV2Statements()) {
      expect(statement).not.toMatch(/^\s*(DROP|DELETE|UPDATE|ALTER\s+TABLE\s+\S+\s+RENAME)\b/i);
    }
  });
});

describe('新しい表の規則', () => {
  it('同じメールの未承諾の招待は1件だけ。承諾済み・取消は数えない (BR-05)', async () => {
    const insert = (id: string, token: string, accepted: string | null, revoked: string | null) =>
      d1
        .prepare(
          `INSERT INTO invitations (id, email, role, token_hash, expires_at, accepted_at, revoked_at,
                                    invited_by, created_at, updated_at)
           VALUES (?, 'new@example.com', 'member', ?, ?, ?, ?, 'u-admin', ?, ?)`,
        )
        .bind(id, hex(token), T, accepted, revoked, T, T)
        .run();
    await insert('inv-accepted', '1', T, null);
    await insert('inv-revoked', '2', null, T);
    await insert('inv-open', '3', null, null);
    await expect(insert('inv-open-2', '4', null, null)).rejects.toThrow(/UNIQUE/);
  });

  it('auth_audit_log は新しい action だけを受け、既存の action は audit_log に残す (2.7)', async () => {
    const insert = (id: string, action: string) =>
      d1
        .prepare(
          `INSERT INTO auth_audit_log (id, user_id, actor_user_id, operation_id, action, scope,
                                       counts_json, occurred_at, result)
           VALUES (?, 'u-admin', NULL, ?, ?, 'account', '{}', ?, 'succeeded')`,
        )
        .bind(id, id, action, T)
        .run();
    await insert('a-1', 'auth_mfa_enable');
    await expect(insert('a-2', 'auth_login')).rejects.toThrow(/CHECK/);
  });

  it('mfa_setup_token の保持の指定は既定で保持あり (3.3)', async () => {
    await d1
      .prepare(
        `INSERT INTO mfa_setup_token (id, user_id, token_hash, expires_at, created_at)
         VALUES ('m-1', 'u-admin', ?, ?, ?)`,
      )
      .bind(hex('c'), T, T)
      .run();
    expect(await count("SELECT remember_me AS n FROM mfa_setup_token WHERE id = 'm-1'")).toBe(1);
  });
});

describe('FK cascade (R-12)', () => {
  it('利用者を消すと session・account・twoFactor・MFA 設定・連携確認のトークンが消える', async () => {
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId, rememberMe)
           VALUES ('s-1', ?, 'tok-1', ?, ?, 'u-admin', 1)`,
        )
        .bind(T, T, T),
      d1.prepare(
        `INSERT INTO twoFactor (id, secret, backupCodes, userId, verified)
           VALUES ('tf-1', 'enc', 'enc', 'u-admin', 1)`,
      ),
      d1
        .prepare(
          `INSERT INTO link_confirmation_token (id, user_id, target, token_hash, expires_at, created_at)
           VALUES ('l-1', 'u-admin', 'google', ?, ?, ?)`,
        )
        .bind(hex('d'), T, T),
    ]);
    await d1.prepare('PRAGMA foreign_keys = ON').run();
    await d1.prepare(`DELETE FROM "user" WHERE id = 'u-admin'`).run();
    for (const [table, column] of [
      ['session', '"userId"'],
      ['account', '"userId"'],
      ['"twoFactor"', '"userId"'],
      ['mfa_setup_token', 'user_id'],
      ['link_confirmation_token', 'user_id'],
    ] as const) {
      expect(await count(`SELECT count(*) AS n FROM ${table} WHERE ${column} = 'u-admin'`)).toBe(0);
    }
  });
});
