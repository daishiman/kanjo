-- Migration number: 0050  トレードオフ画面の開始月・メモと、候補ごとの必要度の上書き
--
-- 試算の記録に開始月とメモを足し、見直し候補ごとに利用者が決めた必要度とメモを残す表を作る。
-- 追加だけで、既存の記録は 1 列も変えない (新しい列は既存行で NULL になる)。
-- need の値域 (low / mid / high / NULL) は既存表の流儀に合わせて API の zod で守る。
ALTER TABLE tradeoff_plans ADD COLUMN start_month TEXT;
ALTER TABLE tradeoff_plans ADD COLUMN memo TEXT;

CREATE TABLE tradeoff_candidate_notes (
  user_id TEXT NOT NULL,
  candidate_key TEXT NOT NULL,
  need TEXT,
  memo TEXT,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX tradeoff_candidate_notes_user_key ON tradeoff_candidate_notes (user_id, candidate_key);
