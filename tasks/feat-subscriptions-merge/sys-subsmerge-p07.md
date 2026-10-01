---
graph_node_id: "SYS-SUBSMERGE-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受入基準 O1 から O4 と U5 の検証"
project_id: "feature-package-feat-subscriptions-merge"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["subscriptions-merge", "p07", "acceptance"]
file_path: "tasks/feat-subscriptions-merge/sys-subsmerge-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-subscriptions-merge/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-30T15:37:43Z", "origin_kind": "system-dev-planner", "source_digest": "c7490d24a113ff369d24716501692dc5364f49a8b5d6aa7179e368a49d1a36d8", "source_path": ".dev-graph/plans/feature-package-feat-subscriptions-merge/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-30T15:37:43Z"
updated_at: "2026-09-30T15:37:43Z"
depends_on: ["SYS-SUBSMERGE-P06"]
related_nodes: ["arch-subscriptions-merge-auth", "arch-subscriptions-merge-backend", "arch-subscriptions-merge-database", "arch-subscriptions-merge-frontend", "arch-subscriptions-merge-infrastructure", "arch-subscriptions-merge-maintenance-ops", "arch-subscriptions-merge-security", "arch-subscriptions-merge-ui-ux", "spec-subscriptions-merge"]
resource_scope: ["docs/subscriptions-screen.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-subscriptions-merge"
feature_package_id: "feature-package/feat-subscriptions-merge"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-subscriptions-merge/sys-subsmerge-p07.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: {"bd_issue_id": "kanjo-c2t.7", "linked_at": "2026-09-30T15:51:55Z", "sync_state": "synced", "github_mirror": null}
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-30T15:19:39Z", "missing_sections": [], "status": "complete"}
---

# 受入基準 O1 から O4 と U5 の検証

## Machine-readable registration fields

本 task の frontmatter が登録情報・依存・担当範囲・完了状態の唯一の正本。本文へ値を複製しない。frontmatter の resource_scope にある旧設計の候補パスは実装ファイルの存在を保証しない。現行の配置は spec「確定した実装契約」を参照する。

## 目的

feature の受入基準 O1〜O4・U5 を、テストと実際の画面で確かめて記録する。

## 背景

テストが緑でも、画面で統合元が消えるか・同時の操作が収束するかは利用者の目で確かめる必要がある。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge, SYS-SUBSMERGE-P06
- Entry gate: staging run plan-feat-subscriptions-merge-20260930T1525Z の goal-spec.json が readiness_pin.status=complete であること、かつ SYS-SUBSMERGE-P06 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json と利用者の例外承認 docs/evidence/subscriptions-merge/spec-evaluation-waiver.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
制約: 本番のデータや実データを検証に使わない。ローカルの seed と匿名化済みの samples だけを使う。

## Workstream applicability

- Frontend: applicable: 本 phase の副次責務として扱う
- Backend: applicable: 本 phase の副次責務として扱う
- API: N/A: 本 phase の責務に含まれない
- Data: N/A: 本 phase の責務に含まれない
- Infrastructure: N/A: 本 phase の責務に含まれない
- Security: N/A: 本 phase の責務に含まれない
- Quality: applicable: 本 phase の主責務として扱う
- Documentation: N/A: 本 phase の責務に含まれない
- Operations: N/A: 本 phase の責務に含まれない

## Architecture and deploy unit

- Architecture decisions: arch-subscriptions-merge-auth, arch-subscriptions-merge-backend, arch-subscriptions-merge-database, arch-subscriptions-merge-frontend, arch-subscriptions-merge-infrastructure, arch-subscriptions-merge-maintenance-ops, arch-subscriptions-merge-security, arch-subscriptions-merge-ui-ux, spec-subscriptions-merge
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: コードと表の変更を伴わない

## 成果物

- Produced artifacts:
- docs/subscriptions-screen.md
- Consumed artifacts:
- docs/subscriptions-screen.md
- specs/spec-subscriptions-merge.md
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
- PR body contract: dev-graph graph_node_id SYS-SUBSMERGE-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-SUBSMERGE-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-SUBSMERGE-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-SUBSMERGE-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- features/feat-subscriptions-merge.context.json の scope_out (他画面のデザインの作り直し、取込方式の変更、未照合明細の算入、AI による自動統合、Web 以外の専用アプリ、DO・Queues・新しい有料サービス・新しい夜間 job、楽観更新、取り消しの権限の分割)
- feature の resource_scope の外にあるファイル (package.json・packages/web/package.json・scripts 配下など) への書込み
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- O1: aquavoice 型の統合で統合元が一覧から 0 件になり、統合先の推定月額を統合後の明細から再計算し、各月の実支払額を保存し、他画面のサブスク集計が同じ名寄せを示すことを確かめた記録がある。
- O2: 5 件連続・2 件同時の操作で 500 が 0 件で、取り合いは 409 か 503 になって画面が自動で収束することを確かめた記録がある。
- O3: 行チェック・全選択・選択バー・統合先・操作状態・操作者・取り消しの DOM テストが全件緑である。
- O4: テナントに無い id は 404、取り消しで統合前の一覧に戻る、古い revision は 409、30 日と 400 日の期限、操作の一覧に before_json・payload_json・key が出ないことを確かめた記録がある。
- U5: pnpm verify:full が緑である (CI は PR 作成後に確かめる)。
- Automated commands:
- pnpm test
- pnpm --filter @kanjo/api test
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
- Dependencies: SYS-SUBSMERGE-P06
