/**
 * 失効層(トークンの失効と添付の30日削除)の回帰テスト。
 *
 * improvement-lifecycle.test.ts が「D1 の行がどうなるか」を固定するのに対し、
 * ここは利用者とエージェントから見える振る舞いを固定する:
 *   - 削除後も「何をいつ直したか」の記録は画面の詳細取得から読める
 *   - 期限切れと取得回数超過は別の理由として返り、どちらも 500 にならない
 * 記録まで一緒に消すと改善の履歴が残らず、500 を返すと呼び出し側が
 * 「壊れた」と「もう使えない」を区別できない。どちらも黙ってすり抜けやすい。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPROVEMENT_RETENTION_DAYS, IMPROVEMENT_TOKEN_MAX_FETCH } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { runImprovementRetention } from './routes/improvement.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;
const env = () => ({ ...auth, DB: d1, FILES: files });

/** 架空の JPEG。マジックナンバーだけが本物で、中身は意味を持たない */
const jpeg = (): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 9]);

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

const post = async (path: string, body?: unknown): Promise<Response> =>
  await app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );

const get = async (path: string): Promise<Response> =>
  await app.request(`/api${path}`, { headers: { cookie } }, env());

async function create(): Promise<{ id: string; token: string }> {
  const form = new FormData();
  form.set('title', '架空の不具合');
  form.set('body', '一覧の並び順が保存されません');
  form.set('route', '/classify');
  form.set('screenshot', new File([jpeg()], 'screen.jpg', { type: 'image/jpeg' }));
  const res = await app.request(
    '/api/improvements',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as { request: { id: string }; prompt: string };
  const m = /Bearer\s+(imp_[A-Za-z0-9._-]+)/.exec(json.prompt);
  if (!m) throw new Error('prompt does not carry a token');
  return { id: json.request.id, token: m[1] };
}

const agent = async (id: string, token: string): Promise<Response> =>
  await app.request(
    `/api/improvements/${id}/agent/data`,
    { headers: { authorization: `Bearer ${token}` } },
    env(),
  );

/** 対応済みにして、完了時刻を指定の日数だけ過去へ動かす */
async function markDoneDaysAgo(id: string, days: number, now: string): Promise<void> {
  expect((await post(`/improvements/${id}/status`, { status: 'done' })).status).toBe(200);
  const doneAt = new Date(Date.parse(now) - days * 24 * 60 * 60 * 1000).toISOString();
  await d1.prepare('UPDATE improvement_requests SET done_at = ? WHERE id = ?').bind(doneAt, id).run();
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'improvement-retention',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    env(),
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');
});

afterAll(async () => {
  await mf?.dispose();
});

beforeEach(async () => {
  await d1.prepare('DELETE FROM improvement_requests').run();
  // R2 も空にする。残すと前のテストの画像が次のテストで孤児として数えられる
  for (const object of (await files.list({ prefix: 'improvements/' })).objects) {
    await files.delete(object.key);
  }
});

