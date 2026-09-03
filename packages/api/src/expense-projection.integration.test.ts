/**
 * freee/MF支出照合のAPI/D1回帰。
 * 実データを使わず、専用のインメモリD1と架空明細だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './index.js';
import { recordTestMigrationHead } from './schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  AUTH_PASSWORD: 'synthetic-test-password',
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
  const login = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: auth.AUTH_PASSWORD }),
    },
    { ...auth, DB: database },
  );
  expect(login.status).toBe(200);
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';

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
      matrix: Record<string, number[]>;
      sourceCoverage: { freee: number; moneyForward: number; matched: number; review: number };
    };
    expect(Object.keys(body.matrix)).toEqual(
      expect.arrayContaining(['架空クラウド', '架空SaaS', '架空動画']),
    );
    expect(body.matrix['架空クラウド']).toEqual([3300]);
    expect(body.matrix['架空SaaS']).toEqual([5000]);
    expect(body.matrix['架空動画']).toEqual([1200]);
    expect(body.sourceCoverage).toEqual({ freee: 3, moneyForward: 2, matched: 2, review: 0 });
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
