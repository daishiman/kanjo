---
graph_node_id: "SYS-MATRIX-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "アクセシビリティ・入力検証・応答上限・JS バンドル予算の保証確認"
project_id: "feature-package-feat-expense-matrix"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["expense-matrix", "p09", "quality-assurance"]
file_path: "tasks/feat-expense-matrix/sys-matrix-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "evaluator": "system-dev-plan-evaluator", "evidence_ref": ".dev-graph/plans/feature-package-feat-expense-matrix/plan-findings.json"}
source_lineage: {"imported_at": "2026-09-16T12:34:56Z", "origin_kind": "system-dev-planner", "source_digest": "8cde5b2e1bdebb3896de7bfc985c34151547a3dd94e4884af66febbb49090a4c", "source_path": ".dev-graph/plans/feature-package-feat-expense-matrix/task-specs/phase-09-quality-assurance.md", "source_plugin": "system-dev-planner", "source_version": "0.1.11"}
created_at: "2026-09-16T12:34:56Z"
updated_at: "2026-09-16T12:34:56Z"
depends_on: ["SYS-MATRIX-P08"]
related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
resource_scope: ["docs/matrix/quality-assurance.md"]
purpose: null
goal: null
scope_in: null
scope_out: null
acceptance: null
architecture_refs: null
parent_feature: "feat-expense-matrix"
feature_package_id: "feature-package/feat-expense-matrix"
phase_ref: "P09"
classification_confidence: 0.95
classification_reason: "単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない"
classification_candidates: [{"artifact_kind": "task", "candidate_path": "tasks/feat-expense-matrix/sys-matrix-p09.md", "confidence": 0.95}]
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

# アクセシビリティ・入力検証・応答上限・JS バンドル予算の保証確認

## Machine-readable registration fields

本 task の frontmatter が唯一の正本。

- feature_package_id: feature-package/feat-expense-matrix
- owners: ["daishiman"]
- tags: ["expense-matrix", "p09", "quality-assurance"]
- related_nodes: ["arch-expense-matrix-auth", "arch-expense-matrix-backend", "arch-expense-matrix-database", "arch-expense-matrix-frontend", "arch-expense-matrix-infrastructure", "arch-expense-matrix-maintenance-ops", "arch-expense-matrix-security", "arch-expense-matrix-ui-ux", "spec-expense-matrix-screen"]
- parent_feature: feat-expense-matrix
- phase_ref: P09
- classification: confidence 0.95、reason 単一責務の実行タスクであり、artifact_kind は task 以外に取り得ない、candidate tasks/feat-expense-matrix/sys-matrix-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only、project_aliases []、labels []、milestone null
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

アクセシビリティと入力検証と応答の大きさと JS バンドル予算という非機能の保証が、本サイクルの変更後も満たされることを確認し記録した状態にする。

## 背景

ヒートマップはキーボードと読み上げでの操作が落ちやすく、明細を返す経路は入力検証と応答の大きさが問題になりやすい。infrastructure 章は応答を 2 分割し 12 か月 かける 最大 21 行に収めることを、security 章は列挙値の許可リストと CSV の数式エスケープと no-store を定めている。

## 前提条件

- Required spec/architecture/phase/task nodes: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Entry gate: staging run run-feat-expense-matrix-20260916T121130Z の goal-spec.json が readiness_pin.status=complete であること
- Source pin: system-spec-harness v0.1.14 / run-system-spec-compile / assign-system-spec-completeness-evaluator (evidence: system-spec/completeness-findings.json)
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source git / .dev-graph/config.json

## Workstream applicability

- Frontend: applicable: キーボード操作と読み上げの経路を確認する
- Backend: N/A: 本 task はコードを変更しない
- API: applicable: 入力検証と応答ヘッダを確認する
- Data: N/A: データ定義に変更なし
- Infrastructure: applicable: 応答の大きさと JS バンドル予算を確認する
- Security: applicable: 許可リストと数式エスケープと no-store を確認する
- Quality: applicable: 非機能の保証結果を記録する
- Documentation: applicable: docs/matrix/quality-assurance.md を新設する
- Operations: N/A: 運用手順は P12 と P13 の責務

