---
graph_node_id: "SYS-IMPORT-P11"
artifact_kind: "task"
artifact_subtypes: []
title: "再現可能な証跡索引の作成"
project_id: "feature-package-feat-import-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["import-screen", "p11", "evidence"]
file_path: "tasks/feat-import-screen/sys-import-p11.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "fa224df0033b3c1ab8a8b635f5b81cf08198f48aca9f810af472bf695fd896b4", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-import-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-21T23:18:31Z", "origin_kind": "system-dev-planner", "source_digest": "fa224df0033b3c1ab8a8b635f5b81cf08198f48aca9f810af472bf695fd896b4", "source_path": ".dev-graph/plans/feature-package-feat-import-screen/task-specs/phase-11-evidence.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-21T23:18:31Z"
updated_at: "2026-09-21T23:18:31Z"
depends_on: ["SYS-IMPORT-P10"]
related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
resource_scope: ["docs/import-screen/evidence.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-import-screen"
feature_package_id: "feature-package/feat-import-screen"
phase_ref: "P11"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-import-screen/sys-import-p11.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-21T23:14:02Z", "missing_sections": [], "status": "complete"}
---

# 再現可能な証跡索引の作成

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-import-screen
- owners: ["daishiman"]
- tags: ["import-screen", "p11", "evidence"]
- related_nodes: ["arch-import-screen-auth", "arch-import-screen-backend", "arch-import-screen-database", "arch-import-screen-frontend", "arch-import-screen-infrastructure", "arch-import-screen-maintenance-ops", "arch-import-screen-security", "arch-import-screen-ui-ux", "spec-import-screen"]
- parent_feature: feat-import-screen
- phase_ref: P11
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-import-screen/sys-import-p11.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04〜P10 の証跡 (テスト結果・監査・レビュー・メモリの実測) を再現手順つきで索引にまとめる。

## 背景

受入は実行済みの最新の証跡だけで判定するため、どのコミットでどのコマンドを実行したかを辿れる索引を残す。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen, SYS-IMPORT-P10
- Entry gate: staging run run-import-screen-20260921T2311Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase では扱わない
- Backend: N/A: 本 phase では扱わない
- API: N/A: 本 phase では扱わない
- Data: N/A: 本 phase では扱わない
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 本 phase では扱わない
- Quality: applicable: 証跡の再現手順を確かめる
- Documentation: applicable: 索引を docs に置く
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Deploy unit/environment: N/A: 索引のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 記録のみ

## 成果物

- Produced artifacts:
- docs/import-screen/evidence.md
- Consumed artifacts:
- docs/import-screen/design-decisions.md
- Write scope/touches:
- docs/import-screen/evidence.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-IMPORT-P11 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-IMPORT-P11 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-IMPORT-P11 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-IMPORT-P10) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (銀行・クレジットカードの明細ファイルの取り込みと、その対応サービスの案内、共通シェル、freee / マネーフォワードの API との自動連携、既存の取込形式、既存の imports と明細の行の書き換え、取消・破棄・差分プレビュー・手当ての継続再適用の規則そのものの変更、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 各証跡にコミットとコマンドが付いている。
- Automated commands:
- pnpm lint (既存の文書検査が緑のままであることを確認する)
- Required evidence:
- docs/import-screen/evidence.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 索引の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-import-screen.md
- Architecture: arch-import-screen-auth, arch-import-screen-backend, arch-import-screen-database, arch-import-screen-frontend, arch-import-screen-infrastructure, arch-import-screen-maintenance-ops, arch-import-screen-security, arch-import-screen-ui-ux, spec-import-screen
- Feature: feat-import-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-IMPORT-P10
