-- Migration number: 0006  現金の記帳・取込の内容指紋
-- 目的1: 口座やカードの明細に出ない現金の受け渡し(商工会議所の会議費など)を明細として記帳できるようにする。
--        事業分(side='biz')は freee 仕訳と同じ経路で科目別集計に合流し、個人分(side='per')は口座「現金」の明細として仕分け・家計集計に合流する。
-- 目的2: 取込ファイルの「内容」から作った指紋(SHA-256)を取込履歴に持ち、ファイル名が変わっていても同じ内容の再取込を検知する。
CREATE TABLE cash_entries (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  month TEXT NOT NULL,             -- 'YYYY-MM'(date から導出)
  side TEXT NOT NULL CHECK(side IN ('biz','per')),
  io TEXT NOT NULL CHECK(io IN ('income','expense')),
  amount INTEGER NOT NULL,         -- 正の整数(円)。向きは io で持つ
  description TEXT NOT NULL,       -- 内容・支払先(例: 〇〇商工会議所 定例会)
  category_major TEXT NOT NULL,    -- biz: freee 勘定科目 / per: MF 大項目
  category_mid TEXT NOT NULL DEFAULT '',  -- per のみ(biz は空)
  memo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_cash_month ON cash_entries(user_id, month);

-- 取込単位の内容指紋。同じ指紋の成功済み取込があれば重複として扱う(duplicate_of に元の取込ID)
ALTER TABLE imports ADD COLUMN content_hash TEXT;
ALTER TABLE imports ADD COLUMN duplicate_of INTEGER;
CREATE INDEX idx_imports_hash ON imports(user_id, content_hash);
