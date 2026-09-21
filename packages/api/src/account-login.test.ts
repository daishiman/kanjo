/**
 * アカウントログインの受け入れ条件(SYS-ACCTLOGIN-P05)を直接固定する回帰テスト。
 *
 * 見張っているのは5つ。
 *   1. 正しい組み合わせだけが通り、誤りは1種類の応答に畳まれること
 *   2. 平文がどこにも保存・返送されず、PBKDF2 の反復が仕様値を下回らないこと
 *   3. ログアウト・パスワード変更・停止のいずれでも、他端末のセッションが即時に失効すること
 *   4. 旧形式(2要素)の Cookie が構造で拒否されること
 *   5. 管理操作は admin だけが通り、一時パスワードは応答に1度だけ現れること
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_TTL_MS } from './auth.js';
import {
  TEST_ADMIN,
  TEST_PBKDF2_ITERATIONS,
  legacySessionCookieForTest,
  loginForTest,
  seedTestUser,
  signedSessionCookieForTest,
} from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';
import { cleanupExpiredTemporaryPasswords } from './users.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const SESSION_SECRET = 'synthetic-test-secret';
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET };

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;

const env = () => ({ ...auth, DB: d1, FILES: files });

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

const post = async (path: string, body: unknown, cookie?: string): Promise<Response> =>
  await app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    },
    env(),
  );

const rawPost = async (path: string, body: string, cookie?: string): Promise<Response> =>
  await app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body,
    },
    env(),
  );

const send = async (path: string, method: string, cookie: string, body?: unknown): Promise<Response> =>
  await app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );

const get = (path: string, cookie: string): Promise<Response> => send(path, 'GET', cookie);

/** Set-Cookie ヘッダから属性を1つ読む。属性名だけの指定 (HttpOnly など) は空文字を返す。 */
function cookieAttr(header: string, name: string): string | null {
  const found = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(name.toLowerCase()));
  if (found === undefined) return null;
  const eq = found.indexOf('=');
  return eq === -1 ? '' : found.slice(eq + 1);
}

const passwordHashOf = async (email: string): Promise<string> =>
  (
    await d1
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .bind(email)
      .first<{ password_hash: string }>()
  )?.password_hash ?? '';

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'account-login-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);
}, 30_000);

