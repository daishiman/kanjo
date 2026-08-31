# P01 財務 figure inventory

- 結果: PASS
- 対象: `packages/web/src` の財務 chart / figure / KPI / 高密度表
- 調査コマンド:
  - `rg -n "Chart|financial-figure|report-chart|canvas|table className" packages/web/src`
  - `rg -n "overflow-x|chart-shell|safe-area|tabbar" packages/web/src/styles.css`
- 匿名性: source 構造だけを調査し、実明細・口座・金額・secret は使用していない。

## 要求基線

モバイル利用者が移動中に片手で見る場面を基準に、第一階層を「結論、期間・単位、異常、次の確認先」へ絞る。正確な系列値は消さず、同じ表示 model から作る semantic table を段階的に開示する。高密度表は突合・比較のため表形式を維持し、document ではなく見出し付きの局所領域だけを横スクロールさせる。

## figure inventory

| route / source | figure | 現行の七要素（見出し / 結論 / 期間 / 単位 / series / 次の行動 / semantic table） | 狭幅 risk | 受入対応 |
|---|---|---|---|---|
| `/` / `pages/Overview.tsx:139` | 売上・経費・移動平均・防衛ライン | 見出し○、結論△、期間△、単位△、series○、行動△、表× | canvas が card 直下で高さ契約なし。4 series の凡例と月 tick が競合 | 共通 figure、明示 chart host、同一 model 表、モバイル凡例 |
| `/household` / `pages/Household.tsx:230` | 月別収入・支出 | 見出し○、結論△、期間△、単位△、series○、行動△、表△（別計算の隣接表） | Chart の semantic companion がなく canvas 操作へ依存 | 月別 balance の同一 model 表と結論を常設 |
| `/subscriptions` / `pages/Subscriptions.tsx:170` | ベンダー別月次積み上げ | 見出し○、結論△、期間△、単位△、series○、行動○、表△（別集計） | series が多く凡例・tooltip がモバイルで高負荷 | 上位情報を結論へ集約、全 series は折返し凡例と表へ保持 |
| `/analysis/trends` / `pages/analysis/Trends.tsx:150` | 事業・家計の月別内訳 | 見出し○、結論○、期間△、単位△、series○、行動○、表○（別 view） | chart と表の値生成経路が別で意味 parity を検査できない | chart/table 共通 model 化 |
| `/analysis/trends` / `pages/analysis/Trends.tsx:273` | 前半→後半の増減寄与 | 見出し○、結論○、期間○、単位△、series△、行動○、表○（別 view） | 長い科目名と横棒の親寸法、色の意味 | 符号と文言を伴う series、局所 scroll/table |
| `/analysis/trends` / `pages/analysis/Trends.tsx:338` | 支出パレート | 見出し○、結論○、期間△、単位△、series○、行動○、表× | 二軸 chart を canvas だけで解釈する必要 | 円/% の列を持つ semantic table、series 文言 |
| `/analysis/matrix` / `components/FinancialCharts.tsx:83` | 直近2記帳月の増減上位 | 見出し○、結論△、期間○、単位○、series○、行動○、表△（下部の全表） | 固定 chart shell と科目ラベルの長さ。増減色の誤読 | 共通 figure、符号付き要約、同一 mover rows 表 |
| `/statements` / `components/FinancialCharts.tsx:142` | 月別 P/L | 見出し○、結論△、期間△、単位△、series○、行動○、表△（別帳票） | 混合 bar/line の意味が canvas に集中 | P/L adapter と semantic table |
| `/statements` / `components/FinancialCharts.tsx:194` | 利益と営業 CF | 見出し○、結論△、期間△、単位△、series○、行動○、表△ | 2 series の差が tooltip 依存 | 差の結論と同一 model 表 |
| `/statements` / `components/FinancialCharts.tsx:227` | 営業 CF 累計 | 見出し○、結論△、期間△、単位△、series△、行動○、表× | 面 chart の正負と期間が視覚依存 | 正負結論、期間、累計表 |
| `/statements` / `components/FinancialCharts.tsx:272,301` | B/S 均衡または負債超過 | 見出し○、結論○、期間○、単位△、series○、行動△、表× | 分岐ごとの DOM 契約が不統一 | 同一 balance model から両分岐を描画 |
| `/ai` / `components/ReportChart.tsx:250` | AI report catalog（line/bar/stacked/waterfall/pareto/band/heatmap） | 見出し○、結論△、期間△、単位△、series△、行動○、表△（heatmap のみ） | kind ごとの canvas/heatmap 差、report 内の横あふれ | 全 kind を共通 figure semantic contract へ接続 |

## 高密度表 inventory

| route | source | 用途と形式判断 | モバイル契約 |
|---|---|---|---|
| `/` | `Overview.tsx:226` | 科目の累計/構成比を突合する表 | `.scroll-x` 内だけ scroll、見出しを直前に維持 |
| `/household` | `Household.tsx:138,248,361,410,477,592` | 事業/個人、月別、内訳の比較・突合 | `stack-sm` は意味単位カード、列比較が必要な表だけ局所 scroll |
| `/subscriptions` | `Subscriptions.tsx:109` | ベンダー金額の縦比較 | mobile card contract + 元表 semantic を維持 |
| `/analysis/trends` | `Trends.tsx:116,189,294` | 区分比較、優先順位、寄与の突合 | 行内の第一階層を科目/行動/キー数値へ絞り、詳細は開示 |
| `/analysis/matrix` | `Matrix.tsx:126` | 科目×月の大量比較（表が最速） | 科目列を固定し、月列だけ局所 scroll。document overflow 禁止 |
| `/statements` | `Statements.tsx:129,255,423,606` | 帳票の正確な金額照合 | 帳票意味を維持した card/局所 scroll、単位を見出しに保持 |
| `/ai` | `ReportChart.tsx:197`, `Ai.tsx` | report heatmap/根拠の照合 | report figure 内の局所 scroll と semantic caption |

## CSS 基線

- `.chart-shell` は存在するが全 page chart へ適用されていない。
- `.scroll-x` / `.heatmap-scroll` は局所 overflow を持つ一方、figure 見出し・edge affordance の共通契約はない。
- mobile `.tabbar` と `env(safe-area-inset-bottom)` の本文 padding は既にあるため、これを壊さず figure/table の末尾へ適用する。
- 既存 `stack-sm` card 化を保持する。比較・突合で表が速い matrix/statement は無理にカードへ崩さない。

## 判定

全対象 route、12 figure 種、主要高密度表を受入条件へ trace できた。未分類の重大対象は 0 件。P02 へ進める。
