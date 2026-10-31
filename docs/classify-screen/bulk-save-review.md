# 一括保存の独立レビュー (P10)

認可・上限・本文の大きさ・予約の値・差分の範囲を、実装者と別の視点で確かめた記録。
直したことの詳細と「旧い実装で落ちたテスト」は [`bulk-save-decisions.md`](bulk-save-decisions.md) の「レビューの差し戻しで直したこと」にある。
本文書は、指摘の全文 (何が・どの条件で・どう壊れるか) と、直した後の今のコードでの判定を持つ。

- 記録の時刻: 2026-10-02T16:50:30Z (`date -u` の実測)
- 対象: HEAD `9b5bbf3` (origin/main と同じ) と、その上の未コミットの作業ツリー。SPEC_BASE の commit はまだ無い (利用者の指示待ち。decisions「head branch と PR の単位」)
- 行番号: 本文書の `file:line` は記録の時刻の作業ツリーのもの。decisions §2 の設計時の表の行番号は HEAD `9b5bbf3` のもので、本文書とは合わない
- テスト名: vitest の json の `fullName` を逐語で写した (describe と it の名前を空白でつないだもの)

## 0. 判定

| 受け入れ条件 | 判定 | 節 |
|---|---|---|
| AC-23〜AC-26 (401・403・400、256KB の 413、他の利用者のものを見つからない扱い、source=bulk の履歴) がテストと実装の両方で確かめられている | 満たす | 観点 1〜4 |
| 選択の読み出しと一括保存の各文の bound parameter が 100 以内であることが、d1-limits.ts の名前を通した計算で確かめられている | 満たす | 観点 5 |
| 予約の値と同じ名前の候補の作成が 400 になり、予約の値が一括指定と編集の値として拒まれる | 満たす (指摘 A・C・G・H を直した後) | 観点 6 |
| `SPEC_BASE...HEAD` の全ファイルが feature の resource_scope の内側にあり、ローカル secrets・`data/`・実データが差分に 0 件 | secrets・`data/`・実データは 0 件。resource_scope は字面の上で 7 件が外れる (宣言漏れ。指摘 F) | 5 章 |

指摘は 8 件 (中 4 件: A・D・G・H、低 4 件: B・C・E・F)。
A〜E・G・H は P05 の差し戻しとして直し、直す前の実装で落ちるテストを足した。F は P08 の記録で閉じ、コードは直していない。

## 1. 走らせたテスト

**直した後の今のコード** (記録の時刻の作業ツリー)

| 範囲 | 開始 (UTC) | 件数 |
|---|---|---|
| api 全件 (`pnpm --filter @kanjo/api exec vitest run`) | 16:38:43Z | 1192 件 (80 ファイル): passed 1192 / failed 0 / skipped 0 |
| core 全件 (`pnpm --filter @kanjo/core exec vitest run`) | 16:28:15Z | 1401 件 (71 ファイル): passed 1395 / failed 0 / skipped 6 |
| web 全件 (`pnpm --filter @kanjo/web exec vitest run`) | 16:55:13Z | 1284 件 (101 ファイル): passed 1284 / failed 0 / skipped 0 |

**1 回目の独立レビュー** (2026-10-02T14:44:52Z。A〜F を直す前のコード)

| 範囲 | 件数 |
|---|---|
| api の 5 ファイル (classify-bulk-save・classify-selected・tax-account-map・src/classify-bulk・settings-screen) | 83 件: passed 83 / failed 0 |
| core の 2 ファイル (classify-bulk-resolve・no-category-contract) | 43 件: passed 43 / failed 0 |
| probe 2 本 (`<scratchpad>/` に置き、架空の明細だけで走らせた) | 9 件: passed 9 / failed 0 |

probe は観測した値を JSON に書き出すためのテストで、何も assert していない。pass は「最後まで走った」という意味しか持たない。
probe で見つけた挙動は、どれも本体のテストに写した (指摘ごとの「確かめるテスト」)。

## 2. 指摘の一覧

| ID | 深刻度 | 見つけた段 | 差し戻し先 | 要旨 | 状態 |
|---|---|---|---|---|---|
| A | 中 | 1 回目 | P05 | `categoryAllowed` が予約の値を受け付け、ルール・分割の内訳・取引先の記憶・現金の記録の 4 つの窓口から『カテゴリなし』を保存できた | 直した |
| D | 中 | 1 回目 | P05 | 大を持たない提案 (区分だけの取引先の記憶) の明細に区分だけ・名義だけを一括指定すると、取込値の組のまま候補の検査を経ずに確定した | 直した |
| G | 中 | 再レビュー | P05 | 取込値に『カテゴリなし』と同じ名前の大項目があると、それが候補に入り、A の直しをすり抜けた | 直した |
| H | 中 | G の確認中 | P05 | 取込値が『カテゴリなし』の明細は、科目を選び直さない限りメモも直せなかった | 直した |
| B | 低 | 1 回目 | P05 | 本文の上限 256KB に定数名と境界のテストが無かった | 直した |
| C | 低 | 1 回目 | P05 | 見分けのつかない書き方 (半角カナ・ゼロ幅文字・分解した濁点) の『カテゴリなし』が候補として作れた | 直した |
| E | 低 | 1 回目 | P05 | テストの薄さ 2 件 (101 件の 400 の文、履歴の before_value)、台帳の read が 1 本少ない、コメントが実装と違う | 直した |
| F | 低 | 1 回目 | P08 | resource_scope に 7 件の宣言漏れ。resource_scope の migration の番号が古い | 記録した (5 章) |

