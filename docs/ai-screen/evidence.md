# AI分析画面 受入の証跡

feature `feat-ai-analysis-screen`(Beads epic `kanjo-5ru`)の検査記録。受入の分け方は [`design-decisions.md`](design-decisions.md) §1、規則と実装・テストの対応は [`rules.md`](rules.md)。

> **現在の判定: 独立レビュー待ち。** 下の E1〜E5 と PASS 表は 2026-09-19 時点の過去スナップショットであり、2026-09-20 の 0047・原子的保存・UI改善後の受入判定には使わない。現作業ツリーの fresh な検証結果は §6 に分離し、未完の全 API suite と旧 visual checker は PASS と扱わない。

## 0. 判定の対象

- 対象: HEAD `0003cb4` の上に、この feature の未コミットの変更を載せた作業ツリー(commit 前)。
- 判定に使うのは下の §1 に書いた実行だけ。それより前の実行は、途中の修正の前の結果なので使わない(S6-c)。
- 時刻は UTC。

## 1. 実行の記録

| # | 実行 | 開始 → 終了 | 結果 |
|---|---|---|---|
| E1 | `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4185 pnpm verify:full`(test → typecheck → lint → build → check:thead → check:mobile-layout → check:financial-figure → check:financial-routes → check:analysis-hub → preview:smoke) | 2026-09-19T16:39:29Z → 16:53:51Z | EXIT 0。テスト 897 passed / 6 skipped、699 passed、804 passed。初期 JS 102.89KiB / 110KiB。実描画検査 6 本すべて合格(財務画面の AI report は図 4 枚) |
| E2 | `pnpm test` / `pnpm typecheck` / `pnpm lint` / `check:analysis-hub` / `preview:smoke`(P10 の指摘を直したあとの再検証) | 2026-09-19T16:25:44Z → 16:38:20Z | 5 段すべて EXIT 0 |
| E3 | `pnpm skills:test` | 2026-09-19(E1 より前。skills は今回の変更の対象外) | 31 tests OK |
| E4 | P08 重複の監査(`rg -n "canceledAt\|usedAt\|expiresAt" packages/api/src packages/web/src`、`rg` による旧 `pages/Ai.tsx` 参照の検索) | 2026-09-19T16:5x(E1 と同じ作業ツリー) | 下の §3 |
| E5 | 採番の衝突のテストを、旧実装の `isUniqueViolation`(`cause` を辿らない)に一時的に戻して実行 | 2026-09-19(P10 の修正中) | 旧実装では 500 で落ち、新実装では 201。戻したあと E1・E2 で緑 |

補足: E1 より前に、同じ `verify:full` を一度通したときは check:financial-routes が「Matrix の描画待ちがタイムアウト」で落ちた(EXIT 1)。vite が依存の再最適化をしている最中だった。vite を起動し直したあとの E1 では合格している。

## 2. 受入ごとの判定

