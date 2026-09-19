/**
 * 家計収支画面 API (GET /api/household・GET /api/household/category) の結合テスト (SYS-HOUSEHOLD-P04)。
 *
 * 契約の正本は `specs/spec-household-cashflow-screen.md` §11。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前の /household は core の旧 household 集計をそのまま返し、month を読まない。
 * 壊れた month も期間外の month も 200 になり、selectedMonth / summary / categories が無い。
 * /household/category は存在しない (404)。
 *
 * 実データを使わず、専用のインメモリ D1 と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

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
    const statements = readFileSync(resolve(migrationsDir, filename), 'utf8')
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((sql) => sql.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  await recordTestMigrationHead(db, filenames);
}

const request = (path: string, withCookie = true) =>
  app.request(`/api${path}`, { headers: withCookie ? { cookie } : {} }, { ...auth, DB: database });

// biome-ignore lint/suspicious/noExplicitAny: 応答の形そのものを検証するテスト
const getJson = async (path: string): Promise<any> => {
  const res = await request(path);
  expect(res.status).toBe(200);
  return res.json();
};

const errorCode = async (res: Response) => ((await res.json()) as { error: { code: string } }).error.code;

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

const PERIOD = 'from=2026-07&to=2026-08';

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'household-screen',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database });

  const mf = [
    ['2026-07_1', '2026-07', '2026-07-03', '架空スーパー', -12_000, '食費', '食料品'],
    ['2026-07_2', '2026-07', '2026-07-25', '架空給与', 300_000, '収入', '給与'],
    ['2026-07_3', '2026-07', '2026-07-27', '架空家賃', -90_000, '住宅', '家賃'],
    ['2026-08_1', '2026-08', '2026-08-03', '架空スーパー', -20_000, '食費', '食料品'],
    ['2026-08_2', '2026-08', '2026-08-04', '架空電力', -8_000, '水道・光熱費', '電気代'],
    ['2026-08_3', '2026-08', '2026-08-25', '架空給与', 300_000, '収入', '給与'],
    ['2026-08_4', '2026-08', '2026-08-27', '架空家賃', -90_000, '住宅', '家賃'],
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
        ('default','2026-08','2026-08-15','expense','架空広告社','広告宣伝費','広告宣伝費',30000,'架空銀行',1),
        ('default','2026-08','2026-08-20','income','架空商事','売上高','売上高',100000,'架空銀行',1),
        ('other-user','2026-08','2026-08-05','expense','別ユーザー','通信費','通信費',999999,'',1)`,
    )
    .run();
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('認証', () => {
  it('未ログインは 2 本とも 401', async () => {
    expect((await request('/household', false)).status).toBe(401);
    expect((await request('/household/category?key=food', false)).status).toBe(401);
  });
});

describe('GET /api/household', () => {
  it('month を省くと期間の最終月を選び、KPI と 6 区分を返す', async () => {
    const body = await getJson(`/household?${PERIOD}`);
    expect(body.empty).toBe(false);
    expect(body.selectedMonth).toBe('2026-08');
    expect(body.series.map((row: { month: string }) => row.month)).toEqual(['2026-07', '2026-08']);
    expect(body.categories).toHaveLength(6);
    expect(body.labels).toEqual({
      business: '本人',
      spouse: 'パートナー',
      family: '子ども',
      unset: 'その他',
    });
  });

  it('期間内の month はそのまま選択月になる', async () => {
    expect((await getJson(`/household?${PERIOD}&month=2026-07`)).selectedMonth).toBe('2026-07');
  });

  it('YYYY-MM でない month と未知のパラメータは 400 invalid_query', async () => {
    for (const q of ['month=2026-13', 'month=2026-8', 'month=abc', 'unknown=1']) {
      const res = await request(`/household?${PERIOD}&${q}`);
      expect(res.status, q).toBe(400);
      expect(await errorCode(res)).toBe('invalid_query');
    }
  });

  it('期間外の month は最終月に倒さず 400 invalid_month', async () => {
    const res = await request(`/household?${PERIOD}&month=2025-01`);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('invalid_month');
  });

  it('家計全体の純収支・収入・支出は総収支画面の総合と一致し、事業 + 個人 = 全体 (不変条件 1・2)', async () => {
    const body = await getJson(`/household?${PERIOD}`);
    const cash = await getJson(`/total-cashflow?${PERIOD}`);
    const months = cash.months as Array<Record<string, number>>;
    const pick = (key: string) => sum(months.map((m) => m[key]));
    expect(body.summary.total).toEqual({
      income: pick('totalIncome'),
      expense: pick('totalExpense'),
      balance: pick('totalBalance'),
    });
    expect(body.segments.biz.balance + body.segments.personal.balance).toBe(body.summary.total.balance);
  });

  it('別の利用者の行は集計に入らない', async () => {
    const body = await getJson(`/household?${PERIOD}`);
    // 自分の支出は MF 12,000 + 90,000 + 20,000 + 8,000 + 90,000 と freee 30,000。別利用者の 999,999 は入らない
    expect(body.summary.total.expense).toBe(250_000);
  });

  it('期間に振替しかない場合は、記録月があっても空状態を返す', async () => {
    await database
      .prepare(
        `INSERT INTO mf_transactions
          (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
         VALUES ('default','transfer-only','2027-01','2027-01-10','口座振替',-50000,'現金・カード','口座振替',1,1,0)`,
      )
      .run();
    try {
      const body = await getJson('/household?from=2027-01&to=2027-01');
      expect(body.empty).toBe(true);
      expect(body.summary).toBeUndefined();
    } finally {
      await database
        .prepare("DELETE FROM mf_transactions WHERE user_id = 'default' AND tx_id = 'transfer-only'")
        .run();
    }
  });
});

describe('GET /api/household/category', () => {
  it('6 区分のどれかと選択月の詳細を返す', async () => {
    const body = await getJson(`/household/category?${PERIOD}&key=food&month=2026-08`);
    expect(body.key).toBe('food');
    expect(body.month).toBe('2026-08');
    expect(body.transactions.map((tx: { amount: number }) => tx.amount)).toEqual([20_000]);
  });

  it('key の欠落・未知の key・壊れた month は 400 invalid_query', async () => {
    for (const q of ['', 'key=constructor', 'key=food&month=2026-00']) {
      const res = await request(`/household/category?${PERIOD}&${q}`);
      expect(res.status, q).toBe(400);
      expect(await errorCode(res)).toBe('invalid_query');
    }
  });

  it('期間外の month は 400 invalid_month', async () => {
    const res = await request(`/household/category?${PERIOD}&key=food&month=2024-08`);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe('invalid_month');
  });
});

describe('名義の表示名の反映', () => {
  it('設定画面で保存した表示名が /household の応答にそのまま載る (画面ごとの写し表を持たない)', async () => {
    const labels = { business: 'わたし', spouse: '夫', family: '娘', unset: '共通' };
    const res = await app.request(
      '/api/settings/owner-labels',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ labels }),
      },
      { ...auth, DB: database },
    );
    expect(res.status).toBe(200);
    expect((await getJson(`/household?${PERIOD}`)).labels).toEqual(labels);
  });
});
