# 決算書画面 — 仕様反映の受領書

- 記録日: 2026-09-21
- 対象ブランチ: `devgraph/feat-statements-screen`
- base: `main`
- Beads: epic `kanjo-oju` + `kanjo-oju.1` .. `kanjo-oju.13` (13 件、`dev-graph:SYS-STMT-P01`..`P13`)
- dev-graph node: `feat-statements-screen`

## 判定: 仕様・設計への影響は「あり」

決算書画面の作り直しは、見た目だけでなく次の 3 点で契約を変えている。そのため `system-spec/`・`specs/`・`architecture/` へ正規フローで反映した。

1. **決算書の数字の出どころを 1 本にした**。画面ごとに `pl` / `cf` / `bs` を別々に呼んでいたのをやめ、core の `statementsScreen(...)` が段階損益 5 行・CF の可否と原因・BS の 3 状態をまとめて導く。API も画面 1 枚ぶんを返す `screen` 経路を足した (既存の `pl` / `cf` / `bs` は残す)。恒等式 (`売上総利益 = 売上高 − 売上原価` など) が全月と合計で閉じることを core のテストが固定する。
2. **負債の手入力に「3 状態」という新しい状態を追加した**。従来は「行がある = 金額あり」だけで、**0 円と未入力が区別できなかった**。`balance_entries` に `status` 列を足し (migration `0046_liability_status.sql`)、`amount` / `zero` / `unset` の 3 つを持つ。あわせて金額を残さない `liability_audit_log` を新設し、`PUT /api/balances/liabilities` の本文形とエラー (400 / 409 `liability_owned_by_import` / 413) を契約として定めた。DB スキーマと API 契約が増える。
3. **画面の問いと構成を変えた**。3 つの計算書をタブで隠すのではなく 1 画面に並べ、`?tab=` / `?row=` / `?ref=` で見ている場所を URL に残す。問いは「損益・現金・残高の 3 つは、互いに整合していますか？」。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| system-spec | `system-spec/00-requirements-definition.md`、8 技術章、`index.md`、`spec-state.json`、`fetched-references.json`、`completeness-findings.json` | 本サイクルの elicit → doc-fetch → compile を正規フローで通して再生成 |
| system-spec (退避) | `system-spec/archive/2026-09-19-household-screen/` (13 章 + README) | 直下にあった家計収支画面の世代を丸ごと退避 |
| specs | `specs/spec-statements-screen.md` (新規) | 画面仕様の正本。受入基準 S1-S5・業務規則・API 契約・§6 の検算済みフィクスチャ |
| architecture | `architecture/statements-{auth,backend,database,frontend,infrastructure,maintenance-ops,security,ui-ux}.md` (新規 8 件) | 章別の設計 |
| architecture (graph) | `architecture/graph.json` | `arch-statements-*` 8 件を追加。`arch-household-cashflow-*` 8 件の `source_path` を退避先へ付け替え (内容同一のため digest は据え置き)。`check-graph-lineage` は 118 ノード一致 |
| features | `features/feat-statements-screen.md`、`.context.json` (新規) | macro feature の purpose / goal / scope / acceptance |
| tasks | `tasks/feat-statements-screen/sys-stmt-p01.md` .. `p13.md` (新規 13 本) | exact-13 package の task spec。p02 / p05 / p12 / p13 の migration 名を 0046 に更新 |
| docs | `docs/statements-screen.md`、`docs/evidence/statements-screen.md`、`docs/evidence/statements/`、本受領書 (新規)、`docs/data-schema.md`、`docs/ui-decisions.md` (更新) | 要件表・証跡・設計判断・スキーマ・UI 判断の正本 |
| migrations | `migrations/0046_liability_status.sql` (新規) | `balance_entries.status` 列の追加と `liability_audit_log` の新設。`ALTER TABLE ... ADD COLUMN` と `CREATE TABLE IF NOT EXISTS` だけで、既存行は `('amount', 0)` として読む |

## main 取込で行った仕様上の調整

本ブランチの起点は `main` の `0003cb4` (#63) で、作業中に main は進んでいない (`git rev-list --count HEAD..origin/main` = 0)。テキスト衝突・意味の衝突ともに発生していない。ただし計画時点からの差として 1 件だけ調整した。

- **migration 番号**: 計画は `0045` だったが、main ですでに `0045_owner_labels.sql` (家計収支) が使われていたため `0046_liability_status.sql` に改番した。`EXPECTED_D1_MIGRATION` と `deletion-schema.test.ts` も 0046 に揃えた。列と表の追加だけなので意味は変わらない。

## `.dev-graph/plans/` を変えなかった理由

`.dev-graph/plans/feature-package-feat-statements-screen/` の成果物は promotion receipt の digest に縛られている (`validate-system-plan.py` = `status: pass`、`sha256:b7b5463d...8f6eb1`)。migration 名 (0045) の記述が残るが、これは計画時点の記録として扱い、書き換えない。実装と現行文書の正本は 0046 である。

## 仕様を実装に合わせて緩めなかった点

受入基準・業務規則は仕様側の記述を削っていない。未達ゲートと再検証項目は `docs/evidence/statements-screen.md` §1・§6 に残した。ローカルで未達だったのは `pnpm verify:full` の exit 0 だけで、原因は 4175 番ポートを同じ機械の別ワークツリーが占有していることである (各段は個別に緑)。CI の `verify` ジョブは commit `9469ae9` で SUCCESS となり、1 本実行としても閉じた。

CI の `テスト (api)` が一度 `timeout-minutes: 20` 超過で `cancelled` になったが、同一 commit の再実行は 11 分 32 秒で SUCCESS だった。ログ上どのテストも失敗・停止しておらず、main の実行と比べた所要時間の倍率は本変更が触っていないファイルにも一様に乗っていたため、原因はランナー側のばらつきと判断した。`timeout-minutes` は緩めない。

本番反映 (P13 = `kanjo-oju.13`) は未実施である。`0046_liability_status.sql` はローカル D1 への適用まで確認済みで、本番の Migrate APPLY と Deploy は PR merge 後の CI で行う。

## 検証結果 (MVP のため最小限)

| 検査 | 結果 |
|---|---|
| core テスト | Test Files 54 passed / 1 skipped、Tests 893 passed / 6 skipped |
| api テスト | Test Files 52 passed、Tests 705 passed |
| web テスト | Test Files 90 passed、Tests 828 passed |
| `pnpm typecheck` | core / api / web すべて Done |
| `pnpm lint` | rc 0。`check-graph-lineage: 118ノードすべてが正本と一致`、`check-glossary: 57語`、`公開文書の実データ参照チェック: OK` |
| `build:bundle` 直後の `check:js-budget` | 初期 JS 103.74 KiB / 上限 110 KiB |
| `validate-system-plan.py` | `status: pass`、P01..P13 exact 13、`violations: []` |
| `pnpm verify:full` | ローカルは **未達** (4175 番ポートを別ワークツリーが占有。各段を個別に実行して置き換え)。CI の `verify` ジョブが commit `9469ae9` で SUCCESS となり、1 本実行は CI 側で確認済み |

## commit の範囲

本サイクルで生まれた差分だけを commit する。`git status` の全件が決算書画面のサイクル由来で、無関係な既存差分は含まれていない (`packages/web/src/components/ExportMenu.tsx` と `use-dismissable-popover.ts` は決算書の `?` 説明で使う popover の共通化、`packages/api/src/schema-guard.ts` は migration 0046 への追随)。
