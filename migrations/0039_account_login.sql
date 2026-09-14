-- Migration number: 0039  アカウントログイン(メールアドレス+パスワード)
--
-- 共有された1つのパスワードから、個人に帰属するアカウントへ認証主体を移す。
-- 既存の業務データには所有者列を足さない。利用者は認証と監査の主体としてだけ導入する。
-- 平文パスワードを保持する列は作らない。保存するのは自己記述形式のPBKDF2ハッシュだけ。

CREATE TABLE users (
  id                   TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  -- 保存前に前後空白除去+小文字化する。制約と正規化の双方で重複登録を止める。
  email                TEXT NOT NULL UNIQUE
    CHECK (
      length(email) BETWEEN 3 AND 254
      AND email = lower(email)
      AND email NOT GLOB '* *'
      AND email LIKE '%_@_%._%'
    ),
  -- pbkdf2-sha256$<iterations>$<salt_b64url>$<hash_b64url> の自己記述形式だけを受ける。
  password_hash        TEXT NOT NULL
    CHECK (length(password_hash) BETWEEN 40 AND 512 AND substr(password_hash, 1, 14) = 'pbkdf2-sha256$'),
  role                 TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  status               TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  -- セッション表を持たずに一括失効を効かせるための世代。増やすと既存Cookieが全て無効になる。
  session_generation   INTEGER NOT NULL DEFAULT 1 CHECK (session_generation >= 1),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  -- 一時資格情報の有効期限は、現在のpassword_hashと同じ行に置く。
  -- 履歴表を別に持たないことで「現在受理してよい資格情報」の正本を1件に保つ。
  temporary_password_expires_at TEXT
    CHECK (
      temporary_password_expires_at IS NULL
      OR (length(temporary_password_expires_at) = 24
          AND temporary_password_expires_at GLOB '????-??-??T??:??:??.???Z')
    ),
  created_at           TEXT NOT NULL
    CHECK (length(created_at) = 24 AND created_at GLOB '????-??-??T??:??:??.???Z'),
  updated_at           TEXT NOT NULL
    CHECK (length(updated_at) = 24 AND updated_at GLOB '????-??-??T??:??:??.???Z'),
  last_login_at        TEXT
    CHECK (last_login_at IS NULL OR (length(last_login_at) = 24 AND last_login_at GLOB '????-??-??T??:??:??.???Z')),
  -- 通常パスワードには期限を持たせない。must_change=1 + NULL は、期限切れを掃除済みで
  -- 再発行されるまで受理しない明示的な失効状態。
  CHECK (must_change_password = 1 OR temporary_password_expires_at IS NULL)
);

CREATE INDEX idx_users_status_role ON users (status, role);
CREATE INDEX idx_users_temporary_password_expiry
  ON users (temporary_password_expires_at)
  WHERE temporary_password_expires_at IS NOT NULL;

-- rate limit のキーをメールアドレス単位へ拡張する。scope_hash の材料が v1(送信元のみ) から
-- v2(送信元 + 対象メール) へ変わるため、古い行は意味が違う。残さず落として作り直す。
ALTER TABLE password_login_rate_limits ADD COLUMN scope_kind TEXT NOT NULL DEFAULT 'ip'
  CHECK (scope_kind IN ('ip', 'account'));

DELETE FROM password_login_rate_limits;

-- audit_log に actor_user_id を足し、認証操作を記録できるよう action/scope を広げる。
-- CHECK 制約の拡張は SQLite では再構築でしか行えないため 0034 と同じ手順を採る。
CREATE TABLE audit_log_new (
  id             TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  user_id        TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100),
  -- NULL は欠測ではなく「操作者を識別できなかった時代の記録」を意味する値。
  -- 共有パスワード経路は操作者を記録していないため、遡って埋めない。
  actor_user_id  TEXT CHECK (actor_user_id IS NULL OR length(actor_user_id) BETWEEN 1 AND 64),
  operation_id   TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 100),
  action         TEXT NOT NULL
    CHECK (action IN (
      'delete', 'undo', 'import_resolution', 'import_discard',
      'auth_login', 'auth_login_failed', 'auth_logout', 'auth_password_change',
      'admin_user_invite', 'admin_user_update', 'admin_user_suspend', 'admin_user_password_reset'
    )),
  scope          TEXT NOT NULL
    CHECK (
      scope IN ('transaction', 'import', 'all', 'account')
      OR (
        substr(scope, 1, 7) = 'import:'
        AND length(substr(scope, 8)) BETWEEN 1 AND 20
        AND substr(scope, 8) NOT GLOB '*[^0-9]*'
      )
      OR (
        substr(scope, 1, 8) = 'account:'
        AND length(substr(scope, 9)) BETWEEN 1 AND 64
        AND substr(scope, 9) NOT GLOB '*[^0-9a-zA-Z_-]*'
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
  counts_json    TEXT NOT NULL
    CHECK (
      json_valid(counts_json)
      AND json_type(counts_json) = 'object'
      AND length(counts_json) BETWEEN 2 AND 512
    ),
  occurred_at    TEXT NOT NULL
    CHECK (length(occurred_at) = 24 AND occurred_at GLOB '????-??-??T??:??:??.???Z'),
  result         TEXT NOT NULL CHECK (result IN ('succeeded', 'failed', 'rejected')),
  UNIQUE (id, user_id)
);

CREATE TABLE audit_log_detail_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100),
  tx_key        TEXT NOT NULL
    CHECK (
      length(tx_key) = 67
      AND substr(tx_key, 1, 3) = 'v1:'
      AND substr(tx_key, 4) NOT GLOB '*[^0-9a-f]*'
    ),
  attribute     TEXT NOT NULL CHECK (attribute IN ('cls', 'category_major', 'category_mid', 'owner')),
  before_value  TEXT CHECK (before_value IS NULL OR length(before_value) <= 120),
  after_value   TEXT CHECK (after_value IS NULL OR length(after_value) <= 120),
  reason_code   TEXT NOT NULL
    CHECK (
      length(reason_code) BETWEEN 1 AND 64
      AND substr(reason_code, 1, 1) GLOB '[a-z]'
      AND reason_code NOT GLOB '*[^a-z0-9_]*'
    ),
  source_type   TEXT NOT NULL
    CHECK (source_type IN ('tx_edit', 'rule', 'vendor_memory', 'import', 'default', 'user_resolution', 'system')),
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
    REFERENCES audit_log_new (id, user_id)
    ON DELETE CASCADE,
  UNIQUE (audit_id, tx_key, attribute)
);

INSERT INTO audit_log_new (id, user_id, actor_user_id, operation_id, action, scope, counts_json, occurred_at, result)
SELECT id, user_id, NULL, operation_id, action, scope, counts_json, occurred_at, result FROM audit_log;

INSERT INTO audit_log_detail_new
SELECT id,audit_id,user_id,tx_key,attribute,before_value,after_value,reason_code,source_type,source_key,occurred_at
FROM audit_log_detail;

DROP TABLE audit_log_detail;
DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;
ALTER TABLE audit_log_detail_new RENAME TO audit_log_detail;

CREATE INDEX idx_audit_log_user_occurred ON audit_log (user_id, occurred_at DESC);
CREATE INDEX idx_audit_log_retention ON audit_log (occurred_at, id);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_log_detail_user_occurred ON audit_log_detail (user_id, occurred_at DESC);
CREATE INDEX idx_audit_log_detail_retention ON audit_log_detail (occurred_at, id);
