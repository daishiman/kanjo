# マトリックス画面 — 仕様反映の受領書

- 記録日: 2026-09-18
- 対象ブランチ: `devgraph/feat-expense-matrix`
- base: `main`
- Beads: `kanjo-c6w` / `kanjo-mr0` / `kanjo-az2` / `kanjo-3o1` / `kanjo-cwr` / `kanjo-wid` / `kanjo-uhg` / `kanjo-lvr` / `kanjo-dyk` / `kanjo-b7f` / `kanjo-8qs` / `kanjo-gje` / `kanjo-8iy` (13 件、`dev-graph:SYS-MATRIX-P01`..`P13`)
- dev-graph node: `feat-expense-matrix`

## 何が変わったか (判定の入力)

1. **偏りの算出経路が 2 本あった**。`financial-chart-model.ts` の `matrixMovers` と、マトリックス画面の独自ロジックが、それぞれ違う定義で「大きく動いた科目」を出していた。前者を削除し、core の `matrixSkewTop` 1 本にした。
2. **未記帳月の扱いが散っていた**。合計・平均・比率・濃淡がそれぞれ別に判断していたものを、`matrix-derived.ts` の `recordedIndexes` 1 か所に集約した。
3. **濃淡の分母を持つ場所が無かった**。`heat-scale.ts` に `heatScaleOf` を新設し、表全体共通の 7 段の分母を core 側へ置いた。色は `heat-model.ts` に残した。
4. **濃淡の描画部品が画面ごとに別だった**。`components/heatmap/` に `HeatGrid` + `heat-model` として統合した。
5. **画面が 1 ファイルだった**。`pages/analysis/Matrix.tsx` を削除し、`pages/analysis/matrix/` へ `MatrixPage` / `MatrixTable` / `SkewTop3` / `model` に分割した。
6. **表記が揺れていた**。`routeMetadata.ts` の `label` と `journeyHint` を「マトリクス」から「マトリックス」へ統一した。
7. **`ExpenseScope` が web 側で再定義されていた**。core の型を import して re-export する形に変えた。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| system-spec | `system-spec/00-requirements-definition.md`、8 技術章、`index.md`、`spec-state.json`、`fetched-references.json` | 本サイクルの elicit → doc-fetch → compile を正規フローで通して再生成。前サイクル (照合画面) の確定成果物は `system-spec/archive/2026-09-16-reconciliation/` へ退避し `source_path` を付け替えた |
| specs | `specs/spec-expense-matrix-screen.md` (新規) | 画面仕様の正本。§3.3 濃淡、§5.1 偏り 3 点、§9.1 API、§9.3 未記帳月 |
| architecture | `architecture/expense-matrix-{ui-ux,frontend,backend,database,auth,security,infrastructure,maintenance-ops}.md` (新規 8 本) | 8 技術章に対応する設計判断。決定 1 (`zOf` 統一)・決定 2 (`scope=total` を今サイクル外)・決定 3 (`pages/analysis/matrix/` 分割)・決定 4 (`components/heatmap/` 統合) を記録 |
| architecture (graph) | `architecture/graph.json` | `.dev-graph/state/graph.json` からの投影。69 → 77 ノード |
| features | `features/feat-expense-matrix.md`、`features/feat-expense-matrix.context.json` (新規) | macro feature の purpose / goal / scope_in / scope_out / acceptance (S1..S5) |
| tasks | `tasks/feat-expense-matrix/sys-matrix-p01.md` .. `p13.md` (新規 13 本) | exact-13 package の task spec。各本の末尾に実装で確定した結果を追記した |
| docs | `docs/matrix.md`、`docs/matrix/evidence-index.md`、本受領書 (いずれも新規)、`docs/spec-v1.1.md`、`docs/ui-decisions.md` (更新) | 見取り図・証跡索引・判定の記録と、製品全体の正本への反映 |

## 既存 docs の扱い

**`docs/spec-v1.1.md` は更新した。** この文書は自ら「製品全体の目的・不変条件・画面/API一覧の正本」と宣言しており、過去の断面ではない。§4.1 の画面一覧の画面名 (「増減マトリクス」→「マトリックス」)、FR-03 の機能記述 (年計・前年比列 → 合計・平均の行列、7 階級の濃淡、偏り 3 点、未記帳月の除外)、§UI 規約のマトリックス行を実装に合わせ、機能固有の詳細は同文書が定める「規範 extension への一方向参照」として `docs/matrix.md` を指す形にした。

一方、HTML 版の由来を述べる箇所 (§1 背景、移行対応表、CSV 名) の「増減マトリクス」は**変えていない**。これは移植元の機能名であり、今の画面名ではない。

**`docs/ui-decisions.md` は追記した。** この文書は日付と機能名で節を足していく慣習を自ら持つ (「※…2026-08-30 に更新 (後述)」)。過去の節は書き換えず、2026-09-18 の節を末尾に足した。2026-09-15 に決めたタブ表示名「マトリクス」を「マトリックス」へ変えたことは、過去の決定の更新として明記した。

## 仕様を実装に合わせて緩めなかった点

`specs/spec-expense-matrix-screen.md` の受入 S2 (セル選択 → 詳細パネル → 明細遷移) と受入 5 (URL 復元)、および §9.1 の API 拡張 (`GET /api/matrix` の `scope`/`axis`、`GET /api/matrix/cell`) は**未実装**である。

