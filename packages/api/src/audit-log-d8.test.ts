/** D8 二層監査の schema / privacy / retention / D1 budget 回帰。すべて架空値。 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AUDIT_DETAIL_BUDGET_BYTES,
  AUDIT_DETAIL_RETENTION_DAYS,
  AUDIT_HEADER_RETENTION_DAYS,
  AuditValidationError,
  buildAuditStatements,
  opaqueAuditSourceKey,
  opaqueAuditTransactionKey,
  runAuditDetailRetention,
  runAuditHeaderRetention,
} from './audit-log.js';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(sourceDir, '../../../migrations');
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

beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      name: 'audit-log-d8-test',
      modules: true,
      script: 'export default { fetch() { return new Response("test") } }',
      d1Databases: ['DB'],
    }),
  );
  d1 = (await mf.getD1Database('DB')) as D1Database;
  await applyMigrations(d1);
}, 30_000);

beforeEach(async () => {
  await d1.prepare('DELETE FROM audit_log_detail').run();
  await d1.prepare('DELETE FROM audit_log').run();
  await d1.prepare('DELETE FROM import_deleted_rows').run();
  await d1.prepare('DELETE FROM import_deletion_operations').run();
});

afterAll(async () => {
  await mf?.dispose();
});

const txKey = (value: number): string => `v1:${value.toString(16).padStart(64, '0')}`;

const writeAudit = async ({
  auditId,
  operationId,
  userId = 'user-a',
  occurredAt = '2026-09-02T00:00:00.000Z',
  details = [],
}: {
  auditId: string;
  operationId: string;
  userId?: string;
  occurredAt?: string;
  details?: Array<{
    txKey: string;
    attribute: 'cls' | 'category_major' | 'category_mid' | 'owner';
    before: string | null;
    after: string | null;
    reason: string;
    sourceType: 'default';
  }>;
}) => {
  const plan = buildAuditStatements({
    database: d1,
    auditId,
    operationId,
    userId,
    action: 'import_resolution',
    scope: { kind: 'period', from: '2026-08', to: '2026-08' },
    counts: { changed: details.length, resolved: details.length },
    occurredAt,
    result: 'succeeded',
    details,
  });
  await d1.batch(plan.statements);
  return plan;
};

describe('0033 schemaと保存境界', () => {
  it('ヘッダは1操作1行、detailは1属性1行で保存する', async () => {
    const opaqueTx = await opaqueAuditTransactionKey('user-a', 'operation-one', 'synthetic-transaction-a');
    expect(opaqueTx).not.toContain('synthetic-transaction-a');
    const sourceKey = await opaqueAuditSourceKey('user-a', 'rule', 'synthetic-rule-a');
    const plan = buildAuditStatements({
      database: d1,
      auditId: 'audit-one',
      operationId: 'operation-one',
      userId: 'user-a',
      action: 'import_resolution',
      scope: { kind: 'period', from: '2026-08', to: '2026-08' },
      counts: { resolved: 2, changed: 1 },
      occurredAt: '2026-09-02T00:00:00.000Z',
      result: 'succeeded',
      details: [
        {
          txKey: opaqueTx,
          attribute: 'cls',
          before: 'per',
          after: 'biz',
          reason: 'explicit_resolution',
          sourceType: 'rule',
          sourceKey,
        },
        {
          txKey: opaqueTx,
          attribute: 'owner',
          before: null,
          after: 'business',
          reason: 'explicit_resolution',
          sourceType: 'rule',
          sourceKey,
        },
      ],
    });

    expect(plan).toMatchObject({ headerStatements: 1, detailCount: 2, queryCount: 2 });
    await d1.batch(plan.statements);
    expect(await d1.prepare('SELECT count(*) AS n FROM audit_log').first<number>('n')).toBe(1);
    expect(await d1.prepare('SELECT count(*) AS n FROM audit_log_detail').first<number>('n')).toBe(2);
    const header = await d1
      .prepare('SELECT operation_id,scope,counts_json,result FROM audit_log')
      .first<Record<string, string>>();
    expect(header).toEqual({
      operation_id: 'operation-one',
      scope: 'period:2026-08..2026-08',
      counts_json: '{"changed":1,"resolved":2}',
      result: 'succeeded',
    });
  });

  it('明細本体・金額・無制限payload用の列を持たない', async () => {
    const columns = async (table: string) =>
      (await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()).results.map(
        (row) => row.name,
      );
    const header = await columns('audit_log');
    const detail = await columns('audit_log_detail');
    for (const forbidden of ['amount', 'description', 'memo', 'payload_json', 'request_json']) {
      expect(header).not.toContain(forbidden);
      expect(detail).not.toContain(forbidden);
    }
    expect(detail).toEqual(
      expect.arrayContaining([
        'audit_id',
        'tx_key',
        'attribute',
        'before_value',
        'after_value',
        'reason_code',
        'source_key',
      ]),
    );
  });

  it('生の明細ID、金額件数キー、長さ超過をbuilderで書込み前に拒否する', () => {
    const base = {
      database: d1,
      auditId: 'audit-invalid',
      operationId: 'operation-invalid',
      userId: 'user-a',
      action: 'import_resolution' as const,
      scope: { kind: 'transaction' as const },
      occurredAt: '2026-09-02T00:00:00.000Z',
      result: 'succeeded' as const,
    };
    expect(() =>
      buildAuditStatements({
        ...base,
        counts: { amount: 1000 } as never,
      }),
    ).toThrowError(AuditValidationError);
    expect(() =>
      buildAuditStatements({
        ...base,
        counts: { resolved: 1 },
        details: [
          {
            txKey: 'raw-transaction-id',
            attribute: 'cls',
            before: 'per',
            after: 'biz',
            reason: 'explicit_resolution',
            sourceType: 'default',
          },
        ],
      }),
    ).toThrowError(/tx_key/);
    expect(() =>
      buildAuditStatements({
        ...base,
        counts: { resolved: 1 },
        details: [
          {
            txKey: txKey(1),
            attribute: 'category_major',
            before: null,
            after: '架'.repeat(121),
            reason: 'explicit_resolution',
            sourceType: 'default',
          },
        ],
      }),
    ).toThrowError(/attribute_value/);
  });

  it('DB制約も不正な不透明keyと重複operationを拒否する', async () => {
    await writeAudit({ auditId: 'audit-db-a', operationId: 'operation-db-a' });
    await expect(
      d1
        .prepare(
          `INSERT INTO audit_log
             (id,user_id,operation_id,action,scope,counts_json,occurred_at,result)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          'audit-db-b',
          'user-a',
          'operation-db-a',
          'delete',
          'all',
          '{}',
          '2026-09-02T00:00:00.000Z',
          'succeeded',
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO audit_log
             (id,user_id,operation_id,action,scope,counts_json,occurred_at,result)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          'audit-raw-scope',
          'user-a',
          'operation-raw-scope',
          'delete',
          'transaction:raw-id',
          '{}',
          '2026-09-02T00:00:00.000Z',
          'succeeded',
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO audit_log_detail
             (audit_id,user_id,tx_key,attribute,before_value,after_value,reason_code,source_type,occurred_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          'audit-db-a',
          'user-a',
          'raw-id',
          'cls',
          'per',
          'biz',
          'explicit_resolution',
          'default',
          '2026-09-02T00:00:00.000Z',
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO audit_log_detail
             (audit_id,user_id,tx_key,attribute,before_value,after_value,reason_code,source_type,occurred_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          'audit-db-a',
          'user-a',
          txKey(8),
          'category_major',
          null,
          '架'.repeat(121),
          'explicit_resolution',
          'default',
          '2026-09-02T00:00:00.000Z',
        )
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          `INSERT INTO audit_log
             (id,user_id,operation_id,action,scope,counts_json,occurred_at,result)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          'audit-invalid-result',
          'user-a',
          'operation-invalid-result',
          'delete',
          'all',
          '{}',
          '2026-09-02T00:00:00.000Z',
          'unknown',
        )
        .run(),
    ).rejects.toThrow();
  });

  it('headerとdetailを同じbatchで失敗させるとheaderだけ残らない', async () => {
    const duplicate = {
      txKey: txKey(9),
      attribute: 'cls' as const,
      before: 'per',
      after: 'biz',
      reason: 'explicit_resolution',
      sourceType: 'default' as const,
    };
    const plan = buildAuditStatements({
      database: d1,
      auditId: 'audit-atomic',
      operationId: 'operation-atomic',
      userId: 'user-a',
      action: 'import_resolution',
      scope: { kind: 'import', importId: 7 },
      counts: { resolved: 2 },
      occurredAt: '2026-09-02T00:00:00.000Z',
      result: 'succeeded',
      details: [duplicate, duplicate],
    });
    await expect(d1.batch(plan.statements)).rejects.toThrow();
    expect(
      await d1.prepare("SELECT count(*) AS n FROM audit_log WHERE id='audit-atomic'").first<number>('n'),
    ).toBe(0);
  });
});

describe('利用者分離', () => {
  it('detailのuser_idはheaderの利用者と異なる値にすり替えられない', async () => {
    await writeAudit({ auditId: 'audit-tenant', operationId: 'operation-tenant', userId: 'user-a' });
    await expect(
      d1
        .prepare(
          `INSERT INTO audit_log_detail
             (audit_id,user_id,tx_key,attribute,before_value,after_value,reason_code,source_type,occurred_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          'audit-tenant',
          'user-b',
          txKey(1),
          'cls',
          'per',
          'biz',
          'explicit_resolution',
          'default',
          '2026-09-02T00:00:00.000Z',
        )
        .run(),
    ).rejects.toThrow();
  });

  it('利用者ごとの参照で他利用者のheader/detailが混ざらない', async () => {
    await writeAudit({
      auditId: 'audit-user-a',
      operationId: 'operation-user-a',
      userId: 'user-a',
      details: [
        {
          txKey: txKey(1),
          attribute: 'cls',
          before: 'per',
          after: 'biz',
          reason: 'explicit_resolution',
          sourceType: 'default',
        },
      ],
    });
    await writeAudit({
      auditId: 'audit-user-b',
      operationId: 'operation-user-b',
      userId: 'user-b',
      details: [
        {
          txKey: txKey(2),
          attribute: 'owner',
          before: null,
          after: 'family',
          reason: 'explicit_resolution',
          sourceType: 'default',
        },
      ],
    });
    const rows = await d1
      .prepare(
        `SELECT h.operation_id,d.attribute
           FROM audit_log h LEFT JOIN audit_log_detail d
             ON d.audit_id=h.id AND d.user_id=h.user_id
          WHERE h.user_id=?`,
      )
      .bind('user-a')
      .all<{ operation_id: string; attribute: string }>();
    expect(rows.results).toEqual([{ operation_id: 'operation-user-a', attribute: 'cls' }]);
  });
});

describe('層ごとの保持と容量掃除', () => {
  const now = '2026-09-02T00:00:00.000Z';

  it(`header=${AUDIT_HEADER_RETENTION_DAYS}日、detail=${AUDIT_DETAIL_RETENTION_DAYS}日で別々に掃除する`, async () => {
    await writeAudit({
      auditId: 'audit-very-old',
      operationId: 'operation-very-old',
      occurredAt: '2025-07-01T00:00:00.000Z',
      details: [
        {
          txKey: txKey(1),
          attribute: 'cls',
          before: 'per',
          after: 'biz',
          reason: 'explicit_resolution',
          sourceType: 'default',
        },
      ],
    });
    await writeAudit({
      auditId: 'audit-detail-old',
      operationId: 'operation-detail-old',
      occurredAt: '2026-05-01T00:00:00.000Z',
      details: [
        {
          txKey: txKey(2),
          attribute: 'owner',
          before: null,
          after: 'business',
          reason: 'explicit_resolution',
          sourceType: 'default',
        },
      ],
    });
    await writeAudit({
      auditId: 'audit-current',
      operationId: 'operation-current',
      occurredAt: '2026-08-20T00:00:00.000Z',
      details: [
        {
          txKey: txKey(3),
          attribute: 'category_major',
          before: null,
          after: '架空費',
          reason: 'explicit_resolution',
          sourceType: 'default',
        },
      ],
    });

    const detail = await runAuditDetailRetention({ DB: d1 }, now);
    expect(detail).toMatchObject({ layer: 'detail', expired: 2, early: 0 });
    expect(detail.queries).toBeLessThan(49);
    expect(await d1.prepare('SELECT count(*) AS n FROM audit_log').first<number>('n')).toBe(3);

    const header = await runAuditHeaderRetention({ DB: d1 }, now);
    expect(header).toMatchObject({ layer: 'header', expired: 1, early: 0 });
    expect(header.queries).toBeLessThan(49);
    expect(await d1.prepare('SELECT count(*) AS n FROM audit_log').first<number>('n')).toBe(2);
    expect(await d1.prepare('SELECT count(*) AS n FROM audit_log_detail').first<number>('n')).toBe(1);
  });

  it(`detailは${AUDIT_DETAIL_BUDGET_BYTES}バイトと同じ境界でも古い順に有界掃除する`, async () => {
    for (let index = 0; index < 3; index += 1) {
      await writeAudit({
        auditId: `audit-capacity-${index}`,
        operationId: `operation-capacity-${index}`,
        occurredAt: `2026-08-${String(20 + index).padStart(2, '0')}T00:00:00.000Z`,
        details: [
          {
            txKey: txKey(index + 1),
            attribute: 'category_major',
            before: null,
            after: '架'.repeat(120),
            reason: 'explicit_resolution',
            sourceType: 'default',
          },
        ],
      });
    }
    const baseline = await runAuditDetailRetention({ DB: d1 }, now, 80, Number.MAX_SAFE_INTEGER);
    const capacity = await runAuditDetailRetention({ DB: d1 }, now, 80, baseline.after.bytes);
    expect(capacity.expired).toBe(0);
    expect(capacity.early).toBe(1);
    expect(capacity.after.bytes).toBeLessThan(baseline.after.bytes);
    expect(capacity.queries).toBeLessThan(49);
    const remaining = await d1
      .prepare('SELECT audit_id FROM audit_log_detail ORDER BY occurred_at,id')
      .all<{ audit_id: string }>();
    expect(remaining.results.map((row) => row.audit_id)).toEqual(['audit-capacity-1', 'audit-capacity-2']);
  });

  it('監査detail掃除はundo tombstoneを触らない', async () => {
    await d1
      .prepare(
        `INSERT INTO import_deletion_operations
           (id,user_id,kind,granularity,request_json,fingerprint,counts_json,expires_at,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        'deletion-operation',
        'user-a',
        'delete',
        'all',
        '{}',
        'v1:synthetic',
        '{}',
        '2026-01-01T00:00:00.000Z',
        '2025-01-01T00:00:00.000Z',
      )
      .run();
    await d1
      .prepare(
        `INSERT INTO import_deleted_rows
           (operation_id,user_id,table_name,row_id,month,payload_json,created_at)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(
        'deletion-operation',
        'user-a',
        'mf_transactions',
        'synthetic-row',
        '2025-01',
        '{}',
        '2025-01-01T00:00:00.000Z',
      )
      .run();
    await runAuditDetailRetention({ DB: d1 }, now);
    expect(await d1.prepare('SELECT count(*) AS n FROM import_deleted_rows').first<number>('n')).toBe(1);
  });
});

describe('D1 query budgetとscheduled配線', () => {
  it('明細500属性も行ごとではなくまとめ書き文にする', () => {
    const details = Array.from({ length: 500 }, (_, index) => ({
      txKey: txKey(index + 1),
      attribute: 'cls' as const,
      before: 'per',
      after: 'biz',
      reason: 'explicit_resolution',
      sourceType: 'default' as const,
    }));
    const plan = buildAuditStatements({
      database: d1,
      auditId: 'audit-budget',
      operationId: 'operation-budget',
      userId: 'user-a',
      action: 'import_resolution',
      scope: { kind: 'import', importId: 1 },
      counts: { resolved: details.length },
      occurredAt: '2026-09-02T00:00:00.000Z',
      result: 'succeeded',
      details,
    });
    expect(plan.detailStatements).toBeLessThan(details.length);
    expect(plan.queryCount).toBeLessThan(49);
  });

  it('header/detail/undo掃除は別々のjobと観測結果に配線する', () => {
    const index = readFileSync(resolve(sourceDir, 'index.ts'), 'utf8');
    expect(index).toContain('runAuditHeaderRetention(env)');
    expect(index).toContain('runAuditDetailRetention(env)');
    expect(index).toContain('runDeletionRetention(env)');
    expect(index).toContain("job: 'audit_header_retention'");
    expect(index).toContain("job: 'audit_detail_retention'");
    expect(index).toContain("job: 'deletion_undo_retention'");
    expect(index).toContain('metadata: deletionRetention.value.metadata');
  });
});
