---
graph_node_id: "SYS-DSFOUND-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "全テスト・型検査・lint の実行記録"
project_id: "feature-package-feat-design-system-foundation"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["design-system-foundation", "p06", "test-run"]
file_path: "tasks/feat-design-system-foundation/sys-dsfound-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-design-system-foundation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-13T08:47:51Z", "origin_kind": "system-dev-planner", "source_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "source_path": ".dev-graph/plans/feature-package-feat-design-system-foundation/task-specs/phase-06-test-run.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-13T08:47:51Z"
updated_at: "2026-09-13T09:08:37Z"
depends_on: ["SYS-DSFOUND-P12"]
related_nodes: ["spec-design-system-foundation", "arch-design-system-maintenance-ops"]
resource_scope: ["docs/design-system/test-run.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-design-system-foundation"
feature_package_id: "feature-package/feat-design-system-foundation"
phase_ref: "P06"
lifecycle_role: "final-verification"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-design-system-foundation/sys-dsfound-p06.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-5kq.6", "linked_at": "2026-09-13T09:08:37Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-13T08:30:17Z", "missing_sections": [], "status": "complete"}
---

# 全テスト・型検査・lint の実行記録

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p06", "test-run"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-maintenance-ops"]
- parent_feature: feat-design-system-foundation
- phase_ref: P06
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p06.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 実装後の全既存チェックが green のままであることを実測し、S6 の根拠として記録する。

## 背景

specs/spec-design-system-foundation.md の S6 は既存の pnpm test / typecheck / lint と check 系4スクリプトが全て緑のままであることを求める。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-maintenance-ops
- Entry gate: 依存 task (SYS-DSFOUND-P12) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実装コードは変更しない
- Backend: N/A: 実装コードは変更しない
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: N/A: 配信構成を変更しない
- Security: N/A: CSP・認可は変更しない
- Quality: applicable: 本 task の中心責務。全チェックの実測結果を記録する
- Documentation: applicable: test-run.md を新規作成する
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-maintenance-ops
- Deploy unit/environment: N/A: 実行記録のみで配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- docs/design-system/test-run.md
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- docs/design-system/test-run.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P06 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P06 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P06 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P12) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm typecheck
- pnpm lint
- Required evidence:
- docs/design-system/test-run.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: test-run.md の記録のみを revert する。テスト自体への影響はない。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-maintenance-ops
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P12
