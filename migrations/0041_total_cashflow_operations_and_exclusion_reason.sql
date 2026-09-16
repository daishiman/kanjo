-- Migration number: 0041  総収支画面の操作履歴と、除外理由の定型化
--
-- ## なぜ操作履歴を表に持つか
--
-- 総収支の集計値は保存しない (dec-aggregation-strategy-001)。保存するのは利用者の判断だけで、
-- 合計は要求のたびに core で導出する。この方針のまま「直前の操作を元に戻す」を成立させるには、
-- 何を判断したかの履歴が要る。集計を戻す必要は無く、判断の行さえ戻せば合計は必ず一致する。
--
-- 行は消さない。取消は対象行の undone_at を埋め、kind='undo' の行を 1 本足す。
-- 消す作りだと「今取り消せるのはどれか」を最新 1 件で決められなくなる
-- (消えた行が最新だったのか、元から無かったのかを区別できない)。
CREATE TABLE IF NOT EXISTS total_cashflow_operations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  -- verdict: 同じ/違うの判断 / exclude: freee から除外 / restore: 除外を戻す / undo: 取消そのもの
  kind       TEXT NOT NULL CHECK (kind IN ('verdict', 'exclude', 'restore', 'undo')),
  -- 操作「前」の値の配列。操作後ではない。後から逆算すると、間に別の操作が入ったときに元へ戻せない
  items_json TEXT NOT NULL,
  -- 一覧で items_json を開かずに件数を出すための写し。0 件の操作は記録しない
  item_count INTEGER NOT NULL CHECK (item_count >= 0),
  -- kind='undo' のとき、どの操作を取り消したか
  undoes_id  TEXT,
  -- この操作が取り消された時刻。空なら未取消
  undone_at  TEXT,
  created_at TEXT NOT NULL
);

-- 「その利用者の最新の操作」を 1 件引くためだけの索引。取消は必ずこの問い合わせから始まる
CREATE INDEX IF NOT EXISTS idx_total_cashflow_operations_user_created
  ON total_cashflow_operations (user_id, created_at DESC);

-- ## 除外理由の定型化
--
-- 0037 の reason は自由文だった。自由文だけだと同じ意味の除外が「振替」「振り替え」
-- 「口座間移動」と散らばり、後から「振替の除外はいくつか」に答えられない。
-- reason は表示用に残したまま、数えられる語を別列で持つ。
--
-- 既存行には 'other' を入れる。中身を推測して振り分けない
-- (推測した分類は、利用者が付けた分類と区別が付かなくなる)。
-- CHECK は追加列自身だけを参照するので ADD COLUMN に付けられる。
-- 既存行の値は NULL で、NULL は CHECK を通過するため、追加時に落ちない。
ALTER TABLE freee_deal_exclusions ADD COLUMN reason_code TEXT
  CHECK (reason_code IN ('transfer', 'internal', 'book_only', 'duplicate', 'other'));
ALTER TABLE freee_deal_exclusions ADD COLUMN memo TEXT
  CHECK (memo IS NULL OR LENGTH(memo) <= 200);

UPDATE freee_deal_exclusions SET reason_code = 'other' WHERE reason_code IS NULL;
