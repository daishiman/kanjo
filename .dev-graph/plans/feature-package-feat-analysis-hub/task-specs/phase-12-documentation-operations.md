# SYS-ANHUB-P12 支出分析ハブ 運用ドキュメントの更新 (ui-decisions・既存テスト文言)

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P12",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P12",
  "workstream_kind": "documentation",
  "secondary_workstreams": [
    "frontend",
    "quality"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P11"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p12.md"
}
```

## 目的

architecture-frontend.md が定める C3 例外 (ハブ API が表示していないタブの API を呼ばない原則の例外であること) を docs/ui-decisions.md に明記し、既存の analysis-tabs/navigation-ux/common-shell-routes DOM テストの文言を新タブ短縮名に更新して、規約とテストの対応を運用可能な状態にする。

## 背景

architecture-frontend.md の Constraints C3 は『ハブ API は例外として docs/ui-decisions.md に明記する』ことを求め、architecture-maintenance-ops.md の qa-analysis-hub-decision-004 は更新対象の DOM テストを analysis-tabs/navigation-ux/common-shell-routes の3件に限定している。P04 で先行追加したテスト差分を P12 で正式な運用ドキュメントとして確定する。

## 前提条件

- Entry gate: P11 の docs/analysis-hub/evidence.md が存在すること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P11

## Workstream applicability

主分類: Documentation / 副分類: frontend, quality

- Frontend: applicable — docs/ui-decisions.md への C3 例外記載がフロントエンド規約として既存実装に反映される
- Backend: N/A: 実装済みロジックへの追加変更なし
- API: N/A: 実装済みロジックへの追加変更なし
- Data: N/A: スキーマ変更なし
- Infrastructure: N/A: 配信構成の変更なし
- Security: N/A: セキュリティ設計の変更なし (P02/P05 で確定済み)
- Quality: applicable — 判定規則とテストの対応付けを docs へ反映し、3件のDOMテスト文言更新が既存テストと矛盾しないことを確認する
- Documentation: applicable — 本taskの主責務。docs/ui-decisions.md の更新
- Operations: N/A: 運用手順 (CI段階等) の変更なし

## Architecture and deploy unit

- Architecture decisions: architecture-frontend.md の C3 例外方針を docs/ui-decisions.md に反映する。デプロイ単位は docs (リポジトリ直下) と packages/web (テストのみ) で、実行時の配布物は変更しない。
- Deploy unit: docs (リポジトリ直下ドキュメント), packages/web (既存DOMテストの文言更新)
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/ui-decisions.md (C3 例外の追記), 3件の既存 DOM テストファイル (新タブ短縮名への文言更新差分の確定)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/architecture-decision.md, architecture/analysis-hub-frontend.md, packages/web/src/analysis-hub.dom.test.tsx (P04/P05 の実装済みテスト)
- Write scope: `docs/ui-decisions.md`, `packages/web/src/analysis-tabs.dom.test.tsx`, `packages/web/src/navigation-ux.dom.test.tsx`, `packages/web/src/common-shell-routes.dom.test.tsx`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P12 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- docs/ui-decisions.md 以外の運用ドキュメントの新設
- テスト以外の実装コードの変更
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `pnpm --filter web test -- analysis-tabs navigation-ux common-shell-routes`
- `grep -n 'C3' docs/ui-decisions.md`
- Required evidence: docs/ui-decisions.md の diff、3件のDOMテストが新文言で green であることの実行ログ

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/ui-decisions.md への追記を取り消し、3件のDOMテストを旧文言に戻す。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p12.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/frontend.md
- system-spec/maintenance-ops.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P11
