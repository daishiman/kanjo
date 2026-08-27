-- Migration number: 0011  添付先の型付き化とR2削除の再試行状態
--
-- target_idの接頭辞判定を各routeに漏らさず、種別+安定keyをD1の契約にする。
-- R2とD1は同一transactionにできないため、削除意図と失敗をD1に残し、
-- 同じDELETEを冪等に再試行できるようにする。

-- 旧行はID列由来か判別できないため、安全側の0で移行する。
-- 次回のMF CSV取込で、ID列がある行だけ1に更新される。
ALTER TABLE mf_transactions ADD COLUMN identity_stable INTEGER NOT NULL DEFAULT 0
  CHECK (identity_stable IN (0, 1));

ALTER TABLE attachments RENAME TO attachments_legacy_0011;

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('cash', 'mf')),
  target_key TEXT NOT NULL CHECK (length(target_key) BETWEEN 1 AND 200),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  content_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ready'
    CHECK (state IN ('ready', 'delete_pending', 'delete_failed')),
  delete_attempts INTEGER NOT NULL DEFAULT 0 CHECK (delete_attempts >= 0),
  delete_requested_at TEXT,
  last_delete_error TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO attachments (
  id, user_id, target_kind, target_key, r2_key, filename, content_type, size,
  content_hash, state, delete_attempts, delete_requested_at, last_delete_error, created_at
)
SELECT
  id,
  user_id,
  CASE
    WHEN target_id LIKE 'cash:%'
      AND length(substr(target_id, 6)) > 0
      AND substr(target_id, 6) NOT GLOB '*[^0-9]*'
      AND CAST(substr(target_id, 6) AS INTEGER) > 0
      AND CAST(CAST(substr(target_id, 6) AS INTEGER) AS TEXT) = substr(target_id, 6)
    THEN 'cash' ELSE 'mf'
  END,
  CASE
    WHEN target_id LIKE 'cash:%'
      AND length(substr(target_id, 6)) > 0
      AND substr(target_id, 6) NOT GLOB '*[^0-9]*'
      AND CAST(substr(target_id, 6) AS INTEGER) > 0
      AND CAST(CAST(substr(target_id, 6) AS INTEGER) AS TEXT) = substr(target_id, 6)
    THEN substr(target_id, 6) ELSE target_id
  END,
  r2_key,
  filename,
  content_type,
  size,
  content_hash,
  'ready',
  0,
  NULL,
  NULL,
  created_at
FROM attachments_legacy_0011;

DROP TABLE attachments_legacy_0011;

CREATE INDEX idx_attachments_target
  ON attachments(user_id, target_kind, target_key, state);
CREATE UNIQUE INDEX uq_attachments_r2key ON attachments(r2_key);
CREATE UNIQUE INDEX uq_attachments_dup
  ON attachments(user_id, target_kind, target_key, content_hash);

-- 通常記帳に交通費metadata/証憑不要フラグが残るのをDB境界でも防ぐ。
-- test/CLIで共通の1 statement単位を保つためtriggerは使わず、CHECK付き表へ移行する。
ALTER TABLE cash_entries RENAME TO cash_entries_legacy_0011;

CREATE TABLE cash_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  month TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('biz', 'per')),
  io TEXT NOT NULL CHECK (io IN ('income', 'expense')),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  category_major TEXT NOT NULL,
  category_mid TEXT NOT NULL DEFAULT '',
  memo TEXT,
  transit_from TEXT,
  transit_to TEXT,
  transit_round INTEGER NOT NULL DEFAULT 0 CHECK (transit_round IN (0, 1)),
  receipt_waived INTEGER NOT NULL DEFAULT 0 CHECK (receipt_waived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (transit_from IS NULL AND transit_to IS NULL)
    OR (
      transit_from IS NOT NULL AND transit_to IS NOT NULL
      AND length(trim(transit_from)) > 0 AND length(trim(transit_to)) > 0
      AND io = 'expense'
    )
  ),
  CHECK (transit_from IS NOT NULL OR transit_round = 0),
  CHECK (receipt_waived = 0 OR (transit_from IS NOT NULL AND io = 'expense'))
);

INSERT INTO cash_entries (
  id, user_id, date, month, side, io, amount, description, category_major, category_mid,
  memo, transit_from, transit_to, transit_round, receipt_waived, created_at, updated_at
)
SELECT
  id, user_id, date, month, side, io, amount, description, category_major, category_mid,
  memo, transit_from, transit_to, transit_round, receipt_waived, created_at, updated_at
FROM cash_entries_legacy_0011;

DROP TABLE cash_entries_legacy_0011;
CREATE INDEX idx_cash_month ON cash_entries(user_id, month);
