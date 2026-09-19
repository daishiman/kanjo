# 家計収支画面 — 仕様反映の受領書

- 記録日: 2026-09-19
- 対象ブランチ: `devgraph/feat-household-cashflow`
- base: `main`
- Beads: epic `kanjo-fzu` + `kanjo-fzu.1` .. `kanjo-fzu.13` (13 件、`dev-graph:SYS-HOUSEHOLD-P01`..`P13`)
- dev-graph node: `feat-household-cashflow`

## 判定: 仕様・設計への影響は「あり」

家計収支画面の作り直しは、見た目だけでなく次の 3 点で契約を変えている。そのため `system-spec/`・`specs/`・`architecture/` へ正規フローで反映した。

1. **家計の数字の出どころを 1 本にした**。旧 `household(data)` (個人分 MF だけの月次比較) を廃止し、core の `householdSummary` が総収支画面と同じ `totalCashflowLedger(...)` の行だけから家計全体・事業・個人を導く。家計全体は総収支画面の「総合」と一致し、事業 + 個人 = 家計全体が重複なく閉じる。
2. **名義の表示名という新しい状態を追加した**。内部値 (`business`/`spouse`/`family`) は集計の鍵のまま残し、見せる語だけを利用者ごとに `owner_labels` 表 (migration `0045_owner_labels.sql`) に持つ。DB スキーマと API 契約 (`GET/PUT /api/settings/owner-labels`) が増える。
3. **画面名と問いを変えた**。「家計」→「家計収支」。問いは「家計の総収入・総支出・純収支は、どう変わりましたか？」。

## 反映した層

| 層 | ファイル | 反映内容 |
|---|---|---|
| system-spec | `system-spec/00-requirements-definition.md`、8 技術章、`index.md`、`spec-state.json`、`fetched-references.json`、`completeness-findings.json` | 本サイクルの elicit → doc-fetch → compile を正規フローで通して再生成 (U1-U9 は利用者承認 `appr-foundation-household-cashflow-001`) |
| system-spec (退避) | `system-spec/archive/2026-09-18-subscriptions-screen/` (13 章 + README) | main 取込時に直下にあったサブスク世代を丸ごと退避。本 README 以外は main の tree とバイト単位で同一 |
| specs | `specs/spec-household-cashflow-screen.md` (新規) | 画面仕様の正本。受入基準・業務規則・API 契約 |
| architecture | `architecture/household-cashflow-{auth,backend,database,frontend,infrastructure,maintenance-ops,security,ui-ux}.md` (新規 8 件) | 章別の設計 |
| architecture (graph) | `architecture/graph.json` | `arch-household-cashflow-*` 8 件を追加。`arch-subscriptions-*` 8 件の `source_path` を退避先へ付け替え (内容同一のため digest は据え置き)。`docs/spec-v1.1.md` 更新に伴い `arch-tax-preparation-boundary` の digest を打ち直し。`check-graph-lineage` は 110 ノード一致 |
| features | `features/feat-household-cashflow.md`、`.context.json` (新規) | macro feature の purpose / goal / scope / acceptance |
| tasks | `tasks/feat-household-cashflow/sys-household-p01.md` .. `p13.md` (新規 13 本) | exact-13 package の task spec。p05 / p13 の migration 名を 0045 に更新 |
| docs | `docs/household-screen/design-decisions.md`、本受領書 (新規)、`docs/data-schema.md`、`docs/ui-decisions.md`、`docs/reconciliation-icons.md`、`docs/spec-v1.1.md` (更新) | 設計判断・スキーマ・UI 判断・製品全体の正本 (§4.1 P6 を「家計収支」と新しい 1 タスクへ) |
| migrations | `migrations/0045_owner_labels.sql` (新規) | `owner_labels`。新しい表の追加だけで既存行は書き換えない |

## main 取込で行った仕様上の調整

PR 前に `main` (7f4504d。#59 診断、#60 サブスク) を取り込んだ。テキスト衝突は解消済みで、次の 3 件は衝突として表に出ない「意味の衝突」だったため、個別に判断した。

1. **migration 番号**: main が `0043` (サブスク) と `0044` (診断) を使っていたため、`0043_owner_labels.sql` を `0045_owner_labels.sql` に改番した。`EXPECTED_D1_MIGRATION` と `deletion-schema.test.ts` も 0045 に揃えた。表の追加だけなので意味は変わらない。
2. **診断コードが旧 `household(data)` を参照していた**: `diagnosis-health.ts`・`diagnosis-screen.ts`・`diagnosis-detectors.ts` の参照を、`analysis.ts` に残した部品 (`personalMonths` / `balanceMonth` / `balanceTotals` / `comparison` / `personalExplainability`) の呼び出しに置き換えた。旧 `household()` と同じ式なので診断の数値は変わらない。旧関数は戻さない (P08 の「旧参照 0 件」を守る)。
3. **`tradeoffCandidates`**: main が診断の検知器レジストリへ移していたため、こちらの `analysis.ts` からも削除した。

## `.dev-graph/plans/` を変えなかった理由

`.dev-graph/plans/feature-package-feat-household-cashflow/` の成果物は promotion receipt の digest に縛られている。migration 名 (0043) の記述が残るが、これは計画時点の記録として扱い、書き換えない。実装と現行文書の正本は 0045 である。

## 仕様を実装に合わせて緩めなかった点

受入基準・業務規則は仕様側の記述を削っていない。本番反映 (P13 = `kanjo-fzu.13`) は未実施である。`0045_owner_labels.sql` はローカル D1 への適用まで確認済みで、本番の Migrate APPLY と Deploy は PR merge 後の CI で行う。

## 検証結果 (MVP のため最小限)

| 検査 | 結果 |
|---|---|
| core テスト | Test Files 53 passed / 1 skipped、Tests 872 passed / 6 skipped |
| api テスト | Test Files 51 passed、Tests 679 passed |
| web テスト | Test Files 89 passed、Tests 777 passed |
| `pnpm -r typecheck` | core / api / web すべて Done (rc 0) |
| `pnpm lint` | rc 0。`check-graph-lineage: 110ノードすべてが正本と一致`、`check-glossary: 57語すべてが画面で使われています`、`公開文書の実データ参照チェック: OK` |
| `build:bundle` 直後の `check:js-budget` | 初期 JS 102.87 KiB / 上限 110 KiB |

main 取込直後の lint では `check-glossary` が「`annualized` がどの画面でも使われていない」で落ちた。家計の作り直しで旧 `Household.tsx` の `<Term id="annualized">` が消え、main のサブスクの作り直しで旧 `Subscriptions.tsx` 側の使用も消えていたため、合わせると 0 件になった (どちらのブランチ単体では通る)。家計の KPI「総収入」の注記に表示している「年換算」を `<Term id="annualized" />` にして解消した。

## commit の範囲

`system-spec/archive/2026-09-18-expense-matrix/` (untracked) は、main の `archive/2026-09-18-expense-matrix-screen/` と内容が同じ重複なので commit しない。
