/**
 * 改善リクエスト画面の API 契約 (specs/spec-improvement-screen.md「API契約」の Contract tests、AC-007〜AC-009)。
 * 実データを使わず、インメモリの D1 + R2 と架空の依頼だけで検証する。
 * ログインした利用者は全員 TENANT_ID ('default') のデータを見る。「他の利用者の依頼」は
 * 画面から作った行の user_id を別の値へ付け替えて作る (経路が user_id で絞っていることを確かめる)。
 *
 * ここが固定するのは次の点。
 *  - 一覧・件数・ページング・検索が core の結果どおりに返り、削除中の行は items にも counts にも入らない
 *  - 状態の変更は許される遷移だけ 200 で履歴が 1 行増え、同じ状態はべき等、許されない遷移は 409
 *  - 削除から復元で同じ id と番号が戻り、履歴に削除と復元の 2 行が残る
 *  - 他の利用者の依頼は、取得・画像・指示文・コピー記録・状態・再発行・削除・復元のすべてで 404 (O4)
 *  - 画面のマスクを通さない直接投稿にも、辞書と規則のマスクがサーバで掛かる (O2)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TENANT_ID } from './auth.js';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

let mf: Miniflare;
let d1: D1Database;
let files: R2Bucket;
let mine: string;
const OTHER_TENANT = 'synthetic-other-tenant';

const env = () => ({ ...auth, DB: d1, FILES: files });
const jpeg = (): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')))
      await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

const call = async (cookie: string, method: string, path: string, body?: unknown): Promise<Response> =>
  await app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );

interface Created {
  id: string;
  seq: number;
  prompt: string;
}

async function create(
  options: { body?: string; route?: string; screenshot?: boolean; diagnostics?: unknown } = {},
): Promise<Response> {
  const form = new FormData();
  form.set('body', options.body ?? '保存ボタンを押しても何も起きません');
  form.set('route', options.route ?? '/classify');
  form.set('privacyConfirmed', 'true');
  form.set('privacyConsented', 'true');
  if (options.diagnostics !== undefined) form.set('diagnostics', JSON.stringify(options.diagnostics));
  if (options.screenshot) form.set('screenshot', new File([jpeg()], 'screen.jpg', { type: 'image/jpeg' }));
  return await app.request(
    '/api/improvements',
    { method: 'POST', headers: { cookie: mine }, body: form },
    env(),
  );
}

async function created(options: Parameters<typeof create>[0] = {}): Promise<Created> {
  const res = await create(options);
  expect(res.status).toBe(201);
  const json = (await res.json()) as { request: { id: string; seq: number }; prompt: string };
  return { id: json.request.id, seq: json.request.seq, prompt: json.prompt };
}

interface ListBody {
  items: { id: string; number: string; status: string }[];
  counts: Record<'all' | 'open' | 'in_progress' | 'done' | 'reconfirm', number>;
  page: number;
  pageSize: number;
  total: number;
}

const list = async (query = ''): Promise<ListBody> => {
  const res = await call(mine, 'GET', `/improvements${query}`);
  expect(res.status).toBe(200);
  return (await res.json()) as ListBody;
};

const activities = async (id: string) =>
  (
    await d1
      .prepare(
        'SELECT kind, from_status, to_status FROM improvement_request_activities WHERE request_id=? ORDER BY created_at, rowid',
      )
      .bind(id)
      .all<{ kind: string; from_status: string | null; to_status: string | null }>()
  ).results;

const rowOf = (id: string) =>
  d1.prepare('SELECT * FROM improvement_requests WHERE id = ?').bind(id).first<Record<string, unknown>>();

/** 画面から作った行を別の利用者のものへ付け替える。履歴の user_id も揃える */
async function foreign(options: Parameters<typeof create>[0] = {}): Promise<Created> {
  const row = await created(options);
  await d1.batch([
    d1.prepare('UPDATE improvement_requests SET user_id=? WHERE id=?').bind(OTHER_TENANT, row.id),
    d1
      .prepare('UPDATE improvement_request_activities SET user_id=? WHERE request_id=?')
      .bind(OTHER_TENANT, row.id),
  ]);
  return row;
}

const tokenOf = (prompt: string): string => {
  const m = /Bearer\s+(imp_[A-Za-z0-9._-]+)/.exec(prompt);
  if (!m) throw new Error('prompt does not carry a token');
  return m[1];
};

