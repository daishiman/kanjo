# 推移画面 設計判断 (SYS-TRENDS-P02)

## 構造

```
D1 (既存の表だけ)
  ├─ loadScoped → Dataset (all / 期間で切った data)
  └─ loadCashflowSources → freee_deals / duplicate_verdicts / freee_deal_exclusions / mf_tx_exclusions
        │
        ▼
core: totalCashflowLedger(all, deals, verdicts, exclusions, mfExcludedTxIds)
        │   総収支の判定 (消し込み・除外・要確認) を通った TrendSourceRow[] と要確認の明細
        ├──────────────► monthlyTotalCashflow / totalCashflowReport (総収支画面)
        ▼
core: trendsScreen({ all, ...sources, range }, { scope, metric, compare, month, category, payee })
        │   METRIC_DEFINITIONS で指標を引き、今回・比較期間を同じ行集合から切る
        ▼
api: GET /api/trends = { ...trendsReport(data, LEGACY_SCOPE[scope]), period, ...screen }
        ▼
web: Trends.tsx (URL 状態 → クエリ → 画面)
```

総収支画面と推移画面が **同じ `totalCashflowLedger` を経由する**ことが中心の判断。
総収支の月次値 (`rowsFrom`) を行集合 (`ledgerFrom`) から畳む形へ組み替え、
推移はその行集合を指標で数える。2 画面が別の選別を持たないので、期間合計は構造上一致する。

## 追加した型 (packages/core)

| 型 | 置き場所 | 中身 |
|---|---|---|
| `TrendSourceRow` | `total-cashflow.ts` | month・side・io・category・payee・amount・origin・account (空は null)・txId |
| `TotalCashflowLedger` | `total-cashflow.ts` | months・rows・shifted・review |
| `MetricDefinition` | `trend-metrics.ts` | id・label・betterWhen・valueOf・breakdownAxis |
| `TrendsSelection` | `trend-metrics.ts` | 解決後の scope・metric・compare・month・category・side・payee |
| `TrendComparePeriod` | `trend-metrics.ts` | 比較期間の from/to とラベル |
| `TrendSeries` / `TrendMetricSeries` | `trend-metrics.ts` | 指標ごとの今回・比較の月次値と、選んだ指標の月次差 |
| `TrendKpis` | `trend-metrics.ts` | current・change (basis 付き)・peakMonth |
| `TrendDetail` / `TrendDriver` / `TrendSourceSummary` | `trend-metrics.ts` | 選択月の値・要因上位 3・出典 |
| `TrendCategoryRow` / `TrendPayeeRow` | `trend-metrics.ts` | カテゴリ行と取引先行 (origin 付き) |
| `ChangeParetoRow` | `trend-metrics.ts` | 増減額の絶対値の降順と累計構成比 |
| `TrendReviewSummary` | `trend-metrics.ts` | 要確認の count・amount・monthCount・monthAmount |
| `TrendFocus` | `trend-metrics.ts` | 選択バーの表示内容と遷移先 href |

## 判断

| # | 判断 | 理由 |
|---|---|---|
| AD-1 | 指標は `METRIC_DEFINITIONS` の配列で持ち、`find` で引く | オブジェクトのキー引きだと `constructor` 等が当たる。配列の完全一致なら任意のキーを評価しない |
| AD-2 | 未登録の metric だけ 400、それ以外の誤りは既定値へ倒す | 古いブックマークで画面が出なくなるのを避ける (loadScoped と同じ方針)。metric の誤りだけは黙って支出に倒すと別の数字を見せてしまう |
| AD-3 | 要確認の件数と金額は `totalCashflowReport` の `reviewCount`・`reviewAmount` と同じ集合 (`ledger.review`) から、`sumAbs` で数える | 総収支画面の帯と同じ数字にするため |
| AD-4 | `previousYearPeriod` は既存の `packages/core/src/period.ts` を使う | 期間の計算を 1 か所に保つ |
| AD-5 | 全期間 (`range` が null) では `comparePeriod: null`、`compareUnavailable: 'all_period'`。KPI の増減は `basis: 'peak_month_mom'` | 全期間の「前期間」はデータの外になり、比べる意味が無い |
| AD-6 | 応答の `scope` は旧名 (`all`/`biz`/`personal`) のまま、新名は `selection.scope` | 既存の画面・テストが旧名を読んでいる |
| AD-7 | 傾向の判定は `trendsReport(data, LEGACY_SCOPE[scope])` のまま、`judgementBasis: 'mf_only'` | 既存の検定結果を変えない (dec-trends-judgement-source-001) |
| AD-8 | freee 系 4 表の読み取りは `analytics.ts` の `loadCashflowSources` に置く | `routes/total-cashflow.ts` が `loadScoped` を import しており、逆向きに import すると循環する |
| AD-9 | 取引先の遷移先は `trendDrilldownHref` (core) が決める | MF と freee の分岐を画面に書かない |
| AD-10 | 画面固有の CSS は `trends.css` に分け、色はトークンだけを使う | S1 の直書き色 0 件を DOM テストで検査できる |

## 変えなかったもの

- D1 のスキーマ (migration は 0042 のまま)。
- `trend.ts` の傾向判定と `trend-contract.test.ts`。
- `total-cashflow.ts` の消し込み・除外・要確認の判定 (行集合への組み替えだけで、判定式は同じ)。
