---
graph_node_id: "SYS-MATRIX-P07"
artifact_kind: "task"
artifact_subtypes: []
title: "受入基準 S1 から S5 の検証"
project_id: "feature-package-feat-expense-matrix"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["expense-matrix", "p07", "acceptance"]
file_path: "tasks/feat-expense-matrix/sys-matrix-p07.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T12:34:56Z", "origin_kind": "system-dev-planner", "source_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "source_path": ".dev-graph/plans/feature-package-feat-expense-matrix/task-specs/phase-07-acceptance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.11"}
created_at: "2026-09-16T12:34:56Z"
updated_at: "2026-09-16T12:34:56Z"
depends_on: ["SYS-MATRIX-P06"]
related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
resource_scope: ["docs/matrix/acceptance.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-expense-matrix"
feature_package_id: "feature-package/feat-expense-matrix"
phase_ref: "P07"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-expense-matrix/sys-matrix-p07.md", "confidence": 0.95}]
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

# 受入基準 S1 から S5 の検証

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p07", "acceptance"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P07
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feature の受入基準 S1 から S5 が実際の画面と API と CSV で満たされることを確認し、確認手順と結果を記録した状態にする。

## 背景

テストが緑であることと、利用者から見て受入基準を満たすことは別である。S2 と S4 は画面と API と CSV と他タブの金額の一致という横断的な確認を含み、自動テストだけでは閉じない。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: 画面の構成要素と選択の挙動を確認する
- Backend: applicable: 集計値と CSV と他タブの一致を確認する
- API: applicable: 2 経路の応答が受入基準を満たすことを確認する
- Data: applicable: 未記帳月と欠測の表示を確認する
- Infrastructure: N/A: 配信構成に変更なし
- Security: N/A: 保証確認は P09 の責務
- Quality: applicable: S1 から S5 の確認手順と結果を記録する
- Documentation: applicable: docs/matrix/acceptance.md を新設する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: 検証記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- docs/matrix/acceptance.md
- Consumed artifacts:
- docs/matrix/test-run.md
- docs/matrix/requirements-baseline.md
- Write scope/touches:
- docs/matrix/acceptance.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P07 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P07 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P07 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P06) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm test
- pnpm --filter @kanjo/web lint
- Required evidence:
- docs/matrix/acceptance.md

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/matrix/acceptance.md の追加コミットを revert する。製品コードへの書込みがないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への documentation handoff (build_target_kind=documentation)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P06

## 実装で確定した結果 (2026-09-18)

| | 判定 | 根拠 |
|---|---|---|
| S1 | 達成 | `matrix-visual.dom.test.tsx` / `matrix-legend.dom.test.tsx`、`check-design-tokens` PASS |
| S2 | **未達** | `MatrixTable` が `HeatGrid` へ `selected` / `onSelect` を渡していない。`GET /api/matrix/cell` も未着手 |
| S3 | 達成 | 選定規則を [`docs/matrix.md`](../../docs/matrix.md) に明記、`matrix-derived.test.ts` で境界値を固定 |
| S4 | 部分達成 | 合計・平均は単一経路。ただし `scope` は決定 2 で今サイクル外、`axis` は未実装のため確認できた組合せは既定の 1 つ |
| S5 | 達成 | 共通シェルの差分は `routeMetadata.ts` の表記統一のみ |

詳細は [`docs/matrix/evidence-index.md`](../../docs/matrix/evidence-index.md) の「2. 受入基準の判定」。
