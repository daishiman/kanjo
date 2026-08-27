-- Migration number: 0010  レシート添付と交通費の記帳
-- 目的1: 現金の記帳と取込明細に、レシート・領収書の原本(画像/PDF)を紐づけて残せるようにする。
--        原本は R2 に置き、この表にはメタデータだけを持つ(D1 に画像は入れない)。
-- 目的2: 領収書が構造上出ない交通費(電車代など)を区間で記帳し、「未添付」ではなく
--        「証憑不要」として扱えるようにする。

-- 添付先 ID(target_id)は tx_edits.tx_id と同じ名前空間を使う。
--   現金の記帳 = 'cash:<cash_entries.id>' / 取込明細 = MF の ID 列(tx_id)
-- 手動編集と同じ鍵にそろえることで、再取込しても添付が明細から外れない。
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,          -- 表示用(無害化済み。R2 キーには使わない)
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,           -- バイト数
  content_hash TEXT NOT NULL,      -- 内容の SHA-256(同一明細への同内容の二重添付を防ぐ)
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attachments_target ON attachments(user_id, target_id);
CREATE UNIQUE INDEX uq_attachments_r2key ON attachments(r2_key);
CREATE UNIQUE INDEX uq_attachments_dup ON attachments(user_id, target_id, content_hash);

-- 交通費の区間。transit_from と transit_to は「両方入る」か「両方 NULL」のどちらか。
ALTER TABLE cash_entries ADD COLUMN transit_from TEXT;
ALTER TABLE cash_entries ADD COLUMN transit_to TEXT;
ALTER TABLE cash_entries ADD COLUMN transit_round INTEGER NOT NULL DEFAULT 0;  -- 1 = 往復
-- 1 = 証憑不要(電車代など、そもそも領収書が出ない支出)。未添付の警告対象から外す。
ALTER TABLE cash_entries ADD COLUMN receipt_waived INTEGER NOT NULL DEFAULT 0;
