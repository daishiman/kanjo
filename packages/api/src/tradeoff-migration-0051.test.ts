import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
const source = readFileSync(resolve(root, 'migrations/0051_tradeoff_notes.sql'), 'utf8');
const statements = splitMigrationStatements(source);

let mf: Miniflare;
let d1: D1Database;

const LEGACY = [
  {
    id: 1,
    user_id: 'u1',
    title: '旧い試算',
    amount: 50000,
    recurring: 1,
    selected: '[{"label":"外注費","value":20000}]',
    covered: 240000,
    verdict: 'insufficient',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    user_id: 'u2',
    title: null,
    amount: 300000,
    recurring: 0,
    selected: null,
    covered: null,
    verdict: null,
    created_at: '2026-02-01T00:00:00Z',
  },
];

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'tradeoff-notes',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  // 0051 直前の tradeoff_plans (0000_init の形)
  await d1
    .prepare(
      `CREATE TABLE tradeoff_plans (
        id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, title TEXT, amount INTEGER NOT NULL,
        recurring INTEGER NOT NULL, selected TEXT, covered INTEGER, verdict TEXT, created_at TEXT
      )`,
    )
    .run();
  for (const r of LEGACY) {
    await d1
      .prepare(
        `INSERT INTO tradeoff_plans (id,user_id,title,amount,recurring,selected,covered,verdict,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(r.id, r.user_id, r.title, r.amount, r.recurring, r.selected, r.covered, r.verdict, r.created_at)
      .run();
  }
  for (const sql of statements) await d1.prepare(sql).run();
});

afterAll(async () => mf?.dispose());

describe('0051 トレードオフの上書きと記録の列', () => {
  it('追加だけで、既存行を書き換える文を持たない', () => {
    const code = source.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/\b(UPDATE|DELETE|DROP|REPLACE)\b/i);
  });

  it('既存の記録を 1 列も変えず、新しい列は NULL で足す', async () => {
    const rows = await d1.prepare('SELECT * FROM tradeoff_plans ORDER BY id').all();
    // 列を選んで見ると選ばなかった列の変化が漏れる。行ごと固定する。
    expect(rows.results).toEqual(LEGACY.map((r) => ({ ...r, start_month: null, memo: null })));
  });

  it('候補ごとの上書き表を足し、利用者と候補キーの組で 1 行に限る', async () => {
    const insert = (user: string, key: string) =>
      d1
        .prepare(
          `INSERT INTO tradeoff_candidate_notes (user_id,candidate_key,need,memo,updated_at)
           VALUES (?,?,'low',NULL,'2026-09-22T00:00:00Z')`,
        )
        .bind(user, key)
        .run();
    await expect(insert('u1', '外注費|架空')).resolves.toBeTruthy();
    await expect(insert('u2', '外注費|架空')).resolves.toBeTruthy();
    await expect(insert('u1', '外注費|架空')).rejects.toThrow(/UNIQUE/);
  });

  it('updated_at は必須で、need と memo は NULL を許す', async () => {
    await expect(
      d1
        .prepare(
          "INSERT INTO tradeoff_candidate_notes (user_id,candidate_key,need,memo) VALUES ('u3','k|',NULL,NULL)",
        )
        .run(),
    ).rejects.toThrow(/NOT NULL/);
    await expect(
      d1
        .prepare(
          `INSERT INTO tradeoff_candidate_notes (user_id,candidate_key,need,memo,updated_at)
           VALUES ('u3','k|',NULL,NULL,'2026-09-22T00:00:00Z')`,
        )
        .run(),
    ).resolves.toBeTruthy();
  });
});
