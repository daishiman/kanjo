# トレードオフ画面 受入の証跡

feature `feat-tradeoff-screen`(Beads epic `kanjo-4ib`)の日時付き検査記録。規則の正本は [`specs/spec-tradeoff-screen.md`](../../specs/spec-tradeoff-screen.md)、判断理由は [`design-decisions.md`](design-decisions.md)。本書は記載時点の実行結果を保存する証跡であり、現在の作業ツリーや公開状態を自動的に保証しない。

**現在の扱い:** 未公開・本番未適用。E7〜E10 が最新作業ツリーの記録である。トレードオフ機能の対象検証、core/API の全体検証、型・lint・build、実ブラウザ 3 幅の構造検証は PASS。web 全体一括実行だけは、対象外の既存テストに負荷依存の失敗・worker 起動 timeout・単独でも無出力の長時間 timeout があり、全件一括 PASS とは扱わない。失敗した import / classify は単独再実行で PASS し、トレードオフ対象 44 件は一括でも PASS している。

## 0. 判定の対象

- 対象: HEAD `f0e5a3b` の上に、この feature の未コミットの変更を載せた作業ツリー(commit 前)。
- 判定に使うのは下の §1 に書いた実行だけ。それより前の実行は、途中の修正の前の結果なので使わない。
- 時刻は UTC。

## 1. 実行の記録