## 3. 観点ごとの確認

### 観点 1 AC-23: 認可と要求全体の拒否 — 満たす

ミドルウェアの順 (`packages/api/src/index.ts`): :113 `authGuard` → :115 `mustChangePasswordFence` → :116 `runtimeSchemaGuard` → :117 `canonicalMutationFence` → :130 `classifyRoute`・:131 `classifyBulkRoute`。

| 項目 | 実装 (file:line) | テスト (fullName) |
|---|---|---|
| 一括保存: 未認証は 401 | index.ts:113 → auth.ts:266・:275 | `要求全体の拒否は何も書かない (AC-23・AC-24) Cookie が無ければ 401`<br>`認証と変更系保護 Cookie が無ければ 401 で、明細は 1 件も書き換わらない` |
| 一括保存: 初回のパスワード変更が済んでいなければ 403 | index.ts:115 → auth.ts:287〜301 (:301 が 403) | `要求全体の拒否は何も書かない (AC-23・AC-24) 初回のパスワード変更が済んでいない利用者は 403 password_change_required` |
| 選択の読み出し: 401 と 403 | 同じミドルウェア | `選択の読み出しの要求全体の拒否 Cookie が無ければ 401`<br>`選択の読み出しの要求全体の拒否 初回のパスワード変更が済んでいない利用者は 403 password_change_required` |
| 選択 51 件・key の重複は 400 | routes/classify.ts:418〜422 (`.max(SELECTION_MAX)` と重複の検査) → :424 `invalidSelection` → :449 の GET が :451 で 400。`SELECTION_MAX` = 50 は core/classify-bulk.ts:22 | `選択の読み出しの要求全体の拒否 51 件・重複・空の keys・keys 無しは 400 invalid_query` |
| 一括 101 件は 400 | routes/classify-bulk.ts:58 `MAX_BULK_ITEMS` = 100、:133 `.max(MAX_BULK_ITEMS)` → :136 `INVALID_BODY` を :229・:232 で 400 | `要求全体の拒否は何も書かない (AC-23・AC-24) 一括 100 件は受け、101 件は 400 (BR-14 の境界)`<br>`要求そのものが成り立たない場合 (BR-14) 101 件は 400。上限は 100 件` |
| 同じ明細の重複は 400 | routes/classify-bulk.ts:137 `DUPLICATE_ITEMS` を :236 で 400 | `要求全体の拒否は何も書かない (AC-23・AC-24) 101 件・同じ明細の重複・一括指定の『カテゴリなし』は 400 invalid_body`<br>`要求そのものが成り立たない場合 (BR-14) 同じ明細を 2 回含めると 400。どちらの指定が勝ったか読めなくなるため` |
| 一括指定の『カテゴリなし』は 400 | routes/classify-bulk.ts:138 `RESERVED_BULK` を :239 で 400 | `要求全体の拒否は何も書かない (AC-23・AC-24) 101 件・同じ明細の重複・一括指定の『カテゴリなし』は 400 invalid_body` |
| 『カテゴリなし』と同じ名前の候補の作成は 400 | routes/settings.ts:505 (作成)・:537 (名前の変更) | `BR-04 予約の値『カテゴリなし』の候補は作れない 候補の作成と名前の変更に予約の値を使うと 400 reserved_category で、何も書かない` |
| (参考) 取込や他の更新の進行中は 409 | index.ts:117 | `認証と変更系保護 取込や他の更新が進行中なら 409 で、何も書かずに返す` |

**指摘 E-1 (低・P05) の全文**: 1 回目のレビューの時点では、101 件・重複・予約の値の 3 つを 1 本の it で確かめ、101 件は status と code だけを見ていた。
101 件が別の理由 (JSON の解析の失敗など) で 400 になる退行を区別できなかった。

**直した後**: 「一括 100 件は受け、101 件は 400 (BR-14 の境界)」が 100 件の 200 と、101 件の `error.message` までを確かめる。
件数の上限を 99 にすると 2 件、101 にすると 5 件が落ちることを確かめた (decisions の B の表)。

### 観点 2 AC-24: 本文の大きさ — 満たす

- 上限: routes/classify-bulk.ts:61 `export const BULK_BODY_MAX_BYTES = 256 * 1024`。:221 で `settingsBodyLimit(BULK_BODY_MAX_BYTES, 'リクエストが大きすぎます')` を `/transactions/bulk` に掛ける。
- `settingsBodyLimit` (routes/settings-screen.ts:75〜76) は hono の `bodyLimit` を包み、413 `payload_too_large` を返す。
- hono 4.13.7 の判定 (`node_modules/hono/dist/middleware/body-limit/index.js:17〜31`): Content-Length があり Transfer-Encoding が無ければヘッダの値を比べる。それ以外 (chunked・ヘッダ無し) は読みながら数え、`size > maxSize` で 413 にする。
- 1 回目の実測 (probe・in-process の `app.request`):

  | 条件 | 結果 |
  |---|---|
  | 262144 バイト (256KB ちょうど) | 200 |
  | 262145 バイト | 413 |
  | chunked (ReadableStream) で 256KB 超 | 413 `payload_too_large` |
  | Content-Length を 100 と偽った 300KB の本文 | 200 (解析まで進み、results は invalid_item)。7 章 |

