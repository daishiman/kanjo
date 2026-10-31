# 明細仕分けの一括保存: 設計の決定 (feat-classify-bulk-save)

本書は spec-classify-bulk-save (`specs/spec-classify-bulk-save.md`) を実装へ落とすときの決定を、
task ごとの節にまとめる。前サイクル (feat-classify-screen) の決定は
[`design-decisions.md`](design-decisions.md) にあり、本書はそれを書き換えない。

## 文書の担当と進め方

### 2 文書の節の担当

| 文書 | 節 | 担当 task | 中身 |
|---|---|---|---|
| bulk-save-decisions.md (本書) | §1 | P01 | 要求 id の担当表・未決事項と OI の対応・置き換える契約と引き継ぐ契約・変えない値 |
| | §2 | P02 | 解決関数・行の key・上限の定数・予算・対応表・『カテゴリなし』・提案の入力の一本化 |
| | §3 | P03 | 既存コードとの照合・行番号の古さ・grep の結果・判定の置き場 |
| | §4 | P05 | 実装で決めた細部と、OI-1・OI-4 の依頼文 |
| | §5 | P12 | 未決事項の閉じ方の記録 |
| [bulk-save-evidence.md](bulk-save-evidence.md) | §1 | P04 | 先に書いたテストと、旧実装で落ちることの記録 |
| | §2 | P06 | 全テストと verify:full の結果 |
| | §3 | P08 | 旧い定義の削除と migration の突き合わせ |
| | §4 | P09 | 品質ゲートの結果 |
| | §5 | P13 | リリース前の最終確認 |

### head branch と PR の単位

- head branch は `devgraph/feat-classify-bulk-save`。13 task を 1 本の feature PR で出す。
- 各 task は直前の task の先端から作り、fast-forward で進める。task ごとの PR は作らない。
- P13 の merge で、13 task の completion_evidence `linked_pr_merged_all` を同時に満たす。
- SPEC_BASE: **利用者の指示待ち**。commit・push・PR は利用者の指示があるまで行わない。
  基準にする commit は現 HEAD の `9b5bbf3` (origin/main と同じ)。spec・architecture・task 仕様書は未 commit のまま作業木にある。

## §1 要求の担当と契約の境界 (P01)

### 要求 id の担当表

列の意味: 「テスト」は P04 で先に書くテスト、「実装」は満たす task、「確認」は受入や検査で確かめる task。
P07 は全 AC の根拠の表を作るため、AC の「確認」には常に P07 が入る (表では省く)。

#### 機能要件

| id | 要旨 | テスト | 実装 | 確認 |
|---|---|---|---|---|
| FR-01 | 一括指定欄 (区分・大・中・所有者・支払い方法) | P04 | P05 | P07 |
| FR-02 | 値の解決の順 | P04 | P02 (設計)・P05 | P07 |
| FR-03 | 区分とカテゴリの組 | P04 | P02 (設計)・P05 | P07 |
| FR-04 | 保存前の内訳 | P04 | P05 | P07 |
| FR-05 | 画面とサーバで同じ解決関数 | P04 | P02 (設計)・P05 | P07・P10 |
| FR-06 | 一括保存 API (1 回の batch) | P04 | P05 | P07・P10 |
| FR-07 | 選択の保持 (sel) | P04 | P05 | P07 |
| FR-08 | 選べない行 | P04 | P02 (設計)・P05 | P07 |
| FR-09 | 見出しの全選択の 50 件での停止 | P04 | P05 | P07 |
| FR-10 | 選択の読み出し API | P04 | P05 | P07・P10 |
| FR-11 | 一覧 API から `transactions` を外す | P04 | P05 | P07・P08 |
| FR-12 | 取引一覧の 6 列・表示件数・ページ送り | P04 | P05 | P06・P07 |
| FR-13 | 編集パネルの可変幅 | P04 | P05 | P06 |
| FR-14 | 提案の最後の由来 | P04 | P02 (設計)・P05 | P07 |
| FR-15 | 明細の再試行 | P04 | P05 | P07 |
| FR-16 | 要求全体の失敗の分類 | P04 | P05 | P07 |
| FR-17 | 勘定科目の対応表 | P04 | P02 (設計)・P05 | P07・P12 |
| FR-18 | 『カテゴリなし』の予約の値 | P04 | P02 (設計)・P05 | P07・P10 |
| FR-19 | 画面検査 `KANJO_VISUAL_SCOPE=classify` | P04 | P05 | P06 |

#### ビジネスルール

| id | 要旨 | テスト | 実装 | 確認 |
|---|---|---|---|---|
| BR-01 | 値の解決の順 | P04 | P05 | P07 |
| BR-02 | 区分とカテゴリは 1 組 | P04 | P05 | P07 |
| BR-03 | 外す行 | P04 | P05 | P07 |
| BR-04 | 『カテゴリなし』の扱い | P04 | P05 | P07・P10 |
| BR-05 | 最後の由来は候補が空のときだけ・信頼度 60 | P04 | P05 | P07 |
| BR-06 | 個人の明細の提案 | P04 | P05 | P07 |
| BR-07 | 事業の明細の提案 | P04 | P05 | P07 |
| BR-08 | 提案を付けない明細 | P04 | P05 | P07 |
| BR-09 | 対応表の行の検証 | P04 | P05 | P07・P10 |
| BR-10 | 対応表の初期の 5 行 | P04 | P05 | P07・P08 |
| BR-11 | 選択 1〜50・一括 1〜100・重複は 400 | P04 | P05 | P07・P10 |
| BR-12 | 下書きの値の検証 | P04 | P05 | P07・P10 |
| BR-13 | 履歴は変わった項目だけ・同じ op_id | P04 | P05 | P07・P10 |
| BR-14 | 冪等・取引先の記憶を書かない | P04 | P05 | P07 |
| BR-15 | KPI・バッジ・月次クローズは既存の関数 | P04 | P05 (変えない) | P07 |

#### 受入条件

| id | 要旨 | テスト | 実装 | 確認 |
|---|---|---|---|---|
| AC-01 | 提案なしの 3 件を一括指定で保存 | P04 | P05 | P07 |
| AC-02 | 解決関数の順 | P04 | P05 | P07 |
| AC-03 | 区分だけの指定と『カテゴリなし』 | P04 | P05 | P07 |
| AC-04 | 外す行と理由 | P04 | P05 | P07 |
| AC-05 | 『カテゴリなし』の集計 | P04 | P05 | P07 |
| AC-06 | batch の失敗は 200 で全件 write_failed | P04 | P05 | P07 |
| AC-07 | write_failed の明細だけを再試行 | P04 | P05 | P07 |
| AC-08 | 通信の失敗・5xx と『同じ内容で再試行』 | P04 | P05 | P07 |
| AC-09 | 409 と『同じ内容で再試行』 | P04 | P05 | P07 |
| AC-10 | 400・403・413 は再試行なし | P04 | P05 | P07 |
| AC-11 | 個人の『MF の分類』 | P04 | P05 | P07 |
| AC-12 | 事業の『MF の分類 (対応表)』 | P04 | P05 | P07 |
| AC-13 | 提案を付けない明細 | P04 | P05 | P07 |
| AC-14 | 集計ルールが当たる個人の明細 | P04 | P05 | P07 |
| AC-15 | 既存の由来の順位と信頼度は不変 | P04 | P05 (変えない) | P07 |
| AC-16 | 対応表の初期の行・履歴・設定画面 | P04 | P05 | P07 |
| AC-17 | 設定の JSON 版 1 と旧いバックアップ | P04 | P05 | P07 |
| AC-18 | ページをまたぐ選択の保存 | P04 | P05 | P07 |
| AC-19 | 選べない行の理由 | P04 | P05 | P07 |
| AC-20 | 全選択の 50 件での停止 | P04 | P05 | P07 |
| AC-21 | 表示外の明細の引き直し・`transactions` なし | P04 | P05 | P07 |
| AC-22 | 1264px と 1280px の画面検査 | P04 | P05 | **P06** |
| AC-23 | 401・403・400 の 8 種 | P04 | P05 | P07・P10 |
| AC-24 | 256KB 超は 413 payload_too_large | P04 | P05 | P07・P10 |
| AC-25 | 他の利用者のものは見つからない扱い | P04 | P05 | P07・P10 |
| AC-26 | 履歴は変わった項目ごとに 1 行 | P04 | P05 | P07・P10 |
| AC-27 | 50 件と 100 件で 49 本以内 | **P04** | **P05** | P07 |
| AC-28 | 予算超過は書く前に 413 | P04 | P05 | P07 |
| AC-29 | 2 回送っても同じ | P04 | P05 | P07 |
| AC-30 | 品質ゲートが全て exit 0 | P06 (verify:full) | — | **P09** |

非機能要件 (D1 の予算・batch の上限・上限の定数・本文の大きさ・性能・初期 JS 予算・品質ゲート・表示・アクセシビリティ・税務・費用) は
AC-24・AC-27・AC-28・AC-30 と P08 (上限の定数の整理)・P09 (初期 JS 予算) で確かめる。

### 未決事項と open item の対応

