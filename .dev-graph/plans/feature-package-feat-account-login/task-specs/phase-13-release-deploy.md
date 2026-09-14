# SYS-ACCTLOGIN-P13 本番反映と切替の実施

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P13
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P13
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P13.md
- `workstream_kind`: infrastructure
- `build_target_kind`: application-code
- `depends_on`: SYS-ACCTLOGIN-P12

## 目的

migration の適用、secret の入れ替え、初期管理者の作成を含む本番反映を、戻せる形で実施する。

## 背景

この反映は認証の主体そのものを切り替えるため、途中で止まると誰もログインできない状態になりうる。適用順序と、各段階で戻せるかどうかを事前に固定して実施する。

## 前提条件

P10 でリリース可と判定され、P12 の運用手順が整っていること。

## Workstream applicability

- 主 workstream: infrastructure
- 副 workstream: operations、security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-infrastructure、arch-account-login-maintenance-ops、arch-account-login-database
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 本番 D1 への migration 適用記録
- SESSION_SECRET 入れ替えと AUTH_PASSWORD 削除の実施記録
- 初期管理者アカウントの作成記録
- 反映後の疎通確認記録

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

本 feature の範囲外の設定変更や、他機能の同時リリース。

## Verification and evidence

- 反映後に、作成した管理者アカウントで実際にログインできることを確認する
- 既存20画面が反映後も 401 と 503 の応答契約どおりに動作することを確認する

### 受入条件

- 本番 D1 に users と audit_log が作成され、スキーマ版数が記録されている
- AUTH_PASSWORD が本番環境から削除され、旧経路でのログインが成立しない
- 作成した管理者アカウントでログインでき、設定画面から利用者を追加できる

## Rollout and rollback

0039は`password_login_rate_limits`と`audit_log`を変更・再構築するため、reverse migrationや旧Worker単体のrollbackは行わない。障害時は適用前のD1 Time Travel復元点と互換アプリ世代を一体で戻す。その組を使えない場合は、旧`AUTH_PASSWORD`経路を復活させずforward-fixする。

## Handoff

反映記録を feature の完了根拠へ加え、以降の運用を P12 の手順書へ引き継ぐ。

## 参照情報

- architecture/account-login-infrastructure.md
- architecture/account-login-maintenance-ops.md
- architecture/account-login-database.md
