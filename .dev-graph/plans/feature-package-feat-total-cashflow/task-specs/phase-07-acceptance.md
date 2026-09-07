# System task overlay: 実データで受入条件を利用者視点から確認する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p07 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-frontend, arch-total-cashflow-ui-ux
- parent_feature: feat-total-cashflow
- phase_ref: P07
- classification: confidence 1.0 / reason: P07 は 13 phase 固定スロットの phase-07-acceptance に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p07.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, quality / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

利用者が実際の freee / Money Forward データで一覧表を開き、総額の推移が読めること、消し込み結果を手で検算できることを確認した状態。

## 背景

受入条件は機械的に検査できても、「トータルでどれぐらいプラスマイナスか分かる」という当初の困りごとが 解けたかは実データで見ないと分からない。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-frontend, arch-total-cashflow-ui-ux
- Entry gate: P06 のテスト実行記録が存在し、失敗 0 件である
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P05, SYS-TCF-P06

## Workstream applicability

- Frontend: applicable: 一覧表の表示が期間切替で崩れないことを確認する
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 受入条件を実データで 1 件ずつ確認する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-frontend / arch-total-cashflow-ui-ux
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 確認のみ

## 成果物

- Produced artifacts: eval-log/tcf-acceptance.md (受入条件ごとの確認結果)
- Consumed artifacts: 稼働中の kanjo-console と取込済みデータ
- Write scope/touches: eval-log/tcf-acceptance.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, quality / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P07 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p07 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P07 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P05, SYS-TCF-P06) が完了済みで、write_scope (eval-log/tcf-acceptance.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 不成立時の実装修正 (P05 へ差し戻す)

## Verification and evidence

- Automated commands:
  - rg -n '成立|不成立' eval-log/tcf-acceptance.md
  - rg -c '^- 受入' eval-log/tcf-acceptance.md の出力が 10 であること (受入 8 件 + 9 列 + 警告)
  - rg -n '9 列|警告' eval-log/tcf-acceptance.md
- Required evidence:
  - eval-log/tcf-acceptance.md

## Rollout and rollback

- Rollout: 確認記録の追加のみ
- Rollback trigger and steps: 受入条件のいずれかが不成立の場合 — eval-log/tcf-acceptance.md を削除して再確認する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-frontend / arch-total-cashflow-ui-ux
- Feature: feat-total-cashflow
- Phase doc: P07 (phase-07-acceptance)
- Dependencies: SYS-TCF-P05, SYS-TCF-P06