| spec の未決事項 | open item | 決める task | 閉じる task | 閉じ方 |
|---|---|---|---|---|
| 1. 章の旧い文言 | OI-5 | — | P12 (記録) | 次の system-spec の改訂へ持ち越し、P12 が持ち越しを記録する |
| 2. 利用者が確かめていない細部 (表示件数 50・key 200 字・旧形式の受け付け) | OI-1 | P05 (依頼文) | P12 | 章の値で実装し、確認の依頼文を §4 に置く。P12 が回答か持ち越しを記録する |
| 3. C07 の low・info | OI-5 | — | P12 (記録) | 同上 (次の改訂) |
| 4. C06 の medium 2 件 | OI-5 | — | P12 (記録) | 同上 (次の改訂) |
| 5. 対応表の API のパスと表・列の名前 | OI-2 | P02 (案) | P12 | P05 が実装し、P12 が `docs/data-schema.md` と architecture 文書に書いて閉じる |
| 6. 『カテゴリなし』の字面 | OI-3 | P02 (案) | P05 | 候補の作成の拒否のテストが通った時点で閉じる |
| 7. 新しい持ち主へ初期の 5 行を入れる時機 | OI-4 | P05 (依頼文) | P12 | 経路が無いことを記録し、依頼文を §4 に置く |
| (spec 外) migration の番号 | OI-6 | P05 | P13 | P05・P08・P13 が番号・承認の sha256・EXPECTED を突き合わせる |
| (spec 外) ci.yml は画面検査を走らせない | OI-7 | — | P13 | P06・P13 が verify:full で確かめ、別 feature の候補として返す |
| (spec 外) 49 本以内 | OI-8 | P04 (テスト) | P05 | AC-27 のテストが緑になった時点で閉じる |

### 置き換える契約と引き継ぐ契約

前サイクル (`specs/spec-classify-screen.md`・`docs/classify-screen/design-decisions.md`) の契約のうち、
本 feature が置き換えるものと、そのまま引き継ぐものを分ける。前サイクルの文書は書き換えない。

置き換える契約:

| 契約 | 前サイクル | 本 feature |
|---|---|---|
| 値の決め方 | web の 2 か所 (`inputFromRow`・`resolveBulkItem`) がそれぞれ決める。`resolveBulkItem` は状態を見ずに提案を使う | core の 1 つの解決関数。未整理は 一括指定→下書き→提案、確定済みは 一括指定→下書き→今の値 |
| 書き込みの単位 | 明細ごとの文を並べる | json_each で束ねた 1 回の batch (全件か無し) |
| 再試行 | 失敗した明細をまとめて再送 | write_failed の明細だけ。要求全体の失敗は status で分ける |
| 一覧の列と表示件数 | 列が多く、表示件数は固定 | 6 列、表示件数 25・50・100 (既定 50)、ページ送り |
| 一覧 API の互換 | 応答に絞り込み後の全件 `transactions` を含む | `transactions` を外し、選択の中身は選択の読み出し API が返す |

引き継ぐ契約 (変えない): 画面の骨格 (KPI・絞り込み・一覧・編集パネルの 3 段)、KPI の数え方、絞り込み、
編集パネル (個別編集)、分割、ルールの作成と適用、下書き (localStorage)。

### スコープ外の制約と変えない値

features/feat-classify-bulk-save.context.json の scope_out を制約として転記する。

1. 選択の上限 (URL の sel 50 件) と一括保存の上限 (100 件) の変更
2. 要確認の閾値 80 と、既存の由来 (記憶・ルール・MF 中項目の対応表) の順位と信頼度の変更
3. 分割・ルール作成・ルール適用・削除と取消・保存フィルタの仕様変更
4. 絞り込み結果の全件 (表示外のページを含む) を一度に選ぶ操作
5. 取込 (CSV の読み込み) の仕様変更、証憑の添付と保管
6. モバイル・タブレット・デスクトップ専用アプリ
7. Workers Paid などの有料プランへの変更

変えない値: 選択の上限 **50**、一括保存の上限 **100**、既存の由来の信頼度 **95** (ルール・取引先)・**85** (ルール・キーワード)・**70** (MF 中項目)、
要確認の閾値 **80**。新しい由来の信頼度 60 は、この 4 つを動かさずに下へ足す。

## §2 実装の設計 (P02)

### 値の解決関数 (FR-02・FR-03・FR-05・BR-01〜03)

core に `packages/core/src/classify-bulk.ts` を新しく置き、画面の内訳とサーバの保存の両方がこれを呼ぶ。

入力:

| 引数 | 中身 |
|---|---|
| `bulk` | 一括指定 `{cls?, big?, mid?, owner?, paymentMethod?}` (指定した項目だけを持つ) |
| `draft` | 明細の下書き (同じ形。無ければ undefined) |
| `suggestion` | 提案 (`classifySuggestion` の結果。無ければ null) |
| `current` | 今の解決値 (`resolveTx` の cls・big・mid・owner) |
| `status` | 分類の状態 (`unclassified`・`review` は未整理、`done`・`manual` は確定済み) |
| `paymentMethod` | `row.edit.paymentMethod` (保存済みの支払い方法) |
| `candidates` | カテゴリの候補 (区分と系統が合うかを見る) |

出力: `{ok: true, item, sources}` か `{ok: false, reason}`。`item` は保存する値、`sources` は項目ごとの出所
(`bulk`・`draft`・`suggestion`・`current`・`no_category`)、`reason` は外す理由。

解決の順:

- 未整理: 一括指定 → 下書き → 提案。
- 確定済み: 一括指定 → 下書き → 今の値 (提案で手の値を置き換えない)。
- 支払い方法: 状態によらず 一括指定 → 下書き → `row.edit.paymentMethod`。どれも無ければ送らない。

区分とカテゴリの組 (BR-02):

- 大を指定したら、中は一括指定の中 (無ければ空)。区分は一括指定 → 下書き → (提案か今の値) の順で決め、大と系統が合わなければ外す。
- 区分だけを指定したら、埋める値の候補 (下書き → 提案か今の値) のうち区分が同じ最初の組を取る。どこにも無ければ『カテゴリなし』。
- 上の 2 行の「提案か今の値」は、すぐ上の解決の順に従い、未整理なら提案、確定済みなら今の値と読む (spec の UC-3 の括弧書きと同じ)。
  未整理の明細では、カテゴリの組を今の値から取らない。今の値の組は取込値 (MF の大・中) で、人の判断も区分の候補の検査も経ていないため。
  区分と所有者は今の値 (明細の区分) を残す。提案も下書きも無い未整理に所有者だけを一括指定したときも、組は埋める値のどこにも無いので『カテゴリなし』にする (spec の用語集の『カテゴリなし』の定義どおり)。
  当初の実装はこの 2 行を「提案があれば提案、無ければ今の値」と読み、提案の無い未整理の取込値の組を保存していた。P07 の匿名サンプル (`samples/`) で sel に 50 件を選んだ再現で見つけ、P05 (解決関数) と P04 (テストの欠け) へ差し戻して直した (`bulk-save-acceptance.md` §2)。

外す行 (外した行は要求に入れず、失敗に数えない):

| 条件 | 理由の文言 |
|---|---|
| 大だけを指定し、明細の区分と系統が合わない | 『指定したカテゴリ (大) が明細の区分に合いません』 |
| 確定済みで、保存する値が今の値と同じ | 『変わる値がありません』 |
| 未整理で、一括指定・下書き・提案のどれも無い | 『埋める値がありません』 |

この関数は web の `inputFromRow` (`packages/web/src/pages/classify/view-model.ts:98-100`) と `resolveBulkItem` (同 :309-327) の分岐を置き換える。

### 行の key と選べない行 (FR-07・FR-08)

- key はサーバ (`packages/api/src/classify-row.ts:64`) が作る形のまま: `split:${lineId}` か `${rowKind}:${txId}` (rowKind は `cash`・`mf`)。
- core に次の 2 つを置く。
  - `parseRowKey(key)`: 形を検査して `{kind, id}` を返す。200 字を超える key、接頭辞の無い key は null。
  - `rowSelectability({rowKind, splitState})`: 選べるなら null、選べないなら理由を返す。
    - `rowKind === 'split'` → 『分割後の内訳は「内訳を編集」からまとめて変更してください』
    - `splitState` が非 null (`amount_conflict`・`identity_unstable`) → 『分割の設定を直してから保存してください』
- key の接頭辞だけでは判定しない。不正な分割の親の行も `mf:` で始まるため。

### D1 の上限の定数 (NFR 上限の定数)

`packages/api/src/d1-limits.ts` に 2 つの名前を足す。

| 名前 | 値 | 意味 |
|---|---|---|
| `D1_INVOCATION_QUERY_LIMIT` | 50 | 1 回の Worker 起動で出せるクエリの合計 (batch 内の文も数える)。受け付けるのは 49 本まで |
| `D1_BATCH_STATEMENT_LIMIT` | 50 | 1 回の batch に入れる文の数 |

一括保存の本文の上限は D1 の上限ではないので、route の側に名前を置く (P10 の指摘 B で足した。§4「レビューの差し戻しで直したこと」)。

| 名前 | 値 | 置き場 | 意味 |
|---|---|---|---|
| `BULK_BODY_MAX_BYTES` | `256 * 1024` (262144) | `packages/api/src/routes/classify-bulk.ts:61` | 本文の上限 (AC-24)。超える本文は読む前に 413 `payload_too_large`。221 行の `settingsBodyLimit` に渡す |

境界は `classify-bulk-save.integration.test.ts` の「本文は 262144 バイト (256KB ちょうど) まで読み、262145 バイトは 413 (AC-24 の境界)」が確かめる。

