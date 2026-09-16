---
graph_node_id: "SYS-RECON-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "API契約・D1新表設計・一致度規則の独立レビュー"
project_id: "feature-package-feat-reconciliation"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["reconciliation", "p03", "design-review"]
file_path: "tasks/feat-reconciliation/sys-recon-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-reconciliation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T11:23:54Z", "origin_kind": "system-dev-planner", "source_digest": "76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad", "source_path": ".dev-graph/plans/feature-package-feat-reconciliation/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T11:23:54Z"
updated_at: "2026-09-15T11:23:54Z"
depends_on: ["SYS-RECON-P02"]
related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
resource_scope: ["docs/reconciliation/design-review.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-reconciliation"
feature_package_id: "feature-package/feat-reconciliation"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-reconciliation/sys-recon-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-15T11:10:33Z", "missing_sections": [], "status": "complete"}
---

# API契約・D1新表設計・一致度規則の独立レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-reconciliation
- owners: ["daishiman"]
- tags: ["reconciliation", "p03", "design-review"]
- related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
- parent_feature: feat-reconciliation
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-reconciliation/sys-recon-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02の設計決定に対する独立レビューを行い、是正指摘を解消した状態でP04以降の失敗テスト設計へ引き渡す。

## 背景

architecture/reconciliation-maintenance-ops.md はG2(一致度・キュー・ステータス・解消率・月次クローズの自動3ステップを境界値テストで固定する)を掲げており、P03でその前提となる規則定義の整合を独立レビューする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Entry gate: staging run sdp-feat-reconciliation-20260915T1102Z のgoal-spec.jsonがreadiness_pin.status=completeであること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- Depends on: SYS-RECON-P02 の成果物が確定していること

## Workstream applicability

- Frontend: N/A: UIコードのレビューはP09/P10で扱う
- Backend: applicable: API/D1設計のレビューを行う
- API: applicable: 3エンドポイント契約のレビューを行う
- Data: applicable: 新表3件の列設計のレビューを行う
- Infrastructure: N/A: 本taskの関心外
- Security: applicable: canonicalMutationFence対象化のレビューを行う
- Quality: applicable: 設計レビュー自体がQuality工程である
- Documentation: applicable: docs/reconciliation/design-review.md を新設する
- Operations: N/A: 本taskの関心外

## Architecture and deploy unit

- Architecture decisions: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Deploy unit/environment: N/A: レビュー記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本taskはコードのマイグレーションを直接実行しない

## 成果物

- Produced artifacts:
- docs/reconciliation/design-review.md
- Consumed artifacts:
- docs/reconciliation/architecture-decision.md
- system-spec/00-requirements-definition.md
- specs/spec-reconciliation.md
- features/feat-reconciliation.md
- system-spec/completeness-findings.json
- Write scope/touches:
- docs/reconciliation/design-review.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-RECON-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-RECON-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-RECON-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-RECON-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (総収支・マトリクス・推移・診断タブ中身の作り直し、他画面の中身の作り直し、freee/MoneyForwardへの書き戻し、外部送信、利用規約等の本文新規作成、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint
- Required evidence:
- docs/reconciliation/design-review.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/reconciliation/design-review.md の追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Feature: feat-reconciliation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-RECON-P02
