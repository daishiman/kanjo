---
graph_node_id: "SYS-TCSCREEN-P05"
artifact_kind: "task"
artifact_subtypes: []
title: "総収支集計・判定作業 API・操作履歴・migration 0041・TotalCashflow.tsx の実装"
project_id: "feature-package-feat-total-cashflow-screen"
domain: "backend"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow-screen", "p05", "implementation"]
file_path: "tasks/feat-total-cashflow-screen/sys-tcscreen-p05.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T15:38:58Z", "origin_kind": "system-dev-planner", "source_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "source_path": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/task-specs/phase-05-implementation.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T15:38:58Z"
updated_at: "2026-09-15T15:38:58Z"
depends_on: ["SYS-TCSCREEN-P04"]
related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
resource_scope: ["packages/core/src/total-cashflow.ts", "packages/core/src/index.ts", "packages/api/src/routes/total-cashflow.ts", "packages/api/src/db/schema.ts", "packages/api/src/schema-guard.ts", "packages/api/src/canonical-mutation-fence.ts", "packages/api/src/import-active.ts", "packages/api/src/routes/imports.ts", "packages/api/src/import-lifecycle-pure.test.ts", "migrations/0041_total_cashflow_operations_and_exclusion_reason.sql", "packages/web/src/pages/analysis/TotalCashflow.tsx", "packages/web/src/api.ts", "packages/web/src/analysis-query-invalidation.ts", "packages/web/src/components/Layout.tsx"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-total-cashflow-screen"
feature_package_id: "feature-package/feat-total-cashflow-screen"
phase_ref: "P05"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-total-cashflow-screen/sys-tcscreen-p05.md", "confidence": 0.95}]
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

# 総収支集計・判定作業 API・操作履歴・migration 0041・TotalCashflow.tsx の実装

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-total-cashflow-screen
- owners: ["daishiman"]
- tags: ["total-cashflow-screen", "p05", "implementation"]
- related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
- parent_feature: feat-total-cashflow-screen
- phase_ref: P05
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-total-cashflow-screen/sys-tcscreen-p05.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P04 の red テストを green にする最小差分を core/api/web へ実装し、FR-001..FR-008 と AC-001..AC-005 を満たす。

## 背景

現行の GET /api/total-cashflow は packages/api/src/routes/total-cashflow.ts から packages/core/src/total-cashflow.ts を呼び、9 列月次表・重複候補・freee 除外 (自由記述 reason) を返す。本 task は既存フィールドを残したまま summary・series・workbench・autoMatches・lastOperation を加え、書込み route を広げ、取消 route を新設する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Entry gate: SYS-TCSCREEN-P04 が完了し red テストが存在すること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: TotalCashflow.tsx を画像の構成 (KPI 3 枚・チャート・3 ペイン・除外一覧・自動一致の候補・選択バー・月次表の開閉) に作り替え、Layout.tsx の共通ヘッダー/フッター文言を画像に揃える。サイドバーは現在地と照合バッジの確認だけ
- Backend: applicable: total-cashflow.ts にセグメント別集計・previousYearPeriod・3 区分・一致度・自動一致の候補を純関数で足す
- API: applicable: routes/total-cashflow.ts の GET 拡張・POST verdicts・POST/DELETE freee-exclusions・POST operations undo を zod 検証付きで実装する
- Data: applicable: migrations/0041_total_cashflow_operations_and_exclusion_reason.sql で reason_code・memo と total_cashflow_operations を追加し、db/schema.ts・schema-guard.ts・import-active.ts・routes/imports.ts を 3 表のバックアップ対象に揃える
- Infrastructure: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Security: applicable: 書込み route を canonical-mutation-fence の consumers に登録し、user_id 境界と入力上限を実装する
- Quality: applicable: P04 の red テストを green にし、import-lifecycle-pure.test.ts の列挙期待値を更新する
- Documentation: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Operations: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Deploy unit/environment: Cloudflare Workers kanjo-console (packages/api) と D1 kanjo-db (migrations/0041_total_cashflow_operations_and_exclusion_reason.sql) への追加。既存配信構成のまま route の拡張・取消 route・列と表を追加する。
- Compatibility/migration/backfill: GET /api/total-cashflow の既存フィールドと旧 reason body の受理を維持し、migration は追加のみとする (spec-total-cashflow-screen.md 互換性・移行・リリース節)

## 受入基準

- P04 で追加・拡張したテストがすべて green である。
- 判定・除外の更新と操作履歴 1 行が同じ D1 batch に入っている。
- GET /api/total-cashflow の既存フィールドと旧 reason body の受理が維持されている。

## 成果物

- Produced artifacts:
- packages/core/src/total-cashflow.ts
- packages/core/src/index.ts
- packages/api/src/routes/total-cashflow.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/import-active.ts
- packages/api/src/routes/imports.ts
- packages/api/src/import-lifecycle-pure.test.ts
- migrations/0041_total_cashflow_operations_and_exclusion_reason.sql
- packages/web/src/pages/analysis/TotalCashflow.tsx
- packages/web/src/api.ts
- packages/web/src/analysis-query-invalidation.ts
- packages/web/src/components/Layout.tsx
- Consumed artifacts:
- docs/total-cashflow-screen/architecture-decision.md
- docs/total-cashflow-screen/design-review.md
- specs/spec-total-cashflow-screen.md
- packages/core/test/total-cashflow-contract.test.ts
- packages/core/test/total-cashflow-screen-rules.test.ts
- packages/api/test/total-cashflow-verdict.integration.test.ts
- packages/api/test/total-cashflow-operations.integration.test.ts
- packages/web/test/total-cashflow-table.dom.test.tsx
- Write scope/touches:
- packages/core/src/total-cashflow.ts
- packages/core/src/index.ts
- packages/api/src/routes/total-cashflow.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/import-active.ts
- packages/api/src/routes/imports.ts
- packages/api/src/import-lifecycle-pure.test.ts
- migrations/0041_total_cashflow_operations_and_exclusion_reason.sql
- packages/web/src/pages/analysis/TotalCashflow.tsx
- packages/web/src/api.ts
- packages/web/src/analysis-query-invalidation.ts
- packages/web/src/components/Layout.tsx

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCSCREEN-P05 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TCSCREEN-P05 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TCSCREEN-P05 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TCSCREEN-P04) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ・照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う・日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する・freee / Money Forward の取込経路の追加と明細分割の仕様変更・期間選択の保存先の変更 (既存どおり localStorage で全画面共有)・mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- pnpm --filter @kanjo/web test
- pnpm typecheck
- pnpm lint
- Required evidence:
- packages/core/src/total-cashflow.ts
- packages/core/src/index.ts
- packages/api/src/routes/total-cashflow.ts
- packages/api/src/db/schema.ts
- packages/api/src/schema-guard.ts
- packages/api/src/canonical-mutation-fence.ts
- packages/api/src/import-active.ts
- packages/api/src/routes/imports.ts
- packages/api/src/import-lifecycle-pure.test.ts
- migrations/0041_total_cashflow_operations_and_exclusion_reason.sql
- packages/web/src/pages/analysis/TotalCashflow.tsx
- packages/web/src/api.ts
- packages/web/src/analysis-query-invalidation.ts
- packages/web/src/components/Layout.tsx

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 実装コミットを revert する。migrations/0041_total_cashflow_operations_and_exclusion_reason.sql は追加のみのため D1 側の取り消しは不要で、追加列と新表は無害に残置してよい。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Feature: feat-total-cashflow-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TCSCREEN-P04
