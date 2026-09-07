---
graph_node_id: "SYS-TCF-P08"
artifact_kind: "task"
artifact_subtypes: []
title: "判定永続化スキーマの移行と既存集計コードの重複整理を行う"
project_id: "feature-package-feat-total-cashflow"
domain: "data"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p08"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p08.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-08-refactoring-migration.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P07"]
related_nodes: ["arch-total-cashflow-database","arch-total-cashflow-backend","arch-total-cashflow-maintenance-ops"]
resource_scope: ["migrations","packages/core/src"]
purpose: "判定永続化テーブルが本番へ適用され、P05 で追加した集計コードと既存 analysis.ts / expense-projection.ts の重複した集計経路が 1 本に整理された状態。"
goal: "判定永続化スキーマの移行と既存集計コードの重複整理を行う"
scope_in: ["migrations","packages/core/src"]
scope_out: ["新機能の追加 (本 phase は移行と整理に限る)"]
acceptance: ["判定永続化テーブルが本番へ適用され、適用前後の既存テーブル行数が変化していない","同じ月のトータル支出を返す経路が 1 本だけであり、重複経路が 0 件である","整理後も P04 のテストが全て緑である"]
architecture_refs: ["arch-total-cashflow-database","arch-total-cashflow-backend","arch-total-cashflow-maintenance-ops"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P08"
classification_confidence: 1.0
classification_reason: "P08 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-08-refactoring-migration に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p08.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","data"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-08-refactoring-migration.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 判定永続化スキーマの移行と既存集計コードの重複整理を行う

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p08 / related_nodes: arch-total-cashflow-database, arch-total-cashflow-backend, arch-total-cashflow-maintenance-ops
- parent_feature: feat-total-cashflow
- phase_ref: P08
- classification: confidence 1.0 / reason: P08 は 13 phase 固定スロットの phase-08-refactoring-migration に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p08.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, data / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

判定永続化テーブルが本番へ適用され、P05 で追加した集計コードと既存 analysis.ts / expense-projection.ts の重複した集計経路が 1 本に整理された状態。

## 背景

既存の analysis.ts と expense-projection.ts にも集計処理があり、新規の合算処理と並置したままだと 同じ数字を別経路で出す状態が残る。数字が食い違ったときに原因が特定できなくなる。

## 前提条件

- Required spec/architecture nodes: arch-total-cashflow-database, arch-total-cashflow-backend, arch-total-cashflow-maintenance-ops
- Entry gate: P07 の受入確認で全条件が成立している
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P07

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: applicable: 集計経路の重複を 1 本へ寄せる
- API: N/A: この phase は HTTP 契約を変更しない
- Data: applicable: 判定永続化テーブルの migration を本番へ適用し、適用後の行数を記録する
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 整理後も P04 のテストが緑であることを確認する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-database / arch-total-cashflow-backend
- Deploy unit/environment: kanjo-console (Cloudflare Workers) + D1 kanjo-db
- Compatibility/migration/backfill: 既存テーブルの列を変更せず追加のみとする。バックフィルは不要で、判定未登録の明細は要確認として扱われる

## 成果物

- Produced artifacts: migrations の適用済みマイグレーション、packages/core/src の整理後の集計モジュール
- Consumed artifacts: packages/core/src/analysis.ts、packages/core/src/expense-projection.ts
- Write scope/touches: migrations, packages/core/src

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, data / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P08 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p08 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P08 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P07) が完了済みで、write_scope (migrations, packages/core/src) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 新機能の追加 (本 phase は移行と整理に限る)

## Verification and evidence

- Automated commands:
  - pnpm --filter @kanjo/api exec wrangler d1 migrations list kanjo-db
  - pnpm test
  - rg -n 'totalExpense|トータル支出' packages/core/src で集計経路が 1 本であることを確認する
- Required evidence:
  - eval-log/tcf-migration.md

## Rollout and rollback

- Rollout: migration を適用してからコードを配備する
- Rollback trigger and steps: migration 適用後に既存テーブルの行数が変化した場合 — 追加テーブルを削除して直前タグへ戻す。既存テーブルは変更していないため取込済みデータは影響を受けない

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-database / arch-total-cashflow-backend
- Feature: feat-total-cashflow
- Phase doc: P08 (phase-08-refactoring-migration)
- Dependencies: SYS-TCF-P07
