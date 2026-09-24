/**
 * 夜間バックアップの一覧・比較・設定だけの復元 (GET /api/backups・compare・restore) と
 * nightlyBackup (scheduled) の結合テスト。
 *
 * 契約の正本は `specs/spec-settings-screen.md` の AT-16。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の夜間バックアップは customMetadata を持たず、失敗の回を残さず、退避 (pre-restore/) を消さない。
 * /api/backups の比較・設定だけの復元の経路も無い。
 *
 * 実データを使わず、専用のインメモリ D1・R2 だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TENANT_ID } from '../src/auth.js';
import { loginForTest } from '../src/auth.test-support.js';
import { app, jstDate, nightlyBackup } from '../src/index.js';
import { splitMigrationStatements } from '../src/migration-test-support.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let miniflare: Miniflare;
let database: D1Database;
let files: R2Bucket;
let cookie: string;

/** JST 2026-09-22 02:00 (夜間バックアップの時刻) */
const NOW = Date.parse('2026-09-21T17:00:00.000Z');
const TODAY = '2026-09-22';

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const env = () => ({ ...auth, DB: database, FILES: files });

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

// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
const json = async (res: Response): Promise<any> => res.json();

const screen = async () => json(await call('/api/settings/screen'));

const rule = (ruleId: string, raw: string, norm: string, kind = 'account', enabled = true) => ({
  ruleId,
  kind,
  raw,
  norm,
  enabled,
});

const listKeys = async (prefix = 'backups/') =>
  (await files.list({ prefix })).objects.map((o) => o.key).sort();

