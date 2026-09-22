-- Migration number: 0051  データ取込画面: 検査・ファイル項目・取込のレート制限と、取込 1 回の影響の列
-- 追加だけにする。既存の表の意味と行は変えない (import_runs の新しい列は NULL を許し、既存の行は NULL のまま読む)。

-- 検査 1 要求 = 1 行。確定後は応答消失時の再送用に完了記録を期限まで残し、期限切れは夜間保守が消す。
-- user_id は業務データの共有テナントキーで、利用者を区別しない。検査を作った本人は actor_id で持つ。
CREATE TABLE import_inspections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','committing')),
  -- 最初の確定で作った取込 1 回の run。D1 の 1 invocation の query 予算に収めるため確定は 1 要求 1 ファイルで、
  -- 2 本目以降の run はこの run の子 (import_runs.parent_run_id) にして履歴を 1 行に保つ。
  run_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_import_inspections_user_expires ON import_inspections(user_id, expires_at);

-- ファイルごとの検査結果と R2 の仮置きキー。確定後は r2_key を消し、summary_json と error_kind に最小 receipt を残す。
-- 検査 ID ごとの累計 (件数・サイズ) はこの表から合計する。
CREATE TABLE import_inspection_files (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL REFERENCES import_inspections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  filename TEXT NOT NULL,
  source TEXT,
  period_from TEXT,
  period_to TEXT,
  size INTEGER NOT NULL,
  content_hash TEXT,
  summary_json TEXT NOT NULL,
  error_kind TEXT,
  r2_key TEXT
);
CREATE INDEX idx_import_inspection_files_inspection ON import_inspection_files(inspection_id);

-- 利用者 × 経路の種別 × 1 分の時間枠の回数。ログイン用の password_login_rate_limits とは分ける。
CREATE TABLE import_rate_limits (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('inspection','commit')),
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, window_start)
);

-- 取込 1 回の影響の値 (確定時の記録) と履歴の非表示の時刻。
ALTER TABLE import_runs ADD COLUMN file_count INTEGER;
ALTER TABLE import_runs ADD COLUMN row_count INTEGER;
ALTER TABLE import_runs ADD COLUMN added_count INTEGER;
ALTER TABLE import_runs ADD COLUMN skipped_count INTEGER;
ALTER TABLE import_runs ADD COLUMN subs_candidate_count INTEGER;
ALTER TABLE import_runs ADD COLUMN result TEXT CHECK(result IS NULL OR result IN ('success','partial','failed'));
ALTER TABLE import_runs ADD COLUMN keep_previous INTEGER CHECK(keep_previous IS NULL OR keep_previous IN (0,1));
ALTER TABLE import_runs ADD COLUMN hidden_at TEXT;
-- 同じ検査 ID の 2 本目以降の確定。親の run が取込 1 回の 1 行で、子は履歴に単独では出さない。
ALTER TABLE import_runs ADD COLUMN parent_run_id TEXT;