- 順序: `bodyLimit` は route の側にあるので、index.ts:117 の `canonicalMutationFence` (リースの取得と解放) の後に効く。256KB を超える要求でもリースの取得と解放は走るが、書き込みは起きない。

**指摘 B (低・P05) の全文**: 上限が `256 * 1024` の直書きで定数名が無く、テストは 300KB の 1 ケースだけだった。
`>` が `>=` に変わる、上限が 255KB に変わるといった境界のずれは、300KB のテストを緑のまま通る。

**直した後**: 定数を export し、route と境界のテストが同じ名前を読む。

- `要求全体の拒否は何も書かない (AC-23・AC-24) 本文は 262144 バイト (256KB ちょうど) まで読み、262145 バイトは 413 (AC-24 の境界)`
- `要求全体の拒否は何も書かない (AC-23・AC-24) 256KB を超える本文は読む前に 413 payload_too_large`

境界のテストは定数を読まず、仕様の値 262144 で固定した。上限を 1 バイト下げても上げても、定数を `255 * 1024` にしても、どれも 1 件が落ちる (decisions の B の表)。

### 観点 3 AC-25: 他の利用者の存在を漏らさない — 満たす

| 経路 | 他の利用者のもの・存在しないもの | 実装 (file:line) | テスト (fullName) |
|---|---|---|---|
| 選択の読み出し | どちらも 200 で、同じ形の `missing` に入る | routes/classify.ts:449〜468 (:453 で自分の明細の源を読み、:458〜468 でメモリ上で突き合わせる) | `見つからない key は 400 にせず missing に入れる (AC-25) 他の利用者の key と存在しない key は、同じ形で missing に入る` |
| 履歴の読み出し | どちらも 404 `not_found`「明細が見つかりません」 | routes/classify-bulk.ts:415〜427 (:424 が 404)、classify-history.ts:154〜158 (`user_id` と `tx_id` の両方で絞る) | `変更履歴 (GET /api/transactions/:txId/history) 他の利用者の明細は 404 で、履歴の存在も漏らさない` |
| 対応表の読み出し | 含まない | routes/tax-account-map.ts:44 (`WHERE user_id=?`) | `読み出し (GET) migration の初期の 5 行を名前順で返し、他の利用者の行を含まない` |
| 一括保存 | 明細ごとに同じ `not_found` | routes/classify-bulk.ts:267〜271 | `他の利用者の明細は見つからない扱い (AC-25) 他の利用者の明細と未知の id は同じ not_found で、存在を明かさない`<br>`明細ごとの成否 (7.8・BR-09・BR-15) 他の利用者の明細と未知の明細は not_found、他の明細は保存される` |
| 対応表の削除 | どちらも 404 `not_found`。他の利用者の行は残る | routes/tax-account-map.ts:41・:162 (`WHERE user_id=? AND category_big=?`) | `削除 (DELETE) 無い行と他の利用者の行は同じ 404 not_found で、存在を明かさず何も消さない (AC-25)` |
| 対応表の追加 | 一覧に無い対応先・予約の大項目・形の不正は 400 | routes/tax-account-map.ts | `追加 (POST) 一覧に無い対応先・予約の大項目・形の不正は 400 invalid_request で、何も書かない` |

- 件数: 一括保存の `saved` と `failed` は、他の利用者のものと存在しないものを同じ `not_found` の失敗として数える。区別できない。
- 書き込みの絞り込み: 一括保存は `user_id` を scalar として bind する (routes/classify-bulk.ts:347 の `deleteJsonValues`、:354・:362 の `insertJsonRows`)。
- 時間差は測っていない (7 章)。

### 観点 4 AC-26: source=bulk の履歴 — 満たす

- 実装: classify-history.ts:56 `historyEntries(before, after)` が区分・カテゴリ・名義・支払方法・メモを比べ、変わった項目だけを返す。before は上書きの層 (`tx_edits`)。
  routes/classify-bulk.ts:330 で明細ごとに作り、:374 の `'bulk'` で `tx_history` に書く。
- テスト:
  - `履歴は変わった項目ごとに 1 行 (AC-26) 未整理の 2 件は 4 行ずつ、確定済みで変わらない明細は 0 行で ok と今の状態を返す`
  - `履歴は変わった項目ごとに 1 行 (AC-26) 前の上書きがある明細は、before_value に上書きの表示値を残し、変わらない項目は行を作らない`
  - `同じ要求の 2 回目は何も書かない (AC-29) 2 回とも全件 ok で、saved・状態・値・月次集計が同じ。履歴は増えない`
  - `明細ごとの成否 (7.8・BR-09・BR-15) 提案と 1 つでも違えば manual として保存され、変わった項目ごとに bulk の履歴が残る (BR-09)`
- 未整理の行は分類の 4 欄を必ず patch に入れるので、表示値が変わらなくても「上書きの層の null → 値」として履歴に残る。spec の「before は上書きの層の値」の定義どおりで、問題ではない。

**指摘 E-2 (低・P05) の全文**: 1 回目の時点の統合テストは行数だけを見ていて、before_value (上書きが無ければ NULL、あれば上書きの層の値) を確かめていなかった。
before に取込値を入れる退行が起きても緑のまま通った。

**直した後**: 上の 2 本目が、前の上書きがある明細で before_value が上書きの層の表示値 (区分は事業・家計、カテゴリは「大 / 中」) であることと、変わらない項目が行を作らないことを確かめる。

