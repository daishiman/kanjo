---
graph_node_id: "SYS-TCSCREEN-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "境界値付きの red テスト先行 (core 規則・API 取消と復元・画面ブロック)"
project_id: "feature-package-feat-total-cashflow-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow-screen", "p04", "test-design"]
file_path: "tasks/feat-total-cashflow-screen/sys-tcscreen-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T15:38:58Z", "origin_kind": "system-dev-planner", "source_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "source_path": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/task-specs/phase-04-test-design.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T15:38:58Z"
updated_at: "2026-09-15T15:38:58Z"
depends_on: ["SYS-TCSCREEN-P03"]
related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
resource_scope: ["packages/core/test/total-cashflow-contract.test.ts", "packages/core/test/total-cashflow-screen-rules.test.ts", "packages/api/test/total-cashflow-verdict.integration.test.ts", "packages/api/test/total-cashflow-operations.integration.test.ts", "packages/web/test/total-cashflow-table.dom.test.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-total-cashflow-screen"
feature_package_id: "feature-package/feat-total-cashflow-screen"
phase_ref: "P04"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-total-cashflow-screen/sys-tcscreen-p04.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-15T15:22:17Z", "missing_sections": [], "status": "complete"}
---

# 境界値付きの red テスト先行 (core 規則・API 取消と復元・画面ブロック)

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-total-cashflow-screen
- owners: ["daishiman"]
- tags: ["total-cashflow-screen", "p04", "test-design"]
- related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
- parent_feature: feat-total-cashflow-screen
- phase_ref: P04
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-total-cashflow-screen/sys-tcscreen-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

AC-001..AC-005 を落とすテストを実装より先に書き、現行実装で red になることを確かめる。境界値は日付差 3 日と 4 日、候補 1 件と 2 件、前年同期の月が 1 か月欠ける場合、続けて 2 回取り消す場合、同じ操作 id を 2 回送る場合、古い id を送る場合、唯一の候補を除外した月ずれ明細、除外前後の事業/家計の入れ替わり、自動一致の組で摘要だけが違う場合とする。

## 背景

spec は既存の total-cashflow-contract / total-cashflow-verdict.integration / total-cashflow-table.dom を緑のまま拡張することを求める。規則の数値を変えたらテストが落ちること (FR-008) を先に固定する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Entry gate: SYS-TCSCREEN-P03 が完了し high 以上の指摘が残っていないこと
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: total-cashflow-table.dom.test.tsx に画面ブロック・開閉・選択バー・取消導線のテストを足す
- Backend: applicable: total-cashflow-screen-rules.test.ts に一致度・3 区分・前年同期・自動一致の境界値テストを置く
- API: applicable: total-cashflow-operations.integration.test.ts に取消 409/404 と冪等性のテストを置く
- Data: applicable: migration 後の既存 reason の memo 化と 3 表の復元往復のテストを置く
- Infrastructure: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Security: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Quality: applicable: 追加テストが現行実装で red であることを記録する
- Documentation: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Operations: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Deploy unit/environment: N/A: テストコードのみで配布物を持たない
- Compatibility/migration/backfill: GET /api/total-cashflow の既存フィールドと旧 reason body の受理を維持し、migration は追加のみとする (spec-total-cashflow-screen.md 互換性・移行・リリース節)

## 受入基準

- 追加・拡張したテストが現行実装で失敗し、失敗理由が未実装の機能に由来する。
- 既存テストの期待値を緩めていない (既存 assertion の削除 0 件)。
- テストの表示値はサンプルデータだけで、実データを含まない。

## 成果物

- Produced artifacts:
- packages/core/test/total-cashflow-contract.test.ts
- packages/core/test/total-cashflow-screen-rules.test.ts
- packages/api/test/total-cashflow-verdict.integration.test.ts
- packages/api/test/total-cashflow-operations.integration.test.ts
- packages/web/test/total-cashflow-table.dom.test.tsx
- Consumed artifacts:
- docs/total-cashflow-screen/architecture-decision.md
- docs/total-cashflow-screen/design-review.md
- specs/spec-total-cashflow-screen.md
- Write scope/touches:
- packages/core/test/total-cashflow-contract.test.ts
- packages/core/test/total-cashflow-screen-rules.test.ts
- packages/api/test/total-cashflow-verdict.integration.test.ts
- packages/api/test/total-cashflow-operations.integration.test.ts
- packages/web/test/total-cashflow-table.dom.test.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCSCREEN-P04 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TCSCREEN-P04 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TCSCREEN-P04 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TCSCREEN-P03) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ・照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う・日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する・freee / Money Forward の取込経路の追加と明細分割の仕様変更・期間選択の保存先の変更 (既存どおり localStorage で全画面共有)・mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core exec vitest run test/total-cashflow-screen-rules.test.ts (新規テストが red であることを確認する)
- pnpm --filter @kanjo/api exec vitest run test/total-cashflow-operations.integration.test.ts (新規テストが red であることを確認する)
- pnpm --filter @kanjo/web exec vitest run test/total-cashflow-table.dom.test.tsx (拡張分が red であることを確認する)
- Required evidence:
- packages/core/test/total-cashflow-contract.test.ts
- packages/core/test/total-cashflow-screen-rules.test.ts
- packages/api/test/total-cashflow-verdict.integration.test.ts
- packages/api/test/total-cashflow-operations.integration.test.ts
- packages/web/test/total-cashflow-table.dom.test.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 追加したテストファイルと拡張分のコミットを revert する。実装コードには触れていないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Feature: feat-total-cashflow-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TCSCREEN-P03
