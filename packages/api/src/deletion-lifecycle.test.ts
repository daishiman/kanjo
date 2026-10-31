/**
 * 取込データの削除・取り消しの API/D1 ライフサイクル回帰テスト。
 * 実データは使わず、専用のインメモリ D1 と架空の明細だけで検証する。
 *
 * 見張っているのは5つ。
 *   1. 指定した範囲の外が1件も消えないこと(DR-1)
 *   2. 手入力(負債・手当て)が取込の削除で消えないこと(DR-6)
 *   3. 消したら取込指紋も落ち、同じCSVをもう一度入れられること(DR-4)
 *   4. 取り消しで明細と指紋が対で戻ること(DR-4 / DR-8)
 *   5. 応答と履歴に明細の内容・金額が出ないこと(DR-9)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freeeDealKeys } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NON_AUTH_AUDIT, loginForTest } from './auth.test-support.js';
import { planDeletionQueries, planUndoQueries } from './deletion-lifecycle.js';
import { IMPORT_RATE_WINDOW_MS } from './import-rate-limit.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { runR2Cleanup } from './r2-cleanup.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';
import * as store from './store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  BETTER_AUTH_SECRET: 'synthetic-test-secret-at-least-32-chars',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let files: R2Bucket;
let cookie: string;

const env = (database: D1Database = d1) => ({ ...auth, DB: database, FILES: files });

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
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
const mfCsv = (rows: string[]) => [MF_HEADER, ...rows].join('\n');

/** 6月2件・7月1件。すべて架空。 */
const JUNE_JULY = mfCsv([
  '1,2026/06/10,-1000,架空費,架空内訳,0,架空の支払い6a,tx-jun-a,架空口座',
  '1,2026/06/20,-2000,架空費,架空内訳,0,架空の支払い6b,tx-jun-b,架空口座',
  '1,2026/07/05,-3000,架空費,架空内訳,0,架空の支払い7a,tx-jul-a,架空口座',
]);

const ASSETS_JUNE_JULY = [
  '日付,合計（円）,預金・現金（円）,株式（円）',
  '2026/06/30,300,100,200',
  '2026/07/31,500,200,300',
].join('\n');

async function importMf(body: string, name: string): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([body], name, { type: 'text/csv' }));
  return app.request('/api/imports', { method: 'POST', headers: { cookie }, body: form }, env());
}

const restoreJson = (body: Record<string, unknown>): Promise<Response> =>
  Promise.resolve(
    app.request(
      '/api/restore',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
      env(),
    ),
  );

const JSON_RESTORE = {
  months: ['2027-02'],
  biz: { revenue: [0], categories: [], expense: {} },
  subs: { vendors: [], matrix: {}, other: [0] },
  personal: {
    '2027-02': { income: { 架空給与: 321 }, expense: { 架空生活費: 45 } },
  },
  bizPersonal: { '2027-02': { income: 67, expense: 89 } },
  mfTx: [
    {
      id: 'json-reimport',
      idStable: true,
      m: '2027-02',
      d: '02/01',
      c: '架空JSON復元',
      a: -404,
      big: '架空費',
      mid: '復元',
      inst: '架空口座',
      isTarget: true,
      isTransfer: false,
    },
  ],
  rules: [],
  edits: {},
  institutionOwners: {},
  budgets: { 架空費: 100 },
  cashOverride: {},
  unrecordedExpMonths: [],
};

const FREEE_HEADER = '収支区分,発生日,勘定科目,金額,取引先,支払期日,支払日,支払口座,支払金額';
/**
 * 6月の事業取引3件。すべて架空。
 *
 * 2件以上あることに意味がある。freee は明細の同一性を整数の `id` で見るので、
 * 1件だけだと「退避行の識別子が全行同じ値になる」不具合が表に出ない。
 */
const FREEE_JUNE = [
  FREEE_HEADER,
  '支出,2026/06/03,通信費,3300,架空クラウド,2026/06/30,2026/06/28,架空口座,3300',
  '支出,2026/06/05,外注費,55000,架空事務所,2026/06/30,,,',
  '収入,2026/06/15,売上高,240000,架空クライアント,2026/06/30,2026/06/30,架空口座,240000',
].join('\n');

/** 全件削除をAPIから実行するときに、利用者が画面で明示した対象範囲。 */
const CONFIRMED_ALL_MONTHS = { from: '2026-06', to: '2026-07' } as const;
const confirmedAll = (
  fingerprint: string,
  confirmedPeriod: { from: string; to: string } = CONFIRMED_ALL_MONTHS,
) => ({
  granularity: 'all' as const,
  confirmedPeriod,
  fingerprint,
});

describe('undo のクエリ予算', () => {
  it('復元が大きすぎる場合は書き込み前に拒否する', () => {
    expect(
      planUndoQueries({ restoreStatements: 8, auditStatements: 1, recomputeStatements: 16 }).accepted,
    ).toBe(true);
    expect(
      planUndoQueries({ restoreStatements: 30, auditStatements: 1, recomputeStatements: 16 }).accepted,
    ).toBe(false);
  });
});

describe('明細削除のクエリ予算', () => {
  const transactionPlan = (recomputeStatements: number) =>
    planDeletionQueries({
      payloadChunks: 1,
      tombstoneChunks: 1,
      deleteChunks: 1,
      fullResetReads: 0,
      fullResetDeletes: 0,
      targetChunks: 0,
      auditStatements: 1,
      recomputeStatements,
    });

  it('正本変更と集計置換を含めてもD1上限未満に収まる', () => {
    const plan = transactionPlan(18);
    expect(plan.accepted).toBe(true);
    expect(plan.total).toBeLessThan(plan.limit);
  });

  it('集計計画が膨らんだ場合は書込み前に拒否する', () => {
    expect(transactionPlan(31).accepted).toBe(false);
  });
});

const balanceRowCount = async (): Promise<number> =>
  (await d1
    .prepare('SELECT COUNT(*) AS n FROM balance_entries WHERE user_id=?')
    .bind('default')
    .first<number>('n')) as number;

const freeeDealCount = async (): Promise<number> =>
  (await d1
    .prepare('SELECT COUNT(*) AS n FROM freee_deals WHERE user_id=?')
    .bind('default')
    .first<number>('n')) as number;

const txIds = async (): Promise<string[]> =>
  (
    await d1
      .prepare('SELECT tx_id FROM mf_transactions WHERE user_id=? ORDER BY tx_id')
      .bind('default')
      .all<{ tx_id: string }>()
  ).results.map((row) => row.tx_id);

const activeTargetKeys = async (): Promise<string[]> =>
  (
    await d1
      .prepare('SELECT target_key FROM import_active_targets WHERE user_id=? ORDER BY target_key')
      .bind('default')
      .all<{ target_key: string }>()
  ).results.map((row) => row.target_key);

const monthlyAmount = async (month: string, scope: string): Promise<number> =>
  (await d1
    .prepare('SELECT amount FROM monthly_agg WHERE user_id=? AND month=? AND scope=?')
    .bind('default', month, scope)
    .first<number>('amount')) ?? 0;

/**
 * 削除とmonthly_agg入れ替えを含むbatchの最後で制約違反を起こす。
 * D1がbatch全体をrollbackし、正本/集計/操作記録の片側だけが残らないことを見る。
 */