### 観点 5: bound parameter と 1 回の呼び出しの本数 — 満たす

**一括保存 (最大 100 件) の 1 文の bind**。json_each で束ねるので、bind の数は件数によらない。

| 文 | bind | 値 | 上限 |
|---|---|---|---|
| `tx_edits` の削除 (`deleteJsonValues`、import-lifecycle.ts:690) | user_id 1 + payload 1 | 2 | ≤ `D1_MAX_BOUND_PARAMS` (100、d1-limits.ts:11) |
| `tx_edits` と `tx_history` の追加 (`insertJsonRows`、import-lifecycle.ts:619) | scalar の列 (user_id) 1 + payload 1 | 2 | ≤ `D1_MAX_BOUND_PARAMS` |
| snapshot の無効化 | user_id 1 | 1 | ≤ `D1_MAX_BOUND_PARAMS` |

- payload は 1 文 `D1_JSON_PAYLOAD_MAX_BYTES` (80KB、import-lifecycle.ts:304) ごとに分ける (`chunkJsonRowsByBytes`、:596。UTF-8 のバイトで数える)。
- 件数で切る IN 句は無いので、`inClauseChunkSize` (d1-limits.ts:29) は使わない。
- 1 回目の実測 (probe。100 件・メモ 200 字・本文 72011 バイト): 1 文の bind は最大 4 (読み出し側の文)、D1 の呼び出しは 26 本、batch の大きさは [1, 7]、履歴は 500 行。

**選択の読み出し (最大 50 件)**: key を SQL に bind しない。自分の明細を user_id などで読み、メモリ上で突き合わせる。1 文の bind は最大 4。

- `読み出しは bound parameter の上限の内に収まる 50 件の key でも、1 文の bound parameter は 100 以内`

**1 回の呼び出しの本数と batch**

- 台帳 `BULK_SAVE_QUERY_LEDGER` (routes/classify-bulk.ts:68) の固定分は 25 本: requestGuards 2、writerLeaseWorstCase 5 (`IMPORT_CLAIM_WORST_CASE_QUERY_COUNT` 4 + 1)、read 15 (`LOAD_DATASET_QUERY_COUNT_WITH_SPLITS` 11 + 1 + 1 + 2)、snapshotInvalidation 1、aggregateReplacement 2。
- `planBulkSaveQueries` (:79〜96) は `total < D1_INVOCATION_QUERY_LIMIT` (50、d1-limits.ts:17)、つまり 49 本以下を受ける。:382 で台帳を引き、:389 の `planClassifyMutation` と合わせて超えれば 413。
- batch: :398 で `statements.length > D1_BATCH_STATEMENT_LIMIT` (50、d1-limits.ts:23) なら 413。
- テスト:
  - `50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27) 50 件: 実測は 49 本以内で、台帳の見積り以下`
  - `50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27) 100 件: 実測は 49 本以内で、台帳の見積り以下`
  - `50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27) 台帳の read は、一括保存が書く前に読むクエリの実数と一致する`
  - `50 件・100 件の保存でも D1 のクエリは 49 本以内 (AC-27) 台帳は 49 本を受け、50 本を拒む (上限そのものは使い切らない)`
  - `書く前に予算の超過が分かる要求は 413 (AC-28) too_many_classify_changes で results を持たず、何も書かない。同じ要求は本物の上限なら通る`

**指摘 E-3・E-4 (低・P05) の全文**

- E-3: 台帳の read は 14 本だったが、コードを辿ると現金明細の読み出し 1 本が加わり、実際は 15 本だった。固定分を 1 本少なく見積もっていた。実測の 26 本は 49 本より十分少ないので、壊れてはいなかった。
- E-4: import-lifecycle.ts のコメントは「2MB ごとに分ける」と書いていたが、実装は `D1_JSON_PAYLOAD_MAX_BYTES` = 80KB だった。

**直した後**: read を 15 本に直し、上の 3 本目が台帳の read と実際に読むクエリの本数を 1 対 1 で突き合わせる (14 本の台帳では「expected 15 to be 14」で落ちる)。
コメントは import-lifecycle.ts:689 で 80KB に直した。

軽微 (直していない): `D1_JSON_PAYLOAD_MAX_BYTES` は d1-limits.ts の外 (import-lifecycle.ts) にあり、D1 の上限の名前が 1 か所に集まっていない。既存の置き場で、本 feature の範囲の外なので動かさない。

### 観点 6: 予約の値『カテゴリなし』 — 満たす (A・C・G・H を直した後)

**今の実装**

