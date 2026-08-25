-- サブスクのベンダー登録を画面から編集できるようにする(これまではコード内の固定8件)。
-- aliases は別名(表記ゆれ)の JSON 配列。取込のたびに消えないよう DB に持つ。
CREATE TABLE sub_vendors (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
-- 既定の8件(HTML版と同じ)を初期登録する
INSERT INTO sub_vendors (user_id, name, sort_order) VALUES
  ('default', 'Anthropic', 1),
  ('default', 'Open AI', 2),
  ('default', 'Cursor', 3),
  ('default', 'note株式会社', 4),
  ('default', 'Twitter', 5),
  ('default', 'Adobe', 6),
  ('default', 'Limitless', 7),
  ('default', 'KandaQuntum', 8);
-- 過去の集計(統合JSON取込など)に残っているベンダーも引き継ぐ
INSERT OR IGNORE INTO sub_vendors (user_id, name, sort_order)
  SELECT DISTINCT user_id, substr(scope, 6), 100 FROM monthly_agg WHERE scope LIKE 'subs:%';
