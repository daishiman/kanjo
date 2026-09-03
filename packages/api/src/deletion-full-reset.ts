/**
 * 全件初期化だけが触る、複合キー/legacyテーブルの明示adapter。
 *
 * 通常の明細3テーブルは単一identity列で扱えるが、restored_monthly_aggは
 * (user_id, month, scope)の複合キー、overridesは読み取り停止済みの旧テーブル。
 * その差を汎用DELETION_TABLESへ押し込まず、退避・削除・復元をここで対にする。
 */
import type { DeletionRequest } from '@kanjo/core';
import { insertJsonRows } from './import-lifecycle.js';

export const FULL_RESET_TABLES = ['restored_monthly_agg', 'overrides'] as const;
export type FullResetTable = (typeof FULL_RESET_TABLES)[number];

export interface FullResetTombstoneRow {
  table: FullResetTable;
  rowId: string;
  month: string | null;
  payload: string;
}

interface StoredTombstoneRow {
  table_name: string;
  month: string | null;
  payload_json: string;
}

interface RestoredMonthlyAggRow {
  month: string;
  scope: string;
  amount: number;
}

interface LegacyOverrideRow {
  tx_id: string;
  cls: 'biz' | 'per';
  updated_at: string | null;
}

/** kindsで絞ったallは部分削除。global baseline/legacy手当てを消すのは真の全件初期化だけ。 */
export const isFullReset = (request: DeletionRequest): boolean =>
  request.granularity === 'all' && (!request.kinds || request.kinds.length === 0);

/** 全件初期化の直前状態を、undo共通のtombstone形へ写す。 */
export async function readFullResetTombstones(
  database: D1Database,
  userId: string,
): Promise<FullResetTombstoneRow[]> {
  const [baseline, legacyOverrides] = await Promise.all([
    database
      .prepare('SELECT month,scope,amount FROM restored_monthly_agg WHERE user_id=?')
      .bind(userId)
      .all<RestoredMonthlyAggRow>(),
    database
      .prepare('SELECT tx_id,cls,updated_at FROM overrides WHERE user_id=?')
      .bind(userId)
      .all<LegacyOverrideRow>(),
  ]);

  return [
    ...baseline.results.map((row) => ({
      table: 'restored_monthly_agg' as const,
      rowId: JSON.stringify([row.month, row.scope]),
      month: row.month,
      payload: JSON.stringify(row),
    })),
    ...legacyOverrides.results.map((row) => ({
      table: 'overrides' as const,
      rowId: row.tx_id,
      month: null,
      payload: JSON.stringify(row),
    })),
  ];
}

/** 退避と同じD1 batchへ入れる、利用者単位の全件初期化statement。 */
export function fullResetDeleteStatements(database: D1Database, userId: string): D1PreparedStatement[] {
  return [
    database.prepare('DELETE FROM restored_monthly_agg WHERE user_id=?').bind(userId),
    database.prepare('DELETE FROM overrides WHERE user_id=?').bind(userId),
  ];
}

const parsedObject = (payload: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(payload);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('invalid_deletion_tombstone');
  return parsed as Record<string, unknown>;
};

const requiredString = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new Error('invalid_deletion_tombstone');
  return value;
};

const restoredMonthlyAggValues = (row: StoredTombstoneRow): unknown[] => {
  const payload = parsedObject(row.payload_json);
  const amount = payload.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('invalid_deletion_tombstone');
  return [requiredString(payload, 'month'), requiredString(payload, 'scope'), amount];
};

const legacyOverrideValues = (row: StoredTombstoneRow): unknown[] => {
  const payload = parsedObject(row.payload_json);
  const cls = requiredString(payload, 'cls');
  if (cls !== 'biz' && cls !== 'per') throw new Error('invalid_deletion_tombstone');
  const updatedAt = payload.updated_at;
  if (updatedAt !== null && typeof updatedAt !== 'string') throw new Error('invalid_deletion_tombstone');
  return [requiredString(payload, 'tx_id'), cls, updatedAt];
};

export interface FullResetRestorePlan {
  statements: D1PreparedStatement[];
  restored: Record<FullResetTable, number>;
  months: string[];
}

/** 複合キー/legacy payloadを各table固有codecで検証し、同じ利用者へ戻す。 */
export function fullResetRestoreStatements(
  database: D1Database,
  userId: string,
  tombstones: readonly StoredTombstoneRow[],
): FullResetRestorePlan {
  const baseline = tombstones.filter((row) => row.table_name === 'restored_monthly_agg');
  const legacyOverrides = tombstones.filter((row) => row.table_name === 'overrides');
  return {
    statements: [
      ...insertJsonRows(
        database,
        'restored_monthly_agg',
        ['month', 'scope', 'amount'],
        baseline.map(restoredMonthlyAggValues),
        [{ column: 'user_id', value: userId }],
      ),
      ...insertJsonRows(
        database,
        'overrides',
        ['tx_id', 'cls', 'updated_at'],
        legacyOverrides.map(legacyOverrideValues),
        [{ column: 'user_id', value: userId }],
      ),
    ],
    restored: {
      restored_monthly_agg: baseline.length,
      overrides: legacyOverrides.length,
    },
    months: [...new Set(baseline.map((row) => row.month).filter((month): month is string => !!month))].sort(),
  };
}
