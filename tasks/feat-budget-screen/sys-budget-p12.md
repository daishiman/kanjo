---
graph_node_id: "SYS-BUDGET-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "算出規則・API・migration・未決事項の docs 最終同期"
project_id: "feature-package-feat-budget-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["budget-screen", "p12", "documentation-sync"]
file_path: "tasks/feat-budget-screen/sys-budget-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "feeba81f7451b59df51e3830e506ace921410eada67b4f6494010ec6bf19a067", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-budget-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-21T14:49:37Z", "origin_kind": "system-dev-planner", "source_digest": "feeba81f7451b59df51e3830e506ace921410eada67b4f6494010ec6bf19a067", "source_path": ".dev-graph/plans/feature-package-feat-budget-screen/task-specs/phase-12-documentation-operations.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-21T14:49:37Z"
updated_at: "2026-09-21T14:49:37Z"
depends_on: ["SYS-BUDGET-P11"]
related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
resource_scope: ["docs/budget-screen/design-decisions.md", "docs/data-schema.md", "docs/ui-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-budget-screen"
feature_package_id: "feature-package/feat-budget-screen"
phase_ref: "P12"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-budget-screen/sys-budget-p12.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-21T15:00:00Z", "missing_sections": [], "status": "complete"}
---

# 算出規則・API・migration・未決事項の docs 最終同期

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p12", "documentation-sync"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P12
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

算出規則・API・migration・未決事項 7 件の最終状態を docs に同期する。

## 背景

docs/data-schema.md に budget_plans 表と monthlyBudgetsAt の読み出し規則を、docs/ui-decisions.md に画面の文言・状態遷移・表示規則を記す。未決事項 7 件の最終的な決定または未決のままである旨を記すが、本 task は値を決めない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 未決事項 7 件 (Q-7・収入行の差額の色・年額の下限・snapshot/バックアップ整合・その他収入の扱い・Q-5・migration 0050 予定番号) のうち、SYS-BUDGET-P05 で実装により事実上確定したものは実装内容をそのまま docs に転記し、未確定のものは未決のまま記す。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: docs 最終同期を行う
- Operations: applicable: 運用向けの最終記録を行う

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/data-schema.md
- docs/ui-decisions.md
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/budget-screen.ts
- migrations/0050_budget_plans.sql
- packages/web/src/pages/budget/
- Write scope/touches:
- docs/budget-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P12 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P12 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P12 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P11) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- docs/data-schema.md に budget_plans 表と monthlyBudgetsAt の読み出し規則 (BR-22・BR-23) が記されている。
- docs/ui-decisions.md に画面の文言・状態遷移・KPI/一覧/科目パネルの表示規則が記されている。
- open_items 7 件 (Q-7・収入行の差額の色・年額の下限・snapshot/バックアップ整合・その他収入の扱い・Q-5・migration 0050 予定番号) の最終的な決定または未決のままである旨が docs に明記されている (本書は値を決めない)。
- Q-7 の D1 上限の確認結果 (dirty row patch を 3〜5 文へまとめたこと) が docs/budget-screen/design-decisions.md に記されている。
- Automated commands:
- pnpm lint
- pnpm test
- Required evidence:
- docs/budget-screen/design-decisions.md
- docs/data-schema.md
- docs/ui-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P11