const failCombinedDeletionBatch = (
  beforeCommit?: () => Promise<void>,
): { database: D1Database; statements: () => string[] } => {
  let observed: string[] = [];
  const originals = new WeakMap<object, D1PreparedStatement>();
  const sqlByStatement = new WeakMap<object, string>();
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: unknown[]) =>
            wrap((target.bind as (...args: unknown[]) => D1PreparedStatement).call(target, ...values), sql);
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as D1PreparedStatement;
    originals.set(proxy, statement);
    sqlByStatement.set(proxy, sql);
    return proxy;
  };
  const database = new Proxy(d1, {
    get(target, property, receiver) {
      if (property === 'prepare') return (sql: string) => wrap(target.prepare(sql), sql);
      if (property === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          observed = statements.map((statement) => sqlByStatement.get(statement) ?? '');
          const raw = statements.map((statement) => originals.get(statement) ?? statement);
          const includesCanonical = observed.some((sql) =>
            /(?:DELETE FROM|INSERT INTO) mf_transactions/i.test(sql),
          );
          const includesAggregate = observed.some((sql) => /DELETE FROM "monthly_agg"/i.test(sql));
          if (includesCanonical && includesAggregate) {
            if (beforeCommit) await beforeCommit();
            else
              raw.push(
                target.prepare(
                  `INSERT INTO import_deletion_operations
                     (id,user_id,kind,granularity,request_json,fingerprint,counts_json,expires_at,created_at)
                   VALUES ('forced-existing','default','delete','transaction','{}','x','{}','2099-01-01','2099-01-01')`,
                ),
              );
          }
          return target.batch(raw);
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { database, statements: () => observed };
};

const latestImportId = async (): Promise<number> =>
  (await d1
    .prepare("SELECT id FROM imports WHERE user_id=? AND status='committed' ORDER BY id DESC LIMIT 1")
    .bind('default')
    .first<number>('id')) as number;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'deletion-lifecycle-test',
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
  cookie = await loginForTest(app, env());
});

afterAll(async () => {
  await mf?.dispose();
});

describe('削除前の確認(preflight)', () => {
  it('件数と巻き添えを返し、1件も消さない', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    expect((await jsonRequest('/transactions/tx-jun-a/edit', 'PUT', { cls: 'biz' })).status).toBe(200);

    const response = await jsonRequest('/data/deletions/preflight', 'POST', {
      granularity: 'period',
      period: { from: '2026-06', to: '2026-06' },
    });
    const body = (await response.json()) as {
      counts: { mfTx: number };
      collateral: { txEdits: number; cashEntries: number };
      months: string[];
      fingerprint: string;
      undoable: boolean;
      undoRetentionDays: number;
    };

    expect(response.status).toBe(200);
    expect(body.counts.mfTx).toBe(2);
    expect(body.collateral.txEdits).toBe(1);
    expect(body.months).toEqual(['2026-06']);
    expect(body.undoable).toBe(true);
    expect(body.undoRetentionDays).toBe(30);
    // 確認しただけで明細は残っている
    expect(await txIds()).toEqual(['tx-jul-a', 'tx-jun-a', 'tx-jun-b']);
  });

  /**
   * 内訳も巻き添えとして数える(DR-6)。
   *
   * 数え方そのものは core に試験がある。ここで見たいのは D1 側の読み出しで、
   * 表や列の名前がずれていても「0件」に見えてしまい、消える前の警告が
   * 静かに消える。0 でない値を1度は通しておかないと、その取り違えは出ない。
   */
  it('内訳のある明細は巻き添え件数に出る', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_splits (user_id, tx_id, line_id, seq, parent_amount, amount, cls, category_major, created_at, updated_at)
         VALUES ('default','tx-jun-a','line-架空-1',1,1000,600,'biz','架空費','2026-06-01T00:00:00.000Z','2026-06-01T00:00:00.000Z')`,
      )
      .run();
    const response = await jsonRequest('/data/deletions/preflight', 'POST', {
      granularity: 'period',
      period: { from: '2026-06', to: '2026-06' },
    });
    const body = (await response.json()) as { collateral: Record<string, number> };
    expect(response.status).toBe(200);
    expect(body.collateral.txSplits).toBe(1);
    // 証憑の廃止で巻き添えの数え上げから添付が消えたこと。残骸の列が残ると
    // 常に0を返す枠が画面に出続けるため、キー自体が無いことを見る
    expect(Object.keys(body.collateral)).not.toContain('attachments');
  });

  it('現金記録は巻き添え0として示す(DR-6)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const response = await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' });
    const body = (await response.json()) as { collateral: { cashEntries: number } };
    expect(body.collateral.cashEntries).toBe(0);
  });

  it('確認後に対象明細の手当てが増えたら実行を止める', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const request = { granularity: 'transaction', txIds: ['tx-jun-a'] } as const;
    const preflight = (await (await jsonRequest('/data/deletions/preflight', 'POST', request)).json()) as {
      fingerprint: string;
    };
    await d1
      .prepare(
        "INSERT INTO tx_edits (user_id,tx_id,cls,updated_at) VALUES ('default','tx-jun-a','biz','2026-09-02T00:00:00.000Z')",
      )
      .run();

    const response = await jsonRequest('/data/deletions', 'POST', {
      ...request,
      fingerprint: preflight.fingerprint,
    });
    expect(response.status).toBe(409);
    expect(await txIds()).toContain('tx-jun-a');
  });

  it('明細の内容も金額も返さない(DR-9)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const text = await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).text();
    expect(text).not.toMatch(/架空の支払い|1000|2000|3000/);
  });

  it('期間の指定が無い期間削除は受け付けない', async () => {
    expect((await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'period' })).status).toBe(
      400,
    );
  });

  it('種別は期間・全件の絞り込みにだけ使える', async () => {
    expect(
      (
        await jsonRequest('/data/deletions/preflight', 'POST', {
          granularity: 'transaction',
          txIds: ['tx-jun-a'],
          kinds: ['mf'],
        })
      ).status,
    ).toBe(400);
  });
});

describe('削除の実行', () => {
  it('明細1件の削除とundoでmonthly_aggも同時に収束する', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    expect(await monthlyAmount('2026-06', 'per_exp:架空費')).toBe(3000);
    const request = { granularity: 'transaction', txIds: ['tx-jun-a'] } as const;
    const preflight = (await (await jsonRequest('/data/deletions/preflight', 'POST', request)).json()) as {
      fingerprint: string;
    };

    const deleted = await jsonRequest('/data/deletions', 'POST', {
      ...request,
      fingerprint: preflight.fingerprint,
    });
    expect(deleted.status).toBe(200);
    expect(await txIds()).toEqual(['tx-jul-a', 'tx-jun-b']);
    expect(await monthlyAmount('2026-06', 'per_exp:架空費')).toBe(2000);

    const { operationId } = (await deleted.json()) as { operationId: string };
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);
    expect(await monthlyAmount('2026-06', 'per_exp:架空費')).toBe(3000);
  });

  it('同一batchのmonthly_agg確定に失敗したら明細と操作記録も残さない', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const request = { granularity: 'transaction', txIds: ['tx-jun-a'] } as const;
    const preflight = (await (await jsonRequest('/data/deletions/preflight', 'POST', request)).json()) as {
      fingerprint: string;
    };
    await d1
      .prepare(
        `INSERT INTO import_deletion_operations
           (id,user_id,kind,granularity,request_json,fingerprint,counts_json,expires_at,created_at)
         VALUES ('forced-existing','default','delete','transaction','{}','x','{}','2099-01-01','2099-01-01')`,
      )
      .run();
    const observed = failCombinedDeletionBatch();

    const response = await app.request(
      '/api/data/deletions',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ...request, fingerprint: preflight.fingerprint }),
      },
      env(observed.database),
    );
    expect(response.status).toBe(500);
    expect(await txIds()).toContain('tx-jun-a');
    expect(await monthlyAmount('2026-06', 'per_exp:架空費')).toBe(3000);
    expect(
      await d1
        .prepare("SELECT COUNT(*) AS n FROM import_deletion_operations WHERE id!='forced-existing'")
        .first<number>('n'),
    ).toBe(0);
    await expect(
      d1.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE ${NON_AUTH_AUDIT}`).first<number>('n'),
    ).resolves.toBe(0);
    expect(observed.statements().some((sql) => /DELETE FROM mf_transactions/i.test(sql))).toBe(true);
    expect(observed.statements().some((sql) => /DELETE FROM "monthly_agg"/i.test(sql))).toBe(true);
    expect(observed.statements().some((sql) => /INSERT INTO audit_log\s/i.test(sql))).toBe(true);
  });

  it('全件はpreflight後も明示した期間が無ければ拒否し、範囲を添えれば実行できる', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };

    const rejected = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'all',
      fingerprint: preflight.fingerprint,
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ error: { code: 'all_scope_confirmation_required' } });
    expect(await txIds()).toHaveLength(3);

    const mismatched = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'all',
      confirmedPeriod: { from: '2026-06', to: '2026-06' },
      fingerprint: preflight.fingerprint,
    });
    expect(mismatched.status).toBe(400);
    expect(await mismatched.json()).toMatchObject({ error: { code: 'all_scope_confirmation_mismatch' } });
    expect(await txIds()).toHaveLength(3);

    const accepted = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'all',
      confirmedPeriod: { from: '2026-06', to: '2026-07' },
      fingerprint: preflight.fingerprint,
    });
    expect(accepted.status).toBe(200);
    expect(await txIds()).toEqual([]);
  });

  it('全件の確認期間は実際のmin/maxと完全一致しなければ拒否する', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };

    const broader = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'all',
      confirmedPeriod: { from: '2026-05', to: '2026-08' },
      fingerprint: preflight.fingerprint,
    });
    expect(broader.status).toBe(400);
    expect(await broader.json()).toMatchObject({ error: { code: 'all_scope_confirmation_mismatch' } });
    expect(await txIds()).toHaveLength(3);
  });

  it('canonical行が無くてもfull resetで消えるbaseline月をpreflightと指紋に含める', async () => {
    await d1
      .prepare('INSERT INTO restored_monthly_agg (user_id,month,scope,amount) VALUES (?,?,?,?)')
      .bind('default', '2025-12', 'biz_exp:架空復元', 4321)
      .run();

    const response = await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' });
    expect(response.status).toBe(200);
    const preflight = (await response.json()) as {
      fingerprint: string;
      months: string[];
      counts: { months: number };
      fullRange: { from: string; to: string } | null;
    };
    expect(preflight.months).toEqual(['2025-12']);
    expect(preflight.counts.months).toBe(1);
    expect(preflight.fullRange).toEqual({ from: '2025-12', to: '2025-12' });

    const deleted = await jsonRequest(
      '/data/deletions',
      'POST',
      confirmedAll(preflight.fingerprint, preflight.fullRange ?? { from: '', to: '' }),
    );
    expect(deleted.status).toBe(200);
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM restored_monthly_agg WHERE user_id=?').bind('default').first('n'),
    ).resolves.toBe(0);
  });

  it('preflight後にfull resetのbaseline対象が増えたら指紋不一致で止める', async () => {
    await d1
      .prepare('INSERT INTO restored_monthly_agg (user_id,month,scope,amount) VALUES (?,?,?,?)')
      .bind('default', '2025-12', 'biz_exp:架空復元A', 1)
      .run();
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string; fullRange: { from: string; to: string } };
    await d1
      .prepare('INSERT INTO restored_monthly_agg (user_id,month,scope,amount) VALUES (?,?,?,?)')
      .bind('default', '2025-12', 'biz_exp:架空復元B', 2)
      .run();

    const changed = await jsonRequest(
      '/data/deletions',
      'POST',
      confirmedAll(preflight.fingerprint, preflight.fullRange),
    );
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ error: { code: 'deletion_scope_changed' } });
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM restored_monthly_agg WHERE user_id=?').bind('default').first('n'),
    ).resolves.toBe(2);
  });

  it('指定した期間だけを消し、範囲外は1件も消さない(DR-1)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', {
        granularity: 'period',
        period: { from: '2026-06', to: '2026-06' },
      })
    ).json()) as { fingerprint: string };

    const response = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'period',
      period: { from: '2026-06', to: '2026-06' },
      fingerprint: preflight.fingerprint,
    });

    expect(response.status).toBe(200);
    expect(await txIds()).toEqual(['tx-jul-a']);
  });

  it('事業の取引が複数あっても、まとめて消して戻せる', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    expect((await importMf(FREEE_JUNE, 'freee-a.csv')).status).toBe(200);
    expect(await freeeDealCount()).toBe(3);
    expect(await monthlyAmount('2026-06', 'biz_exp:通信費')).toBe(3300);

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', {
        granularity: 'period',
        period: { from: '2026-06', to: '2026-06' },
      })
    ).json()) as { fingerprint: string };

    const response = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'period',
      period: { from: '2026-06', to: '2026-06' },
      fingerprint: preflight.fingerprint,
    });
    expect(response.status).toBe(200);
    expect(await freeeDealCount()).toBe(0);
    expect(await txIds()).toEqual(['tx-jul-a']);
    expect(await monthlyAmount('2026-06', 'biz_exp:通信費')).toBe(0);

    // 退避は1明細につき1行。全行が同じ識別子になっていると、ここで3件揃わない
    await expect(
      d1
        .prepare(
          "SELECT COUNT(DISTINCT row_id) AS n FROM import_deleted_rows WHERE user_id=? AND table_name='freee_deals'",
        )
        .bind('default')
        .first<number>('n'),
    ).resolves.toBe(3);

    const { operationId } = (await response.json()) as { operationId: string };
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST', {})).status).toBe(200);
    expect(await freeeDealCount()).toBe(3);
    expect(await monthlyAmount('2026-06', 'biz_exp:通信費')).toBe(3300);
  });

  it('取り込んだ資産の行が複数あっても、まとめて消して戻せる', async () => {
    // freee と同じく、資産の行も同一性を整数の `id` で見る。2ヶ月ぶん入れて
    // 「退避行の識別子が全行同じ値になる」不具合が出ないことを見る
    const assets = [
      '日付,合計（円）,預金・現金（円）,株式（円）',
      '2026/06/30,300,100,200',
      '2026/07/31,500,200,300',
    ].join('\n');
    expect((await importMf(assets, '資産推移.csv')).status).toBe(200);
    const imported = await balanceRowCount();
    expect(imported).toBeGreaterThan(1);

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    const response = await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint));
    expect(response.status).toBe(200);
    expect(await balanceRowCount()).toBe(0);

    // 退避は1行につき1行。識別子が潰れていると、ここで件数が揃わない
    await expect(
      d1
        .prepare(
          "SELECT COUNT(DISTINCT row_id) AS n FROM import_deleted_rows WHERE user_id=? AND table_name='balance_entries'",
        )
        .bind('default')
        .first<number>('n'),
    ).resolves.toBe(imported);

    const { operationId } = (await response.json()) as { operationId: string };
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST', {})).status).toBe(200);
    expect(await balanceRowCount()).toBe(imported);
  });

  it('MF明細・MF資産残高・freee仕訳の混在データを全件消し、それぞれ新規取込できる', async () => {
    expect((await importMf(JUNE_JULY, 'mf-mixed.csv')).status).toBe(200);
    expect((await importMf(FREEE_JUNE, 'freee-mixed.csv')).status).toBe(200);
    expect((await importMf(ASSETS_JUNE_JULY, 'assets-mixed.csv')).status).toBe(200);

    const importedBalances = await balanceRowCount();
    expect(importedBalances).toBeGreaterThan(0);
    const preflightResponse = await jsonRequest('/data/deletions/preflight', 'POST', {
      granularity: 'all',
    });
    const preflight = (await preflightResponse.json()) as {
      counts: { mfTx: number; freeeDeals: number; balanceEntries: number };
      fingerprint: string;
      fullRange: { from: string; to: string };
    };
    expect(preflightResponse.status).toBe(200);
    expect(preflight.counts).toMatchObject({
      mfTx: 3,
      freeeDeals: 3,
      balanceEntries: importedBalances,
    });
    expect(preflight.fullRange).toEqual({ from: '2026-06', to: '2026-07' });

    const deleted = await jsonRequest(
      '/data/deletions',
      'POST',
      confirmedAll(preflight.fingerprint, preflight.fullRange),
    );
    expect(deleted.status).toBe(200);
    expect(await txIds()).toEqual([]);
    expect(await freeeDealCount()).toBe(0);
    expect(await balanceRowCount()).toBe(0);
    expect(await activeTargetKeys()).toEqual([]);

    // 初期投入 3 回と再取込 3 回は、実運用では別の操作時間になる。互換 API の 5 回/分を
    // 緩めずに「削除後も同じ原本を取り込める」というこのテストの責務だけを確認する。
    await d1
      .prepare("UPDATE import_rate_limits SET window_start=window_start-? WHERE user_id=? AND kind='commit'")
      .bind(IMPORT_RATE_WINDOW_MS, 'default')
      .run();

    expect((await importMf(JUNE_JULY, 'mf-replacement.csv')).status).toBe(200);
    expect((await importMf(FREEE_JUNE, 'freee-replacement.csv')).status).toBe(200);
    expect((await importMf(ASSETS_JUNE_JULY, 'assets-replacement.csv')).status).toBe(200);
    expect(await txIds()).toEqual(['tx-jul-a', 'tx-jun-a', 'tx-jun-b']);
    expect(await freeeDealCount()).toBe(3);
    expect(await balanceRowCount()).toBe(importedBalances);
    expect(await activeTargetKeys()).toEqual(
      expect.arrayContaining([
        'mf:2026-06',
        'mf:2026-07',
        'freee:2026-06',
        'assets:2026-06',
        'assets:2026-07',
      ]),
    );
  });

  it('JSON復元後の明細とbaselineも全件消し、同じJSONを新規復元できる', async () => {
    const first = await restoreJson(JSON_RESTORE);
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ ok: true, duplicate: false, mfTxCount: 1 });

    const preflightResponse = await jsonRequest('/data/deletions/preflight', 'POST', {
      granularity: 'all',
    });
    const preflight = (await preflightResponse.json()) as {
      counts: { mfTx: number; months: number };
      months: string[];
      fingerprint: string;
      fullRange: { from: string; to: string };
    };
    expect(preflightResponse.status).toBe(200);
    expect(preflight.counts.mfTx).toBe(1);
    expect(preflight.months).toEqual(['2027-02']);
    expect(preflight.fullRange).toEqual({ from: '2027-02', to: '2027-02' });

    const deleted = await jsonRequest(
      '/data/deletions',
      'POST',
      confirmedAll(preflight.fingerprint, preflight.fullRange),
    );
    expect(deleted.status).toBe(200);
    expect(await txIds()).toEqual([]);
    await expect(
      d1
        .prepare('SELECT COUNT(*) AS n FROM restored_monthly_agg WHERE user_id=?')
        .bind('default')
        .first<number>('n'),
    ).resolves.toBe(0);

    const second = await restoreJson(JSON_RESTORE);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ ok: true, duplicate: false, mfTxCount: 1 });
    expect(await txIds()).toEqual(['json-reimport']);
    await expect(
      d1
        .prepare('SELECT COUNT(*) AS n FROM restored_monthly_agg WHERE user_id=?')
        .bind('default')
        .first<number>('n'),
    ).resolves.toBeGreaterThan(0);
  });

  it('確認していない削除は受け付けない', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const response = await jsonRequest('/data/deletions', 'POST', { granularity: 'all' });
    expect(response.status).toBe(400);
    expect(await txIds()).toHaveLength(3);
  });

  it('確認のあとで対象が変わっていたら実行しない(409)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };

    // 確認と実行の間に明細が1件増える
    expect(
      (
        await importMf(
          mfCsv(['1,2026/08/01,-500,架空費,架空内訳,0,架空の後から来た行,tx-aug-a,架空口座']),
          'mf-b.csv',
        )
      ).status,
    ).toBe(200);

    const response = await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint));

    expect(response.status).toBe(409);
    expect((await response.json()) as { error: { code: string } }).toMatchObject({
      error: { code: 'deletion_scope_changed' },
    });
    // 1件も消えていない
    expect(await txIds()).toHaveLength(4);
  });

  it('手入力の負債を巻き添えにしない(DR-6)', async () => {
    const assets = ['日付,合計（円）,預金・現金（円）', '2026/06/30,100,100'].join('\n');
    expect((await importMf(assets, '資産推移.csv')).status).toBe(200);
    expect(
      (
        await jsonRequest('/balances/liabilities', 'PUT', {
          month: '2026-06',
          lines: [{ category: 'クレジットカード未払金', status: 'amount', amount: 7000 }],
        })
      ).status,
    ).toBe(200);

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    expect(
      (
        await jsonRequest(
          '/data/deletions',
          'POST',
          confirmedAll(preflight.fingerprint, { from: '2026-06', to: '2026-06' }),
        )
      ).status,
    ).toBe(200);

    const rows = (
      await d1
        .prepare('SELECT source, amount FROM balance_entries WHERE user_id=?')
        .bind('default')
        .all<{ source: string; amount: number }>()
    ).results;
    expect(rows).toEqual([{ source: 'manual', amount: 7000 }]);
  });

  it('手当て(tx_edits)は消さない。参照先が消えるだけ', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    expect((await jsonRequest('/transactions/tx-jun-a/edit', 'PUT', { cls: 'biz' })).status).toBe(200);

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    expect((await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint))).status).toBe(
      200,
    );

    const edits = await d1
      .prepare('SELECT COUNT(*) AS n FROM tx_edits WHERE user_id=?')
      .bind('default')
      .first<number>('n');
    expect(edits).toBe(1);
  });

  it('消す前の行を退避してから消す(DR-2)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint));

    const saved = await d1
      .prepare("SELECT COUNT(*) AS n FROM import_deleted_rows WHERE table_name='mf_transactions'")
      .first<number>('n');
    expect(saved).toBe(3);
    expect(await txIds()).toEqual([]);
  });
});