## Architecture and deploy unit

- Architecture decisions: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Deploy unit/environment: N/A: 保証確認の記録のみで配布物を持たない
- Compatibility/migration/backfill: N/A: 本サイクルは新しいテーブルと migration を伴わない

## 成果物

- Produced artifacts:
- docs/matrix/quality-assurance.md
- Consumed artifacts:
- docs/matrix/acceptance.md
- architecture/expense-matrix-security.md
- architecture/expense-matrix-infrastructure.md
- Write scope/touches:
- docs/matrix/quality-assurance.md

## Tracker publication and completion

本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: いずれも値なし (local_only のため)
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-MATRIX-P09 を本文に記載し、default branch を対象にする
- Ownership boundary: system-dev-planner は intent を宣言するのみで、dev-graph が実際の mutation/reconciliation を行う

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/SYS-MATRIX-P09 として割り当てる。system-dev-planner は事前割り当てを行わない
- Worktree lease: 実装着手前に SYS-MATRIX-P09 の worktree lease を claim し、heartbeat/release を行う
- Parallel safety: depends_on (SYS-MATRIX-P08) が完了し、write_scope が他の active lease と重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのクリーンな書き込みが durable な done を確定する

## スコープ外

- goal-spec.json の scope_out (照合・総収支・推移・診断・分析ハブの各画面の中身の作り直し、新しいテーブルと永続化とキャッシュ層、生成 AI による示唆文、サイドバーとヘッダーとフッターの構造の作り直し、認証方式と権限分離の変更と新規外部依存、専用アプリ)
- 本 phase の責務外にある他 phase の成果物への書込み

## Verification and evidence

- Automated commands:
- pnpm --filter @kanjo/web build:bundle
- pnpm --filter @kanjo/web js-budget
- pnpm --filter @kanjo/web test
- pnpm --filter @kanjo/api test
- Required evidence:
- docs/matrix/quality-assurance.md
- Additional completion criteria:
- 測定結果を記録する際、**同一のコマンド行**で `git rev-parse HEAD` と `git status --porcelain` を採り、両方を記録に含めること。後者が空でない場合は「この HEAD では再現できない」と明記する。
- `pnpm --filter @kanjo/web js-budget` は `build:bundle` の直後に実行すること。`build:artifact` は manifest を消すため、順序を入れ替えると測定できない。

## Rollout and rollback

- Rollout: 単一の PR で配信し、default branch への merge をもって反映する
- Rollback trigger and steps: docs/matrix/quality-assurance.md の追加コミットを revert する。製品コードへの書込みがないため単独で戻せる。

## Handoff

- Executor: task-graph build / capability-build への documentation handoff (build_target_kind=documentation)
- Ready when: confirmed かつ evaluation pass かつ implementation_readiness complete かつ promoted digest かつ dev-graph registration complete

## 参照情報

- System specification: system-spec/00-requirements-definition.md (system-spec-harness v0.1.14 出力)
- Architecture: arch-expense-matrix-auth, arch-expense-matrix-backend, arch-expense-matrix-database, arch-expense-matrix-frontend, arch-expense-matrix-infrastructure, arch-expense-matrix-maintenance-ops, arch-expense-matrix-security, arch-expense-matrix-ui-ux, spec-expense-matrix-screen
- Feature: feat-expense-matrix
- Phase doc: 別文書は生成しない (references/feature-execution-package-contract.md により本 task spec 自体が phase の実行単位)
- Dependencies: SYS-MATRIX-P08

## 実装で確定した結果 (2026-09-18)

| 観点 | 結果 |
|---|---|
| アクセシビリティ | 行ヘッダは `<th scope="row">`。濃淡は色だけで判断させず、セルに金額を常に表示し凡例に階級の下限を出す |
| 入力検証 | API を変更していないため既存 `GET /matrix` の検証をそのまま使う |
| 応答上限 | 同上。新しいクエリ経路を足していない |
| JS バンドル予算 | **未実測**。`pnpm lint` の 10 項目に js-budget は含まれない。`matrixMovers` / `MatrixMoversChart` の削除により増加方向ではないが、数値は取っていない |
