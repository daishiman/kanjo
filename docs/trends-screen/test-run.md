# 推移画面 テスト実行記録 (SYS-TRENDS-P06)

実行日: 2026-09-17。最終変更後に package 全件、対象 DOM、typecheck、lint、build、実描画、preview smoke を実行した。

## 件数

| package | Test Files | Tests |
|---|---|---|
| `@kanjo/core` | 46 passed / 1 skipped (47) | 718 passed / 6 skipped (724) |
| `@kanjo/api` | 47 passed (47) | 608 passed (608) |
| `@kanjo/web` | 77 passed (77) | 648 passed (648) |

| ゲート | 結果 |
|---|---|
| `pnpm typecheck` (core / web / api) | 緑 |
| `pnpm lint` (biome 454 files・graph lineage・design token hex 0 件・security:content) | 緑 |
| `pnpm build` | 緑 (`Trends-*.js` 27.31 kB / gzip 8.85 kB、初期 JS 109.88 KiB / 110 KiB、Worker dry-run) |
| 対象 DOM (`trends-screen`・`period-picker`・`analysis-mutation-invalidation`) | 3 files / 33 tests 緑 |
| 実描画 | 緑 (core / additional 各 11 条件。Trends主要2図、8列、初期CTA、旧判定なし、360〜1600px + rail-zoom200) |
| `pnpm preview:smoke` | 緑 (local migration・SPA・auth・cash lifecycle・retired API 404) |

## 推移画面の意味を固定する主なテスト

| テスト | 件数 | 結果 |
|---|---|---|
| `packages/core/test/trend-comparison.test.ts` | 比較欠損を0扱いしない、同名カテゴリをsideで区別、負の増減を保持 | 緑 |
| `packages/core/test/trend-metrics-contract.test.ts` | 登録表メタデータ・総収支との一致・恒等式・初期 recommended と選択 focus の分離 | 緑 |
| `packages/api/test/trends-screen.integration.test.ts` | sideを含むAPI契約・400・既定値・総収支との一致・共有4表loader | 緑 |
| `packages/web/src/pages/analysis/trends-screen.dom.test.tsx` | 3現在系列・追加指標・意味色・8列・初期CTA・origin文言・選択帯・null gap・旧判定なし・カテゴリ表専用幅契約 | 22件 緑 |
| `packages/web/src/period-picker.dom.test.tsx` | 保存値なしは直近1年、利用者が保存した全期間は保持 | 緑 |
| `packages/web/src/analysis-mutation-invalidation.dom.test.tsx` | freee CTA の月 query が総収支 API の同月取得に使われる | 緑 |
| `packages/web/src/classify-trends-filter.dom.test.tsx` | category・payee・month・clsの組合せ | 緑 |

## 最初に赤だったもの

| 赤 | 原因 | 直し方 |
|---|---|---|
| `pnpm lint` 22 件 | biome の整形・未使用 import、`security:content` が仕様の生成物 (`completeness-findings.json`) の絶対パス 2 か所を検出 | 整形を適用し、絶対パスを `<plugin-cache>/` と相対表記へ置換 |
| 実描画検査 641 / 768 / 900 / 1024px と rail-zoom200 で「Trends の表 container が main をはみ出す」 | `.trends` の grid の子要素が `min-width: auto` のため、横長の表の幅で列が広がる | `trends.css` に `grid-template-columns: minmax(0, 1fr)` と子要素の `min-width: 0` |
| web全件でlazy画面のfindが1秒を超えることがある | CPU速度を機能判定に含めた既定待機時間 | lazy遷移の上限を5秒に明示し、全648件を再実行して緑 |
| `pnpm --filter @kanjo/web test` の render wrapper 1件が Vite 起動待ちで timeout | API全件と実ブラウザを同時実行したため workerd / Vite 起動が競合 | unit 648件を全件再実行し、render の core / additional を各11条件で単独実行して緑。機能失敗ではないことを切り分けた |
| `preview:smoke` 初回が timeout | API全件の Miniflare と同時実行し、ローカル workerd が競合 | API終了後に単独再実行して緑 |

`trend-contract.test.ts` と `analytics-period.test.ts` の既存値は維持。
`trends-scope.dom.test.tsx` は rolling deploy 用の旧 Worker fallback の固有部分だけを検証する形へ更新して緑。

## カテゴリ表 UI 追補

汎用 `.scroll-x table.data` の auto table layout が、余剰幅を「12か月の推移」周辺に偏らせ、表の `max-height` と `overflow: auto` がページと表の二重縦スクロールを作っていた。専用 `colgroup` と fixed layout で 8 列を容器内に収め、右端に 8px の余白を残す。通常幅はカテゴリ 20%、推移 9%、残りを数値 6 列に配分し、75rem 以上はカテゴリを 15% へ戻す。名称と事業/家計 pill は 2 段 grid とし、54rem 以下はカード表示へ切り替える。

| 1280px 実測 | 改善前 | 改善後 |
|---|---:|---:|
| 表幅 / 容器幅 | 1027 / 932px | 947 / 947px |
| カテゴリ列 | 378.42px | 187.80px（通常名は1行） |
| 12か月の推移列 | 100px | 84.50px（spark 本体 84px） |
| 数値6列 | 最大幅差 75px | 103.28〜122.06px |
| 8ヘッダが容器内 | NG | PASS |
| 表内縦スクロール | あり | なし |

カテゴリ表の 8 見出しはすべて昇順→降順→元の順序の 3 状態で、`aria-sort` も同期する。12か月の推移は「最初と最後の記録値の差」で並べる。展開した取引先行は親カテゴリと一緒に移動する。

実描画は 320 / 360 / 375 / 390 / 641 / 768 / 900 / 1023 / 1024 / 1280 / 1600 / 1908px と 200% zoom で、横はみ出しなし、8列表示またはカード化、8ソート操作の 44px タップ領域、通常名 1 行・最長名 2〜3 行、内側縦スクロールなしを数値 assertion で確認する。また、生の `<table>` を静的監査し、ソート対象表は共通 `SortableTableHeader`、非対象は `layout / matrix / hierarchy / comparison / workflow` の明示 taxonomy と理由を必須にする。
