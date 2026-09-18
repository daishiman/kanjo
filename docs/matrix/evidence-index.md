# マトリックス画面 — 証跡索引

タスク仕様書 `tasks/feat-expense-matrix/sys-matrix-p01.md` .. `p13.md` が名指しする 10 本の証跡の所在。

MVP のため個別ファイルへは分割せず、**既に正本があるものはポインタ**、**他にどこにも無いもの (受入判定・保証確認・リリースノート) はこの索引が本体**とした。名前だけのファイルを 10 本置くと、正本が二重になって片方だけ古くなる。

| 名前 | 要求元 | 所在 |
|---|---|---|
| `requirements-baseline.md` | P01, P02, P03, P04, P07 | `specs/spec-expense-matrix-screen.md` (仕様の正本) と `features/feat-expense-matrix.md` (受入 S1..S5) |
| `design-decisions.md` | P02, P03, P04, P05, P12 | `architecture/expense-matrix-*.md` 8 本 (決定 1..4) |
| `design-review.md` | P03, P08 | `.dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json` (evaluator: `system-dev-plan-evaluator`) |
| `aggregation-rules.md` | P12 | [`../matrix.md`](../matrix.md) の「2. 集計の規則」 |
| `test-run.md` | P06, P07, P10, P11 | 下記「1. テスト実行記録」 |
| `acceptance.md` | P07, P08, P09, P10, P11 | 下記「2. 受入基準の判定」 |
| `quality-assurance.md` | P09, P10, P11 | 下記「3. 保証確認」 |
| `final-review.md` | P10, P11, P13 | [`spec-reflection-receipt.md`](spec-reflection-receipt.md) |
| `evidence-index.md` | P11, P12, P13 | 本ファイル |
| `release-notes.md` | P13 | 下記「4. リリースノート」 |

## 1. テスト実行記録

| 検査 | 結果 |
|---|---|
| `pnpm lint` | 全 10 項目 PASS。`Checked 438 files in 305ms`、`check-graph-lineage: 77 ノードすべてが正本と一致`、`公開文書の実データ参照チェック: OK` |
| `pnpm typecheck` | core / api / web すべて Done |
| `pnpm --filter @kanjo/core exec vitest run` | Test Files 44 passed / 1 skipped (45)、Tests 658 passed / 6 skipped (664) |
| matrix 系 web テスト | Test Files 6 passed、Tests 42 passed |
| `validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-expense-matrix` | `status: pass`、`violations: []`、P01..P13 exact 13、`validated_digest: sha256:8cde5b2e…` |

`pnpm lint` は `&&` チェーンなので、最初の失敗より後ろは走らない。全 10 項目の通過を個別に確認している。

## 2. 受入基準の判定

`features/feat-expense-matrix.md` の acceptance に対する判定。

| | 内容 | 判定 | 根拠 |
|---|---|---|---|
| S1 (G1) | 構成要素がすべて描画され、直書き色の lint 違反 0 件 | **達成** | `matrix-visual.dom.test.tsx` / `matrix-legend.dom.test.tsx`、`check-design-tokens` PASS |
| S2 (G2) | 任意のセルを選ぶと詳細パネルと下部バーが同じ数値を示し、明細へ遷移できる | **未達** | `MatrixTable` が `HeatGrid` へ `selected` / `onSelect` を渡していない。API 側 (`GET /api/matrix/cell`) も未着手 |
| S3 (G3) | 偏り 3 点の選定規則が docs に明記され、境界値テストで固定されている | **達成** | [`../matrix.md`](../matrix.md) の「偏りが大きい 3 点」、`matrix-derived.test.ts` の同点・窓外・未記帳の境界値 |
| S4 (G4) | 2×2 のどの組合せでも合計・平均が一致する | **部分達成** | 合計・平均は `matrixRowSummary` / `matrixColumnSummary` の単一経路で算出し、総計も合計列の和として 1 経路で出している。ただし `scope` 切替は決定 2 により今サイクル外、`axis` 切替は未実装なので、実際に確認できた組合せは既定の 1 つ |
| S5 (G5) | 共通シェルの差分が表記統一のみで、`pnpm test` が全件緑 | **達成** | サイドバー・ヘッダー・フッターの差分は `routeMetadata.ts` の `label` / `journeyHint` の「マトリクス」→「マトリックス」のみ |

## 3. 保証確認

| 観点 | 結果 |
|---|---|
| アクセシビリティ | 表は行ヘッダを `<th scope="row">` で持ち、濃淡は色だけでなく数値と凡例で伝える。色覚の異なる利用者が濃淡の順序だけで判断しないよう、セルは金額を常に表示する |
| 入力検証 | 本サイクルで API を変更していないため、既存の `GET /matrix` の検証をそのまま使う |
| 応答上限 | 同上。新しいクエリ経路を足していない |
| JS バンドル予算 | **達成**。`pnpm --filter @kanjo/web build` の `check:js-budget` が `初期JS budget: 102.95KiB / 110KiB` (CI 実測 103.45KiB、run 35291470851 で緑)。当初は CI で 110.28KiB の超過だった。経緯と対処は [`spec-reflection-receipt.md`](./spec-reflection-receipt.md) の「JS バンドル予算の超過と是正」に記録した |

## 4. リリースノート

**支出分析 > マトリックス画面を作り直した。**

- 科目 × 月の表で、金額の大きさを 7 段階の濃淡で示すようにした。濃さの基準は表全体で共通なので、月をまたいで比べられる。
- 「偏りが大きい 3 点」を表の上に出すようにした。順位の付け方は 1 か所の規則に従う。以前は画面ごとに違う定義で「大きく動いた科目」を出していた。
- まだ記録していない月を 0 として数えないようにした。合計・平均・比率・濃淡のすべてに効く。
- 表記を「マトリクス」から「マトリックス」へ統一した。

**まだできないこと**: セルを選んでその中身の明細へ降りること。表示する軸を科目から取引先へ切り替えること。
