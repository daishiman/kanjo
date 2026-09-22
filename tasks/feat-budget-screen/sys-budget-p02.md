---
graph_node_id: "SYS-BUDGET-P02"
artifact_kind: "task"
artifact_subtypes: []
title: "budgetScreen・applyBudgetInputs・monthlyBudgetsAt・3 API・migration 0050 のワークストリーム設計決定記録"
project_id: "feature-package-feat-budget-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["budget-screen", "p02", "preparation"]
file_path: "tasks/feat-budget-screen/sys-budget-p02.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "feeba81f7451b59df51e3830e506ace921410eada67b4f6494010ec6bf19a067", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-budget-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-21T14:49:37Z", "origin_kind": "system-dev-planner", "source_digest": "feeba81f7451b59df51e3830e506ace921410eada67b4f6494010ec6bf19a067", "source_path": ".dev-graph/plans/feature-package-feat-budget-screen/task-specs/phase-02-architecture.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-21T14:49:37Z"
updated_at: "2026-09-21T14:49:37Z"
depends_on: ["SYS-BUDGET-P01"]
related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
resource_scope: ["docs/budget-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-budget-screen"
feature_package_id: "feature-package/feat-budget-screen"
phase_ref: "P02"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-budget-screen/sys-budget-p02.md", "confidence": 0.95}]
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

# budgetScreen・applyBudgetInputs・monthlyBudgetsAt・3 API・migration 0050 のワークストリーム設計決定記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p02", "preparation"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P02
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p02.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

budgetScreen・applyBudgetInputs・monthlyBudgetsAt の入出力契約、3 API (GET /api/budget-screen・GET/PUT /api/budget-plans) の応答形、migration 0050_budget_plans.sql の設計を、実装前のワークストリーム設計決定として docs に固定する。

## 背景

予算の算出は BR-01〜BR-25 に従い core 1 か所に閉じ、既存 budgets の読み手 (診断の予算カバー率・予算の着地見込み・analytics の予算表) は monthlyBudgetsAt 経由に寄せる (BR-22・BR-23)。budget_plans は追加のみの期間別年額表とし、JSON snapshot の consumer とバックアップ・復元の write-set の両方に登録する設計 (BR-24) をここで固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Blocker: Q-7 は保存 API (SYS-BUDGET-P05) の設計として、1 回の PUT が最大 200 行のとき batch 文数が D1 上限を超えない構成 (複数 INSERT の一括化やトランザクション分割) を選択肢として記録するに留め、最終決定は SYS-BUDGET-P05 で行う。
Open risk: migration 0050 の番号は予定であり、SYS-BUDGET-P05 の着手時と SYS-BUDGET-P13 の配信時にそれぞれ origin/main と突き合わせることを設計決定として明記する。

## Workstream applicability

- Frontend: applicable: 本 phase の責務に含まれる
- Backend: applicable: budgetScreen / applyBudgetInputs / monthlyBudgetsAt の入出力契約を固定する
- API: applicable: 3 API の応答形と zod 許可リストを固定する
- Data: applicable: migration 0050 の追加のみ設計を固定する
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: N/A: 本 phase の責務に含まれない
- Documentation: applicable: docs へ記録する
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 設計決定の記録のみで、migration の適用は SYS-BUDGET-P05/SYS-BUDGET-P13 で行う

## 成果物

- Produced artifacts:
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-budget-screen.md
- architecture/budget-backend.md
- architecture/budget-database.md
- architecture/budget-frontend.md
- Write scope/touches:
- docs/budget-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P02 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P02 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P02 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P01) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- budgetScreen / applyBudgetInputs / monthlyBudgetsAt (packages/core/src/budget-screen.ts 新設) の入出力と BR-01〜BR-25 の算出規則が docs に書かれている。
- GET /api/budget-screen・GET /api/budget-plans・PUT /api/budget-plans の応答形・zod 許可リストが spec の API 契約と一致している。
- migration 0050_budget_plans.sql (budget_plans の新設、主キー (user_id, period_start, account)) が追加のみである方針と、番号が予定番号であり着手時に origin/main と突き合わせる旨が docs に明記されている。
- 既存 budgets の読み手 (診断の予算カバー率・着地見込み・analytics の予算表) を monthlyBudgetsAt 経由に寄せる設計 (BR-22・BR-23) が docs に明記されている。
- budget_plans を JSON snapshot の consumer (JSON_SNAPSHOT_MUTATION_CONSUMERS) とバックアップ・復元の write-set (import-lifecycle.ts) の両方に入れる設計 (BR-24) が docs に明記されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/budget-screen/design-decisions.md

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
- Dependencies: SYS-BUDGET-P01
