---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-tradeoff-screen/sys-tradeoff-p13.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-tradeoff-screen/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T22:58:32Z"
depends_on: ["SYS-TRADEOFF-P12"]
domain: "operations"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-tradeoff-screen"
file_path: "tasks/feat-tradeoff-screen/sys-tradeoff-p13.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-TRADEOFF-P13"
implementation_readiness: {"checked_at": "2026-09-21T22:55:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-tradeoff-screen"
phase_ref: "P13"
priority: null
project_id: "feature-package-feat-tradeoff-screen"
pull_request_linkages: []
related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
resource_scope: ["docs/tradeoff-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
source_lineage: {"imported_at": "2026-09-21T22:58:32Z", "origin_kind": "system-dev-planner", "source_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "source_path": ".dev-graph/plans/feature-package-feat-tradeoff-screen/task-specs/phase-13-release-deploy.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["tradeoff", "p13", "release"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "単一 PR での配信と migration 0050 の適用とクローズアウト"
tracker_binding: "beads"
updated_at: "2026-09-21T22:58:32Z"
---

# 単一 PR での配信と migration 0050 の適用とクローズアウト

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-tradeoff-screen
- owners: ["daishiman"]
- tags: ["tradeoff", "p13", "release"]
- related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
- parent_feature: feat-tradeoff-screen
- phase_ref: P13
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-tradeoff-screen/sys-tradeoff-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

単一の PR で web・Worker・migration 0050 を配信し、Migrate → Deploy の順で反映し、feature をクローズする。

## 背景

0050 は列と表の追加だけなので、適用後に旧 Worker が動いても新しい列を読まないだけで壊れない。migration 番号はマージ時点の最新 +1 に付け替え、EXPECTED_D1_MIGRATION も同じ値にする。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen, SYS-TRADEOFF-P12
- Entry gate: staging run run-tradeoff-20260921T2250Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 配信のみ
- Backend: N/A: 配信のみ
- API: N/A: 配信のみ
- Data: applicable: migration 0050 を Migrate で適用する
- Infrastructure: applicable: 既存の Migrate → Deploy の順で反映する
- Security: N/A: 配信のみ
- Quality: applicable: 配信後に全テストが緑であることを確認する
- Documentation: N/A: docs は P12
- Operations: applicable: 配信とクローズアウトを行う

## Architecture and deploy unit

- Architecture decisions: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Deploy unit/environment: web ビルドと Worker と D1 migration (単一 PR で同時に配信する)
- Compatibility/migration/backfill: 0050 は追加のみ。番号の付け替えはマージ直前に origin/main を fetch して行う

## 成果物

- Produced artifacts:
- docs/tradeoff-screen/design-decisions.md
- Consumed artifacts:
- docs/tradeoff-screen/design-decisions.md
- docs/tradeoff-screen/evidence.md
- Write scope/touches:
- docs/tradeoff-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRADEOFF-P13 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRADEOFF-P13 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRADEOFF-P13 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRADEOFF-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの作り直し、保存済みの試算の一覧と翌月の突合の画面表示、アプリからの LLM 呼び出し、既存の tradeoff_plans の行やテーブルの削除・書換、既存の defenseLine・tradeoffCandidates・診断検知器の数字の変更、画像の数値の再現と web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- PR が default branch へ merge され、Migrate と Deploy が成功している。
- migration 0050 の適用で既存の tradeoff_plans 行の更新が 0 件である。
- feature の受入 S1〜S6 がすべて PASS の証跡で揃っている。
- Automated commands:
- pnpm test
- pnpm typecheck
- Required evidence:
- docs/tradeoff-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: PR を revert して直前のビルドへ戻す。0050 は追加のみの列と表なので削除しない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-tradeoff-screen.md
- Architecture: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Feature: feat-tradeoff-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRADEOFF-P12
