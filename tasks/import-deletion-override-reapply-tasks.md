---
graph_node_id: "tasks-import-deletion-override-reapply"
artifact_kind: "task"
title: "取込データの削除・上書きと手当ての継続再適用 — タスク分解"
project_id: "kanjo"
domain: "accounting-records"
status: "draft"
file_path: "tasks/import-deletion-override-reapply-tasks.md"
parent_feature: "feat-import-deletion-override-reapply"
template_id: "task"
template_version: "1.0.1"
---

# タスク分解

`specs/import-deletion-and-override-reapply.md` を実装単位に割ったもの。
Slice 0 が純関数の境界、Slice 1 が永続化とAPI、Slice 2 が画面、Slice 3 が運用。
上から順に依存する。

**着手前の前提**: 仕様の「未決事項」4件のうち D01〜D04 が未決のままだと、
Slice 1 以降が仮定の上に載る。D01〜D04 を先に閉じること。

## Slice -1 — 未決事項の決着（実装の前提）

### D01 決め事の確信度を数値にする

- 対象: `specs/import-deletion-and-override-reapply.md` の「取引先単位の決め事」
- 内容: `confidence` の算出式、自動適用の初期閾値、取消率を見ながら緩める判断基準を数値で定める。
- 受入: 「利用者へ問う件数を逓減させる」が測定可能になる（初回取込時の質問件数に対する
  N回目の質問件数の比、という形で判定できる）。
- 依存: なし

### D02 conflict を属性単位へ作り替える範囲を見積もる

- 対象: `packages/core/src/classify.ts`, `packages/api/src/routes/classify.ts`,
  `packages/web/src/pages/Classify.tsx`
- 内容: 現行の `conflict` は明細単位の真偽1つで、どの属性が衝突したかを持たない。
  4属性それぞれの3分岐を返す形へ変えると `resolveTx` の戻り値型が変わり、呼出側と既存テストが波及する。
  互換のため明細単位の `conflict` を導出値として残すか、呼出側をすべて直すかを決める。
- 受入: 波及するファイルとテストが列挙され、どちらの方針を採るかが決まっている。
- 依存: なし

> **注意 — `balance_entries` / `cash_entries` に `import_id` を足さないこと。**
> `migrations/0026` は意図して `source ('mf'|'manual')` で区別し、
> 「取込は `source='mf'` の行しか消さない。これが無いと、CSVを入れ直すたびに手入力した負債が消える」と
> 明記している。`cash_entries`(`0006` / `0007`)も意図して非取込由来で、
> `0007` は `cash:*` edit の誤付着防止に `AUTOINCREMENT` 再構築までしている。
> 取込単位削除の対象特定は `balance_entries` は `source='mf'` かつ対象月で行い、
> `cash_entries` は DR-6 の巻き添え防止対象として削除の対象集合に入れない。

### D03 既存明細への base 埋め移行を設計する

- 対象: `migrations/`、`packages/core/src/persisted-projection.ts`
- 内容: `base_cls` / `base_owner` を持たない既存 `tx_edits` 行に対し、
  どの時点で・どの経路で現在の取込値を base として埋めるかを決める。
- 受入: 移行の前後で手当ての扱いが変わらない。移行前の明細が初回だけ
  DR-10 の分岐2（incoming 採用）へ倒れない。
- 依存: なし

### D04 undo 退避行の保持期間を決める

- 対象: `specs/import-deletion-and-override-reapply.md` DR-8
- 内容: 保持日数の具体値と、1日あたりの削除規模の見積り。
  D1 Free の 500 MB と rows written 10万/日 に照らして妥当性を確認する。
- 受入: 保持期間が数値で定まり、掃除ジョブの対象条件が書ける。
- 依存: なし

## Slice 0 — 境界（core 純関数）

### T01 コア — 3点比較の真理値

- 変更: `packages/core/src/classify.ts`（既存 `resolveTx` の `conflict` を作り替える）,
  `packages/core/src/index.ts`
- 内容: **ゼロから作らない。** 現行の `classify.ts:131-134` は `base_major` / `base_mid` から
  明細単位の `conflict` を既に算出している。これを属性ごとの
  `resolveThreeWay(base, current, incoming)` へ作り替え、4属性
  （`cls` / `category_major` / `category_mid` / `owner`）へ適用する。
  DR-10 の3分岐（手当て維持 / incoming 採用と base 前進 / 衝突）だけを返し、4分岐目を作らない。
  現行が `editedCat` を前提条件にしている制約を外す。
- 受入: `base == incoming` で current が残る。`base != incoming` かつ
  `current == base` で incoming が採られ base が incoming へ進む。
  双方が変わったときだけ `conflict` を返す。
- 証拠: `packages/core/test/three-way-contract.test.ts`
- 依存: なし

### T02 コア — stable_key と適用の優先順位