| 段 | 実装 (file:line) |
|---|---|
| 判定 | core/no-category.ts:30 `isNoCategory`。書式の文字 (:16 `FORMAT_CHARS` = `\p{Cf}`) を除き、NFKC で正規化し、trim して比べる (:34)。結果は :22 の `verdicts` に覚える |
| 候補を作る段 | core/categories.ts:48 `buildScope` の :55 `add` が、大項目 (:60) と中項目 (:68) のどちらも `isNoCategory` に当たる名前を捨てる。候補は取込値と追加の候補から作るので、どちらの出所でも予約の値は候補に入らない |
| 新しく値を受ける窓口 | core/categories.ts:118 `categoryAllowed`。予約の値は候補に無い値として弾く。ルール (routes/classify.ts:958)・分割の内訳 (:770)・取引先の記憶 (routes/vendor-memory.ts:158)・現金の記録 (routes/cash.ts:237)・一括指定 (routes/classify-bulk.ts:246) が使う |
| 今の値の送り返し | core/categories.ts:138 `categoryAllowedOrKept`。今の値も予約の値で中項目が空のときだけ通す (:145)。個別の編集 (routes/classify.ts:578)・一覧の行の判定 (classify-row.ts:170)・core の値の解決 (core/classify-bulk.ts:195) が使う |
| 名指しの拒否 | 一括指定 routes/classify-bulk.ts:239 (400 `RESERVED_BULK`)、下書き :278〜279 (その明細だけ `invalid_item`)、個別の編集 routes/classify.ts:557 (400 `reserved_category`、:183)、候補の作成と名前の変更 routes/settings.ts:505・:537 |
| 「今の値」 | 取込値・ルール・上書きを解決した値。個別の編集は `resolveTx` の結果 (`before.big`)、一括保存の下書きは一覧の行 (`buildClassifyRow` の `row.big`)、core は `current.big`、一覧の行の判定は `r.big` で、4 か所が同じ値を見る |

**テスト (fullName)**

- api:
  - `『カテゴリなし』は予約の値 (BR-04) 下書きの『カテゴリなし』はその明細だけ invalid_item で、他の明細は保存される`
  - `『カテゴリなし』は予約の値 (BR-04) 個別の編集でも『カテゴリなし』は 400 reserved_category`
  - `『カテゴリなし』は予約の値 (BR-04) 今の値が『カテゴリなし』の明細は、その値を送り返してメモだけを直せる`
  - `『カテゴリなし』は予約の値 (BR-04) 取込値が『カテゴリなし』の明細も、個別の編集でその値を送り返して他の欄を直せる`
  - `『カテゴリなし』は予約の値 (BR-04) 取込値が『カテゴリなし』の明細も、一括保存の下書きでその値を送り返して他の欄を直せる`
  - `『カテゴリなし』は予約の値 (BR-04) 『カテゴリなし』と空の大項目は、診断の「未分類明細」から開く一覧 (category=未分類) に出る`
  - `新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04) ルール`
  - `新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04) 分割の内訳`
  - `新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04) 取引先の記憶`
  - `新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04) 現金の記録`
  - `新しく値を受ける窓口は『カテゴリなし』を受けない (BR-04) 取込値に同じ名前の大項目があっても受けない (候補に入れない)`
  - `BR-04 予約の値『カテゴリなし』の候補は作れない 候補の作成と名前の変更に予約の値を使うと 400 reserved_category で、何も書かない`
- core:
  - `予約の値 前後の空白を除いて一致したものだけを予約の値とみなす`
  - `予約の値 画面で見分けがつかない書き方も予約の値とみなし、見て違いが分かる書き方はみなさない`
  - `予約の値 判定を覚えても結果は変わらない (同じ値を繰り返し呼ぶ・覚えた数の上限を超える)`
  - `出口ごとの扱い (AC-05) 候補の検査は予約の値を候補に無い値として弾く (新しく値を受ける窓口)`
  - `出口ごとの扱い (AC-05) 取込値や追加の候補に予約の値と同じ名前があっても、候補には入れない`
  - `出口ごとの扱い (AC-05) 今の値を残す保存は、今の値が予約の値で中項目が空のときだけ通す`
  - `出口ごとの扱い (AC-05) 対応表の大項目に予約の値は登録できない`
  - `下書きの系統の検査 下書きの『カテゴリなし』は、今の値を送り返すときだけ通す (BR-04) 今の値が『カテゴリなし』なら、送り返してメモだけを直せる`
  - `下書きの系統の検査 下書きの『カテゴリなし』は、今の値を送り返すときだけ通す (BR-04) 今の値が別の大項目なら、下書きの『カテゴリなし』は外す`
  - `下書きの系統の検査 下書きの『カテゴリなし』は、今の値を送り返すときだけ通す (BR-04) 送り返しでも、中項目は付けられない`

**指摘 A (中・P05) の全文: 予約の値が 4 つの窓口から保存できた**

- 何が: 本 feature の差分で core/categories.ts の `categoryAllowed` に `if (isNoCategory(b)) return !m;` が入り、中項目の無い『カテゴリなし』を「候補にある」として真を返すようになった。
  予約の値の検査を自前で持たず `categoryAllowed` だけに頼る窓口で、『カテゴリなし』が受け付けられて保存された。
- どの条件で (probe で実測。DB に保存されたことも確かめた):

  | 窓口 | 結果 |
  |---|---|
  | `POST /api/rules` `{cls:'per', big:'カテゴリなし'}` | 201。ルールの大項目が『カテゴリなし』 |
  | 分割の内訳の `PUT` (内訳の 1 行が `{cls:'per', big:'カテゴリなし'}`) | 200。内訳の大項目が『カテゴリなし』 |
  | `PATCH /api/vendor-memory/:vendorKey` `{cls:'per', big:'カテゴリなし'}` | 200。取引先の記憶の大項目が『カテゴリなし』 |
  | `POST /api/cash-entries` `{side:'per', big:'カテゴリなし'}` | 201。現金の明細の大項目 (`category_major`) が『カテゴリなし』 |

  対照として、候補に無い普通の名前はルールと分割で 400 `invalid_category` になった。
- どう壊れるか: BR-04 (予約の値はカテゴリとして選べない) と用語集 (編集パネルでは選べない) への退行。
  ルールや取引先の記憶に入ると、合う明細すべてへ予約の値が自動で配られ、一括保存の解決関数だけが作るはずの『カテゴリなし』が手の届かない経路で増える。
