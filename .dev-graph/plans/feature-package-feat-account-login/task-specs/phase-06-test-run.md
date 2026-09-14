# SYS-ACCTLOGIN-P06 テスト実行と失敗経路の確認

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P06
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P06
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P06.md
- `workstream_kind`: quality
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P05

## 目的

P04 で設計し P05 で実装したテストを実行し、緑であることと、旧実装では赤であったことの両方を記録する。

## 背景

緑になったという事実だけでは、テストが何かを検算したのか、単に何も調べていないのかを区別できない。旧実装に対して落ちることを併せて確認して初めて、テストが受入の代理になる。

## 前提条件

P05 の実装が完了し、テストが実装済みであること。

## Workstream applicability

- 主 workstream: quality
- 副 workstream: security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-security、arch-account-login-auth
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- テスト実行結果 (件数・成功・失敗の内訳)
- 旧実装に対する実行結果と、落ちたケースの一覧
- 失敗経路ケースの実行記録

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

テスト内容の変更。緑にするために判定条件を緩める修正は行わない。

## Verification and evidence

- テスト件数が P04 の設計件数と一致し、失敗が0件であることを確認する
- 旧実装に対して、受入に対応する各テストが落ちたことを実行記録で確認する

### 受入条件

- P04 で設計した全テストが実行され、失敗が0件である
- 旧実装に対する実行で、受入に対応するテストが落ちたことが記録されている
- 失敗経路のケースが期待どおりの応答を返すことが記録されている

## Rollout and rollback

実行と記録だけを行うため、記録を破棄すれば元に戻る。

## Handoff

実行記録を P07 の受入確認と P11 の証跡整備へ渡す。

## 参照情報

- architecture/account-login-security.md
- architecture/account-login-auth.md
