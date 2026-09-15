# SYS-ANHUB-P08 支出分析ハブ previousPeriod 重複実装の除去

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P08",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P08",
  "workstream_kind": "backend",
  "secondary_workstreams": [
    "quality",
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P07"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p08.md"
}
```

## 目的

P05 で packages/core へ移設した previousPeriod 判定ロジックについて、移設元の packages/api/src/ai/dataset.ts に残る重複実装を除去し、core の実装を単一の正本にする。

## 背景

architecture-backend.md の qa-analysis-hub-decision-002/003 は previousPeriod の core への移設を決定しており、移設後に旧実装を残すと2つの正本が並存し将来の齟齬の温床になる。

## 前提条件

- Entry gate: P07 の docs/analysis-hub/acceptance.md で AC-003/AC-004 が pass 判定済みであること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P07

## Workstream applicability

主分類: Backend / 副分類: quality, documentation

- Frontend: N/A: 本taskは api 側の整理のみでフロントエンド実装を持たない
- Backend: applicable — packages/api/src/ai/dataset.ts の previousPeriod 重複実装を除去し packages/core の関数呼び出しへ置換する
- API: N/A: route 契約 (GET /api/analysis/hub 等) は変更しない
- Data: N/A: スキーマ変更を持たない
- Infrastructure: N/A: 配信構成の変更を持たない
- Security: N/A: 認可境界の変更を持たない
- Quality: applicable — 置換後に既存 ai/dataset 関連テストと P04/P05 のテストが green のまま維持されることを確認する
- Documentation: applicable — docs/analysis-hub/refactoring.md を新設し置換内容を記録する
- Operations: N/A: 運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: qa-analysis-hub-decision-002/003 に従い previousPeriod の正本を packages/core に一本化する。デプロイ単位 packages/api は変更内容が内部実装の置換のみのため契約を変えない。
- Deploy unit: packages/api (Cloudflare Workers)
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): packages/api/src/ai/dataset.ts (previousPeriod 重複実装を除去し core 呼び出しへ置換した差分), docs/analysis-hub/refactoring.md
- 参照する既存成果物 (Consumed artifacts): packages/core/src/analysis-hub.ts, packages/api/src/ai/dataset.ts の既存実装
- Write scope: `packages/api/src/ai/dataset.ts`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P08 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- previousPeriod 以外の api/ai/dataset.ts のロジックの変更
- API 契約の変更
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `pnpm --filter api test`
- `pnpm typecheck`
- `grep -n 'previousPeriod' packages/api/src/ai/dataset.ts`
- Required evidence: docs/analysis-hub/refactoring.md の diff、置換後の pnpm --filter api test 成功ログ

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: packages/api/src/ai/dataset.ts を本task直前の状態 (previousPeriod 実装を保持した状態) へ差し戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p08.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/backend.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P07
