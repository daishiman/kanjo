import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthEnv } from './auth.js';
import worker, { scheduledMaintenance } from './index.js';
import { IMPROVEMENT_ORPHAN_CHECKPOINT_KEY } from './routes/improvement.js';
import {
  SCHEDULED_ATTACHMENT_JOB_LIMIT,
  SCHEDULED_D1_QUERY_ACCEPTED_MAX,
  SCHEDULED_D1_QUERY_LIMIT,
  SCHEDULED_D1_QUERY_PLAN_MAX,
  SCHEDULED_MAINTENANCE_D1_PLAN,
  SCHEDULED_MAINTENANCE_JOB_NAMES,
  ScheduledMaintenanceBudgetError,
  planScheduledMaintenanceD1Queries,
} from './scheduled-maintenance-budget.js';

const normalize = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

type CountedDatabase = D1Database & { actual: () => number; events: () => readonly string[] };

/**
 * 7 jobすべてをworst branchへ通すcounting fake。prepare回数ではなく、実行methodを1、
 * batchは渡されたstatement数として数える。
 */
function worstPathDatabase(
  events: string[] = [],
  rejectSql: (query: string) => boolean = () => false,
): CountedDatabase {
  let actual = 0;
  const sqlByStatement = new WeakMap<object, string>();

  const result = (changes = 0, rows: unknown[] = []): D1Result<unknown> => ({
    success: true,
    results: rows,
    meta: {
      changes,
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
    },
  });

  const allRows = (sql: string): unknown[] => {
    const query = normalize(sql);
    if (query.includes('from attachment_cleanup_jobs') && query.includes("state in ('pending','retry')"))
      return Array.from({ length: SCHEDULED_ATTACHMENT_JOB_LIMIT }, (_, index) => ({
        id: index + 1,
        user_id: 'synthetic-user',
        attachment_id: index + 1,
        import_id: null,
        r2_key: `attachments/synthetic/${index + 1}`,
        action: 'delete_object',
        reason: 'attachment_delete',
        attempts: 0,
        created_at: '2026-09-03T00:00:00.000Z',
      }));
    if (query.includes('select id,screenshot_key from improvement_requests'))
      return Array.from({ length: 500 }, (_, index) => ({
        id: `improvement-${index + 1}`,
        screenshot_key: `improvements/synthetic/${index + 1}.jpg`,
      }));
    if (query.includes('select screenshot_key from improvement_requests'))
      return [{ screenshot_key: 'improvements/synthetic/live.jpg' }];
    if (query.includes('from import_deletion_operations o') && query.includes('expires_at <='))
      return [{ id: 'expired-operation' }];
    if (query.includes('from import_deletion_operations o') && query.includes('expires_at >'))
      return [{ id: 'living-operation', bytes: 400 * 1024 * 1024 }];
    if (query.includes('from audit_log_detail') && query.includes(' as bytes'))
      return [{ id: 1, bytes: 400 * 1024 * 1024 }];
    return [];
  };

  const firstRow = (sql: string): Record<string, number> => {
    const query = normalize(sql);
    if (query.includes('sum(length(payload_json))')) return { n: 600 * 1024 * 1024 };
    if (query.includes('from audit_log_detail')) return { rows: 1, bytes: 300 * 1024 * 1024 };
    if (query.includes('from audit_log')) return { rows: 1, bytes: 1024 };
    return {};
  };

  const makeStatement = (sql: string): D1PreparedStatement => {
    const execute = (backupAware = false): void => {
      actual += 1;
      events.push(
        backupAware && normalize(sql).includes('from restored_monthly_agg') ? 'd1:backup' : 'd1:maintenance',
      );
      if (rejectSql(normalize(sql))) throw new Error('synthetic private failure message');
    };
    const statement = {
      bind: (..._values: unknown[]) => makeStatement(sql),
      all: async () => {
        execute(true);
        return result(0, allRows(sql));
      },
      first: async (column?: string) => {
        execute();
        const row = firstRow(sql);
        return column ? (row[column] ?? null) : row;
      },
      run: async () => {
        execute();
        const query = normalize(sql);
        return result(query.startsWith('update improvement_requests') ? 500 : 1);
      },
      raw: async () => {
        execute();
        return [[]];
      },
    } as D1PreparedStatement;
    sqlByStatement.set(statement, sql);
    return statement;
  };

  const database = {
    prepare: (sql: string) => makeStatement(sql),
    batch: async (statements: D1PreparedStatement[]) => {
      actual += statements.length;
      events.push(...statements.map(() => 'd1:maintenance'));
      const sql = statements.map((statement) => normalize(sqlByStatement.get(statement) ?? ''));
      if (sql.some((query) => query.includes('insert into attachment_object_tombstones')))
        throw new Error('synthetic attachment metadata batch failure');
      return statements.map((statement) => {
        const query = normalize(sqlByStatement.get(statement) ?? '');
        return result(1, query.startsWith('select count(*) as n') ? [{ n: 1 }] : []);
      });
    },
  } as D1Database;
  return Object.assign(database, { actual: () => actual, events: () => events });
}

