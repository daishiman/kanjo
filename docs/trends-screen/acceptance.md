# 推移画面 受入判定 (SYS-TRENDS-P07)

S1〜S5 は spec の成功基準、S6 は既存の test・typecheck・lint・視覚検査が緑のままであること。

| # | 判定 | 根拠 |
|---|---|---|
| S1 構成要素とトークン | PASS | web `trends-screen.dom.test.tsx` (目標の主要ブロック・8 列ヘッダー・初期 CTA・意味色・旧判定の非重複)。実描画検査は core / additional の各 11 条件で、はみ出し 0。`pnpm lint` 緑 |
| S2 値の一致と恒等式 | PASS | core 恒等式テスト (3 指標×3 範囲×2 比較対象)・`事業・家計・総合の月次値が monthlyTotalCashflow の同じ月と一致する`。api `総合・事業・家計の期間合計と要確認が GET /api/total-cashflow と一致する` |
| S3 指標の登録制 | PASS | core `テスト用の指標を 1 件足すと、分岐を書かずに系列と一覧へ現れる`。`visualRole`・`controlOrder`・`showInOverview` を登録表の正本にし、追加指標の選択値が主図へ現れる DOM 契約を固定。指標 id の文字列比較の grep 0 件 (`refactoring.md`) |
| S4 明細への遷移と URL 復元 | PASS | 初期詳細の `recommended` CTA と、選択後の `focus` CTA を別契約にした。MF / mixed は `/classify`、freee は月 query 付き `/analysis/total-cashflow`。web の初期 CTA・origin 別文言・選択バー・`category + side` URL、api の payee 完全一致で固定 |
| S5 規則の文書化と境界値 | PASS | `docs/trends-screen.md`。core `trend-comparison.test.ts` 20 件。`trend-contract.test.ts` 無変更で緑 |
| S6 既存ゲート | PASS | core 718 / api 608 / web 648、対象 DOM 33、typecheck・lint・build / Worker dry-run・実描画・preview smoke が緑。詳細は `test-run.md` と `assurance.md` |

Contract tests 10 項目はすべて `packages/api/test/trends-screen.integration.test.ts` と
`packages/api/src/analytics-period.test.ts` (読み取り回数の静的検査) で緑。
