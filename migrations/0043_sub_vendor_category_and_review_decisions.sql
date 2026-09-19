-- Migration number: 0043  サブスク画面のカテゴリ上書きと、見直し候補への判断
--
-- 追加だけを行う。既存の行は書き換えず、backfill もしない。
--
-- ## category を sub_vendors の列に持つ理由
--
-- カテゴリは既定辞書 (core の SUBS_CATEGORY_DICTIONARY) から毎回導く。保存するのは利用者が上書きした
-- ときだけで、NULL は「辞書に従う」。辞書を直したとき、上書きしていないベンダーはそのまま新しい辞書に従う。
--
-- ## 判断を別表に持つ理由
--
-- 見直し候補は規則 (dup / spike / priceUp / overlap / reviewDue) から毎回導く。保存するのは利用者の判断だけ。
-- rule_fingerprint = 当たった規則の種類 (表示順) + 判定時の基準金額。月は含めない。
-- 指紋が変わる (新しい規則が当たる・金額が変わる) と dismissed は効かなくなり、候補が再び出る。
-- 1 利用者 1 ベンダーにつき 1 行で、保存は upsert、取消は行の削除。
-- user_id は既存の sub_vendors (0005) と同じ TEXT にそろえる。
ALTER TABLE sub_vendors ADD COLUMN category TEXT;

CREATE TABLE IF NOT EXISTS sub_vendor_review_decisions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL,
  -- core の vendorKey (表記ゆれを吸収した照合キー)
  vendor_key       TEXT NOT NULL,
  decision         TEXT NOT NULL CHECK (decision IN ('confirmed', 'dismissed')),
  rule_fingerprint TEXT NOT NULL,
  decided_at       TEXT NOT NULL,
  UNIQUE (user_id, vendor_key)
);
