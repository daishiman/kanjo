-- Migration number: 0018  AIレポートのアーカイブ
-- 目的: レポートは期限24時間で自然失効する依頼と違い、増える一方だった。
--       読み終わった版を一覧から畳めるように「archived_at」を持つ。
--       NULL = 通常表示。値が入っていれば一覧の既定では出さない(削除ではないので中身は残る)。

ALTER TABLE ai_reports ADD COLUMN archived_at TEXT;

-- 一覧は「アーカイブしていないものを新しい順」で引く。
CREATE INDEX idx_ai_reports_archived ON ai_reports(user_id, archived_at, created_at);
