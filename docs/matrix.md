# マトリックス画面

マトリックス (`/analysis/matrix`) は、科目 × 月の表で「どの月・どの科目に支出が偏っているか」を見つける画面です。

- 仕様の正本は [`specs/spec-expense-matrix-screen.md`](../specs/spec-expense-matrix-screen.md) です。
- 設計の根拠は `architecture/expense-matrix-*.md` にあり、ここには転記しません。
- この文書は、機能の見取り図と、運用・調査のときに最初に読む場所をまとめたものです。
- 見た目の正本は [`../design/FINAL-UI/images/06-matrix.png`](../design/FINAL-UI/images/06-matrix.png) です。

## 前提となる仕組み

集計の規約は **core の純関数 1 か所**が持ちます。画面は分母を持たず、順位を再計算しません。

| 何を決めるか | 正本 | 備考 |
|---|---|---|
| 未記帳月をどう扱うか | `packages/core/src/matrix-derived.ts` の `recordedIndexes` | 合計・平均・比率・濃淡のすべてがここを通る |
| 合計・平均 | 同 `matrixRowSummary` / `matrixColumnSummary` | 未記帳月を除いた月数で割る |
| 濃淡の分母 | `packages/core/src/heat-scale.ts` の `heatScaleOf` | 分母だけを持ち、色は持たない |
| 濃淡の階級値 | `packages/web/src/components/heatmap/heat-model.ts` の `heatIntensities` | 表示の概念 (色・不透明度) はこちら |
| 偏りが大きい 3 点 | `packages/core/src/matrix-derived.ts` の `matrixSkewTop` | 偏りの定義は `analysis.ts` の `zScores` だけを使う |

**同じ表から違う数字を出さない**ことがこの分担の目的です。以前は「大きく動いた科目」を画面ごとに違う定義で算出しており、増減マトリクス用の `matrixMovers` が `financial-chart-model.ts` に別途ありました。本サイクルでこれを削除し、偏りの算出経路を 1 本にしています。

## 1. 画面の構成

| 部品 | 内容 | 実装 |
|---|---|---|
| 色の凡例 | 増=赤・減=緑の向きと、符号・語による言い換え | `MatrixPage` の `ColorLegend` |
| モード切替 | 金額 / 前月比 / 前年同月比 の 3 つ | `MatrixPage` の `MODES` |
| CSV ダウンロード | `GET /api/export/matrix.csv` | `MatrixPage` |
| 偏りが大きい 3 点 | 順位・科目・月・金額・前月比・前年同月比 | `SkewTop3` (算出は core の `matrixSkewTop`) |
| 科目 × 月の表 | 行ヘッダ固定・横スクロール。金額モードだけ濃淡を塗る | `MatrixTable` → `HeatGrid` |
| 濃淡の凡例 | 階級の下限を実際の判定と同じ配列から引く | `MatrixTable` の `HeatLegend` |

## 2. 集計の規則

### 未記帳月 (§9.3)

未記帳は「使わなかった」ではなく「まだ記録していない」なので、**0 として数えません**。0 を混ぜると平均が下がり標準偏差が上がり、記帳済みの月がどれも平均より上に見えます。合計・平均・比率・濃淡のすべてから除外し、セルは空欄にします。

### 濃淡 (§3.3)

- 階級は **7 段**、分母は**表全体で共通**です。行ごとに取り直さないので、月をまたいで濃さを比べられます。
- 分母の対象は**本体セルだけ**です。合計行・平均行・合計列・平均列は入れません。総計は個々のセルより一桁大きいので、混ぜると本体セルが最下位階級へ潰れます。
- **合計を分母から外すのは表を組み立てる側の責務**です。`heatScaleOf` は渡された値の min/max を取るだけで、どの行が合計かを知りません。
- 濃淡を塗るのは**金額モードだけ**です。率モードに同じ分母は使えません。

### 偏りが大きい 3 点 (§5.1)

スコアは `max(月内偏り, 行内偏り) + max(0, 前月比)` です。同じ表を行方向に見れば行内偏り、列方向に見れば月内偏りになるので、軸ごとに別の式は要りません。

同点の決着は、**スコア → 金額 (降順) → 月 (新しい順) → 行 (仕様の固定順)** の順に見ます。

### 比較の相手がいないとき

- **前月比**: 直前の月が未記帳、または 0 のときは算出しません。
- **前年同月比**: 表の中に前年同月があればそれを、無ければ表示期間の外の実データを見ます (`matrixSkewTop` の `outside` 引数)。

## 3. 調べるときに読む場所

| 症状 | 見る場所 |
|---|---|
| 合計・平均が表の値と合わない | `matrix-derived.ts` の `recordedIndexes` を通っているか |
| 濃淡が全部薄い | 分母に合計行・合計列が混ざっていないか (`model.ts` の `body` の絞り込み) |
| 偏り 3 点の順位が画面ごとに違う | `matrixSkewTop` 以外で順位を出していないか |
| 表記が「マトリクス」になっている | `routeMetadata.ts` の `label` / `journeyHint` が正本 |

## 4. 本サイクルで実装していないもの

仕様 `specs/spec-expense-matrix-screen.md` のうち、次は**未実装**です。仕様を実装に合わせて緩めてはいないので、仕様側は記述を保っています。

| 未実装 | 仕様の該当 | 状況 |
|---|---|---|
| セルを選ぶと詳細パネルが出る | 受入 S2 | `HeatGrid` は `selected` / `onSelect` を props に持つが `MatrixTable` が渡していない |
| 選択セルの URL 復元 | 受入 5 | 上と同じ理由 |
| `GET /api/matrix` の `scope` / `axis` 拡張 | §9.1 | 画面は既存の `GET /matrix` を使っている |
| `GET /api/matrix/cell` (セル内訳) | §9.1 | 未着手 |
| 行の分類を「取引先」にする | §2.2 | 軸の切替が未実装 |

判断の経緯は [`matrix/spec-reflection-receipt.md`](matrix/spec-reflection-receipt.md) にあります。
