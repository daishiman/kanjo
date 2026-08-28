-- Migration number: 0025  明細の分割記帳
--
-- 銀行から10万円が引き落とされている、という事実だけが明細に載っていて、
-- 中身が現金払いだと何にいくら使ったかがどこにも無い。
-- そこで「10万円のうち食品に3万、交通費に2万」と後から内訳を入れる。
--
-- 元の明細(mf_transactions)は消さない。銀行の記録そのものなので、必ず残す。
-- 集計するときだけ、元の1行を内訳N行に差し替える(core の applySplits)。
-- 両方数えると同じ支出を2回計上することになるため、差し替えは1箇所だけで行う。
--
-- 合計は元の金額と一致していなければならないが、その検査はアプリ側で行う。
-- 行を1つずつ入れ替える途中では一時的に合計が合わないので、
-- DBの制約にすると編集そのものができなくなる。
CREATE TABLE IF NOT EXISTS tx_splits (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT    NOT NULL,
  -- 元の明細のID(mf_transactions.tx_id)。分割は明細に付く
  tx_id          TEXT    NOT NULL,
  -- 並び替えやseq再利用に影響されない内訳行の安定ID(UUID)
  line_id        TEXT    NOT NULL,
  -- 同じ明細の中の並び。1から振る
  seq            INTEGER NOT NULL,
  -- 保存時の親金額。再取込で金額が変わった分割をfail-closedする
  parent_amount  INTEGER NOT NULL,
  -- 内訳の金額。常に正の整数(収入か支出かは元の明細の符号で決まる)
  amount         INTEGER NOT NULL,
  cls            TEXT    NOT NULL,
  category_major TEXT    NOT NULL,
  category_mid   TEXT    NOT NULL DEFAULT '',
  memo           TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);

-- 明細を開いたときに内訳を並び順で引く。
-- UNIQUE にしてあるのは、同じ明細に同じ並び番号が2行入ると順序が決まらなくなるため。
-- 引くためのインデックスと、壊れた状態を作らせないための制約を1つで兼ねる。
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_splits_tx ON tx_splits (user_id, tx_id, seq);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_splits_line ON tx_splits (user_id, line_id);
