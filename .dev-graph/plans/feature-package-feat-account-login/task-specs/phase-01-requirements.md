# SYS-ACCTLOGIN-P01 認証要件ベースラインの確定

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P01
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P01
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P01.md
- `workstream_kind`: documentation
- `build_target_kind`: script
- `depends_on`: なし (本 feature の先頭タスク)

## 目的

feature の受入8件を、実装が観測できる粒度の要件ベースラインへ写し取り、以降12フェーズが同じ基準で判定できるようにする。

## 背景

現状は AUTH_PASSWORD という単一の共有秘密で全ての金融明細へ到達できる。権限の主体を個人へ移す変更は認証・データ・画面・運用の4面に同時に触れるため、何をもって完了とするかを先に一点へ固定しないと各面が別々の基準で進む。

## 前提条件

features/feat-account-login.md が confirmed かつ evaluation_status=pass であり、architecture 8章と specs/spec-account-login.md が確定済みであること。

## Workstream applicability

- 主 workstream: documentation
- 副 workstream: security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-auth、arch-account-login-security
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 受入8件と観測点の対応表 (空欄0行)
- 触れてよい既存資産と触れてはならない既存資産の一覧
- 参照した system-spec / architecture の digest 記録

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

要件の新規追加。ベースラインは既存の確定仕様を写すだけで、新しい要件を発明しない。

## Verification and evidence

- 受入8件それぞれに、実行時に真偽が判定できる観測点が1件以上ひも付いていることを確認する
- ベースラインが参照した確定文書の digest が、現行ファイルの digest と一致することを確認する

### 受入条件

- features/feat-account-login.md の受入8件が漏れなくベースラインへ写され、各件に観測可能な判定条件が付いている
- 利用者ドメイン・認証API・ログイン画面・管理画面の4面それぞれについて、変更してよい既存資産の境界が列挙されている
- Cloudflare Access 経路・自己サインアップ・メール送信によるリセットを実装しないことが、スコープ外として明記されている

## Rollout and rollback

記録だけを行い既存コードへ触れないため、生成した証跡 JSON を削除すれば元の状態に戻る。

## Handoff

確定したベースラインを P02 の設計入力とし、受入条件の観測点一覧を P04 のテスト設計へ渡す。

## 参照情報

- architecture/account-login-auth.md
- architecture/account-login-security.md
- specs/spec-account-login.md
