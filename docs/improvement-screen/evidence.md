# 改善リクエスト画面 受入の証跡

feature `feat-improvement-screen`(Beads epic `kanjo-kkp`)の検査記録。受入の分け方は [`design-decisions.md`](design-decisions.md) §1、規則と実装・テストの対応は [`rules.md`](rules.md)。以下の G0〜G2 と PASS は **2026-09-23 の実行時点の履歴**であり、その後の作業ツリーの合格を表すものではない。現行の実行結果は新しい日時で追記する。

## 0. 判定の対象

- 対象: HEAD `ebc9d25` の上に、この feature の未コミットの変更を載せた作業ツリー(commit 前)。
- 2026-09-23 時点の判定に使ったのは、下の §1 の **G1**(`verify:full` の 1 回の通し)と G2(`skills:test`)だけ。G0 と G0b は、G1 より前の途中経過として残す。G0 の typecheck は修正前のコードで走ったものなので、判定に使わない(S5-f)。現行作業ツリーの判定は §5 を参照する。
- 時刻は UTC。

## 1. 実行の記録(品質ゲート)

| # | 実行 | 開始 → 終了 | 結果 |
|---|---|---|---|
| G0 | lint → typecheck → skills:test → test → build → 画面検査 8 本 → preview:smoke を段ごとに実行した(接続先を指定しなかった) | 2026-09-23T16:48:57Z → 17:09:19Z | typecheck は exit 2 だった。修正前のコードで走ったためで、修正後に単独で流し直すと exit 0(2026-09-23T16:57:56Z)。test は exit 0。check:financial-routes・check:ai-screen・check:analysis-hub の 3 本は exit 1(下の補足)。それ以外は exit 0 |
| G0b | G0 で落ちた 3 本と check:cash-screen・check:improvement-screen を、`KANJO_VISUAL_BASE_URL=http://127.0.0.1:4185` を付けて再実行した | 2026-09-23T17:13:58Z → 17:16:08Z | 5 本とも exit 0 |
| **G1** | `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4185 pnpm verify:full`(test → typecheck → lint → build → check:thead → check:mobile-layout → check:financial-figure → check:financial-routes → check:ai-screen → check:analysis-hub → check:cash-screen → check:improvement-screen → preview:smoke) | 2026-09-23T17:17:10Z → 17:38:26Z | **EXIT 0(1 回で通った)**。core 64 files / 1188 passed・6 skipped、api 72 files / 1037 passed、web 91 files / 1031 passed。lint: graph-lineage 174 ノード一致・色の直書き 0 件(252 ファイル)。初期 JS 107.94KiB / 110KiB。画面検査 9 本すべて合格。preview smoke 合格 |
| G2 | `pnpm skills:test` | 2026-09-23T16:49:22Z → 16:49:23Z | EXIT 0(36 tests OK) |

補足:

- G0 で落ちた 3 本の原因は 2 つあり、どちらもこの feature のコードの失敗ではない。
  - 接続先を指定しないと、画面検査は 4175 番を見る。4175 番では別の worktree の vite が動いていた。
  - この作業ツリーの vite(4185 番)は、長く動かしているあいだに依存の事前バンドル(`node_modules/.vite/deps`)の版番号がずれていた。`chart.js` と `react-chartjs-2` が 504(Outdated Optimize Dep)で返り、遅延読み込みの分析画面が真っ白になった。vite を `--force` で起動し直すと解消した。
- この作業ツリーの vite は 4185 番、wrangler は 8787 番で起動した。4175 番は別の worktree のものなので触っていない。

## 2. 受入ごとの判定

