---
graph_node_id: "SYS-MATRIX-P03"
artifact_kind: "task"
artifact_subtypes: []
title: "集計契約・API 契約・URL 契約の独立レビュー"
project_id: "feature-package-feat-expense-matrix"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["expense-matrix", "p03", "design-review"]
file_path: "tasks/feat-expense-matrix/sys-matrix-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T12:34:56Z", "origin_kind": "system-dev-planner", "source_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "source_path": ".dev-graph/plans/feature-package-feat-expense-matrix/task-specs/phase-03-design-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.11"}
created_at: "2026-09-16T12:34:56Z"
updated_at: "2026-09-16T12:34:56Z"
depends_on: ["SYS-MATRIX-P02"]
related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
resource_scope: ["docs/matrix/design-review.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-expense-matrix"
feature_package_id: "feature-package/feat-expense-matrix"
phase_ref: "P03"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-expense-matrix/sys-matrix-p03.md", "confidence": 0.95}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels": [], "milestone": null, "mode": "local_only", "project_aliases": []}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at": null, "evidence_refs": [], "policy": "linked_pr_merged_all", "reconciled_at": null, "source": null, "status": "in_progress"}
implementation_readiness: {"checked_at": "2026-09-16T12:11:25Z", "missing_sections": [], "status": "complete"}
---

# 集計契約・API 契約・URL 契約の独立レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p03", "design-review"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P03
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の決定が architecture 8 章と仕様書の確定章に反する点を持たず、数値の一致 (画面と CSV と総収支と推移) が構造として保証されることを、実装着手前に独立の視点で確認した記録を残す。

## 背景

集計規則が core と画面の二か所に分かれると、同じ期間の金額が画面と CSV で食い違う。maintenance-ops 章は参照画像の合計欄が閉じていない事実を既に記録しており、期待値の出所を取り違えると実装が正しくてもテストが落ちる。P03 は実装前の最後の設計ゲートとして、単一算出源と期待値の出所を検査する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面側に集計が残らない設計であることを検査する
- Backend: applicable: core 単一算出源と API 契約の整合を検査する
- API: applicable: クエリ受理値と応答形の過不足を検査する
- Data: applicable: 読み広げ範囲と集計範囲の分離を検査する
- Infrastructure: N/A: 配信構成に変更なし
- Security: applicable: 認証境界と利用者絞り込みの設計を検査する
- Quality: applicable: 期待値の出所と検証可能性を検査する
- Documentation: applicable: docs/matrix/design-review.md を新設する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: 文書のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- docs/matrix/design-review.md
- Consumed artifacts:
- docs/matrix/design-decisions.md
- docs/matrix/requirements-baseline.md
- architecture/expense-matrix-ui-ux.md
- architecture/expense-matrix-frontend.md
- architecture/expense-matrix-backend.md
- architecture/expense-matrix-database.md
- architecture/expense-matrix-auth.md
- architecture/expense-matrix-security.md
- architecture/expense-matrix-infrastructure.md
- architecture/expense-matrix-maintenance-ops.md
- Write scope/touches:
- docs/matrix/design-review.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P03 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P03 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P03 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P02) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm lint (既存の文書検査が緑のままであることを確認する)
- Required evidence:
- docs/matrix/design-review.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/matrix/design-review.md の追加コミットを revert する。実装コードに未反映のため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への documentation handoff (build_target_kind=documentation)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P02

## 実装で確定した結果 (2026-09-18)

- 独立レビューは `system-dev-plan-evaluator` が実施し、結果は `.dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json` に残っている。
- `validate-system-plan.py --staging .dev-graph/plans/feature-package-feat-expense-matrix` が `status: pass` / `violations: []` / P01..P13 exact 13 を返した。
- API 契約と URL 契約はレビュー対象の記述としては残るが、実装は本サイクルに入っていない。
