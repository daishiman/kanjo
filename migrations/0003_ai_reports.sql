-- AI分析レポート(spec §16 予定): 貼り付け用の指示文を発行し、Claude Code / Codex が API 経由で結果を返す。
-- ai_tasks: 1回分の依頼(期間 + 使い捨てトークンのハッシュ)。トークン原文は保存しない。
CREATE TABLE IF NOT EXISTS ai_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('month', 'year')),
  period_key TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  report_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks (user_id, created_at);

-- ai_reports: 受信したレポート本文(検証・無害化済みのJSON文字列)。
CREATE TABLE IF NOT EXISTS ai_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  period_kind TEXT NOT NULL,
  period_key TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_reports_user ON ai_reports (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_reports_period ON ai_reports (user_id, period_kind, period_key);
