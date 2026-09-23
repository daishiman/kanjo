/**
 * 設定画面の API (GET/PUT /api/settings/screen・history・export・restore) の結合テスト。
 *
 * 契約の正本は `specs/spec-settings-screen.md` の AT-14・AT-15・AT-17・AT-18 と BR-22。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前は settings_norm_rules・settings_cash_overrides・settings_change_log (0052〜0054) も
 * 設定画面の経路も無く、どの要求も 404 になる。旧 PUT /api/settings は旧表にしか書かない。
 *
 * 実データを使わず、専用のインメモリ D1・R2 だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migratedNormRuleId } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TENANT_ID } from '../src/auth.js';
import { loginForTest } from '../src/auth.test-support.js';
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

let miniflare: Miniflare;
let database: D1Database;
let files: R2Bucket;
let cookie: string;
/** 要求ごとの D1 batch の statement 数 (D1 の 1 batch の上限を超えないことを見る) */
let batchSizes: number[] = [];

const migrationFiles = () =>
  readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

async function runMigrations(db: D1Database, filenames: readonly string[]): Promise<void> {
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await db.prepare(sql).run();
  }
}

/** batch の statement 数を記録する D1。他の呼び出しは本物へそのまま渡す */
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

// biome-ignore lint/suspicious/noExplicitAny: D1 の行をそのまま比べる
const rows = async (sql: string, ...binds: unknown[]): Promise<any[]> =>
  (
    await database
      .prepare(sql)
      .bind(...binds)
      .all()
  ).results;

const changeLog = () =>
  rows(
    'SELECT seq, target, target_key, before, after, changed_by, changed_at, origin FROM settings_change_log WHERE user_id=? ORDER BY seq',
    TENANT_ID,
  );