置き換える 4 か所 (参照を移すのは P05、旧い定義を消すのは P08):

| 今の定義 | 置き換え先 |
|---|---|
| `D1_FREE_QUERY_LIMIT` (`packages/api/src/import-lifecycle.ts:305`) | `D1_INVOCATION_QUERY_LIMIT` |
| `SCHEDULED_D1_QUERY_LIMIT` (`packages/api/src/scheduled-maintenance-budget.ts:13`) | `D1_INVOCATION_QUERY_LIMIT` |
| `CLASSIFY_BATCH_STATEMENTS` (`packages/api/src/routes/classify.ts:90`) | `D1_BATCH_STATEMENT_LIMIT` |
| `MAX_BATCH_STATEMENTS` (`packages/api/src/routes/classify-bulk.ts:44`) | `D1_BATCH_STATEMENT_LIMIT` |

### 一括保存の書き込みと予算 (FR-06・AC-27・AC-28・OI-8)

1 回の `database.batch([...])` で書き、全件か無しにする。

| 段 | 文 | 本数 |
|---|---|---|
| 明細の上書きの削除 | `DELETE FROM tx_edits WHERE user_id=? AND tx_id IN (SELECT value FROM json_each(?))` | 1 |
| 明細の上書きの書き込み | `insertJsonRows` (全列。列と関数は `tx-edit-codec.ts` に置く) | 分割数ぶん |
| 履歴の書き込み | `insertJsonRows` (列: id・tx_id・changed_at・field・before_value・after_value・source・confidence・op_id。user_id は固定値) | 分割数ぶん |
| 写しの無効化 | `invalidateJsonSnapshotQuery` (`packages/api/src/import-active.ts:60`) を `rawStatement` で文にする | 1 |
| 月次集計の入れ替え | `planClassifyMutation` (`packages/api/src/routes/classify.ts:98`、export する) の集計を `rawStatement` で文にする | 2 |

- JSON は 1 文 80KB で分割する (1 文の上限 100KB の内側)。
- 見積もりは 100 件で約 28 本 (書き込み約 9 本 + 読み込み約 19 本)。49 本以内に収まる。
  - P05 の後の台帳の read は 15 本: loadDataset (分割の内訳・対応表を含む `LOAD_DATASET_QUERY_COUNT_WITH_SPLITS` = 11 本) + 現金明細 1 + vendor_memory 1 + category_options 1 + distinct freee account 1。
    初めの台帳は現金明細の 1 本を数えず 14 本だった (P10 の指摘 E。§4「レビューの差し戻しで直したこと」)。
  - 読む段は合計でなく 1 対 1 で数える。合計だけを比べると、lease の最悪値 (普段は使い切らない) の余りに read の見積り不足が隠れるため。
    「台帳の read は、一括保存が書く前に読むクエリの実数と一致する」が実数と台帳の read を突き合わせる。
  - 100 件 (メモ 200 字・本文 72011B) の実測は 26 本 (P10 のレビューの probe)。
- `BULK_SAVE_QUERY_LEDGER` に段ごとの本数を置き、countingDatabase (`subs-merge-operations.integration.test.ts:224` の書き方) で実測と突き合わせる (AC-27)。
- 見積もりが 49 本を超える要求は、書く前に 413 `too_many_classify_changes` を返す (results を持たない。AC-28)。
- batch が失敗したら 200 で全件 `write_failed` にする (AC-06)。
- 書き込みは `aggregateReplacementQueries` (`packages/api/src/store.ts:2041`) の json_each の書き方を再利用する。

### 勘定科目の対応表 (FR-17・BR-09・BR-10・OI-2)

**agent の案** (spec の未決事項 5 が実装者に委ねる)。

| 項目 | 決定 |
|---|---|
| 表 | `tax_account_map (user_id, category_big, tax_account, created_at, updated_at)`、主キー `(user_id, category_big)` |
| API | `GET /api/settings/tax-account-map` (一覧)、`POST /api/settings/tax-account-map` (`{categoryBig, taxAccount}`)、`DELETE /api/settings/tax-account-map/:categoryBig` (URL エンコードした大項目) |
| route | `packages/api/src/routes/tax-account-map.ts`。`settingsScreenRoute` と同じ fence (認証 → パスワード変更 → schema → canonicalMutationFence) |
| 検証 | 大項目は trim 後 1〜60 字・『カテゴリなし』を拒む。対応先は `TAX_ACCOUNTS` (32 件) の名前に限る。同じ大項目の 2 行目は 400 `duplicate_category` |
| 応答 | 200 `{rows: [{categoryBig, taxAccount}]}` (大項目の名前順)。他の利用者の行と無い行の削除は 404 `not_found` |
| 変更履歴 | `settings_change_log` に target `tax_account_map`、target_key は大項目、before・after は `{categoryBig, taxAccount}` の JSON。行と履歴を 1 回の batch で書く |
| fence | `'tax_account_map'` を `SETTINGS_SCREEN_CONSUMERS` (`canonical-mutation-fence.ts:66`) と `JSON_SNAPSHOT_MUTATION_CONSUMERS` (`import-active.ts:10`) に足す |
| 設定の JSON | 版 2 で `taxAccountMap` を持つ。版 1 と対応表を持たない旧いバックアップは初期の 5 行に読み替える |

migration (2 本。spec の 0058・0059 は予定番号で、main に 0058 があるため 1 つずらす。OI-6):

- `0059_tax_account_map.sql`: 表を作り、既存の持ち主 `'default'` (`TENANT_ID`、`packages/api/src/auth.ts:36`) に初期の 5 行を入れる (`0000_init.sql:97` と同じ書き方)。
  初期の行の履歴は、履歴の種類を足す 0060 が `origin='migration'`・`changed_by='system'` で 5 行書く (architecture database 章 CBS-DB-06。§4 に経緯)。
- `0060_settings_change_log_target.sql`: `settings_change_log` の target の CHECK に `'tax_account_map'` を足す。SQLite は CHECK を変えられないので表を作り直す (破壊的)。
  `.github/migration-approvals.json` に sha256 を足し、PR の merge を承認とする。
- `EXPECTED_D1_MIGRATION` (`packages/api/src/schema-guard.ts:4`) を `0060_settings_change_log_target.sql` に上げる。

初期の 5 行: 通信費→通信費、水道・光熱費→水道光熱費、交通費→旅費交通費、交際費→接待交際費、日用品→消耗品費。

### 『カテゴリなし』の予約の値 (FR-18・BR-04・OI-3)

**agent の案** (spec の未決事項 6 が実装者に委ねる)。

core に `packages/core/src/no-category.ts` を新しく置く。

```ts
export const NO_CATEGORY = 'カテゴリなし';
/** 画面で見分けがつかない書き方も予約の値とみなす (P10 の指摘 C で足した) */
export const isNoCategory = (v: string | null | undefined): boolean => {
  if (!v) return false;
  // 書式の文字 (\p{Cf}。ゼロ幅スペースなど) を除き → NFKC で半角カナと分解した濁点を寄せ → 前後の空白を除いて比べる。
  // 集計は明細ごとに呼ぶので、判定は名前ごとに覚える (上限 1024 件を超えたら捨てて作り直す)
  return v.replace(/\p{Cf}/gu, '').normalize('NFKC').trim() === NO_CATEGORY;
};
/** 集計では未分類として数える。空の値は読み替えない (総収支が取込値へ戻すため) */
export const categoryForTotals = (big: string) => (isNoCategory(big) ? '未分類' : big);
```

通す箇所:

| 箇所 | 扱い |
|---|---|
| `resolveTx` (`packages/core/src/classify.ts:198`) | 上書きの大が NO_CATEGORY ならそのまま返す (中は空、出所は手動) |
| 分類の状態 | 手動 (`manual`)。提案が NO_CATEGORY を返すことは無いので一致しない |
| 家計の集計 (`packages/core/src/classify.ts:414` の `r.big \|\| '未分類'`) | `categoryForTotals` を通す。説明可能率 (`analysis.ts:787` の `exp['未分類']`) もここから直る |
| 総収支の内訳 (`packages/core/src/total-cashflow.ts:789`) | `categoryForTotals` を通す。家計の集計の台帳もここから得る |
| 支出の見通し (`packages/core/src/expense-projection.ts:122-123`) | `categoryForTotals` を通す |
| 候補の検査 `categoryAllowed` (`packages/core/src/categories.ts:118`) | 候補に無い値として弾く。ルール・分割の内訳・取引先の記憶・現金の記録のように新しく値を受ける窓口が使う |
| 今の値を送り返す保存 `categoryAllowedOrKept` (`packages/core/src/categories.ts:138`) | 今の値も予約の値で、中項目が空のときだけ通す (メモだけを直す保存が 400 にならないように)。今の値は、取込値・ルール・上書きを解決した値 (一覧の行の値で、画面が送り返す値) を指し、上書きの層だけではない (指摘 H)。使うのは個別の編集 (`routes/classify.ts:578`)・一括保存の下書き (`packages/core/src/classify-bulk.ts:195`)・一覧の行の「区分に合わない科目」の判定 (`classify-row.ts:170`) の 3 か所だけ |
| 入力の拒否 | PUT /edit の big は 400、一括指定の big は 400 `invalid_body`、下書きの big は `invalid_item` (PUT と下書きは、今の値が予約の値でないとき)、候補の作成 (`routes/settings.ts:500`) と対応表の大項目は 400。ルール・分割の内訳・取引先の記憶・現金の記録は 400 `invalid_category` |
| 履歴・バックアップ | 値をそのまま残す (読み替えない)。復元の検査が予約の値を拒まないことを P05 で確かめる |