const agent = async (id: string, token: string, suffix: 'data' | 'screenshot'): Promise<Response> =>
  await app.request(
    `/api/improvements/${id}/agent/${suffix}`,
    { headers: { authorization: `Bearer ${token}` } },
    env(),
  );

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'improvement-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);
  mine = await loginForTest(app, env());
  expect(mine).not.toBe('');
});

afterAll(async () => mf?.dispose());

beforeEach(async () => {
  await d1.batch([
    d1.prepare('DELETE FROM improvement_request_activities'),
    d1.prepare('DELETE FROM improvement_requests'),
    d1.prepare('DELETE FROM improvement_request_counters'),
  ]);
});

describe('GET /api/improvements', () => {
  it('12 件で counts.all が 12、page=2 で 2 件、tab=open で受付だけ', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i += 1) ids.push((await created({ body: `架空の依頼 ${i + 1}` })).id);
    await call(mine, 'POST', `/improvements/${ids[0]}/status`, { status: 'in_progress' });

    const first = await list();
    expect(first.counts.all).toBe(12);
    expect(first.items).toHaveLength(10);
    expect(first.pageSize).toBe(10);
    expect(first.total).toBe(12);
    // 並びは作成日の新しい順
    expect(first.items[0]?.number).toBe('IMP-012');

    const second = await list('?page=2');
    expect(second.items.map((i) => i.number)).toEqual(['IMP-002', 'IMP-001']);

    const open = await list('?tab=open');
    expect(open.counts).toMatchObject({ all: 12, open: 11, in_progress: 1 });
    expect(open.items.every((i) => i.status === 'open')).toBe(true);
    expect(open.total).toBe(11);
  });

  it('q は本文・IMP 番号・関連ページ名のそれぞれに当たり、空の結果は total 0', async () => {
    await created({ body: 'グラフの目盛りが読めない', route: '/classify' });
    await created({ body: '取込の手順が分かりにくい', route: '/budget' });

    expect((await list(`?q=${encodeURIComponent('グラフ')}`)).total).toBe(1);
    expect((await list('?q=IMP-002')).items.map((i) => i.number)).toEqual(['IMP-002']);
    expect((await list(`?q=${encodeURIComponent('予算')}`)).items.map((i) => i.number)).toEqual(['IMP-002']);
    expect((await list(`?q=${encodeURIComponent('該当しない語')}`)).total).toBe(0);
  });

  it('壊れた tab・範囲外の page は 400 にせず範囲内へ倒す', async () => {
    await created();
    const broken = await list('?tab=wontfix&page=99');
    expect(broken.total).toBe(1);
    expect(broken.page).toBe(1);
  });

  it('削除中の行は items にも counts にも入らず、他の利用者の行も 0 件', async () => {
    const a = await created();
    await created();
    await foreign();
    expect((await call(mine, 'DELETE', `/improvements/${a.id}`)).status).toBe(200);

    const body = await list();
    expect(body.counts.all).toBe(1);
    expect(body.items.map((i) => i.id)).not.toContain(a.id);
  });

  it('未認証は 401', async () => {
    const res = await app.request('/api/improvements', {}, env());
    expect(res.status).toBe(401);
  });
});

describe('POST /api/improvements', () => {
  it('201 で seq が前回 + 1、作成の履歴が 1 行', async () => {
    const one = await created();
    const two = await created();
    expect(two.seq).toBe(one.seq + 1);
    expect(await activities(two.id)).toEqual([{ kind: 'created', from_status: null, to_status: 'open' }]);
    expect((await rowOf(two.id))?.title).toBeNull();
  });

  it('1000 字ちょうどは 201、1001 字は 400', async () => {
    expect((await create({ body: 'あ'.repeat(1000) })).status).toBe(201);
    expect((await create({ body: 'あ'.repeat(1001) })).status).toBe(400);
  });

  it('プライバシー確認の片方が欠けると 400 で、行が増えない', async () => {
    const form = new FormData();
    form.set('body', '確認の片方だけ');
    form.set('route', '/classify');
    form.set('privacyConfirmed', 'true');
    const res = await app.request(
      '/api/improvements',
      { method: 'POST', headers: { cookie: mine }, body: form },
      env(),
    );
    expect(res.status).toBe(400);
    expect((await list()).total).toBe(0);
  });

  it('削除しても seq は再利用しない', async () => {
    const one = await created();
    await call(mine, 'DELETE', `/improvements/${one.id}`);
    const two = await created();
    expect(two.seq).toBe(one.seq + 1);
  });
});

