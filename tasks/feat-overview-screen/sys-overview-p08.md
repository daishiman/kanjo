---
graph_node_id: "SYS-OVERVIEW-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "migration 0040 の前進のみ整合とバックアップ/復元対象の整理"
project_id: "feature-package-feat-overview-screen"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["overview-screen", "p08", "refactoring-migration"]
file_path: "tasks/feat-overview-screen/sys-overview-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-overview-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:55:29Z", "origin_kind": "system-dev-planner", "source_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "source_path": ".dev-graph/plans/feature-package-feat-overview-screen/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:55:29Z"
updated_at: "2026-09-14T13:55:29Z"
depends_on: ["SYS-OVERVIEW-P07"]
related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
resource_scope: ["packages/api/src/store.ts", "docs/overview-screen/refactoring.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-overview-screen"
feature_package_id: "feature-package/feat-overview-screen"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-overview-screen/sys-overview-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-8c2.8", "linked_at": "2026-09-14T14:18:42Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:41:44Z", "missing_sections": [], "status": "complete"}
---

# migration 0040 の前進のみ整合とバックアップ/復元対象の整理

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p08", "refactoring-migration"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

review_snoozes/monthly_close_reviews追加後もBACKUP_SNAPSHOT_SQLとloadBackupSourceSnapshotのparam数・UNION ALL構成が一致し、migrations/0040がCREATE ONLYの前進のみであることを確定する。goal-specの指示によりP08はD1 migrationが存在するためN/Aにしない。

## 背景

goal-spec.jsonは「P08/P13はapplicabilityに従い、D1 migrationとCloudflare deployがあるのでN/Aにしない方向で内容を判断する」と明示する。migrations/0040でreview_snoozes/monthly_close_reviewsを追加するため、packages/api/src/store.tsのBACKUP_SNAPSHOT_SQLとloadBackupPayloadへの反映漏れがないかを本taskで再点検する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P07が完了し、acceptance.mdのAC-004検証が記録済みであること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: フロントエンドコードは変更しない
- Backend: applicable: packages/api/src/store.tsのバックアップ/復元経路を再点検・整理する
- API: N/A: エンドポイント自体はP05で実装済みで変更しない
- Data: applicable: migrations/0040がDROP/RENAMEを含まずCREATE TABLE/INDEXのみであることを確認する
- Infrastructure: N/A: 配信構成の変更はない
- Security: N/A: 認可制御はP05で実装済み
- Quality: applicable: pnpm --filter @kanjo/api testのバックアップ関連テストが引き続きgreenであることを確認する
- Documentation: applicable: docs/overview-screen/refactoring.mdへ点検結果を記録する
- Operations: N/A: 運用手順はP12/P13の責務

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: N/A: 既存のCloudflare Workers/D1配信構成のまま追加の配布物を持たない
- Compatibility/migration/backfill: migrations/0040はCREATEのみで既存データのバックフィルは不要 (spec-overview-screen.md データモデル節)

## 成果物

- Produced artifacts:
- packages/api/src/store.ts
- docs/overview-screen/refactoring.md
- Consumed artifacts:
- migrations/0040_review_snoozes_and_monthly_close_reviews.sql
- packages/api/src/db/schema.ts
- Write scope/touches:
- packages/api/src/store.ts
- docs/overview-screen/refactoring.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/api test
- pnpm run github-scripts:test
- Required evidence:
- packages/api/src/store.ts
- docs/overview-screen/refactoring.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: packages/api/src/store.tsへの変更コミットをrevertする。docs/overview-screen/refactoring.mdの追加コミットをrevertする。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P07