一覧の絞り込み `category=未分類` (`diagnosis-detectors.ts:487`) に含めるかは P05 で確かめて §4 に書く。

### 提案の最後の由来 (FR-14・BR-05〜08)

`classifySuggestion` (`packages/core/src/classify-status.ts:279`) の candidates が空のときだけ、新しい由来を足す。衝突の判定は働かせない。

| 明細 | 提案 | 由来 | 根拠文 |
|---|---|---|---|
| 個人 | `{per, tx.big, tx.mid, owner}` | `mf_category` (表示『MF の分類』) | 『MFの分類をそのまま提案』 |
| 個人で集計ルール (取引先) が当たる | `{per, vendorRule.norm, '', owner}`。値が個人の候補に無ければ付けない | 集計ルールと同じ表示 | 集計ルールの名前 |
| 事業 | `{biz, 対応表の勘定科目, '', owner}`。対応表に行が無ければ付けない | `mf_category_map` (表示『MF の分類 (対応表)』) | 『<大項目> → <勘定科目>』 |

- 信頼度は定数 `MF_CATEGORY_CONFIDENCE = 60` (70 より下、閾値 80 未満なので要確認)。
- 区分と所有者は今の解決値 (`resolveTx` の cls・owner)、大・中は取込値 (`tx.big`・`tx.mid`) を使う。
- 付けない明細: `tx.big` が空か『未分類』、分割の内訳行。
- 冪等 (AC-29): 2 回目は今の値が保存済みの値になるが、提案は取込値から作るので変わらず、status も同じ。
- 区分の決まり方 (`resolveIncomingTx`: ルール → 記憶 → 中項目 → 既定 `per`) のため、事業の対応表から提案するのは主に手で区分を事業にした明細になる。AC-12 のテストは上書き `cls=biz` で作る。

### 提案の入力の一本化

- `SuggestionContext = {rules, vendorMemories, normRules, taxAccountMap, categoryCandidates}` を core に置き、`classifySuggestion(tx, resolved, ctx)` の形にする。
- 6 か所の呼び出しを、api の 1 つの組み立て関数 (`suggestionContextFor(dataset, taxAccountMap)`) で揃える:
  `overview.ts:254`・`:339`、`classify-row.ts:52`・`:151`、`routes/classify-bulk.ts:155`、`routes/classify.ts:514`。
- `legacyBasisLabel` (`overview.ts:265`) を消し、根拠の表示は候補を作る 1 か所で作る。`RecommendationBasis` (`overview.ts:199`) は `SuggestionBasis` の別名にする。

### 共通部品と route の注記

新しい共通部品は作らず、既存のものを使う。

| 部品 | 置き場 | 使い方 |
|---|---|---|
| `errorBody` | `public-validation.ts:6` | 全てのエラー応答 |
| `PRIVATE_NO_STORE` | `public-validation.ts:11` | 全ての応答のヘッダ |
| `publicJsonValidator` | `public-validation.ts:18` | 対応表の POST (400 `invalid_request`) |
| `canonicalWriteBusy` | `canonical-mutation-fence.ts:14` | 409 |
| `rawStatement` | `routes/settings.ts:51` | Drizzle の文を batch に入れる。export して共有する |
| `insertJsonRows` | `import-lifecycle.ts:615` | json_each で束ねた INSERT |
| `planClassifyMutation` | `routes/classify.ts:98` | 月次集計の入れ替え。export する |
| app.onError の 503 `d1_overloaded` | `index.ts` | 既存のまま |

fence の順: authGuard (401) → mustChangePasswordFence (403) → runtimeSchemaGuard (503) → canonicalMutationFence (409) → bodyLimit (413) → zod (400)。

`index.ts` の注記「未適用と保証できるのは 1 batch の route だけ」に、一括保存 (`POST /api/transactions/bulk`) を足す。

## §3 既存コードとの照合 (P03)

### 決定の根拠

| 決定 | 根拠の id |
|---|---|
| 解決の順と外す行 | FR-02・FR-03・BR-01〜03・AC-02〜04 |
| 1 回の batch と予算 | FR-06・NFR (D1 の予算・batch の上限)・AC-06・AC-27・AC-28 |
| 上限の 2 つの名前 | NFR (上限の定数) |
| 対応表の表・API・migration | FR-17・BR-09・BR-10・AC-16・AC-17・未決事項 5 |
| 『カテゴリなし』 | FR-18・BR-04・AC-05・AC-23・未決事項 6 |
| 最後の由来 | FR-14・BR-05〜08・AC-11〜15 |
| 選べない行 | FR-08・AC-19 |

### spec の行番号の古さ

spec の参照のうち、今のコードとずれているもの (spec は書き換えず、本書で読み替える):

| spec の参照 | 今の位置 |
|---|---|
| `packages/api/src/store.ts:1937` (aggregateReplacementQueries) | `:2041` |
| `packages/api/src/import-lifecycle.ts:304` (D1_FREE_QUERY_LIMIT) | `:305` |

### 食い違いと読み替え

- **400 の code**: `publicJsonValidator` は形の不正を 400 `invalid_request` で返す。spec の一括保存は 400 `invalid_body` を 3 種に限る。
  このため一括保存では `publicJsonValidator` を使わず、route の中で zod の safeParse を行い `invalid_body` を返す。対応表の POST は `publicJsonValidator` のまま (`invalid_request`)。
- **migration の番号**: spec の 0058・0059 は予定番号。main に `0058_subscription_merge_operations.sql` があるため、0059・0060 にずらす (OI-6)。

### 共通部品を新設していないことの確認

次の grep で、同じ役割の部品が増えていないことを P05 の後に確かめる (P08 でも再確認する):

```bash
grep -rnE "function (rawStatement|insertJsonRows|errorBody)|const (rawStatement|insertJsonRows|errorBody) *=" packages/api/src --include=*.ts | grep -v test
```

設計の時点 (P03) の結果: `errorBody` (public-validation.ts:6)・`rawStatement` (routes/settings.ts:51)・`insertJsonRows` (import-lifecycle.ts:615) の 1 件ずつ。

### 判定の置き場 (各 1 か所)

| AC | 判定 | 置き場 |
|---|---|---|
| AC-23 | 選択 51 件・key の重複・一括 101 件・txId の重複・予約の値 | 選択は `selectedKeysSchema`、一括は `bulkSaveSchema` (どちらも api の 1 つのファイル)。予約の値は core の `isNoCategory` を zod の refine から呼ぶ |
| AC-24 | 256KB 超 | 一括保存の route の `bodyLimit` |
| AC-25 | 他の利用者のもの | 明細の引き直しと対応表の読み出しの `user_id` 条件 (見つからなければ not_found) |
| AC-28 | 予算超過 | 一括保存の route で `assertQueryBudget` 相当の見積もりを書く前に 1 回 |
| AC-29 | 冪等 | 書き込みの前に、保存する値と今の値を比べて履歴を作る 1 つの関数 |

## §4 実装で決めた細部 (P05)

### 対応表の初期の行の履歴

- §2 の初版は「初期の行の履歴は作らない」と書いていたが、承認済みの architecture database 章 (CBS-DB-06) と適用後の確認項目
  (「対応表の種類の変更履歴が 5」) は 0060 で `origin='migration'` の履歴を 5 行作ると決めている。上流の architecture と矛盾していたので architecture に従い、§2 を直した。
- 0056 が 0054 の集計ルールを `origin='migration'` で履歴にした前例と同じ形にする。作成なので before は NULL、after は API と同じ `{categoryBig, taxAccount}` の JSON。
  seq は利用者ごとの最後の seq に `ROW_NUMBER()` を足して続ける。
- 0059 の時点の CHECK は `tax_account_map` を許さないので、履歴は CHECK を張り替えた 0060 の最後に書く。

### 対応表の API の細部

spec の「API: 勘定科目の対応表」と §2 の表が決めていない細部を、次のとおり決めた (`packages/api/src/routes/tax-account-map.ts`)。

| 項目 | 決定 | 理由 |
|---|---|---|
| 400 の code | 1 行の検査の不正は `invalid_request` に `fields` (`{categoryBig?, taxAccount?}`、値は core の `TaxAccountMapRowIssue`) を付ける。重複は `duplicate_category`、行数の超過は `too_many_rows` | 欄ごとの理由は画面が欄の横に出す。設定画面の 400 と同じ `invalid_request` に揃え、集合で決まる 2 種だけを別の code にする |
| 行数の上限 | 200 行 (`TAX_ACCOUNT_MAP_ROWS_MAX`)。200 行に達したら追加を 400 `too_many_rows` で止める | 設定の JSON の復元 (`validateSettingsInput` の `too_many`) と同じ数で止め、経路で上限が食い違わないようにする |
| 行の識別子 | 大項目そのものを URL エンコードして `DELETE …/:categoryBig` に渡す。`/`・`%`・中黒も 1 つの識別子として往復する | 主キーが `(user_id, category_big)` なので、別の id 列を足さない。Hono が param を復号する |
| 本文の上限 | POST の本文は 16KB。超えたら読む前に 413 `payload_too_large` | 1 行 (大項目 60 字と科目名) は数百バイトに収まる。設定画面と同じ `settingsBodyLimit` を使う |
| revision | 追加と削除の履歴の `changed_at` を `settingsChangedAt` で revision より必ず後にする | 設定画面の `baseSavedAt` は履歴の最新時刻なので、対応表を変えた後に古い画面から保存すると 409 `settings_conflict` で止まる。設定画面が対応表を表示しているので、古い表示のまま保存させない |
| 書き込みの batch | 読み出し (行と revision) の batch 1 回と、書き込み (行・履歴・JSON snapshot の無効化・応答の読み出し) の batch 1 回 | 書き込みを全件か無しにする。応答の行は同じ batch の最後の SELECT から返し、書いた結果とずれない |
| 他の利用者の行 | 無い行と同じ 404 `not_found` (同じ本文) | 存在を明かさない (AC-25)。user_id で引くので他人の行は消せない |
| 二重の追加 | 事前の検査で 400 `duplicate_category`。検査とフェンスをすり抜けて主キー違反になった場合も同じ 400 にする | 送り直しで二重の行ができない。主キーを最後の砦にする |

