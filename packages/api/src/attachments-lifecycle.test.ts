/**
 * 証憑添付の API/D1/R2 ライフサイクル回帰テスト(spec: specs/attachments-and-transit.md)。
 * 実データを使わず、インメモリの D1 + R2 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTACHMENT_SCHEDULED_MAX_D1_QUERIES, runAttachmentMaintenance } from './attachment-recovery.js';
import { app, scheduledMaintenance } from './index.js';
import { getDb, loadBackupPayload } from './store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  for (const filename of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
}

const env = (filesBinding: R2Bucket = files, dbBinding: D1Database = d1) => ({
  ...auth,
  DB: dbBinding,
  FILES: filesBinding,
});

const signature = (type: string, name: string): number[] => {
  const normalized =
    type === 'application/octet-stream' || !type ? name.toLowerCase().split('.').pop() : type;
  if (normalized === 'application/pdf' || normalized === 'pdf')
    return [...new TextEncoder().encode('%PDF-1.7\n')];
  if (normalized === 'image/png' || normalized === 'png')
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (normalized === 'image/webp' || normalized === 'webp')
    return [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
  if (normalized === 'image/heic' || normalized === 'heic')
    return [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];
  if (normalized === 'image/heif' || normalized === 'heif')
    return [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66];
  return [0xff, 0xd8, 0xff];
};

async function jsonRequest(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );
}

/** 添付の送信。中身を変えればハッシュも変わるので重複判定の材料にもなる */
async function upload(
  target: string,
  {
    name = 'receipt.jpg',
    type = 'image/jpeg',
    bytes = [1, 2, 3],
    raw = false,
    envBinding = env(),
  }: {
    name?: string;
    type?: string;
    bytes?: number[];
    raw?: boolean;
    envBinding?: ReturnType<typeof env>;
  } = {},
): Promise<Response> {
  const form = new FormData();
  form.append('target', target);
  const prefix = raw || bytes.length === 0 ? [] : signature(type, name);
  const content = new Uint8Array(prefix.length + bytes.length);
  content.set(prefix);
  content.set(bytes, prefix.length);
  form.append('file', new File([content], name, { type }));
  return app.request('/api/attachments', { method: 'POST', headers: { cookie }, body: form }, envBinding);
}

/** 安定ID付きMF CSVを本番と同じmultipart取込経路に通す。 */
async function importMfCsv(body: string, name: string): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([body], name, { type: 'text/csv' }));
  return app.request('/api/imports', { method: 'POST', headers: { cookie }, body: form }, env());
}

