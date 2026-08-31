# T5. 仕様反映の受領書 — 取込データの削除・上書きと手当ての継続再適用

**記録日**: 2026-08-31 / **対象ブランチ**: `daishiman/取り込み削除` / **base**: `main`

**Beads**: `kanjo-m2m`(本作業で新規作成、`external_ref: dev-graph:feat-import-deletion-override-reapply`) / **dev-graph node**: `feat-import-deletion-override-reapply`

本作業に**コード変更は無い**。要件のヒアリング確定と、それを仕様・設計・タスクへ落とす文書層の
変更、および仕様と設計の整合を機械で守る CI ゲート1本の追加である。
判定単位は「その層が所有する契約が変わったか」であり、コードが触れたかではない。

## 何が変わったか(判定の入力)

1. **新機能の要件が確定した**。freee / マネーフォワードから取り込んだ会計データの
   削除・上書き・再取込と、利用者が一度直した科目・公私区分を継続的に再適用する仕組み。
   `system-spec/` の正規フロー(elicit → compile)で `spec-state.json` に G1〜G7 / O1〜O11 /
   I1〜I13 / D1〜D3 として確定し、8章 + 要件定義書 + index を再生成した。
2. **`system-spec/` の旧テーマを退避した**。既存の `system-spec/` は
   「本番D1スキーマの乖離解消」(2026-08-27)の正本だった。同じ場所に新テーマを重ねると
   どちらの正本か判らなくなるため、旧8章 + 判定 JSON を
   `system-spec/archive/2026-08-27-d1-schema-recovery/` へ README つきで退避し、
   新テーマで作り直した。**旧テーマの内容は1行も消していない。**
3. **`architecture/graph.json` の lineage が2世代破れていた**。
   旧テーマの3ノードは `source_path` が `system-spec/<章>.md` を指したまま archive へ退避され、
   同じパスに新テーマの章が置かれたため digest が不一致になっていた。
   記録 digest は archive 側の章と**完全一致**していたので、断絶ではなくパスの衝突である。
   パスを archive へ張り替えて復元した(digest は不変)。
   加えて #26 で `architecture/*.md` が2件追加されながら graph.json が更新されていない
   登録漏れを見つけ、frontmatter から復元して登録した。
4. **照合が一度も走っていなかった**。`source_digest` フィールドが**存在すること**が
   **照合されること**の代理指標になっていた。照合は5行で書けるのに2世代実行されておらず、
   上の3のような破れを誰も検出できていなかった。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| 要件正本 | `system-spec/spec-state.json` + 8章 + `00-requirements-definition.md` + `index.md`(再生成) | 上位概念 U1〜U9、ゴール G1〜G7、目標 O1〜O11、不変条件 I1〜I13、決定 D1〜D3。旧テーマは `system-spec/archive/2026-08-27-d1-schema-recovery/` へ退避(README つき) |
| 詳細仕様 | `specs/import-deletion-and-override-reapply.md`(新規) | 文書所有権、目的、非目標、到達状態、不変条件 DR-1〜DR-16、削除の4粒度、undo と監査、3点比較と `vendor_memory`、既存資産との接続点、D1 Free 制約、画面、API 10本、受入27件、未決事項4件 |
| 設計判断 | `architecture/arch-import-deletion-undo-boundary.md`(新規) | 削除範囲のサーバ側再解釈、退避先の選定(D1 退避テーブル vs Time Travel)、writer claim の共用、指紋巻き戻しの対性、派生状態の再計算、監査の非複製 |
| 設計判断 | `architecture/arch-override-reapply-three-way-merge.md`(新規) | git merge と同型の3点比較を選んだ理由、4属性への base 拡張、同一性キーの二段構え、適用の優先順位、`vendor_memory` の確信度、D1 クエリ本数への収め方 |
| 設計グラフ | `architecture/graph.json` | 旧テーマ3件の `source_path` を archive へ張り替え、manual 2件へ digest を打刻、孤児 md 2件を登録、新規2件を登録。5ノード → 9ノード |
| CI ゲート | `scripts/check-graph-lineage.mjs`(新規) + `package.json` | 全ノードの `source_lineage.source_path` の現物 sha256 と `source_digest` の突合、および `architecture/*.md` とノード id の双方向の孤児検出。`pnpm lint` へ連結したため `.github/workflows/ci.yml` の変更は不要 |
| 機能ノード | `features/feat-import-deletion-override-reapply.md` + `.context.json`(新規) | purpose / goal / scope_in 9件 / scope_out 6件 / acceptance 14件 / architecture_refs / `implementation_readiness: blocked` と欠落4件 |
| タスク正本 | `tasks/import-deletion-override-reapply-tasks.md`(新規) | Slice -1(未決事項 D01〜D04)〜 Slice 3、T01〜T16 |
| 製品正本 | `docs/spec-v1.1.md` | FR-01 末尾に、削除・undo・監査・継続再適用の所有者が新詳細仕様であること、および月単位の洗い替えは取込の副作用であって利用者が選ぶ削除ではないことを1行で明示 |
| データ契約 | `docs/data-schema.md` | MF側で `ID` が振り直された場合の第二の引き当てキー(`stable_key`)と `base_*` 4属性の3点比較契約の所有者、および「明細を消すときは `import_active_targets` の現行指紋の巻き戻しと必ず対で行う」不変条件への導線 |
| 製品backlog | `docs/product/backlog.md` | 既存の「取込履歴の監査情報」行に、削除・上書きの監査は新詳細仕様が包含するため本行はそれ以外を指す旨を追記 |