function fakeFiles(events: string[]): R2Bucket {
  const put: R2Bucket['put'] = async (key) => {
    if (key.startsWith('backups/')) events.push('r2:backup');
    const object: Partial<R2Object> = {
      key,
      version: 'synthetic',
      size: 0,
      etag: 'synthetic',
      httpEtag: '"synthetic"',
      uploaded: new Date(0),
      storageClass: 'Standard',
      writeHttpMetadata: () => undefined,
    };
    return object as R2Object;
  };
  const files: Partial<R2Bucket> = {
    put,
    delete: async () => undefined,
    get: async () => null,
    head: async () => null,
    list: async (options) =>
      ({
        objects:
          options?.prefix === 'improvements/'
            ? [
                {
                  key: 'improvements/synthetic/live.jpg',
                  uploaded: new Date(0),
                } as R2Object,
              ]
            : [],
        truncated: options?.prefix === 'improvements/',
        ...(options?.prefix === 'improvements/' ? { cursor: 'synthetic-private-cursor' } : {}),
        delimitedPrefixes: [],
      }) as R2Objects,
  };
  return files as R2Bucket;
}

afterEach(() => vi.restoreAllMocks());

describe('scheduled maintenance D1 plan', () => {
  it('7 jobを一度ずつ合成し、Free上限50に4本の余白を残す', () => {
    expect(Object.keys(SCHEDULED_MAINTENANCE_D1_PLAN.jobs)).toEqual([...SCHEDULED_MAINTENANCE_JOB_NAMES]);
    expect(SCHEDULED_MAINTENANCE_D1_PLAN.jobs).toEqual({
      nightly_backup: 1,
      attachment_maintenance: 20,
      password_login_rate_limit_cleanup: 1,
      improvement_retention: 3,
      deletion_undo_retention: 12,
      audit_header_retention: 3,
      audit_detail_retention: 6,
    });
    expect(SCHEDULED_MAINTENANCE_D1_PLAN.total).toBe(SCHEDULED_D1_QUERY_PLAN_MAX);
    expect(SCHEDULED_MAINTENANCE_D1_PLAN.total).toBeLessThanOrEqual(SCHEDULED_D1_QUERY_ACCEPTED_MAX);
    expect(SCHEDULED_D1_QUERY_LIMIT).toBe(50);
  });

  it('宣言漏れ・未知job・50到達をすべて拒否する', () => {
    const complete = { ...SCHEDULED_MAINTENANCE_D1_PLAN.jobs };
    const { audit_detail_retention: _missing, ...missing } = complete;
    expect(() => planScheduledMaintenanceD1Queries(missing)).toThrow(ScheduledMaintenanceBudgetError);
    expect(() => planScheduledMaintenanceD1Queries({ ...complete, unknown_job: 1 })).toThrow(
      ScheduledMaintenanceBudgetError,
    );
    expect(() => planScheduledMaintenanceD1Queries({ ...complete, attachment_maintenance: 24 })).toThrow(
      ScheduledMaintenanceBudgetError,
    );
  });

  it('backupを先に確定後、500件・attachment batch失敗・両undo sweep・audit容量経路でもactual=planned=46', async () => {
    const chronology: string[] = [];
    const database = worstPathDatabase(chronology);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await scheduledMaintenance({ DB: database, FILES: fakeFiles(chronology) });

    expect(database.actual()).toBe(SCHEDULED_MAINTENANCE_D1_PLAN.total);
    expect(database.actual()).toBeLessThan(SCHEDULED_D1_QUERY_LIMIT);
    expect(database.events().slice(0, 3)).toEqual(['d1:backup', 'r2:backup', 'd1:maintenance']);
    const records = log.mock.calls.map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>);
    expect(records.find((entry) => entry.job === 'scheduled_maintenance_budget')).toEqual({
      level: 'info',
      job: 'scheduled_maintenance_budget',
      plannedQueries: 46,
      limit: 50,
    });
    expect(JSON.stringify(records)).not.toContain('attachments/synthetic');
    expect(JSON.stringify(records)).not.toContain('improvements/synthetic');
    expect(JSON.stringify(records)).not.toContain('synthetic-private-cursor');
    expect(JSON.stringify(records)).not.toContain(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY);
    expect(JSON.stringify(records)).not.toContain('synthetic-user');
  });

  it('非主要jobのrejectも全job記録後にctx.waitUntilへgeneric failureとして伝播する', async () => {
    const database = worstPathDatabase([], (query) => query.endsWith('from audit_log'));
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let pending: Promise<unknown> | undefined;
    const context: Partial<ExecutionContext> = {
      waitUntil: (promise) => {
        pending = promise;
      },
    };

    await worker.scheduled(
      {} as ScheduledController,
      { DB: database, FILES: fakeFiles([]) } as unknown as AuthEnv,
      context as ExecutionContext,
    );
    expect(pending).toBeDefined();
    await expect(pending).rejects.toThrow('scheduled_maintenance_failed');

    const records = [...info.mock.calls, ...error.mock.calls].map(
      ([entry]) => JSON.parse(String(entry)) as Record<string, unknown>,
    );
    for (const job of SCHEDULED_MAINTENANCE_JOB_NAMES)
      expect(records.some((record) => record.job === job)).toBe(true);
    expect(records.find((record) => record.job === 'audit_header_retention')).toEqual({
      level: 'error',
      job: 'audit_header_retention',
      name: 'Error',
    });
    expect(JSON.stringify(records)).not.toContain('synthetic private failure message');
    expect(JSON.stringify(records)).not.toContain('synthetic-private-cursor');
    expect(JSON.stringify(records)).not.toContain(IMPROVEMENT_ORPHAN_CHECKPOINT_KEY);
    expect(JSON.stringify(records)).not.toContain('improvements/synthetic');
    expect(JSON.stringify(records)).not.toContain('synthetic-user');
  });
});
