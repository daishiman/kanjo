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

**着手前の前提**: 旧 D01〜D04 は決定 D4〜D7 として確定済み。
決定内容の正本は `system-spec/spec-state.json` と
`specs/import-deletion-and-override-reapply.md#決定済み事項-旧未決事項` に集約する。

## Slice -1 — 決定済み事項への参照（実装の前提）

- D4: `vendor_memory` の confidence 式・閾値・緩和基準
- D5: `conflict` を属性単位へ一括移行する範囲
- D6: base を再取込直前に遅延埋めする方式
- D7: undo 保持 30 日・容量上限 300 MB の二段構え
- D8: 操作ヘッダは範囲/件数/日時/結果のみを400日保持。属性別 before/after と
  採用根拠は別の判定明細へ90日だけ保持する。明細本体と金額はどちらにも持たず、
  復元payloadは期限付きundo退避に限定する

> **注意 — `balance_entries` / `cash_entries` に `import_id` を足さないこと。**
> `migrations/0026` は意図して `source ('mf'|'manual')` で区別し、
> 「取込は `source='mf'` の行しか消さない。これが無いと、CSVを入れ直すたびに手入力した負債が消える」と
> 明記している。`cash_entries`(`0006` / `0007`)も意図して非取込由来で、
> `0007` は `cash:*` edit の誤付着防止に `AUTOINCREMENT` 再構築までしている。
> 取込単位削除の対象特定は `balance_entries` は `source='mf'` かつ対象月で行い、
> `cash_entries` は DR-6 の巻き添え防止対象として削除の対象集合に入れない。

## Slice 0 — 境界（core 純関数）

### T01 コア — 3点比較の真理値

- 変更: `packages/core/src/classify.ts`（既存 `resolveTx` の `conflict` を作り替える）,
  `packages/core/src/index.ts`
- 内容: **ゼロから作らない。** 現行の `classify.ts:131-134` は `base_major` / `base_mid` から
  明細単位の `conflict` を既に算出している。これを属性ごとの
  `resolveThreeWay(base, current, incoming)` へ作り替え、4属性
  （`cls` / `category_major` / `category_mid` / `owner`）へ適用する。
  DR-10 の3分岐（手当て維持 / incoming 採用と base 前進 / 衝突）だけを返し、4分岐目を作らない。
  現行が `editedCat` を前提条件にしている制約を外す。属性別結果を正本とし、
  `conflict: boolean` を残す場合は属性別結果から毎回求める API 互換値に限定する。
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
- 内容: 4粒度（明細 / 取込 / 期間 / 全件）の対象集合を決める純関数と、
  期間・全件にだけ適用できる種別フィルタ、
  巻き添えになる手動記録（`tx_edits` / `tx_splits` / `attachments`）の件数を数える関数。
  `cash_entries` は取込削除の対象外とし、巻き添え 0 件の表示契約だけを持つ。確認指紋の生成もここ。
- 受入: 指定範囲外が対象集合に入らない。巻き添え件数が実データと一致する。
  同じ範囲から同じ確認指紋が再現する。
- 証拠: `packages/core/test/deletion-scope-contract.test.ts`
- 依存: なし

### T04 コア — 決め事の確信度

- 変更: `packages/core/src/classify.ts`（または新規 `vendor-memory.ts`）
- 内容: `vendor_key` の正規化、`hit_count` / `disagree_count` からの `confidence` 算出、
  閾値判定、`pinned` の扱い。式と閾値は D4 の決定に従う。
- 受入: 閾値未満は自動適用されず候補提示に留まる。`pinned` は confidence によらず適用される。
  取消が `disagree_count` へ反映され confidence が下がる。
- 証拠: `packages/core/test/vendor-memory-contract.test.ts`
- 依存: D4

## Slice 1 — 縦切り（永続化と API）

### T05 永続 — 退避・決め事のスキーマ

