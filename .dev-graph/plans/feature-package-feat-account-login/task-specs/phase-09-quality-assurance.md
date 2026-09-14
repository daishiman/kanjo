# SYS-ACCTLOGIN-P09 セキュリティ観点の総点検

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P09
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P09
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P09.md
- `workstream_kind`: security
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P08

## 目的

実装済みの系に対して、P03 で挙げた脅威が実際に防げているかを確認し、受容した指摘の現状を点検する。

## 背景

設計時に防げるはずだったことと、実装後に実際に防げていることは別である。特に総当たりの抑止やログ出力の内容は、実装の細部で穴が開きやすい。

## 前提条件

P08 の旧経路除去が完了していること。

## Workstream applicability

- 主 workstream: security
- 副 workstream: quality
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-security、arch-account-login-auth、arch-account-login-infrastructure
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- P03 の脅威一覧に対する実機確認結果
- ログ出力に資格情報が含まれないことの確認記録
- ログイン失敗率とロックアウトの監視が機能することの確認記録

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

外部の侵入テスト事業者による診断の実施。

## Verification and evidence

- P03 の脅威一覧の各行について、実機での確認結果が記録されていることを確認する
- 認証関連のログ出力を実際に採取し、パスワードとセッション値が含まれないことを確認する

### 受入条件

- 総当たり抑止が実際に働き、規定回数を超えた試行が拒否されることが確認されている
- ログ・エラー応答・監査記録のいずれにもパスワードとセッション値が含まれないことが確認されている
- audit_log に認証操作が actor_user_id 付きで記録されることが確認されている

## Rollout and rollback

点検記録だけを生成するため、記録を破棄すれば元に戻る。

## Handoff

点検結果を P10 の最終レビューへ渡す。

## 参照情報

- architecture/account-login-security.md
- architecture/account-login-auth.md
- architecture/account-login-infrastructure.md
