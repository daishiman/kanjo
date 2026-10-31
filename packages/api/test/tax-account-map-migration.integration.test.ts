/**
 * 0059 勘定科目の対応表・0060 設定の変更履歴の種類 (spec-classify-bulk-save AC-16・FR-17・BR-10 / SYS-CLASSIFY-BULK-P04)。
 *
 * 仕様は番号を 0058・0059 と書くが、0058 はサブスクの統合が先に使ったため 1 つずつ進めた (OI-6。内容は仕様どおり)。
 * 0058 までを実際に流した DB に 2 人分の変更履歴を置き、そこへ 0059・0060 を当てる。
 * 0060 は表を作り直す migration なので、既存の履歴が seq も含めて 1 件も落ちないことを固定する。
 *
 * ## 置換前に落ちる理由
 *
 * 置換前は 0059・0060 が無く、tax_account_map の表も、履歴の種類 tax_account_map も無い。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TAX_ACCOUNT_MAP } from '@kanjo/core';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitMigrationStatements } from '../src/migration-test-support.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
const MAP = '0059_tax_account_map.sql';
const LOG = '0060_settings_change_log_target.sql';

let mf: Miniflare;
let d1: D1Database;
let before: Record<string, unknown>[];
let maxSeqBefore: Record<string, number>;
let checkBefore0060: unknown;

async function run(filename: string): Promise<void> {
  for (const sql of splitMigrationStatements(readFileSync(resolve(migrationsDir, filename), 'utf8')))
    await d1.prepare(sql).run();
}

const KEPT = 'user_id, seq, target, target_key, before, after, changed_by, changed_at, origin';
const logRows = async (where = '1=1') =>
  (
    await d1
      .prepare(`SELECT ${KEPT} FROM settings_change_log WHERE ${where} ORDER BY user_id, seq`)
      .all<Record<string, unknown>>()
  ).results;

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'tax-account-map-migration',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  const names = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const map = names.indexOf(MAP);
  expect(map).toBeGreaterThanOrEqual(0);
  expect(names[map + 1]).toBe(LOG);
  for (const name of names.slice(0, map)) await run(name);

  // 画面と復元で積んだ履歴。'default' は 0056 の集計ルールの移行行の後ろに続け、別の利用者は飛び番の seq を持つ
  const base = (
    await d1
      .prepare("SELECT COALESCE(MAX(seq), 0) AS m FROM settings_change_log WHERE user_id = 'default'")
      .first<{ m: number }>()
  )?.m as number;
  await d1
    .prepare(
      `INSERT INTO settings_change_log (user_id, seq, target, target_key, before, after, changed_by, changed_at, origin)
       VALUES
         ('default', ?1, 'owner_label', 'self', '"架空の本人"', '"架空の名義A"', 'synthetic-user', '2026-01-01T00:00:00.000Z', 'screen'),
         ('default', ?2, 'cash_override', 'cash-1', NULL, '{"amount":100}', 'synthetic-user', '2026-01-02T00:00:00.000Z', 'restore'),
         ('synthetic-other', 7, 'stat_min_months', 'statMinMonths', '3', '6', 'synthetic-other', '2026-01-03T00:00:00.000Z', 'screen')`,
    )
    .bind(base + 1, base + 2)
    .run();

  await run(MAP);

  // 0060 の前は、履歴の種類 tax_account_map を CHECK が拒む (0059 が履歴を書けない理由)
  checkBefore0060 = await d1
    .prepare(
      `INSERT INTO settings_change_log (user_id, seq, target, target_key, changed_by, changed_at, origin)
       VALUES ('default', 999, 'tax_account_map', '通信費', 'system', 't', 'migration')`,
    )
    .run()
    .then(
      () => null,
      (e: unknown) => e,
    );

  before = await logRows();
  maxSeqBefore = Object.fromEntries(
    (
      await d1
        .prepare('SELECT user_id, MAX(seq) AS m FROM settings_change_log GROUP BY user_id')
        .all<{ user_id: string; m: number }>()
    ).results.map((r) => [r.user_id, r.m]),
  );
  await run(LOG);
});

afterAll(async () => mf?.dispose());

describe('0059 勘定科目の対応表', () => {
  it("既存の持ち主 'default' に初期の 5 行が入り、字面は core の DEFAULT_TAX_ACCOUNT_MAP と一致する", async () => {
    const rows = (
      await d1
        .prepare(
          'SELECT user_id, category_big, tax_account, created_at, updated_at FROM tax_account_map ORDER BY category_big',
        )
        .all<{
          user_id: string;
          category_big: string;
          tax_account: string;
          created_at: string;
          updated_at: string;
        }>()
    ).results;
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.user_id === 'default')).toBe(true);
    const asMap = (list: readonly { categoryBig: string; taxAccount: string }[]) =>
      Object.fromEntries(list.map((r) => [r.categoryBig, r.taxAccount]));
    expect(asMap(rows.map((r) => ({ categoryBig: r.category_big, taxAccount: r.tax_account })))).toEqual(
      asMap(DEFAULT_TAX_ACCOUNT_MAP),
    );
    // 日時は API と同じ ISO 8601 (ミリ秒・Z) で入る
    for (const r of rows) {
      expect(r.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(r.updated_at).toBe(r.created_at);
    }
  });

  it('同じ利用者の同じ大項目の 2 行目は主キーが拒む', async () => {
    await expect(
      d1
        .prepare(
          "INSERT INTO tax_account_map (user_id, category_big, tax_account, created_at, updated_at) VALUES ('default', '通信費', '雑費', 't', 't')",
        )
        .run(),
    ).rejects.toThrow(/UNIQUE|PRIMARY KEY/);
  });
});

describe('0060 設定の変更履歴の種類', () => {
  it('0060 の前は CHECK が tax_account_map を拒んでいた', () => {
    expect(String(checkBefore0060)).toMatch(/CHECK/);
  });

  it('既存の履歴は seq も含めて 1 件も落ちず、値も変わらない', async () => {
    const kept = await logRows("target <> 'tax_account_map'");
    expect(kept).toEqual(before);
    expect(before.some((r) => r.user_id === 'synthetic-other' && r.seq === 7)).toBe(true);
    expect(before.filter((r) => r.user_id === 'default').length).toBeGreaterThanOrEqual(2);
  });

  it("初期の 5 行が origin='migration' の作成の履歴になり、seq は利用者ごとの最後の seq に続く", async () => {
    const added = await logRows("target = 'tax_account_map'");
    expect(added).toHaveLength(5);
    expect((await logRows()).length).toBe(before.length + 5);
    const start = maxSeqBefore.default as number;
    expect(added.map((r) => r.seq)).toEqual([start + 1, start + 2, start + 3, start + 4, start + 5]);
    // seq は大項目の名前順に振られる
    expect(added.map((r) => r.target_key)).toEqual(
      [...DEFAULT_TAX_ACCOUNT_MAP.map((r) => r.categoryBig)].sort(),
    );
    const changedAt = Object.fromEntries(
      (
        await d1
          .prepare('SELECT category_big, updated_at FROM tax_account_map')
          .all<{ category_big: string; updated_at: string }>()
      ).results.map((r) => [r.category_big, r.updated_at]),
    );
    for (const r of added) {
      const row = DEFAULT_TAX_ACCOUNT_MAP.find((m) => m.categoryBig === r.target_key);
      expect(r).toMatchObject({
        user_id: 'default',
        before: null,
        changed_by: 'system',
        origin: 'migration',
        changed_at: changedAt[r.target_key as string],
      });
      expect(JSON.parse(r.after as string)).toEqual({
        categoryBig: row?.categoryBig,
        taxAccount: row?.taxAccount,
      });
    }
    // 対応表を持たない利用者には履歴を足さない
    expect((await logRows("user_id = 'synthetic-other'")).map((r) => r.seq)).toEqual([7]);
  });

  it('CHECK は tax_account_map を受け、知らない種類と origin を拒む。主キーも残る', async () => {
    await d1
      .prepare(
        `INSERT INTO settings_change_log (user_id, seq, target, target_key, changed_by, changed_at, origin)
         VALUES ('synthetic-third', 1, 'tax_account_map', '通信費', 'synthetic-user', 't', 'screen')`,
      )
      .run();
    await expect(
      d1
        .prepare(
          `INSERT INTO settings_change_log (user_id, seq, target, target_key, changed_by, changed_at, origin)
           VALUES ('synthetic-third', 2, 'bogus', 'x', 'synthetic-user', 't', 'screen')`,
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
    await expect(
      d1
        .prepare(
          `INSERT INTO settings_change_log (user_id, seq, target, target_key, changed_by, changed_at, origin)
           VALUES ('synthetic-third', 3, 'tax_account_map', 'x', 'synthetic-user', 't', 'bogus')`,
        )
        .run(),
    ).rejects.toThrow(/CHECK/);
    await expect(
      d1
        .prepare(
          `INSERT INTO settings_change_log (user_id, seq, target, target_key, changed_by, changed_at, origin)
           VALUES ('synthetic-third', 1, 'norm_rule', 'x', 'synthetic-user', 't', 'screen')`,
        )
        .run(),
    ).rejects.toThrow(/UNIQUE|PRIMARY KEY/);
  });

  it('列は 0056 と同じで、作業用の表は残らず、索引が作り直されている', async () => {
    const columns = (
      await d1.prepare('PRAGMA table_info(settings_change_log)').all<{ name: string }>()
    ).results.map((c) => c.name);
    expect(columns).toEqual(KEPT.split(', '));
    const tables = (
      await d1
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'settings_change_log%'")
        .all<{ name: string }>()
    ).results.map((t) => t.name);
    expect(tables).toEqual(['settings_change_log']);
    const index = await d1
      .prepare(
        "SELECT tbl_name, sql FROM sqlite_master WHERE type='index' AND name='settings_change_log_target'",
      )
      .first<{ tbl_name: string; sql: string }>();
    expect(index?.tbl_name).toBe('settings_change_log');
    expect(index?.sql.replace(/\s+/g, ' ')).toContain('(user_id, target, target_key, seq)');
  });
});
