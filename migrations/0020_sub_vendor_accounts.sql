-- Migration number: 0020  サブスク支払先の対象勘定科目
-- 登録した支払先を「この勘定科目のときだけ数える」で絞れるようにする。
-- accounts は対象勘定科目の原本名(account_raw)の JSON 配列。'[]' なら従来どおり全科目を数える。
-- 適用済み環境の旧normalized labelは、読み取り時の互換照合と設定更新時のraw移行で維持する。
-- Amazon のように物販とサブスクが同じ取引先名で混ざる支払先を、科目で切り分けるための列。
ALTER TABLE sub_vendors ADD COLUMN accounts TEXT NOT NULL DEFAULT '[]';