- 変更: `migrations/0030_import_deletion_and_vendor_memory.sql`,
  `migrations/0031_tx_edit_provenance.sql`（append-only の連番。既存 migration は変更しない）,
  `packages/api/src/import-active.ts`
- 内容: 退避テーブル（削除1行につき1行。**削除前の `content_hash` / `import_id` / `updated_at` を含める** —
  DR-4 の巻き戻し先はここからしか得られない）、`vendor_memory` テーブル、
  `tx_edits` への `base_cls` / `base_owner` / `stable_key` / `fingerprint_version` 追加と、
  自動適用由来を値一致から推測しないための `origin` / `origin_key` 追加。
  既存テーブルの破壊的再定義をしない。
  **JSON 復元の write-set を変えるテーブルは `JSON_SNAPSHOT_MUTATION_CONSUMERS` へ登録する。**
- 受入: `docs/data-schema.md` の記述と実スキーマが一致する。既存 migration が壊れない。
  列挙外の mutation が型で接続不能なまま保たれている。
- 証拠: `packages/api/src/schema-guard.test.ts`
- 依存: D5, D6

### T06 API — preflight と確認指紋

- 変更: `packages/api/src/routes/`, `packages/api/src/import-lifecycle.ts`
- 内容: `POST /api/imports/:id/undo/preflight` と `POST /api/data/deletions/preflight`。
  範囲はサーバ側で再解釈し、クライアントの主張を信用しない（DR-1）。書き込みなし。
- 受入: 件数・期間・巻き添え件数・確認指紋・取り消し可否と期限を返す。
  preflight 自体は state を動かさない。
- 証拠: `packages/api/src/deletion-lifecycle.test.ts`
- 依存: T03, T05

### T07 API — 削除の実行と退避

- 変更: `packages/api/src/routes/`, `packages/api/src/import-lifecycle.ts`,
  `packages/api/src/import-active.ts`
- 内容: `POST /api/imports/:id/undo` と `POST /api/data/deletions`。
  退避を先に書いてから本体を変える（DR-2）。`import_writer_claims` 配下で直列化（DR-3）。
  `import_active_targets` の現行指紋を対で巻き戻す（DR-4）。
  正本の変更後 snapshot から `monthly_agg` を計画し、退避・本体変更・集計置換を同じ D1 batch で確定する（DR-2 / DR-5）。手動記録は巻き添えにしない（DR-6）。
- 受入: 確認指紋不一致が409。指定範囲外が1件も変化しない。集計置換の故障時に正本だけ確定しない。削除後に同じファイルを
  `duplicate` にならず入れ直せる。`tx_splits` / `attachments` / `cash_entries` が残る。
- 証拠: `packages/api/src/deletion-lifecycle.test.ts`
- 依存: T06

### T08 API — undo と保持期間

- 変更: `packages/api/src/routes/`
- 内容: `POST /api/data/undo/:operationId`。退避行から巻き戻し、復元後 snapshot から計画した
  `monthly_agg` 置換まで同じ D1 batch で確定する。
  保持期間外は410。
- 受入: undo 後の各テーブルの行数と内容が実行前と完全に一致する。集計置換の故障時に復元だけ確定しない。期限切れが410。
- 証拠: `packages/api/src/deletion-lifecycle.test.ts`
- 依存: T07, D7

### T09 API — 差分プレビューと3点比較の書戻し

- 変更: `packages/api/src/import-diff.ts`, `packages/api/src/routes/import-diff.ts`,
  `packages/api/src/routes/imports.ts`, `packages/api/src/import-lifecycle.ts`, `packages/api/src/d1-limits.ts`
- 内容: `POST /api/imports/diff` は読み取り専用とし、旧 `apply=1` も400 `diff_read_only`で拒否する。
  base遅延補完・stable-key・解決選択は、previewと同じresolver/fingerprintを使う通常
  `POST /imports` の確定batchでだけ書く。取込単位でまとめ読みし、
  既存 `planMultipartImportQueries` と同じ考え方で計画し、
  commit 直前に `actual <= planned` を fail-closed で保証する。
