# SYS-ACCTLOGIN-P10 最終レビューと残課題の確定

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P10
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P10
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P10.md
- `workstream_kind`: quality
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P09

## 目的

P01 から P09 までの結果を通しで見直し、リリースしてよい状態かを一箇所で判定する。

## 背景

個々のフェーズが緑でも、フェーズ間の受け渡しで落ちたものは誰も見ていない。最後に通しで突き合わせて、抜けが無いことを確かめる。

## 前提条件

P09 の総点検が完了していること。

## Workstream applicability

- 主 workstream: quality
- 副 workstream: documentation
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-security、arch-account-login-maintenance-ops
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- P01 から P09 までの成果と受入8件の対応表
- 残課題の一覧と、リリース前に閉じるか後続に送るかの判断記録
- リリース可否の判定

## Tracker publication and completion

- `tracker_binding_intent`: beads
- `github_publication.mode`: local_only
- `pr_completion_policy`: linked_pr_merged_all
- 完了は、ひも付いた pull request が既定ブランチへ全て取り込まれた時点で投影する。

## Branch and worktree execution

- `strategy`: one-task-one-branch
- `worktree_lease_required`: true
- `completion_projection`: default-branch-reconciliation
- `assignment_owner`: dev-graph-scheduler
- 着手時に worktree lease を claim し、完了時に release する。

## スコープ外

新規の機能追加。残課題は後続 feature の候補として返し、本 package へ追加しない。

## Verification and evidence

- 受入8件の全てに、それを満たしたフェーズと根拠がひも付くことを確認する
- 残課題の各行に、閉じるか後続へ送るかの判断が記録されていることを確認する

### 受入条件

- 受入8件の全てについて、充足の根拠となるフェーズ成果が特定されている
- 残課題が全て、リリース前に閉じるか後続へ送るかのいずれかに分類されている
- リリース可否が明示的に判定されている

## Rollout and rollback

判定記録だけを生成するため、記録を破棄すれば元に戻る。

## Handoff

リリース可否の判定と残課題一覧を P11 の証跡と P13 のリリースへ渡す。

## 参照情報

- architecture/account-login-security.md
- architecture/account-login-maintenance-ops.md
