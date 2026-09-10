-- Migration number: 0038  R2 cleanupを特定機能から切り離す
--
-- Release Aで、実objectのkeyと既存の取込原本削除intentを用途中立な
-- outboxへ退避する。旧テーブルは互換性のため今回は残す。R2 DELETEは後続Workerが
-- 処理前に旧2表のlate writeも台帳へ再同期してから冪等に行い、将来の別Releaseでの物理削除に備える。

CREATE TABLE r2_cleanup_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('import_original', 'retired_attachment')),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'retry', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  not_before TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, r2_key)
);

CREATE INDEX idx_r2_cleanup_due ON r2_cleanup_jobs(state, not_before, id);

-- 旧deadはそのままだと定期processorの対象外になる。Release Aで一度だけ
-- retryへ戻し、試行回数とbackoffをresetして取りこぼしなく再処理する。
INSERT OR IGNORE INTO r2_cleanup_jobs
  (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
SELECT user_id,r2_key,
       CASE WHEN reason='import_retention' THEN 'import_original' ELSE 'retired_attachment' END,
       CASE WHEN state='dead' THEN 'retry' ELSE state END,
       CASE WHEN state='dead' THEN 0 ELSE attempts END,
       CASE WHEN state='dead' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE not_before END,
       CASE WHEN state='dead' THEN NULL ELSE last_error END,
       created_at,
       CASE WHEN state='dead' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE updated_at END
  FROM attachment_cleanup_jobs;

-- 台帳に未登録の全証憑objectも補完し、metadata削除後もkeyを失わない。
INSERT OR IGNORE INTO r2_cleanup_jobs
  (user_id,r2_key,purpose,state,attempts,not_before,last_error,created_at,updated_at)
SELECT user_id,r2_key,'retired_attachment','pending',0,
       strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL,created_at,
       strftime('%Y-%m-%dT%H:%M:%fZ','now')
  FROM attachments;
