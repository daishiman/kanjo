---
graph_node_id: "SYS-ANHUB-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "支出分析ハブ 全テスト・型検査・lintの実行と記録"
project_id: "feature-package-feat-analysis-hub"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["analysis-hub", "p06"]
file_path: "tasks/feat-analysis-hub/sys-anhub-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-analysis-hub/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:39:34Z", "origin_kind": "system-dev-planner", "source_digest": "20c92f71e63affce7b3013c237aed7088a25db31a45c2072cc022288fba4b66c", "source_path": ".dev-graph/plans/feature-package-feat-analysis-hub/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:39:34Z"
updated_at: "2026-09-14T13:39:34Z"
depends_on: ["SYS-ANHUB-P05"]
related_nodes: ["arch-analysis-hub-maintenance-ops"]
resource_scope: ["docs/analysis-hub/test-run.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-analysis-hub"
feature_package_id: "feature-package/feat-analysis-hub"
phase_ref: "P06"
classification_confidence: 1.0
classification_reason: "feature-execution-package-contract.md の P01..P13 責務表に基づき、specs/spec-analysis-hub.md と architecture/analysis-hub-*.md の該当領域から本 task の workstream を分類した。"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-analysis-hub/sys-anhub-p06.md", "confidence": 1.0}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-lci.6", "linked_at": "2026-09-14T14:18:23Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:00:22Z", "missing_sections": [], "status": "complete"}
---

# SYS-ANHUB-P06 支出分析ハブ 全テスト・型検査・lintの実行と記録

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P06",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P06",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P05"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p06.md"
}
```

## 目的

P05 実装後、pnpm test / typecheck / lint を含む既存テストスイート全体を実行し、新規追加分だけでなく既存の analysis-tabs/navigation-ux/common-shell-routes を含む回帰の有無を記録する。

## 背景

architecture-maintenance-ops.md は verify:full の test → typecheck → lint の順序を維持することを求める。P05 実装が他画面のテストを壊していないことを、実装 phase とは独立した実行 phase で確認する必要がある。

## 前提条件

- Entry gate: P05 の実装コードが存在し、write_scope に記載の全ファイルが変更済みであること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P05

## Workstream applicability

主分類: Quality / 副分類: documentation

- Frontend: N/A: 実行記録のみで実装コード変更を持たない
- Backend: N/A: 実行記録のみで実装コード変更を持たない
- API: N/A: 実行記録のみで実装コード変更を持たない
- Data: N/A: 実行記録のみでスキーマ変更を持たない
- Infrastructure: N/A: 実行記録のみで配信構成の変更を持たない
- Security: N/A: 実行記録のみでセキュリティ設計変更を持たない
- Quality: applicable — pnpm test / typecheck / lint の全件実行と結果記録が本taskの主責務
- Documentation: applicable — docs/analysis-hub/test-run.md を新設し実行結果を記録する
- Operations: N/A: 実行記録のみで運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: N/A: 本taskはアーキテクチャ決定を行わない。既存 verify:full の test/typecheck/lint 段の実行のみを行う。
- Deploy unit: N/A: 実行記録のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/test-run.md (pnpm test/typecheck/lint の実行結果サマリー)
- 参照する既存成果物 (Consumed artifacts): packages/core/src/analysis-hub.ts ほか P05 の実装コード一式
- Write scope: `docs/analysis-hub/test-run.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P06 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- テスト失敗の修正 (P05 への差し戻しとして扱う)
- check:mobile-layout / check:financial-routes 等の check 系実行 (P09 の責務)
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `pnpm test 2>&1 | tail -20`
- `pnpm typecheck 2>&1 | tail -20`
- `pnpm lint 2>&1 | tail -20`
- Required evidence: docs/analysis-hub/test-run.md に記載した3コマンドの実行結果 (exit code と要約)

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/test-run.md を削除する。テスト失敗が判明した場合は P05 へ差し戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p06.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/maintenance-ops.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P05
