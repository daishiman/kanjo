# SYS-ANHUB-P07 支出分析ハブ AC-001..AC-006 の受入検証

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P07",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P07",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "frontend",
    "backend",
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P06"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p07.md"
}
```

## 目的

specs/spec-analysis-hub.md の AC-001..AC-006 それぞれについて、P05 実装と P06 テスト結果を根拠に受入判定を行い、未充足があれば P05 への差し戻し対象として明記する。

## 背景

feature-execution-package-contract.md の P07 責務は受入判定であり、テストが green であることと利用者が定義した受入基準 (AC) を満たすことは同義ではないため、AC 単位の独立した突合が必要。

## 前提条件

- Entry gate: P06 の docs/analysis-hub/test-run.md が全件 pass を記録していること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P06

## Workstream applicability

主分類: Quality / 副分類: frontend, backend, documentation

- Frontend: applicable — AC-001 (ハブ画面構成), AC-002 (focus 保持・URL コピー), AC-005 (タブ短縮名・バッジ) のUI受入結果を検証する
- Backend: applicable — AC-003 (収支サマリー・前期間比), AC-004 (API 契約) のAPI/core受入結果を検証する
- API: N/A: 契約変更を伴わない受入検証のみで API 実装の変更を持たない
- Data: N/A: 受入検証のみでスキーマ変更を持たない
- Infrastructure: N/A: 受入検証のみで配信構成の変更を持たない
- Security: N/A: 本taskは認証境界を変更せず、AC-006 (focus 許可リスト) の検証結果はP04テストの合否を根拠として引用するに留める
- Quality: applicable — AC-001..AC-006 の受入判定が本taskの主責務
- Documentation: applicable — docs/analysis-hub/acceptance.md を新設する
- Operations: N/A: 受入検証のみで運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: N/A: 本taskはアーキテクチャ決定を行わない。P02 決定記録と P05 実装の整合を AC 単位で確認するのみ。
- Deploy unit: N/A: 受入検証記録のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/acceptance.md (AC-001..AC-006 各項目の受入判定と根拠)
- 参照する既存成果物 (Consumed artifacts): specs/spec-analysis-hub.md, docs/analysis-hub/test-run.md, packages/web/src/pages/Analysis.tsx
- Write scope: `docs/analysis-hub/acceptance.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P07 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- 受入未充足時の実装修正そのもの (P05 への差し戻し)
- 5 タブ詳細画面の受入判定 (本feature スコープ外)
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/acceptance.md`
- `grep -c 'AC-00' docs/analysis-hub/acceptance.md`
- Required evidence: docs/analysis-hub/acceptance.md に記載した AC-001..AC-006 各項目の判定 (pass/fail) と根拠へのリンク

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/acceptance.md を削除する。AC 未充足が判明した場合は P05 へ差し戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p07.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/index.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P06
