-- Migration number: 0060  設定の変更履歴の種類に勘定科目の対応表を足す (表の作り直し)
--
-- 仕様 (specs/spec-classify-bulk-save.md「データモデル」) は 0059 と書くが、0058 をサブスクの統合が先に使ったため
-- 番号を 1 つずつ進めた。内容は仕様のとおりである (OI-6)。
--
-- SQLite は CHECK を後から替えられないので、settings_change_log を作り直す (0057 と同じ手順)。
-- 列・型・PRIMARY KEY・origin の CHECK・索引 settings_change_log_target は 0056 から変えない。
-- 他の表から settings_change_log を参照する外部キーと TRIGGER は無いので、退避表は要らない。
-- 既存の行は seq も含めて 1 件も落とさずに写す (tax-account-map-migration.integration.test.ts が確かめる)。
CREATE TABLE settings_change_log_new (
  user_id    TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  target     TEXT NOT NULL
    CHECK (target IN ('norm_rule', 'owner_label', 'stat_min_months', 'cash_override', 'tax_account_map')),
  target_key TEXT NOT NULL,
  before     TEXT,
  after      TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  origin     TEXT NOT NULL CHECK (origin IN ('screen', 'restore', 'migration')),
  PRIMARY KEY (user_id, seq)
);

INSERT INTO settings_change_log_new (user_id, seq, target, target_key, before, after, changed_by, changed_at, origin)
SELECT user_id, seq, target, target_key, before, after, changed_by, changed_at, origin
FROM settings_change_log;

DROP TABLE settings_change_log;
ALTER TABLE settings_change_log_new RENAME TO settings_change_log;

CREATE INDEX IF NOT EXISTS settings_change_log_target
  ON settings_change_log (user_id, target, target_key, seq);

-- 0059 の初期の 5 行を『システム』の履歴として残す (0056 が 0054 の集計ルールを履歴にした前例。CBS-DB-06)。
-- 作成なので before は NULL、after は対応先の JSON (API・設定画面と同じ {categoryBig, taxAccount} の形)。
-- seq は利用者ごとの最後の seq に続ける。
INSERT INTO settings_change_log (user_id, seq, target, target_key, before, after, changed_by, changed_at, origin)
SELECT t.user_id,
       COALESCE((SELECT MAX(l.seq) FROM settings_change_log l WHERE l.user_id = t.user_id), 0)
         + ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.category_big),
       'tax_account_map', t.category_big, NULL,
       json_object('categoryBig', t.category_big, 'taxAccount', t.tax_account),
       'system', t.updated_at, 'migration'
FROM tax_account_map t;