| # | 実行 | 開始 → 終了 | 結果 |
|---|---|---|---|
| E1 | `verify:full` の全段(test → typecheck → lint → build → check:thead → check:mobile-layout → check:financial-figure → check:financial-routes → check:ai-screen → check:analysis-hub → preview:smoke)を、同じ作業ツリーで下の 3 回に分けて通した。vite は 127.0.0.1:4175 | 2026-09-22T04:01:25Z → 04:24:49Z | 全段 EXIT 0(内訳は E1a〜E1c) |
| E1a | `pnpm verify:full` の test → typecheck | 04:01:25Z → 04:19:36Z | test は core 1016 passed / 6 skipped、api 835 passed、web 908 passed。typecheck は緑。続く lint の `security:content` が、この文書の対(design-decisions §8)に書いた例示の絶対パスで落ちた(EXIT 2)。文を言い換えて、`security:content` 単独で OK を確かめた |
| E1b | lint → build → check:thead → check:mobile-layout → check:financial-figure → check:financial-routes …(verify:full と同じ順) | 04:20:33Z → 04:21:35Z | lint は全段緑(`check-glossary` 55 語、`security:content` OK)。build の初期 JS は 103.68KiB / 110KiB。見出し固定・スマホ幅・財務の図の実描画は合格。check:financial-routes は「Matrix の描画待ちがタイムアウト」(本文が空)で落ちた(EXIT 1)。vite は数時間起動したままで hmr を何度も受けていたので、起動し直した |
| E1c | check:financial-routes → check:ai-screen → check:analysis-hub → preview:smoke | 04:22:29Z → 04:24:49Z | EXIT 0。財務画面と AI 画面の実描画は合格、支出分析ハブは 11 条件すべて合格、preview:smoke は 1 pass / 0 fail |
| E2 | 他の利用者の分離の変異検査。`analytics.ts` の `latest` の読み出しと、両方 null の削除から `userId` の条件を一時的に外して結合テストを実行 | 2026-09-22(P10 の修正中) | 外した状態では「latest は自分の記録のうち id 最大の 1 件」「両方 null で自分の行だけを消し、自動へ戻す」の 2 件が落ちた。バックアップから戻し、`cmp` で元のファイルと一致を確かめた。戻したあとは E1 で緑 |
| E3 | P08 の監査(`rg` による `* 12` の式・hex の直書きの検索、`git diff` による既存契約テストの差分、`migrations/` の最新番号の確認) | 2026-09-22(E1 と同じ作業ツリー) | 下の §4 |
| E4 | 候補キー・丸め境界・413 追加後の対象検証。core 契約、API 結合、期間・入口回帰、migration、core / API typecheck、対象 6 ファイルの Biome、`git diff --check` | 2026-09-22T05:42Z頃 → 05:45Z頃 | core 1 file / 46 passed、API tradeoff 1 file / 28 passed、API 回帰 2 files / 19 passed、migration 1 file / 4 passed。typecheck・Biome・diff check は PASS。全体・web の最終判定ではなく、変更した core / API 契約の対象検証 |
| E5 | `pnpm --filter @kanjo/web exec vitest run src/pages/tradeoff/tradeoff-screen.dom.test.tsx src/tradeoff-review.dom.test.tsx --maxWorkers=1` | 2026-09-22T05:51:11Z | **FAIL**: 2 files 中 1 failed / 1 passed、39 tests 中 2 failed / 37 passed。旧区切り形式のテスト fixture と、422 文の二重表示を検出。修正後の再実行が必要 |
| E6 | E5 修正後に同じ web 対象テストを再実行 | 2026-09-22T05:52:46Z | **FAIL**: 2 files 中 1 failed / 1 passed、44 tests 中 2 failed / 42 passed。追加した入力検証テストのラベル検索と、この環境に無い matcher の使用を検出。修正後の再実行が必要 |
| E7 | 最新作業ツリーのトレードオフ対象検証。core 契約、API tradeoff + auth/schema/canonical 回帰、web DOM、typecheck、lint、build、`check-tradeoff-visual` | 2026-09-22T06:03Z頃 → 06:43Z頃 | **PASS**: core 46、API 4 files / 51、web 2 files / 44。typecheck・lint・build は PASS。初期 JS 104.29KiB / 110KiB。実ブラウザの 1440 / 1024 / 375px は全条件 PASS |
| E8 | `pnpm --filter @kanjo/core test` と `pnpm --filter @kanjo/api test` | 2026-09-22T06:44Z頃 → 07:03Z頃 | **PASS**: core 60 files passed / 1 skipped、1019 tests passed / 6 skipped。API 63 files / 838 tests passed。初回 API 全体検証が抽出済み route の mutation 監査対象漏れを検出したため、監査の列挙へ `routes/tradeoff.ts` を追加してから全件 PASS を確認 |
| E9 | `pnpm --filter @kanjo/web test` と切り分け再実行 | 2026-09-22T07:04Z頃 → 07:22Z頃 | 全件一括 PASS には未到達。全体は worker が長時間停止。描画テスト 1 本を除いた実行は 82 files 中 81 passed / 1 failed、905 tests passed / 1 failed に加え worker 起動 timeout 1 件。対象外の `Import.discard` の失敗例は単独で PASS、`classify-split` も単独で PASS。除外した `mobile-financial-visualization-render` は単独 240 秒で無出力 timeout。トレードオフ対象は E7 で 44/44 PASS |
| E10 | 生成物の実画面キャプチャと画像基準の構造比較 | 2026-09-22T07:22Z頃 → 07:24Z頃 | **PASS**: 1440 / 1024 / 375px の 3 枚で、上部説明、期間、Step 1〜3、試算結果、計算例、下部 CTA、2 列→1 列、横 overflow なし、mobile 44px 操作面を確認。共通 shell は既存仕様を維持 |
| E11 | `pnpm test:aux` と `git diff --check` | 2026-09-22T07:25Z頃 → 07:26Z頃 | **PASS**: runbook、実データ guard、GitHub script、初期 admin、会計 report Skill、設計システム配信の補助テストが全件 PASS。差分の空白エラーなし |
| E12 | main(0ed2d8c)の取り込み後の `pnpm lint`・`pnpm typecheck`・関連テスト | 2026-09-22T07:50Z頃 → 07:54Z頃 | **PASS**: lint(graph-lineage 150 node 一致を含む)と typecheck が EXIT 0。core 1052 passed / 6 skipped、api のトレードオフ・migration 0051・schema-guard・deletion-schema 5 files 64 passed、web のトレードオフ 2 files 44 passed。main 側で 0050 が `0050_budget_plans.sql` に使われたため、本機能の migration を `0051_tradeoff_notes.sql` へ繰り上げた |
| E13 | PR #68 の CI「テスト (core・web)」の失敗の修正 | 2026-09-22T08:31Z → 08:40Z頃 | **PASS**: main から入った契約 `selection-checkbox-source-contract`(native checkbox は `SelectionCheckbox` だけが所有する)に `pages/tradeoff/CandidateRow.tsx` の生 checkbox が違反していた。共通部品へ置き換え、アクセシブル名「〇〇を選ぶ」は `label` と `labelHidden` で維持。契約テストとトレードオフ DOM テストの 3 files 46 passed、typecheck・lint は EXIT 0 |

