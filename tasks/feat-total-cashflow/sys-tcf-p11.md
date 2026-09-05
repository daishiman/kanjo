---
graph_node_id: "SYS-TCF-P11"
artifact_kind: "task"
artifact_subtypes: []
title: "判断の根拠となった実測値を 1 箇所へ集約する"
project_id: "feature-package-feat-total-cashflow"
domain: "documentation"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p11"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p11.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-11-evidence.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P09","SYS-TCF-P10"]
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-maintenance-ops"]
resource_scope: ["eval-log/tcf-evidence-index.md"]
purpose: "どの判断がどの実測値に基づくかを後から辿れる索引ができた状態。"
goal: "判断の根拠となった実測値を 1 箇所へ集約する"
scope_in: ["eval-log/tcf-evidence-index.md"]
scope_out: ["新しい検証の実施 (P06 / P09 の責務)"]
acceptance: ["各判断に対応する実測記録のパスが記載され、参照先が全て実在する","実測でない記述には推定である旨が明示されている","記録の時刻が実行時に測った値であり、後から書き足した推定値が 0 件である"]
architecture_refs: ["arch-total-cashflow-maintenance-ops"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P11"
classification_confidence: 1.0
classification_reason: "P11 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-11-evidence に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p11.md","confidence":1.0}]
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

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-11-evidence.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 判断の根拠となった実測値を 1 箇所へ集約する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p11 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-maintenance-ops
- parent_feature: feat-total-cashflow
- phase_ref: P11
- classification: confidence 1.0 / reason: P11 は 13 phase 固定スロットの phase-11-evidence に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p11.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, documentation / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

どの判断がどの実測値に基づくかを後から辿れる索引ができた状態。

## 背景

仕様の時刻や件数を推定で書くと、書式が正しいまま実測と食い違ってもゲートは素通りする。根拠が実測なのか推定なのかを明示する。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-maintenance-ops
- Entry gate: P09 と P10 の記録が存在する
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P09, SYS-TCF-P10

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 各記録が実測か推定かを区別して記す
- Documentation: applicable: 実測記録へのポインタと、それが支える判断を対応づける
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-maintenance-ops
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 記録の集約のみ

## 成果物

- Produced artifacts: eval-log/tcf-evidence-index.md
- Consumed artifacts: eval-log/tcf-red-run.txt、eval-log/tcf-test-run.md、eval-log/tcf-acceptance.md、eval-log/tcf-qa.md
- Write scope/touches: eval-log/tcf-evidence-index.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, documentation / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P11 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p11 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P11 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P09, SYS-TCF-P10) が完了済みで、write_scope (eval-log/tcf-evidence-index.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 新しい検証の実施 (P06 / P09 の責務)

## Verification and evidence

- Automated commands:
  - rg -o 'eval-log/[A-Za-z0-9._/-]+' eval-log/tcf-evidence-index.md | sort -u | wc -l の出力が 5 以上であること (P03 設計レビュー / P06 テスト実行 / P07 受入 / P09 品質 / P10 最終確認 の各記録を最低 1 件ずつ指すため)
  - rg -o 'eval-log/[A-Za-z0-9._/-]+' eval-log/tcf-evidence-index.md | sort -u | xargs -I{} test -f {} の exit code が 0 であること
  - rg -c '推定' eval-log/tcf-evidence-index.md の出力が 0 であること
- Required evidence:
  - eval-log/tcf-evidence-index.md

## Rollout and rollback

- Rollout: 索引の追加のみ
- Rollback trigger and steps: 参照先が実在しない場合 — eval-log/tcf-evidence-index.md を削除する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-maintenance-ops
- Feature: feat-total-cashflow
- Phase doc: P11 (phase-11-evidence)
- Dependencies: SYS-TCF-P09, SYS-TCF-P10
