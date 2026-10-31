# データ取込画面 受入の証跡

feature `feat-import-screen`(Beads epic `kanjo-y7q`)の検査記録。受入の分け方は [`design-decisions.md`](design-decisions.md) §1、規則と実装・テストの対応は [`rules.md`](rules.md)。

## 0. 判定の対象

- 対象: HEAD `f0e5a3b` の上に、この feature の未コミットの変更を載せた作業ツリー(commit 前)。
- 判定に使うのは下の §1 の E1〜E4(E1b・E1c を含む)だけ。E1 の前に一度 verify:full を始めたが、§3 の監査で見つけた漏れを直すために途中で止めた。その実行と、それより前の実行は、修正前の結果なので使わない(S6-c と同じ考え方)。
- 時刻は UTC。

## 1. 実行の記録

| # | 実行 | 開始 → 終了 | 結果 |
|---|---|---|---|
| E1 | `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4185 pnpm verify:full`(test → typecheck → lint → build → check:thead → check:mobile-layout → check:financial-figure → check:financial-routes → check:ai-screen → check:analysis-hub → preview:smoke) | 2026-09-22T05:36:02Z → 05:49:56Z | **EXIT 1**。core 60 files / 1037 passed・6 skipped。api 64 files / 871 passed だが、空の `src/debug-tmp.test.ts`(下の補足)が「テストが無い」として 1 file failed になり、web の途中で打ち切られた |
| E1b | E1 の test 段より後ろを同じ順で実行(typecheck → lint → build → check:thead → check:mobile-layout → check:financial-figure → check:financial-routes → check:ai-screen → check:analysis-hub → preview:smoke) | 2026-09-22T05:50:28Z → 05:54:13Z | EXIT 0。lint: graph-lineage 142 ノード一致・色の直書き 0 件(204 ファイル)・公開文書の実データ参照 OK。初期 JS 103.95KiB / 110KiB。画面検査 6 本すべて合格。preview smoke 合格 |
| E1c | `pnpm --filter @kanjo/web test`(E1 で打ち切られた web のテスト) | 2026-09-22T05:54:48Z → 05:57:47Z | EXIT 1。84 files / 894 passed・1 failed。落ちたのは家計収支画面の実描画検査 1 件(900px の先頭行の下罫線が 1px)。取込の変更は CSS に触れていない(差分 0 件)。同じファイルを単独で 2 回流すと 2 回とも合格し、同じ検査スクリプトは E1b の check:financial-routes でも合格した(E5 も参照) |
| E5 | 利用者が `debug-tmp.test.ts` を削除したあと、`KANJO_VISUAL_BASE_URL=http://127.0.0.1:4185 pnpm verify:full` | 2026-09-22T06:45:57Z → 07:01:47Z | **EXIT 1**。core 1037 passed、api 64 files / 871 passed(debug-tmp 起因の失敗は消えた)。web 894 passed・1 failed で、E1c と同じ家計収支の実描画検査が今度は 1024px の中間行で落ちた(罫線 上 3px・下 1px)。落ちる幅と行が毎回変わり、取込の変更は CSS・家計画面に触れていない。直後の load average は 26.7(10 コア)で、他のセッションの負荷が高かった |
| **E6** | E5 と同じ作業ツリー・同じコマンドで、もう一度 `pnpm verify:full` | 2026-09-22T07:03:22Z → 07:36:09Z | **EXIT 0(1 回で通った)**。core 60 files / 1037 passed・6 skipped、api 64 files / 871 passed、web 84 files / 895 passed。lint: graph-lineage 142 ノード一致・色の直書き 0 件(204 ファイル)。初期 JS 103.95KiB / 110KiB。画面検査 6 本すべて合格。preview smoke 合格。開始時の load average は 42.9 |
| E2 | `pnpm --filter @kanjo/api exec vitest run --exclude src/debug-tmp.test.ts`(api の全体テスト。E1 の中の api テストとは別に、docs を足したあとに単独で完走させた) | 2026-09-22T05:18Z → 05:30Z | EXIT 0。64 files / 871 passed(741s) |
| E3 | P08 重複の監査(`rg` で core の判定関数の利用箇所と、結果・状態の文字列を直接比べる箇所を web と api の取込経路から洗い出す) | 2026-09-22T05:3x(E1 の直前) | 下の §3。漏れ 1 件を見つけて直した |
| E4 | E3 の修正のテストを、修正前の実装(`importItemStatus` が `uploadError` を core に渡さない)に一時的に戻して実行 | 2026-09-22T05:3x(E1 の直前) | 修正前の実装では DOM テスト「送信が通信で落ちた行は…」が落ち、戻したあとは 21 passed。core の追加ケースは、旧 core では上限違反の組が `blocked` を返すので落ちる |

