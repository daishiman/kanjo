/**
 * 0030 が入れたスキーマの回帰テスト。
 *
 * 見張っているのは4つ。
 *   1. 既存の migration を全部当てた上に 0030 が当たり、既存テーブルが壊れないこと
 *   2. 退避テーブルが DR-4 の巻き戻しに要る3つ(content_hash / import_id / updated_at)を持つこと
 *   3. balance_entries / cash_entries に import_id が生えていないこと
 *   4. 決め事が1利用者1取引先につき1件に保たれること
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JSON_SNAPSHOT_MUTATION_CONSUMERS } from './import-active.js';
import { EXPECTED_D1_MIGRATION } from './schema-guard.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../migrations');
let mf: Miniflare | undefined;
let d1: D1Database;

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
}

const columnsOf = async (table: string): Promise<string[]> => {
  const rows = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return rows.results.map((row) => row.name);
};

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'deletion-schema',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
});

afterAll(async () => {
  await mf?.dispose();
});

describe('0030 の適用', () => {
  it('連番の先頭が実行時ガードの期待headと一致する', () => {
    const latest = readdirSync(migrationsDir)
      .filter((filename) => filename.endsWith('.sql'))
      .sort()
      .at(-1);
    expect(latest).toBe(EXPECTED_D1_MIGRATION);
    expect(EXPECTED_D1_MIGRATION).toBe('0034_import_discard_audit.sql');
  });

  it('削除・決め事・二層監査のテーブルが揃う', async () => {
    const rows = await d1
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all<{ name: string }>();
    const names = rows.results.map((row) => row.name);
    for (const table of [
      'import_deletion_operations',
      'import_deleted_rows',
      'import_deleted_targets',
      'vendor_memory',
      'audit_log',
      'audit_log_detail',
    ])
      expect(names).toContain(table);
  });

  it('既存テーブルを作り直していない(0008 の列がそのまま残る)', async () => {
    expect(await columnsOf('import_active_targets')).toEqual(
      expect.arrayContaining(['user_id', 'target_key', 'content_hash', 'import_id', 'updated_at']),
    );
  });
});

describe('DR-4 の巻き戻し先', () => {
  it('退避テーブルが削除前の指紋3点を持つ', async () => {
    expect(await columnsOf('import_deleted_targets')).toEqual(
      expect.arrayContaining(['target_key', 'content_hash', 'import_id', 'updated_at']),
    );
  });

  it('同じ操作で同じ対象キーを二重に退避できない', async () => {
    const insert = (hash: string) =>
      d1
        .prepare(
          `INSERT INTO import_deleted_targets
             (operation_id,user_id,target_key,content_hash,import_id,updated_at)
           VALUES (?,?,?,?,?,?)`,
        )
        .bind('op-dup', 'u1', 'mf:2026-06', hash, 1, '2026-06-01T00:00:00.000Z')
        .run();
    await insert('hash-a');
    await expect(insert('hash-b')).rejects.toThrow();
  });
});

describe('退避行', () => {
  it('同じ操作で同じ行を二重に退避できない', async () => {
    const insert = () =>
      d1
        .prepare(
          `INSERT INTO import_deleted_rows
             (operation_id,user_id,table_name,row_id,month,payload_json)
           VALUES (?,?,?,?,?,?)`,
        )
        .bind('op-1', 'u1', 'mf_transactions', 'tx-1', '2026-06', '{}')
        .run();
    await insert();
    await expect(insert()).rejects.toThrow();
  });

  it('種類が違えば同じ行IDでも別に退避できる', async () => {
    await d1
      .prepare(
        `INSERT INTO import_deleted_rows
           (operation_id,user_id,table_name,row_id,month,payload_json)
         VALUES (?,?,?,?,?,?)`,
      )
      .bind('op-1', 'u1', 'freee_deals', 'tx-1', '2026-06', '{}')
      .run();
    const count = await d1
      .prepare("SELECT COUNT(*) AS n FROM import_deleted_rows WHERE operation_id='op-1'")
      .first<number>('n');
    expect(count).toBe(2);
  });
});

describe('操作の記録', () => {
  it('粒度は4つ以外を受け付けない', async () => {
    await expect(
      d1
        .prepare(
          `INSERT INTO import_deletion_operations
             (id,user_id,kind,granularity,request_json,fingerprint,expires_at)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .bind('op-bad', 'u1', 'delete', 'everything', '{}', 'v1:del:x', '2026-10-01T00:00:00.000Z')
        .run(),
    ).rejects.toThrow();
  });

  it('保持期限を持つ(D04: 期限切れの undo は 410 にできる)', async () => {
    await d1
      .prepare(
        `INSERT INTO import_deletion_operations
           (id,user_id,kind,granularity,request_json,fingerprint,expires_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind('op-ok', 'u1', 'delete', 'import', '{"importId":1}', 'v1:del:x', '2026-10-01T00:00:00.000Z')
      .run();
    expect(
      await d1
        .prepare("SELECT expires_at AS e FROM import_deletion_operations WHERE id='op-ok'")
        .first<string>('e'),
    ).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('手入力を巻き添えにしない構造(DR-6)', () => {
  it('balance_entries に import_id が生えていない', async () => {
    const columns = await columnsOf('balance_entries');
    expect(columns).not.toContain('import_id');
    expect(columns).toContain('source');
  });

  it('cash_entries に import_id が生えていない', async () => {
    expect(await columnsOf('cash_entries')).not.toContain('import_id');
  });
});

describe('tx_edits の拡張', () => {
  it('3点比較の基準値と第二の鍵が揃う', async () => {
    expect(await columnsOf('tx_edits')).toEqual(
      expect.arrayContaining([
        'base_major',
        'base_mid',
        'base_known',
        'base_cls',
        'base_owner',
        'stable_key',
        'fingerprint_version',
        'origin',
        'origin_key',
      ]),
    );
  });

  it('stable_key は重複を許す(同じ日・同じ金額の明細は現実にある)', async () => {
    const insert = (txId: string) =>
      d1
        .prepare('INSERT INTO tx_edits (user_id,tx_id,stable_key,fingerprint_version) VALUES (?,?,?,?)')
        .bind('u1', txId, 'v1:mf:same', 1)
        .run();
    await insert('tx-a');
    await expect(insert('tx-b')).resolves.toBeTruthy();
  });
});

describe('決め事', () => {
  const insertMemory = (userId: string, vendorKey: string) =>
    d1
      .prepare('INSERT INTO vendor_memory (user_id,vendor_key,category_major) VALUES (?,?,?)')
      .bind(userId, vendorKey, '会議費')
      .run();

  it('1利用者1取引先につき1件だけ', async () => {
    await insertMemory('u1', 'カフェ');
    await expect(insertMemory('u1', 'カフェ')).rejects.toThrow();
  });

  it('利用者が違えば別の決め事になる', async () => {
    await expect(insertMemory('u2', 'カフェ')).resolves.toBeTruthy();
  });

  it('件数は負にできない', async () => {
    await expect(
      d1
        .prepare('INSERT INTO vendor_memory (user_id,vendor_key,hit_count) VALUES (?,?,?)')
        .bind('u3', 'マイナス', -1)
        .run(),
    ).rejects.toThrow();
  });

  it('JSON 復元の write-set を変える表として登録されている', () => {
    expect(JSON_SNAPSHOT_MUTATION_CONSUMERS).toContain('vendor_memory');
  });
});