beforeEach(async () => {
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results.filter(({ name }) => isApplicationTableForTestReset(name)))
    await d1.prepare(`DELETE FROM "${name}"`).run();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('資格情報の照合', () => {
  it('正しい組み合わせだけを通す', async () => {
    await seedTestUser(d1);
    const ok = await post('/auth/login', { email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    expect(ok.status).toBe(200);

    const wrong = await post('/auth/login', { email: TEST_ADMIN.email, password: 'wrong-password-000' });
    expect(wrong.status).toBe(401);
  });

  it('不在・停止・パスワード相違を1種類の応答に畳む', async () => {
    await seedTestUser(d1, { id: 'usr_suspended', email: 'stopped@example.test', status: 'suspended' });

    const absent = await post('/auth/login', { email: 'nobody@example.test', password: 'whatever-000000' });
    const suspended = await post('/auth/login', {
      email: 'stopped@example.test',
      password: TEST_ADMIN.password,
    });
    const mismatch = await post('/auth/login', {
      email: 'stopped@example.test',
      password: 'wrong-password-000',
    });

    const bodies = await Promise.all([absent.json(), suspended.json(), mismatch.json()]);
    expect([absent.status, suspended.status, mismatch.status]).toEqual([401, 401, 401]);
    // 応答が1文字でも違えば、在籍しているアドレスの一覧を外から作れてしまう
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
  });

  it('メールアドレスの表記ゆれを吸収する', async () => {
    await seedTestUser(d1);
    const response = await post('/auth/login', {
      email: `  ${TEST_ADMIN.email.toUpperCase()}  `,
      password: TEST_ADMIN.password,
    });
    expect(response.status).toBe(200);
  });
});

describe('パスワードの保存', () => {
  it('平文を保存せず、PBKDF2 の反復が仕様値を下回らない', async () => {
    await seedTestUser(d1);
    const stored = await passwordHashOf(TEST_ADMIN.email);

    expect(stored).not.toContain(TEST_ADMIN.password);
    const [algorithm, iterations, salt, digest] = stored.split('$');
    expect(algorithm).toBe('pbkdf2-sha256');
    // 自己記述型なので、反復回数を上げても既存の保存値を読み続けられる
    expect(Number(iterations)).toBeGreaterThanOrEqual(100_000);
    expect(Number(iterations)).toBe(TEST_PBKDF2_ITERATIONS);
    expect(salt.length).toBeGreaterThan(0);
    expect(digest.length).toBeGreaterThan(0);
  });

  it('どの応答にも password_hash を出さない', async () => {
    const cookie = await loginForTest(app, env());
    const me = await get('/auth/me', cookie);
    const users = await get('/admin/users', cookie);
    const text = `${await me.text()}${await users.text()}`;

    expect(text).not.toContain('password_hash');
    expect(text).not.toContain('pbkdf2');
    expect(text).not.toContain(TEST_ADMIN.password);
  });
});

describe('セッションの持ち方', () => {
  it('Cookie を JavaScript から読めない形で配る', async () => {
    await seedTestUser(d1);
    const response = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    const header = response.headers.get('set-cookie') ?? '';

    expect(cookieAttr(header, 'HttpOnly')).toBe('');
    expect(cookieAttr(header, 'Secure')).toBe('');
    expect(cookieAttr(header, 'SameSite')).toBe('Strict');
    expect(cookieAttr(header, 'Path')).toBe('/');
  });

  it('保持の有無で有効期限が2段になる', async () => {
    await seedTestUser(d1);
    const remembered = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      remember: true,
    });
    const transient = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      remember: false,
    });

    // 画面のマイクロコピー (30日 / 12時間) と同じ値であること
    expect(Number(cookieAttr(remembered.headers.get('set-cookie') ?? '', 'Max-Age'))).toBe(
      SESSION_TTL_MS.remembered / 1000,
    );
    expect(Number(cookieAttr(transient.headers.get('set-cookie') ?? '', 'Max-Age'))).toBe(
      SESSION_TTL_MS.transient / 1000,
    );
  });

  it('ログイン処理の途中で時計が進んでも Max-Age は1秒欠けない', async () => {
    await seedTestUser(d1);
    // 読むたびに 1ms 進む時計。時刻を2回読む実装だと Max-Age が 2591999 になる。
    let tick = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => ++tick);
    try {
      const response = await post('/auth/login', {
        email: TEST_ADMIN.email,
        password: TEST_ADMIN.password,
        remember: true,
      });
      expect(Number(cookieAttr(response.headers.get('set-cookie') ?? '', 'Max-Age'))).toBe(
        SESSION_TTL_MS.remembered / 1000,
      );
    } finally {
      clock.mockRestore();
    }
  });

  it('保持の指定が無いときは保持する', async () => {
    await seedTestUser(d1);
    const response = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    expect(Number(cookieAttr(response.headers.get('set-cookie') ?? '', 'Max-Age'))).toBe(
      SESSION_TTL_MS.remembered / 1000,
    );
  });

  it('パスワード変更後も元の絶対期限を延長しない', async () => {
    const original = await loginForTest(app, env(), { remember: false });
    const changed = await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: 'brand-new-passphrase' },
      original,
    );
    expect(changed.status).toBe(200);
    const maxAge = Number(cookieAttr(changed.headers.get('set-cookie') ?? '', 'Max-Age'));
    expect(maxAge).toBeGreaterThan(SESSION_TTL_MS.transient / 1000 - 120);
    expect(maxAge).toBeLessThanOrEqual(SESSION_TTL_MS.transient / 1000);
  });

  it('旧形式(2要素)の Cookie を構造で拒否する', async () => {
    await seedTestUser(d1);
    // 署名は正しい。それでも要素数が合わなければ通さない
    const legacy = await legacySessionCookieForTest(SESSION_SECRET);
    expect((await get('/auth/me', legacy)).status).toBe(401);
  });

  it('署名が合っていても世代が古ければ通さない', async () => {
    await seedTestUser(d1, { sessionGeneration: 3 });
    const stale = await signedSessionCookieForTest(SESSION_SECRET, {
      userId: TEST_ADMIN.id,
      generation: 2,
    });
    expect((await get('/auth/me', stale)).status).toBe(401);

    const current = await signedSessionCookieForTest(SESSION_SECRET, {
      userId: TEST_ADMIN.id,
      generation: 3,
    });
    expect((await get('/auth/me', current)).status).toBe(200);
  });

  it('期限切れの Cookie を通さない', async () => {
    await seedTestUser(d1);
    const expired = await signedSessionCookieForTest(SESSION_SECRET, { expiresAt: Date.now() - 1000 });
    expect((await get('/auth/me', expired)).status).toBe(401);
  });
});

