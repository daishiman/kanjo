/**
 * 勘定科目の対応表の API (GET・POST /api/settings/tax-account-map、DELETE …/:categoryBig) の結合テスト。
 *
 * 契約の正本は `specs/spec-classify-bulk-save.md` の「API: 勘定科目の対応表」・FR-17・BR-09・AC-16・AC-25。
 * migration (0059・0060) を実際に流した D1 に対して、読み出し・追加・削除・変更履歴・利用者ごとの分離を固定する。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前は routes/tax-account-map.ts が無く、どの要求も 404 になる。tax_account_map の表と
 * 変更履歴の種類 tax_account_map (0059・0060) も無い。
 *
 * 実データを使わず、専用のインメモリ D1・R2 だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TAX_ACCOUNT_MAP,
  TAX_ACCOUNT_MAP_ROWS_MAX,
  settingsActorFromEmail,
  sortTaxAccountMap,
} from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TENANT_ID } from '../src/auth.js';
import { TEST_ADMIN, loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { splitMigrationStatements } from '../src/migration-test-support.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};
const PATH = '/api/settings/tax-account-map';
const OTHER = 'synthetic-other';

let miniflare: Miniflare;
let database: D1Database;
let files: R2Bucket;
let cookie: string;
/** 要求ごとの D1 batch の statement 数 (追加・削除が 1 回の batch で書くことを見る) */
let batchSizes: number[] = [];
/** migration 直後の対応表と変更履歴。各テストの前にこの状態へ戻す */
let seededMap: Record<string, unknown>[];
let seededLog: Record<string, unknown>[];

const MAP_COLUMNS = 'user_id, category_big, tax_account, created_at, updated_at';
const LOG_COLUMNS = 'user_id, seq, target, target_key, before, after, changed_by, changed_at, origin';

function countingDatabase(db: D1Database): D1Database {
  return new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return (statements: D1PreparedStatement[]) => {
          batchSizes.push(statements.length);
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const env = () => ({ ...auth, DB: countingDatabase(database), FILES: files });

const call = (path: string, init: RequestInit = {}, withCookie = true) =>
  app.request(
    path,
    { ...init, headers: { ...(withCookie ? { cookie } : {}), ...(init.headers ?? {}) } },
    env(),
  );

const send = (method: string, path: string, body: unknown, withCookie = true) =>
  call(
    path,
    {
      method,
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    withCookie,
  );

const add = (body: unknown) => send('POST', PATH, body);
const remove = (categoryBig: string) =>
  call(`${PATH}/${encodeURIComponent(categoryBig)}`, { method: 'DELETE' });

// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
const json = async (res: Response): Promise<any> => res.json();

// biome-ignore lint/suspicious/noExplicitAny: D1 の行をそのまま比べる
const rows = async (sql: string, ...binds: unknown[]): Promise<any[]> =>
  (
    await database
      .prepare(sql)
      .bind(...binds)
      .all()
  ).results;

const mapRows = (userId = TENANT_ID) =>
  rows(`SELECT ${MAP_COLUMNS} FROM tax_account_map WHERE user_id=? ORDER BY category_big`, userId);
const logRows = (userId = TENANT_ID) =>
  rows(`SELECT ${LOG_COLUMNS} FROM settings_change_log WHERE user_id=? ORDER BY seq`, userId);
const pairs = (list: readonly { category_big: string; tax_account: string }[]) =>
  list.map((r) => ({ categoryBig: r.category_big, taxAccount: r.tax_account }));

async function restoreRows(table: string, columns: string, list: readonly Record<string, unknown>[]) {
  await database.prepare(`DELETE FROM ${table}`).run();
  const names = columns.split(', ');
  for (const row of list)
    await database
      .prepare(`INSERT INTO ${table} (${columns}) VALUES (${names.map(() => '?').join(', ')})`)
      .bind(...names.map((n) => row[n] ?? null))
      .run();
}

/** 他の利用者の行。同じ大項目と、その利用者だけの大項目を持つ */
async function seedOtherUser() {
  await database
    .prepare(
      `INSERT INTO tax_account_map (${MAP_COLUMNS}) VALUES
         (?, '通信費', '雑費', 't', 't'),
         (?, '他人の項目', '雑費', 't', 't')`,
    )
    .bind(OTHER, OTHER)
    .run();
}

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'tax-account-map',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  files = (await miniflare.getR2Bucket('FILES')) as unknown as R2Bucket;
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames)
    for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')))
      await database.prepare(sql).run();
  await recordTestMigrationHead(database, filenames);
  cookie = await loginForTest(app, { ...auth, DB: database, FILES: files });
  seededMap = await rows(`SELECT ${MAP_COLUMNS} FROM tax_account_map ORDER BY user_id, category_big`);
  seededLog = await rows(`SELECT ${LOG_COLUMNS} FROM settings_change_log ORDER BY user_id, seq`);
}, 30_000);

