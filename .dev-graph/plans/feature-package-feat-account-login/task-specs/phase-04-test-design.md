# SYS-ACCTLOGIN-P04 受入8件に対するテスト設計

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P04
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P04
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P04.md
- `workstream_kind`: quality
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P03

## 目的

受入8件のそれぞれを、実装前の状態では必ず落ちるテストとして設計し、緑になったことが受入の充足を意味する状態を作る。

## 背景

認証のテストは、通る経路だけを書くと失敗経路の穴に気付けない。また現行実装を落とさないテストは、何も検算していないのと同じになる。落ちることを先に確かめられる設計にしておく。

## 前提条件

P01 のベースラインと P03 のレビュー結果が確定していること。

## Workstream applicability

- 主 workstream: quality
- 副 workstream: security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-auth、arch-account-login-security、arch-account-login-ui-ux
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 受入8件とテストケースの対応表
- 失敗経路のケース一覧 (誤ったパスワード・停止済み利用者・期限切れセッション・権限外アクセス)
- 各テストが現行実装に対して落ちることの事前確認手順

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

テストの実装そのもの。本フェーズは設計であり、コードは P05 で書く。

## Verification and evidence

- 受入8件の全てに対応テストが存在し、対応の無い受入が0件であることを確認する
- 各テストについて、現行実装で落ちる理由が1行で説明されていることを確認する

### 受入条件

- member が /api/admin/* の全エンドポイントに対して 403 を受け取ることを確かめるケースが設計されている
- 保持を有効にした場合は30日、無効にした場合は12時間という期限差を確かめるケースが設計されている
- ログイン画面の DOM にナビゲーション要素が0件であることを確かめるケースが設計されている

## Rollout and rollback

設計記録のみを生成するため、記録を破棄すれば元に戻る。

## Handoff

テスト設計を P05 の実装と P06 のテスト実行の入力とする。

## 参照情報

- architecture/account-login-auth.md
- architecture/account-login-security.md
- architecture/account-login-ui-ux.md
