# P13 本番反映 (Migrate APPLY から Deploy)

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P13
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P13
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p13.md
- depends_on: SYS-DIAGNOSIS-SCREEN-P12

## 目的

本番へ manifest から Migrate APPLY を経て Deploy の順で反映し、適用結果を CI ログから辿れる状態にする。

## 背景

Deploy を先に流すと、新表を前提とするコードが表のない本番に当たる。順序の固定がこの phase の本質である。

## 前提条件

- P12 の docs 更新が完了していること。
- P09 の 5 ゲートが緑のままであること。

## Workstream applicability

- frontend: applicable: /analysis/diagnosis の画面と子コンポーネント群、searchParams による条件の保持が対象になる。
- backend: applicable: packages/core の純粋関数と packages/api の Dataset 組み立てが対象になる。
- api: applicable: GET /api/diagnosis の拡張と PATCH /api/diagnosis/actions の新設が対象になる。
- data: applicable: D1 の diagnosis_action_states と migration が対象になる。
- infrastructure: applicable: Cloudflare Workers と D1 の既存構成の上で動き、新しいサービスを足さない。
- security: applicable: 未認証 401 と許可リスト方式の 400、プレースホルダ束縛が対象になる。
- quality: applicable: 境界値テスト・contract tests・統合テストと既存 CI ゲートの緑維持が対象になる。
- documentation: applicable: docs/diagnosis-screen.md の計算規則と手順の記載が対象になる。
- operations: applicable: manifest から Migrate APPLY を経て Deploy の順での本番反映が対象になる。

## Architecture and deploy unit

- deploy_unit: cloudflare-workers-api
- build_target_kind: application-code
- 構造上の中心は ADR-001 の検知器レジストリであり、packages/web と packages/api は improvements を描画・転送するだけの汎用機構として扱う。
- write_scope: migrations, packages/api/src, docs

## 成果物

- Migrate APPLY の適用結果。
- Deploy の実行結果。
- 本番反映の記録。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- 新しい秘密情報の投入。増やさない方針のため行わない。
- 既存表の行書き換え。行わない。

## Verification and evidence

- Migrate APPLY が Deploy より先に完了していること。
- 適用結果が CI ログから追えること。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: cloudflare-workers-api 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: 画面と API の変更を戻す。新表は追加のみのため残っても既存機能に影響せず、migration の巻き戻しは行わない。

## Handoff

本 feature の最終 phase であり、引き渡し先は dev-graph の完了投影となる。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
