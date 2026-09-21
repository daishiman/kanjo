-- Migration number: 0046  AI分析の依頼の段階 (待機中 / 実行中 / 完了 / 失敗 / キャンセル) と T-番号
--
-- 段階名と進捗 % は保存しない。core の aiTaskStage が次の時刻から毎回導く:
--   canceled_at (取り消し) → used_at (受信) → expires_at (期限) → rejected_at (差し戻し) → data_fetched_at (データ取得)。
-- seq は利用者ごとの通し番号で、画面の T-0001 の元になる。既存行は NULL のまま「旧 作成日」と表示する。
--
-- 追加のみ。既存の行は 1 行も書き換えない (更新 0 件)。ai_reports は変えない。
-- 一意索引は SQLite の規則で NULL どうしを重複とみなさないので、seq の無い既存行は何行あっても衝突しない。
ALTER TABLE ai_tasks ADD COLUMN seq INTEGER;
ALTER TABLE ai_tasks ADD COLUMN data_fetched_at TEXT;
ALTER TABLE ai_tasks ADD COLUMN rejected_at TEXT;
ALTER TABLE ai_tasks ADD COLUMN reject_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_tasks ADD COLUMN canceled_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_tasks_user_seq ON ai_tasks (user_id, seq);