| 受入 | 判定 | 証跡 |
|---|---|---|
| S1-a 問いの見出し・作成フォーム・一覧(検索・5 つの件数タブ・表・ページング)・詳細パネル・空状態・読み込み失敗・撮影パネル・選択中バー・コピー完了トースト | PASS | G1 の web テスト(DOM「画面の要素が揃う (AC-014)」3 件、`improvement-capture.dom.test.tsx`)、G1 の check:improvement-screen(360・390・768・1024・1280・1600px と zoom200 で 10 行・ページ送り・詳細 6 区画・操作 5 つ) |
| S1-b 色・余白・部品はトークンと共通部品を通り、直書き色が 0 件 | PASS | G1 の lint(`check-design-tokens`: 直書き 0 件)、DOM「見た目の契約 (AC-019)」3 件 |
| S1-c 読込・空・失敗の状態 | PASS | G1 の web テスト(DOM「1 件も無いときは…空の状態」、読込・失敗の分岐) |
| S1-d プライバシー確認のどちらかが未チェックなら送信できない | PASS | G1 の web テスト(DOM「送信の条件 (AC-015)」2 件)、core「本文の空・1000 字超・確認の未チェックで送信できない」 |
| S2-a 本文・診断から 7 種と秘匿値が伏せられる | PASS | G1 の core「AC-006 マスク (7 種と秘匿値)」、api `improvement-redaction.test.ts` |
| S2-b 撮影用の複製で `data-capture-mask` の要素と辞書を使わない規則が伏字になる | PASS | G1 の DOM「撮影用の複製で金額を伏せる (AC-016)」 |
| S2-c 画面のマスクを飛ばした直接投稿にも、サーバで同じ規則(辞書を含む)が掛かる | PASS | G1 の api 統合「サーバ側のマスク (AC-009)」、`improvement-redaction.test.ts`「サーバ側の再マスク」5 件 |
| S3-a 状態の遷移・概要・番号・検索・件数・ページング・関連・アクティビティ・診断要約・マスクが core にある | PASS | G1 の core `improvement-screen.test.ts`(AC-001〜006) |
| S3-b web と api に同じ計算が 0 件 | PASS | [`design-decisions.md`](design-decisions.md) §7「P08 の監査」 |
| S3-c 画面名の表が core と `routeMetadata.ts` で一致する | PASS | G1 の web `improvement-route-labels.test.ts` 2 件 |
| S4-a 他の利用者の依頼は全経路で 404 | PASS | G1 の api 統合「他の利用者の依頼 (O4)」2 件 |
| S4-b 空の本文・1000 字超・確認の欠け・候補外の状態・形式外の画像が 400 | PASS | G1 の api 統合「1000 字ちょうどは 201、1001 字は 400」「プライバシー確認の片方が欠けると 400」「旧 wontfix を含む候補外の値は 400」、`improvement-lifecycle.test.ts` |
| S4-c 削除した依頼が『元に戻す』で同じ id と番号のまま戻る | PASS | G1 の api 統合「削除から復元で同じ id と seq が一覧に戻り…(AC-008)」、DOM「削除すると一覧から消え、『元に戻す』で同じ番号が戻る」 |
| S4-d 削除中の行が一覧と件数に 0 件で、詳細・画像・指示文・コピー記録・状態・agent の 2 経路で 404 | PASS | G1 の api 統合「削除中の行は items にも counts にも入らず…」「削除中の依頼は詳細・画像・…で 404」、[`design-decisions.md`](design-decisions.md) §7 の変異検算 M1〜M5 |
| S4-e 30 日を過ぎた論理削除の行が R2 の画像・行・履歴ごと消え、R2 の削除に失敗した行は翌晩に回る | PASS | G1 の `improvement-retention.test.ts`「論理削除から30日の完全消去 (AC-010)」3 件 |
| S5-a 0057 の適用で既存行・画像のキー・トークンのハッシュが失われず、wontfix は完了へ移り履歴に理由が残る | PASS | G1 の `improvement-migration-0057.test.ts` 6 件 |
| S5-b 夜間予算が `total === PLAN_MAX (49)` | PASS | G1 の `scheduled-maintenance-budget.test.ts` |
| S5-c `BACKUP_SNAPSHOT_SQL` に改善リクエストの表が無い | PASS | G1 の `improvement-backup-exclusion.test.ts` |
| S5-d `lint`・`typecheck`・`test`・`skills:test`・初期 JS 予算・`verify:full` が exit 0 | PASS | G1(`verify:full` は test・typecheck・lint・build と初期 JS 予算を含む)、G2 |
| S5-e 旧画面とモーダルの操作が新しい構成から実行できる | PASS | G1 の `improvement-capture.dom.test.tsx`、DOM テスト、api `improvement-lifecycle.test.ts` |
| S5-f 受入は実行済みの最新の証跡だけで判定する | PASS | この表の証跡は G1・G2 だけを指す |

## 3. 2026-09-23 時点で残っていたこと

- **タブレット幅の撮影の入口**: 641〜1023px では、右下の『改善を送る』が CSS(`styles.css` の `@media (min-width: 641px) and (max-width: 1023px)` の中の `.improve-trigger { display: none; }`)で隠れていた。G1 の check:improvement-screen は、768px でボタンが見えないとき撮影パネルの検査を飛ばした(ログの `撮影パネル=false`)。現在の修正と再検証は、この履歴とは別の実行結果で判定する。
- **P13(配信)**: merge・本番の migration 0057 の適用・deploy は行っていない。手順は `docs/improvement-request.md` の「配信と巻き戻し」と [`design-decisions.md`](design-decisions.md) §8 にある。

