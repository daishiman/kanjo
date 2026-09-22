-- Migration number: 0050  予算対象の期間別の年額表 (追加のみ)
--
-- 0050_budget_plans.sql : 予算画面 (spec-budget-screen) の保存先。
-- 既存の budgets 表 (科目ごとの月額) は書き換えずに残す。本 migration は新しい表を足すだけで、
-- 既存の行を書き換える文 (UPDATE・DELETE・表の作り直し) を含まない。
-- 主キーの前方一致 (user_id, period_start) で期間の読取りを引くので、索引は足さない。
-- 金額の範囲 (±10,000,000,000) は API の zod だけで検査し、DB には置かない (JSON 復元で古い値を入れられるように)。
CREATE TABLE budget_plans (
  user_id TEXT NOT NULL,
  period_start TEXT NOT NULL CHECK (period_start GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  account TEXT NOT NULL CHECK (length(account) BETWEEN 1 AND 60),
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  annual_amount INTEGER NOT NULL,
  plan_adjustment INTEGER NOT NULL DEFAULT 0,
  plan_reason TEXT CHECK (plan_reason IS NULL OR length(plan_reason) BETWEEN 1 AND 100),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, period_start, account)
);
