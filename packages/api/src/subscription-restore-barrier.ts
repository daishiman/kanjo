/** 復元と同じ batch で古い統合の undo を遮断する。既存 before_json に境界だけを残す。 */
export function subscriptionRestoreBarrierStatement(
  database: D1Database,
  userId: string,
): D1PreparedStatement {
  return database
    .prepare(
      `UPDATE subscription_operations SET before_json=json_set(before_json,'$.restoreBarrier',1)
     WHERE user_id=? AND kind='merge' AND undone_at IS NULL AND before_json IS NOT NULL`,
    )
    .bind(userId);
}