- 受入: 通常幅5,000行の取込で 49 D1 queries 以内。追加/変更/削除/不変の件数と、
  衝突行の base/current/incoming を返す。previewはwriter claimを変更せず、現金併存月でも同じfingerprintのまま確定できる。
- 証拠: `packages/api/src/import-diff.test.ts`, `packages/api/src/d1-limits.test.ts`
- 依存: T01, T02, T05

### T10 API — 決め事の一覧と操作

- 変更: `packages/api/src/routes/imports.ts`, `packages/api/src/routes/vendor-memory.ts`,
  `packages/api/src/import-lifecycle.ts`, `packages/api/src/store.ts`
- 内容: `GET /api/vendor-memory`, `PATCH /api/vendor-memory/:vendorKey`,
  `POST /api/vendor-memory/:vendorKey/reapply`。加えて通常 `POST /imports` がactiveな決め事を1 statementで一括読みし、
  `tx_edits > rules > vendor_memory > import/default` で解く。高確信はprovenance付きで自動適用、
  低確信は候補、今回の回答はlearningとして別計上する。
- 受入: 他利用者の決め事を参照・更新できない。取消が以後の自動適用を止め、
  再判定で過去の自動適用を戻せる。個別解除は高信頼でも即再適用せず、手動行を壊さず不一致を1回だけ数える。
- 証拠: `packages/api/src/vendor-memory.test.ts`, `packages/api/src/import-diff.test.ts`
- 依存: T04, T05

### T11 API — 監査記録

- 変更: `migrations/0033_audit_log.sql`, `packages/api/src/audit-log.ts`,
  `packages/api/src/index.ts`, `packages/api/src/routes/`
- 内容: `audit_log`は1操作1行で操作種別・範囲・件数・日時・結果だけを持つ。
  `audit_log_detail`は不透明化した明細keyと、判定した1属性の before/after・理由コード・
  不透明化した採用元keyだけを持つ。明細本体・金額は両層に複製せず、undo payloadは監査として扱わない。
  純粋statement builderの戻り値をdelete/undo/import-resolutionの正本書込みと同じD1 batchへ追加する。
  `import_deletion_operations`は30日のundo metadataに限定し、退避行/targetと同時に掃除する。
  `GET /data/operations`は`audit_log`を正本とし、期限内のdeleteだけundo metadataをjoinする。
  掃除はheader 400日/detail 90日で独立し、detailは300MB以上で期限前の古い行も有界掃除する。
- 受入: builder/schemaの両方が生の明細ID、明細本体、金額、無制限JSONを拒否する。
  他利用者の記録を参照できず、header/detail/undo退避の掃除結果を層別に観測できる。
- 証拠: `packages/api/src/audit-log.test.ts`, `packages/api/src/audit-log-d8.test.ts`
- 依存: T07, T09, T10

## Slice 2 — 画面

### T12 画面 — 削除の入口と二段階確認

- 変更: `packages/web/src/pages/Classify.tsx`, `packages/web/src/pages/Import.tsx`,
  `packages/web/src/components/ImportDeletion.tsx`
- 内容: 仕分け中の MF 親明細へ「この明細を削除」を追加し、現金・分割子には出さない。
  取込履歴の各行へ「この取込を取り消す」を追加。期間・全件の入口では種別を任意フィルタとして扱う。
  preflight の要約を挟む二段階確認。全件は範囲の明示入力を必須とする。
  内部のテーブル名・SQL・明細の生データを画面へ出さない。
- 受入: 単一のクリックで全件削除へ到達しない。巻き添え件数が確認画面に出る。
- 証拠: `packages/web/src/classify-deletion.dom.test.tsx`, `packages/web/src/pages/Import.deletion.test.tsx`
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

- 変更: `packages/web/src/pages/Classify.tsx`, `packages/web/src/pages/Import.tsx`,
  `packages/web/src/pages/Settings.tsx`, `packages/web/src/components/ImportDeletion.tsx`
