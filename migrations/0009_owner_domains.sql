-- Migration number: 0009  名義domainを事業・妻・家族へ更新
-- 0001は適用済みの環境があるため変更せず、3テーブルを同じ列・PK契約で再構築する。

CREATE TABLE rules_owner_v2 (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  cls TEXT CHECK(cls IN ('biz','per')),
  category_major TEXT,
  category_mid TEXT,
  owner TEXT CHECK(owner IN ('business','spouse','family')),
  sort_order INTEGER NOT NULL,
  created_at TEXT
);
INSERT INTO rules_owner_v2
  (id, user_id, keyword, cls, category_major, category_mid, owner, sort_order, created_at)
SELECT id, user_id, keyword, cls, category_major, category_mid,
       CASE owner WHEN 'self' THEN 'business' ELSE owner END,
       sort_order, created_at
FROM rules;
DROP TABLE rules;
ALTER TABLE rules_owner_v2 RENAME TO rules;

CREATE TABLE tx_edits_owner_v2 (
  user_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  cls TEXT CHECK(cls IN ('biz','per')),
  category_major TEXT,
  category_mid TEXT,
  owner TEXT CHECK(owner IN ('business','spouse','family')),
  base_major TEXT,
  base_mid TEXT,
  note TEXT,
  updated_at TEXT,
  PRIMARY KEY(user_id, tx_id)
);
INSERT INTO tx_edits_owner_v2
  (user_id, tx_id, cls, category_major, category_mid, owner, base_major, base_mid, note, updated_at)
SELECT user_id, tx_id, cls, category_major, category_mid,
       CASE owner WHEN 'self' THEN 'business' ELSE owner END,
       base_major, base_mid, note, updated_at
FROM tx_edits;
DROP TABLE tx_edits;
ALTER TABLE tx_edits_owner_v2 RENAME TO tx_edits;

CREATE TABLE institution_owners_owner_v2 (
  user_id TEXT NOT NULL,
  institution TEXT NOT NULL,
  owner TEXT NOT NULL CHECK(owner IN ('business','spouse','family')),
  PRIMARY KEY(user_id, institution)
);
INSERT INTO institution_owners_owner_v2 (user_id, institution, owner)
SELECT user_id, institution, CASE owner WHEN 'self' THEN 'business' ELSE owner END
FROM institution_owners;
DROP TABLE institution_owners;
ALTER TABLE institution_owners_owner_v2 RENAME TO institution_owners;

-- JSONのcanonical owner値が変わるため、旧selfで作られたglobal pointerを重複判定へ使わない。
-- attempt/run監査履歴は保持し、次のexport/restore commitでcanonical pointerを再確立する。
DELETE FROM import_active_targets WHERE target_key = 'json:global';