const count = async (table: string) =>
  ((await rows(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`, TENANT_ID))[0] as { n: number }).n;

const listKeys = async (prefix: string) => (await files.list({ prefix })).objects.map((o) => o.key);

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'settings-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  files = (await miniflare.getR2Bucket('FILES')) as unknown as R2Bucket;
  const filenames = migrationFiles();
  await runMigrations(database, filenames);
  await recordTestMigrationHead(database, filenames);
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
  for (const key of await listKeys('backups/')) await files.delete(key);
  batchSizes = [];
});

afterAll(async () => {
  await miniflare?.dispose();
});

describe('AT-14 保存の照合と変更履歴', () => {
  it('未保存の状態から baseSavedAt=null で保存でき、savedAt が revision になる', async () => {
    const before = await screen();
    expect(before.savedAt).toBeNull();

    const res = await send('PUT', '/api/settings/screen', {
      baseSavedAt: null,
      normRules: [rule('r1', '旅費', '交通費'), rule('r2', 'Amazon', '消耗品', 'vendor')],
      statMinMonths: 8,
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(true);
    expect(body.changes).toBe(3);
    expect(body.recomputed).toBe(true);

    const after = await screen();
    expect(after.savedAt).toBe(body.savedAt);
    expect(after.normRules.map((r: { ruleId: string; order: number }) => [r.ruleId, r.order])).toEqual([
      ['r1', 1],
      ['r2', 2],
    ]);
    expect(after.normRules[0].updatedBy).toBe('admin');
    expect(after.statMinMonths).toBe(8);
  });

  it('古い baseSavedAt の PUT は 409 で、何も書かない', async () => {
    const first = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: null,
        normRules: [rule('r1', '旅費', '交通費')],
      }),
    );
    const stale = first.savedAt;
    await send('PUT', '/api/settings/screen', {
      baseSavedAt: stale,
      normRules: [rule('r1', '旅費', '旅費交通費')],
    });
    const logBefore = await changeLog();
    const rulesBefore = await rows('SELECT * FROM settings_norm_rules ORDER BY rule_id');

    const res = await send('PUT', '/api/settings/screen', {
      baseSavedAt: stale,
      normRules: [rule('r1', '旅費', '上書き')],
      statMinMonths: 12,
    });
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({
      error: { code: 'settings_conflict', message: '他の画面で更新されました' },
    });
    expect(await changeLog()).toEqual(logBefore);
    expect(await rows('SELECT * FROM settings_norm_rules ORDER BY rule_id')).toEqual(rulesBefore);
    expect(await count('analysis_settings')).toBe(0);
  });

  it('変更履歴は追記だけで、既存の行は変わらない。history は直前の保存値を返す', async () => {
    const a = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: null,
        normRules: [rule('r1', '旅費', '交通費')],
      }),
    );
    const logA = await changeLog();
    expect(logA).toHaveLength(1);
    expect(logA[0]).toMatchObject({
      seq: 1,
      target: 'norm_rule',
      target_key: 'r1',
      before: null,
      origin: 'screen',
    });

    const b = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: a.savedAt,
        normRules: [rule('r1', '旅費', '旅費交通費', 'account', false)],
      }),
    );
    expect(b.savedAt > a.savedAt).toBe(true);
    const logB = await changeLog();
    expect(logB).toHaveLength(2);
    expect(logB[0]).toEqual(logA[0]);
    expect(logB[1]).toMatchObject({ seq: 2, target_key: 'r1', changed_by: 'admin', origin: 'screen' });

    const history = await json(await call('/api/settings/history?ruleId=r1'));
    expect(history).toEqual({
      ruleId: 'r1',
      previous: { kind: 'account', raw: '旅費', norm: '交通費', enabled: true, order: 1 },
      lastChangedAt: b.savedAt,
      lastChangedBy: 'admin',
    });
  });

  it('変わらない保存は 0 件で、revision を進めない', async () => {
    const a = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: null,
        normRules: [rule('r1', '旅費', '交通費')],
      }),
    );
    const res = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: a.savedAt,
        normRules: [rule('r1', '旅費', '交通費')],
      }),
    );
    expect(res).toEqual({ ok: true, savedAt: a.savedAt, changes: 0, recomputed: false });
    expect(await changeLog()).toHaveLength(1);
  });

  it('履歴の無い ruleId は 404、形の違う ruleId は 400', async () => {
    expect((await call('/api/settings/history?ruleId=nothing')).status).toBe(404);
    expect((await call('/api/settings/history?ruleId=%E6%97%85')).status).toBe(400);
    expect((await call('/api/settings/history')).status).toBe(400);
  });
});

describe('長い日本語の元の表記 (移行 id が 64 字を超える)', () => {
  const raw = '長い日本語の勘定科目名を十一字以上'; // 17 字 → 'm-' + 102 桁
  const ruleId = migratedNormRuleId(raw);

  it('移行 id のまま保存でき、history も引ける', async () => {
    expect(ruleId.length).toBeGreaterThan(64);
    const a = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: null,
        normRules: [rule(ruleId, raw, '雑費')],
      }),
    );
    expect(a.ok).toBe(true);
    const b = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: a.savedAt,
        normRules: [rule(ruleId, raw, '消耗品費')],
      }),
    );
    expect(b.changes).toBe(1);
    const history = await call(`/api/settings/history?ruleId=${ruleId}`);
    expect(history.status).toBe(200);
    expect((await json(history)).previous).toMatchObject({ raw, norm: '雑費' });
    expect((await screen()).normRules[0]).toMatchObject({ ruleId, raw, norm: '消耗品費', canUndo: true });
  });

  it('60 字の日本語 (移行 id 362 字) でも保存できる', async () => {
    const longest = 'あ'.repeat(60);
    const id = migratedNormRuleId(longest);
    expect(id).toHaveLength(2 + 60 * 3 * 2);
    const res = await send('PUT', '/api/settings/screen', {
      baseSavedAt: null,
      normRules: [rule(id, longest, '雑費')],
    });
    expect(res.status).toBe(200);
    expect((await call(`/api/settings/history?ruleId=${id}`)).status).toBe(200);
  });
});

describe('AT-15 設定ファイルの書き出しと復元', () => {
  const seed = async () =>
    json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: null,
        normRules: [rule('r1', '旅費', '交通費'), rule('r2', 'Amazon', '消耗品', 'vendor', false)],
        ownerLabels: { business: '事業', spouse: '妻', family: '子', unset: '未設定' },
        statMinMonths: 9,
        cashOverrides: [
          { kind: 'payment', amount: 30000, scope: 'all', month: null, memo: '家賃' },
          { kind: 'receipt', amount: 1000, scope: 'month', month: '2026-04', memo: '' },
        ],
      }),
    );

  it('書き出した JSON を復元すると設定が一致し、取引件数は変わらない。退避が 1 件増える', async () => {
    await database
      .prepare(
        `INSERT INTO freee_deals (user_id, month, date, io, partner, account_raw, account_norm, amount)
         VALUES (?, '2026-04', '2026-04-01', 'expense', 'x', '旅費', '交通費', 500)`,
      )
      .bind(TENANT_ID)
      .run();
    const saved = await seed();
    expect(saved.ok).toBe(true);

    const exported = await call('/api/settings/export');
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-disposition')).toMatch(/kanjo-settings-\d{4}-\d{2}-\d{2}\.json/);
    const file = await json(exported);
    expect(file).toMatchObject({ format: 'kanjo-settings', version: 1, statMinMonths: 9 });
    const stateBefore = await screen();

    // 別の値へ変えてから復元する
    const changed = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: saved.savedAt,
        normRules: [rule('r3', '会議費', '交際費')],
        statMinMonths: 3,
        cashOverrides: [],
      }),
    );
    const dealsBefore = await count('freee_deals');

    const preview = await json(await send('POST', '/api/settings/restore/preview', file));
    expect(preview.valid).toBe(true);
    expect(preview.revision).toBe(changed.savedAt);

    batchSizes = [];
    const restored = await send('POST', '/api/settings/restore', {
      baseSavedAt: preview.revision,
      settings: file,
    });
    expect(restored.status).toBe(200);
    const body = await json(restored);
    expect(body.ok).toBe(true);
    expect(body.preRestoreKey).toMatch(/^backups\/pre-restore\/[0-9TZ-]+\.json$/);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(49);

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
      ownerLabels: v.ownerLabels,
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
    expect(pick(after)).toEqual(pick(stateBefore));
    expect(await count('freee_deals')).toBe(dealsBefore);
    expect(dealsBefore).toBe(1);

    const preRestore = await listKeys('backups/pre-restore/');
    expect(preRestore).toEqual([body.preRestoreKey]);
    const escaped = (await (await files.get(body.preRestoreKey))?.json()) as { statMinMonths: number };
    expect(escaped.statMinMonths).toBe(3);

    const restoreLog = (await changeLog()).filter((r) => r.origin === 'restore');
    expect(restoreLog.length).toBe(body.changes);
    expect(restoreLog.every((r) => r.changed_by === 'system')).toBe(true);
  });

  it('形違い・版違い・256KB 超・古い revision は 4xx で、何も変えず退避もしない', async () => {
    const saved = await seed();
    const file = await json(await call('/api/settings/export'));
    const logBefore = await changeLog();
    const rulesBefore = await rows('SELECT * FROM settings_norm_rules ORDER BY rule_id');

    const cases: Array<[unknown, number, string | null]> = [
      [{ baseSavedAt: saved.savedAt, settings: { ...file, extra: 1 } }, 400, 'invalid_settings_file'],
      [
        { baseSavedAt: saved.savedAt, settings: { ...file, statMinMonths: 99 } },
        400,
        'invalid_settings_file',
      ],
      [
        { baseSavedAt: saved.savedAt, settings: { ...file, version: 2 } },
        400,
        'unsupported_settings_version',
      ],
      [{ baseSavedAt: saved.savedAt, settings: file, extra: true }, 400, 'invalid_settings_file'],
      [{ baseSavedAt: '2000-01-01T00:00:00.000Z', settings: file }, 409, 'settings_conflict'],
      ['{not json', 400, 'invalid_settings_file'],
    ];
    for (const [body, status, code] of cases) {
      const res = await send('POST', '/api/settings/restore', body);
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(status);
      if (code) expect((await json(res)).error.code).toBe(code);
    }

    const tooLarge = await send('POST', '/api/settings/restore', {
      baseSavedAt: saved.savedAt,
      settings: { ...file, padding: 'x'.repeat(256 * 1024) },
    });
    expect(tooLarge.status).toBe(413);
    expect((await json(tooLarge)).error.code).toBe('payload_too_large');
    expect(
      (await send('POST', '/api/settings/restore/preview', { ...file, padding: 'x'.repeat(256 * 1024) }))
        .status,
    ).toBe(413);
    expect((await send('POST', '/api/settings/restore/preview', { ...file, version: 0 })).status).toBe(400);

    expect(await changeLog()).toEqual(logBefore);
    expect(await rows('SELECT * FROM settings_norm_rules ORDER BY rule_id')).toEqual(rulesBefore);
    expect(await listKeys('backups/pre-restore/')).toEqual([]);
  });

  it('上限いっぱい (500 行・256KB 近く) の復元でも batch は 49 文以下', async () => {
    // 256KB に収まる範囲で、元の表記をできるだけ長くする (移行 id も長くなる)
    const build = (length: number) => ({
      format: 'kanjo-settings',
      version: 1,
      exportedAt: '2026-09-01T00:00:00.000Z',
      normRules: Array.from({ length: 500 }, (_, i) => {
        const raw = `${String(i).padStart(3, '0')}${'科'.repeat(length - 3)}`;
        return rule(migratedNormRuleId(raw), raw, '費'.repeat(60));
      }),
      ownerLabels: { business: '本人', spouse: 'パートナー', family: '子ども', unset: 'その他' },
      statMinMonths: 6,
      cashOverrides: [],
    });
    const size = (settings: unknown) =>
      new TextEncoder().encode(JSON.stringify({ baseSavedAt: null, settings })).byteLength;
    let length = 60;
    while (size(build(length)) > 256 * 1024) length -= 1;
    const settings = build(length);
    expect(size(settings)).toBeGreaterThan(200 * 1024);

    batchSizes = [];
    const res = await send('POST', '/api/settings/restore', { baseSavedAt: null, settings });
    expect(res.status).toBe(200);
    expect(await count('settings_norm_rules')).toBe(500);
    expect(batchSizes.length).toBeGreaterThan(0);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(49);
  });
});

describe('AT-17 migration 0052〜0054 は追加だけで、旧表の値を同じ意味で写す', () => {
  const names = migrationFiles();
  const settingsMigrations = names.filter((n) => /^005[2-4]_/.test(n));

  it('0052〜0054 は UPDATE・DELETE・DROP・ALTER を含まない', () => {
    expect(settingsMigrations).toHaveLength(3);
    for (const filename of settingsMigrations) {
      const sql = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')).join('\n');
      expect(sql, filename).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER)\b/i);
    }
  });

  it('account_norm_map と cash_overrides の行が新表と変更履歴へ写る (旧表は残る)', async () => {
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        name: 'settings-migration',
        modules: true,
        script: 'export default { fetch() { return new Response("test") } }',
        d1Databases: ['DB'],
      }),
    );
    try {
      const db = (await mf.getD1Database('DB')) as D1Database;
      await runMigrations(
        db,
        names.filter((n) => n < '0052'),
      );
      const longRaw = '長い日本語の勘定科目名を十一字以上';
      await db.batch([
        db.prepare("INSERT INTO account_norm_map (user_id, raw, norm) VALUES ('u1', '旅費', '交通費')"),
        db
          .prepare("INSERT INTO account_norm_map (user_id, raw, norm) VALUES ('u1', ?, '雑費')")
          .bind(longRaw),
        db.prepare("INSERT INTO account_norm_map (user_id, raw, norm) VALUES ('u1', 'Amazon', NULL)"),
        db.prepare(
          "INSERT INTO cash_overrides (user_id, month, revenue, expense) VALUES ('u1', '2026-04', 1000, 0)",
        ),
        db.prepare(
          "INSERT INTO cash_overrides (user_id, month, revenue, expense) VALUES ('u1', '2026-05', NULL, 2000)",
        ),
      ]);
      await runMigrations(db, settingsMigrations);

      const rules = (
        await db
          .prepare(
            "SELECT rule_id, kind, raw, norm, sort_order, enabled, updated_by FROM settings_norm_rules WHERE user_id='u1' ORDER BY sort_order",
          )
          .all()
      ).results;
      const sortedRaws = ['旅費', longRaw].sort();
      expect(rules).toEqual(
        sortedRaws.map((raw, i) => ({
          rule_id: migratedNormRuleId(raw),
          kind: 'account',
          raw,
          norm: raw === '旅費' ? '交通費' : '雑費',
          sort_order: i + 1,
          enabled: 1,
          updated_by: 'system',
        })),
      );

      const overrides = (
        await db
          .prepare(
            "SELECT override_id, kind, amount, scope, month, memo FROM settings_cash_overrides WHERE user_id='u1' ORDER BY override_id",
          )
          .all()
      ).results;
      expect(overrides).toEqual([
        {
          override_id: 'm-p-2026-05',
          kind: 'payment',
          amount: 2000,
          scope: 'month',
          month: '2026-05',
          memo: '',
        },
        {
          override_id: 'm-r-2026-04',
          kind: 'receipt',
          amount: 1000,
          scope: 'month',
          month: '2026-04',
          memo: '',
        },
      ]);

      const log = (
        await db
          .prepare(
            "SELECT seq, target, target_key, before, after, changed_by, origin FROM settings_change_log WHERE user_id='u1' ORDER BY seq",
          )
          .all()
      ).results as Array<{ target_key: string; after: string }>;
      expect(log).toHaveLength(2);
      expect(log.map((r) => r.target_key)).toEqual(sortedRaws.map(migratedNormRuleId));
      expect(log[0]).toMatchObject({
        seq: 1,
        target: 'norm_rule',
        before: null,
        changed_by: 'system',
        origin: 'migration',
      });
      expect(JSON.parse(log[0].after)).toEqual({
        kind: 'account',
        raw: sortedRaws[0],
        norm: sortedRaws[0] === '旅費' ? '交通費' : '雑費',
        enabled: 1,
        order: 1,
      });

      expect(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM account_norm_map WHERE user_id='u1'")
            .first<{ n: number }>()
        )?.n,
      ).toBe(3);
      expect(
        (
          await db
            .prepare("SELECT COUNT(*) AS n FROM cash_overrides WHERE user_id='u1'")
            .first<{ n: number }>()
        )?.n,
      ).toBe(2);
    } finally {
      await mf.dispose();
    }
  }, 30_000);

  it('移行行 (enabled が 0/1) の history は真偽値で返す', async () => {
    const raw = '長い日本語の勘定科目名を十一字以上';
    const id = migratedNormRuleId(raw);
    await database.batch([
      database
        .prepare(
          `INSERT INTO settings_norm_rules (user_id, rule_id, kind, raw, norm, sort_order, enabled, updated_at, updated_by)
           VALUES (?, ?, 'account', ?, '雑費', 1, 1, '2026-01-01T00:00:00.000Z', 'system')`,
        )
        .bind(TENANT_ID, id, raw),
      database
        .prepare(
          `INSERT INTO settings_change_log (user_id, seq, target, target_key, before, after, changed_by, changed_at, origin)
           VALUES (?, 1, 'norm_rule', ?, NULL, json_object('kind','account','raw',?,'norm','雑費','enabled',1,'order',1),
                   'system', '2026-01-01T00:00:00.000Z', 'migration')`,
        )
        .bind(TENANT_ID, id, raw),
    ]);
    const view = await screen();
    expect(view.savedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(view.normRules[0]).toMatchObject({ ruleId: id, updatedBy: 'システム', canUndo: false });

    const saved = await json(
      await send('PUT', '/api/settings/screen', {
        baseSavedAt: view.savedAt,
        normRules: [rule(id, raw, '消耗品費', 'account', true)],
      }),
    );
    expect(saved.changes).toBe(1);
    const history = await json(await call(`/api/settings/history?ruleId=${id}`));
    expect(history.previous).toEqual({ kind: 'account', raw, norm: '雑費', enabled: true, order: 1 });
  });
});

describe('BR-22 旧経路の書込みも新表と変更履歴へ写る', () => {
  it('旧 PUT /api/settings の normMap・cashOverrides・statMinMonths', async () => {
    const res = await send('PUT', '/api/settings', {
      normMap: { 旅費: '交通費', 長い日本語の勘定科目名を十一字以上: '雑費' },
      cashOverrides: { '2026-04': { revenue: 1000, expense: 0 }, '2026-05': { revenue: 0, expense: 2500 } },
      statMinMonths: 10,
    });
    expect(res.status).toBe(200);

    expect(
      await rows('SELECT raw, norm FROM account_norm_map WHERE user_id=? ORDER BY raw', TENANT_ID),
    ).toHaveLength(2);
    const view = await screen();
    expect(view.savedAt).not.toBeNull();
    expect(
      view.normRules.map((r: { ruleId: string; raw: string; norm: string }) => [r.ruleId, r.raw, r.norm]),
    ).toEqual(
      ['旅費', '長い日本語の勘定科目名を十一字以上']
        .sort()
        .map((raw) => [migratedNormRuleId(raw), raw, raw === '旅費' ? '交通費' : '雑費']),
    );
    expect(
      view.cashOverrides.map((r: { overrideId: string; amount: number }) => [r.overrideId, r.amount]).sort(),
    ).toEqual([
      ['m-p-2026-05', 2500],
      ['m-r-2026-04', 1000],
    ]);
    expect(view.statMinMonths).toBe(10);

    const log = await changeLog();
    expect(log.length).toBe(5);
    expect(log.every((r) => r.origin === 'screen' && r.changed_by === 'admin')).toBe(true);
    expect(new Set(log.map((r) => r.target))).toEqual(
      new Set(['norm_rule', 'cash_override', 'stat_min_months']),
    );

    // 同じ値を送り直しても履歴は増えず revision は進まない
    await send('PUT', '/api/settings', {
      normMap: { 旅費: '交通費', 長い日本語の勘定科目名を十一字以上: '雑費' },
    });
    expect(await changeLog()).toHaveLength(5);
    expect((await screen()).savedAt).toBe(view.savedAt);

    // 旧経路の保存で revision が進むので、古い baseSavedAt の画面保存は 409
    await send('PUT', '/api/settings', { statMinMonths: 11 });
    expect(
      (await send('PUT', '/api/settings/screen', { baseSavedAt: view.savedAt, statMinMonths: 12 })).status,
    ).toBe(409);
  });

  it('PUT /api/settings/owner-labels は名義の変更履歴を追記する', async () => {
    const labels = { business: '事業', spouse: '妻', family: '子', unset: '未設定' };
    const res = await send('PUT', '/api/settings/owner-labels', { labels });
    expect(res.status).toBe(200);
    const view = await screen();
    expect(view.ownerLabels).toEqual(labels);
    expect(view.ownerLabelsSaved).toBe(true);
    const log = await changeLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((r) => r.target === 'owner_label' && r.origin === 'screen')).toBe(true);
    expect(view.savedAt).toBe(log[log.length - 1].changed_at);
  });
});

describe('AT-18 認証・本文上限・不正入力', () => {
  it('未認証は 401', async () => {
    const cases: Array<[string, string, unknown]> = [
      ['GET', '/api/settings/screen', undefined],
      ['PUT', '/api/settings/screen', { baseSavedAt: null }],
      ['GET', '/api/settings/history?ruleId=r1', undefined],
      ['GET', '/api/settings/export', undefined],
      ['POST', '/api/settings/restore/preview', {}],
      ['POST', '/api/settings/restore', { baseSavedAt: null, settings: {} }],
    ];
    for (const [method, path, body] of cases) {
      const res =
        body === undefined ? await call(path, { method }, false) : await send(method, path, body, false);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('画面の PUT は 64KB を超えると 413', async () => {
    const res = await send('PUT', '/api/settings/screen', {
      baseSavedAt: null,
      normRules: [rule('r1', '旅費', 'x'.repeat(64 * 1024))],
    });
    expect(res.status).toBe(413);
    expect((await json(res)).error.code).toBe('payload_too_large');
    expect(await changeLog()).toEqual([]);
  });

  it('不正入力は 400 で、送った値を応答に返さない', async () => {
    const secret = '秘密の値ABC';
    const cases: unknown[] = [
      { baseSavedAt: null, normRules: [{ ...rule('r1', secret, secret), extra: secret }] },
      { baseSavedAt: null, unknown: secret },
      { baseSavedAt: null, normRules: [rule('r1', secret, 'x'.repeat(61))] },
      { baseSavedAt: null, normRules: [rule('bad id!', secret, secret)] },
      {
        baseSavedAt: null,
        cashOverrides: [{ kind: 'payment', amount: -1, scope: 'all', month: null, memo: secret }],
      },
      { baseSavedAt: null, statMinMonths: 100 },
      `{"baseSavedAt":null,"normRules":[${secret}`,
    ];
    for (const body of cases) {
      const res = await send('PUT', '/api/settings/screen', body);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).not.toContain(secret);
      expect(JSON.parse(text).error).toMatchObject({
        code: 'invalid_request',
        message: '設定を保存できませんでした。入力内容を確認してください。',
      });
    }
    expect(await changeLog()).toEqual([]);
  });
});
