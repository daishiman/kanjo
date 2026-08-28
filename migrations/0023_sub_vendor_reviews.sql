-- Migration number: 0022  サブスクの見直し記録(四半期レビュー)
-- サブスクは契約したまま忘れるのが最大の無駄なので、「いつ見直したか」を残す。
-- 最後の見直しから3ヶ月経った登録を「見直し対象」として画面に出すためだけに使う。
-- 登録済みの行は reviewed_at が NULL のまま = 一度も見直していない扱いになる。
ALTER TABLE sub_vendors ADD COLUMN reviewed_at TEXT;