- 変更: `packages/core/src/fingerprint.ts`, `packages/core/src/classify.ts`
- 内容: `tx_id` を第一・`stable_key` を第二とする同一性解決（DR-13）と、
  `tx_edits` > `rules` > `vendor_memory` > 取込原本値 の優先順位解決（DR-12）。
  `stable_key` の正規化は既存 `fingerprint.ts` と同じ関数を使い、複製しない。
- 受入: MF側で `tx_id` が振り直されても `stable_key` で追随する。
  `fingerprint_version` で版が判別できる。優先順位が固定順で解決される。
- 証拠: `packages/core/test/identity-precedence-contract.test.ts`
- 依存: T01

### T03 コア — 削除の対象特定と巻き添え計算

- 変更: `packages/core/src/dataset.ts`（または新規 `deletion.ts`）
- 内容: 4粒度（明細 / 取込 / 期間×種別 / 全件）の対象集合を決める純関数と、
  巻き添えになる手動記録（`tx_edits` / `tx_splits` / `cash_entries` / `attachments`）の
  件数を数える関数。確認指紋の生成もここ。
- 受入: 指定範囲外が対象集合に入らない。巻き添え件数が実データと一致する。
  同じ範囲から同じ確認指紋が再現する。
- 証拠: `packages/core/test/deletion-scope-contract.test.ts`
- 依存: なし

### T04 コア — 決め事の確信度

- 変更: `packages/core/src/classify.ts`（または新規 `vendor-memory.ts`）
- 内容: `vendor_key` の正規化、`hit_count` / `disagree_count` からの `confidence` 算出、
  閾値判定、`pinned` の扱い。式と閾値は D01 の決定に従う。
- 受入: 閾値未満は自動適用されず候補提示に留まる。`pinned` は confidence によらず適用される。
  取消が `disagree_count` へ反映され confidence が下がる。
- 証拠: `packages/core/test/vendor-memory-contract.test.ts`
- 依存: D01

## Slice 1 — 縦切り（永続化と API）

### T05 永続 — 退避・監査・決め事のスキーマ

- 変更: `migrations/0029_*.sql` 以降（append-only の連番。`0016` / `0017` は欠番で詰めない）,
  `packages/api/src/import-active.ts`
- 内容: 退避テーブル（削除1行につき1行。**削除前の `content_hash` / `import_id` / `updated_at` を含める** —
  DR-4 の巻き戻し先はここからしか得られない）、操作監査テーブル、`vendor_memory` テーブル、
  `tx_edits` への `base_cls` / `base_owner` / `stable_key` / `fingerprint_version` 追加。
  既存テーブルの破壊的再定義をしない。
  **JSON 復元の write-set を変えるテーブルは `JSON_SNAPSHOT_MUTATION_CONSUMERS` へ登録する。**
- 受入: `docs/data-schema.md` の記述と実スキーマが一致する。既存 migration が壊れない。
  列挙外の mutation が型で接続不能なまま保たれている。
- 証拠: `packages/api/src/schema-guard.test.ts`
- 依存: D02, D03

### T06 API — preflight と確認指紋

- 変更: `packages/api/src/routes/`, `packages/api/src/import-lifecycle.ts`
- 内容: `POST /api/imports/:id/undo/preflight` と `POST /api/data/deletions/preflight`。
  範囲はサーバ側で再解釈し、クライアントの主張を信用しない（DR-1）。書き込みなし。
- 受入: 件数・期間・巻き添え件数・確認指紋・取り消し可否と期限を返す。
  preflight 自体は state を動かさない。
- 証拠: `packages/api/src/deletion-preflight.test.ts`
- 依存: T03, T05

### T07 API — 削除の実行と退避

- 変更: `packages/api/src/routes/`, `packages/api/src/import-lifecycle.ts`,
  `packages/api/src/import-active.ts`
- 内容: `POST /api/imports/:id/undo` と `POST /api/data/deletions`。
  退避を先に書いてから本体を変える（DR-2）。`import_writer_claims` 配下で直列化（DR-3）。
  `import_active_targets` の現行指紋を対で巻き戻す（DR-4）。
  `monthly_agg` を実データから再生成する（DR-5）。手動記録は巻き添えにしない（DR-6）。
- 受入: 確認指紋不一致が409。指定範囲外が1件も変化しない。削除後に同じファイルを
  `duplicate` にならず入れ直せる。`tx_splits` / `attachments` / `cash_entries` が残る。
- 証拠: `packages/api/src/deletion-lifecycle.test.ts`
- 依存: T06

### T08 API — undo と保持期間

- 変更: `packages/api/src/routes/`
- 内容: `POST /api/data/undo/:operationId`。退避行から巻き戻す。
  保持期間外は410。
- 受入: undo 後の各テーブルの行数と内容が実行前と完全に一致する。期限切れが410。
- 証拠: `packages/api/src/deletion-undo.test.ts`
- 依存: T07, D04

