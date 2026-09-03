/**
 * 操作の記録(監査ログ)の回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空の明細だけで検証する。
 *
 * 見張っているのは3つ。
 *   1. 消した・戻したが両方とも記録に残ること
 *   2. 記録に明細の内容・金額・明細IDが出ないこと(DR-9)
 *      履歴はブラウザの履歴にも残る。ここを窓にして明細を持ち出せてはいけない。
 *   3. 他の利用者の記録が1件も見えないこと
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';

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

const env = () => ({ ...auth, DB: d1, FILES: files });

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
  await recordTestMigrationHead(database, filenames);
}

const jsonRequest = async (path: string, method = 'GET', body?: unknown): Promise<Response> =>
  app.request(
    `/api${path}`,
    {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env(),
  );

const MF_HEADER = '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関';

/** 6月2件・7月1件。すべて架空。 */
const SEED_CSV = [
  MF_HEADER,
  '1,2026/06/10,-1000,架空費,架空内訳,0,架空の支払い6a,tx-jun-a,架空口座',
  '1,2026/06/20,-2000,架空費,架空内訳,0,架空の支払い6b,tx-jun-b,架空口座',
  '1,2026/07/05,-3000,架空費,架空内訳,0,架空の支払い7a,tx-jul-a,架空口座',
].join('\n');

async function importSeed(): Promise<void> {
  const form = new FormData();
  form.append('file', new File([SEED_CSV], 'mf-seed.csv', { type: 'text/csv' }));
  const response = await app.request(
    '/api/imports',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(response.status).toBe(200);
}

interface OperationBody {
  id: string;
  kind: string;
  granularity: string;
  counts: Record<string, number>;
  undone: boolean;
  expiresAt: string | null;
  createdAt: string;
  result: 'succeeded' | 'failed' | 'rejected';
}

const operations = async (): Promise<OperationBody[]> => {
  const response = await jsonRequest('/data/operations');
  expect(response.status).toBe(200);
  return ((await response.json()) as { operations: OperationBody[] }).operations;
};

/** 期間削除を1回実行し、その operationId を返す。 */
async function deletePeriod(from: string, to: string): Promise<string> {
  const request = { granularity: 'period', period: { from, to } };
  const preflight = await jsonRequest('/data/deletions/preflight', 'POST', request);
  expect(preflight.status).toBe(200);
  const { fingerprint } = (await preflight.json()) as { fingerprint: string };
  const response = await jsonRequest('/data/deletions', 'POST', { ...request, fingerprint });
  expect(response.status).toBe(200);
  return ((await response.json()) as { operationId: string }).operationId;
}

/** 明細を名指しで消す。範囲の指定に明細IDが入る経路を作るために使う。 */
async function deleteTransactions(txIds: string[]): Promise<string> {
  const request = { granularity: 'transaction', txIds };
  const preflight = await jsonRequest('/data/deletions/preflight', 'POST', request);
  expect(preflight.status).toBe(200);
  const { fingerprint } = (await preflight.json()) as { fingerprint: string };
  const response = await jsonRequest('/data/deletions', 'POST', { ...request, fingerprint });
  expect(response.status).toBe(200);
  return ((await response.json()) as { operationId: string }).operationId;
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'audit-log-test',
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
  const tables = await d1
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  for (const { name } of tables.results.filter(({ name }) => isApplicationTableForTestReset(name)))
    await d1.prepare(`DELETE FROM "${name}"`).run();
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
  expect(login.status).toBe(200);
});

afterAll(async () => {
  await mf?.dispose();
});

