-- Migration number: 0046  決算書画面の負債入力: 項目ごとの状態と、保存の監査
--
-- 負債の手入力 4 項目は「未入力 / 0円 / 金額」の 3 状態を持つ。
-- 未入力は行を持たないことで表す (既存の UNIQUE(user_id, month, side, category) がそのまま 1 項目 1 状態を保証する)。
-- 残る 2 状態を見分けるため balance_entries に status を足す。既定は 'amount' で、既存行は 1 行も書き換えない。
-- 0046 より前に「0」を入れて保存した行は ('amount', 0) のまま残り、core が 0円 と同じ扱いで読む。
--
-- 監査は新表で持つ。既存の audit_log は action を CHECK で閉じており、広げるには表の再構築 (DROP と RENAME) が要る。
-- それは Deploy の自動適用判定で止まるうえ、行を書き換えない方針に反する。
-- changed_json には項目ごとの状態遷移と件数だけを入れ、金額は入れない。
--
-- 追加のみ。仕様とタスク仕様は 0045 と書いているが、main で 0045 が owner_labels に使われたため 0046 に繰り下げた。
ALTER TABLE balance_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'amount' CHECK (status IN ('zero', 'amount'));

CREATE TABLE IF NOT EXISTS liability_audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  month         TEXT NOT NULL CHECK (length(month) = 7),
  changed_json  TEXT NOT NULL,
  occurred_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liability_audit_log_user ON liability_audit_log (user_id, occurred_at);
