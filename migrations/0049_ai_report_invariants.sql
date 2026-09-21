-- Migration number: 0047  AI分析レポートの一意性
--
-- 同じ利用者・型・期間の版番号は1回だけ。
-- 旧実装は件数から版を決めていたため、同時受信や古いfixtureに重複版があり得る。
-- 本文・作成順・参照を失わず、系列内を作成日時/id順に連番へ正規化してから制約を張る。
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, report_type, period_from, period_to
      ORDER BY created_at, id
    ) AS next_version
  FROM ai_reports
)
UPDATE ai_reports
SET version = (SELECT next_version FROM ranked WHERE ranked.id = ai_reports.id)
WHERE version <> (SELECT next_version FROM ranked WHERE ranked.id = ai_reports.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_reports_series_version
  ON ai_reports (user_id, report_type, period_from, period_to, version);

-- 旧DBに同じ task_id のレポートが複数あっても削除・参照変更はしない。
-- 今後の INSERT だけを trigger で止め、1依頼1レポートを非破壊で強制する。
CREATE TRIGGER IF NOT EXISTS trg_ai_reports_one_per_task
BEFORE INSERT ON ai_reports
WHEN EXISTS (SELECT 1 FROM ai_reports WHERE task_id = NEW.task_id)
BEGIN
  SELECT RAISE(ABORT, 'ai_reports task already has report');
END;