describe('取込指紋の巻き戻し(DR-4)', () => {
  it('消したあとは同じCSVをもう一度入れられる', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    expect(await activeTargetKeys()).toEqual(expect.arrayContaining(['mf:2026-06', 'mf:2026-07']));

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint));

    // 指紋が残っていると「取込済み」と判定され、入れ直しても何も入らない
    expect(await activeTargetKeys()).not.toContain('mf:2026-06');

    const second = await importMf(JUNE_JULY, 'mf-a-again.csv');
    expect(second.status).toBe(200);
    expect(await txIds()).toEqual(['tx-jul-a', 'tx-jun-a', 'tx-jun-b']);
  });

  it('消した指紋を退避しておく', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint));

    const rows = (
      await d1
        .prepare('SELECT target_key, content_hash, import_id FROM import_deleted_targets')
        .all<{ target_key: string; content_hash: string; import_id: number }>()
    ).results;
    expect(rows.map((row) => row.target_key).sort()).toEqual(['mf:2026-06', 'mf:2026-07']);
    for (const row of rows) expect(row.content_hash.length).toBeGreaterThan(0);
  });
});

describe('取込単位の取り消し', () => {
  it('その取込で入った明細だけを消す', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const first = await latestImportId();
    expect(
      (
        await importMf(
          mfCsv(['1,2026/08/01,-500,架空費,架空内訳,0,架空の別取込,tx-aug-a,架空口座']),
          'mf-b.csv',
        )
      ).status,
    ).toBe(200);

    const preflight = (await (await jsonRequest(`/imports/${first}/undo/preflight`, 'POST')).json()) as {
      counts: { mfTx: number };
      fingerprint: string;
    };
    expect(preflight.counts.mfTx).toBe(3);

    const response = await jsonRequest(`/imports/${first}/undo`, 'POST', {
      fingerprint: preflight.fingerprint,
    });
    expect(response.status).toBe(200);
    expect(await txIds()).toEqual(['tx-aug-a']);
  });

  it('同じ月の別種別 active target とその行は残す', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const mfImportId = await latestImportId();
    const assets = ['日付,合計（円）,預金・現金（円）', '2026/06/30,100,100'].join('\n');
    expect((await importMf(assets, '資産推移.csv')).status).toBe(200);
    const balancesBefore = await balanceRowCount();
    expect(await activeTargetKeys()).toEqual(
      expect.arrayContaining(['mf:2026-06', 'mf:2026-07', 'assets:2026-06']),
    );

    const preflight = (await (await jsonRequest(`/imports/${mfImportId}/undo/preflight`, 'POST')).json()) as {
      fingerprint: string;
    };
    expect(
      (
        await jsonRequest(`/imports/${mfImportId}/undo`, 'POST', {
          fingerprint: preflight.fingerprint,
        })
      ).status,
    ).toBe(200);

    expect(await activeTargetKeys()).toContain('assets:2026-06');
    expect(await balanceRowCount()).toBe(balancesBefore);
  });

  it('資産だけの active 取込を行と指紋のペアで取り消す', async () => {
    const assets = [
      '日付,合計（円）,預金・現金（円）,株式（円）',
      '2026/06/30,300,100,200',
      '2026/07/31,500,200,300',
    ].join('\n');
    expect((await importMf(assets, '資産推移.csv')).status).toBe(200);
    const assetsImportId = await latestImportId();
    const rowsBefore = await balanceRowCount();
    expect(rowsBefore).toBeGreaterThan(0);

    const preflightResponse = await jsonRequest(`/imports/${assetsImportId}/undo/preflight`, 'POST');
    const preflight = (await preflightResponse.json()) as {
      counts: { balanceEntries: number };
      fingerprint: string;
      months: string[];
    };
    expect(preflightResponse.status).toBe(200);
    expect(preflight.counts.balanceEntries).toBe(rowsBefore);
    expect(preflight.months).toEqual(['2026-06', '2026-07']);

    expect(
      (
        await jsonRequest(`/imports/${assetsImportId}/undo`, 'POST', {
          fingerprint: preflight.fingerprint,
        })
      ).status,
    ).toBe(200);
    expect(await balanceRowCount()).toBe(0);
    const targetKeysAfterDelete = await activeTargetKeys();
    expect(targetKeysAfterDelete).not.toContain('assets:2026-06');
    expect(targetKeysAfterDelete).not.toContain('assets:2026-07');
  });
});

