---
graph_node_id: "SYS-BUDGET-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "アクセシビリティ・入力検証・変更系フェンス・外部送信ゼロ・JS バンドル予算の保証確認"
project_id: "feature-package-feat-budget-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["budget-screen", "p09", "quality-assurance"]
file_path: "tasks/feat-budget-screen/sys-budget-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "feeba81f7451b59df51e3830e506ace921410eada67b4f6494010ec6bf19a067", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-budget-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-21T14:49:37Z", "origin_kind": "system-dev-planner", "source_digest": "feeba81f7451b59df51e3830e506ace921410eada67b4f6494010ec6bf19a067", "source_path": ".dev-graph/plans/feature-package-feat-budget-screen/task-specs/phase-09-quality-assurance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-21T14:49:37Z"
updated_at: "2026-09-21T14:49:37Z"
depends_on: ["SYS-BUDGET-P08"]
related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
resource_scope: ["docs/budget-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-budget-screen"
feature_package_id: "feature-package/feat-budget-screen"
phase_ref: "P09"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-budget-screen/sys-budget-p09.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-21T15:00:00Z", "missing_sections": [], "status": "complete"}
---

# アクセシビリティ・入力検証・変更系フェンス・外部送信ゼロ・JS バンドル予算の保証確認

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-budget-screen
- owners: ["daishiman"]
- tags: ["budget-screen", "p09", "quality-assurance"]
- related_nodes: ["arch-budget-auth", "arch-budget-backend", "arch-budget-database", "arch-budget-frontend", "arch-budget-infrastructure", "arch-budget-maintenance-ops", "arch-budget-security", "arch-budget-ui-ux", "spec-budget-screen"]
- parent_feature: feat-budget-screen
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-budget-screen/sys-budget-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

アクセシビリティ・入力検証・変更系フェンス・外部送信ゼロ・JS バンドル予算を保証する。

## 背景

build:bundle 直後の js-budget が予算内であることと、BR-17 の境界値が 400 で拒否されることを確認する。年額の下限が未確定である旨を open item として明記したまま、zod と migration の CHECK 制約の一致だけを確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Entry gate: staging run run-feat-budget-screen-20260921T142755Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
Open risk: 年額の下限は未確定のため、本 task では現状実装の zod と migration CHECK 制約が一致していることの確認に留め、下限値そのものの決定は行わない。

## Workstream applicability

- Frontend: applicable: アクセシビリティと JS バンドル予算を確認する
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: applicable: 入力検証とフェンスを確認する
- Quality: applicable: 保証確認を行う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Deploy unit/environment: N/A: 保証確認の記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 保証確認のみ

## 成果物

- Produced artifacts:
- docs/budget-screen/design-decisions.md
- Consumed artifacts:
- packages/web/src/pages/budget/
- packages/api/src/routes/budget-plans.ts
- Write scope/touches:
- docs/budget-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-BUDGET-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-BUDGET-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-BUDGET-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-BUDGET-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-budget-screen.context.json の scope_out (予算の版管理・担当者・承認フロー、外部 LLM による提案と外部データ、個人 (家計) の予算、共通シェルの作り直し、トレードオフ画面、web 以外の専用アプリ、旧 API (GET/PUT /api/budgets・POST /api/budgets/suggest) の削除、既存 budgets 表の削除・書き換え)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- build:bundle 直後の js-budget が予算内である (/budget は既存の lazy route のまま初期 JS に含まれない)。
- 年額・調整額の ±10,000,000,000 以内、科目名 1〜60 字、理由 100 字以内、1 回の保存 1〜200 行の境界が 400 で拒否される (BR-17)。年額の下限を 0 未満まで許容する現状の実装 (open item: 年額の下限は未確定) が zod と migration の CHECK 制約で一致していることが確認されている。
- PUT /api/budget-plans が canonicalMutationFence に登録され、フェンス違反が 409 になる。
- 外部への送信が 0 件である (fetch の宛先が同一オリジンの /api だけ、AT-22)。
- 差額・過不足・予算純収支・防衛ライン余裕が色だけで区別されず、符号と文言が併記される。画面に『AI』の文字列が無い (AT-12)。
- Automated commands:
- pnpm --filter @kanjo/web build:bundle
- pnpm --filter @kanjo/web js-budget
- Required evidence:
- docs/budget-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-budget-screen.md
- Architecture: arch-budget-auth, arch-budget-backend, arch-budget-database, arch-budget-frontend, arch-budget-infrastructure, arch-budget-maintenance-ops, arch-budget-security, arch-budget-ui-ux, spec-budget-screen
- Feature: feat-budget-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-BUDGET-P08
