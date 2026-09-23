-- Migration number: 0052  現金明細の名義・業務の目的・論理削除
--
-- 追加だけを行う。既存行は1件も書き換えない(backfill 0件)。
-- owner           : 名義。NULL は「未設定」(旧画面で記帳した行)。値は OWNER_VALUES の3値だけ。
-- transit_purpose : 交通費の業務の目的。固定候補の文字列か「その他:<記述>」。区間の無い行は NULL。
-- deleted_at      : 論理削除の時刻(ISO 8601)。NULL = 有効。夜間 job が30日を過ぎた行を完全に消す。
ALTER TABLE cash_entries ADD COLUMN owner TEXT CHECK (owner IS NULL OR owner IN ('business', 'spouse', 'family'));
ALTER TABLE cash_entries ADD COLUMN transit_purpose TEXT;
ALTER TABLE cash_entries ADD COLUMN deleted_at TEXT;

-- 利用者ごとの有効行の読取(deleted_at IS NULL)で使う。
CREATE INDEX IF NOT EXISTS idx_cash_user_deleted ON cash_entries(user_id, deleted_at);

-- 夜間の完全消去は利用者を限定せず、期限切れを deleted_at, id の順で最大500件読む。
-- user_id 始まりの索引ではこの走査を支えられないため、purge専用の並びを持つ。
CREATE INDEX IF NOT EXISTS idx_cash_deleted_purge ON cash_entries(deleted_at, id);
