-- AI分析の期間を「開始年月〜終了年月」の範囲に拡張する。
-- 旧列 period_kind / period_key は残し、period_from / period_to / report_type を正本にする。
-- ai_tasks は CHECK 制約(period_kind IN ('month','year'))を外すため作り直す(SQLite は CHECK を DROP できない)。
CREATE TABLE ai_tasks_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_kind TEXT NOT NULL DEFAULT 'range',
  period_key TEXT NOT NULL DEFAULT '',
  period_from TEXT NOT NULL,
  period_to TEXT NOT NULL,
  report_type TEXT NOT NULL,
  supplement TEXT,
  parent_report_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  report_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO ai_tasks_new (id, user_id, period_kind, period_key, period_from, period_to, report_type, token_hash, expires_at, used_at, report_id, created_at)
SELECT
  id, user_id, period_kind, period_key,
  CASE WHEN period_kind = 'year' THEN period_key || '-01' ELSE period_key END,
  CASE WHEN period_kind = 'year' THEN period_key || '-12' ELSE period_key END,
  CASE WHEN period_kind = 'year' THEN 'annual' ELSE 'monthly' END,
  token_hash, expires_at, used_at, report_id, created_at
FROM ai_tasks;
DROP TABLE ai_tasks;
ALTER TABLE ai_tasks_new RENAME TO ai_tasks;
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks (user_id, created_at);

-- ai_reports は列追加のみ。version は同じ期間・型の再分析で増える通し番号。
ALTER TABLE ai_reports ADD COLUMN period_from TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_reports ADD COLUMN period_to TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_reports ADD COLUMN report_type TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE ai_reports ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ai_reports ADD COLUMN parent_report_id TEXT;
UPDATE ai_reports SET
  period_from = CASE WHEN period_kind = 'year' THEN period_key || '-01' ELSE period_key END,
  period_to = CASE WHEN period_kind = 'year' THEN period_key || '-12' ELSE period_key END,
  report_type = CASE WHEN period_kind = 'year' THEN 'annual' ELSE 'monthly' END
WHERE period_from = '';
CREATE INDEX IF NOT EXISTS idx_ai_reports_type ON ai_reports (user_id, report_type, period_from, period_to);
