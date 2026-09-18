/**
 * freee/MF支出照合のAPI/D1回帰。
 * 実データを使わず、専用のインメモリD1と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from './auth.test-support.js';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
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

const request = (path: string) =>
  app.request(`/api${path}`, { headers: { cookie } }, { ...auth, DB: database });

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'expense-projection',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
  await applyMigrations(database);
  cookie = await loginForTest(app, { ...auth, DB: database });

  await database.batch([
    database.prepare(
      `INSERT INTO monthly_agg (user_id,month,scope,amount) VALUES
        ('default','2026-08','biz_exp:通信費',4300),
        ('other-user','2026-08','biz_exp:通信費',999999)`,
    ),
    database.prepare(
      `INSERT INTO freee_deals (user_id,month,date,io,partner,account_raw,account_norm,amount) VALUES
        ('default','2026-08','2026-08-05','expense','架空クラウド','通信費','サブスク・通信',3300),
        ('default','2026-08','2026-08-06','expense','架空仕入先','仕入高','仕入高',1000),
        ('default','2026-08','2026-08-07','expense','架空動画','事業主貸','事業主貸',1200),
        ('other-user','2026-08','2026-08-05','expense','別ユーザー','通信費','通信費',999999)`,
    ),
    database.prepare(
      `INSERT INTO mf_transactions
        (user_id,tx_id,month,date,description,amount,category_major,category_mid,is_target,is_transfer,identity_stable)
       VALUES
        ('default','mf-exact','2026-08','2026-08-05','架空クラウド',-3300,'事業経費','通信費',1,0,1),
        ('default','mf-only','2026-08','2026-08-08','架空SaaS',-5000,'事業経費','通信費',1,0,1),
        ('default','mf-private','2026-08','2026-08-07','架空動画',-1200,'趣味','動画',1,0,1),
        ('default','mf-music-jul','2026-07','2026-07-09','架空音楽',-980,'趣味','音楽',1,0,1),
        ('default','mf-music-aug','2026-08','2026-08-09','架空音楽',-980,'趣味','音楽',1,0,1),
        ('other-user','mf-other','2026-08','2026-08-09','別ユーザー',-999999,'事業経費','通信費',1,0,1)`,
    ),
    database.prepare(
      `INSERT INTO tx_edits (user_id,tx_id,cls,base_known) VALUES
        ('default','mf-exact','biz',1),
        ('default','mf-only','biz',1),
        ('other-user','mf-other','biz',1)`,
    ),
    database.prepare(
      `INSERT INTO sub_vendors (user_id,name,aliases,accounts,sort_order) VALUES
        ('default','架空クラウド','[]','[]',100),
        ('default','架空SaaS','[]','[]',200),
        ('default','架空動画','[]','[]',300)`,
    ),
  ]);
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('支出照合API', () => {
  it('freee確定とMF未記帳を分け、厳密一致は二重計上しない', async () => {
    const response = await request('/business-spend?from=2026-08&to=2026-08');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      summary: {
        booked: number;
        unbooked: number;
        effective: number;
        matchedCount: number;
        reviewCount: number;
      };
      unbooked: Array<{ id: string; amount: number }>;
    };
    expect(body.summary).toEqual({
      booked: 4300,
      unbooked: 5000,
      effective: 9300,
      matchedCount: 1,
      reviewCount: 0,
    });
    expect(body.unbooked).toEqual([expect.objectContaining({ id: 'mf-only', amount: 5000 })]);
    expect(JSON.stringify(body)).not.toContain('999999');
    expect(JSON.stringify(body)).not.toContain('別ユーザー');
  });

  it('サブスクをfreee/MF両方から集計し、照合済みMFは除く', async () => {
    const response = await request('/subscriptions?from=2026-08&to=2026-08');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      rows: Array<{ vendorKey: string; normalizedName: string; latestAmount: number; status: string }>;
    };
    const amountOf = (name: string) => body.rows.find((row) => row.normalizedName === name)?.latestAmount;
    expect(amountOf('架空クラウド')).toBe(3300);
    expect(amountOf('架空SaaS')).toBe(5000);
    expect(amountOf('架空動画')).toBe(1200);
    // freee と照合済みの MF (mf-exact) は二重に数えない: 架空クラウドの取引は freee の 1 件だけ
    const cloud = body.rows.find((row) => row.normalizedName === '架空クラウド');
    const detail = await request(
      `/subscriptions/vendors/${encodeURIComponent(cloud?.vendorKey ?? '')}?from=2026-08&to=2026-08`,
    );
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as { transactionCount: number }).transactionCount).toBe(1);
    expect(JSON.stringify(body)).not.toContain('999999');
  });

  it('MFだけの定期支出もサブスク候補に出す', async () => {
    const response = await request('/sub-vendors/candidates');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { candidates: Array<{ partner: string; activeMonths: number }> };
    expect(body.candidates).toContainEqual(expect.objectContaining({ partner: '架空音楽', activeMonths: 2 }));
  });

  it('サブスク対象科目の選択肢をfreeeとMFの両方から返す', async () => {
    const response = await request('/sub-vendors');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { accountOptions: string[] };
    expect(body.accountOptions).toEqual(
      expect.arrayContaining(['通信費', '事業経費', '事業経費/通信費', '趣味/音楽']),
    );
    expect(JSON.stringify(body)).not.toContain('999999');
  });
});