補足: E1 より前に 2 回 `verify:full` を通したときは、どちらも lint だけが落ちた(EXIT 1)。1 回目は `check-glossary` の未使用語 4 件、2 回目は `security:content` の絶対パス 3 件。テスト 3 パッケージはどちらの回も緑(core 1016 passed / 6 skipped、api 835 passed、web 908 passed)。直し方は design-decisions §8「範囲外の変更」。

## 2. 最新作業ツリーの4条件判定

| 条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS | 仕様・decision・実装で候補キー、年額化、丸め後の 1,000 円境界、画面部品名を統一。API 全体 838 件と core 全体 1019 件が PASS |
| 漏れなし | PASS（トレードオフ範囲） | 入力、候補、推奨、結果、計算例、保存、読込・空・失敗、3 幅 responsive を DOM 44 件と実ブラウザで確認 |
| 整合性あり | PASS | 定数・年額化・候補キーを core に集約し、web/API の重複契約を除去。UI は design token と共通 Button を使用 |
| 依存関係整合 | PASS | core → API route → web の一方向を維持。route は auth / schema / canonical fence の後で mount し、mutation 監査にも抽出先を登録 |

この判定はトレードオフ機能の受入を対象とする。E9 のため、リポジトリ全体の web 一括テストを「全件 PASS」とは表現しない。

## 3. E1時点の受入判定（履歴）

| 受入 | E1時点の判定 | 証跡 |
|---|---|---|
| S1-a 見出し・問い・分析期間・1〜3・計算例・右の試算結果・選択中バー | PASS | E1 の web テスト(DOM テスト「画面の骨格 (O1)」「候補表 (FR-5 / FR-6)」) |
| S1-b 読込・空・失敗の状態、選択 0 件で選択中バーが無い | PASS | E1 の web テスト(DOM テスト「状態」の 5 件) |
| S1-c 保存一覧と翌月の突合が無い | PASS | E1 の web テスト(「保存済み試算の一覧と翌月の突合を出さない (FR-14)」、`tradeoff-review.dom.test.tsx`) |
| S1-d 色の直書き 0 件・共通 `Button` | PASS | E1 の lint(`check-design-tokens`)、DOM テスト「見た目の約束 (C2)」。E3 で `pages/tradeoff` の hex は 0 件 |
| S2-a 試算の関数は `tradeoffSimulation` だけ | PASS | E1 の core テスト「試算 (決定 005 / 009、O2)」。E3 で web / api に `* 12` の式は 0 件 |
| S2-b O2 の 3 例・境界・nodata・開始月の不変性 | PASS | E1 の core テスト「試算」の 7 件 |
| S2-c 右パネルと選択中バーの差額が同じ | PASS | E1 の web テスト「毎月 80,000 と 地代家賃+外注費 (85,000/月) で捻出の文、右パネルと選択中バーの差額が同じ」 |
| S3-a 候補の集計・1,000 円の境界・50 件・取引先なし・同額の並び | PASS | E1 の core テスト「候補の作り方」 |
| S3-b 推移の境界・必要度の 4 行・検知器で下げない・上書きの優先 | PASS | E1 の core テスト「推移」「必要度 (決定 010)」「候補の作り方」 |
| S3-c PUT で保存、manual とメモが返る、両方 null で自動へ | PASS | E1 の api テスト「PUT /api/tradeoff/candidates/:key」 |
| S4-a 同じ入力で同じ上位 4 件・届かない組を除く・5 段の順位 | PASS | E1 の core テスト「推奨の組み合わせ (決定 003)」(充足度の切り捨ては割り切れない例で固定) |
| S4-b 推奨を選ぶと理由とリンクが出る | PASS | E1 の web テスト「推奨の組み合わせ (FR-8)」 |
| S5-a POST は 1 行ずつ増え、保存値はサーバの再計算値 | PASS | E1 の api テスト「POST /api/tradeoff と latest」 |
| S5-b 422・400・401・利用者の分離 | PASS | E1 の api テスト 3 群。分離のテストが絞り込みの欠落を落とすことは E2 |
| S5-c `latest` と画面の復元 | PASS | E1 の api テスト「latest は自分の記録のうち id 最大の 1 件」、web テスト「記録と復元 (FR-12 / FR-13)」 |
| S5-d migration 0050 は既存行を更新しない | PASS | E1 の `tradeoff-migration-0050.test.ts`、E3 |
| S6-a テスト・typecheck・lint・verify:full | PASS | E1(全段 EXIT 0。1 回の連続実行ではなく 3 回に分けた。分けた理由は §1) |
| S6-b 初期 JS 予算 | PASS | E1b の build 段の `check:js-budget`(103.68KiB / 110KiB) |
| S6-c 既存の契約テストが差分なしで緑 | PASS | E3 で `tradeoff-review-contract.test.ts`・`diagnosis-detectors-contract.test.ts` の差分 0、E1 の core テストで緑 |

