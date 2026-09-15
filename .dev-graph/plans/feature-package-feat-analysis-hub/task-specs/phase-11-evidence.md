# SYS-ANHUB-P11 支出分析ハブ 証跡の集約

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P11",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P11",
  "workstream_kind": "quality",
  "secondary_workstreams": [
    "documentation"
  ],
  "build_target_kind": "application-code",
  "depends_on": [
    "SYS-ANHUB-P10"
  ],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p11.md"
}
```

## 目的

P01..P10 で生成した全 docs/analysis-hub/*.md とテスト実行ログへの参照を1つの証跡索引にまとめ、P12 のドキュメント更新と P13 のリリース判断が参照できる状態にする。

## 背景

feature-execution-package-contract.md の P11 責務は証跡の集約であり、P01..P10 の各 phase 記録が分散したままだと P13 のリリース判断時に参照漏れが生じる。

## 前提条件

- Entry gate: P10 の docs/analysis-hub/final-review.md が pass 判定を記録していること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: SYS-ANHUB-P10

## Workstream applicability

主分類: Quality / 副分類: documentation

- Frontend: N/A: 証跡集約のみで実装コード変更を持たない
- Backend: N/A: 証跡集約のみで実装コード変更を持たない
- API: N/A: 証跡集約のみで実装コード変更を持たない
- Data: N/A: 証跡集約のみでスキーマ変更を持たない
- Infrastructure: N/A: 証跡集約のみで配信構成の変更を持たない
- Security: N/A: 証跡集約のみでセキュリティ設計変更を持たない
- Quality: applicable — P01..P10 の全証跡を索引化することが本taskの主責務
- Documentation: applicable — docs/analysis-hub/evidence.md を新設する
- Operations: N/A: 証跡集約のみで運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: N/A: 本taskはアーキテクチャ決定を行わない。証跡の索引化のみを行う。
- Deploy unit: N/A: 証跡集約のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/evidence.md (P01..P10 の全成果物パスとテスト実行ログ参照の索引)
- 参照する既存成果物 (Consumed artifacts): docs/analysis-hub/requirements-baseline.md, docs/analysis-hub/architecture-decision.md, docs/analysis-hub/design-review.md, docs/analysis-hub/test-run.md, docs/analysis-hub/acceptance.md, docs/analysis-hub/refactoring.md, docs/analysis-hub/assurance.md, docs/analysis-hub/final-review.md
- Write scope: `docs/analysis-hub/evidence.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P11 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- 証跡の再生成 (各 phase での再実行はしない、既存記録への参照に留める)
- 新たな検証の実施
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/evidence.md`
- `grep -c 'docs/analysis-hub/' docs/analysis-hub/evidence.md`
- Required evidence: docs/analysis-hub/evidence.md が P01..P10 の8ファイルすべてへの参照を含むこと

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/evidence.md を削除する。他成果物への参照のみで実体を持たないため副作用はない。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p11.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/index.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: SYS-ANHUB-P10
