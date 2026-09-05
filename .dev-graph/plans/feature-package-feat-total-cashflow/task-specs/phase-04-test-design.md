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
