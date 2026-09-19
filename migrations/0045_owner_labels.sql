-- Migration number: 0043  名義の表示名 (家計収支画面・設定・明細・CSV で共通)
--
-- 名義の内部値 (business / spouse / family / unset) は保存と集計の鍵で、利用者に見せる語ではない。
-- 見せる語だけを利用者ごとに差し替えられるようにする。行が無い名義は core の既定
-- (本人 / パートナー / 子ども / その他) を使うので、初期データは入れない。
--
-- 追加のみ。既存表の行は 1 行も書き換えない。
-- 長さの上限はコードポイント数で core の validateOwnerLabels が先に検査する。
-- SQLite の length() も文字数 (バイト数ではない) を返すので、CHECK は最後の防波堤として同じ上限を置く。
CREATE TABLE IF NOT EXISTS owner_labels (
  user_id    TEXT NOT NULL,
  owner      TEXT NOT NULL CHECK (owner IN ('business', 'spouse', 'family', 'unset')),
  label      TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 20),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, owner)
);
