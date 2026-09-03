-- Migration number: 0031  手当ての適用由来
--
-- NULL/既存行と manual は利用者の手動編集。vendor_memory だけが
-- 取引先の決め事から自動適用した行である。値の一致から由来を推測しない。
ALTER TABLE tx_edits ADD COLUMN origin TEXT
  CHECK (origin IS NULL OR origin IN ('manual', 'vendor_memory'));
ALTER TABLE tx_edits ADD COLUMN origin_key TEXT;

CREATE INDEX idx_tx_edits_origin
  ON tx_edits (user_id, origin, origin_key)
  WHERE origin = 'vendor_memory';
