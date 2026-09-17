# 推移画面 最終レビュー (SYS-TRENDS-P10)

`git status --short` の全変更を FR1〜FR13 と突き合わせ、scope 外の変更が無いことを確認した。

## FR ごとの差分箇所

| FR | 差分箇所 | 固定するテスト |
|---|---|---|
| FR1 期間 | 共通 `PeriodProvider` / `PeriodPicker` と `Trends.tsx` の URL 同期 | web `period-picker.dom.test.tsx` / `trends-screen.dom.test.tsx` |
| FR2 比較条件の帯・要確認の注記 | `trends/Conditions.tsx`・`trends.css` | web 同上 / api 要確認の一致 |
| FR3 一体型 KPI サマリー帯 | `packages/core/src/trend-metrics.ts` (`TrendKpis`)・`trends/KpiSummary.tsx` | core `trend-comparison.test.ts` / web |
| FR4 推移チャート | `trends/TrendSeriesPanel.tsx`・`trends/view-model.ts`・`packages/web/scripts/check-financial-visuals.mjs` | web の系列意味テスト / 視覚検査 |
| FR5 詳細パネル | `trend-metrics.ts` (`recommended` / `focus`・`TrendSourceSummary`)・`trends/TrendDetailPanel.tsx` | core の粒度・api 口座 null・web の初期 CTA / origin 文言 |
| FR6 8列カテゴリ表と独立した取引先内訳 | `trend-metrics.ts` (`TrendCategoryRow`・`TrendPayeeRow`・スパークライン)・`trends/CategoryBreakdown.tsx`・`trends/Spark.tsx` | core スパークライン / web の全期間8列・null gap |
| FR7 パレート図と上位 3 | `trend-metrics.ts` (`ChangeParetoRow`)・`trends/ChangeFactors.tsx`・`trends/view-model.ts` | core / web の意味色・分母・累積・要因文テスト |
| FR8 選択バー | `trend-metrics.ts` (`TrendFocus`・`trendDrilldownHref`)・`trends/ComparisonScreen.tsx`・`trends/format.ts` | web の初期/選択CTA、月・金額・hrefの粒度、origin別ラベル |
| FR9 指標の登録表 | `trend-metrics.ts` (`METRIC_DEFINITIONS.visualRole/controlOrder/showInOverview`)・`packages/api/src/routes/analytics.ts`・`packages/web/src/api.ts` | core 登録契約 / web 追加指標主図 / api 400 |
| FR10 /classify の絞込 | `packages/web/src/pages/Classify.tsx` | web `classify-trends-filter.dom.test.tsx` |
| FR11 旧判定の重複除去 | 新しい `ComparisonScreen.tsx` から `JudgementDisclosure` を除去。`Trends.tsx` の旧 Worker fallback だけを維持 | web の新画面非表示 / fallback テスト |
| FR12 規則の文書化 | `docs/trends-screen.md` | core 境界値テスト |
| FR13 初回直近1年 | `packages/web/src/period.tsx`。保存値なしだけ `span=1`、明示した全期間は保持 | web `period-picker.dom.test.tsx` |

共通の土台: `packages/core/src/total-cashflow.ts` (`totalCashflowLedger` の切り出し)、
`packages/api/src/cashflow-sources.ts` (freee 系4表の userId 分離済み共有loader)、
`packages/core/src/index.ts` (export 追加)、`design/FINAL-UI/spec/AUDIT.md` (07 行の状態更新)。
`design/` は `scripts/link-design.sh` が張る symlink で git の追跡外のため、AUDIT.md の更新は `git status` に現れない。

## scope 外の変更

| 区分 | ファイル | 判断 |
|---|---|---|
| 計画・仕様 | `system-spec/*`、`specs/`、`features/`、`architecture/`、`tasks/feat-trends-screen/`、`.dev-graph/*` | 本機能の要件・設計・task 仕様の成果物 (P01 以前の工程で作成)。scope 内 |
| 文書 | `docs/trends-screen.md`、`docs/trends-screen/*` | P01〜P13 の成果物。scope 内 |
| 実装・テスト | 上表のとおり | scope 内 |
| migration | なし | 0042 のまま |

**scope 外の変更は 0 件。** `git log origin/main..HEAD` は空で、未 push の commit も無い。

## 既存契約との互換

`trend-contract.test.ts` と `analytics-period.test.ts` は既存値を維持し、
`trends-scope.dom.test.tsx` は rolling deploy 用の旧 Worker fallback の固有部分だけを検証する形へ更新して緑。
