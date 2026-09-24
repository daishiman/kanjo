-- Migration number: 0057  改善リクエスト画面(状態の張り替え・利用者ごとの連番・論理削除・アクティビティ)
--
-- 仕様 (specs/spec-improvement-screen.md「データモデル」) は 0053 と書くが、0053 は取込画面
-- (0053_import_inspections.sql)、0054〜0056 は設定画面が先に使った。番号だけを 0057 に進め、内容は仕様のとおりである。
--
-- SQLite は CHECK を後から替えられないので、improvement_requests を作り直す (0026 と同じ手順)。
-- 他の表から improvement_requests を参照する外部キーは無いので、退避表は要らない。
-- アクティビティの表は外部キーで新しい表を参照するため、名前を付け替えた後に作る。
--
-- 既存の行・画像のキー・トークンのハッシュは 1 件も落とさない。
--   status  : wontfix は done へ移し、done_at が NULL ならこの migration の時刻を入れる
--             (NULL のまま done にすると、夜間の添付削除の起点が無くなるため。適用直後に消えないよう今を起点にする)
--   title   : NULL を許す。既存行の値は残す。新規行は NULL
--   seq     : 利用者ごとに作成順 (created_at, id) で 1 から振る
--
-- 禁止事項 (0029 から続く): 以下の 3 表を packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL の列挙対象へ追加しない。
CREATE TABLE improvement_requests_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- 利用者ごとの連番。IMP-024 の形で表示する。削除しても再利用しない
  seq INTEGER NOT NULL CHECK (seq >= 1),
  title TEXT CHECK (title IS NULL OR length(trim(title)) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  route TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'reconfirm')),
  screenshot_key TEXT,
  screenshot_size INTEGER CHECK (screenshot_size IS NULL OR screenshot_size >= 0),
  diagnostics_json TEXT,
  diagnostics_omitted INTEGER NOT NULL DEFAULT 0 CHECK (diagnostics_omitted >= 0),
  token_hash TEXT UNIQUE,
  token_expires_at TEXT,
  token_fetch_count INTEGER NOT NULL DEFAULT 0 CHECK (token_fetch_count >= 0),
  copied_at TEXT,
  copied_target TEXT CHECK (copied_target IS NULL OR copied_target IN ('claude_code', 'codex')),
  done_at TEXT,
  purged_at TEXT,
  -- 論理削除の時刻。NULL は削除中でない。夜間 job が 30 日を過ぎた行を画像・履歴ごと消す
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, seq)
);

INSERT INTO improvement_requests_new (
  id, user_id, seq, title, body, route, status,
  screenshot_key, screenshot_size, diagnostics_json, diagnostics_omitted,
  token_hash, token_expires_at, token_fetch_count, copied_at, copied_target,
  done_at, purged_at, deleted_at, created_at, updated_at
)
SELECT
  id,
  user_id,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id),
  title,
  body,
  route,
  CASE status WHEN 'wontfix' THEN 'done' ELSE status END,
  screenshot_key, screenshot_size, diagnostics_json, diagnostics_omitted,
  token_hash, token_expires_at, token_fetch_count, copied_at, copied_target,
  CASE WHEN status = 'wontfix' AND done_at IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE done_at END,
  purged_at,
  NULL,
  created_at,
  updated_at
FROM improvement_requests;

-- 移した行の履歴を書くため、wontfix だった id を控える (新しい表では done と区別できない)
CREATE TABLE improvement_wontfix_migrated (id TEXT PRIMARY KEY);
INSERT INTO improvement_wontfix_migrated (id) SELECT id FROM improvement_requests WHERE status = 'wontfix';

DROP TABLE improvement_requests;
ALTER TABLE improvement_requests_new RENAME TO improvement_requests;

CREATE INDEX idx_improvement_requests_user
  ON improvement_requests (user_id, created_at);

-- 添付削除ジョブは「完了済みで、まだ添付を消していない行」だけを見る (0029 と同じ)
CREATE INDEX idx_improvement_requests_purge
  ON improvement_requests (status, done_at)
  WHERE purged_at IS NULL;

-- 完全消去ジョブは「論理削除から 30 日を過ぎた行」だけを見る
CREATE INDEX idx_improvement_requests_deleted
  ON improvement_requests (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 利用者ごとの最後の seq。削除しても戻さない。作成時に依頼の行と同じ batch でだけ更新する
CREATE TABLE improvement_request_counters (
  user_id TEXT PRIMARY KEY,
  last_seq INTEGER NOT NULL CHECK (last_seq >= 0)
);

INSERT INTO improvement_request_counters (user_id, last_seq)
SELECT user_id, max(seq) FROM improvement_requests GROUP BY user_id;

-- 1 行 1 事実の追記専用。本文・トークン・診断は入れない。依頼の行が消えると一緒に消える
CREATE TABLE improvement_request_activities (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES improvement_requests (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('created', 'status_changed', 'reissued', 'deleted', 'restored', 'migrated_wontfix')),
  from_status TEXT CHECK (from_status IS NULL OR from_status IN ('open', 'in_progress', 'done', 'reconfirm')),
  to_status TEXT CHECK (to_status IS NULL OR to_status IN ('open', 'in_progress', 'done', 'reconfirm')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_improvement_request_activities_request
  ON improvement_request_activities (request_id, created_at);

-- 既存行の作成の履歴。時刻は行の created_at。状態は移行前の値が残らないので、作成時の既定 open とする
INSERT INTO improvement_request_activities (id, request_id, user_id, kind, from_status, to_status, created_at)
SELECT lower(hex(randomblob(16))), id, user_id, 'created', NULL, 'open', created_at
FROM improvement_requests;

INSERT INTO improvement_request_activities (id, request_id, user_id, kind, from_status, to_status, created_at)
SELECT lower(hex(randomblob(16))), r.id, r.user_id, 'migrated_wontfix', NULL, 'done', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM improvement_requests r
JOIN improvement_wontfix_migrated m ON m.id = r.id;

DROP TABLE improvement_wontfix_migrated;
