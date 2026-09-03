/**
 * 退避行の夜間掃除の契約(T15)。実データは使わず、架空の明細だけで検証する。
 *
 * 見張っているのは4つ。
 *   1. 期限内の退避行は掃除で消えない。取り消しはそのまま効く。
 *   2. 期限切れの退避行は消え、そのあとの取り消しは 410 になる(DR-8)。
 *   3. 消えるのは退避行だけで、「いつ何を消したか」の記録は残る。
 *   4. 1回の実行で扱う操作数に上限があり、残りは次回が拾う。
 *      掃除済みの操作を次回が拾い直さないことも合わせて見る。
 *   5. 期限内でも、退避の総量が予算を超えたら古い世代から前倒しで捨てる(D7 の二段構え)。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DELETION_TOMBSTONE_BUDGET_BYTES, runDeletionRetention } from './deletion-retention.js';
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

/** 月ごとに1件だけの架空CSV。月を分けておくと期間指定で1件ずつ消せる */
const monthCsv = (month: string, id: string) =>
  [MF_HEADER, `1,${month}/05,-1000,架空費,架空内訳,0,架空の支払い,${id},架空口座`].join('\n');

async function importMf(body: string, name: string): Promise<void> {
  const form = new FormData();
  form.append('file', new File([body], name, { type: 'text/csv' }));
  const response = await app.request(
    '/api/imports',
    { method: 'POST', headers: { cookie }, body: form },
    env(),
  );
  expect(response.status).toBe(200);
}

/** その月の明細を消して、操作IDを返す */
async function deletePeriod(month: string): Promise<string> {
  const preflight = await jsonRequest('/data/deletions/preflight', 'POST', {
    granularity: 'period',
    period: { from: month, to: month },
  });
  const { fingerprint } = (await preflight.json()) as { fingerprint: string };
  const executed = await jsonRequest('/data/deletions', 'POST', {
    granularity: 'period',
    period: { from: month, to: month },
    fingerprint,
  });
  expect(executed.status).toBe(200);
  return ((await executed.json()) as { operationId: string }).operationId;
}

const countOf = async (table: string): Promise<number> =>
  ((await d1.prepare(`SELECT count(*) AS n FROM ${table}`).first<number>('n')) ?? 0) as number;

/** 期限を過去に倒す。30日待たずに「期限切れ」の状態を作る */
const expire = async (operationId: string, at = '2000-01-01T00:00:00.000Z'): Promise<void> => {
  await d1
    .prepare('UPDATE import_deletion_operations SET expires_at=? WHERE id=?')
    .bind(at, operationId)
    .run();
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'deletion-retention-test',
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

describe('退避行の夜間掃除', () => {
  it('期限内の退避行は消さない。取り消しはそのまま効く', async () => {
    await importMf(monthCsv('2026/06', 'tx-jun'), 'mf-jun.csv');
    const operationId = await deletePeriod('2026-06');
    expect(await countOf('import_deleted_rows')).toBeGreaterThan(0);

    const swept = await runDeletionRetention(env());

    expect(swept.metadata).toBe(0);
    expect(swept.rows).toBe(0);
    expect(await countOf('import_deleted_rows')).toBeGreaterThan(0);
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);
    expect(await countOf('mf_transactions')).toBe(1);
  });

  it('期限切れの退避行は消え、そのあとの取り消しは410になる', async () => {
    await importMf(monthCsv('2026/06', 'tx-jun'), 'mf-jun.csv');
    const operationId = await deletePeriod('2026-06');
    await expire(operationId);

    const swept = await runDeletionRetention(env());

    expect(swept.metadata).toBe(1);
    expect(swept.rows).toBeGreaterThan(0);
    expect(await countOf('import_deleted_rows')).toBe(0);
    expect(await countOf('import_deleted_targets')).toBe(0);

    const undo = await jsonRequest(`/data/undo/${operationId}`, 'POST');
    expect(undo.status).toBe(410);
    // 消した明細は戻らないままであること(掃除が消したのは退避であって本体ではない)
    expect(await countOf('mf_transactions')).toBe(0);
  });

  it('30日後はundo metadataも捨て、400日層の監査ヘッダだけを残す', async () => {
    await importMf(monthCsv('2026/06', 'tx-jun'), 'mf-jun.csv');
    const operationId = await deletePeriod('2026-06');
    await expire(operationId);

    await runDeletionRetention(env());

    expect(await countOf('import_deletion_operations')).toBe(0);
    expect(await countOf('audit_log')).toBe(1);
    const history = await jsonRequest('/data/operations');
    const { operations } = (await history.json()) as {
      operations: Array<{ id: string; undoable: boolean; expiresAt: string | null }>;
    };
    expect(operations.map((row) => row.id)).toContain(operationId);
    expect(operations.find((row) => row.id === operationId)).toMatchObject({
      undoable: false,
      expiresAt: null,
    });
  });

  it('1回で扱う件数に上限がある。残りは次回が拾い、掃除済みは拾い直さない', async () => {
    for (const [month, id] of [
      ['2026/06', 'tx-jun'],
      ['2026/07', 'tx-jul'],
      ['2026/08', 'tx-aug'],
    ] as const)
      await importMf(monthCsv(month, id), `mf-${id}.csv`);
    for (const month of ['2026-06', '2026-07', '2026-08']) await expire(await deletePeriod(month));

    // 上限1件なら、3晩に分けて片づく
    const first = await runDeletionRetention(env(), new Date().toISOString(), 1);
    expect(first.metadata).toBe(1);
    const second = await runDeletionRetention(env(), new Date().toISOString(), 1);
    expect(second.metadata).toBe(1);
    const third = await runDeletionRetention(env(), new Date().toISOString(), 1);
    expect(third.metadata).toBe(1);

    // 4晩目は何も残っていない。掃除済みの操作を拾い直さないこと
    const fourth = await runDeletionRetention(env(), new Date().toISOString(), 1);
    expect(fourth.metadata).toBe(0);
    expect(await countOf('import_deleted_rows')).toBe(0);
    expect(await countOf('import_deletion_operations')).toBe(0);
    expect(await countOf('audit_log')).toBe(3);
  });
});

