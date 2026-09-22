---
artifact_kind: "task"
artifact_subtypes: []
beads_linkage: null
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-tradeoff-screen/sys-tradeoff-p08.md", "confidence": 0.95}]
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
confirmation_evidence: {"evaluated_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-tradeoff-screen/plan-findings.json"}
confirmation_status: "confirmed"
created_at: "2026-09-21T22:58:32Z"
depends_on: ["SYS-TRADEOFF-P07"]
domain: "quality"
evaluation_status: "pass"
execution_contexts: []
feature_package_id: "feature-package/feat-tradeoff-screen"
file_path: "tasks/feat-tradeoff-screen/sys-tradeoff-p08.md"
github_project_linkages: []
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
graph_node_id: "SYS-TRADEOFF-P08"
implementation_readiness: {"checked_at": "2026-09-21T22:55:00Z", "missing_sections": [], "status": "complete"}
issue_linkage: null
iteration: null
owners: ["daishiman"]
parent_feature: "feat-tradeoff-screen"
phase_ref: "P08"
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
source_lineage: {"imported_at": "2026-09-21T22:58:32Z", "origin_kind": "system-dev-planner", "source_digest": "385e3fbc2589b0988fa1257762c72f111d14e1a3618a3a144c7cb72e467b0748", "source_path": ".dev-graph/plans/feature-package-feat-tradeoff-screen/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
start_date: null
status: "active"
tags: ["tradeoff", "p08", "audit"]
target_date: null
template_id: "task"
template_version: "1.0.0"
title: "試算の式の重複・旧参照・migration の読取専用監査"
tracker_binding: "beads"
updated_at: "2026-09-21T22:58:32Z"
---

# 試算の式の重複・旧参照・migration の読取専用監査

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-tradeoff-screen
- owners: ["daishiman"]
- tags: ["tradeoff", "p08", "audit"]
- related_nodes: ["arch-tradeoff-auth", "arch-tradeoff-backend", "arch-tradeoff-database", "arch-tradeoff-frontend", "arch-tradeoff-infrastructure", "arch-tradeoff-maintenance-ops", "arch-tradeoff-security", "arch-tradeoff-ui-ux", "spec-tradeoff-screen"]
- parent_feature: feat-tradeoff-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-tradeoff-screen/sys-tradeoff-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

web と api に試算の式 (×12・差額) の重複が無いこと、旧 Tradeoff.tsx の参照と保存一覧・突合の UI が残っていないこと、migration 0050 が追加のみであることを読取専用で監査する。

## 背景

core を唯一の計算源にするのが O2 の条件で、重複は実装中に紛れ込みやすい。既存の tradeoffCandidates・defenseLine・tradeoffReview の数字は変えないので、その差分が無いことも照合する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen, SYS-TRADEOFF-P07
- Entry gate: staging run run-tradeoff-20260921T2250Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 旧参照の残存を検査する
- Backend: applicable: 式の重複を検査する
- API: applicable: 経路の旧形の残存を検査する
- Data: applicable: migration が追加のみであることを検査する
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: security は P09
- Quality: applicable: 監査結果を記録する
- Documentation: applicable: 監査記録を docs へ残す
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Deploy unit/environment: N/A: 読取専用監査のみ
- Compatibility/migration/backfill: N/A: 監査のみ

## 成果物

- Produced artifacts:
- docs/tradeoff-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/tradeoff-screen.ts
- packages/api/src/routes/analytics.ts
- migrations/0050_tradeoff_notes.sql
- Write scope/touches:
- docs/tradeoff-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TRADEOFF-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TRADEOFF-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TRADEOFF-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TRADEOFF-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (共通シェルの作り直し、保存済みの試算の一覧と翌月の突合の画面表示、アプリからの LLM 呼び出し、既存の tradeoff_plans の行やテーブルの削除・書換、既存の defenseLine・tradeoffCandidates・診断検知器の数字の変更、画像の数値の再現と web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- rg で web と api の ×12・差額の式が 0 件であることが記録されている。
- 既存の tradeoffCandidates・defenseLine・tradeoffReview の数字と既存テストに差分が無いことが git diff と照合されている。
- migration 0050 に UPDATE / DELETE / DROP が無いことが記録されている。
- Automated commands:
- rg による試算の式の重複・旧参照の検査
- P06 / P07 の証跡と git diff の照合
- Required evidence:
- docs/tradeoff-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 監査記録に誤りがあれば docs の追記だけを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-tradeoff-screen.md
- Architecture: arch-tradeoff-auth, arch-tradeoff-backend, arch-tradeoff-database, arch-tradeoff-frontend, arch-tradeoff-infrastructure, arch-tradeoff-maintenance-ops, arch-tradeoff-security, arch-tradeoff-ui-ux, spec-tradeoff-screen
- Feature: feat-tradeoff-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TRADEOFF-P07
