/**
 * 使い方画面 (SYS-GUIDE) の API/D1 結合テスト。
 * GET /api/guide の期間 (指定あり・なし・壊れた指定)、総収支と同じ総額、振替の除外、取込 0 件、
 * 他の利用者の数値を返さないこと、401/403、防衛ラインを応答に含めないことを実 D1 で確かめる。
 * 実データは使わず、専用のインメモリ D1 と架空の取引だけで検証する。
 *
 * 取引: 2026-07/08 に freee の収入 300,000・支出 120,000、MF の振替 -5,000,000 (総額に入らない)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { splitMigrationStatements } from './migration-test-support.js';
import { isApplicationTableForTestReset, recordTestMigrationHead } from './schema-guard.test-support.js';
import { getDb, recomputeFromDeals } from './store.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-test-secret',
};

let mf: Miniflare | undefined;
let d1: D1Database;
let cookie: string;

async function applyMigrations(database: D1Database): Promise<void> {
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const filename of filenames) {
    const statements = splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));
    for (const sql of statements) await database.prepare(sql).run();
  }
  await recordTestMigrationHead(database, filenames);
}

async function request(path: string, sessionCookie: string | null = cookie): Promise<Response> {
  const headers: Record<string, string> = {};
  if (sessionCookie) headers.cookie = sessionCookie;
  return app.request(`/api${path}`, { headers }, { ...auth, DB: d1 });
}

interface GuideBody {
  screen: {
    period: {
      applied: { from: string; to: string } | null;
      full: { from: string; to: string } | null;
      label: string;
      definition: string;
    };
    totals: { income: number; expense: number; net: number };
    dataUpdatedAt: string | null;
    sources: string;
    closeStatus: unknown;
  };
}

async function guide(query = ''): Promise<GuideBody['screen']> {
  const response = await request(`/guide${query}`);
  expect(response.status).toBe(200);
  return ((await response.json()) as GuideBody).screen;
}

const deal = (
  user: string,
  month: string,
  io: 'income' | 'expense',
  account: string,
  partner: string,
  amount: number,
) =>
  d1
    .prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(user, month, `${month}-10`, io, partner, account, account, amount);

async function seed(): Promise<void> {
  await d1.batch([
    deal('default', '2026-07', 'income', '売上高', '架空商事', 300_000),
    deal('default', '2026-07', 'expense', '通信費', '架空通信', 120_000),
    deal('default', '2026-08', 'income', '売上高', '架空商事', 300_000),
    deal('default', '2026-08', 'expense', '通信費', '架空通信', 120_000),
    deal('other-user', '2026-08', 'income', '売上高', '別ユーザー', 999_999),
  ]);
  // 振替は総収支の総額に入らない (MF の is_transfer=1)
  await d1
    .prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable) VALUES
        ('default','2026-08_1_-5000000','2026-08','2026-08-20','架空口座へ振替',-5000000,'現金・カード','カード引き落とし',1,1,0),
        ('other-user','2026-08_9_-999999','2026-08','2026-08-05','別ユーザー',-999999,'事業経費','通信費',1,0,0)`,
    )
    .run();
  await recomputeFromDeals(getDb(d1), 'default');
  await recomputeFromDeals(getDb(d1), 'other-user');
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'guide-screen-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
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
  cookie = await loginForTest(app, { ...auth, DB: d1 });
});

afterAll(async () => {
  await mf?.dispose();
});

describe('GET /api/guide', () => {
  it('期間の指定があれば、その期間と定義文・総額を返す', async () => {
    await seed();
    const screen = await guide('?from=2026-08&to=2026-08');
    expect(screen.period.applied).toEqual({ from: '2026-08', to: '2026-08' });
    expect(screen.period.full).toEqual({ from: '2026-07', to: '2026-08' });
    expect(screen.period.label).toBe('2026年8月');
    expect(screen.period.definition).toContain('2026');
    expect(screen.totals).toEqual({ income: 300_000, expense: 120_000, net: 180_000 });
    expect(screen.sources).toBe('freeeから取得した取引データ（振替は除く）');
  });

  it('期間の指定が無い・壊れているときは全期間になる', async () => {
    await seed();
    const none = await guide();
    const broken = await guide('?from=abc&to=2026-99');
    for (const screen of [none, broken]) {
      expect(screen.period.applied).toBeNull();
      expect(screen.period.full).toEqual({ from: '2026-07', to: '2026-08' });
    }
    expect(broken.totals).toEqual(none.totals);
  });

  it('総額は同じ期間の総収支画面と一致し、振替と他の利用者の数値を含まない', async () => {
    await seed();
    for (const query of ['', '?from=2026-08&to=2026-08']) {
      const screen = await guide(query);
      const response = await request(`/total-cashflow${query}`);
      expect(response.status).toBe(200);
      const cashflow = (await response.json()) as { summary: { total: { income: number; expense: number } } };
      expect(screen.totals.income).toBe(cashflow.summary.total.income);
      expect(screen.totals.expense).toBe(cashflow.summary.total.expense);
    }
    const all = await guide();
    // freee の 2 か月分だけ。振替 5,000,000 や別利用者の 999,999 が入れば値がずれる
    expect(all.totals).toEqual({ income: 600_000, expense: 240_000, net: 360_000 });
    const text = JSON.stringify(await (await request('/guide')).json());
    expect(text).not.toContain('999999');
    expect(text).not.toContain('別ユーザー');
  });

  it('取込 0 件なら総額 0・最終更新 null・月次の状態 null を返す', async () => {
    const screen = await guide();
    expect(screen.totals).toEqual({ income: 0, expense: 0, net: 0 });
    expect(screen.dataUpdatedAt).toBeNull();
    expect(screen.closeStatus).toBeNull();
    expect(screen.period.applied).toBeNull();
    expect(screen.period.full).toBeNull();
  });

  it('防衛ラインの値を応答に含めない', async () => {
    await seed();
    const text = JSON.stringify(await (await request('/guide')).json());
    expect(text).not.toMatch(/defense/i);
    expect(text).not.toContain('防衛ライン');
  });

  it('未認証は 401、一時パスワードのままなら 403', async () => {
    expect((await request('/guide', null)).status).toBe(401);
    const temp = await loginForTest(
      app,
      { ...auth, DB: d1 },
      {
        id: 'temp-user',
        email: 'temp-user@example.test',
        password: 'Synthetic-Temp-Password-1',
        mustChangePassword: true,
      },
    );
    expect((await request('/guide', temp)).status).toBe(403);
  });
});
