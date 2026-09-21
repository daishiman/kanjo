/**
 * 保存したフィルタ (saved-filters) の API/D1 回帰 (spec-classify-screen 7.4・BR-14)。
 *
 * 条件は JSON 1 列で持つ。だから「読み書きの両方で同じ zod を通し、知らないキーを落とす」
 * ことが表の CHECK と同じ重みの契約になる。ここが緩むと、画面の項目が増えた翌日に
 * 古い条件が復元できなくなる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = { ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', SESSION_SECRET: 'synthetic-test-secret' };

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const env = () => ({ ...auth, DB: database });
const get = (path: string) => app.request(`/api${path}`, { headers: { cookie } }, env());
const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = { cookie }) =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env(),
  );

interface SavedFilter {
  id: string;
  name: string;
  query: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const clean = async () => {
  await database.prepare('DELETE FROM saved_filters').run();
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'saved-filters',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, env());
}, 60_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('認証', () => {
  it('Cookie が無ければ一覧も保存も削除も 401', async () => {
    expect((await app.request('/api/saved-filters', {}, env())).status).toBe(401);
    expect((await send('POST', '/saved-filters', { name: 'x', query: {} }, {})).status).toBe(401);
    expect((await send('DELETE', '/saved-filters/whatever', undefined, {})).status).toBe(401);
  });
});

describe('保存と読み出し', () => {
  it('保存した条件がそのまま往復し、知らないキーは落ちる', async () => {
    await clean();
    const response = await send('POST', '/saved-filters', {
      name: '  未整理の事業  ',
      query: {
        status: ['unsorted', 'review'],
        category: '通信費',
        owner: 'business',
        method: 'card',
        manual: true,
        q: 'クラウド',
        sort: 'date_asc',
        // 画面が持たない値。保存しても読み出しても現れない
        from: '2026-01',
        secret: 'x',
      },
    });
    expect(response.status).toBe(201);
    const { item } = (await response.json()) as { item: SavedFilter };
    // 名前の前後の空白は落とす。「未整理の事業 」と「未整理の事業」を別物にしない
    expect(item.name).toBe('未整理の事業');
    expect(item.query).toEqual({
      status: ['unsorted', 'review'],
      category: '通信費',
      owner: 'business',
      method: 'card',
      manual: true,
      q: 'クラウド',
      sort: 'date_asc',
    });

    const listed = (await (await get('/saved-filters')).json()) as { items: SavedFilter[] };
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.query).toEqual(item.query);
    expect(listed.items[0]?.id).toBe(item.id);
  });

  it('期間は保存しない。先月の条件を今月呼び出して空にしないため', async () => {
    await clean();
    await send('POST', '/saved-filters', { name: '期間つき', query: { status: ['done'] } });
    const stored = await database
      .prepare("SELECT query_json FROM saved_filters WHERE user_id='default'")
      .first<{ query_json: string }>();
    expect(stored?.query_json).toBeTruthy();
    expect(JSON.parse(stored?.query_json ?? '{}')).toEqual({ status: ['done'] });
  });

  it('壊れた行は一覧から落とすだけで、一覧そのものは出る', async () => {
    await clean();
    await send('POST', '/saved-filters', { name: '正しい行', query: { status: ['unsorted'] } });
    await database
      .prepare(
        `INSERT INTO saved_filters (id,user_id,name,query_json,created_at,updated_at)
         VALUES ('broken','default','壊れた行','{not json',
                 '2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
      )
      .run();
    const listed = (await (await get('/saved-filters')).json()) as { items: SavedFilter[] };
    expect(listed.items.map((i) => i.name)).toEqual(['正しい行']);
  });

  it('他の利用者のフィルタは一覧にも出ず、削除も 404', async () => {
    await clean();
    await database
      .prepare(
        `INSERT INTO saved_filters (id,user_id,name,query_json,created_at,updated_at)
         VALUES ('foreign','other-user','別利用者','{"status":["done"]}',
                 '2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')`,
      )
      .run();
    const listed = (await (await get('/saved-filters')).json()) as { items: SavedFilter[] };
    expect(listed.items).toHaveLength(0);

    const deleted = await send('DELETE', '/saved-filters/foreign');
    expect(deleted.status).toBe(404);
    const survives = await database
      .prepare("SELECT COUNT(*) AS n FROM saved_filters WHERE user_id='other-user'")
      .first<{ n: number }>();
    expect(survives?.n).toBe(1);
  });
});

describe('入力の境界 (BR-14)', () => {
  it('空名と 41 文字は 400、40 文字は通る', async () => {
    await clean();
    expect((await send('POST', '/saved-filters', { name: '   ', query: {} })).status).toBe(400);
    expect((await send('POST', '/saved-filters', { name: 'あ'.repeat(41), query: {} })).status).toBe(400);
    expect((await send('POST', '/saved-filters', { name: 'あ'.repeat(40), query: {} })).status).toBe(201);
  });

  // status は enum の配列だが件数の上限が無いので、同じ値を並べれば長さは伸ばせる。
  // 条件 JSON の長さは migration の CHECK と同じ 2000 字で止める (BR-14)。
  // ここを止めないと、CHECK に弾かれる行を作ろうとして 500 で落ちる
  it('条件 JSON が 2000 字を超えると 400', async () => {
    await clean();
    const long = { status: Array.from({ length: 400 }, () => 'done') };
    const over = await send('POST', '/saved-filters', { name: '長い', query: long });
    expect(over.status).toBe(400);
    expect(await over.json()).toMatchObject({ error: { code: 'invalid_body' } });
    const count = await database
      .prepare("SELECT COUNT(*) AS n FROM saved_filters WHERE user_id='default'")
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
  });

  it('知らない状態や支払い方法は 400', async () => {
    await clean();
    expect((await send('POST', '/saved-filters', { name: 'a', query: { status: ['nope'] } })).status).toBe(
      400,
    );
    expect((await send('POST', '/saved-filters', { name: 'b', query: { method: 'bitcoin' } })).status).toBe(
      400,
    );
  });

  it('同じ名前は 409。上書きすると元の条件が黙って消える', async () => {
    await clean();
    expect((await send('POST', '/saved-filters', { name: '重複', query: {} })).status).toBe(201);
    const again = await send('POST', '/saved-filters', { name: '重複', query: { status: ['done'] } });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: 'duplicate_name' } });
  });

  it('21 件目は 409。上限は 20 件', async () => {
    await clean();
    for (let i = 0; i < 20; i++) {
      expect((await send('POST', '/saved-filters', { name: `f${i}`, query: {} })).status).toBe(201);
    }
    const over = await send('POST', '/saved-filters', { name: 'f20', query: {} });
    expect(over.status).toBe(409);
    expect(await over.json()).toMatchObject({ error: { code: 'limit_reached' } });
    const count = await database
      .prepare("SELECT COUNT(*) AS n FROM saved_filters WHERE user_id='default'")
      .first<{ n: number }>();
    expect(count?.n).toBe(20);
  });
});

describe('削除', () => {
  it('自分のフィルタは消え、同じ id をもう一度消すと 404', async () => {
    await clean();
    const created = (await (await send('POST', '/saved-filters', { name: '消す', query: {} })).json()) as {
      item: SavedFilter;
    };
    const first = await send('DELETE', `/saved-filters/${created.item.id}`);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, id: created.item.id });
    expect((await send('DELETE', `/saved-filters/${created.item.id}`)).status).toBe(404);
  });
});

describe('変更系保護', () => {
  it('取込と重なると保存も削除も 409 で、行は増えも減りもしない', async () => {
    await clean();
    const created = (await (await send('POST', '/saved-filters', { name: '残る', query: {} })).json()) as {
      item: SavedFilter;
    };
    await database
      .prepare('INSERT INTO import_writer_claims (user_id,run_id,claimed_at,expires_at) VALUES (?,?,?,?)')
      .bind('default', 'import:other', Date.now(), Date.now() + 600_000)
      .run();
    try {
      expect((await send('POST', '/saved-filters', { name: '入らない', query: {} })).status).toBe(409);
      expect((await send('DELETE', `/saved-filters/${created.item.id}`)).status).toBe(409);
    } finally {
      await database.prepare("DELETE FROM import_writer_claims WHERE user_id='default'").run();
    }
    const count = await database
      .prepare("SELECT COUNT(*) AS n FROM saved_filters WHERE user_id='default'")
      .first<{ n: number }>();
    expect(count?.n).toBe(1);
  });
});
