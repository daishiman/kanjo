---
graph_node_id: "SYS-HOUSEHOLD-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "要件ベースライン確定と持ち越し 4 件の着手時整理"
project_id: "feature-package-feat-household-cashflow"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["household-cashflow", "p01", "preparation"]
file_path: "tasks/feat-household-cashflow/sys-household-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "4780d9fe76b196197a6648e031dc9cdce44fb72507396ce1d5557d93402c9c2b", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-household-cashflow/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-18T12:54:50Z", "origin_kind": "system-dev-planner", "source_digest": "4780d9fe76b196197a6648e031dc9cdce44fb72507396ce1d5557d93402c9c2b", "source_path": ".dev-graph/plans/feature-package-feat-household-cashflow/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-18T12:54:50Z"
updated_at: "2026-09-18T12:54:50Z"
depends_on: []
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
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-household-cashflow/sys-household-p01.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-fzu.1", "linked_at": "2026-09-18T13:37:37Z", "sync_state": "linked"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-18T12:50:00Z", "missing_sections": [], "status": "complete"}
---

# 要件ベースライン確定と持ち越し 4 件の着手時整理

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-household-cashflow
- owners: ["daishiman"]
- tags: ["household-cashflow", "p01", "preparation"]
- related_nodes: ["arch-household-cashflow-auth", "arch-household-cashflow-backend", "arch-household-cashflow-database", "arch-household-cashflow-frontend", "arch-household-cashflow-infrastructure", "arch-household-cashflow-maintenance-ops", "arch-household-cashflow-security", "arch-household-cashflow-ui-ux", "spec-household-cashflow-screen"]
- parent_feature: feat-household-cashflow
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-household-cashflow/sys-household-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec-household-cashflow-screen と feature の受入 S1〜S6 を、実装着手時点の要件ベースラインとして 1 枚に固定し、持ち越し事項 4 件 (OI-01〜OI-04) の解決担当 phase を割り当てる。

## 背景

家計画面は総収支画面・推移画面と同じ行集合 (totalCashflowLedger) を正本にするため、既存数値との一致を要件の最上位に置く。画像の算術が閉じない欄 (spec 10 節) は計算値を期待値にする利用者決定を、要件ベースラインへそのまま写す。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Entry gate: staging run run-feat-household-cashflow-20260918T124500Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 要件の固定のみ
- Backend: N/A: 要件の固定のみ
- API: N/A: 要件の固定のみ
- Data: N/A: 要件の固定のみ
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 要件の固定のみ
- Quality: applicable: 受入 S1〜S6 を検証可能な文に分解する
- Documentation: applicable: 要件ベースラインを docs へ置く
- Operations: N/A: 運用手順は P12 の責務

## Architecture and deploy unit

- Architecture decisions: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/household-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-household-cashflow-screen.md
- features/feat-household-cashflow.md
- system-spec/00-requirements-definition.md
- Write scope/touches:
- docs/household-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-HOUSEHOLD-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-HOUSEHOLD-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-HOUSEHOLD-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (累計収支画面の新設、名義の内部値の変更と既存行の書き換え、明細への相手口座カラムの追加、共通シェルの作り直し、総収支・推移・マトリックス・分析ハブの中身の作り直し、集計結果の永続化とキャッシュ層と新しい外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S6 が検証可能な文として docs に列挙され、各文に対応する spec の節番号が付いている。
- 持ち越し 4 件 (OI-01〜OI-04) の解決担当 phase が docs に記載されている。
- spec 10 節の計算値 (純収支 −¥80,000 など) が期待値として採用されている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/household-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-household-cashflow-screen.md
- Architecture: arch-household-cashflow-auth, arch-household-cashflow-backend, arch-household-cashflow-database, arch-household-cashflow-frontend, arch-household-cashflow-infrastructure, arch-household-cashflow-maintenance-ops, arch-household-cashflow-security, arch-household-cashflow-ui-ux, spec-household-cashflow-screen
- Feature: feat-household-cashflow
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
