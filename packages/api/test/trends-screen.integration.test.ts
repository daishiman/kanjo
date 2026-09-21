/**
 * 推移画面 API (GET /api/trends) の結合テスト (SYS-TRENDS-P04)。
 *
 * 実装より先に書く赤いテストである。実装は SYS-TRENDS-P05 (analytics.ts の /trends)。
 * 契約の正本は `specs/spec-trends-screen.md` の「Contract tests」。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の /trends は MF の Dataset から trendsReport だけを返し、metric・compare・month を読まない。
 * selection / comparePeriod / kpis / detail / review / judgementBasis が無く、未登録の metric も 200 になる。
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trendsReport } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { splitMigrationStatements } from '../src/migration-test-support.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';
import { getDb, loadDataset } from '../src/store.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;

async function applyMigrations(db: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const request = (path: string) =>
  app.request(`/api${path}`, { headers: { cookie } }, { ...auth, DB: database });

// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
const getJson = async (path: string): Promise<any> => {
  const res = await request(path);
  expect(res.status).toBe(200);
  return res.json();
};

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'trends-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database });

  const mf = [
    ['2025-08_1', '2025-08', '2025-08-03', '架空スーパー', -10_000, '食費', '食料品'],
    ['2026-07_1', '2026-07', '2026-07-03', '架空スーパー', -12_000, '食費', '食料品'],
    ['2026-07_2', '2026-07', '2026-07-04', '架空スーパーマーケット', -3_000, '食費', '食料品'],
    ['2026-08_1', '2026-08', '2026-08-03', '架空スーパー', -20_000, '食費', '食料品'],
    ['2026-08_2', '2026-08', '2026-08-25', '架空給与', 250_000, '収入', '給与'],
    // freee の 08-05 と 2 日ずれた同額。要確認になり、推移の数値には入らない
    ['2026-08_3', '2026-08', '2026-08-07', '架空クラウド', -3_300, '事業経費', '通信費'],
  ] as const;
  for (const [txId, month, date, description, amount, major, mid] of mf) {
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default',?1,?2,?3,?4,?5,?6,?7,1,0,0)`,
      )
      .bind(txId, month, date, description, amount, major, mid)
      .run();
  }
  await database
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount,settle_account,settlement_known) VALUES
        -- settlement_known=1 の行だけが決済口座を持つ (0 は決済列の無い取込)
        ('default','2025-08','2025-08-15','expense','架空広告社','広告宣伝費','広告宣伝費',5000,'架空銀行',1),
        ('default','2026-07','2026-07-15','expense','架空広告社','広告宣伝費','広告宣伝費',5000,'架空銀行',1),
        ('default','2026-08','2026-08-15','expense','架空広告社','広告宣伝費','広告宣伝費',30000,'架空銀行',1),
        ('default','2026-08','2026-08-20','income','架空商事','売上高','売上高',100000,'架空銀行',1),
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','通信費',3300,'',1),
        ('other-user','2026-08','2026-08-05','expense','別ユーザー','通信費','通信費',999999,'',1)`,
    )
    .run();
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('GET /api/trends の拡張', () => {
  it('scope の旧名は新名と同じ値を返し、既存の scope フィールドは旧名のまま', async () => {
    for (const [legacy, next] of [
      ['all', 'total'],
      ['biz', 'business'],
      ['personal', 'household'],
    ] as const) {
      const a = await getJson(`/trends?from=2026-07&to=2026-08&scope=${legacy}`);
      const b = await getJson(`/trends?from=2026-07&to=2026-08&scope=${next}`);
      expect(a.selection.scope).toBe(next);
      expect(b.selection.scope).toBe(next);
      expect(a.series).toEqual(b.series);
      expect(a.kpis).toEqual(b.kpis);
      expect(a.scope).toBe(legacy);
      expect(b.scope).toBe(legacy);
    }
  });

  it('未登録の metric は 400 invalid_metric、壊れた month・未知の scope/compare は既定値で 200', async () => {
    const bad = await request('/trends?metric=constructor');
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('invalid_metric');

    const body = await getJson('/trends?from=2026-07&to=2026-08&month=2026-13&scope=x&compare=x');
    expect(body.selection).toMatchObject({ scope: 'total', metric: 'expense', compare: 'previous' });
    expect(body.selection.month).toBe(body.kpis.peakMonth.month);
  });

  it('全期間では comparePeriod が null、増減は最も変化が大きい月の前月差', async () => {
    const body = await getJson('/trends?compare=yoy');
    expect(body.comparePeriod).toBeNull();
    expect(body.compareUnavailable).toBe('all_period');
    expect(body.kpis.change.basis).toBe('peak_month_mom');
  });

  it('compare=previous と yoy で比較期間の月範囲が決まる', async () => {
    const prev = await getJson('/trends?from=2026-08&to=2026-08');
    expect(prev.comparePeriod).toEqual({ from: '2026-07', to: '2026-07', label: '前1か月' });
    const yoy = await getJson('/trends?from=2026-07&to=2026-08&compare=yoy');
    expect(yoy.comparePeriod).toEqual({ from: '2025-07', to: '2025-08', label: '前年同期' });
  });

  it('総合・事業・家計の期間合計と要確認が GET /api/total-cashflow と一致する', async () => {
    const q = 'from=2026-07&to=2026-08';
    const cash = await getJson(`/total-cashflow?${q}`);
    const months = cash.months as Array<Record<string, number>>;
    const pick = (key: string) => sum(months.map((m) => m[key]));

    const total = await getJson(`/trends?${q}&scope=total`);
    expect(total.kpis.current).toBe(pick('totalExpense'));
    expect((await getJson(`/trends?${q}&scope=business`)).kpis.current).toBe(pick('bizExpense'));
    expect((await getJson(`/trends?${q}&scope=household`)).kpis.current).toBe(pick('householdExpense'));
    expect((await getJson(`/trends?${q}&metric=income`)).kpis.current).toBe(pick('totalIncome'));
    expect((await getJson(`/trends?${q}&metric=net`)).kpis.current).toBe(pick('totalBalance'));

    // 要確認は 1 件。件数と金額は総収支と同じで、推移の数値には入らない
    expect(total.review).toMatchObject({ count: pick('reviewCount'), amount: pick('reviewAmount') });
    expect(total.review.count).toBe(1);
    expect(total.review.amount).toBe(3_300);
    // 別の利用者の freee は読まない
    expect(total.kpis.current).toBeLessThan(999_999);
  });

  it('要確認が 0 件の期間では review.count が 0', async () => {
    const body = await getJson('/trends?from=2025-08&to=2025-08');
    expect(body.review).toEqual({ count: 0, amount: 0, monthCount: 0, monthAmount: 0 });
  });

  it('payee は完全一致だけを選ぶ', async () => {
    const hit = await getJson('/trends?from=2026-07&to=2026-08&category=食費&payee=架空スーパー');
    expect(hit.selection).toMatchObject({ category: '食費', payee: '架空スーパー' });
    expect(hit.focus.href).toContain('/classify?');
    const partial = await getJson(
      `/trends?from=2026-07&to=2026-08&category=食費&payee=${encodeURIComponent('架空')}`,
    );
    expect(partial.selection).toMatchObject({ category: '食費', payee: null });
  });

  it('category の side を core へ渡し、同名カテゴリを取り違えない', async () => {
    const hit = await getJson(
      `/trends?from=2026-07&to=2026-08&category=${encodeURIComponent('広告宣伝費')}&side=business`,
    );
    expect(hit.selection).toMatchObject({ category: '広告宣伝費', side: 'business' });

    const miss = await getJson(
      `/trends?from=2026-07&to=2026-08&category=${encodeURIComponent('広告宣伝費')}&side=household`,
    );
    expect(miss.selection).toMatchObject({ category: null, side: null, payee: null });
  });

  it('口座が空の freee 行は detail.sources で account null になる', async () => {
    const body = await getJson('/trends?from=2026-08&to=2026-08&month=2026-08');
    const sources = body.detail.sources as Array<{ origin: string; account: string | null; count: number }>;
    // MF 側は口座列を入れていないので null になる。ここでは freee の空口座だけを見る
    expect(sources.filter((r) => r.origin === 'freee' && r.account === null)).toEqual([
      { origin: 'freee', account: null, count: 1 },
    ]);
    expect(sources.at(-1)?.account).toBeNull();
    expect(sources.find((r) => r.origin === 'freee' && r.account === '架空銀行')?.count).toBe(2);
  });

  it('傾向の判定 (rows/pareto/breakdown) は拡張前と同じ MF だけの値で、基準を mf_only と明示する', async () => {
    const body = await getJson('/trends');
    const before = trendsReport(await loadDataset(getDb(database), 'default'), 'all');
    expect(body.rows).toEqual(JSON.parse(JSON.stringify(before.rows)));
    expect(body.pareto).toEqual(JSON.parse(JSON.stringify(before.pareto)));
    expect(body.breakdown).toEqual(JSON.parse(JSON.stringify(before.breakdown)));
    expect(body.judgementBasis).toBe('mf_only');
    expect(body.metrics.map((m: { id: string }) => m.id)).toEqual(['income', 'expense', 'net']);
  });

  it('/trends の読み取りは loadScoped と共有 cashflow source loader を 1 回ずつ', () => {
    const src = readFileSync(resolve(here, '../src/routes/analytics.ts'), 'utf8');
    const start = src.indexOf("analyticsRoute.get('/trends'");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('analyticsRoute.get(', start + 1);
    const body = src.slice(start, end);
    expect(body.match(/loadScoped\(/g)).toHaveLength(1);
    expect(body.match(/loadCashflowSources\(/g)).toHaveLength(1);
    expect(src).toContain("from '../cashflow-sources.js'");

    const helper = readFileSync(resolve(here, '../src/cashflow-sources.ts'), 'utf8');
    for (const table of ['freeeDeals', 'duplicateVerdicts', 'freeeDealExclusions', 'mfTxExclusions']) {
      expect(helper.match(new RegExp(`from\\(s\\.${table}\\)`, 'g'))).toHaveLength(1);
      expect(helper).toMatch(
        new RegExp(`from\\(s\\.${table}\\)\\.where\\(eq\\(s\\.${table}\\.userId, userId\\)\\)`),
      );
    }
    expect(helper).toContain('dealRows.map(dealFromRow)');
    expect(helper).toContain('bindDuplicateVerdicts(verdictRows, mfTx)');
    expect(helper).toContain('bindMfExclusions(mfExclusionRows, mfTx)');
  });
});