- 直した後: `categoryAllowed` の 1 行を消して「候補に無い値として弾く」意味に戻し、今の値を送り返す 3 か所だけを `categoryAllowedOrKept` に移した。上の api の「新しく値を受ける窓口」4 本と core の「候補の検査は予約の値を候補に無い値として弾く」が確かめる。

**指摘 C (低・P05) の全文: 見分けのつかない書き方の候補が作れた**

- 何が: 1 回目の時点の `isNoCategory` は trim だけで比べ、NFKC の正規化も書式の文字の除去もしていなかった。
- どの条件で (probe): `POST /category-options` に半角カナ『ｶﾃｺﾞﾘなし』を送ると 201 で保存された。末尾に U+200B を付けた『カテゴリなし』も 201。濁点を分けた形 (NFD) は `isNoCategory` が false になった。
- どう壊れるか: 画面で『カテゴリなし』と見分けのつかない候補ができ、それを選んだ明細は「未分類」として数えられない (集計は `isNoCategory` で判定する)。
  被害が広がるのは、先にその候補を作った場合に限られる (作っていなければ、編集と一括保存は 400 `invalid_category` になる)。
- 直した後: 判定を「書式の文字の除去 → NFKC → trim」にし、結果を覚える形にした (上の表の「判定」)。core の「画面で見分けがつかない書き方も…」「判定を覚えても…」と、api の候補の作成のテストに足した半角カナ・ゼロ幅スペース・分解した濁点の例が確かめる。

**指摘 G (中・P05) の全文: 取込値に同じ名前があると、予約の値が候補に入った** (再レビューで発見。6 章)

- 何が: 候補は取込値 (freee の勘定科目・MF の大中項目) と追加の候補から作る。追加の候補は作成の窓口が予約の値を拒むが、取込値は通っていた。
  A の直しは「予約の値は候補に無い」を前提にしていたが、候補の作り方の側でその前提が成り立っていなかった。
- どの条件で: 取込値に『カテゴリなし』という名前の大項目を持つ明細があると、それが候補に入り、`categoryAllowed` が真を返す。ルールに『カテゴリなし』を付けると 201 で保存された。
- どう壊れるか: A と同じ。取込のファイルの中身しだいで、4 つの窓口から予約の値を保存できる。
- 直した後: 候補を作る 1 か所 (`buildScope` の `add`) で、大項目と中項目のどちらも `isNoCategory` に当たる名前を捨てる。窓口ごとに名指しで弾く形にはしない。候補を使う全員 (候補の検査・編集パネル・一括操作バー) に同じ不変条件が効くため。
  core の「取込値や追加の候補に予約の値と同じ名前があっても、候補には入れない」(半角カナ・ゼロ幅スペースの書き方と中項目を含む) と、api の「取込値に同じ名前の大項目があっても受けない (候補に入れない)」が確かめる。

**指摘 H (中・P05) の全文: 取込値が『カテゴリなし』の明細は、メモも直せなかった** (G の確認中に発見。6 章)

- 何が: 「今の値を送り返すのは通す」の今の値を、個別の編集 (予約の値の検査と `categoryAllowedOrKept` の引数) と一括保存の下書きの検査は上書きの層 (`data.edits[txId]`) だけで見ていた。
  画面 (`initialInput` が一覧の行の値を入れる)・core の値の解決 (`current.big`)・一覧の行の判定 (classify-row.ts) は、取込値・ルール・上書きを解決した値を見ていた。
- どの条件で: 取込値だけが『カテゴリなし』で上書きの無い明細を、画面で開いてメモだけを直して保存する。画面は一覧の行の値『カテゴリなし』を送り返すが、サーバは上書きの層 (空) を今の値とみなすので、「新しく『カテゴリなし』を付ける」として拒む。個別の編集は 400、一括保存は `invalid_item` になった。
- どう壊れるか: その明細は、科目を選び直さない限り、メモ・支払方法・名義のどれも直せない。G で取込値の『カテゴリなし』は候補から外れたので、選び直すまで編集パネルは「科目を選ぶ」の未選択の表示になる。
  この feature で足した予約の値の検査 (P05) が生んだもので、G の前からあった。
- 直した後: 2 か所の今の値を、他の 2 か所と同じ意味 (`resolveTx` の結果と `buildClassifyRow` の行) に揃えた。上の api の「取込値が『カテゴリなし』の明細も…」2 本が確かめる。直す前の実装では 2 本とも落ち、3 か所を 1 つずつ戻すと、どれも対応する 1 本だけが落ちた。

### 観点 7: 差分の範囲と秘密情報

5 章にまとめた。

## 4. 追加: core の値の解決関数 — 指摘 D

**指摘 D (中・P05) の全文: 大を持たない提案で、区分だけ・名義だけの一括指定が取込値の組のまま確定した**

- 何が: 1 回目の時点の core/classify-bulk.ts は、組の土台を `pairBase = settled || suggestion ? base : null` で決めていた。
  大も中も null の提案 (組を持たない提案) を、そのまま「同じ区分の組」として採用した。その結果、大と中は空のままになり、候補の検査 (出所が一括指定か下書きのときだけ) も通らなかった。
  route は空の大項目を「取込値へ戻す」として、上書きの層の大項目を NULL で書いた。
