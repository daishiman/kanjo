---
graph_node_id: "SYS-CASH-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "合計と経路の計算の重複・削除中の行の読取漏れ・旧参照の読取専用監査"
project_id: "feature-package-feat-cash-screen"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["cash", "p08", "audit"]
file_path: "tasks/feat-cash-screen/sys-cash-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "67035b1f82f26d2d732f18b156a67c6d43d7e52afba21ff2d568d27cea5c4f1d", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-cash-screen/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-22T01:43:10Z", "origin_kind": "system-dev-planner", "source_digest": "67035b1f82f26d2d732f18b156a67c6d43d7e52afba21ff2d568d27cea5c4f1d", "source_path": ".dev-graph/plans/feature-package-feat-cash-screen/task-specs/phase-08-refactoring-migration.md", "source_plugin": "system-dev-planner", "source_version": "0.1.0"}
created_at: "2026-09-22T01:43:10Z"
updated_at: "2026-09-22T01:43:10Z"
depends_on: ["SYS-CASH-P07"]
related_nodes: ["arch-cash-auth", "arch-cash-backend", "arch-cash-database", "arch-cash-frontend", "arch-cash-infrastructure", "arch-cash-maintenance-ops", "arch-cash-security", "arch-cash-ui-ux", "spec-cash-screen"]
resource_scope: ["docs/cash-screen/design-decisions.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-cash-screen"
feature_package_id: "feature-package/feat-cash-screen"
phase_ref: "P08"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-cash-screen/sys-cash-p08.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-22T00:48:20Z", "missing_sections": [], "status": "complete"}
---

# 合計と経路の計算の重複・削除中の行の読取漏れ・旧参照の読取専用監査

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-cash-screen
- owners: ["daishiman"]
- tags: ["cash", "p08", "audit"]
- related_nodes: ["arch-cash-auth", "arch-cash-backend", "arch-cash-database", "arch-cash-frontend", "arch-cash-infrastructure", "arch-cash-maintenance-ops", "arch-cash-security", "arch-cash-ui-ux", "spec-cash-screen"]
- parent_feature: feat-cash-screen
- phase_ref: P08
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-cash-screen/sys-cash-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

現金明細の合計・絞り込み・ページング・入力経路の計算が cash-screen 以外に無いこと、cash_entries を読む経路に deleted_at の条件漏れが無いこと、旧 Cash.tsx の直参照が残らないことを読取専用で監査する。

## 背景

spec の grep による検査 (O3) と、読取経路の網羅を実装後の現物で確かめる。監査は書き換えを伴わない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen, SYS-CASH-P07
- Entry gate: staging run plan-feat-cash-screen-20260921T2307Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 監査のみ
- Backend: N/A: 監査のみ
- API: N/A: 監査のみ
- Data: N/A: 監査のみ
- Infrastructure: N/A: 監査のみ
- Security: N/A: 監査のみ
- Quality: applicable: grep と照合で監査する
- Documentation: applicable: 監査結果を記録する
- Operations: N/A: 運用手順は P12

## Architecture and deploy unit

- Architecture decisions: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Deploy unit/environment: N/A: 読取専用監査のみ
- Compatibility/migration/backfill: N/A: 監査のみ

## 成果物

- Produced artifacts:
- docs/cash-screen/design-decisions.md
- Consumed artifacts:
- packages/core/src/cash-screen.ts
- packages/api/src/routes/cash.ts
- packages/api/src/import-lifecycle.ts
- packages/web/src/pages/cash/
- Write scope/touches:
- docs/cash-screen/design-decisions.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-CASH-P08 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-CASH-P08 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-CASH-P08 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-CASH-P07) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (領収書ファイルの保存、取込 (MF / freee) の現金明細を一覧に混ぜること (qa-cash-decision-004)、共通シェル (パンくず・取引ライン・最終更新・検索・サイドバーの月次クローズ・フッター) の変更、担当者の自由登録と管理画面 (qa-cash-decision-002)、モバイル・タブレット・デスクトップ専用アプリ (web SPA 1 系統のレスポンシブで扱う)、既存の cash_entries の行と、集計結果 (cashToDeal / cashToTx) の書き換え、税務判断 (税務上の正本は freee))
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Acceptance:
- 金額の reduce と transitFrom による経路の分岐が cash-screen 以外の web と api に 0 件である。
- cash_entries を読む SQL がすべて deleted_at IS NULL を持つか、JSON 復元の件数判定 (import-lifecycle.ts) として記録された例外である。
- 旧 Cash.tsx の直参照が 0 件である。
- Automated commands:
- rg による合計と経路の計算の重複・cash_entries の読取条件・旧参照の検査
- P06 / P07 の証跡と git diff の照合
- Required evidence:
- docs/cash-screen/design-decisions.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: 監査記録に誤りがあれば docs の追記だけを revert する。

## Handoff

- Executor: task-graph build / capability-build への application-code handoff (build_target_kind=application-code)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Screen specification: specs/spec-cash-screen.md
- Architecture: arch-cash-auth, arch-cash-backend, arch-cash-database, arch-cash-frontend, arch-cash-infrastructure, arch-cash-maintenance-ops, arch-cash-security, arch-cash-ui-ux, spec-cash-screen
- Feature: feat-cash-screen
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-CASH-P07
