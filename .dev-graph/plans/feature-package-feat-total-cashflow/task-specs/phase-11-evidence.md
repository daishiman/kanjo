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
