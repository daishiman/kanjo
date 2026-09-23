-- Migration number: 0051  集計ルール (勘定科目・取引先) の表 (追加のみ)
--
-- 0051_settings_norm_rules.sql : 設定画面 (spec-settings-screen) の集計ルールの保存先。
-- 既存の account_norm_map は書き換えずに残し、その行を種別『勘定科目』として同じ意味で写す。
-- 本 migration は既存の行を書き換える文 (UPDATE・DELETE・表の作り直し) を含まない。
-- rule_id の 'm-' || lower(hex(raw)) は core の migratedNormRuleId (UTF-8 の16進) と同じ値になる。
-- 文字数の上限は DB に置かず core で検査する (既存の長い値で migration が失敗しないように)。
CREATE TABLE IF NOT EXISTS settings_norm_rules (
  user_id    TEXT NOT NULL,
  rule_id    TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('account', 'vendor')),
  raw        TEXT NOT NULL,
  norm       TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (user_id, rule_id)
);
CREATE INDEX IF NOT EXISTS settings_norm_rules_order ON settings_norm_rules (user_id, sort_order);

-- 既存の科目正規化マップを写す (初回だけ。NULL の行は既存の読み手でも意味を持たないので写さない)
INSERT OR IGNORE INTO settings_norm_rules
  (user_id, rule_id, kind, raw, norm, sort_order, enabled, updated_at, updated_by)
SELECT user_id,
       'm-' || lower(hex(raw)),
       'account',
       raw,
       norm,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY raw),
       1,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
       'system'
FROM account_norm_map
WHERE user_id IS NOT NULL AND raw IS NOT NULL AND norm IS NOT NULL;
