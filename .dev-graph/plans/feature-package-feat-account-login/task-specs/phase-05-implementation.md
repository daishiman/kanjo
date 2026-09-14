# SYS-ACCTLOGIN-P05 利用者認証と管理画面の実装

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P05
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P05
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P05.md
- `workstream_kind`: backend
- `build_target_kind`: application-code
- `depends_on`: SYS-ACCTLOGIN-P04

## 目的

P02 の設計と P04 のテスト設計に従って、利用者テーブル・認証API・ログイン画面・管理画面を実装する。

## 背景

この feature の実体はここで生まれる。4面 (スキーマ・API・ログイン画面・設定画面) が同時に揃わないと、どれか一つでも欠けると認証が成立しないため、一つの実行単位として扱う。

## 前提条件

P02 の設計、P03 のレビュー結果、P04 のテスト設計が全て確定していること。

## Workstream applicability

- 主 workstream: backend
- 副 workstream: frontend、data、security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-database、arch-account-login-backend、arch-account-login-frontend、arch-account-login-ui-ux
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- users と audit_log を作る migration
- ログイン・ログアウト・セッション検証の API ハンドラ
- 管理者による招待・停止・一時パスワード再発行の API ハンドラ
- 参照画像を正とするログイン画面と、パスワード失念時の案内ダイアログ
- 設定画面の利用者管理セクション
- P04 で設計したテストの実装

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

メール送信基盤の導入、外部 IdP との連携、多要素認証。

## Verification and evidence

- P04 で設計した全テストが実装され、実行して緑になることを確認する
- パスワードの平文がログ・レスポンス・データベースのいずれにも残らないことを、該当コード経路の確認で検証する

### 受入条件

- 正しいメールアドレスとパスワードで認証が成功し、誤った資格情報では成功しない
- パスワードが PBKDF2-HMAC-SHA256 で 210,000 回以上反復した派生値として保存され、平文がどこにも残らない
- 管理者が設定画面から利用者の追加・停止・一時パスワード再発行を完結でき、一時パスワードは発行直後の1度だけ表示される
- ログイン画面がヘッダー・フッター・サイドバーを描画せず、アイコンが常にテキストラベルと併記されている

## Rollout and rollback

実装は専用ブランチで行うため、ブランチを破棄すれば既存の動作へ戻る。migration は未適用の状態で保持し、本番配信は P13 まで行わない。

## Handoff

実装済みコードと通過したテストを P06 のテスト実行へ渡す。

## 参照情報

- architecture/account-login-database.md
- architecture/account-login-backend.md
- architecture/account-login-frontend.md
- architecture/account-login-ui-ux.md