- 内容: 実行直後のその場取り消しと、保持期間内の履歴からの取り消し（期限を明示）。
  設定配下に決め事の一覧（取引先・適用内容・確信度・適用件数・最終適用日）と
  取消 / pin / 修正の3操作、再判定の導線。
- 受入: 自動適用された明細に決め事由来の印が付き、その場から決め事へ辿れる。
- 証拠: `packages/web/src/components/VendorMemory.test.tsx`
- 依存: T08, T10, T13

## Slice 3 — 運用

### T15 運用 — 退避行の掃除

- 変更: `packages/api/src/index.ts`, `packages/api/src/scheduled-maintenance-budget.ts`（既存の夜間 scheduled 経路）
- 内容: 保持期間を過ぎた退避行を掃除する。既存の夜間ジョブと同じ経路に載せ、
  新しい起動経路を作らない。7 jobのD1上界を中央で合成し、backupを先に確定してから残る6 jobを独立実行する。
- 受入: 期限切れの退避行が残らない。掃除が他のデータへ波及せず、全jobのworst pathでも46 queries以下。
- 証拠: `packages/api/src/deletion-retention.test.ts`, `packages/api/src/scheduled-maintenance-budget.test.ts`
- 依存: T08, D7

### T16 運用 — 仕様と実装の突合

- 変更: `docs/data-schema.md`, `specs/import-deletion-and-override-reapply.md`
- 内容: 実装で確定した数値（confidence の式・閾値、保持日数、
  `balance_entries` / `cash_entries` の由来）を仕様へ書き戻し、D4〜D8 の正本と実装を突合する。
- 受入: 仕様の決定済み事項と実装に相反がない。`architecture/graph.json` の digest が
  `scripts/check-graph-lineage.mjs` で緑のまま。
- 依存: T01〜T15

### T17 取込履歴 — 非有効attemptの破棄

- 変更: `migrations/0034_import_discard_audit.sql`, `packages/core/src/deletion.ts`,
  `packages/api/src/import-history-discard.ts`, `packages/api/src/routes/deletions.ts`,
  `packages/web/src/components/ImportDeletion.tsx`, `packages/web/src/pages/Import.tsx`
- 内容: `failed` / `duplicate` に限り、preflightと確認指紋を通して履歴を破棄する。
  active target・canonical行・undo退避があれば拒否し、共有R2原本は最後の参照まで保持する。
  会計データの「取り消す」、再試行の「やり直す」「やり直しをやめる」と操作を分離する。
- 受入: DR-17を満たし、帳簿・他利用者・共有原本へ波及しない。R2失敗は再試行可能なcleanupへ残る。
- 証拠: `packages/core/test/import-history-discard-contract.test.ts`,
  `packages/api/src/import-history-discard.test.ts`, `packages/web/src/pages/Import.discard.test.tsx`
- 依存: T11, T12, T16

# 受入証拠台帳

仕様側 (`specs/import-deletion-and-override-reapply.md` の「受入」) の各項目に対し、
それを落とすテストを1つ以上対応させる。緑であることではなく、**壊したときに赤くなること**が
証拠である。実装を意図的に壊して該当テストだけが赤くなるかを確かめたものには印を付けた。

