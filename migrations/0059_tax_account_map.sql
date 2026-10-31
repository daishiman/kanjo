-- Migration number: 0059  勘定科目の対応表 (追加のみ)
--
-- 仕様 (specs/spec-classify-bulk-save.md「データモデル」) は 0058 と書くが、0058 はサブスクの統合
-- (0058_subscription_merge_operations.sql) が先に使った。番号だけを 0059 に進め、内容は仕様のとおりである (OI-6)。
--
-- MF の大項目 → 確定申告の勘定科目の対応表。事業の明細の提案『MF の分類 (対応表)』が読む (FR-17)。
-- 本 migration は既存の行を書き換える文 (UPDATE・DELETE・表の作り直し) を含まない。
-- 対応先に外部キーと CHECK は置かない。勘定科目の一覧は利用者が足せる動的な集合なので、
-- 一覧に無い対応先は API (routes/tax-account-map.ts) が core の taxAccountMapRowIssue で 400 にする。
-- 初期の 5 行の変更履歴は、履歴の種類を足す 0060 が書く (この時点の CHECK では書けない)。
CREATE TABLE IF NOT EXISTS tax_account_map (
  user_id      TEXT NOT NULL,
  category_big TEXT NOT NULL,
  tax_account  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, category_big)
);

-- 初期の 5 行 (BR-10)。業務データの持ち主 'default' (TENANT_ID、packages/api/src/auth.ts) に入れる
-- (0000_init.sql の科目正規化の初期値と同じ書き方)。字面は core の DEFAULT_TAX_ACCOUNT_MAP と一致させる
-- (tax-account-map-migration.integration.test.ts が突き合わせる)。利用者の作成のたびには入れない。
INSERT OR IGNORE INTO tax_account_map (user_id, category_big, tax_account, created_at, updated_at) VALUES
  ('default', '通信費', '通信費', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('default', '水道・光熱費', '水道光熱費', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('default', '交通費', '旅費交通費', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('default', '交際費', '接待交際費', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('default', '日用品', '消耗品費', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
