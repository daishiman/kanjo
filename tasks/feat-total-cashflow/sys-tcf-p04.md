---
graph_node_id: "SYS-TCF-P04"
artifact_kind: "task"
artifact_subtypes: []
title: "受入条件と 1 対 1 に対応する失敗するテストを先に書く"
project_id: "feature-package-feat-total-cashflow"
domain: "quality"
status: "done"
priority: null
start_date: null
target_date: null
iteration: null
owners: ["daishiman"]
tags: ["total-cashflow","web","p04"]
file_path: "tasks/feat-total-cashflow/sys-tcf-p04.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/plans/feature-package-feat-total-cashflow/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-05T13:53:35Z","origin_kind":"system-dev-planner","source_digest":"919f834485f45d4c971b90cfcf330e82dfb4d7875aa8a70c1f4d7b5e7d42e6bb","source_path":".dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-04-test-design.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
created_at: "2026-09-05T13:53:35Z"
updated_at: "2026-09-06T01:46:30Z"
depends_on: ["SYS-TCF-P03"]
related_nodes: ["spec-total-cashflow-requirements","arch-total-cashflow-backend","arch-total-cashflow-database","arch-total-cashflow-frontend"]
resource_scope: ["packages/core/test","packages/api/test","packages/web/test"]
purpose: "受入 8 件それぞれに対応するテストが存在し、実装前の現行コードに対して確かに落ちる状態。「0 件の違反」と「0 件しか調べていない」を区別できるよう、件数を固定した検査にする。"
goal: "受入条件と 1 対 1 に対応する失敗するテストを先に書く"
scope_in: ["packages/core/test","packages/api/test","packages/web/test"]
scope_out: ["実装コードの変更 (P05 の責務)"]
acceptance: ["受入 8 件それぞれに対応するテストが 1 件以上存在し、対応表が記録されている","追加したテストを実装前のコードに対して実行すると全て失敗する (赤であることを実測した記録がある)","件数を固定した検査を含み、検査対象が 0 件でも緑になるテストが 0 件である","一覧表の列数を 9 に固定した検査 (月・総収入・総支出・総収支・事業費・家計費・事業費へ寄せた件数・要確認件数・トレンド) と、取込完了時に要確認が残っていれば警告が出ることの検査が含まれている"]
architecture_refs: ["arch-total-cashflow-backend","arch-total-cashflow-database","arch-total-cashflow-frontend"]
parent_feature: "feat-total-cashflow"
feature_package_id: "feature-package/feat-total-cashflow"
phase_ref: "P04"
classification_confidence: 1.0
classification_reason: "P04 は feature feat-total-cashflow の 13 phase 固定スロットのうち phase-04-test-design に対応する実行タスクであり、成果物は tasks/ 配下の task 文書として登録する。"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-total-cashflow/sys-tcf-p04.md","confidence":1.0}]
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":["total-cashflow","quality"],"milestone":null,"mode":"local_only","project_aliases":[]}
issue_linkage: null
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-06T01:46:30Z","evidence_refs":["eval-log/tcf-red-run.txt","sha256:151aada55a51795cbffad2491cce9308105ada73991886cbdaa0b66ca5f4c975","eval-log/tcf-p04-acceptance.json","packages/core/test/total-cashflow-contract.test.ts","packages/api/test/total-cashflow-verdict.integration.test.ts","packages/web/test/total-cashflow-table.dom.test.tsx","packages/web/test/import-review-notice.dom.test.tsx"],"policy":"manual","reconciled_at":null,"source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-05T13:13:34Z","missing_sections":[],"status":"complete"}
---

> **この文書が正本。** `.dev-graph/plans/feature-package-feat-total-cashflow/task-specs/phase-04-test-design.md` はこれを生成した staging snapshot で、promotion 後の更新は本書だけに入れる。
# System task overlay: 受入条件と 1 対 1 に対応する失敗するテストを先に書く

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p04 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-frontend
- parent_feature: feat-total-cashflow
- phase_ref: P04
- classification: confidence 1.0 / reason: P04 は 13 phase 固定スロットの phase-04-test-design に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p04.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, quality / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

受入 8 件それぞれに対応するテストが存在し、実装前の現行コードに対して確かに落ちる状態。「0 件の違反」と「0 件しか調べていない」を区別できるよう、件数を固定した検査にする。

## 背景

実装後に書いたテストは、実装の写しになりやすく、旧実装を落とせないことがある。先に書いて赤を確認しておけば、緑になったことが仕様の充足を意味する。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-frontend
- Entry gate: P03 のレビュー記録が存在し、未解決の反例が 0 件である
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P03

## Workstream applicability

- Frontend: applicable: 一覧表の列と合計表示を検証するテストを設計する
- Backend: applicable: 消し込みと合算の純関数に対する単体テストを設計する
- API: N/A: この phase は HTTP 契約を変更しない
- Data: applicable: 判定の再取込冪等性を検証するテストを設計する
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 受入 8 件に対応するテストを追加し、実装前に全て失敗することを記録する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-frontend
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: テスト追加のみで本体コードを変更しない

## 成果物

- Produced artifacts: packages/core/test 配下の消し込み・合算・トレンドテスト、packages/api/test の判定登録テスト、packages/web/test の一覧表テスト
- Consumed artifacts: specs/total-cashflow-requirements.md の受入節
- Write scope/touches: packages/core/test, packages/api/test, packages/web/test

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, quality / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P04 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p04 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P04 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P03) が完了済みで、write_scope (packages/core/test, packages/api/test, packages/web/test) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 実装コードの変更 (P05 の責務)

## Verification and evidence

- Automated commands:
  - pnpm test --filter @kanjo/core を実装前に実行し、追加テストが失敗することを記録する
  - rg -n '受入' packages/core/test で受入条件との対応表があることを確認する
  - rg -n '9|警告' packages/web/test で 9 列固定と警告表示の検査が存在することを確認する
- Required evidence:
  - eval-log/tcf-red-run.txt

## Rollout and rollback

- Rollout: テスト追加のみ
- Rollback trigger and steps: 受入条件が P01 で変更され、テストの対応が崩れた場合 — 追加したテストファイルを削除する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-frontend
- Feature: feat-total-cashflow
- Phase doc: P04 (phase-04-test-design)
- Dependencies: SYS-TCF-P03
