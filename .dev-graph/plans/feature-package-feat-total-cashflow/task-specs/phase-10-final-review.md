# System task overlay: 当初の困りごとが解けたかを最終確認する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p10 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-ui-ux
- parent_feature: feat-total-cashflow
- phase_ref: P10
- classification: confidence 1.0 / reason: P10 は 13 phase 固定スロットの phase-10-final-review に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p10.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, quality / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

「事業と家計が一緒くたで、トータルでどれぐらいプラスマイナスか分からない」という当初の困りごとに対し、作ったものが答えになっているかを、ゲートの緑とは別に判断した状態。

## 背景

ゲートが全て緑でも中身が正しいとは限らない。緑は仕様と矛盾しないことを示すだけで、仕様が困りごとを捉え損ねていた場合はそのまま通る。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-ui-ux
- Entry gate: P07 の受入確認と P09 の品質ゲートがいずれも完了している
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P07, SYS-TCF-P09

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: N/A: この phase は Workers 実行コードを触らない
- API: N/A: この phase は HTTP 契約を変更しない
- Data: N/A: この phase は D1 スキーマとマイグレーションを触らない
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: N/A: この phase は認証・認可の制御点を変更しない
- Quality: applicable: 困りごとと成果物の対応を 1 件ずつ突き合わせる
- Documentation: applicable: 残課題を follow-up 候補として記録する
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: spec-total-cashflow-requirements / arch-total-cashflow-ui-ux
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: 確認のみ

## 成果物

- Produced artifacts: eval-log/tcf-final-review.md (困りごとと成果物の対応・残課題)
- Consumed artifacts: eval-log/tcf-acceptance.md、eval-log/tcf-qa.md
- Write scope/touches: eval-log/tcf-final-review.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, quality / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P10 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p10 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P10 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P07, SYS-TCF-P09) が完了済みで、write_scope (eval-log/tcf-final-review.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- 残課題の実装 (別 feature の責務)

## Verification and evidence

- Automated commands:
  - rg -n '残課題' eval-log/tcf-final-review.md
  - rg -n 'follow-up' eval-log/tcf-final-review.md
- Required evidence:
  - eval-log/tcf-final-review.md

## Rollout and rollback

- Rollout: 確認記録の追加のみ
- Rollback trigger and steps: 困りごとに対応しない成果物が見つかった場合 — eval-log/tcf-final-review.md を削除して再確認する

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: spec-total-cashflow-requirements / arch-total-cashflow-ui-ux
- Feature: feat-total-cashflow
- Phase doc: P10 (phase-10-final-review)
- Dependencies: SYS-TCF-P07, SYS-TCF-P09
