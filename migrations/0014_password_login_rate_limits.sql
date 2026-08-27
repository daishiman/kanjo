-- Migration number: 0014  password loginのD1-backed atomic rate limit
--
-- scope_hashはCloudflareが付与する接続元IPをnamespace付きSHA-256へ変換した値だけを保存する。
-- raw IP、password、request headerは永続化しない。

CREATE TABLE password_login_rate_limits (
  scope_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  failure_count INTEGER NOT NULL CHECK (failure_count >= 0),
  locked_until INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_password_login_rate_limits_updated
  ON password_login_rate_limits(updated_at);
