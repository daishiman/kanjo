-- ログイン v2: Better Auth の認証の表と、招待・MFA 設定・連携確認の表を足す。
--
-- 追加のみ。旧 users・password_login_rate_limits・audit_log は残し、行も列も書き換えない。
-- Deploy の自動適用 (plan-auto-migration.mjs) を止める DROP / DELETE / UPDATE / RENAME を含めない。
-- 認証の表は業務データの表から参照しない。外部キーは認証の文脈の中 (user への cascade) に閉じる。
--
-- 認証の 5 表は Better Auth v1.7.5 の schema 生成 (twoFactor plugin と additionalFields 込み) の出力に合わせる。
-- 列名はキャメルケースのまま (Better Auth の既定名、接頭辞なし)。日付は ISO 文字列、真偽は 0/1 で入る。

CREATE TABLE "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "twoFactorEnabled" INTEGER,
  "role" TEXT NOT NULL CHECK ("role" IN ('admin', 'member')),
  "status" TEXT NOT NULL CHECK ("status" IN ('active', 'suspended')),
  "lastLoginAt" DATE
);

CREATE TABLE "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  -- 保持なし (0) のセッションは延長しない (design-decisions 3.1 R-2)
  "rememberMe" INTEGER
);

CREATE TABLE "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE TABLE "twoFactor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "secret" TEXT NOT NULL,
  "backupCodes" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "verified" INTEGER,
  "failedVerificationCount" INTEGER,
  "lockedUntil" DATE
);

CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "session_expiresAt_idx" ON "session" ("expiresAt");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE UNIQUE INDEX "account_one_credential_per_user_idx"
  ON "account" ("userId") WHERE "providerId" = 'credential';
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
CREATE INDEX "verification_expiresAt_idx" ON "verification" ("expiresAt");
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" ("secret");
CREATE UNIQUE INDEX "twoFactor_userId_idx" ON "twoFactor" ("userId");

-- 招待。状態 (未承諾・承諾済み・期限切れ・取消) は列から core の invitationStatus が導き、保存しない。
-- トークンは SHA-256 の 16 進だけを持つ (BR-11)。平文は保存しない。
CREATE TABLE invitations (
  id           TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  email        TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email = lower(email)),
  role         TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash   TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  expires_at   TEXT NOT NULL CHECK (length(expires_at) = 24 AND expires_at GLOB '????-??-??T??:??:??.???Z'),
  accepted_at  TEXT CHECK (accepted_at IS NULL OR (length(accepted_at) = 24 AND accepted_at GLOB '????-??-??T??:??:??.???Z')),
  revoked_at   TEXT CHECK (revoked_at IS NULL OR (length(revoked_at) = 24 AND revoked_at GLOB '????-??-??T??:??:??.???Z')),
  invited_by   TEXT CHECK (invited_by IS NULL OR length(invited_by) BETWEEN 1 AND 64),
  created_at   TEXT NOT NULL CHECK (length(created_at) = 24 AND created_at GLOB '????-??-??T??:??:??.???Z'),
  updated_at   TEXT NOT NULL CHECK (length(updated_at) = 24 AND updated_at GLOB '????-??-??T??:??:??.???Z')
);

-- 同じメールの未承諾の招待は 1 件だけ (BR-05)。期限切れの未承諾もここに入るので、作り直しは行の置き換えで行う。
CREATE UNIQUE INDEX idx_invitations_open_email
  ON invitations (email) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_invitations_created ON invitations (created_at DESC, id);

-- 管理者の MFA 設定トークン (10 分・1 回限り)。消費は条件付き UPDATE の更新行数で保証する。
CREATE TABLE mfa_setup_token (
  id           TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  user_id      TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  -- パスワード認証時の保持の指定を complete まで持ち越す。web から送り直させない (design-decisions 3.3)
  remember_me  INTEGER NOT NULL DEFAULT 1 CHECK (remember_me IN (0, 1)),
  expires_at   TEXT NOT NULL CHECK (length(expires_at) = 24 AND expires_at GLOB '????-??-??T??:??:??.???Z'),
  consumed_at  TEXT CHECK (consumed_at IS NULL OR (length(consumed_at) = 24 AND consumed_at GLOB '????-??-??T??:??:??.???Z')),
  created_at   TEXT NOT NULL CHECK (length(created_at) = 24 AND created_at GLOB '????-??-??T??:??:??.???Z')
);

CREATE INDEX idx_mfa_setup_token_user ON mfa_setup_token (user_id);
CREATE INDEX idx_mfa_setup_token_expires ON mfa_setup_token (expires_at);

