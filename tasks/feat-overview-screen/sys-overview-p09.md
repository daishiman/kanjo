---
graph_node_id: "SYS-OVERVIEW-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "アクセシビリティ・CSP・初期JS予算・可観測性の保証確認"
project_id: "feature-package-feat-overview-screen"
domain: "security"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["overview-screen", "p09", "quality-assurance"]
file_path: "tasks/feat-overview-screen/sys-overview-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-overview-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-14T13:55:29Z", "origin_kind": "system-dev-planner", "source_digest": "ad6e8d16a4a5305d14208af616047b4a1cb1b1f43cd4de3baa4cc5db30521cb6", "source_path": ".dev-graph/plans/feature-package-feat-overview-screen/task-specs/phase-09-quality-assurance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-14T13:55:29Z"
updated_at: "2026-09-14T13:55:29Z"
depends_on: ["SYS-OVERVIEW-P08"]
related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
resource_scope: ["docs/overview-screen/assurance.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-overview-screen"
feature_package_id: "feature-package/feat-overview-screen"
phase_ref: "P09"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-overview-screen/sys-overview-p09.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-8c2.9", "linked_at": "2026-09-14T14:18:42Z", "sync_state": "synced"}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-14T13:41:44Z", "missing_sections": [], "status": "complete"}
---

# アクセシビリティ・CSP・初期JS予算・可観測性の保証確認

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-overview-screen
- owners: ["daishiman"]
- tags: ["overview-screen", "p09", "quality-assurance"]
- related_nodes: ["arch-overview-auth", "arch-overview-backend", "arch-overview-database", "arch-overview-frontend", "arch-overview-infrastructure", "arch-overview-maintenance-ops", "arch-overview-security", "arch-overview-ui-ux", "spec-overview-screen"]
- parent_feature: feat-overview-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-overview-screen/sys-overview-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

WCAG 2.2 AA・CSP connect-src 'self'・初期JS 110KiB予算・可観測性 (reviewed_at/reviewed_by_user_id記録) の非機能要件を保証確認する。

## 背景

spec-overview-screen.mdの非機能要件節はPerformance (110KiB予算)・Accessibility (WCAG 2.2 AA、role=status/alert)・Security (外部送信なし) を要求する。architecture/overview-screen-security.md と architecture/overview-screen-infrastructure.md に従う。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Entry gate: SYS-OVERVIEW-P08が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: role=status (件数変化)・role=alert (防衛予測警告)・320pxで横スクロールなし (WCAG 1.4.10) を確認する
- Backend: N/A: 非機能保証はweb/APIの観測対象で、core自体の変更はない
- API: applicable: 月次レビューのreviewed_at/reviewed_by_user_idが記録されることを確認する
- Data: N/A: データモデルの保証確認はP08で完了済み
- Infrastructure: applicable: pnpm --filter @kanjo/web run check:js-budgetで初期JS 110KiB予算内であることを確認する
- Security: applicable: CSP connect-src 'self'が維持されることをpackages/api/src/index.test.tsのCSP差分検査で確認する
- Quality: applicable: check-financial-visuals.mjsのOverview 8幅描画exit 0 (AC-005) を確認する
- Documentation: applicable: docs/overview-screen/assurance.mdへ保証結果を記録する
- Operations: applicable: 既存Workerログの範囲に留まることを確認する

## Architecture and deploy unit

- Architecture decisions: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Deploy unit/environment: N/A: 既存のCloudflare Workers/D1配信構成のまま追加の配布物を持たない
- Compatibility/migration/backfill: N/A: 保証確認のみでコードを変更しない

## 成果物

- Produced artifacts:
- docs/overview-screen/assurance.md
- Consumed artifacts:
- packages/web/scripts/check-financial-visuals.mjs
- packages/web/scripts/check-initial-js-budget.mjs
- packages/api/src/index.test.ts
- Write scope/touches:
- docs/overview-screen/assurance.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-OVERVIEW-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-OVERVIEW-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-OVERVIEW-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-OVERVIEW-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (専用アプリ・AI/LLMによる推定・分類アルゴリズムの変更・概況以外の19画面の作り替え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web run check:financial-routes
- pnpm --filter @kanjo/web run check:js-budget
- pnpm --filter @kanjo/api exec vitest run src/index.test.ts
- pnpm run security:content
- Required evidence:
- docs/overview-screen/assurance.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/overview-screen/assurance.md の追加コミットを revert する。保証確認のみのためコード側の巻き戻しは不要。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-overview-auth, arch-overview-backend, arch-overview-database, arch-overview-frontend, arch-overview-infrastructure, arch-overview-maintenance-ops, arch-overview-security, arch-overview-ui-ux, spec-overview-screen
- Feature: feat-overview-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-OVERVIEW-P08