const count = async (table: string) =>
  (
    await database
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`)
      .bind(TENANT_ID)
      .first<{ n: number }>()
  )?.n;

const insertDeal = (memo: string) =>
  database
    .prepare(
      `INSERT INTO freee_deals (user_id, month, date, io, partner, account_raw, account_norm, amount, memo)
       VALUES (?, '2026-08', '2026-08-01', 'expense', 'x', '旅費', '交通費', 500, ?)`,
    )
    .bind(TENANT_ID, memo)
    .run();

/** 本文の put だけを失敗させる R2 (失敗の印 *.failed.json は置ける) */
function failingBucket(bucket: R2Bucket): R2Bucket {
  return new Proxy(bucket, {
    get(target, key) {
      if (key === 'put')
        return (k: string, ...rest: unknown[]) => {
          if (!k.endsWith('.failed.json')) return Promise.reject(new Error('r2 down'));
          return (target.put as (...a: unknown[]) => unknown)(k, ...rest);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const saveSettings = async (body: Record<string, unknown>) => {
  const base = (await screen()).savedAt;
  const res = await send('PUT', '/api/settings/screen', { baseSavedAt: base, ...body });
  expect(res.status).toBe(200);
  return json(res);
};

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'settings-backups',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  files = (await miniflare.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database, FILES: files });
}, 30_000);

beforeEach(async () => {
  for (const table of [
    'settings_norm_rules',
    'settings_cash_overrides',
    'settings_change_log',
    'owner_labels',
    'analysis_settings',
    'account_norm_map',
    'cash_overrides',
    'freee_deals',
  ])
    await database.prepare(`DELETE FROM ${table}`).run();
  for (const key of await listKeys()) await files.delete(key);
});

afterAll(async () => {
  await miniflare?.dispose();
});

describe('AT-16 夜間バックアップ (scheduled)', () => {
  it('JST の日付のキーに、状態・メモ・要約・形式の版つきで置く', async () => {
    expect(jstDate(NOW)).toBe(TODAY);
    await saveSettings({ normRules: [rule('r1', '旅費', '交通費')], statMinMonths: 9 });

    const result = await nightlyBackup({ DB: database, FILES: files }, NOW);
    expect(result).toEqual({ stored: 1, deleted: 0 });
    const head = await files.head(`backups/${TODAY}.json`);
    expect(head?.customMetadata).toMatchObject({
      status: 'success',
      memo: '自動バックアップ',
      formatVersion: '1',
    });
    expect(JSON.parse(head?.customMetadata?.summary ?? 'null')).toEqual({
      normRules: 1,
      ownerLabelsSet: false,
      statMinMonths: 9,
      cashOverrides: 0,
    });

    const list = await json(await call('/api/backups'));
    expect(list.backups).toHaveLength(1);
    expect(list.backups[0]).toMatchObject({
      date: TODAY,
      status: 'success',
      memo: '自動バックアップ',
      formatVersion: '1',
      latest: true,
      reason: null,
      summary: { normRules: 1, statMinMonths: 9 },
    });
    expect(list.backups[0].size).toBeGreaterThan(0);
  });

  it('本文を置けなかった回は失敗の印を残し、一覧に失敗として出す (最後に throw する)', async () => {
    await expect(nightlyBackup({ DB: database, FILES: failingBucket(files) }, NOW)).rejects.toThrow();
    expect(await listKeys()).toEqual([`backups/${TODAY}.failed.json`]);

    const list = await json(await call('/api/backups'));
    expect(list.backups).toEqual([
      expect.objectContaining({
        date: TODAY,
        status: 'failed',
        size: null,
        summary: null,
        latest: false,
        reason: 'put_failed',
      }),
    ]);

    // 同じ日に成功の回があれば、成功を採る
    await nightlyBackup({ DB: database, FILES: files }, NOW);
    const again = await json(await call('/api/backups'));
    expect(again.backups).toEqual([
      expect.objectContaining({ date: TODAY, status: 'success', latest: true }),
    ]);
  });

  it('30 日より古い回・失敗の印・退避を消し、境界の日と新しい回は残す', async () => {
    // cutoff = jstDate(NOW - 30日) = 2026-08-23
    const old = [
      'backups/2026-08-01.json',
      'backups/2026-08-22.json',
      'backups/2026-08-20.failed.json',
      'backups/pre-restore/2026-08-10T03-00-00-000Z.json',
    ];
    const kept = [
      'backups/2026-08-23.json',
      'backups/2026-09-01.json',
      'backups/pre-restore/2026-09-20T03-00-00-000Z.json',
    ];
    for (const key of [...old, ...kept]) await files.put(key, '{}');

    const result = await nightlyBackup({ DB: database, FILES: files }, NOW);
    expect(result).toEqual({ stored: 1, deleted: old.length });
    expect(await listKeys()).toEqual([...kept, `backups/${TODAY}.json`].sort());

    // 一覧は退避を出さず、日付の新しい順で、最新の成功だけが latest
    const list = await json(await call('/api/backups'));
    expect(list.backups.map((b: { date: string; latest: boolean }) => [b.date, b.latest])).toEqual([
      [TODAY, true],
      ['2026-09-01', false],
      ['2026-08-23', false],
    ]);
  });
});

describe('AT-16 バックアップとの比較と設定だけの復元', () => {
  it('compare は現在との差分を返し、復元は設定だけを戻す (取引は変えない)', async () => {
    await insertDeal('backup前');
    await saveSettings({
      normRules: [rule('r1', '旅費', '交通費'), rule('r2', 'Amazon', '消耗品', 'vendor')],
      statMinMonths: 9,
      cashOverrides: [{ kind: 'payment', amount: 30000, scope: 'all', month: null, memo: '家賃' }],
    });
    await nightlyBackup({ DB: database, FILES: files }, NOW);
    const backedUp = await screen();

    // バックアップの後に設定と取引を変える
    await insertDeal('backup後');
    const changed = await saveSettings({
      normRules: [rule('r1', '旅費', '旅費交通費')],
      statMinMonths: 12,
      cashOverrides: [],
    });

    const compare = await json(await call(`/api/backups/${TODAY}/compare`));
    expect(compare.date).toBe(TODAY);
    expect(compare.revision).toBe(changed.savedAt);
    expect(compare.diff.statMinMonths).toEqual({ before: 12, after: 9 });
    expect(compare.diff.normRules.added.count).toBe(1);
    expect(compare.diff.normRules.changed.count).toBe(1);
    expect(compare.diff.cashOverrides.added.count).toBe(1);

    const preview = await json(await send('POST', `/api/backups/${TODAY}/restore/preview`, {}));
    expect(preview).toEqual({ valid: true, diff: compare.diff, revision: changed.savedAt });

    // 古い revision は 409 で、何も変えず退避もしない
    const stale = await send('POST', `/api/backups/${TODAY}/restore`, {
      baseSavedAt: '2000-01-01T00:00:00.000Z',
    });
    expect(stale.status).toBe(409);
    expect(await listKeys('backups/pre-restore/')).toEqual([]);

    const res = await send('POST', `/api/backups/${TODAY}/restore`, { baseSavedAt: preview.revision });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ ok: true, changes: compare.diff.total, recomputed: true });
    expect(await listKeys('backups/pre-restore/')).toEqual([body.preRestoreKey]);

    const after = await screen();
    const pick = (v: typeof after) => ({
      normRules: v.normRules.map(({ ruleId, kind, raw, norm, order, enabled }: (typeof v.normRules)[0]) => ({
        ruleId,
        kind,
        raw,
        norm,
        order,
        enabled,
      })),
      statMinMonths: v.statMinMonths,
      cashOverrides: v.cashOverrides.map(
        ({ kind, amount, scope, month, memo }: (typeof v.cashOverrides)[0]) => ({
          kind,
          amount,
          scope,
          month,
          memo,
        }),
      ),
    });
    expect(pick(after)).toEqual(pick(backedUp));
    expect(after.normRules.every((r: { updatedBy: string }) => r.updatedBy === 'システム')).toBe(true);
    // 全データの復元ではないので、バックアップ後に増えた取引は残る
    expect(await count('freee_deals')).toBe(2);
  });

  it('古い形の本文 (normMap・月ごとの cashOverride) も比べられる', async () => {
    await files.put(
      'backups/2026-09-01.json',
      JSON.stringify({
        normMap: { 旅費: '交通費' },
        cashOverride: { '2026-04': { revenue: 0, expense: 500 } },
      }),
    );
    const compare = await json(await call('/api/backups/2026-09-01/compare'));
    expect(compare.diff.normRules.added.count).toBe(1);
    expect(compare.diff.cashOverrides.added.count).toBe(1);
    expect(compare.diff.statMinMonths).toBeNull();
  });

  it('無い日は 404、読めない本文は 422、日付の形が違えば 400。どれも何も変えない', async () => {
    await files.put('backups/2026-09-02.json', 'not json');
    await files.put('backups/2026-09-03.json', JSON.stringify({ analysisSettings: { statMinMonths: 999 } }));

    expect((await call('/api/backups/2026-09-01/compare')).status).toBe(404);
    expect((await json(await call('/api/backups/2026-09-01'))).error.code).toBe('backup_not_found');
    expect((await call('/api/backups/2026-09-02/compare')).status).toBe(422);
    const invalid = await call('/api/backups/2026-09-03/compare');
    expect(invalid.status).toBe(422);
    expect((await json(invalid)).error.code).toBe('backup_settings_unreadable');
    expect((await call('/api/backups/..%2Fsecret/compare')).status).toBe(400);
    expect((await call('/api/backups/2026-9-1')).status).toBe(400);

    const restore = await send('POST', '/api/backups/2026-09-02/restore', { baseSavedAt: null });
    expect(restore.status).toBe(422);
    expect(
      (await send('POST', '/api/backups/2026-09-01/restore', { baseSavedAt: null, extra: 1 })).status,
    ).toBe(400);
    expect(
      (await send('POST', '/api/backups/2026-09-01/restore', { baseSavedAt: 'x'.repeat(2000) })).status,
    ).toBe(413);
    expect(await count('settings_change_log')).toBe(0);
    expect(await listKeys('backups/pre-restore/')).toEqual([]);
  });

  it('未認証は 401', async () => {
    for (const [method, path] of [
      ['GET', '/api/backups'],
      ['GET', `/api/backups/${TODAY}`],
      ['GET', `/api/backups/${TODAY}/compare`],
      ['POST', `/api/backups/${TODAY}/restore/preview`],
      ['POST', `/api/backups/${TODAY}/restore`],
    ] as const) {
      const res = method === 'GET' ? await call(path, {}, false) : await send(method, path, {}, false);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});