describe('削除の取り消し(undo)', () => {
  const deleteAll = async (): Promise<string> => {
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    const response = await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint));
    expect(response.status).toBe(200);
    return ((await response.json()) as { operationId: string }).operationId;
  };

  it('明細と取込指紋を対で戻す', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const operationId = await deleteAll();
    expect(await txIds()).toEqual([]);

    const response = await jsonRequest(`/data/undo/${operationId}`, 'POST');
    expect(response.status).toBe(200);
    expect(await txIds()).toEqual(['tx-jul-a', 'tx-jun-a', 'tx-jun-b']);
    // 指紋も戻る。戻さないと、同じCSVがもう一度入って二重になる
    expect(await activeTargetKeys()).toEqual(expect.arrayContaining(['mf:2026-06', 'mf:2026-07']));
  });

  it('undoのmonthly_agg確定に失敗したら明細も取り消し済み状態も変えない', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const request = { granularity: 'transaction', txIds: ['tx-jun-a'] } as const;
    const preflight = (await (await jsonRequest('/data/deletions/preflight', 'POST', request)).json()) as {
      fingerprint: string;
    };
    const deleted = await jsonRequest('/data/deletions', 'POST', {
      ...request,
      fingerprint: preflight.fingerprint,
    });
    const { operationId } = (await deleted.json()) as { operationId: string };
    expect(await monthlyAmount('2026-06', 'per_exp:架空費')).toBe(2000);
    await d1
      .prepare(
        `INSERT INTO import_deletion_operations
           (id,user_id,kind,granularity,request_json,fingerprint,counts_json,expires_at,created_at)
         VALUES ('forced-existing','default','delete','transaction','{}','x','{}','2099-01-01','2099-01-01')`,
      )
      .run();
    const observed = failCombinedDeletionBatch();

    const response = await app.request(
      `/api/data/undo/${operationId}`,
      { method: 'POST', headers: { cookie } },
      env(observed.database),
    );
    expect(response.status).toBe(500);
    expect(await txIds()).not.toContain('tx-jun-a');
    expect(await monthlyAmount('2026-06', 'per_exp:架空費')).toBe(2000);
    await expect(
      d1
        .prepare('SELECT undone_by FROM import_deletion_operations WHERE id=?')
        .bind(operationId)
        .first<string | null>('undone_by'),
    ).resolves.toBeNull();
    await expect(
      d1.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='undo'").first<number>('n'),
    ).resolves.toBe(0);
    expect(observed.statements().some((sql) => /INSERT INTO mf_transactions/i.test(sql))).toBe(true);
    expect(observed.statements().some((sql) => /DELETE FROM "monthly_agg"/i.test(sql))).toBe(true);
    expect(observed.statements().some((sql) => /INSERT INTO audit_log\s/i.test(sql))).toBe(true);
  });

  it('全件削除は復元baselineと旧手当ても退避し、undoで値をそのまま戻す', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    await d1.batch([
      d1
        .prepare('INSERT INTO restored_monthly_agg (user_id,month,scope,amount) VALUES (?,?,?,?)')
        .bind('default', '2026-06', 'biz_exp:架空確定科目', 4321),
      d1
        .prepare('INSERT INTO overrides (user_id,tx_id,cls,updated_at) VALUES (?,?,?,?)')
        .bind('default', 'legacy-架空', 'biz', '2026-06-30T00:00:00.000Z'),
      d1
        .prepare('INSERT INTO restored_monthly_agg (user_id,month,scope,amount) VALUES (?,?,?,?)')
        .bind('other-user', '2026-06', 'biz_exp:他利用者', 9999),
      d1
        .prepare('INSERT INTO overrides (user_id,tx_id,cls,updated_at) VALUES (?,?,?,?)')
        .bind('other-user', 'legacy-other', 'per', '2026-06-30T00:00:00.000Z'),
    ]);

    const operationId = await deleteAll();
    await expect(
      d1
        .prepare('SELECT COUNT(*) AS n FROM restored_monthly_agg WHERE user_id=?')
        .bind('default')
        .first<number>('n'),
    ).resolves.toBe(0);
    await expect(
      d1.prepare('SELECT COUNT(*) AS n FROM overrides WHERE user_id=?').bind('default').first<number>('n'),
    ).resolves.toBe(0);
    await expect(
      d1
        .prepare(
          "SELECT COUNT(*) AS n FROM import_deleted_rows WHERE operation_id=? AND table_name IN ('restored_monthly_agg','overrides')",
        )
        .bind(operationId)
        .first<number>('n'),
    ).resolves.toBe(2);
    await expect(
      d1
        .prepare('SELECT COUNT(*) AS n FROM restored_monthly_agg WHERE user_id=?')
        .bind('other-user')
        .first<number>('n'),
    ).resolves.toBe(1);

    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);
    await expect(
      d1
        .prepare('SELECT month,scope,amount FROM restored_monthly_agg WHERE user_id=?')
        .bind('default')
        .first(),
    ).resolves.toEqual({ month: '2026-06', scope: 'biz_exp:架空確定科目', amount: 4321 });
    await expect(
      d1.prepare('SELECT tx_id,cls,updated_at FROM overrides WHERE user_id=?').bind('default').first(),
    ).resolves.toEqual({ tx_id: 'legacy-架空', cls: 'biz', updated_at: '2026-06-30T00:00:00.000Z' });
  });

  it('戻した明細は金額も内容もそのまま', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const before = (
      await d1
        .prepare('SELECT tx_id, amount, description FROM mf_transactions WHERE user_id=? ORDER BY tx_id')
        .bind('default')
        .all<{ tx_id: string; amount: number; description: string }>()
    ).results;

    const operationId = await deleteAll();
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);

    const after = (
      await d1
        .prepare('SELECT tx_id, amount, description FROM mf_transactions WHERE user_id=? ORDER BY tx_id')
        .bind('default')
        .all<{ tx_id: string; amount: number; description: string }>()
    ).results;
    expect(after).toEqual(before);
  });

  it('退避行は取り消しのあとも残す(もう一度戻せるように)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const operationId = await deleteAll();
    await jsonRequest(`/data/undo/${operationId}`, 'POST');
    const saved = await d1
      .prepare('SELECT COUNT(*) AS n FROM import_deleted_rows WHERE operation_id=?')
      .bind(operationId)
      .first<number>('n');
    expect(saved).toBe(3);
  });

  it('二度目の取り消しは受け付けない', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const operationId = await deleteAll();
    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);
    const second = await jsonRequest(`/data/undo/${operationId}`, 'POST');
    expect(second.status).toBe(409);
    // 二重INSERTで明細が倍にならない
    expect(await txIds()).toHaveLength(3);
  });

  it('知らない操作は404', async () => {
    expect((await jsonRequest('/data/undo/not-a-real-operation', 'POST')).status).toBe(404);
  });

  it('保持期間を過ぎた取り消しは410(「無い」ではなく「もう戻せない」)', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const operationId = await deleteAll();
    await d1
      .prepare('UPDATE import_deletion_operations SET expires_at=? WHERE id=?')
      .bind('2000-01-01T00:00:00.000Z', operationId)
      .run();

    const response = await jsonRequest(`/data/undo/${operationId}`, 'POST');
    expect(response.status).toBe(410);
    expect((await response.json()) as { error: { code: string } }).toMatchObject({
      error: { code: 'undo_expired' },
    });
    expect(await txIds()).toEqual([]);
  });
});

