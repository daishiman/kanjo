import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
const statements = splitMigrationStatements(
  readFileSync(resolve(root, 'migrations/0047_ai_report_invariants.sql'), 'utf8'),
);

let mf: Miniflare;
let d1: D1Database;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'ai-report-invariants',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await d1
    .prepare(
      `CREATE TABLE ai_reports (
        id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, task_id TEXT NOT NULL,
        report_type TEXT NOT NULL, period_from TEXT NOT NULL, period_to TEXT NOT NULL,
        version INTEGER NOT NULL, created_at TEXT NOT NULL,
        body_json TEXT NOT NULL, parent_report_id TEXT
      )`,
    )
    .run();
  await d1
    .prepare(
      // 版が重複した旧データ。legacy-b は legacy-a を親に持つ (連番化で参照が切れないことを見る)。
      `INSERT INTO ai_reports
         (id,user_id,task_id,report_type,period_from,period_to,version,created_at,body_json,parent_report_id)
       VALUES
         ('legacy-b','u1','legacy-task','annual','2025-09','2026-08',1,'2026-01-02T00:00:00Z','{"t":"B"}','legacy-a'),
         ('legacy-a','u1','legacy-task','annual','2025-09','2026-08',1,'2026-01-01T00:00:00Z','{"t":"A"}',NULL)`,
    )
    .run();
  for (const sql of statements) await d1.prepare(sql).run();
});

afterAll(async () => mf?.dispose());

describe('0047 AIレポート不変条件', () => {
  const insert = (id: string, task: string, version: number) =>
    d1
      .prepare(
        `INSERT INTO ai_reports (id,user_id,task_id,report_type,period_from,period_to,version,created_at,body_json)
         VALUES (?,'u1',?,'annual','2025-09','2026-08',?,'2026-02-01T00:00:00Z','{}')`,
      )
      .bind(id, task, version)
      .run();

  it('既存の重複版を作成順の連番へ直す', async () => {
    const rows = await d1
      .prepare('SELECT id, version FROM ai_reports ORDER BY created_at, id')
      .all<{ id: string; version: number }>();
    expect(rows.results).toEqual([
      { id: 'legacy-a', version: 1 },
      { id: 'legacy-b', version: 2 },
    ]);
  });

  it('連番化で version 以外の列を失わない', async () => {
    const rows = await d1
      .prepare(
        'SELECT id, task_id, created_at, body_json, parent_report_id FROM ai_reports ORDER BY created_at, id',
      )
      .all<{
        id: string;
        task_id: string;
        created_at: string;
        body_json: string;
        parent_report_id: string | null;
      }>();
    // 列を選んで見ると、選ばなかった列の消失が漏れる。行ごと固定する。
    expect(rows.results).toEqual([
      {
        id: 'legacy-a',
        task_id: 'legacy-task',
        created_at: '2026-01-01T00:00:00Z',
        body_json: '{"t":"A"}',
        parent_report_id: null,
      },
      {
        id: 'legacy-b',
        task_id: 'legacy-task',
        created_at: '2026-01-02T00:00:00Z',
        body_json: '{"t":"B"}',
        // 連番を振り直しても自己参照は付け替えない (親は id で指しているため)
        parent_report_id: 'legacy-a',
      },
    ]);
  });

  it('同一系列の同一版をDBで拒否し、別版は受け付ける', async () => {
    await expect(insert('r1', 't1', 1)).rejects.toThrow(/UNIQUE/);
    await expect(insert('r2', 't1', 3)).resolves.toBeTruthy();
    await expect(insert('r3', 't2', 3)).rejects.toThrow(/UNIQUE/);
  });

  it('既存のtask重複は保持し、今後の同一task追加だけを拒否する', async () => {
    expect(
      await d1
        .prepare("SELECT COUNT(*) AS n FROM ai_reports WHERE task_id = 'legacy-task'")
        .first<number>('n'),
    ).toBe(2);
    await expect(insert('r4', 'legacy-task', 4)).rejects.toThrow(/already has report/);
  });
});
