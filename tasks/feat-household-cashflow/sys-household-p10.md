---
graph_node_id: "SYS-HOUSEHOLD-P10"
artifact_kind: "task"
artifact_subtypes: []
title: "独立最終レビュー"
project_id: "feature-package-feat-household-cashflow"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["household-cashflow", "p10", "independent-review"]
file_path: "tasks/feat-household-cashflow/sys-household-p10.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "4780d9fe76b196197a6648e031dc9cdce44fb72507396ce1d5557d93402c9c2b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-household-cashflow/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-18T12:54:50Z", "origin_kind": "system-dev-planner", "source_digest": "4780d9fe76b196197a6648e031dc9cdce44fb72507396ce1d5557d93402c9c2b", "source_path": ".dev-graph/plans/feature-package-feat-household-cashflow/task-specs/phase-10-final-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-18T12:54:50Z"
updated_at: "2026-09-18T12:54:50Z"
depends_on: ["SYS-HOUSEHOLD-P09"]
related_nodes: ["arch-household-cashflow-auth", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-frontend", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops", "arch-household-cashflow-security", "arch-household-cashflow-ui-ux", "spec-household-cashflow-screen"]
resource_scope: ["docs/household-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-household-cashflow"
feature_package_id: "feature-package/feat-household-cashflow"
phase_ref: "P10"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-household-cashflow/sys-household-p10.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-fzu.10", "linked_at": "2026-09-18T13:37:51Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-18T12:50:00Z", "missing_sections": [], "status": "complete"}
---

# 独立最終レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-household-cashflow
- owners: ["daishiman"]
- tags: ["household-cashflow", "p10", "independent-review"]
- related_nodes: ["arch-household-cashflow-auth", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-frontend", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops", "arch-household-cashflow-security", "arch-household-cashflow-ui-ux", "spec-household-cashflow-screen"]
- parent_feature: feat-household-cashflow
- phase_ref: P10
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-household-cashflow/sys-household-p10.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P01〜P09 の成果物と差分全体を、受入 S1〜S6 と scope_out に照らして独立にレビューし、合否を記録する。

## 背景

家計・設定・明細の 3 画面と migration にまたがる変更なので、scope_out (名義の内部値の変更・累計収支画面・相手口座カラム) を侵していないかを最後に確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen, SYS-HOUSEHOLD-P09
- Entry gate: staging run run-feat-household-cashflow-20260918T124500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面差分をレビューする
- Backend: applicable: 集計差分をレビューする
- API: applicable: 経路差分をレビューする
- Data: applicable: migration 差分をレビューする
- Infrastructure: N/A: 基盤は変更しない
- Security: applicable: フェンスと入力検証の差分をレビューする
- Quality: applicable: レビュー記録を残す
- Documentation: N/A: docs の同期は P12
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Deploy unit/environment: N/A: レビュー記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: レビュー記録のみ

## 成果物

- Produced artifacts:
- docs/household-screen/design-decisions.md
- Consumed artifacts:
- docs/household-screen/design-decisions.md
- specs/spec-household-cashflow-screen.md
- Write scope/touches:
- docs/household-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-HOUSEHOLD-P10 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-HOUSEHOLD-P10 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-HOUSEHOLD-P10 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-HOUSEHOLD-P09) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (累計収支画面の新設、名義の内部値の変更と既存行の書き換え、明細への相手口座カラムの追加、共通シェルの作り直し、総収支・推移・マトリックス・分析ハブの中身の作り直し、集計結果の永続化とキャッシュ層と新しい外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- scope_out の侵犯が 0 件である。
- 受入 S1〜S6 の全項目が合格で記録されている。
- Automated commands:
- pnpm test
- pnpm typecheck
- Required evidence:
- docs/household-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-household-cashflow-screen.md
- Architecture: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Feature: feat-household-cashflow
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-HOUSEHOLD-P09
