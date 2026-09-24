-- Migration number: 0056  設定の変更履歴 (追加のみ)
--
-- 0056_settings_change_log.sql : 設定の変更 1 件ごとの前後の値。右パネルの最終更新・元に戻す・revision の起点。
-- 本 migration は既存の行を書き換える文 (UPDATE・DELETE・表の作り直し) を含まない。
-- seq は利用者ごとの連番。追記は同じ batch の中で MAX(seq) + n を使う (fence の内側で直列化されている)。
-- 保持は無期限。before・after は項目の値の JSON 文字列 (作成は before が NULL、削除は after が NULL)。
CREATE TABLE IF NOT EXISTS settings_change_log (
  user_id    TEXT NOT NULL,
  seq        INTEGER NOT NULL,
  target     TEXT NOT NULL CHECK (target IN ('norm_rule', 'owner_label', 'stat_min_months', 'cash_override')),
  target_key TEXT NOT NULL,
  before     TEXT,
  after      TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  origin     TEXT NOT NULL CHECK (origin IN ('screen', 'restore', 'migration')),
  PRIMARY KEY (user_id, seq)
);
CREATE INDEX IF NOT EXISTS settings_change_log_target
  ON settings_change_log (user_id, target, target_key, seq);

-- 0054 で移した集計ルールを『システム』の履歴として残す。現金上書き・名義・統計の既存値の履歴は作らない
-- (行ごとの元に戻すを持たないため。revision の起点は集計ルールの移行行で足りる)。
INSERT INTO settings_change_log (user_id, seq, target, target_key, before, after, changed_by, changed_at, origin)
SELECT user_id,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY sort_order),
       'norm_rule', rule_id, NULL,
       json_object('kind', kind, 'raw', raw, 'norm', norm, 'enabled', enabled, 'order', sort_order),
       'system', updated_at, 'migration'
FROM settings_norm_rules;
