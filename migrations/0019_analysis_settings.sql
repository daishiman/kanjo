-- Migration number: 0019  統計指標の基準月数(利用者ごとの設定)
-- 目的: 平均・標準偏差・移動平均・固定費/変動費の判定に必要な月数は 6ヶ月固定だった。
--       記帳の粒度は人によって違う(毎月きっちり入れる人と、四半期でまとめる人)ので、
--       設定画面から変えられるようにする。既定は今までどおり 6。
--       行が無い利用者は既定値(6)として扱うので、初期化のための INSERT は不要。

CREATE TABLE analysis_settings (
  user_id TEXT PRIMARY KEY,
  stat_min_months INTEGER NOT NULL DEFAULT 6,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
