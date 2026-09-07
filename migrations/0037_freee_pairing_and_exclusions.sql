-- Migration number: 0037  どの freee 取引と組むかの名指しと、freee 側の二重登録の除外
--
-- 0036 は「同じ / 違う」だけを保存していた。これで足りるのは、候補が 1 件しかない場合に限る。
-- 同じ日に同じ額の freee 取引が 2 件あるとき、「同じ」と言われても機械はどちらとも読める。
-- 利用者が選んだ相手を保存できなければ、次に開いたときにまた別の相手へ寄りうる。
-- そこで freee_key (取引の内容から作る安定鍵。配列の位置は再取込で動くので使えない) を併せ持つ。
-- NULL を許すのは、候補が 1 件しかない大半の判断で名指しを必須にしないため。
ALTER TABLE duplicate_verdicts ADD COLUMN freee_key TEXT;

-- freee 側に同じ支払が 2 回登録されていることがある。これは MF との突合では消せない。
-- 突合は「MF と freee のどちらを正とするか」の話で、こちらは「freee の中に重複がある」話であり、
-- 別の問題なので別の表に置く。既定はあくまで freee が正で、ここに行があるものだけを総額から外す。
--
-- reason を NOT NULL にするのは、後から見て理由の分からない除外を残さないため。
-- 金額が合わない原因を追うとき、外した根拠が読めないと元へ戻す判断ができない。
CREATE TABLE freee_deal_exclusions (
  user_id    TEXT NOT NULL,
  -- 取引の内容から作る安定鍵 (v1:freee:<canonical>#<n>)。位置ではなく内容で指す
  freee_key  TEXT NOT NULL,
  reason     TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (user_id, freee_key)
);
