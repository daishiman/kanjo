---
graph_node_id: "SYS-MATRIX-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "重複算出経路の除去と既存 matrix 利用箇所の整理"
project_id: "feature-package-feat-expense-matrix"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["expense-matrix", "p08", "refactoring"]
file_path: "tasks/feat-expense-matrix/sys-matrix-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T12:34:56Z", "origin_kind": "system-dev-planner", "source_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "source_path": ".dev-graph/plans/feature-package-feat-expense-matrix/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.11"}
created_at: "2026-09-16T12:34:56Z"
updated_at: "2026-09-16T12:34:56Z"
depends_on: ["SYS-MATRIX-P07"]
related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
resource_scope: ["packages/core/src/analysis.ts", "packages/core/src/csv.ts", "packages/core/src/report-html.ts", "packages/web/src/components/FinancialCharts.tsx", "packages/web/src/components/ReportChart.tsx", "packages/web/src/components/financial-chart-model.test.ts", "packages/web/src/components/financial-chart-model.ts", "packages/web/src/components/heatmap/heat-grid.tsx", "packages/web/src/components/heatmap/heat-model.ts", "packages/web/src/figure-guides.ts", "packages/web/src/heatmap-behavior.dom.test.tsx", "packages/web/src/mobile-financial-visualization.dom.test.tsx", "packages/web/src/pages/analysis/Matrix.tsx", "packages/web/src/styles.css"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-expense-matrix"
feature_package_id: "feature-package/feat-expense-matrix"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-expense-matrix/sys-matrix-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-16T12:11:25Z", "missing_sections": [], "status": "complete"}
---

# 重複算出経路の除去と既存 matrix 利用箇所の整理

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p08", "refactoring"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

集計の算出経路が core の 1 か所に収束し、旧来の画面側算出と CSV 側の独自集計が残らない状態にする。新しい表と migration は作らない。

## 背景

実装が緑になった直後は、旧経路が呼ばれないまま残ることがある。残った経路は次の変更で復活し、画面と CSV の数値が再び食い違う原因になる。本サイクルは新しい保存を伴わないため、整理の対象はコード上の重複経路と参照だけである。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面側の残存算出を除去する
- Backend: applicable: core への収束と CSV の付け替えを確定する
- API: N/A: 契約に変更なし
- Data: applicable: 新しい保存と migration を伴わないことを確認する
- Infrastructure: N/A: 配信構成に変更なし
- Security: N/A: 保証確認は P09 の責務
- Quality: applicable: 整理の前後でテストが緑であることを確認する
- Documentation: N/A: docs の最終同期は P12 の責務
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: web ビルドと Worker (既存の配信単位)
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- packages/core/src/analysis.ts
- Consumed artifacts:
- docs/matrix/acceptance.md
- docs/matrix/design-review.md
- Write scope/touches:
- packages/core/src/analysis.ts
- packages/core/src/csv.ts
- packages/web/src/pages/analysis/Matrix.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm typecheck
- pnpm lint
- Required evidence:
- packages/core/src/analysis.ts
- packages/core/src/heat-model.ts
- Additional completion criteria:
- 濃さの共通部品 `packages/core/src/heat-model.ts` は**階級 (0-6 の離散値) だけを返す**こと。生の値と分母を返してはならない。受け手が割り算を持つと、除いたはずの重複が戻る。
- `packages/api/src/ai/catalog.ts` の配線は変更しないこと (本サイクルは凍結と決定済み)。`ReportChart.tsx` は現在 `sr.data` から自前で最大値を求めているので、その値をそのまま共通部品へ渡す形にする。
- 濃さの基準は**科目ごと**を維持すること。基準も同時に変えると、見た目が変わったときに部品の統合が原因か基準変更が原因かを切り分けられない。今回は見た目が変わらないことが統合の正しさの証拠になる。
- `packages/web/src/styles.css:1214-1222` の 2 規則を**移設せず残す場合は、その判断そのものを記録に残す**こと。記録がないと、次に読む者は消し忘れと解釈して消す。この 2 規則は同じクラス名に依存しているが死に方が異なるので、**次の 2 項目を 1 つにまとめないこと**。
- (a) **クラス名が消えたときの沈黙**。`heatmap-scroll` の発行元は `packages/web/src/components/ReportChart.tsx:207` の 1 か所だけである。ここが出さなくなると `:1218` の `:has()` と `:1222` の `:not()` が同時に沈黙する。`:has()` 側は高さが固定枠へ戻って見た目に出るが、それを目視に頼らないために、**`ReportChart` が `heatmap-scroll` を持つ要素を描画することを検査で固定する**こと。クラス名の結び付きを見るだけなので jsdom で書ける。
- (b) **除外リストが陳腐化したときの沈黙**。`:1222` はクラス名が生きていても、この枠に `heatmap-scroll` 以外の高さ可変要素が入った瞬間、その要素を `height: 100%` へ押し込めて何も警告しない。**これを検出する自動検査はこのスタックでは書けない** — 判定にはレイアウト結果が要るが、`packages/web` のテスト環境は jsdom (`package.json:39`) でレイアウトを計算しないためである。したがって (b) への対処は記録だけであり、**「自動検出手段が存在しない」ことを記録の中に明記する**こと。検査で守れるものと守れないものを同じ欄に書くと、(a) が緑になったときに (b) も守られたと読まれる。
- `packages/core/src/chart-aggregates.ts` の `AccountMonthRow.max` は**プロジェクト全体で消費者が 0 件**であり、同ファイルのコメント「ヒートマップの濃さは科目ごとにこの値で割る」はどこでも実行されていない死んだ宣言である。共通部品へ寄せた結果この欄が使われるようになるか、使われないなら欄とコメントの両方を落とすか、どちらかへ決着させること。
- `packages/web/src/figure-guides.ts:111` の「前年から」という説明は誤りである。実装 (`financial-chart-model.ts:25-26` の `recordedIndexes.at(-1)` / `.at(-2)`) は**直近 2 記帳月**を比べている。説明文を実装に合わせること。

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。新しい表と migration を伴わないため、データの巻き戻しは不要である。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P07

## 実装で確定した結果 (2026-09-18)

- `packages/web/src/components/financial-chart-model.ts` から `matrixMovers` と `MatrixMoversChart` を削除した。これが「同じ偏りを画面ごとに違う定義で計算していた」経路の 1 本。
- 偏りの算出は core の `matrixSkewTop` 1 本になり、その中の偏りの定義も `analysis.ts` の `zScores` だけを使う。
- 重複経路の本数は 3 から 2 へ減り、目標の下限 2 に到達した。残る 2 本は別画面が持つもので、本 feature の範囲外。
- 既存利用箇所の整理として `LEGACY_ROUTE_REDIRECTS` に `/matrix` → `/analysis/matrix` を維持した。
