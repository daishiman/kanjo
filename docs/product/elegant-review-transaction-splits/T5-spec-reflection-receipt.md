# T5. 仕様反映の受領書 — 明細の分割記帳と科目の可読性

**記録日**: 2026-08-30 / **対象ブランチ**: `daishiman/公私仕分けの分離` / **base**: `main`

**Beads**: `kanjo-17k`(本作業で新規作成、`external_ref: dev-graph:feat-transaction-split-readability`) / **dev-graph node**: `feat-transaction-split-readability`

コード変更が仕様・設計文書へ与える影響を層ごとに判定し、反映したものと、反映不要と判断した
理由を残す。判定単位は「その層が所有する契約が変わったか」であり、コードが触れたかではない。

## 何が変わったか(判定の入力)

1. **分割エディタの科目パネルが読めなかった**。`CategoryPicker` の `.cat-panel` は
   `position: absolute` で浮くが、浮いた要素は最も近いスクロール祖先で切られる。
   分割の表は `.scroll-x`(内側)と `.card.scroll-x.classify-table-card`(外側)に
   二重で囲われており、460px のパネルが2〜3行ぶんの小窓になっていた。
   → 分割エディタ内だけ `position: static` にし、内側の `.scroll-x` を `.split-lines` へ置換。
   科目列を480pxで先に確保(開いた瞬間に隣の金額欄が動かないため)。
2. **分割結果が他ページへ届いているかの再確認**。実装(`projectAccountingDataset`)は届けていたが、
   それを固定する検査が無かった。家計の科目別・名義別・事業立替・合計不一致時の4件を追加。
3. **実描画の不変条件9を追加**。分割エディタを開いた状態でパネルが内部の `overflow` で
   切られていないことを headless Chrome で測る。外側の明細一覧は意図したスクロール領域なので除外。
4. **CI の `wrangler types` を typecheck へ内包**。生成物 `worker-configuration.d.ts` は
   gitignore のままで、手元でも CI と同じ1コマンドで通るようにした。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| 製品正本 | `docs/spec-v1.1.md` | **FR-12 明細の分割記帳(P5)** を新設。金額/割合の2入力・保存は金額のみ・合計一致・内訳ごとの公私と科目・投影による集計反映・fail-closed・証憑は親に1件・`identity_stable=0` は不可。規範詳細は `specs/transaction-splits.md` を正とする旨のポインタ。あわせて品質ゲート行を「typecheck(wrangler types を内包)」へ更新 |
| データ契約 | `docs/data-schema.md` | 「明細の分割記帳(tx_splits)の投影先」を新設。列・一意索引 `(user_id, tx_id, seq)` / `(user_id, line_id)`、合計一致をDB制約ではなくアプリで検証する理由、`line_id` が `seq` から独立である理由、`parent_amount` がスナップショットである理由、合流先4経路(集計/証憑棚卸し/申告書=合流しない/取込計画=合流しない)と fail-closed 条件 |
| 詳細仕様 | `specs/transaction-splits.md`(新規) | 不変条件 TS-1〜TS-12、集計への波及表、UI表示契約 TS-U1〜TS-U5、受入 A1〜A9、対象外3件 |
| 設計判断 | `architecture/arch-transaction-split-projection.md`(新規) + `architecture/graph.json` | 決定 D1(投影で解く)/D2(既存の手動編集の枠へ入れる)/D3(fail-closed)/D4(証憑は親に1件)/D5(freee科目別へ合流させない)/D6(分割エディタでは浮かせない)。各決定に却下案を併記。graph.json へ `origin_kind: "manual"` で登録 |
| UI判断 | `docs/ui-decisions.md` | 「決定の更新(2026-08-30 / feat-transaction-split-readability)」を追記。3件の更新表、浮かせるのをやめた代償(下の行が下がる)、不変条件9で古びさせない方法。**過去の行は消していない** |
| 機能ノード | `features/feat-transaction-split-readability.md` + `.context.json`(新規) | purpose/goal/scope_in/scope_out/acceptance 10件/architecture_refs |
| タスク正本 | `tasks/transaction-split-readability-tasks.md`(新規) | T01〜T12、受入証拠台帳、残課題 |
| 運用 | `docs/ci-cd-operations.md` | CI 行を「依存導入、lint、Env型生成を内包した型検査、テスト、依存監査」へ |

## 反映不要と判断した層

| 層 | 判断 | 理由 |
|---|---|---|
| `system-spec/` | **反映不要** | この仕様書群は上位概念 U1「本番D1スキーマの乖離を解消し、取込エラーに遭遇しない状態を保つ」に閉じた正本で、ゴールは G1〜G4(スキーマ復旧・fail-closed 検査・検知・データ無損失)である。今回の変更は既存 migration 0025 の上での投影とUIであり、**スキーマ版数もデプロイ経路も変えていない**(`EXPECTED_D1_MIGRATION` 不変、migration 追加なし)。加えて `system-spec/` は `origin_kind: "system-spec-harness"` の生成物で、elicit→compile→completeness evaluator の正規フローを通さない直接編集は lineage を壊す。よって手を入れない |
| `system-spec/database.md` | **反映不要** | 同上。`tx_splits` は本ブランチ以前に導入済みで、本変更で列も索引も変えていない |
| `docs/ui-navigation-guidelines.md` | **反映不要** | route も画面数もタブ構成も変えていない。分割エディタは P5 の内部表示であってナビゲーション契約に触れない |

## 品質ゲートの再実行結果

| ゲート | 結果 |
|---|---|
| `pnpm lint`(Biome) | PASS |
| `pnpm typecheck`(core/api/web) | PASS |
| `@kanjo/core` 単体 | 454 passed / 6 skipped |
| `@kanjo/web` 単体(実描画回帰を含む) | 296 passed |
| `@kanjo/api` 単体 | exit 0 |

## 残課題

- seed データは360行すべて `identity_stable = 1` のため、「ID なし・添付不可」の状態を
  手元で再現できない。TS-9 の `identity_unstable` 経路は単体検査だけで担保している。
- 分割エディタでパネルを開くと下の行が下がる。分割の文脈では「読めない」ほうが致命的と判断して
  受け入れた副作用であり、解消したわけではない。
- 意匠の妥当性の人手レビューと Chrome 以外のブラウザでの確認は未実施。計測ではカバーできない。
