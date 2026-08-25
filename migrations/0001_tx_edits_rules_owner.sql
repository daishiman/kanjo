-- Migration number: 0001  明細の手動編集(オーバーライド)・ルール拡張・名義
-- 目的: 画面での編集(公私/大項目/中項目/名義)を元CSV(mf_transactions)とは別枠で永続化し、再取込でも保持する。
-- 同一性キー: MF明細の ID 列(mf_transactions.tx_id)。

-- 1. 手動編集。NULL の属性は「編集していない(ルール/取込値に従う)」
CREATE TABLE tx_edits (
  user_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  cls TEXT CHECK(cls IN ('biz','per')),
  category_major TEXT,
  category_mid TEXT,
  owner TEXT CHECK(owner IN ('self','spouse')),
  -- 編集した時点の取込値(再取込でMF側の分類が変わったことを検知する)
  base_major TEXT,
  base_mid TEXT,
  note TEXT,
  updated_at TEXT,
  PRIMARY KEY(user_id, tx_id)
);
-- 既存の手動判定(overrides)を引き継ぐ。旧テーブルは互換のため残す(以後は書かない)
INSERT INTO tx_edits (user_id, tx_id, cls, updated_at)
  SELECT user_id, tx_id, cls, updated_at FROM overrides;

-- 2. ルール拡張: 公私に加えて 大項目/中項目/名義 も設定できる(各列 NULL = そのルールでは変えない)
CREATE TABLE rules_v2 (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  cls TEXT CHECK(cls IN ('biz','per')),
  category_major TEXT,
  category_mid TEXT,
  owner TEXT CHECK(owner IN ('self','spouse')),
  sort_order INTEGER NOT NULL,
  created_at TEXT
);
INSERT INTO rules_v2 (id, user_id, keyword, cls, sort_order, created_at)
  SELECT id, user_id, keyword, cls, sort_order, created_at FROM rules;
DROP TABLE rules;
ALTER TABLE rules_v2 RENAME TO rules;

-- 3. 保有金融機関 → 名義(本人/妻)。MF明細の「保有金融機関」列の値をそのままキーにする
CREATE TABLE institution_owners (
  user_id TEXT NOT NULL,
  institution TEXT NOT NULL,
  owner TEXT NOT NULL CHECK(owner IN ('self','spouse')),
  PRIMARY KEY(user_id, institution)
);

-- 4. 大項目/中項目の候補(取込値に無い組み合わせを使いたいときだけ登録)
CREATE TABLE category_options (
  user_id TEXT NOT NULL,
  major TEXT NOT NULL,
  mid TEXT NOT NULL,
  PRIMARY KEY(user_id, major, mid)
);
