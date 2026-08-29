-- Migration number: 0028  証憑の取得先プロファイルと明細別例外
--
-- 取得先は月ごとに複製せず、merchant_key::service_keyのprofile_keyを正本にする。
-- 同じ取引先の複数サービスは別profileとし、merchant_keyの検索結果から曖昧候補を導出する。
-- login_accountはログイン識別子だけを持ち、password/token/secretはD1へ保存しない。
CREATE TABLE receipt_source_profiles (
  user_id TEXT NOT NULL,
  profile_key TEXT NOT NULL CHECK (
    length(trim(profile_key)) BETWEEN 3 AND 400
    AND instr(trim(profile_key), '::') BETWEEN 2 AND length(trim(profile_key)) - 2
  ),
  merchant_key TEXT NOT NULL CHECK (length(trim(merchant_key)) BETWEEN 1 AND 200),
  service_name TEXT NOT NULL CHECK (length(trim(service_name)) BETWEEN 1 AND 120),
  source_url TEXT NOT NULL CHECK (
    length(trim(source_url)) BETWEEN 1 AND 2000
    AND (source_url GLOB 'http://*' OR source_url GLOB 'https://*')
  ),
  login_account TEXT CHECK (login_account IS NULL OR length(login_account) BETWEEN 1 AND 254),
  memo TEXT CHECK (memo IS NULL OR length(memo) BETWEEN 1 AND 500),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, profile_key)
);

CREATE INDEX idx_receipt_source_profiles_merchant
  ON receipt_source_profiles(user_id, merchant_key);

-- 例外は「別のprofileを参照」または「この明細だけの明示値」のどちらか一方。
-- merchant_keyは明細側の取引先キー、profile_keyは参照先なので別に持つ。
CREATE TABLE receipt_source_overrides (
  user_id TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('cash', 'mf')),
  target_key TEXT NOT NULL CHECK (length(target_key) BETWEEN 1 AND 200),
  merchant_key TEXT NOT NULL CHECK (length(trim(merchant_key)) BETWEEN 1 AND 200),
  profile_key TEXT CHECK (profile_key IS NULL OR length(trim(profile_key)) BETWEEN 3 AND 400),
  service_name TEXT CHECK (service_name IS NULL OR length(trim(service_name)) BETWEEN 1 AND 120),
  source_url TEXT CHECK (
    source_url IS NULL OR (
      length(trim(source_url)) BETWEEN 1 AND 2000
      AND (source_url GLOB 'http://*' OR source_url GLOB 'https://*')
    )
  ),
  login_account TEXT CHECK (login_account IS NULL OR length(login_account) BETWEEN 1 AND 254),
  memo TEXT CHECK (memo IS NULL OR length(memo) BETWEEN 1 AND 500),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_kind, target_key),
  FOREIGN KEY (user_id, profile_key)
    REFERENCES receipt_source_profiles(user_id, profile_key)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (
    (
      profile_key IS NOT NULL
      AND service_name IS NULL AND source_url IS NULL
      AND login_account IS NULL AND memo IS NULL
    )
    OR
    (
      profile_key IS NULL
      AND service_name IS NOT NULL AND source_url IS NOT NULL
    )
  )
);

CREATE INDEX idx_receipt_source_overrides_profile
  ON receipt_source_overrides(user_id, profile_key);
