# 推移画面 整理の記録 (SYS-TRENDS-P08)

## 何を整理したか

### 1. 総収支の月次値を行集合から作る

`packages/core/src/total-cashflow.ts` の `rowsFrom` は、月ごとに freee と MF を
`filter` して合計していた。推移画面は同じ判定を通った **1 行ずつ** が必要なので、次の形に分けた。

| 前 | 後 |
|---|---|
| `rowsFrom(data, deals, result): TotalCashflowMonth[]` | `ledgerFrom(data, deals, result): TotalCashflowLedger` (判定を通った `TrendSourceRow[]`) |
| — | 月次値は `ledger.rows` を月・side・io で畳んで作る |
| — | `totalCashflowLedger(...)` を export し、推移はこれを数える |

判定式 (突合済み MF を積み増さない・要確認を入れない・除外 freee を入れない・`resolveTx` で事業/家計) は
変えていない。変えたのは「月で畳むタイミング」だけ。

副作用として、`resolveTx` を月ループの外で 1 回だけ呼ぶ形になった (前は `Map` で前計算していた)。
呼び出し回数は明細 1 件につき 1 回で、前と同じ。

### 2. 推移の集計は core の 1 か所だけ

- API (`routes/analytics.ts`) は `trendsScreen(...)` を呼んで返すだけ。
- 画面 (`Trends.tsx`) は応答を描くだけで、増減・構成比・寄与度を計算し直さない。
- 遷移先の分岐は `trendDrilldownHref` (core)。

### 3. 画面を役割単位へ分割し、重複表示を除いた

`Trends.tsx` は URL・取得・期間との同期だけを担うページコントローラへ縮小し、表示は
`pages/analysis/trends/` の条件、KPI、推移、詳細、カテゴリ、要因、旧Worker fallbackの各部品へ分割した。
チャートへ渡す意味は `view-model.ts` に集約し、DOM テストが系列名・種類・符号を直接検証する。

- 期間操作とページ見出しは共通 `Layout` / `AnalysisPage` に一本化し、画面内の重複を削除。
- 詳細ページ内の分析タブ列を削除し、ナビゲーションは左サイドバーに一本化。
- 旧画面の「事業/家計の推移」「ウォーターフォール」「旧パレート」は新しい推移・要因図と重複するため削除。
- 新比較画面から旧傾向判定を外し、新フィールドの無い旧Worker応答だけ `LegacyJudgement` へfallbackする。
- カテゴリ選択は `category + side`、比較欠損は `null`、パレート棒は符号付き、累計線は絶対寄与という責務を core と view-model に固定。

### 4. 期間・指標・読込の正本を一元化した

- `PeriodProvider` は保存値なしだけ直近1年を既定にし、利用者が保存した全期間は保持する。
- 指標の色・操作順・概要表示を `MetricDefinition` の `visualRole`・`controlOrder`・`showInOverview` へ置き、日本語label分岐と固定3件sliceを削除した。
- freee系4表の重複loaderを `packages/api/src/cashflow-sources.ts` へ抽出し、全routeが必須 `userId` を渡す。DB schema・migration・secretは増やしていない。
- `changeTone` をpure helperとしてKPI・表・主図差分・パレート・上位3で共有し、支出の減少と収入/純収支の増加を同じ意味色に揃えた。

## 整理の前後でテスト結果が同じ

`total-cashflow.ts` を組み替えた後も、総収支の既存テストは値を変えずに通る。

| テスト | 結果 |
|---|---|
| `packages/core/test/total-cashflow*.test.ts` | 緑 (期待値の変更なし) |
| `packages/api/test/total-cashflow*.integration.test.ts` | 緑 (期待値の変更なし) |
| `packages/core/test/trend-contract.test.ts` | 緑 (ファイル変更なし) |
| `packages/web/src/trends-scope.dom.test.tsx` | 緑 (rolling deploy 用の旧 Worker fallback だけを検証するよう更新) |
| `packages/api/src/analytics-period.test.ts` | 緑 (ファイル変更なし) |

件数は `test-run.md` を参照。期待値の更新は削除した重複表示ではなく、残すべき意味を固定している。

## 指標 id の文字列比較は 0 件

```
$ grep -nE "(===|!==|case)\s*'(income|expense|net)'" \
    packages/api/src/routes/analytics.ts \
    packages/web/src/pages/analysis/Trends.tsx \
    packages/web/src/pages/analysis/trends \
    packages/web/src/api.ts
(出力なし)
```

指標 id が現れるのは `packages/core/src/trend-metrics.ts` の `METRIC_DEFINITIONS` と
`DEFAULT_TREND_METRIC` だけ。`valueOf` の中の `row.io === 'income'` は取引の向きの比較で、指標 id の比較ではない。

## migration は 0042 のまま

```
$ ls migrations | tail -1
0042_total_cashflow_operations_and_exclusion_reason.sql
```

`git status` に `migrations/` の変更・追加は無い。
