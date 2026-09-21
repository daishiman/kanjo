-- Migration number: 0046  明細仕分けの作業台 (保存フィルタ・変更履歴・ルール拡張・支払方法/提案一致)
--
-- 追加のみ。既存表の行は 1 行も書き換えない (AT-20)。ALTER TABLE ADD COLUMN は
-- 既存行へ NULL か DEFAULT を入れるだけで、行の書き換えを伴わない。
--
-- saved_filters: 絞り込み条件に名前を付けて残す。条件そのものは JSON で持つ。
--   条件の項目は画面の都合で増減するので、列に割らない。上限 2000 字は
--   「画面が作れる最大の条件」より十分大きく、壊れた値の際限ない保存は防ぐ。
CREATE TABLE IF NOT EXISTS saved_filters (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  query_json TEXT NOT NULL CHECK (length(query_json) BETWEEN 2 AND 2000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, name)
);

-- tx_history: 明細1件の変更をあとから辿る。変わった項目ごとに 1 行、同じ要求は同じ op_id。
--   before/after を文字列で持つのは、項目ごとに型が違う値を 1 つの表に収めるため。
--   意味付け (どう表示するか) は field を見て画面側が決める。
CREATE TABLE IF NOT EXISTS tx_history (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  tx_id        TEXT NOT NULL,
  changed_at   TEXT NOT NULL,
  field        TEXT NOT NULL CHECK (field IN ('cls', 'category', 'owner', 'payment_method', 'note', 'split', 'deleted')),
  before_value TEXT,
  after_value  TEXT,
  source       TEXT NOT NULL CHECK (source IN ('auto', 'manual', 'rule', 'bulk', 'split', 'delete', 'undo')),
  confidence   INTEGER CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  op_id        TEXT NOT NULL
);

-- 履歴は「この明細の新しい順に 20 件」しか引かない。索引の並びをその読み方に合わせる。
CREATE INDEX IF NOT EXISTS idx_tx_history_user_tx_changed ON tx_history (user_id, tx_id, changed_at);

-- rules 拡張: 取引先での絞り込み、適用範囲、分割の型。
--   payee は正規化済みの取引先キー。キーワード一致に重ねると提案の信頼度が上がる。
--   scope の既定 'all' は、この migration より前に作られたルールの現在の挙動と同じ。
ALTER TABLE rules ADD COLUMN payee TEXT;
ALTER TABLE rules ADD COLUMN scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'unconfirmed'));
ALTER TABLE rules ADD COLUMN split_template_json TEXT;

-- tx_edits 拡張: 支払方法の手動上書きと、保存時に提案と一致していたかの印。
--   'unknown' を上書きの値に許さないのは、それが判定できなかったという導出結果であって
--   利用者が選べる答えではないため。matched_proposal が NULL の既存行は
--   「一致していたか分からない」= 手動変更として扱う (BR-01)。
ALTER TABLE tx_edits ADD COLUMN payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'account'));
ALTER TABLE tx_edits ADD COLUMN matched_proposal INTEGER CHECK (matched_proposal IS NULL OR matched_proposal IN (0, 1));