describe('保管量の上限による前倒しの掃除(D7)', () => {
  it('予算内なら期限内の退避には手を付けない', async () => {
    await importMf(monthCsv('2026/06', 'tx-jun'), 'mf-jun.csv');
    const operationId = await deletePeriod('2026-06');

    const swept = await runDeletionRetention(
      env(),
      new Date().toISOString(),
      50,
      DELETION_TOMBSTONE_BUDGET_BYTES,
    );

    expect(swept.early).toBe(0);
    expect(swept.bytes).toBeGreaterThan(0);
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);
  });

  it('予算を超えたら期限内でも古い世代から捨て、新しい世代は残す', async () => {
    for (const [month, id] of [
      ['2026/06', 'tx-jun'],
      ['2026/07', 'tx-jul'],
    ] as const)
      await importMf(monthCsv(month, id), `mf-${id}.csv`);
    const older = await deletePeriod('2026-06');
    const newer = await deletePeriod('2026-07');
    // 先に消した世代の期限を手前にずらす。「古い世代」の順序を作るため
    await expire(older, '2099-01-01T00:00:00.000Z');
    await expire(newer, '2099-06-01T00:00:00.000Z');

    // 今ある退避の総量より1バイトだけ小さい予算にする。
    // 1件落とせば残量が予算を下回るので、掃除はそこで止まるはず
    const probe = await runDeletionRetention(env(), new Date().toISOString(), 50, Number.MAX_SAFE_INTEGER);
    expect(probe.early).toBe(0);
    const swept = await runDeletionRetention(env(), new Date().toISOString(), 50, probe.bytes - 1);

    expect(swept.early).toBe(1);
    // 古い世代はもう戻せない(410)。新しい世代は戻せる
    expect((await jsonRequest(`/data/undo/${older}`, 'POST')).status).toBe(410);
    expect((await jsonRequest(`/data/undo/${newer}`, 'POST')).status).toBe(200);
  });

  it('前倒しで捨てた世代は、期限内でも「戻せない」と履歴に出る', async () => {
    await importMf(monthCsv('2026/06', 'tx-jun'), 'mf-jun.csv');
    const operationId = await deletePeriod('2026-06');
    await expire(operationId, '2099-01-01T00:00:00.000Z');

    await runDeletionRetention(env(), new Date().toISOString(), 50, 1);

    const { operations } = (await (await jsonRequest('/data/operations')).json()) as {
      operations: Array<{ id: string; undoable: boolean; expiresAt: string | null }>;
    };
    const row = operations.find((op) => op.id === operationId);
    // 前倒し掃除で退避は落ちるが、期限表示のmetadataは30日まで残る。
    expect(row?.expiresAt?.startsWith('2099')).toBe(true);
    expect(row?.undoable).toBe(false);
  });
});