-- 連携確認のトークン (1 時間・1 回限り)。消費済みの行が link grant の裏付けになる (design-decisions 3.1 R-9)。
CREATE TABLE link_confirmation_token (
  id           TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  user_id      TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  target       TEXT NOT NULL CHECK (target IN ('google', 'password')),
  token_hash   TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64 AND token_hash NOT GLOB '*[^0-9a-f]*'),
  expires_at   TEXT NOT NULL CHECK (length(expires_at) = 24 AND expires_at GLOB '????-??-??T??:??:??.???Z'),
  consumed_at  TEXT CHECK (consumed_at IS NULL OR (length(consumed_at) = 24 AND consumed_at GLOB '????-??-??T??:??:??.???Z')),
  created_at   TEXT NOT NULL CHECK (length(created_at) = 24 AND created_at GLOB '????-??-??T??:??:??.???Z')
);

CREATE INDEX idx_link_confirmation_token_user ON link_confirmation_token (user_id);
CREATE INDEX idx_link_confirmation_token_expires ON link_confirmation_token (expires_at);

-- 新しい監査 action の表。列は audit_log と同じ形。既存 action は従来どおり audit_log に書く (design-decisions 2.7)。
-- 利用者の文脈の外 (再送依頼など) の記録があるので scope は 'account' と 'account:<id>' に限る。
CREATE TABLE auth_audit_log (
  id             TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  user_id        TEXT NOT NULL CHECK (length(user_id) BETWEEN 1 AND 100),
  actor_user_id  TEXT CHECK (actor_user_id IS NULL OR length(actor_user_id) BETWEEN 1 AND 64),
  operation_id   TEXT NOT NULL UNIQUE CHECK (length(operation_id) BETWEEN 1 AND 100),
  action         TEXT NOT NULL
    CHECK (action IN (
      'admin_invite_resend', 'admin_invite_revoke',
      'auth_invite_accept', 'auth_invite_resend_request',
      'auth_password_reset_request', 'auth_password_reset',
      'auth_mfa_setup_issued', 'auth_mfa_enable', 'auth_mfa_disable',
      'auth_mfa_backup_code_used', 'auth_mfa_backup_codes_regenerated',
      'auth_link_add', 'auth_link_remove'
    )),
  scope          TEXT NOT NULL
    CHECK (
      scope = 'account'
      OR (
        substr(scope, 1, 8) = 'account:'
        AND length(substr(scope, 9)) BETWEEN 1 AND 64
        AND substr(scope, 9) NOT GLOB '*[^0-9a-zA-Z_-]*'
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
  result         TEXT NOT NULL CHECK (result IN ('succeeded', 'failed', 'rejected'))
);

CREATE INDEX idx_auth_audit_log_user_occurred ON auth_audit_log (user_id, occurred_at DESC);
CREATE INDEX idx_auth_audit_log_retention ON auth_audit_log (occurred_at, id);
CREATE INDEX idx_auth_audit_log_actor ON auth_audit_log (actor_user_id, occurred_at DESC);

-- Login v2 の全入口を扱う統合レート制限。旧 password_login_rate_limits はrollback用に残すがruntimeからは読まない。
-- login・MFA・招待・再設定・statusをscope_kindで分け、不可逆scope_hashだけを保存する。
CREATE TABLE auth_rate_limits (
  scope_hash         TEXT PRIMARY KEY,
  scope_kind         TEXT NOT NULL
    CHECK (scope_kind IN ('login_ip', 'login_account', 'mfa_ip', 'mfa_account', 'invite_ip', 'invite_account', 'reset_ip', 'reset_account', 'status_ip')),
  window_started_at  INTEGER NOT NULL,
  failure_count      INTEGER NOT NULL CHECK (failure_count >= 0),
  locked_until       INTEGER,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX idx_auth_rate_limits_updated ON auth_rate_limits (updated_at);

-- 旧 users から複写する (C3・C4)。移行の複写は招待の規則 (BR-01) の外で、SQL で直接行う。
-- 再実行で重複しないよう NOT EXISTS で守り、id は決定的に作る (R-6)。
-- name はメールの @ より前。管理者が登録し運用してきたメールなので emailVerified=1 (Q-15)。
INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt",
                    "twoFactorEnabled", "role", "status", "lastLoginAt")
SELECT u.id,
       substr(u.email, 1, instr(u.email, '@') - 1),
       u.email,
       1,
       NULL,
       u.created_at,
       u.updated_at,
       0,
       u.role,
       u.status,
       u.last_login_at
  FROM users u
 WHERE u.must_change_password = 0
   AND NOT EXISTS (SELECT 1 FROM "user" x WHERE x.id = u.id OR x.email = u.email);

-- 一時パスワードのまま未変更 (must_change_password=1) の利用者は user/account の両方へ写さない。
-- email を予約して招待不能にせず、Login v2 の通常招待から登録し直せるようにする (Q-16)。
-- 既存の pbkdf2-sha256$ のハッシュは形式ごと写し、差し替えた password.verify で読む (C4)。
INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT 'cred-' || u.id,
       u.id,
       'credential',
       u.id,
       u.password_hash,
       u.created_at,
       u.updated_at
  FROM users u
 WHERE u.must_change_password = 0
   AND EXISTS (SELECT 1 FROM "user" x WHERE x.id = u.id)
   AND NOT EXISTS (SELECT 1 FROM "account" a WHERE a.id = 'cred-' || u.id);
