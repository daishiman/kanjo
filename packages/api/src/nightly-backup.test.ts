/**
 * 夜間バックアップが R2 へ実際に書けたことを見る独立テスト。
 *
 * なぜ独立した1ファイルなのか: この保証は元々、証憑ライフサイクルの巨大な回帰テストの
 * 中の1アサーションとしてだけ存在していた。証憑機能を廃止してそのファイルを消すと、
 * バックアップという無関係な機能の唯一の実行証跡が黙って一緒に消える。
 * ここへ退避させることで、バックアップの保証は証憑の去就から切り離される。
 *
 * 検証するのは scheduled 経由の外形だけ:
 *   - 当日分 backups/YYYY-MM-DD.json が R2 に置かれる
 *   - 30日を過ぎた世代が消える (30日以内は残る)
 *   - 他ジョブが落ちてもバックアップは完了している
 * 証憑のテーブルにも証憑のジョブにも依存しない。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduledMaintenance } from './index.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;

const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

const env = (filesBinding: R2Bucket = files, dbBinding: D1Database = d1) => ({
  ...auth,
  DB: dbBinding,
  FILES: filesBinding,
});

/** 実行日の当日キー。テストが日付をまたいでも同じ規則で求める。 */
const todayKey = (): string => `backups/${new Date().toISOString().slice(0, 10)}.json`;

/** 今日から days 日前の世代キー。 */
const dayKey = (days: number): string =>
  `backups/${new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}.json`;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'nightly-backup',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  const filenames = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await d1.prepare(sql).run();
  }
});

afterAll(async () => {
  await mf?.dispose();
});

beforeEach(async () => {
  // 世代の前提を毎回そろえる。前のテストが置いた backups/ を持ち越さない。
  const listed = await files.list({ prefix: 'backups/' });
  for (const object of listed.objects) await files.delete(object.key);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('夜間バックアップ', () => {
  it('scheduled 経由で当日分を R2 へ書き、中身が JSON として読める', async () => {
    await scheduledMaintenance(env());

    const stored = await files.get(todayKey());
    expect(stored).not.toBeNull();
    // put しただけで中身が壊れていては復元できない。JSON として読めることまで見る。
    const body = await (stored as unknown as R2ObjectBody).text();
    expect(() => JSON.parse(body)).not.toThrow();
    expect(JSON.parse(body)).toBeTypeOf('object');
  });

  it('30日を過ぎた世代だけを消し、30日以内の世代と当日分は残す', async () => {
    const expired = dayKey(45);
    const living = dayKey(10);
    await files.put(expired, '{"synthetic":"expired"}');
    await files.put(living, '{"synthetic":"living"}');

    await scheduledMaintenance(env());

    expect(await files.head(expired)).toBeNull();
    expect(await files.head(living)).not.toBeNull();
    expect(await files.head(todayKey())).not.toBeNull();
  });

  it('他ジョブが落ちてもバックアップは完了し、件数だけをログへ残す', async () => {
    // backup 以外の全 D1 経路を落とす。backup は allSettled の外側で先に確定するので、
    // ここが緑になることは「backup が他ジョブの成否に依存していない」ことを意味する。
    let executions = 0;
    const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, property, receiver) {
          if (property === 'bind') return (...values: unknown[]) => wrap(target.bind(...values));
          if (property === 'run' || property === 'all' || property === 'first' || property === 'raw')
            return (...values: unknown[]) => {
              executions += 1;
              if (executions > 1) return Promise.reject(new Error('synthetic maintenance failure'));
              const method = Reflect.get(target, property, receiver) as (...args: unknown[]) => unknown;
              return method.apply(target, values);
            };
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    const brokenDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare') return (query: string) => wrap(database.prepare(query));
        if (property === 'batch') return () => Promise.reject(new Error('synthetic maintenance failure'));
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;

    await expect(scheduledMaintenance(env(files, brokenDb))).rejects.toThrow('scheduled_maintenance_failed');
    expect(executions).toBeGreaterThan(1);
    expect(await files.head(todayKey())).not.toBeNull();

    const records = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      ([entry]) => JSON.parse(String(entry)) as Record<string, unknown>,
    );
    const summary = records.find((entry) => entry.job === 'nightly_backup');
    expect(summary).toMatchObject({ level: 'info', job: 'nightly_backup', stored: 1 });
    // R2 key も利用者 ID もログへ出さない。件数だけを残す契約。
    expect(JSON.stringify(summary)).not.toContain('backups/');
    expect(JSON.stringify(summary)).not.toContain('default');
  });
});
