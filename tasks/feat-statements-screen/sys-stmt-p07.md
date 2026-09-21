---
graph_node_id: "SYS-STMT-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "成功基準 S1 から S5 と仕様 §7 の受入の判定"
project_id: "feature-package-feat-statements-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["statements-screen", "p07", "acceptance"]
file_path: "tasks/feat-statements-screen/sys-stmt-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-statements-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-19T12:35:04Z", "origin_kind": "system-dev-planner", "source_digest": "b7b5463d81396f3733f71694ba174d935c886841941c232029b6574add8f6eb1", "source_path": ".dev-graph/plans/feature-package-feat-statements-screen/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-19T12:35:04Z"
updated_at: '2026-09-19T12:47:48Z'
depends_on: ["SYS-STMT-P06"]
related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
resource_scope: ["docs/statements-screen.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-statements-screen"
feature_package_id: "feature-package/feat-statements-screen"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-statements-screen/sys-stmt-p07.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage:
  bd_issue_id: kanjo-oju.7
  linked_at: '2026-09-19T12:47:48Z'
  sync_state: synced
  github_mirror: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-19T12:22:08Z", "missing_sections": [], "status": "complete"}
---

# 成功基準 S1 から S5 と仕様 §7 の受入の判定

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-statements-screen
- owners: ["daishiman"]
- tags: ["statements-screen", "p07", "acceptance"]
- related_nodes: ["arch-statements-auth", "arch-statements-backend", "arch-statements-database", "arch-statements-frontend", "arch-statements-infrastructure", "arch-statements-maintenance-ops", "arch-statements-security", "arch-statements-ui-ux", "spec-statements-screen"]
- parent_feature: feat-statements-screen
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-statements-screen/sys-stmt-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

S1-S5 と仕様 §7 の受入を 1 件ずつ実測で判定し、満たさないものを該当 phase へ差し戻す。

## 背景

緑のゲートが並んでいても、画像どおりの配置、ページ内ナビで節の見出しへフォーカスが移ること、下書きが再読込後に復元されることは、実画面で受入判定を別に行わないと確かめられない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Entry gate: staging run plan-feat-statements-screen-20260919 の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- SYS-STMT-P06 のテストが全て緑であること

## Workstream applicability

- Frontend: applicable: 画像との構成要素の対応と操作の流れ (ナビ・行の選択・負債入力・下書き・保存) を実画面で確かめる
- Backend: N/A: 本 phase は Backend の成果物を変更しない
- API: N/A: 本 phase は API の成果物を変更しない
- Data: N/A: 本 phase は Data の成果物を変更しない
- Infrastructure: N/A: 本 phase は Infrastructure の成果物を変更しない
- Security: N/A: 本 phase は Security の成果物を変更しない
- Quality: applicable: 受入の判定と根拠の実測値を記録する
- Documentation: N/A: 本 phase は Documentation の成果物を変更しない
- Operations: N/A: 本 phase は Operations の成果物を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Deploy unit/environment: N/A: テストコードのみで配信単位を持たない
- Compatibility/migration/backfill: N/A: 本 phase は migration を適用しない

## 成果物

- Produced artifacts:
- docs/statements-screen.md
- Consumed artifacts:
- specs/spec-statements-screen.md
- packages/web/src/pages/Statements.tsx
- Write scope/touches:
- docs/statements-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-STMT-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-STMT-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-STMT-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-STMT-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (投資 CF と財務 CF の区分、区分対応表の利用者による上書き、下書きのサーバ保存、共通シェルの構造変更、既存 audit_log の action 拡張、他画面の作り直しと web 以外のプラットフォーム)
- 品質ゲート全体の維持 (P09 が行う)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web test
- pnpm --filter @kanjo/web run check:financial-routes
- Required evidence:
- docs/statements-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 判定記録を revert する。差し戻しは該当 phase へ戻す。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-statements-auth, arch-statements-backend, arch-statements-database, arch-statements-frontend, arch-statements-infrastructure, arch-statements-maintenance-ops, arch-statements-security, arch-statements-ui-ux, spec-statements-screen
- Feature: feat-statements-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-STMT-P06
