-- Migration number: 0021  サブスク候補の除外リスト
-- サブスク候補の一覧から「これはサブスクではない」と記録して以後の候補から外す。
-- 候補は上位20件しか出ないため、除外できないと本当に見たい候補が埋もれる。
-- vendor_key は表記ゆれを吸収した照合キー(core の vendorKey)。取り消しは行の削除。
CREATE TABLE sub_vendor_exclusions (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  partner TEXT NOT NULL,
  vendor_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, vendor_key)
);
