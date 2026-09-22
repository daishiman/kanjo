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
  // 0050: 期間別の年額予算。budgets と同じく JSON 復元の write-set に入る
  'budget_plans',
  'account_norm_map',
  'unrecorded_months',
  'cash_overrides',
  'sub_vendors',
  'sub_vendor_review_decisions',
  'sub_vendor_exclusions',
  'analysis_settings',
  'freee_deals',
  'mf_transactions',
  'restored_monthly_agg',
  // 0030: 取引先ごとの決め事。rules と同じく、変えると復元後の分類結果が変わる
  'vendor_memory',
  // 0040: 概況の保留と月次レビュー。変えると復元後の未処理件数とクローズ状況が変わる
  'review_snoozes',
  'monthly_close_reviews',
  /*
   * 0041: 総収支の判断3表。復元後の合計そのものを動かす。
   *
   * 消し込みの判断 (duplicate_verdicts) と除外 (freee_deal_exclusions) は、
   * 同じ明細から違う総額を導く唯一の入力である。これを write-set の外に置くと、
   * 復元しても「前は合っていた金額」に戻らない。
   * 操作履歴 (total_cashflow_operations) を一緒に戻すのは、判断だけ戻して履歴を残すと
   * 取消ボタンが復元前の操作を指し、二重に戻してしまうため。
   */
  'duplicate_verdicts',
  'freee_deal_exclusions',
  'total_cashflow_operations',
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
