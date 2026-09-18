# P06 テスト実行と緑化

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P06
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P06
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p06.md
- depends_on: SYS-DIAGNOSIS-SCREEN-P05

## 目的

P04 が設計した境界値・contract・統合テストを実装して実行し、typecheck / lint / test を緑にする。

## 背景

テストを緑にするために契約を緩めてはならない。件数と金額を固定値で検算し、旧実装では落ちることを確認してから緑化する。

## 前提条件

- P05 の実装が完了していること。
- P04 のテスト入力表が参照できること。

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

- deploy_unit: ci-pipeline
- build_target_kind: application-code
- 構造上の中心は ADR-001 の検知器レジストリであり、packages/web と packages/api は improvements を描画・転送するだけの汎用機構として扱う。
- write_scope: packages/core/src, packages/api/src/routes, packages/web/src

## 成果物

- 検知器 6 種の境界値テスト。
- 健全性スコアの 3 点の境界値テスト。
- 2 endpoint の contract tests と対応状況の復元を確かめる統合テスト。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- 受入条件の判定。P07 が行う。
- CI ゲート全体の維持確認。P09 が行う。

## Verification and evidence

- typecheck / lint / test が exit 0 であること。
- 検知器を 1 件足したテストで画面と API を編集せずに新しい課題が現れること。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: ci-pipeline 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: テスト追加コミットを revert する。プロダクト挙動に影響しない。

## Handoff

次 phase P07 (SYS-DIAGNOSIS-SCREEN-P07) へ成果物と判定結果を引き渡す。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