| 受入 | 証拠 |
|---|---|
| 取込単位の取り消しで他の取込由来が1件も減らない | `packages/api/src/deletion-lifecycle.test.ts` |
| failed/duplicateの履歴だけを破棄でき、active・canonical・undo参照があれば拒否される | `packages/core/test/import-history-discard-contract.test.ts`, `packages/api/src/import-history-discard.test.ts` |
| 共有R2原本は最後の参照まで保持され、削除失敗は再試行へ残る | `packages/api/src/import-history-discard.test.ts` |
| 履歴削除と会計データ取消・再試行中止が画面上で混同されない | `packages/web/src/pages/Import.discard.test.tsx`, `packages/web/src/import-reimport.dom.test.tsx` |
| 指定範囲外のデータが1件も変化しない | `packages/core/test/deletion-scope-contract.test.ts`, `packages/api/src/deletion-lifecycle.test.ts` |
| 確認画面に対象件数・期間・巻き添え件数が出る | `packages/web/src/classify-deletion.dom.test.tsx`, `packages/web/src/pages/Import.deletion.test.tsx` |
| 示された件数以外の手動記録が失われない | `packages/core/test/deletion-scope-contract.test.ts` |
| 確認指紋の不一致が409で拒否され状態が動かない | `packages/api/src/deletion-lifecycle.test.ts` |
| 実行直後の取り消しで行数と内容が完全に一致する | `packages/api/src/deletion-lifecycle.test.ts` |
| 保持期間を過ぎた undo が410、退避行が掃除されている | `packages/api/src/deletion-retention.test.ts` |
| 掃除でundo退避・target・metadataが消え、監査ヘッダは残る | `packages/api/src/deletion-retention.test.ts` ✓突然変異 |
| 1回の掃除に上限があり掃除済みを拾い直さない | `packages/api/src/deletion-retention.test.ts` ✓突然変異 |
| 容量上限で期限内でも古い世代から前倒しに捨てる | `packages/api/src/deletion-retention.test.ts` |
| 前倒しの世代は `undoable:false` で期限切れと別文言 | `packages/api/src/deletion-retention.test.ts`, `packages/web/src/pages/Import.deletion.test.tsx` |
| 削除後に指紋が巻き戻り同じファイルを入れ直せる | `packages/api/src/deletion-lifecycle.test.ts`, `packages/web/src/import-reimport.dom.test.tsx` |
| 削除・undo と `monthly_agg` 置換が同じ batch で確定し、片側だけ残らない | `packages/api/src/deletion-lifecycle.test.ts` |
| import-resolutionの3点比較・rule・vendor判定と属性監査が同じ batch で確定する | `packages/api/src/import-diff.test.ts`, `packages/api/src/import-lifecycle-pure.test.ts` |
| 削除後の `monthly_agg` / `imports` / `balance_entries` が再計算値と一致 | `packages/api/src/deletion-lifecycle.test.ts` |
| 監査記録に明細本体・金額が含まれない | `packages/api/src/deletion-lifecycle.test.ts`, `packages/api/src/d1-limits.test.ts` (拒否理由にも載せない), `packages/web/src/pages/Import.deletion.test.tsx` |
| `base == incoming` で手当てが維持される | `packages/core/test/three-way-contract.test.ts` |
| `base != incoming` かつ未編集で incoming が採られ base が進む | `packages/core/test/three-way-contract.test.ts` |
| 双方が変わった属性だけが衝突として提示される | `packages/core/test/three-way-contract.test.ts`, `packages/web/src/pages/Import.diff.test.tsx` |
| 衝突を無操作で確定しても手当てが消えない | `packages/api/src/import-diff.test.ts` |
| `tx_id` 振り直しでも `stable_key` で追随する | `packages/core/test/fingerprint.test.ts`, `packages/core/test/identity-precedence-contract.test.ts` |
| `stable_key` の正規化が `packages/core/src/fingerprint.ts` と一致し版が判別できる | `packages/core/test/fingerprint.test.ts` |
| 適用の優先順位が edits > rules > vendor_memory > 原本 | `packages/core/test/identity-precedence-contract.test.ts`, `packages/api/src/import-diff.test.ts` |
| 一度直した取引先の再入力が0件になる | `packages/core/test/vendor-memory-contract.test.ts`, `packages/api/src/vendor-memory.test.ts` |
| 閾値未満の決め事は自動適用されず候補提示に留まる | `packages/core/test/vendor-memory-contract.test.ts` |
| 取消後は自動適用されず、過去の適用を再判定で戻せる | `packages/api/src/vendor-memory.test.ts`, `packages/api/src/import-diff.test.ts` (通常再取込も非適用) |
| 自動適用の明細に由来の印が付き決め事へ辿れる | `packages/api/src/import-diff.test.ts` (origin/originKey), `packages/web/src/components/VendorMemory.test.tsx` (値一致推測をしない) |
| previewが読み取り専用で、base書込は確定POSTだけが行う | `packages/api/src/import-diff.test.ts` |
| 5,000行の3点比較と書戻しが 49 D1 queries 以内 | `packages/api/src/import-diff.test.ts`, `packages/api/src/d1-limits.test.ts` |
| 夜間7 jobの同一invocation合計が、batch内statementを含め46 D1 queries以内 | `packages/api/src/scheduled-maintenance-budget.test.ts`（attachment metadata batch失敗、改善要望500件、undo両sweep、audit容量経路を合成） |
| quick class / full editが4属性のbaseを共通経路で保存し、既存baseを上書きしない | `packages/api/src/tx-edit-codec.test.ts`, `packages/api/src/import-diff.test.ts` |
| `owner=null` / `mid=''` の既知baseがbackup・復元・再取込を越える | `packages/core/test/three-way-contract.test.ts`, `packages/api/src/tx-edit-codec.test.ts`, `packages/api/src/import-lifecycle.test.ts` |
| previewがwriter claimを変更せず、現金併存月でpreview→commitする | `packages/api/src/import-diff.test.ts` |
| 低確信候補が今回previewの対象明細だけで値と根拠を持つ | `packages/api/src/import-diff.test.ts`, `packages/web/src/pages/Import.diff.test.tsx` |
| 大量削除で退避行の書込が分割される | `packages/api/src/d1-limits.test.ts` (見積りと実測の突合・上限ちょうども通さない) |
| 他利用者の明細・退避行・監査記録・決め事へ到達できない | `packages/api/src/audit-log.test.ts` (あるかどうかも教えない), `packages/api/src/vendor-memory.test.ts` |
| 削除・上書きが freee・MF 側へ波及しない | 経路が存在しないことの証拠として `packages/api/src/import-lifecycle-pure.test.ts` の route 全列挙 |
| 事業(freee)の取引が複数含まれる削除を退避・取り消しできる | `packages/api/src/deletion-lifecycle.test.ts` 「事業の取引が複数あっても、まとめて消して戻せる」(退避行の `row_id` が明細ごとに異なることまで見る) ✓突然変異 (`readTombstoneRows` の識別子取得を旧実装へ戻すと 500 で赤) |
| 内訳・添付の巻き添え件数が D1 から正しく数えられる (DR-6) | `packages/api/src/deletion-lifecycle.test.ts` 「内訳と添付のある明細は巻き添え件数に出る」 ✓突然変異 (`loadManualRecords` の tx_splits/attachments の読みを潰すと 0 件になって赤) |
| 取り込んだ資産(残高)の行が複数含まれる削除を退避・取り消しできる | `packages/api/src/deletion-lifecycle.test.ts` 「取り込んだ資産の行が複数あっても、まとめて消して戻せる」 ✓突然変異 (同上。freee と同じ急所を残高側から見ているので、片方だけ消しても検知は残る) |
| 3点比較の基準値4つが backup の往復を越える | `packages/api/src/import-lifecycle.test.ts` 「3点比較の基準値のbackup往復」 |
| 第二の引き当て鍵は版が一致するときだけ復元される | `packages/api/src/import-lifecycle.test.ts` 「第二の引き当て鍵のbackup往復」 ✓突然変異 (版判定を外す/常に捨てる の両方向で赤くなることを確認) |

route の全列挙 (`packages/api/src/import-lifecycle-pure.test.ts`) は、新しい書込経路を足したのに
lease の直列化と正本の扱いを決め忘れる、という抜けを型でも実行でもなく**一覧の差**で落とす。
削除・undo・差分・決め事の6経路を canonical 側へ、preflight の2経路を非 canonical 側へ
明示的に置いてあるのはこのためで、どちらにも書かずに増やすとテストが赤くなる。
