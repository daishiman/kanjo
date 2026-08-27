-- Migration number: 0012  添付原本の単調fact・orphan・durable cleanup ledger
--
-- stateは後方互換の操作状態として残すが、原本の物理削除済みは
-- object_deleted_at、MF親不在はparent_missing_atを正本にする。

ALTER TABLE attachments ADD COLUMN object_deleted_at TEXT;
ALTER TABLE attachments ADD COLUMN parent_missing_at TEXT;
ALTER TABLE attachments ADD COLUMN cleanup_dead_letter_at TEXT;

CREATE INDEX idx_attachments_owner_available
  ON attachments(user_id, object_deleted_at, target_kind, target_key);
CREATE INDEX idx_attachments_orphans
  ON attachments(user_id, parent_missing_at, object_deleted_at);

-- R2とD1の非原子的な境界を時間軸へ引き継ぐoutbox。
-- upload_intentはR2 PUT前に作成し、添付metadata確定と同じD1 batchで閉じる。
-- attachment_delete/import_retentionも同じbounded reconcilerが処理する。
CREATE TABLE attachment_cleanup_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  attachment_id INTEGER REFERENCES attachments(id) ON DELETE CASCADE,
  import_id INTEGER,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0 CHECK (size >= 0),
  action TEXT NOT NULL CHECK (action IN ('delete_object', 'delete_metadata')),
  reason TEXT NOT NULL CHECK (reason IN ('upload_intent', 'attachment_delete', 'import_retention')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'retry', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  not_before TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, r2_key)
);

CREATE INDEX idx_attachment_cleanup_due
  ON attachment_cleanup_jobs(state, not_before, id);
CREATE INDEX idx_attachment_cleanup_attachment
  ON attachment_cleanup_jobs(user_id, attachment_id);
