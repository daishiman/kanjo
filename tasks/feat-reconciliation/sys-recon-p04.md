---
graph_node_id: "SYS-RECON-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "core境界値・API統合・DOMの失敗テスト先行作成 (契約テストで7件の未決事項を固定)"
project_id: "feature-package-feat-reconciliation"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["reconciliation", "p04", "test-design"]
file_path: "tasks/feat-reconciliation/sys-recon-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-reconciliation/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T11:23:54Z", "origin_kind": "system-dev-planner", "source_digest": "76c705dfa24c67d6b3bf7e3e42d55f2e7b60c0a316f4df01b0343abd909431ad", "source_path": ".dev-graph/plans/feature-package-feat-reconciliation/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T11:23:54Z"
updated_at: "2026-09-15T11:23:54Z"
depends_on: ["SYS-RECON-P03"]
related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
resource_scope: ["packages/core/test/reconciliation.test.ts", "packages/api/test/reconciliation.integration.test.ts", "packages/web/src/reconciliation.dom.test.tsx", "packages/web/src/route-icon-distinct.test.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-reconciliation"
feature_package_id: "feature-package/feat-reconciliation"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-reconciliation/sys-recon-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-15T11:10:33Z", "missing_sections": [], "status": "complete"}
---

# core境界値・API統合・DOMの失敗テスト先行作成 (契約テストで7件の未決事項を固定)

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-reconciliation
- owners: ["daishiman"]
- tags: ["reconciliation", "p04", "test-design"]
- related_nodes: ["arch-reconciliation-auth", "arch-reconciliation-backend", "arch-reconciliation-database", "arch-reconciliation-frontend", "arch-reconciliation-infrastructure", "arch-reconciliation-maintenance-ops", "arch-reconciliation-security", "arch-reconciliation-ui-ux", "spec-reconciliation"]
- parent_feature: feat-reconciliation
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-reconciliation/sys-recon-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

core/API/DOMの失敗テストを先行作成し、未決事項7件のうち値の確定が必要な6件 (rounding・bigram数え方・0.5比較・月次レビューAPI形・再取消status・actions成功status) をテストのassertionとして契約化する。残る1件 (status定義の推定根拠) も判定条件をassertionで固定する。

## 背景

architecture/reconciliation-maintenance-ops.md のRisk and verificationは『丸め規則・Diceの重複bigramの数え方・0.5ちょうどの比較方法は実装時に決める』としており、goal-spec.jsonのopen_itemsは全て disposition=『実装taskの契約テストで確定する』である。P04はこの契約テストを書く最初のtaskであり、placeholder値ではなくテストコードのassertion自体を根拠として値を確定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Entry gate: staging run sdp-feat-reconciliation-20260915T1102Z のgoal-spec.jsonがreadiness_pin.status=completeであること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json
- Depends on: SYS-RECON-P03 の成果物が確定していること

## Workstream applicability

- Frontend: applicable: reconciliation.dom.test.tsx・route-icon-distinct.test.tsxを追加する
- Backend: applicable: reconciliation.integration.test.tsを追加する
- API: applicable: 3エンドポイント+月次レビューAPIの契約テストを追加する
- Data: applicable: 新表3件を前提としたAPI統合テストを追加する
- Infrastructure: N/A: 本taskの関心外
- Security: applicable: 未認証401・他人操作id 404・409競合のテストを追加する
- Quality: applicable: 失敗テスト先行作成自体がQuality工程である
- Documentation: N/A: 本taskはコードのみで文書を追加しない
- Operations: N/A: 本taskの関心外

## Architecture and deploy unit

- Architecture decisions: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Deploy unit/environment: N/A: テストコードのみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本taskはコードのマイグレーションを直接実行しない

## 成果物

- Produced artifacts:
- packages/core/test/reconciliation.test.ts
- packages/api/test/reconciliation.integration.test.ts
- packages/web/src/reconciliation.dom.test.tsx
- packages/web/src/route-icon-distinct.test.tsx (更新)
- Consumed artifacts:
- docs/reconciliation/architecture-decision.md
- docs/reconciliation/design-review.md
- system-spec/00-requirements-definition.md
- specs/spec-reconciliation.md
- features/feat-reconciliation.md
- system-spec/completeness-findings.json
- Write scope/touches:
- packages/core/test/reconciliation.test.ts
- packages/api/test/reconciliation.integration.test.ts
- packages/web/src/reconciliation.dom.test.tsx
- packages/web/src/route-icon-distinct.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-RECON-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-RECON-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-RECON-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-RECON-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (総収支・マトリクス・推移・診断タブ中身の作り直し、他画面の中身の作り直し、freee/MoneyForwardへの書き戻し、外部送信、利用規約等の本文新規作成、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core exec vitest run test/reconciliation.test.ts (新規テストがredであることを確認する)
- pnpm --filter @kanjo/api exec vitest run test/reconciliation.integration.test.ts (新規テストがredであることを確認する)
- pnpm --filter @kanjo/web exec vitest run src/reconciliation.dom.test.tsx (新規テストがredであることを確認する)
- Required evidence:
- packages/core/test/reconciliation.test.ts
- packages/api/test/reconciliation.integration.test.ts
- packages/web/src/reconciliation.dom.test.tsx
- packages/web/src/route-icon-distinct.test.tsx (更新)

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: packages/core/test/reconciliation.test.ts・packages/api/test/reconciliation.integration.test.ts・packages/web/src/reconciliation.dom.test.tsx・packages/web/src/route-icon-distinct.test.tsx への追加コミットを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-reconciliation-auth, arch-reconciliation-backend, arch-reconciliation-database, arch-reconciliation-frontend, arch-reconciliation-infrastructure, arch-reconciliation-maintenance-ops, arch-reconciliation-security, arch-reconciliation-ui-ux, spec-reconciliation
- Feature: feat-reconciliation
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-RECON-P03
