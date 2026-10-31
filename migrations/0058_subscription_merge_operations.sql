-- Migration number: 0058  サブスクの統合・取り消し・操作の記録と、利用者ごとの版番号
--
-- 仕様の正本は specs/spec-subscriptions-merge.md「データモデル」。
--
-- 統合は sub_vendors の行を消さずに、統合元の merged_into_id を統合先の id へ向けるだけにする。
-- 取り消しは merged_into_id を NULL に戻し、統合先の別名・対象科目を操作の記録 (before_json) から戻す。
--
-- subscription_operations はサブスクの書込み 1 回ぶんの記録。
--   UNIQUE (user_id, actor_user_id, idempotency_key) : 同じ操作者の同じ key の再送を 1 回に畳む
--   UNIQUE (user_id, base_revision)                  : 同じ版を土台にした書込みは 1 件しか勝てない
-- payload_json と before_json は 30 日で NULL にし、行は 400 日で消す (書込みの batch が 50 件ずつ掃除する)。
-- 外部キーは付けない。統合先を削除しても、操作の記録は保持期間まで残す。
--
-- subscription_revisions は利用者ごとの版番号。行が無ければ 0 として扱う。
--
-- 既存の行は書き換えず、backfill もしない (破壊的な変更は 0 件)。
-- 旧実装へ戻しても、列と表は残るが参照されない。
-- 禁止事項 (0029 から続く): 2 表を packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL の列挙対象へ追加しない。
ALTER TABLE sub_vendors ADD COLUMN merged_into_id INTEGER;

CREATE TABLE subscription_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'merge',
      'unmerge',
      'vendor_create',
      'vendor_update',
      'vendor_delete',
      'review',
      'review_decision',
      'exclusion'
    )
  ),
  target_vendor_id INTEGER,
  payload_json TEXT,
  before_json TEXT,
  base_revision INTEGER NOT NULL,
  undoes_id TEXT,
  undone_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, actor_user_id, idempotency_key),
  UNIQUE (user_id, base_revision)
);

CREATE INDEX idx_subscription_operations_user_created
  ON subscription_operations (user_id, created_at);

CREATE TABLE subscription_revisions (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
