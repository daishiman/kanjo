/**
 * 認証済み境界をテストから通すための補助。
 *
 * 共有パスワードが無くなったので、テストも「利用者を1件作ってからログインする」という
 * 本番と同じ順序を踏む。ここを単一の切替点にしておくと、Cookie の形式や
 * パスワード方針が変わっても各テストの本文を触らずに済む。
 */
import { PBKDF2_ITERATIONS, hashPassword, temporaryPasswordExpiresAt } from './users.js';

/** テスト全体で使う既定の管理者。実在しないドメインを使い、本番の値と取り違えない。 */
export const TEST_ADMIN = Object.freeze({
  id: 'usr_test_admin',
  email: 'admin@example.test',
  /** PASSWORD_MIN_LENGTH (12) 以上。平文はテストコードの中だけに存在する。 */
  password: 'synthetic-test-password',
});

/**
 * PBKDF2 は 210,000 回反復するので、1ファイル1回だけ計算して使い回す。
 * salt はランダムなまま、同じハッシュを毎回の beforeEach へ配る。
 */
let cachedHash: Promise<string> | undefined;
const testAdminHash = (): Promise<string> => {
  cachedHash ??= hashPassword(TEST_ADMIN.password);
  return cachedHash;
};

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

export interface SeedUserOptions {
  id?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'member';
  status?: 'active' | 'suspended';
  mustChangePassword?: boolean;
  sessionGeneration?: number;
}

/** users へ1件入れる。beforeEach の全テーブル削除の後に呼ぶ。 */
export async function seedTestUser(
  db: D1Database,
  options: SeedUserOptions = {},
): Promise<{ id: string; email: string; password: string; sessionGeneration: number }> {
  const id = options.id ?? TEST_ADMIN.id;
  const email = options.email ?? TEST_ADMIN.email;
  const password = options.password ?? TEST_ADMIN.password;
  const sessionGeneration = options.sessionGeneration ?? 1;
  const passwordHash = options.password ? await hashPassword(password) : await testAdminHash();
  const temporaryExpiry = options.mustChangePassword
    ? temporaryPasswordExpiresAt(new Date().toISOString())
    : null;
  await db
    .prepare(
      `INSERT INTO users
         (id,email,password_hash,role,status,session_generation,must_change_password,temporary_password_expires_at,created_at,updated_at,last_login_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`,
    )
    .bind(
      id,
      email,
      passwordHash,
      options.role ?? 'admin',
      options.status ?? 'active',
      sessionGeneration,
      options.mustChangePassword ? 1 : 0,
      temporaryExpiry,
      TIMESTAMP,
      TIMESTAMP,
    )
    .run();
  return { id, email, password, sessionGeneration };
}

/**
 * 業務監査だけを見るための WHERE 条件。
 *
 * ログインは監査に残る操作なので、テストが loginForTest を通った時点で
 * audit_log には必ず `auth_login` が1件ある。業務側の件数を数える主張は
 * この条件で認証の監査を外し、「何件になったか」を認証の有無に揺さぶられなくする。
 */
export const NON_AUTH_AUDIT = "action NOT LIKE 'auth\\_%' ESCAPE '\\'";

/**
 * users 検索クエリかどうか。ダミー D1 を使うテストが「認証の照会」と
 * 「業務データの照会」を取り違えないための判定を1か所に集める。
 */
export const isUserLookupQuery = (sql: string): boolean =>
  sql.startsWith('SELECT id,email,password_hash') && sql.includes('FROM users');

/**
 * users の1行そのもの。ログイン経路を通さず認証境界だけを越えたいテストが、
 * ダミー D1 の戻り値として使う。password_hash は照合に使われない前提の形だけの値。
 */
export const TEST_ADMIN_ROW = Object.freeze({
  id: TEST_ADMIN.id,
  email: TEST_ADMIN.email,
  password_hash: `pbkdf2-sha256$${PBKDF2_ITERATIONS}$c3R1Yg$c3R1Yg`,
  role: 'admin',
  status: 'active',
  session_generation: 1,
  must_change_password: 0,
  temporary_password_expires_at: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  last_login_at: null,
});

/** テスト用の反復回数の確認に使う。仕様値が下がったら気づけるようにする。 */
export const TEST_PBKDF2_ITERATIONS = PBKDF2_ITERATIONS;

/**
 * 既定の管理者を作り、実アプリの /api/auth/login を通して Cookie 文字列を得る。
 * 署名を自前で作らないので、ログイン経路そのものの回帰もここで拾える。
 */
export async function loginForTest<E extends { DB: D1Database }>(
  requestApp: { request: (input: string, init: RequestInit, env: E) => Response | Promise<Response> },
  env: E,
  options: SeedUserOptions & { remember?: boolean } = {},
): Promise<string> {
  const seeded = await seedTestUser(env.DB, options);
  const response = await requestApp.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: seeded.email,
        password: seeded.password,
        ...(options.remember === undefined ? {} : { remember: options.remember }),
      }),
    },
    env,
  );
  if (response.status !== 200) {
    throw new Error(`loginForTest failed: ${response.status} ${await response.text()}`);
  }
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

/**
 * 署名 Cookie を直接組み立てる。ログイン経路を通さずに認証境界だけを試したいときに使う。
 * 署名対象は「利用者ID . 有効期限 . 世代」の3要素で、2要素の旧形式はアプリ側が構造で弾く。
 */
export async function signedSessionCookieForTest(
  secret: string,
  options: { userId?: string; generation?: number; expiresAt?: number } = {},
): Promise<string> {
  const payload = [
    options.userId ?? TEST_ADMIN.id,
    String(options.expiresAt ?? Date.now() + 60_000),
    String(options.generation ?? 1),
  ].join('.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  const encoded = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `kanjo_session=${payload}.${encoded}`;
}

/** 旧形式(有効期限のみ2要素)の Cookie。撤去できたことを確かめるテストで使う。 */
export async function legacySessionCookieForTest(secret: string): Promise<string> {
  const expiresAt = String(Date.now() + 60_000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(expiresAt)));
  const encoded = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `kanjo_session=${expiresAt}.${encoded}`;
}