describe('添付の30日削除', () => {
  const NOW = '2026-06-01T00:00:00.000Z';

  it(`対応完了から${IMPROVEMENT_RETENTION_DAYS}日を1日でも過ぎたら消え、1日でも足りなければ残る`, async () => {
    const expired = await create();
    const notYet = await create();
    await markDoneDaysAgo(expired.id, IMPROVEMENT_RETENTION_DAYS + 1, NOW);
    await markDoneDaysAgo(notYet.id, IMPROVEMENT_RETENTION_DAYS - 1, NOW);

    const result = await runImprovementRetention(env(), NOW);
    expect(result.selected).toBe(1);
    expect(result.purged).toBe(1);
    expect(result.failed).toBe(0);
    expect(await files.head(`improvements/default/${expired.id}.jpg`)).toBeNull();
    expect(await files.head(`improvements/default/${notYet.id}.jpg`)).not.toBeNull();
  });

  it('削除後も画面の詳細取得は 200 で、本文・状態・対応記録が読める', async () => {
    const { id } = await create();
    await markDoneDaysAgo(id, IMPROVEMENT_RETENTION_DAYS + 1, NOW);
    await runImprovementRetention(env(), NOW);

    const res = await get(`/improvements/${id}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      request: {
        body: string;
        status: string;
        doneAt: string | null;
        purgedAt: string | null;
        screenshot: { available: boolean };
        diagnostics: { available: boolean };
      };
    };
    // 消えるのは添付だけ。何をいつ直したかの記録は残す
    expect(json.request.body).toBe('一覧の並び順が保存されません');
    expect(json.request.status).toBe('done');
    expect(json.request.doneAt).not.toBeNull();
    expect(json.request.purgedAt).not.toBeNull();
    expect(json.request.screenshot.available).toBe(false);
    expect(json.request.diagnostics.available).toBe(false);
  });

  it('一覧にも残り続け、消えたことが available で分かる', async () => {
    const { id } = await create();
    await markDoneDaysAgo(id, IMPROVEMENT_RETENTION_DAYS + 1, NOW);
    await runImprovementRetention(env(), NOW);

    const json = (await (await get('/improvements')).json()) as {
      requests: { id: string; screenshot: { available: boolean } }[];
    };
    const row = json.requests.find((r) => r.id === id);
    expect(row).toBeDefined();
    expect(row?.screenshot.available).toBe(false);
  });

  it('同じ実行を二度掛けても対象が増えず、二重削除で落ちない', async () => {
    const { id } = await create();
    await markDoneDaysAgo(id, IMPROVEMENT_RETENTION_DAYS + 1, NOW);
    expect((await runImprovementRetention(env(), NOW)).purged).toBe(1);
    // purged_at が立った行は次回の対象に入らない(冪等)
    const second = await runImprovementRetention(env(), NOW);
    expect(second.selected).toBe(0);
    expect(second.failed).toBe(0);
  });
});

describe('トークンの失効理由', () => {
  it('期限切れは token_expired で 401、500 にならない', async () => {
    const { id, token } = await create();
    await d1
      .prepare('UPDATE improvement_requests SET token_expires_at = ? WHERE id = ?')
      .bind('2020-01-01T00:00:00.000Z', id)
      .run();

    const res = await agent(id, token);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('token_expired');
  });

  it('回数超過は token_fetch_limit で 401、500 にならない', async () => {
    const { id, token } = await create();
    await d1
      .prepare('UPDATE improvement_requests SET token_fetch_count = ? WHERE id = ?')
      .bind(IMPROVEMENT_TOKEN_MAX_FETCH, id)
      .run();

    const res = await agent(id, token);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('token_fetch_limit');
  });

  it('2つの理由は互いに別の文字列で、呼び出し側が対処を選べる', async () => {
    const expired = await create();
    const exhausted = await create();
    await d1
      .prepare('UPDATE improvement_requests SET token_expires_at = ? WHERE id = ?')
      .bind('2020-01-01T00:00:00.000Z', expired.id)
      .run();
    await d1
      .prepare('UPDATE improvement_requests SET token_fetch_count = ? WHERE id = ?')
      .bind(IMPROVEMENT_TOKEN_MAX_FETCH, exhausted.id)
      .run();

    const codes = await Promise.all(
      [agent(expired.id, expired.token), agent(exhausted.id, exhausted.token)].map(
        async (p) => ((await (await p).json()) as { error: { code: string } }).error.code,
      ),
    );
    expect(new Set(codes).size).toBe(2);
  });

  it('添付の削除でトークンも失効し、以後は認証が通らない', async () => {
    const { id, token } = await create();
    expect((await agent(id, token)).status).toBe(200);
    await markDoneDaysAgo(id, IMPROVEMENT_RETENTION_DAYS + 1, '2026-06-01T00:00:00.000Z');
    await runImprovementRetention(env(), '2026-06-01T00:00:00.000Z');

    // 取得先が空になった指示文を生かしておく意味はない
    const res = await agent(id, token);
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
  });
});