| 受入 | 判定 | 証跡 |
|---|---|---|
| S1-a 見出し・期間タブ・1〜3・選択中バー | PASS | E1 の web テスト(DOM テスト「問いの見出しの下に 1.依頼 → 2.実行中 → 3.レポート が順に並ぶ」) |
| S1-b 7 列の表 | PASS | E1 の web テスト(DOM テスト「7 列の表を出し…」) |
| S1-c 一覧・取り込み・4 タブ・版履歴 | PASS | E1 の web テスト(DOM テスト「レポートの一覧と詳細」) |
| S1-d 色の直書き 0 件・共通 `Button` | PASS | E1 の lint(`check-design-tokens` と design-system 検査)。`pages/ai` の hex は `rg` で 0 件 |
| S1-e 読込・空・失敗の状態 | PASS | E1 の web テスト(DOM テスト「読込と失敗の状態」「まだ依頼はありません」) |
| S2-a 段階を導く関数は `aiTaskStage` だけ | PASS | E1 の core テスト「段階と進捗」。E4(§3)。core の外に残る判定は §3 の 2 か所の既知の例外だけ |
| S2-b 境界 4 件 | PASS | E1 の core テスト「境界」 |
| S2-c 画面とエージェント経路が同じ判定 | PASS | `taskView` と `agentTask` はどちらも `stageOf` を呼ぶ。E1 の統合テスト「取り消し」で、取り消し後のデータ取得とレポート送信が 401(実行中 50%・75% を含む) |
| S3-a キャンセルでトークンが無効になり、行が残る | PASS | E1 の統合テスト「待機中の依頼を取り消すと canceled になり…」 |
| S3-b 失敗・キャンセルの再実行 | PASS | E1 の統合テスト「キャンセルした依頼を…新しい番号とトークンで発行する」「失敗 (結果なしで期限切れ) の依頼は再実行でき、期間を引き継ぐ」。待機中と完了の依頼の再実行は 409 |
| S3-c 結果の無い行だけ削除できる | PASS | E1 の `ai-lifecycle.test.ts` |
| S4-a 4 タブへの振り分け | PASS | E1 の core テスト「タブの振り分け」 |
| S4-b 版の説明 | PASS | E1 の core テストと統合テスト「版の説明」 |
| S4-c 2 版の比較 | PASS | E1 の DOM テスト「版履歴は新しい順に並び、1 つ前の版と比較できる」 |
| S4-d URL から選択を戻す | PASS | E1 の DOM テスト「URL の report と tab から詳細を復元し…」「ID を押すと選択が移り、URL に残る」 |
| S5-a 件数が D1 の行数と一致する | PASS | E1 の統合テスト「使用するデータの件数」 |
| S5-b 明細と摘要を渡さない | PASS | E1 の統合テスト「エージェントへ渡すデータ」(MF の摘要で確認。freee の `memo` は次の改訂で目印を足す) |
| S5-c 上限ちょうどを保存する | PASS | E1 の統合テスト「ちょうど 4 MiB の契約適合レポートは保存され…」(report と paste の両方) |
| S5-d 1 バイト超えは読み込み前に 413 | PASS | 同上(差し戻しの回数が増えない) |
| S5-e migration 0046 は既存行を更新しない | PASS | E1 の `ai-migration-0048.test.ts` |
| S6-a verify:full・skills:test・JS 予算 | PASS | E1(EXIT 0、102.89KiB / 110KiB)、E3 |
| S6-b 旧画面の操作を引き継ぐ | PASS | E1 の `ai-copy-log` / `ai-report-archive` / `ai-task-collapse` の DOM テスト |
| S6-c 最新の証跡で判定する | PASS | この文書は E1・E2 だけを判定に使う(§0) |

この23件PASSは E1 の過去スナップショットに限る。現作業ツリーの承認ではない。

## 3. P08 重複の監査(E4)

- `packages/web/src` で `canceledAt` / `usedAt` / `expiresAt` に当たるのは、`api.ts` の型定義と、AI 以外の画面(改善・取込の削除)だけ。AI 画面で段階を判定している箇所は 0 件。
- `packages/api/src/routes/ai.ts` で当たる箇所は、次の 3 つに分かれる。段階を導き直している箇所は無い。
  - 更新 SQL の条件(`isNull(usedAt)` / `isNull(canceledAt)`)と、競合で負けたときの文言の選択。取り消しとレポートの保存を、1 回だけ効かせるための条件。
  - 既知の例外 2 か所。エージェント認証の `agentGuard` と、画面からの貼り付け(design-decisions §7 P10)。
  - 応答の組み立てと、期限の計算。
- 旧 `pages/Ai.tsx` は `pages/ai/AiPage.tsx` などを再 export するだけ。これを参照しているのはコメント 1 行(`report-body.tsx`)だけ。

## 4. P10 配信してよいかの判断

