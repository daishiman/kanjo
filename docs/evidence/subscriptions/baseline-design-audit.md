# サブス画面 — 統合前デザイン監査

- 実施: 2026-09-18
- 対象: 隔離した local D1 に `samples/` の匿名 fixture だけを投入した `/subscriptions`
- 比較の正本: [`design/FINAL-UI/images/09-subscriptions.png`](../../../design/FINAL-UI/images/09-subscriptions.png) (1024×1536)
- 目的: 並列実装を統合する前の baseline を固定する。本文書は最終 PASS 証跡ではない。

## 証跡

| 状態 | 証跡 |
|---|---|
| 参照 (左) / baseline (右) 同寸比較 | [`baseline-comparison-1024x1536.png`](baseline-comparison-1024x1536.png) |
| baseline 1024×1536 | [`baseline-1024x1536.png`](baseline-1024x1536.png) |
| 詳細を開いた baseline 1024×1536 | [`baseline-detail-1024x1536.png`](baseline-detail-1024x1536.png) |
| 1280×1000 | [`baseline-1280x1000.png`](baseline-1280x1000.png) |
| 375×1000 | [`baseline-375x1000.png`](baseline-375x1000.png) |
| 768×1000 | [`baseline-768x1000.png`](baseline-768x1000.png) |
| 1600×1000 | [`baseline-1600x1000.png`](baseline-1600x1000.png) |
| DOM 寸法・API 要求・console の機械記録 | [`baseline-audit.json`](baseline-audit.json) |

## 結論

baseline は機能要素を持つが、参照画面の「一覧から 1 件を選び、1 つの詳細で根拠確認から判断まで完結する」主導線が弱い。1024px では候補カードの反復が画面高を使い、推移と年換算比較が first viewport から外れる。最小改善は、一覧と詳細に操作の正本を集約し、候補カードを根拠と詳細導線に限定することである。

## 優先所見

### P1 — 必ず改善

1. **1024px の主作業領域が狭い**
   - 証跡: [`baseline-comparison-1024x1536.png`](baseline-comparison-1024x1536.png)
   - baseline の `.subs` 幅は 725px。一覧と右レールの両方が窄く、一覧はほぼ横スクロール前提になる。参照のように「一覧を比較できる幅」と「1件の詳細」を同時に保つ grid 配分が必要。

2. **候補表示と判断操作が反復し、分析を押し下げる**
   - 証拠: [`baseline-1024x1536.png`](baseline-1024x1536.png)
   - 右レールは 5 候補×3 操作=15 個の操作を持つ。候補カードは「理由+詳細を開く」に限定し、採用・除外・確認の正本は選択中の詳細へ一本化する。

3. **一覧と詳細の選択概念が二重に見える**
   - 証拠: [`baseline-detail-1024x1536.png`](baseline-detail-1024x1536.png)
   - 一覧行の選択は「詳細を開く」、詳細内のチェックは「生の取引名を統合する」と目的が異なる。一覧は行選択のみ、複数選択は詳細内の生取引名のみとし、下部バーの対象を一意にする。

4. **期間と KPI の意味が baseline で衝突する**
   - 証拠: [`baseline-1280x1000.png`](baseline-1280x1000.png)
   - 月額・年換算が 0 円の一方、直近 12 か月は 159,960 円となる。参照の明示期間と同様に、対象期間の終了月と「月額」の基準月を画面で追跡できる表示にする。データ未記録月を 0 円と見なすかは仕様の正本と再照合する。

### P2 — 統合後に確認

1. **768px で header 下の空白が過大**
   - 証拠: [`baseline-768x1000.png`](baseline-768x1000.png)
   - コントロール群の折り返し後も header 高が大きく残る。折り返し時の row-gap と固定高をなくし、本文開始を早める。

2. **375px は横には収まるが、意思決定までの縦移動が長い**
   - 証拠: [`baseline-375x1000.png`](baseline-375x1000.png)
   - 文書全体の `scrollWidth === clientWidth` で横はみ出しはない。ただし KPI 5 枚から一覧・詳細への距離が長いため、mobile では KPI の要約化または水平スクロール化を最終判定する。

## 予備検査

- 1024 / 1280 / 375 / 768 / 1600 のすべてで文書全体の横スクロールはない。表は意図した内部スクロール。
- baseline 撮影中の console entry は 0 件。
- 参照と baseline の同寸比較は実施済み。色・余白・シェルの値は画像から推定せず、既存 design token を正本とする。
- screenshot だけで WCAG 適合を宣言せず、最終ゲートでキーボード操作・focus・エラー状態を別に確認する。
