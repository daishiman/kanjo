/** R2/D1 非原子境界の、用途に依存しない durable cleanup 契約。 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  R2_CLEANUP_JOB_LIMIT,
  enqueueExpiredImportOriginals,
  processR2CleanupJobNow,
  runR2Cleanup,
} from './r2-cleanup.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const NOW = new Date('2026-09-08T00:00:00.000Z');

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
}

const insertJob = async (input: {
  key: string;
  purpose?: 'import_original' | 'retired_attachment';
  state?: 'pending' | 'retry' | 'dead';
  attempts?: number;
  notBefore?: string;
  createdAt?: string;
}): Promise<number> => {
  const result = await d1
    .prepare(
      `INSERT INTO r2_cleanup_jobs
       (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
       VALUES ('default',?,?,?,?,?,NULL,?,?)
       RETURNING id`,
    )
    .bind(
      input.key,
      input.purpose ?? 'import_original',
      input.state ?? 'pending',
      input.attempts ?? 0,
      input.notBefore ?? NOW.toISOString(),
      input.createdAt ?? NOW.toISOString(),
      NOW.toISOString(),
    )
    .first<{ id: number }>();
  if (!result) throw new Error('synthetic cleanup job insert failed');
  return result.id;
};

const insertImport = async (input: {
  id: number;
  key: string;
  status: string;
  createdAt: string;
  activeTarget?: string;
}): Promise<void> => {
  await d1
    .prepare(
      `INSERT INTO imports (id,user_id,filename,kind,status,r2_key,created_at)
       VALUES (?,'default','synthetic.csv','mf',?,?,?)`,
    )
    .bind(input.id, input.status, input.key, input.createdAt)
    .run();
  if (input.activeTarget)
    await d1
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default',?,'synthetic-hash',?,?)`,
      )
      .bind(input.activeTarget, input.id, NOW.toISOString())
      .run();
};

const seedActiveImport = async (key: string, importId = 7001): Promise<number> => {
  await d1
    .prepare(
      `INSERT INTO imports (id,user_id,filename,kind,status,r2_key,created_at)
       VALUES (?,'default','synthetic.csv','mf','committed',?,?)`,
    )
    .bind(importId, key, NOW.toISOString())
    .run();
  await d1
    .prepare(
      `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
       VALUES ('default',?,'synthetic-hash',?,?)`,
    )
    .bind(`mf:2099-${String(importId).slice(-2)}`, importId, NOW.toISOString())
    .run();
  return importId;
};

const insertLegacyImportCleanup = async (key: string, importId: number): Promise<void> => {
  await d1
    .prepare(
      `INSERT INTO attachment_cleanup_jobs
       (user_id,attachment_id,import_id,r2_key,size,action,reason,state,attempts,not_before,
        last_error,created_at,updated_at)
       VALUES ('default',NULL,?,? ,10,'delete_object','import_retention','pending',0,?,NULL,?,?)`,
    )
    .bind(importId, key, NOW.toISOString(), NOW.toISOString(), NOW.toISOString())
    .run();
};

const insertLegacyAttachment = async (key: string, targetKey: string): Promise<number> => {
  const attachment = await d1
    .prepare(
      `INSERT INTO attachments
       (user_id,target_kind,target_key,r2_key,filename,content_type,size,content_hash,created_at)
       VALUES ('default','cash',?,?,'synthetic.jpg','image/jpeg',10,'synthetic-attachment',?)
       RETURNING id`,
    )
    .bind(targetKey, key, NOW.toISOString())
    .first<{ id: number }>();
  if (!attachment) throw new Error('synthetic attachment insert failed');
  return attachment.id;
};

const deleteFails = (): R2Bucket =>
  new Proxy(files, {
    get(target, property, receiver) {
      if (property === 'delete') return async () => Promise.reject(new Error('synthetic private R2 error'));
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as R2Bucket;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'r2-cleanup-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);
}, 30_000);

beforeEach(async () => {
  await d1.prepare('DELETE FROM attachment_cleanup_jobs').run();
  await d1.prepare('DELETE FROM attachments').run();
  await d1.prepare('DELETE FROM r2_cleanup_jobs').run();
  await d1.prepare('DELETE FROM import_active_targets').run();
  await d1.prepare('DELETE FROM imports').run();
  const listed = await files.list();
  for (const object of listed.objects) await files.delete(object.key);
});

afterAll(async () => {
  await mf?.dispose();
});

describe('R2 cleanup ledger', () => {
  it('共有keyの全rowが30日超・terminal・非activeなら1jobで削除し、全imports参照をNULLにする', async () => {
    const old = '2026-07-01T00:00:00.000Z';
    const key = 'uploads/synthetic/expired-shared.csv';
    await files.put(key, 'synthetic');
    await insertImport({ id: 7101, key, status: 'failed', createdAt: old });
    await insertImport({ id: 7102, key, status: 'duplicate', createdAt: old });
    await insertImport({ id: 7103, key, status: 'committed', createdAt: old });

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toEqual({
      selected: 1,
      completed: 1,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 1,
    });
    await expect(
      d1.prepare('SELECT id,r2_key FROM imports ORDER BY id').all<{ id: number; r2_key: string | null }>(),
    ).resolves.toMatchObject({
      results: [
        { id: 7101, r2_key: null },
        { id: 7102, r2_key: null },
        { id: 7103, r2_key: null },
      ],
    });
    await expect(files.head(key)).resolves.toBeNull();
  });

  it('30日以内・active/shared-active・partial/processing原本は保持する', async () => {
    const old = '2026-07-01T00:00:00.000Z';
    const young = '2026-08-20T00:00:00.000Z';
    const inputs = [
      { id: 7201, key: 'uploads/synthetic/young.csv', status: 'failed', createdAt: young },
      {
        id: 7202,
        key: 'uploads/synthetic/active.csv',
        status: 'committed',
        createdAt: old,
        activeTarget: 'mf:2099-21',
      },
      { id: 7203, key: 'uploads/synthetic/shared-active.csv', status: 'failed', createdAt: old },
      {
        id: 7204,
        key: 'uploads/synthetic/shared-active.csv',
        status: 'committed',
        createdAt: old,
        activeTarget: 'mf:2099-22',
      },
      { id: 7205, key: 'uploads/synthetic/partial.csv', status: 'partial', createdAt: old },
      { id: 7206, key: 'uploads/synthetic/processing.csv', status: 'processing', createdAt: old },
    ];
    for (const input of inputs) await insertImport(input);
    const keys = [...new Set(inputs.map(({ key }) => key))];
    await Promise.all(keys.map((key) => files.put(key, 'synthetic')));

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toEqual({
      selected: 0,
      completed: 0,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 0,
    });
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM imports WHERE r2_key IS NOT NULL').first<number>('n'),
    ).resolves.toBe(inputs.length);
    for (const key of keys) await expect(files.head(key)).resolves.not.toBeNull();
  });

  it.each([
    ['processing', 'processing', '2026-07-01T00:00:00.000Z'],
    ['partial', 'partial', '2026-07-01T00:00:00.000Z'],
    ['applying', 'applying', '2026-07-01T00:00:00.000Z'],
    ['旧status', 'ok', '2026-07-01T00:00:00.000Z'],
    ['不正日時failed', 'failed', 'invalid-created-at'],
    ['30日以内failed', 'failed', '2026-08-20T00:00:00.000Z'],
    ['30日以内duplicate', 'duplicate', '2026-08-20T00:00:00.000Z'],
  ])('30日超failedと%s siblingが同keyにあれば共有原本を保持する', async (_case, status, createdAt) => {
    const key = `uploads/synthetic/protected-${status}-${createdAt.slice(5, 10)}.csv`;
    await files.put(key, 'synthetic');
    await insertImport({
      id: 7251,
      key,
      status: 'failed',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    await insertImport({ id: 7252, key, status, createdAt });

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toEqual({
      selected: 0,
      completed: 0,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 0,
    });
    await expect(files.head(key)).resolves.not.toBeNull();
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM imports WHERE r2_key=?').bind(key).first<number>('n'),
    ).resolves.toBe(2);
  });

  it('enqueue後にprotected siblingが現れても削除直前guardで原本とimports参照を保持する', async () => {
    const key = 'uploads/synthetic/protected-after-enqueue.csv';
    await files.put(key, 'synthetic');
    await insertImport({ id: 7291, key, status: 'failed', createdAt: '2026-07-01T00:00:00.000Z' });
    await expect(enqueueExpiredImportOriginals(d1, NOW)).resolves.toBe(1);
    const jobId = await d1
      .prepare('SELECT id FROM r2_cleanup_jobs WHERE user_id=? AND r2_key=?')
      .bind('default', key)
      .first<number>('id');
    expect(jobId).not.toBeNull();
    await insertImport({ id: 7292, key, status: 'processing', createdAt: NOW.toISOString() });
    await insertLegacyImportCleanup(key, 7291);

    await expect(processR2CleanupJobNow({ DB: d1, FILES: files }, jobId as number, NOW)).resolves.toBe(
      'completed',
    );
    await expect(files.head(key)).resolves.not.toBeNull();
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM imports WHERE r2_key=?').bind(key).first<number>('n'),
    ).resolves.toBe(2);
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
  });

  it('既存pending/retry/dead keyをLIMIT前に除外し、次の期限超過keyを処理する', async () => {
    const old = '2026-07-01T00:00:00.000Z';
    const future = '2026-12-01T00:00:00.000Z';
    for (let index = 0; index < R2_CLEANUP_JOB_LIMIT; index += 1) {
      const key = `uploads/synthetic/already-enqueued-${index}.csv`;
      await insertImport({ id: 7301 + index, key, status: 'failed', createdAt: old });
      await insertJob({
        key,
        state: index === R2_CLEANUP_JOB_LIMIT - 1 ? 'dead' : index % 2 === 0 ? 'pending' : 'retry',
        notBefore: future,
        createdAt: old,
      });
    }
    const nextKey = 'uploads/synthetic/not-starved.csv';
    await insertImport({ id: 7399, key: nextKey, status: 'failed', createdAt: old });
    await files.put(nextKey, 'synthetic');

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toEqual({
      selected: 1,
      completed: 1,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 1,
    });
    await expect(files.head(nextKey)).resolves.toBeNull();
    await expect(d1.prepare('SELECT r2_key FROM imports WHERE id=7399').first()).resolves.toEqual({
      r2_key: null,
    });
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM r2_cleanup_jobs').first<number>('n')).resolves.toBe(
      R2_CLEANUP_JOB_LIMIT,
    );
  });

  it('R2削除後のcompletion batch失敗でjobとimports.r2_keyを残し、再試行で収束する', async () => {
    const key = 'uploads/synthetic/completion-failure.csv';
    await insertImport({ id: 7401, key, status: 'failed', createdAt: '2026-07-01T00:00:00.000Z' });
    const jobId = await insertJob({ key });
    await files.put(key, 'synthetic');
    const failingDatabase = new Proxy(d1, {
      get(target, property, receiver) {
        if (property === 'batch') return async () => Promise.reject(new Error('synthetic D1 failure'));
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;

    await expect(processR2CleanupJobNow({ DB: failingDatabase, FILES: files }, jobId, NOW)).rejects.toThrow(
      'synthetic D1 failure',
    );
    await expect(files.head(key)).resolves.toBeNull();
    await expect(d1.prepare('SELECT r2_key FROM imports WHERE id=7401').first()).resolves.toEqual({
      r2_key: key,
    });
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE id=?').bind(jobId).first(),
    ).resolves.not.toBeNull();

    await expect(processR2CleanupJobNow({ DB: d1, FILES: files }, jobId, NOW)).resolves.toBe('completed');
    await expect(d1.prepare('SELECT r2_key FROM imports WHERE id=7401').first()).resolves.toEqual({
      r2_key: null,
    });
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE id=?').bind(jobId).first(),
    ).resolves.toBeNull();
  });

  it('失敗を永続retryにし、backoff後の同じ処理で冪等に完了する', async () => {
    const key = 'uploads/synthetic/retry.csv';
    await files.put(key, 'synthetic');
    await insertJob({ key });

    await expect(runR2Cleanup({ DB: d1, FILES: deleteFails() }, NOW)).resolves.toEqual({
      selected: 1,
      completed: 0,
      retried: 1,
      dead: 0,
      importJobsEnqueued: 0,
    });
    await expect(
      d1.prepare('SELECT state,attempts,last_error FROM r2_cleanup_jobs').first(),
    ).resolves.toEqual({ state: 'retry', attempts: 1, last_error: 'r2_delete_failed' });
    await expect(files.head(key)).resolves.not.toBeNull();

    const afterBackoff = new Date(NOW.getTime() + 3 * 60_000);
    await expect(runR2Cleanup({ DB: d1, FILES: files }, afterBackoff)).resolves.toEqual({
      selected: 1,
      completed: 1,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 0,
    });
    await expect(d1.prepare('SELECT id FROM r2_cleanup_jobs').first()).resolves.toBeNull();
    await expect(files.head(key)).resolves.toBeNull();
  });

  it('長期間の連続失敗だけをdeadにし、通常Cronから無限再試行しない', async () => {
    const key = 'uploads/synthetic/dead.csv';
    await files.put(key, 'synthetic');
    await insertJob({
      key,
      attempts: 4,
      createdAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });

    await expect(runR2Cleanup({ DB: d1, FILES: deleteFails() }, NOW)).resolves.toMatchObject({
      selected: 1,
      dead: 1,
    });
    await expect(d1.prepare('SELECT state,attempts FROM r2_cleanup_jobs').first()).resolves.toEqual({
      state: 'dead',
      attempts: 5,
    });
    await expect(
      runR2Cleanup({ DB: d1, FILES: files }, new Date(NOW.getTime() + 24 * 60 * 60 * 1000)),
    ).resolves.toEqual({
      selected: 0,
      completed: 0,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 0,
    });
    await expect(files.head(key)).resolves.not.toBeNull();
  });

  it.each(['attachment', 'cleanup_intent'] as const)(
    'dead後に旧Workerが同じkeyへ%sを書いてもjobを再開し、Release Bを塞ぐ旧rowを収束させる',
    async (lateWrite) => {
      const key = `attachments/synthetic/dead-late-${lateWrite}.jpg`;
      await files.put(key, 'synthetic');
      await insertJob({
        key,
        purpose: 'retired_attachment',
        state: 'dead',
        attempts: 5,
        notBefore: '2026-12-01T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
      });
      if (lateWrite === 'attachment') await insertLegacyAttachment(key, 'dead-late');
      else await insertLegacyImportCleanup(key, 8801);

      await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toEqual({
        selected: 1,
        completed: 1,
        retried: 0,
        dead: 0,
        importJobsEnqueued: 0,
      });
      await expect(files.head(key)).resolves.toBeNull();
      await expect(
        d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
      await expect(
        d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
      await expect(
        d1.prepare('SELECT id FROM attachments WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
    },
  );

  it('旧Workerのlate writeは既存retryの試行回数とbackoffを巻き戻さない', async () => {
    const key = 'attachments/synthetic/retry-late.jpg';
    const notBefore = '2026-12-01T00:00:00.000Z';
    await insertJob({
      key,
      purpose: 'retired_attachment',
      state: 'retry',
      attempts: 3,
      notBefore,
      createdAt: '2026-08-01T00:00:00.000Z',
    });
    await insertLegacyAttachment(key, 'retry-late');

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toMatchObject({ selected: 0 });
    await expect(
      d1.prepare('SELECT state,attempts,not_before FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toEqual({ state: 'retry', attempts: 3, not_before: notBefore });
  });

  it('active原本はR2から削除せず、退役metadataと新旧cleanup intentだけを取り消す', async () => {
    const key = 'uploads/synthetic/reactivated.csv';
    const importId = await seedActiveImport(key);
    await files.put(key, 'synthetic');
    await insertJob({ key });
    await insertLegacyImportCleanup(key, importId);
    await insertLegacyAttachment(key, '7001');

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toEqual({
      selected: 1,
      completed: 1,
      retried: 0,
      dead: 0,
      importJobsEnqueued: 0,
    });
    await expect(files.head(key)).resolves.not.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachments WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(d1.prepare('SELECT r2_key FROM imports WHERE id=?').bind(importId).first()).resolves.toEqual(
      { r2_key: key },
    );
  });

  it('retired起点のactive原本取消batchが失敗したらR2・参照・退役metadata・全intentを残す', async () => {
    const key = 'uploads/synthetic/cancel-failure.csv';
    const importId = await seedActiveImport(key, 7002);
    await files.put(key, 'synthetic');
    const jobId = await insertJob({ key, purpose: 'retired_attachment' });
    await insertLegacyImportCleanup(key, importId);
    await insertLegacyAttachment(key, '7002');
    const failingDatabase = new Proxy(d1, {
      get(target, property, receiver) {
        if (property === 'batch') return async () => Promise.reject(new Error('synthetic D1 failure'));
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;

    await expect(processR2CleanupJobNow({ DB: failingDatabase, FILES: files }, jobId, NOW)).rejects.toThrow(
      'synthetic D1 failure',
    );
    await expect(files.head(key)).resolves.not.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.not.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.not.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachments WHERE r2_key=?').bind(key).first(),
    ).resolves.not.toBeNull();
    await expect(d1.prepare('SELECT r2_key FROM imports WHERE id=?').bind(importId).first()).resolves.toEqual(
      { r2_key: key },
    );
  });

  it('inactiveな取込原本は通常どおり削除する', async () => {
    const key = 'uploads/synthetic/inactive.csv';
    await files.put(key, 'synthetic');
    await insertJob({ key });

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toMatchObject({
      selected: 1,
      completed: 1,
    });
    await expect(files.head(key)).resolves.toBeNull();
  });

  it.each([
    ['active', 'committed', '2026-07-01T00:00:00.000Z', 'mf:2099-31'],
    ['30日以内', 'failed', '2026-08-20T00:00:00.000Z', undefined],
    ['processing', 'processing', '2026-07-01T00:00:00.000Z', undefined],
  ])(
    'retired起点でも同じkeyに%s取込参照があればR2と参照を守り、退役metadataだけ収束させる',
    async (caseName, status, createdAt, activeTarget) => {
      const key = `uploads/synthetic/retired-protected-${caseName}.csv`;
      const importId = 7601;
      await insertImport({ id: importId, key, status, createdAt, activeTarget });
      await files.put(key, 'synthetic');
      await insertJob({ key, purpose: 'retired_attachment' });
      await insertLegacyImportCleanup(key, importId);
      await insertLegacyAttachment(key, caseName);

      await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toMatchObject({
        selected: 1,
        completed: 1,
      });
      await expect(files.head(key)).resolves.not.toBeNull();
      await expect(
        d1.prepare('SELECT r2_key FROM imports WHERE id=?').bind(importId).first(),
      ).resolves.toEqual({ r2_key: key });
      await expect(
        d1.prepare('SELECT id FROM attachments WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
      await expect(
        d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
      await expect(
        d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
    },
  );

  it('retired起点でも共有keyの全取込参照が適格ならR2を削除し、全imports参照をNULLにする', async () => {
    const key = 'uploads/synthetic/retired-eligible.csv';
    const importId = 7701;
    await insertImport({
      id: importId,
      key,
      status: 'failed',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    await files.put(key, 'synthetic');
    await insertJob({ key, purpose: 'retired_attachment' });
    await insertLegacyImportCleanup(key, importId);
    await insertLegacyAttachment(key, '7701');

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toMatchObject({
      selected: 1,
      completed: 1,
    });
    await expect(files.head(key)).resolves.toBeNull();
    await expect(d1.prepare('SELECT r2_key FROM imports WHERE id=?').bind(importId).first()).resolves.toEqual(
      {
        r2_key: null,
      },
    );
    await expect(
      d1.prepare('SELECT id FROM attachments WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
  });

  it('共有key guard増分を含めて予算内に収まる件数を固定する', () => {
    expect(R2_CLEANUP_JOB_LIMIT).toBe(3);
  });

  it('R2削除成功と同じD1 batchでRelease Aの旧metadataも消す', async () => {
    const key = 'attachments/synthetic/late.jpg';
    await files.put(key, 'synthetic');
    await d1
      .prepare(
        `INSERT INTO attachments
         (user_id,target_kind,target_key,r2_key,filename,content_type,size,content_hash,created_at)
         VALUES ('default','cash','1',?,'late.jpg','image/jpeg',10,'late-hash',?)`,
      )
      .bind(key, NOW.toISOString())
      .run();
    const attachmentId = await d1
      .prepare('SELECT id FROM attachments WHERE r2_key=?')
      .bind(key)
      .first<number>('id');
    await d1
      .prepare(
        `INSERT INTO attachment_cleanup_jobs
         (user_id,attachment_id,import_id,r2_key,size,action,reason,state,attempts,not_before,
          last_error,created_at,updated_at)
         VALUES ('default',?,NULL,?,10,'delete_object','attachment_delete','pending',0,?,NULL,?,?)`,
      )
      .bind(attachmentId, key, NOW.toISOString(), NOW.toISOString(), NOW.toISOString())
      .run();

    await expect(runR2Cleanup({ DB: d1, FILES: files }, NOW)).resolves.toMatchObject({
      selected: 1,
      completed: 1,
    });
    await expect(files.head(key)).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachments WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM attachment_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
    await expect(
      d1.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
    ).resolves.toBeNull();
  });

  it('将来旧表が物理削除された後もretired起点からactive取込原本を守る', async () => {
    const staged = new Miniflare(
      convertV4MiniflareOptions({
        name: 'r2-cleanup-without-legacy-tables',
        modules: true,
        script: 'export default { fetch() { return new Response("test") } }',
        d1Databases: ['DB'],
        r2Buckets: ['FILES'],
      }),
    );
    try {
      const database = (await staged.getD1Database('DB')) as D1Database;
      const bucket = (await staged.getR2Bucket('FILES')) as unknown as R2Bucket;
      await applyMigrations(database);
      await database.prepare('DROP TABLE attachment_cleanup_jobs').run();
      await database.prepare('DROP TABLE attachments').run();
      const key = 'uploads/synthetic/post-release-b.csv';
      await bucket.put(key, 'synthetic');
      await database
        .prepare(
          `INSERT INTO imports (id,user_id,filename,kind,status,r2_key,created_at)
           VALUES (8001,'default','synthetic.csv','mf','committed',?,?)`,
        )
        .bind(key, NOW.toISOString())
        .run();
      await database
        .prepare(
          `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
           VALUES ('default','mf:2099-01','synthetic-hash',8001,?)`,
        )
        .bind(NOW.toISOString())
        .run();
      await database
        .prepare(
          `INSERT INTO r2_cleanup_jobs
           (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
           VALUES ('default',?,'retired_attachment','pending',0,?,NULL,?,?)`,
        )
        .bind(key, NOW.toISOString(), NOW.toISOString(), NOW.toISOString())
        .run();

      await expect(runR2Cleanup({ DB: database, FILES: bucket }, NOW)).resolves.toEqual({
        selected: 1,
        completed: 1,
        retried: 0,
        dead: 0,
        importJobsEnqueued: 0,
      });
      await expect(bucket.head(key)).resolves.not.toBeNull();
      await expect(
        database.prepare('SELECT id FROM r2_cleanup_jobs WHERE r2_key=?').bind(key).first(),
      ).resolves.toBeNull();
    } finally {
      await staged.dispose();
    }
  }, 30_000);
});
