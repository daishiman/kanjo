# 推移画面 設計レビュー (SYS-TRENDS-P03)

`architecture-decision.md` を実装前に読み、spec と architecture 8 ノード
(`architecture/trends-screen-*.md`) に照らして指摘を出した。
severity は high (数字が食い違う・データが漏れる)、medium (契約や互換が崩れる)、low (読みやすさ・運用) の 3 段。

## 指摘

| # | severity | 指摘 | 解消 |
|---|---|---|---|
| DR-1 | high | 推移が MF の Dataset から別に数えると、消し込み・除外・要確認が推移だけに反映されず、総収支画面と合計が食い違う | 総収支の月次値を `totalCashflowLedger` の行集合から作る形へ組み替え、推移も同じ行集合を数える (AD-3)。一致はテストで固定 |
| DR-2 | high | 要確認の件数と金額を推移側で数え直すと、総収支画面の帯と数字がずれる | `ledger.review` から `sumAbs` で数える。API テストで `GET /api/total-cashflow` と突き合わせる |
| DR-3 | medium | 指標をオブジェクトのキーで引くと `metric=constructor` などが通る | 配列の `find` で完全一致 (AD-1)。未登録は 400 `invalid_metric` |
| DR-4 | medium | 応答の `scope` を新名へ変えると既存画面と `trends-scope.dom.test.tsx` が壊れる | 旧名のまま返し、新名は `selection.scope` に置く (AD-6) |
| DR-5 | medium | 傾向の判定を新しい行集合で計算し直すと、`trend-contract.test.ts` の検定結果が変わる | `trendsReport` に MF の Dataset を渡したまま。`judgementBasis: 'mf_only'` を返し、見出しに基準を出す (AD-7) |
| DR-6 | medium | freee 系 4 表を `routes/total-cashflow.ts` の読込関数から借りると import が循環する | `analytics.ts` に `loadCashflowSources` を置く (AD-8)。読み取り回数は静的検査で固定 |
| DR-7 | medium | 全期間で「前期間」を作ると、データの外の月と比べて増減が全額になる | `comparePeriod: null` と `basis: 'peak_month_mom'` (AD-5) |
| DR-8 | medium | `payee` を部分一致で扱うと、似た名前の取引先の明細まで混ざる | 取引先行・`/classify` とも完全一致。既存の検索 `q` とは別のクエリ |
| DR-9 | low | freee の口座が空の行を「—」のまま口座別件数に入れると、存在しない口座が 1 件として並ぶ | `account: null` にして口座別の件数から外す |
| DR-10 | low | MF と freee の遷移先の分岐を画面に書くと、行の種類が増えるたびに画面を直すことになる | `trendDrilldownHref` を core に置く (AD-9) |
| DR-11 | low | 取引先名を `innerHTML` で描くと、取込データ経由でスクリプトが入りうる | React のテキストとして描く。応答は JSON だけ |

high 2 件・medium 6 件はすべて解消済み。**未解消の high / medium は 0 件。**

## 4 点を固定するテスト

| 観点 | テスト |
|---|---|
| 総収支 API との一致 | core `trend-metrics-contract.test.ts` › `事業・家計・総合の月次値が monthlyTotalCashflow の同じ月と一致する` / api `trends-screen.integration.test.ts` › `総合・事業・家計の期間合計と要確認が GET /api/total-cashflow と一致する` |
| 要確認の件数 | core `trend-comparison.test.ts` › `1 件以上なら件数と金額を返し、数値には含めない`・`0 件なら 0` / api › `要確認が 0 件の期間では review.count が 0` |
| 口座が空の行 | core › `口座が空の freee 行は account null で、口座別の件数に数えない` / api › `口座が空の freee 行は detail.sources で account null になる` / web `trends-screen.dom.test.tsx` › `詳細パネルは要因の説明文・出典 (口座が無ければ —)・要確認の件数を出す` |
| 全期間の扱い | core › `全期間では比較を作らず、増減は最も変化が大きい月の前月差` / api › `全期間では comparePeriod が null、増減は最も変化が大きい月の前月差` / web › `全期間では比較対象を押せず、その旨を出す` |
