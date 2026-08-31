/**
 * 改善要望の API/D1/R2 ライフサイクル回帰テスト。
 * 実データを使わず、インメモリの D1 + R2 と架空の要望だけで検証する。
 *
 * ここが固定するのは受入条件のうち次の点。
 *  - 撮影が無くても投稿が成立する
 *  - トークンは平文で D1 に残らない(SHA-256 ハッシュだけ)
 *  - 期限切れと取得回数超過が区別され、どちらも 500 にならない
 *  - スクリーンショットの取得経路が Worker 1本だけである(公開/署名 URL を返さない)
 *  - 対応完了から30日で添付だけが消え、本文・状態・対応記録は残る
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMPROVEMENT_TOKEN_MAX_FETCH } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
const jpeg = (): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

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

/** 画面からの投稿。screenshot を渡さなければ本文だけの投稿になる */
async function create(
  options: { screenshot?: Uint8Array; diagnostics?: unknown; title?: string } = {},
): Promise<{ id: string; prompt: string; json: Record<string, unknown> }> {
  const form = new FormData();
  form.set('title', options.title ?? '架空の不具合');
  form.set('body', '保存ボタンを押しても何も起きません');
  form.set('route', '/classify');
  form.set(
    'diagnostics',
    JSON.stringify(
      options.diagnostics ?? {
        environment: {
          userAgent: 'synthetic-agent',
          language: 'ja',
          viewport: '1280x800@2',
          route: '/classify',
          capturedAt: '2026-03-01T00:00:00.000Z',
        },
        entries: [
          { at: '2026-03-01T00:00:00.000Z', kind: 'console_error', message: '架空のエラー', detail: '' },
        ],
        omittedCount: 0,
      },
    ),
  );
  if (options.screenshot)
    form.set('screenshot', new File([options.screenshot], 'screen.jpg', { type: 'image/jpeg' }));
  const res = await app.request(
    '/api/improvements',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as Record<string, unknown>;
  const request = json.request as { id: string };
  return { id: request.id, prompt: json.prompt as string, json };
}

/** 指示文からトークン原文だけを取り出す。指示文は Bearer 行にそれを載せている */
const tokenOf = (prompt: string): string => {
  const m = /Bearer\s+(imp_[A-Za-z0-9._-]+)/.exec(prompt);
  if (!m) throw new Error('prompt does not carry a token');
  return m[1];
};

const agent = async (id: string, token: string, suffix = 'data'): Promise<Response> =>
  await app.request(
    `/api/improvements/${id}/agent/${suffix}`,
    { headers: { authorization: `Bearer ${token}` } },
    env(),
  );

const rowOf = (id: string) =>
  d1.prepare('SELECT * FROM improvement_requests WHERE id = ?').bind(id).first<Record<string, unknown>>();

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'improvement-lifecycle',
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
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');
});

afterAll(async () => {
  await mf?.dispose();
});

beforeEach(async () => {
  await d1.prepare('DELETE FROM improvement_requests').run();
  // R2 も一緒に空にする。消し忘れると前のテストの画像が次のテストで孤児として数えられる
  const listed = await files.list({ prefix: 'improvements/' });
  for (const object of listed.objects) await files.delete(object.key);
});

