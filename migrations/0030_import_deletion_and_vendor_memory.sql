-- Migration number: 0030  取込データの削除・取り消しと、取引先ごとの決め事
--
-- 取り込んだデータを消せるようにする。ただし「消した」で終わらせない。
-- 消す前の姿を退避しておき、あとから元に戻せる状態を作る。
--
-- ここで足すのは4つ。
--   1. import_deletion_operations … 削除・取り消しの操作1回ぶんの記録(監査)
--   2. import_deleted_rows        … 消した行そのものの退避(1行につき1行)
--   3. import_deleted_targets     … 消したことで巻き戻す必要がある取込指紋の退避
--   4. vendor_memory              … 取引先ごとの「いつもの手当て」
-- あわせて tx_edits に、3点比較の基準値と明細の安定キーを足す。
--
-- 既存テーブルの作り直しはしない。ALTER TABLE ADD COLUMN だけを使う。
-- balance_entries / cash_entries に import_id を足さないこと。
-- 取込の削除で手入力の残高・現金が巻き添えになる道をここで作ってしまう。

-- ---------------------------------------------------------------------------
-- 1. 操作の記録
-- ---------------------------------------------------------------------------
-- 何を消したかを範囲(粒度・期間・取込ID)としてだけ持つ。
-- 明細の内容・金額はこのテーブルへ入れない(DR-9)。入れると監査ログを見せる導線が
-- そのまま明細の横流し経路になる。中身が要るときは import_deleted_rows を見る。
CREATE TABLE import_deletion_operations (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL,
  -- 'delete' は取込データの削除、'undo' はその取り消し
  kind          TEXT    NOT NULL CHECK (kind IN ('delete', 'undo')),
  granularity   TEXT    NOT NULL
    CHECK (granularity IN ('transaction', 'import', 'period', 'all')),
  -- 範囲の指定そのもの(JSON)。件数ではなく指定を残すので、あとから再現できる
  request_json  TEXT    NOT NULL,
  -- preflight で利用者に見せた対象集合の指紋。実行時に一致しなければ 409(DR-1)
  fingerprint   TEXT    NOT NULL,
  -- 消した件数の内訳(JSON)。画面と監査の両方がこの数字を使う
  counts_json   TEXT    NOT NULL DEFAULT '{}',
  -- この操作を取り消した操作のID。NULL なら未取り消し
  undone_by     TEXT,
  -- 退避行を捨ててよくなる時刻(D04: 既定30日)。過ぎた操作の undo は 410 を返す
  expires_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_deletion_operations_user
  ON import_deletion_operations (user_id, created_at);

-- 掃除ジョブは「期限切れで、まだ退避を消していない操作」だけを見る
CREATE INDEX idx_deletion_operations_expiry
  ON import_deletion_operations (expires_at)
  WHERE undone_by IS NULL;

-- ---------------------------------------------------------------------------
-- 2. 消した行の退避
-- ---------------------------------------------------------------------------
-- 消す前に必ずここへ書く(DR-2)。書いてから消す、の順を崩さない。
-- 逆順にすると、退避の途中で落ちたときに「消えたが戻せない」行が残る。
--
-- payload_json は行の全列をそのまま持つ。undo はこれを INSERT し直すだけで済む。
-- 明細の内容がここには入るが、このテーブルは undo 専用で、
-- 画面・ログ・エラー応答のどれからも中身を出さない(DR-9)。
CREATE TABLE import_deleted_rows (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT    NOT NULL,
  user_id      TEXT    NOT NULL,
  -- 戻し先のテーブル名。undo はこの名前で分岐する
  table_name   TEXT    NOT NULL,
  -- 元の行のID。文字列で持つ(mf_transactions は TEXT、他は INTEGER のため)
  row_id       TEXT    NOT NULL,
  -- 集計を作り直す対象月(DR-5)。行から月を引き直さずに済ませる
  month        TEXT,
  payload_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_deleted_rows_operation
  ON import_deleted_rows (operation_id, table_name);

-- 同じ操作で同じ行を二重に退避しない。undo の二重 INSERT を DB 側で止める
CREATE UNIQUE INDEX uq_deleted_rows_row
  ON import_deleted_rows (operation_id, table_name, row_id);

-- ---------------------------------------------------------------------------
-- 3. 取込指紋の退避(DR-4)
-- ---------------------------------------------------------------------------
-- import_active_targets は「現在適用中の指紋」しか持たない。履歴が無い。
-- そのため削除で行を消すと、巻き戻し先の値はどこからも得られなくなる。
-- 消す前の content_hash / import_id / updated_at をここへ写しておくのが唯一の道。
--
-- 粒度が import_deleted_rows と違う(あちらは明細1行、こちらは取込の対象キー1つ)ので
-- テーブルを分ける。同居させると、明細5,000行の削除で同じ指紋を5,000回複製し、
-- しかも行ごとに食い違った「巻き戻し先」を作れてしまう。
CREATE TABLE import_deleted_targets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id  TEXT    NOT NULL,
  user_id       TEXT    NOT NULL,
  target_key    TEXT    NOT NULL,
  -- 削除前の値。undo はこの3つをそのまま import_active_targets へ戻す
  content_hash  TEXT    NOT NULL,
  import_id     INTEGER NOT NULL,
  updated_at    TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX uq_deleted_targets_key
  ON import_deleted_targets (operation_id, target_key);

-- ---------------------------------------------------------------------------
-- 4. 取引先ごとの決め事
-- ---------------------------------------------------------------------------
-- 同じ取引先へ何度も同じ手当てをしているなら、次からは当てにいく。
-- ただし2回目で当てはじめると外し続けるので、件数と一致率の両方が要る(D01)。
--
-- hit_count と disagree_count を別々に持つのは、確信度を1つの数で持つと
-- 「1件中1件で 1.00」と「40件中40件で 1.00」が区別できなくなるため。
-- 割合は2つの数から毎回作る。画面へも割合ではなく件数で出す。
CREATE TABLE vendor_memory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT    NOT NULL,
  -- 表記ゆれを寄せた照合キー(core の normalizeVendorKey)
  vendor_key      TEXT    NOT NULL,
  -- 画面に出す元の表記。照合には使わない
  vendor_label    TEXT    NOT NULL DEFAULT '',
  cls             TEXT    CHECK (cls IS NULL OR cls IN ('biz', 'per')),
  category_major  TEXT,
  category_mid    TEXT,
  owner           TEXT    CHECK (owner IS NULL OR owner IN ('business', 'spouse', 'family')),
  hit_count       INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  disagree_count  INTEGER NOT NULL DEFAULT 0 CHECK (disagree_count >= 0),
  -- 利用者が明示的に留めた決め事。件数によらず当てる
  pinned          INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  -- 利用者が取り消した決め事。以後は当てない・候補にも出さない
  revoked         INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 1利用者・1取引先につき決め事は1つ。2つあると、どちらを当てるかが決まらない
CREATE UNIQUE INDEX uq_vendor_memory_key
  ON vendor_memory (user_id, vendor_key);

-- ---------------------------------------------------------------------------
-- 5. tx_edits の拡張
-- ---------------------------------------------------------------------------
-- 既に base_major / base_mid はある(取込時の大項目・中項目)。
-- 3点比較を属性ごとに行うには cls と owner の基準値も要る(DR-10)。
-- 無いままだと、種別・名義を直した明細が再取込のたびに衝突として上がってくる。
--
-- 既存行の base_cls / base_owner は NULL で入る。NULL は「基準が分からない」で、
-- 空欄とは違う。次の再取込で取込値を基準として埋める(D03 の遅延 backfill)。
ALTER TABLE tx_edits ADD COLUMN base_cls TEXT;
ALTER TABLE tx_edits ADD COLUMN base_owner TEXT;

-- 明細IDが変わっても手当てを見失わないための第二の鍵(DR-13)。
-- 第一の鍵は今までどおり tx_id。stable_key はそれが取れないときだけ使う。
ALTER TABLE tx_edits ADD COLUMN stable_key TEXT;
-- stable_key の作り方の版。作り方を変えたときに古い鍵を誤って照合しないための番号
ALTER TABLE tx_edits ADD COLUMN fingerprint_version INTEGER;

-- 第二の鍵での引き当て。UNIQUE にはしない。
-- 同じ日・同じ金額・同じ相手の明細は現実に複数あり、UNIQUE にすると手当てを保存できなくなる。
-- 鍵が重なった場合は「結び付けない」を選ぶ(core の indexEditsByStableKey)。
CREATE INDEX idx_tx_edits_stable_key
  ON tx_edits (user_id, stable_key)
  WHERE stable_key IS NOT NULL;
