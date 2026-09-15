# SYS-ANHUB-P01 支出分析ハブ 要件ベースラインの確定

## Machine-readable registration fields

```json
{
  "id": "SYS-ANHUB-P01",
  "feature_package_id": "feature-package/feat-analysis-hub",
  "parent_feature": "feat-analysis-hub",
  "phase_ref": "P01",
  "workstream_kind": "documentation",
  "secondary_workstreams": [
    "quality"
  ],
  "build_target_kind": "application-code",
  "depends_on": [],
  "tracker_binding_intent": "beads",
  "graph_node_registration_file_path": "tasks/feat-analysis-hub/sys-anhub-p01.md"
}
```

## 目的

specs/spec-analysis-hub.md の FR-001..FR-006・BR-001..BR-005・AC-001..AC-006・非機能要件・確定意思決定を単一のベースライン文書に写し取り、後続 P02..P13 が参照する要件の正本を固定する。

## 背景

feature-execution-package-contract.md の P01 責務は要件ベースラインの確定であり、system-spec/00-requirements-definition.md と specs/spec-analysis-hub.md の 2 正本間の要件差分が後続 phase に紛れ込むと実装粒度が曖昧になる。本 feature は既存の /analysis 画面を照合タブへの転送からハブへ置き換える変更であり、要件を 1 度固定してから設計へ進む必要がある。

## 前提条件

- Entry gate: spec-analysis-hub.md の confirmation_status=confirmed かつ evaluation_status=pass、features/feat-analysis-hub.context.json の digest が起動時指定 (sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f) と一致していること。
- Source pin: source_feature_digest=sha256:dacba5d1016d278f40dd8d70ea86621422af0addaa4362cc639a6cb2713a711f (features/feat-analysis-hub.context.json と一致すること。本 digest は変更しない)
- Repository context: repo_identity=github:daishiman/kanjo, config_path=.dev-graph/config.json
- 依存 task: なし (P01 は本feature package の起点であり先行 taskを持たない)

## Workstream applicability

主分類: Documentation / 副分類: quality

- Frontend: N/A: 本taskは要件文書化のみで実装コード変更を持たない
- Backend: N/A: 本taskは要件文書化のみで実装コード変更を持たない
- API: N/A: 本taskは要件文書化のみで実装コード変更を持たない
- Data: N/A: 本taskは要件文書化のみでスキーマ変更を持たない
- Infrastructure: N/A: 本taskは配信構成の変更を持たない
- Security: N/A: 本taskは認可・データ保護方針の変更を持たない
- Quality: applicable — 後続 P04 のテスト対象範囲 (FR/BR/AC コード一覧) を requirements-baseline.md から導出する
- Documentation: applicable — docs/analysis-hub/requirements-baseline.md を新設し FR/BR/AC を単一文書へ集約する
- Operations: N/A: 本taskは運用手順の変更を持たない

## Architecture and deploy unit

- Architecture decisions: N/A: 本taskはアーキテクチャ決定を行わない。要件の写し取りのみを行う。
- Deploy unit: N/A: ドキュメント成果物のみでビルド・デプロイ単位を持たない
- Compatibility/migration: D1 migration を伴わない (本feature 全体で確定済み)。既存 API 契約 (/analysis/:tab, LEGACY_ROUTE_REDIRECTS) は維持する。

## 成果物

- 生成物 (Produced artifacts): docs/analysis-hub/requirements-baseline.md (FR-001..FR-006, BR-001..BR-005, AC-001..AC-006, 非機能要件, 未決事項, 確定意思決定の一覧)
- 参照する既存成果物 (Consumed artifacts): specs/spec-analysis-hub.md, features/feat-analysis-hub.md
- Write scope: `docs/analysis-hub/requirements-baseline.md`

## Tracker publication and completion

- tracker_binding_intent: beads (.dev-graph/config.json の execution_tracker.mode=beads と features/feat-analysis-hub.md の tracker_binding=beads に一致)
- github_publication.mode: local_only (project_aliases/labels/milestone は本サイクルでは未設定)
- pr_completion_policy: linked_pr_merged_all
- PR 本文契約: PR は本 task の write_scope に記載したファイルのみを変更し、verification コマンドの実行結果を PR 本文に含める。
- Ownership boundary: 永続 tracker_binding への解決と起票は dev-graph 側が所有し、本 task-spec は intent 宣言のみを行う。

## Branch and worktree execution

- Branch: one-task-one-branch 戦略に従い、SYS-ANHUB-P01 専用ブランチで作業する。
- Worktree lease: worktree_lease_required=true。dev-graph-scheduler が発行する lease の下で実行する。
- Parallel safety: write_scope は他 12 task の write_scope と重複しないため、並列実行時の衝突を生じない。
- Completion projection: default-branch-reconciliation (既定ブランチへの反映をもって完了とみなす)。

## スコープ外

- 実装コードの変更
- アーキテクチャ決定の新設 (P02 の責務)
- 未決事項 (staleTime 値・bundled decision 分割・推論残存箇所) の確定または推測による解決
- 別 feature の task の生成・変更 (本 feature package は feat-analysis-hub のみを対象とする)

## Verification and evidence

- Automated commands:
- `test -f docs/analysis-hub/requirements-baseline.md`
- `grep -c 'FR-00' docs/analysis-hub/requirements-baseline.md`
- Required evidence: docs/analysis-hub/requirements-baseline.md の diff、および FR/BR/AC 各コードが specs/spec-analysis-hub.md と一致することの目視突合結果

## Rollout and rollback

- Rollout: 本 task の write_scope 変更を含む PR を作成し、verification コマンドが成功したことを確認した上で default branch へ反映する。
- Rollback trigger and steps: docs/analysis-hub/requirements-baseline.md を削除する。他 phase の成果物に依存されないため巻き戻しの副作用はない。

## Handoff

- Executor: dev-graph の task-graph build ルート (build_target_kind=application-code のため task-graph build/capability-build へ汎用 handoff される)。
- Ready when: 本 task の acceptance 項目と verification コマンドがすべて成功し、graph_node_registration.file_path (tasks/feat-analysis-hub/sys-anhub-p01.md) への登録準備が整った状態。

## 参照情報

- System specification: specs/spec-analysis-hub.md
- Architecture (system-spec-harness lineage):
- system-spec/index.md
- system-spec/00-requirements-definition.md
- Feature: features/feat-analysis-hub.md
- Phase document: N/A: 本 plan 契約は P01..P13 の task-spec 以外に別の lifecycle 文書を持たない (references/feature-execution-package-contract.md)
- Dependencies: なし (P01 は本feature package の起点であり先行 taskを持たない)
