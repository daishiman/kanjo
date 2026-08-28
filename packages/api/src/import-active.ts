/** JSON restore snapshotをsupersedeするmutationの静的契約。 */
import { and, eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as s from './db/schema.js';

export const JSON_ACTIVE_TARGET = 'json:global';
export const INVALIDATE_JSON_ACTIVE_SQL =
  "DELETE FROM import_active_targets WHERE user_id=? AND target_key='json:global'";

export const JSON_SNAPSHOT_MUTATION_CONSUMERS = [
  'cash_entries',
  'rules',
  'tx_edits',
  'tx_splits',
  'institution_owners',
  'budgets',
  'account_norm_map',
  'unrecorded_months',
  'cash_overrides',
  'sub_vendors',
  'sub_vendor_exclusions',
  'analysis_settings',
  'freee_deals',
  'mf_transactions',
  'restored_monthly_agg',
] as const;

export type JsonSnapshotMutationConsumer = (typeof JSON_SNAPSHOT_MUTATION_CONSUMERS)[number];
type Db = ReturnType<typeof drizzle>;

/** consumer引数を必須にし、復元write-setを変えるmutationを列挙外で接続できなくする。 */
export const invalidateJsonSnapshotQuery = (
  db: Db,
  userId: string,
  _consumer: JsonSnapshotMutationConsumer,
  ..._additionalConsumers: JsonSnapshotMutationConsumer[]
) =>
  db
    .delete(s.importActiveTargets)
    .where(
      and(eq(s.importActiveTargets.userId, userId), eq(s.importActiveTargets.targetKey, JSON_ACTIVE_TARGET)),
    );

export const invalidateJsonSnapshotStatement = (
  database: D1Database,
  userId: string,
  _consumer: JsonSnapshotMutationConsumer,
): D1PreparedStatement => database.prepare(INVALIDATE_JSON_ACTIVE_SQL).bind(userId);
