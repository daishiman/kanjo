# P05 検知器レジストリ・健全性スコア・2 endpoint・D1 新表・診断画面の実装

## Machine-readable registration fields

- task_id: SYS-DIAGNOSIS-SCREEN-P05
- feature_package_id: feature-package/feat-diagnosis-screen
- parent_feature: feat-diagnosis-screen
- phase_ref: P05
- owners: SH2-maintainer
- tags: diagnosis, analysis, system-dev-plan
- related_nodes: spec-diagnosis-screen, arch-diagnosis-screen
- classification: artifact_kind=task, confidence=1.0
- tracker_binding_intent: beads
- github_publication: mode=local_only, project_aliases=none, labels=none, milestone=none
- pr_completion_policy: linked_pr_merged_all
- branch_policy: strategy=one-task-one-branch, worktree_lease_required=true, completion_projection=default-branch-reconciliation, assignment_owner=dev-graph-scheduler
- graph_node_registration: file_path=tasks/feat-diagnosis-screen/sys-diagnosis-screen-p05.md
- depends_on: SYS-DIAGNOSIS-SCREEN-P04

## 目的

P02 の境界どおりに core の検知器レジストリと健全性スコアを実装し、GET /api/diagnosis を拡張して PATCH /api/diagnosis/actions を新設し、D1 の diagnosis_action_states を作り、/analysis/diagnosis の画面を 11 ブロック構成で作り直す。

## 背景

仕様と設計が確定し、テスト入力表も揃った段階で初めてコードを書く。画面と API が検知器の種類を知らない構造を守ることが、この phase の成否を決める唯一の構造条件である。

## 前提条件

- P04 のテスト入力表が確定していること。
- repository 直下の migrations ディレクトリ (wrangler.jsonc の migrations_dir が指す実体) の既存最大番号を origin/main を取り直して確認済みであること。

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

- deploy_unit: browser-web-bundle
- build_target_kind: application-code
- 構造上の中心は ADR-001 の検知器レジストリであり、packages/web と packages/api は improvements を描画・転送するだけの汎用機構として扱う。
- write_scope: packages/core/src, packages/api/src/routes, migrations, packages/web/src/pages/analysis, packages/web/src

## 成果物

- packages/core の検知器レジストリ 6 種と diagnosis() の再構成。
- packages/core の健全性スコア (実測値・要素スコア・重み・寄与点の内訳を返す)。
- packages/api の GET /api/diagnosis 拡張と PATCH /api/diagnosis/actions の新設。
- repository 直下の migrations ディレクトリへ新表 diagnosis_action_states を作る migration 1 本。
- packages/web の /analysis/diagnosis 画面と子コンポーネント群、DiagnosisData 型の拡張。

## Tracker publication and completion

- tracker: beads (issue_prefix kanjo)。GitHub Issue は作らず local_only とする。
- 完了は linked_pr_merged_all で判定する。PR が既定ブランチへ merge された時点を完了とする。
- 完了の投影は default-branch-reconciliation に従い、dev-graph sync が冪等に収束させる。

## Branch and worktree execution

- strategy: one-task-one-branch。本 task 専用のブランチで作業する。
- worktree lease を claim してから着手し、作業中は heartbeat を維持する。
- 完了または中断時に lease を release する。lease を持たない並行編集を行わない。

## スコープ外

- テストの実行と緑化。P06 が行う。
- 既存 tradeoffCandidates() の重複除去。P08 が行う。

## Verification and evidence

- packages/web と packages/api に検知器 id の分岐が 0 件であること。
- 色と余白の直書きが lint で 0 件であること。
- migration が既存表の行書き換えを含まないこと。
- 証跡は実測値で記録し、推定を実測として記載しない。

## Rollout and rollback

- rollout: browser-web-bundle 単位で反映する。本番反映は manifest から Migrate APPLY を経て Deploy の順を守る。
- rollback: 当該コミットを revert する。新表は作成のみで既存データを書き換えないため、表が残っても既存機能に影響しない。

## Handoff

次 phase P06 (SYS-DIAGNOSIS-SCREEN-P06) へ成果物と判定結果を引き渡す。
- 引き渡す内容は成果物一覧と Verification の判定結果とする。
- 未解決の論点がある場合は follow-up feature candidate として dev-graph へ返し、本 package へ 14 件目を足さない。

## 参照情報

- specs/spec-diagnosis-screen.md
- architecture/arch-diagnosis-screen.md
- features/feat-diagnosis-screen.context.json
- system-spec/index.md
