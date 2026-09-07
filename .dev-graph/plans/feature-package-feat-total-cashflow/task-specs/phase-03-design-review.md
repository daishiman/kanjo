# System task overlay: 設計が受入条件を実際に満たしうるかを反例探索で検証する

## Machine-readable registration fields

- feature_package_id: feature-package/feat-total-cashflow
- owners: daishiman / tags: total-cashflow, web, p03 / related_nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-security
- parent_feature: feat-total-cashflow
- phase_ref: P03
- classification: confidence 1.0 / reason: P03 は 13 phase 固定スロットの phase-03-design-review に対応する / candidate: tasks/feat-total-cashflow/sys-tcf-p03.md
- tracker_binding_intent: beads
- github_publication: mode local_only / project_aliases なし / labels total-cashflow, quality / milestone なし
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch / worktree lease 必須 / default-branch-reconciliation / assignment_owner dev-graph-scheduler

## 目的

P02 の設計に対し、受入条件を破る入力を先に列挙し、設計が破綻しないことを確認した状態。同額同日が 3 件以上並ぶ場合や、口座 3 つのうち 1 つだけが重複する場合の扱いが決まる。

## 背景

三井住友銀行の口座は 3 つあり、重複するのはそのうち 1 つ。MF 側だけを見るとどの口座か判別できない。同額同日が複数並ぶと 1 対 1 対応が一意に決まらず、消し込みが多すぎたり少なすぎたりする。

## 前提条件

- Required spec/architecture nodes: spec-total-cashflow-requirements, arch-total-cashflow-backend, arch-total-cashflow-database, arch-total-cashflow-security
- Entry gate: P02 の architecture 文書が更新済みで、層分担と一意キーが読み取れる
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity github:daishiman/kanjo / root_resolution_source explicit-cli / .dev-graph/config.json (絶対パスを保存しない)
- Dependencies: SYS-TCF-P02

## Workstream applicability

- Frontend: N/A: この phase は web の描画実装を触らない
- Backend: applicable: 多対多になる同額同日の突合を、決定的な順序で 1 対 1 へ落とす規則を確認する
- API: N/A: この phase は HTTP 契約を変更しない
- Data: applicable: 一意キーが反例入力で衝突しないことを確認する
- Infrastructure: N/A: この phase は wrangler 設定とバインディングを変更しない
- Security: applicable: 判定登録が認証済み経路の内側にあることを確認する
- Quality: applicable: 受入条件ごとに反例候補を作り、設計が拒否できるかを机上で追跡する
- Documentation: N/A: この phase は利用者向け文書を更新しない
- Operations: N/A: この phase は運用手順と監視を変更しない

## Architecture and deploy unit

- Architecture decisions: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-security
- Deploy unit/environment: N/A: 配備単位を持たない。リポジトリ内文書と検証記録だけを生成する
- Compatibility/migration/backfill: N/A: レビューのみでコードとスキーマを変更しない

## 成果物

- Produced artifacts: eval-log/tcf-design-review.md (反例一覧と設計側の応答)
- Consumed artifacts: architecture/total-cashflow-*.md、specs/total-cashflow-requirements.md
- Write scope/touches: eval-log/tcf-design-review.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: project_aliases なし / labels total-cashflow, quality / milestone なし
- PR completion policy: linked_pr_merged_all
- PR body contract: dev-graph graph_node_id SYS-TCF-P03 を本文に記し、default branch を対象にする。Beads issue 番号は dev-graph の sync が採番したものを追記する
- Ownership boundary: system-dev-planner は intent を宣言するだけで、永続 binding の解決・起票・完了収束は dev-graph が所有する

## Branch and worktree execution

- Branch: dev-graph 登録後に C15 が devgraph/sys-tcf-p03 を割り当てる。system-dev-planner は事前割当しない
- Worktree lease: 実装着手前に graph_node_id SYS-TCF-P03 を claim し、作業中は heartbeat、終了時に release する
- Parallel safety: depends_on (SYS-TCF-P02) が完了済みで、write_scope (eval-log/tcf-design-review.md) が他の active lease と重ならないこと
- Completion projection: feature branch では pending event だけを記録し、default branch がクリーンになった時点で done を永続化する

## スコープ外

- テストコードの作成 (P04 の責務)

## Verification and evidence

- Automated commands:
  - rg -n '反例' eval-log/tcf-design-review.md
  - rg -n '未解決' eval-log/tcf-design-review.md
- Required evidence:
  - eval-log/tcf-design-review.md

## Rollout and rollback

- Rollout: レビュー記録の追加のみ
- Rollback trigger and steps: 設計に未解決の反例が残り、P05 へ進めないと判断した場合 — eval-log/tcf-design-review.md を削除し P02 へ戻す

## Handoff

- Executor: dev-graph の task-graph 経路 (build_target_kind: application-code)
- Ready when: 引用元が confirmed かつ evaluation pass、C08 readiness complete、promotion 済み digest が staging と一致し、dev-graph への task 登録が完了していること

## 参照情報

- System specification: spec-total-cashflow-requirements (system-spec/00-requirements-definition.md 由来)
- Architecture: arch-total-cashflow-backend / arch-total-cashflow-database / arch-total-cashflow-security
- Feature: feat-total-cashflow
- Phase doc: P03 (phase-03-design-review)
- Dependencies: SYS-TCF-P02
