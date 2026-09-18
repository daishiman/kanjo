---
graph_node_id: "SYS-MATRIX-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "core 集計純関数・2 経路 API・マトリックス画面・表記統一の実装"
project_id: "feature-package-feat-expense-matrix"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["expense-matrix", "p05", "implementation"]
file_path: "tasks/feat-expense-matrix/sys-matrix-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T12:34:56Z", "origin_kind": "system-dev-planner", "source_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "source_path": ".dev-graph/plans/feature-package-feat-expense-matrix/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.11"}
created_at: "2026-09-16T12:34:56Z"
updated_at: "2026-09-16T12:34:56Z"
depends_on: ["SYS-MATRIX-P04"]
related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
resource_scope: ["packages/api/src/routes/analytics.ts", "packages/core/src/analysis.ts", "packages/core/src/csv.ts", "packages/core/src/dataset.ts", "packages/core/src/report-html.ts", "packages/web/src/api.ts", "packages/web/src/components/ExportMenu.tsx", "packages/web/src/components/ReportChart.tsx", "packages/web/src/components/heatmap/heat-grid.tsx", "packages/web/src/components/heatmap/heat-model.ts", "packages/web/src/figure-guides.ts", "packages/web/src/pages/Settings.tsx", "packages/web/src/pages/analysis/Matrix.tsx", "packages/web/src/pages/analysis/matrix.css", "packages/web/src/pages/analysis/matrix/CellDetail.tsx", "packages/web/src/pages/analysis/matrix/MatrixPage.tsx", "packages/web/src/pages/analysis/matrix/MatrixTable.tsx", "packages/web/src/pages/analysis/matrix/SelectionBar.tsx", "packages/web/src/pages/analysis/matrix/SkewTop3.tsx", "packages/web/src/pages/analysis/matrix/api.ts", "packages/web/src/pages/analysis/matrix/model.ts", "packages/web/src/route-search.test.ts", "packages/web/src/routeMetadata.ts", "packages/web/src/styles.css"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-expense-matrix"
feature_package_id: "feature-package/feat-expense-matrix"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-expense-matrix/sys-matrix-p05.md", "confidence": 0.95}]
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

# core 集計純関数・2 経路 API・マトリックス画面・表記統一の実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p05", "implementation"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の失敗テストが全て緑になるまで、core の集計純関数と GET /api/matrix の拡張と GET /api/matrix/cell の新設と packages/web のマトリックス画面と表記統一を実装する。

## 背景

集計は core の純関数 1 か所に寄せ、API はそれを返すだけ、画面は返ってきた数値と階級と順位を描くだけにする。現行の画面側算出 (cell(series, i)) は廃する。取得は表本体とセル内訳の 2 本に分け、内訳は選択が入るまで開始しない条件付き取得にする。サイドバーとヘッダーとフッターの構造は変更せず、表記のみを マトリックス へ統一する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: マトリックス画面と切替 3 群と詳細パネルと下部バーを実装する
- Backend: applicable: core の集計純関数と偏り度スコアと示唆テンプレートを実装する
- API: applicable: 2 経路のクエリ受理と応答形を実装する
- Data: applicable: 前後 12 か月まで読み広げた Dataset 構築を実装する
- Infrastructure: N/A: binding と配信構成は据え置きで、変更しない
- Security: applicable: 列挙値の許可リスト検査と 400、key の完全一致と長さ上限を実装する
- Quality: applicable: P04 の失敗テストが全て緑になることを確認する
- Documentation: N/A: docs の最終同期は P12 の責務
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: web ビルドと Worker (既存の配信単位。新しい binding と migration を伴わない)
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- packages/core/src/analysis.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/analysis/Matrix.tsx
- Consumed artifacts:
- docs/matrix/design-decisions.md
- packages/core/test/matrix-contract.test.ts
- packages/api/test/matrix-routes.test.ts
- Write scope/touches:
- packages/core/src/analysis.ts
- packages/core/src/csv.ts
- packages/core/src/dataset.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/analysis/Matrix.tsx
- packages/web/src/routeMetadata.ts

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- Required evidence:
- packages/core/src/analysis.ts
- packages/api/src/routes/analytics.ts
- packages/web/src/pages/analysis/Matrix.tsx
- Additional completion criteria (本サイクルの承認事項):
- **期間は直近 13 ヶ月**とする。既存の `year13` プリセット (`packages/web/src/pages/Ai.tsx:56` / `packages/api/src/ai/dataset.ts:154`、`note: '前年同月と比べられる(年次・既定)'`) と同じ定義を使い、新たな期間概念を作らない。13 は `MONTHLY_LIMIT = 36` を下回るので四半期への丸めは発生しない。
- **CSV も同じ 13 ヶ月**にそろえる。`packages/api/src/routes/analytics.ts:652` の現行ヘッダ `['科目', ...m.months, ...m.years.map(...), '前年比(年換算)']` のうち `前年比(年換算)` 列は残す。画面と CSV の列数が一致することで、両者が同一経路から出ているかを列数の照合だけで確かめられる。
- CSV の先頭列名は軸に追随させること。軸が取引先のとき `科目` と出るのは誤りである。
- **家計側にも取引先軸を出す**。家計の明細には帳簿の取引先欄がないため、`packages/core/src/types.ts:53-73` の `MfTx.c` (表記を揃えずに保持される自由文) から取り出す。行数が数十行以上に膨らむ前提で上位 20 + その他の扱いを決めること。取引先名の正規化の適用範囲は OI-04 として P04 が確定する。
- **画面の表記ゆれを本サイクルで統一する**。サイドバー・ヘッダー・フッターは既存踏襲のままで、差分は表記統一に限る。`packages/web/src/api.ts:161` の `ExpenseScope` は `packages/core/src/trend.ts:18` からの再定義になっているので、core を正本として一本化する。

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 本 task のコミットを revert する。新しい表と migration を伴わないため、データの巻き戻しは不要で、配信済みなら直前のビルドへ戻す。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P04

## 実装で確定した結果 (2026-09-18)

実装した範囲:

- core: `packages/core/src/heat-scale.ts` (濃淡の分母 `heatScaleOf`、7 段)、`packages/core/src/matrix-derived.ts` (`recordedIndexes` / `matrixRowSummary` / `matrixColumnSummary` / `matrixBodyValues` / `matrixSkewTop`)。
- web: `packages/web/src/components/heatmap/` (`HeatGrid` + `heat-model`)、`packages/web/src/pages/analysis/matrix/` (`MatrixPage` / `MatrixTable` / `SkewTop3` / `model`)。旧 `packages/web/src/pages/analysis/Matrix.tsx` は削除。
- 表記統一: `packages/web/src/routeMetadata.ts` の `label` と `journeyHint` を「マトリクス」から「マトリックス」へ。
- 型の正本化: `packages/web/src/api.ts` の `ExpenseScope` を core から import して re-export する形へ。

**実装していない範囲**: 2 経路 API (`GET /api/matrix` の `scope` / `axis` 拡張、`GET /api/matrix/cell` 新設) は未着手で `packages/api/` の差分は 0 行。画面は既存の `GET /matrix` をそのまま呼んでいる。