describe('セッションの失効', () => {
  it('ログアウトで他端末のセッションも同時に切れる', async () => {
    const phone = await loginForTest(app, env());
    // 同じ利用者の2本目。世代は共有なので、片方の破棄が両方へ効く
    const desktop = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    const desktopCookie = desktop.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    expect((await get('/auth/me', desktopCookie)).status).toBe(200);

    expect((await send('/auth/logout', 'POST', phone)).status).toBe(200);
    expect((await get('/auth/me', phone)).status).toBe(401);
    expect((await get('/auth/me', desktopCookie)).status).toBe(401);
  });

  it('パスワード変更で変更した端末だけが残る', async () => {
    const phone = await loginForTest(app, env());
    const desktop = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    const desktopCookie = desktop.headers.get('set-cookie')?.split(';', 1)[0] ?? '';

    const changed = await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: 'brand-new-passphrase' },
      phone,
    );
    expect(changed.status).toBe(200);
    const refreshed = changed.headers.get('set-cookie')?.split(';', 1)[0] ?? '';

    // 変更した端末は新しい世代の Cookie を受け取って続行できる
    expect((await get('/auth/me', refreshed)).status).toBe(200);
    // 変更前の Cookie は、変更した端末のものでも失効する
    expect((await get('/auth/me', desktopCookie)).status).toBe(401);
    expect(
      (await post('/auth/login', { email: TEST_ADMIN.email, password: TEST_ADMIN.password })).status,
    ).toBe(401);
  });

  it('現在のパスワードが違えば変更させない', async () => {
    const cookie = await loginForTest(app, env());
    const response = await post(
      '/auth/password',
      { currentPassword: 'not-the-current-one', newPassword: 'brand-new-passphrase' },
      cookie,
    );
    expect(response.status).toBe(401);
    // 失敗したのだから世代も動かない。他端末を巻き添えにしない
    expect((await get('/auth/me', cookie)).status).toBe(200);
  });

  it('弱いパスワードと現行と同一の値を拒む', async () => {
    const cookie = await loginForTest(app, env());
    const short = await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: 'short' },
      cookie,
    );
    const same = await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: TEST_ADMIN.password },
      cookie,
    );
    expect(short.status).toBe(400);
    expect(same.status).toBe(400);
  });
});

