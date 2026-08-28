/**
 * 公私仕分けの明細一覧が、本番で起きた「集計だけ残り、明細が1ヶ月分しかない」状態でも開けること。
 * 実データは使わず、専用のインメモリ D1 と架空明細だけで検証する。
 *
 * 見張っているのは「集計キャッシュと明細のずれ」。monthly_agg は27ヶ月ぶんの科目・ベンダーを
 * 持っているのに mf_transactions は最新1ヶ月しか無い、という食い違いは、取込のやり直しや
 * 復元の途中で普通に起きる。このとき一覧が500で落ちると、利用者は仕分け画面に入れなくなり、
 * 領収書の添付も科目の付け直しも一切できない(画面が丸ごと使えなくなる)。
 *
 * あわせて、口座名が無い旧取込の明細(institution = NULL)と、ルール0件・候補0件でも
 * 一覧が返ることを見る。支払手段の導出と科目候補はどちらも欠損に触れる場所なので、
 * ここが落ちると同じく画面ごと開けなくなる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

/** 本番で観測した形: 27ヶ月ぶんの集計、明細は最新1ヶ月だけ、口座名なし、ルール0件 */
const MONTHS = Array.from({ length: 27 }, (_, i) => {
  const m = 5 + i; // 2024-05 から
  return `${2024 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
});
const LAST_MONTH = MONTHS[MONTHS.length - 1];
const VENDORS = Array.from({ length: 22 }, (_, i) => `架空ベンダー${i + 1}`);
const BIZ_CATEGORIES = ['消耗品費', '旅費交通費', '広告宣伝費', '会議費', '雑費'];
const PER_CATEGORIES = ['食費', '通信費', '日用品', '未分類'];

async function seedProductionShape(): Promise<void> {
  const stmts: D1PreparedStatement[] = [];

  // 集計キャッシュ: 全期間ぶんの科目・ベンダーが残っている
  for (const month of MONTHS) {
    stmts.push(
      d1
        .prepare(
          "INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES ('default', ?, 'biz_rev', 300000)",
        )
        .bind(month),
    );
    for (const c of BIZ_CATEGORIES)
      stmts.push(
        d1
          .prepare('INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES (?, ?, ?, ?)')
          .bind('default', month, `biz_exp:${c}`, 10000),
      );
    for (const c of PER_CATEGORIES)
      stmts.push(
        d1
          .prepare('INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES (?, ?, ?, ?)')
          .bind('default', month, `per_exp:${c}`, 20000),
      );
    for (const v of VENDORS)
      stmts.push(
        d1
          .prepare('INSERT INTO monthly_agg (user_id, month, scope, amount) VALUES (?, ?, ?, ?)')
          .bind('default', month, `subs:${v}`, 1500),
      );
  }

  // 明細: 最新1ヶ月だけ107件。口座名なし・同一性キーは不安定(旧取込)
  for (let i = 0; i < 107; i += 1)
    stmts.push(
      d1
        .prepare(
          `INSERT INTO mf_transactions
             (user_id, tx_id, month, date, description, amount, category_major, category_mid, institution, identity_stable, is_target, is_transfer)
           VALUES ('default', ?, ?, ?, ?, ?, ?, '', NULL, 0, 1, 0)`,
        )
        .bind(
          `TX${i}`,
          LAST_MONTH,
          `${LAST_MONTH}-${String((i % 28) + 1).padStart(2, '0')}`,
          `架空の支払 ${i}`,
          i % 5 === 0 ? 50000 : -1200 - i,
          PER_CATEGORIES[i % PER_CATEGORIES.length],
        ),
    );

  for (const [i, v] of VENDORS.entries())
    stmts.push(
      d1
        .prepare(
          'INSERT INTO sub_vendors (user_id, name, aliases, accounts, sort_order) VALUES (?, ?, ?, ?, ?)',
        )
        .bind('default', v, '[]', '[]', i),
    );

  // freee 仕訳は科目候補の材料。件数だけ本番に合わせる
  for (let i = 0; i < 340; i += 1)
    stmts.push(
      d1
        .prepare(
          `INSERT INTO freee_deals (user_id, month, date, io, partner, account_raw, account_norm, amount)
           VALUES ('default', ?, ?, 'expense', ?, ?, ?, ?)`,
        )
        .bind(
          MONTHS[i % MONTHS.length],
          `${MONTHS[i % MONTHS.length]}-01`,
          `架空取引先${i}`,
          BIZ_CATEGORIES[i % BIZ_CATEGORIES.length],
          BIZ_CATEGORIES[i % BIZ_CATEGORIES.length],
          1000 + i,
        ),
    );

  await d1.batch(stmts);
}

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'classify-transactions-shape-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
      r2Buckets: ['FILES'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  files = (await mf.getR2Bucket('FILES')) as unknown as R2Bucket;
  await applyMigrations(d1);

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
    { ...auth, DB: d1, FILES: files },
  );
  cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  expect(login.status).toBe(200);

  await seedProductionShape();
}, 60_000);

afterAll(async () => {
  await mf?.dispose();
});

const get = (path: string) =>
  app.request(`/api${path}`, { headers: { cookie } }, { ...auth, DB: d1, FILES: files });

describe('公私仕分けの明細一覧(集計と明細がずれた状態)', () => {
  it('明細が最新1ヶ月しか無くても200で返す', async () => {
    const response = await get('/transactions');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      months: string[];
      month: string;
      summary: { count: number; noInstitutionCount: number };
      transactions: unknown[];
    };
    expect(body.month).toBe(LAST_MONTH);
    expect(body.summary.count).toBe(107);
    expect(body.transactions).toHaveLength(107);
    // 口座名の無い明細は件数として出す。取込漏れと取り違えさせない
    expect(body.summary.noInstitutionCount).toBe(107);
  });

  it('明細の無い月を指定しても落ちず、最新月に寄せる', async () => {
    const response = await get(`/transactions?month=${MONTHS[0]}`);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { month: string }).month).toBe(LAST_MONTH);
  });

  it('絞り込みを掛けても落ちない', async () => {
    for (const query of ['cls=biz', 'owner=unset', 'manual=1', 'method=unknown', 'q=架空']) {
      const response = await get(`/transactions?${query}`);
      expect(response.status, query).toBe(200);
    }
  });

  it('同じ状態でサマリ・サブスクも開ける(明細一覧だけの問題にしない)', async () => {
    for (const path of ['/summary', '/subscriptions']) {
      const response = await get(path);
      expect(response.status, path).toBe(200);
    }
  });
});