結合テストは `packages/api/test/tax-account-map.integration.test.ts` (11 件)。route を外すと 10 件が落ちる (未認証の 401 は authGuard が route より前に返すので残る)。

### 画面のテストが旧実装で落ちること

P04 の記録 (`bulk-save-evidence.md` §1「画面のテストを P05 の画面と同じ周回で書くこと」) のとおり、画面のテストは画面より先に書いた。
web の 6 本 136 件を、今のテストのまま旧実装 (main の 9b5bbf3) に当てると 64 件が落ちる。今の実装では 136 件すべてが通る。

| ファイル | 件数 | 旧実装で落ちる |
|---|---|---|
| `packages/web/src/pages/classify/classify.dom.test.tsx` | 53 | 30 |
| `packages/web/src/pages/settings/settings.dom.test.tsx` | 34 | 32 |
| `packages/web/src/pages/settings/view-model.test.ts` | 10 | 2 |
| `packages/web/src/pages/classify/view-model.test.ts` | 26 | 0 |
| `packages/web/src/backup-restore.dom.test.tsx` | 9 | 0 |
| `packages/web/test/import-multifile.dom.test.tsx` | 4 | 0 |

### 画面の実描画検査 (AC-22・FR-13)

`check:classify-screen` (`packages/web/scripts/check-financial-visuals.mjs` の classify の範囲) を 390・768・1024・1264・1280px で回し、すべて合格した。
1264px と 1280px が検査の対象から外れると、それ自体を不合格にする。

| 幅 | 一覧の幅 (閉じた / 開いた) | 表の幅 / 見える幅 | 一括バーの高さ / 画面の高さ | フォーカスが見える操作 (閉じた / 開いた) |
|---|---|---|---|---|
| 390px | 350 / 350px | 680 / 350px (表の中だけ横に送る) | 192 / 844px | 103/103・120/120 |
| 768px | 621 / 621px | 621 / 621px | 140 / 900px | 103/103・120/120 |
| 1024px | 415 / 355px | 520 / 415px | 296 / 900px | 114/114・131/131 |
| 1264px | 553 / 373px | 560 / 553px | 218 / 900px | 114/114・131/131 |
| 1280px | 569 / 389px | 569 / 569px | 218 / 900px | 114/114・131/131 |

同じ検査を旧実装に当てた結果 (1 幅ずつ回した 768px・1024px は「1264px・1280px が検査の対象に無い」の 2 件を含む):

- 390px: 「明細を開く」のクリックが信頼度のセルに当たり、検査がそこで止まる。
- 768px は 8 件、1024px は 9 件、1264px と 1280px は合わせて 14 件の不合格。列が 7 列で最小幅に届かない・内容が 1 字ずつ折り返す・選択の件数が URL と合わない・
  一括バーが「改善を送る」に重なる・Tab で移った先が一括バーの裏に入る (1264px は 2/115 件、1280px は 3/115 件)・編集パネルが開かない。

検査で決めたこと:

- メディアクエリの帯は `window.innerWidth` で判定する。`clientWidth` は縦のスクロールバーのぶん狭く、1024px の画面を 1023px 以下の帯と取り違える。
- フォーカスの検査は、ブラウザが見える所まで送った後も操作の中心が別の要素 (固定の一括バー・ヘッダー) の裏にあれば不合格にする。
  貼り付いた編集パネルはページを送っても動かないので、裏に入った操作はスクロールしても出てこない。

### 画面のレイアウトの細部

spec の FR-13・7.2・7.12 が決めていない細部を、次のとおり決めた (`packages/web/src/pages/classify/classify.css`・`BulkActionBar.tsx`)。

| 項目 | 決定 | 理由 |
|---|---|---|
| 3 面の幅 | 絞り込みを 180〜220px、編集パネルを閉じている間は 140〜160px、開いたら 280〜340px。表は `min-width: 560px` (6 列の最小幅の和) | 旧実装では 1264px で一覧が 313px、1280px で 329px まで縮み、7 列が最小幅に届かず内容が 1 字ずつ折り返した。最小幅を下回る幅では表の中だけを横に送り、ページは横にはみ出さない |
| 1024〜1199px | 両脇を 150px・140px (開いたら 200px) に詰め、表は 520px で文字を 1 段小さくする | 常設のサイドバー (`--sidebar-w: 220px`) を引いた残りで、1024px の参照画像どおり 3 面を保つ |
| 1023px 以下の一括指定欄 | 畳んだ状態で始め、「一括指定」の開閉で出す。指定した欄の数を「一括指定 (2)」のように開閉の名前に出す。件数・クリア・保存・内訳は常に見せる | 5 欄を出したままだとバーが画面の約 1/3 を覆い、狭い幅で一覧の行を押せなかった。絞り込みも同じ幅で畳む |
| 一括バーの持ち上げ | 641〜1023px は「改善を送る」の上 (`--tap-target-min` + 22px)、640px 以下はタブバーと「改善を送る」の上 (`.tcf-selection-bar` と同じ式) | 固定の「改善を送る」が、バーの内訳と操作を隠していた |
| バーの裏に入るフォーカス | BulkActionBar が ResizeObserver でバーの高さを CSS 変数 `--classify-bulk-h` として `:root` に渡す。CSS がその分を `scroll-padding-bottom` にし、編集パネルの `max-height` からも引く。バーが消えたら変数を外す | Tab で移った行と編集パネルの操作が、画面下に貼り付いたバーの裏に入っていた (WCAG 2.4.11)。subscriptions の `.subs-selection` と同じ型 |
| 編集パネルの上端 | `top: calc(var(--header-h) + 16px)`。入りきらない分はパネルの中だけで送る | `top: 16px` では固定ヘッダーの裏に潜った |
| 一括バーの置き場 | 3 面の外 (`.classify-body` の後) に置き、本文の全幅を使う | 編集パネルの開閉で一覧の幅が変わっても、バーの幅と高さが変わらない |

### 一覧の絞り込み `category=未分類` (§2 の宿題)

§2 は「一覧の絞り込み `category=未分類` に含めるかは P05 で確かめて §4 に書く」としていた。確かめた結果、含める。

- 集計 (`packages/core/src/classify.ts` の家計の集計) は `categoryForTotals(big) || '未分類'` で数えるので、『カテゴリなし』と空の大項目は「未分類」の行に入る。
  診断の「未分類明細」(`packages/core/src/diagnosis-detectors.ts` の入口) はこの金額から `/classify?cls=per&category=未分類` を開く。
  一覧が字面の完全一致だけで絞ると、金額は見えるのに明細に辿り着けない。
- `GET /api/transactions` の絞り込み (`packages/api/src/routes/classify.ts`) は、字面の完全一致に加えて集計と同じ鍵 `categoryForTotals(big) || '未分類'` でも当てる。
  `category=カテゴリなし` で『カテゴリなし』だけを引く従来の動きは残る。
- テストは `packages/api/test/classify-bulk-save.integration.test.ts` の
  「『カテゴリなし』と空の大項目は、診断の「未分類明細」から開く一覧 (category=未分類) に出る」。修正前の route では `expected [] to include 'tx-bulk-168'` で落ちる。
- このテストは P04 の成果物のファイルに 1 件足したもので、P05 の書き込み範囲の外にある。P04 の契約に無かった振る舞いを、route の修正と対で固定するために足した。
  ほかのテストは書き換えていない。

### 復元で『カテゴリなし』が戻ること (§2 の宿題)

§2 は「復元の検査が予約の値を拒まないことを P05 で確かめる」としていた。確かめた結果、拒まない。

- 経路は `POST /api/restore` (`packages/api/src/routes/imports.ts`) → core の `importJSON` (`packages/core/src/dataset.ts`)。
  `importJSON` の `normalizeEdit` は持ち主 (owner) だけを正規化し、大項目には触れない。
- 予約の値を見る route は `classify.ts`・`classify-bulk.ts`・`settings.ts` の 3 本だけで、`imports.ts`・`backups.ts` には無い (`isNoCategory`・`NO_CATEGORY` の grep)。
  履歴とバックアップの値を読み替えない §2 の方針と合う。

### 共通部品の grep (P05 の後)

上の grep の P05 の後の結果: `errorBody` (public-validation.ts:6)・`insertJsonRows` (import-lifecycle.ts:621)・`rawStatement` (routes/settings.ts:52) の 1 件ずつ。
行番号は P03 から動いたが、件数は変わらない。

