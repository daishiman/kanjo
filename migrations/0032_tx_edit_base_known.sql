-- 4属性のbaseで「未記録」と「記録済みの空」を区別する。
-- cls=1 / category_major=2 / category_mid=4 / owner=8。append-only migration。
ALTER TABLE tx_edits ADD COLUMN base_known INTEGER NOT NULL DEFAULT 0 CHECK (base_known BETWEEN 0 AND 15);

-- 旧行は非nullの値だけを「既知」と安全に推定する。旧NULLは意味を復元できないため未記録のままにする。
UPDATE tx_edits
   SET base_known =
       (CASE WHEN base_cls   IS NOT NULL THEN 1 ELSE 0 END) |
       (CASE WHEN base_major IS NOT NULL THEN 2 ELSE 0 END) |
       (CASE WHEN base_mid   IS NOT NULL THEN 4 ELSE 0 END) |
       (CASE WHEN base_owner IS NOT NULL THEN 8 ELSE 0 END);
