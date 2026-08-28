-- Migration number: 0026  月次の残高(貸借対照表)
--
-- PLやCFは取引を足せば出るが、BSは足し算では出ない。
-- 「10万円使った」を何回足しても、いま口座にいくらあるかは分からない。
-- 残高そのものを外から入れるしかないので、この表を置く。
--
-- 入り口は2つある。
--   資産 … MFの資産推移CSV(https://moneyforward.com/bs/history)を取り込む
--   負債 … 画面で手入力する(CSVに負債の列が無いため)
-- source 列はその区別のためにある。取込は source='mf' の行しか消さない。
-- これが無いと、CSVを入れ直すたびに手入力した負債が消える。
--
-- 1つの月・側・種類につき行は1本だけ。取込は INSERT ではなく upsert になる。
-- 制約にしておかないと、同じCSVを2回入れたときに資産が倍に見える。
CREATE TABLE IF NOT EXISTS balance_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL,
  -- 'YYYY-MM'
  month      TEXT    NOT NULL,
  -- その月で採用した日付 'YYYY-MM-DD'。月末とは限らない。
  -- 直近1ヶ月のCSVは日次で出るので、月内でいちばん新しい日付が入る
  date       TEXT    NOT NULL,
  -- 'asset' | 'liability'
  side       TEXT    NOT NULL,
  -- 「預金・現金」「クレジットカード未払金」など
  category   TEXT    NOT NULL,
  amount     INTEGER NOT NULL,
  -- 'mf'(CSV取込) | 'manual'(手入力)
  source     TEXT    NOT NULL,
  created_at TEXT,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_entries
  ON balance_entries (user_id, month, side, category);
CREATE INDEX IF NOT EXISTS idx_balance_entries_month
  ON balance_entries (user_id, month);

-- 取込履歴の kind に 'assets' を足す。
-- 0000 が CHECK(kind IN ('freee','mf','json')) を持っており、
-- SQLite は CHECK を後から外せないので、0004 と同じくテーブルを作り直す。
--
-- mf_transactions.import_id と freee_deals.import_id が imports(id) を参照しているので、
-- 素の DROP TABLE は外部キー制約で弾かれる(FOREIGN KEY constraint failed)。
-- 参照している行が1つも無い環境では通ってしまい、取込を済ませた本番でだけ落ちる。
--
-- D1 では外部キーを切れない。PRAGMA foreign_keys=OFF は黙って無視され、
-- defer_foreign_keys も文をまたいでは効かない(DROP の文だけで検査が走る)。
-- そこで、検査の側を止める代わりに、参照している側を一時的に外す。
-- import_id は NULL を許すので、NULL の間は検査の対象にならない。
--
-- 元の値は退避表に控え、作り直しが済んだら書き戻す。この移行全体は1つの
-- トランザクションなので、途中で落ちれば import_id が欠けたままにはならない。
CREATE TABLE imports_fk_backup (
  table_name TEXT NOT NULL,
  row_id     INTEGER NOT NULL,
  import_id  INTEGER NOT NULL
);

INSERT INTO imports_fk_backup (table_name, row_id, import_id)
SELECT 'mf_transactions', id, import_id FROM mf_transactions WHERE import_id IS NOT NULL;
INSERT INTO imports_fk_backup (table_name, row_id, import_id)
SELECT 'freee_deals', id, import_id FROM freee_deals WHERE import_id IS NOT NULL;

UPDATE mf_transactions SET import_id = NULL WHERE import_id IS NOT NULL;
UPDATE freee_deals SET import_id = NULL WHERE import_id IS NOT NULL;

CREATE TABLE imports_new (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT,
  kind TEXT CHECK(kind IN ('freee','mf','json','assets')),
  months TEXT,
  row_count INTEGER,
  status TEXT,
  r2_key TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  content_hash TEXT,
  duplicate_of INTEGER,
  run_id TEXT,
  target_keys TEXT,
  failure_reason TEXT,
  fingerprint_version INTEGER,
  committed_at TEXT
);

INSERT INTO imports_new (
  id, user_id, filename, kind, months, row_count, status, r2_key, created_at,
  content_hash, duplicate_of, run_id, target_keys, failure_reason, fingerprint_version, committed_at
)
SELECT
  id, user_id, filename, kind, months, row_count, status, r2_key, created_at,
  content_hash, duplicate_of, run_id, target_keys, failure_reason, fingerprint_version, committed_at
FROM imports;

DROP TABLE imports;
ALTER TABLE imports_new RENAME TO imports;

CREATE INDEX IF NOT EXISTS idx_imports_hash ON imports(user_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_imports_run ON imports(run_id, id);

-- 外した参照を戻す。この時点で imports は同じ id を持っているので、検査に通る。
UPDATE mf_transactions
SET import_id = (
  SELECT b.import_id FROM imports_fk_backup b
  WHERE b.table_name = 'mf_transactions' AND b.row_id = mf_transactions.id
)
WHERE id IN (SELECT row_id FROM imports_fk_backup WHERE table_name = 'mf_transactions');

UPDATE freee_deals
SET import_id = (
  SELECT b.import_id FROM imports_fk_backup b
  WHERE b.table_name = 'freee_deals' AND b.row_id = freee_deals.id
)
WHERE id IN (SELECT row_id FROM imports_fk_backup WHERE table_name = 'freee_deals');

DROP TABLE imports_fk_backup;
