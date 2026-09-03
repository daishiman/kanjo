/**
 * MF canonical parent の入れ替え後に、添付の親有無を実状態へ収束させる。
 *
 * 取込、明示削除、undo はどれも同じ `mf_transactions` を動かす。
 * 各経路で別の SQL を持たず、canonical mutation の D1 batch 内でこの1文を再利用する。
 */
export function reconcileMfAttachmentParentsStatement(
  database: D1Database,
  userId: string,
  missingAt: string,
): D1PreparedStatement {
  return database
    .prepare(
      `UPDATE attachments
          SET parent_missing_at=CASE
            WHEN EXISTS (
              SELECT 1 FROM mf_transactions m
               WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
            ) THEN NULL ELSE COALESCE(parent_missing_at,?) END
        WHERE user_id=? AND target_kind='mf'
          AND ((parent_missing_at IS NULL AND NOT EXISTS (
                  SELECT 1 FROM mf_transactions m
                   WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
               ))
            OR (parent_missing_at IS NOT NULL AND EXISTS (
                  SELECT 1 FROM mf_transactions m
                   WHERE m.user_id=attachments.user_id AND m.tx_id=attachments.target_key
               )))`,
    )
    .bind(missingAt, userId);
}
