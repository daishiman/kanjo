# SYS-ANHUB-P03 支出分析ハブ 設計レビューの実施と記録

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P03",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P03",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P02"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p03.md"
}
```

## 目的

P02 の決定記録を独立レビューし、C1 (集計は core の純関数)・C4 (総収支は freee 正本) と FR-001..006/AC-001..006 の判定基準に対する齟齬の有無を記録する。

## 背景

feature-execution-package-contract.md の P03 責務は設計レビューであり、実装 (P05) 着手前に決定記録の整合性検査を独立の phase として行うことで、後戻りコストの大きい実装後の設計修正を防ぐ。

## 前提条件

- Entry gate: P02 の docs/analysis-hub/architecture-decision.md が存在すること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P02

## Workstream applicability

主分類: Quality / 副分類: documentation

- Frontend: N/A: レビュー記録のみで実装コード変更を持たない
- Backend: N/A: レビュー記録のみで実装コード変更を持たない
- API: N/A: レビュー記録のみで実装コード変更を持たない
- Data: N/A: レビュー記録のみでスキーマ変更を持たない
- Infrastructure: N/A: レビュー記録のみで配信構成の変更を持たない
- Security: applicable — URL コピーの情報最小化 (focus のみ) と C3 例外方針のレビュー
- Quality: applicable — P02 決定記録の独立レビューと FR-001..006/AC-001..006 判定基準の指摘有無を記録する
- Documentation: applicable — docs/analysis-hub/design-review.md を新設する
- Operations: N/A: レビュー記録のみで運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: P02 で確定した ADR 群をレビュー対象とし、決定そのものは変更しない。指摘があれば docs/analysis-hub/design-review.md に記録し P02 の再オープン要否を明記する。
- Deploy unit: N/A: レビュー記録のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/design-review.md (レビュー結果、指摘事項の有無、再オープン要否の判定)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/architecture-decision.md, architecture/analysis-hub-security.md, architecture/analysis-hub-auth.md
- Write scope: `docs/analysis-hub/design-review.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P03 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- 決定記録の内容変更そのもの (指摘は記録に留め、変更は P02 の再オープンとして扱う)
- 実装コードの変更
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/design-review.md`
- Required evidence: docs/analysis-hub/design-review.md の diff。レビュー観点 (C1/C3/C4 整合、FR/AC 判定基準の充足) ごとの判定が記載されていること

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/design-review.md を削除する。指摘が P02 の再オープンを要する場合は P02 の決定記録を直接修正する。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p03.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/security.md
- system-spec/auth.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P02
