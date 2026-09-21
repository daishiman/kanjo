/**
 * migration 0046 (AI分析の依頼の段階と T-番号) が追加だけで、既存の行を 1 行も書き換えないことの検証。
 * 0045 までを当てたインメモリ D1 に架空の依頼・レポートを入れ、0046 を当てる前後で中身を突き合わせる。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const TARGET = '0046_ai_task_stages.sql';

let mf: Miniflare;
let d1: D1Database;

const statementsOf = (filename: string): string[] =>
  splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8'));

const all = async (sql: string) => (await d1.prepare(sql).all()).results as Record<string, unknown>[];

let before: { tasks: Record<string, unknown>[]; reports: Record<string, unknown>[] };
let changesDuring = -1;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'ai-migration-0046',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  const filenames = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const targetIndex = filenames.indexOf(TARGET);
  expect(targetIndex).toBeGreaterThan(0);
  for (const f of filenames.slice(0, targetIndex))
    for (const sql of statementsOf(f)) await d1.prepare(sql).run();

  // 架空の既存行: 受信済み・待機中・期限切れと、同じ利用者の複数行 (seq が NULL のまま並ぶ)
  const tasks: [string, string, string | null][] = [
    ['old-done', '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z'],
    ['old-waiting', '2099-01-01T00:00:00.000Z', null],
    ['old-expired', '2026-01-02T00:00:00.000Z', null],
  ];
  for (const [id, expiresAt, usedAt] of tasks)
    await d1
      .prepare(
        `INSERT INTO ai_tasks (id, user_id, period_kind, period_key, period_from, period_to, report_type,
          token_hash, expires_at, used_at, created_at)
         VALUES (?, 'default', 'range', '', '2026-01', '2026-01', 'monthly', ?, ?, ?, '2026-01-01T00:00:00.000Z')`,
      )
      .bind(id, `hash-${id}`, expiresAt, usedAt)
      .run();
  await d1
    .prepare(
      `INSERT INTO ai_reports (id, user_id, task_id, period_kind, period_key, period_from, period_to, report_type,
        version, generated_by, title, summary, body_json, created_at)
       VALUES ('old-report', 'default', 'old-done', 'range', '', '2026-01', '2026-01', 'monthly', 1, 'test',
        '架空', '架空の総評', '{}', '2026-01-01T01:00:00.000Z')`,
    )
    .run();
  before = {
    tasks: await all('SELECT * FROM ai_tasks ORDER BY id'),
    reports: await all('SELECT * FROM ai_reports ORDER BY id'),
  };

  // meta.changes は INSERT/UPDATE/DELETE で変わった行数。ALTER TABLE と索引作成だけなら合計 0 になる
  // (total_changes() は D1 の内部記録でも増えるため、行の更新件数の物差しに使わない)
  changesDuring = 0;
  for (const sql of statementsOf(TARGET)) changesDuring += (await d1.prepare(sql).run()).meta.changes;
});

afterAll(async () => {
  await mf?.dispose();
});

describe('migration 0046', () => {
  it('当てても行の更新は 0 件', () => {
    expect(changesDuring).toBe(0);
  });

  it('既存の列の値はそのままで、追加列は NULL (reject_count だけ 0)', async () => {
    const after = await all('SELECT * FROM ai_tasks ORDER BY id');
    expect(after).toHaveLength(before.tasks.length);
    after.forEach((row, i) => {
      const { seq, data_fetched_at, rejected_at, reject_count, canceled_at, ...rest } = row;
      expect(rest).toEqual(before.tasks[i]);
      expect({ seq, data_fetched_at, rejected_at, reject_count, canceled_at }).toEqual({
        seq: null,
        data_fetched_at: null,
        rejected_at: null,
        reject_count: 0,
        canceled_at: null,
      });
    });
    expect(await all('SELECT * FROM ai_reports ORDER BY id')).toEqual(before.reports);
  });

  it('(user_id, seq) は一意で、seq が NULL の既存行どうしは衝突しない', async () => {
    const idx = await all(
      "SELECT name, \"unique\" FROM pragma_index_list('ai_tasks') WHERE name = 'uq_ai_tasks_user_seq'",
    );
    expect(idx).toEqual([{ name: 'uq_ai_tasks_user_seq', unique: 1 }]);
    await d1.prepare("UPDATE ai_tasks SET seq = 1 WHERE id = 'old-waiting'").run();
    await expect(d1.prepare("UPDATE ai_tasks SET seq = 1 WHERE id = 'old-expired'").run()).rejects.toThrow(
      /UNIQUE/,
    );
  });
});
