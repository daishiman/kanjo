-- Migration number: 0007  現金ID非再利用・復元集計provenance
-- 0006 は既に適用済みの可能性があるため変更せず、追加DDLはこのmigrationで行う。

-- JSON復元でのみ得られた集計値の正本。monthly_agg は現在の原本/現金との合成キャッシュ。
CREATE TABLE restored_monthly_agg (
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  scope TEXT NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY(user_id, month, scope)
);

-- 0007以前のmonthly_aggには現金投影のprovenanceが無い。scope domainと同じsideの現金が無く、
-- かつ対応原本も無い値だけrestore-onlyと安全に確定できる。反対sideの現金だけを理由に捨てない。
INSERT INTO restored_monthly_agg (user_id, month, scope, amount)
SELECT a.user_id, a.month, a.scope, a.amount
FROM monthly_agg a
WHERE (
  (
    (a.scope = 'biz_rev' OR a.scope = 'subs_other' OR a.scope LIKE 'biz_exp:%' OR a.scope LIKE 'subs:%')
    AND NOT EXISTS (
      SELECT 1 FROM cash_entries c
      WHERE c.user_id = a.user_id AND c.month = a.month AND c.side = 'biz'
    )
    AND NOT EXISTS (
      SELECT 1 FROM freee_deals d WHERE d.user_id = a.user_id AND d.month = a.month
    )
  )
  OR
  (
    (a.scope = 'biz_personal_in' OR a.scope = 'biz_personal_out' OR a.scope LIKE 'per_inc:%' OR a.scope LIKE 'per_exp:%')
    AND NOT EXISTS (
      SELECT 1 FROM cash_entries c
      WHERE c.user_id = a.user_id AND c.month = a.month AND c.side = 'per'
    )
    AND NOT EXISTS (
      SELECT 1 FROM mf_transactions t WHERE t.user_id = a.user_id AND t.month = a.month
    )
  )
);

-- SQLiteのINTEGER PRIMARY KEYは削除済み最大IDを再利用し得る。cash:* editの誤付着を防ぐため
-- AUTOINCREMENTテーブルへ再構築する。既存IDを保持し、sqlite_sequenceはINSERTで最大IDへ進む。
ALTER TABLE cash_entries RENAME TO cash_entries_legacy;
DROP INDEX idx_cash_month;
CREATE TABLE cash_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  month TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('biz','per')),
  io TEXT NOT NULL CHECK(io IN ('income','expense')),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  category_major TEXT NOT NULL,
  category_mid TEXT NOT NULL DEFAULT '',
  memo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO cash_entries
  (id, user_id, date, month, side, io, amount, description, category_major, category_mid, memo, created_at, updated_at)
SELECT id, user_id, date, month, side, io, amount, description, category_major, category_mid, memo, created_at, updated_at
FROM cash_entries_legacy
ORDER BY id;
DROP TABLE cash_entries_legacy;
CREATE INDEX idx_cash_month ON cash_entries(user_id, month);
