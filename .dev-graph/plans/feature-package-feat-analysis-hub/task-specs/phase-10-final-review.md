# SYS-ANHUB-P10 支出分析ハブ 最終レビューと要件突合

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P10",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P10",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "frontend",
    "backend",
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P09"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p10.md"
}
```

## 目的

P01 要件ベースラインから P09 品質保証までの全成果物を突合し、feat-analysis-hub.md の到達状態・受入条件がすべて満たされていることを独立レビューとして最終確認する。

## 背景

feature-execution-package-contract.md の P10 責務は最終レビューであり、P07 の受入判定 (AC単位) とは別に、feature 全体としての一貫性 (要件・設計・実装・品質保証の整合) を確認する必要がある。

## 前提条件

- Entry gate: P09 の docs/analysis-hub/assurance.md が全件 pass を記録していること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P09

## Workstream applicability

主分類: Quality / 副分類: frontend, backend, documentation

- Frontend: applicable — features/feat-analysis-hub.md のUI要件 (画面構成・URL・タブ・バッジ) の最終突合を行う
- Backend: applicable — API/core 要件 (previousPeriod 移設・集計純関数) の最終突合を行う
- API: N/A: 契約変更を伴わない最終確認のみ
- Data: N/A: スキーマ変更なし
- Infrastructure: N/A: 配信構成の最終確認は P09 で完了済み
- Security: N/A: セキュリティ確認は P09 で完了済み
- Quality: applicable — P01..P09 成果物全体の一貫性レビューが本taskの主責務
- Documentation: applicable — docs/analysis-hub/final-review.md を新設する
- Operations: N/A: 運用手順の最終確認は本feature スコープ外

## Architecture and deploy unit

- Architecture decisions: N/A: 本taskはアーキテクチャ決定を行わない。P02 決定記録の遵守を P01..P09 成果物全体で最終確認するのみ。
- Deploy unit: N/A: 最終レビュー記録のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/final-review.md (feature 全体の整合性レビュー結果)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/requirements-baseline.md, docs/analysis-hub/architecture-decision.md, docs/analysis-hub/acceptance.md, docs/analysis-hub/assurance.md, features/feat-analysis-hub.md
- Write scope: `docs/analysis-hub/final-review.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P10 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- レビューで判明した不整合の修正そのもの (該当 phase への差し戻し)
- 5 タブ詳細画面レビュー (本feature スコープ外)
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/final-review.md`
- Required evidence: docs/analysis-hub/final-review.md に記載した P01..P09 各成果物への参照と最終判定 (pass/fail)

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/final-review.md を削除する。不整合が判明した場合は該当 phase へ差し戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p10.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/index.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P09
