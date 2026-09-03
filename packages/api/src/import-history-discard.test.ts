/** 非有効な取込履歴・共有R2原本の破棄契約。fixtureはすべて架空値。 */
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
let cookie = '';

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

const request = (path: string, body?: unknown, bucket: R2Bucket = files) =>
  app.request(
    `/api${path}`,
    {
      method: 'POST',
      headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    { ...auth, DB: d1, FILES: bucket },
  );

const history = () => app.request('/api/imports', { headers: { cookie } }, { ...auth, DB: d1, FILES: files });

const seedImport = async (input: {
  id: number;
  status: string;
  r2Key?: string | null;
  runId?: string | null;
  duplicateOf?: number | null;
  userId?: string;
}) => {
  const userId = input.userId ?? 'default';
  if (input.runId) {
    await d1
      .prepare(
        `INSERT OR IGNORE INTO import_runs
           (id,user_id,status,failure_reason,created_at,updated_at)
         VALUES (?,?,?,NULL,'2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z')`,
      )
      .bind(input.runId, userId, input.status)
      .run();
  }
  await d1
    .prepare(
      `INSERT INTO imports
         (id,user_id,filename,kind,months,row_count,status,r2_key,duplicate_of,run_id,target_keys,
          failure_reason,created_at)
       VALUES (?,?,'架空履歴.csv','mf','2026-09',0,?,?,?,?, '[]','架空の失敗理由','2026-09-01T00:00:00.000Z')`,
    )
    .bind(input.id, userId, input.status, input.r2Key ?? null, input.duplicateOf ?? null, input.runId ?? null)
    .run();
};

const preflight = async (id: number) => {
  const response = await request(`/imports/${id}/discard/preflight`);
  const body = (await response.json()) as {
    fingerprint: string;
    originalDisposition: 'delete' | 'keep_shared' | 'none';
    error?: { code: string; message: string };
  };
  return { response, body };
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'import-history-discard-test',
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
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*'",
    )
    .all<{ name: string }>();
  const resetTables = tables.results
    .filter(({ name }) => isApplicationTableForTestReset(name))
    .sort((a, b) => Number(b.name === 'audit_log_detail') - Number(a.name === 'audit_log_detail'));
  for (const { name } of resetTables) await d1.prepare(`DELETE FROM "${name}"`).run();
  const listed = await files.list();
  for (const object of listed.objects) await files.delete(object.key);
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: d1 },
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(login.status).toBe(200);
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('取込履歴の破棄', () => {
  it('失敗履歴を確認指紋の後だけ破棄し、原本・空runも消して専用監査を残す', async () => {
    const r2Key = 'uploads/2026-09-01/架空-failed.csv';
    await files.put(r2Key, '架空原本');
    await seedImport({ id: 1, status: 'failed', r2Key, runId: 'run-failed' });

    const checked = await preflight(1);
    expect(checked.response.status).toBe(200);
    expect(checked.body.originalDisposition).toBe('delete');
    expect(JSON.stringify(checked.body)).not.toContain('架空履歴');
    expect(JSON.stringify(checked.body)).not.toContain(r2Key);
    expect((await request('/imports/1/discard', {})).status).toBe(400);

    const response = await request('/imports/1/discard', { fingerprint: checked.body.fingerprint });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ discarded: true, original: 'deleted' });
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM imports').first<number>('n')).resolves.toBe(0);
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<number>('n')).resolves.toBe(0);
    await expect(files.head(r2Key)).resolves.toBeNull();
    await expect(d1.prepare('SELECT action,scope,counts_json FROM audit_log').first()).resolves.toEqual({
      action: 'import_discard',
      scope: 'import:1',
      counts_json: '{"imports":1}',
    });
    const auditRows = await d1.prepare('SELECT * FROM audit_log').all();
    const auditDetailRows = await d1.prepare('SELECT * FROM audit_log_detail').all();
    const recordedAudit = JSON.stringify([auditRows.results, auditDetailRows.results]);
    expect(recordedAudit).not.toContain('架空履歴.csv');
    expect(recordedAudit).not.toContain(r2Key);
    expect(recordedAudit).not.toContain('架空原本');
  });

  it('共有原本は兄弟履歴がある間は残し、最後の参照を破棄した時だけ消す', async () => {
    const r2Key = 'uploads/2026-09-01/架空-shared.zip';
    await files.put(r2Key, '架空共有原本');
    await seedImport({ id: 10, status: 'failed', r2Key, runId: 'run-shared' });
    await seedImport({
      id: 11,
      status: 'duplicate',
      r2Key,
      runId: 'run-shared',
      duplicateOf: 10,
    });

    const first = await preflight(10);
    expect(first.body.originalDisposition).toBe('keep_shared');
    await expect(
      (await request('/imports/10/discard', { fingerprint: first.body.fingerprint })).json(),
    ).resolves.toEqual({ discarded: true, original: 'kept_shared' });
    await expect(files.head(r2Key)).resolves.not.toBeNull();
    await expect(d1.prepare('SELECT duplicate_of FROM imports WHERE id=11').first()).resolves.toEqual({
      duplicate_of: null,
    });

    const last = await preflight(11);
    expect(last.body.originalDisposition).toBe('delete');
    await expect(
      (await request('/imports/11/discard', { fingerprint: last.body.fingerprint })).json(),
    ).resolves.toEqual({ discarded: true, original: 'deleted' });
    await expect(files.head(r2Key)).resolves.toBeNull();
  });

  it.each(['processing', 'applying', 'ok', 'committed', 'unknown'])(
    '%s は履歴だけを破棄できない',
    async (status) => {
      await seedImport({ id: 20, status });
      const checked = await preflight(20);
      expect(checked.response.status).toBe(409);
      expect(checked.body.error?.code).toMatch(/^import_history_discard_/);
      await expect(d1.prepare('SELECT COUNT(*) AS n FROM imports').first<number>('n')).resolves.toBe(1);
    },
  );

  it('active pointer・canonical行・undo退避のどれかが参照中なら拒否する', async () => {
    await seedImport({ id: 30, status: 'failed' });
    await seedImport({ id: 31, status: 'failed' });
    await seedImport({ id: 32, status: 'failed' });
    await seedImport({ id: 33, status: 'duplicate' });
    await d1
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default','mf:2026-09','v4:架空',30,'2026-09-01T00:00:00.000Z')`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO freee_deals
         (user_id,month,date,io,partner,account_raw,account_norm,amount,memo,import_id)
         VALUES ('default','2026-09','2026-09-01','expense','架空先','架空費','架空費',1,NULL,31)`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO import_deleted_rows
         (operation_id,user_id,table_name,row_id,month,payload_json,created_at)
         VALUES ('op-undo-ref','default','mf_transactions','架空行','2026-09','{"import_id":32}',
                 '2026-09-01T00:00:00.000Z')`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO import_deleted_targets
         (operation_id,user_id,target_key,content_hash,import_id,updated_at,created_at)
         VALUES ('op-target-ref','default','mf:2026-10','v4:架空',33,
                 '2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z')`,
      )
      .run();

    for (const id of [30, 31, 32, 33]) expect((await preflight(id)).response.status).toBe(409);
  });

  it('同じZIPのactiveな兄弟がいる場合も、失敗行だけ消して共有原本は残す', async () => {
    const r2Key = 'uploads/2026-09-01/架空-active-shared.zip';
    await files.put(r2Key, '架空共有原本');
    await seedImport({ id: 50, status: 'failed', r2Key, runId: 'run-active-shared' });
    await seedImport({ id: 51, status: 'committed', r2Key, runId: 'run-active-shared' });
    await d1
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default','mf:2026-09','v4:架空',51,'2026-09-01T00:00:00.000Z')`,
      )
      .run();

    const checked = await preflight(50);
    expect(checked.body.originalDisposition).toBe('keep_shared');
    await expect(
      (await request('/imports/50/discard', { fingerprint: checked.body.fingerprint })).json(),
    ).resolves.toEqual({ discarded: true, original: 'kept_shared' });
    await expect(files.head(r2Key)).resolves.not.toBeNull();
    await expect(d1.prepare('SELECT status FROM imports WHERE id=51').first()).resolves.toEqual({
      status: 'committed',
    });
    await expect(
      d1.prepare("SELECT status FROM import_runs WHERE id='run-active-shared'").first(),
    ).resolves.toEqual({ status: 'committed' });
  });

  it('最後の参照はoutboxへ載せ、R2障害でも履歴だけ安全に消して再試行状態を残す', async () => {
    const r2Key = 'uploads/2026-09-01/架空-retry.csv';
    await files.put(r2Key, '架空原本');
    await seedImport({ id: 60, status: 'failed', r2Key });
    const checked = await preflight(60);
    const failingBucket = new Proxy(files, {
      get(target, property, receiver) {
        if (property === 'delete') return async () => Promise.reject(new Error('synthetic R2 failure'));
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as R2Bucket;

    const response = await request(
      '/imports/60/discard',
      { fingerprint: checked.body.fingerprint },
      failingBucket,
    );
    await expect(response.json()).resolves.toEqual({ discarded: true, original: 'deletion_pending' });
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM imports').first<number>('n')).resolves.toBe(0);
    await expect(
      d1.prepare('SELECT state,reason,last_error FROM attachment_cleanup_jobs').first(),
    ).resolves.toEqual({ state: 'retry', reason: 'import_retention', last_error: 'r2_delete_failed' });
    await expect(files.head(r2Key)).resolves.not.toBeNull();
  });

  it('確認後に状態が変わった場合と他利用者の履歴をfail closedする', async () => {
    await seedImport({ id: 40, status: 'failed' });
    await seedImport({ id: 41, status: 'failed', userId: 'synthetic-other-user' });
    const checked = await preflight(40);
    await d1.prepare("UPDATE imports SET status='processing' WHERE id=40").run();

    const changed = await request('/imports/40/discard', { fingerprint: checked.body.fingerprint });
    expect(changed.status).toBe(409);
    expect(((await changed.json()) as { error: { code: string } }).error.code).toMatch(
      /^import_history_discard_/,
    );
    expect((await preflight(41)).response.status).toBe(404);
  });

  it('状態名が同じでも共有原本の参照が増えたら指紋不一致409にする', async () => {
    const r2Key = 'uploads/2026-09-01/架空-race.zip';
    await files.put(r2Key, '架空原本');
    await seedImport({ id: 70, status: 'failed', r2Key });
    const checked = await preflight(70);
    expect(checked.body.originalDisposition).toBe('delete');
    await seedImport({ id: 71, status: 'duplicate', r2Key });

    const response = await request('/imports/70/discard', { fingerprint: checked.body.fingerprint });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'import_history_discard_scope_changed',
        message: '確認後に取込履歴の状態が変わりました。もう一度確認してください',
      },
    });
    await expect(files.head(r2Key)).resolves.not.toBeNull();
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM imports').first<number>('n')).resolves.toBe(2);
  });

  it('履歴APIは表示状態ではなく現在参照から取消・破棄可否を排他導出す', async () => {
    await seedImport({ id: 80, status: 'committed' });
    await seedImport({ id: 81, status: 'committed' });
    await seedImport({ id: 82, status: 'committed' });
    await seedImport({ id: 83, status: 'failed' });
    await d1.prepare("UPDATE imports SET kind='json' WHERE id=80").run();
    await d1.prepare("UPDATE imports SET kind='assets' WHERE id=82").run();
    await d1
      .prepare(
        `INSERT INTO freee_deals
         (user_id,month,date,io,partner,account_raw,account_norm,amount,memo,import_id)
         VALUES ('default','2026-09','2026-09-01','expense','架空先','架空費','架空費',1,NULL,80)`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('default','assets:2026-09','v4:架空',82,'2026-09-01T00:00:00.000Z')`,
      )
      .run();

    const response = await history();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      imports: Array<{
        id: number;
        generationState: string | null;
        cancelable: boolean;
        discardable: boolean;
      }>;
    };
    const byId = new Map(body.imports.map((row) => [row.id, row]));

    expect(byId.get(80)).toMatchObject({
      generationState: 'superseded',
      cancelable: true,
      discardable: false,
    });
    expect(byId.get(81)).toMatchObject({
      generationState: 'superseded',
      cancelable: false,
      discardable: false,
    });
    expect(byId.get(82)).toMatchObject({
      generationState: 'partial',
      cancelable: true,
      discardable: false,
    });
    expect(byId.get(83)).toMatchObject({
      generationState: null,
      cancelable: false,
      discardable: true,
    });
  });
});
