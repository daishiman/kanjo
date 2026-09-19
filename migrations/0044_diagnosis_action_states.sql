-- Migration number: 0043  診断画面の「改善アクションの判断」
--
-- 改善余地そのもの (どの科目がいくら超過しているか) は明細から毎回計算し直す派生物で、表には持たない。
-- 表に残すのは利用者の判断だけ: 「この改善余地をどう扱うと決めたか」「その理由」「いつ決めたか」。
-- 判断の宛先は action_key = '<検知器 id>:<対象キー>' で、検知の実装が変わっても同じ対象なら同じ鍵になる。
--
-- 仕様書 (specs/spec-diagnosis-screen.md) は利用者 ID 列を持たない設計だが、既存の全表が user_id を持ち
-- API も c.get('userId') でスコープしている。ID を持たないと利用者間で判断が混ざるため、
-- ここでは user_id を足し PRIMARY KEY を (user_id, action_key) とする (仕様からの明示的な逸脱)。
--
-- 改善余地が一時的に検知されなくなっても行は消さない。再び検知されたときに判断が戻る (BR-008)。

CREATE TABLE IF NOT EXISTS diagnosis_action_states (
  user_id    TEXT NOT NULL,
  action_key TEXT NOT NULL CHECK (length(action_key) BETWEEN 1 AND 200),
  status     TEXT NOT NULL CHECK (status IN ('未着手', '対応中', '対応済み', '見送り')),
  note       TEXT CHECK (note IS NULL OR length(note) <= 500),
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, action_key)
);