beforeEach(async () => {
  await restoreRows('tax_account_map', MAP_COLUMNS, seededMap);
  await restoreRows('settings_change_log', LOG_COLUMNS, seededLog);
  await database.prepare('DELETE FROM import_active_targets').run();
  batchSizes = [];
});

afterAll(async () => {
  await miniflare?.dispose();
});

describe('読み出し (GET)', () => {
  it('migration の初期の 5 行を名前順で返し、他の利用者の行を含まない', async () => {
    await seedOtherUser();
    const res = await call(PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await json(res);
    expect(body).toEqual({ rows: sortTaxAccountMap(DEFAULT_TAX_ACCOUNT_MAP) });
    expect(body.rows.some((r: { categoryBig: string }) => r.categoryBig === '他人の項目')).toBe(false);
  });

  it('未認証は読み出し・追加・削除のどれも 401 で、何も書かない', async () => {
    const before = await mapRows();
    expect((await call(PATH, {}, false)).status).toBe(401);
    expect((await send('POST', PATH, { categoryBig: '消耗品', taxAccount: '消耗品費' }, false)).status).toBe(
      401,
    );
    expect((await call(`${PATH}/${encodeURIComponent('通信費')}`, { method: 'DELETE' }, false)).status).toBe(
      401,
    );
    expect(await mapRows()).toEqual(before);
  });
});

describe('追加 (POST)', () => {
  it('前後の空白を落として 1 行を足し、行・変更履歴・JSON snapshot の無効化を 1 回の batch で書く', async () => {
    await database
      .prepare(
        "INSERT INTO import_active_targets (user_id, target_key, content_hash, import_id, updated_at) VALUES (?, 'json:global', 'h', 1, '2026-01-01T00:00:00Z')",
      )
      .bind(TENANT_ID)
      .run();
    const logBefore = await logRows();
    const revisionBefore = logBefore
      .map((r) => r.changed_at as string)
      .sort()
      .at(-1) as string;

    const res = await add({ categoryBig: '  消耗品 ', taxAccount: '消耗品費' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = await json(res);
    const expected = sortTaxAccountMap([
      ...DEFAULT_TAX_ACCOUNT_MAP,
      { categoryBig: '消耗品', taxAccount: '消耗品費' },
    ]);
    expect(body).toEqual({ rows: expected });
    expect(pairs(await mapRows())).toEqual(expected);

    // 書き込みは 1 回の batch (行・履歴・無効化・応答の読み出し)。その前に読み出しの batch が 1 回。
    // さらに前の batch は canonicalMutationFence の lease の取得で、route の外の責務なので数えない
    expect(batchSizes.slice(-2)).toEqual([2, 4]);

    const added = (await mapRows()).find((r) => r.category_big === '消耗品');
    expect(added.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(added.updated_at).toBe(added.created_at);

    const logAfter = await logRows();
    expect(logAfter).toHaveLength(logBefore.length + 1);
    const entry = logAfter.at(-1);
    expect(entry).toMatchObject({
      seq: (logBefore.at(-1)?.seq as number) + 1,
      target: 'tax_account_map',
      target_key: '消耗品',
      before: null,
      changed_by: settingsActorFromEmail(TEST_ADMIN.email),
      changed_at: added.created_at,
      origin: 'screen',
    });
    expect(JSON.parse(entry.after)).toEqual({ categoryBig: '消耗品', taxAccount: '消耗品費' });
    // revision (変更履歴の最新時刻) は必ず進む
    expect(entry.changed_at > revisionBefore).toBe(true);

    const snapshot = await rows(
      "SELECT COUNT(*) AS n FROM import_active_targets WHERE user_id=? AND target_key='json:global'",
      TENANT_ID,
    );
    expect(snapshot[0].n).toBe(0);
  });

  it('同じ大項目の 2 行目は空白違いも含めて 400 duplicate_category で、行も履歴も増えない (送り直しで二重の行ができない)', async () => {
    const mapBefore = await mapRows();
    const logBefore = await logRows();
    for (const categoryBig of ['通信費', ' 通信費  ']) {
      const res = await add({ categoryBig, taxAccount: '雑費' });
      expect(res.status).toBe(400);
      expect((await json(res)).error.code).toBe('duplicate_category');
    }
    // 追加の送り直しも同じ 400 になる
    expect((await add({ categoryBig: '消耗品', taxAccount: '消耗品費' })).status).toBe(200);
    const again = await add({ categoryBig: '消耗品', taxAccount: '消耗品費' });
    expect(again.status).toBe(400);
    expect((await json(again)).error.code).toBe('duplicate_category');
    expect((await mapRows()).length).toBe(mapBefore.length + 1);
    expect((await logRows()).length).toBe(logBefore.length + 1);
  });

  it('一覧に無い対応先・予約の大項目・形の不正は 400 invalid_request で、何も書かない', async () => {
    const mapBefore = await mapRows();
    const logBefore = await logRows();
    const cases: Array<[unknown, Record<string, string> | undefined]> = [
      [{ categoryBig: '消耗品', taxAccount: '存在しない科目' }, { taxAccount: 'not_in_list' }],
      [{ categoryBig: 'カテゴリなし', taxAccount: '雑費' }, { categoryBig: 'reserved' }],
      [{ categoryBig: 'あ'.repeat(61), taxAccount: '雑費' }, { categoryBig: 'too_long' }],
      [{ categoryBig: '消耗\u0007品', taxAccount: '雑費' }, { categoryBig: 'control_char' }],
      [{ categoryBig: '   ', taxAccount: '雑費' }, { categoryBig: 'required' }],
      [{ categoryBig: 1, taxAccount: '雑費' }, { categoryBig: 'invalid_type' }],
      [{ categoryBig: '消耗品' }, { taxAccount: 'invalid_type' }],
      // 形の不正 (知らない欄・JSON でない本文) は欄を名指ししない
      [{ categoryBig: '消耗品', taxAccount: '消耗品費', extra: 1 }, undefined],
      ['not json', undefined],
      [[{ categoryBig: '消耗品', taxAccount: '消耗品費' }], undefined],
    ];
    for (const [body, fields] of cases) {
      const res = await add(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      const error = (await json(res)).error;
      expect(error.code).toBe('invalid_request');
      expect(error.fields).toEqual(fields);
    }
    // 60 字ちょうどは受ける (上限の境界)
    expect((await add({ categoryBig: 'あ'.repeat(60), taxAccount: '雑費' })).status).toBe(200);
    expect((await mapRows()).length).toBe(mapBefore.length + 1);
    expect((await logRows()).length).toBe(logBefore.length + 1);
  });

  it(`対応表が ${TAX_ACCOUNT_MAP_ROWS_MAX} 行に達したら 400 too_many_rows で止める`, async () => {
    const filler = Array.from(
      { length: TAX_ACCOUNT_MAP_ROWS_MAX - DEFAULT_TAX_ACCOUNT_MAP.length - 1 },
      (_, i) => [`項目${String(i).padStart(3, '0')}`, '雑費', 't', 't'],
    );
    await database
      .prepare(
        `INSERT INTO tax_account_map (${MAP_COLUMNS})
         SELECT ?, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]')
         FROM json_each(?)`,
      )
      .bind(TENANT_ID, JSON.stringify(filler))
      .run();
    // 199 行 → 200 行目は足せる
    expect((await add({ categoryBig: '最後の行', taxAccount: '雑費' })).status).toBe(200);
    expect((await mapRows()).length).toBe(TAX_ACCOUNT_MAP_ROWS_MAX);
    const res = await add({ categoryBig: 'はみ出す行', taxAccount: '雑費' });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('too_many_rows');
    expect((await mapRows()).length).toBe(TAX_ACCOUNT_MAP_ROWS_MAX);
  });

  it('本文が 16KB を超えたら読む前に 413 で止める', async () => {
    const res = await add({ categoryBig: 'x'.repeat(17 * 1024), taxAccount: '雑費' });
    expect(res.status).toBe(413);
    expect((await json(res)).error.code).toBe('payload_too_large');
  });
});

describe('削除 (DELETE)', () => {
  it('URL エンコードした大項目で 1 行を消し、変更履歴に前の値が残る', async () => {
    // スラッシュ・百分率記号・中黒を含む大項目も 1 つの識別子として往復する
    expect((await add({ categoryBig: 'A/B 50%', taxAccount: '雑費' })).status).toBe(200);
    for (const [categoryBig, taxAccount] of [
      ['A/B 50%', '雑費'],
      ['水道・光熱費', '水道光熱費'],
    ] as const) {
      const logBefore = await logRows();
      batchSizes = [];
      const res = await remove(categoryBig);
      expect(res.status, categoryBig).toBe(200);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      const body = await json(res);
      expect(body.rows.some((r: { categoryBig: string }) => r.categoryBig === categoryBig)).toBe(false);
      expect(pairs(await mapRows())).toEqual(body.rows);
      expect(batchSizes.slice(-2)).toEqual([2, 4]);
      const logAfter = await logRows();
      expect(logAfter).toHaveLength(logBefore.length + 1);
      const entry = logAfter.at(-1);
      expect(entry).toMatchObject({
        target: 'tax_account_map',
        target_key: categoryBig,
        after: null,
        origin: 'screen',
      });
      expect(JSON.parse(entry.before)).toEqual({ categoryBig, taxAccount });
    }
    expect(pairs(await mapRows())).toEqual(
      sortTaxAccountMap(DEFAULT_TAX_ACCOUNT_MAP.filter((r) => r.categoryBig !== '水道・光熱費')),
    );
  });

  it('無い行と他の利用者の行は同じ 404 not_found で、存在を明かさず何も消さない (AC-25)', async () => {
    await seedOtherUser();
    const otherBefore = await mapRows(OTHER);
    const logBefore = await rows(`SELECT ${LOG_COLUMNS} FROM settings_change_log ORDER BY user_id, seq`);
    const missing = await remove('まったく無い項目');
    const others = await remove('他人の項目');
    expect(missing.status).toBe(404);
    expect(others.status).toBe(404);
    const missingBody = await json(missing);
    expect(missingBody.error.code).toBe('not_found');
    expect(await json(others)).toEqual(missingBody);
    expect(await mapRows(OTHER)).toEqual(otherBefore);
    expect(await rows(`SELECT ${LOG_COLUMNS} FROM settings_change_log ORDER BY user_id, seq`)).toEqual(
      logBefore,
    );

    // 同じ大項目を両方が持つときは、自分の行だけを消す
    expect((await remove('通信費')).status).toBe(200);
    expect(await mapRows(OTHER)).toEqual(otherBefore);
  });
});

describe('初期の行と利用者 (AC-16)', () => {
  it('消した行は戻らず、利用者を作っても対応表の行は増えない', async () => {
    expect((await remove('通信費')).status).toBe(200);
    const allBefore = await rows(`SELECT ${MAP_COLUMNS} FROM tax_account_map ORDER BY user_id, category_big`);

    const created = await send('POST', '/api/admin/users', {
      email: 'synthetic-member@example.test',
      role: 'member',
    });
    expect(created.status).toBe(201);

    expect(await rows(`SELECT ${MAP_COLUMNS} FROM tax_account_map ORDER BY user_id, category_big`)).toEqual(
      allBefore,
    );
    const body = await json(await call(PATH));
    expect(body.rows).toHaveLength(DEFAULT_TAX_ACCOUNT_MAP.length - 1);
    expect(body.rows.some((r: { categoryBig: string }) => r.categoryBig === '通信費')).toBe(false);
  });
});

describe('設定画面との関係', () => {
  it('対応表の変更は設定画面に映り、revision が進むので古い画面からの保存は 409 になる', async () => {
    const first = await json(await call('/api/settings/screen'));
    expect(first.taxAccountMap).toEqual(sortTaxAccountMap(DEFAULT_TAX_ACCOUNT_MAP));

    expect((await add({ categoryBig: '消耗品', taxAccount: '消耗品費' })).status).toBe(200);
    const second = await json(await call('/api/settings/screen'));
    expect(second.savedAt > first.savedAt).toBe(true);
    expect(second.taxAccountMap).toContainEqual({ categoryBig: '消耗品', taxAccount: '消耗品費' });

    const stale = await send('PUT', '/api/settings/screen', { baseSavedAt: first.savedAt, statMinMonths: 6 });
    expect(stale.status).toBe(409);
    const fresh = await send('PUT', '/api/settings/screen', {
      baseSavedAt: second.savedAt,
      statMinMonths: 6,
    });
    expect(fresh.status).toBe(200);
    // 4 種の保存は対応表を変えない
    expect((await json(await call(PATH))).rows).toContainEqual({
      categoryBig: '消耗品',
      taxAccount: '消耗品費',
    });
  });
});
