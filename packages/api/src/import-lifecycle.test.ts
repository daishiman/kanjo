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
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';
import {
  LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT,
  getDb,
  loadBackupPayload,
  loadCashEntries,
  loadDataset,
  loadImportRestoreSettingsSnapshot,
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
  await recordTestMigrationHead(database, files);
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

const mfCompleteProjectionCsv = (): string =>
  [
    '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関,メモ',
    '1,2026/10/01,-101,架空費,通常,0,架空通常,mf-full-1,架空口座,  通常メモ  ',
    '0,2026/10/02,-202,架空費,非対象,0,架空非対象,mf-full-2,架空口座,   ',
    '1,2026/10/03,-303,架空費,振替,1,架空振替,mf-full-3,架空口座,',
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
  const resetTables = tables.results
    .filter(({ name }) => isApplicationTableForTestReset(name))
    // 0028の同一利用者FKは親profileをRESTRICTするため子から消す。
    .sort(
      (a, b) => Number(b.name === 'receipt_source_overrides') - Number(a.name === 'receipt_source_overrides'),
    );
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
  expect(cookie).not.toBe('');
}, 30_000);

afterAll(async () => {
  await mf?.dispose();
}, 30_000);

describe('active target duplicate', () => {
  it('MF取込結果は解析・保存・集計対象・集計対象外・保存不能を別々に返す', async () => {
    const csv = [
      '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
      '0,2026/12/01,-100,架空費,旧値,0,架空旧値,shared-id,架空口座',
      '1,2026/12/02,-200,架空費,新値,0,架空新値,shared-id,架空口座',
      '1,2026/12/03,-300,架空費,振替,1,架空振替,transfer-id,架空口座',
      '1,日付不明,-400,架空費,不正,0,架空不正,rejected-id,架空口座',
    ].join('\n');

    const response = await importFiles([{ name: 'anonymous-counts.csv', body: csv }]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      results: [
        {
          status: 'committed',
          counts: { parsed: 3, stored: 2, countable: 1, nonCountable: 1, rejected: 1 },
          rows: 1,
          skipped: 3,
          duplicateIds: 1,
        },
      ],
    });
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM mf_transactions').first<{ n: number }>(),
    ).resolves.toEqual({ n: 2 });

    const duplicate = await importFiles([{ name: 'anonymous-counts-again.csv', body: csv }]);
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toMatchObject({
      results: [
        {
          status: 'duplicate',
          counts: { parsed: 3, stored: 0, countable: 0, nonCountable: 0, rejected: 1 },
          rows: 1,
          skipped: 3,
          duplicateIds: 1,
        },
      ],
    });
  });

  it('通常MF取込は全行のメモ・計算対象・振替をD1と再読込に保つ', async () => {
    expect(
      await resultStatuses(
        await importFiles([{ name: 'complete-projection.csv', body: mfCompleteProjectionCsv() }]),
      ),
    ).toEqual(['committed']);

    const rows = await d1
      .prepare(
        `SELECT tx_id AS txId, memo, is_target AS isTarget, is_transfer AS isTransfer
         FROM mf_transactions ORDER BY tx_id`,
      )
      .all<{ txId: string; memo: string | null; isTarget: number; isTransfer: number }>();
    expect(rows.results).toEqual([
      { txId: 'mf-full-1', memo: '  通常メモ  ', isTarget: 1, isTransfer: 0 },
      { txId: 'mf-full-2', memo: '   ', isTarget: 0, isTransfer: 0 },
      { txId: 'mf-full-3', memo: '', isTarget: 1, isTransfer: 1 },
    ]);

    const reloaded = await loadDataset(getDb(d1), 'default', []);
    expect(
      reloaded.mfTx.map(({ id, memo, isTarget, isTransfer }) => ({ id, memo, isTarget, isTransfer })),
    ).toEqual([
      { id: 'mf-full-1', memo: '  通常メモ  ', isTarget: true, isTransfer: false },
      { id: 'mf-full-2', memo: '   ', isTarget: false, isTransfer: false },
      { id: 'mf-full-3', memo: '', isTarget: true, isTransfer: true },
    ]);
  });

  it('raw MF月を全て集計対象外へ洗い替えると旧集計をD1と再読込結果から除く', async () => {
    const header = '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関,メモ';
    const countable = [header, '1,2027/01/01,-123,架空費,通常,0,架空通常,mf-zero-month,架空口座,原本'].join(
      '\n',
    );
    const nonCountable = [
      header,
      '0,2027/01/01,-123,架空費,通常,0,架空通常,mf-zero-month,架空口座,原本',
    ].join('\n');

    expect(await resultStatuses(await importFiles([{ name: 'countable.csv', body: countable }]))).toEqual([
      'committed',
    ]);
    expect(
      await d1
        .prepare("SELECT amount FROM monthly_agg WHERE month='2027-01' AND scope='per_exp:架空費'")
        .first(),
    ).toEqual({ amount: 123 });

    expect(
      await resultStatuses(await importFiles([{ name: 'non-countable.csv', body: nonCountable }])),
    ).toEqual(['committed']);
    const reloaded = await loadDataset(getDb(d1), 'default', []);
    expect(reloaded.mfTx).toMatchObject([{ id: 'mf-zero-month', isTarget: false, isTransfer: false }]);
    expect(reloaded.personal['2027-01']).toEqual({ income: {}, expense: {} });
    expect(reloaded.bizPersonal['2027-01']).toEqual({ income: 0, expense: 0 });
    expect(reloaded.personalByOwner['2027-01']).toEqual({
      business: { income: 0, expense: 0 },
      spouse: { income: 0, expense: 0 },
      family: { income: 0, expense: 0 },
      unset: { income: 0, expense: 0 },
    });
    expect(
      await d1
        .prepare(
          `SELECT scope,amount FROM monthly_agg
           WHERE month='2027-01' AND (scope LIKE 'per_%' OR scope LIKE 'biz_personal_%')
           ORDER BY scope`,
        )
        .all(),
    ).toMatchObject({
      results: [
        { scope: 'biz_personal_in', amount: 0 },
        { scope: 'biz_personal_out', amount: 0 },
      ],
    });
  });

  it('raw MF行が無いJSON復元月はpersonal baselineをD1再読込後も保持する', async () => {
    const source = structuredClone(restoreBody) as Record<string, unknown> & { mfTx: unknown[] };
    source.months = ['2027-02'];
    source.mfTx = [];
    source.personal = {
      '2027-02': { income: { 架空給与: 321 }, expense: { 架空生活費: 45 } },
    };
    source.bizPersonal = { '2027-02': { income: 67, expense: 89 } };

    await expect(restore(source).then((response) => response.json())).resolves.toMatchObject({ ok: true });
    const reloaded = await loadDataset(getDb(d1), 'default', []);
    expect(reloaded.personal['2027-02']).toEqual({
      income: { 架空給与: 321 },
      expense: { 架空生活費: 45 },
    });
    expect(reloaded.bizPersonal['2027-02']).toEqual({ income: 67, expense: 89 });
    expect(
      await d1
        .prepare(
          `SELECT scope,amount FROM monthly_agg
           WHERE month='2027-02' AND (scope LIKE 'per_%' OR scope LIKE 'biz_personal_%')
           ORDER BY scope`,
        )
        .all(),
    ).toMatchObject({
      results: [
        { scope: 'biz_personal_in', amount: 67 },
        { scope: 'biz_personal_out', amount: 89 },
        { scope: 'per_exp:架空生活費', amount: 45 },
        { scope: 'per_inc:架空給与', amount: 321 },
      ],
    });
  });

  it('JSON復元は同じ完全射影と旧undefinedの既定意味をD1と再読込に保つ', async () => {
    const source = structuredClone(restoreBody) as Record<string, unknown> & { mfTx: unknown[] };
    source.months = ['2026-11'];
    source.mfTx = [
      {
        id: 'json-full',
        idStable: true,
        m: '2026-11',
        d: '11/01',
        c: '架空JSON完全',
        a: -404,
        big: '架空費',
        mid: '復元',
        inst: '架空口座',
        memo: '  復元メモ  ',
        isTarget: false,
        isTransfer: true,
      },
      {
        id: 'json-legacy',
        m: '2026-11',
        d: '11/02',
        c: '架空JSON旧形式',
        a: -505,
        big: '架空費',
        mid: '復元',
      },
    ];

    await expect(restore(source).then((response) => response.json())).resolves.toMatchObject({
      ok: true,
      duplicate: false,
      mfTxCount: 2,
    });
    const rows = await d1
      .prepare(
        `SELECT tx_id AS txId, memo, is_target AS isTarget, is_transfer AS isTransfer,
                identity_stable AS identityStable
         FROM mf_transactions ORDER BY tx_id`,
      )
      .all<{
        txId: string;
        memo: string | null;
        isTarget: number;
        isTransfer: number;
        identityStable: number;
      }>();
    expect(rows.results).toEqual([
      { txId: 'json-full', memo: '  復元メモ  ', isTarget: 0, isTransfer: 1, identityStable: 1 },
      { txId: 'json-legacy', memo: null, isTarget: 1, isTransfer: 0, identityStable: 0 },
    ]);

    const reloaded = await loadDataset(getDb(d1), 'default', []);
    expect(
      reloaded.mfTx.map(({ id, memo, isTarget, isTransfer }) => ({ id, memo, isTarget, isTransfer })),
    ).toEqual([
      { id: 'json-full', memo: '  復元メモ  ', isTarget: false, isTransfer: true },
      { id: 'json-legacy', memo: undefined, isTarget: true, isTransfer: false },
    ]);
  });

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

  it('同じvendor keyの候補除外はsource表記へ収束し、fingerprintとD1確定状態を一致させる', async () => {
    await d1
      .prepare(
        `INSERT INTO sub_vendor_exclusions (user_id,partner,vendor_key)
         VALUES ('default','架空 家賃','架空家賃')`,
      )
      .run();
    const body = {
      ...structuredClone(restoreBody),
      subVendorExclusions: [{ partner: '架空家賃' }],
    };

    const first = await restore(body);
    expect(first.status).toBe(200);
    await expect(first.clone().json()).resolves.toMatchObject({ duplicate: false });
    await expect(
      d1
        .prepare(
          `SELECT partner,vendor_key AS vendorKey
           FROM sub_vendor_exclusions WHERE user_id='default'`,
        )
        .first(),
    ).resolves.toEqual({ partner: '架空家賃', vendorKey: '架空家賃' });

    await expect((await restore(body)).clone().json()).resolves.toMatchObject({ duplicate: true });
  });

  it('確定申告の科目判定を年別にbackupし、100%も含めてrestoreで再現する', async () => {
    await d1
      .prepare(
        `INSERT INTO tax_account_settings
           (user_id,tax_year,account,tax_account,business_percent,basis)
         VALUES
           ('default',2025,'架空通信費','通信費',65,'作業時間'),
           ('default',2026,'架空通信費','通信費',100,NULL),
           ('default',2026,'架空地代',NULL,80,'面積比')`,
      )
      .run();

    const backup = await loadBackupPayload(getDb(d1), 'default');
    expect(backup.taxAccountSettings).toEqual([
      {
        taxYear: 2025,
        account: '架空通信費',
        taxAccount: '通信費',
        businessPercent: 65,
        basis: '作業時間',
      },
      {
        taxYear: 2026,
        account: '架空地代',
        taxAccount: null,
        businessPercent: 80,
        basis: '面積比',
      },
      {
        taxYear: 2026,
        account: '架空通信費',
        taxAccount: '通信費',
        businessPercent: 100,
        basis: null,
      },
    ]);

    await d1.prepare("DELETE FROM tax_account_settings WHERE user_id='default'").run();
    const response = await restore(backup);
    expect(response.status, await response.clone().text()).toBe(200);
    await expect(
      d1
        .prepare(
          `SELECT tax_year AS taxYear, account, tax_account AS taxAccount,
                  business_percent AS businessPercent, basis
             FROM tax_account_settings WHERE user_id='default'
            ORDER BY tax_year, account`,
        )
        .all(),
    ).resolves.toMatchObject({ results: backup.taxAccountSettings });
  });

  it('確定申告年と事業割合のD1制約は曖昧な値を受け入れない', async () => {
    const insert = (taxYear: unknown, percent: unknown) =>
      d1
        .prepare(
          `INSERT INTO tax_account_settings
             (user_id,tax_year,account,tax_account,business_percent)
           VALUES ('constraint-test',?,'架空費','諸会費',?)`,
        )
        .bind(taxYear, percent)
        .run();

    await expect(insert(1999, 100)).rejects.toThrow();
    await expect(insert(2100, 100)).rejects.toThrow();
    await expect(insert(2026.5, 100)).rejects.toThrow();
    await expect(insert(2026, null)).rejects.toThrow();
    await expect(insert(2026, 101)).rejects.toThrow();
    await expect(insert(2026, 100)).resolves.toBeDefined();
    await expect(insert(2027, 100)).resolves.toBeDefined();
  });

  it('証憑の取得先と明細別例外をbackupし、利用者を混ぜずにrestoreする', async () => {
    await d1
      .prepare(
        `INSERT INTO receipt_source_profiles
           (user_id,profile_key,merchant_key,service_name,source_url,login_account,memo)
         VALUES
           ('default','架空saas::架空クラウド','架空saas','架空クラウド','https://example.invalid/billing','account@example.invalid','月初に取得'),
           ('default','架空saas::架空ストア','架空saas','架空ストア','https://store.invalid/receipts',NULL,NULL),
           ('default','架空通販::架空ポータル','架空通販','架空ポータル','https://shop.invalid/receipts',NULL,NULL),
           ('other-user','架空saas::架空クラウド','架空saas','他人の取得先','https://other.invalid',NULL,NULL)`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO receipt_source_overrides
           (user_id,target_kind,target_key,merchant_key,profile_key,
            service_name,source_url,login_account,memo)
         VALUES
           ('default','cash','7','架空店舗','架空saas::架空クラウド',NULL,NULL,NULL,NULL),
           ('default','mf','mf-source-1','架空直販',NULL,
            '架空ポータル','https://direct.invalid/receipts','direct@example.invalid','個別取得')`,
      )
      .run();

    const backup = await loadBackupPayload(getDb(d1), 'default');
    expect(backup.receiptSourceProfiles).toEqual([
      {
        profileKey: '架空saas::架空クラウド',
        merchantKey: '架空saas',
        serviceName: '架空クラウド',
        sourceUrl: 'https://example.invalid/billing',
        loginAccount: 'account@example.invalid',
        memo: '月初に取得',
      },
      {
        profileKey: '架空saas::架空ストア',
        merchantKey: '架空saas',
        serviceName: '架空ストア',
        sourceUrl: 'https://store.invalid/receipts',
        loginAccount: null,
        memo: null,
      },
      {
        profileKey: '架空通販::架空ポータル',
        merchantKey: '架空通販',
        serviceName: '架空ポータル',
        sourceUrl: 'https://shop.invalid/receipts',
        loginAccount: null,
        memo: null,
      },
    ]);
    expect(backup.receiptSourceOverrides).toEqual([
      {
        targetKind: 'cash',
        targetKey: '7',
        merchantKey: '架空店舗',
        profileKey: '架空saas::架空クラウド',
        serviceName: null,
        sourceUrl: null,
        loginAccount: null,
        memo: null,
      },
      {
        targetKind: 'mf',
        targetKey: 'mf-source-1',
        merchantKey: '架空直販',
        profileKey: null,
        serviceName: '架空ポータル',
        sourceUrl: 'https://direct.invalid/receipts',
        loginAccount: 'direct@example.invalid',
        memo: '個別取得',
      },
    ]);

    await d1.prepare("DELETE FROM receipt_source_overrides WHERE user_id='default'").run();
    await d1.prepare("DELETE FROM receipt_source_profiles WHERE user_id='default'").run();
    await expect(loadImportRestoreSettingsSnapshot(getDb(d1), 'default')).resolves.toMatchObject({
      receiptSourceProfiles: [],
      receiptSourceOverrides: [],
    });
    const response = await restore(backup);
    expect(response.status, await response.clone().text()).toBe(200);
    await expect(
      d1
        .prepare(
          `SELECT profile_key AS profileKey, merchant_key AS merchantKey, service_name AS serviceName,
                  source_url AS sourceUrl, login_account AS loginAccount, memo
             FROM receipt_source_profiles WHERE user_id='default' ORDER BY profile_key`,
        )
        .all(),
    ).resolves.toMatchObject({ results: backup.receiptSourceProfiles });
    await expect(
      d1
        .prepare(
          `SELECT target_kind AS targetKind, target_key AS targetKey, merchant_key AS merchantKey,
                  profile_key AS profileKey, service_name AS serviceName,
                  source_url AS sourceUrl, login_account AS loginAccount, memo
             FROM receipt_source_overrides WHERE user_id='default' ORDER BY target_kind,target_key`,
        )
        .all(),
    ).resolves.toMatchObject({ results: backup.receiptSourceOverrides });
    await expect(
      d1
        .prepare("SELECT service_name AS serviceName FROM receipt_source_profiles WHERE user_id='other-user'")
        .first(),
    ).resolves.toEqual({ serviceName: '他人の取得先' });
  });

  it('証憑取得先の参照は同一利用者に限定し、秘密値列を持たない', async () => {
    await expect(
      d1
        .prepare(
          `INSERT INTO receipt_source_profiles
             (user_id,profile_key,merchant_key,service_name)
           VALUES ('owner-a','架空取得先::URLなし','架空取得先','URLなし')`,
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO receipt_source_profiles
             (user_id,profile_key,merchant_key,service_name,source_url)
           VALUES ('owner-a','架空取得先::FTP','架空取得先','FTP','ftp://source.invalid')`,
        )
        .run(),
    ).rejects.toThrow();
    await d1
      .prepare(
        `INSERT INTO receipt_source_profiles
           (user_id,profile_key,merchant_key,service_name,source_url)
         VALUES ('owner-a','架空取得先::架空サービス','架空取得先','架空サービス','https://source.invalid')`,
      )
      .run();
    const profileOverride = (userId: string) =>
      d1
        .prepare(
          `INSERT INTO receipt_source_overrides
             (user_id,target_kind,target_key,merchant_key,profile_key)
           VALUES (?,'mf','mf-1','架空店','架空取得先::架空サービス')`,
        )
        .bind(userId)
        .run();
    await expect(profileOverride('owner-b')).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO receipt_source_overrides
             (user_id,target_kind,target_key,merchant_key)
           VALUES ('owner-a','cash','1','架空店')`,
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO receipt_source_overrides
             (user_id,target_kind,target_key,merchant_key,service_name)
           VALUES ('owner-a','cash','2','架空店','架空取得先')`,
        )
        .run(),
    ).rejects.toThrow();
    await expect(profileOverride('owner-a')).resolves.toBeDefined();
    await expect(
      d1
        .prepare(
          `UPDATE receipt_source_profiles SET profile_key='架空取得先::架空新サービス'
            WHERE user_id='owner-a' AND profile_key='架空取得先::架空サービス'`,
        )
        .run(),
    ).resolves.toBeDefined();
    await expect(
      d1
        .prepare(
          `SELECT profile_key AS profileKey
             FROM receipt_source_overrides WHERE user_id='owner-a'`,
        )
        .first(),
    ).resolves.toEqual({ profileKey: '架空取得先::架空新サービス' });
    await expect(
      d1
        .prepare(
          `DELETE FROM receipt_source_profiles
            WHERE user_id='owner-a' AND profile_key='架空取得先::架空新サービス'`,
        )
        .run(),
    ).rejects.toThrow();
    const columns = await d1.prepare('PRAGMA table_info(receipt_source_profiles)').all<{ name: string }>();
    expect(columns.results.map((column) => column.name)).not.toContain('password');
    expect(columns.results.map((column) => column.name)).not.toContain('token');
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

  it('移行先に記帳が無いときだけ、現金記帳をidごと復元して集計を保つ', async () => {
    const body = {
      ...structuredClone(restoreBody),
      biz: { revenue: [0], categories: ['架空通信費'], expense: { 架空通信費: [1000] } },
      cashEntries: [
        {
          id: 7,
          date: '2026-07-10',
          month: '2026-07',
          side: 'biz',
          io: 'expense',
          amount: 1000,
          description: '架空現金',
          categoryMajor: '架空通信費',
          categoryMid: '',
          memo: null,
          transitFrom: null,
          transitTo: null,
          transitRound: false,
          receiptWaived: false,
        },
      ],
      cashProjection: {
        version: 1,
        basis: 'post-resolution',
        rows: [{ month: '2026-07', scope: 'biz_exp:架空通信費', amount: 1000 }],
      },
    };

    const first = (await (await restore(body)).json()) as { cashEntries: number; cashKept: number };
    expect(first).toMatchObject({ cashEntries: 1, cashKept: 0 });
    expect(await d1.prepare('SELECT id,amount,category_major FROM cash_entries').all()).toMatchObject({
      results: [{ id: 7, amount: 1000, category_major: '架空通信費' }],
    });
    // 投影で引いた分を復元した記帳が戻すので、集計はバックアップと同じ額に落ち着く
    expect(
      await d1
        .prepare("SELECT amount FROM monthly_agg WHERE user_id='default' AND scope='biz_exp:架空通信費'")
        .first(),
    ).toEqual({ amount: 1000 });

    const again = (await (await restore(body)).json()) as { cashEntries: number; cashKept: number };
    expect(again).toMatchObject({ cashEntries: 0, cashKept: 1 });
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM cash_entries').first()).toEqual({ n: 1 });
  });

  it('分割済みMFを再取込してもraw planningとaccounting projectionを混ぜず、内訳集計を保存する', async () => {
    const first = [
      '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
      '1,2026/09/01,-100000,未分類,,0,架空引き落とし,split-parent,架空口座',
    ].join('\n');
    expect(await resultStatuses(await importFiles([{ name: 'split-parent.csv', body: first }]))).toEqual([
      'committed',
    ]);
    await d1
      .prepare(
        `INSERT INTO tx_splits
          (user_id,tx_id,line_id,seq,parent_amount,amount,cls,category_major,category_mid,created_at,updated_at)
         VALUES
          ('default','split-parent','00000000-0000-4000-8000-000000000001',1,100000,60000,'per','食費','',datetime('now'),datetime('now')),
          ('default','split-parent','00000000-0000-4000-8000-000000000002',2,100000,40000,'per','日用品','',datetime('now'),datetime('now'))`,
      )
      .run();

    const second = first.replace('架空引き落とし', '架空引き落とし（更新）');
    const response = await importFiles([{ name: 'split-parent-updated.csv', body: second }]);
    expect(response.status).toBe(200);
    expect(await resultStatuses(response)).toEqual(['committed']);
    const aggregates = await d1
      .prepare(
        `SELECT scope,amount FROM monthly_agg
          WHERE user_id='default' AND month='2026-09' AND scope LIKE 'per_exp:%'
          ORDER BY scope`,
      )
      .all<{ scope: string; amount: number }>();
    expect(aggregates.results).toEqual([
      { scope: 'per_exp:日用品', amount: 40000 },
      { scope: 'per_exp:食費', amount: 60000 },
    ]);
    expect(await d1.prepare("SELECT COUNT(*) AS n FROM tx_splits WHERE user_id='default'").first()).toEqual({
      n: 2,
    });
  });

  it('backup/export/fingerprint/restoreのcanonical inventoryにtx_splitsを含めて往復する', async () => {
    const csv = [
      '計算対象,日付,金額,大項目,中項目,振替,内容,ID,保有金融機関',
      '1,2026/09/01,-100000,未分類,,0,架空引き落とし,backup-parent,架空口座',
    ].join('\n');
    expect(await resultStatuses(await importFiles([{ name: 'backup-parent.csv', body: csv }]))).toEqual([
      'committed',
    ]);
    await d1
      .prepare(
        `INSERT INTO tx_splits
          (user_id,tx_id,line_id,seq,parent_amount,amount,cls,category_major,category_mid,created_at,updated_at)
         VALUES
          ('default','backup-parent','00000000-0000-4000-8000-000000000011',1,100000,70000,'per','食費','',datetime('now'),datetime('now')),
          ('default','backup-parent','00000000-0000-4000-8000-000000000012',2,100000,30000,'per','日用品','',datetime('now'),datetime('now'))`,
      )
      .run();
    const backup = await loadBackupPayload(getDb(d1), 'default');
    expect(backup.txSplits).toMatchObject({
      version: 1,
      rows: [{ txId: 'backup-parent' }, { txId: 'backup-parent' }],
    });

    await d1.prepare("DELETE FROM tx_splits WHERE user_id='default'").run();
    const response = await restore(backup);
    expect(response.status).toBe(200);
    expect(
      await d1
        .prepare(
          "SELECT line_id AS lineId,parent_amount AS parentAmount FROM tx_splits WHERE user_id='default' ORDER BY seq",
        )
        .all(),
    ).toMatchObject({
      results: [
        { lineId: '00000000-0000-4000-8000-000000000011', parentAmount: 100000 },
        { lineId: '00000000-0000-4000-8000-000000000012', parentAmount: 100000 },
      ],
    });
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
    const planningSnapshot = await loadImportRestoreSettingsSnapshot(observedDb, 'default');
    // 取込の下見はD1の50 query上限に張り付いているので、分割の内訳は読まない。
    // ledgerもその呼び方に合わせる(実際の呼び出しとずれると予算が意味を失う)
    const raw = await loadDataset(observedDb, 'default', planningSnapshot.cashEntries, { withSplits: false });
    raw.txSplits = planningSnapshot.txSplits;
    expect(observed.count()).toBe(1 + LOAD_DATASET_QUERY_COUNT_WITH_CASH_SNAPSHOT);

    const plan = planMultipartImportQueries({
      fileCount: 1,
      unitCount: 1,
      applicableUnitCount: 1,
      jsonUnitCount: 0,
      commitStatementCounts: [1],
    });
    // routeはcanonical planning snapshot 1本とraw loadDatasetを同じ呼び方で使う。
    expect(plan.breakdown.preflightReads).toBe(observed.count());
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

describe('取込のやり直し(原本の取り出し)', () => {
  const history = async (): Promise<Array<{ id: number; filename: string; originalRecorded: boolean }>> => {
    const response = await app.request(
      '/api/imports',
      { headers: { cookie } },
      { ...auth, DB: d1, FILES: files },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      imports: Array<{ id: number; filename: string; originalRecorded: boolean }>;
    };
    return body.imports;
  };

  const original = async (id: number): Promise<Response> =>
    app.request(`/api/imports/${id}/original`, { headers: { cookie } }, { ...auth, DB: d1, FILES: files });

  it('保存した原本をそのまま返し、履歴はやり直せることを申告する', async () => {
    const body = freeeCsv(801);
    expect(await resultStatuses(await importFiles([{ name: 'redo.csv', body }]))).toEqual(['committed']);
    const [row] = await history();
    expect(row.originalRecorded).toBe(true);

    const response = await original(row.id);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('content-disposition')).toContain(encodeURIComponent('redo.csv'));
  });

  it('取り出した原本を投入し直すと通常の取込と同じ経路で洗い替えられる', async () => {
    const first = freeeCsvRows(3);
    expect(await resultStatuses(await importFiles([{ name: 'gen1.csv', body: first }]))).toEqual([
      'committed',
    ]);
    // 別内容で上書きし、1世代目を「更新済み」にする
    expect(await resultStatuses(await importFiles([{ name: 'gen2.csv', body: freeeCsvRows(1) }]))).toEqual([
      'committed',
    ]);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM freee_deals').first<{ n: number }>()).toEqual({
      n: 1,
    });

    const gen1 = (await history()).find((row) => row.filename === 'gen1.csv');
    if (!gen1) throw new Error('gen1 not found');
    const restored = await (await original(gen1.id)).text();
    expect(await resultStatuses(await importFiles([{ name: 'gen1.csv', body: restored }]))).toEqual([
      'committed',
    ]);
    expect(await d1.prepare('SELECT COUNT(*) AS n FROM freee_deals').first<{ n: number }>()).toEqual({
      n: 3,
    });
  });

  it('R2から原本が消えていれば理由つきで断り、勝手にやり直さない', async () => {
    expect(await resultStatuses(await importFiles([{ name: 'gone.csv', body: freeeCsv(802) }]))).toEqual([
      'committed',
    ]);
    const [row] = await history();
    const key = await d1
      .prepare('SELECT r2_key AS r2Key FROM imports WHERE id=?')
      .bind(row.id)
      .first<{ r2Key: string }>();
    if (!key) throw new Error('r2 key not found');
    await files.delete(key.r2Key);

    const response = await original(row.id);
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'import_original_missing',
    );
  });

  it('他人の取込・存在しないIDは原本を返さない', async () => {
    expect(await resultStatuses(await importFiles([{ name: 'mine.csv', body: freeeCsv(803) }]))).toEqual([
      'committed',
    ]);
    const [row] = await history();
    await d1.prepare("UPDATE imports SET user_id='synthetic-other-user' WHERE id=?").bind(row.id).run();

    expect((await original(row.id)).status).toBe(404);
    expect((await original(999_999)).status).toBe(404);
    expect((await original(0)).status).toBe(400);
  });
});
