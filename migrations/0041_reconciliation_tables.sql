-- Migration number: 0041  照合画面の「MF 明細の除外」と「直前の操作 (元に戻す)」
--
-- 照合の状態 (未処理・要確認・照合済み・除外) は明細と判断から毎回導出する派生物で、表には持たない。
-- 表に残すのは利用者の判断だけ: 「この MF 明細は突合から外す」と「いつ何をまとめて判断したか」。
-- 月次レビューは 0040 の monthly_close_reviews をそのまま使い、ここでは作らない。
--
-- 既存の duplicate_verdicts (0036) と freee_deal_exclusions (0037) の列は変えない。CREATE だけで戻し不要。

-- MF 明細を突合から外す。総額からは外さない (外すのは「照合の相手探し」だけ)。
-- tx_id が振り直されたときは stable_key で引き直す (duplicate_verdicts と同じ規則)。
CREATE TABLE IF NOT EXISTS mf_tx_exclusions (
  user_id             TEXT NOT NULL,
  tx_id               TEXT NOT NULL CHECK (length(tx_id) BETWEEN 1 AND 120),
  stable_key          TEXT,
  fingerprint_version INTEGER,
  reason              TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  created_at          TEXT NOT NULL,
  PRIMARY KEY (user_id, tx_id)
);
CREATE INDEX IF NOT EXISTS idx_mf_tx_exclusions_stable_key ON mf_tx_exclusions (user_id, stable_key);

-- まとめて行った判断 1 回ぶんの記録。before_json に直前の行を持ち、取り消しはそれを書き戻す。
-- 明細本文の写しは持たない (判断表の行 = tx_id・鍵・判断・理由だけ)。
CREATE TABLE IF NOT EXISTS reconciliation_actions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('same', 'different', 'exclude-mf', 'exclude-freee')),
  target_count INTEGER NOT NULL CHECK (target_count BETWEEN 1 AND 200),
  before_json  TEXT NOT NULL,
  after_json   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  undone_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_actions_user_created ON reconciliation_actions (user_id, created_at);
