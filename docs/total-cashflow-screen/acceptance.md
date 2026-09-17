# 総収支画面 受入条件の検証 (SYS-TCSCREEN-P07)

`docs/total-cashflow-screen/requirements-baseline.md` の AC-001..AC-006 を 1 件ずつ、
根拠となるテスト名またはコマンド出力と対にして記録する。

判定の原則: **緑であることは根拠にならない**。
「その規則を壊したときに落ちるテストがどれか」を書けたものだけを PASS とする。

## AC-001 画像の構成要素が全て描画され、色の直書きが 0 件

判定: **PASS**

| 構成要素 (05-total-cashflow.png) | 固定しているテスト |
|---|---|
| 見出し・説明・データの見方リンク | `total-cashflow-table.dom.test.tsx` の描画テスト群 |
| 5 タブと現在地 | `analysis-hub.dom.test.tsx` `不正な focus は既定 (照合) として扱う` |
| 総合/事業/家計のセグメント | `total-cashflow-table.dom.test.tsx` `選んだ区分の「N 件中 M 件」を出し、区分を変えると数も変わる` |
| KPI 3 枚と前年同期比 | 同 `前年同期がそろっていれば差額と率を、欠けていればその旨を出す` |
| 月次の棒 + 折れ線 | 同 `色は CSS 変数だけで渡し、描画の宣言へ直書きしない` |
| 判定作業 3 ペイン | `check:mobile-layout` の `total-cashflow-workbench` 測定 |
| freee 除外一覧・自動一致の候補 | `total-cashflow-verdict.integration.test.ts` の分割テスト |
| 9 列月次表の開閉 | `total-cashflow-table.dom.test.tsx` |

色の直書きが 0 件であることは `check:financial-figure` と
`chart-series-contract.test.ts` が固定している。前者は描画の宣言に `#` 始まりの色が
現れたら落ち、後者は系列色が `docs/design-system.md` のトークン名から来ていることを見る。

**壊したときに落ちること**: `TotalCashflow.tsx` の系列色を `'#4f8'` などへ直書きすると
`色は CSS 変数だけで渡し、描画の宣言へ直書きしない` が落ちる。

## AC-002 KPI が core と一致し、総合 = 事業 + 家計

判定: **PASS**

根拠: `packages/core/test/total-cashflow-screen-rules.test.ts`。
BR-004 (セグメント) と BR-006 (前年同期比) の節が、期間合計と月次系列の**両方**で
総合 = 事業 + 家計 を確認している。前年同期比は境界値付き:

- 前年同期が 0 → 率は出さず額だけ (0 除算を率 `Infinity` として出さない)
- 前年同期のデータが無い → 『比較データなし』

画面が core の値をそのまま出していることは `packages/web/src/api.ts` の
`TotalCashflowResponse` が core の型を再輸出していることで型検査が保証する。

## AC-003 単票・複数選択の 同じ/別/除外 と判定後の総額

判定: **PASS**

根拠: `packages/api/test/total-cashflow-verdict.integration.test.ts` (19 tests)。

- `3 つの内訳を足すと freee の総数になる` — 除外の前後で freee 全件の行き先が閉じる
- 除外 → 復元で `coverage` が元へ戻る
- 一括 (`freeeKeys`) で複数件を 1 リクエストで処理する
- **境界** (本 phase で追加): 集計語 5 語 / メモ 200 字 / 一括 200 件

判定後の総額が不変であること (BR-009) は、除外は freee 側の総額からだけ引き、
MF 側の公私仕分けには触れないという分割で担保している。
`coverage.matched + coverage.freeeOnly + coverage.excluded === coverage.freeeTotal` を
除外の前後で両方確かめているのがその検算にあたる。

## AC-004 取消で総額と件数が操作前と一致、再送は 1 回分、再読込後は導線なし

判定: **PASS**

根拠: `packages/api/test/total-cashflow-operations.integration.test.ts` (6 tests)。

| 見ていること | 期待 |
|---|---|
| 取消後の総額と判定件数 | 操作前と一致 |
| 同じ操作 id の再送 | 2 回目は 409。1 回分しか戻らない |
| 画面を開く前の操作 id | 404。古い表示から昔の操作を戻せない |
| 再読込後 | 操作履歴が空になり導線が出ない |

409 と 404 を分けているのが要点で、どちらも「戻らない」だが原因が違う。
利用者に出す文言と復旧手順は `docs/runbooks/total-cashflow-undo-conflict.md` に書いた。

## AC-005 規則が docs と境界値テストで固定され、サイドバーの現在地と照合バッジが一致

判定: **PASS**

規則の docs 化は `docs/total-cashflow-screen.md` (P12)。
数値が core の定数と一致することは同書の表で対応づけた。

境界値テスト:

| 規則 | テスト |
|---|---|
| BR-001 一致度の配点 | `total-cashflow-screen-rules.test.ts` の `duplicateMatchScore` 節 |
| BR-003 候補の日数差 3 日・上限 3 件 | 同 BR-003 節 |
| BR-005 除外後の数え方 | 同 BR-005 節 (候補 1 件と 2 件で挙動が分かれる) |
| reasonCode 5 語 | `total-cashflow-verdict.integration.test.ts` `集計語は許可した 5 語だけを受け、知らない語は弾く` |
| memo 200 字 | 同 `メモは 200 字ちょうどまで受け、201 字は弾く` |
| 一括 200 件 | 同 `一括は 200 件ちょうどまで受け、201 件は弾く` |

サイドバー: `packages/web/src/analysis-hub.dom.test.tsx` の
`照合と総収支の子行に、集約応答の要確認件数をそのまま出す` と
`要確認が 0 件の視点にはバッジを出さない`。
前者は照合 3 件・総収支 2 件を別々に出し、要確認を持たない視点 (matrix/trends/diagnosis) には
バッジが出ないことまで見ている。**このテストは本 branch で変更していない。**
decision-011 によりサイドバーは確認のみで、項目と並びを変えていないことの裏付けでもある。

## AC-006 pnpm test / typecheck / lint と web の check 系が緑

判定: **PASS**

実測値は `docs/total-cashflow-screen/test-run.md` と
`docs/total-cashflow-screen/assurance.md` に記録した。

## 05-total-cashflow.png との構成差分

意図して画像と違えた点。

| 箇所 | 画像 | 実装 | 理由 |
|---|---|---|---|
| 判定作業の表 | 7 列を横に並べる | 640px 以下で 1 行 = 1 カードへ畳む | 行ごとに『同じ取引/別の取引』を押す作業で、判定列が横スクロールの先にあると 1 件ごとに横送りが挟まる (P09 で `check:mobile-layout` が検出) |
| 3 ペイン | 常に横 3 列 | 900px 以下で縦積み | 375px では 1 列が 100px 台へ潰れる |
| 長い判定一覧 | ページ全体を送る | 中央一覧に高さ上限を設け、列名を上端に固定 | スクロール後も、各値が発生日・内容・金額・対応候補・一致度・判定のどれかを見失わない |
| 候補の並び | 指定なし | 一致度の降順 → 発生日 → id | 仕様が決めていないため実装側で決めた。**変更可**。利用者の指示があれば差し替える |

検算用の 9 列月次表と freee 取引の不変条件は、画像の主作業を重複させないよう初期状態で閉じた `details` に残す。
