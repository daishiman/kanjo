/**
 * 二重マスクと量の上限の回帰テスト。
 *
 * 画面側(diagnostics-buffer)のマスクは改竄できる経路にある。だからサーバは
 * 「クライアントが既にマスクした」を前提にしない。ここでは画面側を通さず
 * 生の秘匿値を直接 POST し、保存された行に平文が残らないことを確かめる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIAGNOSTIC_MAX_BYTES,
  DIAGNOSTIC_MAX_DETAIL,
  DIAGNOSTIC_MAX_ENTRIES,
  DIAGNOSTIC_MAX_MESSAGE,
  type DiagnosticEntry,
  redactSecrets,
  trimDiagnostics,
} from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './index.js';
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

const entry = (message: string, detail = ''): DiagnosticEntry => ({
  at: '2026-03-01T00:00:00.000Z',
  kind: 'console_error',
  message,
  detail,
});

/** 画面のマスク処理を通さず、生の秘匿値をそのまま multipart で投げる */
async function postRaw(fields: {
  title?: string;
  body?: string;
  route?: string;
  entries?: DiagnosticEntry[];
  omittedCount?: number;
}): Promise<{ id: string }> {
  const form = new FormData();
  form.set('title', fields.title ?? '架空の不具合');
  form.set('body', fields.body ?? '本文');
  form.set('route', fields.route ?? '/');
  form.set(
    'diagnostics',
    JSON.stringify({
      environment: {
        userAgent: 'synthetic-agent',
        language: 'ja',
        viewport: '1280x800@2',
        route: fields.route ?? '/',
        capturedAt: '2026-03-01T00:00:00.000Z',
      },
      entries: fields.entries ?? [],
      omittedCount: fields.omittedCount ?? 0,
    }),
  );
  const res = await app.request(
    '/api/improvements',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(res.status).toBe(201);
  const json = (await res.json()) as { request: { id: string } };
  return { id: json.request.id };
}

const storedText = async (id: string): Promise<string> => {
  const row = await d1
    .prepare('SELECT * FROM improvement_requests WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  return JSON.stringify(row);
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'improvement-redaction',
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

describe('マスク規則(core)', () => {
  it.each([
    ['Authorization: Bearer abc.def-ghi123', 'abc.def-ghi123'],
    ['cookie: kanjo_session=abcdef123456; path=/', 'abcdef123456'],
    ['CF_Authorization=eyJhbGciOiJIUzI1NiJ9', 'eyJhbGciOiJIUzI1NiJ9'],
    ['{"password":"hunter2-secret"}', 'hunter2-secret'],
    ['api_key = 1234567890abcdef', '1234567890abcdef'],
    ['連絡先は taro@example.com です', 'taro@example.com'],
    ['口座 1234-5678-9012 の残高', '1234-5678-9012'],
    ['token=imp_rawtokenvalue', 'imp_rawtokenvalue'],
  ])('%s から秘匿値が消える', (input, secret) => {
    const masked = redactSecrets(input);
    expect(masked).not.toContain(secret);
    expect(masked).toContain('***');
  });

  it('二度掛けても結果が変わらない(冪等)', () => {
    const once = redactSecrets('Authorization: Bearer abc.def-ghi123 / taro@example.com');
    expect(redactSecrets(once)).toBe(once);
  });

  it('秘匿値でない文字列は壊さない', () => {
    const plain = '分類画面で保存ボタンを押しても反応しません';
    expect(redactSecrets(plain)).toBe(plain);
  });
});

describe('切り詰め(core)', () => {
  it('件数上限を超えた分は新しい方を残し、捨てた件数を数える', () => {
    const many = Array.from({ length: DIAGNOSTIC_MAX_ENTRIES + 7 }, (_, i) => entry(`件 ${i}`));
    const trimmed = trimDiagnostics(many);
    expect(trimmed.entries.length).toBeLessThanOrEqual(DIAGNOSTIC_MAX_ENTRIES);
    expect(trimmed.omittedCount).toBe(many.length - trimmed.entries.length);
    // 直近が残る。古い方から捨てる
    expect(trimmed.entries.at(-1)?.message).toBe(`件 ${many.length - 1}`);
  });

  it('件数が上限内でもバイト上限で切り詰める', () => {
    // 1件あたり message 400字上限 = UTF-8 で約1.2KB。40件で 32KB を超える
    const fat = Array.from({ length: 40 }, (_, i) => entry(`件 ${i} ${'あ'.repeat(400)}`));
    const trimmed = trimDiagnostics(fat);
    expect(trimmed.omittedCount).toBeGreaterThan(0);
    const bytes = new TextEncoder().encode(JSON.stringify(trimmed.entries)).length;
    expect(bytes).toBeLessThanOrEqual(DIAGNOSTIC_MAX_BYTES);
  });

  it('1件が長すぎる場合は message と detail が個別に切られる', () => {
    const trimmed = trimDiagnostics([entry('x'.repeat(5000), 'y'.repeat(5000))]);
    expect(trimmed.entries[0].message.length).toBeLessThanOrEqual(DIAGNOSTIC_MAX_MESSAGE);
    expect(trimmed.entries[0].detail.length).toBeLessThanOrEqual(DIAGNOSTIC_MAX_DETAIL);
  });
});

describe('サーバ側の再マスク', () => {
  it('画面のマスクを通さない直接投稿でも、保存された行に平文が残らない', async () => {
    const secrets = [
      'Bearer super-secret-agent-token',
      'kanjo_session=raw-session-value',
      'hunter2-plaintext',
      'taro@example.com',
    ];
    const { id } = await postRaw({
      body: '連絡先 taro@example.com / Authorization: Bearer super-secret-agent-token',
      entries: [
        entry('fetch failed', 'cookie: kanjo_session=raw-session-value'),
        entry('{"password":"hunter2-plaintext"}'),
      ],
    });
    const stored = await storedText(id);
    for (const secret of secrets) expect(stored).not.toContain(secret);
    expect(stored).toContain('***');
  });

  it('画面パスに紛れ込んだトークンもマスクされる', async () => {
    const { id } = await postRaw({ route: '/report?token=raw-query-token' });
    expect(await storedText(id)).not.toContain('raw-query-token');
  });

  it('上限を超える件数を直接投げても保存側で切り詰め、省略件数を返す', async () => {
    const { id } = await postRaw({
      entries: Array.from({ length: DIAGNOSTIC_MAX_ENTRIES + 25 }, (_, i) => entry(`件 ${i}`)),
    });
    const res = await app.request(`/api/improvements/${id}`, { headers: { cookie } }, env());
    const json = (await res.json()) as { diagnostics: { entries: unknown[]; omittedCount: number } };
    expect(json.diagnostics.entries.length).toBeLessThanOrEqual(DIAGNOSTIC_MAX_ENTRIES);
    expect(json.diagnostics.omittedCount).toBeGreaterThan(0);
  });

  it('診断が壊れた JSON でも 201 になり、拒否したことを返す', async () => {
    const form = new FormData();
    form.set('title', '架空の不具合');
    form.set('body', '診断が壊れている');
    form.set('route', '/');
    form.set('diagnostics', '{ これは JSON ではない');
    const res = await app.request(
      '/api/improvements',
      { method: 'POST', headers: { cookie }, body: form },
      env(),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { diagnosticsRejected: boolean }).diagnosticsRejected).toBe(true);
  });

  it('上限を超える件名・本文は 400 で断り、黙って切り詰めない', async () => {
    // 画面側の入力欄が maxLength で止めるので、ここへ来るのは直接投稿だけ。
    // 勝手に切ると「送ったはずの説明が消える」ため、受け取らないほうを選ぶ
    const form = new FormData();
    form.set('title', 'あ'.repeat(400));
    form.set('body', 'い'.repeat(9000));
    form.set('route', '/');
    const res = await app.request(
      '/api/improvements',
      { method: 'POST', headers: { cookie }, body: form },
      env(),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).not.toBe('internal');
  });
});