describe('GET /api/improvements/:id', () => {
  it('関連する依頼は同じ route の他の行を最大 3 件、新しい順で、自分と削除中を含めない', async () => {
    const same = [];
    for (let i = 0; i < 5; i += 1) same.push(await created({ route: '/budget' }));
    await created({ route: '/classify' });
    await call(mine, 'DELETE', `/improvements/${same[3]?.id}`);

    const res = await call(mine, 'GET', `/improvements/${same[0]?.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      number: string;
      related: { id: string }[];
      allowedTransitions: string[];
      activities: { title: string }[];
    };
    expect(body.number).toBe('IMP-001');
    expect(body.related.map((r) => r.id)).toEqual([same[4]?.id, same[2]?.id, same[1]?.id]);
    expect(body.allowedTransitions).toEqual(['in_progress', 'done']);
    expect(body.activities).toHaveLength(1);
  });

  it('履歴は新しい順に並ぶ', async () => {
    const a = await created();
    await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'in_progress' });
    const body = (await (await call(mine, 'GET', `/improvements/${a.id}`)).json()) as {
      activities: { kind: string }[];
    };
    expect(body.activities.map((x) => x.kind)).toEqual(['status_changed', 'created']);
  });
});

describe('POST /api/improvements/:id/status', () => {
  it('受付から対応中で 200・履歴 1 行、完了に入ると done_at が付き、出ると外れる', async () => {
    const a = await created();
    expect((await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'in_progress' })).status).toBe(
      200,
    );
    expect(await activities(a.id)).toHaveLength(2);

    await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'done' });
    expect((await rowOf(a.id))?.done_at).not.toBeNull();
    await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'reconfirm' });
    expect((await rowOf(a.id))?.done_at).toBeNull();
  });

  it('同じ状態は 200 で、履歴は増えない', async () => {
    const a = await created();
    const res = await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'open' });
    expect(res.status).toBe(200);
    expect(await activities(a.id)).toHaveLength(1);
  });

  it('旧 wontfix を含む候補外の値は 400、許されない遷移は 409', async () => {
    const a = await created();
    expect((await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'wontfix' })).status).toBe(
      400,
    );
    const conflict = await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'reconfirm' });
    expect(conflict.status).toBe(409);
    expect(await activities(a.id)).toHaveLength(1);
  });
});

describe('DELETE と restore', () => {
  it('削除から復元で同じ id と seq が一覧に戻り、履歴に削除と復元の 2 行が残る (AC-008)', async () => {
    const a = await created();
    const del = await call(mine, 'DELETE', `/improvements/${a.id}`);
    expect(del.status).toBe(200);
    const { deletedAt } = (await del.json()) as { deletedAt: string };

    // 2 回目の削除も 200 で、deletedAt は変わらない
    const again = await call(mine, 'DELETE', `/improvements/${a.id}`);
    expect(again.status).toBe(200);
    expect(((await again.json()) as { deletedAt: string }).deletedAt).toBe(deletedAt);
    expect((await list()).total).toBe(0);

    const restored = await call(mine, 'POST', `/improvements/${a.id}/restore`);
    expect(restored.status).toBe(200);
    const body = (await restored.json()) as { request: { id: string; seq: number }; number: string };
    expect(body.request).toMatchObject({ id: a.id, seq: a.seq });
    expect(body.number).toBe('IMP-001');
    expect((await list()).items.map((i) => i.id)).toEqual([a.id]);
    expect((await activities(a.id)).map((x) => x.kind)).toEqual(['created', 'deleted', 'restored']);
  });

  it('削除中でない行の restore は 200 で、updated_at は変わらず履歴も増えない', async () => {
    const a = await created();
    const before = (await rowOf(a.id))?.updated_at;
    expect((await call(mine, 'POST', `/improvements/${a.id}/restore`)).status).toBe(200);
    expect((await rowOf(a.id))?.updated_at).toBe(before);
    expect(await activities(a.id)).toHaveLength(1);
  });

  it('削除中の依頼は詳細・画像・指示文・コピー記録・状態・agent の 2 経路で 404', async () => {
    const a = await created({ screenshot: true });
    const token = tokenOf(a.prompt);
    await call(mine, 'DELETE', `/improvements/${a.id}`);

    expect((await call(mine, 'GET', `/improvements/${a.id}`)).status).toBe(404);
    expect((await call(mine, 'GET', `/improvements/${a.id}/screenshot`)).status).toBe(404);
    expect((await call(mine, 'POST', `/improvements/${a.id}/prompt`)).status).toBe(404);
    expect((await call(mine, 'POST', `/improvements/${a.id}/copied`, { target: 'codex' })).status).toBe(404);
    expect((await call(mine, 'POST', `/improvements/${a.id}/status`, { status: 'done' })).status).toBe(404);
    expect((await agent(a.id, token, 'data')).status).toBe(404);
    expect((await agent(a.id, token, 'screenshot')).status).toBe(404);
  });
});

describe('他の利用者の依頼 (O4)', () => {
  it('取得・画像・指示文・コピー記録・状態・再発行・削除・復元のすべてで 404 になり、行は変わらない', async () => {
    const other = await foreign({ screenshot: true });
    const before = await rowOf(other.id);

    const attempts: [string, string, unknown?][] = [
      ['GET', `/improvements/${other.id}`],
      ['GET', `/improvements/${other.id}/screenshot`],
      ['POST', `/improvements/${other.id}/prompt`],
      ['POST', `/improvements/${other.id}/copied`, { target: 'claude_code' }],
      ['POST', `/improvements/${other.id}/status`, { status: 'in_progress' }],
      ['DELETE', `/improvements/${other.id}`],
      ['POST', `/improvements/${other.id}/restore`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await call(mine, method, path, body);
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
    }

    // 相手が削除した後の restore も 404。存在を推測させない
    await d1
      .prepare('UPDATE improvement_requests SET deleted_at=? WHERE id=?')
      .bind('2026-03-01T00:00:00.000Z', other.id)
      .run();
    expect((await call(mine, 'POST', `/improvements/${other.id}/restore`)).status).toBe(404);

    const after = await rowOf(other.id);
    expect({ ...after, deleted_at: null, updated_at: null }).toEqual({
      ...before,
      deleted_at: null,
      updated_at: null,
    });
    expect((await activities(other.id)).map((x) => x.kind)).toEqual(['created']);
  });

  it('存在しない id と他の利用者の id は同じ応答で区別できない', async () => {
    const other = await foreign();
    const missing = await call(mine, 'GET', '/improvements/imp-does-not-exist');
    const hidden = await call(mine, 'GET', `/improvements/${other.id}`);
    expect(hidden.status).toBe(missing.status);
    expect(await hidden.json()).toEqual(await missing.json());
  });
});

describe('サーバ側のマスク (AC-009)', () => {
  it('画面のマスクを通さない直接投稿でも、取引先名・名義・金額・メール・電話が伏せられる', async () => {
    await d1.batch([
      d1
        .prepare('INSERT INTO sub_vendor_exclusions (user_id, partner, vendor_key) VALUES (?, ?, ?)')
        .bind(TENANT_ID, '架空商事株式会社', 'kakuu-shoji'),
      d1
        .prepare('INSERT INTO owner_labels (user_id, owner, label, updated_at) VALUES (?, ?, ?, ?)')
        .bind(TENANT_ID, 'spouse', '山田花子', '2026-01-01T00:00:00.000Z'),
    ]);
    const secrets = ['架空商事株式会社', '山田花子', '¥1,248,000', 'taro@example.com', '090-1234-5678'];
    const a = await created({
      body: '架空商事株式会社への ¥1,248,000 が 山田花子 の名義で出る。連絡 taro@example.com / 090-1234-5678',
      diagnostics: {
        environment: {
          userAgent: 'synthetic-agent',
          language: 'ja',
          viewport: '1280x800@2',
          route: '/classify',
          capturedAt: '2026-03-01T00:00:00.000Z',
        },
        entries: [
          {
            at: '2026-03-01T00:00:00.000Z',
            kind: 'console_error',
            message: '架空商事株式会社 の行で失敗',
            detail: '',
          },
        ],
        omittedCount: 0,
      },
    });
    const row = await rowOf(a.id);
    const stored = `${row?.body} ${row?.diagnostics_json}`;
    for (const secret of secrets) expect(stored, secret).not.toContain(secret);
    expect(stored).toContain('***');
  });
});