describe('一時パスワードの強制変更', () => {
  it('初回ログインで一時パスワードを消費し、変更前の再ログインを拒む', async () => {
    await seedTestUser(d1, { mustChangePassword: true });
    const first = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    expect(first.status).toBe(200);
    expect(
      (
        await d1
          .prepare('SELECT temporary_password_expires_at FROM users WHERE id=?')
          .bind(TEST_ADMIN.id)
          .first<{ temporary_password_expires_at: string | null }>()
      )?.temporary_password_expires_at,
    ).toBeNull();

    const replay = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    expect(replay.status).toBe(401);
  });

  it('並行した初回ログインでセッションを1本しか発行しない', async () => {
    await seedTestUser(d1, { mustChangePassword: true });
    const responses = await Promise.all([
      post('/auth/login', { email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
      post('/auth/login', { email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  });

  it('変更するまで業務データへ入れない', async () => {
    const cookie = await loginForTest(app, env(), { mustChangePassword: true });
    const blocked = await get('/summary', cookie);
    expect(blocked.status).toBe(403);
    expect((await blocked.json()) as { error: { code: string } }).toMatchObject({
      error: { code: 'password_change_required' },
    });
  });

  it('変更経路と自分の確認だけは通す', async () => {
    const cookie = await loginForTest(app, env(), { mustChangePassword: true });
    // ここまで塞ぐと変更する手段が無くなる。門は開けたまま先へ進ませない
    expect((await get('/auth/me', cookie)).status).toBe(200);

    const changed = await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: 'brand-new-passphrase' },
      cookie,
    );
    expect(changed.status).toBe(200);
    const refreshed = changed.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    expect((await get('/summary', refreshed)).status).toBe(200);
  });

  it('72時間を過ぎた一時パスワードを拒否し、cleanupで失効状態へ畳む', async () => {
    await seedTestUser(d1, { mustChangePassword: true });
    await d1
      .prepare('UPDATE users SET temporary_password_expires_at=? WHERE id=?')
      .bind('2026-01-01T00:00:00.000Z', TEST_ADMIN.id)
      .run();

    const expired = await post('/auth/login', {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
    });
    expect(expired.status).toBe(401);
    expect(await cleanupExpiredTemporaryPasswords(d1, '2026-01-02T00:00:00.000Z')).toBe(1);
    expect(
      (
        await d1
          .prepare('SELECT temporary_password_expires_at FROM users WHERE id=?')
          .bind(TEST_ADMIN.id)
          .first<{ temporary_password_expires_at: string | null }>()
      )?.temporary_password_expires_at,
    ).toBeNull();
  });
});

describe('利用者の管理', () => {
  const memberLogin = async (): Promise<string> =>
    loginForTest(app, env(), {
      id: 'usr_member',
      email: 'member@example.test',
      password: 'member-test-password',
      role: 'member',
    });

  it('member は管理APIを1本も通せない', async () => {
    const cookie = await memberLogin();
    const responses = await Promise.all([
      get('/admin/users', cookie),
      post('/admin/users', { email: 'new@example.test', role: 'member' }, cookie),
      send('/admin/users/usr_member', 'PATCH', cookie, { role: 'admin' }),
      send('/admin/users/usr_member/password-reset', 'POST', cookie),
    ]);
    // 自分を admin へ引き上げる経路も含めて、1本も開いていないこと
    expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403]);
  });

  it('admin は利用者を追加でき、一時パスワードは応答に1度だけ現れる', async () => {
    const cookie = await loginForTest(app, env());
    const created = await post('/admin/users', { email: 'newbie@example.test', role: 'member' }, cookie);
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      user: { email: string; mustChangePassword: boolean };
      temporaryPassword: string;
    };
    expect(body.user.email).toBe('newbie@example.test');
    expect(body.user.mustChangePassword).toBe(true);
    expect(body.temporaryPassword.length).toBeGreaterThanOrEqual(12);

    // 発行した値は保存されていない。一覧にも再取得の経路にも出てこない
    const listed = await (await get('/admin/users', cookie)).text();
    expect(listed).not.toContain(body.temporaryPassword);
    expect(await passwordHashOf('newbie@example.test')).not.toContain(body.temporaryPassword);

    // 発行された一時パスワードで実際に入れる
    const first = await post('/auth/login', {
      email: 'newbie@example.test',
      password: body.temporaryPassword,
    });
    expect(first.status).toBe(200);
  });

  it('同じメールアドレスを二重に登録できない', async () => {
    const cookie = await loginForTest(app, env());
    expect((await post('/admin/users', { email: 'dup@example.test', role: 'member' }, cookie)).status).toBe(
      201,
    );
    const again = await post('/admin/users', { email: 'DUP@example.test', role: 'member' }, cookie);
    expect(again.status).toBe(409);
  });

  it('停止した利用者のセッションは即座に切れる', async () => {
    const admin = await loginForTest(app, env());
    const member = await memberLogin();
    expect((await get('/auth/me', member)).status).toBe(200);

    const suspended = await send('/admin/users/usr_member', 'PATCH', admin, { status: 'suspended' });
    expect(suspended.status).toBe(200);
    // 停止は次のログインを断るだけでなく、いま開いている画面も止める
    expect((await get('/auth/me', member)).status).toBe(401);
  });

  it('管理監査が失敗したとき利用者更新も同じbatchでrollbackする', async () => {
    const admin = await loginForTest(app, env());
    await seedTestUser(d1, {
      id: 'usr_member',
      email: 'member@example.test',
      password: 'member-test-password',
      role: 'member',
    });
    await d1
      .prepare(
        `CREATE TRIGGER reject_admin_audit BEFORE INSERT ON audit_log
           WHEN NEW.action='admin_user_suspend'
         BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END`,
      )
      .run();
    try {
      expect((await send('/admin/users/usr_member', 'PATCH', admin, { status: 'suspended' })).status).toBe(
        500,
      );
      expect(
        (
          await d1
            .prepare('SELECT status FROM users WHERE id=?')
            .bind('usr_member')
            .first<{ status: string }>()
        )?.status,
      ).toBe('active');
    } finally {
      await d1.prepare('DROP TRIGGER reject_admin_audit').run();
    }
  });

  it('最後の管理者を降格・停止できない', async () => {
    const cookie = await loginForTest(app, env());
    const demote = await send(`/admin/users/${TEST_ADMIN.id}`, 'PATCH', cookie, { role: 'member' });
    const stop = await send(`/admin/users/${TEST_ADMIN.id}`, 'PATCH', cookie, { status: 'suspended' });
    // 誰も入れない状態を作らせない
    expect(demote.status).toBe(409);
    expect(stop.status).toBe(409);
  });

  it('再発行した一時パスワードで入ると変更を求められる', async () => {
    const admin = await loginForTest(app, env());
    await memberLogin();

    const reissued = await send('/admin/users/usr_member/password-reset', 'POST', admin);
    expect(reissued.status).toBe(200);
    const { temporaryPassword } = (await reissued.json()) as { temporaryPassword: string };

    const login = await post('/auth/login', { email: 'member@example.test', password: temporaryPassword });
    expect(login.status).toBe(200);
    expect((await login.json()) as { user: { mustChangePassword: boolean } }).toMatchObject({
      user: { mustChangePassword: true },
    });
    // 旧パスワードはもう通らない
    expect(
      (await post('/auth/login', { email: 'member@example.test', password: 'member-test-password' })).status,
    ).toBe(401);
  });
});

describe('認証操作の監査', () => {
  /** auth_ で始まる監査行だけを、書き込まれた順で取り出す。 */
  const authAuditRows = async (): Promise<
    { action: string; actor_user_id: string | null; scope: string; result: string; user_id: string }[]
  > =>
    (
      await d1
        .prepare(
          `SELECT action, actor_user_id, scope, result, user_id FROM audit_log
             WHERE action LIKE 'auth\\_%' ESCAPE '\\' ORDER BY rowid`,
        )
        .all<{
          action: string;
          actor_user_id: string | null;
          scope: string;
          result: string;
          user_id: string;
        }>()
    ).results;

  it('ログイン・失敗・ログアウト・変更を操作者つきで積む', async () => {
    const cookie = await loginForTest(app, env());
    await post('/auth/login', { email: TEST_ADMIN.email, password: 'wrong-but-long-enough' });
    await send('/auth/logout', 'POST', cookie);
    // 2本目は seed 済みの利用者へそのまま入る。loginForTest は seed も兼ねるので使えない。
    const relogin = await post('/auth/login', { email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    const back = relogin.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: 'brand-new-passphrase' },
      back,
    );

    // action・操作者・結果の三点で固定する。いずれか1つでも欠けると落ちる。
    expect((await authAuditRows()).map((row) => [row.action, row.actor_user_id, row.result])).toEqual([
      ['auth_login', TEST_ADMIN.id, 'succeeded'],
      ['auth_login_failed', null, 'failed'],
      ['auth_logout', TEST_ADMIN.id, 'succeeded'],
      ['auth_login', TEST_ADMIN.id, 'succeeded'],
      ['auth_password_change', TEST_ADMIN.id, 'succeeded'],
    ]);
  });

  it('未認証失敗は操作者をNULLとし、対象accountと分離する', async () => {
    await seedTestUser(d1);
    await post('/auth/login', { email: TEST_ADMIN.email, password: 'wrong-but-long-enough' });
    const [row] = await authAuditRows();
    expect(row.actor_user_id).toBeNull();
    expect(row.scope).toBe(`account:${TEST_ADMIN.id}`);
  });

  it('テナントと操作者を別の欄に分けて持つ', async () => {
    await loginForTest(app, env());
    const [row] = await authAuditRows();
    // user_id は業務データのテナント、actor_user_id が「誰が」。同じ値に潰さない。
    expect(row.user_id).toBe('default');
    expect(row.actor_user_id).toBe(TEST_ADMIN.id);
    expect(row.scope).toBe(`account:${TEST_ADMIN.id}`);
  });

  it('監査の本文へパスワードとセッション値を残さない', async () => {
    const cookie = await loginForTest(app, env());
    const sessionValue = cookie.slice(cookie.indexOf('=') + 1);
    await post(
      '/auth/password',
      { currentPassword: TEST_ADMIN.password, newPassword: 'brand-new-passphrase' },
      cookie,
    );

    const dumped = JSON.stringify(
      (await d1.prepare('SELECT * FROM audit_log').all<Record<string, unknown>>()).results,
    );
    // 空の台帳に対して「含まれない」を確かめても何も言えない。先に対象行の実在を固定する。
    expect(dumped).toContain('auth_password_change');
    expect(dumped).not.toContain(TEST_ADMIN.password);
    expect(dumped).not.toContain('brand-new-passphrase');
    expect(dumped).not.toContain(sessionValue);
  });
});

describe('公開入力エラー契約', () => {
  const expectInvalidRequest = async (response: Response): Promise<void> => {
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'invalid_request', message: '入力内容を確認してください' },
    });
  };

  it('壊れたJSONを共通error envelopeで拒否する', async () => {
    await expectInvalidRequest(await rawPost('/auth/login', '{"email":'));
  });

  it('型不正とoversizeを共通error envelopeで拒否する', async () => {
    await expectInvalidRequest(await post('/auth/login', { email: 42, password: 'valid-password-000' }));
    await expectInvalidRequest(
      await post('/auth/login', { email: TEST_ADMIN.email, password: 'x'.repeat(201) }),
    );
  });

  it('adminの型不正も同じerror envelopeで拒否する', async () => {
    const cookie = await loginForTest(app, env());
    await expectInvalidRequest(
      await post('/admin/users', { email: 'new@example.test', role: 'owner' }, cookie),
    );
    await expectInvalidRequest(await send(`/admin/users/${TEST_ADMIN.id}`, 'PATCH', cookie, { status: 1 }));
  });
});