describe('投稿', () => {
  it('スクリーンショットが無くても本文だけで 201 になる', async () => {
    const { json } = await create();
    expect((json.request as { screenshot: { available: boolean } }).screenshot.available).toBe(false);
    expect(json.screenshotRejected).toBeNull();
    expect(json.diagnosticsRejected).toBe(false);
  });

  it('画像を添えると R2 に置かれ、一覧と詳細から参照できる', async () => {
    const { id } = await create({ screenshot: jpeg() });
    const row = await rowOf(id);
    expect(row?.screenshot_key).toBe(`improvements/default/${id}.jpg`);
    expect(await files.head(String(row?.screenshot_key))).not.toBeNull();

    const list = (await (await get('/improvements')).json()) as {
      requests: { id: string; screenshot: { available: boolean } }[];
    };
    expect(list.requests.map((r) => r.id)).toContain(id);
    expect(list.requests[0].screenshot.available).toBe(true);
  });

  it('JPEG でも PNG でもない中身は保存せず、拒否理由を返して投稿自体は成立させる', async () => {
    const form = new FormData();
    form.set('title', '架空の不具合');
    form.set('body', '中身が画像ではないファイル');
    form.set('route', '/');
    form.set('screenshot', new File([new Uint8Array([1, 2, 3, 4])], 'x.jpg', { type: 'image/jpeg' }));
    const res = await app.request(
      '/api/improvements',
      { method: 'POST', headers: { cookie }, body: form },
      env(),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { screenshotRejected: string };
    expect(json.screenshotRejected).toBe('unsupported_type');
  });

  it('件名と内容が空なら 400 で、行が増えない', async () => {
    const form = new FormData();
    form.set('title', '');
    form.set('body', '');
    const res = await app.request(
      '/api/improvements',
      { method: 'POST', headers: { cookie }, body: form },
      env(),
    );
    expect(res.status).toBe(400);
    const count = await d1.prepare('SELECT COUNT(*) AS n FROM improvement_requests').first<number>('n');
    expect(count).toBe(0);
  });
});

describe('指示文とトークン', () => {
  it('トークンの平文はどの列にも保存されず、SHA-256 ハッシュだけが残る', async () => {
    const { id, prompt } = await create();
    const token = tokenOf(prompt);
    const row = await rowOf(id);
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain(token);
    // ハッシュは 64 桁の16進
    expect(String(row?.token_hash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('トークン値がログへ出力されない', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { id, prompt } = await create({ screenshot: jpeg() });
    const token = tokenOf(prompt);
    await agent(id, token);
    await agent(id, 'imp_wrong-token');
    const printed = [log, error, warn].flatMap((spy) => spy.mock.calls.flat()).join('\n');
    expect(printed).not.toContain(token);
    expect(printed).not.toContain('imp_wrong-token');
    log.mockRestore();
    error.mockRestore();
    warn.mockRestore();
  });

  /*
   * 指示文には診断の中身を埋めない(取得先だけを載せる)方針は変えない。
   * ただし再現条件の当たりを付ける最小限 — 画面・表示サイズ・時刻・ブラウザ — は
   * 行として載せる。これが無いと、受け取った側は取得するまで何も分からない。
   */
  it('指示文に発生時の画面と表示環境が載る', async () => {
    const { prompt } = await create();
    expect(prompt).toContain('- 発生画面: /classify');
    expect(prompt).toContain('- 表示サイズ: 1280x800@2');
    expect(prompt).toContain('- 発生時刻: 2026-03-01T00:00:00.000Z');
    expect(prompt).toContain('- ブラウザ: synthetic-agent');
  });

  /*
   * 指示文へ出すのは先頭の数件だけ。全件は data から取れるので重ねない。
   * 選び方は core が正本で、利用者が送信前に画面で見た並びと同じになる。
   */
  it('先に見るべき記録が指示文に出て、上限を超えて並ばない', async () => {
    const { prompt } = await create({
      diagnostics: {
        environment: {
          userAgent: 'synthetic-agent',
          language: 'ja',
          viewport: '1280x800@2',
          route: '/classify',
          capturedAt: '2026-03-01T00:00:00.000Z',
        },
        entries: Array.from({ length: 8 }, (_, i) => ({
          at: `2026-03-01T00:00:0${i}.000Z`,
          kind: 'network',
          message: `GET /api/synthetic-${i} 500`,
          detail: '',
        })),
        omittedCount: 0,
      },
    });
    expect(prompt).toContain('先に見るべき記録:');
    const shown = prompt.split('\n').filter((l) => l.startsWith('- [network]'));
    expect(shown).toHaveLength(3);
    // 新しいほう(末尾)が選ばれる。押す直前ほど再現条件に近い
    expect(prompt).toContain('GET /api/synthetic-7 500');
    expect(prompt).not.toContain('GET /api/synthetic-0 500');
  });

  it('作り直した指示文にも同じ表示環境が載る', async () => {
    const { id } = await create();
    const res = await post(`/improvements/${id}/prompt`);
    const next = ((await res.json()) as { prompt: string }).prompt;
    expect(next).toContain('- 表示サイズ: 1280x800@2');
    expect(next).toContain('- ブラウザ: synthetic-agent');
  });

  it('指示文の作り直しで前のトークンが失効する', async () => {
    const { id, prompt } = await create();
    const old = tokenOf(prompt);
    const res = await post(`/improvements/${id}/prompt`);
    expect(res.status).toBe(200);
    const next = tokenOf(((await res.json()) as { prompt: string }).prompt);
    expect(next).not.toBe(old);
    expect((await agent(id, old)).status).toBe(401);
    expect((await agent(id, next)).status).toBe(200);
  });

  it('期限切れと取得回数超過が別の拒否理由になり、どちらも 500 にならない', async () => {
    const expired = await create();
    await d1
      .prepare('UPDATE improvement_requests SET token_expires_at = ? WHERE id = ?')
      .bind('2000-01-01T00:00:00.000Z', expired.id)
      .run();
    const expiredRes = await agent(expired.id, tokenOf(expired.prompt));
    expect(expiredRes.status).toBe(401);
    expect(((await expiredRes.json()) as { error: { code: string } }).error.code).toBe('token_expired');

    const exhausted = await create();
    await d1
      .prepare('UPDATE improvement_requests SET token_fetch_count = ? WHERE id = ?')
      .bind(IMPROVEMENT_TOKEN_MAX_FETCH, exhausted.id)
      .run();
    const exhaustedRes = await agent(exhausted.id, tokenOf(exhausted.prompt));
    expect(exhaustedRes.status).toBe(401);
    expect(((await exhaustedRes.json()) as { error: { code: string } }).error.code).toBe('token_fetch_limit');
  });

  it('取得のたびに回数が増え、上限を超えると同じトークンでは取れなくなる', async () => {
    const { id, prompt } = await create({ screenshot: jpeg() });
    const token = tokenOf(prompt);
    for (let i = 0; i < IMPROVEMENT_TOKEN_MAX_FETCH; i += 1) {
      expect((await agent(id, token)).status).toBe(200);
    }
    expect((await agent(id, token)).status).toBe(401);
  });
});

describe('エージェントからの取得', () => {
  it('指示文のトークンだけで診断情報とスクリーンショットが取れる', async () => {
    const { id, prompt } = await create({ screenshot: jpeg() });
    const token = tokenOf(prompt);

    const data = await agent(id, token);
    expect(data.status).toBe(200);
    const json = (await data.json()) as {
      screenshot: { available: boolean; url: string };
      diagnostics: { entries: unknown[] };
    };
    expect(json.diagnostics.entries.length).toBe(1);
    // 取得先は必ず Worker の endpoint。R2 の公開/署名 URL は出さない
    expect(json.screenshot.url).toMatch(/\/api\/improvements\/[^/]+\/agent\/screenshot$/);
    expect(json.screenshot.url).not.toMatch(/r2\.cloudflarestorage\.com|X-Amz-Signature/);

    const shot = await agent(id, token, 'screenshot');
    expect(shot.status).toBe(200);
    expect(shot.headers.get('content-type')).toBe('image/jpeg');
    expect(shot.headers.get('cache-control')).toBe('private, no-store');
  });

  it('トークンなし・別要望のトークンでは取得できない', async () => {
    const a = await create({ screenshot: jpeg() });
    const b = await create();
    expect((await app.request(`/api/improvements/${a.id}/agent/data`, {}, env())).status).toBe(401);
    // b のトークンで a を取りにいっても通らない(id とハッシュの両方で照合している)
    expect((await agent(a.id, tokenOf(b.prompt))).status).toBe(401);
  });
});

describe('保持期限', () => {
  it('対応完了から30日を過ぎると添付だけが消え、本文と状態は残る', async () => {
    const { id } = await create({ screenshot: jpeg() });
    const key = `improvements/default/${id}.jpg`;
    expect((await post(`/improvements/${id}/status`, { status: 'done' })).status).toBe(200);
    await d1
      .prepare('UPDATE improvement_requests SET done_at = ? WHERE id = ?')
      .bind('2026-01-01T00:00:00.000Z', id)
      .run();

    const result = await runImprovementRetention(env(), '2026-02-15T00:00:00.000Z');
    expect(result.selected).toBe(1);
    expect(result.purged).toBe(1);
    expect(result.failed).toBe(0);

    expect(await files.head(key)).toBeNull();
    const row = await rowOf(id);
    expect(row?.screenshot_key).toBeNull();
    expect(row?.diagnostics_json).toBeNull();
    expect(row?.token_hash).toBeNull();
    expect(row?.purged_at).toBe('2026-02-15T00:00:00.000Z');
    // 本文・状態・対応記録は残る
    expect(row?.body).toBe('保存ボタンを押しても何も起きません');
    expect(row?.status).toBe('done');
    expect(row?.done_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('未完了と30日未満の要望は消さない', async () => {
    const open = await create({ screenshot: jpeg() });
    const recent = await create({ screenshot: jpeg() });
    await post(`/improvements/${recent.id}/status`, { status: 'done' });
    await d1
      .prepare('UPDATE improvement_requests SET done_at = ? WHERE id = ?')
      .bind('2026-02-10T00:00:00.000Z', recent.id)
      .run();

    const result = await runImprovementRetention(env(), '2026-02-15T00:00:00.000Z');
    expect(result.selected).toBe(0);
    expect(await files.head(`improvements/default/${open.id}.jpg`)).not.toBeNull();
    expect(await files.head(`improvements/default/${recent.id}.jpg`)).not.toBeNull();
  });

  it('削除済みの要望は画像取得が 410、指示文の作り直しも 410 になる', async () => {
    const { id } = await create({ screenshot: jpeg() });
    await post(`/improvements/${id}/status`, { status: 'done' });
    await d1
      .prepare('UPDATE improvement_requests SET done_at = ? WHERE id = ?')
      .bind('2026-01-01T00:00:00.000Z', id)
      .run();
    await runImprovementRetention(env(), '2026-02-15T00:00:00.000Z');

    expect((await get(`/improvements/${id}/screenshot`)).status).toBe(410);
    expect((await post(`/improvements/${id}/prompt`)).status).toBe(410);
  });

  it('D1 に対応する行が無い R2 オブジェクトは孤児として消える', async () => {
    await files.put('improvements/default/orphan.jpg', jpeg());
    // 直近5分の猶予をまたぐよう、置いた直後は消えないことも同時に確かめる
    const immediate = await runImprovementRetention(env(), '2026-02-15T00:00:00.000Z');
    expect(immediate.orphans).toBe(0);
    expect(await files.head('improvements/default/orphan.jpg')).not.toBeNull();

    // 猶予を過ぎた状態を作る。R2 の uploaded は書けないので、現在時刻の方を進める
    const real = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(real + 10 * 60_000);
    try {
      const later = await runImprovementRetention(env(), '2026-02-15T00:00:00.000Z');
      expect(later.orphans).toBe(1);
      expect(await files.head('improvements/default/orphan.jpg')).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });
});
