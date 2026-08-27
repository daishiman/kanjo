-- MF「収入・支出詳細」CSVの列をレコードを捨てずに保存できるようにする。
-- 目的: これまでパーサが 計算対象!=1 / 振替=1 の行を破棄していたため、
--       取込元CSVに存在する明細がDBに残らなかった。行を落とさず、
--       集計対象かどうかはカラムの値で判定する形へ移す。
-- 既存行は「計算対象=1 かつ 振替=0」の行だけが入っているため、DEFAULT がその実態と一致する。

ALTER TABLE mf_transactions ADD COLUMN memo TEXT;
ALTER TABLE mf_transactions ADD COLUMN is_target INTEGER NOT NULL DEFAULT 1;
ALTER TABLE mf_transactions ADD COLUMN is_transfer INTEGER NOT NULL DEFAULT 0;

-- 集計は「計算対象=1 かつ 振替=0」だけを見る。全行保存後もこの経路が痩せないよう部分インデックスを張る。
CREATE INDEX idx_mftx_active_month
  ON mf_transactions(user_id, month)
  WHERE is_target = 1 AND is_transfer = 0;