## 反映不要と判断した層

| 層 | 判断 | 理由 |
|---|---|---|
| `packages/` 一式 | **変更なし** | 本作業は要件確定と文書化に閉じており、実装へ着手していない。仕様の「未決事項」4件が閉じるまで実装は仮定の上に載る |
| `migrations/` | **変更なし** | 同上。スキーマ追加は T05 で `0029_*` 以降に append-only で足す。`EXPECTED_D1_MIGRATION` は不変 |
| `docs/metrics.md` | 反映不要 | 削除・再適用の測定指標は `vendor_memory` の confidence が数値化されて初めて書ける(D01)。数値の無いまま指標を置くと、達成を判定できない指標が既成事実になる |
| `docs/ui-decisions.md` | 反映不要 | 画面の追加はすべて既存の取込画面(P8)の内部であり、UI の決定そのものを変えていない。実装時に確認画面の意匠が決まった段階で追記する |
| `docs/ui-navigation-guidelines.md` | 反映不要 | route も画面数もタブ構成も変えていない。新しい最上位画面を作らない方針を仕様側に明記済み |
| `docs/ci-cd-operations.md` | 反映不要 | 追加した `check-graph-lineage.mjs` は既存の `pnpm lint` へ連結しただけで、CI の段構成もワークフローも変えていない |
| `docs/requirements.md` | 反映不要 | 要件の正本は `system-spec/` 側にあり、本ファイルは初期の与件を残す文書である。二重の正本を作らない |
| `docs/runbooks/prod-d1-schema-recovery.md` | 反映不要 | 旧テーマの運用手順であり、archive への退避で無効化されるものではない。手順そのものは今も有効 |
| `docs/cloudflare-credentials-setup.md` | 反映不要 | 認証情報の扱いに変更なし。仕様側で「パスワード・認証トークンを保存しない」既存方針を踏襲した |

## 品質ゲートの再実行結果

| ゲート | 結果 |
|---|---|
| `pnpm lint`(Biome 273ファイル) | PASS |
| `scripts/sync-project-skills.mjs --check` | PASS |
| `scripts/check-glossary.mjs` | PASS(59語) |
| `scripts/check-report-css.mjs` | PASS |
| `scripts/check-graph-lineage.mjs`(新規) | PASS(9ノード / 孤児0) |

`pnpm typecheck` と単体テストは、`packages/` と `migrations/` に変更が無いため再実行していない。

新規ゲートは**負のテストで赤も確認した**。(1) `architecture/` に未登録の md を一時的に置く →
「登録漏れ」で赤、(2) `specs/transaction-splits.md` に改行を1つ足す → digest 不一致で赤。
いずれも復元済み。実際に、`arch-import-deletion-undo-boundary.md` を作って graph.json へ
登録する前の瞬間にこのゲートが赤くなり、**#26 で起きた登録漏れと同じ事象を機械が捕えた**。

## 残課題

- **仕様の「未決事項」4件が未決**。`vendor_memory` の confidence 算出式と初期閾値、
  `balance_entries` / `cash_entries` の由来 `import_id` の持ち方、既存明細への base 埋め移行の
  経路と検証、undo 退避行の保持期間。タスク側では Slice -1(D01〜D04)として先頭に置いた。
  とくに confidence が数値化されるまで、上位目標 O10「利用者へ問う件数を逓減させる」は
  **達成を判定できない**。
- **`origin/feat/import-lifecycle-and-classification` が未マージのまま 70ファイル・8,831行を抱えている**。
  うち `packages/api/src/routes/imports.ts`(+1,145) と `packages/api/src/store.ts`(+802) は
  本仕様の Slice 1 が触る場所と正面から重なる。実装着手の前にこのブランチの去就
  (マージするか破棄するか)を決めないと、同じ場所を二重に書くことになる。
- **`system-spec/` の各章の `#### 本章での適用` が `unrecorded` のまま**。
  compile 0.2.0 は `qa_log[].design_applications` から設計原則の採否根拠を書き出すが、
  本件の `spec-state.json` は `schema_version: 1.0` でこのフィールドを持たない。
  補完する writer op (`set-qa-design-applications`) は `legacy_exempt=true` を持つ旧 qa しか
  受け付けず、その `legacy_exempt` を立てる op が 0.2.0 writer に存在しない。
  **この repo からは開けられない門**であり、ハーネス側に移行経路が要る。
- **`compile-spec-doc.py` が同一マシンに2世代ある**。marketplace 側が `0.1.0`(780行)、
  cache 側が `0.2.0`(164行 + `lib/`)で、plugin manifest の version と script の version が
  独立に付番されて逆転している。本作業は 0.2.0 で再生成したが、
  **以後 `/dev-graph spec` を再実行すると 0.1.0 の compile が走り、章の意味層が消えるおそれがある**。
- **deep knowledge card の逐語重複が3種残る**(Clean Architecture / Domain-Driven Design /
  Secure by Design がそれぞれ2章に全文で入る)。カードの逐語と描画は
  ハーネス側の `resource-map.yaml` と `_render_markdown_card()` が持つため、
  この repo から1行も減らせない。
- **0.2.0 の foundation provenance 要求は未対応**。MVP 段階のため 0.1.0 のゲートで完了とした。
