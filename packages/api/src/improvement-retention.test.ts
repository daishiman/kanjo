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
import {
  IMPROVEMENT_ORPHAN_CHECKPOINT_KEY,
  IMPROVEMENT_ORPHAN_GRACE_MS,
  IMPROVEMENT_ORPHAN_LOOKUP_MAX_BYTES,
  IMPROVEMENT_ORPHAN_SCAN_LIMIT,
  runImprovementRetention,
  serializeImprovementOrphanLookupKeys,
} from './routes/improvement.js';
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

const r2Object = (key: string, uploaded = new Date(0)): R2Object => ({
  key,
  version: 'synthetic',
  size: 0,
  etag: 'synthetic',
  httpEtag: '"synthetic"',
  uploaded,
  storageClass: 'Standard',
  checksums: { toJSON: () => ({}) },
  writeHttpMetadata: () => undefined,
});

interface PagedFilesOptions {
  checkpoint?: string;
  checkpointSize?: number;
  failDeleteOnce?: boolean;
  failPutOnce?: boolean;
}

function pagedFiles(pages: ReadonlyMap<string, R2Objects>, options: PagedFilesOptions = {}) {
  let checkpoint: string | null = options.checkpoint ?? null;
  let failDeleteOnce = options.failDeleteOnce ?? false;
  let failPutOnce = options.failPutOnce ?? false;
  const listCursors: Array<string | undefined> = [];
  const deleteCalls: string[][] = [];
  const bucket: Partial<R2Bucket> = {
    get: async (key) => {
      if (key !== IMPROVEMENT_ORPHAN_CHECKPOINT_KEY || checkpoint === null) return null;
      const bytes = new TextEncoder().encode(checkpoint);
      return {
        ...r2Object(key),
        size: options.checkpointSize ?? bytes.byteLength,
        body: new ReadableStream(),
        bodyUsed: false,
        arrayBuffer: async () => bytes.buffer,
        text: async () => checkpoint ?? '',
        json: async <T>() => JSON.parse(checkpoint ?? '') as T,
        blob: async () => new Blob([bytes]),
      } as R2ObjectBody;
    },
    put: async (key, value) => {
      if (key !== IMPROVEMENT_ORPHAN_CHECKPOINT_KEY || typeof value !== 'string')
        throw new Error('unexpected synthetic R2 put');
      if (failPutOnce) {
        failPutOnce = false;
        throw new Error('synthetic checkpoint put failure');
      }
      checkpoint = value;
      return r2Object(key);
    },
    delete: async (keys) => {
      const values = Array.isArray(keys) ? keys : [keys];
      deleteCalls.push(values);
      if (failDeleteOnce && !values.includes(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY)) {
        failDeleteOnce = false;
        throw new Error('synthetic orphan delete failure');
      }
      if (values.includes(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY)) checkpoint = null;
    },
    list: async (options) => {
      listCursors.push(options?.cursor);
      const page = pages.get(options?.cursor ?? '');
      if (!page) throw new Error('unexpected synthetic R2 cursor');
      return page;
    },
  };
  return {
    bucket: bucket as R2Bucket,
    checkpoint: () => checkpoint,
    deleteCalls,
    listCursors,
  };
}

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
  await files.delete(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY);
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

  it('500件を1回で処理し、R2空pageではD1をdue読取・集合更新の2 statementsに収める', async () => {
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<500)
         INSERT INTO improvement_requests
           (id,user_id,title,body,route,status,screenshot_key,done_at,created_at,updated_at)
         SELECT printf('bulk-%03d',n),'default','架空','架空','/','done',
                printf('improvements/default/bulk-%03d.jpg',n),
                '2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'
           FROM seq`,
      )
      .run();
    let statements = 0;
    const countedDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare')
          return (query: string) => {
            const statement = database.prepare(query);
            const count = <T extends (...args: never[]) => unknown>(fn: T): T =>
              ((...args: never[]) => {
                statements += 1;
                return fn(...args);
              }) as T;
            return new Proxy(statement, {
              get(target, member, statementReceiver) {
                if (member === 'bind')
                  return (...values: unknown[]) =>
                    new Proxy(target.bind(...values), {
                      get(bound, boundMember, boundReceiver) {
                        const value = Reflect.get(bound, boundMember, boundReceiver);
                        if (boundMember === 'all' || boundMember === 'run' || boundMember === 'raw')
                          return count(value.bind(bound));
                        return typeof value === 'function' ? value.bind(bound) : value;
                      },
                    });
                const value = Reflect.get(target, member, statementReceiver);
                if (member === 'all' || member === 'run' || member === 'raw')
                  return count(value.bind(target));
                return typeof value === 'function' ? value.bind(target) : value;
              },
            });
          };
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;
    const partialFiles: Partial<R2Bucket> = {
      delete: () => Promise.resolve(),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve({ objects: [], truncated: false, delimitedPrefixes: [] }),
    };
    const filesWithoutObjects = partialFiles as R2Bucket;

    const result = await runImprovementRetention({ DB: countedDb, FILES: filesWithoutObjects }, NOW);
    expect(result).toEqual({
      selected: 500,
      purged: 500,
      failed: 0,
      orphans: 0,
      orphanScanned: 0,
      orphanDeferredRecent: 0,
      orphanHasMore: false,
      orphanCycleCompleted: true,
    });
    expect(statements).toBe(2);
    expect(
      await d1
        .prepare('SELECT count(*) AS n FROM improvement_requests WHERE purged_at IS NOT NULL')
        .first<number>('n'),
    ).toBe(500);
  });

  it('live keyが1001件を超え300件のR2 page順がD1と異なっても正規objectを孤児として消さない', async () => {
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<1001)
         INSERT INTO improvement_requests
           (id,user_id,title,body,route,status,screenshot_key,created_at,updated_at)
         SELECT printf('live-%04d',n),'default','架空','架空','/','open',
                printf('improvements/default/live-%04d.jpg',n),
                '2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'
           FROM seq`,
      )
      .run();
    const deleted: string[] = [];
    const listed = Array.from({ length: IMPROVEMENT_ORPHAN_SCAN_LIMIT }, (_, index) => {
      const n = 1001 - index;
      const object: Partial<R2Object> = {
        key: `improvements/default/live-${String(n).padStart(4, '0')}.jpg`,
        uploaded: new Date(0),
      };
      return object as R2Object;
    });
    let requestedLimit: number | undefined;
    const partialFiles: Partial<R2Bucket> = {
      get: () => Promise.resolve(null),
      put: async (key) => r2Object(key),
      delete: async (key) => {
        deleted.push(...(Array.isArray(key) ? key : [key]));
      },
      list: async (options) => {
        requestedLimit = options?.limit;
        return {
          objects: listed,
          truncated: true,
          cursor: 'synthetic-next',
          delimitedPrefixes: [],
        };
      },
    };

    const result = await runImprovementRetention({ DB: d1, FILES: partialFiles as R2Bucket }, NOW);
    expect(result).toEqual({
      selected: 0,
      purged: 0,
      failed: 0,
      orphans: 0,
      orphanScanned: IMPROVEMENT_ORPHAN_SCAN_LIMIT,
      orphanDeferredRecent: 0,
      orphanHasMore: true,
      orphanCycleCompleted: false,
    });
    expect(deleted).toEqual([]);
    expect(requestedLimit).toBe(IMPROVEMENT_ORPHAN_SCAN_LIMIT);
    expect(listed.some((object) => object.key.endsWith('live-1001.jpg'))).toBe(true);
  });

  it('最大300件の1024-byte制御文字keyでもJSON bindを2MB未満に保つ', () => {
    const keys = Array.from({ length: IMPROVEMENT_ORPHAN_SCAN_LIMIT }, () => '\u0000'.repeat(1024));
    const serialized = serializeImprovementOrphanLookupKeys(keys);
    const bytes = new TextEncoder().encode(serialized).byteLength;
    expect(bytes).toBe(1_844_101);
    expect(bytes).toBeLessThan(IMPROVEMENT_ORPHAN_LOOKUP_MAX_BYTES);
  });

  it('R2が上限を超えるpageを返して2MB以上になっても、D1照合・R2削除前にfail closedする', async () => {
    const listed = Array.from({ length: 330 }, (_, index) => {
      const label = `improvements/${String(index).padStart(3, '0')}`;
      const object: Partial<R2Object> = {
        key: `${label}${'\u0000'.repeat(1024 - label.length)}`,
        uploaded: new Date(0),
      };
      return object as R2Object;
    });
    expect(
      new TextEncoder().encode(JSON.stringify(listed.map((object) => object.key))).byteLength,
    ).toBeGreaterThan(IMPROVEMENT_ORPHAN_LOOKUP_MAX_BYTES);
    let orphanLookups = 0;
    const guardedDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare')
          return (query: string) => {
            if (query.includes('WHERE screenshot_key IN')) orphanLookups += 1;
            return database.prepare(query);
          };
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;
    let requestedLimit: number | undefined;
    const deleted: string[] = [];
    const partialFiles: Partial<R2Bucket> = {
      get: () => Promise.resolve(null),
      list: async (options) => {
        requestedLimit = options?.limit;
        return { objects: listed, truncated: false, delimitedPrefixes: [] };
      },
      delete: async (key) => {
        deleted.push(...(Array.isArray(key) ? key : [key]));
      },
    };

    await expect(
      runImprovementRetention({ DB: guardedDb, FILES: partialFiles as R2Bucket }, NOW),
    ).rejects.toThrow('improvement_orphan_lookup_payload_too_large');
    expect(requestedLimit).toBe(IMPROVEMENT_ORPHAN_SCAN_LIMIT);
    expect(orphanLookups).toBe(0);
    expect(deleted).toEqual([]);
  });

  it('先頭300件がliveでもcheckpointから次pageへ進み、古い孤児だけを一括削除して末尾でresetする', async () => {
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<300)
         INSERT INTO improvement_requests
           (id,user_id,title,body,route,status,screenshot_key,created_at,updated_at)
         SELECT printf('page-live-%03d',n),'default','架空','架空','/','open',
                printf('improvements/default/page-live-%03d.jpg',n),
                '2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z'
           FROM seq`,
      )
      .run();
    const firstPage = Array.from({ length: IMPROVEMENT_ORPHAN_SCAN_LIMIT }, (_, index) =>
      r2Object(`improvements/default/page-live-${String(index + 1).padStart(3, '0')}.jpg`),
    );
    const oldOrphan = 'improvements/default/orphan-old.jpg';
    const recentOrphan = 'improvements/default/orphan-recent.jpg';
    const pages = new Map<string, R2Objects>([
      [
        '',
        {
          objects: firstPage,
          truncated: true,
          cursor: 'synthetic-page-2',
          delimitedPrefixes: [],
        },
      ],
      [
        'synthetic-page-2',
        {
          objects: [r2Object(oldOrphan), r2Object(recentOrphan, new Date(Date.parse(NOW) - 1_000))],
          truncated: false,
          delimitedPrefixes: [],
        },
      ],
    ]);
    const synthetic = pagedFiles(pages);

    expect(await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW)).toMatchObject({
      orphans: 0,
      orphanScanned: 300,
      orphanDeferredRecent: 0,
      orphanHasMore: true,
      orphanCycleCompleted: false,
    });
    expect(synthetic.checkpoint()).not.toBeNull();

    expect(await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW)).toMatchObject({
      orphans: 1,
      orphanScanned: 2,
      orphanDeferredRecent: 1,
      orphanHasMore: false,
      orphanCycleCompleted: true,
    });
    expect(synthetic.checkpoint()).toBeNull();
    expect(synthetic.deleteCalls).toContainEqual([oldOrphan]);

    await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW);
    expect(synthetic.listCursors).toEqual([undefined, 'synthetic-page-2', undefined]);
  });

  it('次pageのD1照合が失敗したらcheckpointを進めず、同じcursorから冪等再試行する', async () => {
    const pages = new Map<string, R2Objects>([
      ['', { objects: [], truncated: true, cursor: 'synthetic-retry-page', delimitedPrefixes: [] }],
      [
        'synthetic-retry-page',
        {
          objects: [r2Object('improvements/default/retry-orphan.jpg')],
          truncated: false,
          delimitedPrefixes: [],
        },
      ],
    ]);
    const synthetic = pagedFiles(pages);
    await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW);
    const failingDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare')
          return (query: string) => {
            if (query.includes('WHERE screenshot_key IN')) throw new Error('synthetic lookup failure');
            return database.prepare(query);
          };
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;

    await expect(runImprovementRetention({ DB: failingDb, FILES: synthetic.bucket }, NOW)).rejects.toThrow(
      'synthetic lookup failure',
    );
    expect(synthetic.checkpoint()).not.toBeNull();

    await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW);
    expect(synthetic.listCursors).toEqual([undefined, 'synthetic-retry-page', 'synthetic-retry-page']);
    expect(synthetic.checkpoint()).toBeNull();
  });

  it('R2孤児削除が失敗したらcheckpointを進めず、同じcursorから再試行する', async () => {
    const cursor = 'synthetic-delete-retry-page';
    const orphan = 'improvements/default/delete-retry-orphan.jpg';
    const pages = new Map<string, R2Objects>([
      [cursor, { objects: [r2Object(orphan)], truncated: false, delimitedPrefixes: [] }],
    ]);
    const synthetic = pagedFiles(pages, {
      checkpoint: JSON.stringify({ version: 1, cursor }),
      failDeleteOnce: true,
    });

    await expect(runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW)).rejects.toThrow(
      'synthetic orphan delete failure',
    );
    expect(synthetic.checkpoint()).not.toBeNull();

    await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW);
    expect(synthetic.listCursors).toEqual([cursor, cursor]);
    expect(synthetic.checkpoint()).toBeNull();
    expect(synthetic.deleteCalls).toContainEqual([orphan]);
  });

  it.each([
    { label: '初回page', checkpoint: undefined, expectedCursor: undefined },
    {
      label: '継続page',
      checkpoint: JSON.stringify({ version: 1, cursor: 'synthetic-old-page' }),
      expectedCursor: 'synthetic-old-page',
    },
  ])('checkpoint putが失敗したら$labelの元cursorから再試行する', async ({ checkpoint, expectedCursor }) => {
    const pages = new Map<string, R2Objects>([
      [
        expectedCursor ?? '',
        { objects: [], truncated: true, cursor: 'synthetic-next-page', delimitedPrefixes: [] },
      ],
    ]);
    const synthetic = pagedFiles(pages, { checkpoint, failPutOnce: true });

    await expect(runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW)).rejects.toThrow(
      'synthetic checkpoint put failure',
    );
    await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW);

    expect(synthetic.listCursors).toEqual([expectedCursor, expectedCursor]);
    expect(synthetic.checkpoint()).not.toBeNull();
  });

  it.each([
    { label: 'invalid JSON', checkpoint: '{' },
    { label: '未対応version', checkpoint: JSON.stringify({ version: 2, cursor: 'synthetic' }) },
    { label: 'empty cursor', checkpoint: JSON.stringify({ version: 1, cursor: '' }) },
    {
      label: 'oversize',
      checkpoint: JSON.stringify({ version: 1, cursor: 'synthetic' }),
      checkpointSize: 65 * 1024,
    },
  ])('$label checkpointはlist前にfail closedする', async ({ checkpoint, checkpointSize }) => {
    const synthetic = pagedFiles(new Map(), { checkpoint, checkpointSize });

    await expect(runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW)).rejects.toThrow(
      'invalid_improvement_orphan_checkpoint',
    );
    expect(synthetic.listCursors).toEqual([]);
    expect(synthetic.deleteCalls).toEqual([]);
  });

  it('注入時刻からちょうど5分の孤児は削除し、1ms新しい孤児は次回へ送る', async () => {
    const boundary = 'improvements/default/boundary-orphan.jpg';
    const recent = 'improvements/default/recent-orphan.jpg';
    const pages = new Map<string, R2Objects>([
      [
        '',
        {
          objects: [
            r2Object(boundary, new Date(Date.parse(NOW) - IMPROVEMENT_ORPHAN_GRACE_MS)),
            r2Object(recent, new Date(Date.parse(NOW) - IMPROVEMENT_ORPHAN_GRACE_MS + 1)),
          ],
          truncated: false,
          delimitedPrefixes: [],
        },
      ],
    ]);
    const synthetic = pagedFiles(pages);

    const result = await runImprovementRetention({ DB: d1, FILES: synthetic.bucket }, NOW);
    expect(result).toMatchObject({
      orphans: 1,
      orphanScanned: 2,
      orphanDeferredRecent: 1,
      orphanHasMore: false,
      orphanCycleCompleted: true,
    });
    expect(synthetic.deleteCalls).toContainEqual([boundary]);
    expect(synthetic.deleteCalls.flat()).not.toContain(recent);
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
