-- Migration number: 0053  現金上書きの表 (追加のみ)
--
-- 0053_settings_cash_overrides.sql : 設定画面の現金上書き (支払い・受け取り × 全期間・月指定) の保存先。
-- 既存の cash_overrides は書き換えずに残し、月ごとの値を『月指定』の行として写す (支出 → 支払い、入金 → 受け取り)。
-- 本 migration は既存の行を書き換える文 (UPDATE・DELETE・表の作り直し) を含まない。
--
-- 0 と NULL の月は写さない (R-1)。旧画面は空欄を 0 として保存してきたので、保存済みの 0 が
-- 『空欄』か『0 円』かを区別できない。そのまま『月指定の 0 円』へ写すと、空欄のつもりだった月の
-- 現金集計を 0 円で上書きしてしまう。旧値はどの集計にも効いていなかった (観測) ので、写さなくても
-- 既存の集計結果は変わらない。core の settingsJsonFromBackup (古いバックアップ本文の写し) と同じ意味。
CREATE TABLE IF NOT EXISTS settings_cash_overrides (
  user_id     TEXT NOT NULL,
  override_id TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('payment', 'receipt')),
  amount      INTEGER CHECK (amount IS NULL OR amount >= 0),
  scope       TEXT NOT NULL CHECK (scope IN ('all', 'month')),
  month       TEXT CHECK ((scope = 'all' AND month IS NULL) OR (scope = 'month' AND month IS NOT NULL)),
  memo        TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL,
  updated_by  TEXT NOT NULL,
  PRIMARY KEY (user_id, override_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS settings_cash_overrides_scope
  ON settings_cash_overrides (user_id, kind, scope, ifnull(month, ''));

INSERT OR IGNORE INTO settings_cash_overrides
  (user_id, override_id, kind, amount, scope, month, memo, updated_at, updated_by)
SELECT user_id, 'm-p-' || month, 'payment', expense, 'month', month, '',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'system'
FROM cash_overrides
WHERE user_id IS NOT NULL AND month IS NOT NULL AND expense IS NOT NULL AND expense <> 0
UNION ALL
SELECT user_id, 'm-r-' || month, 'receipt', revenue, 'month', month, '',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'system'
FROM cash_overrides
WHERE user_id IS NOT NULL AND month IS NOT NULL AND revenue IS NOT NULL AND revenue <> 0;
