---
graph_node_id: "SYS-AI-P01"
artifact_kind: "task"
artifact_subtypes: []
title: "要件ベースライン確定と持ち越し事項の解決担当の割り当て"
project_id: "feature-package-feat-ai-analysis-screen"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["ai-analysis", "p01", "preparation"]
file_path: "tasks/feat-ai-analysis-screen/sys-ai-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "dede168b82fcdec85ff00d13378d586344ebdd90747d5ea9bd779c6a825d5405", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-ai-analysis-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-19T13:50:42Z", "origin_kind": "system-dev-planner", "source_digest": "dede168b82fcdec85ff00d13378d586344ebdd90747d5ea9bd779c6a825d5405", "source_path": ".dev-graph/plans/feature-package-feat-ai-analysis-screen/task-specs/phase-01-requirements.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-19T13:50:42Z"
updated_at: "2026-09-19T13:50:42Z"
depends_on: []
related_nodes: ["arch-ai-analysis-auth", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-frontend", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops", "arch-ai-analysis-security", "arch-ai-analysis-ui-ux", "spec-ai-analysis-screen"]
resource_scope: ["docs/ai-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-ai-analysis-screen"
feature_package_id: "feature-package/feat-ai-analysis-screen"
phase_ref: "P01"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-ai-analysis-screen/sys-ai-p01.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-19T13:45:00Z", "missing_sections": [], "status": "complete"}
---

# 要件ベースライン確定と持ち越し事項の解決担当の割り当て

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-ai-analysis-screen
- owners: ["daishiman"]
- tags: ["ai-analysis", "p01", "preparation"]
- related_nodes: ["arch-ai-analysis-auth", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-frontend", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops", "arch-ai-analysis-security", "arch-ai-analysis-ui-ux", "spec-ai-analysis-screen"]
- parent_feature: feat-ai-analysis-screen
- phase_ref: P01
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-ai-analysis-screen/sys-ai-p01.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

spec-ai-analysis-screen と feature の受入 S1〜S6 を、実装着手時点の要件ベースラインとして 1 枚に固定し、持ち越し事項 (OI-01〜OI-04) の解決担当 phase を割り当てる。

## 背景

AI分析画面はアプリが LLM を呼ばず、外部エージェントが使い捨てトークンで既存 API を呼ぶ構成を保つ。段階表示・取り消し・やり直し・版比較・渡すデータの範囲を画面で読めるようにするのが本サイクルの価値であり、レポート JSON 契約 v3 と skill は変えない。この境界を要件の最上位に置く。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Entry gate: staging run run-ai-analysis-20260919T1339Z の goal-spec.json が readiness_pin.status=complete であること
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

- Architecture decisions: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts:
- docs/ai-screen/design-decisions.md
- Consumed artifacts:
- specs/spec-ai-analysis-screen.md
- features/feat-ai-analysis-screen.md
- system-spec/00-requirements-definition.md
- Write scope/touches:
- docs/ai-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-AI-P01 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-AI-P01 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-AI-P01 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (なし) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入、レポート JSON 契約 v3、ヘッダー、既存の依頼・レポート行の書き換え、新しいログイン手段・長期トークン・secret・binding・外部サービスの登録、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 受入 S1〜S6 が検証可能な文に分解され docs/ai-screen/design-decisions.md に載っている。
- 持ち越し事項 OI-01〜OI-04 それぞれに解決担当 phase が割り当てられている。
- 『agent 推定・利用者未確認』の値が一覧になり、確認の担当 phase が決まっている。
- Automated commands:
- pnpm lint
- Required evidence:
- docs/ai-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs の追記を revert する。コードと表の変更を伴わない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-ai-analysis-screen.md
- Architecture: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Feature: feat-ai-analysis-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: なし