補足:

- `packages/api/src/debug-tmp.test.ts` は、この作業のデバッグで作った一時ファイル(0 行・未追跡)。E2 は `--exclude` で外していたので表に出なかった。利用者が削除した。
- P06 の「verify:full が緑」は **E6** で満たした。E1・E1c・E5 の失敗は、debug-tmp の空ファイルと、家計収支の実描画検査の揺らぎ(3 回の通しで 2 回、毎回違う幅と行)だけで、取込の変更による失敗は 0 件。家計収支の検査の揺らぎは範囲外なので直していない。高負荷時に再発しうるので、CI で落ちたら同じ commit で再実行して見分ける。

- E1 の web の実描画検査は、この作業ツリーの vite を 4185 番、wrangler を 8790 番で起動して行った。8787〜8789 番と 4175 番は別の worktree が使っていたので触っていない。
- ローカルの画面確認用に、`node scripts/seed-admin.mjs` で管理者を作り、`KANJO_BASE_URL=http://localhost:8790 node scripts/seed-local.mjs` で架空の明細 4 ファイル・仕分けルール 5 件・口座 3 件・予算 4 科目を入れた。seed が書き換える `samples/*.csv` は `git checkout` で戻した。

## 2. 受入ごとの判定

| 受入 | 判定 | 証跡 |
|---|---|---|
| S1-a 問いの見出し・期間カード・ステッパー 3 段・1〜5 の節・詳細ペイン・選択件数バー | PASS | E1c の web テスト(DOM「問い・期間カード・段 1〜5 の見出し・手順 3 段を持ち…」「選ぶと 2 段目と選択件数バー…」「?run=<id> で開くと詳細ペインを復元し…」) |
| S1-b 一覧 9 列・要約 6 項目・履歴 7 列と一括削除の選択列 | PASS | E1c の web テスト(DOM「一覧は 9 列、要約は 6 項目、履歴は 7 列…」) |
| S1-c 色の直書き 0 件・共通 `Button`・期間は `usePeriod` | PASS | E1b の lint(`check-design-tokens`: 直書き 0 件、design-system 検査) |
| S1-d 読込・空・失敗の状態 | PASS | E1c の web テスト(DOM「履歴は読込中を示し、失敗すると理由と再読込を出し…」「送信が通信で落ちた行は、理由つきの失敗になり…」) |
| S2-a 検査は明細・残高・有効取込の表を 1 行も書かない | PASS | E1・E2 の統合テスト「明細の表を 1 行も書かず…」 |
| S2-b 確定は検査 ID だけで行い、同じファイルを 2 回送らない | PASS | E1・E2 の統合テスト「本人の検査 ID だけで…」「確定応答を受け取れなくても…」。要求本文は `{inspectionId, fileIds, keepPrevious, force}` だけで、同一選択の再送は receipt から同じ結果を返す |
| S2-c 期限切れの検査と 24 時間を過ぎた仮置きが夜間保守の後に残らない | PASS | E1・E2 の統合テスト「夜間保守の片づけ」、`scheduled-maintenance-budget.test.ts` |
| S3-a 状態・取込可否・要約・結果・上限の判定は `packages/core/src/import-screen.ts` だけ | PASS | E1 の core テスト。E3(§3)で見つけた送信失敗の分岐は core へ移した |
| S3-b web と api の取込経路に上限の数値リテラルが 0 件 | PASS | E1・E2 の `import-limits-literal.test.ts` |
| S4-a オンで同じファイルを 2 回確定しても明細は増えない | PASS | E1・E2 の統合テスト「オンで同じファイルを確定し直しても…」 |
| S4-b オフは従来の月単位の入れ替えと同じ | PASS | E1・E2 の統合テスト「オフは月単位の入れ替えで…」 |
| S5-a 履歴の 1 行が取込 1 回に対応し、影響の数値が確定時と一致する | PASS | E1・E2 の統合テスト「取込 1 回を 1 行で返し…」 |
| S5-b 一括削除の前後で明細数が変わらない | PASS | E1・E2 の統合テスト「失敗した履歴 100 件は 1 回で非表示にでき…」 |
| S5-c 既存の取り消し・破棄・置換・削除と 30 日の期限 | PASS | E1・E2 の統合テスト「取り消しは確認した指紋で…」「置換は保存した原本で…」、既存の `Import.*.test.tsx`、`import-reimport.dom.test.tsx` |
| S6-a 新旧の取込経路の上限・Origin・レート制限の拒否 | PASS | E1・E2 の統合テスト「413」「403」「429」、共通境界表(core・web・api が同じ表を読む)、互換 `POST /imports` の 5 回許可・6 回目 429 |
| S6-b 取込経路から外部ホストへの送信が 0 件 | PASS | E1・E2 の統合テスト「検査から確定・履歴まで、localhost 以外への要求は 0 件」 |
| S6-c migration は追加だけで、既存の取込履歴が読める | PASS | E1・E2 の `import-migration-0053.test.ts` |