- どの条件で (probe で実測):
  1. 取込値が個人の『食費 / カフェ』の明細が 3 件ある取引先に、`PATCH /api/vendor-memory/:vendorKey` `{cls:'biz'}` で区分だけの記憶を作る (200)。
  2. 実績が 0 件なので自動では当てず、未整理の行の提案は `{cls:'biz', big:null, mid:null, owner:null}` になる。
  3. 一括保存 `{bulk:{cls:'biz'}, items:[{txId}]}` は 200・ok・manual になり、画面上は事業の『食費 / カフェ』のまま確定した (区分に合わない科目の印も出ない)。
  4. `{bulk:{owner:'spouse'}}` だけを指定しても同じで、区分は提案の事業になり、組は取込値のまま確定した。
  5. 対照: 同じ組 `{cls:'biz', big:'食費', mid:'カフェ'}` を下書きで明示すると、`invalid_item`「下書きのカテゴリが区分に合いません」で拒まれた。
- どう壊れるか: BR-02・FR-03・UC-3 の「区分だけの指定は、区分が同じ埋める値から組を取り、無ければ『カテゴリなし』」に反する。
  個人の科目のまま事業として確定するので、事業側の集計に事業の候補に無い科目が入る。内訳の出所も「提案」を名乗り、事実と違う。
- 直した後: 大を持たない提案は組の出所にしない (core/classify-bulk.ts:144 `suggestionPair`)。区分と名義は欄ごとに、値を持つ最初の層から取る (:161 `layerOf`。一括指定 → 下書き → 土台 → 今の値)。
- テスト (fullName):
  - core `大を持たない提案は組の出所にしない (用語集『カテゴリなし』・BR-02)` の 9 本。たとえば `大を持たない提案は組の出所にしない (用語集『カテゴリなし』・BR-02) 区分だけの一括指定でも、提案の空の組を同じ区分の組として取らない`
  - api `区分だけの提案 (まだ自動で当てない取引先の記憶) の明細は『カテゴリなし』で保存する (用語集『カテゴリなし』・BR-02) 指定なしで保存すると事業の『カテゴリなし』になり、一覧で区分に合わない科目として出ない`
  - api `区分だけの提案 (まだ自動で当てない取引先の記憶) の明細は『カテゴリなし』で保存する (用語集『カテゴリなし』・BR-02) 区分だけの一括指定でも同じ`
  - api `区分だけの提案 (まだ自動で当てない取引先の記憶) の明細は『カテゴリなし』で保存する (用語集『カテゴリなし』・BR-02) 『カテゴリなし』の明細は、一括保存の下書きで今の値を送り返してメモだけを直せる`
  - api の fixture は記憶を PATCH で作り、保存の前に一覧の行が `{status: 'unsorted', suggestion: {cls: 'biz', big: null, mid: null}}` であることを確かめてから保存する (前提が崩れたときに、緑のまま意味を失わないため)。
- 2 か所を別々に元へ戻した結果は decisions の D の版の表にある (組の土台を戻すと 9 件、区分と名義の落ち先を戻すと 2 件が落ちる)。
- 補足: 名義だけの提案は、提案のラベルが区分・大・中だけで作られる (名義を含まない) ので、今は存在しない。区分が null のまま候補の検査を飛ばす経路は理論上だけにある。

## 5. 差分の範囲

### SPEC_BASE の代わりに見た差分

受け入れ条件は `git diff --stat "${SPEC_BASE}...HEAD"` の全ファイルが feature の resource_scope の内側にあることを求める。
SPEC_BASE の commit は利用者の指示待ちで、まだ無い (decisions「head branch と PR の単位」)。
そこで、HEAD (`9b5bbf3`、origin/main と同じ) と作業ツリーの差 202 件 (変更 112 件・未追跡 90 件。本文書を含む) を、`git status --porcelain -uall` で取り、graph の feature node の `resource_scope` と前方一致で突き合わせた。

| 分類 | 件数 | 中身 |
|---|---|---|
| A resource_scope の内側 | 95 | 実装・テスト・migration・記録文書 (本文書を含む) |
| B 仕様サイクルの成果物 | 100 | dev-graph の登録・計画・描画 39、architecture の既存文書 17、spec 2、仕様の章とその退避 27、macro feature 2、task 仕様書 13 |
| C どちらでもない | 7 | 下の表 |

B は SPEC_BASE に入る予定のもので、SPEC_BASE を commit した後の `SPEC_BASE...HEAD` には現れない。

### 宣言外の 7 件

字面の上では受け入れ条件を満たさない。どれも spec の scope_in の項目へ辿れる必要な変更で、計画が新しく作る module を見込まずに resource_scope を宣言した漏れである。

| ファイル | 辿れる要求 |
|---|---|
| `packages/core/src/classify-bulk.ts` | 新設。一括保存の値の解決関数 (FR-05・BR-01〜03) |
| `packages/core/src/no-category.ts` | 新設。『カテゴリなし』の予約の値 (FR-18・BR-04) |
| `packages/core/src/expense-projection.ts` | 家計の集計で『カテゴリなし』を未分類と同じに扱う (FR-18) |
| `packages/core/src/total-cashflow.ts` | 総収支の内訳で同じ扱い (FR-18) |
| `packages/core/src/types.ts` | 提案の入力 (Dataset) に勘定科目の対応表を足す 3 行 (FR-14・FR-17) |
| `packages/api/src/tx-edit-codec.ts` | json_each で束ねて書く `tx_edits` の列の定義 39 行。単一の書き込みと同じ正規化を通す (FR-06) |
| `packages/web/src/backup-restore.dom.test.tsx` | 復元の差分の fixture に対応表の欄を足す 1 行 (FR-17。バックアップが対応表を含むようになったため) |