describe('操作の履歴(DR-9)', () => {
  it('件数と粒度だけを返し、明細の内容・金額・IDを返さない', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', {
        granularity: 'transaction',
        txIds: ['tx-jun-a'],
      })
    ).json()) as { fingerprint: string };
    await jsonRequest('/data/deletions', 'POST', {
      granularity: 'transaction',
      txIds: ['tx-jun-a'],
      fingerprint: preflight.fingerprint,
    });

    const response = await jsonRequest('/data/operations');
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(text) as { operations: unknown[] }).toMatchObject({
      operations: [{ kind: 'delete', granularity: 'transaction', counts: { mfTx: 1 }, undone: false }],
    });
    // 範囲の指定には明細IDが入りうるので、履歴には出さない
    expect(text).not.toContain('tx-jun-a');
    expect(text).not.toMatch(/架空の支払い|1000/);
  });

  it('取り消した削除は履歴でそう分かる', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    const { operationId } = (await (
      await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint))
    ).json()) as { operationId: string };
    await jsonRequest(`/data/undo/${operationId}`, 'POST');

    const { operations } = (await (await jsonRequest('/data/operations')).json()) as {
      operations: { kind: string; undone: boolean }[];
    };
    expect(operations.find((op) => op.kind === 'delete')?.undone).toBe(true);
    expect(operations.some((op) => op.kind === 'undo')).toBe(true);
  });
});

