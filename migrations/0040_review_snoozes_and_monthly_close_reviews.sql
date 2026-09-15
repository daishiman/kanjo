-- Migration number: 0040  概況の「後で確認」と月次レビューの記録
--
-- 未処理キューそのものは明細・照合・取込履歴から毎回計算する派生物で、表には持たない。
-- 表に残すのは利用者の判断だけ: 「この明細は後で確認する」と「この月はレビューした」。
--
-- 保留は指紋 (金額・日付・内容の SHA-256) が一致する間だけ効く。明細が直されたら自動で解ける。
-- 明細本文の写しは持たない。CHECK で 64 桁に固定し、平文が紛れ込む書込を DB でも拒む。
CREATE TABLE IF NOT EXISTS review_snoozes (
  user_id     TEXT NOT NULL,
  item_kind   TEXT NOT NULL CHECK (item_kind IN ('classification', 'reconciliation', 'import')),
  item_key    TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  snoozed_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, item_kind, item_key)
);

-- 月次レビューは月ごとに 1 行。再実行しても初回の reviewed_at を保つ (冪等)。
CREATE TABLE IF NOT EXISTS monthly_close_reviews (
  user_id             TEXT NOT NULL,
  month               TEXT NOT NULL
    CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(month, 6, 2) BETWEEN '01' AND '12'),
  reviewed_at         TEXT NOT NULL,
  reviewed_by_user_id TEXT NOT NULL,
  PRIMARY KEY (user_id, month)
);
