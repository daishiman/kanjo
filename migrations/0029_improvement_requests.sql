-- Migration number: 0029  改善要望(投稿・スクリーンショット・診断情報・使い捨てトークン)
--
-- 画面から出した改善要望を1行で持つ。スクリーンショットの実体は R2、D1 にはキーだけを置く。
-- 診断情報はマスク済みの JSON をそのまま列へ入れる(件数・総バイトの上限が掛かった後の値)。
--
-- token_hash は SHA-256 のハッシュだけを保存する。原文はこの DB のどの列にも入らない。
-- 指示文へ載せた原文は発行時の1回だけ画面へ返し、以後は再発行(=ハッシュの置換)で対応する。
--
-- 禁止事項: このテーブルを packages/api/src/store.ts の BACKUP_SNAPSHOT_SQL の列挙対象へ追加しない。
-- 追加すると、対応完了から30日での添付削除がバックアップ側で最大30日ぶん骨抜きになる。
CREATE TABLE improvement_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  -- 発生していた画面のパス。原因の再現に効くので残す(クエリはマスク済み)
  route TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'wontfix')),

  -- 添付。削除済みは NULL になる(行そのものは残す)
  screenshot_key TEXT,
  screenshot_size INTEGER CHECK (screenshot_size IS NULL OR screenshot_size >= 0),
  diagnostics_json TEXT,
  -- 上限で捨てた診断の件数。画面にも指示文にも出す(黙って捨てないため)
  diagnostics_omitted INTEGER NOT NULL DEFAULT 0 CHECK (diagnostics_omitted >= 0),

  -- 使い捨てトークン。原文は保存しない
  token_hash TEXT UNIQUE,
  token_expires_at TEXT,
  token_fetch_count INTEGER NOT NULL DEFAULT 0 CHECK (token_fetch_count >= 0),

  -- 指示文を最後にコピーした日時と貼り付け先。上書き方式(ai_tasks と同じ)
  copied_at TEXT,
  copied_target TEXT CHECK (copied_target IS NULL OR copied_target IN ('claude_code', 'codex')),

  -- 対応完了時刻。ここが30日削除の起点になる
  done_at TEXT,
  -- 添付を実際に削除した時刻。NULL は未削除
  purged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_improvement_requests_user
  ON improvement_requests (user_id, created_at);

-- 削除ジョブは「完了済みで、まだ添付を消していない行」だけを見る
CREATE INDEX idx_improvement_requests_purge
  ON improvement_requests (status, done_at)
  WHERE purged_at IS NULL;
