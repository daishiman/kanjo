-- Migration number: 0013  R2削除完了の永続tombstone
--
-- attachment_deleteのcleanup jobとmetadataを消した後も、古いarchiveが明示削除済みkeyをreadyへ
-- 復活させないための単調fact。upload失敗補償・import retentionには作らず、無期限増加を避ける。
-- R2削除とjob/metadata cleanupの間は既存jobがguardし、最後のD1 batchでtombstoneへ所有権を移す。

CREATE TABLE attachment_object_tombstones (
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, r2_key)
);

CREATE INDEX idx_attachment_object_tombstones_deleted
  ON attachment_object_tombstones(deleted_at);