/** 添付先の現金記帳を1件作り、その targetId を返す */
async function seedCashEntry(): Promise<string> {
  expect((await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空会議費' })).status).toBe(
    201,
  );
  const created = await jsonRequest('/cash-entries', 'POST', {
    date: '2026-07-10',
    side: 'biz',
    io: 'expense',
    amount: 1200,
    description: '架空の現金支払い',
    big: '架空会議費',
    mid: '',
    memo: null,
  });
  expect(created.status).toBe(201);
  const { entry } = (await created.json()) as { entry: { id: number } };
  return `cash:${entry.id}`;
}

/** 取込明細を1件だけ直接置く(取込の全経路はここの関心ではない) */
async function seedMfTransaction(txId = 'mf-synthetic-1', identityStable = true): Promise<string> {
  await d1
    .prepare(
      'INSERT INTO mf_transactions (user_id, tx_id, month, date, description, amount, category_major, category_mid, institution, identity_stable) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      'default',
      txId,
      '2026-07',
      '2026-07-11',
      '架空の取込明細',
      -3000,
      '架空食費',
      '',
      '架空銀行',
      identityStable ? 1 : 0,
    )
    .run();
  return txId;
}

const r2Keys = async (): Promise<string[]> =>
  (await d1.prepare('SELECT r2_key FROM attachments').all<{ r2_key: string }>()).results.map((r) => r.r2_key);

const r2DeleteFails = (): R2Bucket =>
  new Proxy(files, {
    get(bucket, property, receiver) {
      if (property === 'delete') return async () => Promise.reject(new Error('synthetic R2 failure'));
      const value = Reflect.get(bucket, property, receiver);
      return typeof value === 'function' ? value.bind(bucket) : value;
    },
  });

const r2HeadFails = (onHead: () => void = () => undefined): R2Bucket =>
  new Proxy(files, {
    get(bucket, property, receiver) {
      if (property === 'head')
        return async () => {
          onHead();
          throw new Error('synthetic R2 HEAD failure');
        };
      const value = Reflect.get(bucket, property, receiver);
      return typeof value === 'function' ? value.bind(bucket) : value;
    },
  });

const r2HeadMissing = (onHead: () => void = () => undefined): R2Bucket =>
  new Proxy(files, {
    get(bucket, property, receiver) {
      if (property === 'head')
        return async () => {
          onHead();
          return null;
        };
      const value = Reflect.get(bucket, property, receiver);
      return typeof value === 'function' ? value.bind(bucket) : value;
    },
  });

const snapshotObject = async (key: string) => {
  const object = await files.get(key);
  if (!object) throw new Error('synthetic R2 fixture missing');
  return {
    bytes: await object.arrayBuffer(),
    httpMetadata: object.httpMetadata,
    customMetadata: object.customMetadata,
  };
};

const restoreObject = async (key: string, snapshot: Awaited<ReturnType<typeof snapshotObject>>) =>
  files.put(key, snapshot.bytes, {
    httpMetadata: snapshot.httpMetadata,
    customMetadata: snapshot.customMetadata,
  });

/** archiveの実byte検証直後にscheduled cleanup完了が割り込むraceを再現する。 */
const archiveCleanupCompletesAfterRead = (raceKey: string): R2Bucket =>
  new Proxy(files, {
    get(bucket, property, receiver) {
      if (property === 'get')
        return async (key: string) => {
          const object = await bucket.get(key);
          if (!object || key !== raceKey) return object;
          return new Proxy(object, {
            get(target, objectProperty, objectReceiver) {
              if (objectProperty === 'arrayBuffer')
                return async () => {
                  const bytes = await target.arrayBuffer();
                  await bucket.delete(key);
                  await d1
                    .prepare(
                      `INSERT INTO attachment_object_tombstones (user_id,r2_key,deleted_at)
                       VALUES ('default',?,?)`,
                    )
                    .bind(key, new Date().toISOString())
                    .run();
                  return bytes;
                };
              const value = Reflect.get(target, objectProperty, objectReceiver);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        };
      const value = Reflect.get(bucket, property, receiver);
      return typeof value === 'function' ? value.bind(bucket) : value;
    },
  });

/** R2削除後のattachments行DELETEだけ1回失敗させる */
const attachmentRowDeleteFailsOnce = (): D1Database => {
  let failed = false;
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrapped = new WeakSet<object>();
  const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) => wrapStatement(target.bind(...values));
        }
        if (property === 'run' && !failed) {
          return async () => {
            failed = true;
            throw new Error('synthetic D1 delete failure');
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    originals.set(proxy, statement);
    wrapped.add(proxy);
    return proxy;
  };
  return new Proxy(d1, {
    get(database, property, receiver) {
      if (property === 'prepare') {
        return (query: string) => {
          const statement = database.prepare(query);
          return /^delete from\s+"?attachments"?/i.test(query.trim()) ? wrapStatement(statement) : statement;
        };
      }
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          if (!failed && statements.some((statement) => wrapped.has(statement))) {
            failed = true;
            return Promise.reject(new Error('synthetic D1 delete failure'));
          }
          return database.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(database, property, receiver);
      return typeof value === 'function' ? value.bind(database) : value;
    },
  });
};

/** attachment metadata commitだけを失敗させ、put後の補償境界を再現する。 */
const attachmentInsertFails = (): D1Database => {
  const originals = new WeakMap<object, D1PreparedStatement>();
  const sqlByStatement = new WeakMap<object, string>();
  const wrapStatement = (statement: D1PreparedStatement, query: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) => wrapStatement(target.bind(...values), query);
        }
        if (
          (property === 'run' || property === 'all') &&
          /^insert into\s+"?attachments"?/i.test(query.trim())
        ) {
          return async () => Promise.reject(new Error('synthetic attachment insert failure'));
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    sqlByStatement.set(proxy, query);
    return proxy;
  };
  return new Proxy(d1, {
    get(database, property, receiver) {
      if (property === 'prepare') return (query: string) => wrapStatement(database.prepare(query), query);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          if (
            statements.some((statement) =>
              /^insert into\s+"?attachments"?/i.test(sqlByStatement.get(statement) ?? ''),
            )
          )
            return Promise.reject(new Error('synthetic attachment batch failure'));
          return database.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(database, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(database) : value;
    },
  }) as D1Database;
};

/** attachment maintenanceのretention enqueueだけを失敗させ、backupとの独立実行を検証する。 */
const maintenanceEnqueueFails = (): D1Database => {
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement =>
    new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') return (...values: unknown[]) => wrap(target.bind(...values));
        if (property === 'run') return async () => Promise.reject(new Error('synthetic maintenance failure'));
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  return new Proxy(d1, {
    get(database, property, receiver) {
      if (property === 'prepare') {
        return (query: string) => {
          const statement = database.prepare(query);
          return /INSERT OR IGNORE INTO attachment_cleanup_jobs/i.test(query) ? wrap(statement) : statement;
        };
      }
      const value = Reflect.get(database, property, receiver);
      return typeof value === 'function' ? value.bind(database) : value;
    },
  });
};

/** cash DELETEとmonthly_agg入れ替えを含む確定batchだけ1回失敗させる。 */
const finalCashBatchFailsOnce = (): {
  database: D1Database;
  failedBatchSql: () => string[];
} => {
  let failed = false;
  let failedBatchSql: string[] = [];
  const originals = new WeakMap<object, D1PreparedStatement>();
  const sqlByStatement = new WeakMap<object, string>();
  const wrapStatement = (statement: D1PreparedStatement, query: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrapStatement(
              (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values),
              query,
            );
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    sqlByStatement.set(proxy, query);
    return proxy;
  };
  const database = new Proxy(d1, {
    get(target, property, receiver) {
      if (property === 'prepare') return (query: string) => wrapStatement(target.prepare(query), query);
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          const queries = statements.map((statement) => sqlByStatement.get(statement) ?? '');
          if (!failed && queries.some((query) => /^delete from "cash_entries"/i.test(query.trim()))) {
            failed = true;
            failedBatchSql = queries;
            return Promise.reject(new Error('synthetic final cash batch failure'));
          }
          return target.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
  return { database, failedBatchSql: () => failedBatchSql };
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'attachments-lifecycle-test',
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
  const objects = await files.list({ prefix: 'attachments/' });
  for (const object of objects.objects) await files.delete(object.key);
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results) await d1.prepare(`DELETE FROM "${name}"`).run();
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    env(),
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('証憑の添付', () => {
  it('POST成功responseもD1確定後のexact HEADを正本とし、帯域外欠損をoriginal_missingで返す', async () => {
    const target = await seedCashEntry();
    const head = vi.fn();
    const response = await upload(target, { envBinding: env(r2HeadMissing(head)) });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      attachment: { originalAvailable: false, cleanupStage: 'original_missing' },
    });
    expect(head).toHaveBeenCalledTimes(1);
    expect(await r2Keys()).toHaveLength(1);
  });

  it('POSTのcommit後HEAD障害はstaleなoriginalAvailableを返さず503にし、再送をduplicateへ安全収束させる', async () => {
    const target = await seedCashEntry();
    const head = vi.fn();
    const failed = await upload(target, { envBinding: env(r2HeadFails(head)) });

    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({
      attachment: expect.objectContaining({ originalAvailable: false }),
      error: {
        code: 'attachment_availability_unavailable',
        message:
          '添付は保存済みです。原本の保管状況を確認できないため、同じファイルを再送せず一覧を読み直してください',
        committed: true,
        retryable: false,
      },
    });
    expect(head).toHaveBeenCalledTimes(1);
    expect(
      (await d1.prepare('SELECT COUNT(*) AS count FROM attachments').first<{ count: number }>())?.count,
    ).toBe(1);

    const retry = await upload(target);
    expect(retry.status).toBe(409);
    expect(await retry.json()).toMatchObject({ error: { code: 'duplicate' } });
    expect(
      await (await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`)).json(),
    ).toMatchObject({
      attachments: [{ originalAvailable: true, cleanupStage: 'none' }],
    });
  });

  it('現金の記帳に添付して一覧・原本取得・削除まで往復する', async () => {
    const target = await seedCashEntry();

    const created = await upload(target);
    expect(created.status).toBe(201);
    const { attachment } = (await created.json()) as {
      attachment: {
        id: number;
        target: { kind: string; id: number };
        targetId: string;
        filename: string;
        contentType: string;
        size: number;
      };
    };
    expect(attachment.target).toEqual({ kind: 'cash', id: Number(target.slice('cash:'.length)) });
    expect(attachment.targetId).toBe(target);
    expect(attachment.filename).toBe('receipt.jpg');
    expect(attachment.contentType).toBe('image/jpeg');
    expect(attachment.size).toBe(6);

    const listed = await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`);
    expect(listed.status).toBe(200);
    expect(listed.headers.get('Cache-Control')).toBe('private, no-store');
    expect(((await listed.json()) as { attachments: unknown[] }).attachments).toHaveLength(1);

    // 原本は R2 から返る。中間キャッシュに残さない指定も併せて確認する。
    const content = await jsonRequest(`/attachments/${attachment.id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get('Content-Type')).toBe('image/jpeg');
    expect(content.headers.get('Cache-Control')).toBe('private, no-store');
    expect(content.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]));

    const [key] = await r2Keys();
    expect(key).toMatch(/^attachments\/default\/\d{4}-\d{2}\/[0-9a-f-]+\.jpg$/);

    const deleted = await jsonRequest(`/attachments/${attachment.id}`, 'DELETE');
    expect(deleted.status).toBe(200);
    expect(await r2Keys()).toEqual([]);
    // メタデータだけでなく原本も消える(孤児オブジェクトを残さない)
    expect(await files.get(key)).toBeNull();
  });

  it('取込明細にも同じ経路で添付でき、一覧に件数が出る', async () => {
    const txId = await seedMfTransaction();
    expect((await upload(txId)).status).toBe(201);

    const listed = await jsonRequest('/transactions');
    expect(listed.status).toBe(200);
    const { transactions } = (await listed.json()) as {
      transactions: { id: string; attachmentCount: number }[];
    };
    expect(transactions.find((t) => t.id === txId)?.attachmentCount).toBe(1);
  });

  it('安定ID付きMF CSVを変更再取込しても、同じIDの証憑件数と原本を保つ', async () => {
    const txId = 'mf-stable-reimport';
    const csv = (amount: number, description: string) =>
      [
        '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
        `1,2026/07/12,-${amount},架空費,架空内訳,0,${description},${txId},架空口座`,
      ].join('\n');

    const firstImport = await importMfCsv(csv(3100, '架空の取込前'), 'mf-stable-before.csv');
    expect(firstImport.status).toBe(200);
    expect((await firstImport.json()) as unknown).toMatchObject({ results: [{ status: 'committed' }] });

    const uploaded = await upload(txId, { bytes: [7, 8, 9, 10] });
    expect(uploaded.status).toBe(201);
    const { attachment } = (await uploaded.json()) as { attachment: { id: number } };

    const secondImport = await importMfCsv(csv(3600, '架空の取込後'), 'mf-stable-after.csv');
    expect(secondImport.status).toBe(200);
    expect((await secondImport.json()) as unknown).toMatchObject({ results: [{ status: 'committed' }] });

    const listed = await jsonRequest('/transactions?month=2026-07');
    const { transactions } = (await listed.json()) as {
      transactions: { id: string; description: string; amount: number; attachmentCount: number }[];
    };
    expect(transactions.find((transaction) => transaction.id === txId)).toMatchObject({
      description: '架空の取込後',
      amount: -3600,
      attachmentCount: 1,
    });
    const content = await jsonRequest(`/attachments/${attachment.id}/content`);
    expect(content.status).toBe(200);
    expect(new Uint8Array(await content.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff, 7, 8, 9, 10]),
    );
  });

  it('ID列がないMF明細は再取込で同一性を保証できないため新規添付を拒否する', async () => {
    const txId = await seedMfTransaction('2026-07_4_-5000', false);
    const rejected = await upload(txId);
    expect(rejected.status).toBe(409);
    expect((await rejected.json()) as unknown).toMatchObject({
      error: { code: 'unstable_attachment_target' },
    });
    expect(await r2Keys()).toEqual([]);
  });

  it('現金の一覧にも添付件数が出る', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const listed = await jsonRequest('/cash-entries');
    const { entries } = (await listed.json()) as { entries: { id: number; attachmentCount: number }[] };
    expect(entries[0].attachmentCount).toBe(1);
  });

  it('存在しない明細への添付を拒否し、原本を残さない', async () => {
    const res = await upload('cash:999999');
    expect(res.status).toBe(404);
    expect(await r2Keys()).toEqual([]);
  });

  it('cash:予約名前空間の非正規IDを400で拒否する', async () => {
    const res = await upload('cash:not-a-number');
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_input');
    expect(await files.list({ prefix: 'attachments/' })).toMatchObject({ objects: [] });
  });

  it('許可外の形式と空ファイルを日本語の理由で拒否する', async () => {
    const target = await seedCashEntry();
    const bad = await upload(target, { name: 'note.txt', type: 'text/plain' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('unsupported_type');

    const empty = await upload(target, { bytes: [] });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { error: { code: string } }).error.code).toBe('empty_file');
    expect(await r2Keys()).toEqual([]);
  });

  it('申告MIMEと拡張子が正しくてもmagicが違うファイルを拒否する', async () => {
    const target = await seedCashEntry();
    const forged = await upload(target, {
      name: 'forged.jpg',
      type: 'image/jpeg',
      bytes: [1, 2, 3],
      raw: true,
    });
    expect(forged.status).toBe(400);
    expect(await forged.json()).toMatchObject({ error: { code: 'content_mismatch' } });
    expect(await r2Keys()).toEqual([]);
  });

  it('8MiBを1バイト超えるmultipartを実routeで400にする', async () => {
    const target = await seedCashEntry();
    const over = await upload(target, { bytes: new Array(8 * 1024 * 1024 - 2).fill(1) });
    expect(over.status).toBe(400);
    expect(await over.json()).toMatchObject({ error: { code: 'too_large' } });
    expect(await r2Keys()).toEqual([]);
  });

  it('設定可能な利用者別bytes quotaをwriter lease内で判定し、使用量を返す', async () => {
    const target = await seedCashEntry();
    const limitedEnv = { ...env(), ATTACHMENT_QUOTA_BYTES: '10' };
    expect((await upload(target, { bytes: [1, 2, 3], envBinding: limitedEnv })).status).toBe(201);
    const rejected = await upload(target, { bytes: [4, 5, 6], envBinding: limitedEnv });
    expect(rejected.status).toBe(413);
    expect(await rejected.json()).toMatchObject({
      error: { code: 'attachment_quota_exceeded' },
      usage: { usedBytes: 6, limitBytes: 10, remainingBytes: 4 },
    });
    const listed = await app.request(
      `/api/attachments?target=${encodeURIComponent(target)}`,
      { headers: { cookie } },
      limitedEnv,
    );
    expect(await listed.json()).toMatchObject({ usage: { usedBytes: 6, limitBytes: 10, remainingBytes: 4 } });
    const quota = await app.request('/api/attachments/quota', { headers: { cookie } }, limitedEnv);
    expect(quota.status).toBe(200);
    expect(await quota.json()).toEqual({
      usage: { usedBytes: 6, limitBytes: 10, remainingBytes: 4, accepted: true },
    });
  });

  it('一覧はD1がreadyでもR2原本が帯域外削除されるとoriginal_missingへfail closedし、再出現で復帰する', async () => {
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    const [key] = await r2Keys();
    const snapshot = await snapshotObject(key);
    await files.delete(key);

    const missingList = await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`);
    expect(await missingList.json()).toMatchObject({
      attachments: [{ id: attachment.id, originalAvailable: false, cleanupStage: 'original_missing' }],
    });
    const missingContent = await jsonRequest(`/attachments/${attachment.id}/content`);
    expect(missingContent.status).toBe(404);
    expect(await missingContent.json()).toEqual({
      error: { code: 'attachment_original_missing', message: '添付の原本が保管先に見つかりません' },
    });

    await restoreObject(key, snapshot);
    expect(
      await (await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`)).json(),
    ).toMatchObject({
      attachments: [{ id: attachment.id, originalAvailable: true, cleanupStage: 'none' }],
    });
    expect((await jsonRequest(`/attachments/${attachment.id}/content`)).status).toBe(200);
  });

  it('cash/classifyの添付件数はexact R2 HEADだけを数え、原本復元後に再び1へ戻る', async () => {
    const cashTarget = await seedCashEntry();
    expect((await upload(cashTarget)).status).toBe(201);
    const mfTarget = await seedMfTransaction('mf-head-count');
    expect((await upload(mfTarget, { bytes: [7, 8, 9] })).status).toBe(201);
    const keys = await r2Keys();
    const snapshots = await Promise.all(keys.map(async (key) => [key, await snapshotObject(key)] as const));
    await Promise.all(keys.map((key) => files.delete(key)));

    const cashMissing = (await (await jsonRequest('/cash-entries')).json()) as {
      entries: { attachmentCount: number }[];
    };
    expect(cashMissing.entries[0]?.attachmentCount).toBe(0);
    const mfMissing = (await (await jsonRequest('/transactions')).json()) as {
      transactions: { id: string; attachmentCount: number }[];
    };
    expect(mfMissing.transactions.find((row) => row.id === mfTarget)?.attachmentCount).toBe(0);

    await Promise.all(snapshots.map(([key, snapshot]) => restoreObject(key, snapshot)));
    const cashRestored = (await (await jsonRequest('/cash-entries')).json()) as {
      entries: { attachmentCount: number }[];
    };
    expect(cashRestored.entries[0]?.attachmentCount).toBe(1);
    const mfRestored = (await (await jsonRequest('/transactions')).json()) as {
      transactions: { id: string; attachmentCount: number }[];
    };
    expect(mfRestored.transactions.find((row) => row.id === mfTarget)?.attachmentCount).toBe(1);
  });

  it('R2 HEAD障害はmissingに偽装せずlist/orphan/content/cash/classifyを同じ503でfail closedする', async () => {
    const cashTarget = await seedCashEntry();
    const created = await upload(cashTarget);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    const mfTarget = await seedMfTransaction('mf-head-error');
    expect((await upload(mfTarget, { bytes: [4, 5, 6] })).status).toBe(201);
    await d1
      .prepare("UPDATE attachments SET parent_missing_at=? WHERE target_kind='mf' AND target_key=?")
      .bind(new Date().toISOString(), mfTarget)
      .run();
    const failedEnv = env(r2HeadFails());
    const paths = [
      `/api/attachments?target=${encodeURIComponent(cashTarget)}`,
      '/api/attachments/orphans',
      `/api/attachments/${attachment.id}/content`,
      '/api/cash-entries',
      '/api/transactions',
    ];
    for (const path of paths) {
      const response = await app.request(path, { headers: { cookie } }, failedEnv);
      expect(response.status, path).toBe(503);
      expect(await response.json(), path).toEqual({
        error: {
          code: 'attachment_availability_unavailable',
          message: '原本の保管状況を確認できません。時間をおいて再試行してください',
        },
      });
    }
  });

  it('listは901 unique active候補をHEAD前にstructured 503で拒否する', async () => {
    const target = await seedCashEntry();
    const targetKey = target.slice('cash:'.length);
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<901)
         INSERT INTO attachments
          (user_id,target_kind,target_key,r2_key,filename,content_type,size,content_hash,state,
           delete_attempts,created_at)
         SELECT 'default','cash',?,
                'attachments/default/2026-08/cap-'||n||'.jpg','cap.jpg','image/jpeg',1,
                printf('%064x',n),'ready',0,?
           FROM seq`,
      )
      .bind(targetKey, new Date().toISOString())
      .run();
    let headCalls = 0;
    const countingFiles = new Proxy(files, {
      get(bucket, property, receiver) {
        if (property === 'head')
          return async (key: string) => {
            headCalls += 1;
            return bucket.head(key);
          };
        const value = Reflect.get(bucket, property, receiver);
        return typeof value === 'function' ? value.bind(bucket) : value;
      },
    });
    const response = await app.request(
      `/api/attachments?target=${encodeURIComponent(target)}`,
      { headers: { cookie } },
      env(countingFiles),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'attachment_availability_unavailable' },
    });
    expect(headCalls).toBe(0);
  });

  it('POSTのD1 commit失敗と補償R2 DELETE失敗でもkeyを保持し、補償完了後に永久tombstoneを残さない', async () => {
    const target = await seedCashEntry();
    const response = await upload(target, {
      envBinding: env(r2DeleteFails(), attachmentInsertFails()),
    });
    expect(response.status).toBe(500);
    const job = await d1
      .prepare(
        `SELECT user_id AS userId, r2_key AS r2Key, action, reason, attempts, state
           FROM attachment_cleanup_jobs`,
      )
      .first<{
        userId: string;
        r2Key: string;
        action: string;
        reason: string;
        attempts: number;
        state: string;
      }>();
    expect(job).toMatchObject({
      userId: 'default',
      r2Key: expect.stringMatching(/^attachments\/default\//),
      action: 'delete_object',
      reason: 'upload_intent',
      state: 'retry',
    });
    expect(job && (await files.head(job.r2Key))).not.toBeNull();

    const maintenance = await runAttachmentMaintenance(env(), new Date(Date.now() + 10 * 60_000));
    expect(maintenance).toMatchObject({ selected: 1, completed: 1, retried: 0, dead: 0 });
    expect(await d1.prepare('SELECT id FROM attachment_cleanup_jobs').first()).toBeNull();
    expect(job && (await files.head(job.r2Key))).toBeNull();
    expect(await d1.prepare('SELECT COUNT(*) AS count FROM attachment_object_tombstones').first()).toEqual({
      count: 0,
    });
  });

  it('scheduled cleanupは10件bounded・43 queries以下で、grace経過+max attemptsだけdead-letter化する', async () => {
    expect(ATTACHMENT_SCHEDULED_MAX_D1_QUERIES).toBe(43);
    expect(ATTACHMENT_SCHEDULED_MAX_D1_QUERIES).toBeLessThan(50);
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    expect(
      (
        await app.request(
          `/api/attachments/${attachment.id}`,
          { method: 'DELETE', headers: { cookie } },
          env(r2DeleteFails()),
        )
      ).status,
    ).toBe(503);
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await d1
      .prepare(
        `UPDATE attachment_cleanup_jobs
            SET attempts=4,created_at=?,not_before=?
          WHERE attachment_id=?`,
      )
      .bind(old, old, attachment.id)
      .run();
    const maintenance = await runAttachmentMaintenance(env(r2DeleteFails()), new Date());
    expect(maintenance).toMatchObject({ selected: 1, dead: 1 });
    expect(
      await d1
        .prepare('SELECT state FROM attachment_cleanup_jobs WHERE attachment_id=?')
        .bind(attachment.id)
        .first(),
    ).toEqual({ state: 'dead' });
    expect(
      await d1
        .prepare('SELECT cleanup_dead_letter_at AS at FROM attachments WHERE id=?')
        .bind(attachment.id)
        .first(),
    ).toMatchObject({ at: expect.any(String) });
  });

  it('Cronはcleanupとbackupを独立実行し、cleanup障害時もbackupを完了してcount-onlyで失敗を透過する', async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((message) => logs.push(String(message)));
    const error = vi.spyOn(console, 'error').mockImplementation((message) => errors.push(String(message)));
    try {
      await scheduledMaintenance(env());
      const summary = logs
        .map((entry) => JSON.parse(entry) as Record<string, unknown>)
        .find((entry) => entry.job === 'attachment_maintenance');
      expect(summary).toEqual({
        level: 'info',
        job: 'attachment_maintenance',
        selected: 0,
        completed: 0,
        retried: 0,
        dead: 0,
        importJobsEnqueued: 0,
      });
      const loginRateLimitSummary = logs
        .map((entry) => JSON.parse(entry) as Record<string, unknown>)
        .find((entry) => entry.job === 'password_login_rate_limit_cleanup');
      expect(loginRateLimitSummary).toEqual({
        level: 'info',
        job: 'password_login_rate_limit_cleanup',
        deleted: 0,
      });

      const backupKey = `backups/${new Date().toISOString().slice(0, 10)}.json`;
      await files.delete(backupKey);
      await expect(scheduledMaintenance(env(files, maintenanceEnqueueFails()))).rejects.toThrow(
        'scheduled_maintenance_failed',
      );
      expect(await files.head(backupKey)).not.toBeNull();
      const failure = errors
        .map((entry) => JSON.parse(entry) as Record<string, unknown>)
        .find((entry) => entry.job === 'attachment_maintenance');
      expect(failure).toEqual({ level: 'error', job: 'attachment_maintenance', name: 'Error' });
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it('30日を過ぎたfailed・duplicate・完全supersededだけを削除し、partial/shared-active原本を保って永久tombstoneを作らない', async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const keys = {
      failed: 'uploads/default/synthetic-failed.csv',
      duplicate: 'uploads/default/synthetic-duplicate.csv',
      superseded: 'uploads/default/synthetic-superseded.csv',
      partial: 'uploads/default/synthetic-partial.csv',
      sharedActive: 'uploads/default/synthetic-shared-active.csv',
    };
    await Promise.all(Object.values(keys).map((key) => files.put(key, 'synthetic')));
    await d1
      .prepare(
        `INSERT INTO imports (id,user_id,filename,kind,status,r2_key,created_at)
         VALUES
          (1,'default','failed.csv','mf','failed',?,?),
          (2,'default','duplicate.csv','mf','duplicate',?,?),
          (3,'default','superseded-a.csv','mf','committed',?,?),
          (4,'default','partial.csv','mf','committed',?,?),
          (5,'default','shared-failed.csv','mf','failed',?,?),
          (6,'default','shared-active.csv','mf','committed',?,?),
          (7,'default','superseded-b.csv','mf','committed',?,?)`,
      )
      .bind(
        keys.failed,
        old,
        keys.duplicate,
        old,
        keys.superseded,
        old,
        keys.partial,
        old,
        keys.sharedActive,
        old,
        keys.sharedActive,
        old,
        keys.superseded,
        old,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default','mf:2026-01','partial',4,?),
                ('default','mf:2026-02','shared',6,?)`,
      )
      .bind(old, old)
      .run();
    const first = await runAttachmentMaintenance(env(), new Date());
    expect(first.importJobsEnqueued).toBe(3);
    expect(first.completed).toBe(3);
    expect(
      await Promise.all([files.head(keys.failed), files.head(keys.duplicate), files.head(keys.superseded)]),
    ).toEqual([null, null, null]);
    expect(await files.head(keys.partial)).not.toBeNull();
    expect(await files.head(keys.sharedActive)).not.toBeNull();
    const rows = await d1.prepare('SELECT id,r2_key AS r2Key FROM imports ORDER BY id').all<{
      id: number;
      r2Key: string | null;
    }>();
    expect(rows.results).toEqual([
      { id: 1, r2Key: null },
      { id: 2, r2Key: null },
      { id: 3, r2Key: null },
      { id: 4, r2Key: keys.partial },
      { id: 5, r2Key: keys.sharedActive },
      { id: 6, r2Key: keys.sharedActive },
      { id: 7, r2Key: null },
    ]);
    expect(await d1.prepare('SELECT COUNT(*) AS count FROM attachment_object_tombstones').first()).toEqual({
      count: 0,
    });
  });

  it('同じ明細への同一内容の再送を409で弾く(撮り直しの二重登録を防ぐ)', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const again = await upload(target, { name: 'copy.jpg' });
    expect(again.status).toBe(409);
    expect(await r2Keys()).toHaveLength(1);

    // 中身が違えば同じ明細にも追加できる
    expect((await upload(target, { bytes: [9, 9, 9, 9] })).status).toBe(201);
    expect(await r2Keys()).toHaveLength(2);
  });

  it('generic MIMEでもrawの長いファイル名から拡張子を解決した後に無害化する', async () => {
    const target = await seedCashEntry();
    const rawName = `${'a'.repeat(100)}.pdf`;
    const created = await upload(target, {
      name: rawName,
      type: 'application/octet-stream',
      bytes: [4, 5, 6],
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      attachment: { filename: string; contentType: string; state: string };
    };
    expect(body.attachment.filename).toHaveLength(80);
    expect(body.attachment.contentType).toBe('application/pdf');
    expect(body.attachment.state).toBe('ready');
  });

  it('1明細の上限を超えたら受け付けない', async () => {
    const target = await seedCashEntry();
    for (let i = 0; i < 10; i += 1) {
      expect((await upload(target, { bytes: [i, i + 1] })).status).toBe(201);
    }
    const over = await upload(target, { bytes: [200, 201] });
    expect(over.status).toBe(409);
    expect(((await over.json()) as { error: { code: string } }).error.code).toBe('too_many');
    expect(await r2Keys()).toHaveLength(10);
  });

  it('上限直前の並行POSTでも10件を超えない', async () => {
    const target = await seedCashEntry();
    for (let i = 0; i < 9; i += 1) {
      expect((await upload(target, { bytes: [i, i + 1, i + 2] })).status).toBe(201);
    }
    const responses = await Promise.all([
      upload(target, { bytes: [101, 102, 103] }),
      upload(target, { bytes: [111, 112, 113] }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await r2Keys()).toHaveLength(10);
  });

  it('R2削除失敗を再試行状態で残し、同じDELETEで完了できる', async () => {
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    const failed = await app.request(
      `/api/attachments/${attachment.id}`,
      { method: 'DELETE', headers: { cookie } },
      env(r2DeleteFails()),
    );
    expect(failed.status).toBe(503);
    expect((await failed.json()) as unknown).toMatchObject({
      error: { code: 'attachment_delete_failed', retryable: true },
    });
    expect(
      await d1
        .prepare(
          'SELECT state, delete_attempts AS deleteAttempts, last_delete_error AS lastDeleteError FROM attachments WHERE id=?',
        )
        .bind(attachment.id)
        .first(),
    ).toMatchObject({ state: 'delete_failed', deleteAttempts: 1, lastDeleteError: 'r2_delete_failed' });

    const listed = await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`);
    expect((await listed.json()) as unknown).toMatchObject({
      attachments: [{ id: attachment.id, state: 'delete_failed', retryable: true }],
    });
    const cashList = (await (await jsonRequest('/cash-entries')).json()) as {
      entries: { id: number; attachmentCount: number }[];
    };
    expect(cashList.entries[0]?.attachmentCount).toBe(1);

    expect((await jsonRequest(`/attachments/${attachment.id}`, 'DELETE')).status).toBe(200);
    expect(await r2Keys()).toEqual([]);
  });

  it('R2削除成功後のD1 cleanup失敗は専用メッセージを返し、削除fact後の同key再出現を復活表示せず再削除する', async () => {
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    const [key] = await r2Keys();
    const originalSnapshot = await snapshotObject(key);

    const failed = await app.request(
      `/api/attachments/${attachment.id}`,
      { method: 'DELETE', headers: { cookie } },
      env(files, attachmentRowDeleteFailsOnce()),
    );
    expect(failed.status).toBe(503);
    expect(await failed.clone().json()).toEqual({
      error: {
        code: 'attachment_delete_failed',
        message: '原本は削除済みですが、管理情報を整理できませんでした。時間をおいて再試行してください',
        retryable: true,
      },
    });
    expect(await files.get(key)).toBeNull();
    expect(
      await d1
        .prepare(
          'SELECT state, object_deleted_at AS objectDeletedAt, last_delete_error AS lastDeleteError FROM attachments WHERE id=?',
        )
        .bind(attachment.id)
        .first(),
    ).toMatchObject({
      state: 'delete_failed',
      objectDeletedAt: expect.any(String),
      lastDeleteError: 'd1_delete_failed_after_r2',
    });

    const listed = await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`);
    expect(await listed.json()).toMatchObject({
      attachments: [
        {
          id: attachment.id,
          originalAvailable: false,
          cleanupStage: 'metadata_delete_pending',
          retryable: true,
        },
      ],
    });
    const cashList = (await (await jsonRequest('/cash-entries')).json()) as {
      entries: { attachmentCount: number }[];
    };
    expect(cashList.entries[0]?.attachmentCount).toBe(0);
    expect((await jsonRequest(`/attachments/${attachment.id}/content`)).status).toBe(410);

    await restoreObject(key, originalSnapshot);
    expect(
      await (await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`)).json(),
    ).toMatchObject({
      attachments: [{ id: attachment.id, originalAvailable: false, cleanupStage: 'metadata_delete_pending' }],
    });
    expect((await jsonRequest(`/attachments/${attachment.id}/content`)).status).toBe(410);
    const cashAfterReappearance = (await (await jsonRequest('/cash-entries')).json()) as {
      entries: { attachmentCount: number }[];
    };
    expect(cashAfterReappearance.entries[0]?.attachmentCount).toBe(0);

    expect((await jsonRequest(`/attachments/${attachment.id}`, 'DELETE')).status).toBe(200);
    expect(await files.head(key)).toBeNull();
    expect(await r2Keys()).toEqual([]);
  });

  it('MF orphan一覧もexact R2 HEADで帯域外欠損をoriginal_missingとし、R2再出現で復帰する', async () => {
    const txId = 'mf-orphan-recovery';
    const csv = (id: string) =>
      [
        '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
        `1,2026/07/12,-3100,架空費,架空内訳,0,架空の取込,${id},架空口座`,
      ].join('\n');

    expect((await importMfCsv(csv(txId), 'mf-orphan-before.csv')).status).toBe(200);
    const uploaded = await upload(txId);
    const { attachment } = (await uploaded.json()) as { attachment: { id: number } };

    expect((await importMfCsv(csv('mf-replacement'), 'mf-orphan-replaced.csv')).status).toBe(200);
    const orphans = await jsonRequest('/attachments/orphans');
    expect(orphans.status).toBe(200);
    expect(await orphans.json()).toMatchObject({
      attachments: [{ id: attachment.id, orphaned: true, originalAvailable: true, targetId: txId }],
    });
    expect((await jsonRequest(`/attachments/${attachment.id}/content`)).status).toBe(200);

    const [key] = await r2Keys();
    const snapshot = await snapshotObject(key);
    await files.delete(key);
    expect(await (await jsonRequest('/attachments/orphans')).json()).toMatchObject({
      attachments: [{ id: attachment.id, originalAvailable: false, cleanupStage: 'original_missing' }],
    });
    await restoreObject(key, snapshot);
    expect(await (await jsonRequest('/attachments/orphans')).json()).toMatchObject({
      attachments: [{ id: attachment.id, originalAvailable: true }],
    });

    expect((await importMfCsv(csv(txId), 'mf-orphan-returned.csv')).status).toBe(200);
    expect(await (await jsonRequest('/attachments/orphans')).json()).toMatchObject({ attachments: [] });
    expect(await (await jsonRequest(`/attachments?target=${encodeURIComponent(txId)}`)).json()).toMatchObject(
      {
        attachments: [{ id: attachment.id, orphaned: false }],
      },
    );
  });

  it('delete_pendingでrequestが中断しても一覧から削除を再開できる', async () => {
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    await d1
      .prepare("UPDATE attachments SET state='delete_pending', delete_attempts=1 WHERE id=?")
      .bind(attachment.id)
      .run();

    const listed = await jsonRequest(`/attachments?target=${encodeURIComponent(target)}`);
    expect((await listed.json()) as unknown).toMatchObject({
      attachments: [
        {
          id: attachment.id,
          state: 'delete_pending',
          originalAvailable: true,
          cleanupStage: 'object_delete_pending',
          retryable: true,
        },
      ],
    });
    expect((await jsonRequest(`/attachments/${attachment.id}/content`)).status).toBe(200);
    expect((await jsonRequest(`/attachments/${attachment.id}`, 'DELETE')).status).toBe(200);
    expect(await r2Keys()).toEqual([]);
  });

  it('親記帳の削除はR2失敗時に親と集計を保ち、再試行成功時にまとめて反映する', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const id = Number(target.slice('cash:'.length));
    const [key] = await r2Keys();

    const failed = await app.request(
      `/api/cash-entries/${id}`,
      { method: 'DELETE', headers: { cookie } },
      env(r2DeleteFails()),
    );
    expect(failed.status).toBe(503);
    expect((await failed.json()) as unknown).toMatchObject({
      error: { code: 'attachment_delete_failed', retryable: true },
    });
    expect(
      await d1.prepare('SELECT id FROM cash_entries WHERE id=?').bind(id).first<{ id: number }>(),
    ).toEqual({ id });
    expect(
      await d1
        .prepare('SELECT state FROM attachments WHERE target_kind=? AND target_key=?')
        .bind('cash', String(id))
        .first<{ state: string }>(),
    ).toEqual({ state: 'delete_failed' });
    const aggregateBeforeRetry = await d1
      .prepare('SELECT amount FROM monthly_agg WHERE user_id=? AND month=? AND scope=?')
      .bind('default', '2026-07', 'biz_exp:架空会議費')
      .first<{ amount: number }>();
    expect(aggregateBeforeRetry?.amount).toBe(1200);

    expect((await jsonRequest(`/cash-entries/${id}`, 'DELETE')).status).toBe(200);
    expect(await d1.prepare('SELECT id FROM cash_entries WHERE id=?').bind(id).first()).toBeNull();
    expect(
      await d1
        .prepare('SELECT id FROM attachments WHERE target_kind=? AND target_key=?')
        .bind('cash', String(id))
        .first(),
    ).toBeNull();
    expect(await files.get(key)).toBeNull();
    const aggregateAfterRetry = await d1
      .prepare('SELECT amount FROM monthly_agg WHERE user_id=? AND month=? AND scope=?')
      .bind('default', '2026-07', 'biz_exp:架空会議費')
      .first<{ amount: number }>();
    expect(aggregateAfterRetry?.amount ?? 0).toBe(0);
  });

  it('R2成功後の親削除batch失敗は親・pending添付・旧集計を保ち、同じDELETEで収束する', async () => {
    const target = await seedCashEntry();
    const id = Number(target.slice('cash:'.length));
    expect((await upload(target)).status).toBe(201);
    const [key] = await r2Keys();
    const other = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-20',
      side: 'biz',
      io: 'expense',
      amount: 300,
      description: '架空の残存記帳',
      big: '架空会議費',
      mid: '',
      memo: null,
    });
    expect(other.status).toBe(201);
    expect(
      await d1
        .prepare('SELECT amount FROM monthly_agg WHERE user_id=? AND month=? AND scope=?')
        .bind('default', '2026-07', 'biz_exp:架空会議費')
        .first(),
    ).toEqual({ amount: 1500 });

    // 多数の正規化差分があっても、親削除batchでは1 UPDATEにまとまる。
    await d1
      .prepare("INSERT INTO account_norm_map (user_id,raw,norm) VALUES ('default','架空旧科目','架空新科目')")
      .run();
    await d1
      .prepare(
        `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 100)
         INSERT INTO freee_deals (user_id,month,date,io,account_raw,account_norm,amount)
         SELECT 'default','2026-07','2026-07-01','expense','架空旧科目','古い値',n FROM seq`,
      )
      .run();

    const observed = finalCashBatchFailsOnce();
    const failed = await app.request(
      `/api/cash-entries/${id}`,
      { method: 'DELETE', headers: { cookie } },
      env(files, observed.database),
    );
    expect(failed.status).toBe(500);
    expect(await files.get(key)).toBeNull();
    expect(await d1.prepare('SELECT id FROM cash_entries WHERE id=?').bind(id).first()).toEqual({ id });
    expect(
      await d1
        .prepare('SELECT state FROM attachments WHERE target_kind=? AND target_key=?')
        .bind('cash', String(id))
        .first(),
    ).toEqual({ state: 'delete_pending' });
    expect(
      await d1
        .prepare('SELECT amount FROM monthly_agg WHERE user_id=? AND month=? AND scope=?')
        .bind('default', '2026-07', 'biz_exp:架空会議費')
        .first(),
    ).toEqual({ amount: 1500 });

    const failedBatchSql = observed.failedBatchSql().map((query) => query.trim().toLowerCase());
    expect(failedBatchSql.some((query) => query.startsWith('delete from "cash_entries"'))).toBe(true);
    expect(failedBatchSql.some((query) => query.startsWith('delete from "attachments"'))).toBe(true);
    expect(failedBatchSql.some((query) => query.startsWith('delete from "monthly_agg"'))).toBe(true);
    expect(failedBatchSql.some((query) => query.startsWith('insert into "monthly_agg"'))).toBe(true);
    expect(failedBatchSql.filter((query) => query.startsWith('update "freee_deals"'))).toHaveLength(1);

    expect((await jsonRequest(`/cash-entries/${id}`, 'DELETE')).status).toBe(200);
    expect(await d1.prepare('SELECT id FROM cash_entries WHERE id=?').bind(id).first()).toBeNull();
    expect(
      await d1
        .prepare('SELECT id FROM attachments WHERE target_kind=? AND target_key=?')
        .bind('cash', String(id))
        .first(),
    ).toBeNull();
    expect(
      await d1
        .prepare('SELECT amount FROM monthly_agg WHERE user_id=? AND month=? AND scope=?')
        .bind('default', '2026-07', 'biz_exp:架空会議費')
        .first(),
    ).toEqual({ amount: 300 });
  });

  it('exportは添付を復元データと誤認させず、棚卸archiveとして返す', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const exportedResponse = await jsonRequest('/export/json');
    expect(exportedResponse.status).toBe(200);
    const exported = (await exportedResponse.json()) as Record<string, unknown> & {
      attachmentArchive: {
        version: number;
        basis: string;
        restoreCapable: boolean;
        records: { target: { kind: string; key: string }; state: string }[];
      };
    };
    expect(Object.hasOwn(exported, 'attachments')).toBe(false);
    expect(exported.attachmentArchive).toMatchObject({
      version: 1,
      basis: 'inventory-only',
      restoreCapable: false,
      records: [{ target: { kind: 'cash', key: target.slice('cash:'.length) }, state: 'ready' }],
    });

    const preparedSql: string[] = [];
    const observedDb = new Proxy(d1, {
      get(database, property, receiver) {
        if (property === 'prepare') {
          return (sql: string) => {
            preparedSql.push(sql);
            return database.prepare(sql);
          };
        }
        const value = Reflect.get(database, property, receiver);
        return typeof value === 'function' ? value.bind(database) : value;
      },
    });
    await loadBackupPayload(getDb(observedDb), 'default');
    expect(preparedSql).toHaveLength(1);
    expect(preparedSql[0]).toContain("SELECT 'attachment'");
  });

  it('archiveをowner/key/hash/sizeで棚卸し、same-bucket原本がある行だけmetadataを再結合する', async () => {
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    const exported = (await (await jsonRequest('/export/json')).json()) as {
      attachmentArchive: { version: 1; basis: string; records: Record<string, unknown>[] };
    };
    await d1.prepare('DELETE FROM attachments WHERE id=?').bind(attachment.id).run();

    const reconcile = await jsonRequest('/attachments/archive/reconcile', 'POST', {
      attachmentArchive: exported.attachmentArchive,
    });
    expect(reconcile.status).toBe(200);
    expect(await reconcile.json()).toMatchObject({
      ok: true,
      report: { metadataMissing: 1, missing: 0, mismatch: 0 },
    });

    const recovered = await jsonRequest('/attachments/archive/recover', 'POST', {
      confirm: true,
      attachmentArchive: exported.attachmentArchive,
    });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ ok: true, recovered: 1, alreadyPresent: 0 });
    const restoredRow = await d1.prepare('SELECT id FROM attachments').first<{ id: number }>();
    expect(restoredRow?.id).toBeGreaterThan(0);
    expect((await jsonRequest(`/attachments/${restoredRow?.id}/content`)).status).toBe(200);

    await d1
      .prepare('UPDATE attachments SET delete_requested_at=? WHERE id=?')
      .bind(new Date().toISOString(), restoredRow?.id)
      .run();
    const [record] = exported.attachmentArchive.records;
    const deletionIntent = await jsonRequest('/attachments/archive/reconcile', 'POST', {
      attachmentArchive: {
        ...exported.attachmentArchive,
        records: [record, { ...record, r2Key: 'attachments/default/2026-07/same-content-alternate-key.jpg' }],
      },
    });
    expect(deletionIntent.status).toBe(200);
    expect(await deletionIntent.json()).toMatchObject({
      report: { matched: 0, metadataMissing: 0, skipped: 2 },
    });
  });

  it('D1 metadataが存在してもexact R2欠損・実byte改変をmatchedにしない', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const exported = (await (await jsonRequest('/export/json')).json()) as {
      attachmentArchive: { version: 1; basis: string; records: Record<string, unknown>[] };
    };
    const [record] = exported.attachmentArchive.records;
    const key = String(record?.r2Key);
    await files.delete(key);
    const missing = await jsonRequest('/attachments/archive/reconcile', 'POST', {
      attachmentArchive: exported.attachmentArchive,
    });
    expect(await missing.json()).toMatchObject({ report: { matched: 0, missing: 1 } });

    const changed = new Uint8Array([0xff, 0xd8, 0xff, 9, 9, 9]);
    await files.put(key, changed, {
      customMetadata: { ownerId: 'default', contentHash: String(record?.contentHash) },
    });
    const mismatch = await jsonRequest('/attachments/archive/reconcile', 'POST', {
      attachmentArchive: exported.attachmentArchive,
    });
    expect(await mismatch.json()).toMatchObject({ report: { matched: 0, mismatch: 1 } });
  });

  it('archive consumerは10件boundedで、11件一括をrouteで拒否する', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const exported = (await (await jsonRequest('/export/json')).json()) as {
      attachmentArchive: { version: 1; basis: string; records: Record<string, unknown>[] };
    };
    const [record] = exported.attachmentArchive.records;
    const rejected = await jsonRequest('/attachments/archive/reconcile', 'POST', {
      attachmentArchive: { ...exported.attachmentArchive, records: Array.from({ length: 11 }, () => record) },
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: { code: 'invalid_attachment_archive' } });
  });

  it('archive recoverは実byte検証後にscheduled tombstoneが確定してもready metadataを挿入しない', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const exported = (await (await jsonRequest('/export/json')).json()) as {
      attachmentArchive: { version: 1; basis: string; records: Record<string, unknown>[] };
    };
    const key = String(exported.attachmentArchive.records[0]?.r2Key);
    await d1.prepare('DELETE FROM attachments').run();
    const recovered = await app.request(
      '/api/attachments/archive/recover',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true, attachmentArchive: exported.attachmentArchive }),
      },
      env(archiveCleanupCompletesAfterRead(key)),
    );
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({
      ok: true,
      recovered: 0,
      skipped: 1,
      report: { metadataMissing: 0, skipped: 1 },
    });
    expect(await d1.prepare('SELECT id FROM attachments').first()).toBeNull();
    expect(await files.head(key)).toBeNull();
  });

  it('archiveの一致原本だけ部分復元し、欠損・他owner・hash/size不一致は成功扱いにしない', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    expect((await upload(target, { bytes: [7, 8, 9, 10] })).status).toBe(201);
    const exported = (await (await jsonRequest('/export/json')).json()) as {
      attachmentArchive: { version: 1; basis: string; records: Record<string, unknown>[] };
    };
    const [missingRecord, validRecord] = exported.attachmentArchive.records;
    await d1.prepare('DELETE FROM attachments').run();
    await files.delete(String(missingRecord?.r2Key));
    const validObject = await files.get(String(validRecord?.r2Key));
    if (!validObject) throw new Error('synthetic archive fixture missing');
    const duplicateKey = 'attachments/default/2026-07/archive-duplicate.jpg';
    await files.put(duplicateKey, await validObject.arrayBuffer(), {
      customMetadata: {
        ownerId: 'default',
        contentHash: String(validRecord?.contentHash),
      },
    });
    const invalidArchive = {
      ...exported.attachmentArchive,
      records: [
        missingRecord,
        validRecord,
        { ...validRecord, r2Key: duplicateKey },
        { ...missingRecord, r2Key: 'attachments/other/2026-07/not-owned.jpg' },
      ],
    };

    const recovered = await jsonRequest('/attachments/archive/recover', 'POST', {
      confirm: true,
      attachmentArchive: invalidArchive,
    });
    expect(recovered.status).toBe(409);
    expect(await recovered.json()).toMatchObject({
      ok: false,
      error: { code: 'attachment_archive_incomplete' },
      recovered: 1,
      skipped: 1,
      report: { missing: 1, mismatch: 1, skipped: 1 },
    });
    expect(await d1.prepare('SELECT COUNT(*) AS count FROM attachments').first()).toEqual({ count: 1 });
    const recoveredKey = await d1.prepare('SELECT r2_key AS r2Key FROM attachments').first();
    expect(recoveredKey).toEqual({ r2Key: validRecord?.r2Key });
  });

  it('記帳を削除すると証憑も原本ごと消える', async () => {
    const target = await seedCashEntry();
    expect((await upload(target)).status).toBe(201);
    const [key] = await r2Keys();

    const id = Number(target.slice('cash:'.length));
    expect((await jsonRequest(`/cash-entries/${id}`, 'DELETE')).status).toBe(200);
    expect(await r2Keys()).toEqual([]);
    expect(await files.get(key)).toBeNull();
  });

  it('未認証では一覧も原本も取れない', async () => {
    const target = await seedCashEntry();
    const created = await upload(target);
    const { attachment } = (await created.json()) as { attachment: { id: number } };
    const anonymous = await app.request(`/api/attachments/${attachment.id}/content`, {}, env());
    expect(anonymous.status).toBe(401);
    expect((await app.request('/api/attachments?target=cash:1', {}, env())).status).toBe(401);
  });
});

