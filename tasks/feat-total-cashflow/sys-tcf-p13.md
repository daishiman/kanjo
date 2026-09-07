---
graph_node_id: "SYS-TCF-P13"
artifact_kind: "task"
artifact_subtypes: []
title: "kanjo-console へ配備し集計値が本番で成立することを確認する"
project_id: "feature-package-feat-total-cashflow"
domain: "operations"
status: "active"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p13"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p13.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-13-release-deploy.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-05T13:53:35Z"
depends_on: ["SYS-TCF-P12"]
related_nodes: ["arch-total-cashflow-infrastructure","arch-total-cashflow-maintenance-ops","arch-total-cashflow-security"]
resource_scope: ["packages/api/wrangler.jsonc","eval-log/tcf-release.md"]
purpose: "本番の kanjo-console で一覧表が表示され、2 恒等式が本番データでも成立していることを確認した状態。"
goal: "kanjo-console へ配備し集計値が本番で成立することを確認する"
scope_in: ["packages/api/wrangler.jsonc","eval-log/tcf-release.md"]
scope_out: ["mobile / tablet / desktop 向けの配備 (対象は web のみ)"]
acceptance: ["本番で月次一覧表が表示され、全表示月で 2 恒等式が成立している","migration 適用とコード配備の順序が記録どおりであり、逆順になっていない","配備後に本番の判定登録エンドポイントが未認証で拒否されることを実測済みである"]
architecture_refs: ["arch-total-cashflow-infrastructure","arch-total-cashflow-maintenance-ops","arch-total-cashflow-security"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P13"
classification_confidence: 1.0
classification_reason: "P13 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-13-release-deploy に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p13.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","operations"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-13-release-deploy.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: kanjo-console へ配備し集計値が本番で成立することを確認する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p13 / related_nodes: arch-total-cashflow-infrastructure, arch-total-cashflow-maintenance-ops, arch-total-cashflow-security
- parent_feature: feat-total-cashflow
- phase_ref: P13
- classification: confidence 1.0 / reason: P13 は 13 phase 固定スロットの phase-13-release-deploy に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p13.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, operations / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

本番の kanjo-console で一覧表が表示され、2 恒等式が本番データでも成立していることを確認した状態。

## 背景

配備先は Cloudflare Workers の kanjo-console、データは D1 の kanjo-db。migration の適用とコード配備の順序を誤ると、集計が存在しないテーブルを読む。

## 前提条件

- Required spec/architecture nodes: arch-total-cashflow-infrastructure, arch-total-cashflow-maintenance-ops, arch-total-cashflow-security
- Entry gate: P12 の文書が存在し、P09 の品質ゲートが全て成功で記録されている
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P12

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: applicable: wrangler 設定とバインディングが新テーブルを参照できることを確認する
- Security: applicable: 本番でも判定登録が未認証で叩けないことを確認する
- Quality: applicable: 本番データで 2 恒等式が成立することを確認する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: applicable: 配備手順を実行し、結果を記録する

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-infrastructure / arch-total-cashflow-maintenance-ops / arch-total-cashflow-security
- Deploy unit/environment: kanjo-console (Cloudflare Workers) + D1 kanjo-db
- Compatibility/migration/backfill: migration を先に適用してからコードを配備する。逆順は集計が存在しないテーブルを読むため許可しない

## 成果物

- Produced artifacts: 配備済み kanjo-console、eval-log/tcf-release.md
- Consumed artifacts: packages/api/wrangler.jsonc、migrations
- Write scope/touches: packages/api/wrangler.jsonc, eval-log/tcf-release.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, operations / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P13 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p13 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P13 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P12) が完了済みで、write_scope (packages/api/wrangler.jsonc, eval-log/tcf-release.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- mobile / tablet / desktop 向けの配備 (対象は web のみ)

## Verification and evidence

- Automated commands:
  - pnpm --filter @kanjo/api exec wrangler deploy
  - pnpm --filter @kanjo/api exec wrangler d1 migrations list kanjo-db
  - 本番 URL の一覧表を開き、各月の総支出と内訳合計の一致を確認する
- Required evidence:
  - eval-log/tcf-release.md

## Rollout and rollback

- Rollout: migration 適用 → コード配備 → 本番確認の順に行う
- Rollback trigger and steps: 本番で恒等式が崩れた場合、または一覧表が表示されない場合 — 直前タグへコードを戻し、追加テーブルは残す (読み取りのみのため副作用がない)

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-infrastructure / arch-total-cashflow-maintenance-ops / arch-total-cashflow-security
- Feature: feat-total-cashflow
- Phase doc: P13 (phase-13-release-deploy)
- Dependencies: SYS-TCF-P12
