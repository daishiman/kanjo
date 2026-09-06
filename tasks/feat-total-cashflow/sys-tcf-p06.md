---
graph_node_id: "SYS-TCF-P06"
artifact_kind: "task"
artifact_subtypes: []
title: "テストを実行して受入条件との対応が全て緑であることを実測する"
project_id: "feature-package-feat-total-cashflow"
domain: "quality"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p06"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p06.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-06-test-run.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P05"]
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-backend","arch-total-cashflow-maintenance-ops"]
resource_scope: ["eval-log/tcf-test-run.md"]
purpose: "受入 10 件に紐づくテストが実際に実行され、緑であることが記録として残った状態。"
goal: "テストを実行して受入条件との対応が全て緑であることを実測する"
scope_in: ["eval-log/tcf-test-run.md"]
scope_out: ["テストを緑にするための実装変更 (P05 へ差し戻す)"]
acceptance: ["実行したテスト件数と成功件数が記録され、両者が一致している","受入 10 件それぞれに対応するテストが実行対象に含まれていることが対応表で確認できる","CI とローカルの結果が一致している、または差分の原因が記録されている"]
architecture_refs: ["arch-total-cashflow-backend","arch-total-cashflow-maintenance-ops"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P06"
classification_confidence: 1.0
classification_reason: "P06 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-06-test-run に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p06.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","quality"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-06T12:12:38Z","evidence_refs":["git:d2871bd","eval-log/tcf-test-run.md","sha256:0bc75fe33facbb112c709c6df6f56413133dde47055529df604b6b25304dfed9","eval-log/tcf-test-run-after-remediation.log","sha256:20f88192bd24c5ff6672a76d997ef2bc71d1a9c65195cf87e72f8be3053135c6"],"policy":"manual","reconciled_at":null,"source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-06-test-run.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: テストを実行して受入条件との対応が全て緑であることを実測する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p06 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-maintenance-ops
- parent_feature: feat-total-cashflow
- phase_ref: P06
- classification: confidence 1.0 / reason: P06 は 13 phase 固定スロットの phase-06-test-run に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p06.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, quality / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

受入 10 件に紐づくテストが実際に実行され、緑であることが記録として残った状態。

## 背景

CI の headless Chrome は pointer:none であり、pointer:fine 前提の描画テストはローカル緑・CI 赤になる。実行環境の差で結果が変わる箇所を実測で潰す。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-maintenance-ops
- Entry gate: P05 の実装が commit 済みで、pnpm install が成功する
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P05

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: applicable: 失敗したテストの原因を実装側へ差し戻す
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 単体・結合・web の各テストを実行し出力を保存する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: applicable: CI での実行結果とローカル結果の差分を確認する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-backend / arch-total-cashflow-maintenance-ops
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 実行と記録のみ

## 成果物

- Produced artifacts: eval-log/tcf-test-run.md (実行コマンド・件数・結果)
- Consumed artifacts: packages/core/test、packages/api/test、packages/web/test
- Write scope/touches: eval-log/tcf-test-run.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, quality / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P06 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p06 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P06 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P05) が完了済みで、write_scope (eval-log/tcf-test-run.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- テストを緑にするための実装変更 (P05 へ差し戻す)

## Verification and evidence

- Automated commands:
  - pnpm test 2>&1 | tee eval-log/tcf-test-run.md
  - rg -n 'passed|failed' eval-log/tcf-test-run.md
- Required evidence:
  - eval-log/tcf-test-run.md

## Rollout and rollback

- Rollout: 実行記録の追加のみ
- Rollback trigger and steps: 記録が実行結果と一致しない場合 — eval-log/tcf-test-run.md を削除して再実行する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-backend / arch-total-cashflow-maintenance-ops
- Feature: feat-total-cashflow
- Phase doc: P06 (phase-06-test-run)
- Dependencies: SYS-TCF-P05