## 3. P08 重複の監査(E3)

- core の判定関数(`importFileState` / `importFileActions` / `importFileSelectable` / `importRunResult` / `importHistoryActions` / `importHistoryHideable` / `importLimitViolation` / `importInspectionSummary` / `importStep` / `importWithinUndoWindow`)を呼んでいるのは、api の `routes/imports.ts` と、web の `pages/import/` の 7 ファイル(と `api.ts` の型 1 か所)。
- 見つけた漏れ 1 件: `pages/import/view-model.ts` の `importItemStatus` が、送信の失敗(`uploadError`)のときだけ core を呼ぶ前に `failed` を返していた。core の `importFileState` に入力 `uploadError` を足し、優先順を「確定の結果 → 送信の失敗 → 上限違反・検査結果 → …」として core に移した(rules R9)。web に残るのは、core が理由を持たない確定の失敗に、確定の応答で受け取った理由を添えることだけ。
- 結果・状態の文字列を直接比べている残りの箇所は、次の 3 つに分かれる。判定を作り直している箇所は無い。
  - core が導いた状態を数える・出し分けるもの(`view-model.ts` の検査中の判定と選択バーの errors、`ImportFileTable.tsx` の進捗表示、`use-import-files.ts` の再送対象)。
  - 応答の値を型で確かめるもの(`routes/imports.ts` の `isRunResult`)。
  - 確定の応答のファイル状態を数えるもの(`ImportHistory.tsx` の置換の結果、`use-import-files.ts` の失敗の拾い出し)。
- 旧 `pages/Import.tsx` は新しい画面を再 export するだけ。

## 4. P09 xlsx のメモリ(OI-03)

実測は design-decisions §8。展開後 15MB〜60MB の xlsx は当初の上限 60MB の内側でも Workers のメモリ 128MB を超えうる。後退策(xlsx だけ展開後の上限を下げる / xlsx は 1 要求 1 ファイルに限る)を上限値を決めた利用者の判断に回し、**A案(展開後の上限を 15MB に下げる)で決着した**(2026-09-23)。`IMPORT_LIMITS.maxExpandedBytes` を 15,728,640 へ変更し、core と api の境界テストの期待値、`specs/spec-import-screen.md` の上限表を同時に更新した。判断の理由は design-decisions §8「結論」。

## 5. P10 配信してよいかの判断

- P10 時点の独立レビューは「条件付きで配信可」。画面と確定経路の改善後の最終判定は §10 を正とする。互換 `POST /imports` にも新経路と同じ確定 5 回/分制限を適用した。
- 低の指摘 6 件は記録だけ。そのうち `debug-tmp.test.ts`(0 行)は、この作業のデバッグで作った一時ファイルで、削除は利用者の操作に回した。
- 利用者の削除のあと、E6 で verify:full が 1 回の実行で通ったので、条件は満たした。