describe('何が記録に残るか', () => {
  it('消した操作が、粒度と件数と取り消し期限つきで残る', async () => {
    await importSeed();
    const operationId = await deletePeriod('2026-06', '2026-06');

    const [operation, ...rest] = await operations();
    expect(rest).toEqual([]);
    expect(operation.id).toBe(operationId);
    expect(operation.kind).toBe('delete');
    expect(operation.granularity).toBe('period');
    expect(operation.counts.mfTx).toBe(2);
    expect(operation.undone).toBe(false);
    expect(operation.result).toBe('succeeded');
    // 取り消せる期限が入っていないと、画面が「まだ戻せるか」を判断できない
    expect(Date.parse(operation.expiresAt ?? '')).toBeGreaterThan(Date.parse(operation.createdAt));
  });

  it('取り消した操作も別の記録として残り、元の記録に取り消し済みが立つ', async () => {
    await importSeed();
    const operationId = await deletePeriod('2026-06', '2026-06');
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);

    const rows = await operations();
    expect(rows.map((row) => row.kind).sort()).toEqual(['delete', 'undo']);
    const original = rows.find((row) => row.id === operationId);
    expect(original?.undone).toBe(true);
    await expect(
      d1.prepare("SELECT COUNT(*) AS n FROM import_deletion_operations WHERE kind='undo'").first<number>('n'),
    ).resolves.toBe(0);
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM audit_log').first<number>('n')).resolves.toBe(2);
  });

  it('新しい操作から並べる', async () => {
    await importSeed();
    const first = await deletePeriod('2026-06', '2026-06');
    const second = await deletePeriod('2026-07', '2026-07');

    const rows = await operations();
    expect(rows.map((row) => row.id).slice(0, 2)).toEqual([second, first]);
  });

  it('取込単位の取り消しも記録に残る', async () => {
    await importSeed();
    const importId = (await d1
      .prepare("SELECT id FROM imports WHERE user_id=? AND status='committed' ORDER BY id DESC LIMIT 1")
      .bind('default')
      .first<number>('id')) as number;
    const preflight = await jsonRequest(`/imports/${importId}/undo/preflight`, 'POST');
    const { fingerprint } = (await preflight.json()) as { fingerprint: string };
    expect((await jsonRequest(`/imports/${importId}/undo`, 'POST', { fingerprint })).status).toBe(200);

    const [operation] = await operations();
    expect(operation.granularity).toBe('import');
    expect(operation.counts.mfTx).toBe(3);
  });
});

describe('記録に出してはいけないもの(DR-9)', () => {
  it('明細を名指しで消しても、記録に明細IDが出ない', async () => {
    await importSeed();
    await deleteTransactions(['tx-jun-a', 'tx-jun-b']);

    const text = await (await jsonRequest('/data/operations')).text();
    // 範囲の指定(request_json)には明細IDが入る。それを応答へ出さないのがここの契約
    expect(text).not.toContain('tx-jun-a');
    expect(text).not.toContain('tx-jun-b');
    expect(text).not.toContain('requestJson');
    expect(text).not.toContain('request_json');
    // 消す前の確認に使う指紋も出さない。指紋は対象の組み合わせから作る値である
    expect(text).not.toContain('fingerprint');
    // 出るのは件数だけ
    expect(JSON.parse(text).operations[0].counts.mfTx).toBe(2);
  });

  it('明細の内容も金額も口座名も出ない', async () => {
    await importSeed();
    await deletePeriod('2026-06', '2026-06');

    const text = await (await jsonRequest('/data/operations')).text();
    expect(text).not.toContain('架空の支払い6a');
    expect(text).not.toContain('架空口座');
    expect(text).not.toContain('1000');
    expect(text).not.toContain('架空費');
  });
});

describe('他の利用者の記録', () => {
  it('1件も見えない', async () => {
    await d1
      .prepare(
        `INSERT INTO audit_log
           (id,user_id,operation_id,action,scope,counts_json,occurred_at,result)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .bind(
        'op-of-someone-else',
        'someone-else',
        'op-of-someone-else',
        'delete',
        'all',
        '{"mfTx":999}',
        new Date().toISOString(),
        'succeeded',
      )
      .run();

    expect(await operations()).toEqual([]);
  });

  it('他の利用者の削除は取り消せない(あるかどうかも教えない)', async () => {
    await d1
      .prepare(
        `INSERT INTO import_deletion_operations
           (id, user_id, kind, granularity, request_json, fingerprint, counts_json, expires_at, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        'op-of-someone-else',
        'someone-else',
        'delete',
        'all',
        '{"granularity":"all"}',
        'fp-someone-else',
        '{"mfTx":999}',
        new Date(Date.now() + 86_400_000).toISOString(),
        new Date().toISOString(),
      )
      .run();

    const response = await jsonRequest('/data/undo/op-of-someone-else', 'POST');
    expect(response.status).toBe(404);
    // 他人の記録は取り消し済みにもなっていない
    const row = await d1
      .prepare('SELECT undone_by FROM import_deletion_operations WHERE id=?')
      .bind('op-of-someone-else')
      .first<{ undone_by: string | null }>();
    expect(row?.undone_by).toBeNull();
  });
});
