# SYS-ACCTLOGIN-P07 受入8件の充足確認

## Machine-readable registration fields

- `graph_node_id`: SYS-ACCTLOGIN-P07
- `artifact_kind`: task
- `parent_feature`: feat-account-login
- `feature_package_id`: feature-package/feat-account-login
- `phase_ref`: P07
- `file_path`: tasks/feat-account-login/SYS-ACCTLOGIN-P07.md
- `workstream_kind`: quality
- `build_target_kind`: script
- `depends_on`: SYS-ACCTLOGIN-P06

## 目的

feature の受入8件を実際に動く系で一件ずつ確認し、充足したか否かを二値で判定する。

## 背景

自動テストは設計した観測点しか見ない。参照画像との一致や、既定の帰結が画面上で読み取れるかといった点は、実際に見て確かめる必要がある。

## 前提条件

P06 のテスト実行が全件成功していること。

## Workstream applicability

- 主 workstream: quality
- 副 workstream: frontend、security
- 本タスクは上記 workstream の責務だけを持ち、他フェーズの責務を先取りしない。

## Architecture and deploy unit

- 参照する architecture node: arch-account-login-auth、arch-account-login-ui-ux、arch-account-login-security
- deploy unit: packages/web の React SPA と packages/api の Cloudflare Workers、および Cloudflare D1 kanjo-db

## 成果物

- 受入8件の判定表 (各件に充足か未充足かと、判定の根拠)
- ログイン画面の実描画と参照画像の突き合わせ記録
- 未充足があった場合の差し戻し先フェーズの記録

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

受入条件の書き換え。未充足は差し戻しであり、条件を緩めて充足扱いにしない。

## Verification and evidence

- 受入8件の全てに判定と根拠が記録され、判定の無い行が0件であることを確認する
- ログイン画面の DOM にナビゲーション要素が0件であることを、実描画に対して確認する

### 受入条件

- 受入8件が全て充足と判定され、未充足が0件である
- 保持を有効にした場合の30日という帰結が、チェックボックスの脇で読み取れることが確認されている
- 既存20画面の呼び出しが 401 と 503 の応答契約の変更なしに動作することが確認されている

## Rollout and rollback

判定記録だけを生成するため、記録を破棄すれば元に戻る。

## Handoff

充足した受入の根拠を P11 の証跡へ渡し、P10 の最終レビューの入力とする。

## 参照情報

- architecture/account-login-auth.md
- architecture/account-login-ui-ux.md
- architecture/account-login-security.md