### T09 API — 差分プレビューと3点比較の書戻し

- 変更: `packages/api/src/import-pipeline.ts`, `packages/api/src/d1-limits.ts`
- 内容: `POST /api/imports/diff`。取込単位でまとめ読みし、書戻しは
  `INSERT ... ON CONFLICT DO UPDATE` で SELECT を省いて1文にまとめる。
  既存 `planMultipartImportQueries` と同じ考え方で計画し、
  commit 直前に `actual <= planned` を fail-closed で保証する。
- 受入: 通常幅5,000行の取込で 49 D1 queries 以内。追加/変更/削除/不変の件数と、
  衝突行の base/current/incoming を返す。
- 証拠: `packages/api/src/import-diff.test.ts`, `packages/api/src/d1-limits.test.ts`
- 依存: T01, T02, T05

### T10 API — 決め事の一覧と操作

- 変更: `packages/api/src/routes/`
- 内容: `GET /api/vendor-memory`, `PATCH /api/vendor-memory/:vendorKey`,
  `POST /api/vendor-memory/:vendorKey/reapply`。
- 受入: 他利用者の決め事を参照・更新できない。取消が以後の自動適用を止め、
  再判定で過去の自動適用を戻せる。
- 証拠: `packages/api/src/vendor-memory.test.ts`
- 依存: T04, T05

### T11 API — 監査記録

- 変更: `packages/api/src/routes/`
- 内容: `GET /api/data/operations`。操作種別・範囲・件数・日時だけを返し、
  明細本体を複製しない（DR-9）。
- 受入: 明細本体・金額がログとエラー応答に含まれない。他利用者の記録を参照できない。
- 証拠: `packages/api/src/audit-log.test.ts`
- 依存: T07

## Slice 2 — 画面

### T12 画面 — 削除の入口と二段階確認

- 変更: `packages/web/src/pages/Import.tsx`
- 内容: 取込履歴の各行へ「この取込を取り消す」を追加。期間・種別・全件の入口。
  preflight の要約を挟む二段階確認。全件は範囲の明示入力を必須とする。
  内部のテーブル名・SQL・明細の生データを画面へ出さない。
- 受入: 単一のクリックで全件削除へ到達しない。巻き添え件数が確認画面に出る。
- 証拠: `packages/web/src/pages/Import.deletion.test.tsx`
- 依存: T06, T07

### T13 画面 — 差分プレビューと衝突行

- 変更: `packages/web/src/pages/Import.tsx`
- 内容: 追加/変更/削除/不変の件数を先に出す。自動で決まった分は**要約だけ**。
  行として出すのは真の衝突と閾値未満の候補の2種類だけ。
  衝突行は base/current/incoming を並べて1操作で選べる。既定は手当ての維持（DR-11）。
  同じ取引先の同じ選択をまとめて扱え、決め事として覚えるかを同じ場で選べる。
- 受入: 無操作で確定しても手当てが消えない。全件目視確認を強いる作りになっていない。
- 証拠: `packages/web/src/pages/Import.diff.test.tsx`
- 依存: T09, T12

### T14 画面 — undo 導線と決め事の一覧

- 変更: `packages/web/src/pages/Import.tsx`, `packages/web/src/pages/Settings.tsx`
- 内容: 実行直後のその場取り消しと、保持期間内の履歴からの取り消し（期限を明示）。
  設定配下に決め事の一覧（取引先・適用内容・確信度・適用件数・最終適用日）と
  取消 / pin / 修正の3操作、再判定の導線。
- 受入: 自動適用された明細に決め事由来の印が付き、その場から決め事へ辿れる。
- 証拠: `packages/web/src/pages/VendorMemory.test.tsx`
- 依存: T08, T10, T13

## Slice 3 — 運用

### T15 運用 — 退避行の掃除

- 変更: `packages/api/src/index.ts`（既存の夜間 scheduled 経路）
- 内容: 保持期間を過ぎた退避行を掃除する。既存の夜間ジョブと同じ経路に載せ、
  新しい起動経路を作らない。
- 受入: 期限切れの退避行が残らない。掃除が他のデータへ波及しない。
- 証拠: `packages/api/src/deletion-retention.test.ts`
- 依存: T08, D04

### T16 運用 — 仕様と実装の突合

- 変更: `docs/data-schema.md`, `specs/import-deletion-and-override-reapply.md`
- 内容: 実装で確定した数値（confidence の式・閾値、保持日数、
  `balance_entries` / `cash_entries` の由来）を仕様へ書き戻し、「未決事項」を空にする。
- 受入: 仕様の「未決事項」が0件になる。`architecture/graph.json` の digest が
  `scripts/check-graph-lineage.mjs` で緑のまま。
- 依存: T01〜T15

# 受入証拠台帳

仕様側の受入27件に対する証拠の対応表は、実装着手時にこの節へ足す。
現時点では各タスクの「証拠」欄が唯一の対応である。
