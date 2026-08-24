-- Migration number: 0000  spec-v1.1 §7.2
-- MF明細(公私仕分け対象)
CREATE TABLE mf_transactions (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  month TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category_major TEXT,
  category_mid TEXT,
  institution TEXT,
  import_id INTEGER REFERENCES imports(id),
  UNIQUE(user_id, tx_id)
);
CREATE INDEX idx_mftx_month ON mf_transactions(user_id, month);

-- freee仕訳
CREATE TABLE freee_deals (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  date TEXT NOT NULL,
  io TEXT NOT NULL CHECK(io IN ('income','expense')),
  partner TEXT,
  account_raw TEXT,
  account_norm TEXT,
  amount INTEGER NOT NULL,
  memo TEXT,
  import_id INTEGER REFERENCES imports(id)
);
CREATE INDEX idx_deals_month ON freee_deals(user_id, month, io);

-- 仕分けルール(sort_order 昇順で先勝ち)
CREATE TABLE rules (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  cls TEXT NOT NULL CHECK(cls IN ('biz','per')),
  sort_order INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 手動判定
CREATE TABLE overrides (
  user_id TEXT NOT NULL,
  tx_id TEXT NOT NULL,
  cls TEXT NOT NULL CHECK(cls IN ('biz','per')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, tx_id)
);

-- 予算 / 現金補正 / 未記帳月 / 科目正規化
CREATE TABLE budgets (user_id TEXT, account TEXT, monthly_amount INTEGER, PRIMARY KEY(user_id, account));
CREATE TABLE cash_overrides (user_id TEXT, month TEXT, revenue INTEGER, expense INTEGER, PRIMARY KEY(user_id, month));
CREATE TABLE unrecorded_months (user_id TEXT, month TEXT, kind TEXT CHECK(kind IN ('expense','revenue')), PRIMARY KEY(user_id, month, kind));
CREATE TABLE account_norm_map (user_id TEXT, raw TEXT, norm TEXT, PRIMARY KEY(user_id, raw));

-- 取込履歴
CREATE TABLE imports (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT,
  kind TEXT CHECK(kind IN ('freee','mf','json')),
  months TEXT,
  row_count INTEGER,
  status TEXT,
  r2_key TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 月次集計キャッシュ(取込・仕分け変更時に再生成)
-- scope: biz_rev / biz_exp:{科目} / per_inc:{中項目} / per_exp:{大項目} / biz_personal_in / biz_personal_out
--        + 拡張: subs:{vendor} / subs_other (サブスクベンダー行列の永続化)
CREATE TABLE monthly_agg (
  user_id TEXT,
  month TEXT,
  scope TEXT,
  amount INTEGER,
  PRIMARY KEY(user_id, month, scope)
);

-- FR-09 やりくり試算の保存(言いっぱなし防止)
CREATE TABLE tradeoff_plans (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  amount INTEGER NOT NULL,
  recurring INTEGER NOT NULL DEFAULT 0,
  selected TEXT,
  covered INTEGER,
  verdict TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 科目正規化の初期値(単一ユーザー 'default')
INSERT INTO account_norm_map (user_id, raw, norm) VALUES
  ('default', '支払手数料', 'サブスク・通信'),
  ('default', '通信費', 'サブスク・通信');
