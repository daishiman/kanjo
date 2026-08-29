-- Migration number: 0027  確定申告での科目の扱い(決算書への割り当て・家事按分)
-- 目的: 帳簿の科目名は正規化後の名前(例「サブスク・通信」)で、青色申告決算書の欄と一致しない。
--       また自宅家賃・携帯代は全額が経費ではなく、事業割合で按分する必要がある。
--       この2つはどちらも「この科目を申告でどう扱うか」という同じ問いなので、
--       設定を2つのテーブルに割らず1行にまとめる。
--
--       行が無い科目は未確認として申告額へ入れず、readinessをblockedにする。
--       全額事業でも利用者が100%を確認して明示INSERTすることで、後日の再現性を保つ。
--
--       basis(按分の根拠)を金額と同じ行に置くのは、税務調査で聞かれるのが率ではなく根拠だから。
--       別の場所に置くと、数年後に「この30%は何」を誰も再現できない。

CREATE TABLE tax_account_settings (
  user_id TEXT NOT NULL,
  -- 対象の申告年。過去年の再exportを後年の設定変更から分離する
  tax_year INTEGER NOT NULL,
  -- 帳簿上の科目名(正規化後)。data.biz.categories の要素
  account TEXT NOT NULL,
  -- 転記先の決算書科目。NULL = 未割当(申告額に入れず、画面で要対応として出す)
  tax_account TEXT,
  -- 家事按分の事業割合(0..100)。按分なしも100を明示し、NULLの多義性を持ち込まない
  business_percent INTEGER NOT NULL DEFAULT 100,
  -- 按分率の根拠(例: 作業部屋 6畳 / 全体 30畳)
  basis TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tax_year, account),
  CHECK (typeof(tax_year) = 'integer' AND tax_year BETWEEN 2000 AND 2099),
  CHECK (length(account) BETWEEN 1 AND 60),
  CHECK (typeof(business_percent) = 'integer' AND business_percent BETWEEN 0 AND 100)
);
