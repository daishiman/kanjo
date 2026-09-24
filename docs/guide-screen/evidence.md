# 使い方画面の受入証跡

feature `feat-guide-screen`(Beads epic `kanjo-ogz`)の受入 S1〜S4 から、証跡のファイル・再現コマンド・取得時刻・基準コミットへ辿るための表。判断の理由は [`design-decisions.md`](design-decisions.md) を読む。

## 基準

| 項目 | 値 |
|---|---|
| 基準コミット | `ebc9d25`(作業開始時の `origin/main`。本 feature の変更は未コミットの作業ツリーにある) |
| 取得日 | 2026-09-23(UTC)。各コマンドの時刻は下表 |
| 実行環境 | macOS・Node.js 22.21.1・pnpm workspace。描画検査は headless Chrome(CDP)で `/api` をモックして行う |
| 描画検査の接続先 | `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4176`(この worktree の vite。4175 は別 worktree が使っていた) |

作業中に `origin/main` が `ef7ee82`(#71 設定画面)へ進んだ。#71 は本 feature の変更と `packages/core/src/index.ts`・`packages/web/src/components/Layout.tsx`・`packages/web/package.json`・`packages/web/src/api.ts`・`architecture/graph.json`・仕様書一式で重なる。取り込みは commit の後に行い、取り込み後に本表のコマンドを再実行する。

## 受入 → 証跡

| 受入 | 証跡(テスト / 検査) | 再現コマンド |
|---|---|---|
| S1-a 画面の構成 | `packages/web/src/pages/guide/guide-screen.dom.test.tsx`『見出し・4 ステップ・目次 7 項目・月次の流れ・総収支・右カラム 3 枚・よくある疑問・下部固定バーを出す』。描画検査 guide スコープ(360〜1600px・200% 拡大で構成・列数・2 列 / 1 列・はみ出し・固定バー) | `pnpm --filter @kanjo/web exec vitest run src/pages/guide` / `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4176 pnpm --filter @kanjo/web run check:guide-screen` |
| S1-b 総収支が実データ(振替除外)と一致 | `packages/api/src/guide-screen.integration.test.ts`『総額は同じ期間の総収支画面と一致し、振替と他の利用者の数値を含まない』『期間の指定があれば…』『期間の指定が無い・壊れているときは全期間になる』 | `pnpm --filter @kanjo/api exec vitest run src/guide-screen.integration.test.ts` |
| S1-c 直書き色 0 件 | `scripts/check-design-tokens.mjs`(`pnpm lint` 内)『hex/rgb/hsl/color-mix の直書きは 0 件』 | `pnpm lint` |
| S1-d 読込・失敗・検索 0 件・取込 0 件 | `guide-screen.dom.test.tsx` の『読込・失敗・検索 0 件』3 件と『取込が 0 件なら…』。`guide.dom.test.tsx`(用語と目安は API 失敗でも読める)。api『取込 0 件なら総額 0・最終更新 null・月次の状態 null を返す』 | 上の 2 コマンド |
| S2-a 段階の境界 49/50/79/80 | `packages/core/src/classify-status.test.ts`『信頼度の段階 (高 80 以上・中 50〜79・低 49 以下)』3 件 | `pnpm --filter @kanjo/core exec vitest run src/classify-status.test.ts` |
| S2-b 『段階＋%』の表示 | `pages/classify/classify.dom.test.tsx`・`pages/classify/view-model.test.ts`・`overview-review-queue.dom.test.tsx` の信頼度の期待値(RQ-F1 で書き換えを承認済み) | `pnpm --filter @kanjo/web test` |
| S2-c 防衛ラインと要確認の判定が不変 | `classify-status.test.ts`『信頼度 79 は要確認、80 は要確認でない』『要確認の閾値と高の下限はともに 80 (閾値は変えない)』。`packages/core/test/defense-forecast-contract.test.ts` ほか防衛ラインの既存テスト(期待値の変更なし)。api『防衛ラインの値を応答に含めない』 | `pnpm --filter @kanjo/core test` |
| S3 導出が core の 1 か所 | `packages/core/src/guide-screen.test.ts`(20 件)・`period-shift.test.ts`(3 件)。rg の結果は下の「grep の記録」 | `pnpm --filter @kanjo/core exec vitest run src/guide-screen.test.ts src/period-shift.test.ts` |
| S4-a ヘッダ『防衛ライン』 | `packages/web/src/common-shell.dom.test.tsx`(ヘッダの期待は変更なし) | `pnpm --filter @kanjo/web exec vitest run src/common-shell.dom.test.tsx` |
| S4-b フッタと AI 補足 3 か所 | `common-shell.dom.test.tsx`『信頼の前提と確認先を全画面のフッターに残す』(1 文目・title・プライバシー欄)。`guide-screen.dom.test.tsx`(データ出典の節の補足) | 同上 |
| S4-c 認可 | api『未認証は 401、一時パスワードのままなら 403』『…他の利用者の数値を含まない』 | S1-b と同じ |

## 実行結果(2026-09-23 UTC)

| コマンド | 結果 |
|---|---|
| `pnpm test` | core 65 ファイル・1,183 件合格(6 件 skip)/ api 71 ファイル・1,014 件合格 / web 91 ファイル・1,043 件合格。exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0(biome・glossary・graph-lineage 174 ノード・design-tokens 直書き 0 件・security:content を含む) |
| `pnpm --filter @kanjo/web run build:bundle` → `check:js-budget` | 初期 JS 107.71KiB / 110KiB |
| verify:full の build 以降の各段 | 下の「verify:full」に記す |

## 検証中に見つけて直した不具合

| 見つけた検査 | 症状 | 直し方 | 修正前に検査が落ちることの確認 |
|---|---|---|---|
| `check:guide-screen`(1280px) | 総収支の金額が『¥4,860,00 / 0』と桁の途中で折り返す | `.guide-total-value` を `white-space: nowrap` と `min(var(--fs-xl), 13cqi)` に | 修正前の guide.css で 2 つの幅が不合格になることを確認 |
| `check:js-budget` | 初期 JS 111.96KiB > 110KiB。フッタが `AI_DATA_NOTICE` を値で import したため、同じモジュールの本文表(よくある疑問・月次の流れ)が初期 JS に載った | `AI_DATA_NOTICE` を `packages/core/src/data-notice.ts` へ分けた | import を外すと 107.68KiB、分けた後 107.71KiB。初期チャンクに『よくある疑問』『月次の流れ』が 0 件 |
| `pnpm typecheck`(api) | 統合テストの `request` が `Response \| Promise<Response>` を返す型エラー | 他の統合テストと同じ `async function` に | — |
| `pnpm lint`(security:content) | planner が生成した `implementation-readiness.json` に端末の絶対パス | 既存 feature と同じ `<HOME>/` 表記に匿名化 | — |

## grep の記録(S3・P08)

| 調べたこと | 結果 |
|---|---|
| web と api の信頼度の境界比較(80 / 60 / 50) | 0 件 |
| `pages/Guide.tsx` | `export { GuidePage } from './guide/GuidePage.js';` の 1 行 |
| 防衛ラインの説明の『直近3か月 / 3ヶ月』の直書き(実装コード) | 0 件。残るのは `packages/core/test/defense-forecast-contract.test.ts:35` のコメントと、範囲外の `routeMetadata.ts:134`(トレードオフの説明) |
| `REVIEW_CONFIDENCE_THRESHOLD` | `packages/core/src/classify-status.ts:43` で 80 のまま |
| migrations と `packages/api/src/db/schema.ts` の差分 | 0 件 |
| web で `@kanjo/core` から使い方画面の規則を読むファイル | `pages/guide/view-model.ts` だけ(フッタの `AI_DATA_NOTICE` は `data-notice.ts` から) |

## 描画検査のスクリーンショット

`check:guide-screen` は幅ごとの画像を `$TMPDIR/kanjo-financial-review/guide-<幅>.png` に保存する(リポジトリには入れない)。見た目の正本は `design/FINAL-UI/images/19-guide.png`。

## verify:full

`pnpm verify:full` の build 以降の段を 1 段ずつ実行した(接続先は `KANJO_VISUAL_BASE_URL=http://127.0.0.1:4176`)。1 回目は 2026-09-23T23:01:56Z〜23:04:50Z。

| 段 | 結果 |
|---|---|
| `pnpm build` | exit 0 |
| `check:thead` / `check:mobile-layout` / `check:financial-figure` | exit 0 |
| `check:financial-routes` / `check:ai-screen` / `check:analysis-hub` | 1 回目は『描画待ちがタイムアウト』。vite が長時間の HMR で古いモジュール状態を持ち、React の Lazy で Uncaught が出ていた。vite を `--force` で再起動して再実行し、3 つとも exit 0(『財務画面の実描画検査: すべて合格』『支出分析ハブ実描画検査: 11条件・選択・遷移・履歴すべて合格』) |
| `check:cash-screen` / `check:guide-screen` | exit 0。再起動後の vite でも再実行して exit 0(2026-09-23T23:10:24Z) |
| `preview:smoke` | exit 0 |
| `build:bundle` → `check:js-budget` | exit 0(初期 JS 107.71KiB / 110KiB) |

## 2026-09-24 の30視点再レビュー

思考リセット後に30種を個別に適用した判断は [`elegant-review.md`](elegant-review.md) に記録した。改善は1回の実装・再検証サイクルで完了した。画像は `design/FINAL-UI/images/19-guide.png` を参照し、共通シェルのトークンを守りながら、期間帯・4ステップ・目次と本文・右カラム・FAQ・下部バーの存在と並びを確認した。画像の例示金額、サイドバーのバッジ数、防衛ラインの名称、用語と目安の追加は本機能の仕様に従う。現行の共通シェルの幅と FAQ の表形式は画像と視覚上の差があり、ピクセル単位の一致は主張しない。

| 検証条件 | 判定 | 根拠 |
|---|---|---|
| 矛盾なし | PASS（対象範囲） | 重複候補の説明を `total-cashflow.ts` の候補規則へ合わせ、月次進捗の `review` を「月次レビュー」と表示。期間表に別期間を「1年」と注記する矛盾も除去。 |
| 漏れなし | PASS（対象範囲） | 画像の主要構成、7つ目の「用語と目安」、検索のトピック一致・疑問のみ・0件、期間切替・失敗・0件を DOM と実描画で確認。 |
| 整合性あり | PASS（対象範囲） | 右カラムの4ラベルは `GUIDE_FACT_LABELS`、期間移動は `PeriodRange`、符号つき円は共通書式が正本。用語の現在値も共通期間で取得。 |
| 依存関係整合 | PASS（対象範囲） | 説明と導出は core、数値と認可は API、表示と検索状態は Web。サブスク候補の集計は必要なレビューキュー経路だけで行う。 |

今回の実行結果: core の対象25件と最終修正の21件、API の結合6件、Web のガイド/決算書関連75件と最終修正の15件が合格。`pnpm typecheck`、`pnpm lint`、Web の本番ビルドと初期 JS 予算 (108.46KiB / 110KiB)、`check:mobile-layout`、`check:guide-screen` (360〜1600px・200%拡大) が合格。後者は、期間切替中の「読み込み中」を完成値と誤判定しないよう待機条件も修正してから再実行した。

画像の自動ピクセル照合に使う `12ui improve --target` は CLI のサインインが必要で、この環境では実行できなかった。上記の PASS は画面の構成・動作と内部整合の判定であり、自動ピクセル一致の判定ではない。生成スクリーンショットは `$TMPDIR/kanjo-financial-review/guide-<幅>.png` に置き、リポジトリには含めない。
