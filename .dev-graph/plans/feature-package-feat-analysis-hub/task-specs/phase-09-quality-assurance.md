# SYS-ANHUB-P09 支出分析ハブ 品質保証 (アクセシビリティ・性能予算・チェック系)

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P09",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P09",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "frontend",
    "infrastructure",
    "security",
    "operations"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P08"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p09.md"
}
```

## 目的

WCAG AA (色だけに頼らない優先度バッジ等)・URL への財務情報非露出・D1 読取り件数・check:js-budget・check:mobile-layout・check:financial-routes を横断で確認し、機能要件以外の品質基準を保証する。

## 背景

architecture-security.md は URL コピー内容の最小化を、architecture-infrastructure.md は D1 クエリ予算の遵守を、architecture-maintenance-ops.md は check:mobile-layout/check:financial-routes の対象への /analysis 追加を求める。これらは個別 AC に一対一対応しない横断品質基準のため独立 phase で保証する。

## 前提条件

- Entry gate: P08 のリファクタリングが完了し、docs/analysis-hub/refactoring.md が存在すること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P08

## Workstream applicability

主分類: Quality / 副分類: frontend, infrastructure, security, operations

- Frontend: applicable — WCAG AA (文字4.5:1・部品3:1) と、優先度を文字バッジで示し色だけに頼らないことを確認する
- Backend: applicable — GET /api/analysis/hub の D1 読取り本数が既存の予算内であることを確認する
- API: N/A: 契約変更を伴わない品質確認のみ
- Data: N/A: スキーマ変更なし
- Infrastructure: applicable — _headers の CSP 無変更確認と check:js-budget によるバンドル予算確認を行う
- Security: applicable — URL コピーに金額・取引・期間を含めないこと、未認証で200を返さないことを確認する
- Quality: applicable — 本task横断の品質保証が主責務
- Documentation: applicable — docs/analysis-hub/assurance.md を新設する
- Operations: applicable — 既存デプロイ経路 (ci.yml → deploy.yml) が変更されていないことを確認する

## Architecture and deploy unit

- Architecture decisions: N/A: 本taskはアーキテクチャ決定を行わない。既存の architecture-security.md / architecture-infrastructure.md / architecture-maintenance-ops.md の制約に対する遵守確認のみを行う。
- Deploy unit: N/A: 品質保証記録のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/assurance.md (WCAG AA・URL情報最小化・D1予算・js-budget・check:mobile-layout・check:financial-routes の確認結果)
- 参照する既存成果物 (Consumed artifacts): packages/web/src/pages/Analysis.tsx, packages/web/scripts/check-mobile-layout.mjs, packages/web/scripts/check-financial-visuals.mjs, packages/web/_headers
- Write scope: `docs/analysis-hub/assurance.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P09 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- 品質基準未達時の実装修正そのもの (P05/P08 への差し戻し)
- CSP・セキュリティヘッダーそのものの変更
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `pnpm --filter web run check:mobile-layout`
- `pnpm --filter web run check:financial-routes`
- `pnpm --filter web run check:js-budget`
- Required evidence: docs/analysis-hub/assurance.md に記載した各 check コマンドの実行結果 (exit code)

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/assurance.md を削除する。品質基準未達が判明した場合は該当 phase (P05/P08) へ差し戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p09.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/security.md
- system-spec/infrastructure.md
- system-spec/maintenance-ops.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P08
