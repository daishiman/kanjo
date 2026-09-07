-- Migration number: 0036  重複の「同じ / 違う」判断を保存する
--
-- トータル収支の一覧表は、freee と MF の二重計上を消し込んだ上で数を出す。
-- 消し込みの機械判定 (発生日 + 金額) で決まらない組だけが要確認として残り、
-- そこを閉じられるのは利用者の判断だけである。導出できない値はこれ1つなので、
-- 保存するのもこれ1つに限る。月次の合計・件数・トレンドは保存しない
-- (保存すると、取込のやり直しで原本が変わったときに古い合計が残る)。
--
-- 鍵は tx_edits と同じ (user_id, tx_id)。MF が再出力のたびに ID 列を振り直すことがあるため、
-- 第二の鍵として stable_key を併せ持つ (DR-13)。stable_key は衝突しうるので UNIQUE にしない。
-- 版が違う鍵を誤って突き合わせないよう fingerprint_version も持つ。
CREATE TABLE duplicate_verdicts (
  user_id             TEXT    NOT NULL,
  tx_id               TEXT    NOT NULL,
  verdict             TEXT    NOT NULL CHECK (verdict IN ('same', 'different')),
  stable_key          TEXT,
  fingerprint_version INTEGER,
  -- 判断した時刻。監査のために残す。更新時も最初の値を保つ
  decided_at          TEXT,
  updated_at          TEXT,
  PRIMARY KEY (user_id, tx_id)
);

-- tx_id が変わった明細を stable_key から引き直すための索引。
CREATE INDEX idx_duplicate_verdicts_stable_key
  ON duplicate_verdicts (user_id, stable_key);