### OI-1 の依頼文 (章の値で実装した 3 点)

feature の PR で、次の 3 点の承認をお願いする。値を改める場合は同じ PR で直す (P12 が回答か持ち越しを記録する)。

| 点 | 今の値 | 置き場 | 変えたときの影響 |
|---|---|---|---|
| (a) 一覧の表示件数の既定 | 50 件。選べるのは 25・50・100 件 | core の `CLASSIFY_DEFAULT_PAGE_SIZE`・`CLASSIFY_PAGE_SIZES` | `GET /api/transactions` の `limit` の検査と既定・画面の既定・『表示件数』の選択肢が同じ定数を読むので、変えるのは 1 か所。100 件を既定にすると、1 回の読み出しの行と描画が倍になる |
| (b) 選択の key の上限 | 200 字。超えた key は「見つからない」明細と同じ扱いにする | core の `ROW_KEY_MAX_LENGTH` (`parseRowKey` が当てる) | 選択の読み出し (`GET /api/transactions/selected`) が `parseRowKey` で当てる。key の形は `mf:<id>`・`cash:<id>`・`split:<lineId>`。下げると長い id の明細を選び直せなくなる |
| (c) 一括保存の旧形式の受け付け | `{txId, cls, big, ...}` の旧形式も受け付け、値は下書きとして扱う | api の `legacyItemSchema` (`routes/classify-bulk.ts`) | 受け付けをやめると、古い画面を開いたままの利用者の保存が 400 になる。新しい画面は旧形式を送らない |

依頼文 (PR に載せる):

> 明細仕分けの一括保存で、利用者がまだ確かめていない 3 点を章の値で実装しました。
> (a) 一覧の表示件数の既定は 50 件 (25・50・100 件から選べる)。
> (b) 選択の key の上限は 200 字 (超えた key は読めないものとして扱う)。
> (c) 一括保存は旧形式 (`{txId, cls, big, ...}`) も受け付け、値を下書きとして扱う。
> この 3 点でよいか、改める値があれば教えてください。改める場合はこの PR の中で直します。

### OI-4 の依頼文 (新しい持ち主へ初期の 5 行を入れる時機)

今のコードには、業務データの新しい持ち主 (user_id) を作る経路が無い。user_id は全員 `TENANT_ID` で、利用者の作成 (`packages/api/src/users.ts` の `prepareUserInvitation`) は users に行を足すだけである。
既存の持ち主には 0059 が初期の 5 行を入れた (AC-16 のテストが確かめている)。

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| A | 対応表を初めて読むとき、その user_id に行も変更履歴も無ければ初期の 5 行を入れる | 持ち主を作る経路ができても書き足しが要らない。変更履歴があれば入れないので、利用者が 5 行を全部消しても戻らない | 読み出し (GET) が書き込みを持つ。今は使われない経路のために書く |
| B | 持ち主を作る経路ができたとき、その経路の中で入れる | 読み出しが書かない。入れる時機が 1 か所に決まる | 経路ができるまで O3 の API テスト (まだ対応表を持たない user_id に 5 行が入る) を書けない |
| C | 持ち越す | 今の変更が増えない | 未決事項 7 が閉じない |

推奨は **B**。今は新しい持ち主が生まれないので、A の書き込みはどの利用者にも効かない。持ち主を作る機能を足す feature の受け入れ条件に「初期の 5 行を入れ、消した行が戻らない」を入れ、O3 の API テストもその feature で書く。
B を選んだ場合、本 feature では O3 の API テストを書かず、未決事項 7 は P12 が「持ち主を作る feature へ持ち越し」として記録する。

依頼文 (PR に載せる):

> 勘定科目の対応表の初期の 5 行は、既存の持ち主には migration 0059 で入れました。
> 新しい持ち主 (user_id) へ入れる時機は未決です。今のコードには新しい持ち主を作る経路がありません (利用者を作っても user_id は全員同じ)。
> 案は A (初めて読むときに、変更履歴が無ければ入れる)・B (持ち主を作る経路ができたときに、その経路で入れる)・C (持ち越す) の 3 つです。
> 推奨は B です。今は新しい持ち主が生まれないので、A の書き込みはどの利用者にも効きません。どれにするか教えてください。

### OI-6・OI-3・OI-8 の結果

- **OI-6 (migration の番号)**: 新しい migration は `0059_tax_account_map.sql` と `0060_settings_change_log_target.sql`。`schema-guard.ts` の `EXPECTED_D1_MIGRATION` は 0060。
  0060 の本文の sha256 (`05886f213b91aa700eadcb2afe93f6c44386e365702af22bf010bfc90599d0fc`) は `.github/migration-approvals.json` の承認と一致する。P08・P13 がもう一度突き合わせる。
- **OI-3 (『カテゴリなし』の字面)**: core の `NO_CATEGORY = 'カテゴリなし'` に置き、既存の候補と衝突しない。
  `packages/api/test/settings-screen.integration.test.ts` の「候補の作成と名前の変更に予約の値を使うと 400 reserved_category で、何も書かない」が通ったので閉じる。
- **OI-8 (49 本以内)**: `classify-bulk-save.integration.test.ts` の「50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27)」が通ったので閉じる。

### 受け入れ条件の機械検査 (P05 の後)

- `resolveBulkItem`・`inputFromRow`・`legacyBasisLabel` の出現は packages/ 全体で 0 件 (main では 7・21・2 件)。web の内訳とサーバの一括保存は core の `resolveBulkSaveItem` を呼ぶ。
- D1 の上限の旧い定数は、`D1_FREE_QUERY_LIMIT` (import-lifecycle.ts:306)・`SCHEDULED_D1_QUERY_LIMIT` (scheduled-maintenance-budget.ts:15)・`CLASSIFY_BATCH_STATEMENTS` (routes/classify.ts:107) の定義行が 1 件ずつ残るだけ。
- **task 仕様と違う点**: `inputFromRow`・`resolveBulkItem` (web の `view-model.ts`)・`legacyBasisLabel` (core の `overview.ts`。export していない)・`MAX_BATCH_STATEMENTS` (`routes/classify-bulk.ts`) は、置き場のファイルを P05 が書き直したので、定義行ごと無くなった。
  よって P08 が消すのは、残る 3 定数の定義行だけになる。最後の状態 (出現 0 件) は P08 の受け入れ条件と変わらない。
- 本 feature で足した行のうち、直書きの `error: { code` は packages/api/src で 0 件。この検査で見つかった 3 件は errorBody を通す形に直した。
  直したのは routes/classify.ts の `invalidCategory`・`reservedCategory` と、routes/classify-bulk.ts の明細ごとの失敗 (型も `ReturnType<typeof errorBody>` から作る)。
  応答の JSON は変わらない (関係する API テスト 6 本・153 件が通る)。web のテストに残る 11 件は、サーバの応答を真似たモックの値で、route の実装ではない。
- index.ts の D1 の混雑の注記 (1 回の batch で書く route だけが「未適用」を保証できる) に、一括保存 `POST /api/transactions/bulk` を足した。

### レビューの差し戻しで直したこと (P10 → P05)

P10 の独立したレビューが指摘 A〜F を返した。A・D (中) と B・C・E (低) は P05 の差し戻しとしてここで直し、F (低・P08) は記録だけを直した。
G (中) は、A〜F を直した後の再レビューで見つかった。A の直しが前提にした「予約の値は候補に無い」が、候補の作り方の側で成り立っていなかった。
H (中) は、G の記録をコードと突き合わせて見つかった。「今の値を送り返すのは通す」の今の値を、2 か所が上書きの層だけで見ていた。
指摘の全文と判定は [`bulk-save-review.md`](bulk-save-review.md) にある。
「旧い実装」は、各指摘を直す前のコード (直した箇所だけを元に戻したもの) を指す。どの検算も、戻した後に sha256 が直した版と一致することを確かめた。

