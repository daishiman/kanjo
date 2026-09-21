---
graph_node_id: "SYS-AI-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "段階判定の重複・旧参照の読取専用監査"
project_id: "feature-package-feat-ai-analysis-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["ai-analysis", "p08", "audit"]
file_path: "tasks/feat-ai-analysis-screen/sys-ai-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "dede168b82fcdec85ff00d13378d586344ebdd90747d5ea9bd779c6a825d5405", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-ai-analysis-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-19T13:50:42Z", "origin_kind": "system-dev-planner", "source_digest": "dede168b82fcdec85ff00d13378d586344ebdd90747d5ea9bd779c6a825d5405", "source_path": ".dev-graph/plans/feature-package-feat-ai-analysis-screen/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-19T13:50:42Z"
updated_at: "2026-09-19T13:50:42Z"
depends_on: ["SYS-AI-P07"]
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
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-ai-analysis-screen/sys-ai-p08.md", "confidence": 0.95}]
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

# 段階判定の重複・旧参照の読取専用監査

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-ai-analysis-screen
- owners: ["daishiman"]
- tags: ["ai-analysis", "p08", "audit"]
- related_nodes: ["arch-ai-analysis-auth", "arch-ai-analysis-backend", "arch-ai-analysis-database", "arch-ai-analysis-frontend", "arch-ai-analysis-infrastructure", "arch-ai-analysis-maintenance-ops", "arch-ai-analysis-security", "arch-ai-analysis-ui-ux", "spec-ai-analysis-screen"]
- parent_feature: feat-ai-analysis-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-ai-analysis-screen/sys-ai-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

段階の判定が core の 1 か所以外に残っていないこと、旧 Ai.tsx の直参照と使われない部品が残っていないことを読取専用で監査する。

## 背景

画面側や route 側に段階の条件分岐が残ると、表示と拒否が再び食い違う。監査はコードを変えずに行い、見つかれば P05 へ差し戻す。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen, SYS-AI-P07
- Entry gate: staging run run-ai-analysis-20260919T1339Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase では扱わない
- Backend: N/A: 本 phase では扱わない
- API: N/A: 本 phase では扱わない
- Data: N/A: 本 phase では扱わない
- Infrastructure: N/A: 基盤は変更しない
- Security: N/A: 本 phase では扱わない
- Quality: applicable: 重複と旧参照を検査する
- Documentation: applicable: 監査結果を記録する
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Deploy unit/environment: N/A: 読取専用監査のみ
- Compatibility/migration/backfill: N/A: 監査のみ

## 成果物

- Produced artifacts:
- docs/ai-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/ai-screen.ts
- packages/core/src/index.ts
- packages/core/src/exports.ts
- packages/api/src/routes/ai.ts
- packages/api/src/ai/dataset.ts
- packages/api/src/ai/period.ts
- packages/api/src/ai/catalog.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/index.ts
- packages/api/src/auth.ts
- migrations/0048_ai_task_stages.sql
- packages/web/src/api.ts
- packages/web/src/pages/Ai.tsx
- packages/web/src/pages/ai/
- packages/web/src/period.tsx
- packages/web/src/ai-copy-log.dom.test.tsx
- packages/web/src/ai-report-archive.dom.test.tsx
- packages/web/src/ai-report-structure.dom.test.tsx
- packages/web/src/ai-task-collapse.dom.test.tsx
- Write scope/touches:
- docs/ai-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-AI-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-AI-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-AI-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-AI-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (アプリからの LLM 呼び出し、依頼の自動送信、キュー・外部ストレージ・LLM の鍵の導入、レポート JSON 契約 v3、ヘッダー、既存の依頼・レポート行の書き換え、新しいログイン手段・長期トークン・secret・binding・外部サービスの登録、web 以外のプラットフォーム)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 段階の条件分岐が core/src/ai-screen.ts 以外に 0 件である。
- 旧 Ai.tsx の直参照が 0 件である。
- Automated commands:
- rg による段階判定の重複・旧参照の検査
- P06 / P07 の証跡と git diff の照合
- Required evidence:
- docs/ai-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 監査記録に誤りがあれば docs の追記だけを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-ai-analysis-screen.md
- Architecture: arch-ai-analysis-auth, arch-ai-analysis-backend, arch-ai-analysis-database, arch-ai-analysis-frontend, arch-ai-analysis-infrastructure, arch-ai-analysis-maintenance-ops, arch-ai-analysis-security, arch-ai-analysis-ui-ux, spec-ai-analysis-screen
- Feature: feat-ai-analysis-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-AI-P07
