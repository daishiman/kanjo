/**
 * 改善要望を「会計の正本」から締め出しておくための境界テスト。
 *
 * 改善要望は業務データではなく、画面の不具合を伝えるための一時的な作業記録である。
 * これを夜間バックアップの対象に混ぜると、毎晩の snapshot が要望件数ぶん膨らみ、
 * さらにスクリーンショットや診断情報を会計データと同じ保存期間で抱え込むことになる。
 * よって BACKUP_SNAPSHOT_SQL には決して足さない。ここはその決定を、
 * うっかり足したときに落ちる形で固定する。
 *
 * 同時に、削除ジョブが既存の夜間処理を道連れにしないことも確かめる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImprovementRetention } from './routes/improvement.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../migrations');
const source = (relative: string): string => readFileSync(resolve(here, relative), 'utf8');

/** BACKUP_SNAPSHOT_SQL のテンプレートリテラル本体だけを取り出す */
function backupSnapshotSql(): string {
  const text = source('./store.ts');
  const start = text.indexOf('const BACKUP_SNAPSHOT_SQL = `');
  expect(start).toBeGreaterThan(-1);
  const from = text.indexOf('`', start) + 1;
  const to = text.indexOf('`', from);
  expect(to).toBeGreaterThan(from);
  return text.slice(from, to);
}

describe('夜間バックアップの対象外であること', () => {
  it('BACKUP_SNAPSHOT_SQL に improvement_requests が現れない', () => {
    expect(backupSnapshotSql()).not.toContain('improvement_requests');
  });

  it('バックアップ対象は明示列挙のままで、テーブルを総なめしていない', () => {
    const sql = backupSnapshotSql();
    // sqlite_master から動的に集める書き方にすると、新しいテーブルが自動で混ざる
    expect(sql).not.toContain('sqlite_master');
    expect(sql).toContain('transactions');
  });

  it('改善要望のスクリーンショットは会計用の添付とは別の prefix に置く', () => {
    // improvements/ 配下だけを対象にすることで、証憑の掃除と混線しない
    const core = readFileSync(resolve(here, '../../core/src/improvement.ts'), 'utf8');
    expect(core).toContain('`improvements/${userId}/${requestId}.jpg`');
  });
});

describe('Cron を増やさないこと', () => {
  it('wrangler.jsonc の cron は既存の1本だけである', () => {
    const config = readFileSync(resolve(here, '../wrangler.jsonc'), 'utf8');
    const crons = /"crons"\s*:\s*\[([^\]]*)\]/.exec(config);
    expect(crons).not.toBeNull();
    const entries = (crons?.[1] ?? '').split(',').filter((s) => s.trim().length > 0);
    expect(entries.length).toBe(1);
  });

  it('削除ジョブは既存の scheduledMaintenance に相乗りしている', () => {
    const index = source('./index.ts');
    expect(index).toContain('runImprovementRetention');
    // Promise.allSettled の中にいる = 他ジョブの失敗と独立に結果を記録できる
    const block = index.slice(index.indexOf('async function scheduledMaintenance'));
    const settled = block.indexOf('Promise.allSettled');
    const retention = block.indexOf('runImprovementRetention');
    expect(settled).toBeGreaterThan(-1);
    expect(retention).toBeGreaterThan(settled);
  });
});

