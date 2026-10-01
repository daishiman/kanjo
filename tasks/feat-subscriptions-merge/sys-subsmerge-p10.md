---
graph_node_id: "SYS-SUBSMERGE-P10"
artifact_kind: "task"
artifact_subtypes: []
title: "独立最終レビュー"
project_id: "feature-package-feat-subscriptions-merge"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["subscriptions-merge", "p10", "independent-review"]
file_path: "tasks/feat-subscriptions-merge/sys-subsmerge-p10.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-subscriptions-merge/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-30T15:37:43Z", "origin_kind": "system-dev-planner", "source_digest": "c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8", "source_path": ".dev-graph/plans/feature-package-feat-subscriptions-merge/task-specs/phase-10-final-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-30T15:37:43Z"
updated_at: "2026-09-30T15:37:43Z"
depends_on: ["SYS-SUBSMERGE-P09"]
related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
resource_scope: ["docs/subscriptions-screen.md", "packages/core/src/subscription-operation.ts", "packages/api/src/subscription-restore-barrier.ts", "packages/core/src/types.ts"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-subscriptions-merge"
feature_package_id: "feature-package/feat-subscriptions-merge"
phase_ref: "P10"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-subscriptions-merge/sys-subsmerge-p10.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-c2t.10", "linked_at": "2026-09-30T15:51:55Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-30T15:19:39Z", "missing_sections": [], "status": "complete"}
---

# 独立最終レビュー

## Machine-readable registration fields

本 task の frontmatter が登録情報・依存・担当範囲・完了状態の唯一の正本。本文へ値を複製しない。frontmatter の resource_scope にある旧設計の候補パスは実装ファイルの存在を保証しない。現行の配置は spec「確定した実装契約」を参照する。

## 目的

変更の全体を spec と照らして独立にレビューし、結果を記録する。

## 背景

実装者と別の視点で、要件の取りこぼしと範囲外の変更が無いかを確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge, SYS-SUBSMERGE-P09
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-SUBSMERGE-P09 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: resource_scope の外のファイルに変更が無いことを git status で確かめる。

## Workstream applicability

- Frontend: N/A: 本 phase の責務に含まれない
- Backend: N/A: 本 phase の責務に含まれない
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Deploy unit/environment: N/A: レビュー記録のみで配布物を持たない
- Compatibility/migration/backfill: コードと表の変更を伴わない

## 成果物

- Produced artifacts:
- docs/subscriptions-screen.md
- Consumed artifacts:
- migrations/0058_subscription_merge_operations.sql
- packages/core/src/subs.ts
- packages/core/src/subs-screen.ts
- packages/core/src/dataset.ts
- packages/core/src/expense-projection.ts
- packages/core/src/index.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/import-active.ts
- packages/api/src/import-lifecycle.ts
- packages/api/src/store.ts
- packages/api/src/subscription-writes.ts
- packages/api/src/routes/subs.ts
- packages/api/src/routes/imports.ts
- packages/api/src/routes/settings.ts
- packages/api/src/index.ts
- packages/api/src/index.test.ts
- packages/api/src/deletion-schema.test.ts
- packages/api/src/import-lifecycle-pure.test.ts
- packages/web/src/api.ts
- packages/web/src/api-client.ts
- packages/web/src/components/Page.tsx
- packages/web/src/pages/Subscriptions.tsx
- packages/web/src/pages/subscriptions/
- packages/web/src/pages/import/import-test-fakes.ts
- packages/web/src/diagnosis-next-action-receivers.dom.test.tsx
- packages/web/src/mobile-financial-visualization.dom.test.tsx
- packages/core/test/subs-contract.test.ts
- packages/core/test/subs-screen-contract.test.ts
- packages/api/src/subs-screen.integration.test.ts
- packages/api/src/subs-merge-operations.integration.test.ts
- packages/api/src/subs-vendor-scope.test.ts
- packages/api/src/expense-projection.integration.test.ts
- packages/web/src/subscriptions-screen.dom.test.tsx
- Write scope/touches:
- docs/subscriptions-screen.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P10 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P10 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P10 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBSMERGE-P09) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- FR-001〜023・BR-001〜013・AC-001〜023 の各項目が実装とテストのどこで満たされたかの対応が記録されている。
- resource_scope の外への変更が 0 件であることが記録されている。
- 指摘があれば解消が記録されている。
- Automated commands:
- pnpm test
- pnpm typecheck
- Required evidence:
- docs/subscriptions-screen.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 記録の追記を revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-subscriptions-merge.md
- Architecture: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Feature: feat-subscriptions-merge
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-SUBSMERGE-P09
