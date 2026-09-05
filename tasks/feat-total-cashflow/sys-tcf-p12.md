---
graph_node_id: "SYS-TCF-P12"
artifact_kind: "task"
artifact_subtypes: []
title: "利用者向けの使い方と運用手順を書く"
project_id: "feature-package-feat-total-cashflow"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p12"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p12.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-12-documentation-operations.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P11"]
related_nodes: ["arch-total-cashflow-ui-ux","arch-total-cashflow-maintenance-ops"]
resource_scope: ["docs"]
purpose: "一覧表の読み方、要確認キューでの判定のしかた、判定を間違えたときの直し方が文書として存在する状態。"
goal: "利用者向けの使い方と運用手順を書く"
scope_in: ["docs"]
scope_out: ["機能の追加・変更"]
acceptance: ["一覧表の 3 列と内訳の意味が、会計用語を知らなくても読める言葉で説明されている","要確認キューで 同じ / 違う を判定する手順と、判定が次回取込へ再適用されることが書かれている","判定を間違えたときの取り消し手順が書かれ、実際に手順どおり操作できることを確認済みである"]
architecture_refs: ["arch-total-cashflow-ui-ux","arch-total-cashflow-maintenance-ops"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P12"
classification_confidence: 1.0
classification_reason: "P12 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-12-documentation-operations に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p12.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","documentation"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-12-documentation-operations.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 利用者向けの使い方と運用手順を書く

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p12 / related_nodes: arch-total-cashflow-ui-ux, arch-total-cashflow-maintenance-ops
- parent_feature: feat-total-cashflow
- phase_ref: P12
- classification: confidence 1.0 / reason: P12 は 13 phase 固定スロットの phase-12-documentation-operations に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p12.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, documentation / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

一覧表の読み方、要確認キューでの判定のしかた、判定を間違えたときの直し方が文書として存在する状態。

## 背景

消し込みは利用者の判定を蓄積して精度が上がる仕組みであり、判定の意味と取り消し方が分からないと使われない。

## 前提条件

- Required spec/architecture nodes: arch-total-cashflow-ui-ux, arch-total-cashflow-maintenance-ops
- Entry gate: P11 の索引が存在する
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P11

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: N/A: この phase は自動テストとゲートを追加しない
- Documentation: applicable: 一覧表の読み方と要確認キューの操作手順を書く
- Operations: applicable: 判定の取り消しと再集計の手順を書く

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-ui-ux / arch-total-cashflow-maintenance-ops
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 文書のみ

## 成果物

- Produced artifacts: docs 配下の利用手順と運用手順
- Consumed artifacts: eval-log/tcf-acceptance.md、architecture/total-cashflow-ui-ux.md
- Write scope/touches: docs

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, documentation / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P12 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p12 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P12 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P11) が完了済みで、write_scope (docs) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 機能の追加・変更

## Verification and evidence

- Automated commands:
  - rg -n '要確認' docs
  - rg -n '取り消し' docs
- Required evidence:
  - docs

## Rollout and rollback

- Rollout: 文書の追加のみ
- Rollback trigger and steps: 手順どおりに操作できない場合 — 追加した docs 配下のファイルを削除する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-ui-ux / arch-total-cashflow-maintenance-ops
- Feature: feat-total-cashflow
- Phase doc: P12 (phase-12-documentation-operations)
- Dependencies: SYS-TCF-P11
