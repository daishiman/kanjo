/**
 * 取込のcommit/duplicate/concurrency契約。全fixtureは架空値のみ。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyDataset } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  IMPORT_CLAIM_TTL_MS,
  acquireImportWriter,
  createImportRun,
  freeeCommitStatements,
  planMultipartImportQueries,
  preflightWriteSetConflicts,
  releaseImportWriter,
} from './import-lifecycle.js';
import { parseUpload } from './import-pipeline.js';
import { app } from './index.js';
import {
  LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
  getDb,
  loadCashEntries,
  loadDataset,
  loadNormMap,
} from './store.js';

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
  const files = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of files) {
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await database.prepare(sql).run();
  }
}

const freeeCsv = (amount: number): string =>
  ['収支区分,発生日,勘定科目,金額,取引先', `支出,2026/07/02,架空通信費,${amount},架空SaaS`].join('\n');

const freeeCsvRows = (count: number, partnerWidth = 0): string =>
  [
    '収支区分,発生日,勘定科目,金額,取引先',
    ...Array.from(
      { length: count },
      (_, index) =>
        `支出,2026/07/${String((index % 28) + 1).padStart(2, '0')},架空通信費,${index + 1},架空-${index}-${'幅'.repeat(partnerWidth)}`,
    ),
  ].join('\n');

const mfCsvRows = (count: number, descriptionWidth = 0): string =>
  [
    '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
    ...Array.from(
      { length: count },
      (_, index) =>
        `1,2026/08/${String((index % 28) + 1).padStart(2, '0')},-${index + 1},架空費,架空内訳,0,架空-${index}-${'幅'.repeat(descriptionWidth)},mf-${index},架空口座`,
    ),
  ].join('\n');

const countingDatabase = (database: D1Database): { database: D1Database; count: () => number } => {
  let queryCount = 0;
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrapStatement(
              (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values),
            );
        }
        if (property === 'run' || property === 'all' || property === 'first' || property === 'raw') {
          return (...values: unknown[]) => {
            queryCount++;
            return (Reflect.get(target, property, receiver) as (...args: unknown[]) => unknown).call(
              target,
              ...values,
            );
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    return proxy;
  };
  const proxy = new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrapStatement(target.prepare(sql));
      if (property === 'batch') {
        return (statements: D1PreparedStatement[]) => {
          queryCount += statements.length;
          return target.batch(statements.map((statement) => originals.get(statement) ?? statement));
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
  return { database: proxy, count: () => queryCount };
};

const snapshotInterleavingDatabase = (
  database: D1Database,
  onFirstSnapshotRead: () => Promise<void>,
): D1Database => {
  let claimBatchCompleted = false;
  let checked = false;
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrapStatement = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrapStatement(
              (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values),
              sql,
            );
        }
        if (property === 'run' || property === 'all' || property === 'first' || property === 'raw') {
          return async (...values: unknown[]) => {
            if (claimBatchCompleted && !checked && sql.includes('account_norm_map')) {
              checked = true;
              await onFirstSnapshotRead();
            }
            return (Reflect.get(target, property, receiver) as (...args: unknown[]) => unknown).call(
              target,
              ...values,
            );
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    return proxy;
  };
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrapStatement(target.prepare(sql), sql);
      if (property === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          const result = await target.batch(
            statements.map((statement) => originals.get(statement) ?? statement),
          );
          claimBatchCompleted = true;
          return result;
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
};

const mutationInterleavingDatabase = (
  database: D1Database,
  whileLeaseHeld: () => Promise<void>,
): D1Database => {
  let batches = 0;
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          batches++;
          // batch 1 is middleware lease acquisition; batch 2 is the route's canonical write.
          if (batches === 2) await whileLeaseHeld();
          return target.batch(statements);
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as D1Database;
};

const restoreBody = {
  months: ['2026-07'],
  biz: { revenue: [0], categories: [], expense: {} },
  subs: { vendors: [], matrix: {}, other: [0] },
  personal: {},
  bizPersonal: {},
  mfTx: [],
  rules: [],
  edits: {},
  institutionOwners: {},
  budgets: { 架空費: 100 },
  cashOverride: {},
  unrecordedExpMonths: [],
};

const restore = async (
  body: Record<string, unknown> = restoreBody,
  database: D1Database = d1,
): Promise<Response> =>
  Promise.resolve(
    app.request(
      '/api/restore',
      { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) },
      { ...auth, DB: database, FILES: files },
    ),
  );

async function importFiles(
  inputs: Array<{ name: string; body: string }>,
  database: D1Database = d1,
  bucket: R2Bucket = files,
  force = false,
  keepOnShrink = false,
): Promise<Response> {
  const form = new FormData();
  for (const input of inputs) form.append('file', new File([input.body], input.name, { type: 'text/csv' }));
  if (force) form.append('force', '1');
  if (keepOnShrink) form.append('keepOnShrink', '1');
  return app.request(
    '/api/imports',
    { method: 'POST', headers: { cookie }, body: form },
    { ...auth, DB: database, FILES: bucket },
  );
}

const resultStatuses = async (response: Response): Promise<string[]> => {
  const body = (await response.clone().json()) as { results: Array<{ status: string }> };
  return body.results.map((result) => result.status);
};

const queryPlanOf = async (response: Response): Promise<{ total: number; accepted: boolean }> => {
  const body = (await response.clone().json()) as {
    queryPlan: { total: number; accepted: boolean };
  };
  return body.queryPlan;
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'import-lifecycle-test',
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
  for (const { name } of tables.results) await d1.prepare(`DELETE FROM "${name}"`).run();
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
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('active target duplicate', () => {
  it('MFの明示IDと合成IDをD1で区別し、添付可否の根拠を失わない', async () => {
    expect(await resultStatuses(await importFiles([{ name: 'stable-mf.csv', body: mfCsvRows(1) }]))).toEqual([
      'committed',
    ]);
    const withoutId = [
      '計算対象,日付,金額,大項目,中項目,振替,内容,保有金融機関',
      '1,2026/09/01,-500,架空費,架空内訳,0,架空-IDなし,架空口座',
    ].join('\n');
    expect(await resultStatuses(await importFiles([{ name: 'unstable-mf.csv', body: withoutId }]))).toEqual([
      'committed',
    ]);

    const rows = await d1
      .prepare('SELECT tx_id AS txId, identity_stable AS identityStable FROM mf_transactions ORDER BY month')
      .all<{ txId: string; identityStable: number }>();
    expect(rows.results).toEqual([
      { txId: 'mf-0', identityStable: 1 },
      { txId: '2026-09_0_-500', identityStable: 0 },
    ]);
  });

  it('active A→B→Aはforceなしで再適用する', async () => {
    expect(await resultStatuses(await importFiles([{ name: 'a.csv', body: freeeCsv(100) }]))).toEqual([
      'committed',
    ]);
    expect(await resultStatuses(await importFiles([{ name: 'b.csv', body: freeeCsv(200) }]))).toEqual([
      'committed',
    ]);
    expect(await resultStatuses(await importFiles([{ name: 'a-again.csv', body: freeeCsv(100) }]))).toEqual([
      'committed',
    ]);
  });

  it('active A→Aの通常再試行だけduplicate、forceは確定済Aを再適用する', async () => {
    expect(await resultStatuses(await importFiles([{ name: 'a.csv', body: freeeCsv(100) }]))).toEqual([
      'committed',
    ]);
    expect(await resultStatuses(await importFiles([{ name: 'a-retry.csv', body: freeeCsv(100) }]))).toEqual([
      'duplicate',
    ]);
    expect(
      await resultStatuses(
        await importFiles([{ name: 'a-force.csv', body: freeeCsv(100) }], d1, files, true),
      ),
    ).toEqual(['committed']);
  });

  it('「前回を残す」指定は件数が減る洗い替えを実行せず、既存データを無傷で残す', async () => {
    const mfRows = async (): Promise<number> =>
      (await d1.prepare('SELECT COUNT(*) AS n FROM mf_transactions').first<{ n: number }>())?.n ?? 0;
    expect(await resultStatuses(await importFiles([{ name: 'full.csv', body: mfCsvRows(3) }]))).toEqual([
      'committed',
    ]);
    expect(await mfRows()).toBe(3);

    const kept = await importFiles([{ name: 'partial.csv', body: mfCsvRows(1) }], d1, files, false, true);
    expect(kept.status).toBe(200); // 何も壊していないので失敗ではない
    expect(await resultStatuses(kept)).toEqual(['kept']);
    expect(await mfRows()).toBe(3);
    // 見送ったunitは履歴にも残さない(取込は起きていないため)
    const history = await d1
      .prepare('SELECT COUNT(*) AS n FROM imports WHERE filename=?')
      .bind('partial.csv')
      .first<{ n: number }>();
    expect(history?.n).toBe(0);

    // 指定を外せば従来どおり洗い替える
    expect(await resultStatuses(await importFiles([{ name: 'partial.csv', body: mfCsvRows(1) }]))).toEqual([
      'committed',
    ]);
    expect(await mfRows()).toBe(1);
  });

  it('「前回を残す」でも件数が減らないファイルは通常どおり取り込む', async () => {
    expect(
      await resultStatuses(
        await importFiles([{ name: 'first.csv', body: mfCsvRows(2) }], d1, files, false, true),
      ),
    ).toEqual(['committed']);
    expect(
      await resultStatuses(
        await importFiles([{ name: 'more.csv', body: mfCsvRows(5) }], d1, files, false, true),
      ),
    ).toEqual(['committed']);
  });

  it('無変更JSONだけduplicate、設定変更はpointerを同じtransactionで失効して再適用する', async () => {
    const first = (await (await restore()).json()) as { duplicate: boolean };
    expect(first.duplicate).toBe(false);
    const unchanged = (await (await restore()).json()) as { duplicate: boolean };
    expect(unchanged.duplicate).toBe(true);

    const settings = await app.request(
      '/api/budgets',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ budgets: { 架空費: 999 } }),
      },
      { ...auth, DB: d1, FILES: files },
    );
    expect(settings.status).toBe(200);
    const reapplied = (await (await restore()).json()) as { duplicate: boolean };
    expect(reapplied.duplicate).toBe(false);
  });

  it('JSON sourceのcash editを破棄し、destination editをpersist/集計/指紋で一致させる', async () => {
    const now = '2026-08-26T00:00:00.000Z';
    await d1
      .prepare(
        `INSERT INTO cash_entries
         (id,user_id,date,month,side,io,amount,description,category_major,category_mid,memo,created_at,updated_at)
         VALUES (1,'default','2026-07-10','2026-07','per','expense',500,'架空現金','架空食費','架空内訳',NULL,?,?)`,
      )
      .bind(now, now)
      .run();
    await d1
      .prepare(
        "INSERT INTO tx_edits (user_id,tx_id,cls,note) VALUES ('default','cash:1','biz','destination')",
      )
      .run();
    const source = structuredClone(restoreBody) as Record<string, unknown> & {
      edits: Record<string, { cls: 'biz' | 'per'; note: string }>;
    };
    source.edits = {
      'cash:1': { cls: 'per', note: 'source-conflict' },
      'cash:999': { cls: 'per', note: 'source-orphan' },
    };

    const multipart = await importFiles([{ name: 'cash-restore.json', body: JSON.stringify(source) }]);
    expect(multipart.status).toBe(200);
    expect(await resultStatuses(multipart)).toEqual(['committed']);
    expect(
      await d1.prepare("SELECT tx_id,cls,note FROM tx_edits WHERE tx_id LIKE 'cash:%' ORDER BY tx_id").all(),
    ).toMatchObject({ results: [{ tx_id: 'cash:1', cls: 'biz', note: 'destination' }] });
    expect(
      await d1
        .prepare("SELECT amount FROM monthly_agg WHERE user_id='default' AND scope='biz_personal_out'")
        .first(),
    ).toEqual({ amount: 500 });
    expect(
      await d1
        .prepare("SELECT COUNT(*) AS n FROM monthly_agg WHERE user_id='default' AND scope LIKE 'per_exp:%'")
        .first(),
    ).toEqual({ n: 0 });

    const repeated = (await (await restore(source)).json()) as { duplicate: boolean };
    expect(repeated.duplicate).toBe(true);
  });
});

describe('writer claim', () => {
  it('同一利用者の同時claimを単一writerにする', async () => {
    const now = Date.parse('2026-08-26T00:00:00.000Z');
    const [a, b] = await Promise.all([
      acquireImportWriter(d1, 'same-user', 'run-a', now),
      acquireImportWriter(d1, 'same-user', 'run-b', now),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    await releaseImportWriter(d1, 'same-user', a ? 'run-a' : 'run-b');
  });

  it('期限内claimは奪えず、stale後は新runが回復する', async () => {
    const now = Date.parse('2026-08-26T00:00:00.000Z');
    expect(await acquireImportWriter(d1, 'stale-user', 'run-a', now)).toBe(true);
    expect(await acquireImportWriter(d1, 'stale-user', 'run-b', now + IMPORT_CLAIM_TTL_MS - 1)).toBe(false);
    expect(await acquireImportWriter(d1, 'stale-user', 'run-b', now + IMPORT_CLAIM_TTL_MS + 1)).toBe(true);
  });

  it('stale takeoverは旧runのprocessing/applying unitだけを同じ回復batchでfailedへCASする', async () => {
    const now = Date.parse('2026-08-26T00:00:00.000Z');
    await createImportRun(d1, 'recovery-user', 'old-run', new Date(now).toISOString());
    await createImportRun(d1, 'recovery-user', 'new-run', new Date(now).toISOString());
    expect(await acquireImportWriter(d1, 'recovery-user', 'old-run', now)).toBe(true);
    for (const status of ['processing', 'applying', 'committed', 'duplicate', 'failed']) {
      await d1
        .prepare(
          `INSERT INTO imports (user_id,filename,status,run_id,failure_reason)
           VALUES ('recovery-user',?,?, 'old-run',?)`,
        )
        .bind(`${status}.csv`, status, status === 'failed' ? '既存失敗' : null)
        .run();
    }
    expect(await acquireImportWriter(d1, 'recovery-user', 'new-run', now + IMPORT_CLAIM_TTL_MS + 1)).toBe(
      true,
    );
    const units = await d1
      .prepare("SELECT filename,status,failure_reason FROM imports WHERE run_id='old-run' ORDER BY id")
      .all<{ filename: string; status: string; failure_reason: string | null }>();
    expect(units.results.map(({ filename, status }) => [filename, status])).toEqual([
      ['processing.csv', 'failed'],
      ['applying.csv', 'failed'],
      ['committed.csv', 'committed'],
      ['duplicate.csv', 'duplicate'],
      ['failed.csv', 'failed'],
    ]);
    expect(units.results[0]?.failure_reason).toContain('回復');
    expect(
      await d1.prepare("SELECT status FROM import_runs WHERE id='old-run'").first<{ status: string }>(),
    ).toEqual({ status: 'failed' });
  });

  it('import routeはauthoritative snapshot前にleaseを保持し、settings mutationを409にする', async () => {
    let competitorStatus: number | undefined;
    const guarded = snapshotInterleavingDatabase(d1, async () => {
      const competitor = await app.request(
        '/api/settings',
        {
          method: 'PUT',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({ normMap: { 架空通信費: '架空通信費' } }),
        },
        { ...auth, DB: d1, FILES: files },
      );
      competitorStatus = competitor.status;
    });
    const response = await importFiles([{ name: 'claim-before-snapshot.csv', body: freeeCsv(123) }], guarded);
    expect(response.status).toBe(200);
    expect(competitorStatus).toBe(409);
    expect(await resultStatuses(response)).toEqual(['committed']);
  }, 15_000);

  it('settingsのread/write/recomputeリース中cashとimportをどちらも409にする', async () => {
    const competingStatuses: number[] = [];
    const guarded = mutationInterleavingDatabase(d1, async () => {
      const cash = await app.request(
        '/api/cash-entries',
        {
          method: 'POST',
          headers: { cookie, 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
        { ...auth, DB: d1, FILES: files },
      );
      const upload = await importFiles([{ name: 'mutation-interleave.csv', body: freeeCsv(321) }]);
      competingStatuses.push(cash.status, upload.status);
    });
    const settings = await app.request(
      '/api/settings',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ normMap: { 架空通信費: '架空通信費' } }),
      },
      { ...auth, DB: guarded, FILES: files },
    );
    expect(settings.status).toBe(200);
    expect(competingStatuses).toEqual([409, 409]);
  }, 15_000);

  it('stale mutation tokenの回復は存在しないimport runを作成せずcanonical updateを継続できる', async () => {
    const staleAt = Date.now() - IMPORT_CLAIM_TTL_MS - 1_000;
    expect(await acquireImportWriter(d1, 'default', 'mutation:stale', staleAt)).toBe(true);
    const response = await app.request(
      '/api/settings',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ unrecordedExpMonths: ['2026-07'] }),
      },
      { ...auth, DB: d1, FILES: files },
    );
    expect(response.status).toBe(200);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first()).toEqual({ n: 0 });
  });

  it('mutation成功後のrelease失敗は応答を500に反転させない', async () => {
    const wrap = (statement: D1PreparedStatement, release: boolean): D1PreparedStatement =>
      new Proxy(statement, {
        get(target, property, receiver) {
          if (property === 'bind') {
            return (...values: unknown[]) =>
              wrap(
                (target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values),
                release,
              );
          }
          if (release && property === 'run') {
            return async () => {
              await target.run();
              throw new Error('synthetic release response loss');
            };
          }
          const value = Reflect.get(target, property, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }) as D1PreparedStatement;
    const releaseFailureDb = new Proxy(d1, {
      get(target, property, receiver) {
        if (property === 'prepare') {
          return (sql: string) =>
            wrap(target.prepare(sql), sql.startsWith('DELETE FROM import_writer_claims'));
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const response = await app.request(
      '/api/settings',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ unrecordedExpMonths: ['2026-07'] }),
      },
      { ...auth, DB: releaseFailureDb, FILES: files },
    );
    expect(response.status).toBe(200);
    expect(
      await d1.prepare("SELECT month FROM unrecorded_months WHERE user_id='default'").all(),
    ).toMatchObject({ results: [{ month: '2026-07' }] });
  });

  it('stale takeover後の旧worker commitは先頭制約エラーでrollbackしcanonical/active/statusを変えない', async () => {
    const staleAt = Date.now() - IMPORT_CLAIM_TTL_MS - 1_000;
    await createImportRun(d1, 'fenced-user', 'old-run');
    await createImportRun(d1, 'fenced-user', 'new-run');
    expect(await acquireImportWriter(d1, 'fenced-user', 'old-run', staleAt)).toBe(true);
    const attempt = await d1
      .prepare(
        `INSERT INTO imports (user_id,filename,kind,status,run_id,target_keys)
         VALUES ('fenced-user','old.csv','freee','processing','old-run','["freee:2026-07"]')
         RETURNING id`,
      )
      .first<{ id: number }>();
    if (!attempt) throw new Error('test attempt was not created');
    await d1
      .prepare(
        `INSERT INTO freee_deals
         (user_id,month,date,io,partner,account_raw,account_norm,amount,import_id)
         VALUES ('fenced-user','2026-07','2026-07-01','expense','旧取引先','旧科目','旧科目',100,?)`,
      )
      .bind(attempt.id)
      .run();
    await d1
      .prepare(
        `INSERT INTO import_active_targets (user_id,target_key,content_hash,import_id,updated_at)
         VALUES ('fenced-user','freee:2026-07','v2:old',?,'2026-08-26T00:00:00.000Z')`,
      )
      .bind(attempt.id)
      .run();
    expect(await acquireImportWriter(d1, 'fenced-user', 'new-run')).toBe(true);
    const before = {
      deals: (await d1.prepare("SELECT partner,amount FROM freee_deals WHERE user_id='fenced-user'").all())
        .results,
      active: await d1
        .prepare("SELECT content_hash,import_id FROM import_active_targets WHERE user_id='fenced-user'")
        .all()
        .then((result) => result.results),
      unit: await d1.prepare('SELECT status,failure_reason FROM imports WHERE id=?').bind(attempt.id).first(),
    };
    const statements = freeeCommitStatements({
      database: d1,
      userId: 'fenced-user',
      runId: 'old-run',
      importId: attempt.id,
      deals: [
        {
          month: '2026-07',
          date: '2026-07-02',
          io: 'expense',
          partner: '新取引先',
          accountRaw: '新科目',
          accountNorm: '新科目',
          amount: 999,
        },
      ],
      months: ['2026-07'],
      contentHash: 'v2:new',
      targetKeys: ['freee:2026-07'],
      data: emptyDataset(),
    });
    await expect(d1.batch(statements)).rejects.toThrow(/NOT NULL|constraint/i);
    const after = {
      deals: (await d1.prepare("SELECT partner,amount FROM freee_deals WHERE user_id='fenced-user'").all())
        .results,
      active: await d1
        .prepare("SELECT content_hash,import_id FROM import_active_targets WHERE user_id='fenced-user'")
        .all()
        .then((result) => result.results),
      unit: await d1.prepare('SELECT status,failure_reason FROM imports WHERE id=?').bind(attempt.id).first(),
    };
    expect(after).toEqual(before);
  });
});

describe('run terminal convergence', () => {
  it('final commitのresponse loss後もunit/runはcommittedへ収束する', async () => {
    let batches = 0;
    const observed = countingDatabase(d1);
    const responseLossDb = new Proxy(observed.database, {
      get(target, property, receiver) {
        if (property === 'batch')
          return async (statements: D1PreparedStatement[]) => {
            batches++;
            const result = await target.batch(statements);
            if (batches === 2) throw new Error('synthetic response loss after commit');
            return result;
          };
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const response = await importFiles([{ name: 'response-loss.csv', body: freeeCsv(444) }], responseLossDb);
    expect(response.status).toBe(200);
    expect(observed.count()).toBeLessThanOrEqual((await queryPlanOf(response)).total);
    expect(await resultStatuses(response)).toEqual(['committed']);
    expect(await d1.prepare('SELECT status FROM imports ORDER BY id DESC LIMIT 1').first()).toEqual({
      status: 'committed',
    });
    expect(
      await d1.prepare('SELECT status FROM import_runs ORDER BY created_at DESC LIMIT 1').first(),
    ).toEqual({
      status: 'committed',
    });
  });

  it('duplicate batchのresponse loss後もsettled statusを読んで200/duplicateへ収束する', async () => {
    expect(await resultStatuses(await importFiles([{ name: 'original.csv', body: freeeCsv(445) }]))).toEqual([
      'committed',
    ]);
    let batches = 0;
    const observed = countingDatabase(d1);
    const responseLossDb = new Proxy(observed.database, {
      get(target, property, receiver) {
        if (property === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            batches++;
            const result = await target.batch(statements);
            if (batches === 2) throw new Error('synthetic duplicate response loss');
            return result;
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const response = await importFiles(
      [{ name: 'duplicate-response-loss.csv', body: freeeCsv(445) }],
      responseLossDb,
    );
    expect(response.status).toBe(200);
    expect(await resultStatuses(response)).toEqual(['duplicate']);
    expect(observed.count()).toBeLessThanOrEqual((await queryPlanOf(response)).total);
    expect(await d1.prepare('SELECT status FROM imports ORDER BY id DESC LIMIT 1').first()).toEqual({
      status: 'duplicate',
    });
  });

  it('partial successはcommitted unitを保持し、runだけfailedで閉じる', async () => {
    const response = await importFiles([
      { name: 'valid.csv', body: freeeCsv(555) },
      { name: 'unknown.csv', body: '架空列\n値' },
    ]);
    expect(response.status).toBe(200);
    expect(await resultStatuses(response)).toEqual(['committed', 'failed']);
    expect(
      await d1.prepare('SELECT status FROM import_runs ORDER BY created_at DESC LIMIT 1').first(),
    ).toEqual({
      status: 'failed',
    });
  });
});

describe('preflight write-set', () => {
  it('同一multipartの同domain×month競合をR2/DB副作用前に拒否する', async () => {
    const response = await importFiles([
      { name: 'a.csv', body: freeeCsv(100) },
      { name: 'b.csv', body: freeeCsv(200) },
    ]);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'import_write_conflict' } });
    expect((await files.list()).objects).toHaveLength(0);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>()).toEqual({
      n: 0,
    });
  });

  it('freeeとMFの別domainは同月でも競合しない', () => {
    const freee = parseUpload('a.csv', new TextEncoder().encode(freeeCsv(100)), {});
    const mf = parseUpload(
      'b.csv',
      new TextEncoder().encode(
        ['計算対象,日付,金額,大項目,中項目,振替,内容,ID', '1,2026/07/03,-300,架空費,雑費,0,架空店,mf-1'].join(
          '\n',
        ),
      ),
      {},
    );
    expect(preflightWriteSetConflicts([...freee, ...mf])).toEqual([]);
  });

  it('5,000行の通常幅は実D1 queryも50未満でcommitする', async () => {
    const observed = countingDatabase(d1);
    const response = await importFiles(
      [{ name: 'five-thousand.csv', body: freeeCsvRows(5_000) }],
      observed.database,
    );
    expect(response.status).toBe(200);
    const queryPlan = await queryPlanOf(response);
    expect(await resultStatuses(response)).toEqual(['committed']);
    expect(observed.count()).toBeLessThan(50);
    expect(observed.count()).toBeLessThanOrEqual(queryPlan.total);
  }, 15_000);

  it('MF+freee複数unitが50-query上界に達する場合はrun/R2前に拒否する', async () => {
    const observed = countingDatabase(d1);
    const response = await importFiles(
      [
        { name: 'freee.csv', body: freeeCsv(321) },
        { name: 'mf.csv', body: mfCsvRows(120) },
      ],
      observed.database,
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'import_query_budget_exceeded' },
    });
    expect(observed.count()).toBeLessThan(50);
    expect((await files.list()).objects).toHaveLength(0);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first()).toEqual({ n: 0 });
  }, 15_000);

  it('高桁attempt IDでもchunk数は計画から増えず、actual<=plannedを保つ', async () => {
    await d1
      .prepare("INSERT INTO imports (id,user_id,status) VALUES (9007199254740000,'seed','committed')")
      .run();
    const observed = countingDatabase(d1);
    const response = await importFiles([{ name: 'high-id-mf.csv', body: mfCsvRows(300) }], observed.database);
    expect(response.status).toBe(200);
    const body = (await response.clone().json()) as {
      results: Array<{ importId: number }>;
      queryPlan: { total: number };
    };
    expect(body.results[0]?.importId).toBeGreaterThan(9_000_000_000_000_000);
    expect(observed.count()).toBeLessThanOrEqual(body.queryPlan.total);
  }, 15_000);

  it('restoreのduplicate/commit実測も同じplanner上界以下になる', async () => {
    const committedDb = countingDatabase(d1);
    const committed = await restore(restoreBody, committedDb.database);
    expect(committed.status).toBe(200);
    expect(committedDb.count()).toBeLessThanOrEqual((await queryPlanOf(committed)).total);

    const duplicateDb = countingDatabase(d1);
    const duplicate = await restore(restoreBody, duplicateDb.database);
    expect(duplicate.status).toBe(200);
    await expect(duplicate.clone().json()).resolves.toMatchObject({ duplicate: true });
    expect(duplicateDb.count()).toBeLessThanOrEqual((await queryPlanOf(duplicate)).total);
  }, 15_000);

  it('手書きpreflight ledgerをloadDataset実測と固定し、loader追加queryのdriftを検出する', async () => {
    const observed = countingDatabase(d1);
    const observedDb = getDb(observed.database);
    const cashEntries = await loadCashEntries(observedDb, 'default');
    await loadDataset(observedDb, 'default', cashEntries);
    await loadNormMap(observedDb, 'default');
    expect(observed.count()).toBe(2 + LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT);

    const plan = planMultipartImportQueries({
      fileCount: 1,
      unitCount: 1,
      applicableUnitCount: 1,
      jsonUnitCount: 0,
      commitStatementCounts: [1],
    });
    // routeは上のcash/loadDataset/normにfreee件数readを1本足す。
    expect(plan.breakdown.preflightReads).toBe(observed.count() + 1);
  });

  it('同じ5,000行でもcanonical byte/query予算超過はR2/DB副作用前に413', async () => {
    const observed = countingDatabase(d1);
    const response = await importFiles(
      [{ name: 'too-wide.csv', body: freeeCsvRows(5_000, 400) }],
      observed.database,
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'import_query_budget_exceeded' },
    });
    expect(observed.count()).toBeLessThan(50);
    expect((await files.list()).objects).toHaveLength(0);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM import_runs').first<{ n: number }>()).toEqual({
      n: 0,
    });
  }, 15_000);
});

describe('failure recovery', () => {
  it('R2保存失敗をrun/unitのfailedとして残し、canonicalへ進まない', async () => {
    const observed = countingDatabase(d1);
    const failingFiles = new Proxy(files, {
      get(target, property, receiver) {
        if (property === 'put') return async () => Promise.reject(new Error('synthetic R2 failure'));
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as R2Bucket;
    const response = await importFiles(
      [{ name: 'r2-retry.csv', body: freeeCsv(222) }],
      observed.database,
      failingFiles,
    );
    expect(response.status).toBe(400);
    expect(observed.count()).toBeLessThanOrEqual((await queryPlanOf(response)).total);
    expect(await resultStatuses(response)).toEqual(['failed']);
    expect(
      await d1.prepare('SELECT status, failure_reason, r2_key FROM imports ORDER BY id DESC LIMIT 1').first(),
    ).toMatchObject({
      status: 'failed',
      failure_reason: expect.stringContaining('原本'),
      r2_key: expect.any(String),
    });
    expect(
      await d1
        .prepare('SELECT status, failure_reason FROM import_runs ORDER BY created_at DESC LIMIT 1')
        .first(),
    ).toMatchObject({ status: 'failed', failure_reason: expect.any(String) });
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM freee_deals').first<{ n: number }>()).toEqual({
      n: 0,
    });
  });

  it('canonical/cache commit失敗はcommittedにせず、同じ入力の通常retryで回復する', async () => {
    const failingDb = new Proxy(d1, {
      get(target, property, receiver) {
        if (property === 'batch')
          return async (statements: D1PreparedStatement[]) =>
            statements.length > 3
              ? Promise.reject(new Error('synthetic commit failure'))
              : target.batch(statements);
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const observed = countingDatabase(failingDb);
    const failed = await importFiles([{ name: 'retry.csv', body: freeeCsv(333) }], observed.database);
    expect(failed.status).toBe(400);
    expect(observed.count()).toBeLessThanOrEqual((await queryPlanOf(failed)).total);
    expect(await resultStatuses(failed)).toEqual(['failed']);
    expect(
      await d1.prepare("SELECT COUNT(*) AS n FROM imports WHERE status='committed'").first<{ n: number }>(),
    ).toEqual({ n: 0 });
    expect(
      await d1
        .prepare("SELECT COUNT(*) AS n FROM freee_deals WHERE user_id='default'")
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    expect(
      await d1.prepare('SELECT COUNT(*) AS n FROM import_active_targets').first<{ n: number }>(),
    ).toEqual({
      n: 0,
    });

    const retried = await importFiles([{ name: 'retry.csv', body: freeeCsv(333) }]);
    expect(retried.status).toBe(200);
    expect(await resultStatuses(retried)).toEqual(['committed']);
    expect(
      await d1.prepare('SELECT status, failure_reason FROM imports ORDER BY id DESC LIMIT 2').all(),
    ).toMatchObject({
      results: [
        { status: 'committed', failure_reason: null },
        { status: 'failed', failure_reason: expect.stringContaining('内部') },
      ],
    });
  });

  it('unit cleanup自体の失敗がouter cleanupへ上がってもactual queryは予約済み上界内', async () => {
    const reference = await importFiles([{ name: 'cleanup-reference.csv', body: freeeCsv(701) }]);
    const planned = (await queryPlanOf(reference)).total;
    let batches = 0;
    const faultDb = new Proxy(d1, {
      get(target, property, receiver) {
        if (property === 'batch') {
          return async (statements: D1PreparedStatement[]) => {
            batches++;
            if (batches === 2) throw new Error('synthetic canonical failure');
            if (batches === 3) throw new Error('synthetic unit cleanup failure');
            return target.batch(statements);
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1Database;
    const observed = countingDatabase(faultDb);
    const response = await importFiles(
      [{ name: 'cleanup-failure.csv', body: freeeCsv(702) }],
      observed.database,
    );
    expect(response.status).toBe(500);
    expect(observed.count()).toBeLessThanOrEqual(planned);
    expect(
      await d1.prepare('SELECT status FROM imports ORDER BY id DESC LIMIT 1').first<{ status: string }>(),
    ).toEqual({ status: 'failed' });
  });
});
