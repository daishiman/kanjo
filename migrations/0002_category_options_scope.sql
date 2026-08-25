-- 候補科目に系統(scope)を持たせる: biz=freee 勘定科目(決算書の科目) / per=MF 大項目・中項目(家計の内訳)
-- 既存行は MF 由来の候補として登録されていたため 'per' を既定にする。
ALTER TABLE category_options ADD COLUMN scope TEXT NOT NULL DEFAULT 'per' CHECK (scope IN ('biz', 'per'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_options_key ON category_options (user_id, scope, major, mid);
