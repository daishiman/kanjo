-- 取込データの手当てを2つ広げる。append-only migration。
--
-- 1) tx_edits.institution … 明細1件の口座(保有金融機関)の振替。
--    base_* を持たないのは、口座が stable_key(DR-13)の材料そのものだからである。
--    取込側で口座が変われば別の明細として入るので、3点比較にかける相手がいない。
--    取込値は mf_transactions.institution が常に持っているため、表示の突き合わせはそこで足りる。
--
-- 2) tx_splits.owner … 内訳1行ごとの名義。NULL は「元の明細の名義に従う」。
--    妻と家族で分け合う引き落としを、分割と名義の二重運用なしに1回で表せるようにする。
ALTER TABLE tx_edits ADD COLUMN institution TEXT;

ALTER TABLE tx_splits ADD COLUMN owner TEXT
  CHECK (owner IS NULL OR owner IN ('business', 'spouse', 'family'));