describe('CSVの不可逆削除', () => {
  it('取込履歴から削除すると原本・複数月の明細・補正・集計・指紋も消え、再取込できる', async () => {
    expect((await importMf(JUNE_JULY, 'synthetic-delete.csv')).status).toBe(200);
    await jsonRequest('/transactions/tx-jun-a/edit', 'PUT', { cls: 'biz' });
    const runs = (await (await jsonRequest('/imports/runs')).json()) as { runs: Array<{ id: string }> };
    const ids = [runs.runs[0].id];
    const originals = (
      await d1
        .prepare('SELECT DISTINCT r2_key FROM imports WHERE r2_key IS NOT NULL')
        .all<{ r2_key: string }>()
    ).results;
    const pre = await jsonRequest('/imports/runs/delete/preflight', 'POST', { ids });
    expect(pre.status).toBe(200);
    const plan = (await pre.json()) as { fingerprint: string; counts: { mfTx: number } };
    expect(plan.counts.mfTx).toBe(3);
    const response = await jsonRequest('/imports/runs/delete', 'POST', {
      ids,
      fingerprint: plan.fingerprint,
    });
    expect(response.status).toBe(200);
    expect(await txIds()).toEqual([]);
    for (const table of [
      'imports',
      'import_active_targets',
      'tx_edits',
      'import_deleted_rows',
      'import_deletion_operations',
    ])
      expect((await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n, table).toBe(
        0,
      );
    for (const row of originals) expect(await files.head(row.r2_key)).toBeNull();
    expect((await importMf(JUNE_JULY, 'synthetic-delete.csv')).status).toBe(200);
    expect(await txIds()).toHaveLength(3);
  });
});

async function sourcePlan(ids: string[]) {
  const response = await jsonRequest('/imports/runs/delete/preflight', 'POST', { ids });
  expect(response.status).toBe(200);
  return (await response.json()) as { fingerprint: string };
}
async function sourceDelete(ids: string[]) {
  const plan = await sourcePlan(ids);
  return jsonRequest('/imports/runs/delete', 'POST', { ids, fingerprint: plan.fingerprint });
}
async function sourceRun(filename: string) {
  return (await d1
    .prepare('SELECT run_id FROM imports WHERE filename=? ORDER BY id DESC LIMIT 1')
    .bind(filename)
    .first<{ run_id: string }>())!.run_id;
}

describe('CSV削除の所有境界と原子性', () => {
  it('置換済みCSVを削除しても新しいCSVの同一tx_idと補正を残す', async () => {
    await importMf(JUNE_JULY, 'older.csv');
    const old = await sourceRun('older.csv');
    await importMf(JUNE_JULY.replace('-1000', '-1400'), 'newer.csv');
    await jsonRequest('/transactions/tx-jun-a/edit', 'PUT', { cls: 'biz' });
    expect((await sourceDelete([old])).status).toBe(200);
    expect(await txIds()).toHaveLength(3);
    expect((await d1.prepare('SELECT count(*) AS n FROM tx_edits').first<{ n: number }>())?.n).toBe(1);
  });
  it('混在した過去undoの対象CSVだけを除き、残る件数と復元を一致させる', async () => {
    await importMf(mfCsv(['1,2026/06/10,-1100,架空費,架空内訳,0,架空A,keep-a,架空口座']), 'a.csv');
    const runA = await sourceRun('a.csv');
    await importMf(mfCsv(['1,2026/07/10,-2200,架空費,架空内訳,0,架空B,keep-b,架空口座']), 'b.csv');
    const request = { granularity: 'period', period: { from: '2026-06', to: '2026-07' } };
    const pre = (await (await jsonRequest('/data/deletions/preflight', 'POST', request)).json()) as {
      fingerprint: string;
    };
    const deletion = (await (
      await jsonRequest('/data/deletions', 'POST', { ...request, fingerprint: pre.fingerprint })
    ).json()) as { operationId: string };
    expect((await sourceDelete([runA])).status).toBe(200);
    const ops = (await (await jsonRequest('/data/operations')).json()) as {
      operations: Array<{ id: string; counts: { mfTx: number }; undoable: boolean }>;
    };
    expect(ops.operations.find((r) => r.id === deletion.operationId)).toMatchObject({
      counts: { mfTx: 1, months: 1 },
      undoable: true,
    });
    expect((await jsonRequest(`/data/undo/${deletion.operationId}`, 'POST')).status).toBe(200);
    expect(await txIds()).toEqual(['keep-b']);
  });
  it('処理中または帰属不明のCSVを含む一括削除は全件を保持', async () => {
    await importMf(JUNE_JULY, 'normal.csv');
    const id = await sourceRun('normal.csv');
    const user = (await d1.prepare('SELECT user_id FROM imports LIMIT 1').first<{ user_id: string }>())!
      .user_id;
    await d1
      .prepare(
        "INSERT INTO import_runs(id,user_id,status,created_at,updated_at) VALUES ('busy',?,'processing',datetime('now'),datetime('now'))",
      )
      .bind(user)
      .run();
    expect((await jsonRequest('/imports/runs/delete/preflight', 'POST', { ids: [id, 'busy'] })).status).toBe(
      409,
    );
    expect(await txIds()).toHaveLength(3);
    await d1.prepare("UPDATE import_runs SET status='failed' WHERE id='busy'").run();
    await d1.prepare("UPDATE imports SET status='ok' WHERE run_id=?").bind(id).run();
    expect((await jsonRequest('/imports/runs/delete/preflight', 'POST', { ids: [id, 'busy'] })).status).toBe(
      409,
    );
    expect(await txIds()).toHaveLength(3);
  });
  it('共有R2原本を持つ存続CSVがあれば原本を保持し理由を返す', async () => {
    await importMf(JUNE_JULY, 'shared-a.csv');
    const a = await sourceRun('shared-a.csv');
    const original = (await d1
      .prepare('SELECT r2_key,user_id FROM imports LIMIT 1')
      .first<{ r2_key: string; user_id: string }>())!;
    await d1
      .prepare(
        "INSERT INTO import_runs(id,user_id,status,created_at,updated_at) VALUES ('shared-b',?,'committed',datetime('now'),datetime('now'))",
      )
      .bind(original.user_id)
      .run();
    await d1
      .prepare(
        "INSERT INTO imports(user_id,filename,kind,months,row_count,status,r2_key,run_id) VALUES (?,'shared-b.csv','mf','[]',0,'duplicate',?,'shared-b')",
      )
      .bind(original.user_id, original.r2_key)
      .run();
    const response = await sourceDelete([a]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      originals: { shared: 1, pending: 0, deleted: 0 },
      sharedReason: expect.any(String),
    });
    expect(await files.head(original.r2_key)).not.toBeNull();
  });
  it('D1 batch失敗は明細・履歴・原本削除intentをまとめてロールバックする', async () => {
    await importMf(JUNE_JULY, 'rollback.csv');
    const ids = [await sourceRun('rollback.csv')];
    const plan = await sourcePlan(ids);
    await d1
      .prepare(
        "CREATE TRIGGER fail_csv_delete BEFORE DELETE ON imports BEGIN SELECT RAISE(ABORT,'synthetic rollback'); END",
      )
      .run();
    try {
      expect(
        (await jsonRequest('/imports/runs/delete', 'POST', { ids, fingerprint: plan.fingerprint })).status,
      ).toBe(500);
      expect(await txIds()).toHaveLength(3);
      expect((await d1.prepare('SELECT count(*) AS n FROM r2_cleanup_jobs').first<{ n: number }>())?.n).toBe(
        0,
      );
    } finally {
      await d1.prepare('DROP TRIGGER fail_csv_delete').run();
    }
  });
  it('R2失敗でも正本削除は確定し耐久outboxを残してwriterを解放する', async () => {
    await importMf(JUNE_JULY, 'retry.csv');
    const ids = [await sourceRun('retry.csv')];
    const plan = await sourcePlan(ids);
    const broken = new Proxy(files, {
      get(target, key) {
        if (key === 'delete')
          return async () => {
            throw new Error('synthetic R2 failure');
          };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const response = await app.request(
      '/api/imports/runs/delete',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ids, fingerprint: plan.fingerprint }),
      },
      { ...env(), FILES: broken },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ originals: { pending: 1 } });
    expect(await txIds()).toHaveLength(0);
    expect((await d1.prepare('SELECT count(*) AS n FROM r2_cleanup_jobs').first<{ n: number }>())?.n).toBe(1);
    await runR2Cleanup(env(), new Date(Date.now() + 3 * 60_000));
    expect((await d1.prepare('SELECT count(*) AS n FROM r2_cleanup_jobs').first<{ n: number }>())?.n).toBe(0);
    // 解放されているため、直後に同CSVの再取込が成功する。
    expect((await importMf(JUNE_JULY, 'retry.csv')).status).toBe(200);
  });
});

