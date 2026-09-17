/**
 * 取込前の総収支レスポンス契約。
 * 実データを使わず、空のインメモリ D1 だけで検証する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginForTest } from '../src/auth.test-support.js';
import { app } from '../src/index.js';
import { recordTestMigrationHead } from '../src/schema-guard.test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const auth = {
  ACCESS_AUD: '',
  ACCESS_TEAM_DOMAIN: '',
  SESSION_SECRET: 'synthetic-empty-cashflow-secret',
};

let miniflare: Miniflare;
let database: D1Database;
let cookie: string;

beforeAll(async () => {
  miniflare = new Miniflare(
    convertV4MiniflareOptions({
      name: 'total-cashflow-empty',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  database = (await miniflare.getD1Database('DB')) as D1Database;
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
  cookie = await loginForTest(app, { ...auth, DB: database });
}, 30_000);

afterAll(async () => {
  await miniflare?.dispose();
});

describe('取込前の総収支', () => {
  it('coverage は通常時と同じ項目名を返す', async () => {
    const response = await app.request(
      '/api/total-cashflow',
      { headers: { cookie } },
      { ...auth, DB: database },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      months: [],
      coverage: { freeeTotal: 0, matched: 0, freeeOnly: 0, excluded: 0, mfReview: 0 },
      summary: null,
      workbench: null,
    });
  });
});
