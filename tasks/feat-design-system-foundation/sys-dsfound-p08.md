---
graph_node_id: "SYS-DSFOUND-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "COLOR_FALLBACKS と重複トークン値の除去"
project_id: "feature-package-feat-design-system-foundation"
domain: "frontend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["design-system-foundation", "p08", "refactoring"]
file_path: "tasks/feat-design-system-foundation/sys-dsfound-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-design-system-foundation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-13T08:47:51Z", "origin_kind": "system-dev-planner", "source_digest": "d9e77bf715718b82970a4664a1fce41d7ce136543f789e442bf0010338dc3887", "source_path": ".dev-graph/plans/feature-package-feat-design-system-foundation/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-13T08:47:51Z"
updated_at: "2026-09-13T09:08:40Z"
depends_on: ["SYS-DSFOUND-P05"]
related_nodes: ["spec-design-system-foundation", "arch-design-system-frontend"]
resource_scope: ["packages/web/src/components/charts.ts", "packages/web/src/styles.css", "docs/design-system/refactoring.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-design-system-foundation"
feature_package_id: "feature-package/feat-design-system-foundation"
phase_ref: "P08"
lifecycle_role: "mutation"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-design-system-foundation/sys-dsfound-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-5kq.8", "linked_at": "2026-09-13T09:08:40Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-13T08:30:17Z", "missing_sections": [], "status": "complete"}
---

# COLOR_FALLBACKS と重複トークン値の除去

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-design-system-foundation
- owners: ["daishiman"]
- tags: ["design-system-foundation", "p08", "refactoring"]
- related_nodes: ["spec-design-system-foundation", "arch-design-system-frontend"]
- parent_feature: feat-design-system-foundation
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり artifact_kind は task 以外に取り得ない、candidate tasks/feat-design-system-foundation/sys-dsfound-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P05 実装後に残る予備値の直書きと正本とのずれを除去し、FR-002 の直書き0件の範囲を COLOR_FALLBACKS 全体へ広げる。

## 背景

architecture/design-system-frontend.md は neutral と VENDOR_EXTRA_COLORS が CSS 変数を持たず直書きのみであることを課題として明記している。

## 前提条件

- Required spec/architecture/phase/task nodes: spec-design-system-foundation、arch-design-system-frontend
- Entry gate: 依存 task (SYS-DSFOUND-P05) が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 本 task の中心責務。charts.ts と styles.css の残存直書きを除去する
- Backend: N/A: packages/core は変更しない (P05 で新設済み)
- API: N/A: API を公開・変更しない
- Data: N/A: 永続化を変更しない
- Infrastructure: N/A: 配信構成を変更しない
- Security: N/A: CSP・認可は変更しない
- Quality: applicable: 置換後も P04 のテストが green であることを確認する
- Documentation: applicable: refactoring.md に除去内容を記録する
- Operations: N/A: 運用手順は P12/P13 の責務

## Architecture and deploy unit

- Architecture decisions: spec-design-system-foundation、arch-design-system-frontend
- Deploy unit/environment: N/A: 既存の Cloudflare Workers 配信構成のまま追加の配布物を持たない
- Compatibility/migration/backfill: CSS 変数名と charts.ts の公開関数を維持し、画面側の参照を壊さない (specs/spec-design-system-foundation.md 互換性・移行・リリース節)

## 成果物

- Produced artifacts:
- packages/web/src/components/charts.ts
- packages/web/src/styles.css
- docs/design-system/refactoring.md
- Consumed artifacts: specs/spec-design-system-foundation.md、architecture/design-system-*.md (8件)、design/FINAL-UI/spec/DESIGN-SYSTEM.md
- Write scope/touches:
- packages/web/src/components/charts.ts
- packages/web/src/styles.css
- docs/design-system/refactoring.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-DSFOUND-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-DSFOUND-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-DSFOUND-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-DSFOUND-P05) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- 各画面の中身 (表・カード・フォームの配置) を FINAL-UI の画像どおりに作り直すこと (次サイクル)
- 新機能の追加、API・データベースの変更、ネイティブアプリ、ダークテーマ、Web フォントの追加
- report-design-system (skills/report-design-system/assets/report.css、packages/core/src/report-css.ts) の配色移行

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web test
- pnpm lint
- pnpm --filter @kanjo/web run check:financial-figure
- Required evidence:
- packages/web/src/components/charts.ts
- packages/web/src/styles.css
- docs/design-system/refactoring.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: charts.ts・styles.css のリファクタリングコミットを revert し、P07 完了時点の状態へ戻す。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: spec-design-system-foundation、arch-design-system-frontend
- Feature: feat-design-system-foundation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-DSFOUND-P05
