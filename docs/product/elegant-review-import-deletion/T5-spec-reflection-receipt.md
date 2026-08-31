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
| 要件正本 | `system-spec/archive/2026-08-31-import-deletion-override-reapply/spec-state.json` + 8章 + `00-requirements-definition.md` + `index.md`(再生成) | 上位概念 U1〜U9、ゴール G1〜G7、目標 O1〜O11、不変条件 I1〜I13、決定 D1〜D3。旧テーマは `system-spec/archive/2026-08-27-d1-schema-recovery/` へ退避(README つき) |
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

## 実装との突合で仕様を訂正した6件

仕様を書いたあと `origin/main` の実装を実測で読み直し、次の6件を訂正した。
**うち2件は、そのままなら実装者を誤らせるものだった。**

| # | 訂正前 | 実測 | 訂正後 |
|---|---|---|---|
| 1 | 「`base_major` / `base_mid` の比較は現状使われていない」 | `core/classify.ts:131-134` が `conflict` を算出し、`routes/classify.ts:233` が集計し、`Classify.tsx:368-370, 661` が「編集済み・取込値が変更」まで表示している | 「科目2属性については**検出・表示まで到達済み**。本件は4属性への拡張と、検出で止まっているものを解決まで運ぶこと」 |
| 2 | 「`base_cls` / `base_owner` を足す」(列追加のみ) | `routes/classify.ts` は**科目編集時にしか base を書かず**、`core/classify.ts:132` の `conflict` は `editedCat` を前提条件にしている | 列追加に加え、**base の書込条件と `conflict` の算出式の両方を作り替える**ことを明記 |
| 3 | 「`balance_entries` / `cash_entries` の `import_id` の持ち方は未決。無ければ migration で追加する」 | `migrations/0026` は意図して `source ('mf'\|'manual')` で区別し「取込は `source='mf'` の行しか消さない。これが無いと、CSVを入れ直すたびに手入力した負債が消える」と明記。`cash_entries`(`0006`/`0007`)も意図して非取込由来 | **「`import_id` を足さない」を不変条件として明記。** 追加していれば手入力した負債が取込のたびに消える欠陥を作っていた |
| 4 | DR-4「該当 target の現行指紋を巻き戻す」 | `import_active_targets` は PK `(user_id, target_key)` の現行値のみで履歴を持たず、JSON 復元時は `DELETE ... WHERE user_id=?` で全消し。**巻き戻し先が存在しない** | 「退避行に削除前の `content_hash` / `import_id` / `updated_at` を含める」を明記。`imports.content_hash` からの再構成は、同じ target を複数の取込が上書きした場合に直前を一意に決められないため採らない |
| 5 | 「上書きの判断が実装に固定されている」 | `keepOnShrink`(`routes/imports.ts:984, 1093-1105` / `Import.tsx:382`)で利用者が選べる経路が既にある | 「選択肢が**月単位までしか無い**」へ。画面も既存 `keepOnShrink` の拡張として置き、別設定として並べない |
| 6 | (記載なし) | `import-active.ts` の `JSON_SNAPSHOT_MUTATION_CONSUMERS` が型で列挙外の mutation を接続不能にしている。migration の次番号は `0029`(`0016`/`0017` は欠番) | 新設テーブルの同配列への登録必須と、次番号を明記 |

3と4は**そのまま実装すると既存の保護を壊すか、実装不能になる**ものだった。
仕様を書いた時点で `system-spec/` の qa-002 は `import_writer_claims` /
`planMultipartImportQueries` を正しく名指ししており、上位層は main を読んで書かれていた。
破れたのは**その下の、テーブル1枚ごとの意図**である。
migration のコメントに残された「なぜこの列なのか」を読まずに、列名だけで判断していた。

## 残課題

- **仕様の「未決事項」4件が未決**。`vendor_memory` の confidence 算出式と初期閾値、
  `core/classify.ts` の `conflict` を属性単位へ作り替える範囲の見積り、既存明細への base 埋め移行の
  経路と検証、undo 退避行の保持期間。タスク側では Slice -1(D01〜D04)として先頭に置いた。
  とくに confidence が数値化されるまで、上位目標 O10「利用者へ問う件数を逓減させる」は
  **達成を判定できない**。
- **`origin/feat/import-lifecycle-and-classification` は懸念ではなかった**(調査で解消)。
  `0aefe44 feat: 取込・名義・仕分けを安全に運用できるようにする (#11)` として squash-merge 済みで、
  main はその上をさらに進んでいる(`FINGERPRINT_VERSION` は main `4` / ブランチ `2`、
  migrations は main `0000`〜`0028` / ブランチ `0009` まで、`0008_import_lifecycle.sql` は差分ゼロ)。
  「70ファイル・8,831行」は merge-base が squash 前の `b1856a1` であることによる
  three-dot diff の見かけの数字だった。ブランチ側にしか無い61行はすべて main で置き換わった旧版で、
  失われた作業は無い。
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

## `system-spec/` の衝突と、本テーマの退避 (2026-08-31 追記)

本ブランチの作業中に `#28`(数字の図を、読めて検算できる形にそろえる)が main へ入り、
`system-spec/` の11ファイルが衝突した。原因は個別の編集競合ではなく**構造**にある。
`system-spec/` は一度に1テーマしか持てない置き場であり、`#28` と本件の双方が
「テーマを作り直す」という同じ手順を踏んだため、同じ場所を奪い合った。

**解決: main を正本とし、後発の本テーマが道を譲る。**
`system-spec/` 直下は `origin/main`(`#28` のモバイル可視化テーマ)の内容へ戻し、
本テーマの14ファイルは `system-spec/archive/2026-08-31-import-deletion-override-reapply/`
へ退避した。**1行も失っていない。** 本テーマの成果物
(`specs/` / `architecture/` / `features/` / `tasks/`)が指す正本パスは退避先へ張り替えた。

### この衝突で見つかった、より重い問題

`#28` は `architecture/*.md` を2件追加したが `architecture/graph.json` を更新していない。
**`#26` で起きた登録漏れが、`#28` でも同じ形で再発していた。**
本 PR で追加した `scripts/check-graph-lineage.mjs` がこれを検出し、
frontmatter から2ノードを復元して登録した(graph 9 → 11ノード)。
ゲートを CI に入れた回の、その同じマージでゲートが仕事をしたことになる。

あわせて、`#28` の frontmatter が持つ `source_digest` は
リポジトリに残るどの commit 版とも一致しなかった(`#28` 直前・直後の双方と不一致を確認)。
章を取り込んで node を作ったあとに章がさらに更新され、node が追随しなかった中間状態を指している。
旧テーマの件は「記録 digest が archive 側と完全一致していた」= 記録が正しくパスが誤っていたが、
今回は逆で**現物が正本**であるため、現物から打ち直した。
MISMATCH に対する処置は毎回同じではなく、記録がどこかの現物と一致するかで分岐する。

### 残る構造的な問題

`system-spec/` がテーマごとに上書きされる限り、次のテーマでも同じ衝突が起きる。
テーマ単位のディレクトリを最初から切る(`system-spec/<theme>/`)か、
`archive/` への退避を `/dev-graph spec` の手順へ組み込むかの、どちらかが要る。
本 PR の範囲外だが、3回連続で同じ事象が起きている以上、次に着手する価値がある。