## 6. P13 配信

**未実施(保留)**。commit・push・PR の作成・merge と、本番の Migrate / Deploy は、この作業では行っていない。`migrations/0053_import_inspections.sql` も本番には適用していない。配信は Migrate → Deploy の順(rules R30)。

## 7. 範囲外で見つけたこと

- `packages/api/src/users.ts` の `DUMMY_HASH_PROMISE` がモジュールの最上位で `crypto.getRandomValues` を呼ぶ。`wrangler dev` では、グローバルスコープでの乱数生成が拒否され、この Promise が reject する。管理者がまだいないローカル D1 で存在しないアカウントにログインすると、401 ではなく 500 になる。seed-admin で管理者を作ったあとは再現しない。取込画面の範囲外なので直していない。

## 8. 思考リセット後の30思考法レビュー

2026-09-22 に、既存の対策を正しい前提とせず、まず作業ツリーと参照画像の事実だけを再取得した。その後、論理・構造、メタ・発想、システム・戦略・問題解決の3系統を並列で分析した。

| # | 思考法 | 要点と反映 |
|---:|---|---|
| 1 | 批判的思考 | 「検査 ID だけで確定」と MF だけ再送する実装の矛盾を検出し、新画面を `/imports/runs` に一本化した。 |
| 2 | 演繹思考 | 「確定で再送しない」から、ファイル種別による例外経路は成立しないと判定した。 |
| 3 | 帰納的思考 | 画面・DOMテスト・仕様の個別差分から、読み順と確定経路の2点が主要なずれとまとめた。 |
| 4 | アブダクション | 選択解除後もバーが消えない最良説明を「選択数が checked でなく pending を数えている」と特定した。 |
| 5 | 垂直思考 | サマリーが確定後に消える原因を `inspectionId=null` まで追い、確定時スナップショットで解決した。 |
| 6 | 要素分解 | 取込を選択・検査・要約・確定・結果・履歴・メンテナンスに分け、責務を再確認した。 |
| 7 | MECE | 画面の1〜5、下部バー、履歴詳細、確認ダイアログを重複なく点検した。 |
| 8 | 2軸思考 | 「頻度×失敗コスト」で主フローとメンテナンスを分け、後者は折りたたみのままにした。 |
| 9 | プロセス思考 | 選ぶ→検査→確認→確定→結果→履歴の状態遷移と戻り道をテストに固定した。 |
| 10 | メタ思考 | 画像の全要素の複製ではなく、利用者の意思決定を保つ構造一致を検証対象にした。 |
| 11 | 抽象化思考 | 画面上の差を「入力」「判断」「結果」「監査」の4層にまとめた。 |
| 12 | ダブル・ループ思考 | 「差分プレビューを新画面に移す」自体を見直し、検査要約で代替して旧 UI を削除した。 |
| 13 | ブレインストーミング | 差分UI統合・別画面化・サマリー強化・現状維持を出し、最小変更のサマリー強化を採用した。 |
| 14 | 水平思考 | 機能追加ではなく、参照画像と同じ読み順へDOM構造を並べ替えて複雑性を減らした。 |
| 15 | 逆説思考 | 「全ての情報を常時出す」と想定し、別目的の削除操作は折りたたみが妥当と確認した。 |
| 16 | 類推思考 | 検査→確定は一般的なステージング取込と同じと捉え、確定はID参照に一本化した。 |
| 17 | if思考 | 「MFだけ」「エラー行あり」「全選択解除」「確定後」「履歴詳細あり」をテストした。 |
| 18 | 素人思考 | 「前回データを残す」の意味が文面だけで分かるよう、追加と月次置換の文言を分けた。 |
| 19 | システム思考 | UI・view-model・フック・API・core・仕様・証跡のつながりを追い、同時に更新した。 |
| 20 | 因果関係分析 | 旧差分UI→旧POST→ファイル再送→検査契約違反、という連鎖を切った。 |
| 21 | 因果ループ | 取込失敗→再試行→新検査→確定の回復ループに、自動除外されたエラー行も接続した。 |
| 22 | トレードオン思考 | 再送の信頼性と保持量を両立させ、原本は確定時に消し、有効期限付きの最小 receipt だけを残した。 |
| 23 | プラスサム思考 | 再送を0にして通信・保守コストを下げつつ、確定後の判断根拠を残した。 |
| 24 | 価値提案思考 | 中心価値を「取り込んだ後に、何が反映され何を直すか分かる」と再確認した。 |
| 25 | 戦略的思考 | 高リスクなAPI分割は同時に行わず、次の独立スライスとしてバックログに切り分けた。 |
| 26 | why思考 | 五回の「なぜ」で、視覚差の根本を「参照画像とDOMの節の所属が違う」まで深掘りした。 |
| 27 | 改善思考 | 欠陥を「契約違反」「状態数え違い」「文言」「読み順」に分け、テストから直した。 |
| 28 | 仮説思考 | 「旧差分経路を外せば再送0になる」等を、失敗する契約テストで先に確かめた。 |
| 29 | 論点思考 | 本質的な論点を「ファイルを再送せず、安全に一括取込し、判断根拠を残す」に絞った。 |
| 30 | KJ法 | 指摘を「確定契約」「選択・エラー」「画面構造」「仕様整合」「後続課題」に群化し、依存順に実装した。 |