describe('CSV削除の追加退行', () => {
  it('同一内容freeeの存続旧#1の除外・名指し・過去undoを新#0へ引き継ぐ', async () => {
    const csv = [
      FREEE_HEADER,
      '支出,2026/06/03,通信費,4400,架空共同支払,2026/06/30,2026/06/28,架空口座,4400',
    ].join('\n');
    await importMf(csv, 'freee-old.csv');
    const run = await sourceRun('freee-old.csv');
    await d1
      .prepare(
        "INSERT INTO import_runs(id,user_id,status,created_at,updated_at) VALUES ('freee-keep','default','committed',datetime('now'),datetime('now'))",
      )
      .run();
    const second = await d1
      .prepare(
        "INSERT INTO imports(user_id,filename,kind,months,row_count,status,run_id) VALUES ('default','keep.csv','freee','[\"2026-06\"]',1,'committed','freee-keep') RETURNING id",
      )
      .first<{ id: number }>();
    await d1
      .prepare(
        'INSERT INTO freee_deals(user_id,month,date,io,partner,account_raw,account_norm,amount,import_id,settle_account,settlement_known) SELECT user_id,month,date,io,partner,account_raw,account_norm,amount,?,settle_account,settlement_known FROM freee_deals LIMIT 1',
      )
      .bind(second!.id)
      .run();
    const [key0, key1] = freeeDealKeys(
      [0, 1].map(() => ({
        month: '2026-06',
        date: '2026-06-03',
        io: 'expense' as const,
        partner: '架空共同支払',
        accountRaw: '通信費',
        accountNorm: '通信費',
        amount: 4400,
        settleAccount: '架空口座',
      })),
    );
    await d1
      .prepare(
        "INSERT INTO freee_deal_exclusions(user_id,freee_key,reason,reason_code) VALUES ('default',?,'架空の維持判断','duplicate')",
      )
      .bind(key1)
      .run();
    await d1
      .prepare(
        "INSERT INTO duplicate_verdicts(user_id,tx_id,verdict,freee_key) VALUES ('default','other-tx','same',?)",
      )
      .bind(key1)
      .run();
    await d1
      .prepare(
        "INSERT INTO total_cashflow_operations(id,user_id,kind,items_json,item_count,created_at) VALUES ('mixed-op','default','exclude',?,2,datetime('now'))",
      )
      .bind(
        JSON.stringify([
          { freeeKey: key0, before: null },
          { freeeKey: key1, before: { freeeKey: key1, reason: 'keep' } },
        ]),
      )
      .run();
    await d1
      .prepare(
        "INSERT INTO reconciliation_actions(id,user_id,action,target_count,before_json,after_json,created_at) VALUES ('mixed-action','default','same',2,?,?,datetime('now'))",
      )
      .bind(
        JSON.stringify({
          verdicts: [
            { txId: 'gone-link', row: { freeeKey: key0 } },
            { txId: 'other-tx', row: { freeeKey: key1 } },
          ],
          mfExclusions: [],
          freeeExclusions: [],
        }),
        JSON.stringify({
          verdicts: [
            { txId: 'gone-link', freeeKey: key0, verdict: 'same' },
            { txId: 'other-tx', freeeKey: key1, verdict: 'same' },
          ],
          mfExclusions: [],
          mfExclusionDeletes: [],
          freeeExclusions: [],
        }),
      )
      .run();
    await d1
      .prepare(
        "INSERT INTO reconciliation_actions(id,user_id,action,target_count,before_json,after_json,created_at) VALUES ('paired-action','default','same',2,?,?,datetime('now'))",
      )
      .bind(
        JSON.stringify({
          verdicts: [
            { txId: 'paired-target', row: { freeeKey: key0 } },
            { txId: 'unrelated-target', row: null },
          ],
          mfExclusions: [],
          freeeExclusions: [],
        }),
        JSON.stringify({
          verdicts: [
            { txId: 'paired-target', freeeKey: key1, verdict: 'same' },
            { txId: 'unrelated-target', freeeKey: null, verdict: 'different' },
          ],
          mfExclusions: [],
          mfExclusionDeletes: [],
          freeeExclusions: [],
        }),
      )
      .run();
    expect((await sourceDelete([run])).status).toBe(200);
    expect(
      (await d1.prepare('SELECT freee_key FROM freee_deal_exclusions').first<{ freee_key: string }>())
        ?.freee_key,
    ).toBe(key0);
    expect(
      (await d1.prepare('SELECT freee_key FROM duplicate_verdicts').first<{ freee_key: string }>())
        ?.freee_key,
    ).toBe(key0);
    const op = await d1
      .prepare("SELECT items_json,item_count FROM total_cashflow_operations WHERE id='mixed-op'")
      .first<{ items_json: string; item_count: number }>();
    expect(op?.item_count).toBe(1);
    expect(JSON.parse(op!.items_json)).toEqual([
      { freeeKey: key0, before: { freeeKey: key0, reason: 'keep' } },
    ]);
    const action = await d1
      .prepare(
        "SELECT before_json,after_json,target_count FROM reconciliation_actions WHERE id='mixed-action'",
      )
      .first<{ before_json: string; after_json: string; target_count: number }>();
    const paired = await d1
      .prepare(
        "SELECT before_json,after_json,target_count FROM reconciliation_actions WHERE id='paired-action'",
      )
      .first<{ before_json: string; after_json: string; target_count: number }>();
    expect(paired?.target_count).toBe(1);
    expect(JSON.parse(paired!.before_json).verdicts).toEqual([{ txId: 'unrelated-target', row: null }]);
    expect(JSON.parse(paired!.after_json).verdicts).toEqual([
      { txId: 'unrelated-target', freeeKey: null, verdict: 'different' },
    ]);
    expect(action?.target_count).toBe(1);
    expect(JSON.parse(action!.before_json).verdicts).toEqual([{ txId: 'other-tx', row: { freeeKey: key0 } }]);
  });
  it('計画後のwriter差し替えで全batchをロールバックし別CSVに触らない', async () => {
    await importMf(JUNE_JULY, 'lease.csv');
    const ids = [await sourceRun('lease.csv')];
    const plan = await sourcePlan(ids);
    const wrapped = failCombinedDeletionBatch(async () => {
      await d1
        .prepare("UPDATE import_writer_claims SET run_id='another-writer' WHERE user_id='default'")
        .run();
    });
    const response = await app.request(
      '/api/imports/runs/delete',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ids, fingerprint: plan.fingerprint }),
      },
      env(wrapped.database),
    );
    expect(response.status).toBe(409);
    expect(await txIds()).toHaveLength(3);
  });
  it('書込み予算超過は原本削除intentも正本も変更しない', async () => {
    await importMf(JUNE_JULY, 'budget.csv');
    const ids = [await sourceRun('budget.csv')];
    const plan = await sourcePlan(ids);
    const original = store.recomputePlanStatements;
    const spy = vi
      .spyOn(store, 'recomputePlanStatements')
      .mockImplementation((...args) => [
        ...original(...args),
        ...Array.from({ length: 30 }, () => d1.prepare('SELECT 1')),
      ]);
    try {
      expect(
        (await jsonRequest('/imports/runs/delete', 'POST', { ids, fingerprint: plan.fingerprint })).status,
      ).toBe(413);
      expect(await txIds()).toHaveLength(3);
      expect((await d1.prepare('SELECT count(*) AS n FROM r2_cleanup_jobs').first<{ n: number }>())?.n).toBe(
        0,
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe('CSV削除の資産控え', () => {
  it('資産CSVの旧undoから残高が復活せず、別月と手入力負債を保持する', async () => {
    await importMf(['日付,合計（円）,預金・現金（円）', '2026/06/30,100,100'].join('\n'), 'asset-delete.csv');
    const id = await latestImportId();
    const run = await sourceRun('asset-delete.csv');
    const pre = (await (await jsonRequest(`/imports/${id}/undo/preflight`, 'POST')).json()) as {
      fingerprint: string;
    };
    const removed = (await (
      await jsonRequest(`/imports/${id}/undo`, 'POST', { fingerprint: pre.fingerprint })
    ).json()) as { operationId: string };
    await importMf(['日付,合計（円）,預金・現金（円）', '2026/07/31,200,200'].join('\n'), 'asset-keep.csv');
    await d1
      .prepare(
        "INSERT INTO balance_entries(user_id,month,date,side,category,amount,source) VALUES ('default','2026-06','2026-06-30','liability','架空手入力負債',900,'manual')",
      )
      .run();
    const before = await balanceRowCount();
    expect((await sourceDelete([run])).status).toBe(200);
    expect(
      (
        await d1
          .prepare('SELECT count(*) AS n FROM import_deleted_rows WHERE operation_id=?')
          .bind(removed.operationId)
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    // 空になった控えのundoを実行しても対象CSVは復活しない。
    const undone = await jsonRequest(`/data/undo/${removed.operationId}`, 'POST');
    expect([200, 409, 410]).toContain(undone.status);
    expect(await balanceRowCount()).toBe(before);
  });
});

describe('CSV削除の複数原本', () => {
  it('複数CSVと子runを一括削除し、正常時は全原本を一括削除する', async () => {
    await importMf(mfCsv(['1,2026/06/10,-1100,架空費,架空内訳,0,架空A,child-a,架空口座']), 'child-a.csv');
    const parent = await sourceRun('child-a.csv');
    await importMf(mfCsv(['1,2026/07/10,-2200,架空費,架空内訳,0,架空B,child-b,架空口座']), 'child-b.csv');
    const child = await sourceRun('child-b.csv');
    await d1.prepare('UPDATE import_runs SET parent_run_id=? WHERE id=?').bind(parent, child).run();
    const originalKeys = (
      await d1
        .prepare('SELECT DISTINCT r2_key FROM imports WHERE r2_key IS NOT NULL')
        .all<{ r2_key: string }>()
    ).results;
    const response = await sourceDelete([parent]);
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      originals: { deleted: number; pending: number; shared: number };
      fileCount: number;
    };
    expect(result.fileCount).toBe(2);
    for (const row of originalKeys) expect(await files.head(row.r2_key)).toBeNull();
    expect(result.originals.deleted).toBe(2);
    expect(result.originals.pending).toBe(0);
    expect(await txIds()).toEqual([]);
    expect((await d1.prepare('SELECT count(*) AS n FROM import_runs').first<{ n: number }>())?.n).toBe(0);
    await runR2Cleanup(env());
    expect((await d1.prepare('SELECT count(*) AS n FROM r2_cleanup_jobs').first<{ n: number }>())?.n).toBe(0);
    expect((await jsonRequest('/auth/me')).status).toBe(200);
  });
});

describe('CSV削除のD1サイズ境界', () => {
  it('合計2MBを超える明細も1つのJSONセルへ集約せず確認・削除できる', async () => {
    await importMf(JUNE_JULY, 'large-synthetic.csv');
    const id = await latestImportId();
    const run = await sourceRun('large-synthetic.csv');
    await d1
      .prepare(`WITH RECURSIVE sequence(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM sequence WHERE n<2100)
    INSERT INTO mf_transactions(user_id,tx_id,month,date,description,amount,import_id,is_target,is_transfer,identity_stable)
    SELECT 'default','large-synthetic-'||n,'2026-06','2026-06-10',printf('%01000d',n),-1,?,1,0,1 FROM sequence`)
      .bind(id)
      .run();
    expect(
      (await d1
        .prepare('SELECT sum(length(description)) AS bytes FROM mf_transactions')
        .first<{ bytes: number }>())!.bytes,
    ).toBeGreaterThan(2_000_000);
    const response = await sourceDelete([run]);
    expect(response.status).toBe(200);
    expect(await txIds()).toEqual([]);
  });
});