dev-graph 0.1.11 には、登録済みの package の resource_scope を直す経路が無い (register-package の verb は register・preflight・execution-context だけ)。
task 仕様を手で書き換えると package の digest とずれ、コードを scope の内側のファイルへ移すと設計が悪くなる。
そこで直さずに、ここに記録する。直し方は plugin の改善案として返す (計画が新設の module を見込んで scope を宣言する、scope を直す verb を設ける)。

### ローカル secrets・`data/`・実データ

| 確かめたこと | 結果 |
|---|---|
| 202 件のうち `data/` 配下とローカル secrets のファイル | 0 件 |
| 差分の追加行 (`git diff HEAD`) と未追跡の 90 件の本文を、鍵・token・JWT・秘密の代入・seed のパスワード・メールアドレス・電話番号の 10 種の形で検査 | 当たりは 5 件。どれも統合テストが作る架空の利用者 (アドレスは予約 TLD の `.test`、パスワードは `Synthetic-Temp-Password-1`)。鍵・token・seed のパスワードは 0 件 |
| 明細の fixture | 架空の取引先・金額だけ。匿名サンプル (samples/) は変えていない |

検査の正規表現は `<scratchpad>/scan-diff-secrets.py` にあり、読み取りだけで何も書かない。

### 他のブランチと lease

| 確かめたこと | 結果 |
|---|---|
| 開いている PR | 0 件 |
| リモートのブランチ (origin/main を除く) | 16 本。`origin/main...<branch>` の差分が本 feature の 201 件 (本文書を除く) と重なるのは 11 本、宣言外の 7 件と重なるのは 4 本 |
| 宣言外の 7 件と重なる 4 本 | `devgraph/feat-subscriptions-merge` (#75 で merge 済み) と `feat/import-lifecycle-and-classification` (#11 で merge 済み) は、squash merge なので分岐点が古いまま残り、main に入った変更が差分に出る。`feat/ui-refresh` と `feat/webapp-v1` は PR が無く、最初の commit (2026-08-24) から分かれた立ち上げ期のブランチで、中身は #2 で main に入っている。最後の commit は 2026-08-25 |
| 重なる 11 本 | どれも PR が merge 済みか、上の立ち上げ期の 2 本。開いている作業は無い |
| worktree lease | 記録は 13 件で、どれも解放済みか期限切れ (最後は 2026-09-06)。有効な lease は 0 件 |

実際に衝突する変更は 0 件である。

### 進め方が task の branch 方針から外れた点

task 仕様の branch 方針は「1 task 1 branch・着手前に worktree lease を claim・完了時に head branch を fast-forward」である。
本 feature は、commit・push・PR を利用者の指示があるまで行わない指示に従い、1 つの作業ツリーで P01〜P13 を順に進めた。
task ごとの branch と commit が無いので lease も claim していない。SYS-CLASSIFY-BULK の lease は 0 件である。
利用者の指示で commit するときは、head branch `devgraph/feat-classify-bulk-save` に SPEC_BASE と実装を分けて積む (decisions「head branch と PR の単位」)。

## 6. 再レビュー

A〜F を直した後に、同じ観点でコードを読み直した。

- G: A の直しは「予約の値は候補に無い」を前提にしていた。候補を作る `buildCandidates` を読むと、追加の候補は作成の窓口が拒むが、取込値はそのまま候補に入る。取込値に同じ名前を持つ fixture で、ルールの保存が 201 になることを確かめた。
- H: G の直しを記録する段で、decisions の「今の値を送り返すのは通す」という記述をコードと突き合わせた。今の値を見る 4 か所のうち 2 か所が上書きの層だけを見ていて、残りの 2 か所 (画面と core) と意味が違った。取込値だけが『カテゴリなし』の明細で、個別の編集が 400 になることを確かめた。
- G・H を直した後、観点 1〜6 の表の行番号と fullName をすべて取り直し、テストを回し直した (1 章)。

G と H は、どちらも「1 つの値の意味を、複数の場所が別々に決めていた」ことから来ている。
G は「候補」の意味 (予約の値を含まない) を候補を作る段で 1 回だけ成り立たせ、H は「今の値」の意味 (解決した値) を 4 か所で揃えて閉じた。

## 7. 確かめられなかったこと・推測

- Content-Length を偽った本文の、本番 (Cloudflare Workers) での挙動。in-process の `app.request` は、ヘッダと本文の食い違いを検査しないので 200 まで進んだ。本番では HTTP の framing により Content-Length を超えた部分は本文として届かないと推測するが、実機では確かめていない。
- AC-25 の時間差は測っていない。どの経路も自分の明細を全件読んでからメモリ上で突き合わせるので、処理時間は他の利用者の key が実在するかどうかに依存しないと推測する (コードからの推論だけ)。
- 古いブランチ (`feat/ui-refresh`・`feat/webapp-v1`) の意図。PR が無く、最後の commit が 2026-08-25 なので進行中ではないと推測したが、作者には確かめていない。
- `keys=a,,b` のように空の key を含む選択は 400 `invalid_query` になる。spec は空の key の扱いを書いていない。存在の漏えいには当たらないので、指摘にはしなかった。