## 9. 改善後の検証（2026-09-22）

| # | 実行 | 結果 |
|---|---|---|
| E7 | 取込関連 web / core / api focused | PASS: web 8 files / 76件、core 64件、API 統合 43件 + query budget・migration 45件 |
| E8 | web typecheck、root lint、web build | PASS。色の直書き0件、公開文書の実データ参照OK、初期JS 104.50KiB / 110KiB |
| E9 | `check:mobile-layout` | PASS: 360px・375px・375px/200%、タップ最小44px、横はみ出し0 |
| E10 | web 全テスト | 81 files / 891 tests PASS。1件の家計画面実描画は、検査子プロセス自身が「すべて合格」を出力後に SIGTERM でタイムアウト。取込関連の失敗は0件で、既存証跡 E1c/E5 と同種の不安定性 |
| E11 | ローカルの認証済み Chrome で `/import?run=<id>` を実操作 | PASS: 3は全幅、4と5は左、履歴詳細は右、狭幅は縦積み。URL復元・閉じる操作もDOMテストでPASS |
| E12 | `import-screen.integration.test.ts` | 43 / 43 PASS。確定応答消失時の receipt 再送、確定開始後の追加・削除 404、互換 `POST /imports` の 5 回許可・6 回目 429 を含む |
| E13 | 互換 `POST /imports` 利用側の回帰 | PASS: import-diff 30件、import-lifecycle 52件、削除・監査・残高等 111 シナリオ。削除後再取込のテストは次の1分枠を明示し、本番の 5 回/分を緩めず PASS |

12ui の自動差分キットはローカルキャプチャまで完了したが、参照画像の LayerDoc 変換は外部サービスの認証待ちで停止した。`.improve/import-restore/` は gitignore 済みで、未完のキットから代替 CSS を採用していない。

## 10. 検証4条件

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | 新画面の確定を `/imports/runs` に一本化。T2の表示形式、specの読み順、receipt 再送、互換経路の防御、実装を揃えた |
| 漏れなし | PASS | MF・選択解除・エラー自動除外・確定後・履歴詳細・狭幅を契約テストで追加した |
| 整合性あり | PASS | 追加/月次置換の文言を純関数1か所に集約し、coreの状態判定とwebの表示を維持した |
| 依存関係整合 | PASS | 検査 ID→確定→receipt→結果→履歴の依存と、UI→view-model→hook→APIの単一経路をテストした。API分割と旧API廃止は独立した後続課題に分離した |

## 11. main 取込後の検証（2026-09-22）

