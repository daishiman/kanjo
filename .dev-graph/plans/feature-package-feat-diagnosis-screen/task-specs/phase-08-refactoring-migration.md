# P08 tradeoffCandidates の統合と D1 migration の整理

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P08
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P08
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p08.md
- depends_on: SYS-DIAGNOSIS-SCREEN-P07

## 目的

既存 tradeoffCandidates() の 5 種を検知器レジストリへ寄せて重複実装を除去し、migration 番号を origin/main の最新最大番号 + 1 に整える。

## 背景

重複実装が残ると G2 が壊れる。また migration 番号は他ブランチと衝突しうるため、統合の最終段で最新の origin/main を取り直して番号を確定する必要がある。

## 前提条件

- P07 の受入判定が PASS であること。
- origin/main を fetch し直して migration の最大番号を確認できること。

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

- deploy_unit: cloudflare-d1
- build_target_kind: application-code
- 構造上の中心は ADR-001 の検知器レジストリであり、packages/web と packages/api は improvements を描画・転送するだけの汎用機構として扱う。
- write_scope: packages/core/src, migrations

## 成果物

- tradeoffCandidates() の 5 種をレジストリへ寄せた core の整理。
- migration 番号の最終確定 (repository 直下 migrations の既存最大番号 + 1 の連番 1 本)。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- 新しい検知器の追加。本 feature の範囲外。
- 既存表の行書き換え。方針として行わない。

## Verification and evidence

- 同じ観点の実装が core に 1 箇所だけであること。
- migration が新表の作成のみで既存表に触れないこと。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: cloudflare-d1 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: 統合コミットを revert する。migration は追加のみのため巻き戻しを行わない。

## Handoff

次 phase P09 (SYS-DIAGNOSIS-SCREEN-P09) へ成果物と判定結果を引き渡す。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
