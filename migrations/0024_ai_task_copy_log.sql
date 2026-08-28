-- Migration number: 0023  AI指示文のコピー記録
-- 指示文を作っただけで貼り付け忘れた依頼と、貼り付けたのに結果が返っていない依頼は
-- 一覧上で見分けが付かない。いつ・どちらへ渡したかを1件だけ残して切り分ける。
-- 上書き方式(最後にコピーした操作が正)。NULL は一度もコピーしていない。
ALTER TABLE ai_tasks ADD COLUMN copied_at TEXT;
ALTER TABLE ai_tasks ADD COLUMN copied_target TEXT;
