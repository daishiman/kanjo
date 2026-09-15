---
graph_node_id: "SYS-OVERVIEW-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "API契約・データモデル設計の独立レビュー"
project_id: "feature-package-feat-overview-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["overview-screen", "p03", "design-review"]
file_path: "tasks/feat-overview-screen/sys-overview-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-overview-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:55:29Z", "origin_kind": "system-dev-planner", "source_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "source_path": ".dev-graph/plans/feature-package-feat-overview-screen/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:55:29Z"
updated_at: "2026-09-14T13:55:29Z"
depends_on: ["SYS-OVERVIEW-P02"]
related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
resource_scope: ["docs/overview-screen/design-review.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-overview-screen"
feature_package_id: "feature-package/feat-overview-screen"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-overview-screen/sys-overview-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-8c2.3", "linked_at": "2026-09-14T14:18:42Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:41:44Z", "missing_sections": [], "status": "complete"}
---

# API契約・データモデル設計の独立レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p03", "design-review"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02で確定したAPI契約とデータモデル設計を、実装着手前に独立した視点でレビューし是正未了の指摘を0件にする。

## 背景

feature-execution-package-contractのP03責務 (independent design gate) に従い、P02の決定記録がspec-overview-screen.mdのBR-001..BR-007と矛盾しないことを実装前に確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P02が完了し、docs/overview-screen/architecture-decision.mdが存在すること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 4要素の同一月別系列からの算出方針 (BR-001) をレビュー対象にする
- Backend: applicable: 概況集計のcore純関数化方針をレビュー対象にする
- API: applicable: エラー契約 (400/401/409/503) とkind/itemKey/month/scopeの入力検証方針をレビュー対象にする
- Data: applicable: review_snoozes/monthly_close_reviewsの主キー・CHECK制約をレビュー対象にする
- Infrastructure: N/A: 配信構成の変更はない
- Security: applicable: 外部送信なし (CSP connect-src 'self') が維持される設計かをレビュー対象にする
- Quality: applicable: レビュー結果をdesign-review.mdへ記録する
- Documentation: applicable: is-review.mdを新設する
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: N/A: レビュー記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 設計レビューのみでコードを変更しない

## 成果物

- Produced artifacts:
- docs/overview-screen/design-review.md
- Consumed artifacts:
- docs/overview-screen/architecture-decision.md
- specs/spec-overview-screen.md
- Write scope/touches:
- docs/overview-screen/design-review.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint
- Required evidence:
- docs/overview-screen/design-review.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/overview-screen/design-review.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P02
