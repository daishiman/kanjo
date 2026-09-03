-- Migration number: 0033  D8 の二層監査記録
--
-- 年を跨ぐ操作の事実と、短期間だけ必要な判定根拠は寿命が異なる。
-- audit_log は操作ヘッダを1操作1行で持ち、400日保持する。
-- audit_log_detail は判定した1属性1行だけを持ち、90日保持する。
-- どちらにも明細本体や金額の列は作らない(D8 / DR-9)。

CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY
    CHECK (length(id) BETWEEN 1 AND 100),
  user_id       TEXT NOT NULL
    CHECK (length(user_id) BETWEEN 1 AND 100),
  operation_id  TEXT NOT NULL UNIQUE
    CHECK (length(operation_id) BETWEEN 1 AND 100),
  action        TEXT NOT NULL
    CHECK (action IN ('delete', 'undo', 'import_resolution')),
  -- transaction/import/period/all の種類と、安全な期間・取込IDだけを持つ。
  -- 明細IDは transaction の場合でも保存しない。
  scope         TEXT NOT NULL
    CHECK (
      scope IN ('transaction', 'import', 'all')
      OR (
        substr(scope, 1, 7) = 'import:'
        AND length(substr(scope, 8)) BETWEEN 1 AND 20
        AND substr(scope, 8) NOT GLOB '*[^0-9]*'
      )
      OR (
        length(scope) = 23
        AND substr(scope, 1, 7) = 'period:'
        AND substr(scope, 8, 4) NOT GLOB '*[^0-9]*'
        AND substr(scope, 12, 1) = '-'
        AND substr(scope, 13, 2) BETWEEN '01' AND '12'
        AND substr(scope, 15, 2) = '..'
        AND substr(scope, 17, 4) NOT GLOB '*[^0-9]*'
        AND substr(scope, 21, 1) = '-'
        AND substr(scope, 22, 2) BETWEEN '01' AND '12'
        AND substr(scope, 8, 7) <= substr(scope, 17, 7)
      )
    ),
  -- 件数の辞書に限定し、builderがキーと値を検証する。
  counts_json   TEXT NOT NULL
    CHECK (
      json_valid(counts_json)
      AND json_type(counts_json) = 'object'
      AND length(counts_json) BETWEEN 2 AND 512
    ),
  occurred_at   TEXT NOT NULL
    CHECK (length(occurred_at) = 24 AND occurred_at GLOB '????-??-??T??:??:??.???Z'),
  result        TEXT NOT NULL
    CHECK (result IN ('succeeded', 'failed', 'rejected'))
);

CREATE UNIQUE INDEX uq_audit_log_tenant_ref
  ON audit_log (id, user_id);
CREATE INDEX idx_audit_log_user_occurred
  ON audit_log (user_id, occurred_at DESC);
CREATE INDEX idx_audit_log_retention
  ON audit_log (occurred_at, id);

CREATE TABLE audit_log_detail (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL
    CHECK (length(user_id) BETWEEN 1 AND 100),
  -- user_id・operation_id・元の明細identityを SHA-256 した v1:<64 hex> だけを受ける。
  tx_key        TEXT NOT NULL
    CHECK (
      length(tx_key) = 67
      AND substr(tx_key, 1, 3) = 'v1:'
      AND substr(tx_key, 4) NOT GLOB '*[^0-9a-f]*'
    ),
  attribute     TEXT NOT NULL
    CHECK (attribute IN ('cls', 'category_major', 'category_mid', 'owner')),
  before_value  TEXT
    CHECK (before_value IS NULL OR length(before_value) <= 120),
  after_value   TEXT
    CHECK (after_value IS NULL OR length(after_value) <= 120),
  reason_code   TEXT NOT NULL
    CHECK (
      length(reason_code) BETWEEN 1 AND 64
      AND substr(reason_code, 1, 1) GLOB '[a-z]'
      AND reason_code NOT GLOB '*[^a-z0-9_]*'
    ),
  source_type   TEXT NOT NULL
    CHECK (source_type IN ('tx_edit', 'rule', 'vendor_memory', 'import', 'default', 'user_resolution', 'system')),
  -- 生のベンダー名やルール本文ではなく、source_type:v1:<64 hex> のみ。
  source_key    TEXT
    CHECK (
      (
        source_key IS NULL
        AND source_type NOT IN ('tx_edit', 'rule', 'vendor_memory', 'user_resolution')
      )
      OR (
        length(source_key) = length(source_type) + 68
        AND substr(source_key, 1, length(source_type) + 4) = source_type || ':v1:'
        AND substr(source_key, length(source_type) + 5) NOT GLOB '*[^0-9a-f]*'
      )
    ),
  occurred_at   TEXT NOT NULL
    CHECK (length(occurred_at) = 24 AND occurred_at GLOB '????-??-??T??:??:??.???Z'),
  FOREIGN KEY (audit_id, user_id)
    REFERENCES audit_log (id, user_id)
    ON DELETE CASCADE
);

-- 同じ操作で同じ明細の同じ属性を2回記録しない。
CREATE UNIQUE INDEX uq_audit_log_detail_decision
  ON audit_log_detail (audit_id, tx_key, attribute);
CREATE INDEX idx_audit_log_detail_user_occurred
  ON audit_log_detail (user_id, occurred_at DESC);
CREATE INDEX idx_audit_log_detail_retention
  ON audit_log_detail (occurred_at, id);
