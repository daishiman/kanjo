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
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { planDeletionQueries, planUndoQueries } from './deletion-lifecycle.js';
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

const env = (database: D1Database = d1) => ({ ...auth, DB: database, FILES: files });

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
const mfCsv = (rows: string[]) => [MF_HEADER, ...rows].join('\n');

/** 6月2件・7月1件。すべて架空。 */
const JUNE_JULY = mfCsv([
  '1,2026/06/10,-1000,架空費,架空内訳,0,架空の支払い6a,tx-jun-a,架空口座',
  '1,2026/06/20,-2000,架空費,架空内訳,0,架空の支払い6b,tx-jun-b,架空口座',
  '1,2026/07/05,-3000,架空費,架空内訳,0,架空の支払い7a,tx-jul-a,架空口座',
]);

async function importMf(body: string, name: string): Promise<Response> {
  const form = new FormData();
  form.append('file', new File([body], name, { type: 'text/csv' }));
  return app.request('/api/imports', { method: 'POST', headers: { cookie }, body: form }, env());
}

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
const CONFIRMED_ALL_MONTHS = { from: '2026-06', to: '2026-08' } as const;
const confirmedAll = (fingerprint: string) => ({
  granularity: 'all' as const,
  confirmedPeriod: CONFIRMED_ALL_MONTHS,
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
      derivedConvergenceStatements: 1,
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
const failCombinedDeletionBatch = (): { database: D1Database; statements: () => string[] } => {
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
   * 内訳と添付も巻き添えとして数える(DR-6)。
   *
   * 数え方そのものは core に試験がある。ここで見たいのは D1 側の読み出しで、
   * 表や列の名前がずれていても「0件」に見えてしまい、消える前の警告が
   * 静かに消える。0 でない値を1度は通しておかないと、その取り違えは出ない。
   */
  it('内訳と添付のある明細は巻き添え件数に出る', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO tx_splits (user_id, tx_id, line_id, seq, parent_amount, amount, cls, category_major, created_at, updated_at)
         VALUES ('default','tx-jun-a','line-架空-1',1,1000,600,'biz','架空費','2026-06-01T00:00:00.000Z','2026-06-01T00:00:00.000Z')`,
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO attachments (user_id, target_kind, target_key, r2_key, filename, content_type, size, content_hash, created_at)
         VALUES ('default','mf','tx-jun-a','架空/key-1','架空.pdf','application/pdf',1,'架空ハッシュ','2026-06-01T00:00:00.000Z')`,
      )
      .run();

    const response = await jsonRequest('/data/deletions/preflight', 'POST', {
      granularity: 'period',
      period: { from: '2026-06', to: '2026-06' },
    });
    const body = (await response.json()) as { collateral: { txSplits: number; attachments: number } };
    expect(response.status).toBe(200);
    expect(body.collateral.txSplits).toBe(1);
    expect(body.collateral.attachments).toBe(1);
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
    await expect(d1.prepare('SELECT COUNT(*) AS n FROM audit_log').first<number>('n')).resolves.toBe(0);
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
          lines: [{ category: 'クレジットカード未払金', amount: 7000 }],
        })
      ).status,
    ).toBe(200);

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', { granularity: 'all' })
    ).json()) as { fingerprint: string };
    expect((await jsonRequest('/data/deletions', 'POST', confirmedAll(preflight.fingerprint))).status).toBe(
      200,
    );

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

describe('削除後の派生状態の収束', () => {
  it('MF明細の添付は削除で孤立し、undoで親へ戻る', async () => {
    expect((await importMf(JUNE_JULY, 'mf-a.csv')).status).toBe(200);
    await d1
      .prepare(
        `INSERT INTO attachments
           (user_id,target_kind,target_key,r2_key,filename,content_type,size,content_hash,created_at)
         VALUES ('default','mf','tx-jun-a','架空/key-parent','架空.pdf','application/pdf',1,'架空-hash','2026-06-01T00:00:00.000Z')`,
      )
      .run();

    const preflight = (await (
      await jsonRequest('/data/deletions/preflight', 'POST', {
        granularity: 'transaction',
        txIds: ['tx-jun-a'],
      })
    ).json()) as { fingerprint: string };
    const deleted = await jsonRequest('/data/deletions', 'POST', {
      granularity: 'transaction',
      txIds: ['tx-jun-a'],
      fingerprint: preflight.fingerprint,
    });
    expect(deleted.status).toBe(200);
    const { operationId } = (await deleted.json()) as { operationId: string };
    await expect(
      d1
        .prepare("SELECT parent_missing_at FROM attachments WHERE target_key='tx-jun-a'")
        .first<string>('parent_missing_at'),
    ).resolves.toBeTruthy();

    expect((await jsonRequest(`/data/undo/${operationId}`, 'POST')).status).toBe(200);
    await expect(
      d1
        .prepare("SELECT parent_missing_at FROM attachments WHERE target_key='tx-jun-a'")
        .first<string | null>('parent_missing_at'),
    ).resolves.toBeNull();
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
