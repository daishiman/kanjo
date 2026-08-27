-- Migration number: 0015  freee 未決済(未入金・未払)の一覧
-- 目的: freee の取引は「発生」と「決済」が別で、支払日が空のままの取引は未決済のまま残る。
--       期日を過ぎた未払は延滞、期日を過ぎた未入金は回収漏れだが、どちらも損益からは見えない
--       (損益は発生ベースで既に計上済み)。期日の側から並べ直すための列をここで持つ。

ALTER TABLE freee_deals ADD COLUMN due_date TEXT;        -- 支払期日(YYYY-MM-DD)
ALTER TABLE freee_deals ADD COLUMN settled_date TEXT;    -- 支払日。NULL = 未決済
ALTER TABLE freee_deals ADD COLUMN settle_account TEXT;  -- 支払口座
ALTER TABLE freee_deals ADD COLUMN settled_amount INTEGER;

-- 上の4列は「列が無いエクスポート」でも「列はあるが空欄」でも NULL になる。
-- この2つを取り違えると、決済列の無い時期に取り込んだ仕訳が全件「未決済」に見える。
-- そのため取込時点で列があったかどうかを、この1列に明示して持ち越す。
-- 既存行は決済列の無い時期の取込なので既定 0(未決済判定の対象外)。
ALTER TABLE freee_deals ADD COLUMN settlement_known INTEGER NOT NULL DEFAULT 0;

-- 未決済の一覧は「支払日が空のものを期日順」で引く。
CREATE INDEX idx_deals_settlement ON freee_deals(user_id, settlement_known, settled_date, due_date);
