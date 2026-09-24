/**
 * 0054 改善リクエスト画面 (spec-improvement-screen AC-013 / SYS-IMPSCR-P04)。
 *
 * 仕様は番号を 0053 と書くが、0053 は取込画面が先に使ったため 0054 で当てる (内容は仕様どおり)。
 * 0053 までを実際に流した DB に旧画面の依頼 (wontfix を含む) を置き、そこへ 0054 を当てる。
 * 表を作り直す migration なので、行・画像のキー・トークンのハッシュが 1 件も落ちないことを固定する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const TARGET = '0054_improvement_request_screen.sql';

let mf: Miniflare;
let d1: D1Database;
let before: Record<string, unknown>[];
let appliedFrom: string;
let appliedTo: string;

async function run(filename: string): Promise<void> {
  for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')))
    await d1.prepare(sql).run();
}

const KEPT = `id, user_id, title, body, route, screenshot_key, screenshot_size, diagnostics_json, diagnostics_omitted,
  token_hash, token_expires_at, token_fetch_count, copied_at, copied_target, purged_at, created_at, updated_at`;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'improvement-migration-0054',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  const names = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const target = names.indexOf(TARGET);
  expect(target).toBeGreaterThanOrEqual(0);
  for (const name of names.slice(0, target)) await run(name);

  // 旧画面で作った依頼。作成順を id の順と食い違わせ、seq が created_at で振られることを確かめる
  await d1
    .prepare(
      `INSERT INTO improvement_requests
         (id,user_id,title,body,route,status,screenshot_key,screenshot_size,diagnostics_json,diagnostics_omitted,
          token_hash,token_expires_at,token_fetch_count,copied_at,copied_target,done_at,purged_at,created_at,updated_at)
       VALUES
         ('imp-c','default','架空の件名C','架空の本文C','/budget','open','improvements/imp-c.jpg',1024,'{"entries":[]}',0,
          'hash-c','2026-02-01T00:00:00.000Z',1,'2026-01-03T00:00:00.000Z','codex',NULL,NULL,
          '2026-01-01T00:00:00.000Z','2026-01-01T00:00:01.000Z'),
         ('imp-a','default','架空の件名A','架空の本文A','/classify','wontfix',NULL,NULL,NULL,2,
          'hash-a',NULL,0,NULL,NULL,NULL,NULL,
          '2026-01-02T00:00:00.000Z','2026-01-02T00:00:01.000Z'),
         ('imp-b','default','架空の件名B','架空の本文B','','done','improvements/imp-b.jpg',2048,NULL,0,
          NULL,NULL,0,NULL,NULL,'2026-01-05T00:00:00.000Z','2026-01-06T00:00:00.000Z',
          '2026-01-03T00:00:00.000Z','2026-01-05T00:00:00.000Z'),
         ('imp-d','default','架空の件名D','架空の本文D','/cash','wontfix',NULL,NULL,NULL,0,
          NULL,NULL,0,NULL,NULL,'2026-01-07T00:00:00.000Z',NULL,
          '2026-01-04T00:00:00.000Z','2026-01-07T00:00:00.000Z'),
         ('imp-z','synthetic-other','架空の件名Z','架空の本文Z','','in_progress',NULL,NULL,NULL,0,
          'hash-z',NULL,0,NULL,NULL,NULL,NULL,
          '2026-01-01T12:00:00.000Z','2026-01-01T12:00:00.000Z')`,
    )
    .run();
  before = (
    await d1.prepare(`SELECT ${KEPT} FROM improvement_requests ORDER BY id`).all<Record<string, unknown>>()
  ).results;
  appliedFrom = new Date().toISOString();
  await run(TARGET);
  appliedTo = new Date(Date.now() + 1000).toISOString();
});

afterAll(async () => mf?.dispose());

const rows = async () =>
  (
    await d1
      .prepare('SELECT id, user_id, seq, status, done_at, deleted_at FROM improvement_requests ORDER BY id')
      .all<{
        id: string;
        user_id: string;
        seq: number;
        status: string;
        done_at: string | null;
        deleted_at: null;
      }>()
  ).results;

const activities = async () =>
  (
    await d1
      .prepare(
        'SELECT request_id, user_id, kind, from_status, to_status, created_at FROM improvement_request_activities ORDER BY request_id, kind',
      )
      .all<Record<string, unknown>>()
  ).results;

describe('0054 改善リクエスト画面', () => {
  it('既存の行は 1 件も落ちず、id・画像のキー・トークンのハッシュを含む列の値は変わらない', async () => {
    const after = (
      await d1.prepare(`SELECT ${KEPT} FROM improvement_requests ORDER BY id`).all<Record<string, unknown>>()
    ).results;
    expect(after).toHaveLength(5);
    expect(after).toEqual(before);
  });

  it('wontfix は done へ移り、done_at が無ければ適用時刻を起点にする。既存の done_at は残す', async () => {
    const byId = Object.fromEntries((await rows()).map((r) => [r.id, r]));
    expect(byId['imp-a']?.status).toBe('done');
    expect(byId['imp-d']?.status).toBe('done');
    expect(byId['imp-d']?.done_at).toBe('2026-01-07T00:00:00.000Z');
    const stamped = byId['imp-a']?.done_at ?? '';
    expect(stamped >= appliedFrom && stamped <= appliedTo).toBe(true);
    // wontfix でなかった行の状態と done_at はそのまま
    expect(byId['imp-b']).toMatchObject({ status: 'done', done_at: '2026-01-05T00:00:00.000Z' });
    expect(byId['imp-c']).toMatchObject({ status: 'open', done_at: null });
    expect(byId['imp-z']).toMatchObject({ status: 'in_progress', done_at: null });
    expect((await rows()).every((r) => r.deleted_at === null)).toBe(true);
  });

  it('seq は利用者ごとに作成順 (created_at, id) で 1 から振られ、counters は最後の seq を持つ', async () => {
    const seqs = Object.fromEntries((await rows()).map((r) => [r.id, [r.user_id, r.seq]]));
    expect(seqs).toEqual({
      'imp-c': ['default', 1],
      'imp-a': ['default', 2],
      'imp-b': ['default', 3],
      'imp-d': ['default', 4],
      'imp-z': ['synthetic-other', 1],
    });
    const counters = (
      await d1.prepare('SELECT user_id, last_seq FROM improvement_request_counters ORDER BY user_id').all()
    ).results;
    expect(counters).toEqual([
      { user_id: 'default', last_seq: 4 },
      { user_id: 'synthetic-other', last_seq: 1 },
    ]);
  });

  it('全行に作成の履歴が 1 行ずつ、wontfix だった行にだけ migrated_wontfix が 1 行できる', async () => {
    const all = await activities();
    const created = all.filter((a) => a.kind === 'created');
    expect(created.map((a) => a.request_id)).toEqual(['imp-a', 'imp-b', 'imp-c', 'imp-d', 'imp-z']);
    for (const a of created) expect(a).toMatchObject({ from_status: null, to_status: 'open' });
    expect(created.find((a) => a.request_id === 'imp-c')?.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(created.find((a) => a.request_id === 'imp-z')?.user_id).toBe('synthetic-other');

    const migrated = all.filter((a) => a.kind === 'migrated_wontfix');
    expect(migrated.map((a) => a.request_id)).toEqual(['imp-a', 'imp-d']);
    for (const a of migrated)
      expect(a).toMatchObject({ from_status: null, to_status: 'done', user_id: 'default' });
    expect(all).toHaveLength(7);
  });

  it('作業用の表は残らず、新しい状態の CHECK は wontfix を拒む', async () => {
    const tables = (
      await d1
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'improvement%' ORDER BY name",
        )
        .all<{
          name: string;
        }>()
    ).results.map((t) => t.name);
    expect(tables).toEqual([
      'improvement_request_activities',
      'improvement_request_counters',
      'improvement_requests',
    ]);
    await expect(
      d1
        .prepare(
          "INSERT INTO improvement_requests (id,user_id,seq,body,status,created_at,updated_at) VALUES ('x','default',9,'架空','wontfix','t','t')",
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
    // 同じ利用者で seq の重複も拒む
    await expect(
      d1
        .prepare(
          "INSERT INTO improvement_requests (id,user_id,seq,body,created_at,updated_at) VALUES ('y','default',1,'架空','t','t')",
        )
        .run(),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('索引が仕様どおりにある', async () => {
    const indexes = (
      await d1
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_improvement%' ORDER BY name",
        )
        .all<{ name: string }>()
    ).results.map((i) => i.name);
    expect(indexes).toEqual([
      'idx_improvement_request_activities_request',
      'idx_improvement_requests_deleted',
      'idx_improvement_requests_purge',
      'idx_improvement_requests_user',
    ]);
  });
});
