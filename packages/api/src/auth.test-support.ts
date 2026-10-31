import { REMEMBERED_SESSION_TTL_MS, TRANSIENT_SESSION_TTL_MS } from '@kanjo/core';
import { makeSignature } from 'better-auth/crypto';
import { hashPassword } from './users.js';

export const TEST_ADMIN = Object.freeze({
  id: 'usr_test_admin',
  email: 'admin@example.test',
  password: 'synthetic-test-password',
});

export const TEST_BETTER_AUTH_SECRET = 'synthetic-better-auth-secret-32-characters-minimum';
export const TEST_PBKDF2_ITERATIONS = 100_000;
const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export interface SeedUserOptions {
  id?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'member';
  status?: 'active' | 'suspended';
  mustChangePassword?: boolean;
  sessionGeneration?: number;
  twoFactorEnabled?: boolean;
}

export async function seedTestUser(
  db: D1Database,
  options: SeedUserOptions = {},
): Promise<{ id: string; email: string; password: string; sessionGeneration: number }> {
  const id = options.id ?? TEST_ADMIN.id;
  const email = (options.email ?? TEST_ADMIN.email).toLowerCase();
  const password = options.password ?? TEST_ADMIN.password;
  const role = options.role ?? 'admin';
  await db.batch([
    db
      .prepare(
        `INSERT INTO "user"
          (id,name,email,"emailVerified",image,"createdAt","updatedAt","twoFactorEnabled",role,status,"lastLoginAt")
         VALUES (?,?,?,1,NULL,?,?,?,?,?,NULL)`,
      )
      .bind(
        id,
        email.split('@')[0],
        email,
        TIMESTAMP,
        TIMESTAMP,
        options.twoFactorEnabled ? 1 : 0,
        role,
        options.status ?? 'active',
      ),
    db
      .prepare(
        `INSERT INTO account
          (id,"accountId","providerId","userId",password,"createdAt","updatedAt")
         VALUES (?,?, 'credential', ?,?,?,?)`,
      )
      .bind(`cred-${id}`, id, id, await hashPassword(password), TIMESTAMP, TIMESTAMP),
  ]);
  return { id, email, password, sessionGeneration: options.sessionGeneration ?? 1 };
}

export const NON_AUTH_AUDIT = "action NOT LIKE 'auth\\_%' ESCAPE '\\'";

export const isUserLookupQuery = (sql: string): boolean =>
  sql.includes('FROM "user"') || sql.includes("FROM 'user'");

export const TEST_ADMIN_ROW = Object.freeze({
  id: TEST_ADMIN.id,
  name: 'admin',
  email: TEST_ADMIN.email,
  emailVerified: 1,
  image: null,
  role: 'admin',
  status: 'active',
  twoFactorEnabled: 1,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  lastLoginAt: null,
});

async function insertSession(
  db: D1Database,
  userId: string,
  remember: boolean,
): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID().replace(/-/g, '');
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (remember ? REMEMBERED_SESSION_TTL_MS : TRANSIENT_SESSION_TTL_MS),
  ).toISOString();
  await db
    .prepare(
      `INSERT INTO session
        (id,"expiresAt",token,"createdAt","updatedAt","ipAddress","userAgent","userId","rememberMe")
       VALUES (?,?,?,?,?,NULL,NULL,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      expiresAt,
      token,
      now.toISOString(),
      now.toISOString(),
      userId,
      remember ? 1 : 0,
    )
    .run();
  return { token, expiresAt };
}

export async function loginForTest<E extends { DB: D1Database; BETTER_AUTH_SECRET?: string }>(
  _requestApp: { request: (input: string, init: RequestInit, env: E) => Response | Promise<Response> },
  env: E,
  options: SeedUserOptions & { remember?: boolean } = {},
): Promise<string> {
  const seeded = await seedTestUser(env.DB, options);
  const session = await insertSession(env.DB, seeded.id, options.remember !== false);
  const secret = env.BETTER_AUTH_SECRET ?? TEST_BETTER_AUTH_SECRET;
  return `kanjo.session_token=${session.token}.${await makeSignature(session.token, secret)}`;
}

/** ダミーDB契約テスト用。実統合テストは loginForTest でD1 session行も作る。 */
export async function signedSessionCookieForTest(secret: string): Promise<string> {
  const token = 'synthetic-session-token';
  return `kanjo.session_token=${token}.${await makeSignature(token, secret)}`;
}

export const legacySessionCookieForTest = async (secret: string): Promise<string> =>
  `kanjo_session=legacy.${await makeSignature('legacy', secret)}`;
