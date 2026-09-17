---
graph_node_id: "SYS-MATRIX-P10"
artifact_kind: "task"
artifact_subtypes: []
title: "独立最終レビュー"
project_id: "feature-package-feat-expense-matrix"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["expense-matrix", "p10", "final-review"]
file_path: "tasks/feat-expense-matrix/sys-matrix-p10.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T12:34:56Z", "origin_kind": "system-dev-planner", "source_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "source_path": ".dev-graph/plans/feature-package-feat-expense-matrix/task-specs/phase-10-final-review.md", "source_plugin": "system-dev-planner", "source_version": "0.1.11"}
created_at: "2026-09-16T12:34:56Z"
updated_at: "2026-09-16T12:34:56Z"
depends_on: ["SYS-MATRIX-P09"]
related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
resource_scope: ["docs/matrix/final-review.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-expense-matrix"
feature_package_id: "feature-package/feat-expense-matrix"
phase_ref: "P10"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-expense-matrix/sys-matrix-p10.md", "confidence": 0.95}]
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

# 独立最終レビュー

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p10", "final-review"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P10
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p10.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

実装と検証の一式を、実装者以外の視点で通して確認し、配信前に残る懸念を洗い出した記録を残す。

## 背景

同じ視点で書いて同じ視点で確かめると、前提の取り違えは見つからない。P10 は受入と保証の記録を突き合わせ、テストが旧実装に対して落ちることの確認を含め、緑の根拠が本物かを検査する。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面の受入記録を突き合わせる
- Backend: applicable: 集計の受入記録を突き合わせる
- API: applicable: 契約の検証記録を突き合わせる
- Data: applicable: 欠測と読み広げの扱いを突き合わせる
- Infrastructure: applicable: 予算と応答の記録を突き合わせる
- Security: applicable: 入力検証と認証境界の記録を突き合わせる
- Quality: applicable: 緑の根拠を検査する
- Documentation: applicable: docs/matrix/final-review.md を新設する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: レビュー記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- docs/matrix/final-review.md
- Consumed artifacts:
- docs/matrix/acceptance.md
- docs/matrix/quality-assurance.md
- docs/matrix/test-run.md
- Write scope/touches:
- docs/matrix/final-review.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P10 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P10 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P10 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P09) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm typecheck
- pnpm lint
- Required evidence:
- docs/matrix/final-review.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/matrix/final-review.md の追加コミットを revert する。製品コードへの書込みがないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への documentation handoff (build_target_kind=documentation)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P09

## 実装で確定した結果 (2026-09-18)

- 最終レビューの結果は [`docs/matrix/spec-reflection-receipt.md`](../../docs/matrix/spec-reflection-receipt.md) に記録した。
- 仕様・設計への影響は「あり」と判定し、`system-spec/` (再生成)、`specs/spec-expense-matrix-screen.md` (新規)、`architecture/expense-matrix-*.md` 8 本 (新規) へ正規フローで反映済み。
- 未達の受入 S2 / 受入 5 について、**仕様側の記述は緩めていない**。実装が仕様に追いついていない状態をそのまま残した。
