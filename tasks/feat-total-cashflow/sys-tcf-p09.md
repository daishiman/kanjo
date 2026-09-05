---
graph_node_id: "SYS-TCF-P09"
artifact_kind: "task"
artifact_subtypes: []
title: "静的検査とセキュリティ確認を通し品質ゲートを満たす"
project_id: "feature-package-feat-total-cashflow"
domain: "quality"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p09"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p09.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-09-quality-assurance.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P06","SYS-TCF-P08"]
related_nodes: ["arch-total-cashflow-security","arch-total-cashflow-auth","arch-total-cashflow-maintenance-ops"]
resource_scope: ["eval-log/tcf-qa.md"]
purpose: "型検査・lint・依存監査・認証境界の確認が通り、配備を止める品質上の理由が残っていない状態。"
goal: "静的検査とセキュリティ確認を通し品質ゲートを満たす"
scope_in: ["eval-log/tcf-qa.md"]
scope_out: ["ゲートを通すための実装修正 (P05 または P08 へ差し戻す)"]
acceptance: ["typecheck / lint / build の各ゲートについて、成功・失敗・打ち切りのいずれかが明示的に記録されている","判定登録エンドポイントへの未認証リクエストが拒否されることを実測済みである","判定登録が audit-log に記録されることを実測済みである"]
architecture_refs: ["arch-total-cashflow-security","arch-total-cashflow-auth","arch-total-cashflow-maintenance-ops"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P09"
classification_confidence: 1.0
classification_reason: "P09 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-09-quality-assurance に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p09.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","quality"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-09-quality-assurance.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 静的検査とセキュリティ確認を通し品質ゲートを満たす

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p09 / related_nodes: arch-total-cashflow-security, arch-total-cashflow-auth, arch-total-cashflow-maintenance-ops
- parent_feature: feat-total-cashflow
- phase_ref: P09
- classification: confidence 1.0 / reason: P09 は 13 phase 固定スロットの phase-09-quality-assurance に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p09.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, quality / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

型検査・lint・依存監査・認証境界の確認が通り、配備を止める品質上の理由が残っていない状態。

## 背景

静的検査が時間切れで打ち切られると、失敗ではないのに通ってもいない状態がログから読めなくなる。打ち切りと失敗を区別できる形で記録する。

## 前提条件

- Required spec/architecture nodes: arch-total-cashflow-security, arch-total-cashflow-auth, arch-total-cashflow-maintenance-ops
- Entry gate: P08 の移行が完了し、P06 のテストが緑である
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P06, SYS-TCF-P08

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: applicable: 判定登録エンドポイントが未認証で叩けないことを確認する
- Quality: applicable: typecheck / lint / build を実行し、打ち切りと失敗を区別して記録する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: applicable: 監査ログに判定登録が残ることを確認する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-security / arch-total-cashflow-auth
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 検査のみ

## 成果物

- Produced artifacts: eval-log/tcf-qa.md (各ゲートの実行結果)
- Consumed artifacts: packages/api/src/auth.ts、packages/api/src/canonical-mutation-fence.ts、packages/api/src/audit-log.ts
- Write scope/touches: eval-log/tcf-qa.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, quality / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P09 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p09 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P09 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P06, SYS-TCF-P08) が完了済みで、write_scope (eval-log/tcf-qa.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- ゲートを通すための実装修正 (P05 または P08 へ差し戻す)

## Verification and evidence

- Automated commands:
  - pnpm -w typecheck
  - pnpm -w lint
  - pnpm -w build
- Required evidence:
  - eval-log/tcf-qa.md

## Rollout and rollback

- Rollout: 検査記録の追加のみ
- Rollback trigger and steps: いずれかのゲートが失敗または打ち切りの場合 — eval-log/tcf-qa.md を削除して再実行する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-security / arch-total-cashflow-auth
- Feature: feat-total-cashflow
- Phase doc: P09 (phase-09-quality-assurance)
- Dependencies: SYS-TCF-P06, SYS-TCF-P08