`packages/api/` の差分は 0 行で、`MatrixPage` は既存の `GET /matrix` をそのまま呼んでいる。`HeatGrid` は `selected` / `onSelect` を props に持つが `MatrixTable` が渡していない。

**仕様側の記述は削っていない。** 実装が仕様に追いついていない状態をそのまま残し、残課題として次に回す。仕様を実装に合わせて書き直すと「何が未達か」が読めなくなる。

## 検証結果

| 検査 | 結果 |
|---|---|
| `pnpm lint` (10 項目の `&&` チェーン) | 全 PASS。`Checked 438 files`、`check-graph-lineage: 77 ノードすべてが正本と一致`、`公開文書の実データ参照チェック: OK` |
| `pnpm typecheck` | core / api / web すべて Done |
| `pnpm --filter @kanjo/core exec vitest run` | Test Files 44 passed / 1 skipped、Tests 658 passed / 6 skipped |
| matrix 系 web テスト | Test Files 6 passed、Tests 42 passed |
| `validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-expense-matrix` | `status: pass`、`violations: []`、P01..P13 exact 13 |
| ローカル実機 | `wrangler dev --local` (8788) で `/analysis/matrix` が 200 |

## Beads の状態

| 状態 | 課題 |
|---|---|
| closed | `kanjo-c6w` (P01 要件ベースライン)、`kanjo-mr0` (P02 設計決定)、`kanjo-az2` (P03 独立レビュー) |
| in_progress | `kanjo-3o1` (P04 失敗テスト先行 — API 契約テスト未作成)、`kanjo-cwr` (P05 実装 — API 拡張未着手)、`kanjo-uhg` (P07 受入検証 — S2 未達)、`kanjo-dyk` (P09 保証確認 — JS バンドル予算が未実測) |
| open | `kanjo-wid` (P06)、`kanjo-lvr` (P08)、`kanjo-b7f` (P10)、`kanjo-8qs` (P11)、`kanjo-gje` (P12)、`kanjo-8iy` (P13) |

**P06 / P08 / P10 / P11 / P12 の作業内容そのものは完了している** (テスト実行記録・重複経路の除去・最終レビュー・証跡索引・docs 同期)。それでも open のままなのは、`bd` の依存 DAG が上流の未完了を理由に close を拒むためである。

```
cannot close kanjo-wid: blocked by open issues [kanjo-cwr]
```

`--force` で上書きはしていない。**このブロックは正しい**。P05 (API 拡張) が本当に未完なので、その下流を done にすると「feature が完了した」という誤った信号になる。作業が済んだことは各 task 仕様書の「実装で確定した結果」に残し、tracker 上は feature 未完として見えるままにした。

## main の取り込み (2026-09-18)

本ブランチは照合サイクル (230baaa) から分岐しており、その後 main に総収支 (PR #55) と推移 (PR #56) の 2 サイクルが積まれた。`origin/main` = ローカル `main` = `9a8bd28` で、リモートからローカル main への取り込みは差分 0 (no-op) だった。そこから本ブランチへマージし、衝突 17 件を解決した。

| 衝突 | 解決 |
|---|---|
| `system-spec/` 直下 12 件 | 直下は「現行 1 世代」の運用なので、main 側 (推移サイクル) を `system-spec/archive/2026-09-17-trends-screen/` へバイト単位で退避し、直下はマトリックスサイクルを載せた。`arch-trends-screen-*` 8 ノードの `source_path` を退避先へ付け替え、複製なので `source_digest` は 1 件も打ち直していない |
| `system-spec/archive/2026-09-16-reconciliation/README.md` (add/add) | 両系列が独立に同じ退避を行っていた。README 以外の 13 ファイルはバイト単位で同一だったため、経緯を統合した 1 本にまとめた |
| `architecture/graph.json` | ノード集合の和を取った (85 + 77 → 93)。`arch-tax-preparation-boundary` は本サイクルで打ち直した digest を採用 |
| `scripts/hooks/guard-real-data.sh` | 両方の意図を残した。main の「実測した時刻」除去 (`audited`) が無いと、本サイクルの premise 絞り込みだけでは判定行が空になり検査が空振りする |
| `packages/web/src/components/ReportChart.tsx` | 本サイクルの `HeatGrid` 置き換えを採り、main が足した `data-table-kind` / `data-sort-reason` は置き換え先の `heat-grid.tsx` へ移した。`table-sort-coverage` が「無言でソート対象外になっている表」を禁じているため、移送しないと落ちる |
| `packages/web/src/analysis-navigation.integration.dom.test.tsx` | 表記 (マトリックス) と main の `LAZY_WAIT` の両方を取り込んだ |

マージ後の検証: `pnpm lint` 全 10 項目 PASS (`check-graph-lineage: 93 ノードすべてが正本と一致`)、`pnpm typecheck` 3 パッケージ Done、`packages/web` のテスト 85 ファイル 695 件 PASS。

## 残課題

1. 受入 S2 / 受入 5: セル選択 → 詳細パネル → 明細遷移と URL 復元。α (偏りが見えても明細に降りられない) の本体。
2. §9.1 の API 拡張: `GET /api/matrix` の `scope` / `axis`、`GET /api/matrix/cell`。
3. §2.2 の軸切替 (科目 / 取引先)。
4. 決定 2 により `scope=total` は今サイクル外。