## 4. P08 重複と安全の監査(E3)

- `packages/web/src` と `packages/api/src` のトレードオフ経路(テストを除く)に `* 12` の式は 0 件。
- `migrations/0050_tradeoff_notes.sql` は `ALTER TABLE tradeoff_plans ADD COLUMN` × 2(`start_month`・`memo`)、`CREATE TABLE tradeoff_candidate_notes`、`CREATE UNIQUE INDEX` だけ。UPDATE / DELETE / DROP は無い。
- 既存の契約テスト 2 本は `git diff` で差分 0。
- `packages/web/src/pages/tradeoff` に hex の直書きは 0 件。
- `origin/main`(f0e5a3b)の最新 migration は `0049_ai_report_invariants.sql`。0050 は空いている。

## 5. P10時点の配信判断

- 独立した最終レビュー(コードを読むだけ)の判定は「条件付きで配信可」。高の指摘は 0 件。
- 条件にされた中の指摘 2 件は、どちらもテストを足して直した(design-decisions §8 P10)。
  - 他の利用者の分離: E2 で、テストが絞り込みの欠落を落とすことを確かめた。
  - 充足度の切り捨て: 割り切れない例を足した。
- 低の指摘のうち `selected` の `label` と `keys` の重複の 400 は直した。
- 修正したあとの E1 では条件を満たした。これは現行作業ツリーの再検証や P13 の完了を意味しない。
- E1時点で残した事項(現時点の未解決一覧ではない):
  - 413 のテストが無い(後続の E4 で POST / PUT の 64 KiB 超を追加し、いずれも 413 を確認済み)。
  - 月額を丸めてから 1,000 円と比べる順序が spec に無い(後続の改善で、丸め後に閾値判定する契約と境界例を spec へ明記済み)。
  - メモの保存の失敗で入力が消える。取り直しの失敗で画面全体がエラーになる(後続の Web 改善で、メモ入力保持と背景再取得失敗時の非破壊表示へ変更済み)。
  - 候補キーの区切り `|` が名前に入ると衝突する(後続の改善で versioned JSON tuple と可逆 parser へ変更済み。最新状態は spec §「文書の正本と投影」および design-decisions §4を参照)。

## 6. P13 配信

- main(0ed2d8c)を取り込み、衝突を解決した(解決表は design-decisions「main の取り込み(P13 準備)」)。取り込み後の検証は E12。
- migration は `0051_tradeoff_notes.sql` に繰り上げた。§4 と §3 の「0050」は E3・E1 時点の履歴として残す。
- commit・push・draft PR の作成まで行う。merge と本番の Migrate / Deploy は行わない。merge の前に `origin/main` を fetch し直して、0051 がまだ空いていることを確かめる。
