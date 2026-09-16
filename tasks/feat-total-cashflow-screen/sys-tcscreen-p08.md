---
graph_node_id: "SYS-TCSCREEN-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "規則定数の整理と migration 0041・3 表バックアップの整合確認"
project_id: "feature-package-feat-total-cashflow-screen"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow-screen", "p08", "refactoring-migration"]
file_path: "tasks/feat-total-cashflow-screen/sys-tcscreen-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-15T15:38:58Z", "origin_kind": "system-dev-planner", "source_digest": "1ba15965f79abcfeb36897ece409784304af0b2d868cceaeb5a244e3e375c9b5", "source_path": ".dev-graph/plans/feature-package-feat-total-cashflow-screen/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-15T15:38:58Z"
updated_at: "2026-09-15T15:38:58Z"
depends_on: ["SYS-TCSCREEN-P07"]
related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
resource_scope: ["packages/core/src/total-cashflow.ts", "docs/total-cashflow-screen/refactoring.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-total-cashflow-screen"
feature_package_id: "feature-package/feat-total-cashflow-screen"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-total-cashflow-screen/sys-tcscreen-p08.md", "confidence": 0.95}]
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

# 規則定数の整理と migration 0041・3 表バックアップの整合確認

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-total-cashflow-screen
- owners: ["daishiman"]
- tags: ["total-cashflow-screen", "p08", "refactoring-migration"]
- related_nodes: ["arch-total-cashflow-screen-auth", "arch-total-cashflow-screen-backend", "arch-total-cashflow-screen-database", "arch-total-cashflow-screen-frontend", "arch-total-cashflow-screen-infrastructure", "arch-total-cashflow-screen-maintenance-ops", "arch-total-cashflow-screen-security", "arch-total-cashflow-screen-ui-ux", "spec-total-cashflow-screen"]
- parent_feature: feat-total-cashflow-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-total-cashflow-screen/sys-tcscreen-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

一致度・区分の数値を名前付き定数へ寄せる振る舞い不変の整理を行い、migration 0041 の既存 reason 移行と 3 表のバックアップ・復元 (key 無しの旧バックアップを含む) の整合を記録する。

## 背景

spec は規則の数値を名前付き定数にし docs とテストを同じ変更で更新することを求める。旧バックアップに key が無ければ既存の行を残し、key があれば空配列でも置き換え、形が不正なら復元全体を拒む。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Entry gate: SYS-TCSCREEN-P07 が完了していること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Backend: applicable: 規則の数値を名前付き定数へ寄せる (振る舞いは変えない)
- API: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Data: applicable: migration 0041 の移行結果と 3 表の復元往復を確認する
- Infrastructure: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Security: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Quality: applicable: 整理の前後で全テストが緑であることを確認する
- Documentation: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない
- Operations: N/A: 本 phase は文書の作成だけを行い、この層のコードを変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Deploy unit/environment: N/A: 既存の Cloudflare Workers kanjo-console と D1 kanjo-db の配信構成のまま、追加の配布物を持たない
- Compatibility/migration/backfill: GET /api/total-cashflow の既存フィールドと旧 reason body の受理を維持し、migration は追加のみとする (spec-total-cashflow-screen.md 互換性・移行・リリース節)

## 受入基準

- 整理の前後で pnpm --filter @kanjo/core test と pnpm --filter @kanjo/api test が緑である。
- 既存 reason が memo と reason_code=other として読めること、key 無しの旧バックアップで既存の行が残ることを refactoring.md に記録している。

## 成果物

- Produced artifacts:
- packages/core/src/total-cashflow.ts
- docs/total-cashflow-screen/refactoring.md
- Consumed artifacts:
- migrations/0041_total_cashflow_operations_and_exclusion_reason.sql
- packages/api/src/import-active.ts
- packages/api/src/routes/imports.ts
- Write scope/touches:
- packages/core/src/total-cashflow.ts
- docs/total-cashflow-screen/refactoring.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCSCREEN-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-TCSCREEN-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-TCSCREEN-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-TCSCREEN-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (サイドバーの総収支以外の項目・並び・月次クローズ進捗の形の変更: 利用者指示により今回は確認のみ・照合・マトリクス・推移・診断の各タブの中身: それぞれの画面サイクルで扱う・日付と金額の一致による自動寄せの廃止: 利用者決定により自動寄せを維持する・freee / Money Forward の取込経路の追加と明細分割の仕様変更・期間選択の保存先の変更 (既存どおり localStorage で全画面共有)・mobile / tablet / desktop 向け専用アプリ: 対象は web のみ (狭幅は既存のレスポンシブ表示で扱う))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/core test
- pnpm --filter @kanjo/api test
- Required evidence:
- packages/core/src/total-cashflow.ts
- docs/total-cashflow-screen/refactoring.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 整理コミットを revert する。振る舞い不変の整理のため、revert しても P05 の機能は残る。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-total-cashflow-screen-auth, arch-total-cashflow-screen-backend, arch-total-cashflow-screen-database, arch-total-cashflow-screen-frontend, arch-total-cashflow-screen-infrastructure, arch-total-cashflow-screen-maintenance-ops, arch-total-cashflow-screen-security, arch-total-cashflow-screen-ui-ux, spec-total-cashflow-screen
- Feature: feat-total-cashflow-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-TCSCREEN-P07
