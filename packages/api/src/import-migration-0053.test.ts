/**
 * migration 0053 (データ取込画面) は追加だけで、既存の行を 1 件も書き換えない (SYS-IMPORT-P04)。
 * 0008 の import_runs に既存の行を置いてから 0053 を当て、文ごとの changes の合計が 0 であることと、
 * 新しい表・列・制約・索引が仕様どおりにあることを確かめる。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
const sql = readFileSync(resolve(root, 'migrations/0053_import_inspections.sql'), 'utf8');
const statements = splitMigrationStatements(sql);

let mf: Miniflare;
let d1: D1Database;
let changes = 0;
let before: unknown[] = [];

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'import-inspections',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await d1
    .prepare(
      `CREATE TABLE import_runs (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('processing','applying','committed','failed','duplicate')),
        failure_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      )`,
    )
    .run();
  await d1
    .prepare(
      `INSERT INTO import_runs (id,user_id,status,failure_reason,created_at,updated_at) VALUES
        ('run-a','u1','committed',NULL,'2026-01-01T00:00:00Z','2026-01-01T00:00:01Z'),
        ('run-b','u1','failed','parse_error','2026-01-02T00:00:00Z','2026-01-02T00:00:01Z'),
        ('run-c','u2','duplicate',NULL,'2026-01-03T00:00:00Z','2026-01-03T00:00:01Z')`,
    )
    .run();
  before = (await d1.prepare('SELECT * FROM import_runs ORDER BY id').all()).results;
  for (const statement of statements) {
    const result = await d1.prepare(statement).run();
    changes += result.meta.changes ?? 0;
  }
});

afterAll(async () => mf?.dispose());

const columns = async (table: string) =>
  (await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results.map((c) => c.name);

describe('0053 データ取込画面', () => {
  it('既存の行の更新は 0 件で、既存の列の値は変わらない', async () => {
    expect(changes).toBe(0);
    const after = (
      await d1
        .prepare('SELECT id,user_id,status,failure_reason,created_at,updated_at FROM import_runs ORDER BY id')
        .all()
    ).results;
    expect(after).toEqual(before);
    expect(after).toHaveLength(3);
  });

  it('既存の行の新しい列は NULL のまま', async () => {
    const rows = (
      await d1
        .prepare(
          'SELECT file_count,row_count,added_count,skipped_count,subs_candidate_count,result,keep_previous,hidden_at FROM import_runs',
        )
        .all<Record<string, unknown>>()
    ).results;
    for (const row of rows) expect(Object.values(row).every((v) => v === null)).toBe(true);
  });

  it('既存の表の UPDATE・DELETE・DROP を含まない', () => {
    expect(sql).not.toMatch(/\b(UPDATE|DELETE\s+FROM|DROP)\b/i);
    expect(
      statements.every((s) => /^(CREATE (TABLE|INDEX)|ALTER TABLE import_runs ADD COLUMN)/.test(s.trim())),
    ).toBe(true);
  });

  it('3 表と列が仕様どおり', async () => {
    expect(await columns('import_inspections')).toEqual([
      'id',
      'user_id',
      'actor_id',
      'status',
      'run_id',
      'expires_at',
      'created_at',
    ]);
    expect(await columns('import_inspection_files')).toEqual([
      'id',
      'inspection_id',
      'user_id',
      'position',
      'filename',
      'source',
      'period_from',
      'period_to',
      'size',
      'content_hash',
      'summary_json',
      'error_kind',
      'r2_key',
    ]);
    expect(await columns('import_rate_limits')).toEqual(['user_id', 'kind', 'window_start', 'count']);
    expect((await columns('import_runs')).slice(6)).toEqual([
      'file_count',
      'row_count',
      'added_count',
      'skipped_count',
      'subs_candidate_count',
      'result',
      'keep_previous',
      'hidden_at',
      'parent_run_id',
    ]);
  });

  it('索引は検査の (user_id, expires_at) とファイル項目の (inspection_id)', async () => {
    const names = (
      await d1
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_import_%'")
        .all<{ name: string }>()
    ).results.map((r) => r.name);
    expect(names.sort()).toEqual([
      'idx_import_inspection_files_inspection',
      'idx_import_inspections_user_expires',
    ]);
  });

  it('レート制限の主キーは (user_id, kind, window_start) で、種別は検査と確定だけ', async () => {
    await d1.prepare("INSERT INTO import_rate_limits VALUES ('u1','inspection',1,1)").run();
    await expect(
      d1.prepare("INSERT INTO import_rate_limits VALUES ('u1','inspection',1,2)").run(),
    ).rejects.toThrow();
    await d1.prepare("INSERT INTO import_rate_limits VALUES ('u1','commit',1,1)").run();
    await expect(
      d1.prepare("INSERT INTO import_rate_limits VALUES ('u1','login',1,1)").run(),
    ).rejects.toThrow();
  });

  it('結果と前回データを残すの値は決まった値だけ', async () => {
    await expect(d1.prepare("UPDATE import_runs SET result='done' WHERE id='run-a'").run()).rejects.toThrow();
    await expect(
      d1.prepare("UPDATE import_runs SET keep_previous=2 WHERE id='run-a'").run(),
    ).rejects.toThrow();
  });

  it('検査の行を消すとファイル項目も消える', async () => {
    await d1.prepare('PRAGMA foreign_keys = ON').run();
    await d1
      .prepare(
        "INSERT INTO import_inspections VALUES ('i1','u1','usr_a','open',NULL,'2026-01-02T00:00:00Z','2026-01-01T00:00:00Z')",
      )
      .run();
    await d1
      .prepare(
        "INSERT INTO import_inspection_files (id,inspection_id,user_id,position,filename,size,summary_json) VALUES ('f1','i1','u1',0,'a.csv',10,'{}')",
      )
      .run();
    await d1.prepare("DELETE FROM import_inspections WHERE id='i1'").run();
    const left = await d1.prepare('SELECT COUNT(*) AS n FROM import_inspection_files').first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