describe('交通費の記帳', () => {
  it('区間と往復を保存し、金額は集計にも反映される', async () => {
    expect(
      (await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空旅費交通費' })).status,
    ).toBe(201);
    const created = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-12',
      side: 'biz',
      io: 'expense',
      amount: 460,
      description: '電車代 架空駅A→架空駅B(往復)',
      big: '架空旅費交通費',
      mid: '',
      memo: null,
      transitFrom: '架空駅A',
      transitTo: '架空駅B',
      transitRound: true,
      receiptWaived: true,
    });
    expect(created.status).toBe(201);
    const { entry } = (await created.json()) as {
      entry: { transitFrom: string; transitTo: string; transitRound: boolean; receiptWaived: boolean };
    };
    expect(entry).toMatchObject({
      transitFrom: '架空駅A',
      transitTo: '架空駅B',
      transitRound: true,
      receiptWaived: true,
    });

    const agg = await d1
      .prepare('SELECT amount FROM monthly_agg WHERE user_id = ? AND month = ? AND scope = ?')
      .bind('default', '2026-07', 'biz_exp:架空旅費交通費')
      .first<{ amount: number }>();
    expect(agg?.amount).toBe(460);
  });

  it('出発地だけの入力を日本語の理由で拒否する', async () => {
    expect(
      (await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空旅費交通費' })).status,
    ).toBe(201);
    const res = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-12',
      side: 'biz',
      io: 'expense',
      amount: 230,
      description: '電車代',
      big: '架空旅費交通費',
      mid: '',
      memo: null,
      transitFrom: '架空駅A',
      transitTo: null,
      transitRound: false,
      receiptWaived: true,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('出発地と到着地');
  });

  it('通常記帳で証憑不要だけを指定する入力を400で拒否する', async () => {
    expect(
      (await jsonRequest('/category-options', 'POST', { scope: 'biz', major: '架空会議費' })).status,
    ).toBe(201);
    const res = await jsonRequest('/cash-entries', 'POST', {
      date: '2026-07-12',
      side: 'biz',
      io: 'expense',
      amount: 1200,
      description: '通常の架空支払い',
      big: '架空会議費',
      mid: '',
      memo: null,
      receiptWaived: true,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain('証憑不要');
  });

  it('D1直接のinsert/updateも不正な交通費状態をCHECKで拒否する', async () => {
    const insert = d1
      .prepare(
        `INSERT INTO cash_entries
         (user_id,date,month,side,io,amount,description,category_major,category_mid,memo,
          transit_from,transit_to,transit_round,receipt_waived,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        'default',
        '2026-07-12',
        '2026-07',
        'biz',
        'expense',
        1200,
        '架空支払い',
        '架空会議費',
        '',
        null,
        null,
        null,
        0,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    await expect(insert.run()).rejects.toThrow(/CHECK constraint failed/i);

    const target = await seedCashEntry();
    const id = Number(target.slice('cash:'.length));
    await expect(
      d1.prepare('UPDATE cash_entries SET receipt_waived=1 WHERE id=?').bind(id).run(),
    ).rejects.toThrow(/CHECK constraint failed/i);
  });
});