| 指摘 | 直したこと | 確かめるテスト | 旧い実装での結果 |
|---|---|---|---|
| A (中) 予約の値が 4 つの窓口から保存できた | `categoryAllowed` が予約の値を『指定なし』と同じに扱っていた (`if (isNoCategory(b)) return !m;`)。この 1 行を消して、候補に無い値として弾く意味に戻した。今の値を送り返す 3 か所だけを `categoryAllowedOrKept` に移した | api「新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04)」の 4 件 (ルール・分割の内訳・取引先の記憶・現金の記録)。core「候補の検査は予約の値を候補に無い値として弾く (新しく値を受ける窓口)」 | api の 4 件が落ちた (ルールと現金は 201、分割の内訳と取引先の記憶は 200。期待は 400 `invalid_category`)。core の 1 件も落ちた |
| D (中) 区分だけの提案で、別の区分の組が残った | 大を持たない提案は組の出所にしない (`suggestionPair`)。区分と名義は欄ごとに、値を持つ最初の層から取る (`layerOf`。一括指定 → 下書き → 土台 → 今の値) | core「大を持たない提案は組の出所にしない (用語集『カテゴリなし』・BR-02)」の 9 件。api「区分だけの提案 (まだ自動で当てない取引先の記憶) の明細は『カテゴリなし』で保存する (用語集『カテゴリなし』・BR-02)」の 3 件。web の内訳の 1 件 | 下の 2 版 |
| G (中・再レビュー) 取込値に同じ名前があると、予約の値が候補に入った | 候補は取込値 (freee の勘定科目・MF の大中項目) と追加の候補から作る (`buildCandidates`)。追加の候補は作成の窓口が予約の値を拒むが、取込値は通っていた。候補を作る 1 か所 (`buildScope` の `add`) で、大項目と中項目のどちらも `isNoCategory` に当たる名前を捨てる。窓口ごとに名指しで弾く形にはしない。候補を使う全員 (候補の検査・編集パネル・一括操作バー) に同じ不変条件が効くため | core「出口ごとの扱い (AC-05) 取込値や追加の候補に予約の値と同じ名前があっても、候補には入れない」(半角カナ・ゼロ幅スペースの書き方と中項目を含む)。api「新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04) 取込値に同じ名前の大項目があっても受けない (候補に入れない)」 | core の 1 件が「expected [ 'カテゴリなし' ] to deeply equal []」で落ちた。api の 1 件はルールが保存され「expected 201 to be 400」で落ちた |
| H (中・G の確認中) 取込値が『カテゴリなし』の明細は、科目を選び直さない限りメモも直せなかった | 「今の値を送り返すのは通す」の今の値を、個別の編集 (`routes/classify.ts` の予約の値の検査と `categoryAllowedOrKept` の引数) と一括保存の下書きの検査 (`routes/classify-bulk.ts`) は上書きの層 (`data.edits[txId]`) だけで見ていた。画面 (`initialInput` が一覧の行の値を入れる)・core の値の解決 (`current.big` が一覧の行の値)・一覧の行の判定 (`classify-row.ts`) は、取込値・ルール・上書きを解決した値を見る。前の 2 か所を同じ意味 (`resolveTx` の結果と `buildClassifyRow` の行) に揃えた。この feature で足した予約の値の検査 (P05) が生んだもので、G の前からあった | api「『カテゴリなし』は予約の値 (BR-04) 取込値が『カテゴリなし』の明細も、個別の編集でその値を送り返して他の欄を直せる」と「『カテゴリなし』は予約の値 (BR-04) 取込値が『カテゴリなし』の明細も、一括保存の下書きでその値を送り返して他の欄を直せる」。取込値だけが『カテゴリなし』で、上書きの無い明細を使う | 直す前の実装で 2 件とも落ちた (個別の編集は「expected 400 to be 200」、一括保存は `invalid_item` で ok にならない)。3 か所を 1 つずつ戻すと、どれも対応する 1 件だけが落ちた (個別の編集の予約の値の検査、個別の編集の `categoryAllowedOrKept` の引数、一括保存の下書きの検査) |
| B (低) 本文の上限に名前と境界のテストが無かった | `BULK_BODY_MAX_BYTES` を export し、route と境界のテストが同じ名前を読む | 「本文は 262144 バイト (256KB ちょうど) まで読み、262145 バイトは 413 (AC-24 の境界)」「一括 100 件は受け、101 件は 400 (BR-14 の境界)」 | 下の表 |
| C (低) 見分けのつかない書き方の『カテゴリなし』が候補として作れた | `isNoCategory` を、書式の文字の除去 → NFKC → trim で比べ、判定を覚える形にした (§2 のコード) | core「画面で見分けがつかない書き方も予約の値とみなし、見て違いが分かる書き方はみなさない」「判定を覚えても結果は変わらない (同じ値を繰り返し呼ぶ・覚えた数の上限を超える)」。api「候補の作成と名前の変更に予約の値を使うと 400 reserved_category で、何も書かない」に、半角カナ・ゼロ幅スペース・分解した濁点の例を足した | trim だけで比べる版で core の 2 件 (「半角カナ: expected false to be true」) と api の 1 件 (`ｶﾃｺﾞﾘなし` の候補が 201) が落ちた |
| E-1 (低) 101 件の 400 の文を確かめていなかった | 101 件のテストで `error.message` まで確かめる | 「一括 100 件は受け、101 件は 400 (BR-14 の境界)」 | — (テストを強めただけで、実装は変えていない) |
| E-2 (低) 履歴の before_value を確かめていなかった | 前の上書きがある明細で、before_value が上書きの層の表示値 (区分は事業・家計、カテゴリは「大 / 中」) であること、変わらない項目は行を作らないことを確かめる | 「前の上書きがある明細は、before_value に上書きの表示値を残し、変わらない項目は行を作らない」 | 前の上書きを捨てて履歴を作る版で「expected [ …(3) ] to deeply equal [ …(2) ]」で落ちた |
| E-3 (低) 台帳の read が 1 本少なかった | read を 14 本から 15 本に直した (現金明細の 1 本。§2「一括保存の書き込みと予算」) | 「台帳の read は、一括保存が書く前に読むクエリの実数と一致する」 | 14 本の台帳で「expected 15 to be 14」で落ちた |
| E-4 (低) コメントが実装と違った | `import-lifecycle.ts:689` の「2MB ごとに分ける」を、実装どおり `D1_JSON_PAYLOAD_MAX_BYTES` = 80KB に直した | — (コメントだけ) | — |
| F (低・P08) 書き込み範囲の宣言漏れと、resource_scope の古い migration の番号 | コードは直さず記録した。宣言外の 7 件は review の「5. 差分の範囲」にある。resource_scope の `0058_tax_account_map.sql`・`0059_settings_change_log_target.sql` は予定番号として据え置く (graph と spec は lineage の digest が照合するので書き換えない)。実体の 0059・0060 は resource_scope の `migrations/` に含まれ、`EXPECTED_D1_MIGRATION` も 0060 で一致する | — | — |

**D の 2 か所を別々に元へ戻した結果**

| 版 | 戻した箇所 | 落ちたテスト |
|---|---|---|
| pair | `pairBase = settled ? base : suggestion ? base : null` (大の無い提案も組の土台にする) | 9 件。core 5 件 (「大を持たない提案は組の出所にしない」の「指定が無ければ…」「区分だけの一括指定でも…」「名義だけの一括指定は…」「区分と名義だけの提案も…」「区分を持たない提案…」)、api 3 件 (D の 3 件)、web 1 件 (「区分だけの提案 … 一括保存の内訳は、組の無い明細を『カテゴリなし』で保存する件数に数える」) |
| layer | 区分と名義の落ち先を、今の値でなく土台 (`base.cls`・`base.owner`) にする | 2 件。core の 2 件 (「区分を持たない提案 (中項目だけの記憶) は、区分を今の値から取る」「名義を持たない提案は、今の名義 (人が付けた値) を消さない」)。api と web の fixture の明細は名義を持たないので、違いが見えない |

**B の上限を 1 つずつずらした結果** (`classify-bulk-save.integration.test.ts` と `classify-bulk.integration.test.ts` の 49 件)

| 版 | 落ちたテスト |
|---|---|
| 上限を 1 バイト下げる (`BULK_BODY_MAX_BYTES - 1`) | 1 件。262144 バイトの本文が「expected 413 to be 200」 |
| 上限を 1 バイト上げる (`BULK_BODY_MAX_BYTES + 1`) | 1 件。262145 バイトの本文が「expected 200 to be 413」 |
| 定数を `255 * 1024` にする | 1 件。定数の値の検査が「expected 261120 to be 262144」 |
| 件数の上限を 99 にする | 2 件。100 件の要求が 400 になる (BR-14 の境界と、100 件の予算の実測) |
| 件数の上限を 101 にする | 5 件。101 件の要求が 200 になる (BR-14 の境界・invalid_body・101 件の拒否・予算の実測 2 件) |

**変えなかったこと**

- 下書きの空の大項目は「取込値へ戻す」指定のまま変えない。組を省いた下書き (旧形式の item) で大か中のどちらかを送ったときは、組を下書きから取る (core「組を省いた下書き (旧形式の item)」の「大か中のどちらかを送った下書きは、組を下書きから取る (空の大は取込値へ戻す指定)」)。
- 大の無い提案が生まれるのは、まだ自動で当てない取引先の記憶が区分・名義・中項目だけを持つときだけである (`classify-status.ts` の `candidatesFor`)。取引先の記憶は PATCH `/api/vendor-memory/:vendor` で区分だけを付けて作れるので、利用者の操作で起きる。api の D の fixture はこの経路で記憶を作り、保存の前に一覧の行が `{status: 'unsorted', suggestion: {cls: 'biz', big: null, mid: null}}` であることを確かめてから保存する。
- 検査するのは、人が入れた組 (一括指定と下書き) だけ。土台と今の値は検査しない。
- G・H の後も、取込値が『カテゴリなし』の明細はその値のまま残る (取込値を書き換えない)。編集パネルの科目の欄は、今の値が候補に無いので未選択の表示 (「科目を選ぶ」。`CategoryPicker.tsx`) になり、spec の用語集「編集パネルでは選べない」と集計の「未分類と同じに数える」に揃う。画面はその値を入力に持ったまま送り返すので、他の欄だけを直す保存は通る (H)。
- 一括操作バーの候補から予約の値を除く画面側の絞り込み (`BulkActionBar.tsx`) は残した。core が同じ不変条件を持つので結果は変わらない。

記録の時刻: §4 は 2026-10-02T11:11:33Z、「レビューの差し戻しで直したこと」は 2026-10-02T16:13:34Z、G の行は 2026-10-02T16:29:01Z、H の行は 2026-10-02T16:40:16Z (どれも `date -u` の実測)。

## §5 未決事項の閉じ方の記録 (P12)