- 独立した最終レビューの判定は「条件付きで配信可」(2026-09-20)。条件にされた指摘は、次のとおり扱った(design-decisions §7)。
  - 採番の衝突: 修正済み。E5 で、テストが旧実装を落とすことを確認した。
  - `no_data` を差し戻しに数えていた問題: 修正済み。
  - テストの抜け: 追加済み。
- 修正したあとの E1・E2 が緑なので、条件は満たした。
- 残した事項:
  - T-番号の再利用は仕様どおりの挙動。番号を使い回さないようにするかは、利用者の確認事項。
  - freee の摘要の目印と、2 か所の例外を `aiTaskStage` に寄せることは、次の改訂で行う。
- §3 の推定値には、利用者の異論はまだ出ていない。

## 5. P13 配信

**未実施(保留)**。commit・push・PR の作成・merge と、本番の Migrate / Deploy は、この作業では行っていない。`0049_ai_report_invariants.sql` も本番には適用していない。

## 6. 2026-09-20 改善後の検証台帳

この節は今回の作業ツリーで実行した結果だけを記す。旧スナップショットの件数は合算しない。

| 種別 | 実行 / 範囲 | fresh な結果 |
|---|---|---|
| core | `pnpm --filter @kanjo/core exec vitest run test/ai-screen.test.ts --maxWorkers=1` | PASS: 1 file / 27 tests。retry helper が capability table から導かれることを全 stage で確認 |
| Web AI DOM | AI の DOM test 5 files を `vitest run --maxWorkers=1` | PASS: 5 files / 43 tests |
| targeted API | AI・契約・migration・schema guard の targeted API run | PASS: 6 files / 84 tests |
| API 競合の再確認 | `pnpm --filter @kanjo/api exec vitest run src/ai-screen.integration.test.ts --maxWorkers=1` | PASS: 1 file / 23 tests。三者競合で一意衝突後の再claimが 0 件なら 201 を返さない負例を含む |
| migration helper 代表 | trigger-aware migration helper・0047・balances の代表 run | PASS: 3 files / 14 tests |
| reconciliation 回帰 | `packages/api/test/reconciliation.integration.test.ts` | PASS: 1 file / 26 tests |
| total-cashflow 回帰 | `packages/api/test/total-cashflow-verdict.integration.test.ts` | PASS: 1 file / 19 tests |
| typecheck | `pnpm typecheck` | PASS: core / api / web の 3 workspace、終了コード 0 |
| lint | `pnpm lint` | PASS: 終了コード 0。551 files、graph lineage 118 nodes、`packages/web/src` を含む直書き hex/rgb/hsl/color-mix 0 件 |
| build / Worker dry-run | `pnpm build` | PASS: Vite 302 modules、初期 JS 103.42 KiB / 110 KiB、Wrangler `--dry-run: exiting now.` |
| AI 直行 visual | Vite を 4195 番で起動し、`KANJO_VISUAL_BASE_URL=http://127.0.0.1:4195 pnpm --filter @kanjo/web run check:ai-screen` | PASS: 360 / 768 / 1280 / zoom 200% の 4 条件。3 段、help、進捗 50%、選択行、選択中バー、検索結果、レポート詳細と 4 tab、図 4 枚、page overflow なし。参照画像との pixel 同一性は判定対象外 |
| diff | `git diff --check` | PASS: 終了コード 0 |
| 全 API suite | `pnpm --filter @kanjo/api test` | **未完 / PASS ではない**。長時間無出力のため安全に中断し、上記の targeted・代表・回帰 run へ切り替えた。失敗表示は観測していないが、完走していない |
| 旧全体 visual checker | `check-financial-visuals.mjs` の全 route run | **未完 / PASS ではない**。AI へ到達する前に Reconciliation の待機で timeout。AI は上記の独立した `check:ai-screen` で改めて完走した |
| 本番 migration / deploy | 対象外 | この作業では実行しない |

未完了項目の owner は実装担当、期限は現反復終了時、再実行 trigger は関連コードまたは文書の変更である。最終4条件の承認は独立レビュー担当が行い、本書の作成者は自己承認しない。