## 4. 2026-09-24 JST 思考リセット後の再検証

この節は現行作業ツリーの証跡。30観点と修正理由は [`elegant-review.md`](elegant-review.md) に記録した。匿名fixtureを使い、実データは検査に持ち込んでいない。

| 検査 | 結果 |
|---|---|
| 初回 `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4185 pnpm verify:full` | core 64ファイル/1188件、API 72ファイル/1037件が合格。Webは90ファイル/1034件が合格し、実描画1件が旧仕様「641pxでは改善操作をnavへ委譲する」を期待して失敗した。現行仕様の撮影ボタン表示・押下判定へ検査を更新した。後続ゲートはこの実行では未実行。 |
| 修正範囲の単体・統合検査 | core 32件、API 44件、Web DOM 60件が合格。撮影の文字・属性・canvas伏字、詳細取得失敗、タブレット入口を含む。 |
| `pnpm typecheck`、`pnpm lint`、`pnpm build` | それぞれ合格。lintは設計グラフ174ノードの参照一致、画面の色直書き0件、公開文書の実データ参照なしを確認した。 |
| `check:thead`、`check:mobile-layout`、`check:financial-figure` | すべて合格。 |
| 新しいVite（4186番、`--force`）での `check:ai-screen`、`check:financial-routes`、`check:analysis-hub`、`check:cash-screen`、`check:improvement-screen` | すべて合格。長時間起動していた旧サーバでは現行CSSに無い `display:none` が観測されたため、新サーバで全幅・全ルートを再検証した。照合詳細へ移動中のクリック検査も安定化した。改善画面は360・641・768・900・1023・1024・1280・1600pxと200%拡大で撮影入口を確認。 |
| `pnpm run preview:smoke` | 合格。ローカルmigration、SPA、認証、現金入力の作成・一覧・削除・空状態、廃止APIの404を確認。 |
| `pnpm --filter @kanjo/web exec vitest run src/mobile-financial-visualization-render.test.ts` | 専用Viteも `--force` で起動するよう更新して再実行し、1ファイル/1件が合格（887.24秒）。初回 `verify:full` で失敗した実描画テストを再確認した。 |

この段階では初回の `verify:full` 全体が途中で exit 1 だったため、修正後に同じテスト・後続ゲートを対象ごとに実行して判定した。後日実行した先頭からの通し検証は §5 に記録した。

参照画像（900×1748px）は複数の状態を同時に載せた見本で、実画面では一覧・空状態・取得失敗を排他的に表示する。匿名fixtureの900px全ページ撮影は885×3062px。作成フォームと一覧・詳細の左右配置は一致するが、青系配色・広いサイドバー・文字密度・ページ高は一致しない。最小文字サイズ、44px操作領域、共通シェルは現行デザインシステムに従う。画像の未知の固有名詞は自動伏字を保証できないため、送信前の目視確認が必要。

## 5. 2026-09-24 JST 最終通し検証

`vite preview --host 127.0.0.1 --port 4187 --strictPort` でビルド成果物を配信し、`KANJO_VISUAL_BASE_URL=http://127.0.0.1:4187 pnpm verify:full` を 12:40〜13:31 JST に先頭から実行した。**exit 0**。匿名fixtureと一時local D1だけを使用した。

| ゲート | 最終結果 |
|---|---|
| `pnpm test` | core 64ファイル/1188件合格・6件スキップ、API 72ファイル/1037件合格、Web 91ファイル/1035件合格。補助テストも合格。 |
| `pnpm typecheck`・`pnpm lint`・`pnpm build` | すべて合格。初期JSは108.61KiB/110KiB。 |
| 画面ゲート8本 | `check:thead`、`check:mobile-layout`、`check:financial-figure`、`check:financial-routes`、`check:ai-screen`、`check:analysis-hub`、`check:cash-screen`、`check:improvement-screen` がすべて合格。 |
| `pnpm run preview:smoke` | migration、SPA、認証、現金の作成・一覧・削除・空状態、廃止APIの404を確認して合格。 |
| 差分検査 | `git diff --check` 合格。変更一覧に `data/` と `packages/api/.dev.vars` はない。 |

通し検証の途中で二つの実行環境の問題を修正した。固定時間だけ待っていたモバイル検査は、遷移先URLと必要なDOMが揃うまで待つようにした。長時間起動したVite開発サーバはビルド後に依存モジュールを504で返したため、画面ゲートはプレビューサーバのビルド成果物へ向けた。さらにプレビュー動作確認の再ビルドが60秒制限でSIGTERMになったため、その工程を120秒、外側の制限を300秒に揃えた。最終の通し実行ではこれらを含む全ゲートが合格した。