spec の未決事項 1〜7 と、spec の外で立てた OI-6〜OI-8 の、この feature の中での行き先。
§1「未決事項と open item の対応」の「閉じる task」の列を、結果で埋める。

| OI | 未決事項 | 結果 | 閉じた根拠・残る条件 |
|---|---|---|---|
| OI-1 | 2. 利用者が確かめていない細部 | **PR で判断待ち** | 章の値 (表示件数の既定 50・key の上限 200 字・旧形式の受け付け) で実装した。§4 の依頼文を PR の本文に載せ、利用者の承認か値の改めで閉じる。改める場合は同じ PR で直す |
| OI-2 | 5. 対応表の API のパスと表・列の名前 | **閉じた** | 表 `tax_account_map` と列を `docs/data-schema.md` の「勘定科目の対応表と変更履歴の種類(0059・0060 / feat-classify-bulk-save)」に、経路 3 本とエラーを `architecture/classify-bulk-save-backend.md` の「実装で決めた名前 (SYS-CLASSIFY-BULK-P12)」に、表と migration の名前を `architecture/classify-bulk-save-database.md` の同名の節に書いた |
| OI-3 | 6. 『カテゴリなし』の字面 | **閉じた (P05)** | `packages/api/test/settings-screen.integration.test.ts` の「BR-04 予約の値『カテゴリなし』の候補は作れない 候補の作成と名前の変更に予約の値を使うと 400 reserved_category で、何も書かない」が通った (§4「OI-6・OI-3・OI-8 の結果」)。P10 の指摘 C の後は、半角カナ・ゼロ幅スペース・分解した濁点で書いた名前も同じテストが確かめる |
| OI-4 | 7. 新しい持ち主へ初期の 5 行を入れる時機 | **PR で判断待ち** | 今のコードに新しい持ち主を作る経路が無いことを §4 に記録し、案 A・B・C と推奨 B の依頼文を PR の本文に載せる。B が選ばれたら「持ち主を作る feature へ持ち越し」として閉じ、O3 の API テストはその feature で書く。A が選ばれたら同じ PR で読み出し時の投入と O3 の API テストを足す |
| OI-5 | 1. 章の旧い文言・3. C07 の low・info・4. C06 の medium 2 件 | **持ち越し (次の system-spec の改訂)** | どれも仕様の章と監査の注記で、本 feature の契約と実装に影響しない。次の system-spec の改訂へ持ち越し、そのとき spec 担当 (agent) が直し、章の grep・C07 の再監査・利用者の判断の記録で閉じる |
| OI-6 | (spec 外) migration の番号 | **P13 で最終確認** | 0059・0060、`EXPECTED_D1_MIGRATION`、0060 の sha256 と承認の一致を P05・P08 が突き合わせた (evidence「migration の突き合わせ (OI-6)」)。P08 の時点で origin/main は `9b5bbf3` のままで、番号・承認・`EXPECTED_D1_MIGRATION` のどれも変更なし。merge の直前に origin/main を取り直し、P13 がもう一度確かめる |
| OI-7 | (spec 外) ci.yml は画面検査を走らせない | **記録した (P06)** | evidence「P06 品質ゲートの通し」の「別 feature の候補として返すもの」に記録した。verify:full の中の画面検査 (`check:classify-screen` を含む) はローカルで通したが、CI では確かめていない。CI に画面検査の job を足すのは本 feature の範囲の外なので、別 feature の候補として返す。P13 が merge の前の verify:full で画面検査をもう一度通す |
| OI-8 | (spec 外) 49 本以内 | **閉じた (P05)** | `packages/api/test/classify-bulk-save.integration.test.ts` の「50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27)」の 4 件 (50 件、100 件、台帳の read が実数と一致する、台帳は 49 本を受けて 50 本を拒む) が通った (§4「OI-6・OI-3・OI-8 の結果」)。台帳の read は P10 の指摘 E-3 で 14 本から 15 本に直した |

### 実装で spec の字面を解釈した点

- **BR-04 の「編集の値としては 400」**: `PUT /api/transactions/:txId/edit` は、新しく『カテゴリなし』へ変える要求だけを 400 `reserved_category` にし、今の値が『カテゴリなし』の明細でその値を送り返す要求は通す (`packages/api/src/routes/classify.ts`)。
  一括保存で『カテゴリなし』にした明細を編集パネルで開き、メモや所有者だけを直して保存すると、カテゴリの欄は今の値のまま送られる。これを 400 にすると、カテゴリを選び直さない限り他の欄を直せない。
  「編集の値として選べない」は、利用者が新しく選ぶ値の話と読んだ。PR の本文でもこの解釈を示す。
  「今の値」は、取込値・ルール・手動の上書きを解決した実効値 (個別の編集は `resolveTx` の結果、一括保存の下書きは `buildClassifyRow` の行) である。上書きの層だけを見ると、取込値が『カテゴリなし』の明細の送り返しが 400 になる (P10 の指摘 H)。
  テストは `packages/api/test/classify-bulk-save.integration.test.ts` の「『カテゴリなし』は予約の値 (BR-04)」にある。送り返しは「今の値が『カテゴリなし』の明細は、その値を送り返してメモだけを直せる」「取込値が『カテゴリなし』の明細も、個別の編集でその値を送り返して他の欄を直せる」「取込値が『カテゴリなし』の明細も、一括保存の下書きでその値を送り返して他の欄を直せる」の 3 件が確かめる。
- **BR-04 の窓口の範囲**: spec は予約の値を一括保存・個別の編集・候補の作成と改名で書く。科目を新しく受けるほかの窓口 (ルール・分割の内訳・取引先の記憶・現金の記録) も予約の値を 400 `invalid_category` にし、取込値に同じ名前があっても候補に入れない (P10 の指摘 A・G)。
  テストは同じファイルの「新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04)」の 5 件 (ルール・分割の内訳・取引先の記憶・現金の記録・取込値に同じ名前の大項目があっても受けない (候補に入れない))。
- **所有者だけの一括指定**: 提案も下書きも無い未整理に所有者だけを一括指定したときは、区分を明細の区分のまま残し、組は『カテゴリなし』にする。
  埋める値 (一括指定・下書き・提案) のどこにも組が無いので、spec の用語集の『カテゴリなし』の定義どおりになる。設計の字面には無いので、§2 の「区分とカテゴリの組 (BR-02)」に書いた。PR の本文でもこの解釈を示す。

### 実装の途中で見つけた不具合と修正

acceptance「2. sel に 50 件を選んだ状態の再現」で、spec の決まりと合わない保存を 1 つ見つけた。P05 と P04 へ差し戻して直した。

| 項目 | 内容 |
|---|---|
| 起きたこと | 提案の無い未整理 16 件に区分 (家計) を一括指定して保存すると、16 件は確定に変わったが、大項目は取込値の『未分類』のまま残った。変更履歴 (source=bulk) にもカテゴリ『未分類 / 未分類』が 16 行あった |
| 合わない決まり | BR-01 (未整理は 一括指定 → 下書き → 提案 の順で埋め、今の値は候補に入らない)、用語集の『カテゴリなし』(埋める値のどこにも組が無いときに保存する値) |
| 原因 | `packages/core/src/classify-bulk.ts` の解決関数が、提案の無い未整理でも今の値の組 (取込値) を土台にしていた |
| 直したこと (P05) | 組の土台を「確定済みか、提案があるときだけ」にした (`pairBase`)。区分と所有者は今まで通り今の値を残す |
| 足したテスト (P04) | core に、提案も下書きも無い未整理の組み合わせを見るテストを 5 件足した。4 件は修正の前の式で落ちることを、旧い式を写して確かめた。残る 1 件 (大項目の指定) は修正の前後で答えが同じで、修正の範囲が広がっていないことを見る |
| 修正の後 | 同じ seed・同じ選び方で、『カテゴリなし』で保存する件数は 8 件から 24 件になり、変更履歴の『未分類』は 16 行から 0 行になった。それ以外の表示と件数は修正の前と同じだった (acceptance「2. sel に 50 件を選んだ状態の再現」) |

P10 の独立したレビューと再レビューで、ほかに 4 つの不具合が見つかった。どれも P05 と P04 へ差し戻して直した。
直したこと・確かめるテスト・旧い実装での結果は §4「レビューの差し戻しで直したこと (P10 → P05)」にある。

| 指摘 | 起きたこと | 直したこと |
|---|---|---|
| A (中) | ルール・分割の内訳・取引先の記憶・現金の記録の窓口から、予約の値『カテゴリなし』を保存できた | 候補の検査 `categoryAllowed` が予約の値を弾く。今の値を送り返す 3 か所だけ `categoryAllowedOrKept` を使う |
| D (中) | 区分だけの提案がある未整理で、別の区分の組が残った | 大を持たない提案は組の出所にしない (`suggestionPair`)。区分と名義は欄ごとに値を持つ最初の層から取る (`layerOf`) |
| G (中) | 取込値に同じ名前があると、予約の値が候補に入り、A の検査を通った | 候補を作る 1 か所 (`buildScope` の `add`) で、大項目と中項目の予約の値を捨てる |
| H (中) | 取込値が『カテゴリなし』の明細は、科目を選び直さない限りメモも直せなかった | 「今の値」を上書きの層でなく、取込値・ルール・上書きを解決した値で見る |

記録の時刻: 2026-10-02T17:14:05Z (`date -u` の実測)
