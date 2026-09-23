/**
 * 0052 現金明細の担当者・業務の目的・論理削除 (spec-cash-screen 受入 S5-a)。
 *
 * 0050 (予算) までを実際に流した DB に旧画面の行を置き、そこへ 0052 を当てる。
 * 追加だけの migration なので、既存行は1文字も変えない (backfill 0件) ことを固定する。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from './migration-test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const TARGET = '0052_cash_entry_owner_soft_delete.sql';

let mf: Miniflare;
let d1: D1Database;
let before: Record<string, unknown>[];

async function run(filename: string): Promise<void> {
  for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')))
    await d1.prepare(sql).run();
}

const selectLegacy = () =>
  d1
    .prepare(
      `SELECT id, user_id, date, month, side, io, amount, description, category_major, category_mid, memo,
              transit_from, transit_to, transit_round, receipt_waived, created_at, updated_at
         FROM cash_entries ORDER BY id`,
    )
    .all<Record<string, unknown>>();

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'cash-migration-0052',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  const names = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  expect(names.at(-1)).toBe(TARGET);
  for (const name of names.slice(0, -1)) await run(name);

  // 旧画面で記帳した行 (通常の支出と、往復の交通費)
  await d1
    .prepare(
      `INSERT INTO cash_entries
         (id,user_id,date,month,side,io,amount,description,category_major,category_mid,memo,
          transit_from,transit_to,transit_round,receipt_waived,created_at,updated_at)
       VALUES
         (1,'default','2026-07-10','2026-07','biz','expense',1200,'架空の文具','架空消耗品','','架空メモ',
          NULL,NULL,0,0,'2026-07-10T00:00:00Z','2026-07-10T00:00:00Z'),
         (2,'default','2026-07-11','2026-07','biz','expense',560,'架空駅A→架空駅B 往復','架空旅費','',NULL,
          '架空駅A','架空駅B',1,1,'2026-07-11T00:00:00Z','2026-07-12T00:00:00Z')`,
    )
    .run();
  before = (await selectLegacy()).results;
  await run(TARGET);
}, 60_000);

afterAll(async () => mf?.dispose());

describe('0052 現金明細の担当者・業務の目的・論理削除', () => {
  it('既存行の列を1つも書き換えない', async () => {
    expect(before).toHaveLength(2);
    expect((await selectLegacy()).results).toEqual(before);
  });

  it('足した3列は既存行で NULL (担当者は未設定、目的なし、有効)', async () => {
    const rows = await d1
      .prepare('SELECT id, owner, transit_purpose, deleted_at FROM cash_entries ORDER BY id')
      .all();
    expect(rows.results).toEqual([
      { id: 1, owner: null, transit_purpose: null, deleted_at: null },
      { id: 2, owner: null, transit_purpose: null, deleted_at: null },
    ]);
  });

  it('担当者は NULL か3値だけを受け付ける', async () => {
    for (const owner of ['business', 'spouse', 'family'])
      await d1.prepare('UPDATE cash_entries SET owner = ? WHERE id = 1').bind(owner).run();
    await expect(d1.prepare("UPDATE cash_entries SET owner = 'wife' WHERE id = 1").run()).rejects.toThrow(
      /CHECK constraint failed/,
    );
    expect(await d1.prepare('SELECT owner FROM cash_entries WHERE id = 1').first()).toEqual({
      owner: 'family',
    });
  });

  it('利用者ごとの有効行の読取に使う索引 (user_id, deleted_at) がある', async () => {
    const cols = await d1
      .prepare("SELECT name FROM pragma_index_info('idx_cash_user_deleted') ORDER BY seqno")
      .all();
    expect(cols.results).toEqual([{ name: 'user_id' }, { name: 'deleted_at' }]);
  });

  it('全利用者の夜間完全消去に使う索引 (deleted_at, id) がある', async () => {
    const cols = await d1
      .prepare("SELECT name FROM pragma_index_info('idx_cash_deleted_purge') ORDER BY seqno")
      .all();
    expect(cols.results).toEqual([{ name: 'deleted_at' }, { name: 'id' }]);
  });

  it('索引は IF NOT EXISTS で、流し直しても失敗しない', async () => {
    const createIndexes = splitMigrationStatements(
      readFileSync(resolve(migrationsDir, TARGET), 'utf8'),
    ).filter((statement) => statement.startsWith('CREATE INDEX'));
    expect(createIndexes).toHaveLength(2);
    for (const createIndex of createIndexes) {
      expect(createIndex).toContain('CREATE INDEX IF NOT EXISTS');
      await expect(d1.prepare(createIndex).run()).resolves.toBeTruthy();
    }
  });
});
