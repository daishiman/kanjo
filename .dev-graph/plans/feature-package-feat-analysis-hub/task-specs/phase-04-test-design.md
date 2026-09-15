# SYS-ANHUB-P04 支出分析ハブ 先行失敗テストの設計と追加

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P04",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P04",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "frontend",
    "backend",
    "api"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P03"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p04.md"
}
```

## 目的

BR-001..BR-005 の判定規則 (優先度・マトリクス正常判定・改善余地・前期間比) の境界値、GET /api/analysis/hub の契約、ハブ画面の DOM 構成に対する失敗テストを実装前に追加し、AC-001..AC-006 を検証可能な形で先行固定する。

## 背景

architecture-maintenance-ops.md は『規則は名前の付いた関数とテストで表す』を保守性の基準とし、境界値テスト (要確認 0/1 件、未記録月 0/1、tradeoff 候補 0 件、前期間の欠け 0/1 か月) で規則を固定することを求める。P05 実装より先にテストを書き red 状態を確認することで、テストが旧実装や恒真条件を検証していないことを担保する。

## 前提条件

- Entry gate: P03 の docs/analysis-hub/design-review.md が指摘なし、または指摘が P02 へ反映済みであること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P03

## Workstream applicability

主分類: Quality / 副分類: frontend, backend, api

- Frontend: applicable — analysis-tabs/navigation-ux/common-shell-routes の DOM テストを新文言 (短縮タブ名) に更新する差分と、新規 analysis-hub.dom.test.tsx を失敗状態で追加する
- Backend: applicable — packages/core の境界値テスト (BR-001..BR-005) を失敗状態で追加する
- API: applicable — GET /api/analysis/hub の契約テスト (200/401/期間メタ) を失敗状態で追加する
- Data: N/A: スキーマ変更なしのためデータ層のテスト追加を持たない
- Infrastructure: N/A: 配信構成のテストを持たない
- Security: applicable — 未認証時 401 および focus 許可リスト外入力の既定値化を契約テストに含める
- Quality: applicable — 本task最大の責務。先行失敗テストにより旧実装や恒真条件を検算しないことを担保する
- Documentation: N/A: 本taskはテストコードのみで docs 追加を持たない (docs 化は P12)
- Operations: N/A: 運用手順のテストを持たない

## Architecture and deploy unit

- Architecture decisions: architecture-backend.md の core 集計関数契約、architecture-frontend.md の O1/O2/S3/O5 検証観点、architecture-security.md の許可リスト検証観点をテスト設計の入力とする。デプロイ単位は変更しない。
- Deploy unit: packages/core (Node ライブラリ), packages/api (Cloudflare Workers), packages/web (web ビルド) — いずれもテストコードのみでデプロイ物を追加しない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): packages/core/src/analysis-hub.test.ts, packages/api/src/analysis-hub.test.ts, packages/web/src/analysis-hub.dom.test.tsx (いずれも実装前は失敗する)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/architecture-decision.md, specs/spec-analysis-hub.md の AC-001..006
- Write scope: `packages/core/src/analysis-hub.test.ts`, `packages/api/src/analysis-hub.test.ts`, `packages/web/src/analysis-hub.dom.test.tsx`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P04 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- テストを通すための実装コードの変更 (P05 の責務)
- 5 タブ詳細画面のテストの作り直し
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `pnpm --filter core test -- analysis-hub 2>&1 | tail -5`
- `pnpm --filter api test -- analysis-hub 2>&1 | tail -5`
- `pnpm --filter web test -- analysis-hub.dom 2>&1 | tail -5`
- Required evidence: 追加した3テストファイルが実装前は red (失敗) であることを示す実行ログ

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: 追加した3テストファイルを削除する。既存の analysis-tabs/navigation-ux/common-shell-routes テストは変更前の文言に戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p04.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/backend.md
- system-spec/frontend.md
- system-spec/maintenance-ops.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P03