describe('削除ジョブの失敗が他へ波及しないこと', () => {
  let mf: Miniflare;
  let d1: D1Database;

  beforeAll(async () => {
    mf = new Miniflare(
      convertV4MiniflareOptions({
        name: 'improvement-backup-exclusion',
        modules: true,
        script: 'export default { fetch() { return new Response("test") } }',
        d1Databases: ['DB'],
        r2Buckets: ['FILES'],
      }),
    );
    d1 = (await mf.getD1Database('DB')) as D1Database;
    const filenames = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const filename of filenames) {
      const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
        .replace(/^\s*--.*$/gm, '')
        .split(';')
        .map((sql) => sql.trim())
        .filter(Boolean);
      for (const sql of statements) await d1.prepare(sql).run();
    }
    // 期限を過ぎた要望を2件だけ置く。片方の削除は R2 側で失敗させる
    for (const id of ['imp-a', 'imp-b']) {
      await d1
        .prepare(
          `INSERT INTO improvement_requests
             (id, user_id, title, body, route, status, screenshot_key, done_at, created_at, updated_at)
           VALUES (?, 'default', '架空の要望', '本文', '/', 'done', ?, ?, ?, ?)`,
        )
        .bind(
          id,
          `improvements/default/${id}.jpg`,
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
        )
        .run();
    }
  });

  afterAll(async () => {
    await mf?.dispose();
  });

  it('R2個別失敗とR2成功後のD1集合更新失敗を、どちらも次回へ安全に持ち越す', async () => {
    const failing = {
      delete: (key: string) => {
        if (key.endsWith('imp-a.jpg')) throw new Error('synthetic R2 failure');
        return Promise.resolve();
      },
      get: () => Promise.resolve(null),
      list: () => Promise.resolve({ objects: [] }),
    } as unknown as R2Bucket;
    const env = {
      ACCESS_AUD: '',
      ACCESS_TEAM_DOMAIN: '',
      AUTH_PASSWORD: 'synthetic-test-password',
      SESSION_SECRET: 'synthetic-test-secret',
      DB: d1,
      FILES: failing,
    };
    const result = await runImprovementRetention(env, '2026-02-15T00:00:00.000Z');
    expect(result.selected).toBe(2);
    expect(result.purged).toBe(1);
    expect(result.failed).toBe(1);

    // 失敗した行は purged_at が立たないので、次回の実行で拾い直せる
    const remaining = await d1
      .prepare("SELECT id FROM improvement_requests WHERE purged_at IS NULL AND status = 'done'")
      .all<{ id: string }>();
    expect(remaining.results.map((r) => r.id)).toEqual(['imp-a']);

    // 集合UPDATE失敗時に、同じsweepでR2削除済みの全行が未処理に戻ることを複数行で確認する。
    await d1
      .prepare(
        `INSERT INTO improvement_requests
           (id, user_id, title, body, route, status, screenshot_key, done_at, created_at, updated_at)
         VALUES ('imp-c', 'default', '架空の要望', '本文', '/', 'done',
                 'improvements/default/imp-c.jpg', ?, ?, ?)`,
      )
      .bind('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
      .run();

    const successfulFiles: Partial<R2Bucket> = {
      delete: () => Promise.resolve(),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve({ objects: [], truncated: false, delimitedPrefixes: [] }),
    };
    const failBoundUpdate = (statement: D1PreparedStatement): D1PreparedStatement => {
      const proxy = new Proxy(statement, {
        get(target, property, receiver) {
          if (property === 'run') return () => Promise.reject(new Error('synthetic D1 set update failure'));
          const value = Reflect.get(target, property, receiver);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      return proxy;
    };
    const updateFails = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare')
          return (query: string) => {
            const statement = database.prepare(query);
            if (!/^\s*UPDATE improvement_requests/i.test(query)) return statement;
            return new Proxy(statement, {
              get(target, member, statementReceiver) {
                if (member === 'bind')
                  return (...values: unknown[]) => failBoundUpdate(target.bind(...values));
                const value = Reflect.get(target, member, statementReceiver);
                return typeof value === 'function' ? value.bind(target) : value;
              },
            });
          };
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    }) as D1Database;
    const deferred = await runImprovementRetention(
      { ...env, DB: updateFails, FILES: successfulFiles as R2Bucket },
      '2026-02-15T00:00:00.000Z',
    );
    expect(deferred).toMatchObject({ selected: 2, purged: 0, failed: 2 });
    expect(
      (
        await d1
          .prepare(
            "SELECT id FROM improvement_requests WHERE id IN ('imp-a','imp-c') AND purged_at IS NULL ORDER BY id",
          )
          .all<{ id: string }>()
      ).results.map((row) => row.id),
    ).toEqual(['imp-a', 'imp-c']);

    const retried = await runImprovementRetention(
      { ...env, FILES: successfulFiles as R2Bucket },
      '2026-02-15T00:00:00.000Z',
    );
    expect(retried).toMatchObject({ selected: 2, purged: 2, failed: 0 });
  });
});