PR 前に `origin/main` (0ed2d8c、#67 予算画面まで) を本ブランチへマージした。衝突 25 ファイルの解き方と結果を残す。

| # | 実行 | 結果 |
|---|---|---|
| E14 | 衝突の解消 | migration を `0051_import_inspections.sql` へ繰り上げ (main の `0050_budget_plans.sql` が先着)。`schema-guard`・migration テスト・specs・tasks・docs を 0051 に統一。`routes/imports.ts` は main の budgetPlans バックアップ対応と取込の import を両立。`core/index.ts` は両 export を保持 |
| E15 | 仕様の世代交代 | `system-spec/` 直下は取込サイクルを現行世代とし、main の予算サイクル 14 ファイルをバイト同一で `system-spec/archive/2026-09-22-budget-screen/` へ退避。`architecture/graph.json` は 150 ノードの和集合、`arch-budget-*` 8 件の lineage を退避先へ付け替え |
| E16 | checkbox の共通化 | main の方針に合わせ、新画面の checkbox 5 箇所を `SelectionCheckbox` に置換 (accessible name は従来の aria-label と同文) |
| E17 | `pnpm lint` | PASS。biome 644 files、check-graph-lineage 150 ノード一致・孤児0、デザイントークン直書き0、公開文書の実データ参照OK |
| E18 | `pnpm typecheck` | PASS (全 package) |
| E19 | `pnpm test` | PASS。core 1070 (skip 6)、api 913、web 932、test:aux EXIT 0 |
| E20 | render 再生成 | `.dev-graph/render/index.html` の output_sha256 `50e791e8…` が既存 receipt と一致 |

## 12. main 取込後の検証（2026-09-23）

PR 前に `origin/main` (237d2a2、#68 トレードオフ画面と #70 現金入力画面まで) をもう一度マージした。衝突 26 ファイルの解き方と結果を残す。

| # | 実行 | 結果 |
|---|---|---|
| E21 | 衝突の解消 | migration を `0053_import_inspections.sql` へ繰り上げ (main の `0051_tradeoff_notes.sql` #68 と `0052_cash_entry_owner_soft_delete.sql` #70 が先着)。裸の「0051」を行指定で 30 箇所置換。経緯を述べた行 (OI-01・spec の番号の由来・E14) は当時の事実なので対象から外し、個別に書き直した |
| E22 | 夜間保守の D1 予算 | 51 本 (取込 2 + 現金 2) が Free の 1 起動 50 本・安全枠 49 本を超えた。git は数値の衝突として見せず、`planScheduledMaintenanceD1Queries()` が module 初期化時に throw して表に出た。利用者の判断で取込を夜間の D1 枠から外し、`purgeExpiredImportRows` を検査要求へ相乗りさせた (OI-08)。予算表は 8 job・49 本 |
| E23 | 仕様の世代交代 | 直下は取込サイクルを現行世代とし、main の現金入力サイクル 14 ファイルをバイト同一で `system-spec/archive/2026-09-23-cash-entry-screen/` へ退避。`architecture/graph.json` は 166 ノードの和集合、`arch-cash-*` 8 件の lineage を退避先へ付け替え (内容同一なので digest は打ち直さない)。166 ノード全件で source_path 実在と digest 一致を確認 |
| E24 | main 側テストの前提の修正 | `cash-migration-0052.test.ts` が `names.at(-1)` で「自分が最後の migration」を前提にしており、0053 の追加で落ちた。`indexOf(TARGET)` に直し、他の画面が番号を足しても対象だけを見るようにした。衝突としては現れない種類の壊れ方 |
| E25 | `pnpm lint` | PASS。biome 683 files、check-graph-lineage 166 ノード一致・孤児0、デザイントークン直書き0、公開文書の実データ参照OK |
| E26 | `pnpm typecheck` | PASS (全 package) |
| E27 | テスト | PASS。core 63 files / 1156 (skip 6)、api 70 files / 1008 (skip 6)、web 89 files / 1019、`test:aux` 43 / 43。api は E24 の修正前に 1 件だけ失敗し、修正後に該当 3 file を再実行して PASS |
| E28 | render 再生成 | `.dev-graph/state/graph.json` (23 ノード・git 管理外) を入力に描き直し、`output_sha256` が既存 receipt の `50e791e8…` とバイト一致。`architecture/graph.json` (166 ノード) は render の入力ではない |
